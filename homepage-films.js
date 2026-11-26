window.maisonpeFilms = {
  slug: 'homepage-films',
  defaults: [
    { title: 'Maisonpé campaign', url: '/films/17972.mp4' },
    { title: 'Collection film', url: '/films/17976.mp4' },
    { title: 'Maisonpé in motion', url: '/films/18061.mp4' },
    { title: 'Collection detail', url: '/films/18060.mp4' },
  ],
  parse(body) {
    const films = JSON.parse(body)
    if (!Array.isArray(films)) throw new Error('Invalid homepage film list.')
    return films.filter(film => typeof film?.title === 'string' &&
      typeof film.url === 'string' && (/^\/films\/[0-9]+\.mp4$/.test(film.url) ||
        /^https:\/\/maisonpe-api\.thankgododiawa6\.workers\.dev\/media\/[0-9a-f-]{36}\.(mp4|webm)$/.test(film.url)))
  },
}
