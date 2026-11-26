(async () => {
  const section = document.querySelector('#home-films')
  const grid = section.querySelector('.film-grid')
  const config = window.maisonpeFilms
  let films = []
  try {
    const response = await fetch('/api/pages?slug=' + config.slug)
    if (response.status === 404) films = config.defaults
    else if (response.ok) films = config.parse((await response.json()).body)
  } catch {
    // Keep the section hidden when the current published list cannot be loaded.
  }
  for (const film of films) {
    const card = document.createElement('figure')
    const video = document.createElement('video')
    video.src = film.url
    video.controls = true
    video.playsInline = true
    video.preload = 'metadata'
    video.setAttribute('aria-label', film.title)
    const caption = document.createElement('figcaption')
    caption.textContent = film.title
    card.append(video, caption)
    grid.append(card)
  }
  section.hidden = films.length === 0
  grid.addEventListener('play', event => {
    for (const video of grid.querySelectorAll('video')) {
      if (video !== event.target) video.pause()
    }
  }, true)
})()
