(async () => {
  try {
    const response = await fetch('/api/store-settings');
    if (!response.ok) return;
    const { settings, navigation } = await response.json();
    const text = (selector, value) => {
      if (typeof value === 'string' && value.trim()) {
        document.querySelectorAll(selector).forEach(element => { element.textContent = value; });
      }
    };
    if (settings) {
      text('.brand, footer strong', settings.brand);
      text('footer p', settings.tagline);
      text('.heroText h1', settings.heroTitle);
      text('.op-promo', settings.announcement);
      const hero = document.querySelector('.hero img');
      if (hero && /^https:\/\//i.test(settings.heroImage ?? '')) hero.src = settings.heroImage;
      if (/^#[0-9a-f]{6}$/i.test(settings.accent ?? '')) {
        document.documentElement.style.setProperty('--accent', settings.accent);
      }
    }
    if (Array.isArray(navigation) && navigation.length) {
      const menu = document.querySelector('nav[aria-label="Main navigation"]');
      const links = navigation.flatMap(item => {
        if (typeof item?.label !== 'string' || typeof item.url !== 'string') return [];
        const url = new URL(item.url, location.href);
        if (url.protocol !== 'https:' && url.origin !== location.origin) return [];
        const link = document.createElement('a');
        link.href = url.href;
        link.textContent = item.label;
        return [link];
      });
      if (menu && links.length) {
        menu.querySelectorAll('a').forEach(link => link.remove());
        menu.prepend(...links);
      }
    }
  } catch {
    // Keep the storefront defaults if the configuration service is unavailable.
  }
})();
