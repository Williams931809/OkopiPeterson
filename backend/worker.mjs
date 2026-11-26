const sizes = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
const encoder = new TextEncoder()
const productId = /^[a-z0-9][a-z0-9-]{0,63}$/
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Send an application/json body.')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, 'A JSON body is required.')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let body = ''
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 16384) {
        await reader.cancel()
        throw new RequestError(413, 'Request body is too large.')
      }
      body += decoder.decode(value, { stream: true })
    }
    const data = JSON.parse(body + decoder.decode())
    if (data && typeof data === 'object' && !Array.isArray(data)) return data
  } catch (error) {
    if (error instanceof RequestError) throw error
  } finally {
    reader.releaseLock()
  }
  throw new RequestError(400, 'Send a valid JSON object.')
}

const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value))
const hex = buffer => Array.from(new Uint8Array(buffer), byte =>
  byte.toString(16).padStart(2, '0')).join('')

async function requireAdmin(request, env) {
  if (!env.ADMIN_API_TOKEN || env.ADMIN_API_TOKEN.length < 32) {
    throw new RequestError(503, 'Admin access is not configured.')
  }
  const candidate = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]
  if (!candidate || candidate.length > 512 ||
      !crypto.subtle.timingSafeEqual(await digest(candidate), await digest(env.ADMIN_API_TOKEN))) {
    throw new RequestError(401, 'Admin authorization is required.')
  }
}

function field(value, max, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new RequestError(400, 'Invalid product fields.')
  }
  return value.trim()
}

async function saveProduct(request, db, id) {
  const data = await readJson(request)
  const name = field(data.name, 150)
  const category = field(data.category, 80)
  const description = field(data.description ?? '', 4000, false)
  const imageUrl = field(data.image_url ?? '', 1000, false)
  if (imageUrl && !URL.canParse(imageUrl)) throw new RequestError(400, 'Invalid image URL.')
  if (imageUrl && new URL(imageUrl).protocol !== 'https:') {
    throw new RequestError(400, 'Image URLs must use HTTPS.')
  }
  if (!Number.isSafeInteger(data.price_minor) || data.price_minor < 1 ||
      data.price_minor > 100000000000 || typeof data.active !== 'boolean') {
    throw new RequestError(400, 'Provide a valid price in kobo and an active flag.')
  }
  return db.prepare(`
    INSERT INTO products (id, name, category, description, image_url, price_minor, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category,
      description=excluded.description, image_url=excluded.image_url,
      price_minor=excluded.price_minor, active=excluded.active, updated_at=CURRENT_TIMESTAMP
    RETURNING *
  `).bind(id, name, category, description, imageUrl, data.price_minor, Number(data.active)).first()
}

async function createOrder(request, db) {
  const key = request.headers.get('Idempotency-Key')?.toLowerCase()
  if (!key || !uuid.test(key)) throw new RequestError(400, 'Provide a UUID v4 Idempotency-Key.')
  const data = await readJson(request)
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError(400, 'Provide a valid email address.')
  }
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) {
    throw new RequestError(400, 'An order must contain 1 to 20 line items.')
  }
  const items = new Map()
  for (const item of data.items) {
    if (typeof item?.id !== 'string' || !productId.test(item.id) || !sizes.has(item.size) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new RequestError(400, 'Invalid product, size, or quantity.')
    }
    const lineKey = `${item.id}:${item.size}`
    const quantity = (items.get(lineKey)?.quantity ?? 0) + item.quantity
    if (quantity > 10) throw new RequestError(400, 'Limit of 10 per product and size.')
    items.set(lineKey, { id: item.id, size: item.size, quantity })
  }
  const lines = JSON.stringify([...items.keys()].sort().map(key => items.get(key)))
  const hash = hex(await digest(JSON.stringify([email, lines])))
  const receipt = 'id, currency, total_minor, status, created_at'
  const order = await db.prepare(`
    WITH cart AS (
      SELECT json_extract(value, '$.id') AS id,
             json_extract(value, '$.size') AS size,
             json_extract(value, '$.quantity') AS quantity
      FROM json_each(?)
    )
    INSERT INTO orders (id, idempotency_key, request_hash, customer_email, total_minor, items_json)
    SELECT ?, ?, ?, ?, SUM(p.price_minor * c.quantity),
      json_group_array(json_object('id', p.id, 'name', p.name, 'size', c.size,
        'quantity', c.quantity, 'unit_price_minor', p.price_minor))
    FROM cart c JOIN products p ON p.id = c.id AND p.active = 1
    HAVING COUNT(*) = (SELECT COUNT(*) FROM cart)
    ON CONFLICT(idempotency_key) DO NOTHING
    RETURNING ${receipt}
  `).bind(lines, crypto.randomUUID(), key, hash, email).first()

  if (order) return Response.json({ order }, { status: 201 })
  const previous = await db.prepare(`
    SELECT ${receipt}, request_hash FROM orders WHERE idempotency_key = ?
  `).bind(key).first()
  if (!previous) throw new RequestError(409, 'One or more products are unavailable.')
  if (previous.request_hash !== hash) throw new RequestError(409, 'Order key already used.')
  const { request_hash: ignored, ...existing } = previous
  return Response.json({ order: existing })
}

