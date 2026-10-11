/* ============================================================
   NEXTLI · Configurador (cliente + Modo Trabajador)
   Depende de: config.js, certificate.js, inventory.js
   ============================================================ */
const CFG = window.NEXTLI_CONFIG || {};
const INV = window.NextliInventory;
const CERT = window.NextliCertificate;
const IMAGE_BASE = CFG.IMAGE_BASE || 'https://nextli-stroks15s-projects.vercel.app/images/';
const WA_NUMBER = CFG.WA_NUMBER || '525521889698';
const NEXTLI_GROUP = CFG.GROUP_URL || 'https://chat.whatsapp.com/KBc1dBIEJQHCoBTmrG96mi?s=cl&p=a&mlu=4&ilr=4';

const SIZE_LABEL = { chico: 'Chico (0–10 kg)', mediano: 'Mediano (11–25 kg)', grande: 'Grande (26–45 kg)', xl: 'Extra grande (+45 kg)' };
const breedSize = { Chihuahueño: 'chico', Poodle: 'chico', Pug: 'chico', Schnauzer: 'chico', Yorkshire: 'chico', Beagle: 'chico', Bulldog: 'mediano', Cocker: 'mediano', 'Golden Retriever': 'grande', Labrador: 'grande', 'Pastor Alemán': 'grande', 'Gran Danés': 'xl', Husky: 'grande' };
const catSize = { Siamés: 'chico', Persa: 'chico', 'Maine Coon': 'mediano', Ragdoll: 'chico', Bengalí: 'chico', 'Británico de pelo corto': 'chico' };

let workerMode = false, logoTaps = 0, workerUnlockArmed = false, workerUnlockTimer = null;
const WORKER_UNLOCK_WINDOW = 3000;
let state = { service: null, species: '', otherSpecies: '', breed: '', weight: '', urnId: null, plus: false, huella: false, cert: false, color: '', frame: '', paymentStatus: 'No pagado', paymentOther: '' };

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
function hasValidSelection() { return isCom() ? !!(state.weight && comPrice()[state.weight]) : hasValidUrn(); }
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
      : 'Desde ' + money(Math.min(...sizes)) + ' <small>MXN</small>';
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
  $('urnPickerWrap').style.display = com ? 'none' : '';
  const note = $('comNote');
  if (com) {
    const p = state.weight && comPrice()[state.weight];
    note.style.display = 'block';
    note.textContent = !state.weight ? 'En la cremación comunitaria no se recupera la urna. Elige su peso para ver el valor.'
      : p ? `Valor del servicio comunitario: ${money(p)} MXN.` : 'Para mascotas de más de 45 kg, escríbenos y te ayudamos con gusto a coordinar el servicio.';
  } else note.style.display = 'none';
  syncUrnControls();
}

function autoWeight() {
  const s = state.species === 'perro' ? breedSize[state.breed] : state.species === 'gato' ? catSize[state.breed] : null;
  if (s) { state.weight = s; $('weightRange').value = s; $('manualWeightAction').style.display = 'block'; }
  else { $('manualWeightAction').style.display = 'none'; }
  const u = getUrn(state.urnId);
  if (!u || !state.weight || !u.prices[state.weight] || u.soldOut) state.urnId = null;
  renderUrns();
  applyServiceUI();
}

