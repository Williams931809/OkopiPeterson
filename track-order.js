const form = document.querySelector('#track-form')
const message = document.querySelector('#track-message')
const details = document.querySelector('#order-details')
const title = document.querySelector('#shipment-title')
const progress = document.querySelector('#shipment-progress')
const recommendations = document.querySelector('#tracking-recommendations')
const reference = new URLSearchParams(location.search).get('order') ?? window.maisonpeOrders.latest()
if (/^[a-f0-9-]{36}$/i.test(reference ?? '')) form.elements.reference.value = reference

const stages = [
  ['processing', 'Processing'],
  ['packed', 'Packed'],
  ['shipped', 'In transit'],
  ['delivered', 'Delivered'],
]
const paymentLabels = { paid: 'Payment verified', pending_payment: 'Payment pending', cancelled: 'Order cancelled' }
const money = (value, currency = 'NGN') => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency,
}).format(value / 100)

function renderOrder(order) {
  const stage = order.status === 'paid' && order.payment_mode === 'live'
    ? stages.findIndex(([key]) => key === order.fulfillment_status)
    : -1
  document.querySelector('#order-reference').textContent = 'Order ' + order.id
  title.textContent = stage >= 0 ? stages[stage][1] : paymentLabels[order.status] ?? 'Order received'
  progress.hidden = stage < 0
  progress.replaceChildren(...stages.map(([, label], index) => {
    const item = document.createElement('li')
    const marker = document.createElement('span')
    marker.setAttribute('aria-hidden', 'true')
    marker.textContent = index <= stage ? '✓' : String(index + 1)
    item.toggleAttribute('data-reached', index <= stage)
    if (index === stage) item.setAttribute('aria-current', 'step')
    item.append(marker, label)
    return item
  }))

  const updated = document.querySelector('#shipment-updated')
  const timestamp = order.fulfillment_updated_at
  const date = new Date(timestamp && (timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T') + 'Z'))
  updated.hidden = stage < 0 || !timestamp || Number.isNaN(date.valueOf())
  if (!updated.hidden) {
    updated.dateTime = date.toISOString()
    updated.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }

  const fulfillment = document.querySelector('#order-fulfillment')
  fulfillment.hidden = stage < 0 || !order.carrier
  fulfillment.textContent = [order.carrier, order.shipment_reference && 'Tracking number ' + order.shipment_reference]
    .filter(Boolean).join(' · ')
  document.querySelector('#order-payment').textContent = paymentLabels[order.status] +
    (order.payment_mode === 'test' ? ' · Test order' : '')
  document.querySelector('#order-items').replaceChildren(...order.items.map(item => {
    const line = document.createElement('li')
    const name = document.createElement('strong')
    const price = document.createElement('span')
    const variant = document.createElement('small')
    name.textContent = item.name
    price.textContent = money(item.unit_price_minor * item.quantity, order.currency)
    variant.textContent = 'Size ' + item.size + ' · Qty ' + item.quantity
    line.append(name, price, variant)
    return line
  }))
  document.querySelector('#order-total').textContent = 'Order total ' + money(order.total_minor, order.currency)
}

const supportLink = document.querySelector('.tracking-support')
const supportAddress = 'mailto:support@maisonpe.com?subject='
const supportSubject = 'Maisonpé order support'
const copyReference = document.querySelector('#copy-order-reference')
const copyStatus = document.querySelector('#copy-order-status')
let trackedReference = ''
copyReference.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(trackedReference)
    copyStatus.textContent = 'Order reference copied.'
  } catch {
    copyStatus.textContent = 'Order reference ' + trackedReference
  }
})

let lookup = 0
async function loadRecommendations(order, request) {
  try {
    const response = await fetch('/api/products')
    if (!response.ok) return
    const { products } = await response.json()
    if (request !== lookup) return
    const names = new Set(order.items.map(item => item.name))
    const cards = products.filter(product => !product.demo && product.image_url && !names.has(product.name))
      .slice(0, 3).map(product => {
        const link = document.createElement('a')
        link.href = '/product.html?id=' + encodeURIComponent(product.id)
        const image = document.createElement('img')
        image.src = product.image_url
        image.alt = ''
        image.loading = 'lazy'
        const price = document.createElement('span')
        price.textContent = money(product.price_minor)
        link.append(image, product.name, price)
        return link
      })
    document.querySelector('#tracking-products').replaceChildren(...cards)
    recommendations.hidden = cards.length === 0
  } catch {
    // Recommendations are optional when the catalog is unavailable.
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  const request = ++lookup
  const button = form.querySelector('button')
  details.hidden = true
  supportLink.href = supportAddress + encodeURIComponent(supportSubject)
  copyReference.hidden = true
  copyStatus.textContent = ''
  recommendations.hidden = true
  button.disabled = true
  message.textContent = 'Looking up your order…'
  try {
    const response = await fetch('/api/track-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not look up the order.')
    const { order } = result
    renderOrder(order)
    details.hidden = false
    trackedReference = order.id
    supportLink.href = supportAddress + encodeURIComponent(supportSubject + ' · ' + trackedReference)
    copyReference.hidden = false
    message.textContent = ''
    title.focus()
    if (order.status === 'paid') window.maisonpeOrders.settle(order.id)
    void loadRecommendations(order, request)
  } catch (error) {
    message.textContent = error.message
  } finally {
    button.disabled = false
  }
})
document.querySelector('#print-order').onclick = () => window.print()
