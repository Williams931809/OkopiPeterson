(()=>{'use strict';const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const money=n=>'₦'+Number(n||0).toLocaleString('en-NG');const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));let state=read('opAdminState',{products:[],discounts:[],campaigns:[],pages:[],settings:{brand:'OKOPI PETERSON',tagline:'THE ART OF OUTERWEAR',announcement:'',heroTitle:'Wear the exceptional.',heroImage:'',accent:'#111111',shipping:5000}});let token = '';
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
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Store request failed.');
  return result;
}

const toProduct = p => ({
  id: p.id, name: p.name, category: p.category, price: p.price_minor / 100,
  image: p.image_url, description: p.description, status: p.active ? 'Active' : 'Draft',
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

function savePreview() {
  const { products, ...preview } = state;
  save('opAdminState', { ...preview, products: read('opAdminState', {}).products ?? [] });
}
const titles={home:'Home',orders:'Orders',products:'Products',inventory:'Inventory',customers:'Customers',analytics:'Analytics',marketing:'Marketing & advertising',discounts:'Discounts',content:'Content & pages',branding:'Branding & theme',gallery:'Media gallery',navigation:'Navigation',settings:'Settings'};const head=(title,desc,button='')=>'<div class="page-head"><div><h1>'+title+'</h1><p>'+desc+'</p></div>'+button+'</div>';const panel=(title,body)=>'<section class="panel"><h2>'+title+'</h2>'+body+'</section>';const table=(cols,rows)=>'<div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';const notice='<div class="notice"><strong>Preview settings:</strong> Changes in this section are saved in this browser.</div>';let page='home';function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2800)}function button(label,action){return '<button class="primary" data-action="'+action+'">'+label+'</button>'}function home(){const total=paidOrders().reduce((s,o)=>s+(o.total||0),0);return head('Good day. Welcome back.','Here is what is happening with your store.',button('Add product','newProduct'))+'<div class="cards">'+[['Total sales',money(total),'Verified live payments'],['Orders',orders().length,'Cloudflare orders'],['Products',state.products.length,'Cloudflare catalog'],['Active campaigns',state.campaigns.filter(c=>c.status==='Active').length,'Draft marketing plans']].map(x=>'<div class="card"><label>'+x[0]+'</label><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('')+'</div><div class="two">'+panel('Sales overview', '<div class="chart">'+[15,35,22,45,31,62,48,75,53,80,60,92].map(v=>'<div style="height:'+v+'%"></div>').join('')+'</div><p class="muted">Illustrative chart — not live sales data.</p>')+panel('Quick actions',[['Add a new jacket','newProduct'],['Create discount','newDiscount'],['Launch a campaign','newCampaign'],['Customize storefront','branding']].map(x=>'<div class="list-row"><span>'+x[0]+'</span><button class="secondary" data-action="'+x[1]+'">Open →</button></div>').join(''))+'</div>'+panel('Recent orders',orders().length?orderTable(orders().slice(0,5)):'<div class="empty">No orders yet.</div>')}function orderTable(list){return table(['Reference','Customer','Amount','Status','Date'],list.map(o=>'<tr><td>'+esc(o.reference)+'</td><td>'+esc(o.customer?.name||'—')+'<details><summary>Order details</summary><p>'+esc(o.customer.email)+'</p><p>'+esc(o.customer.phone)+'</p><p>'+esc(o.address)+'</p><ul>'+o.items.map(item=>'<li>'+esc(item.name)+' · '+esc(item.size)+' × '+esc(item.quantity)+'</li>').join('')+'</ul></details>'+'</td><td>'+money(o.total)+'</td><td><span class="tag neutral">'+esc(o.status)+(o.test?' · Test':'')+'</span></td><td>'+new Date(o.date).toLocaleDateString()+'</td></tr>'))}function productTable(list){return table(['Product','Category','Price','Status','Manage'],list.map(p=>'<tr><td>'+(p.image?'<img src="'+esc(p.image)+'" alt="">':'')+'<strong>'+esc(p.name)+'</strong></td><td>'+esc(p.category)+'</td><td>'+money(p.price)+'</td><td><span class="tag">'+esc(p.status)+'</span></td><td><button class="secondary" data-editproduct="'+esc(p.id)+'">Edit</button></td></tr>'))}function products(){return head('Products','Manage jacket listings and pricing.',button('Add product','newProduct'))+panel('All products <span class="muted">('+state.products.length+')</span>','<div class="toolbar"><input id="productFilter" placeholder="Search products"><select id="categoryFilter"><option value="">All categories</option>'+['Leather','Varsity','Bomber','Denim','Puffer'].map(x=>'<option>'+x+'</option>').join('')+'</select><button class="secondary" data-action="export">Export CSV</button></div><div id="productTable">'+productTable(state.products)+'</div>')}function inventory(){return head('Inventory','Catalog availability by product.')+panel('Catalog availability',productTable(state.products))}function customers(){const seen=new Map();orders().forEach(o=>{const email=o.customer?.email;if(email&&!seen.has(email))seen.set(email,o.customer)});return head('Customers','Customer records from Cloudflare orders.')+panel('Customer directory',seen.size?table(['Name','Email','Phone'],[...seen.values()].map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.email)+'</td><td>'+esc(c.phone)+'</td></tr>')):'<div class="empty">No customers recorded in this browser yet.</div>')}function analytics(){return head('Analytics','Understand your store performance.')+'<div class="cards">'+[['Orders',orders().length],['Verified sales',money(paidOrders().reduce((s,o)=>s+(o.total||0),0))],['Average order',money(paidOrders().length?paidOrders().reduce((s,o)=>s+(o.total||0),0)/paidOrders().length:0)],['Products',state.products.length]].map(x=>'<div class="card"><label>'+x[0]+'</label><strong>'+x[1]+'</strong></div>').join('')+'</div>'+panel('Reporting', '<p class="muted">Real conversion rates, visitors, ad attribution and revenue reports require production event tracking and a database.</p>')}function listView(key,title,desc,fields){return head(title,desc,button('Create new',key==='discounts'?'newDiscount':key==='campaigns'?'newCampaign':'newPage'))+panel('All '+title.toLowerCase(),state[key].length?table(['Name','Details','Status','Edit'],state[key].map((v,i)=>'<tr><td>'+esc(v.name||v.title)+'</td><td>'+esc(v.code||v.channel||v.slug||'—')+'</td><td><span class="tag neutral">'+esc(v.status||'Draft')+'</span></td><td><button class="secondary" data-editlist="'+key+':'+i+'">Edit</button></td></tr>')):'<div class="empty">Nothing created yet. Select Create new to begin.</div>')}function branding(){const s=state.settings;return head('Branding & theme','Control your storefront identity and visual content.')+notice+panel('Store identity','<div class="form-grid">'+[['brand','Brand name'],['tagline','Brand tagline'],['announcement','Announcement text'],['heroTitle','Homepage headline'],['heroImage','Hero image URL'],['accent','Accent color (hex)']].map(([k,l])=>'<label class="field">'+l+'<input data-setting="'+k+'" value="'+esc(s[k])+'"></label>').join('')+'</div><button class="primary" data-action="saveBrand">Save branding</button>')+panel('Storefront preview','<p class="muted">Open the storefront in the same browser to preview saved content changes.</p><a href="./index.html" target="_blank" class="secondary">↗ Open storefront</a>')}function gallery(){return head('Media gallery','Review image URLs used by your collection.',button('Add product image','newProduct'))+panel('Product imagery','<div class="media-grid">'+state.products.filter(p=>p.image).map(p=>'<div><img src="'+esc(p.image)+'" alt="'+esc(p.name)+'"><span>'+esc(p.name)+'</span></div>').join('')+'</div><p class="muted">Edit a product to add or change its photograph. Image URLs must be publicly accessible.</p>')}function navigation(){const links=read('opNavLinks',[{label:'Collections',url:'./index.html#collections'},{label:'Gallery',url:'./index.html#gallery'},{label:'The House',url:'./index.html#about'},{label:'Craftsmanship',url:'./index.html#craftsmanship'},{label:'Bag',url:'./index.html#bag'}]);return head('Navigation','Edit storefront menu links in this browser.')+notice+panel('Main menu',links.map((x,i)=>'<div class="list-row"><div><strong>'+esc(x.label)+'</strong><small> '+esc(x.url)+'</small></div><span><button class="secondary" data-nav-up="'+i+'">↑</button> <button class="secondary" data-nav-down="'+i+'">↓</button> <button class="secondary" data-nav-remove="'+i+'">Delete</button></span></div>').join('')+'<form id="navAddForm" class="form-grid"><label class="field">Label<input name="label" required maxlength="60"></label><label class="field">URL<input name="url" required maxlength="500" placeholder="./index.html#collections"></label><button class="primary" type="submit">Add menu link</button></form>')}function settings(){return head('Settings','Store preferences and configuration.')+notice+panel('Store settings','<label class="field">Shipping charge (₦)<input type="number" min="0" id="shipping" value="'+Number(state.settings.shipping||0)+'"></label><button class="primary" data-action="saveSettings">Save settings</button>')+panel('Production readiness','<div class="list-row"><span>Admin authentication and staff permissions</span><span class="tag neutral">Not connected</span></div><div class="list-row"><span>Shared database</span><span class="tag neutral">Not connected</span></div><div class="list-row"><span>Live payment processor</span><span class="tag neutral">Not connected</span></div><div class="list-row"><span>Advertising platforms</span><span class="tag neutral">Not connected</span></div>')}function render(){const views={home,orders:()=>head('Orders','Manage checkout records and fulfillment.')+panel('Order history',orders().length?orderTable(orders()):'<div class="empty">No orders yet.</div>'),products,inventory,customers,analytics,marketing:()=>listView('campaigns','Marketing & advertising','Plan promotions, campaigns and channels.'),discounts:()=>listView('discounts','Discounts','Manage promotion codes and offers.'),content:()=>listView('pages','Content & pages','Manage editorial pages and publishing.'),branding,gallery,navigation,settings};$('#screen').innerHTML=(views[page]||home)();document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page))}function field(name,label,value='',type='text'){return '<label class="field">'+label+(type==='textarea'?'<textarea name="'+name+'">'+esc(value)+'</textarea>':'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'">')+'</label>'}let editing=null;function openEditor(type,index){editing={type,index};const v=type==='product'?(index==null?{}:state.products.find(x=>x.id===index)):index==null?{}:state[type][index];$('#editorTitle').textContent=(index==null?'Create ':'Edit ')+(type==='product'?'product':type.slice(0,-1));let fields='';if(type==='product'){fields=field('name','Product name',v.name)+field('category','Category',v.category||'Bomber')+field('price','Price (₦)',v.price??'','text')+field('image','Image URL',v.image)+field('description','Description',v.description,'textarea')+'<label class="field">Status<select name="status"><option value="Draft">Draft</option><option value="Active"'+(v.status==='Active'?' selected':'')+'>Published</option></select></label>'}else if(type==='discounts'){fields=field('name','Offer name',v.name)+field('code','Discount code',v.code)+field('percent','Percentage off',v.percent||10,'number')+field('status','Status',v.status||'Draft')}else if(type==='campaigns'){fields=field('name','Campaign name',v.name)+field('channel','Channel (Meta, Google, Email)',v.channel||'Meta')+field('budget','Planned budget (₦)',v.budget||0,'number')+field('status','Status',v.status||'Draft')}else{fields=field('title','Page title',v.title)+field('slug','URL slug',v.slug)+field('body','Page content',v.body,'textarea')+field('status','Status',v.status||'Draft')}$('#editorFields').innerHTML=fields;$('#editor').showModal()}$('#editorForm').onsubmit = async event => {
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
      const { product } = await adminApi('products/' + id, 'PUT', {
        name: values.name, category: values.category, price_minor: priceMinor,
        image_url: values.image, description: values.description, active: values.status === 'Active',
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
    const entries = state[type];
    if (index == null) entries.unshift(values);
    else entries[index] = values;
    savePreview();
    toast('Saved in this browser');
  }
  $('#editor').close();
  render();
};
$('#closeEditor').onclick=$('#cancelEditor').onclick=()=>$('#editor').close();document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{page=b.dataset.page;render();$('.sidebar').classList.remove('open')});$('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');$('#globalSearch').oninput=e=>{const q=e.target.value.toLowerCase();if(q){page='products';render();$('#productFilter').value=q;filterProducts()}};function filterProducts(){const q=($('#productFilter')?.value||'').toLowerCase(),cat=$('#categoryFilter')?.value||'';$('#productTable').innerHTML=productTable(state.products.filter(p=>(p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q))&&(!cat||p.category===cat)))}document.addEventListener('input',e=>{if(e.target.id==='productFilter')filterProducts()});document.addEventListener('change',e=>{if(e.target.id==='categoryFilter')filterProducts()});document.addEventListener('submit',e=>{if(e.target.id!=='navAddForm')return;e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(!/^(https:\/\/|\.\/|\/|#)/.test(v.url)){toast('Use an HTTPS or relative URL');return}const links=read('opNavLinks',[]);links.push(v);save('opNavLinks',links);render();toast('Menu link added locally')});document.addEventListener('click',e=>{const navButton=e.target.closest('[data-nav-up],[data-nav-down],[data-nav-remove]');if(navButton){const links=read('opNavLinks',[{label:'Collections',url:'./index.html#collections'},{label:'Gallery',url:'./index.html#gallery'},{label:'The House',url:'./index.html#about'},{label:'Craftsmanship',url:'./index.html#craftsmanship'},{label:'Bag',url:'./index.html#bag'}]);const i=Number(navButton.dataset.navUp??navButton.dataset.navDown??navButton.dataset.navRemove);if(navButton.hasAttribute('data-nav-remove'))links.splice(i,1);else{const j=i+(navButton.hasAttribute('data-nav-up')?-1:1);if(j>=0&&j<links.length)[links[i],links[j]]=[links[j],links[i]]}save('opNavLinks',links);render();return}const a=e.target.closest('[data-action]')?.dataset.action;if(a==='newProduct')openEditor('product');if(a==='newDiscount')openEditor('discounts');if(a==='newCampaign')openEditor('campaigns');if(a==='newPage')openEditor('pages');if(a==='branding'){page='branding';render()}if(a==='saveBrand'){document.querySelectorAll('[data-setting]').forEach(el=>state.settings[el.dataset.setting]=el.value);savePreview();toast('Branding saved locally')}if(a==='saveSettings'){state.settings.shipping=Math.max(0,Number($('#shipping').value)||0);savePreview();toast('Settings saved locally')}if(a==='export'){const rows=[['Name','Category','Price','Status'],...state.products.map(p=>[p.name,p.category,p.price,p.status])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download='okopi-products.csv';link.click();URL.revokeObjectURL(url)}const id=e.target.closest('[data-editproduct]')?.dataset.editproduct;if(id)openEditor('product',id);const key=e.target.closest('[data-editlist]')?.dataset.editlist;if(key){const [type,index]=key.split(':');openEditor(type,Number(index))}});const login = $('#adminLogin');
const shell = $('.shell');
login.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = login.querySelector('button');
  const message = login.querySelector('[role="status"]');
  token = login.elements.token.value.trim();
  submit.disabled = true;
  message.textContent = 'Connecting to Cloudflare…';
  try {
    const [catalog, records] = await Promise.all([adminApi('products'), loadOrders()]);
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
