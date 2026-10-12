'use strict';
// Generatore di PDF scritto apposta: niente librerie esterne, funziona offline.
// Usa i font standard Helvetica (presenti in ogni lettore PDF), le foto JPEG così come sono
// e disegni vettoriali (gli schemi dei serramenti restano nitidi a qualsiasi ingrandimento).
const PDF = (() => {
  const W = 595.28, H = 841.89; // A4 in punti

  // Caratteri fuori dall'alfabeto latino base -> codici WinAnsi
  const WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

  // Larghezze dei caratteri ASCII 32..126 (millesimi di em) per Helvetica e Helvetica-Bold
  const HV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const EXTRA = { '°': 400, '×': 584, '€': 556, '–': 556, '—': 1000, '•': 350, '…': 1000, '‘': 222, '’': 222, '“': 333, '”': 333, '«': 556, '»': 556, '·': 278, '²': 333, '³': 333, 'ß': 611, 'ø': 611, 'Ø': 778, 'æ': 889, 'Æ': 1000 };

  const pulisci = s => String(s ?? '').normalize('NFC').replace(/[\t\r\n]+/g, ' ');

  function larg(s, size, bold) {
    const T = bold ? HB : HV; let w = 0;
    for (const ch of pulisci(s)) {
      const c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126) w += T[c - 32];
      else if (EXTRA[ch]) w += EXTRA[ch];
      else { const b = ch.normalize('NFD').charCodeAt(0); w += (b >= 32 && b <= 126) ? T[b - 32] : 556; }
    }
    return w * size / 1000;
  }

  // Stringa PDF (solo caratteri ASCII, il resto in ottale)
  function str(s) {
    let out = '(';
    for (const ch of pulisci(s)) {
      let c = ch.codePointAt(0);
      if (WIN[c]) c = WIN[c];
      else if (c > 255 || (c >= 0x80 && c < 0xA0)) {
        const b = ch.normalize('NFD').charCodeAt(0);
        c = b < 128 ? b : 63;
      }
      if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c);
      else if (c < 32 || c > 126) out += '\\' + c.toString(8).padStart(3, '0');
      else out += String.fromCharCode(c);
    }
    return out + ')';
  }

  const num = n => (Math.round(n * 100) / 100).toString();
  function rgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map(i => num(parseInt(h.substr(i, 2), 16) / 255)).join(' ');
  }
  const byteLatin = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };

  async function comprimi(b) {
    try {
      if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null;
      const flusso = new Blob([b]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Uint8Array(await new Response(flusso).arrayBuffer());
    } catch (e) { return null; }
  }

  // Colori degli schemi dei serramenti nel PDF
  const STILE = {
    telaio: { f: '#ffffff', s: '#1f2937' }, anta: { s: '#1f2937' }, bordo: { s: '#1f2937' },
    vetro: { f: '#e7f0fb', s: '#64748b' }, opaco: { f: '#dde1e7', s: '#64748b' },
    apertura: { s: '#6b7480' }, maniglia: { f: '#ea580c' },
    cass: { f: '#cfd5dc', s: '#1f2937' }, guida: { f: '#e5e8ec', s: '#64748b' }, telo: { f: '#f3f4f6', s: '#64748b' },
    stecca: { s: '#9aa3ad' }, cieca: { f: '#cfd5dc' }, paletto: { f: '#475569' },
    rete: { s: '#c3cad2' }, 'rete-fondo': { f: '#f6f7f9' },
    quota: { s: '#c2410c' }, 'quota-fine': { s: '#eab08f' }, qt: { c: '#c2410c' }, lettera: { c: '#94a3b8' },
  };

  class Doc {
    constructor() { this.pagine = []; this.img = []; this.p = null; }
    pagina() { this.p = { ops: [], img: new Set() }; this.pagine.push(this.p); return this.p; }
    testo(x, y, s, size = 10, bold = false, col = '#14171c') {
      this.p.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(col)} rg ${num(x)} ${num(H - y)} Td ${str(s)} Tj ET`);
    }
    testoDx(xDestra, y, s, size, bold, col) { this.testo(xDestra - larg(s, size, bold), y, s, size, bold, col); }
    testoCentro(xc, y, s, size, bold, col) { this.testo(xc - larg(s, size, bold) / 2, y, s, size, bold, col); }
    // testo verticale (dal basso verso l'alto) centrato in (xc, yc)
    testoSu(xc, yc, s, size, bold, col) {
      const l = larg(s, size, bold);
      this.p.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(col)} rg 0 1 -1 0 ${num(xc + size * 0.35)} ${num(H - (yc + l / 2))} Tm ${str(s)} Tj ET`);
    }
    rett(x, y, w, h, riemp, bordo, spess = 0.6) {
      let o = '';
      if (riemp) o += rgb(riemp) + ' rg ';
      if (bordo) o += rgb(bordo) + ' RG ' + num(spess) + ' w ';
      o += `${num(x)} ${num(H - y - h)} ${num(w)} ${num(h)} re ` + (riemp && bordo ? 'B' : riemp ? 'f' : 'S');
      this.p.ops.push(o);
    }
    linea(x1, y1, x2, y2, col = '#d5dae0', spess = 0.6, tratteggio) {
      this.p.ops.push(`${tratteggio ? `[${num(tratteggio[0])} ${num(tratteggio[1])}] 0 d ` : ''}${rgb(col)} RG ${num(spess)} w ${num(x1)} ${num(H - y1)} m ${num(x2)} ${num(H - y2)} l S${tratteggio ? ' [] 0 d' : ''}`);
    }
    jpeg(byte, w, h) { this.img.push({ byte, w, h }); return 'Im' + this.img.length; }
    disegna(nome, x, y, w, h) { this.p.img.add(nome); this.p.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(H - y - h)} cm /${nome} Do Q`); }
    // schema vettoriale prodotto da disegno.js
    schema(sc, ox, oy, k) {
      for (const o of sc.ops) {
        const st = STILE[o.cl] || { s: '#333333' };
        const sp = Math.max(0.25, (o.sw || 0) * k);
        if (o.t === 'R') this.rett(ox + o.x * k, oy + o.y * k, o.w * k, o.h * k, st.f, o.sw ? st.s : null, sp);
        else if (o.t === 'L') { if (o.sw && st.s) this.linea(ox + o.x1 * k, oy + o.y1 * k, ox + o.x2 * k, oy + o.y2 * k, st.s, sp, o.dash ? [2 * k + 0.6, 1.4 * k + 0.4] : null); }
        else if (o.t === 'T') {
          const size = o.size * k, col = st.c || '#333333';
          if (o.rot) this.testoSu(ox + o.x * k, oy + o.y * k, o.s, size, true, col);
          else this.testoCentro(ox + o.x * k, oy + o.y * k + size * 0.35, o.s, size, true, col);
        }
      }
    }

    async crea(titolo) {
      const contenuti = await Promise.all(this.pagine.map(async pg => {
        const grezzo = byteLatin(pg.ops.join('\n'));
        const z = await comprimi(grezzo);
        return z && z.length < grezzo.length ? { dati: z, filtro: '/Filter /FlateDecode' } : { dati: grezzo, filtro: '' };
      }));
      const parti = []; let off = 0; const xref = [];
      const metti = x => { const b = typeof x === 'string' ? byteLatin(x) : x; parti.push(b); off += b.length; };
      let n = 5;
      const numImg = this.img.map(() => ++n);
      const numPag = [], numCont = [];
      this.pagine.forEach(() => { numPag.push(++n); numCont.push(++n); });
      const ogg = (i, corpo) => { xref[i] = off; metti(`${i} 0 obj\n`); metti(corpo); metti('\nendobj\n'); };
      const flusso = (i, diz, dati) => { xref[i] = off; metti(`${i} 0 obj\n<< ${diz} /Length ${dati.length} >>\nstream\n`); metti(dati); metti('\nendstream\nendobj\n'); };

      metti('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      ogg(1, '<< /Type /Catalog /Pages 2 0 R >>');
      ogg(2, `<< /Type /Pages /Kids [${numPag.map(i => i + ' 0 R').join(' ')}] /Count ${numPag.length} >>`);
      ogg(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      ogg(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const d = new Date(), p2 = v => String(v).padStart(2, '0');
      const data = `D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
      ogg(5, `<< /Title ${str(titolo || 'Rilievo')} /Producer (Rilievi Serramenti) /CreationDate (${data}) >>`);
      this.img.forEach((im, i) => flusso(numImg[i], `/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, im.byte));
      this.pagine.forEach((pg, i) => {
        const xo = [...pg.img].map(nm => `/${nm} ${numImg[+nm.slice(2) - 1]} 0 R`).join(' ');
        ogg(numPag[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo ? ` /XObject << ${xo} >>` : ''} >> /Contents ${numCont[i]} 0 R >>`);
        flusso(numCont[i], contenuti[i].filtro, contenuti[i].dati);
      });
      const inizioXref = off;
      let x = `xref\n0 ${n + 1}\n0000000000 65535 f \n`;
      for (let i = 1; i <= n; i++) x += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
      metti(x);
      metti(`trailer\n<< /Size ${n + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inizioXref}\n%%EOF\n`);
      const tot = new Uint8Array(off); let pos = 0;
      for (const b of parti) { tot.set(b, pos); pos += b.length; }
      return tot;
    }
  }

  // Impaginazione a "flusso": coppie [etichetta, valore] che vanno a capo da sole.
  // Restituisce righe di pezzi { x, t, g (grigio) }.
  function impagina(coppie, maxW, size) {
    const sp = larg(' ', size), gap = larg('   ·   ', size), mezzo = larg('   ', size);
    const righe = [[]]; let x = 0;
    for (const [etich, valore] of coppie) {
      let parole = pulisci(valore).split(' ').filter(Boolean);
      parole = parole.flatMap(p => {
        if (larg(p, size) <= maxW) return [p];
        const pezzi = []; let cur = '';
        for (const ch of p) { if (larg(cur + ch, size) > maxW && cur) { pezzi.push(cur); cur = ''; } cur += ch; }
        if (cur) pezzi.push(cur);
        return pezzi;
      });
      if (!parole.length) continue;
      parole.forEach((p, i) => {
        const parti = i === 0 && etich ? [{ t: etich + ': ', g: true }, { t: p }] : [{ t: p }];
        const w = parti.reduce((s, q) => s + larg(q.t, size), 0);
        let sep = x === 0 ? 0 : (i === 0 ? gap : sp);
        if (x > 0 && x + sep + w > maxW) { righe.push([]); x = 0; sep = 0; }
        if (sep === gap) righe[righe.length - 1].push({ x: x + mezzo, t: '·', g: true });
        x += sep;
        for (const q of parti) { righe[righe.length - 1].push({ x, t: q.t, g: q.g }); x += larg(q.t, size); }
      });
    }
    return righe.filter(r => r.length);
  }

  // Testo semplice che va a capo (le parole troppo lunghe vengono spezzate)
  function aCapo(s, maxW, size, bold) {
    const righe = []; let cur = '';
    for (let p of pulisci(s).split(' ').filter(Boolean)) {
      while (larg(p, size, bold) > maxW && p.length > 1) {
        let i = p.length - 1; while (i > 1 && larg(p.slice(0, i), size, bold) > maxW) i--;
        if (cur) { righe.push(cur); cur = ''; }
        righe.push(p.slice(0, i)); p = p.slice(i);
      }
      const prova = cur ? cur + ' ' + p : p;
      if (larg(prova, size, bold) <= maxW || !cur) cur = prova; else { righe.push(cur); cur = p; }
    }
    if (cur) righe.push(cur);
    return righe.length ? righe : [''];
  }

  const INK = '#14171c', GRIGIO = '#6b7480', CHIARO = '#d5dae0', FASCIA = '#eef0f3', ROSSO = '#c2410c', ZEBRA = '#f7f8fa';

  /* Report del rilievo.
     d = { titolo, intest:{azienda,tecnico,telefono,logo:{byte,w,h}}, info:[[etichetta,valore]], riepilogo:[[nome,n]], note,
           stanze:[{ nome, articoli:[{ pos, titolo, q, misure, mancano, coppie, note, colore, schema, foto:[{byte,w,h}] }] }],
           firma:{byte,w,h,nome,quando}, distinta:[{ titolo, colore, righe:[{pos,stanza,misure,mancano,q,dettagli}] }], piede } */
  async function rilievo(d) {
    const doc = new Doc();
    const M = 40, CW = W - 2 * M, FONDO = H - 50;
    let y = 0;
    const nuova = () => { doc.pagina(); y = M; };
    const serve = h => { if (y + h > FONDO) { nuova(); return true; } return false; };
    nuova();

    // --- Intestazione ---
    const az = d.intest || {};
    let yA = y, largAz = 0;
    if (az.logo && az.logo.byte) {
      const s = Math.min(150 / az.logo.w, 46 / az.logo.h);
      const lw = az.logo.w * s, lh = az.logo.h * s;
      doc.disegna(doc.jpeg(az.logo.byte, az.logo.w, az.logo.h), W - M - lw, y, lw, lh);
      yA = y + lh + 6; largAz = lw + 20;
    }
    const righeAz = [az.azienda && [az.azienda, 11, true, INK], az.tecnico && ['Tecnico: ' + az.tecnico, 8.5, false, GRIGIO], az.telefono && ['Tel. ' + az.telefono, 8.5, false, GRIGIO]].filter(Boolean);
    yA += righeAz.length ? 10 : 0;
    for (const [t, s, b, c] of righeAz) { doc.testoDx(W - M, yA, t, s, b, c); yA += s + 4; largAz = Math.max(largAz, larg(t, s, b) + 20); }
    largAz = Math.min(largAz, CW * 0.45);
    doc.testo(M, y + 9, 'RILIEVO MISURE', 8, true, ROSSO);
    let yT = y + 16;
    for (const r of aCapo(d.titolo, CW - largAz, 19, true)) { yT += 21; doc.testo(M, yT, r, 19, true, INK); }
    y = Math.max(yT + 14, yA + 2);

    // Riquadro dati (due colonne)
    const info = d.info.filter(([, v]) => v);
    const colW = (CW - 16) / 2;
    const celle = info.map(([e, v]) => ({ e, r: aCapo(v, colW - 12, 10, false) }));
    const meta = Math.ceil(celle.length / 2);
    const col1 = celle.slice(0, meta), col2 = celle.slice(meta);
    const hCol = c => c.reduce((s, x) => s + 12 + x.r.length * 13 + 5, 0);
    const hBox = Math.max(hCol(col1), hCol(col2)) + 12;
    doc.rett(M, y, CW, hBox, '#f7f8fa', CHIARO);
    [col1, col2].forEach((col, i) => {
      let yy = y + 8; const x = M + 10 + i * (colW + 16);
      for (const c of col) {
        doc.testo(x, yy + 8, c.e.toUpperCase(), 6.8, true, GRIGIO); yy += 12;
        for (const r of c.r) { yy += 13; doc.testo(x, yy - 2, r, 10, false, INK); }
        yy += 5;
      }
    });
    y += hBox + 14;

    // Riepilogo quantità
    if (d.riepilogo && d.riepilogo.length) {
      doc.testo(M, y + 8, 'RIEPILOGO', 7.5, true, GRIGIO);
      let x = M + 62;
      for (const [nome, n] of d.riepilogo) {
        const t = `${n} ${nome}`; const w = larg(t, 9.5, true) + 16;
        if (x + w > W - M) { x = M + 62; y += 20; }
        doc.rett(x, y - 2, w, 16, FASCIA, null);
        doc.testo(x + 8, y + 9.5, t, 9.5, true, INK);
        x += w + 6;
      }
      y += 26;
    }

    // Note generali
    if (d.note) {
      const righe = aCapo(d.note, CW, 9.5, false);
      serve(18 + righe.length * 12.5);
      doc.testo(M, y + 8, 'NOTE GENERALI', 7.5, true, GRIGIO); y += 14;
      for (const r of righe) { y += 12.5; doc.testo(M, y - 2, r, 9.5, false, INK); }
      y += 12;
    }

    // --- Articoli per stanza ---
    const xDis = M + 34, wDis = 58, hDis = 68;
    const xMid = M + 34 + wDis + 10, xDx = W - M, wDx = 104, wMid = xDx - wDx - 8 - xMid;
    const misuraRiga = a => {
      const tit = aCapo(a.titolo, wMid, 11.5, true);
      const det = impagina(a.coppie, wMid, 8.6);
      const nt = a.note ? impagina([['Note', a.note]], wMid, 8.6) : [];
      const hMid = 6 + tit.length * 14 + (det.length ? 3 + det.length * 11.5 : 0) + (nt.length ? 3 + nt.length * 11.5 : 0);
      return { tit, det, nt, h: Math.max(hMid, a.schema ? hDis + 4 : 48) + 8 };
    };
    const fascia = (nome, n, segue) => {
      doc.rett(M, y, CW, 22, FASCIA, null);
      doc.testo(M + 9, y + 15, (nome + (segue ? '  (segue)' : '')).toUpperCase(), 9.5, true, INK);
      if (!segue) doc.testoDx(W - M - 9, y + 15, n === 1 ? '1 articolo' : `${n} articoli`, 8, false, GRIGIO);
      y += 26;
    };

    for (const s of d.stanze) {
      if (!s.articoli.length) {
        serve(40); fascia(s.nome, 0, false);
        doc.testo(M + 9, y + 10, 'Nessun articolo inserito', 9, false, GRIGIO); y += 24;
        continue;
      }
      const prima = misuraRiga(s.articoli[0]);
      serve(26 + prima.h);
      fascia(s.nome, s.articoli.length, false);
      s.articoli.forEach((a, i) => {
        const m = i === 0 ? prima : misuraRiga(a);
        if (serve(m.h)) fascia(s.nome, 0, true);
        const y0 = y;
        doc.rett(M, y0 + 2, 3, m.h - 10, a.colore || '#888888', null);
        doc.testo(M + 10, y0 + 12, 'POS.', 6.5, true, GRIGIO);
        doc.testo(M + 10, y0 + 29, String(a.pos), 16, true, INK);
        if (a.schema) {
          const k = Math.min(wDis / a.schema.W, hDis / a.schema.H);
          doc.schema(a.schema, xDis + (wDis - a.schema.W * k) / 2, y0 + 3, k);
        }
        let yy = y0 + 6;
        for (const r of m.tit) { yy += 14; doc.testo(xMid, yy - 2, r, 11.5, true, INK); }
        if (m.det.length) yy += 3;
        for (const riga of m.det) { yy += 11.5; for (const p of riga) doc.testo(xMid + p.x, yy - 2, p.t, 8.6, false, p.g ? GRIGIO : INK); }
        if (m.nt.length) yy += 3;
        for (const riga of m.nt) { yy += 11.5; for (const p of riga) doc.testo(xMid + p.x, yy - 2, p.t, 8.6, false, p.g ? GRIGIO : '#3b424b'); }
        if (a.misure) {
          doc.testoDx(xDx, y0 + 19, a.misure, 14, true, a.mancano ? ROSSO : INK);
          doc.testoDx(xDx, y0 + 29, a.mancano ? 'MISURE MANCANTI' : 'L × H  mm', 6.8, true, a.mancano ? ROSSO : GRIGIO);
          doc.testoDx(xDx, y0 + 44, `Q.tà ${a.q}`, 10, true, INK);
        } else doc.testoDx(xDx, y0 + 19, `Q.tà ${a.q}`, 10, true, INK);
        y += m.h;
        doc.linea(xDis, y - 4, W - M, y - 4, CHIARO, 0.5);
      });
      y += 10;
    }

    // --- Firma del cliente ---
    if (d.firma && d.firma.byte) {
      const s = Math.min(220 / d.firma.w, 80 / d.firma.h);
      const fw = d.firma.w * s, fh = d.firma.h * s;
      serve(fh + 54);
      y += 6;
      doc.testo(M, y + 8, 'FIRMA DEL CLIENTE PER PRESA VISIONE', 7.5, true, GRIGIO);
      y += 14;
      doc.rett(M, y, fw + 16, fh + 12, null, CHIARO, 0.5);
      doc.disegna(doc.jpeg(d.firma.byte, d.firma.w, d.firma.h), M + 8, y + 6, fw, fh);
      y += fh + 12;
      doc.testo(M, y + 13, [d.firma.nome, d.firma.quando].filter(Boolean).join(' · '), 9, false, INK);
      y += 26;
    }

    // --- Distinta per tipo (per preparare gli ordini) ---
    if (d.distinta && d.distinta.length) {
      nuova();
      doc.testo(M, y + 13, 'DISTINTA PER TIPO', 14, true, INK);
      doc.testo(M, y + 27, 'Gli stessi articoli raggruppati per tipo, per preparare gli ordini.', 8.5, false, GRIGIO);
      y += 40;
      const cPos = M + 4, cSt = M + 34, cMis = M + 132, cQ = M + 214, cDet = M + 248, wDet = W - M - cDet;
      const intest = () => {
        doc.testo(cPos, y + 8, 'POS.', 6.5, true, GRIGIO); doc.testo(cSt, y + 8, 'STANZA', 6.5, true, GRIGIO);
        doc.testo(cMis, y + 8, 'L × H (MM)', 6.5, true, GRIGIO); doc.testo(cQ, y + 8, 'Q.TÀ', 6.5, true, GRIGIO);
        doc.testo(cDet, y + 8, 'DETTAGLI', 6.5, true, GRIGIO);
        y += 13;
      };
      for (const g of d.distinta) {
        const tot = g.righe.reduce((s, r) => s + r.q, 0);
        serve(26 + 13 + 18);
        doc.rett(M, y, CW, 22, FASCIA, null);
        doc.rett(M, y, 3, 22, g.colore || '#888888', null);
        doc.testo(M + 10, y + 15, g.titolo.toUpperCase(), 9.5, true, INK);
        doc.testoDx(W - M - 9, y + 15, tot === 1 ? '1 pezzo' : `${tot} pezzi`, 8, true, INK);
        y += 26;
        intest();
        g.righe.forEach((r, i) => {
          const det = aCapo(r.dettagli || '—', wDet, 8.2, false);
          const st = aCapo(r.stanza, cMis - cSt - 6, 8.5, false);
          const h = Math.max(det.length, st.length) * 10.5 + 6;
          if (serve(h)) { doc.testo(M, y + 10, g.titolo.toUpperCase() + '  (segue)', 8, true, GRIGIO); y += 16; intest(); }
          if (i % 2 === 0) doc.rett(M, y, CW, h, ZEBRA, null);
          doc.testo(cPos, y + 11, String(r.pos), 8.5, true, INK);
          st.forEach((t, j) => doc.testo(cSt, y + 11 + j * 10.5, t, 8.5, false, INK));
          doc.testo(cMis, y + 11, r.misure || '—', 9, true, r.mancano ? ROSSO : INK);
          doc.testo(cQ + 6, y + 11, String(r.q), 9, true, INK);
          det.forEach((t, j) => doc.testo(cDet, y + 11 + j * 10.5, t, 8.2, false, '#3b424b'));
          y += h;
        });
        y += 12;
      }
    }

    // --- Foto ---
    const conFoto = d.stanze.flatMap(s => s.articoli.map(a => ({ a, s }))).filter(x => x.a.foto && x.a.foto.length);
    if (conFoto.length) {
      nuova();
      doc.testo(M, y + 12, 'FOTO', 13, true, INK); y += 26;
      const cw = (CW - 12) / 2, maxH = 290;
      const dim = f => { let w = cw, h = cw * f.h / f.w; if (h > maxH) { h = maxH; w = h * f.w / f.h; } return { w, h }; };
      for (const { a, s } of conFoto) {
        const coppie = [];
        for (let i = 0; i < a.foto.length; i += 2) coppie.push(a.foto.slice(i, i + 2));
        const hRiga = r => Math.max(...r.map(f => dim(f).h));
        const didascalia = `Pos. ${a.pos} · ${s.nome} · ${a.titolo}${a.misure ? ' · ' + a.misure + ' mm' : ''}`;
        serve(22 + hRiga(coppie[0]));
        doc.testo(M, y + 10, didascalia, 9.5, true, INK); y += 18;
        for (const r of coppie) {
          const hr = hRiga(r);
          if (serve(hr + 10)) { doc.testo(M, y + 10, didascalia + '  (segue)', 9.5, true, INK); y += 18; }
          r.forEach((f, i) => {
            const { w, h } = dim(f);
            const nome = doc.jpeg(f.byte, f.w, f.h);
            const fx = M + i * (cw + 12) + (cw - w) / 2;
            doc.disegna(nome, fx, y, w, h);
            doc.rett(fx, y, w, h, null, CHIARO, 0.5);
          });
          y += hr + 10;
        }
        y += 8;
      }
    }

    // --- Piè di pagina ---
    const tot = doc.pagine.length;
    doc.pagine.forEach((pg, i) => {
      doc.p = pg;
      doc.linea(M, H - 36, W - M, H - 36, CHIARO, 0.5);
      const piede = d.piede || '';
      const pd = larg(piede, 7.5) > CW - 90 ? aCapo(piede, CW - 90, 7.5)[0] + '…' : piede;
      doc.testo(M, H - 24, pd, 7.5, false, GRIGIO);
      doc.testoDx(W - M, H - 24, `Pagina ${i + 1} di ${tot}`, 7.5, false, GRIGIO);
    });

    return doc.crea(d.titolo);
  }

  return { rilievo, larg, Doc };
})();
if (typeof module !== 'undefined') module.exports = PDF;
