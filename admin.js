(()=>{'use strict';const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const money=n=>'₦'+Number(n||0).toLocaleString('en-NG');const state = { products: [], discounts: [], campaigns: [], pages: [], settings: {
  brand: 'MAISONPÉ', tagline: '', announcement: '', heroTitle: '', heroImage: '', accent: '', shipping: 0,
} };let token = '';
let staffRole = '';
let liveOrders = [];
const orders = () => liveOrders;
const paidOrders = () => orders().filter(order => order.status === 'paid' && !order.test);
window.maisonpeAdminOrders = orders;
state.products = [];

async function adminApi(path, method = 'GET', data) {
  const response = await fetch('/api/admin/' + path, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Store request failed.');
  return result;
}

const toProduct = p => ({
  id: p.id, name: p.name, category: p.category, price: p.price_minor / 100,
  image: p.image_url, video: p.video_url, description: p.description, status: p.active ? 'Active' : 'Draft',
});

async function loadOrders() {
  const records = [];
  for (let page = 1; ; page++) {
    const result = await adminApi('orders?page=' + page);
    records.push(...result.orders);
    if (!result.has_more) break;
  }
  return records.map(o => ({
    reference: o.id, date: o.created_at.replace(' ', 'T') + 'Z', total: o.total_minor / 100,
    status: o.status.replaceAll('_', ' '), test: o.payment_mode === 'test',
    customer: { name: o.customer_name, phone: o.customer_phone, email: o.customer_email },
    address: o.shipping_address, items: o.items,
  }));
}

const shared = {};
let galleryCursor = null;

async function saveShared(name, value) {
  const { version } = await adminApi('settings/' + name, 'PUT', { value, version: shared[name]?.version ?? 0 });
  shared[name] = { value, version };
}

window.maisonpeAdminSettings = {
  read: name => shared[name]?.value,
  api: adminApi,
  role: () => staffRole,
  save: saveShared,
};

const fileTypes = 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm';
const uploadField = (name, label, accept = fileTypes) =>
  '<label class="field">' + label + '<input name="' + name + '" type="file" accept="' + accept + '"></label>';

async function upload(file) {
  const response = await fetch('https://maisonpe-api.thankgododiawa6.workers.dev/api/admin/media', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': file.type },
    body: file,
  });
  if (response.status === 413) throw new Error('Images can be up to 10 MB and videos up to 50 MB.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Upload failed.');
  return result.url;
}

async function loadGallery(cursor = null) {
  try {
    const root = $('#mediaGrid');
    if (!root) return;
    const result = await adminApi('media' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    if ($('#mediaGrid') !== root) return;
    root.innerHTML = result.media.map(item => '<div class="list-row">' +
      (item.video ? '<video controls preload="metadata" width="220" src="' : '<img width="120" alt="Uploaded media" src="') +
      esc(item.url) + '">' + (item.video ? '</video>' : '') + '</div>').join('') ||
      '<p>No media uploaded yet.</p>';
    galleryCursor = result.cursor;
    $('#moreMedia').hidden = !galleryCursor;
  } catch (error) {
    toast(error.message);
  }
}
const titles={home:'Home',orders:'Orders',products:'Products',inventory:'Inventory',customers:'Customers',analytics:'Analytics',marketing:'Marketing & advertising',discounts:'Discounts',content:'Content & pages',branding:'Branding & theme',gallery:'Media gallery',navigation:'Navigation',settings:'Settings'};const head=(title,desc,button='')=>'<div class="page-head"><div><h1>'+title+'</h1><p>'+desc+'</p></div>'+button+'</div>';const panel=(title,body)=>'<section class="panel"><h2>'+title+'</h2>'+body+'</section>';const table=(cols,rows)=>'<div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';const notice='';let page='home';function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2800)}function button(label,action){return '<button class="primary" data-action="'+action+'">'+label+'</button>'}function home(){const total=paidOrders().reduce((s,o)=>s+(o.total||0),0);return head('Good day. Welcome back.','Here is what is happening with your store.',button('Add product','newProduct'))+'<div class="cards">'+[['Total sales',money(total),'Verified live payments'],['Orders',orders().length,'Cloudflare orders'],['Products',state.products.length,'Cloudflare catalog'],['Active campaigns',state.campaigns.filter(c=>c.status==='Active').length,'Draft marketing plans']].map(x=>'<div class="card"><label>'+x[0]+'</label><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('')+'</div><div class="two">'+panel('Sales overview', '<div class="chart">'+[15,35,22,45,31,62,48,75,53,80,60,92].map(v=>'<div style="height:'+v+'%"></div>').join('')+'</div><p class="muted">Illustrative chart — not live sales data.</p>')+panel('Quick actions',[['Add a new jacket','newProduct'],['Create discount','newDiscount'],['Launch a campaign','newCampaign'],['Customize storefront','branding']].map(x=>'<div class="list-row"><span>'+x[0]+'</span><button class="secondary" data-action="'+x[1]+'">Open →</button></div>').join(''))+'</div>'+panel('Recent orders',orders().length?orderTable(orders().slice(0,5)):'<div class="empty">No orders yet.</div>')}function orderTable(list){return table(['Reference','Customer','Amount','Status','Date'],list.map(o=>'<tr><td>'+esc(o.reference)+'</td><td>'+esc(o.customer?.name||'—')+'<details><summary>Order details</summary><p>'+esc(o.customer.email)+'</p><p>'+esc(o.customer.phone)+'</p><p>'+esc(o.address)+'</p><ul>'+o.items.map(item=>'<li>'+esc(item.name)+' · '+esc(item.size)+' × '+esc(item.quantity)+'</li>').join('')+'</ul>'+(o.status==='pending payment'?'<button class="secondary" data-cancel-order="'+esc(o.reference)+'">Cancel order</button>':'')+'</details>'+'</td><td>'+money(o.total)+'</td><td><span class="tag neutral">'+esc(o.status)+(o.test?' · Test':'')+'</span></td><td>'+new Date(o.date).toLocaleDateString()+'</td></tr>'))}function productTable(list){return table(['Product','Category','Price','Status','Manage'],list.map(p=>'<tr><td>'+(p.image?'<img src="'+esc(p.image)+'" alt="">':'')+'<strong>'+esc(p.name)+'</strong></td><td>'+esc(p.category)+'</td><td>'+money(p.price)+'</td><td><span class="tag">'+esc(p.status)+'</span></td><td><button class="secondary" data-editproduct="'+esc(p.id)+'">Edit</button></td></tr>'))}function products(){return head('Products','Manage jacket listings and pricing.',button('Add product','newProduct'))+panel('All products <span class="muted">('+state.products.length+')</span>','<div class="toolbar"><input id="productFilter" placeholder="Search products"><select id="categoryFilter"><option value="">All categories</option>'+[...new Set(state.products.map(product=>product.category))].sort().map(x=>'<option>'+esc(x)+'</option>').join('')+'</select><button class="secondary" data-action="export">Export CSV</button></div><div id="productTable">'+productTable(state.products)+'</div>')}function inventory(){return head('Inventory','Catalog availability by product.')+panel('Catalog availability',productTable(state.products))}function customers(){const seen=new Map();orders().forEach(o=>{const email=o.customer?.email;if(email&&!seen.has(email))seen.set(email,o.customer)});return head('Customers','Customer records from Cloudflare orders.')+panel('Customer directory',seen.size?table(['Name','Email','Phone'],[...seen.values()].map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.email)+'</td><td>'+esc(c.phone)+'</td></tr>')):'<div class="empty">No customers recorded in this browser yet.</div>')}function analytics(){return head('Analytics','Understand your store performance.')+'<div class="cards">'+[['Orders',orders().length],['Verified sales',money(paidOrders().reduce((s,o)=>s+(o.total||0),0))],['Average order',money(paidOrders().length?paidOrders().reduce((s,o)=>s+(o.total||0),0)/paidOrders().length:0)],['Products',state.products.length]].map(x=>'<div class="card"><label>'+x[0]+'</label><strong>'+x[1]+'</strong></div>').join('')+'</div>'+panel('Reporting', '<p class="muted">Real conversion rates, visitors, ad attribution and revenue reports require production event tracking and a database.</p>')}function listView(key,title,desc,fields){return head(title,desc,button('Create new',key==='discounts'?'newDiscount':key==='campaigns'?'newCampaign':'newPage'))+panel('All '+title.toLowerCase(),state[key].length?table(['Name','Details','Status','Edit'],state[key].map((v,i)=>'<tr><td>'+esc(v.name||v.title)+'</td><td>'+(key==='pages'&&v.status==='Published'?'<a target="_blank" rel="noopener" href="/pages/'+encodeURIComponent(v.slug)+'">'+esc(v.slug)+'</a>':esc(v.code||v.channel||v.slug||'—'))+'</td><td><span class="tag neutral">'+esc(v.status||'Draft')+'</span></td><td><button class="secondary" data-editlist="'+key+':'+i+'">Edit</button></td></tr>')):'<div class="empty">Nothing created yet. Select Create new to begin.</div>')}function branding(){const s=state.settings;return head('Branding & theme','Control your storefront identity and visual content.')+notice+panel('Store identity','<div class="form-grid">'+[['brand','Brand name'],['tagline','Brand tagline'],['announcement','Announcement text'],['heroTitle','Homepage headline'],['accent','Accent color (hex)']].map(([k,l])=>'<label class="field">'+l+'<input data-setting="'+k+'" value="'+esc(s[k])+'"></label>').join('')+uploadField('heroFile','Upload homepage image','image/jpeg,image/png,image/webp,image/avif')+'</div><button class="primary" data-action="saveBrand">Save branding</button>')+panel('Storefront preview','<p class="muted">Open the storefront to confirm published changes.</p><a href="./index.html" target="_blank" class="secondary">↗ Open storefront</a>')}function gallery(){return head('Media gallery','Upload images and videos from your computer.')+
panel('Upload media','<form id="mediaUpload">'+uploadField('media','Choose image or video')+
'<button class="primary">Upload</button></form><p>Images up to 10 MB. Videos up to 50 MB.</p>')+
panel('Uploaded media','<div id="mediaGrid">Loading media…</div><button class="secondary" id="moreMedia" data-action="moreMedia" hidden>Next page</button>')}function navigation(){const links=structuredClone(shared.navigation?.value ?? [{label:'Collections',url:'/collection.html'},{label:'Gallery',url:'/gallery.html'},{label:'The House',url:'/house.html'},{label:'Craftsmanship',url:'/craftsmanship.html'}]);return head('Navigation','Publish storefront menu links.')+notice+panel('Main menu',links.map((x,i)=>'<div class="list-row"><div><strong>'+esc(x.label)+'</strong><small> '+esc(x.url)+'</small></div><span><button class="secondary" data-nav-up="'+i+'">↑</button> <button class="secondary" data-nav-down="'+i+'">↓</button> <button class="secondary" data-nav-remove="'+i+'">Delete</button></span></div>').join('')+'<form id="navAddForm" class="form-grid"><label class="field">Label<input name="label" required maxlength="60"></label><label class="field">URL<input name="url" required maxlength="500" placeholder="./index.html#collections"></label><button class="primary" type="submit">Add menu link</button></form>')}function settings(){return head('Settings','Store preferences.')+panel('Delivery planning','<label class="field">Standard delivery fee (₦)<input type="number" min="0" id="shipping" value="'+Number(state.settings.shipping||0)+'"></label><p>Applied once per order at checkout.</p><button class="primary" data-action="saveSettings">Save delivery fee</button>')}function marketing() {
  const planner = listView('campaigns','Marketing & advertising','Plan campaigns and control existing Meta campaigns.');
  if (staffRole !== 'owner') return planner;
  return planner + panel('Meta campaign controls','<form id="metaCampaignForm" class="form-grid">'+
    '<label class="field">Meta campaign ID<input name="id" inputmode="numeric" required></label>'+
    '<button class="primary" name="action" value="review">Review campaign</button>'+
    '<button class="secondary" name="action" value="activate" disabled>Activate</button>'+
    '<button class="secondary" name="action" value="pause" disabled>Pause</button><p role="status"></p></form>');
}
document.addEventListener('input', event => {
  const form = event.target.closest('#metaCampaignForm');
  if (form) {
    delete form.dataset.reviewed;
    form.querySelectorAll('button[value]:not([value="review"])').forEach(button => { button.disabled = true; });
  }
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'metaCampaignForm') return;
  event.preventDefault();
  const form = event.target;
  const id = form.elements.id.value.trim();
  const action = event.submitter.value;
  if (action !== 'review' && form.dataset.reviewed !== id) return;
  if (action === 'activate' && !confirm('Activate this Meta campaign? Meta may begin spending its configured budget.')) return;
  const message = form.querySelector('[role="status"]');
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const campaign = await adminApi('meta-campaign','POST',{ id, action, confirmed: action === 'activate' });
    form.dataset.reviewed = id;
    message.textContent = campaign.name + ' · ' + campaign.status +
      ' · Review budget and delivery in Meta Ads Manager before activating.';
  } catch(error) { message.textContent = error.message; }
  finally {
    buttons.forEach(button => { button.disabled = button.value !== 'review' && form.dataset.reviewed !== form.elements.id.value.trim(); });
  }
});
function render(){const views={home,orders:()=>head('Orders','Manage checkout records and fulfillment.')+panel('Order history',orders().length?orderTable(orders()):'<div class="empty">No orders yet.</div>'),products,inventory,customers,analytics,marketing,discounts:()=>listView('discounts','Discounts','Manage promotion codes and offers.'),content:()=>listView('pages','Content & pages','Manage editorial pages and publishing.'),branding,gallery,navigation,settings};$('#screen').innerHTML=(views[page]||home)();document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='gallery')loadGallery()}function field(name,label,value='',type='text'){return '<label class="field">'+label+(type==='textarea'?'<textarea name="'+name+'">'+esc(value)+'</textarea>':'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'">')+'</label>'}let editing=null;function openEditor(type,index){editing={type,index};const v=type==='product'?(index==null?{}:state.products.find(x=>x.id===index)):index==null?{}:state[type][index];$('#editorTitle').textContent=(index==null?'Create ':'Edit ')+(type==='product'?'product':type.slice(0,-1));let fields='';if(type==='product'){fields=field('name','Product name',v.name)+field('category','Category',v.category||'Bomber')+field('price','Price (₦)',v.price??'','text')+uploadField('imageFile','Upload product image',fileTypes.split(',').filter(type=>type.startsWith('image/')).join(','))+uploadField('videoFile','Upload product video','video/mp4,video/webm')+field('description','Description',v.description,'textarea')+'<label class="field">Status<select name="status"><option value="Draft">Draft</option><option value="Active"'+(v.status==='Active'?' selected':'')+'>Published</option></select></label>'}else if(type==='discounts'){fields=field('name','Offer name',v.name)+field('code','Discount code',v.code)+field('percent','Percentage off',v.percent||10,'number')+'<label class="field">Status<select name="status"><option>Draft</option><option'+(v.status==='Active'?' selected':'')+'>Active</option></select></label>'}else if(type==='campaigns'){fields=field('name','Campaign name',v.name)+field('channel','Channel (Meta, Google, Email)',v.channel||'Meta')+field('budget','Planned budget (₦)',v.budget||0,'number')+field('status','Status',v.status||'Draft')}else{fields=field('title','Page title',v.title)+field('slug','URL slug',v.slug)+field('body','Page content',v.body,'textarea')+'<label class="field">Status<select name="status"><option>Draft</option><option'+(v.status==='Published'?' selected':'')+'>Published</option></select></label>'}$('#editorFields').innerHTML=fields;$('#editor').showModal()}$('#editorForm').onsubmit = async event => {
  event.preventDefault();
  if (!editing || !token) return;
  const { type, index } = editing;
  const values = Object.fromEntries(new FormData(event.target));
  if (type === 'product') {
    const amount = /^(\d+)(?:\.(\d{1,2}))?$/.exec(values.price.trim());
    if (!amount) return toast('Enter a price with up to two decimal places.');
    const priceMinor = Number(amount[1]) * 100 + Number((amount[2] ?? '').padEnd(2, '0'));
    const id = index || editing.newId || (editing.newId = 'jacket-' + crypto.randomUUID());
    const submit = event.target.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const previous = state.products.find(item => item.id === id);
      const image = values.imageFile?.size ? await upload(values.imageFile) : previous?.image ?? '';
      const video = values.videoFile?.size ? await upload(values.videoFile) : previous?.video ?? '';
      const { product } = await adminApi('products/' + id, 'PUT', {
        name: values.name, category: values.category, price_minor: priceMinor,
        image_url: image, video_url: video, description: values.description, active: values.status === 'Active',
      });
      state.products = [toProduct(product), ...state.products.filter(item => item.id !== id)];
      toast('Product saved to Cloudflare');
    } catch (error) {
      toast(error.message);
      return;
    } finally {
      submit.disabled = false;
    }
  } else {
    const entries = [...state[type]];
    if (index == null) entries.unshift(values);
    else entries[index] = values;
    try {
      await saveShared(type, entries);
      state[type] = entries;
    } catch (error) {
      state[type] = structuredClone(shared[type]?.value ?? []);
      return toast(error.message);
    }
    toast('Saved to Cloudflare');
  }
  $('#editor').close();
  render();
};
$('#closeEditor').onclick=$('#cancelEditor').onclick=()=>$('#editor').close();document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{page=b.dataset.page;render();$('.sidebar').classList.remove('open')});$('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');$('#globalSearch').oninput=e=>{const q=e.target.value.toLowerCase();if(q){page='products';render();$('#productFilter').value=q;filterProducts()}};function filterProducts(){const q=($('#productFilter')?.value||'').toLowerCase(),cat=$('#categoryFilter')?.value||'';$('#productTable').innerHTML=productTable(state.products.filter(p=>(p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q))&&(!cat||p.category===cat)))}document.addEventListener('input',e=>{if(e.target.id==='productFilter')filterProducts()});document.addEventListener('change',e=>{if(e.target.id==='categoryFilter')filterProducts()});document.addEventListener('submit',async e=>{if(e.target.id==='mediaUpload'){
e.preventDefault();const file=new FormData(e.target).get('media');if(!file?.size)return toast('Choose a file.');
const submit=e.target.querySelector('button');submit.disabled=true;
try{await upload(file);e.target.reset();await loadGallery();toast('Media uploaded')}catch(error){toast(error.message)}finally{submit.disabled=false}return
}if(e.target.id!=='navAddForm')return;e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(!/^(https:\/\/|\.\/|\/|#)/.test(v.url)){toast('Use an HTTPS or relative URL');return}const links=structuredClone(shared.navigation?.value ?? []);links.push(v);try{await saveShared('navigation',links);render();toast('Menu link published')}catch(error){toast(error.message)}});document.addEventListener('click',async e=>{
const cancel=e.target.closest('[data-cancel-order]');
if(cancel){
 if(!confirm('Cancel this unpaid order?'))return;
 cancel.disabled=true;
 try{
  await adminApi('orders/'+encodeURIComponent(cancel.dataset.cancelOrder)+'/cancel','POST');
  liveOrders=await loadOrders();render();toast('Order cancelled');
 }catch(error){toast(error.message)}finally{cancel.disabled=false}
 return;
}
const navButton=e.target.closest('[data-nav-up],[data-nav-down],[data-nav-remove]');if(navButton){const links=structuredClone(shared.navigation?.value ?? [{label:'Collections',url:'/collection.html'},{label:'Gallery',url:'/gallery.html'},{label:'The House',url:'/house.html'},{label:'Craftsmanship',url:'/craftsmanship.html'}]);const i=Number(navButton.dataset.navUp??navButton.dataset.navDown??navButton.dataset.navRemove);if(navButton.hasAttribute('data-nav-remove'))links.splice(i,1);else{const j=i+(navButton.hasAttribute('data-nav-up')?-1:1);if(j>=0&&j<links.length)[links[i],links[j]]=[links[j],links[i]]}try{await saveShared('navigation',links);render()}catch(error){toast(error.message)}return}const a=e.target.closest('[data-action]')?.dataset.action;if(a==='moreMedia'&&galleryCursor)await loadGallery(galleryCursor);if(a==='newProduct')openEditor('product');if(a==='newDiscount')openEditor('discounts');if(a==='newCampaign')openEditor('campaigns');if(a==='newPage')openEditor('pages');if(a==='branding'){page='branding';render()}if(a==='saveBrand'||a==='saveSettings'){
const control=e.target.closest('[data-action]');control.disabled=true;
try{
 const settings={...state.settings};
 if(a==='saveBrand'){
  document.querySelectorAll('[data-setting]').forEach(el=>settings[el.dataset.setting]=el.value);
  const file=document.querySelector('[name="heroFile"]')?.files[0];
  if(file)settings.heroImage=await upload(file);
 }else settings.shipping=Math.max(0,Number($('#shipping').value)||0);
 await saveShared('settings',settings);state.settings=settings;toast('Saved to Cloudflare');
}catch(error){toast(error.message)}finally{control.disabled=false}
}if(a==='export'){const rows=[['Name','Category','Price','Status'],...state.products.map(p=>[p.name,p.category,p.price,p.status])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download='okopi-products.csv';link.click();URL.revokeObjectURL(url)}const id=e.target.closest('[data-editproduct]')?.dataset.editproduct;if(id)openEditor('product',id);const key=e.target.closest('[data-editlist]')?.dataset.editlist;if(key){const [type,index]=key.split(':');openEditor(type,Number(index))}});const login = $('#adminLogin');
const shell = $('.shell');
login.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = login.querySelector('button');
  const message = login.querySelector('[role="status"]');
  token = login.elements.token.value.trim();
  submit.disabled = true;
  message.textContent = 'Connecting to Cloudflare…';
  try {
    const [catalog, records, settings, session] = await Promise.all([adminApi('products'), loadOrders(), adminApi('settings'), adminApi('session')]);
    staffRole = session.role;
    const staffMenu = document.querySelector('[data-extra="staff"]');
    if (staffMenu) staffMenu.hidden = staffRole !== 'owner';
    Object.assign(shared, settings);
    for (const key of ['pages','discounts','campaigns']) state[key] = structuredClone(shared[key]?.value ?? []);
    state.settings = { ...state.settings, ...shared.settings?.value };
    state.products = catalog.products.map(toProduct);
    liveOrders = records;
    render();
    login.reset();
    login.hidden = true;
    shell.hidden = false;
    shell.style.removeProperty('display');
  } catch (error) {
    token = '';
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('#lockAdmin').onclick = () => location.reload();
})();
