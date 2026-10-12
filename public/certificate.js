/* ============================================================
   NEXTLI · Certificado de cremación
   - Se dibuja directamente en un <canvas> (sin html2canvas), usando
     un sistema de coordenadas fijo de 1179 × 912 (el formato oficial).
     Todo se escala con un solo factor, así nunca se desalinea ni se corta.
   - El PDF se arma con un escritor mínimo (una página carta horizontal
     con la imagen del certificado a página completa). Sin dependencias.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Formato oficial ---------- */
  const REF_W = 1179, REF_H = 912;               // lienzo de referencia
  const OUT_W = 3300, OUT_H = Math.round(OUT_W * REF_H / REF_W); // ≈ 11" a 300 dpi
  const PAGE_W = 792, PAGE_H = Math.round(792 * REF_H / REF_W);  // pt (carta horizontal, ajustada)

  const COLORS = {
    paper: '#f7f1e3',
    navy: '#1e2a55',
    ink: '#16130d',
    gold: ['#8a5f14', '#d6b153', '#a87a22', '#e0c068', '#8a5f14']
  };
  const F_SCRIPT = '"Great Vibes","Allura","Playfair Display",Georgia,serif';
  const F_SERIF = '"Cormorant Garamond","EB Garamond","Times New Roman",Georgia,serif';

  const SUBTITLE = ['EN HONOR A TI Y A TODO ESTE TIEMPO COMPARTIDO,', 'MUCHAS GRACIAS'];

  /* ---------- Utilidades ---------- */
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

  function loadImage(src) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  /**
   * Integra sellos y firmas sobre el papel marfil del certificado.
   * Elimina únicamente los píxeles casi blancos del fondo de la imagen,
   * conservando los trazos, colores y detalles de la huella/silueta.
   */
  function imageWithoutWhiteBackground(image) {
    if (!image) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const c = canvas.getContext('2d', { willReadFrequently: true });
      c.drawImage(image, 0, 0);
      const frame = c.getImageData(0, 0, canvas.width, canvas.height);
      const px = frame.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const min = Math.min(r, g, b), max = Math.max(r, g, b);
        // Transparencia gradual para eliminar el rectángulo blanco sin
        // borrar trazos grises, negros o dorados de la imagen original.
        if (r > 242 && g > 242 && b > 238) {
          px[i + 3] = 0;
        } else if (r > 220 && g > 220 && b > 215 && max - min < 18) {
          px[i + 3] = Math.round(px[i + 3] * (242 - min) / 22);
        }
      }
      c.putImageData(frame, 0, 0);
      return canvas;
    } catch (e) {
      // Si el navegador impide procesar el recurso, conserva la imagen.
      return image;
    }
  }

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const jobs = [
      document.fonts.load('80px "Great Vibes"', 'Certificado de cremación Nombre'),
      document.fonts.load('500 30px "Cormorant Garamond"', 'Especie Raza Edad'),
      document.fonts.load('italic 700 30px "Cormorant Garamond"', 'Canino Individual'),
      document.fonts.load('700 20px "Cormorant Garamond"', 'FECHA DE DEFUNCIÓN')
    ];
    await withTimeout(Promise.all(jobs.map(j => j.catch(() => null))), 4000);
  }

  /** true solo si la tipografía realmente se descargó (document.fonts.check devuelve true si nunca se declaró). */
  function fontLoaded(family) {
    try {
      if (!document.fonts) return false;
      return Array.from(document.fonts).some(f => f.family.replace(/["']/g, '') === family && f.status === 'loaded');
    } catch (e) { return false; }
  }

  function goldGradient(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    COLORS.gold.forEach((c, i) => g.addColorStop(i / (COLORS.gold.length - 1), c));
    return g;
  }

  /** Reduce el tamaño de fuente hasta que el texto quepa en maxW. */
  function fitFont(ctx, text, fontFor, size, minSize, maxW) {
    let s = size;
    ctx.font = fontFor(s);
    while (ctx.measureText(text).width > maxW && s > minSize) {
      s -= 1;
      ctx.font = fontFor(s);
    }
    return s;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatAge(a) {
    const t = String(a || '').trim();
    if (!t || t === '—') return '—';
    if (/^\d+([.,]\d+)?$/.test(t)) return t + (parseFloat(t.replace(',', '.')) === 1 ? ' año' : ' años');
    return t;
  }

  function speciesLabel(d) {
    if (d.kind === 'perro') return 'Canino';
    if (d.kind === 'gato') return 'Felino';
    const o = (d.otherSpecies || '').trim();
    return o ? o.charAt(0).toUpperCase() + o.slice(1) : 'Otro';
  }

  /* ---------- Ornamentos (coordenadas de referencia) ---------- */
  function spiral(ctx, cx, cy, r0, turns, startAngle, dir) {
    const steps = 90;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const a = startAngle + dir * k * turns * Math.PI * 2;
      const r = r0 * (1 - k * 0.92);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /** Esquina superior izquierda; el resto se obtiene por espejo. (0,0) = esquina del marco dorado */
  function cornerFlourish(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // remolino principal
    ctx.lineWidth = 4;
    spiral(ctx, 62, 62, 40, 1.65, Math.PI * 0.15, 1);
    ctx.lineWidth = 2.4;
    spiral(ctx, 62, 62, 25, 1.4, Math.PI * 0.6, 1);

    // cola superior (hacia la derecha)
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(100, 40);
    ctx.bezierCurveTo(130, 6, 176, 70, 214, 36);
    ctx.bezierCurveTo(236, 18, 262, 30, 252, 48);
    ctx.stroke();
    spiral(ctx, 243, 52, 16, 1.5, -Math.PI * 0.2, -1);

    // cola lateral (hacia abajo)
    ctx.beginPath();
    ctx.moveTo(40, 100);
    ctx.bezierCurveTo(6, 130, 70, 176, 36, 214);
    ctx.bezierCurveTo(18, 236, 30, 262, 48, 252);
    ctx.stroke();
    spiral(ctx, 52, 243, 16, 1.5, -Math.PI * 0.8, 1);

    // rizos interiores
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(98, 98);
    ctx.bezierCurveTo(130, 96, 150, 120, 142, 146);
    ctx.stroke();
    spiral(ctx, 138, 152, 14, 1.4, -Math.PI * 0.35, 1);
    ctx.beginPath();
    ctx.moveTo(98, 98);
    ctx.bezierCurveTo(96, 130, 120, 150, 146, 142);
    ctx.stroke();

    // pequeños "granos" dorados
    ctx.fillStyle = ctx.strokeStyle;
    [[170, 40], [40, 170], [118, 66], [66, 118]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    });
  }

  function pawPath(ctx, cx, cy, s) {
    ctx.beginPath();
    // almohadilla principal
    ctx.moveTo(cx, cy + 20 * s);
    ctx.bezierCurveTo(cx - 36 * s, cy + 22 * s, cx - 44 * s, cy - 4 * s, cx - 24 * s, cy - 16 * s);
    ctx.bezierCurveTo(cx - 12 * s, cy - 24 * s, cx + 12 * s, cy - 24 * s, cx + 24 * s, cy - 16 * s);
    ctx.bezierCurveTo(cx + 44 * s, cy - 4 * s, cx + 36 * s, cy + 22 * s, cx, cy + 20 * s);
    ctx.closePath();
    // dedos
    [[-44, -26, -0.35, 11, 15], [-16, -48, -0.1, 11, 16], [16, -48, 0.1, 11, 16], [44, -26, 0.35, 11, 15]].forEach(([dx, dy, rot, rx, ry]) => {
      ctx.moveTo(cx + dx * s + rx * s, cy + dy * s);
      ctx.ellipse(cx + dx * s, cy + dy * s, rx * s, ry * s, rot, 0, Math.PI * 2);
    });
  }

  function pawMedallion(ctx, cx, cy, gold, paper) {
    // disco que "corta" las líneas del marco detrás de la huella
    ctx.fillStyle = paper;
    ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.fill();
    // huella con doble línea
    pawPath(ctx, cx, cy + 4, 1.05);
    ctx.fillStyle = paper; ctx.fill('nonzero');
    ctx.strokeStyle = gold; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = paper; ctx.lineWidth = 2.4; ctx.stroke();
  }

  function frame(ctx, gold, paper) {
    const x0 = 66, y0 = 66, x1 = REF_W - 66, y1 = REF_H - 66;
    ctx.strokeStyle = gold; ctx.lineJoin = 'round';
    ctx.lineWidth = 3.4; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = 1.6; ctx.strokeRect(x0 + 9, y0 + 9, x1 - x0 - 18, y1 - y0 - 18);

    // florituras en las cuatro esquinas
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx * 0.72, sy * 0.72);
      ctx.strokeStyle = gold;
      cornerFlourish(ctx);
      ctx.restore();
    });

    // huellas laterales
    pawMedallion(ctx, x0 + 36, REF_H / 2 - 2, gold, paper);
    pawMedallion(ctx, x1 - 36, REF_H / 2 - 2, gold, paper);
  }

  /* ---------- Dibujo principal ---------- */
  /**
   * @param {Object} d  { name, kind, otherSpecies, breed, age, cremation, owner, date(YYYY-MM-DD), doctor:{name,title} }
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function render(d, opts) {
    opts = opts || {};
    const W = opts.width || OUT_W, H = Math.round(W * REF_H / REF_W), k = W / REF_W;
    const assets = window.NEXTLI_ASSETS || {};
    const sealSrc = opts.sealSrc || assets.seal || '/images/cert-seal.png';
    const sigSrc = opts.signatureSrc || assets.sig || '';
    const [seal, signature] = await Promise.all([
      loadImage(sealSrc),
      sigSrc ? loadImage(sigSrc) : Promise.resolve(null),
      ensureFonts()
    ]).then(([sealImage, signatureImage]) => [sealImage, signatureImage]);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const gold = goldGradient(ctx, W, H);

    // papel + marco azul
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.navy;
    const m = 12 * k, t = 22 * k;
    ctx.fillRect(m, m, W - 2 * m, t); ctx.fillRect(m, H - m - t, W - 2 * m, t);
    ctx.fillRect(m, m, t, H - 2 * m); ctx.fillRect(W - m - t, m, t, H - 2 * m);

    // a partir de aquí trabajamos en coordenadas de referencia
    ctx.save();
    ctx.scale(k, k);
    ctx.textBaseline = 'alphabetic';

    frame(ctx, gold, COLORS.paper);

    const scriptItalic = fontLoaded('Great Vibes') ? '' : 'italic ';
    const script = s => `${scriptItalic}${s}px ${F_SCRIPT}`;
    const serif = (s, w, st) => `${st || 'normal'} ${w || 500} ${s}px ${F_SERIF}`;

    // Título
    ctx.fillStyle = COLORS.ink; ctx.textAlign = 'center';
    const ts = fitFont(ctx, 'Certificado de cremación', script, 84, 50, 620);
    ctx.font = script(ts);
    ctx.fillText('Certificado de cremación', REF_W / 2, 152);

    // Subtítulo (dos líneas, mayúsculas)
    ctx.font = serif(27, 500);
    ctx.fillStyle = '#1b1810';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '1px';
    SUBTITLE.forEach((line, i) => ctx.fillText(line, REF_W / 2, 214 + i * 35));
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

    // Marcador de mascota (izquierda): huella dorada dentro de un círculo
    const px = 316, py = 325;
    ctx.strokeStyle = gold; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(px, py, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(px, py, 57, 0, Math.PI * 2); ctx.stroke();
    pawPath(ctx, px, py + 4, 1.0);
    ctx.fillStyle = '#a87a22'; ctx.fill('nonzero');

    // Nombre + línea
    const nameCx = 612, nameMax = 420;
    ctx.fillStyle = COLORS.ink; ctx.textAlign = 'center';
    const name = d.name || 'Nombre';
    const ns = fitFont(ctx, name, script, 84, 30, nameMax);
    ctx.font = script(ns);
    ctx.fillText(name, nameCx, 360);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(nameCx - 232, 396, 464, 2.2);

    // Bloque de datos
    const rows = [
      ['Especie:', speciesLabel(d)],
      ['Raza:', d.breed || '—'],
      ['Edad:', formatAge(d.age)],
      ['Tipo de cremación:', d.cremation || 'Individual'],
      ['Propietario:', d.owner || '—']
    ];
    const labelX = 302, valueCx = 800, valueMax = 380;
    rows.forEach(([label, value], i) => {
      const y = 497 + i * 39.5;
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.ink;
      ctx.font = serif(31, 500);
      ctx.fillText(label, labelX, y);
      ctx.textAlign = 'center';
      fitFont(ctx, value, s => serif(s, 700, 'italic'), 32, 18, valueMax);
      ctx.fillText(value, valueCx, y);
    });

    // Pie: fecha (izquierda)
    const footY = 782;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    fitFont(ctx, formatDate(d.date), s => serif(s, 700, 'italic'), 25, 15, 205);
    ctx.fillText(formatDate(d.date), 340, footY - 14);
    ctx.fillRect(340 - 105, footY - 4, 210, 1.6);
    ctx.font = serif(20, 700);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.5px';
    ctx.fillText('FECHA DE DEFUNCIÓN', 340, footY + 24);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

    // Pie: firma del médico (derecha). La imagen se mezcla para que el fondo blanco
    // no tape el papel del certificado; si no carga, se conserva el diseño tipográfico.
    const doc = d.doctor || { name: 'Carlos Chávez', title: 'M.V.Z' };
    if (signature) {
      const cleanSignature = imageWithoutWhiteBackground(signature);
      const maxW = 190, maxH = 70;
      const sigScale = Math.min(maxW / cleanSignature.width, maxH / cleanSignature.height);
      const sigW = cleanSignature.width * sigScale, sigH = cleanSignature.height * sigScale;
      ctx.save();
      ctx.drawImage(cleanSignature, 840 - sigW / 2, footY - 13 - sigH, sigW, sigH);
      ctx.restore();
    }
    ctx.fillRect(840 - 105, footY - 4, 210, 1.6);
    ctx.font = serif(26, 700, 'italic');
    ctx.fillText(doc.name, 840, footY + 24);
    ctx.font = serif(22, 600);
    ctx.fillText(doc.title, 840, footY + 50);

    // Sello circular central
    const sx = REF_W / 2, sy = 790, sr = 66;
    ctx.fillStyle = COLORS.paper;
    ctx.beginPath(); ctx.arc(sx, sy, sr + 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = gold; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(sx, sy, sr - 9, 0, Math.PI * 2); ctx.stroke();
    if (seal) {
      const cleanSeal = imageWithoutWhiteBackground(seal);
      const box = (sr - 11) * 2;
      const sc = Math.min(box / cleanSeal.width, box / cleanSeal.height);
      const w = cleanSeal.width * sc, h = cleanSeal.height * sc;
      ctx.drawImage(cleanSeal, sx - w / 2, sy - h / 2, w, h);
    }

    ctx.restore();
    return cv;
  }

  /* ---------- PDF mínimo (1 página con imagen JPEG) ---------- */
  function canvasToJpegBytes(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => {
        if (!b) return reject(new Error('No se pudo generar la imagen del certificado.'));
        b.arrayBuffer().then(buf => resolve(new Uint8Array(buf)), reject);
      }, 'image/jpeg', quality || 0.93);
    });
  }

  function buildPdf(jpeg, imgW, imgH, title) {
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let length = 0;
    const push = data => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      parts.push(bytes); length += bytes.length;
    };
    const obj = (n, body) => { offsets[n] = length; push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); };

    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`);
    // Imagen
    offsets[4] = length;
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\nendobj\n');
    const content = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const safeTitle = String(title || 'Certificado de cremación').replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '');
    obj(6, `<< /Title (${safeTitle}) /Producer (NEXTLI) >>`);

    const xrefPos = length;
    let xref = `xref\n0 7\n0000000000 65535 f \n`;
    for (let i = 1; i <= 6; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(xref);
    push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

    const out = new Uint8Array(length);
    let p = 0;
    parts.forEach(b => { out.set(b, p); p += b.length; });
    return out;
  }

  async function toPdfBlob(canvas, title) {
    const jpeg = await canvasToJpegBytes(canvas, 0.93);
    const bytes = buildPdf(jpeg, canvas.width, canvas.height, title);
    return new Blob([bytes], { type: 'application/pdf' });
  }

  window.NextliCertificate = { render, toPdfBlob, formatDate, formatAge, speciesLabel, REF_W, REF_H };
})();
