(() => {
  const button = document.querySelector('#checkout')
  const availability = document.querySelector('#checkoutAvailability')
  const dialog = document.createElement('dialog')
  dialog.className = 'checkout-dialog'
  dialog.setAttribute('aria-labelledby', 'checkout-title')
  dialog.innerHTML = `
    <form id="checkout-form" class="checkout-layout">
      <div class="checkout-heading">
        <button type="button" data-close>Back to bag</button>
        <h2 id="checkout-title" tabindex="-1" autofocus>Checkout</h2>
      </div>
      <section class="checkout-fields" aria-labelledby="checkout-delivery">
        <h3 id="checkout-delivery">Contact &amp; delivery</h3>
        <label class="checkout-wide">Full name <input name="name" autocomplete="name" maxlength="120" required></label>
        <label>Email <input name="email" type="email" autocomplete="email" maxlength="254" required></label>
        <label>Phone <input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label>
        <label class="checkout-wide">Delivery address <textarea name="address" autocomplete="street-address" maxlength="500" rows="2" required></textarea></label>
        <label id="delivery-region" class="checkout-wide" hidden>Delivery region <select name="region"><option value="">Standard delivery</option></select></label>
        <label class="checkout-wide">Discount code <span>(optional)</span><input name="discount_code" maxlength="40"></label>
      </section>
      <section class="checkout-summary" aria-labelledby="checkout-summary-title">
        <h3 id="checkout-summary-title">Order summary</h3>
        <ul class="checkout-items"></ul>
        <dl class="checkout-totals">
          <div><dt>Subtotal</dt><dd data-amount="subtotal"></dd></div>
          <div><dt>Delivery</dt><dd data-amount="shipping"></dd></div>
          <div hidden><dt>Discount</dt><dd data-amount="discount"></dd></div>
          <div class="checkout-total"><dt>Total</dt><dd data-amount="total"></dd></div>
        </dl>
        <p class="checkout-status" role="status"></p>
        <button class="checkout-submit" type="submit">Review total</button>
        <p class="checkout-payment">Secure payment via Flutterwave</p>
      </section>
    </form>
  `
  document.body.append(dialog)
  const form = dialog.querySelector('form')
  const submit = form.querySelector('[type=submit]')
  const status = form.querySelector('[role=status]')
  const itemList = form.querySelector('.checkout-items')
  const amounts = Object.fromEntries(
    Array.from(form.querySelectorAll('[data-amount]'), node => [node.dataset.amount, node]),
  )
  dialog.querySelector('[data-close]').onclick = () => dialog.close()

  let approved = null
  const format = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
  const money = minor => format.format(minor / 100)

  function renderSummary() {
    let subtotal = 0
    itemList.replaceChildren(...bag.map(({ id, size, qty }) => {
      const product = productById(id)
      const lineTotal = Math.round(product.price * 100) * qty
      subtotal += lineTotal
      const item = document.createElement('li')
      const details = document.createElement('div')
      const name = document.createElement('strong')
      const variant = document.createElement('small')
      const price = document.createElement('span')
      name.textContent = product.name
      variant.textContent = 'Size ' + size + ' · Qty ' + qty
      price.textContent = money(lineTotal)
      details.append(name, variant)
      item.append(details, price)
      return item
    }))
    amounts.subtotal.textContent = money(subtotal)
  }

  const invalidate = () => {
    approved = null
    submit.textContent = 'Review total'
    status.textContent = ''
    amounts.shipping.textContent = 'Calculated at review'
    amounts.discount.parentElement.hidden = true
    amounts.total.textContent = 'Pending review'
    renderSummary()
  }
  form.addEventListener('input', invalidate)

  let enabled = false
  button.onclick = () => {
    if (!enabled) return
    invalidate()
    dialog.showModal()
    dialog.scrollTop = 0
  }
  function checkoutBody() {
    const items = bag.map(({ id, size, qty }) => ({ id, size, quantity: qty }))
      .sort((a, b) => (a.id + ':' + a.size).localeCompare(b.id + ':' + b.size))
    return JSON.stringify({ ...Object.fromEntries(new FormData(form)), items })
  }
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!enabled || submit.disabled || !bag.length) return
    submit.disabled = true
    status.textContent = 'Updating checkout…'
    try {
      const body = checkoutBody()
      if (!approved || approved.body !== body) {
        const quote = await fetch('/api/checkout-quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        })
        const price = await quote.json()
        if (!quote.ok) throw new Error(price.error || 'Could not calculate the total.')
        if (!dialog.open || body !== checkoutBody()) {
          invalidate()
          submit.disabled = false
          return
        }
        approved = { body, total: price.total_minor }
        amounts.subtotal.textContent = money(price.subtotal)
        amounts.shipping.textContent = money(price.shipping)
        amounts.discount.textContent = '−' + money(price.discount)
        amounts.discount.parentElement.hidden = !price.discount
        amounts.total.textContent = money(price.total_minor)
        status.textContent = 'Order total confirmed.'
        submit.textContent = 'Pay ' + money(price.total_minor)
        submit.disabled = false
        return
      }
      const expectedTotal = approved.total
      status.textContent = 'Opening Flutterwave…'
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
      const fingerprint = Array.from(new Uint8Array(hash)).join(',')
      const saved = JSON.parse(sessionStorage.getItem('maisonpe-checkout') ?? 'null')
      const key = saved?.fingerprint === fingerprint ? saved.key : crypto.randomUUID()
      sessionStorage.setItem('maisonpe-checkout', JSON.stringify({ key, fingerprint }))
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ ...JSON.parse(body), expected_total_minor: expectedTotal }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not start checkout.')
      const url = new URL(result.url)
      if (url.origin !== 'https://checkout.flutterwave.com') throw new Error('Invalid checkout link.')
      sessionStorage.setItem('maisonpe-checkout', JSON.stringify({
        key, fingerprint, order: result.order, bag: localStorage.getItem('okopiBag'),
      }))
      window.maisonpeOrders.save(result.order, localStorage.getItem('okopiBag'))
      location.assign(url.href)
    } catch (error) {
      invalidate()
      status.textContent = error.message
      submit.disabled = false
    }
  })

  async function loadCatalog() {
    try {
      const response = await fetch('/api/products')
      if (!response.ok) return
      const result = await response.json()
      if (!Array.isArray(result.products)) return
      window.maisonpeManagedCatalog = true
      products.splice(0, products.length, ...result.products.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        img: item.image_url,
        video: item.video_url,
        price: item.price_minor / 100,
        demo: Boolean(item.demo),
      })))
      bag = bag.filter(item => { const product = productById(item.id); return product && !product.demo })
      enabled = result.checkout_enabled === true
      availability.textContent = enabled
        ? result.payment_mode === 'test' ? 'Test checkout. Use Flutterwave test payment details.' : ''
        : 'Online checkout is currently unavailable.'
      document.querySelectorAll('[data-filter]').forEach(control => {
        control.hidden = control.dataset.filter !== 'All' &&
          !products.some(product => product.category === control.dataset.filter)
      })
      if (filter !== 'All' && !products.some(product => product.category === filter)) filter = 'All'
      render()
      update()
      document.dispatchEvent(new Event('maisonpe-catalog-loaded'))
    } catch {
      enabled = false
    }
  }
  async function loadRegions() {
    try {
      const response = await fetch('/api/store-settings')
      if (!response.ok) return
      const { shipping_regions } = await response.json()
      if (!shipping_regions?.length) return
      const region = form.elements.region
      region.replaceChildren(new Option('Select region', ''))
      for (const name of shipping_regions) region.add(new Option(name, name))
      region.required = true
      document.querySelector('#delivery-region').hidden = false
    } catch {
      // Standard delivery remains available when no regional options are loaded.
    }
  }
  document.addEventListener('maisonpe-cart-settled', event => {
    bag = event.detail.filter(item => productById(item.id))
    update()
    if (dialog.open) {
      if (bag.length) invalidate()
      else dialog.close()
    }
  })
  async function initialize() {
    await loadCatalog()
    await window.maisonpeOrders.reconcile()
  }
  initialize()
  window.addEventListener('pageshow', event => {
    if (event.persisted) window.maisonpeOrders.reconcile()
  })
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) window.maisonpeOrders.reconcile()
  })
  loadRegions()
})()
