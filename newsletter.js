(() => {
  const read = (storage, key) => {
    try { return storage.getItem(key) } catch { return null }
  }
  const remember = (storage, key) => {
    try { storage.setItem(key, '1') } catch { /* Storage can be unavailable. */ }
  }
  if (read(localStorage, 'maisonpe-newsletter-subscribed') ||
      read(sessionStorage, 'maisonpe-newsletter-seen')) return

  const dialog = document.createElement('dialog')
  dialog.className = 'maisonpe-newsletter'
  dialog.setAttribute('aria-labelledby', 'newsletter-title')
  dialog.innerHTML = `
    <button class="newsletter-close" type="button" aria-label="Close newsletter signup">×</button>
    <h2 id="newsletter-title">The Maisonpé Newsletter</h2>
    <p>Get new collection announcements and Maisonpé updates by email.</p>
    <form>
      <label for="newsletter-email">Email address</label>
      <input id="newsletter-email" type="email" name="email" autocomplete="email" maxlength="254" required>
      <label class="newsletter-consent"><input type="checkbox" name="consent" required> I agree to receive the Maisonpé newsletter.</label>
      <button type="submit" class="cta">Subscribe</button>
      <p role="status"></p>
    </form>
  `
  document.body.append(dialog)
  dialog.querySelector('.newsletter-close').onclick = () => dialog.close()
  const form = dialog.querySelector('form')
  const message = form.querySelector('[role="status"]')
  const submit = form.querySelector('[type="submit"]')
  form.onsubmit = async event => {
    event.preventDefault()
    submit.disabled = true
    message.textContent = ''
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.elements.email.value, consent: form.elements.consent.checked }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not subscribe. Please try again.')
      remember(localStorage, 'maisonpe-newsletter-subscribed')
      form.reset()
      dialog.querySelector('h2').textContent = 'You’re subscribed'
      dialog.querySelector('h2 + p').textContent = 'Thank you for joining the Maisonpé newsletter.'
      form.hidden = true
      dialog.querySelector('.newsletter-close').focus()
    } catch (error) {
      message.textContent = error.message
      submit.disabled = false
    }
  }

  function show() {
    if (document.hidden || document.querySelector('dialog[open]')) {
      setTimeout(show, 1500)
      return
    }
    dialog.showModal()
    remember(sessionStorage, 'maisonpe-newsletter-seen')
  }
  setTimeout(show, 1200)
})()
