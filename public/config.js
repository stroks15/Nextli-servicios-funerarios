/* NEXTLI · Configuración central (edita aquí contacto, firma del certificado y contraseña del panel) */
window.NEXTLI_CONFIG = {
  WA_NUMBER: '525521889698',
  GROUP_URL: 'https://chat.whatsapp.com/KBc1dBIEJQHCoBTmrG96mi?s=cl&p=a&mlu=4&ilr=4',
  IMAGE_BASE: 'https://nextli-stroks15s-projects.vercel.app/images/',
  DOCTOR: { name: 'Carlos Chávez', title: 'M.V.Z' },
  // Supabase: la clave publishable solo permite LEER; escribir exige la contraseña del panel.
  SUPABASE_URL: 'https://gzdoqxhvwiivwqmkxcem.supabase.co',
  SUPABASE_KEY: 'sb_publishable_QvTHUHAfwKdQ446LUc97sQ_z2ssLHDQ',
  // ----- Panel de inventario del Modo Trabajador -----

  // Respaldo offline: hash SHA-256 de la contraseña.

  // Para generar otro hash: nextliHash('nueva-contraseña')

  // Debe corresponder a la contraseña configurada en Supabase.

  ADMIN_PASSWORD_HASH: 'fe106380d6dcaf823a3f47452f85606bacac08114b281e7745441edcec2ee1b0',

  // Apps Script que guarda el PDF en Google Drive.

  // Organiza los respaldos por subcarpetas: perro, gato, ave u otro.

  // Dejar vacío para desactivar el respaldo.

  DRIVE_BACKUP_URL: 'https://script.google.com/macros/s/AKfycbySmXX9TTypld7-r5vgAZ4lnG0r1HLCCKIQqbDtAIJXOYerNDVHsOzrVXJyfDKhyH4lng/exec'
};

/* WhatsApp compartido (Supabase, tabla nextli_settings) con copia local para arrancar al instante */
try {
  var _wa = localStorage.getItem('nextli_wa');
  if (/^\d{11,15}$/.test(_wa || '')) window.NEXTLI_CONFIG.WA_NUMBER = _wa;
} catch (e) { /* sin almacenamiento */ }

/* Conexión con Supabase más tolerante: ante un corte de red reintenta hasta 3 veces
   (a partir del segundo intento sin la opción no-store, que algunos navegadores móviles rechazan). */
(function () {
  var f = window.fetch, SBU = window.NEXTLI_CONFIG.SUPABASE_URL;
  if (!f || !SBU) return;
  window.fetch = function (u, o) {
    var url = typeof u === 'string' ? u : (u && u.url) || '';
    if (url.indexOf(SBU) !== 0) return f.apply(this, arguments);
    var self = this, n = 0;
    var go = function () {
      var opts = n > 0 && o ? Object.assign({}, o, { cache: 'default' }) : o;
      return f.call(self, u, opts).catch(function (e) {
        if (++n > 3) throw e;
        return new Promise(function (r) { setTimeout(r, n * 1200); }).then(go);
      });
    };
    return go();
  };
})();

