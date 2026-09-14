import { escapeHtml, supabaseRest } from '/assets/client.js';

const workLabels={requested:'Requested',scheduled:'Scheduled',in_progress:'In progress',waiting_client:'Waiting on client',complete:'Complete',invoiced:'Invoiced',paid:'Paid',cancelled:'Cancelled'};
const categories={website:'Website',tech_support:'Tech support',content:'Content',maintenance:'Maintenance',other:'Other'};
const openWork=new Set(['requested','scheduled','in_progress','waiting_client']);
const byId=(items=[])=>new Map(items.map(item=>[item.id,item]));
const nullable=(value)=>value===''||value==null?null:value;
const money=(cents=0)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents||0)/100);
function date(value,fallback='No date'){if(!value)return fallback;const raw=String(value),d=raw.includes('T')?new Date(raw):new Date(`${raw}T12:00:00`);return Number.isNaN(d.getTime())?fallback:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)}
async function write(path,method,body){return supabaseRest(path,{method,headers:{Prefer:'return=representation'},body:JSON.stringify(body)})}
function workCard(item,names){const customer=names.customers?.get(item.customer_id)?.company_name||names.sites?.get(item.site_id)?.name||'General work';const amount=item.fixed_amount_cents??(item.billable_hours!=null&&item.hourly_rate_cents!=null?Math.round(item.billable_hours*item.hourly_rate_cents):null);const completion=item.completion_summary?`<div class="tracker-completion"><strong>Completed work</strong><p>${escapeHtml(item.completion_summary)}</p></div>`:'';return `<article class="tracker-work-card ${item.priority==='urgent'?'is-urgent':''}"><div class="tracker-work-top"><div><p class="tracker-kicker">${escapeHtml(customer)} · ${escapeHtml(categories[item.category]||item.category)}</p><h3>${escapeHtml(item.title)}</h3></div><span class="status-pill ${['complete','paid'].includes(item.status)?'good':['waiting_client','invoiced'].includes(item.status)?'warn':''}">${escapeHtml(workLabels[item.status]||item.status)}</span></div>${item.description?`<p>${escapeHtml(item.description)}</p>`:''}${completion}<div class="tracker-meta"><span class="priority-${item.priority}">${escapeHtml(item.priority)} priority</span><span>${date(item.due_date,'No due date')}</span>${item.completed_at?`<span>Completed ${date(item.completed_at)}</span>`:''}${item.billable_hours!=null?`<span>${item.billable_hours}h billable</span>`:''}${amount!=null?`<span>${money(amount)}</span>`:''}</div></article>`}
function ensureAccountUi(){const layout=document.querySelector('.tracker-layout');if(layout&&!document.querySelector('#client-account-summary'))layout.insertAdjacentHTML('beforebegin','<section class="tracker-stats client-account-stats" id="client-account-summary"><article><strong>—</strong><span>Loading account…</span></article></section>');const aside=layout?.querySelector('aside');if(aside&&!document.querySelector('#client-account-list'))aside.insertAdjacentHTML('beforeend','<section class="client-panel"><div class="client-panel-header"><div><p class="client-eyebrow">Account activity</p><h2>Charges & payments</h2></div></div><div id="client-account-list"><p>Loading account…</p></div></section>')}

export async function initClientTracker(session,notice){
  ensureAccountUi();
  const [customers,sites]=await Promise.all([
    supabaseRest(`customers?portal_user_id=eq.${encodeURIComponent(session.user.id)}&select=*`),
    supabaseRest(`sites?owner_user_id=eq.${encodeURIComponent(session.user.id)}&select=id,name&order=name.asc`)
  ]);
  const customer=customers[0]||null;
  const [work,entries]=await Promise.all([
    supabaseRest('work_items?select=*&order=created_at.desc'),
    customer?supabaseRest(`account_entries?customer_id=eq.${encodeURIComponent(customer.id)}&select=*&order=occurred_at.desc`):Promise.resolve([])
  ]);
  const names={customers:byId(customers),sites:byId(sites)};
  const select=document.querySelector('#request-site'),form=document.querySelector('#request-form'),mount=document.querySelector('#client-work-list');
  select.required=!customer;
  select.innerHTML=(customer?'<option value="">General request</option>':'')+sites.map(site=>`<option value="${site.id}">${escapeHtml(site.name)}</option>`).join('');
  if(!customer&&sites.length)select.value=sites[0].id;
  const balance=entries.reduce((sum,entry)=>sum+Number(entry.balance_effect_cents||0),0);
  document.querySelector('#client-account-summary').innerHTML=`<article><strong>${money(balance)}</strong><span>Current balance</span></article><article><strong>${work.filter(item=>openWork.has(item.status)).length}</strong><span>Open requests</span></article><article><strong>${work.filter(item=>['complete','invoiced','paid'].includes(item.status)).length}</strong><span>Completed work</span></article>`;
  document.querySelector('#client-account-list').innerHTML=entries.length?entries.map(entry=>`<div class="ledger-row"><div><strong>${escapeHtml(entry.description)}</strong><span>${date(entry.occurred_at)}</span></div><strong class="${Number(entry.balance_effect_cents)>0?'balance-due':'balance-credit'}">${Number(entry.balance_effect_cents)>0?'+':''}${money(entry.balance_effect_cents)}</strong></div>`).join(''):'<p class="client-muted">No charges or payments have been posted to your account.</p>';
  const render=()=>{mount.innerHTML=work.length?work.map(item=>workCard(item,names)).join(''):'<div class="tracker-empty"><h3>No requests yet</h3><p>Your requests and completed work will appear here.</p></div>'};render();
  if(!customer&&!sites.length){form.querySelector('button[type="submit"]').disabled=true;notice('Your portal account is active, but it has not been linked to a client record yet. Contact Untrained Momentum to finish setup.','error');return}
  form.addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));try{const [created]=await write('work_items','POST',{customer_id:customer?.id||null,site_id:nullable(values.site_id),requester_user_id:session.user.id,title:values.title,description:values.description,category:values.category,priority:values.priority});work.unshift(created);form.reset();select.value=customer?'':(sites[0]?.id||'');render();notice('Your work request was sent.','good')}catch(error){notice(error.message,'error')}});
}
