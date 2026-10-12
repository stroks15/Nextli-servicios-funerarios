/* NEXTLI · Configuración central (edita aquí contacto, firma del certificado y contraseña del panel) */
window.NEXTLI_CONFIG = {
  WA_NUMBER: '525521889698',
  GROUP_URL: 'https://chat.whatsapp.com/KBc1dBIEJQHCoBTmrG96mi?s=cl&p=a&mlu=4&ilr=4',
  IMAGE_BASE: 'https://nextli-stroks15s-projects.vercel.app/images/',
  DOCTOR: { name: 'Carlos Chávez', title: 'M.V.Z' },
  // Supabase: la clave publishable solo permite LEER; escribir exige la contraseña del panel.
  SUPABASE_URL: 'https://gzdoqxhvwiivwqmkxcem.supabase.co',
  SUPABASE_KEY: 'sb_publishable_QvTHUHAfwKdQ446LUc97sQ_z2ssLHDQ',
  // Respaldo offline: hash SHA-256 de la contraseña (consola: nextliHash('nueva-contraseña')).
  ADMIN_PASSWORD_HASH: 'fe106380d6dcaf823a3f47452f85606bacac08114b281e7745441edcec2ee1b0',
  // Apps Script que guarda el PDF en Drive (subcarpeta perro|gato|ave|otro). Vacío = desactivado.
  DRIVE_BACKUP_URL: 'https://script.google.com/macros/s/AKfycbySmXX9TTypld7-r5vgAZ4lnG0r1HLCCKIQqbDtAIJXOYerNDVHsOzrVXJyfDKhyH4lng/exec'
};

/* WhatsApp compartido: se lee de Supabase (tabla nextli_settings). Se guarda copia en este dispositivo
   para arrancar al instante y, si el valor en la nube cambió, la página se recarga una vez. */
try {
  var _wa = localStorage.getItem('nextli_wa');
  if (/^\d{11,15}$/.test(_wa || '')) window.NEXTLI_CONFIG.WA_NUMBER = _wa;
} catch (e) { /* sin almacenamiento */ }

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

  /* 2 · Paso 3: imágenes completas, vinilos sin imagen azul y con punto de color */
  var st = document.createElement('style');
  st.textContent = '[data-frame] img,[data-color] img{object-fit:contain!important;background-size:contain!important}' +
    '.nx-refimg{width:100%;height:auto!important;max-height:none!important;object-fit:contain!important}' +
    '.nx-dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:8px;border:1px solid rgba(0,0,0,.35);vertical-align:-2px}' +
    '.nx-loc{background:#fff;border:1px solid rgba(212,175,55,.6);border-radius:16px;padding:14px;margin:0 0 14px;text-align:center}' +
    '.nx-loc h4{margin:0 0 4px;color:#0b192c}.nx-loc p{margin:0 0 10px;font-size:13px;color:#555}' +
    '.nx-loc iframe{width:100%;height:190px;border:0;border-radius:12px}.nx-loc a{display:inline-block;margin-top:8px;font:600 12px Poppins,sans-serif;color:#0b192c}';
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

  /* 6 · Ubicación en el Paso 1 y WhatsApp editable en el Modo Trabajador */
  var grid = document.querySelector('[data-step="1"] .option-grid');
  if (grid) {
    var ADDR = 'José Bernardo Couto 226, México 2da Secc, 57620 Cdad. Nezahualcóyotl, Méx.', q = encodeURIComponent(ADDR);
    var loc = document.createElement('div'); loc.className = 'nx-loc';
    loc.innerHTML = '<h4>📍 Ubicación de NEXTLI</h4><p>' + ADDR + '</p><iframe title="Mapa de NEXTLI" loading="lazy" src="https://www.google.com/maps?q=' + q + '&output=embed"></iframe><a href="https://maps.google.com/?q=' + q + '" target="_blank" rel="noopener">Abrir en Google Maps</a>';
    grid.parentNode.insertBefore(loc, grid);
  }
  var wb = document.querySelector('#workerBar .wb-actions');
  if (wb) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = '📞 WhatsApp';
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
    wb.insertBefore(b, wb.firstChild);
  }

  /* 4 y 5 · Certificado: icono por especie, logo con aureola y aves, folio */
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

  var origRender = C.render;
  C.render = async function (d, o) {
    var cv = await origRender.call(C, d, o);
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
    ctx.fillStyle = '#16130d'; ctx.textAlign = 'center';
    ctx.font = '700 17px "Cormorant Garamond","Times New Roman",Georgia,serif';
    ctx.fillText('Folio: ' + folio, 340, 828);
    ctx.restore();
    cv.nextliFolio = folio; cv.nextliKind = kind; cv.nextliName = d.name || 'Mascota';
    return cv;
  };

  var origPdf = C.toPdfBlob;
  C.toPdfBlob = async function (canvas, title) {
    var blob = await origPdf.call(C, canvas, title);
    try {
      if (CFG.DRIVE_BACKUP_URL) {
        var r = new FileReader();
        r.onload = function () {
          // no-cors: Apps Script no devuelve cabeceras CORS; el archivo se guarda igual.
          fetch(CFG.DRIVE_BACKUP_URL, {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              folio: canvas.nextliFolio, species: canvas.nextliKind,
              fileName: canvas.nextliName.replace(/[\/:*?"<>|]+/g, '-') + '.pdf',
              pdfBase64: String(r.result).split(',')[1]
            })
          }).catch(function () { /* no afecta la descarga */ });
        };
        r.readAsDataURL(blob);
      }
    } catch (e) { /* nunca bloquear la descarga */ }
    return blob;
  };
});
