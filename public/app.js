/* ============================================================
   NEXTLI · Configurador (cliente + Modo Trabajador)
   Depende de: config.js, certificate.js, inventory.js
   ============================================================ */
const CFG = window.NEXTLI_CONFIG || {};
const INV = window.NextliInventory;
const CERT = window.NextliCertificate;
const IMAGE_BASE = CFG.IMAGE_BASE || '/images/';
const WA_NUMBER = CFG.WA_NUMBER || '525521889698';

const DEFAULT_WEIGHT_RANGES = { chico:{min:0,max:10}, mediano:{min:11,max:25}, grande:{min:25,max:45}, xl:{min:46,max:null} };
const WEIGHT_RANGE_KEY='nextli-weight-ranges-v1';
let weightRanges=JSON.parse(JSON.stringify(DEFAULT_WEIGHT_RANGES));
try{const saved=JSON.parse(localStorage.getItem(WEIGHT_RANGE_KEY)||'null');if(saved&&['chico','mediano','grande','xl'].every(k=>saved[k]&&Number.isFinite(Number(saved[k].min))&&(k==='xl'||Number.isFinite(Number(saved[k].max)))))weightRanges=saved;}catch(e){}
const SIZE_LABEL={};
function weightLabel(key){
  const r=weightRanges[key];if(!r)return '—';
  if(key==='xl')return 'Extra grande (más de '+(Number(r.min)-1)+' kg)';
  return ({chico:'Chico',mediano:'Mediano',grande:'Grande'}[key]||key)+' ('+r.min+'–'+r.max+' kg)';
}
function renderWeightRangeLabels(){
  document.querySelectorAll('#weightRange option[data-weight-option]').forEach(o=>o.textContent=weightLabel(o.value));
  Object.keys(weightRanges).forEach(k=>SIZE_LABEL[k]=weightLabel(k));
  ['chico','mediano','grande','xl'].forEach(k=>{
    const r=weightRanges[k],min=$('weight'+k.charAt(0).toUpperCase()+k.slice(1)+'Min'),max=$('weight'+k.charAt(0).toUpperCase()+k.slice(1)+'Max');
    if(min)min.value=r.min;if(max)max.value=k==='xl'?'':r.max;
  });
}

const breedSize = { Chihuahueño: 'chico', Poodle: 'chico', Pug: 'chico', Schnauzer: 'chico', Yorkshire: 'chico', Beagle: 'chico', Bulldog: 'mediano', Cocker: 'mediano', 'Golden Retriever': 'grande', Labrador: 'grande', 'Pastor Alemán': 'grande', 'Gran Danés': 'xl', Husky: 'grande' };
const catSize = { Siamés: 'chico', Persa: 'chico', 'Maine Coon': 'mediano', Ragdoll: 'chico', Bengalí: 'chico', 'Británico de pelo corto': 'chico' };

let workerMode = false, logoTaps = 0, workerUnlockArmed = false, workerUnlockTimer = null, progressControls = null;
const WORKER_UNLOCK_WINDOW = 3000;
let extraNoteText = '';
let clientMessageOverride = '';
let nextliNoteEditDraft = {};
let nextliSavedNoteFolio = '';
let state = { extraQuantities: {}, service: null, species: '', otherSpecies: '', breed: '', weight: '', weightConfirmed: false, urnId: null, plus: false, huella: false, cert: false, plusQty: 0, huellaQty: 0, certQty: 0, petColor: '', petColorOther: '', color: '', frame: '', paymentStatus: 'No pagado', paymentOther: '' };

const $ = id => document.getElementById(id);
const val = id => (($(id)?.value || '').trim() || '—');
const esc = INV.esc;
const money = n => '$' + Number(n || 0).toLocaleString('es-MX');
const isCom = () => state.service === 'comunitaria';

/* ---------- Datos del inventario (precios vigentes) ---------- */
const getUrns = () => INV.urns();
const getUrn = id => getUrns().find(u => u.id === id);
const getExtra = id => INV.extras().find(x => x.id === id);
const comPrice = () => INV.com();

function localizeImg(img) {
  img.onerror = () => {
    if (img.src.startsWith('data:')) { img.style.opacity = '.18'; return; }
    if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = IMAGE_BASE + img.src.split('/').pop(); }
    else img.style.opacity = '.18';
  };
}

/* ---------- Pasos ---------- */
function buildTrack() {
  $('stepsTrack').innerHTML = ['🐾', '🐶', '🐱', '🐦', '🐰'].map((x, i) => `<div class="step-dot ${i === 0 ? 'active' : ''}" id="dot${i + 1}"><span class="step-icon">${x}</span></div>${i < 4 ? '<div class="step-line"></div>' : ''}`).join('');
}
buildTrack();
renderWeightRangeLabels();

function goTo(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', +p.dataset.step === step));
  for (let i = 1; i <= 5; i++) { $('dot' + i)?.classList.toggle('active', i === step); $('dot' + i)?.classList.toggle('done', i < step); }
  $('stepProgressLabel').textContent = `Paso ${step} de 5`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (step === 2) urnCarousel.refresh();
  if (step === 3) extrasCarousel.refresh();
}

/* ---------- Carrusel (scroll-snap + flechas + puntos) ---------- */
function initCarousel(rootId, trackId, dotsId) {
  const root = $(rootId), track = $(trackId), dotsEl = $(dotsId);
  const prev = root.querySelector('.prev'), next = root.querySelector('.next');
  const cards = () => [...track.querySelectorAll('.pcard')];
  const stepPx = () => { const c = cards()[0]; return c ? c.getBoundingClientRect().width + 14 : track.clientWidth * 0.8; };
  let raf = 0;
  function activeIndex() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = Infinity;
    cards().forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function update() {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= max - 4 || max <= 4;
    const ai = activeIndex();
    dotsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === ai));
  }
  function buildDots() {
    dotsEl.innerHTML = cards().map((_, i) => `<button type="button" aria-label="Ir a la tarjeta ${i + 1}"></button>`).join('');
    dotsEl.querySelectorAll('button').forEach((b, i) => b.onclick = () => centerOn(cards()[i]));
  }
  function centerOn(card, smooth = true) {
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }
  prev.onclick = () => track.scrollBy({ left: -stepPx(), behavior: 'smooth' });
  next.onclick = () => track.scrollBy({ left: stepPx(), behavior: 'smooth' });
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
  });
  window.addEventListener('resize', () => requestAnimationFrame(update));
  return { refresh() { buildDots(); update(); }, centerOn, update };
}
const urnCarousel = initCarousel('urnCarousel', 'urnGrid', 'urnDots');
const extrasCarousel = initCarousel('extrasCarousel', 'extrasTrack', 'extrasDots');

function cardKey(e, fn) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }

/* ---------- Urnas ---------- */
let urnsDirty = true;
function hasValidUrn() { const u = getUrn(state.urnId); return !!(u && !u.soldOut && state.weight && u.prices[state.weight]); }
function hasValidSelection() { return !!state.weightConfirmed && (isCom() ? !!(state.weight && comPrice()[state.weight]) : hasValidUrn()); }
function syncUrnControls() { $('next2').disabled = !hasValidSelection(); updateTotal(); }

function buildUrnCards() {
  const grid = $('urnGrid');
  const left = grid.scrollLeft;
  grid.innerHTML = '';
  getUrns().forEach(u => {
    const c = document.createElement('div');
    c.className = 'pcard'; c.dataset.id = u.id; c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.innerHTML = `<div class="pcard-media"><span class="pcard-badge" hidden></span><img src="${esc(u.img)}" alt="${esc(u.name)}" loading="lazy" decoding="async"></div>
      <div class="pcard-body"><h5>${esc(u.name)}</h5><p class="pcard-desc">${esc(u.desc)}</p><div class="pcard-price"></div></div>`;
    localizeImg(c.querySelector('img'));
    const pick = () => selectUrn(u.id);
    c.onclick = pick; c.onkeydown = e => cardKey(e, pick);
    grid.appendChild(c);
  });
  grid.scrollLeft = left;
  urnsDirty = false;
}

function refreshUrnCards() {
  const size = state.weight || null;
  getUrns().forEach(u => {
    const c = $('urnGrid').querySelector(`[data-id="${u.id}"]`); if (!c) return;
    const inSize = !size || !!u.prices[size];
    c.classList.toggle('selected', state.urnId === u.id && !u.soldOut);
    c.classList.toggle('soldout', u.soldOut);
    c.classList.toggle('unavailable', !u.soldOut && !inSize);
    c.setAttribute('aria-pressed', state.urnId === u.id ? 'true' : 'false');
    const badge = c.querySelector('.pcard-badge');
    badge.hidden = !(u.soldOut || !inSize);
    badge.textContent = u.soldOut ? 'Agotada por ahora' : 'No disponible en este tamaño';
    const sizes = Object.values(u.prices);
    c.querySelector('.pcard-price').innerHTML = size
      ? (inSize ? money(u.prices[size]) + ' <small>MXN</small>' : '<small>Prueba con otro modelo</small>')
      : 'Desde ' + money(Math.min(...sizes)) + ' <small>MXN</small> ';
  });
}

