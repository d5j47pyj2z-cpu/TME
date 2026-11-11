const KEY='tme_app_v1';
const defaults={payments:[],settings:{name:'TME',activity:'Entretien & mécanique automobile',address:'',zip:'',city:'',phone:'',email:'',siret:'',vatNumber:'',legal:'',payment:'Virement bancaire',vatDefault:20,terms:'Paiement à réception de facture.'},clients:[],services:[],quotes:[],invoices:[]};

// V3 — configure these public project values in supabase-config.js.
const SUPABASE_URL = window.TME_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.TME_SUPABASE_ANON_KEY || '';
let supabaseClient = null;
let currentUser = null;
let cloudReady = false;
let saveQueue = Promise.resolve();

let db=load();db.payments=db.payments||[];let page='dashboard';
let editing=null;let docLines=[];
function load(){try{return {...structuredClone(defaults),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return structuredClone(defaults)}}
function save(){
  localStorage.setItem(KEY,JSON.stringify(db));
  if(!supabaseClient || !currentUser || !cloudReady) return;
  const snapshot=JSON.parse(JSON.stringify(db));
  saveQueue=saveQueue.then(async()=>{
    const {error}=await supabaseClient.from('tme_workspace').upsert(
      {user_id:currentUser.id,data:snapshot,updated_at:new Date().toISOString()},
      {onConflict:'user_id'}
    );
    if(error){console.error(error);setCloudStatus('Erreur de synchronisation');toast('Sauvegarde cloud impossible. Exporte une sauvegarde.')}
    else setCloudStatus('Synchronisé en ligne');
  }).catch(err=>{console.error(err);setCloudStatus('Erreur de synchronisation')});
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(n){return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0)}
function date(s){return s?new Date(s+'T12:00:00').toLocaleDateString('fr-FR'):'—'}
function today(){return new Date().toISOString().slice(0,10)}
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function nextNo(type){let arr=type==='quote'?db.quotes:db.invoices;let y=new Date().getFullYear();let nums=arr.map(x=>Number((x.number||'').split('-').pop())||0);return `${type==='quote'?'DEV':'FAC'}-${y}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`}
function toast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300)}
function setPage(p){page=p;document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));document.getElementById('page-title').textContent=({dashboard:'Tableau de bord',quotes:'Mes devis',invoices:'Mes factures',payments:'Suivi des paiements',services:'Catalogue de prestations',clients:'Mes clients',settings:'Paramètres'})[p];render()}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.getElementById('quick-quote').onclick=()=>openDoc('quote');
function render(){let el=document.getElementById('content');({dashboard:renderDashboard,quotes:()=>renderDocs('quote'),invoices:()=>renderDocs('invoice'),payments:renderPayments,services:renderServices,clients:renderClients,settings:renderSettings}[page]())}
function renderDashboard(){let paid=db.invoices.filter(x=>x.status==='Payée').reduce((a,x)=>a+x.total,0),unpaid=db.invoices.filter(x=>x.status!=='Payée').reduce((a,x)=>a+x.total,0);document.getElementById('content').innerHTML=`
<div class="grid stats">
 <div class="stat"><label>Chiffre d'affaires encaissé</label><strong>${money(paid)}</strong><small>Factures marquées payées</small></div>
 <div class="stat"><label>Factures en attente</label><strong>${money(unpaid)}</strong><small>${db.invoices.filter(x=>x.status!=='Payée').length} document(s)</small></div>
 <div class="stat"><label>Devis en cours</label><strong>${db.quotes.filter(x=>x.status==='En attente').length}</strong><small>En attente de réponse</small></div>
 <div class="stat"><label>Prestations enregistrées</label><strong>${db.services.length}</strong><small>Dans ton catalogue TME</small></div>
</div>
<div class="grid two-col">
 <div class="panel"><div class="panel-head"><h3>Derniers documents</h3><span class="muted">Activité récente</span></div>${recentTable()}</div>
 <div class="panel"><div class="panel-head"><h3>Accès rapide</h3></div><div class="grid">
 <button class="primary" onclick="openDoc('quote')">＋ Créer un devis</button><button class="secondary" onclick="openDoc('invoice')">＋ Créer une facture</button><button class="secondary" onclick="openSimple('service')">＋ Ajouter une prestation</button><button class="secondary" onclick="openSimple('client')">＋ Ajouter un client</button>
 </div><p class="muted-line" style="margin-top:18px">Les données sont enregistrées dans ce navigateur. Pense à exporter une sauvegarde régulièrement depuis les paramètres.</p></div>
</div>`}
function recentTable(){let all=[...db.quotes.map(x=>({...x,type:'Devis'})),...db.invoices.map(x=>({...x,type:'Facture'}))].sort((a,b)=>(b.created||'').localeCompare(a.created||'')).slice(0,6);if(!all.length)return '<div class="empty">Aucun document pour le moment.</div>';return `<div class="table-wrap"><table><thead><tr><th>Document</th><th>Client</th><th>Total TTC</th><th>Statut</th></tr></thead><tbody>${all.map(x=>`<tr><td>${x.number}</td><td>${esc(clientName(x.clientId))}</td><td>${money(x.total)}</td><td><span class="tag">${x.status}</span></td></tr>`).join('')}</tbody></table></div>`}
function renderDocs(type){let arr=type==='quote'?db.quotes:db.invoices;let label=type==='quote'?'devis':'facture';document.getElementById('content').innerHTML=`<div class="toolbar"><h3>${arr.length} ${label}(s)</h3><div style="display:flex;gap:8px"><input class="search" id="doc-search" placeholder="Rechercher un document…"><button class="primary" onclick="openDoc('${type}')">＋ Nouveau ${label}</button></div></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Numéro</th><th>Date</th><th>Client</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="doc-rows">${docRows(arr,type)}</tbody></table></div></div>`;
document.getElementById('doc-search').addEventListener('input',e=>{let q=e.target.value.toLowerCase();document.getElementById('doc-rows').innerHTML=docRows(arr,type,q)})}
function docRows(arr,type,q=''){let filtered=arr.filter(x=>(x.number+' '+clientName(x.clientId)).toLowerCase().includes(q));if(!filtered.length)return `<tr><td colspan="6"><div class="empty">Aucun document trouvé.</div></td></tr>`;return filtered.map(x=>`<tr><td><strong>${esc(x.number)}</strong></td><td>${date(x.date)}</td><td>${esc(clientName(x.clientId))}</td><td>${money(x.total)}</td><td><span class="tag ${x.status==='Payée'||x.status==='Accepté'?'paid':x.status==='En attente'?'pending':''}">${esc(x.status)}</span></td><td><div class="actions"><button class="small-btn" onclick="viewDoc('${type}','${x.id}')">Voir / PDF</button><button class="small-btn" onclick="editDoc('${type}','${x.id}')">Modifier</button>${type==='quote'?`<button class="small-btn" onclick="convertQuote('${x.id}')">Facturer</button>`:`<button class="small-btn" onclick="addPayment('${x.id}')">＋ Paiement</button>`}<button class="danger" onclick="deleteDoc('${type}','${x.id}')">Supprimer</button></div></td></tr>`).join('')}
function renderServices(){document.getElementById('content').innerHTML=`<div class="toolbar"><h3>Mes prestations enregistrées</h3><button class="primary" onclick="openSimple('service')">＋ Ajouter une prestation</button></div><div class="grid service-grid">${db.services.length?db.services.map(s=>`<div class="card service-card"><strong>${esc(s.name)}</strong><div class="price">${money(s.price)} <small class="muted">HT</small></div><div class="muted-line">TVA : ${s.vat}% • ${esc(s.unit||'Forfait')}</div><div class="actions" style="margin-top:14px"><button class="small-btn" onclick="openSimple('service','${s.id}')">Modifier</button><button class="danger" onclick="deleteItem('services','${s.id}')">Supprimer</button></div></div>`).join(''):'<div class="panel empty">Ajoute tes prestations habituelles : vidange, filtres, freinage, batterie, diagnostic…</div>'}</div>`}
function renderClients(){document.getElementById('content').innerHTML=`<div class="toolbar"><h3>${db.clients.length} client(s)</h3><button class="primary" onclick="openSimple('client')">＋ Ajouter un client</button></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Ville</th><th>Actions</th></tr></thead><tbody>${db.clients.length?db.clients.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td><td>${esc(c.city)}</td><td><div class="actions"><button class="small-btn" onclick="openSimple('client','${c.id}')">Modifier</button><button class="danger" onclick="deleteItem('clients','${c.id}')">Supprimer</button></div></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty">Aucun client enregistré.</div></td></tr>'}</tbody></table></div></div>`}
function renderSettings(){let s=db.settings;document.getElementById('content').innerHTML=`<div class="notice">Renseigne les informations légales de ton entreprise avant d'émettre des documents. Les champs SIRET, adresse, mentions légales et TVA doivent être exacts. La mention de TVA dépend de ton régime réel.</div><div class="grid settings-grid"><div class="panel"><div class="panel-head"><h3>Informations entreprise</h3></div><form id="settings-form" class="form-grid">
${field('Nom commercial','name',s.name)}${field('Activité','activity',s.activity)}${field('Adresse','address',s.address)}${field('Code postal','zip',s.zip)}${field('Ville','city',s.city)}${field('Téléphone','phone',s.phone)}${field('Email','email',s.email)}${field('SIRET','siret',s.siret)}${field('N° TVA intracommunautaire','vatNumber',s.vatNumber)}${field('Taux TVA par défaut (%)','vatDefault',s.vatDefault,'number')}
<div class="field full"><label>Mentions légales complémentaires</label><textarea name="legal">${esc(s.legal)}</textarea></div><div class="field full"><label>Conditions de paiement</label><textarea name="terms">${esc(s.terms)}</textarea></div><div class="field full"><label>Mode de paiement</label><input name="payment" value="${esc(s.payment)}"></div><div class="field full"><button class="primary">Enregistrer les paramètres</button></div></form></div>
<div class="panel"><div class="panel-head"><h3>Sauvegarde des données</h3></div><p class="muted-line">Exporte régulièrement tes clients, prestations, devis et factures dans un fichier JSON. Tu pourras le réimporter sur un autre appareil ou après changement de navigateur.</p><div class="grid"><button class="primary" onclick="exportData()">⇩ Exporter ma sauvegarde</button><label class="secondary" style="text-align:center;cursor:pointer">⇧ Importer une sauvegarde<input type="file" accept="application/json" hidden onchange="importData(event)"></label><button class="danger" onclick="resetData()">Réinitialiser toutes les données</button></div><p class="muted-line" style="margin-top:18px">Attention : le stockage local est lié au navigateur et à l'appareil. Ce projet ne synchronise pas automatiquement les données entre téléphone et ordinateur.</p></div></div>`;
document.getElementById('settings-form').onsubmit=e=>{e.preventDefault();let f=new FormData(e.target);for(let [k,v] of f)db.settings[k]=v;save();toast('Paramètres enregistrés');renderSettings()}}
function field(label,name,value,type='text'){return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}"></div>`}
function clientName(id){return db.clients.find(c=>c.id===id)?.name||'Client supprimé'}
function openSimple(kind,id){editing=id?{kind,id}:null;let obj=id?db[kind==='service'?'services':'clients'].find(x=>x.id===id):{};let isS=kind==='service';document.getElementById('modal-title').textContent=(id?'Modifier ':'Ajouter ')+(isS?'une prestation':'un client');document.getElementById('modal-eyebrow').textContent=isS?'CATALOGUE':'CLIENT';document.getElementById('modal-body').innerHTML=isS?`<div class="form-grid">${field('Nom de la prestation','name',obj.name||'')}${field('Prix unitaire HT (€)','price',obj.price??'','number')}${field('Taux de TVA (%)','vat',obj.vat??db.settings.vatDefault,'number')}<div class="field"><label>Unité</label><select name="unit"><option ${obj.unit==='Forfait'?'selected':''}>Forfait</option><option ${obj.unit==='Heure'?'selected':''}>Heure</option><option ${obj.unit==='Unité'?'selected':''}>Unité</option></select></div><div class="field full"><label>Description</label><textarea name="description">${esc(obj.description||'')}</textarea></div></div>`:`<div class="form-grid">${field('Nom / Raison sociale','name',obj.name||'')}${field('Téléphone','phone',obj.phone||'')}${field('Email','email',obj.email||'')}${field('Adresse','address',obj.address||'')}${field('Code postal','zip',obj.zip||'')}${field('Ville','city',obj.city||'')}${field('SIRET (si professionnel)','siret',obj.siret||'')}</div>`;
document.getElementById('editor-form').onsubmit=e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();let f=new FormData(e.target),data=Object.fromEntries(f);if(!data.name){toast('Le nom est obligatoire');return}let arr=db[isS?'services':'clients'];if(editing){Object.assign(arr.find(x=>x.id===id),data)}else arr.push({id:uid(),...data});save();document.getElementById('editor').close();toast('Enregistré');render()};document.getElementById('editor').showModal()}
function openDoc(type,id){editing=id?{kind:type,id}:null;let old=id?(type==='quote'?db.quotes:db.invoices).find(x=>x.id===id):null;docLines=old?structuredClone(old.lines):[{id:uid(),serviceId:'',description:'',qty:1,price:0,vat:Number(db.settings.vatDefault)||20}];document.getElementById('modal-eyebrow').textContent=type==='quote'?'DEVIS':'FACTURE';document.getElementById('modal-title').textContent=(old?'Modifier ':'Nouveau ')+(type==='quote'?'devis':'facture');document.getElementById('modal-body').innerHTML=`
<div class="form-grid">
<div class="field"><label>Client</label><select id="d-client"><option value="">Choisir un client</option>${db.clients.map(c=>`<option value="${c.id}" ${old?.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
${field('Date','d-date',old?.date||today(),'date')}
${type==='quote'?`<div class="field"><label>Validité jusqu'au</label><input id="d-valid" type="date" value="${old?.validUntil||''}"></div>`:`<div class="field"><label>Date d'échéance</label><input id="d-due" type="date" value="${old?.dueDate||''}"></div>`}
<div class="field"><label>Statut</label><select id="d-status">${(type==='quote'?['En attente','Accepté','Refusé']:['À payer','Payée','En retard']).map(v=>`<option ${old?.status===v?'selected':''}>${v}</option>`).join('')}</select></div>
</div>
<div class="panel" style="padding:12px;margin:14px 0"><div class="panel-head"><h3>Prestations</h3><button type="button" class="small-btn" onclick="addLine()">＋ Ajouter une ligne</button></div><div class="table-wrap"><table class="line-items"><thead><tr><th>Prestation / description</th><th>Qté</th><th>Prix HT</th><th>TVA %</th><th>Total TTC</th><th></th></tr></thead><tbody id="line-body">${lineRows()}</tbody></table></div><div class="totals" id="doc-totals">${totalsHTML()}</div></div>
<div class="field"><label>Notes / conditions particulières</label><textarea id="d-notes">${esc(old?.notes||'')}</textarea></div>
<div class="field"><label>Signature du client (facultative — à signer sur écran tactile)</label><div class="signature-wrap"><canvas id="signature-pad" width="760" height="180"></canvas><div class="signature-tools"><span class="muted-line">La signature sera intégrée au document imprimé.</span><button type="button" class="small-btn" onclick="clearSignature()">Effacer la signature</button></div></div></div>`;
document.getElementById('editor-form').onsubmit=e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();let clientId=document.getElementById('d-client').value;if(!clientId){toast('Sélectionne un client');return}if(!docLines.length||docLines.some(l=>!l.description.trim())){toast('Ajoute au moins une prestation');return}let sums=calcTotals();let data={id:old?.id||uid(),number:old?.number||nextNo(type),clientId,date:document.getElementById('d-date').value,status:document.getElementById('d-status').value,lines:structuredClone(docLines),...sums,notes:document.getElementById('d-notes').value,signature:signatureData(),created:old?.created||new Date().toISOString()};if(type==='quote')data.validUntil=document.getElementById('d-valid').value;else data.dueDate=document.getElementById('d-due').value;let arr=type==='quote'?db.quotes:db.invoices;if(old)Object.assign(arr.find(x=>x.id===old.id),data);else arr.push(data);save();document.getElementById('editor').close();toast('Document enregistré');render()};
document.getElementById('editor').showModal();initSignature(old?.signature||'')}
function lineRows(){return docLines.map((l,i)=>`<tr><td><select onchange="selectService(${i},this.value)"><option value="">Choisir une prestation…</option>${db.services.map(s=>`<option value="${s.id}" ${l.serviceId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><input style="margin-top:5px" placeholder="Description" value="${esc(l.description)}" onchange="docLines[${i}].description=this.value"></td><td><input type="number" min="0.01" step="0.01" value="${l.qty}" onchange="docLines[${i}].qty=+this.value;updateTotals()"></td><td><input type="number" min="0" step="0.01" value="${l.price}" onchange="docLines[${i}].price=+this.value;updateTotals()"></td><td><select onchange="docLines[${i}].vat=+this.value;updateTotals()">${[0,5.5,10,20].map(v=>`<option value="${v}" ${Number(l.vat)===v?'selected':''}>${v}%</option>`).join('')}</select></td><td class="line-total">${money(l.qty*l.price*(1+l.vat/100))}</td><td><button type="button" class="remove" onclick="removeLine(${i})">✕</button></td></tr>`).join('')}
function selectService(i,id){let s=db.services.find(x=>x.id===id);if(!s)return;docLines[i]={...docLines[i],serviceId:id,description:s.name,price:Number(s.price),vat:Number(s.vat)};document.getElementById('line-body').innerHTML=lineRows();updateTotals()}
function addLine(){docLines.push({id:uid(),serviceId:'',description:'',qty:1,price:0,vat:Number(db.settings.vatDefault)||20});document.getElementById('line-body').innerHTML=lineRows()}
function removeLine(i){docLines.splice(i,1);document.getElementById('line-body').innerHTML=lineRows();updateTotals()}
function calcTotals(){let ht=docLines.reduce((a,l)=>a+(+l.qty||0)*(+l.price||0),0),vat=docLines.reduce((a,l)=>a+(+l.qty||0)*(+l.price||0)*(+l.vat||0)/100,0);return {ht,vat,total:ht+vat}}
function totalsHTML(){let t=calcTotals();return `<div class="total-row"><span>Total HT</span><strong>${money(t.ht)}</strong></div><div class="total-row"><span>TVA</span><strong>${money(t.vat)}</strong></div><div class="total-row grand"><span>Total TTC</span><strong>${money(t.total)}</strong></div>`}
function updateTotals(){document.querySelectorAll('.line-total').forEach((el,i)=>el.textContent=money(docLines[i].qty*docLines[i].price*(1+docLines[i].vat/100)));document.getElementById('doc-totals').innerHTML=totalsHTML()}
function editDoc(type,id){openDoc(type,id)}
function deleteDoc(type,id){if(!confirm('Supprimer définitivement ce document ? Cette action est irréversible.'))return;let k=type==='quote'?'quotes':'invoices';db[k]=db[k].filter(x=>x.id!==id);save();toast('Document supprimé');render()}
function deleteItem(kind,id){if(!confirm('Supprimer cet élément ?'))return;db[kind]=db[kind].filter(x=>x.id!==id);save();toast('Élément supprimé');render()}
function togglePaid(id){let x=db.invoices.find(x=>x.id===id);x.status=x.status==='Payée'?'À payer':'Payée';save();render()}
function convertQuote(id){let q=db.quotes.find(x=>x.id===id);if(!q)return;if(!confirm('Créer une facture à partir de ce devis ?'))return;let inv={...structuredClone(q),id:uid(),number:nextNo('invoice'),status:'À payer',created:new Date().toISOString(),dueDate:''};db.invoices.push(inv);q.status='Accepté';save();toast('Facture créée');setPage('invoices')}
function viewDoc(type,id){let x=(type==='quote'?db.quotes:db.invoices).find(x=>x.id===id),c=db.clients.find(c=>c.id===x.clientId)||{},s=db.settings;let rows=x.lines.map(l=>`<tr><td>${esc(l.description)}</td><td>${l.qty}</td><td>${money(l.price)}</td><td>${l.vat}%</td><td>${money(l.qty*l.price)}</td></tr>`).join('');let win=window.open('','_blank');if(!win){toast('Autorise les fenêtres pop-up pour imprimer');return}win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${x.number}</title><style>body{font:13px Arial;color:#222;margin:40px}h1{font-size:28px;margin:0}h2{margin-top:40px}small{color:#666}.head{display:flex;justify-content:space-between}.box{margin-top:30px;padding:15px;background:#f4f5f7}table{width:100%;border-collapse:collapse;margin-top:30px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}th{background:#f2f2f2}.totals{width:280px;margin:25px 0 0 auto}.totals p{display:flex;justify-content:space-between}.grand{font-size:18px;font-weight:bold;border-top:2px solid #333;padding-top:12px}.foot{margin-top:45px;font-size:11px;color:#555;white-space:pre-line}@media print{button{display:none}}</style></head><body><div style="display:flex;align-items:center;gap:12px;margin-bottom:24px"><div style="width:58px;height:48px;display:grid;place-items:center;background:#141b25;color:white;border:3px solid #e43b43;font-weight:900;font-size:22px;letter-spacing:1px;transform:skew(-6deg)">TME</div><div><b style="font-size:11px;letter-spacing:2px">TME • ENTRETIEN AUTOMOBILE</b><br><small>Entretien & mécanique automobile</small></div></div><div class="head"><div><h1>${esc(s.name)}</h1><b>${esc(s.activity)}</b><p>${esc(s.address)}<br>${esc(s.zip)} ${esc(s.city)}<br>${esc(s.phone)}<br>${esc(s.email)}</p><p>SIRET : ${esc(s.siret)}<br>N° TVA : ${esc(s.vatNumber)}</p></div><div><h1>${type==='quote'?'DEVIS':'FACTURE'}</h1><h2>${esc(x.number)}</h2><p>Date : ${date(x.date)}<br>${type==='quote'?'Valable jusqu’au : '+date(x.validUntil):'Échéance : '+date(x.dueDate)}</p></div></div><div class="box"><b>Client</b><p>${esc(c.name)}<br>${esc(c.address)}<br>${esc(c.zip)} ${esc(c.city)}<br>${esc(c.email)}<br>${esc(c.phone)}</p></div><table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><p><span>Total HT</span><b>${money(x.ht)}</b></p><p><span>TVA</span><b>${money(x.vat)}</b></p><p class="grand"><span>Total TTC</span><b>${money(x.total)}</b></p></div><p>${esc(x.notes||'')}</p>${x.signature?`<div style="margin-top:24px"><b>Signature du client</b><br><img alt="Signature du client" src="${x.signature}" style="max-width:360px;max-height:110px;border-bottom:1px solid #aaa"></div>`:''}<div class="foot">${esc(s.terms)}\n${esc(s.legal)}\n${type==='quote'?'Bon pour accord, date et signature du client :':''}</div><button onclick="window.print()">Imprimer / Enregistrer en PDF</button> <button onclick="location.href='mailto:${encodeURIComponent(c.email||'')}?subject=${encodeURIComponent((type==='quote'?'Devis ':'Facture ')+x.number+' - '+s.name)}&body=${encodeURIComponent('Bonjour '+(c.name||'')+',\\n\\nVeuillez trouver votre document '+x.number+' pour un montant de '+money(x.total)+'.\\n\\nCordialement,\\n'+s.name)}'">Préparer un email</button><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close()}

function initSignature(existing){
  const canvas=document.getElementById('signature-pad'); if(!canvas)return;
  const ctx=canvas.getContext('2d'); ctx.strokeStyle='#111'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
  if(existing){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=existing;}
  let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
  canvas.onpointerdown=e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};
  canvas.onpointermove=e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()};
  canvas.onpointerup=canvas.onpointercancel=()=>drawing=false;
}
function clearSignature(){const c=document.getElementById('signature-pad');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height)}
function signatureData(){const c=document.getElementById('signature-pad');if(!c)return '';const ctx=c.getContext('2d');const pixels=ctx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i])return c.toDataURL('image/png');return ''}
function addPayment(invoiceId){
  const inv=db.invoices.find(x=>x.id===invoiceId);if(!inv)return;
  const already=db.payments.filter(p=>p.invoiceId===invoiceId).reduce((a,p)=>a+Number(p.amount||0),0);
  const remaining=Math.max(0,Number(inv.total)-already);
  document.getElementById('modal-eyebrow').textContent='ENCAISSEMENT';
  document.getElementById('modal-title').textContent='Enregistrer un paiement';
  document.getElementById('modal-body').innerHTML=`<div class="notice">Facture ${esc(inv.number)} • Total TTC : ${money(inv.total)} • Déjà réglé : ${money(already)} • Reste : ${money(remaining)}</div><div class="form-grid">${field('Montant encaissé (€)','amount',remaining.toFixed(2),'number')}${field('Date du paiement','date',today(),'date')}<div class="field"><label>Moyen de paiement</label><select name="method"><option>Virement</option><option>Carte bancaire</option><option>Espèces</option><option>Chèque</option><option>Autre</option></select></div><div class="field"><label>Référence (facultative)</label><input name="reference" placeholder="Référence du virement / reçu"></div></div>`;
  document.getElementById('editor-form').onsubmit=e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.target),amount=Number(f.get('amount'));if(!(amount>0)){toast('Montant invalide');return}db.payments.push({id:uid(),invoiceId,amount,date:f.get('date'),method:f.get('method'),reference:f.get('reference')});const paid=db.payments.filter(p=>p.invoiceId===invoiceId).reduce((a,p)=>a+Number(p.amount||0),0);inv.status=paid>=Number(inv.total)-0.01?'Payée':'À payer';save();document.getElementById('editor').close();toast('Paiement enregistré');render()};
  document.getElementById('editor').showModal();
}
function renderPayments(){
  const total=db.payments.reduce((a,p)=>a+Number(p.amount||0),0);
  const rows=db.payments.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  document.getElementById('content').innerHTML=`<div class="grid stats"><div class="stat"><label>Total encaissé enregistré</label><strong>${money(total)}</strong><small>Somme des paiements saisis</small></div><div class="stat"><label>Nombre de paiements</label><strong>${rows.length}</strong><small>Toutes factures confondues</small></div><div class="stat"><label>Factures réglées</label><strong>${db.invoices.filter(i=>i.status==='Payée').length}</strong><small>Statut mis à jour selon les paiements</small></div><div class="stat"><label>Factures à régler</label><strong>${db.invoices.filter(i=>i.status!=='Payée').length}</strong><small>Solde restant éventuel</small></div></div><div class="panel"><div class="panel-head"><h3>Historique des encaissements</h3><span class="muted">${rows.length} opération(s)</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Facture</th><th>Client</th><th>Moyen</th><th>Référence</th><th>Montant</th><th></th></tr></thead><tbody>${rows.length?rows.map(p=>{let inv=db.invoices.find(i=>i.id===p.invoiceId);return `<tr><td>${date(p.date)}</td><td>${esc(inv?.number||'Facture supprimée')}</td><td>${esc(inv?clientName(inv.clientId):'—')}</td><td>${esc(p.method)}</td><td>${esc(p.reference)}</td><td><strong>${money(p.amount)}</strong></td><td><button class="danger" onclick="deletePayment('${p.id}')">Supprimer</button></td></tr>`}).join(''):'<tr><td colspan="7"><div class="empty">Aucun paiement enregistré. Ajoute un paiement depuis la liste des factures.</div></td></tr>'}</tbody></table></div></div>`;
}
function deletePayment(id){if(!confirm('Supprimer cet encaissement ?'))return;const p=db.payments.find(x=>x.id===id);db.payments=db.payments.filter(x=>x.id!==id);if(p){const inv=db.invoices.find(x=>x.id===p.invoiceId);if(inv){const sum=db.payments.filter(x=>x.invoiceId===inv.id).reduce((a,x)=>a+Number(x.amount||0),0);inv.status=sum>=Number(inv.total)-0.01?'Payée':'À payer'}}save();toast('Paiement supprimé');render()}