/* NEXTLI · Mejoras v2 (se aplican al terminar de cargar la página) */
window.addEventListener('load', function () {
  var CFG = window.NEXTLI_CONFIG, C = window.NextliCertificate, INV = window.NextliInventory;
  var $ = function (id) { return document.getElementById(id); };
  var norm = function (s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  var SB = { apikey: CFG.SUPABASE_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_KEY };

  /* WhatsApp: sincronizar con Supabase */
  fetch(CFG.SUPABASE_URL + '/rest/v1/nextli_settings?key=eq.wa_number&select=value', { headers: SB })
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var v = rows && rows[0] && rows[0].value;
      if (!/^\d{11,15}$/.test(v || '') || v === CFG.WA_NUMBER) return;
      try { localStorage.setItem('nextli_wa', v); } catch (e) { return; }
      if (!sessionStorage.getItem('nextli_wa_reloaded')) { sessionStorage.setItem('nextli_wa_reloaded', '1'); location.reload(); }
    }).catch(function () { /* sin conexión: se usa la copia local */ });

  /* 1 · Más razas de perro */
  var sel = $('breed');
  if (sel) {
    var have = Array.from(sel.options).map(function (o) { return norm(o.textContent); });
    var anchor = Array.from(sel.options).find(function (o) { return /^(mestizo|otro)/i.test(o.textContent.trim()); });
    [['Golden Retriever', 'grande'], ['Pastor Alemán', 'grande'], ['Bulldog Francés', 'mediano'], ['Beagle', 'chico'],
     ['Rottweiler', 'grande'], ['Boxer', 'grande'], ['Yorkshire Terrier', 'chico'], ['Dóberman', 'grande'],
     ['Shih Tzu', 'chico'], ['Gran Danés', 'xl']].forEach(function (r) {
      var n = norm(r[0]), n2 = n.replace(' terrier', '');
      if (have.some(function (h) { return h === n || h === n2; })) return;
      var o = document.createElement('option'); o.value = o.textContent = r[0];
      sel.insertBefore(o, anchor || null);
      if (typeof breedSize !== 'undefined') breedSize[r[0]] = r[1];
    });
  }

  /* 1b · Especie "Ave" con las 7 aves más comunes (certificado con pluma) */
  var spSel = $('species'), birdBox = null;
  if (spSel && !spSel.querySelector('option[value="ave"]')) {
    var oa = document.createElement('option'); oa.value = 'ave'; oa.textContent = 'Ave';
    spSel.insertBefore(oa, spSel.querySelector('option[value="otro"]'));
    birdBox = document.createElement('div'); birdBox.className = 'field'; birdBox.style.display = 'none';
    birdBox.innerHTML = '<label>Tipo de ave</label><select id="birdType"><option value="">Selecciona…</option>' +
      ['Canario', 'Periquito', 'Agaporni', 'Ninfa', 'Cotorra', 'Loro', 'Paloma'].map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select>';
    var bf = $('breedField'); bf.parentNode.insertBefore(birdBox, bf.nextSibling);
    spSel.addEventListener('change', function () { birdBox.style.display = spSel.value === 'ave' ? 'block' : 'none'; $('birdType').value = ''; });
    $('birdType').onchange = function (e) {
      state.breed = e.target.value;
      if (state.breed) { state.weight = 'chico'; $('weightRange').value = 'chico'; renderUrns(); applyServiceUI(); }
    };
  }

  /* 2 · Urnas del mismo tamaño, imágenes completas y vinilos */
  var st = document.createElement('style');
  st.textContent = '#urnGrid .pcard-media{aspect-ratio:1/1!important;height:auto!important;display:flex!important;align-items:center;justify-content:center;background:#fff!important;overflow:hidden}' +
    '#urnGrid .pcard-media img{width:100%!important;height:100%!important;object-fit:contain!important;padding:8px;box-sizing:border-box;mix-blend-mode:multiply;background:transparent!important}' +
    '.nx-refimg{width:100%;height:auto!important;max-height:none!important;object-fit:contain!important}' +
    '.nx-dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:8px;border:1px solid rgba(0,0,0,.35);vertical-align:-2px}' +
    '.nx-loc{background:#fff;border:1px solid rgba(212,175,55,.6);border-radius:16px;margin:14px 0 0;overflow:hidden}' +
    '.nx-loc-btn{width:100%;border:0;background:transparent;padding:14px;font:600 14px Poppins,sans-serif;color:#0b192c;cursor:pointer;text-align:left}' +
    '.nx-loc-body{padding:0 14px 14px;text-align:center}.nx-loc-body p{margin:0 0 10px;font-size:13px;color:#555}' +
    '.nx-loc iframe{width:100%;height:190px;border:0;border-radius:12px}' +
    '.nx-go{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:999px;background:#0b192c;color:#f3efe1!important;font:600 12px Poppins,sans-serif;text-decoration:none}';
  document.head.appendChild(st);
  var vi = document.querySelector('img.nx-refimg[src*="vinilos"]');
  if (vi) {
    var tx = document.createElement('p'); tx.className = 'nx-hint';
    tx.textContent = 'Cuatro acabados: plateado, blanco, negro y dorado. Con logo Nextli.';
    vi.replaceWith(tx);
  }
  var DOTS = { plateado: '#c0c0c0', blanco: '#ffffff', negro: '#111111', dorado: '#d4af37' };
  document.querySelectorAll('[data-color]').forEach(function (el) {
    var c = DOTS[norm(el.dataset.color)];
    if (!c || el.querySelector('.nx-dot')) return;
    var s = document.createElement('span'); s.className = 'nx-dot'; s.style.background = c;
    el.insertBefore(s, el.firstChild);
  });

  /* 3 · No dejar elegir urna sin especie, raza y peso */
  var origSelect = window.selectUrn;
  if (typeof origSelect === 'function') {
    window.selectUrn = function (id) {
      var breedOk = state.species === 'otro' ? state.otherSpecies : state.breed;
      if (!state.species || !breedOk || !state.weight) {
        INV.toast('Por favor, primero selecciona la especie, raza y peso de tu mascota antes de elegir una urna.');
        var f = $('species'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); }
        return;
      }
      return origSelect.call(window, id);
    };
  }

  /* 6 · Ubicación (plegable, al final del Paso 1) */
  var grid = document.querySelector('[data-step="1"] .option-grid');
  if (grid) {
    var ADDR = 'José Bernardo Couto 226, México 2da Secc, 57620 Cdad. Nezahualcóyotl, Méx.', q = encodeURIComponent(ADDR);
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var go = ios ? 'https://maps.apple.com/?daddr=' + q : 'https://www.google.com/maps/dir/?api=1&destination=' + q;
    var loc = document.createElement('div'); loc.className = 'nx-loc';
    loc.innerHTML = '<button type="button" class="nx-loc-btn" aria-expanded="false">📍 Conoce dónde te esperamos</button>' +
      '<div class="nx-loc-body" hidden><p>' + ADDR + '</p><iframe title="Mapa de NEXTLI" loading="lazy"></iframe><a class="nx-go" href="' + go + '" target="_blank" rel="noopener">Cómo llegar</a></div>';
    var lb = loc.querySelector('.nx-loc-btn'), body = loc.querySelector('.nx-loc-body'), fr = loc.querySelector('iframe');
    lb.onclick = function () {
      var open = body.hidden;
      if (open && !fr.src) fr.src = 'https://www.google.com/maps?q=' + q + '&output=embed';
      body.hidden = !open; lb.setAttribute('aria-expanded', String(open));
    };
    grid.parentNode.insertBefore(loc, grid.nextSibling);
  }

  /* WhatsApp editable: solo aparece con la sesión de administración iniciada (junto a "Inventario") */
  var wb = document.querySelector('#workerBar .wb-actions'), invBtn = $('adminInventoryBtn');
  if (wb && invBtn) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = '📞 WhatsApp';
    var syncBtn = function () { b.hidden = invBtn.hidden; b.style.display = invBtn.hidden ? 'none' : ''; };
    new MutationObserver(syncBtn).observe(invBtn, { attributes: true, attributeFilter: ['hidden'] });
    syncBtn();
    b.onclick = function () {
      var v = window.prompt('Número de WhatsApp de contacto (10 dígitos, o con lada de país):', CFG.WA_NUMBER);
      if (v === null) return;
      var d = v.replace(/\D/g, ''); if (d.length === 10) d = '52' + d;
      if (!/^\d{11,15}$/.test(d)) { INV.toast('Número no válido. Revisa que tenga 10 dígitos.'); return; }
      var pw = window.prompt('Contraseña del panel de trabajador, para confirmar el cambio:');
      if (!pw) return;
      fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/nextli_settings_save', {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, SB),
        body: JSON.stringify({ p_pw: pw, p_key: 'wa_number', p_value: d })
      }).then(function (r) {
        if (!r.ok) throw new Error('rechazado');
        try { localStorage.setItem('nextli_wa', d); } catch (e) { /* ya quedó en la nube */ }
        INV.toast('WhatsApp actualizado para todos. Recargando…');
        setTimeout(function () { location.reload(); }, 900);
      }).catch(function () { INV.toast('No se pudo guardar. Revisa la contraseña y tu conexión.'); });
    };
    wb.insertBefore(b, invBtn);
  }

  /* 4 y 5 · Certificado: icono por especie, logo con aureola y aves, sello grande, folio */
  if (!C) return;
  var PAPER = '#f7f1e3', GOLD = '#a87a22', GREY = '#8b9099', BIRD = /\b(ave|pajaro|loro|canario|perico|cotorra|periquito|paloma|pato|gallina|pollo|guacamaya|cacatua)/;
  var kindOf = function (d) { return d.kind === 'otro' && BIRD.test(norm(d.otherSpecies || '')) ? 'ave' : d.kind; };
  function paw(ctx, cx, cy, s, cat) {
    var pad = cat ? [22, 16] : [27, 19];
    var toes = cat ? [[-30, -14, 9, 9], [-11, -30, 9, 10], [11, -30, 9, 10], [30, -14, 9, 9]]
                   : [[-34, -12, 10, 14], [-12, -30, 10, 14], [12, -30, 10, 14], [34, -12, 10, 14]];
    ctx.beginPath(); ctx.ellipse(cx, cy + 8 * s, pad[0] * s, pad[1] * s, 0, 0, Math.PI * 2);
    toes.forEach(function (t) {
      ctx.moveTo(cx + (t[0] + t[2]) * s, cy + t[1] * s);
      ctx.ellipse(cx + t[0] * s, cy + t[1] * s, t[2] * s, t[3] * s, 0, 0, Math.PI * 2);
    });
    ctx.fill();
  }
  function feather(ctx, cx, cy, s) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.6); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -44);
    ctx.bezierCurveTo(26, -26, 26, 16, 0, 34); ctx.bezierCurveTo(-26, 16, -26, -26, 0, -44); ctx.fill();
    ctx.strokeStyle = PAPER; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 34); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(-6, 50); ctx.stroke();
    ctx.restore();
  }
  function nextFolio() {
    var t = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    var ymd = '' + t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()), key = 'nextli_folio_' + ymd, n;
    try { n = (+localStorage.getItem(key) || 0) + 1; localStorage.setItem(key, n); }
    catch (e) { n = Math.floor(Math.random() * 900) + 100; }
    return 'NX-' + ymd + '-' + String(n).padStart(3, '0') + Math.random().toString(36).slice(2, 4).toUpperCase();
  }
  function sealExtras(ctx) {
    ctx.save(); ctx.strokeStyle = GREY; ctx.lineCap = 'round';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(637, 739, 15, 3.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.7;
    [[659, 770, 1], [662, 783, 0.8], [652, 794, 0.65]].forEach(function (b) {
      ctx.save(); ctx.translate(b[0], b[1]); ctx.scale(b[2], b[2]);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-3, -5, 0, -1); ctx.quadraticCurveTo(3, -5, 6, 0); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  /* Fecha de defunción: se corre a la derecha (solo durante el dibujo) para que no choque con el adorno de la esquina */
  var shift = 0, P = CanvasRenderingContext2D.prototype, ft = P.fillText, fr2 = P.fillRect;
  P.fillText = function () { var a = [].slice.call(arguments); if (shift && a[1] === 340 && a[2] > 760) a[1] = 392; return ft.apply(this, a); };
  P.fillRect = function (x, y, w, h) { return fr2.call(this, (shift && x === 235 && w === 210) ? 287 : x, y, w, h); };

  /* Sello grande (cert-assets.js → seal): se dibuja a la derecha, translúcido; el centro conserva el logo original */
  var stampSrc = null, stampImg = null;
  function loadStamp() {
    if (stampImg) return stampImg;
    stampImg = new Promise(function (res) {
      if (!stampSrc) return res(null);
      var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = stampSrc;
    });
    return stampImg;
  }

  var origRender = C.render;
  C.render = async function (d, o) {
    if (d.kind === 'ave' && !d.otherSpecies) d = Object.assign({}, d, { otherSpecies: 'Ave' });
    var A = window.NEXTLI_ASSETS || {};
    if (!stampSrc && A.seal) stampSrc = A.seal;
    var cv, pr;
    shift++;
    try {
      A.seal = null;                       // el sello central de certificate.js vuelve a ser el logo original
      pr = origRender.call(C, d, o);       // certificate.js lee sus imágenes de forma síncrona, al empezar
      A.seal = stampSrc;
      cv = await pr;
    } finally { shift--; if (stampSrc) A.seal = stampSrc; }
    var stamp = await loadStamp();
    var ctx = cv.getContext('2d'), k = cv.width / C.REF_W, kind = kindOf(d), folio = nextFolio();
    ctx.save(); ctx.scale(k, k);
    if (kind !== 'perro') {
      var g = ctx.createLinearGradient(0, 0, C.REF_W, C.REF_H);
      ['#8a5f14', '#d6b153', '#a87a22', '#e0c068', '#8a5f14'].forEach(function (c, i) { g.addColorStop(i / 4, c); });
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(316, 325, 71, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(316, 325, 66, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(316, 325, 57, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = GOLD;
      if (kind === 'gato') paw(ctx, 316, 329, 1, true);
      else if (kind === 'ave') feather(ctx, 316, 325, 1);
      else { feather(ctx, 316, 297, 0.5); paw(ctx, 291, 343, 0.42, false); paw(ctx, 341, 343, 0.42, true); }
    }
    sealExtras(ctx);
    if (stamp) {                           // sello translúcido a la derecha (el blanco del fondo desaparece al multiplicar)
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.9;
      ctx.drawImage(stamp, 833, 537, 246, 246);
      ctx.restore();
    }
    ctx.fillStyle = '#16130d'; ctx.textAlign = 'center';
    ctx.font = '700 17px "Cormorant Garamond","Times New Roman",Georgia,serif';
    ctx.fillText('Folio: ' + folio, 392, 828);
    ctx.restore();
    cv.nextliFolio = folio; cv.nextliKind = kind; cv.nextliName = d.name || 'Mascota';
    return cv;
  };

  /* Respaldo en Drive (subcarpeta por especie, archivo con el nombre de la mascota) */
  function backup(blob, cv) {
    if (!CFG.DRIVE_BACKUP_URL) return;
    var r = new FileReader();
    r.onload = function () {
      fetch(CFG.DRIVE_BACKUP_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          folio: cv.nextliFolio, species: cv.nextliKind,
          fileName: cv.nextliName.replace(/[\/:*?"<>|]+/g, '-') + '.pdf',
          pdfBase64: String(r.result).split(',')[1]
        })
      }).catch(function () { /* no afecta al usuario */ });
    };
    r.readAsDataURL(blob);
  }
  var origPdf = C.toPdfBlob;
  C.toPdfBlob = async function (canvas, title, opt) {
    var blob = await origPdf.call(C, canvas, title);
    if (!(opt && opt.noBackup)) { try { backup(blob, canvas); } catch (e) { /* nunca bloquear la descarga */ } }
    return blob;
  };

  /* Modo cliente: el certificado se crea en silencio y se respalda en Drive, sin mostrarse ni descargarse */
  var pre = { sig: '', p: null, sent: '' };
  function prebuild() {
    var d = certData(), sig = JSON.stringify(d);
    if (pre.sig === sig && pre.p) return;
    pre.sig = sig;
    pre.p = C.render(d, { width: 2400 }).then(function (cv) {
      return C.toPdfBlob(cv, 'Certificado de cremacion', { noBackup: true }).then(function (blob) { return { blob: blob, cv: cv }; });
    });
    pre.p.catch(function () { pre.p = null; });
  }
  var origRS = window.renderSummary;
  if (typeof origRS === 'function') {
    window.renderSummary = function () {
      var r = origRS.apply(this, arguments);
      try { if (!workerMode) setTimeout(function () { try { prebuild(); } catch (e) { /* datos incompletos */ } }, 0); } catch (e) { /* sin modo trabajador */ }
      return r;
    };
  }
  var sw = $('sendWa');
  if (sw) sw.addEventListener('click', function () {
    if (workerMode) return;
    try {
      prebuild();
      var sig = pre.sig;
      pre.p.then(function (r) { if (pre.sent !== sig) { pre.sent = sig; backup(r.blob, r.cv); } }).catch(function () { /* no afecta el envío por WhatsApp */ });
    } catch (e) { /* no afecta el envío por WhatsApp */ }
  });
});