function renderUrns() {
  if (urnsDirty) buildUrnCards();
  refreshUrnCards();
  urnCarousel.refresh();
  $('urnHint').textContent = state.weight
    ? 'Estos son los precios para el tamaño que elegiste. Desliza para verlas todas.'
    : 'Desliza para conocerlas todas. Primero selecciona su peso para ver los precios.';
  syncUrnControls();
}

function selectUrn(id) {
  const u = getUrn(id); if (!u) return;
  if (u.soldOut) { INV.toast('Esta urna está agotada por ahora. Escríbenos y te sugerimos una parecida.'); return; }
  if (state.weight && !u.prices[state.weight]) { INV.toast('Esta urna no está disponible en ese tamaño. Te invitamos a ver otras opciones.'); return; }
  state.urnId = id;
  refreshUrnCards();
  urnCarousel.centerOn($('urnGrid').querySelector(`[data-id="${id}"]`));
  syncUrnControls();
}

/* ---------- Servicio comunitario: sin urna ---------- */
function applyServiceUI() {
  const com = isCom();
  $('urnPickerWrap').style.display = (com || !state.weight) ? 'none' : '';
  const note = $('comNote');
  if (com) {
    const p = state.weight && comPrice()[state.weight];
    note.style.display = state.weightConfirmed ? 'block' : 'none';
    note.textContent = !state.weight ? 'En la cremación comunitaria no se recupera la urna. Elige su peso para ver el valor.'
      : p ? `Valor del servicio comunitario: ${money(p)} MXN.` : 'Para mascotas de más de 45 kg, escríbenos y te ayudamos con gusto a coordinar el servicio.';
  } else note.style.display = 'none';
  syncUrnControls();
}

function revealStepField(id, visible) { const el = $(id); if (!el) return; el.style.display = visible ? '' : 'none'; if (visible) el.classList.add('step-reveal'); else el.classList.remove('step-reveal'); }
function updatePetFlow() {
  const ready = state.species === 'otro' ? !!state.otherSpecies.trim() : !!state.breed;
  revealStepField('breedField', state.species === 'perro'); revealStepField('catBreedField', state.species === 'gato'); revealStepField('otherSpeciesField', state.species === 'otro');
  revealStepField('weightField', !!state.species && ready);
  revealStepField('manualWeightAction', !!(breedSize[state.breed] || catSize[state.breed]));
  revealStepField('confirmWeightBtn', !!state.weight && !!state.species && ready && !state.weightConfirmed);
  revealStepField('urnPickerWrap', !isCom() && !!state.weightConfirmed && !!state.species && ready);
}
function autoWeight() {
  const s = state.species === 'perro' ? breedSize[state.breed] : state.species === 'gato' ? catSize[state.breed] : null;
  if (s) { state.weight = s; $('weightRange').value = s; } else if (state.species !== 'otro') { state.weight = ''; $('weightRange').value = ''; }
  state.weightConfirmed = false;
  const u = getUrn(state.urnId); if (!u || !state.weight || !u.prices[state.weight] || u.soldOut) state.urnId = null;
  updatePetFlow(); renderUrns(); applyServiceUI();
}

