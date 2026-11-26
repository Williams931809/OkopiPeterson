(async () => {
  const title = document.querySelector('#page-title');
  const slug = location.pathname.split('/').filter(Boolean).pop();
  if (slug === 'homepage-films') {
    title.textContent = 'Page not found';
    return;
  }
  try {
    const response = await fetch('/api/pages?slug=' + encodeURIComponent(slug));
    if (response.status === 404) {
      title.textContent = 'Page not found';
      return;
    }
    if (!response.ok) throw new Error();
    const page = await response.json();
    title.textContent = page.title;
    document.title = page.title + ' | Maisonpé';
    document.querySelector('#page-content').textContent = page.body;
  } catch {
    title.textContent = 'This page is temporarily unavailable';
  }
})();
