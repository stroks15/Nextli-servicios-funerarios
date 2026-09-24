const IMAGE_BASE='https://nextli-stroks15s-projects.vercel.app/images/';
const WA_NUMBER='525521889698';
const NEXTLI_GROUP='https://chat.whatsapp.com/KBc1dBIEJQHCoBTmrG96mi?s=cl&p=a&mlu=4&ilr=4';
const URNS=[
{id:'clasica',name:'Urna Clásica Pewter',img:'/images/urna-clasica.jpg',prices:{chico:1750,mediano:1850,grande:1950,xl:2100}},
{id:'luna',name:'Urna Luna Pewter',img:'/images/urna-luna.jpg',prices:{chico:1750}},
{id:'talavera',name:'Urna de Talavera',img:'/images/urna-talavera.jpg',prices:{chico:1750,mediano:1950,grande:2050,xl:2150}},
{id:'talpewter',name:'Talavera y Pewter',img:'/images/urna-talavera-pewter.jpg',prices:{chico:1950,mediano:2050}},
{id:'huesohuella',name:'Huesito con Huella',img:'/images/urna-hueso-huella.jpg',prices:{chico:1950,mediano:2050,grande:2150}},
{id:'corazon',name:'Urna Corazón',img:'/images/urna-corazon.png',prices:{chico:1950,mediano:2050,grande:2150}},
{id:'casitalisa',name:'Casita Lisa',img:'/images/urna-casita-lisa.jpg',prices:{chico:1950,mediano:2050,grande:2150,xl:2250}},
{id:'casitateja',name:'Casita con Teja',img:'/images/urna-casita-teja.jpg',prices:{chico:1950,mediano:2050,grande:2150,xl:2250}},
{id:'huesocromado',name:'Huesito Cromado',img:'/images/urna-hueso-cromado.jpg',prices:{chico:1950,mediano:2050,grande:2150,xl:2250}}
];
const SIZE_LABEL={chico:'Chico (0–10 kg)',mediano:'Mediano (11–25 kg)',grande:'Grande (26–45 kg)',xl:'Extra grande (+45 kg)'};
const COM_PRICE={chico:800,mediano:850,grande:1100};
const breedSize={Chihuahueño:'chico',Poodle:'chico',Pug:'chico',Schnauzer:'chico',Yorkshire:'chico',Beagle:'chico',Bulldog:'mediano',Cocker:'mediano','Golden Retriever':'grande',Labrador:'grande','Pastor Alemán':'grande','Gran Danés':'xl',Husky:'grande'};
const catSize={Siamés:'chico',Persa:'chico','Maine Coon':'mediano',Ragdoll:'chico',Bengalí:'chico','Británico de pelo corto':'chico'};
let workerMode=false, logoTaps=0, workerUnlockArmed=false, workerUnlockTimer=null;
const WORKER_UNLOCK_WINDOW=3000;
let state={service:null,species:'',otherSpecies:'',breed:'',weight:'',urnId:null,plus:false,huella:false,cert:false,color:'',frame:'',paymentStatus:'No pagado',paymentOther:''};
const $=id=>document.getElementById(id), val=id=>(($(id)?.value||'').trim()||'—');
function localizeImg(img){img.onerror=()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src=IMAGE_BASE+img.src.split('/').pop();}else img.style.opacity='.18';};}
function buildTrack(){const t=$('stepsTrack');t.innerHTML=['🐾','🐶','🐱','🐦','🐰'].map((x,i)=>`<div class="step-dot ${i===0?'active':''}" id="dot${i+1}"><span class="step-icon">${x}</span></div>${i<4?'<div class="step-line"></div>':''}`).join('');}
buildTrack();
function goTo(step){document.querySelectorAll('.step-panel').forEach(p=>p.classList.toggle('active',+p.dataset.step===step));for(let i=1;i<=5;i++){$('dot'+i)?.classList.toggle('active',i===step);$('dot'+i)?.classList.toggle('done',i<step);}$('stepProgressLabel').textContent=`Paso ${step} de 5`;window.scrollTo({top:0,behavior:'smooth'});}
function hasValidUrn(){const u=URNS.find(x=>x.id===state.urnId);return !!(u&&state.weight&&u.prices[state.weight]);}
function syncUrnControls(){const valid=hasValidUrn();$('next2').disabled=!valid;updateTotal();return valid;}
function renderUrns(size){
  const grid=$('urnGrid');grid.innerHTML='';
  URNS.forEach(u=>{
    const available=!size||!!u.prices[size],price=size&&u.prices[size];
    const b=document.createElement('button');b.type='button';
    b.className='urn-card '+(state.urnId===u.id?'selected ':'')+(size&&!available?'unavailable':'');
    b.innerHTML=`<img src="${u.img}" alt="${u.name}"><div class="u-body"><h5>${u.name}</h5><div class="u-price">${size?(available?'$'+price.toLocaleString()+' MXN':'No disponible en este tamaño'):'Selecciona un tamaño'}</div></div>`;
    localizeImg(b.querySelector('img'));
    if(available){
      b.onclick=()=>{
        state.urnId=u.id;
        if(size)state.weight=size;
        renderUrns(state.weight||size||null);
        syncUrnControls();
      };
    }
    grid.appendChild(b);
  });
  syncUrnControls();
}
function autoWeight(){
  const s=state.species==='perro'?breedSize[state.breed]:state.species==='gato'?catSize[state.breed]:null;
  if(s){state.weight=s;$('weightRange').value=s;$('manualWeightAction').style.display='block';}
  else{$('manualWeightAction').style.display='none';}
  const selected=URNS.find(u=>u.id===state.urnId);
  if(!selected || !state.weight || !selected.prices[state.weight]) state.urnId=null;
  renderUrns(state.weight||null);
  syncUrnControls();
}
function calcBase(){if(state.service==='comunitaria')return COM_PRICE[state.weight]||0;const u=URNS.find(x=>x.id===state.urnId);return u?.prices[state.weight]||0;}
function total(){return calcBase()+(state.plus?500:0)+(state.huella?200:0)+(state.cert?50:0);}
function updateTotal(){$('runningTotal3').textContent='Total: $'+total().toLocaleString()+' MXN';}
function extras(){return [state.plus?'Paquete Plus — Homenaje completo (+$500 MXN)':null,state.huella?'Huella con pelo de mascota (+$200 MXN)':null,state.cert?'Certificado físico adicional (+$50 MXN)':null,state.frame?`Marco: ${state.frame}`:null,state.color?`Vinilo: ${state.color}`:null].filter(Boolean);}
function speciesLabel(){return state.species==='otro'?(state.otherSpecies||'Otro'):state.species||'—';}
function paymentLabel(){return state.paymentStatus==='Otro'?`Otro: $${Number(state.paymentOther||0).toLocaleString()} MXN`:state.paymentStatus;}
function buildMessage(audience){const urn=URNS.find(u=>u.id===state.urnId);let m=`*LEVANTAMIENTO DE ORDEN — NEXTLI*
------------------------------
*Servicio:* ${state.service==='comunitaria'?'Cremación Comunitaria':'Cremación Individual'}
*Mascota:* ${val('petName')}
*Especie / raza:* ${speciesLabel()}${state.breed?' / '+state.breed:''}
*Edad:* ${val('petAge')}
*Urna:* ${urn?.name||'—'}
*Tamaño / peso:* ${SIZE_LABEL[state.weight]||'—'}
*Adicionales:* ${extras().join(', ')||'Ninguno'}
*Total estimado:* $${total().toLocaleString()} MXN

*DATOS DEL CLIENTE*
*Propietario:* ${val('ownerName')}
*Teléfono:* ${val('ownerPhone')}
*Dirección:* ${val('ownerAddress')}
*Fecha de defunción:* ${val('petDate')}
*Frase:* ${val('farewellPhrase')}`;if(workerMode)m+=`\n\n*PAGO:* ${paymentLabel()}`;if(audience==='cliente')m='*NOTA DE TU SOLICITUD NEXTLI*\n\n'+m+'\n\nGracias por confiar en NEXTLI.';return m;}
function renderSummary(){const urn=URNS.find(u=>u.id===state.urnId);$('summaryBox').innerHTML=`<div class="summary-box"><h4>Resumen de tu solicitud</h4>${line('Servicio',state.service==='comunitaria'?'Cremación Comunitaria':'Cremación Individual')}${line('Mascota',val('petName'))}${line('Especie / raza',speciesLabel()+(state.breed?' / '+state.breed:''))}${line('Tamaño / peso',SIZE_LABEL[state.weight]||'—')}${line('Urna',urn?.name||'—')}${extras().map((x,i)=>line(i?'Adicional':'Adicional',x)).join('')}${line('Propietario',val('ownerName'))}${line('Teléfono',val('ownerPhone'))}${line('Dirección',val('ownerAddress'))}${workerMode?line('Pago',paymentLabel()):''}<div class="summary-total"><span>Total estimado</span><span>$${total().toLocaleString()} MXN</span></div></div>`;$('sendWa').href='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(buildMessage('cliente'));}
function line(a,b){return `<div class="summary-line"><span>${a}</span><b>${b}</b></div>`;}
function requiredOk(){
  const ids=['petName','petAge','petDate','ownerName','ownerPhone','ownerAddress'];
  return hasValidUrn()&&state.species&&state.weight&&ids.every(id=>val(id)!=='—')&&(state.species!=='otro'||state.otherSpecies);
}
function activateWorker(){
  workerMode=true;
  document.body.classList.add('worker-mode');
  $('workerButton').textContent='Modo trabajador NEXTLI';
  $('workerPaymentWrap').style.display='block';
  workerUnlockArmed=false;
  logoTaps=0;
  clearTimeout(workerUnlockTimer);
}
$('nextliTrigger').onclick=()=>{
  if(workerMode)return;
  logoTaps++;
  if(logoTaps===1){
    clearTimeout(workerUnlockTimer);
    workerUnlockTimer=setTimeout(()=>{logoTaps=0;workerUnlockArmed=false;},WORKER_UNLOCK_WINDOW);
  }
  if(logoTaps===2){
    workerUnlockArmed=true;
    clearTimeout(workerUnlockTimer);
    workerUnlockTimer=setTimeout(()=>{logoTaps=0;workerUnlockArmed=false;},WORKER_UNLOCK_WINDOW);
  }
};
$('workerButton').onclick=()=>{
  if(workerMode)return;
  if(workerUnlockArmed){
    activateWorker();
  }else{
    logoTaps=0;
  }
};
$('workerButton').addEventListener('dblclick',e=>e.preventDefault());
document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-service]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.service=b.dataset.service;goTo(2);});
document.querySelectorAll('[data-wa-text]').forEach(b=>b.onclick=()=>window.open('https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(b.dataset.waText),'_blank'));
$('species').onchange=e=>{state.species=e.target.value;state.breed='';state.otherSpecies='';$('breedField').style.display=state.species==='perro'?'block':'none';$('catBreedField').style.display=state.species==='gato'?'block':'none';$('otherSpeciesField').style.display=state.species==='otro'?'block':'none';autoWeight();};
$('otherSpecies').oninput=e=>{state.otherSpecies=e.target.value};
$('breed').onchange=e=>{state.breed=e.target.value;autoWeight();};
$('catBreed').onchange=e=>{state.breed=e.target.value;autoWeight();};
$('weightRange').onchange=e=>{
  state.weight=e.target.value;
  const selected=URNS.find(u=>u.id===state.urnId);
  if(!selected || !selected.prices[state.weight]) state.urnId=null;
  renderUrns(state.weight);
  syncUrnControls();
};$('manualWeightBtn').onclick=()=>{$('weightRange').focus();};
$('next2').onclick=()=>goTo(state.service==='comunitaria'?4:3);
[['addPlus','plus',500],['addHuella','huella',200],['addCert','cert',50]].forEach(([id,key])=>$(id).onchange=e=>{state[key]=e.target.checked;$('frameWrap').style.display=state.plus?'block':'none';$('colorWrap').style.display=state.plus?'block':'none';updateTotal();});
document.querySelectorAll('[data-frame]').forEach(x=>x.onclick=()=>{document.querySelectorAll('[data-frame]').forEach(y=>y.classList.remove('selected'));x.classList.add('selected');state.frame=x.dataset.frame;});document.querySelectorAll('[data-color]').forEach(x=>x.onclick=()=>{document.querySelectorAll('[data-color]').forEach(y=>y.classList.remove('selected'));x.classList.add('selected');state.color=x.dataset.color;});$('next3').onclick=()=>goTo(4);document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>goTo(+b.dataset.back));
$('paymentStatus').onchange=e=>{$('paymentOther').style.display=e.target.value==='Otro'?'block':'none';state.paymentStatus=e.target.value};$('paymentOther').oninput=e=>state.paymentOther=e.target.value;
$('next4').onclick=()=>{if(!requiredOk()){alert('Para continuar debes seleccionar una urna y completar todos los datos obligatorios del cliente.');return;}renderSummary();goTo(5);};
$('useMyLocationBtn').onclick=()=>{const status=$('geoStatus');if(!navigator.geolocation){status.textContent='No disponible. Escribe la dirección manualmente.';status.style.display='block';return;}status.textContent='Obteniendo ubicación…';status.style.display='block';navigator.geolocation.getCurrentPosition(async p=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.coords.latitude}&lon=${p.coords.longitude}`,{headers:{'Accept-Language':'es'}});const d=await r.json();$('ownerAddress').value=d.display_name||'';status.textContent='Dirección obtenida; puedes editarla.';}catch{status.textContent='No pudimos traducir la ubicación. Escríbela manualmente.';}},()=>status.textContent='Permiso de ubicación no disponible. Escribe la dirección manualmente.',{enableHighAccuracy:true,timeout:10000});};
$('sendGroupWa').onclick=()=>window.open(NEXTLI_GROUP,'_blank');
$('sendClientWa').onclick=()=>{window.open('https://wa.me/'+val('ownerPhone').replace(/\D/g,'')+'?text='+encodeURIComponent(buildMessage('cliente')),'_blank');generateCertificate();};
$('downloadCertificate').onclick=generateCertificate;
let certificateReady=false;
function closeCertificatePreview(){
  const overlay=$('certificatePreview');
  if(!overlay)return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
  const shell=$('certificateShell');
  if(shell){
    document.body.appendChild(shell);
    shell.style.position='fixed';
    shell.style.left='-100000px';
    shell.style.top='0';
    shell.style.visibility='hidden';
  }
  $('certificatePreviewMount').innerHTML='';
  certificateReady=false;
}
async function waitForCertificateRender(el){
  if(document.fonts?.ready) await document.fonts.ready;
  const imgs=[...el.querySelectorAll('img')];
  await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
    img.addEventListener('load',resolve,{once:true});
    img.addEventListener('error',resolve,{once:true});
  })));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
async function generateCertificate(){
  if(!workerMode){
    alert('El certificado es generado por el personal NEXTLI.');
    return;
  }
  if(!requiredOk()){
    alert('Completa primero todos los datos obligatorios.');
    return;
  }
  const map={certPet:'petName',certOwner:'ownerName',certSpecies:null,certAge:'petAge',certDate:'petDate',certPhone:'ownerPhone',certAddress:'ownerAddress'};
  Object.entries(map).forEach(([a,b])=>{if(b)$(''+a).textContent=val(b)});
  $('certSpecies').textContent=speciesLabel()+(state.breed?' / '+state.breed:'');
  const el=$('certificateShell'),mount=$('certificatePreviewMount'),overlay=$('certificatePreview');
  if(!el||!mount||!overlay)return;
  mount.innerHTML='';
  mount.appendChild(el);
  el.style.position='relative';el.style.left='auto';el.style.top='auto';el.style.visibility='visible';
  await waitForCertificateRender(el);
  certificateReady=true;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}
async function downloadCertificatePdf(){
  if(!workerMode||!certificateReady){
    if(!workerMode)alert('El certificado es generado por el personal NEXTLI.');
    return;
  }
  const el=$('certificateShell');
  await waitForCertificateRender(el);
  try{
    await html2pdf().set({
      margin:0,
      filename:`Certificado-${safe(val('petName'))}-${safe(val('ownerName'))}.pdf`,
      image:{type:'jpeg',quality:.98},
      html2canvas:{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#fbf7ee',logging:false},
      jsPDF:{unit:'pt',format:'letter',orientation:'portrait'}
    }).from(el).save();
  }finally{closeCertificatePreview();}
}
$('confirmCertificateDownload').onclick=downloadCertificatePdf;
$('closeCertificatePreview').onclick=closeCertificatePreview;
$('cancelCertificatePreview').onclick=closeCertificatePreview;
function safe(s){return String(s).replace(/[\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/^-|-$/g,'')||'Cremacion-Nextli';}
renderUrns(null);syncUrnControls();updateTotal();