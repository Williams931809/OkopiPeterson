const form = document.querySelector('#track-form')
const message = document.querySelector('#track-message')
const details = document.querySelector('#order-details')
const reference = new URLSearchParams(location.search).get('order') ?? window.maisonpeOrders.latest()
if (/^[a-f0-9-]{36}$/i.test(reference ?? '')) form.elements.reference.value = reference

form.addEventListener('submit', async event => {
  event.preventDefault()
  const button = form.querySelector('button')
  details.hidden = true
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
    const money = value => new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: order.currency,
    }).format(value / 100)
    const status = { paid: 'Payment verified', pending_payment: 'Payment pending', cancelled: 'Order cancelled' }
    document.querySelector('#order-payment').textContent = status[order.status] +
      ' · ' + order.id + (order.payment_mode === 'test' ? ' · Test order' : '')
    const fulfillment = order.status === 'paid' && order.payment_mode === 'live'
      ? 'Fulfillment: ' + order.fulfillment_status +
        (order.carrier ? ' · ' + order.carrier + ' · Tracking number ' + order.shipment_reference : '')
      : ''
    document.querySelector('#order-fulfillment').textContent = fulfillment
    document.querySelector('#order-items').replaceChildren(...order.items.map(item => {
      const line = document.createElement('li')
      line.textContent = item.name + ' · ' + item.size + ' × ' + item.quantity + ' · ' +
        money(item.unit_price_minor * item.quantity)
      return line
    }))
    document.querySelector('#order-total').textContent = 'Order total: ' + money(order.total_minor)
    details.hidden = false
    message.textContent = ''
    if (order.status === 'paid') window.maisonpeOrders.settle(order.id)
  } catch (error) {
    message.textContent = error.message
  } finally {
    button.disabled = false
  }
})
document.querySelector('#print-order').onclick = () => window.print()
