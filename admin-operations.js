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
async function staffPanel() {
  screen.innerHTML='<div class="page-head"><h1>Staff & permissions</h1></div>'+
    '<section class="panel"><ul id="staffList"></ul><form id="staffForm" class="form-grid">'+
    '<label class="field">Name<input name="name" required maxlength="120"></label>'+
    '<label class="field">Email<input name="email" type="email" required maxlength="254"></label>'+
    '<label class="field">Role<select name="role"><option value="viewer">Viewer</option><option value="manager">Manager</option></select></label>'+
    '<button class="primary">Create sign-in token</button></form><div id="staffNotice" role="status"></div></section>';
  const list = document.querySelector('#staffList');
  const form = document.querySelector('#staffForm');
  const notice = document.querySelector('#staffNotice');
  async function refresh() {
    const { staff } = await cloud.api('staff');
    list.replaceChildren(...staff.map(person => {
      const row = document.createElement('li');
      row.textContent = person.name+' · '+person.email+' · '+person.role+' ';
      const revoke = document.createElement('button');
      revoke.textContent = 'Revoke';
      revoke.onclick = async () => {
        if (!confirm('Revoke access for '+person.name+'?')) return;
        try { await cloud.api('staff/'+person.id,'DELETE'); await refresh(); }
        catch(error) { notice.textContent=error.message; }
      };
      row.append(revoke);
      return row;
    }));
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('button');
    submit.disabled = true;
    try {
      const {token} = await cloud.api('staff','POST',Object.fromEntries(new FormData(form)));
      const value = document.createElement('input');
      value.readOnly = true;
      value.value = token;
      value.setAttribute('aria-label','New staff token');
      notice.replaceChildren('Copy this token now and share it privately with the staff member. ',value);
      value.select();
      form.reset();
      await refresh();
    } catch(error) { if (!notice.querySelector('input')) notice.textContent=error.message; }
    finally { submit.disabled=false; }
  };
  try { await refresh(); } catch(error) { notice.textContent=error.message; }
}

function emailSender(rows, records) {
  rows.querySelectorAll('[data-send-email]').forEach(button => {
    const draft = records[Number(button.dataset.sendEmail)];
    button.onclick = () => {
      const form = document.createElement('form');
      form.className = 'form-grid';
      form.innerHTML = '<label class="field">Resend segment ID<input required name="segment" maxlength="36"></label>'+
        '<label><input type="checkbox" name="consent" required> These recipients agreed to receive this message.</label>'+
        '<button class="primary">Send campaign</button><p role="status"></p>';
      button.replaceWith(form);
      let previousSegment = '';
      let id = '';
      form.onsubmit = async event => {
        event.preventDefault();
        const segment = form.elements.segment.value.trim();
        if (!confirm('Send this campaign to the selected Resend segment?')) return;
        if (segment !== previousSegment) { id = crypto.randomUUID(); previousSegment = segment; }
        const send = form.querySelector('button');
        const notice = form.querySelector('[role="status"]');
        send.disabled = true;
        try {
          const result = await cloud.api('email-send','POST',{
            subject:draft.subject,message:draft.message,segment_id:segment,consent:form.elements.consent.checked,request_id:id,
          });
          notice.textContent = 'Campaign accepted by Resend. Broadcast ID '+result.id+'.';
        } catch(error) { notice.textContent=error.message; send.disabled=false; }
      };
    };
  });
}

