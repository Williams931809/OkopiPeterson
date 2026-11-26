(async () => {
  const intro = document.querySelector('#home-films')
  const sequence = intro.querySelector('.film-sequence')
  const skip = intro.querySelector('#skip-films')
  if (location.hash && location.hash !== '#home-films') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    if (sessionStorage.getItem('maisonpe-intro-seen')) return
  } catch {}
  const config = window.maisonpeFilms
  let films = config.defaults
  document.body.classList.add('film-intro-pending')
  try {
    const response = await fetch('/api/pages?slug=' + config.slug, { signal: AbortSignal.timeout(2500) })
    if (response.ok) films = config.parse((await response.json()).body)
  } catch {} finally {
    document.body.classList.remove('film-intro-pending')
  }
  if (!films.length) return

  const slides = films.map(film => {
    const slide = document.createElement('div')
    slide.className = 'film-slide'
    const video = document.createElement('video')
    video.src = film.url
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.loop = true
    video.preload = 'none'
    video.setAttribute('aria-label', film.title)
    slide.append(video)
    return slide
  })
  const end = document.createElement('div')
  end.className = 'film-end'
  end.setAttribute('aria-hidden', 'true')
  sequence.append(...slides, end)
  const background = [...document.body.children].filter(element =>
    element !== intro && /^(HEADER|MAIN|FOOTER|DIALOG)$/.test(element.tagName))
  const finish = () => {
    observer.disconnect()
    for (const slide of slides) slide.firstChild.pause()
    intro.hidden = true
    background.forEach(element => { element.inert = false })
    document.body.classList.remove('film-intro-active')
    try { sessionStorage.setItem('maisonpe-intro-seen', '1') } catch {}
    const main = document.querySelector('main')
    main.tabIndex = -1
    main.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target === end) {
        if (entry.isIntersecting && entry.intersectionRatio >= .6) finish()
        continue
      }
      const video = entry.target.firstChild
      if (entry.intersectionRatio >= .6) video.play().catch(() => { video.controls = true })
      else video.pause()
    }
  }, { root: sequence, threshold: [.6] })
  skip.addEventListener('click', finish)
  intro.addEventListener('keydown', event => {
    if (event.key === 'Escape') finish()
  })
  background.forEach(element => { element.inert = true })
  document.body.classList.add('film-intro-active')
  intro.hidden = false
  sequence.focus({ preventScroll: true })
  for (const element of [...slides, end]) observer.observe(element)
})()
