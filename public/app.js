/* ============================================================
   NEXTLI · Configurador (cliente + Modo Trabajador)
   Depende de: config.js, certificate.js, inventory.js
   ============================================================ */
const CFG = window.NEXTLI_CONFIG || {};
const INV = window.NextliInventory;
const CERT = window.NextliCertificate;
const IMAGE_BASE = CFG.IMAGE_BASE || 'https://nextli-personaliza-despedida.vercel.app/images/';
const WA_NUMBER = CFG.WA_NUMBER || '525521889698';

const SIZE_LABEL = { chico: 'Chico (0–10 kg)', mediano: 'Mediano (11–25 kg)', grande: 'Grande (26–45 kg)', xl: 'Extra grande (+45 kg)' };
const breedSize = { Chihuahueño: 'chico', Poodle: 'chico', Pug: 'chico', Schnauzer: 'chico', Yorkshire: 'chico', Beagle: 'chico', Bulldog: 'mediano', Cocker: 'mediano', 'Golden Retriever': 'grande', Labrador: 'grande', 'Pastor Alemán': 'grande', 'Gran Danés': 'xl', Husky: 'grande' };
const catSize = { Siamés: 'chico', Persa: 'chico', 'Maine Coon': 'mediano', Ragdoll: 'chico', Bengalí: 'chico', 'Británico de pelo corto': 'chico' };