async function showAutomationRuns(target) {
  try {
    const {runs} = await cloud.api('automation-runs');
    const list = document.createElement('ul');
    for (const run of runs) {
      const row = document.createElement('li');
      row.textContent = run.at+' · '+run.name;
      list.append(row);
    }
    target.replaceChildren(list);
    if (!runs.length) target.textContent = 'No automation runs yet.';
  } catch(error) { target.textContent = error.message; }
}
async function showSubscribers(panel, after = '') {
  const list = panel.querySelector('ul');
  const status = panel.querySelector('[role="status"]');
  const next = panel.querySelector('button');
  next.hidden = true;
  try {
    const data = await cloud.api('newsletter' + (after ? '?after=' + encodeURIComponent(after) : ''));
    for (const subscriber of data.subscribers) {
      const row = document.createElement('li');
      row.textContent = subscriber.email + ' · ' + subscriber.subscribed_at + ' UTC';
      list.append(row);
    }
    status.textContent = list.children.length ? '' : 'No subscribers yet.';
    if (data.next) {
      next.hidden = false;
      next.onclick = () => showSubscribers(panel, data.next);
    }
  } catch (error) {
    status.textContent = error.message;
  }
}
function render(key){const records=get(key);document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.extra===key));const title=sections.find(s=>s[0]===key)[1];if(key==='staff'){staffPanel();return;}
const intro=key==='email'?'Send saved messages to opted-in recipients after connecting your sender.':key==='automation'?'Active rules log a verified payment automatically.':'Records are shared through Cloudflare.';
screen.innerHTML='<div class="page-head"><div><h1>'+esc(title)+'</h1><p>'+esc(intro)+'</p></div></div><section class="panel"><h2>'+esc(title)+'</h2><div id="extraRows"></div></section>'+(key==='activity'?'':'<section class="panel"><h2>Create record</h2><form id="extraForm"><div class="form-grid">'+fields[key].map(f=>key==='automation'&&f==='trigger'?'<label class="field">Trigger<select name="trigger"><option value="payment_verified">Payment verified</option></select></label>':key==='automation'&&f==='action'?'<label class="field">Action<select name="action"><option value="activity_log">Write a run log</option></select></label>':key==='automation'&&f==='status'?'<label class="field">Status<select name="status"><option>Draft</option><option>Active</option></select></label>':'<label class="field">'+esc(f)+'<input name="'+esc(f)+'" required maxlength="1000"></label>').join('')+'</div><button class="primary" type="submit">Save record</button></form></section>');
const utility=document.createElement('div');utility.className='toolbar';utility.innerHTML='<button class="secondary" id="extraExport">Export JSON</button><label class="secondary" style="cursor:pointer">Import JSON <input id="extraImport" type="file" accept="application/json" hidden></label>';
const section=document.querySelector('#extraRows').parentElement;section.insertBefore(utility,document.querySelector('#extraRows'));
document.querySelector('#extraExport').onclick=()=>{const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='okopi-'+key+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
document.querySelector('#extraImport').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!Array.isArray(imported)||imported.length>1000||imported.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Expected an array of up to 1000 records');if(!confirm('Replace all '+title+' records?'))return;await saveRecords(key,imported,'Imported '+title+' records');render(key)}catch(err){alert('Import failed: '+err.message)}};
const rows=document.querySelector('#extraRows');rows.innerHTML=records.length?records.map((item,i)=>'<div class="list-row"><div><strong>'+esc(item.name||item.title)+'</strong><div class="muted">'+esc(item.subject||item.description||item.region||item.at||item.role||'')+'</div></div>'+(key==='activity'?'':'<span><button class="secondary" data-edit="'+i+'">Edit</button> <button class="secondary" data-remove="'+i+'">Delete</button>'+(key==='email'&&cloud.role()==='owner'?'<button class="secondary" data-send-email="'+i+'">Prepare send</button>':'')+'</span>')+'</div>').join(''):'<div class="empty">No records yet.</div>';
if (key==='email') {
  emailSender(rows,records);
  if (cloud.role()==='owner') {
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.innerHTML = '<h2>Newsletter subscribers</h2><ul></ul><p role="status">Loading…</p><button class="secondary" hidden>Load more</button>';
    screen.append(panel);
    showSubscribers(panel);
  }
}
if (key==='automation') {
  const history = document.createElement('section');
  history.className='panel';
  history.innerHTML='<h2>Run history</h2><div>Loading…</div>';
  screen.append(history);
  showAutomationRuns(history.lastElementChild);
}
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