/* ============================================================
   NEXTLI · Configuración central
   Edita este archivo para cambiar datos de contacto, la firma
   del certificado o la contraseña del panel de inventario.
   ============================================================ */
window.NEXTLI_CONFIG = {
  // WhatsApp de NEXTLI (con lada de país, sin "+")
  WA_NUMBER: '525521889698',

  // Invitación al Grupo NEXTLI (WhatsApp no permite prellenar texto en un enlace de grupo,
  // por eso la app copia el mensaje y abre el grupo para pegarlo).
  GROUP_URL: 'https://chat.whatsapp.com/KBc1dBIEJQHCoBTmrG96mi?s=cl&p=a&mlu=4&ilr=4',

  // Respaldo de imágenes si alguna no carga desde el mismo sitio
  IMAGE_BASE: 'https://nextli-stroks15s-projects.vercel.app/images/',

  // Firma del médico veterinario en el certificado
  DOCTOR: { name: 'Carlos Chávez', title: 'M.V.Z' },

  // ----- Inventario compartido (Supabase) -----
  // La URL y la clave pública (publishable) son seguras de publicar: solo permiten LEER el inventario.
  // Escribir exige la contraseña del panel, que se valida en el servidor.
  SUPABASE_URL: 'https://gzdoqxhvwiivwqmkxcem.supabase.co',
  SUPABASE_KEY: 'sb_publishable_QvTHUHAfwKdQ446LUc97sQ_z2ssLHDQ',

  // ----- Panel de inventario del Modo Trabajador -----
  // Respaldo SIN conexión: hash SHA-256 de la contraseña (no la contraseña en texto plano).
  // Debe corresponder a la misma contraseña que está guardada en Supabase.
  // Para generar otro hash: en la consola del navegador ejecuta  nextliHash('nueva-contraseña')
  ADMIN_PASSWORD_HASH: 'fe106380d6dcaf823a3f47452f85606bacac08114b281e7745441edcec2ee1b0',

  // ----- Respaldo automático del certificado en Google Drive -----
  // URL del servicio (Apps Script / función) que recibe el PDF y lo guarda en la subcarpeta
  // perro | gato | ave | otro, con el nombre de la mascota. Vacío = respaldo desactivado.
  DRIVE_BACKUP_URL: ''
};

/* ============================================================
   NEXTLI · Mejoras v2 (se aplican al terminar de cargar la página)
   Razas, colores de vinilo, validación de urnas y certificado por especie con folio.
   ============================================================ */
window.addEventListener('load', function () {
  var CFG = window.NEXTLI_CONFIG, C = window.NextliCertificate, INV = window.NextliInventory;
  var $ = function (id) { return document.getElementById(id); };
  var norm = function (s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };

  /* 1 · Más razas de perro (sin repetir las existentes) */
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

  /* 2 · Paso 3: imágenes completas y punto de color en cada vinilo */
  var st = document.createElement('style');
  st.textContent = '[data-frame] img,[data-color] img{object-fit:contain!important;background-size:contain!important}' +
    '.nx-dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:8px;border:1px solid rgba(0,0,0,.35);vertical-align:-2px}';
  document.head.appendChild(st);
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

  /* 4 y 5 · Certificado: icono por especie y folio */
  if (!C) return;
  var PAPER = '#f7f1e3', GOLD = '#a87a22', BIRD = /\b(ave|pajaro|loro|canario|perico|cotorra|periquito|paloma|pato|gallina|pollo|guacamaya|cacatua)/;
  var kindOf = function (d) {
    return d.kind === 'otro' && BIRD.test(norm(d.otherSpecies || '')) ? 'ave' : d.kind;
  };
  function paw(ctx, cx, cy, s, cat) {
    var pad = cat ? [22, 16] : [27, 19];
    var toes = cat ? [[-30, -14, 9, 9], [-11, -30, 9, 10], [11, -30, 9, 10], [30, -14, 9, 9]]
                   : [[-34, -12, 10, 14], [-12, -30, 10, 14], [12, -30, 10, 14], [34, -12, 10, 14]];
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8 * s, pad[0] * s, pad[1] * s, 0, 0, Math.PI * 2);
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

  var origRender = C.render;
  C.render = async function (d, o) {
    var cv = await origRender.call(C, d, o);
    var ctx = cv.getContext('2d'), k = cv.width / C.REF_W, kind = kindOf(d), folio = nextFolio();
    ctx.save(); ctx.scale(k, k);
    if (kind !== 'perro') { // la huella de perro original se conserva solo para perros
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
    ctx.fillStyle = '#16130d'; ctx.textAlign = 'center';
    ctx.font = '700 17px "Cormorant Garamond","Times New Roman",Georgia,serif';
    ctx.fillText('Folio: ' + folio, 340, 828);
    ctx.restore();
    cv.nextliFolio = folio; cv.nextliKind = kind; cv.nextliName = d.name || 'Mascota';
    return cv;
  };

  /* Respaldo en Drive: la descarga local sigue igual; el envío va en segundo plano */
  var origPdf = C.toPdfBlob;
  C.toPdfBlob = async function (canvas, title) {
    var blob = await origPdf.call(C, canvas, title);
    try {
      if (CFG.DRIVE_BACKUP_URL) {
        var r = new FileReader();
        r.onload = function () {
          fetch(CFG.DRIVE_BACKUP_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              folio: canvas.nextliFolio, species: canvas.nextliKind,
              fileName: canvas.nextliName.replace(/[\/:*?"<>|]+/g, '-') + '.pdf',
              pdfBase64: String(r.result).split(',')[1]
            })
          }).catch(function () { /* sin conexión: no afecta la descarga */ });
        };
        r.readAsDataURL(blob);
      }
    } catch (e) { /* nunca bloquear la descarga */ }
    return blob;
  };
});
