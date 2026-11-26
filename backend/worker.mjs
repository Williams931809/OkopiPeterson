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

async function readJson(request, raw = false) {
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
    body += decoder.decode()
    if (raw) return body
    const data = JSON.parse(body)
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
  const videoUrl = data.video_url === undefined ? null : field(data.video_url, 1000, false)
  if (videoUrl && (!URL.canParse(videoUrl) || new URL(videoUrl).protocol !== 'https:')) {
    throw new RequestError(400, 'Video URLs must use HTTPS.')
  }
  if (imageUrl && !URL.canParse(imageUrl)) throw new RequestError(400, 'Invalid image URL.')
  if (imageUrl && new URL(imageUrl).protocol !== 'https:') {
    throw new RequestError(400, 'Image URLs must use HTTPS.')
  }
  if (!Number.isSafeInteger(data.price_minor) || data.price_minor < 1 ||
      data.price_minor > 100000000000 || typeof data.active !== 'boolean') {
    throw new RequestError(400, 'Provide a valid price in kobo and an active flag.')
  }
  return db.prepare(`
    INSERT INTO products (id, name, category, description, image_url, video_url, price_minor, active)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, ''), ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category,
      description=excluded.description, image_url=excluded.image_url,
      video_url=COALESCE(?, products.video_url), price_minor=excluded.price_minor, active=excluded.active, updated_at=CURRENT_TIMESTAMP
    RETURNING *
  `).bind(id, name, category, description, imageUrl, videoUrl, data.price_minor, Number(data.active), videoUrl).first()
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
  const name = field(data.name, 120)
  const phone = field(data.phone, 30)
  const address = field(data.address, 500)
  if (!/^[+0-9 ()-]{7,30}$/.test(phone)) throw new RequestError(400, 'Enter a valid phone number.')
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
  const hash = hex(await digest(JSON.stringify([email, name, phone, address, lines])))
  const receipt = 'id, currency, total_minor, status, created_at, checkout_state, checkout_url, payment_mode'
  const order = await db.prepare(`
    WITH cart AS (
      SELECT json_extract(value, '$.id') AS id,
             json_extract(value, '$.size') AS size,
             json_extract(value, '$.quantity') AS quantity
      FROM json_each(?)
    )
    INSERT INTO orders (id, idempotency_key, request_hash, customer_email, customer_name, customer_phone, shipping_address, total_minor, items_json)
    SELECT ?, ?, ?, ?, ?, ?, ?, SUM(p.price_minor * c.quantity),
      json_group_array(json_object('id', p.id, 'name', p.name, 'size', c.size,
        'quantity', c.quantity, 'unit_price_minor', p.price_minor))
    FROM cart c JOIN products p ON p.id = c.id AND p.active = 1
    HAVING COUNT(*) = (SELECT COUNT(*) FROM cart)
    ON CONFLICT(idempotency_key) DO NOTHING
    RETURNING ${receipt}
  `).bind(lines, crypto.randomUUID(), key, hash, email, name, phone, address).first()

  if (order) return { order, email, name, phone }
  const previous = await db.prepare(`
    SELECT ${receipt}, request_hash FROM orders WHERE idempotency_key = ?
  `).bind(key).first()
  if (!previous) throw new RequestError(409, 'One or more products are unavailable.')
  if (previous.request_hash !== hash) throw new RequestError(409, 'Order key already used.')
  const { request_hash: ignored, ...existing } = previous
  return { order: existing, email, name, phone }
}

const paymentMode = env => env.FLW_MODE === 'live' ? 'live' : 'test'

function paymentsReady(env) {
  const secret = env.FLW_SECRET_KEY ?? ''
  const correctKey = paymentMode(env) === 'test'
    ? secret.startsWith('FLWSECK_TEST-')
    : secret.startsWith('FLWSECK-') && !secret.startsWith('FLWSECK_TEST-')
  return Boolean(correctKey && env.FLW_WEBHOOK_SECRET && env.STOREFRONT_ORIGIN && env.WORKER_ORIGIN)
}

async function flutterwave(env, path, body) {
  const response = await fetch('https://api.flutterwave.com/v3' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + env.FLW_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  })
  const result = await response.json()
  if (!response.ok || result.status !== 'success') {
    throw new RequestError(502, 'Flutterwave is temporarily unavailable.')
  }
  return result.data
}