function exportData(){let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='TME-sauvegarde-'+today()+'.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let d=JSON.parse(r.result);if(!d.settings||!Array.isArray(d.quotes)||!Array.isArray(d.invoices))throw Error();db={...structuredClone(defaults),...d};save();toast('Sauvegarde importée');render()}catch{alert('Fichier de sauvegarde invalide.')}};r.readAsText(f)}
function resetData(){if(!confirm('Effacer tous les clients, prestations, devis et factures ? Exporte une sauvegarde avant de continuer.'))return;db=structuredClone(defaults);save();toast('Données réinitialisées');render()}

function setCloudStatus(message){const el=document.getElementById('cloud-status');if(el)el.textContent=message}
function showAuth(message=''){
  document.getElementById('auth-screen').hidden=false;
  document.getElementById('app-shell').style.display='none';
  document.getElementById('auth-message').textContent=message;
}
function showApp(){
  document.getElementById('auth-screen').hidden=true;
  document.getElementById('app-shell').style.display='flex';
}
async function loadCloudWorkspace(){
  setCloudStatus('Chargement des données…');
  const {data,error}=await supabaseClient.from('tme_workspace').select('data').eq('user_id',currentUser.id).maybeSingle();
  if(error){setCloudStatus('Erreur cloud');throw error}
  if(data?.data){
    db={...structuredClone(defaults),...data.data};
    db.payments=db.payments||[];
    localStorage.setItem(KEY,JSON.stringify(db));
  }else{
    // First connection: migrate the current browser's local data to this account.
    const {error:insertError}=await supabaseClient.from('tme_workspace').upsert(
      {user_id:currentUser.id,data:db,updated_at:new Date().toISOString()},
      {onConflict:'user_id'}
    );
    if(insertError)throw insertError;
  }
  cloudReady=true;
  setCloudStatus('Synchronisé en ligne');
  render();
}
async function bootV3(){
  if(!window.supabase?.createClient || !SUPABASE_URL || !SUPABASE_ANON_KEY){
    showAuth('Configuration Supabase manquante. Suis le guide INSTALLATION-V3.md, ou ouvre la version V2 locale.');
    document.getElementById('auth-submit').disabled=true;
    document.getElementById('auth-signup').disabled=true;
    return;
  }
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  document.getElementById('auth-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=document.getElementById('auth-email').value.trim();
    const password=document.getElementById('auth-password').value;
    const button=document.getElementById('auth-submit');button.disabled=true;button.textContent='Connexion…';
    const {error}=await supabaseClient.auth.signInWithPassword({email,password});
    button.disabled=false;button.textContent='Se connecter';
    if(error)document.getElementById('auth-message').textContent=error.message;
  });
  document.getElementById('auth-signup').addEventListener('click',async()=>{
    const email=document.getElementById('auth-email').value.trim();
    const password=document.getElementById('auth-password').value;
    if(!email||password.length<8){document.getElementById('auth-message').textContent='Saisis un email et un mot de passe de 8 caractères minimum.';return}
    const {error}=await supabaseClient.auth.signUp({email,password});
    document.getElementById('auth-message').textContent=error?error.message:'Compte créé. Vérifie ton email si la confirmation est activée, puis connecte-toi.';
  });
  document.getElementById('logout-button').addEventListener('click',async()=>{await supabaseClient.auth.signOut();currentUser=null;cloudReady=false;showAuth('Tu es déconnecté.')});
  supabaseClient.auth.onAuthStateChange(async(_event,session)=>{
    if(session?.user){
      currentUser=session.user;
      try{await loadCloudWorkspace();showApp()}
      catch(err){console.error(err);showAuth('Impossible de charger les données cloud : '+err.message)}
    }else{
      currentUser=null;cloudReady=false;showAuth();
    }
  });
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session?.user){currentUser=session.user;try{await loadCloudWorkspace();showApp()}catch(err){showAuth('Erreur de chargement : '+err.message)}}
  else showAuth();
}

bootV3();