import { initAdminCrm } from '/assets/admin-crm.js';
import { initAdminInventory } from '/assets/admin-inventory.js';
import { initAdminAccounts } from '/assets/admin-accounts.js';

function notice(message,kind=''){const el=document.querySelector('#tracker-status');if(el)el.innerHTML=message?`<div class="client-notice ${kind}">${message}</div>`:''}
const button=document.querySelector('#load-extended-ops');
button?.addEventListener('click',async()=>{button.disabled=true;button.textContent='Loading…';try{await Promise.all([initAdminCrm(notice),initAdminInventory(notice),initAdminAccounts(notice)]);button.textContent='Operations loaded';notice('CRM, client accounts, and inventory are ready.','good')}catch(error){button.disabled=false;button.textContent='Load operations data';notice(error.message||'Operations data could not load.','error')}});
