(() => {
  const button = document.querySelector('#checkout')
  const availability = document.querySelector('#checkoutAvailability')
  const dialog = document.createElement('dialog')
  dialog.innerHTML = `
    <form id="checkout-form" class="checkout-form">
      <h2>Checkout</h2>
      <label>Full name <input name="name" autocomplete="name" maxlength="120" required></label>
      <label>Email <input name="email" type="email" autocomplete="email" maxlength="254" required></label>
      <label>Phone <input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label>
      <label>Delivery address <textarea name="address" autocomplete="street-address" maxlength="500" required></textarea></label>
      <label id="delivery-region" hidden>Delivery region <select name="region"><option value="">Standard delivery</option></select></label>
      <label>Discount code <input name="discount_code" maxlength="40"></label>
      <p role="status" aria-live="polite"></p>
      <button class="cta" type="submit">Review total</button>
      <button type="button" data-close>Back to bag</button>
    </form>
  `
  document.body.append(dialog)
  const form = dialog.querySelector('form')
  const submit = form.querySelector('[type=submit]')
  const status = form.querySelector('[role=status]')
  dialog.querySelector('[data-close]').onclick = () => dialog.close()

  let approved = null
  const format = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
  const money = minor => format.format(minor / 100)
  const invalidate = () => {
    approved = null
    submit.textContent = 'Review total'
  }
  form.addEventListener('input', invalidate)

  let enabled = false
  button.onclick = () => {
    if (!enabled) return
    invalidate()
    status.textContent = ''
    dialog.showModal()
  }
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!enabled || submit.disabled || !bag.length) return
    submit.disabled = true
    status.textContent = 'Opening secure checkout…'
    try {
      const items = bag.map(({ id, size, qty }) => ({ id, size, quantity: qty }))
        .sort((a, b) => (a.id + ':' + a.size).localeCompare(b.id + ':' + b.size))
      const body = JSON.stringify({ ...Object.fromEntries(new FormData(form)), items })
      if (!approved || approved.body !== body) {
        const quote = await fetch('/api/checkout-quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        })
        const price = await quote.json()
        if (!quote.ok) throw new Error(price.error || 'Could not calculate the total.')
        approved = { body, total: price.total_minor }
        status.textContent = 'Subtotal ' + money(price.subtotal) + ' · Delivery ' + money(price.shipping) +
          ' · Discount ' + money(price.discount) + ' · Total ' + money(price.total_minor)
        submit.textContent = 'Pay ' + money(price.total_minor) + ' with Flutterwave'
        submit.disabled = false
        return
      }
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
      const fingerprint = Array.from(new Uint8Array(hash)).join(',')
      const saved = JSON.parse(sessionStorage.getItem('maisonpe-checkout') ?? 'null')
      const key = saved?.fingerprint === fingerprint ? saved.key : crypto.randomUUID()
      sessionStorage.setItem('maisonpe-checkout', JSON.stringify({ key, fingerprint }))
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ ...JSON.parse(body), expected_total_minor: approved.total }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not start checkout.')
      const url = new URL(result.url)
      if (url.origin !== 'https://checkout.flutterwave.com') throw new Error('Invalid checkout link.')
      sessionStorage.setItem('maisonpe-checkout', JSON.stringify({
        key, fingerprint, order: result.order, bag: localStorage.getItem('okopiBag'),
      }))
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
      if (!Array.isArray(result.products) || !result.products.length) return
      products.splice(0, products.length, ...result.products.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        img: item.image_url,
        video: item.video_url,
        price: item.price_minor / 100,
      })))
      bag = bag.filter(item => productById(item.id))
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
  loadCatalog()
  loadRegions()
})()
