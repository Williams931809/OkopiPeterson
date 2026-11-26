const reference = new URLSearchParams(location.search).get('order')
const paymentStatus = document.querySelector('#payment-status')

async function checkPayment(remaining) {
  if (!/^[a-f0-9-]{36}$/i.test(reference ?? '')) {
    paymentStatus.textContent = 'No order reference was returned.'
    return
  }
  try {
    const response = await fetch('/api/orders/' + encodeURIComponent(reference))
    if (!response.ok) throw new Error('Order status unavailable.')
    const { order } = await response.json()
    if (order.status === 'paid') {
      paymentStatus.textContent = order.payment_mode === 'test'
        ? 'Test payment verified. No order will be shipped.'
        : 'Payment verified. Your order reference is ' + reference + '.'
      const saved = JSON.parse(sessionStorage.getItem('maisonpe-checkout') ?? 'null')
      if (saved?.order === reference) {
        if (saved.bag === localStorage.getItem('okopiBag')) localStorage.removeItem('okopiBag')
        sessionStorage.removeItem('maisonpe-checkout')
      }
      return
    }
    if (order.status === 'cancelled') {
      paymentStatus.textContent = 'This order was cancelled.'
      return
    }
    if (remaining > 0) {
      setTimeout(() => checkPayment(remaining - 1), 3000)
      return
    }
    paymentStatus.textContent = 'Payment is still unconfirmed. Refresh this page to check again.'
  } catch {
    paymentStatus.textContent = 'We could not check your order. Refresh this page to retry.'
  }
}

checkPayment(5)