async function route(request, env) {
  const { pathname, searchParams } = new URL(request.url)
  const method = request.method
  if (pathname === '/health' && method === 'GET') {
    await env.DB.prepare('SELECT 1 FROM products LIMIT 1').all()
    await env.DB.prepare('SELECT 1 FROM orders LIMIT 1').all()
    return Response.json({ status: 'ok' })
  }
  if (pathname === '/api/products' && method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT id, name, category, description, image_url, price_minor
      FROM products WHERE active = 1 ORDER BY name, id
    `).all()
    return Response.json({ currency: 'NGN', products: results })
  }
  if (pathname === '/api/orders' && method === 'POST') {
    if (env.ORDERS_ENABLED !== 'true') throw new RequestError(503, 'Ordering is closed.')
    return createOrder(request, env.DB)
  }
  if (pathname.startsWith('/api/admin/')) {
    await requireAdmin(request, env)
    if (pathname === '/api/admin/products' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY name, id').all()
      return Response.json({ products: results })
    }
    const id = pathname.slice('/api/admin/products/'.length)
    if (pathname.startsWith('/api/admin/products/') && productId.test(id) && method === 'PUT') {
      return Response.json({ product: await saveProduct(request, env.DB, id) })
    }
    if (pathname === '/api/admin/orders' && method === 'GET') {
      const page = Number(searchParams.get('page') ?? 1)
      if (!Number.isInteger(page) || page < 1 || page > 100000) {
        throw new RequestError(400, 'Invalid page.')
      }
      const { results } = await env.DB.prepare(`
        SELECT id, customer_email, currency, total_minor, items_json, status,
               payment_reference, created_at
        FROM orders ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET ?
      `).bind((page - 1) * 50).all()
      return Response.json({
        orders: results.slice(0, 50).map(({ items_json, ...order }) =>
          ({ ...order, items: JSON.parse(items_json) })),
        page,
        has_more: results.length > 50,
      })
    }
    const cancellation = /^\/api\/admin\/orders\/([^/]+)\/cancel$/.exec(pathname)
    if (cancellation && uuid.test(cancellation[1]) && method === 'POST') {
      const order = await env.DB.prepare(`
        UPDATE orders SET status = 'cancelled'
        WHERE id = ? AND status IN ('pending_payment', 'cancelled')
        RETURNING id, status
      `).bind(cancellation[1]).first()
      if (!order) throw new RequestError(409, 'Order cannot be cancelled.')
      return Response.json({ order })
    }
  }
  throw new RequestError(404, 'Endpoint not found.')
}

export default {
  async fetch(request, env) {
    let response
    try {
      response = await route(request, env)
    } catch (error) {
      if (error instanceof RequestError) {
        response = Response.json({ error: error.message }, { status: error.status })
      } else {
        console.error(JSON.stringify({ event: 'maisonpe_request_failed', type: error.name }))
        response = Response.json({ error: 'Service temporarily unavailable.' }, { status: 500 })
      }
    }
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    return response
  },
}
