(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sections=[['email','Email & newsletters'],['forms','Contact forms'],['seo','SEO & metadata'],['shipping','Shipping zones'],['returns','Returns & policies'],['automation','Automations'],['staff','Staff & permissions'],['activity','Activity log']];
const defaults={email:[],forms:[],seo:[{name:'Homepage',title:'OKOPI PETERSON | Luxury Outerwear',description:'Discover distinctive jackets and outerwear.'}],shipping:[],returns:[],automation:[],staff:[],activity:[]};
const cloud = window.maisonpeAdminSettings;
const get = key => structuredClone(cloud.read(key) ?? defaults[key]);
async function saveRecords(key, entries, message) {
  await cloud.save(key, entries);
  try {
    await cloud.save('activity', [{ name: message, at: new Date().toISOString() }, ...get('activity')].slice(0, 100));
  } catch {
    alert('Record saved. The activity entry could not be recorded.');
  }
}
const nav=document.querySelector('#nav'),screen=document.querySelector('#screen');
if(!nav||!screen)return;
const label=document.createElement('div');label.className='navlabel';label.textContent='OPERATIONS';nav.append(label);
sections.forEach(([key,title])=>{const b=document.createElement('button');b.textContent='◦   '+title;b.dataset.extra=key;nav.append(b);b.addEventListener('click',()=>render(key))});
const fields={email:['name','subject','audience','message','status'],forms:['name','recipient','fields','successMessage'],seo:['name','title','description','canonical'],shipping:['name','region','rate','deliveryEstimate'],returns:['name','policy','contact'],automation:['name','trigger','action','status'],staff:['name','role','email']};
function render(key){const records=get(key);document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.extra===key));const title=sections.find(s=>s[0]===key)[1];
const intro=key==='staff'?'Staff records here are planning-only; they do not grant access or protect the admin.':key==='email'?'Email campaigns are drafts; sending requires a connected email provider.':key==='automation'?'Automation rules are drafts and do not run automatically.':'Records are shared through Cloudflare.';
screen.innerHTML='<div class="page-head"><div><h1>'+esc(title)+'</h1><p>'+esc(intro)+'</p></div></div><section class="panel"><h2>'+esc(title)+'</h2><div id="extraRows"></div></section>'+(key==='activity'?'':'<section class="panel"><h2>Create record</h2><form id="extraForm"><div class="form-grid">'+fields[key].map(f=>'<label class="field">'+esc(f)+'<input name="'+esc(f)+'" required maxlength="1000"></label>').join('')+'</div><button class="primary" type="submit">Save record</button></form></section>');
const utility=document.createElement('div');utility.className='toolbar';utility.innerHTML='<button class="secondary" id="extraExport">Export JSON</button><label class="secondary" style="cursor:pointer">Import JSON <input id="extraImport" type="file" accept="application/json" hidden></label>';
const section=document.querySelector('#extraRows').parentElement;section.insertBefore(utility,document.querySelector('#extraRows'));
document.querySelector('#extraExport').onclick=()=>{const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='okopi-'+key+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
document.querySelector('#extraImport').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!Array.isArray(imported)||imported.length>1000||imported.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Expected an array of up to 1000 records');if(!confirm('Replace all '+title+' records?'))return;await saveRecords(key,imported,'Imported '+title+' records');render(key)}catch(err){alert('Import failed: '+err.message)}};
const rows=document.querySelector('#extraRows');rows.innerHTML=records.length?records.map((item,i)=>'<div class="list-row"><div><strong>'+esc(item.name||item.title)+'</strong><div class="muted">'+esc(item.subject||item.description||item.region||item.at||item.role||'')+'</div></div>'+(key==='activity'?'':'<span><button class="secondary" data-edit="'+i+'">Edit</button> <button class="secondary" data-remove="'+i+'">Delete</button></span>')+'</div>').join(''):'<div class="empty">No records yet.</div>';
rows.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const item=records[Number(b.dataset.edit)];const form=document.querySelector('#extraForm');if(!form)return;fields[key].forEach(f=>{if(form.elements[f])form.elements[f].value=item[f]||''});form.dataset.edit=b.dataset.edit;form.scrollIntoView({behavior:'smooth',block:'center'});form.querySelector('button[type="submit"]').textContent='Update record'});
rows.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{
 const updated=records.filter((_,i)=>i!==Number(b.dataset.remove));
 try{await saveRecords(key,updated,'Deleted '+title+' record');render(key)}catch(error){alert(error.message)}
});
const form=document.querySelector('#extraForm');
if(form)form.onsubmit=async e=>{
 e.preventDefault();
 const item=Object.fromEntries(new FormData(form));
 const updated=[...records];
 if(form.dataset.edit!==undefined)updated[Number(form.dataset.edit)]=item;
 else updated.unshift(item);
 const submit=form.querySelector('[type="submit"]');
 submit.disabled=true;
 try{await saveRecords(key,updated,'Saved '+title+' record');render(key)}catch(error){alert(error.message)}finally{submit.disabled=false}
};
}
document.querySelectorAll('#nav button:not([data-extra])').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-extra]').forEach(x=>x.classList.remove('active'))}));
})();