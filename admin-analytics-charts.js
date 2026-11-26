(()=>{'use strict';const root=document.querySelector('#screen');if(!root)return;
const currency=n=>'₦'+Math.round(Number(n)||0).toLocaleString('en-NG');
function orders(){return window.maisonpeAdminOrders().filter(o=>!o.test)}
function draw(){const h=root.querySelector('h1');if(!h||h.textContent.trim()!=='Analytics'||root.querySelector('#opCharts'))return;
const data=orders().filter(o=>o&&Number.isFinite(Number(o.total))&&o.date&&!Number.isNaN(Date.parse(o.date)));
const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(13-i));return d.toISOString().slice(0,10)});
const daily=days.map(day=>({day,orders:data.filter(o=>new Date(o.date).toISOString().slice(0,10)===day)}));
const totals=daily.map(d=>d.orders.filter(o=>o.status==='paid').reduce((sum,o)=>sum+Number(o.total),0)),counts=daily.map(d=>d.orders.length);
const max=Math.max(1,...totals),peak=Math.max(1,...counts);
const box=document.createElement('section');box.id='opCharts';box.className='panel';
box.innerHTML='<h2>Sales & order trends</h2><p class="muted">Last 14 days · Cloudflare orders and verified sales.</p><div class="op-chart-grid"><div><h3>Sales by day</h3><div class="op-bars" role="img" aria-label="Daily verified sales chart">'+daily.map((d,i)=>'<div class="op-bar-slot" title="'+d.day+': '+currency(totals[i])+'"><div class="op-bar" style="height:'+Math.max(totals[i]?3:1,totals[i]/max*100)+'%"></div></div>').join('')+'</div><div class="op-chart-ends"><span>'+days[0]+'</span><span>'+days[13]+'</span></div></div><div><h3>Orders by day</h3><svg viewBox="0 0 520 190" role="img" aria-label="Order count line chart" style="width:100%;height:190px"><path d="M 10 170 H 510" stroke="currentColor" opacity=".25" fill="none"/><polyline points="'+counts.map((v,i)=>(10+i*500/13)+','+(170-v/peak*145)).join(' ')+'" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/>'+counts.map((v,i)=>'<circle cx="'+(10+i*500/13)+'" cy="'+(170-v/peak*145)+'" r="4" fill="#111"><title>'+days[i]+': '+v+' orders</title></circle>').join('')+'</svg><div class="op-chart-ends"><span>'+days[0]+'</span><span>'+days[13]+'</span></div></div></div><div class="op-chart-summary"><strong>'+currency(totals.reduce((a,b)=>a+b,0))+'</strong> verified sales &nbsp; · &nbsp; <strong>'+counts.reduce((a,b)=>a+b,0)+'</strong> orders in 14 days</div>';
root.append(box);
}
const observer=new MutationObserver(()=>{if(!root.querySelector('#opCharts'))draw()});observer.observe(root,{childList:true});draw();
})();