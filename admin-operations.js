(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sections=[['email','Email & newsletters'],['forms','Contact forms'],['seo','SEO & metadata'],['shipping','Shipping zones'],['returns','Returns & policies'],['automation','Automations'],['staff','Staff & permissions'],['activity','Activity log']];
const defaults={email:[],forms:[],seo:[{name:'Homepage',title:'OKOPI PETERSON | Luxury Outerwear',description:'Discover distinctive jackets and outerwear.'}],shipping:[],returns:[],automation:[],staff:[],activity:[]};
let data;try{data={...defaults,...JSON.parse(localStorage.getItem('opAdminExtras')||'{}')}}catch{data=structuredClone(defaults)}
const persist=()=>localStorage.setItem('opAdminExtras',JSON.stringify(data));
const log=message=>{data.activity.unshift({name:message,at:new Date().toISOString()});data.activity=data.activity.slice(0,100);persist()};
const nav=document.querySelector('#nav'),screen=document.querySelector('#screen');
if(!nav||!screen)return;
const label=document.createElement('div');label.className='navlabel';label.textContent='OPERATIONS';nav.append(label);
sections.forEach(([key,title])=>{const b=document.createElement('button');b.textContent='◦   '+title;b.dataset.extra=key;nav.append(b);b.addEventListener('click',()=>render(key))});
const fields={email:['name','subject','audience','message','status'],forms:['name','recipient','fields','successMessage'],seo:['name','title','description','canonical'],shipping:['name','region','rate','deliveryEstimate'],returns:['name','policy','contact'],automation:['name','trigger','action','status'],staff:['name','role','email']};
function render(key){document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.extra===key));const title=sections.find(s=>s[0]===key)[1];
const intro=key==='staff'?'Staff records here are planning-only; they do not grant access or protect the admin.':key==='email'?'Email campaigns are drafts; sending requires a connected email provider.':key==='automation'?'Automation rules are drafts and do not run automatically.':'Saved in this browser only; no shared production database is connected.';
screen.innerHTML='<div class="page-head"><div><h1>'+esc(title)+'</h1><p>'+esc(intro)+'</p></div></div><div class="notice"><strong>Local preview:</strong> This page is not a secure production backend.</div><section class="panel"><h2>'+esc(title)+'</h2><div id="extraRows"></div></section>'+(key==='activity'?'':'<section class="panel"><h2>Create record</h2><form id="extraForm"><div class="form-grid">'+fields[key].map(f=>'<label class="field">'+esc(f)+'<input name="'+esc(f)+'" required maxlength="1000"></label>').join('')+'</div><button class="primary" type="submit">Save locally</button></form></section>');
const rows=document.querySelector('#extraRows');rows.innerHTML=data[key].length?data[key].map((item,i)=>'<div class="list-row"><div><strong>'+esc(item.name||item.title)+'</strong><div class="muted">'+esc(item.subject||item.description||item.region||item.at||item.role||'')+'</div></div>'+(key==='activity'?'':'<button class="secondary" data-remove="'+i+'">Delete</button>')+'</div>').join(''):'<div class="empty">No records yet.</div>';
rows.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{data[key].splice(Number(b.dataset.remove),1);log('Deleted '+title+' record');render(key)});
const form=document.querySelector('#extraForm');if(form)form.onsubmit=e=>{e.preventDefault();const item=Object.fromEntries(new FormData(form));data[key].unshift(item);log('Created '+title+' record');render(key)};
}
document.querySelectorAll('#nav button:not([data-extra])').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-extra]').forEach(x=>x.classList.remove('active'))}));
})();