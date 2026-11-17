(() => {
  const hero = document.querySelector('.runway-hero');
  const button = hero.querySelector('.runway-pause');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function updateControl() {
    button.hidden = reducedMotion.matches;
  }

  button.addEventListener('click', () => {
    const paused = hero.classList.toggle('is-paused');
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? 'Resume motion' : 'Pause motion';
  });

  reducedMotion.addEventListener('change', updateControl);
  updateControl();
})();
