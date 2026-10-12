'use strict';
// Generatore di PDF minimo, scritto apposta: niente librerie esterne, funziona offline.
// Usa i font standard Helvetica (già presenti in ogni lettore PDF) e le foto JPEG così come sono.
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

  class Doc {
    constructor() { this.pagine = []; this.img = []; this.p = null; }
    pagina() { this.p = { ops: [], img: new Set() }; this.pagine.push(this.p); return this.p; }
    testo(x, y, s, size = 10, bold = false, col = '#14171c') {
      this.p.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(col)} rg ${num(x)} ${num(H - y)} Td ${str(s)} Tj ET`);
    }
    testoDx(xDestra, y, s, size, bold, col) { this.testo(xDestra - larg(s, size, bold), y, s, size, bold, col); }
    rett(x, y, w, h, riemp, bordo, spess = 0.6) {
      let o = '';
      if (riemp) o += rgb(riemp) + ' rg ';
      if (bordo) o += rgb(bordo) + ' RG ' + num(spess) + ' w ';
      o += `${num(x)} ${num(H - y - h)} ${num(w)} ${num(h)} re ` + (riemp && bordo ? 'B' : riemp ? 'f' : 'S');
      this.p.ops.push(o);
    }
    linea(x1, y1, x2, y2, col = '#d5dae0', spess = 0.6) {
      this.p.ops.push(`${rgb(col)} RG ${num(spess)} w ${num(x1)} ${num(H - y1)} m ${num(x2)} ${num(H - y2)} l S`);
    }
    jpeg(byte, w, h) { this.img.push({ byte, w, h }); return 'Im' + this.img.length; }
    disegna(nome, x, y, w, h) { this.p.img.add(nome); this.p.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(H - y - h)} cm /${nome} Do Q`); }

    crea(titolo) {
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
        flusso(numCont[i], '', byteLatin(pg.ops.join('\n')));
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
  // Restituisce righe di pezzi { x, t, g (grigio), b (grassetto) }.
  function impagina(coppie, maxW, size) {
    const sp = larg(' ', size), gap = larg('   ·   ', size), mezzo = larg('   ', size);
    const righe = [[]]; let x = 0;
    for (const [etich, valore] of coppie) {
      let parole = pulisci(valore).split(' ').filter(Boolean);
      // parole lunghissime: le spezzo
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

  // Testo semplice che va a capo
  function aCapo(s, maxW, size, bold) {
    const righe = []; let cur = '';
    for (const p of pulisci(s).split(' ').filter(Boolean)) {
      const prova = cur ? cur + ' ' + p : p;
      if (larg(prova, size, bold) <= maxW || !cur) cur = prova; else { righe.push(cur); cur = p; }
    }
    if (cur) righe.push(cur);
    return righe.length ? righe : [''];
  }

  const INK = '#14171c', GRIGIO = '#6b7480', CHIARO = '#d5dae0', FASCIA = '#eef0f3', ROSSO = '#c2410c';

  /* Report del rilievo.
     d = { titolo, intest:{azienda,tecnico,telefono}, info:[[etichetta,valore]], riepilogo:[[nome,n]], note,
           stanze:[{ nome, articoli:[{ pos, titolo, q, misure, mancano, coppie, note, colore, foto:[{byte,w,h}] }] }],
           piede, nomeFile } */
  function rilievo(d) {
    const doc = new Doc();
    const M = 40, CW = W - 2 * M, FONDO = H - 50;
    let y = 0;
    const nuova = () => { doc.pagina(); y = M; };
    const serve = h => { if (y + h > FONDO) { nuova(); return true; } return false; };
    nuova();

    // --- Intestazione ---
    const az = d.intest || {};
    const righeAz = [az.azienda && [az.azienda, 11, true, INK], az.tecnico && ['Tecnico: ' + az.tecnico, 8.5, false, GRIGIO], az.telefono && ['Tel. ' + az.telefono, 8.5, false, GRIGIO]].filter(Boolean);
    let yA = y + 10;
    for (const [t, s, b, c] of righeAz) { doc.testoDx(W - M, yA, t, s, b, c); yA += s + 4; }
    const largAz = righeAz.length ? Math.max(...righeAz.map(([t, s, b]) => larg(t, s, b))) + 20 : 0;
    doc.testo(M, y + 9, 'RILIEVO MISURE', 8, true, ROSSO);
    y += 16;
    for (const r of aCapo(d.titolo, CW - largAz, 19, true)) { y += 21; doc.testo(M, y, r, 19, true, INK); }
    y = Math.max(y + 14, yA + 4);

    // Riquadro dati (due colonne)
    const info = d.info.filter(([, v]) => v);
    const colW = (CW - 16) / 2;
    const celle = info.map(([e, v]) => ({ e, r: aCapo(v, colW - 12, 10, false) }));
    const metà = Math.ceil(celle.length / 2);
    const col1 = celle.slice(0, metà), col2 = celle.slice(metà);
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
    const xMid = M + 44, xDx = W - M, wDx = 118, wMid = CW - 44 - wDx - 10;
    const misuraRiga = a => {
      const tit = aCapo(a.titolo, wMid, 11.5, true);
      const det = impagina(a.coppie, wMid, 8.8);
      const nt = a.note ? impagina([['Note', a.note]], wMid, 8.8) : [];
      const hMid = 6 + tit.length * 14 + (det.length ? 3 + det.length * 12 : 0) + (nt.length ? 3 + nt.length * 12 : 0);
      return { tit, det, nt, h: Math.max(hMid, 46) + 8 };
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
        let yy = y0 + 6;
        for (const r of m.tit) { yy += 14; doc.testo(xMid, yy - 2, r, 11.5, true, INK); }
        if (m.det.length) yy += 3;
        for (const riga of m.det) { yy += 12; for (const p of riga) doc.testo(xMid + p.x, yy - 2, p.t, 8.8, false, p.g ? GRIGIO : INK); }
        if (m.nt.length) yy += 3;
        for (const riga of m.nt) { yy += 12; for (const p of riga) doc.testo(xMid + p.x, yy - 2, p.t, 8.8, false, p.g ? GRIGIO : '#3b424b'); }
        if (a.misure) {
          doc.testoDx(xDx, y0 + 19, a.misure, 14, true, a.mancano ? ROSSO : INK);
          doc.testoDx(xDx, y0 + 29, a.mancano ? 'MISURE MANCANTI' : 'L × H  mm', 6.8, true, a.mancano ? ROSSO : GRIGIO);
          doc.testoDx(xDx, y0 + 44, `Q.tà ${a.q}`, 10, true, INK);
        } else doc.testoDx(xDx, y0 + 19, `Q.tà ${a.q}`, 10, true, INK);
        y += m.h;
        doc.linea(xMid, y - 4, W - M, y - 4, CHIARO, 0.5);
      });
      y += 10;
    }

    // --- Foto ---
    const conFoto = d.stanze.flatMap(s => s.articoli.map(a => ({ a, s }))).filter(x => x.a.foto && x.a.foto.length);
    if (conFoto.length) {
      nuova();
      doc.testo(M, y + 12, 'FOTO', 13, true, INK); y += 26;
      const cw = (CW - 12) / 2, maxH = 290;
      const dim = f => { let w = cw, h = cw * f.h / f.w; if (h > maxH) { h = maxH; w = h * f.w / f.h; } return { w, h }; };
      for (const { a, s } of conFoto) {
        const coppiaFoto = [];
        for (let i = 0; i < a.foto.length; i += 2) coppiaFoto.push(a.foto.slice(i, i + 2));
        const hRiga = r => Math.max(...r.map(f => dim(f).h));
        const didascalia = `Pos. ${a.pos} · ${s.nome} · ${a.titolo}${a.misure ? ' · ' + a.misure + ' mm' : ''}`;
        serve(22 + hRiga(coppiaFoto[0]));
        doc.testo(M, y + 10, didascalia, 9.5, true, INK); y += 18;
        for (const r of coppiaFoto) {
          const hr = hRiga(r);
          if (serve(hr + 10)) { doc.testo(M, y + 10, didascalia + '  (segue)', 9.5, true, INK); y += 18; }
          r.forEach((f, i) => {
            const { w, h } = dim(f);
            const nome = doc.jpeg(f.byte, f.w, f.h);
            doc.disegna(nome, M + i * (cw + 12) + (cw - w) / 2, y, w, h);
            doc.rett(M + i * (cw + 12) + (cw - w) / 2, y, w, h, null, CHIARO, 0.5);
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
