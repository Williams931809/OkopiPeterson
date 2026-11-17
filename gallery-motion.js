(() => {
  const gallery = document.querySelector('#gallery');
  if (!gallery) return;

  const track = gallery.querySelector('#op-gallery-track');
  function populate() {
    const seen = new Set();
    const picks = products.filter(product => {
      const image = product.img.split('?')[0];
      if (seen.has(image)) return false;
      seen.add(image);
      return true;
    }).slice(0, 12);

    track.replaceChildren(...picks.map(product => {
      const card = document.createElement('a');
      card.className = 'op-gallery-card';
      card.href = productUrl(product.id);
      const image = new Image();
      image.loading = 'lazy';
      image.src = product.img;
      image.alt = '';
      const name = document.createElement('span');
      name.textContent = product.name;
      card.append(image, name);
      return card;
    }));
  }

  populate();
  document.addEventListener('catalogue-images-updated', populate);
  gallery.addEventListener('click', event => {
    const control = event.target.closest('[data-gallery-dir]');
    if (!control) return;
    const distance = Math.min(track.clientWidth * .8, 450);
    track.scrollBy({ left: Number(control.dataset.galleryDir) * distance, behavior: 'smooth' });
  });
})();
