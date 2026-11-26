(()=>{const nav=document.querySelector('header nav');const header=document.querySelector('header');const promo=document.createElement('div');promo.className='op-promo';promo.textContent='COMPLIMENTARY DELIVERY ON SELECT ORDERS  •  THE ART OF OUTERWEAR';document.body.prepend(promo);const mobile=document.createElement('button');mobile.className='op-menu';mobile.textContent='☰ MENU';mobile.setAttribute('aria-label','Toggle menu');header.insertBefore(mobile,header.firstChild);mobile.onclick=()=>header.classList.toggle('menu-open');nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>header.classList.remove('menu-open')));const account=document.createElement('button');account.className='op-account';account.textContent='♡ WISHLIST';account.onclick = () => {
  const first = favorites.find(id => products.some(product => product.id === id));
  location.assign(first ? productUrl(first) : 'collection.html');
};
nav.insertBefore(account,document.querySelector('#bagButton'));const main = document.querySelector('main');
const productPage=document.createElement('div');productPage.id='op-product-page';productPage.hidden=true;productPage.innerHTML='<div class="op-breadcrumb"><a href="collection.html" id="op-back">← BACK TO COLLECTION</a><span>MAISONPÉ / OUTERWEAR</span></div><div class="op-product-layout"><div class="op-product-gallery"><img id="op-main-image" alt="Jacket product photograph"><div class="op-thumbnails" id="op-thumbnails"></div></div><div class="op-product-info"><p class="op-kicker">THE OUTERWEAR EDIT / SIGNATURE COLLECTION</p><h1 id="op-product-title"></h1><p class="op-price" id="op-product-price"></p><p class="op-subtitle">Refined proportions. Everyday confidence.</p><div class="op-divider"></div><label for="op-size">SELECT SIZE</label><select id="op-size"><option>XS</option><option>S</option><option selected>M</option><option>L</option><option>XL</option><option>XXL</option></select><button class="op-add" id="op-add">ADD TO BAG</button><p class="op-shipping">Payment is handled by Flutterwave when checkout is available.</p><details open><summary>DESCRIPTION</summary><p id="op-description"></p></details><details><summary>SIZE & FIT</summary><p>Demonstration sizing only. Final measurements will be confirmed by MAISONPÉ.</p></details><details><summary>SHIPPING & RETURNS</summary><p>Delivery and return policies will be finalized before launch.</p></details></div></div><section class="op-related"><p class="op-kicker">DISCOVER MORE</p><h2>YOU MAY ALSO LIKE</h2><div id="op-related-grid"></div></section>';main.append(productPage);let current=null;function showProduct(id){const p=products.find(x=>x.id===id);if(!p)return;current=p;main.querySelector('.page-heading').hidden = true;productPage.hidden=false;document.querySelector('#op-main-image').src=p.img;document.querySelector('#op-product-title').textContent=p.name;document.querySelector('#op-product-price').textContent=fmt(p.price);document.querySelector('#op-description').textContent=p.description;const related=products.filter(x=>x.id!==id&&x.category===p.category).slice(0,4);document.querySelector('#op-related-grid').innerHTML=related.map(x=>'<a href="'+productUrl(x.id)+'" data-product-link="'+x.id+'"><img loading="lazy" src="'+html(x.img)+'" alt="'+html(x.name)+'"><strong>'+html(x.name)+'</strong><span>'+fmt(x.price)+'</span></a>').join('');document.querySelector('#op-thumbnails').innerHTML='<button class="active" aria-label="Front view"><img src="'+html(p.img)+'" alt="Front view"></button>';window.scrollTo({top:0,behavior:'instant'});document.title=p.name+' | MAISONPÉ'}function redirectLegacyLink() {
  const legacyPages = {
    '#collections': 'collection.html',
    '#gallery': 'gallery.html',
    '#story': 'house.html',
    '#craft': 'craftsmanship.html',
  };
  if (Object.hasOwn(legacyPages, location.hash)) {
    location.replace(legacyPages[location.hash]);
    return;
  }

  const match = location.hash.match(/^#\/product\/(.+)$/);
  if (!match) return;
  try {
    location.replace(productUrl(decodeURIComponent(match[1])));
  } catch {
    location.replace('collection.html');
  }
}

window.addEventListener('hashchange', redirectLegacyLink);
redirectLegacyLink();

document.addEventListener('click', event => {
  const detail = event.target.closest('[data-detail]');
  const card = event.target.closest('.product img,.product h3');
  const id = detail?.dataset.detail
    ?? card?.closest('.product')?.querySelector('[data-detail]')?.dataset.detail;
  if (!id) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(productUrl(id));
}, true);

document.querySelector('#op-add').onclick = () => {
  if (current) add(current.id, document.querySelector('#op-size').value);
};

if (location.pathname.endsWith('/product.html')) {
  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    showProduct(id);
    document.addEventListener('maisonpe-catalog-loaded', () => {
      if (productById(id)) showProduct(id);
      else {
        current = null;
        productPage.hidden = true;
        const heading = main.querySelector('.page-heading');
        heading.hidden = false;
        heading.textContent = 'This jacket is currently unavailable.';
      }
    });
    document.addEventListener('catalogue-images-updated', () => {
      if (!current) return;
      document.querySelector('#op-main-image').src = current.img;
      document.querySelector('#op-thumbnails img').src = current.img;
      for (const link of document.querySelectorAll('[data-product-link]')) {
        const related = productById(link.dataset.productLink);
        if (related) link.querySelector('img').src = related.img;
      }
    });
  }
}
})();