async function startCheckout(request, env) {
  const { order, email, name, phone } = await createOrder(request, env.DB)
  const mode = paymentMode(env)
  if (order.status !== 'pending_payment' || (order.payment_mode && order.payment_mode !== mode)) {
    throw new RequestError(409, 'Start a new checkout for this bag.')
  }
  if (order.checkout_url) return Response.json({ url: order.checkout_url, order: order.id })
  const claimed = await env.DB.prepare(`
    UPDATE orders SET checkout_state = 'starting', payment_mode = ?
    WHERE id = ? AND status = 'pending_payment' AND checkout_state IS NULL RETURNING id
  `).bind(mode, order.id).first()
  if (!claimed) throw new RequestError(409, 'This checkout is already processing.')
  const data = await flutterwave(env, '/payments', {
    amount: (order.total_minor / 100).toFixed(2),
    currency: order.currency,
    tx_ref: order.id,
    redirect_url: new URL('/payments/flutterwave/return', env.WORKER_ORIGIN).href,
    customer: { email, name, phonenumber: phone },
    customizations: { title: 'Maisonpé' },
    configurations: { session_duration: 30, max_retry_attempt: 3 },
  })
  const url = new URL(data.link)
  if (url.origin !== 'https://checkout.flutterwave.com') {
    throw new RequestError(502, 'Unexpected checkout destination.')
  }
  await env.DB.prepare("UPDATE orders SET checkout_state = 'ready', checkout_url = ? WHERE id = ?")
    .bind(url.href, order.id).run()
  return Response.json({ url: url.href, order: order.id })
}

function amountInKobo(value) {
  const parts = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!parts) return NaN
  return Number(parts[1]) * 100 + Number((parts[2] ?? '').padEnd(2, '0'))
}

async function verifyPayment(env, reference, transactionId) {
  if (!paymentsReady(env)) throw new RequestError(503, 'Payment verification is unavailable.')
  const order = await env.DB.prepare(`
    SELECT id, currency, total_minor, status, payment_reference, payment_mode
    FROM orders WHERE id = ?
  `).bind(reference).first()
  if (!order || order.payment_mode !== paymentMode(env)) return
  if (order.status === 'paid' && order.payment_reference === transactionId) return
  const payment = await flutterwave(env, '/transactions/' + transactionId + '/verify')
  if (String(payment.id) !== transactionId || payment.tx_ref !== order.id ||
      payment.status !== 'successful' || payment.currency !== order.currency ||
      amountInKobo(payment.amount) !== order.total_minor) return
  await env.DB.prepare(`
    UPDATE orders SET status = 'paid', payment_reference = ?
    WHERE id = ? AND status = 'pending_payment'
      AND NOT EXISTS (SELECT 1 FROM orders WHERE payment_reference = ?)
  `).bind(transactionId, order.id, transactionId).run()
}

async function receiveWebhook(request, env) {
  if (!env.FLW_WEBHOOK_SECRET) throw new RequestError(503, 'Webhook is unavailable.')
  const raw = await readJson(request, true)
  const signature = request.headers.get('flutterwave-signature') ?? ''
  const legacy = request.headers.get('verif-hash') ?? ''
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(env.FLW_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(raw))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  const valid = signature
    ? crypto.subtle.timingSafeEqual(await digest(signature), await digest(expected))
    : Boolean(legacy && crypto.subtle.timingSafeEqual(await digest(legacy), await digest(env.FLW_WEBHOOK_SECRET)))
  if (!valid) throw new RequestError(401, 'Invalid webhook signature.')
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new RequestError(400, 'Invalid webhook body.')
  }
  const reference = payload?.data?.tx_ref ?? ''
  const transactionId = String(payload?.data?.id ?? '')
  if ((payload.event === 'charge.completed' || payload.type === 'charge.completed') &&
      uuid.test(reference) && /^\d{1,20}$/.test(transactionId)) {
    await verifyPayment(env, reference, transactionId)
  }
  return new Response(null, { status: 200 })
}