/* ---------- Complementos ---------- */
let extrasDirty = true;
function buildExtraCards() {
  const track = $('extrasTrack'); const left = track.scrollLeft; track.innerHTML = '';
  INV.extras().forEach(x => {
    const c = document.createElement('div');
    c.className = 'pcard'; c.dataset.id = x.id; c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.innerHTML = `<div class="pcard-media"><span class="pcard-badge" hidden>Agotado por ahora</span><img src="${esc(x.img)}" alt="${esc(x.name)}" loading="lazy" decoding="async"></div>
      <div class="pcard-body"><p class="pcard-eyebrow">${esc(x.eyebrow)}</p><h5>${esc(x.name)}</h5><p class="pcard-desc">${esc(x.desc)}</p>
      <div class="pcard-price">+${money(x.price)} <small>MXN</small></div><button type="button" class="pcard-cta" tabindex="-1"></button></div>`;
    localizeImg(c.querySelector('img'));
    const tog = () => toggleExtra(x.id);
    c.onclick = tog; c.onkeydown = e => cardKey(e, tog);
    track.appendChild(c);
  });
  track.scrollLeft = left; extrasDirty = false;
}
function refreshExtraCards() {
  INV.extras().forEach(x => {
    if (x.soldOut && state[x.id]) state[x.id] = false;
    const c = $('extrasTrack').querySelector(`[data-id="${x.id}"]`); if (!c) return;
    c.classList.toggle('added', !!state[x.id]);
    c.classList.toggle('soldout', x.soldOut);
    c.querySelector('.pcard-badge').hidden = !x.soldOut;
    c.querySelector('.pcard-cta').textContent = state[x.id] ? 'Agregado ✓' : 'Agregar';
    c.setAttribute('aria-pressed', state[x.id] ? 'true' : 'false');
  });
  $('frameWrap').style.display = state.plus ? 'block' : 'none';
  $('colorWrap').style.display = state.plus ? 'block' : 'none';
}
function toggleExtra(id) {
  const x = getExtra(id);
  if (x.soldOut) { INV.toast('Este detalle está agotado por ahora.'); return; }
  state[id] = !state[id];
  if (id === 'plus' && !state.plus) {
    state.frame = ''; state.color = '';
    document.querySelectorAll('[data-frame],[data-color]').forEach(y => y.classList.remove('selected'));
  }
  refreshExtraCards(); updateTotal();
}
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
function total() { return calcBase() + (state.plus ? extraPrice('plus') : 0) + (state.huella ? extraPrice('huella') : 0) + (state.cert ? extraPrice('cert') : 0); }
function updateTotal() { $('runningTotal3').textContent = 'Total: ' + money(total()) + ' MXN'; updatePayNote(); }
function extrasList() {
  if (isCom()) return [];
  return [
    state.plus ? `Paquete Plus — Homenaje completo (+${money(extraPrice('plus'))} MXN)` : null,
    state.huella ? `Huella con pelo de mascota (+${money(extraPrice('huella'))} MXN)` : null,
    state.cert ? `Certificado físico adicional (+${money(extraPrice('cert'))} MXN)` : null,
    state.plus && state.frame ? `Marco: ${state.frame}` : null,
    state.plus && state.color ? `Vinilo: ${state.color}` : null
  ].filter(Boolean);
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
  const breedTxt = state.breed ? ' / ' + state.breed : '';

  if (audience === 'grupo') {
    const p = paymentInfo();
    const lines = [
      '*🐾 NUEVA ORDEN — GRUPO NEXTLI*',
      `_Capturada en Modo Trabajador · ${nowStamp()}_`,
      '------------------------------',
      '*SERVICIO*',
      `*Servicio:* ${serviceName}`,
      ...(isCom() ? [] : [`*Urna:* ${urn?.name || '—'}`]),
      `*Tamaño / peso:* ${SIZE_LABEL[state.weight] || '—'}`,
      `*Adicionales:* ${ex.length ? '' : 'Ninguno'}`,
      ...ex.map(x => `   • ${x}`),
      '',
      '*MASCOTA*',
      `*Nombre:* ${val('petName')}`,
      `*Especie / raza:* ${speciesLabel()}${breedTxt}`,
      `*Edad:* ${val('petAge')}`,
      `*Fecha de defunción:* ${fmtDate()}`,
      `*Frase:* ${val('farewellPhrase')}`,
      '',
      '*CLIENTE*',
      `*Propietario:* ${val('ownerName')}`,
      `*Teléfono:* ${val('ownerPhone')}`,
      `*Dirección:* ${val('ownerAddress')}`
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
*Edad:* ${val('petAge')}
${isCom() ? '' : `*Urna:* ${urn?.name || '—'}\n`}*Tamaño / peso:* ${SIZE_LABEL[state.weight] || '—'}
*Adicionales:* ${ex.join(', ') || 'Ninguno'}
*Total estimado:* ${money(total())} MXN

*DATOS DEL CLIENTE*
*Propietario:* ${val('ownerName')}
*Teléfono:* ${val('ownerPhone')}
*Dirección:* ${val('ownerAddress')}
*Fecha de defunción:* ${fmtDate()}
*Frase:* ${val('farewellPhrase')}`;

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
  $('summaryBox').innerHTML = `<div class="summary-box"><h4>Resumen de tu solicitud</h4>${line('Servicio', isCom() ? 'Cremación Comunitaria' : 'Cremación Individual')}${line('Mascota', val('petName'))}${line('Especie / raza', speciesLabel() + (state.breed ? ' / ' + state.breed : ''))}${line('Tamaño / peso', SIZE_LABEL[state.weight] || '—')}${isCom() ? '' : line('Urna', urn?.name || '—')}${extrasList().map(x => line('Adicional', x)).join('')}${line('Propietario', val('ownerName'))}${line('Teléfono', val('ownerPhone'))}${line('Dirección', val('ownerAddress'))}${workerMode ? line('Pago', paymentLabel()) + line('Saldo pendiente', money(paymentInfo().balance) + ' MXN') : ''}<div class="summary-total"><span>Total estimado</span><span>${money(total())} MXN</span></div></div>`;
  $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage('cliente'));
}
function requiredOk() {
  const ids = ['petName', 'petAge', 'petDate', 'ownerName', 'ownerPhone', 'ownerAddress'];
  return hasValidSelection() && state.species && state.weight && ids.every(id => val(id) !== '—') && (state.species !== 'otro' || state.otherSpecies);
}

/* ---------- Modo Trabajador ---------- */
function activateWorker() {
  workerMode = true;
  document.body.classList.add('worker-mode');
  $('workerButton').textContent = 'Modo trabajador NEXTLI';
  $('workerPaymentWrap').style.display = 'block';
  workerUnlockArmed = false; logoTaps = 0; clearTimeout(workerUnlockTimer);
  updatePayNote();
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
  if (isCom()) { state.plus = state.huella = state.cert = false; state.frame = state.color = ''; refreshExtraCards(); }
  applyServiceUI(); renderUrns(); goTo(2);
});
document.querySelectorAll('[data-wa-text]').forEach(b => b.onclick = () => window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(b.dataset.waText), '_blank'));
$('species').onchange = e => {
  state.species = e.target.value; state.breed = ''; state.otherSpecies = '';
  $('breedField').style.display = state.species === 'perro' ? 'block' : 'none';
  $('catBreedField').style.display = state.species === 'gato' ? 'block' : 'none';
  $('otherSpeciesField').style.display = state.species === 'otro' ? 'block' : 'none';
  autoWeight();
};
$('otherSpecies').oninput = e => { state.otherSpecies = e.target.value; };
$('breed').onchange = e => { state.breed = e.target.value; autoWeight(); };
$('catBreed').onchange = e => { state.breed = e.target.value; autoWeight(); };
$('weightRange').onchange = e => {
  state.weight = e.target.value;
  const u = getUrn(state.urnId);
  if (!u || !u.prices[state.weight]) state.urnId = null;
  renderUrns(); applyServiceUI();
};
$('manualWeightBtn').onclick = () => { $('weightRange').focus(); };
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

/* ---------- Envío al Grupo NEXTLI (Modo Trabajador) ----------
   WhatsApp no deja prellenar texto en el enlace de un grupo. Por eso:
   1) se arma el mensaje COMPLETO del trabajador (incluye pago y saldo),
   2) se copia al portapapeles y se muestra para revisarlo,
   3) "Copiar y abrir Grupo" lo copia otra vez y abre el grupo para pegarlo.
   "Compartir…" usa el menú nativo del teléfono con el texto ya cargado. */
async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* respaldo */ }
  try {
    const ta = $('groupMsg'); const prevHidden = $('groupSheet').hidden;
    if (!prevHidden) { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); const ok = document.execCommand('copy'); ta.setSelectionRange(0, 0); return ok; }
  } catch (e) { /* nada */ }
  return false;
}
function closeGroupSheet() { $('groupSheet').hidden = true; }
$('sendGroupWa').onclick = () => {
  if (!workerMode) return;
  if (!requiredOk()) { alert('Completa primero todos los datos obligatorios para enviar la orden al grupo.'); return; }
  const ta = $('groupMsg'); ta.value = buildMessage('grupo');
  $('groupCopied').hidden = true; $('groupShare').hidden = !navigator.share;
  $('groupSheet').hidden = false;
  copyText(ta.value).then(ok => { $('groupCopied').hidden = !ok; });
};
$('groupCopy').onclick = async () => { const ok = await copyText($('groupMsg').value); $('groupCopied').hidden = !ok; if (!ok) INV.toast('No se pudo copiar. Mantén presionado el texto y elige “Copiar”.'); };
$('groupOpen').onclick = () => {
  const text = $('groupMsg').value;
  const p = copyText(text);
  const w = window.open(NEXTLI_GROUP, '_blank');
  if (!w) window.location.href = NEXTLI_GROUP;
  p.then(ok => { $('groupCopied').hidden = !ok; });
};
$('groupShare').onclick = async () => { try { await navigator.share({ text: $('groupMsg').value }); } catch (e) { /* cancelado */ } };
$('groupClose').onclick = closeGroupSheet;
$('groupSheet').addEventListener('mousedown', e => { if (e.target.id === 'groupSheet') closeGroupSheet(); });

$('sendClientWa').onclick = () => {
  if (!workerMode) return;
  if (!requiredOk()) { alert('Completa primero todos los datos obligatorios.'); return; }
  const phone = normalizePhone(val('ownerPhone'));
  if (phone.length < 10) { alert('Revisa el teléfono del cliente: parece incompleto.'); return; }
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(buildMessage('recibo')), '_blank');
  generateCertificate();
};
$('downloadCertificate').onclick = generateCertificate;

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
    breed: breedForCert(), age: val('petAge'),
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
    mount.innerHTML = ''; const wrap = document.createElement('div'); wrap.className = 'cert-canvas-wrap'; wrap.appendChild(certCanvas); mount.appendChild(wrap);
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
renderUrns(); renderExtras(); updatePriceLabels(); syncUrnControls(); updateTotal();
