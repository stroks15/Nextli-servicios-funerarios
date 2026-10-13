/* ============================================================
   NEXTLI · Inventario y panel de administración (Modo Trabajador)
   ------------------------------------------------------------
   - Catálogo base (urnas, complementos, precios de comunitaria).
   - Los cambios del trabajador (precios, imagen, agotado) se guardan
     en localStorage del dispositivo; no hace falta tocar GitHub
     ni volver a desplegar en Vercel.
   - Acceso: contraseña validada contra el hash SHA-256 guardado en
     config.js (ADMIN_PASSWORD_HASH). La contraseña nunca va en texto plano.
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.NEXTLI_CONFIG || {};
  const STORAGE_KEY = 'nextli_inventory_v1';
  const SB_URL = String(CFG.SUPABASE_URL || '').replace(/\/$/, '');
  const SB_KEY = String(CFG.SUPABASE_KEY || '');
  const REMOTE = !!(SB_URL && SB_KEY);   // con Supabase configurado, el inventario es compartido
  const SIZES = [
    ['chico', 'Chico'],
    ['mediano', 'Mediano'],
    ['grande', 'Grande'],
    ['xl', 'Extra grande']
  ];

  /* ---------- Catálogo base ---------- */
  const BASE_URNS = [
    { id: 'clasica', name: 'Urna Clásica Pewter', desc: 'Líneas sobrias y atemporales, con un acabado sereno en pewter.', img: '/images/urna-clasica.png', prices: { chico: 1750, mediano: 1850, grande: 1950, xl: 2100 } },
    { id: 'luna', name: 'Urna Luna Pewter', desc: 'Un diseño suave y silencioso, como una noche de luna.', img: '/images/urna-luna.png', prices: { chico: 1750 } },
    { id: 'talavera', name: 'Urna de Talavera', desc: 'Artesanía mexicana con calidez y carácter propio.', img: '/images/urna-talavera.png', prices: { chico: 1750, mediano: 1950, grande: 2050, xl: 2150 } },
    { id: 'talpewter', name: 'Talavera y Pewter', desc: 'La calidez de la Talavera junto a la elegancia del pewter.', img: '/images/urna-talavera-pewter.png', prices: { chico: 1950, mediano: 2050 } },
    { id: 'huesohuella', name: 'Huesito con Huella', desc: 'Un detalle tierno que guarda su huella en el recuerdo.', img: '/images/urna-hueso-huella.png', prices: { chico: 1950, mediano: 2050, grande: 2150 } },
    { id: 'corazon', name: 'Urna Corazón', desc: 'Una forma de corazón para el amor que siempre permanece.', img: '/images/urna-corazon.png', prices: { chico: 1950, mediano: 2050, grande: 2150 } },
    { id: 'casitalisa', name: 'Casita Lisa', desc: 'Un pequeño hogar de formas limpias para su descanso.', img: '/images/urna-casita-lisa.png', prices: { chico: 1950, mediano: 2050, grande: 2150, xl: 2250 } },
    { id: 'casitateja', name: 'Casita con Teja', desc: 'Una casita con techo de teja, cálida como su compañía.', img: '/images/urna-casita-teja.png', prices: { chico: 1950, mediano: 2050, grande: 2150, xl: 2250 } },
    { id: 'huesocromado', name: 'Huesito Cromado', desc: 'Un acabado cromado luminoso, en forma de huesito.', img: '/images/urna-hueso-cromado.png', prices: { chico: 1950, mediano: 2050, grande: 2150, xl: 2250 } }
  ];

  const BASE_EXTRAS = [
    { id: 'plus', eyebrow: 'Homenaje', name: 'Paquete Plus — Homenaje completo', desc: 'Fotografía, huella y urna personalizada en vinilo, para tenerle siempre cerca.', img: '/images/thumb-plus.jpg', price: 500 },
    { id: 'huella', eyebrow: 'Recuerdo', name: 'Huella con su pelo', desc: 'Un recuerdo íntimo y delicado, hecho con un poco de su pelo.', img: '/images/thumb-huella.jpg', price: 200 },
    { id: 'cert', eyebrow: 'Documento', name: 'Certificado físico adicional', desc: 'Una copia impresa de su certificado, para guardarla con cariño.', img: '/images/thumb-certificado.jpg', price: 50 }
  ];

  const BASE_COM = { chico: 800, mediano: 850, grande: 1100 };

  const IMAGE_LIBRARY = [
    '/images/urna-clasica.png', '/images/urna-luna.png', '/images/urna-talavera.png', '/images/urna-talavera-pewter.png',
    '/images/urna-hueso-huella.png', '/images/urna-corazon.png', '/images/urna-casita-lisa.png', '/images/urna-casita-teja.png',
    '/images/urna-hueso-cromado.png', '/images/thumb-plus.jpg', '/images/thumb-huella.jpg', '/images/thumb-certificado.jpg',
    '/images/homenaje-grande.jpg', '/images/huella-grande.jpg', '/images/certificado-grande.jpg', '/images/marcos.jpg', '/images/vinilos.jpg'
  ];

  /* ---------- Utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Number(n || 0).toLocaleString('es-MX');
  const $ = id => document.getElementById(id);

  let toastTimer = null;
  function toast(msg) {
    let t = $('nxToast');
    if (!t) { t = document.createElement('div'); t.id = 'nxToast'; t.className = 'nx-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- SHA-256 (WebCrypto con respaldo en JS) ---------- */
  function sha256js(str) {
    const bytes = Array.from(new TextEncoder().encode(str));
    const K = [], H = [];
    for (let n = 2, c = 0; c < 64; n++) {
      let prime = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (!prime) continue;
      if (c < 8) H[c] = (Math.pow(n, 0.5) % 1) * 4294967296 | 0;
      K[c++] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0;
    }
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  async function sha256Hex(str) {
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* cae al respaldo */ }
    return sha256js(str);
  }
  // Ayuda para generar un hash nuevo desde la consola del navegador
  window.nextliHash = async pw => { const h = await sha256Hex(pw); console.log(h); return h; };

  /* ---------- Almacén (overrides en localStorage) ---------- */
  let over = { urns: {}, extras: {}, com: {} };
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        over = { urns: o.urns || {}, extras: o.extras || {}, com: o.com || {} };
      }
    } catch (e) { over = { urns: {}, extras: {}, com: {} }; }
  }
  function cacheLocal() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(over)); return true; } catch (e) { return false; } }
  function save() {
    const ok = cacheLocal();
    if (!ok && !REMOTE) toast('No se pudo guardar: el almacenamiento del dispositivo está lleno. Usa una imagen más ligera.');
    schedulePush();
    return ok || REMOTE;
  }

  /* ---------- Sincronización con Supabase (inventario compartido) ---------- */
  let remoteTs = null, dirty = false, pushing = false, pushTimer = null, syncState = REMOTE ? 'idle' : 'local';
  const SYNC_TEXT = {
    local: 'Los cambios se guardan en este dispositivo y se aplican de inmediato.',
    idle: 'Conectado. Los cambios se comparten con todos los dispositivos.',
    ok: '✓ Sincronizado: todos los dispositivos verán estos cambios.',
    pending: 'Guardando cambios…',
    offline: 'Sin conexión con el servidor: guardado en este dispositivo; se enviará al reconectar.',
    denied: 'No se pudo sincronizar: la contraseña no es válida en el servidor.'
  };
  function setSync(st) { syncState = st; const el = document.getElementById('syncText'); if (el) el.textContent = SYNC_TEXT[st] || ''; }
  function sbFetch(path, init) {
    init = init || {};
    return fetch(SB_URL + path, Object.assign({}, init, { cache: 'no-store', headers: Object.assign({ apikey: SB_KEY, 'Content-Type': 'application/json' }, init.headers || {}) }));
  }
  async function pull() {
    if (!REMOTE || pushing || dirty) return;
    try {
      const r = await sbFetch('/rest/v1/nextli_inventory?id=eq.main&select=data,updated_at');
      if (!r.ok) throw new Error('http ' + r.status);
      const row = (await r.json())[0];
      if (row && row.updated_at !== remoteTs) {
        remoteTs = row.updated_at;
        const d = row.data || {};
        over = { urns: d.urns || {}, extras: d.extras || {}, com: d.com || {} };
        cacheLocal(); emit();
      }
      if (syncState !== 'ok') setSync('idle');
    } catch (e) { setSync('offline'); }
  }
  function schedulePush() {
    if (!REMOTE) return;
    dirty = true; setSync('pending');
    clearTimeout(pushTimer); pushTimer = setTimeout(push, 500);
  }
  async function push() {
    if (!REMOTE || !dirty) return;
    if (!admin || !adminPw) { setSync('offline'); return; }
    pushing = true;
    try {
      const r = await sbFetch('/rest/v1/rpc/nextli_inventory_save', { method: 'POST', body: JSON.stringify({ p_pw: adminPw, p_data: Object.assign({ v: 1 }, over) }) });
      const body = await r.text();
      if (!r.ok) throw new Error(body);
      remoteTs = JSON.parse(body); dirty = false; setSync('ok'); saveSession();   // renueva la ventana de inactividad
    } catch (e) {
      if (/unauthorized/.test(String(e.message))) { setSync('denied'); clearSession(); toast('La contraseña no es válida en el servidor.'); }
      else { setSync('offline'); clearTimeout(pushTimer); pushTimer = setTimeout(push, 15000); }
    } finally { pushing = false; }
  }
  if (REMOTE) {
    const kick = () => { if (dirty) push(); else pull(); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    window.addEventListener('online', kick);
    setInterval(() => { if (!document.hidden) pull(); }, 90000);
    setTimeout(pull, 0);
  }
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  load();

  function urns() {
    return BASE_URNS.map(u => {
      const o = over.urns[u.id] || {};
      const prices = Object.assign({}, u.prices);
      if (o.prices) Object.keys(o.prices).forEach(k => {
        if (o.prices[k] === null) delete prices[k]; else if (o.prices[k] > 0) prices[k] = o.prices[k];
      });
      return { id: u.id, name: u.name, desc: u.desc, defaultImg: u.img, img: o.img || u.img, prices, soldOut: !!o.soldOut, edited: !!over.urns[u.id] };
    });
  }
  function extras() {
    return BASE_EXTRAS.map(x => {
      const o = over.extras[x.id] || {};
      return Object.assign({}, x, { defaultImg: x.img, img: o.img || x.img, price: o.price > 0 ? o.price : x.price, soldOut: !!o.soldOut, edited: !!over.extras[x.id] });
    });
  }
  function com() { return Object.assign({}, BASE_COM, Object.fromEntries(Object.entries(over.com).filter(([, v]) => v > 0))); }

  function patchUrn(id, patch) {
    const cur = over.urns[id] || (over.urns[id] = {});
    if ('soldOut' in patch) { if (patch.soldOut) cur.soldOut = true; else delete cur.soldOut; }
    if ('img' in patch) { if (patch.img) cur.img = patch.img; else delete cur.img; }
    if (patch.prices) {
      cur.prices = cur.prices || {};
      const base = BASE_URNS.find(u => u.id === id).prices;
      Object.keys(patch.prices).forEach(size => {
        const v = patch.prices[size];
        if (v === null || v === '' || Number.isNaN(v)) { if (base[size] !== undefined) cur.prices[size] = null; else delete cur.prices[size]; }
        else if (v === base[size]) delete cur.prices[size];
        else cur.prices[size] = v;
      });
      if (!Object.keys(cur.prices).length) delete cur.prices;
    }
    if (!Object.keys(cur).length) delete over.urns[id];
    if (save()) emit();
  }
  function patchExtra(id, patch) {
    const cur = over.extras[id] || (over.extras[id] = {});
    const base = BASE_EXTRAS.find(x => x.id === id);
    if ('soldOut' in patch) { if (patch.soldOut) cur.soldOut = true; else delete cur.soldOut; }
    if ('img' in patch) { if (patch.img) cur.img = patch.img; else delete cur.img; }
    if ('price' in patch) { if (patch.price > 0 && patch.price !== base.price) cur.price = patch.price; else delete cur.price; }
    if (!Object.keys(cur).length) delete over.extras[id];
    if (save()) emit();
  }
  function patchCom(size, price) {
    if (price > 0 && price !== BASE_COM[size]) over.com[size] = price; else delete over.com[size];
    if (save()) emit();
  }
  function resetAll() { over = { urns: {}, extras: {}, com: {} }; try { localStorage.removeItem(STORAGE_KEY); } catch (e) { } schedulePush(); emit(); }
  function exportJson() { return JSON.stringify({ app: 'nextli-inventory', v: 1, data: over }, null, 2); }
  function importJson(text) {
    const o = JSON.parse(text);
    const d = o && o.data;
    if (!d || typeof d !== 'object') throw new Error('Archivo no válido');
    over = { urns: d.urns || {}, extras: d.extras || {}, com: d.com || {} };
    if (save()) emit();
  }

  /* ---------- Sesión de administración ---------- */
  let admin = false, adminPw = '', failed = 0, lockedUntil = 0;

  /* La sesión vive en sessionStorage (por pestaña, se borra al cerrarla). Antes solo existía en memoria:
     cualquier recarga o descarte de la página (cambiar a WhatsApp, bloquear el teléfono, el aviso de
     "WhatsApp actualizado") la destruía y el panel volvía a "Inventario bloqueado". */
  const SESSION_KEY = 'nextli_admin_session_v1';
  const SESSION_TTL = 8 * 60 * 60 * 1000;   // 8 h sin actividad
  function saveSession() { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pw: adminPw, t: Date.now() })); } catch (e) { /* sin almacenamiento */ } }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* nada */ } }
  async function restoreSession() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s.pw !== 'string' || !s.pw || !(Date.now() - s.t < SESSION_TTL)) { clearSession(); return; }
    admin = true; adminPw = s.pw; saveSession(); emitAdmin();   // se restaura al instante, sin parpadeo de "bloqueado"
    // Verificación en segundo plano: solo se cierra si el servidor confirma que la contraseña ya no vale.
    // Un fallo de red NUNCA cierra la sesión.
    let valid = null;
    try {
      if (REMOTE) {
        const r = await sbFetch('/rest/v1/rpc/nextli_inventory_check', { method: 'POST', body: JSON.stringify({ p_pw: adminPw }) });
        const body = await r.text();
        if (r.ok) valid = JSON.parse(body) === true;
      } else if (CFG.ADMIN_PASSWORD_HASH) {
        valid = (await sha256Hex(adminPw)) === String(CFG.ADMIN_PASSWORD_HASH).toLowerCase();
      }
    } catch (e) { /* sin conexión: se conserva la sesión */ }
    if (valid === false) { admin = false; adminPw = ''; clearSession(); emitAdmin(); toast('La sesión de administración terminó. Inicia sesión de nuevo.'); }
    else if (valid && REMOTE) pull();
  }

  async function login(pw) {
    if (Date.now() < lockedUntil) return { ok: false, wait: Math.ceil((lockedUntil - Date.now()) / 1000) };
    // 1) Con servidor: la contraseña se valida en Supabase (es lo que protege la escritura).
    if (REMOTE) {
      try {
        const r = await sbFetch('/rest/v1/rpc/nextli_inventory_check', { method: 'POST', body: JSON.stringify({ p_pw: pw }) });
        const body = await r.text();
        if (r.ok) {
          if (JSON.parse(body) === true) { admin = true; adminPw = pw; failed = 0; saveSession(); emitAdmin(); await pull(); return { ok: true }; }
          return { ok: false };
        }
        if (/too_many_attempts/.test(body)) return { ok: false, wait: 600 };
      } catch (e) { /* sin conexión: se valida localmente abajo */ }
    }
    // 2) Sin servidor / sin conexión: validación local con el hash de config.js
    if (!CFG.ADMIN_PASSWORD_HASH) return { ok: false, error: 'No hay contraseña configurada (config.js).' };
    const ok = (await sha256Hex(pw)) === String(CFG.ADMIN_PASSWORD_HASH).toLowerCase();
    if (ok) { admin = true; adminPw = pw; failed = 0; saveSession(); emitAdmin(); return { ok: true }; }
    failed++;
    if (failed >= 5) { failed = 0; lockedUntil = Date.now() + 30000; return { ok: false, wait: 30 }; }
    return { ok: false };
  }
  async function logout() { if (REMOTE && dirty && admin && adminPw) await push(); admin = false; adminPw = ''; clearSession(); closePanel(); emitAdmin(); }
  function emitAdmin() {
    document.body.classList.toggle('admin-mode', admin);
    const st = $('adminStatus'), li = $('adminLoginBtn'), inv = $('adminInventoryBtn'), lo = $('adminLogoutBtn');
    if (st) st.textContent = admin ? 'Administración activa' : 'Inventario bloqueado';
    if (li) li.hidden = admin;
    if (inv) inv.hidden = !admin;
    if (lo) lo.hidden = !admin;
  }

  /* ---------- Imagen: subir y reducir ---------- */
  function fileToDataUrl(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, (max || 900) / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }

  /* ---------- UI: modales ---------- */
  function ensureModals() {
    if ($('adminPanel')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<div class="nx-modal" id="loginModal" hidden>
  <div class="nx-sheet nx-login" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
    <h3 id="loginTitle">Acceso del personal</h3>
    <p class="nx-muted">Ingresa la contraseña para administrar el inventario del día.</p>
    <form id="loginForm" autocomplete="off">
      <div class="nx-pass"><input type="password" id="loginPass" placeholder="Contraseña" autocomplete="current-password" required>
      <button type="button" id="loginEye" aria-label="Mostrar contraseña">👁</button></div>
      <p class="nx-error" id="loginError" role="alert" hidden></p>
      <div class="nx-actions"><button type="button" class="nx-btn ghost" id="loginCancel">Cancelar</button><button type="submit" class="nx-btn primary">Entrar</button></div>
    </form>
  </div>
</div>
<div class="nx-modal" id="adminPanel" hidden>
  <div class="nx-sheet nx-admin" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
    <header class="nx-admin-head"><h3 id="adminTitle">Inventario del día</h3><button class="nx-x" id="adminClose" aria-label="Cerrar">×</button></header>
    <nav class="nx-tabs" id="adminTabs">
      <button data-tab="urnas" class="on">Urnas</button><button data-tab="extras">Complementos</button><button data-tab="respaldo">Respaldo</button>
    </nav>
    <div class="nx-admin-body" id="adminBody"></div>
    <p class="nx-muted nx-admin-foot" id="syncText"></p>
  </div>
</div>
<div class="nx-modal" id="imagePicker" hidden>
  <div class="nx-sheet nx-picker" role="dialog" aria-modal="true" aria-label="Cambiar imagen">
    <header class="nx-admin-head"><h3>Cambiar imagen</h3><button class="nx-x" id="pickerClose" aria-label="Cerrar">×</button></header>
    <div class="nx-picker-actions">
      <label class="nx-btn primary" for="pickerFile">📷 Subir o tomar foto</label>
      <input type="file" id="pickerFile" accept="image/*" hidden>
      <button class="nx-btn ghost" id="pickerReset">Restaurar la original</button>
    </div>
    <p class="nx-muted">O elige una de las imágenes del catálogo:</p>
    <div class="nx-lib" id="pickerLib"></div>
  </div>
</div>`;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    // Login
    $('loginCancel').onclick = closeLogin;
    $('loginEye').onclick = () => { const i = $('loginPass'); i.type = i.type === 'password' ? 'text' : 'password'; };
    $('loginForm').onsubmit = async e => {
      e.preventDefault();
      const err = $('loginError');
      const r = await login($('loginPass').value);
      if (r.ok) { closeLogin(); toast('Sesión iniciada'); openPanel(); return; }
      err.hidden = false;
      err.textContent = r.wait ? `Demasiados intentos. Espera ${r.wait > 90 ? Math.ceil(r.wait / 60) + ' min' : r.wait + ' s'} e inténtalo de nuevo.` : (r.error || 'Contraseña incorrecta.');
      $('loginPass').select();
    };
    // Panel
    $('adminClose').onclick = closePanel;
    $('adminTabs').onclick = e => {
      const b = e.target.closest('button[data-tab]'); if (!b) return;
      currentTab = b.dataset.tab; renderPanel();
    };
    setSync(syncState);
    $('pickerClose').onclick = closePicker;
    $('pickerFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f || !pickerTarget) return;
      try { applyImage(await fileToDataUrl(f, 640)); } catch (err) { toast('No se pudo leer esa imagen.'); }
    };
    $('pickerReset').onclick = () => applyImage(null);
    $('pickerLib').innerHTML = IMAGE_LIBRARY.map(p => `<button type="button" data-src="${p}"><img src="${p}" alt="" loading="lazy"></button>`).join('');
    $('pickerLib').onclick = e => { const b = e.target.closest('button[data-src]'); if (b) applyImage(b.dataset.src); };
    // Cerrar al tocar el fondo
    ['loginModal', 'adminPanel', 'imagePicker'].forEach(id => $(id).addEventListener('mousedown', e => {
      if (e.target.id === id) { if (id === 'loginModal') closeLogin(); else if (id === 'adminPanel') closePanel(); else closePicker(); }
    }));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('imagePicker').hidden) closePicker(); else if (!$('adminPanel').hidden) closePanel(); else if (!$('loginModal').hidden) closeLogin();
    });
  }

  function openLogin() {
    ensureModals();
    $('loginError').hidden = true; $('loginPass').value = ''; $('loginPass').type = 'password';
    $('loginModal').hidden = false;
    setTimeout(() => $('loginPass').focus(), 50);
  }
  function closeLogin() { const m = $('loginModal'); if (m) m.hidden = true; }

  let currentTab = 'urnas', pickerTarget = null;
  function openPanel() { if (!admin) return openLogin(); ensureModals(); renderPanel(); $('adminPanel').hidden = false; document.body.classList.add('nx-lock'); }
  function closePanel() { const m = $('adminPanel'); if (m) m.hidden = true; document.body.classList.remove('nx-lock'); closePicker(); }
  function openPicker(target) { pickerTarget = target; $('imagePicker').hidden = false; }
  function closePicker() { pickerTarget = null; const m = $('imagePicker'); if (m) m.hidden = true; }
  function applyImage(src) {
    if (!pickerTarget) return;
    const t = pickerTarget;
    if (t.kind === 'urn') patchUrn(t.id, { img: src }); else patchExtra(t.id, { img: src });
    closePicker(); renderPanel(); toast('Imagen actualizada');
  }

  const num = v => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null; };

  function renderPanel() {
    $('adminTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === currentTab));
    const body = $('adminBody');
    const keepScroll = body.scrollTop;
    if (currentTab === 'urnas') {
      body.innerHTML = urns().map(u => `
<div class="adm-row ${u.soldOut ? 'soldout' : ''}" data-kind="urn" data-id="${u.id}">
  <button class="adm-thumb" data-act="img" aria-label="Cambiar imagen de ${esc(u.name)}"><img src="${esc(u.img)}" alt=""><span>Cambiar</span></button>
  <div class="adm-main">
    <strong>${esc(u.name)}</strong>
    <div class="adm-prices">${SIZES.map(([k, l]) => `
      <label>${l}<input type="text" inputmode="numeric" data-size="${k}" value="${u.prices[k] || ''}" placeholder="—"></label>`).join('')}
    </div>
    <small class="nx-muted">Deja vacío un tamaño para no ofrecerlo.</small>
  </div>
  <button class="adm-stock ${u.soldOut ? 'out' : 'in'}" data-act="stock">${u.soldOut ? 'Agotado' : 'Disponible'}</button>
</div>`).join('');
    } else if (currentTab === 'extras') {
      const c = com();
      body.innerHTML = extras().map(x => `
<div class="adm-row ${x.soldOut ? 'soldout' : ''}" data-kind="extra" data-id="${x.id}">
  <button class="adm-thumb" data-act="img" aria-label="Cambiar imagen de ${esc(x.name)}"><img src="${esc(x.img)}" alt=""><span>Cambiar</span></button>
  <div class="adm-main"><strong>${esc(x.name)}</strong>
    <div class="adm-prices one"><label>Precio (MXN)<input type="text" inputmode="numeric" data-price="1" value="${x.price}"></label></div>
  </div>
  <button class="adm-stock ${x.soldOut ? 'out' : 'in'}" data-act="stock">${x.soldOut ? 'Agotado' : 'Disponible'}</button>
</div>`).join('') + `
<div class="adm-row" data-kind="com"><div class="adm-main"><strong>Cremación comunitaria · precio por tamaño</strong>
  <div class="adm-prices">${[['chico', 'Chico'], ['mediano', 'Mediano'], ['grande', 'Grande']].map(([k, l]) => `<label>${l}<input type="text" inputmode="numeric" data-com="${k}" value="${c[k]}"></label>`).join('')}</div>
</div></div>`;
    } else {
      body.innerHTML = `
<div class="adm-backup">
  <p>Guarda una copia de tus precios, imágenes y disponibilidad, o pásala a otro dispositivo.</p>
  <div class="nx-actions wrap">
    <button class="nx-btn primary" id="bkExport">⬇ Descargar respaldo</button>
    <label class="nx-btn ghost" for="bkImport">⬆ Cargar respaldo</label><input type="file" id="bkImport" accept="application/json,.json" hidden>
  </div>
  <hr>
  <p>Si quieres volver a los precios, imágenes y disponibilidad originales:</p>
  <button class="nx-btn danger" id="bkReset">Restaurar valores originales</button>
  <hr>
  <button class="nx-btn ghost" id="bkLogout">Cerrar sesión de administración</button>
</div>`;
      $('bkExport').onclick = () => {
        const blob = new Blob([exportJson()], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'nextli-inventario-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      };
      $('bkImport').onchange = async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { importJson(await f.text()); toast('Respaldo cargado'); renderPanel(); } catch (err) { toast('Ese archivo no es un respaldo válido.'); }
      };
      $('bkReset').onclick = () => { if (confirm('¿Restaurar precios, imágenes y disponibilidad originales?')) { resetAll(); toast('Valores originales restaurados'); renderPanel(); } };
      $('bkLogout').onclick = logout;
    }
    body.scrollTop = keepScroll;
  }

  // Delegación de eventos del cuerpo del panel (se enlaza una sola vez)
  document.addEventListener('click', e => {
    const body = $('adminBody'); if (!body || !body.contains(e.target)) return;
    const row = e.target.closest('.adm-row'); const act = e.target.closest('[data-act]');
    if (!row || !act) return;
    const id = row.dataset.id, kind = row.dataset.kind;
    if (act.dataset.act === 'img') openPicker({ kind: kind === 'urn' ? 'urn' : 'extra', id });
    if (act.dataset.act === 'stock') {
      if (kind === 'urn') { const u = urns().find(x => x.id === id); patchUrn(id, { soldOut: !u.soldOut }); }
      else { const x = extras().find(x => x.id === id); patchExtra(id, { soldOut: !x.soldOut }); }
      renderPanel();
    }
  });
  document.addEventListener('change', e => {
    const body = $('adminBody'); if (!body || !body.contains(e.target)) return;
    const row = e.target.closest('.adm-row'); if (!row) return;
    const id = row.dataset.id, kind = row.dataset.kind, inp = e.target;
    if (kind === 'urn' && inp.dataset.size) {
      const v = num(inp.value);
      const base = urns().find(u => u.id === id).prices;
      const others = Object.keys(base).filter(k => k !== inp.dataset.size).length;
      if (v === null && !others) { toast('Debe quedar al menos un tamaño con precio.'); inp.value = base[inp.dataset.size] || ''; return; }
      patchUrn(id, { prices: { [inp.dataset.size]: v } });
      inp.value = v || ''; toast('Precio guardado');
    } else if (kind === 'extra' && inp.dataset.price) {
      const v = num(inp.value);
      if (!v) { toast('Escribe un precio válido.'); inp.value = extras().find(x => x.id === id).price; return; }
      patchExtra(id, { price: v }); inp.value = v; toast('Precio guardado');
    } else if (kind === 'com' && inp.dataset.com) {
      const v = num(inp.value);
      if (!v) { toast('Escribe un precio válido.'); inp.value = com()[inp.dataset.com]; return; }
      patchCom(inp.dataset.com, v); inp.value = v; toast('Precio guardado');
    }
  });

  /* ---------- Barra inferior (Modo Trabajador) ---------- */
  function bindBar() {
    const li = $('adminLoginBtn'); if (!li) return;
    li.onclick = openLogin;
    $('adminInventoryBtn').onclick = openPanel;
    $('adminLogoutBtn').onclick = () => { logout(); toast('Sesión cerrada'); };
    emitAdmin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindBar); else bindBar();
  restoreSession();

  window.NextliInventory = {
    SIZES, urns, extras, com, money,
    onChange: fn => listeners.push(fn),
    isAdmin: () => admin,
    logout,
    esc, toast, sha256Hex, remote: REMOTE
  };
})();