const mediaTypes = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
  ['image/avif', 'avif'], ['video/mp4', 'mp4'], ['video/webm', 'webm'],
])
const mediaKey = /^[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4|webm)$/
const settingsKeys = new Set([
  'settings', 'pages', 'discounts', 'campaigns', 'navigation', 'email', 'forms',
  'seo', 'shipping', 'returns', 'automation', 'staff', 'activity',
])

function validMediaHeader(bytes, type) {
  const ascii = (offset, count) => String.fromCharCode(...bytes.slice(offset, offset + count))
  switch (type) {
    case 'image/jpeg': return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    case 'image/png': return bytes[0] === 137 && ascii(1, 7) === 'PNG\r\n\x1a\n'
    case 'image/webp': return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
    case 'image/avif': return ascii(4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 4))
    case 'video/mp4': return ascii(4, 4) === 'ftyp'
    case 'video/webm': return bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163
    default: return false
  }
}

async function uploadMedia(request, env) {
  const type = request.headers.get('Content-Type')
  const extension = mediaTypes.get(type)
  if (!extension) throw new RequestError(415, 'Choose a JPEG, PNG, WebP, AVIF, MP4 or WebM file.')
  const length = Number(request.headers.get('Content-Length'))
  const max = type.startsWith('video/') ? 50 * 1024 ** 2 : 10 * 1024 ** 2
  if (!request.body || !Number.isSafeInteger(length) || length < 12 || length > max) {
    throw new RequestError(413, 'Images can be up to 10 MB and videos up to 50 MB.')
  }
  const reader = request.body.getReader()
  const initial = []
  let size = 0
  while (size < 12) {
    const { done, value } = await reader.read()
    if (done) break
    initial.push(value)
    size += value.byteLength
  }
  const header = Uint8Array.from(initial.flatMap(chunk => Array.from(chunk.subarray(0, 12))).slice(0, 12))
  if (!validMediaHeader(header, type)) {
    await reader.cancel()
    throw new RequestError(415, 'The file contents do not match the selected media type.')
  }
  const stream = new FixedLengthStream(length)
  const source = new ReadableStream({
    async pull(controller) {
      if (initial.length) return controller.enqueue(initial.shift())
      const { done, value } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel: reason => reader.cancel(reason),
  })
  const id = crypto.randomUUID() + '.' + extension
  const object = { httpMetadata: { contentType: type } }
  await Promise.all([source.pipeTo(stream.writable), env.MEDIA.put(id, stream.readable, object)])
  return Response.json({ url: new URL('/media/' + id, env.WORKER_ORIGIN).href, type }, { status: 201 })
}

async function serveMedia(request, env, id) {
  const object = request.method === 'HEAD'
    ? await env.MEDIA.head(id)
    : await env.MEDIA.get(id, { range: request.headers })
  if (!object) throw new RequestError(404, 'Media not found.')
  const headers = new Headers({ 'Accept-Ranges': 'bytes', ETag: object.httpEtag })
  object.writeHttpMetadata(headers)
  headers.set('Content-Length', String(object.range?.length ?? object.size))
  const partial = Boolean(request.headers.has('Range') && object.range?.length)
  if (partial) {
    const start = object.range.offset ?? object.size - object.range.length
    headers.set('Content-Range', 'bytes ' + start + '-' + (start + object.range.length - 1) + '/' + object.size)
  }
  return new Response(object.body ?? null, { status: partial ? 206 : 200, headers })
}

async function saveSetting(request, db, name) {
  const { value, version } = await readJson(request)
  if (!Number.isInteger(version) || version < 0 || !value || typeof value !== 'object' ||
      (name === 'settings' ? Array.isArray(value) : !Array.isArray(value))) {
    throw new RequestError(400, 'Invalid settings record.')
  }
  const encoded = JSON.stringify(value)
  const query = version === 0
    ? db.prepare('INSERT INTO admin_settings(name,value) VALUES(?,?) ON CONFLICT DO NOTHING RETURNING version').bind(name, encoded)
    : db.prepare('UPDATE admin_settings SET value=?,version=version+1 WHERE name=? AND version=? RETURNING version').bind(encoded,name,version)
  const saved = await query.first()
  if (!saved) throw new RequestError(409, 'This section changed. Reload before saving.')
  return Response.json(saved)
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
      SELECT id, name, category, description, image_url, video_url, price_minor
      FROM products WHERE active = 1 ORDER BY name, id
    `).all()
    return Response.json({ currency: 'NGN', products: results, checkout_enabled: paymentsReady(env), payment_mode: paymentMode(env) })
  }
  if (pathname === '/api/orders' && method === 'POST') {
    if (!paymentsReady(env)) throw new RequestError(503, 'Online checkout is unavailable.')
    return startCheckout(request, env)
  }
  if (pathname === '/payments/flutterwave/return' && method === 'GET') {
    const reference = searchParams.get('tx_ref') ?? ''
    const transactionId = searchParams.get('transaction_id') ?? ''
    if (uuid.test(reference) && /^\d{1,20}$/.test(transactionId)) {
      try {
        await verifyPayment(env, reference, transactionId)
      } catch {
        console.error(JSON.stringify({ event: 'flutterwave_return_verification_pending' }))
      }
    }
    const target = new URL('/payment.html', env.STOREFRONT_ORIGIN)
    if (uuid.test(reference)) target.searchParams.set('order', reference)
    return new Response(null, { status: 303, headers: { Location: target.href } })
  }
  if (pathname === '/payments/flutterwave/webhook' && method === 'POST') {
    return receiveWebhook(request, env)
  }
  const status = /^\/api\/orders\/([^/]+)$/.exec(pathname)
  if (status && uuid.test(status[1]) && method === 'GET') {
    const order = await env.DB.prepare('SELECT status, payment_mode FROM orders WHERE id = ?')
      .bind(status[1]).first()
    if (!order) throw new RequestError(404, 'Order not found.')
    return Response.json({ order })
  }
  const id = pathname.slice('/media/'.length)
  if (pathname.startsWith('/media/') && mediaKey.test(id) && ['GET', 'HEAD'].includes(method)) {
    return serveMedia(request, env, id)
  }
  if (pathname === '/api/store-settings' && method === 'GET') {
    const { results } = await env.DB.prepare("SELECT name,value FROM admin_settings WHERE name IN ('settings','navigation')").all()
    const config = Object.fromEntries(results.map(row => [row.name, JSON.parse(row.value)]))
    const allowed = ['brand', 'tagline', 'announcement', 'heroTitle', 'heroImage', 'accent']
    const settings = Object.fromEntries(allowed.filter(key => typeof config.settings?.[key] === 'string')
      .map(key => [key, config.settings[key]]))
    return Response.json({ settings, navigation: config.navigation })

  }
  if (pathname === '/api/admin/media' && method === 'OPTIONS') return new Response(null, { status: 204 })
  if (pathname.startsWith('/api/admin/')) {
    await requireAdmin(request, env)
    if (pathname === '/api/admin/media' && method === 'POST') return uploadMedia(request, env)
    if (pathname === '/api/admin/media' && method === 'GET') {
      const listing = await env.MEDIA.list({ limit: 40, cursor: searchParams.get('cursor') ?? undefined })
      return Response.json({
        media: listing.objects.filter(object => mediaKey.test(object.key)).map(object => ({
          url: new URL('/media/' + object.key, env.WORKER_ORIGIN).href,
          video: /\.(mp4|webm)$/.test(object.key),
        })), cursor: listing.truncated ? listing.cursor : null,
      })
    }
    if (pathname === '/api/admin/settings' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT name,value,version FROM admin_settings').all()
      return Response.json(Object.fromEntries(results.map(row => [row.name, { value: JSON.parse(row.value), version: row.version }])))
    }
    const setting = pathname.slice('/api/admin/settings/'.length)
    if (pathname.startsWith('/api/admin/settings/') && settingsKeys.has(setting) && method === 'PUT') {
      return saveSetting(request, env.DB, setting)
    }
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
        SELECT id, customer_email, customer_name, customer_phone, shipping_address, payment_mode, currency, total_minor, items_json, status,
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
        WHERE id = ? AND status IN ('pending_payment', 'cancelled') AND checkout_state IS NULL
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
    const origin = request.headers.get('Origin')
    if (new URL(request.url).pathname === '/api/admin/media' &&
        ['https://www.xn--maisonp-hya.com', 'https://xn--maisonp-hya.com', 'https://okopipeterson.vercel.app'].includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      response.headers.set('Vary', 'Origin')
    }
    return response
  },
}