function saveWeightRanges(){
  const keys=['chico','mediano','grande','xl'],next={};
  for(const k of keys){
    const cap=k.charAt(0).toUpperCase()+k.slice(1),minEl=$('weight'+cap+'Min'),maxEl=$('weight'+cap+'Max');
    const minText=minEl?.value?.trim()||'',maxText=maxEl?.value?.trim()||'';
    const min=Number(minText),max=k==='xl'?null:Number(maxText);
    if(!minText||!Number.isInteger(min)||min<(k==='xl'?1:0)||(k!=='xl'&&(!maxText||!Number.isInteger(max)||max<min))){INV.toast('Revisa los límites de kg: deben ser números enteros y el máximo no puede ser menor al mínimo.');return;}
    next[k]={min,max};
  }
  weightRanges=next;try{localStorage.setItem(WEIGHT_RANGE_KEY,JSON.stringify(weightRanges));}catch(e){}
  renderWeightRangeLabels();INV.toast('Rangos de peso actualizados para cliente y trabajador.');
}
/* ---------- Complementos ---------- */
let extrasDirty = true;
function buildExtraCards() {
  const track = $('extrasTrack'); const left = track.scrollLeft; track.innerHTML = '';
  INV.extras().forEach(x => {
    const c = document.createElement('div');
    c.className = 'pcard'; c.dataset.id = x.id; c.setAttribute('role', 'group'); c.setAttribute('aria-label', x.name + ': selecciona el complemento o ajusta su cantidad'); c.tabIndex = 0;
    c.innerHTML = `<div class="pcard-media"><span class="pcard-badge" hidden>Agotado por ahora</span><img src="${esc(x.img)}" alt="${esc(x.name)}" loading="lazy" decoding="async"></div>
      <div class="pcard-body"><p class="pcard-eyebrow">${esc(x.eyebrow)}</p><h5>${esc(x.name)}</h5><p class="pcard-desc">${esc(x.desc)}</p>
      <div class="pcard-price">+${money(x.price)} <small>MXN / unidad</small></div><button type="button" class="pcard-cta" tabindex="-1"></button><div class="extra-qty"><button type="button" data-qty-change="-1" aria-label="Quitar una unidad">−</button><output data-qty-value>0</output><button type="button" data-qty-change="1" aria-label="Agregar una unidad">+</button></div></div>`;
    localizeImg(c.querySelector('img'));
    const tog = () => toggleExtra(x.id);
    c.onclick = e => { if (e.target.closest('[data-qty-change]')) return; tog(); };
    c.querySelectorAll('[data-qty-change]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); changeExtraQty(x.id, Number(b.dataset.qtyChange)); }));
    c.onkeydown = e => { if (!e.target.closest('[data-qty-change]')) cardKey(e, tog); };
    track.appendChild(c);
  });
  track.scrollLeft = left; extrasDirty = false;
}
function extraQty(id) { return Math.max(0, Math.floor(Number(state.extraQuantities?.[id] ?? state[id + 'Qty']) || 0)); }
function setExtraQty(id, qty) {
  const x = getExtra(id); if (!x || x.soldOut) { if (x && x.soldOut) INV.toast('Este detalle está agotado por ahora.'); return; }
  const max = Number.isFinite(x.stock) ? Math.max(0, x.stock) : 99;
  const next = Math.max(0, Math.min(max, 99, Math.floor(Number(qty) || 0)));
  state.extraQuantities = state.extraQuantities || {}; state.extraQuantities[id] = next;
  if (['plus','huella','cert'].includes(id)) state[id + 'Qty'] = next;
  state[id] = next > 0;
  if (id === 'plus' && !state.plus) { state.frame = ''; state.color = ''; document.querySelectorAll('[data-frame],[data-color]').forEach(y => y.classList.remove('selected')); }
  refreshExtraCards(); updateTotal();
}
function changeExtraQty(id, delta) { setExtraQty(id, extraQty(id) + delta); }
function refreshExtraCards() {
  INV.extras().forEach(x => {
    if (x.soldOut && extraQty(x.id)) { state.extraQuantities[x.id] = 0; if (['plus','huella','cert'].includes(x.id)) state[x.id + 'Qty'] = 0; state[x.id] = false; }
    const qty = extraQty(x.id), c = [...$('extrasTrack').querySelectorAll('.pcard')].find(el => el.dataset.id === x.id); if (!c) return;
    c.classList.toggle('added', qty > 0); c.classList.toggle('soldout', x.soldOut); c.querySelector('.pcard-badge').hidden = !x.soldOut;
    c.querySelector('.pcard-cta').textContent = qty ? 'Agregado ✓' : 'Agregar';
    const out = c.querySelector('[data-qty-value]'); if (out) out.textContent = String(qty);
    c.querySelectorAll('[data-qty-change]').forEach(b => b.disabled = x.soldOut || (b.dataset.qtyChange === '-1' && qty === 0) || (b.dataset.qtyChange === '1' && Number.isFinite(x.stock) && qty >= x.stock));
    c.setAttribute('aria-pressed', qty > 0 ? 'true' : 'false');
  });
  $('frameWrap').style.display = state.plus ? 'block' : 'none'; $('colorWrap').style.display = state.plus ? 'block' : 'none';
}
function toggleExtra(id) { setExtraQty(id, extraQty(id) ? 0 : 1); }
function renderExtras() {
  if (extrasDirty) buildExtraCards();
  refreshExtraCards();
  extrasCarousel.refresh();
}

/* ---------- Totales ---------- */
function calcBase() {
  if (isCom()) return comPrice()[state.weight] || 0;
  const u = getUrn(state.urnId);
  return (u && u.prices[state.weight]) || 0;
}
function extraPrice(id) { return getExtra(id).price; }
function total() { return calcBase() + (isCom() ? 0 : INV.extras().reduce((sum, x) => sum + extraQty(x.id) * x.price, 0)); }
function updateTotal() { $('runningTotal3').textContent = 'Total: ' + money(total()) + ' MXN'; updatePayNote(); }
function extrasList() {
  if (isCom()) return [];
  return [...INV.extras().filter(x => extraQty(x.id) > 0).map(x => `${extraQty(x.id)}x ${x.name} (+${money(extraQty(x.id) * x.price)} MXN)`), state.plus && state.frame ? `Marco: ${state.frame}` : null, state.plus && state.color ? `Vinilo: ${state.color}` : null].filter(Boolean);
}
function updatePriceLabels() {
  const all = getUrns().filter(u => !u.soldOut).flatMap(u => Object.values(u.prices));
  if (all.length) $('priceIndividual').textContent = 'Desde ' + money(Math.min(...all)) + ' MXN';
  const c = Object.values(comPrice());
  $('priceCom').textContent = money(Math.min(...c)) + ' – ' + money(Math.max(...c)) + ' MXN';
}

/* ---------- Pago (solo Modo Trabajador) ---------- */
function paymentInfo() {
  const t = total(); const label = state.paymentStatus; let paid = 0;
  if (label === 'Pago liquidado') paid = t;
  else if (label === 'Pago del 50%') paid = Math.round(t / 2);
  else if (label === 'Otro') paid = Math.max(0, Number(state.paymentOther) || 0);
  return { label, total: t, paid, balance: Math.max(t - paid, 0), over: paid > t };
}
function paymentLabel() {
  const p = paymentInfo();
  return p.label === 'Otro' ? `Otro — abonó ${money(p.paid)} MXN` : p.label;
}
function updatePayNote() {
  const n = $('payNote'); if (!n) return;
  const p = paymentInfo();
  n.textContent = `Total ${money(p.total)} · Abonado ${money(p.paid)} · Saldo ${money(p.balance)} MXN` + (p.over ? ' (el abono supera el total)' : '');
}

/* ---------- Mensajes de WhatsApp ---------- */
function speciesLabel() { return state.species === 'otro' ? (state.otherSpecies || 'Otro') : state.species ? state.species.charAt(0).toUpperCase() + state.species.slice(1) : '—'; }
function petColorLabel() { return state.petColor === 'Otro' ? (state.petColorOther.trim() || 'Otro') : (state.petColor || '—'); }
function fmtDate() { const v = $('petDate')?.value; return v ? CERT.formatDate(v) : '—'; }
function mapsLink(a) { return a && a !== '—' ? 'https://maps.google.com/?q=' + encodeURIComponent(a) : ''; }
function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return '52' + d;
  return d;
}
function nowStamp() {
  return new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildMessage(audience) {
  const urn = getUrn(state.urnId);
  const serviceName = isCom() ? 'Cremación Comunitaria' : 'Cremación Individual';
  const ex = extrasList();
  const noteExtra = workerMode ? extraNoteText.trim() : '';
  const breedTxt = state.breed ? ' / ' + state.breed : '';

  if (audience === 'grupo') {
    const p = paymentInfo();
    const lines = [
      '*🐾 NUEVA ORDEN — NEXTLI*',
      `_Capturada en Modo Trabajador · ${nowStamp()}_`,
      '------------------------------',
      '*SERVICIO*',
      `*Servicio:* ${serviceName}`,
      ...(isCom() ? [] : [`*Urna:* ${urn?.name || '—'}`]),
      `*Tamaño / peso:* ${weightLabel(state.weight) || '—'}`,
      `*Adicionales:* ${ex.length ? '' : 'Ninguno'}`,
      ...ex.map(x => `   • ${x}`),
      '',
      '*MASCOTA*',
      `*Nombre:* ${val('petName')}`,
      `*Especie / raza:* ${speciesLabel()}${breedTxt}`,
      `*Color:* ${petColorLabel()}`,
      `*Edad:* ${val('petAge')}`,
      `*Fecha de defunción:* ${fmtDate()}`,
      `*Frase:* ${val('farewellPhrase')}`,
      '',
      '*CLIENTE*',
      `*Propietario:* ${val('ownerName')}`,
      `*Teléfono:* ${val('ownerPhone')}`,
      `*Dirección:* ${val('ownerAddress')}`,
      ...(noteExtra ? ['', '*NOTA EXTRA:*', noteExtra] : [])
    ];
    const ml = mapsLink(val('ownerAddress')); if (ml) lines.push(`*Mapa:* ${ml}`);
    lines.push('',
      '*COBRO*',
      `*Total:* ${money(p.total)} MXN`,
      `*Estado del pago:* ${p.label === 'Otro' ? 'Otro (monto manual)' : p.label}`,
      `*Abonado:* ${money(p.paid)} MXN`,
      `*Saldo pendiente:* ${money(p.balance)} MXN${p.over ? ' ⚠️ (el abono supera el total)' : ''}`);
    return lines.join('\n');
  }

  let m = `*LEVANTAMIENTO DE ORDEN — NEXTLI*
------------------------------
*Servicio:* ${serviceName}
*Mascota:* ${val('petName')}
*Especie / raza:* ${speciesLabel()}${breedTxt}
*Color:* ${petColorLabel()}
*Edad:* ${val('petAge')}
${isCom() ? '' : `*Urna:* ${urn?.name || '—'}\n`}*Tamaño / peso:* ${weightLabel(state.weight) || '—'}
*Adicionales:* ${ex.join(', ') || 'Ninguno'}
*Total estimado:* ${money(total())} MXN

*DATOS DEL CLIENTE*
*Propietario:* ${val('ownerName')}
*Teléfono:* ${val('ownerPhone')}
*Dirección:* ${val('ownerAddress')}
*Fecha de defunción:* ${fmtDate()}
*Frase:* ${val('farewellPhrase')}${noteExtra ? '\n*Nota extra:* ' + noteExtra : ''}`;

  if (audience === 'recibo') { // trabajador → cliente: incluye su estado de pago
    const p = paymentInfo();
    m += `\n\n*PAGO:* ${p.label}\n*Abonado:* ${money(p.paid)} MXN\n*Saldo pendiente:* ${money(p.balance)} MXN`;
  }
  if (audience === 'cliente' || audience === 'recibo') {
    m = '*NOTA DE TU SOLICITUD NEXTLI*\n\n' + m + '\n\nGracias por confiarnos a tu compañero en un momento tan especial. Estamos contigo. 🤍';
  }
  return m;
}

/* ---------- Resumen ---------- */
function line(a, b) { return `<div class="summary-line"><span>${a}</span><b>${esc(b)}</b></div>`; }
function renderSummary() {
  const urn = getUrn(state.urnId);
  const extra = workerMode ? (extraNoteText || '') : '';
  const workerTools = workerMode ? `<div class="worker-only remission-worker-tools">
    <div class="summary-extra"><label for="extraSummaryNote">Nota extra / observaciones (se incluirá en el WhatsApp y en la Nota de Remisión)</label><textarea id="extraSummaryNote" rows="3" maxlength="1200" placeholder="Agrega indicaciones u observaciones…">${esc(extra)}</textarea></div>
    <div class="summary-extra summary-message-edit"><label for="editableClientMessage">Mensaje de WhatsApp editable antes de enviarlo</label><textarea id="editableClientMessage" rows="8">${esc(clientMessageOverride || buildMessage('cliente'))}</textarea></div>
  </div>` : '';
  $('summaryBox').innerHTML = `<div class="summary-box"><h4>Resumen de tu solicitud</h4>${line('Servicio', isCom() ? 'Cremación Comunitaria' : 'Cremación Individual')}${line('Mascota', val('petName'))}${line('Especie / raza', speciesLabel() + (state.breed ? ' / ' + state.breed : ''))}${line('Color', petColorLabel())}${line('Tamaño / peso', weightLabel(state.weight) || '—')}${isCom() ? '' : line('Urna', urn?.name || '—')}${extrasList().map(x => line('Adicional', x)).join('')}${line('Propietario', val('ownerName'))}${line('Teléfono', val('ownerPhone'))}${line('Dirección', val('ownerAddress'))}${workerMode ? line('Pago', paymentLabel()) + line('Abonado', money(paymentInfo().paid) + ' MXN') + line('Saldo pendiente', money(paymentInfo().balance) + ' MXN') : ''}<div class="summary-total"><span>Total estimado</span><span>${money(total())} MXN</span></div>${workerTools}</div>`;
  const messageInput = workerMode ? $('editableClientMessage') : null;
  if (messageInput) messageInput.addEventListener('input', e => {
    clientMessageOverride = e.target.value;
    $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(clientMessageOverride);
  });
  const extraInput = workerMode ? $('extraSummaryNote') : null;
  if (extraInput) extraInput.addEventListener('input', e => {
    extraNoteText = e.target.value;
    clientMessageOverride = buildMessage('cliente');
    if ($('editableClientMessage')) $('editableClientMessage').value = clientMessageOverride;
    $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(clientMessageOverride);
  });
  $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(workerMode ? (clientMessageOverride || buildMessage('cliente')) : buildMessage('cliente'));
}
function requiredOk() {
  const ids = ['petName', 'petAge', 'petDate', 'ownerName', 'ownerPhone', 'ownerAddress'];
  return hasValidSelection() && state.species && state.weight && state.petColor && (state.petColor !== 'Otro' || state.petColorOther.trim()) && ids.every(id => val(id) !== '—') && (state.species !== 'otro' || state.otherSpecies.trim()) && (state.species === 'otro' || !!state.breed);
}

/* ---------- Modo Trabajador ---------- */
function activateWorker() {
  workerMode = true;
  document.body.classList.add('worker-mode');
  progressControls?.restore();
  $('workerButton').textContent = 'Modo trabajador NEXTLI';
  $('workerPaymentWrap').style.display = 'block';
  workerUnlockArmed = false; logoTaps = 0; clearTimeout(workerUnlockTimer);
  updatePayNote();
  if (+document.querySelector('.step-panel.active')?.dataset.step === 5) {
    renderSummary();
    if ($('editableClientMessage')) $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(clientMessageOverride || buildMessage('cliente'));
  }
}
$('nextliTrigger').onclick = () => {
  if (workerMode) return;
  logoTaps++;
  if (logoTaps === 1) { clearTimeout(workerUnlockTimer); workerUnlockTimer = setTimeout(() => { logoTaps = 0; workerUnlockArmed = false; }, WORKER_UNLOCK_WINDOW); }
  if (logoTaps === 2) { workerUnlockArmed = true; clearTimeout(workerUnlockTimer); workerUnlockTimer = setTimeout(() => { logoTaps = 0; workerUnlockArmed = false; }, WORKER_UNLOCK_WINDOW); }
};
$('workerButton').onclick = () => {
  if (workerMode) return;
  if (workerUnlockArmed) activateWorker(); else logoTaps = 0;
};
$('workerButton').addEventListener('dblclick', e => e.preventDefault());

/* ---------- Eventos del flujo ---------- */
document.querySelectorAll('[data-service]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-service]').forEach(x => x.classList.remove('selected'));
  b.classList.add('selected'); state.service = b.dataset.service;
  if (isCom()) { state.plus = state.huella = state.cert = false; state.plusQty = state.huellaQty = state.certQty = 0; state.extraQuantities = {}; state.frame = state.color = ''; refreshExtraCards(); }
  applyServiceUI(); renderUrns(); goTo(2);
});
document.querySelectorAll('[data-wa-text]').forEach(b => b.onclick = () => window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(b.dataset.waText), '_blank'));
$('species').onchange = e => {
  state.species = e.target.value; state.breed = ''; state.otherSpecies = ''; state.weight = ''; state.weightConfirmed = false; state.urnId = null; $('breed').value = ''; $('catBreed').value = ''; $('weightRange').value = ''; updatePetFlow(); autoWeight();
};
$('otherSpecies').oninput = e => { state.otherSpecies = e.target.value; updatePetFlow(); if (state.species === 'otro') { state.weight = ''; state.weightConfirmed = false; $('weightRange').value = ''; } };
$('breed').onchange = e => { state.breed = e.target.value; autoWeight(); };
$('catBreed').onchange = e => { state.breed = e.target.value; autoWeight(); };
$('toggleWeightRanges')?.addEventListener('click',()=>{const box=$('weightRangeSettings'),btn=$('toggleWeightRanges');if(!box||!btn)return;box.hidden=!box.hidden;btn.setAttribute('aria-expanded',String(!box.hidden));});
$('saveWeightRanges')?.addEventListener('click',saveWeightRanges);
$('weightRange').onchange = e => {
  state.weight = e.target.value; state.weightConfirmed = false; updatePetFlow();
  const u = getUrn(state.urnId);
  if (!u || !u.prices[state.weight]) state.urnId = null;
  renderUrns(); applyServiceUI();
};
$('manualWeightBtn').onclick = () => { $('weightRange').focus(); };
$('confirmWeightBtn').onclick = () => { if (!state.weight) return; state.weightConfirmed = true; updatePetFlow(); applyServiceUI(); };
$('next2').onclick = () => goTo(isCom() ? 4 : 3);
document.querySelectorAll('[data-frame]').forEach(x => x.onclick = () => { document.querySelectorAll('[data-frame]').forEach(y => y.classList.remove('selected')); x.classList.add('selected'); state.frame = x.dataset.frame; });
document.querySelectorAll('[data-color]').forEach(x => x.onclick = () => { document.querySelectorAll('[data-color]').forEach(y => y.classList.remove('selected')); x.classList.add('selected'); state.color = x.dataset.color; });
$('next3').onclick = () => goTo(4);
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => {
  const to = +b.dataset.back;
  goTo(to === 3 && isCom() ? 2 : to);
});
$('paymentStatus').onchange = e => { $('paymentOther').style.display = e.target.value === 'Otro' ? 'block' : 'none'; state.paymentStatus = e.target.value; updatePayNote(); };
$('paymentOther').oninput = e => { state.paymentOther = e.target.value; updatePayNote(); };
$('petColor').onchange = e => { state.petColor = e.target.value; state.petColorOther = ''; $('petColorOther').style.display = state.petColor === 'Otro' ? 'block' : 'none'; if (state.petColor === 'Otro') $('petColorOther').focus(); };
$('petColorOther').oninput = e => { state.petColorOther = e.target.value; };
$('next4').onclick = () => {
  if (!requiredOk()) { alert('Para continuar, elige una urna y completa los datos marcados con *. Gracias por tu paciencia.'); return; }
  renderSummary(); goTo(5);
};
$('useMyLocationBtn').onclick = () => {
  const status = $('geoStatus');
  if (!navigator.geolocation) { status.textContent = 'No disponible. Escribe la dirección manualmente.'; status.style.display = 'block'; return; }
  status.textContent = 'Obteniendo ubicación…'; status.style.display = 'block';
  navigator.geolocation.getCurrentPosition(async p => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.coords.latitude}&lon=${p.coords.longitude}`, { headers: { 'Accept-Language': 'es' } });
      const d = await r.json(); $('ownerAddress').value = d.display_name || ''; status.textContent = 'Dirección obtenida; puedes editarla.';
    } catch { status.textContent = 'No pudimos traducir la ubicación. Escríbela manualmente.'; }
  }, () => status.textContent = 'Permiso de ubicación no disponible. Escribe la dirección manualmente.', { enableHighAccuracy: true, timeout: 10000 });
};

/* ---------- Envío directo a WhatsApp NEXTLI (Modo Trabajador) ----------
   Usa el número de contacto configurado en NEXTLI_CONFIG / Supabase.
   El mensaje incluye los datos completos de la orden y el estado del pago. */
$('sendGroupWa').onclick = () => {
  if (!workerMode) return;
  if (!requiredOk()) { alert('Completa primero todos los datos obligatorios para enviar la orden a NEXTLI.'); return; }
  const phone = normalizePhone(WA_NUMBER);
  if (!/^\d{11,15}$/.test(phone)) { alert('El número de WhatsApp de NEXTLI no está configurado correctamente.'); return; }
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(buildMessage('grupo'));
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
};

$('sendClientWa').onclick = () => {
  if (!workerMode) return;
  if (!requiredOk()) { alert('Completa primero todos los datos obligatorios.'); return; }
  const phone = normalizePhone(val('ownerPhone'));
  if (!/^\d{11,15}$/.test(phone)) { alert('Revisa el teléfono del cliente: parece incompleto.'); return; }
  const p = paymentInfo();
  let message = clientMessageOverride || $('editableClientMessage')?.value || buildMessage('cliente');
  message += `\n\n*PAGO:* ${p.label}\n*Abonado:* ${money(p.paid)} MXN\n*Saldo pendiente:* ${money(p.balance)}`;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(message), '_blank');
};
$('sendChuchoWa').onclick = () => {
  if (!workerMode) return;
  if (!requiredOk()) { alert('Completa primero todos los datos obligatorios.'); return; }
  const message = '*ORDEN NEXTLI PARA CHUCHO*\n\n' + buildMessage('grupo');
  window.open('https://wa.me/527121483834?text=' + encodeURIComponent(message), '_blank');
};
$('downloadCertificate').onclick = generateCertificate;

function restartForNextPet(){
  if(!confirm('¿Comenzar una nueva mascota? Se borrarán los datos de esta solicitud para iniciar desde cero.'))return;
  const keepWorker=workerMode;
  try{localStorage.removeItem('nextli-progress-v3');}catch(e){}
  document.querySelectorAll('input,select,textarea').forEach(el=>{
    if(el.type==='checkbox'||el.type==='radio')el.checked=!!el.defaultChecked;
    else el.value=el.defaultValue||'';
  });
  state={extraQuantities:{},service:null,species:'',otherSpecies:'',breed:'',weight:'',weightConfirmed:false,urnId:null,plus:false,huella:false,cert:false,plusQty:0,huellaQty:0,certQty:0,petColor:'',petColorOther:'',color:'',frame:'',paymentStatus:'No pagado',paymentOther:''};
  extraNoteText='';clientMessageOverride='';nextliNoteEditDraft={};nextliSavedNoteFolio='';
  document.querySelectorAll('[data-service],[data-frame],[data-color]').forEach(el=>el.classList.remove('selected'));
  $('paymentStatus').value='No pagado';$('paymentOther').style.display='none';
  $('workerPaymentWrap').style.display=keepWorker?'block':'none';
  document.body.classList.toggle('worker-mode',keepWorker);
  $('workerButton').textContent=keepWorker?'Modo trabajador NEXTLI':'Personaliza tu despedida';
  updatePetFlow();applyServiceUI();renderUrns();refreshExtraCards();renderExtras();updateTotal();updatePayNote();
  goTo(1);
  INV.toast('Listo. Puedes registrar a otra mascota desde cero.');
}
$('restartNewPet').addEventListener('click',restartForNextPet);

/* ---------- Certificado de cremación (canvas → PDF) ---------- */
let certCanvas = null;
function breedForCert() {
  if (state.species === 'otro') return '—';
  if (!state.breed) return '—';
  return /^mestizo/i.test(state.breed) ? 'Mestizo' : state.breed;
}
function certData() {
  return {
    name: val('petName') === '—' ? '' : val('petName'),
    kind: state.species, otherSpecies: state.otherSpecies,
    breed: breedForCert(), color: petColorLabel(), age: val('petAge'),
    cremation: isCom() ? 'Comunitaria' : 'Individual',
    owner: val('ownerName'), date: $('petDate').value,
    doctor: CFG.DOCTOR ? { name: CFG.DOCTOR.name, title: CFG.DOCTOR.title } : undefined
  };
}
function closeCertificatePreview() {
  const o = $('certificatePreview'); o.classList.remove('open'); o.setAttribute('aria-hidden', 'true');
  $('certificatePreviewMount').innerHTML = ''; certCanvas = null;
}
async function generateCertificate() {
  if (!workerMode) { alert('El certificado lo genera el equipo NEXTLI.'); return; }
  if (!requiredOk()) { alert('Completa primero todos los datos obligatorios.'); return; }
  const mount = $('certificatePreviewMount'), overlay = $('certificatePreview'), ok = $('confirmCertificateDownload');
  mount.innerHTML = '<div class="cert-loading" style="padding:50px 10px;text-align:center;font:500 14px Poppins,sans-serif">Preparando el certificado…</div>';
  overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); ok.disabled = true;
  try {
    certCanvas = await CERT.render(certData(), { width: 2400 });
    mount.innerHTML = '';
    if (window.NEXTLI_CERT_ART_STATUS === 'respaldo') {
      const warning = document.createElement('div');
      warning.className = 'cert-art-warning';
      warning.style.cssText = 'margin:12px;padding:12px 14px;border:1px solid #d6a64a;border-radius:10px;background:#fff8e8;color:#76521b;font:500 13px Poppins,sans-serif';
      warning.textContent = 'No se pudo generar la ilustración realista con IA. Se muestra la ilustración de respaldo. ' + (window.NEXTLI_CERT_ART_ERROR || 'Revisa la configuración de AI Gateway en Vercel.');
      mount.appendChild(warning);
    }
    const wrap = document.createElement('div'); wrap.className = 'cert-canvas-wrap'; wrap.appendChild(certCanvas); mount.appendChild(wrap);
  } catch (e) {
    console.error(e); mount.textContent = 'No se pudo preparar el certificado. Inténtalo de nuevo.';
  } finally { ok.disabled = false; }
}
function safe(s) { return String(s).replace(/[\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/^-|-$/g, '') || 'Cremacion-Nextli'; }
async function downloadCertificatePdf() {
  if (!workerMode) { alert('El certificado lo genera el equipo NEXTLI.'); return; }
  if (!certCanvas) return;
  const btn = $('confirmCertificateDownload'); btn.disabled = true;
  try {
    const blob = await CERT.toPdfBlob(certCanvas, 'Certificado de cremacion');
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Certificado-${safe(val('petName'))}-${safe(val('ownerName'))}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 15000);
    closeCertificatePreview();
  } catch (e) { console.error(e); alert('No se pudo generar el PDF. Inténtalo de nuevo.'); }
  finally { btn.disabled = false; }
}
$('confirmCertificateDownload').onclick = downloadCertificatePdf;
$('closeCertificatePreview').onclick = closeCertificatePreview;
$('cancelCertificatePreview').onclick = closeCertificatePreview;

/* ---------- Cambios de inventario en vivo ---------- */
INV.onChange(() => {
  urnsDirty = true; extrasDirty = true;
  const u = getUrn(state.urnId);
  if (u && (u.soldOut || (state.weight && !u.prices[state.weight]))) state.urnId = null;
  renderUrns(); renderExtras(); updatePriceLabels(); applyServiceUI(); updateTotal();
  if ($('summaryBox').innerHTML && document.querySelector('.step-panel[data-step="5"]').classList.contains('active')) renderSummary();
});

/* ---------- Inicio ---------- */
renderUrns(); renderExtras(); updatePriceLabels(); syncUrnControls(); updateTotal(); updatePetFlow();


/* ---------- Bienvenida y aplicación instalable NEXTLI ---------- */
(function initWelcomeAndInstall() {
  var welcome = $('welcomeScreen');
  var continueBtn = $('continueToConfigurator');
  var installBtn = $('installAppBtn');
  var deferredInstallPrompt = null;
  var params = new URLSearchParams(window.location.search);
  var workerLaunch = params.get('modo') === 'trabajador';

  function enterApp(asWorker) {
    document.body.classList.add('app-ready');
    if (welcome) welcome.setAttribute('aria-hidden', 'true');
    if (asWorker && !workerMode) activateWorker();
    if (asWorker) {
      // Mantener la URL de inicio de la app instalada en modo trabajador.
      document.documentElement.dataset.nextliLaunch = 'worker';
    }
  }

  if (continueBtn) continueBtn.addEventListener('click', function() { enterApp(false); });
  if (workerLaunch) {
    enterApp(true);
    // La URL de arranque instalada siempre abre directamente el configurador.
    if (welcome) welcome.hidden = true;
  } else {
    document.body.classList.remove('app-ready');
  }

  function showInstallButton() {
    if (!installBtn) return;
    installBtn.hidden = false;
    installBtn.textContent = 'Instalar app';
  }
  if (installBtn) {
    installBtn.hidden = false;
    installBtn.addEventListener('click', async function() {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          var choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            installBtn.textContent = 'Instalación solicitada';
          }
        } catch (e) { /* el navegador puede cerrar el diálogo */ }
        deferredInstallPrompt = null;
        return;
      }
      var ua = navigator.userAgent || '';
      var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        alert('Para instalar NEXTLI en iPhone o iPad:\n1. Abre esta página en Safari.\n2. Pulsa Compartir.\n3. Elige “Añadir a pantalla de inicio”.\n4. Confirma con “Añadir”.\n\nLa app instalada abrirá directamente el configurador en modo trabajador.');
      } else if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        alert('NEXTLI ya está abierta como aplicación instalada.');
      } else {
        alert('Si tu navegador no muestra la opción de instalación, abre el menú del navegador y selecciona “Instalar aplicación” o “Añadir a pantalla de inicio”.');
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });
  window.addEventListener('appinstalled', function() {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.textContent = 'App instalada';
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    var nextliSwReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (nextliSwReloading) return;
      nextliSwReloading = true;
      // pagehide activa el autosave antes de recargar con la versión nueva.
      window.location.reload();
    });
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function(reg) {
        function checkForUpdate() {
          if (document.visibilityState === 'visible' && reg.update) reg.update().catch(function(){});
        }
        window.addEventListener('pageshow', checkForUpdate);
        document.addEventListener('visibilitychange', checkForUpdate);
        window.setInterval(checkForUpdate, 5 * 60 * 1000);
        checkForUpdate();
      }).catch(function(err) {
        console.warn('NEXTLI: no se pudo registrar el modo sin conexión.', err);
      });
    });
  }
})();


/* ---------- Nota de Remisión visual NEXTLI (solo Modo Trabajador) ---------- */
(function initRemissionNote() {
  const openBtn = $('viewRemissionNote'), overlay = $('remissionNoteOverlay'), paper = $('remissionNotePaper');
  if (!openBtn || !overlay || !paper) return;
  let folio = nextliSavedNoteFolio || '';
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateParts = d => { const p = d.split('-'); return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : d; };
  function nextFolio() {
    const d = new Date(), key = 'nextli_remision_' + d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    let n = 1; try { n = (+localStorage.getItem(key) || 0)+1; localStorage.setItem(key,String(n)); } catch(e) {}
    return 'NX-'+key.replace('nextli_remision_','')+'-'+String(n).padStart(3,'0');
  }
  function noteRows() {
    const urn = getUrn(state.urnId), extras = INV.extras();
    const rows = [];
    const qExtra = id => Math.max(0, Number(extraQty(id)) || 0);
    if (isCom()) {
      const price = calcBase();
      rows.push({desc:'Cremación comunitaria / sin recuperación de cenizas',price,unit:price,qty:1,checked:true});
    } else {
      rows.push({desc:'Cremación individual (recuperación de cenizas, urna, placa y certificado)',price:0,unit:0,qty:1,checked:true});
      if (urn) {
        const price = calcBase();
        const color = state.color ? ' | Vinilo: '+state.color : '';
        rows.push({desc:'Urna seleccionada: '+urn.name+(color?' '+color:''),price,unit:price,qty:1,checked:true});
      }
    }
    if (state.plus) { const q=qExtra('plus')||1,x=extras.find(v=>v.id==='plus'); rows.push({desc:x?.name||'Paquete Plus — Homenaje completo',price:Number(x?.price||0)*q,unit:Number(x?.price||0),qty:q,checked:true}); }
    if (state.huella) { const q=qExtra('huella')||1,x=extras.find(v=>v.id==='huella'); rows.push({desc:x?.name||'Huella con pelo de mascota',price:Number(x?.price||0)*q,unit:Number(x?.price||0),qty:q,checked:true}); }
    if (state.cert) { const q=qExtra('cert')||1,x=extras.find(v=>v.id==='cert'); rows.push({desc:x?.name||'Certificado físico adicional',price:Number(x?.price||0)*q,unit:Number(x?.price||0),qty:q,checked:true}); }
    const used=['plus','huella','cert'];
    extras.filter(x=>!used.includes(x.id)&&qExtra(x.id)>0).forEach(x=>{const q=qExtra(x.id);rows.push({desc:x.name,price:Number(x.price||0)*q,unit:Number(x.price||0),qty:q,checked:true});});
    return rows.filter(r=>r.checked);
  }
  function renderPaper() {
    const rows=noteRows(), pay=paymentInfo(), date=new Date();
    const dateText=date.toLocaleDateString('es-MX');
    const fmtMoney=v=>Number(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
    const serviceLines=rows.map((r,ri)=>`<tr><td class="rn-check"><span class="rn-checkmark">✓</span><small>${r.qty>1?r.qty+' pzas.':'1'}</small></td><td contenteditable="true" data-note-edit="row-${ri}-desc">${escHtml(r.desc)}</td><td class="rn-money" contenteditable="true" data-note-edit="row-${ri}-price">${r.unit?('$ '+fmtMoney(r.unit)):'Incluido'}</td><td class="rn-money" contenteditable="true" data-note-edit="row-${ri}-amount">${r.price?('$ '+fmtMoney(r.price)):'Incluido'}</td></tr>`).join('');
    const field=(label,key,value)=>value&&value!=='—'?'<p contenteditable="true" data-note-edit="'+key+'">'+escHtml(label+': '+value)+'</p>':'';
    const owner=[field('Nombre','owner',val('ownerName')),field('WhatsApp','phone',val('ownerPhone')),field('Dirección','address',val('ownerAddress'))].filter(Boolean).join('');
    const pet=[field('Mascota','pet',val('petName')),field('Especie / raza','species',speciesLabel()+(state.breed?' / '+state.breed:'')),field('Peso','weight',weightLabel(state.weight)||''),field('Fecha de defunción','death',fmtDate()==='—'?'':fmtDate())].filter(Boolean).join('');
    const observations=[val('farewellPhrase')==='—'?'':val('farewellPhrase'),extraNoteText.trim()].filter(Boolean).join('\n');
    paper.innerHTML=`<article class="remission-sheet">
      <header class="rn-header">
        <div class="rn-brand"><img src="/images/nextli-logo.png" alt="Emblema NEXTLI"><strong>NEXTLI</strong><small>Cremación de Mascotas<br>con Amor en México</small></div>
        <div class="rn-title"><h2>NOTA DE REMISIÓN</h2><div>Folio N°: <span contenteditable="true" data-note-edit="folio">${escHtml(folio)}</span></div><div>Fecha: <span contenteditable="true" data-note-edit="date">${dateText}</span></div></div>
      </header>
      <div class="rn-contact">Tel / WhatsApp: 55 2188 9698 | José Bernardo Couto 226, 57620 Cd. Nezahualcóyotl, Méx.</div>
      <div class="rn-two">
        <section><h3>Datos del Tutor</h3>${owner||'<p>Datos del tutor por completar</p>'}</section>
        <section><h3>Datos del Compañero</h3>${pet||'<p>Datos de la mascota por completar</p>'}</section>
      </div>
      <table class="rn-table"><thead><tr><th>Cant.</th><th>Descripción del Servicio / Personalización</th><th>Precio Unit.</th><th>Importe</th></tr></thead><tbody>${serviceLines}</tbody></table>
      <div class="rn-bottom">
        <section class="rn-observations"><label>Frase de despedida / Observaciones:</label><div contenteditable="true" data-note-edit="observations" class="rn-lines">${escHtml(observations)}</div></section>
        <section class="rn-totals"><p>Subtotal: <b contenteditable="true" data-note-edit="subtotal">$ ${fmtMoney(total())}</b></p><p>Anticipo: <b contenteditable="true" data-note-edit="deposit">$ ${fmtMoney(pay.paid)}</b></p><strong>Total a pagar: <span contenteditable="true" data-note-edit="total">$ ${fmtMoney(pay.balance)}</span> MXN</strong><p class="rn-payment">Estado del pago: ${escHtml(paymentLabel())}</p></section>
      </div>
      <div class="rn-signatures"><div>Firma de conformidad<br>del Tutor</div><div>Recibido / Entregado<br>por NEXTLI</div></div>
      <footer>“Pequeños detalles que guardan su huella por siempre.”</footer>
    </article>`;
    paper.querySelectorAll('[data-note-edit]').forEach(el=>{const k=el.dataset.noteEdit;if(Object.prototype.hasOwnProperty.call(nextliNoteEditDraft,k))el.innerText=nextliNoteEditDraft[k];});
  }
  function noteText() {
    const clone=paper.querySelector('.remission-sheet'); if(!clone)return '';
    clone.querySelectorAll('[contenteditable="true"]').forEach(el=>el.removeAttribute('contenteditable'));
    return clone.innerText || clone.textContent || '';
  }
  function closeNote(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');}
  function openNote(){
    if(!workerMode){alert('La Nota de Remisión está disponible únicamente en Modo Trabajador.');return;}
    if(!folio)folio=nextFolio(); nextliSavedNoteFolio=folio; renderPaper();
    overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  }
  async function downloadNote(){
    if(!workerMode)return;
    const sheet=paper.querySelector('.remission-sheet');if(!sheet)return;
    const W=1240,H=1754,cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const ctx=cv.getContext('2d');
    const C={navy:'#10233d',navy2:'#1d3857',gold:'#c6a34b',paper:'#fbf8f0',ink:'#18283b',muted:'#647184',sage:'#e4eee7',line:'#d8d4c9',white:'#fff'};
    ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);
    const rounded=(x,y,w,h,r,fill,stroke)=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const text=(str,x,y,size=25,color=C.ink,weight='400',align='left',font='Arial')=>{ctx.font=weight+' '+size+'px '+font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(String(str||''),x,y);};
    const wrap=(str,maxW,size=22,weight='400')=>{ctx.font=weight+' '+size+'px Arial';const words=String(str||'').split(/\s+/),out=[];let line='';words.forEach(word=>{const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxW&&line){out.push(line);line=word;}else line=test;});if(line)out.push(line);return out;};
    const paragraph=(str,x,y,maxW,size=21,color=C.ink,lineH=29,weight='400',maxLines=5)=>{const lines=wrap(str,maxW,size,weight).slice(0,maxLines);lines.forEach((l,i)=>text(l,x,y+i*lineH,size,color,weight));return y+lines.length*lineH;};
    const loadLogo=()=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src='/images/nextli-logo.png';});
    ctx.fillStyle=C.navy;ctx.fillRect(0,0,W,245);
    ctx.fillStyle=C.gold;ctx.fillRect(0,239,W,6);
    const logo=await loadLogo();
    if(logo){const sc=Math.min(155/logo.width,165/logo.height),lw=logo.width*sc,lh=logo.height*sc;ctx.drawImage(logo,66,35,lw,lh);}
    text('NEXTLI',245,52,42,'#e0c46f','700');
    text('Cremación de Mascotas',245,104,24,C.white,'500');
    text('con Amor en México',245,137,24,C.white,'500');
    text('NOTA DE REMISIÓN',1160,58,39,C.white,'700','right');
    text('Folio: '+noteField('folio'),1160,117,23,'#f1d88f','600','right');
    text('Fecha: '+noteField('date'),1160,158,21,C.white,'400','right');
    text('Tel / WhatsApp: 55 2188 9698  ·  José Bernardo Couto 226, Nezahualcóyotl, Méx.',W/2,267,18,C.muted,'400','center');
    const drawInfoCard=(x,y,w,h,title,lines)=>{
      rounded(x,y,w,h,18,C.white,C.line);
      ctx.fillStyle=C.navy2;ctx.fillRect(x,y,w,48);
      text(title,x+w/2,y+12,23,C.white,'700','center');
      let cy=y+64;
      lines.filter(Boolean).forEach(line=>{cy=paragraph(line,x+22,cy,w-44,20,C.ink,27,'400',2)+6;});
    };
    const owner=[noteField('owner'),noteField('phone'),noteField('address')].filter(v=>v&&v!=='—');
    const pet=[noteField('pet'),noteField('species'),noteField('weight'),noteField('death')].filter(v=>v&&v!=='—');
    drawInfoCard(64,305,542,232,'DATOS DEL TUTOR',owner.length?owner:['Por completar']);
    drawInfoCard(634,305,542,232,'DATOS DEL COMPAÑERO',pet.length?pet:['Por completar']);
    const tableRows=[...paper.querySelectorAll('.rn-table tbody tr')].map(tr=>{
      const td=tr.querySelectorAll('td');if(td.length<4)return null;
      const desc=(td[1].innerText||td[1].textContent||'').trim();
      if(!desc)return null;
      return {qty:(td[0].innerText||td[0].textContent||'1').trim(),desc,unit:(td[2].innerText||td[2].textContent||'').trim(),amount:(td[3].innerText||td[3].textContent||'').trim()};
    }).filter(Boolean);
    const tableX=64,tableY=570,tableW=1112,headerH=58,col=[90,642,190,190];
    rounded(tableX,tableY,tableW,headerH,12,C.navy2,null);
    const headers=['Cant.','Descripción del servicio / personalización','Precio unit.','Importe'];
    let xx=tableX;headers.forEach((h,i)=>{text(h,xx+col[i]/2,tableY+18,18,C.white,'700','center');xx+=col[i];});
    let y=tableY+headerH;
    tableRows.forEach((r,i)=>{
      const lines=wrap(r.desc,col[1]-34,20,'500');
      const rowH=Math.max(62,lines.length*27+24);
      ctx.fillStyle=i%2===0?C.white:'#f2efe6';ctx.fillRect(tableX,y,tableW,rowH);
      ctx.strokeStyle=C.line;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(tableX,y+rowH);ctx.lineTo(tableX+tableW,y+rowH);ctx.stroke();
      text(r.qty.replace(/\n/g,' '),tableX+col[0]/2,y+20,20,C.navy,'700','center');
      lines.forEach((line,i)=>text(line,tableX+col[0]+18,y+16+i*27,19,C.ink,'500'));
      text(r.unit,tableX+col[0]+col[1]+col[2]/2,y+20,18,C.ink,'500','center');
      text(r.amount,tableX+col[0]+col[1]+col[2]+col[3]/2,y+20,18,C.ink,'700','center');
      y+=rowH;
    });
    rounded(tableX,y,tableW,2,0,C.gold,null);
    const bottomY=Math.min(y+30,1320);
    const obsH=250,obsW=620,totW=460;
    rounded(64,bottomY,obsW,obsH,16,C.white,C.line);
    text('FRASE / OBSERVACIONES',86,bottomY+20,20,C.navy,'700');
    paragraph(noteField('observations')||'—',86,bottomY+62,obsW-44,20,C.ink,29,'400',5);
    rounded(710,bottomY,466,obsH,16,C.white,C.line);
    text('RESUMEN',736,bottomY+20,20,C.navy,'700');
    text('Subtotal',736,bottomY+65,20,C.muted);text(noteField('subtotal'),1148,bottomY+65,20,C.ink,'600','right');
    text('Anticipo',736,bottomY+105,20,C.muted);text(noteField('deposit'),1148,bottomY+105,20,C.ink,'600','right');
    ctx.fillStyle=C.sage;ctx.fillRect(711,bottomY+145,464,58);
    text('SALDO',736,bottomY+161,21,C.navy,'700');text(noteField('total')+' MXN',1148,bottomY+159,24,C.navy,'700','right');
    const signY=Math.min(bottomY+obsH+70,1570);
    ctx.strokeStyle=C.navy;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(120,signY);ctx.lineTo(520,signY);ctx.moveTo(720,signY);ctx.lineTo(1120,signY);ctx.stroke();
    text('Firma de conformidad del Tutor',320,signY+14,17,C.muted,'400','center');
    text('Recibido / Entregado por NEXTLI',920,signY+14,17,C.muted,'400','center');
    text('“Pequeños detalles que guardan su huella por siempre.”',W/2,1680,22,C.navy,'italic 500','center','Georgia');
    const blob=await (async function canvasToA4Pdf(canvas){
      const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(b=>{if(!b)return reject(new Error('No se pudo generar el PDF de la nota.'));b.arrayBuffer().then(v=>resolve(new Uint8Array(v)),reject);},'image/jpeg',0.94));
      const enc=new TextEncoder(),parts=[],offsets=[];let length=0;
      const push=data=>{const bytes=typeof data==='string'?enc.encode(data):data;parts.push(bytes);length+=bytes.length;};
      const obj=(n,body)=>{offsets[n]=length;push(n+' 0 obj\\n');push(body);push('\\nendobj\\n');};
      const pageW=595.28,pageH=841.89;
      push('%PDF-1.4\\n%\\xE2\\xE3\\xCF\\xD3\\n');
      obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
      obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
      obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' '+pageH+'] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>');
      offsets[4]=length;push('4 0 obj\\n<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\\nstream\\n');push(jpeg);push('\\nendstream\\nendobj\\n');
      const content='q '+pageW+' 0 0 '+pageH+' 0 0 cm /Im0 Do Q';obj(5,'<< /Length '+content.length+' >>\\nstream\\n'+content+'\\nendstream');
      obj(6,'<< /Title (Nota de Remision NEXTLI) /Producer (NEXTLI) >>');
      const xrefPos=length;let xref='xref\\n0 7\\n0000000000 65535 f \\n';for(let i=1;i<=6;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \\n';push(xref);push('trailer\\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\\nstartxref\\n'+xrefPos+'\\n%%EOF');
      const out=new Uint8Array(length);let p=0;parts.forEach(b=>{out.set(b,p);p+=b.length;});return new Blob([out],{type:'application/pdf'});
    })(cv);
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    const safe=(val('petName')==='—'?'mascota':val('petName')).replace(/[^a-z0-9áéíóúñ_-]+/gi,'-');
    a.href=url;a.download='Nota-Remision-NEXTLI-'+safe+'.pdf';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  function noteField(key) {
    const el=paper.querySelector('[data-note-edit="'+key+'"]');
    return (el?.innerText||el?.textContent||'').trim();
  }
  function noteWhatsAppText() {
    const rows=[...paper.querySelectorAll('.rn-table tbody tr')].map(tr=>{
      const cells=tr.querySelectorAll('td');
      if(cells.length<4)return '';
      const checkText=(cells[0].innerText||cells[0].textContent||'');const checked=checkText.includes('☑')||checkText.includes('✓');
      const description=(cells[1].innerText||cells[1].textContent||'').trim();
      const unit=(cells[2].innerText||cells[2].textContent||'').trim();
      const amount=(cells[3].innerText||cells[3].textContent||'').trim();
      if(!description||/^_{3,}$/.test(description))return '';
      return (checked?'☑ ':'□ ')+description+(amount&&amount!=='$ __________'?'\n   Importe: '+amount:'');
    }).filter(Boolean);
    const obs=noteField('observations');
    return [
      '*NOTA DE REMISIÓN · NEXTLI*',
      'Folio: '+noteField('folio'),
      'Fecha: '+noteField('date'),
      '',
      '*DATOS DEL TUTOR*',
      noteField('owner'),
      noteField('phone'),
      noteField('address'),
      '',
      '*DATOS DEL COMPAÑERO*',
      noteField('pet'),
      noteField('species'),
      noteField('weight'),
      'Fecha de defunción: '+noteField('death'),
      '',
      '*SERVICIO / PERSONALIZACIÓN*',
      ...rows,
      '',
      '*FRASE / OBSERVACIONES*',
      obs||'—',
      '',
      'Subtotal: '+noteField('subtotal'),
      'Anticipo: '+noteField('deposit'),
      '*TOTAL A PAGAR: '+noteField('total')+' MXN*',
      '',
      'NEXTLI · Cremación de Mascotas con Amor en México'
    ].join('\n');
  }
  function shareNote(){
    if(!workerMode)return;
    const phone=normalizePhone(val('ownerPhone'));
    if(!/^\d{11,15}$/.test(phone)){alert('Revisa el teléfono del cliente.');return;}
    const message=noteWhatsAppText();
    const url='https://wa.me/'+phone+'?text='+encodeURIComponent(message);
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(!opened)window.location.href=url;
  }
  openBtn.addEventListener('click',openNote);
  $('closeRemissionNote').addEventListener('click',closeNote);$('cancelRemissionNote').addEventListener('click',closeNote);
  $('downloadRemissionNote').addEventListener('click',downloadNote);$('whatsappRemissionNote').addEventListener('click',shareNote);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeNote();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))closeNote();});
})();


/* ---------- Guardado automático del progreso / reanudación (solo trabajador) ---------- */
(function initProgressAutosave(){
  const KEY='nextli-progress-v3',TTL=5*60*1000;
  const status=$('progressSaveStatus');
  let saveTimer=null,expiryTimer=null,restoring=false,restored=false;
  function setStatus(msg){if(status)status.textContent=msg;}
  function removeExpired(){
    try{const data=JSON.parse(localStorage.getItem(KEY)||'null');if(!data||!data.savedAt||Date.now()-Number(data.savedAt)>=TTL){localStorage.removeItem(KEY);return true;}}catch(e){try{localStorage.removeItem(KEY);}catch(_){}return true;}return false;
  }
  function armExpiry(savedAt){
    clearTimeout(expiryTimer);const remaining=TTL-(Date.now()-Number(savedAt||0));
    if(remaining<=0){try{localStorage.removeItem(KEY);}catch(e){}return;}
    expiryTimer=setTimeout(()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'null');if(data&&data.savedAt&&Date.now()-Number(data.savedAt)>=TTL)localStorage.removeItem(KEY);}catch(e){try{localStorage.removeItem(KEY);}catch(_){}}},remaining);
  }
  function capture(){
    const fields={};
    document.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>{
      if(el.type==='checkbox'||el.type==='radio')fields[el.id]={checked:!!el.checked};
      else fields[el.id]={value:el.value};
    });
    return {version:3,workerMode:true,savedAt:Date.now(),state:JSON.parse(JSON.stringify(state)),fields,
      step:+document.querySelector('.step-panel.active')?.dataset.step||1,
      appReady:document.body.classList.contains('app-ready'),extraNoteText,clientMessageOverride,
      noteEdits:nextliNoteEditDraft,noteFolio:nextliSavedNoteFolio};
  }
  function saveNow(manual=false){
    if(restoring||!workerMode)return;
    try{
      const data=capture();localStorage.setItem(KEY,JSON.stringify(data));armExpiry(data.savedAt);
      setStatus(manual?'✓ Progreso guardado manualmente. Se conservará durante 5 minutos.':'✓ Progreso guardado automáticamente (5 minutos)');
    }catch(e){setStatus('No se pudo guardar el progreso en este navegador');}
  }
  function scheduleSave(){
    if(restoring||!workerMode)return;
    setStatus('Guardando progreso…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow(false),300);
  }
  function restore(){
    if(restored||!workerMode)return;
    let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){data=null;}
    if(!data||data.version!==3||data.workerMode!==true){setStatus('');return;}
    if(!data.savedAt||Date.now()-Number(data.savedAt)>=TTL){try{localStorage.removeItem(KEY);}catch(e){}setStatus('El progreso guardado ya venció (5 minutos).');return;}
    restoring=true;restored=true;armExpiry(data.savedAt);
    try{
      if(data.state&&typeof data.state==='object')Object.assign(state,data.state);
      if(!state.extraQuantities||typeof state.extraQuantities!=='object')state.extraQuantities={};
      Object.entries(data.fields||{}).forEach(([id,v])=>{const el=$(id);if(!el||!v)return;if(el.type==='checkbox'||el.type==='radio')el.checked=!!v.checked;else if(typeof v.value==='string')el.value=v.value;});
      extraNoteText=typeof data.extraNoteText==='string'?data.extraNoteText:'';
      clientMessageOverride=typeof data.clientMessageOverride==='string'?data.clientMessageOverride:'';
      nextliNoteEditDraft=data.noteEdits&&typeof data.noteEdits==='object'?data.noteEdits:{};
      nextliSavedNoteFolio=typeof data.noteFolio==='string'?data.noteFolio:'';
      document.querySelectorAll('[data-service]').forEach(el=>el.classList.toggle('selected',el.dataset.service===state.service));
      document.querySelectorAll('[data-frame]').forEach(el=>el.classList.toggle('selected',el.dataset.frame===state.frame));
      document.querySelectorAll('[data-color]').forEach(el=>el.classList.toggle('selected',el.dataset.color===state.color));
      $('paymentOther').style.display=state.paymentStatus==='Otro'?'block':'none';
      $('petColorOther').style.display=state.petColor==='Otro'?'block':'none';
      updatePetFlow();applyServiceUI();renderUrns();refreshExtraCards();renderExtras();updateTotal();updatePayNote();
      const step=Math.min(5,Math.max(1,Number(data.step)||1));if(step===5)renderSummary();goTo(step);
      setStatus('✓ Progreso recuperado (caduca a los 5 minutos)');
    }catch(e){console.warn('NEXTLI: no se pudo restaurar el progreso',e);}
    finally{restoring=false;}
  }
  // La recuperación se espera hasta que el trabajador desbloquee el modo.
  try{const existing=JSON.parse(localStorage.getItem(KEY)||'null');if(existing&&existing.savedAt)armExpiry(existing.savedAt);}catch(e){}
  progressControls={restore,saveNow:()=>saveNow(true)};
  if(workerMode)restore();
  $('saveProgressNow')?.addEventListener('click',()=>saveNow(true));
  document.addEventListener('input',scheduleSave,true);
  document.addEventListener('change',scheduleSave,true);
  document.addEventListener('click',e=>{if(e.target.closest('#saveProgressNow,#toggleWeightRanges,#saveWeightRanges'))return;setTimeout(scheduleSave,0);},true);
  document.addEventListener('input',e=>{const el=e.target;if(el&&el.matches&&el.matches('[data-note-edit]'))nextliNoteEditDraft[el.dataset.noteEdit]=el.innerText;},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveNow(false);else scheduleSave();});
  window.addEventListener('pagehide',()=>saveNow(false));
  window.addEventListener('beforeunload',()=>saveNow(false));
  window.addEventListener('pageshow',()=>{if(workerMode&&!restoring)scheduleSave();});
  document.querySelectorAll('[data-service],[data-frame],[data-color]').forEach(el=>el.addEventListener('click',()=>setTimeout(scheduleSave,0)));
})();
