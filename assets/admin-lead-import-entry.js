import { initLeadImport } from '/assets/admin-lead-import.js';
function notice(message,kind=''){const el=document.querySelector('#tracker-status');if(el)el.textContent=message||''}
document.querySelector('#load-extended-ops')?.addEventListener('click',()=>initLeadImport(notice),{once:true});