let workerMode = false, logoTaps = 0, workerUnlockArmed = false, workerUnlockTimer = null;
const WORKER_UNLOCK_WINDOW = 3000;
let state = { extraQuantities: {}, service: null, species: '', otherSpecies: '', breed: '', weight: '', weightConfirmed: false, urnId: null, plus: false, huella: false, cert: false, plusQty: 0, huellaQty: 0, certQty: 0, petColor: '', petColorOther: '', color: 'Plateado', frame: 'Plateado', plusMessage: '', vinylExtraColor: 'Plateado', paymentStatus: 'No pagado', paymentOther: '' };

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
    if (x.id === 'vinilo-personalizado') {
      const config = document.createElement('div');
      config.className = 'personalization-config';
      config.dataset.vinylExtraConfig = '';
      config.hidden = true;
      config.innerHTML = '<h6>Personaliza el color del vinilo</h6><div class="urn-preview-shell"><img src="/images/urn-sample.webp" alt="Urna de muestra con diseño de vinilo premium" loading="lazy"><div class="vinyl-tint" data-vinyl-tint aria-hidden="true"></div></div><div class="vinyl-colors" role="group" aria-label="Color del vinilo del complemento">' + ['Plateado','Blanco','Negro','Dorado'].map(color => '<button type="button" class="color-swatch ' + (color === state.vinylExtraColor ? 'selected' : '') + '" data-vinyl-extra-color="' + color + '" aria-pressed="' + (color === state.vinylExtraColor) + '">' + color + '</button>').join('') + '</div>';
      c.querySelector('.pcard-body').appendChild(config);
      config.querySelectorAll('[data-vinyl-extra-color]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        state.vinylExtraColor = b.dataset.vinylExtraColor;
        updatePersonalizationPreviews();
        refreshExtraCards();
      }));
    }
    const tog = () => toggleExtra(x.id);
    c.onclick = e => { if (e.target.closest('[data-qty-change],[data-vinyl-extra-color]')) return; tog(); };
    c.querySelectorAll('[data-qty-change]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); changeExtraQty(x.id, Number(b.dataset.qtyChange)); }));
    c.onkeydown = e => { if (!e.target.closest('[data-qty-change],[data-vinyl-extra-color]')) cardKey(e, tog); };
    track.appendChild(c);
  });
  track.scrollLeft = left; extrasDirty = false; updatePersonalizationPreviews();
}
function extraQty(id) { return Math.max(0, Math.floor(Number(state.extraQuantities?.[id] ?? state[id + 'Qty']) || 0)); }
function setExtraQty(id, qty) {
  const x = getExtra(id); if (!x || x.soldOut) { if (x && x.soldOut) INV.toast('Este detalle está agotado por ahora.'); return; }
  const max = x.id === 'vinilo-personalizado' ? 1 : (Number.isFinite(x.stock) ? Math.max(0, x.stock) : 99);
  const next = Math.max(0, Math.min(max, 99, Math.floor(Number(qty) || 0)));
  state.extraQuantities = state.extraQuantities || {}; state.extraQuantities[id] = next;
  if (['plus','huella','cert'].includes(id)) state[id + 'Qty'] = next;
  state[id] = next > 0;
  refreshExtraCards(); updatePersonalizationPreviews(); updateTotal();
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
    const config = c.querySelector('[data-vinyl-extra-config]'); if (config) config.hidden = !(qty > 0);
    c.querySelectorAll('[data-vinyl-extra-color]').forEach(b => { const selected = b.dataset.vinylExtraColor === state.vinylExtraColor; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
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
  return [...INV.extras().filter(x => extraQty(x.id) > 0).map(x => `${extraQty(x.id)}x ${x.name} (+${money(extraQty(x.id) * x.price)} MXN)`), state.plus ? `Color del marco incluido: ${state.frame}` : null, state.plus ? `Vinilo premium de la urna incluida: ${state.color}` : null, state.plus && state.plusMessage.trim() ? `Mensaje personalizado: ${state.plusMessage.trim()}` : null, extraQty('vinilo-personalizado') > 0 ? `Color del vinilo del complemento: ${state.vinylExtraColor}` : null].filter(Boolean);
}
function colorHex(color) { return ({ Plateado: '#aeb4bd', Blanco: '#f7f5ef', Negro: '#171719', Dorado: '#c69a45' })[color] || '#aeb4bd'; }
function updatePersonalizationPreviews() {
  const frameTint = $('plusFrameTint');
  if (frameTint) { frameTint.style.backgroundColor = colorHex(state.frame); frameTint.style.mixBlendMode = state.frame === 'Blanco' ? 'screen' : 'multiply'; }
  const plusTint = $('plusUrnTint');
  if (plusTint) plusTint.style.backgroundColor = colorHex(state.color);
  document.querySelectorAll('[data-vinyl-tint]').forEach(layer => {
    layer.style.backgroundColor = colorHex(state.vinylExtraColor);
  });
  document.querySelectorAll('[data-frame-color]').forEach(b => { const on=b.dataset.frameColor===state.frame;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on)); });
  document.querySelectorAll('[data-color]').forEach(b => { const on=b.dataset.color===state.color;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on)); });
  document.querySelectorAll('[data-vinyl-extra-color]').forEach(b => { const on=b.dataset.vinylExtraColor===state.vinylExtraColor;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on)); });
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
      `*Tamaño / peso:* ${SIZE_LABEL[state.weight] || '—'}`,
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
*Color:* ${petColorLabel()}
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
  const urn = getUrn(state.urnId), plus = getExtra('plus'), vinyl = getExtra('vinilo-personalizado');
  const colorSelect = (field, label, selected) => `<div class="summary-line summary-edit-line"><span>${label}</span><select data-summary-field="${field}" aria-label="${label}">${['Plateado','Blanco','Negro','Dorado'].map(c => `<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('')}</select></div>`;
  const plusLines = state.plus ? line('Paquete Plus', `${plus?.name || 'Paquete Plus'} (+${money((plus?.price || 0) * extraQty('plus'))} MXN)`) + line('Cuadro con fotografía y marco', 'Incluido') + colorSelect('frame','Color del marco',state.frame) + colorSelect('color','Vinilo premium de la urna',state.color) + `<div class="summary-edit-message"><label for="summaryPlusMessage">Mensaje personalizado (máximo 60 caracteres)</label><textarea id="summaryPlusMessage" data-summary-field="plusMessage" maxlength="60" rows="2">${esc(state.plusMessage)}</textarea><small><span id="summaryPlusCount">${Array.from(state.plusMessage).length}</span>/60 caracteres</small></div>` : '';
  const vinylLines = extraQty('vinilo-personalizado') > 0 ? line('Complemento extra', `${vinyl?.name || 'Personalización de vinil'} (+${money((vinyl?.price || 100) * extraQty('vinilo-personalizado'))} MXN)`) + colorSelect('vinylExtraColor','Color del vinilo del complemento',state.vinylExtraColor) : '';
  const otherExtras = INV.extras().filter(x => !['plus','vinilo-personalizado'].includes(x.id) && extraQty(x.id) > 0).map(x => line('Complemento', `${extraQty(x.id)}x ${x.name} (+${money(extraQty(x.id) * x.price)} MXN)`)).join('');
  $('summaryBox').innerHTML = `<div class="summary-box"><h4>Resumen de tu solicitud</h4>${line('Servicio', isCom() ? 'Cremación Comunitaria' : 'Cremación Individual')}${line('Mascota', val('petName'))}${line('Especie / raza', speciesLabel() + (state.breed ? ' / ' + state.breed : ''))}${line('Color', petColorLabel())}${line('Tamaño / peso', SIZE_LABEL[state.weight] || '—')}${isCom() ? '' : line('Urna', urn?.name || '—')}${plusLines}${vinylLines}${otherExtras}${line('Propietario', val('ownerName'))}<div class="summary-line summary-edit-line"><span>Teléfono del cliente</span><input data-summary-field="ownerPhone" type="tel" inputmode="tel" value="${esc(val('ownerPhone'))}" aria-label="Teléfono del cliente"></div>${line('Dirección', val('ownerAddress'))}${workerMode ? line('Pago', paymentLabel()) + line('Saldo pendiente', money(paymentInfo().balance) + ' MXN') : ''}<div class="summary-total"><span>Total estimado</span><span>${money(total())} MXN</span></div></div>`;
  $('summaryBox').querySelectorAll('[data-summary-field]').forEach(control => {
    const update = () => {
      const field = control.dataset.summaryField, value = control.value;
      if (field === 'plusMessage') {
        const chars = typeof Intl !== 'undefined' && Intl.Segmenter ? Array.from(new Intl.Segmenter('es',{granularity:'grapheme'}).segment(value),part=>part.segment).slice(0,60) : Array.from(value).slice(0,60);
        state.plusMessage = chars.join('');
        if (control.value !== state.plusMessage) control.value = state.plusMessage;
        const original = $('plusMessage'); if (original) original.value = state.plusMessage;
        const count = $('summaryPlusCount'); if (count) count.textContent = String(chars.length);
        const originalCount = $('plusMessageCount'); if (originalCount) originalCount.textContent = chars.length + '/60 caracteres';
      } else if (field === 'ownerPhone') {
        $('ownerPhone').value = value.replace(/[^0-9+()\s-]/g,'').slice(0,20);
        control.value = $('ownerPhone').value;
      } else {
        state[field] = value;
        updatePersonalizationPreviews();
      }
      $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage('cliente'));
    };
    control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', update);
  });
  $('sendWa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage('cliente'));
}
function requiredOk() {
  const ids = ['petName', 'petAge', 'petDate', 'ownerName', 'ownerPhone', 'ownerAddress'];
  return hasValidSelection() && state.species && state.weight && state.petColor && (state.petColor !== 'Otro' || state.petColorOther.trim()) && ids.every(id => val(id) !== '—') && (state.species !== 'otro' || state.otherSpecies.trim()) && (state.species === 'otro' || !!state.breed);
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
  if (isCom()) { state.plus = state.huella = state.cert = false; state.plusQty = state.huellaQty = state.certQty = 0; state.extraQuantities = {}; refreshExtraCards(); }
  applyServiceUI(); renderUrns(); goTo(2);
});
document.querySelectorAll('[data-wa-text]').forEach(b => b.onclick = () => window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(b.dataset.waText), '_blank'));
$('species').onchange = e => {
  state.species = e.target.value; state.breed = ''; state.otherSpecies = ''; state.weight = ''; state.weightConfirmed = false; state.urnId = null; $('breed').value = ''; $('catBreed').value = ''; $('weightRange').value = ''; updatePetFlow(); autoWeight();
};
$('otherSpecies').oninput = e => { state.otherSpecies = e.target.value; updatePetFlow(); if (state.species === 'otro') { state.weight = ''; state.weightConfirmed = false; $('weightRange').value = ''; } };
$('breed').onchange = e => { state.breed = e.target.value; autoWeight(); };
$('catBreed').onchange = e => { state.breed = e.target.value; autoWeight(); };
$('weightRange').onchange = e => {
  state.weight = e.target.value; state.weightConfirmed = false; updatePetFlow();
  const u = getUrn(state.urnId);
  if (!u || !u.prices[state.weight]) state.urnId = null;
  renderUrns(); applyServiceUI();
};
$('manualWeightBtn').onclick = () => { $('weightRange').focus(); };
$('confirmWeightBtn').onclick = () => { if (!state.weight) return; state.weightConfirmed = true; updatePetFlow(); applyServiceUI(); };
$('next2').onclick = () => goTo(isCom() ? 4 : 3);
document.querySelectorAll('[data-frame-color]').forEach(x => x.onclick = () => { document.querySelectorAll('[data-frame-color]').forEach(y => { y.classList.remove('selected'); y.setAttribute('aria-pressed','false'); }); x.classList.add('selected'); x.setAttribute('aria-pressed','true'); state.frame = x.dataset.frameColor; updatePersonalizationPreviews(); });
document.querySelectorAll('[data-color]').forEach(x => x.onclick = () => { document.querySelectorAll('[data-color]').forEach(y => { y.classList.remove('selected'); y.setAttribute('aria-pressed','false'); }); x.classList.add('selected'); x.setAttribute('aria-pressed','true'); state.color = x.dataset.color; updatePersonalizationPreviews(); });
$('plusMessage').oninput = e => {
  const raw = String(e.target.value || '');
  const parts = typeof Intl !== 'undefined' && Intl.Segmenter
    ? Array.from(new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(raw), part => part.segment)
    : Array.from(raw);
  state.plusMessage = parts.slice(0,60).join('');
  if (e.target.value !== state.plusMessage) e.target.value = state.plusMessage;
  $('plusMessageCount').textContent = `${parts.length > 60 ? 60 : parts.length}/60 caracteres`;
};
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
  if (phone.length < 10) { alert('Revisa el teléfono del cliente: parece incompleto.'); return; }
  if (!confirm('Vas a enviar el resumen a ' + val('ownerName') + ' al número +' + phone + '. ¿Es el teléfono del cliente?')) return;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(buildMessage('recibo')), '_blank');
  generateCertificate();
};
$('downloadCertificate').onclick = generateCertificate;
$('downloadRemision').onclick = downloadRemisionPdf;

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
let remisionCanvas = null;
function buildRemisionCanvas() {
  const canvas=document.createElement('canvas'); canvas.width=1600; canvas.height=1237;
  const ctx=canvas.getContext('2d'), ink='#17263a', muted='#687386', gold='#b8944d', paper='#fbf8f0';
  ctx.fillStyle=paper;ctx.fillRect(0,0,1600,1237);
  ctx.fillStyle=ink;ctx.font='bold 54px Georgia';ctx.fillText('NEXTLI',90,105);
  ctx.font='24px Arial';ctx.fillStyle=muted;ctx.fillText('SERVICIOS FUNERARIOS · ACOMPAÑAMIENTO CON AMOR',92,145);
  ctx.textAlign='right';ctx.font='bold 42px Georgia';ctx.fillStyle=ink;ctx.fillText('NOTA DE REMISIÓN',1510,105);
  ctx.font='22px Arial';ctx.fillStyle=muted;ctx.fillText(nowStamp(),1510,145);ctx.textAlign='left';
  ctx.fillStyle=gold;ctx.fillRect(90,180,1420,4);
  ctx.font='bold 25px Arial';ctx.fillStyle=ink;ctx.fillText('DATOS DEL SERVICIO',90,238);
  ctx.font='22px Arial';ctx.fillStyle=muted;
  ctx.fillText('Mascota: '+val('petName'),90,286);
  ctx.fillText('Especie / raza: '+speciesLabel()+(state.breed?' / '+state.breed:''),90,326);
  ctx.fillText('Servicio: '+(isCom()?'Cremación comunitaria':'Cremación individual'),90,366);
  ctx.fillText('Tamaño / peso: '+(SIZE_LABEL[state.weight]||'—'),90,406);
  ctx.fillText('Propietario: '+val('ownerName'),850,286);ctx.fillText('Teléfono: '+val('ownerPhone'),850,326);
  ctx.fillText('Dirección: '+val('ownerAddress'),850,366);ctx.fillText('Fecha de defunción: '+fmtDate(),850,406);
  ctx.fillStyle=gold;ctx.fillRect(90,445,1420,2);ctx.font='bold 25px Arial';ctx.fillStyle=ink;ctx.fillText('CONCEPTOS Y PERSONALIZACIÓN',90,500);
  let y=552;
  const drawRow=(label,amount,sub=false)=>{
    ctx.font=sub?'19px Arial':'bold 22px Arial';ctx.fillStyle=sub?muted:ink;
    const max=amount?1120:1390,words=String(label).split(/\s+/);let line='';
    for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>max&&line){ctx.fillText(line,sub?125:90,y);y+=sub?27:30;line=word;}else line=test;}
    if(line)ctx.fillText(line,sub?125:90,y);
    if(amount){ctx.textAlign='right';ctx.fillText(amount,1510,y);ctx.textAlign='left';}y+=sub?34:46;
  };
  if(isCom())drawRow('Cremación comunitaria',money(calcBase())+' MXN');
  else{const urn=getUrn(state.urnId);drawRow(urn?.name||'Urna seleccionada',money(calcBase())+' MXN');}
  if(state.plus){const plus=getExtra('plus');drawRow('Paquete Plus — cuadro con fotografía y marco incluido',money((plus?.price||0)*extraQty('plus'))+' MXN');drawRow('Color del marco: '+state.frame,'',true);drawRow('Color del vinilo premium de la urna: '+state.color,'',true);if(state.plusMessage.trim())drawRow('Mensaje personalizado: '+state.plusMessage.trim(),'',true);}
  INV.extras().filter(x=>!['plus','vinilo-personalizado'].includes(x.id)&&extraQty(x.id)>0).forEach(x=>drawRow(extraQty(x.id)+' × '+x.name,money(extraQty(x.id)*x.price)+' MXN'));
  if(extraQty('vinilo-personalizado')>0){const vinyl=getExtra('vinilo-personalizado');drawRow('Complemento: Personalización de vinil',money((vinyl?.price||100)*extraQty('vinilo-personalizado'))+' MXN');drawRow('Color del vinilo del complemento: '+state.vinylExtraColor,'',true);}
  ctx.fillStyle=gold;ctx.fillRect(90,Math.min(y+12,1080),1420,3);const totalY=Math.min(y+72,1130);
  ctx.font='bold 32px Arial';ctx.fillStyle=ink;ctx.fillText('TOTAL',90,totalY);ctx.textAlign='right';ctx.fillText(money(total())+' MXN',1510,totalY);ctx.textAlign='left';
  ctx.font='italic 20px Georgia';ctx.fillStyle=muted;ctx.fillText('Gracias por permitirnos honrar la vida de tu compañero. Estamos contigo.',90,1205);
  return canvas;
}
function closeRemisionPreview(){const o=$('remisionPreview');if(!o)return;o.classList.remove('open');o.setAttribute('aria-hidden','true');$('remisionPreviewMount').innerHTML='';remisionCanvas=null;}
async function generateRemisionPreview(){
  if(!workerMode){alert('La nota de remisión la genera el equipo NEXTLI.');return;}
  if(!requiredOk()){alert('Completa primero todos los datos obligatorios.');return;}
  const overlay=$('remisionPreview'),mount=$('remisionPreviewMount');mount.innerHTML='<div class="cert-loading" style="padding:30px;text-align:center">Preparando la nota de remisión…</div>';overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  try{remisionCanvas=buildRemisionCanvas();mount.innerHTML='';const wrap=document.createElement('div');wrap.className='remision-canvas-wrap';wrap.appendChild(remisionCanvas);mount.appendChild(wrap);}
  catch(e){console.error(e);mount.textContent='No se pudo preparar la nota. Inténtalo de nuevo.';}
}
async function createRemisionFile(){
  if(!remisionCanvas)remisionCanvas=buildRemisionCanvas();
  const blob=await CERT.toPdfBlob(remisionCanvas,'Nota de remision NEXTLI');
  if(!(blob instanceof Blob)||blob.type!=='application/pdf'||blob.size<1000)throw new Error('El PDF generado no es válido.');
  return new File([blob],'Nota-Remision-'+safe(val('petName'))+'-'+safe(val('ownerName'))+'.pdf',{type:'application/pdf'});
}
async function downloadRemisionPdf(){
  if(!workerMode)return;const btn=$('downloadRemisionPdfPreview');if(btn)btn.disabled=true;
  try{const file=await createRemisionFile(),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  catch(e){console.error(e);alert('No se pudo generar un PDF válido. Vuelve a abrir la vista previa e inténtalo otra vez.');}
  finally{if(btn)btn.disabled=false;}
}
async function sendRemisionToClient(){
  if(!workerMode)return;const btn=$('sendRemisionToClient');btn.disabled=true;
  try{
    const phone=normalizePhone(val('ownerPhone'));if(!/^52\d{10}$|^\d{11,15}$/.test(phone)){alert('Revisa el teléfono del cliente antes de compartir la nota.');return;}
    const file=await createRemisionFile(),textMessage=buildMessage('recibo');
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:'Nota de remisión NEXTLI',text:textMessage});
    else{
      const url='https://wa.me/'+phone+'?text='+encodeURIComponent(textMessage+'\n\nTe comparto la nota de remisión en PDF. Adjuntaré el archivo en este chat.');
      const blobUrl=URL.createObjectURL(file),a=document.createElement('a');a.href=blobUrl;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);window.location.href=url;
      alert('Se descargó el PDF y se abrió el chat del cliente. Adjunta el archivo descargado en WhatsApp para enviarlo.');
    }
  }catch(e){if(e&&e.name!=='AbortError'){console.error(e);alert('No se pudo compartir la nota PDF. Puedes descargarla y adjuntarla manualmente.');}}
  finally{btn.disabled=false;}
}
$('downloadRemision').onclick=generateRemisionPreview;

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
$('closeRemisionPreview').onclick = closeRemisionPreview;
$('cancelRemisionPreview').onclick = closeRemisionPreview;
$('downloadRemisionPdfPreview').onclick = downloadRemisionPdf;
$('sendRemisionToClient').onclick = sendRemisionToClient;
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
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function(err) {
        console.warn('NEXTLI: no se pudo registrar el modo sin conexión.', err);
      });
    });
  }
})();
