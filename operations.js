const signIn = document.querySelector('#sign-in')
const operations = document.querySelector('#operations')
const notice = document.querySelector('#notice')
const form = document.querySelector('#product-form')
const productsList = document.querySelector('#products-list')
const ordersList = document.querySelector('#orders-list')
const previous = document.querySelector('#previous')
const next = document.querySelector('#next')
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
let token = ''
let page = 1

async function api(path, method = 'GET', data) {
  const response = await fetch('/api/admin/' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Store operations are unavailable.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Request could not be completed.')
  return result
}

async function loadProducts() {
  const { products } = await api('products')
  productsList.replaceChildren(...products.map(product => {
    const row = document.createElement('li')
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.textContent = product.name + ' · ' + money.format(product.price_minor / 100) +
      (product.active ? ' · Published' : ' · Draft')
    edit.onclick = () => {
      for (const field of ['id', 'name', 'category', 'image_url', 'description']) {
        form.elements.namedItem(field).value = product[field]
      }
      form.elements.price.value = (product.price_minor / 100).toFixed(2)
      form.elements.active.checked = Boolean(product.active)
      form.elements.id.readOnly = true
    }
    row.append(edit)
    return row
  }))
}

async function loadOrders(targetPage) {
  const { orders, has_more } = await api('orders?page=' + targetPage)
  ordersList.replaceChildren(...orders.map(order => {
    const row = document.createElement('li')
    const details = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = [
      order.id, order.status, order.payment_mode === 'test' ? 'TEST' : '',
      money.format(order.total_minor / 100), order.created_at,
    ].filter(Boolean).join(' · ')
    const customer = document.createElement('p')
    customer.textContent = [order.customer_name, order.customer_email, order.customer_phone, order.shipping_address]
      .filter(Boolean).join(' · ')
    const items = document.createElement('ul')
    for (const item of order.items) {
      const line = document.createElement('li')
      line.textContent = item.name + ' · ' + item.size + ' × ' + item.quantity
      items.append(line)
    }
    details.append(summary, customer, items)
    row.append(details)
    return row
  }))
  if (!orders.length) {
    const empty = document.createElement('li')
    empty.textContent = 'No orders.'
    ordersList.append(empty)
  }
  page = targetPage
  previous.disabled = page === 1
  next.disabled = !has_more
}

function lock() {
  token = ''
  form.reset()
  productsList.replaceChildren()
  ordersList.replaceChildren()
  operations.hidden = true
  signIn.hidden = false
}

signIn.addEventListener('submit', async event => {
  event.preventDefault()
  token = signIn.elements.token.value
  signIn.reset()
  try {
    await Promise.all([loadProducts(), loadOrders(1)])
    signIn.hidden = true
    operations.hidden = false
    notice.textContent = ''
  } catch (error) {
    lock()
    notice.textContent = error.message
  }
})

form.addEventListener('reset', () => { form.elements.id.readOnly = false })
form.addEventListener('submit', async event => {
  event.preventDefault()
  const { id, price, ...data } = Object.fromEntries(new FormData(form))
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim())
  if (!match) {
    notice.textContent = 'Enter a naira amount with up to two decimal places.'
    return
  }
  const price_minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  try {
    await api('products/' + encodeURIComponent(id), 'PUT', {
      ...data, price_minor, active: form.elements.active.checked,
    })
    await loadProducts()
    form.reset()
    notice.textContent = 'Product saved.'
  } catch (error) {
    notice.textContent = error.message
  }
})

document.querySelector('#sign-out').onclick = lock
previous.onclick = () => loadOrders(page - 1).catch(error => { notice.textContent = error.message })
next.onclick = () => loadOrders(page + 1).catch(error => { notice.textContent = error.message })
