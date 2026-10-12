'use strict';
// Disegni tecnici semplificati dei serramenti (visti da dentro), generati dai dati dell'articolo.
// Producono "primitive" (rettangoli, linee, testi): l'app le trasforma in SVG, il PDF in grafica vettoriale.
const DISEGNO = (() => {
  const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const PRED = { finestra: [1000, 1300], pf: [900, 2250], tapparella: [1000, 1400], zanzariera: [1000, 1400] };
  const t1 = n => Math.round(n * 10) / 10;

  // "2 Ante" -> [A, A]; "1 Anta e 1 Fisso" -> [A, F]; "2 Ante + sopraluce fisso" -> [A, A] con sopraluce
  function ante(comp) {
    const s = norm(comp);
    const sopraluce = /sopra\s*luce/.test(s), sottoluce = /sotto\s*luce/.test(s);
    const pulito = s.replace(/(sopra|sotto)\s*luce\s*(fiss[oa])?/g, '');
    let nA = 0, nF = 0;
    const mA = pulito.match(/(\d+)\s*ant/); if (mA) nA = +mA[1]; else if (/\bant[ae]/.test(pulito)) nA = 1;
    const mF = pulito.match(/(\d+)\s*fiss/); if (mF) nF = +mF[1]; else if (/fiss/.test(pulito)) nF = 1;
    if (!nA && !nF) nA = 1;
    return { lista: [...Array(Math.min(nA, 6)).fill('A'), ...Array(Math.min(nF, 4)).fill('F')], sopraluce, sottoluce };
  }

  function disegna(cat, c, opz = {}) {
    if (!c) return null;
    const W = opz.w || 200, H = opz.h || 220, mini = !!opz.mini, quote = !!opz.quote && !mini;
    const ops = [];
    const R = (x, y, w, h, cl, sw) => ops.push({ t: 'R', x: t1(x), y: t1(y), w: t1(w), h: t1(h), cl, sw });
    const L = (x1, y1, x2, y2, cl, sw, dash) => ops.push({ t: 'L', x1: t1(x1), y1: t1(y1), x2: t1(x2), y2: t1(y2), cl, sw, dash });
    const T = (x, y, s, cl, size, rot) => ops.push({ t: 'T', x: t1(x), y: t1(y), s, cl, size, rot });

    if (cat === 'Motore') return motore(W, H, mini);
    const tipo = cat === 'Tapparella' ? 'tapparella' : cat === 'Zanzariera' ? 'zanzariera' : (c.tipologia === 'Porta-Finestra' ? 'pf' : 'finestra');
    const Lmm = +c.larghezza_mm > 0 ? +c.larghezza_mm : PRED[tipo][0];
    const Hmm = +c.altezza_mm > 0 ? +c.altezza_mm : PRED[tipo][1];
    const rap = Math.max(0.28, Math.min(3.6, Hmm / Lmm));
    const mq = quote ? 24 : 0, pad = mini ? 1.5 : 3;
    const bw = W - pad * 2 - mq, bh = H - pad * 2 - mq;
    let w = bw, h = bw * rap;
    if (h > bh) { h = bh; w = bh / rap; }
    const x = pad + (bw - w) / 2, y = pad + (bh - h) / 2;
    const k = Math.min(w, h);
    const sw = mini ? 1 : Math.max(0.9, k / 110);         // spessore tratto principale
    const sf = mini ? 0.6 : Math.max(0.5, k / 220);       // tratto fine

    if (cat === 'Finestra/Porta-Finestra') finestra();
    else if (cat === 'Persiana') persiana();
    else if (cat === 'Tapparella') tapparella();
    else if (cat === 'Zanzariera') zanzariera();

    if (quote) {
      const lt = +c.larghezza_mm > 0 ? String(c.larghezza_mm) : 'L ?';
      const ht = +c.altezza_mm > 0 ? String(c.altezza_mm) : 'H ?';
      const yq = y + h + 9, xq = x + w + 9, tk = 4;
      L(x, y + h + 2, x, yq + tk, 'quota-fine', sf); L(x + w, y + h + 2, x + w, yq + tk, 'quota-fine', sf);
      L(x, yq, x + w, yq, 'quota', sf * 1.3);
      L(x - tk * 0.7, yq + tk * 0.7, x + tk * 0.7, yq - tk * 0.7, 'quota', sf * 1.6);
      L(x + w - tk * 0.7, yq + tk * 0.7, x + w + tk * 0.7, yq - tk * 0.7, 'quota', sf * 1.6);
      T(x + w / 2, yq + 9, lt, 'qt', 11);
      L(x + w + 2, y, xq + tk, y, 'quota-fine', sf); L(x + w + 2, y + h, xq + tk, y + h, 'quota-fine', sf);
      L(xq, y, xq, y + h, 'quota', sf * 1.3);
      L(xq - tk * 0.7, y + tk * 0.7, xq + tk * 0.7, y - tk * 0.7, 'quota', sf * 1.6);
      L(xq - tk * 0.7, y + h + tk * 0.7, xq + tk * 0.7, y + h - tk * 0.7, 'quota', sf * 1.6);
      T(xq + 9, y + h / 2, ht, 'qt', 11, -90);
    }
    return { ops, W, H };

    // ---- singoli tipi ----
    function finestra() {
      const t = Math.max(mini ? 2 : 3, k * 0.055);
      R(x, y, w, h, 'telaio', sw);
      let ix = x + t, iy = y + t, iw = w - 2 * t, ih = h - 2 * t;
      const comp = ante(c.composizione_ante);
      const vetro = c.vetro === 'Opaco' ? 'opaco' : 'vetro';
      if (comp.sopraluce) { const hs = ih * 0.22; R(ix, iy, iw, hs, vetro, sf); lettera(ix, iy, iw, hs); R(ix, iy + hs, iw, t * 0.7, 'telaio', sf); iy += hs + t * 0.7; ih -= hs + t * 0.7; }
      if (comp.sottoluce) { const hs = ih * 0.2; R(ix, iy + ih - hs, iw, hs, vetro, sf); lettera(ix, iy + ih - hs, iw, hs); R(ix, iy + ih - hs - t * 0.7, iw, t * 0.7, 'telaio', sf); ih -= hs + t * 0.7; }
      let lista = comp.lista.slice();
      if (c.lato_apertura === 'Destra' && lista.includes('F')) lista.reverse();
      const n = lista.length, nA = lista.filter(v => v === 'A').length;
      const pw = iw / n;
      // anta principale (per il wasistas): quella indicata, altrimenti la prima
      let principale = lista.indexOf('A');
      if (c.lato_apertura === 'Destra') principale = lista.lastIndexOf('A');
      let ia = 0;
      const maniglie = [];
      lista.forEach((tipoA, i) => {
        const px = ix + i * pw;
        if (tipoA === 'F') {
          R(px, iy, pw, ih, vetro, sf);
          if (c.wasistas && principale < 0 && i === 0) ribalta(px, iy, pw, ih);
          else lettera(px, iy, pw, ih);
          return;
        }
        const s2 = t * 0.6;
        R(px, iy, pw, ih, 'anta', sw * 0.8);
        const gx = px + s2, gy = iy + s2, gw = pw - 2 * s2, gh = ih - 2 * s2;
        R(gx, gy, gw, gh, vetro, sf);
        // cerniere: anta singola dal lato scelto; più ante: le esterne verso fuori
        let cern;
        if (nA === 1) cern = c.lato_apertura === 'Destra' ? 'dx' : 'sx';
        else cern = ia < nA / 2 ? 'sx' : 'dx';
        ia++;
        if (!mini || gw > 6) {
          const cx = cern === 'sx' ? gx : gx + gw, ox = cern === 'sx' ? gx + gw : gx;
          L(ox, gy, cx, gy + gh / 2, 'apertura', sf); L(ox, gy + gh, cx, gy + gh / 2, 'apertura', sf);
          if (c.wasistas && i === principale) ribalta(gx, gy, gw, gh);
          const mx = cern === 'sx' ? px + pw - s2 / 2 : px + s2 / 2;
          const mh = Math.max(3, gh * 0.09), mw = Math.max(1.4, s2 * 0.55);
          maniglie.push([mx - mw / 2, gy + gh / 2 - mh / 2, mw, mh]);
        }
      });
      const nt = Math.min(+c.traversi_strutturali || 0, 8);
      for (let j = 1; j <= nt; j++) { const yy = iy + ih * j / (nt + 1); R(ix, yy - t * 0.3, iw, t * 0.6, 'telaio', sf); }
      for (const m of maniglie) R(m[0], m[1], m[2], m[3], 'maniglia', 0);
    }
    function ribalta(gx, gy, gw, gh) {
      L(gx, gy, gx + gw / 2, gy + gh, 'apertura', sf, true);
      L(gx + gw, gy, gx + gw / 2, gy + gh, 'apertura', sf, true);
    }
    function lettera(px, py, pw, ph) {
      if (mini || Math.min(pw, ph) < 14) return;
      T(px + pw / 2, py + ph / 2, 'F', 'lettera', Math.min(13, Math.min(pw, ph) * 0.35));
    }
    function persiana() {
      const t = Math.max(mini ? 1.6 : 2.4, k * 0.04);
      R(x, y, w, h, 'telaio', sw);
      const comp = ante(c.composizione_ante);
      const n = comp.lista.length, pw = (w - 2 * t) / n;
      const iy = y + t, ih = h - 2 * t;
      comp.lista.forEach((v, i) => {
        const px = x + t + i * pw, s2 = t * 0.8;
        R(px, iy, pw, ih, 'anta', sw * 0.8);
        const gx = px + s2, gw = pw - 2 * s2, gy = iy + s2, gh = ih - 2 * s2;
        R(gx, gy, gw, gh, 'telo', sf * 0.6);
        const passo = Math.max(mini ? 2.2 : 3, gh / (mini ? 12 : 26));
        const genova = c.tipo_stecche === 'Vecchia Genova';
        const yr = gy + gh * 0.42;
        for (let yy = gy + passo; yy < gy + gh - passo / 3; yy += passo) {
          if (genova && Math.abs(yy - yr) < passo * 0.9) continue;
          L(gx, yy, gx + gw, yy, 'stecca', sf * 0.8, c.tipo_stecche === 'Orientabili');
        }
        if (genova) R(gx, yr - t * 0.45, gw, t * 0.9, 'anta', sf);
      });
    }
    function tapparella() {
      const hc = Math.max(4, h * 0.13), gw = Math.max(2, w * 0.035);
      R(x, y, w, hc, 'cass', sw);
      R(x, y + hc, gw, h - hc, 'guida', sf); R(x + w - gw, y + hc, gw, h - hc, 'guida', sf);
      const tx = x + gw, tw = w - 2 * gw, ty = y + hc, th = h - hc;
      R(tx, ty, tw, th, 'telo', sf);
      const passo = Math.max(mini ? 2.4 : 3.2, th / (mini ? 11 : 22));
      const nc = Math.max(0, Math.min(+c.stecche_cieche_numero || 0, 30));
      for (let j = 0; j < nc; j++) { const yb = ty + th - passo * (j + 1); if (yb < ty) break; R(tx, yb, tw, passo, 'cieca', 0); }
      for (let yy = ty + passo; yy < ty + th - 0.5; yy += passo) L(tx, yy, tx + tw, yy, 'stecca', sf * 0.8);
      if (c.paletti_sicurezza && !mini) {
        const hp = Math.min(th * 0.35, passo * Math.max(2, +c.paletti_altezza_stecche || 3));
        for (const px of [tx + tw * 0.3, tx + tw * 0.7]) R(px - 1, ty + th - hp, 2, hp, 'paletto', 0);
      }
      R(x, y, w, h, 'bordo', sw);
    }
    function zanzariera() {
      const t = Math.max(mini ? 1.6 : 2.4, k * 0.035);
      R(x, y, w, h, 'telaio', sw);
      const m = norm(c.modello);
      const laterale = /lateral|orizzont/.test(m);
      let rx = x + t, ry = y + t, rw = w - 2 * t, rh = h - 2 * t;
      if (laterale) { const bc = Math.max(4, w * 0.09); R(x, y, bc, h, 'cass', sw * 0.8); rx = x + bc; rw = w - bc - t; }
      else { const hc = Math.max(4, h * 0.1); R(x, y, w, hc, 'cass', sw * 0.8); ry = y + hc; rh = h - hc - t; }
      R(rx, ry, rw, rh, 'rete-fondo', 0);
      const passo = Math.max(mini ? 3.5 : 6, Math.min(rw, rh) / (mini ? 5 : 12));
      for (let xx = rx + passo; xx < rx + rw - 0.5; xx += passo) L(xx, ry, xx, ry + rh, 'rete', sf * 0.6);
      for (let yy = ry + passo; yy < ry + rh - 0.5; yy += passo) L(rx, yy, rx + rw, yy, 'rete', sf * 0.6);
    }
  }

  // motore tubolare: tubo con testa e corona di trascinamento
  function motore(W, H, mini) {
    const ops = [];
    const R = (x, y, w, h, cl, sw) => ops.push({ t: 'R', x: t1(x), y: t1(y), w: t1(w), h: t1(h), cl, sw });
    const L = (x1, y1, x2, y2, cl, sw) => ops.push({ t: 'L', x1: t1(x1), y1: t1(y1), x2: t1(x2), y2: t1(y2), cl, sw });
    const sw = mini ? 1 : Math.max(0.9, Math.min(W, H) / 110);
    const tw = W * 0.8, th = Math.min(H * 0.22, tw * 0.22), x = (W - tw) / 2, y = (H - th) / 2;
    R(x + tw * 0.12, y, tw * 0.88, th, 'cass', sw);
    R(x, y - th * 0.2, tw * 0.12, th * 1.4, 'anta', sw);
    for (let i = 1; i <= 3; i++) { const xx = x + tw * 0.12 + tw * 0.88 * i * 0.08; L(xx, y + th * 0.2, xx, y + th * 0.8, 'stecca', sw * 0.7); }
    R(x + tw * 0.9, y - th * 0.35, tw * 0.1, th * 1.7, 'maniglia', 0);
    return { ops, W, H };
  }

  function escXml(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function svg(d, cls = '') {
    if (!d) return '';
    let s = `<svg class="dis ${cls}" viewBox="0 0 ${d.W} ${d.H}" aria-hidden="true">`;
    for (const o of d.ops) {
      const w = o.sw ? ` stroke-width="${t1(o.sw)}"` : ' stroke="none"';
      if (o.t === 'R') s += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" class="d-${o.cl}"${w}/>`;
      else if (o.t === 'L') s += `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" class="d-${o.cl}"${w}${o.dash ? ' stroke-dasharray="3 2"' : ''}/>`;
      else if (o.t === 'T') s += `<text x="${o.x}" y="${o.y}" class="d-${o.cl}" font-size="${t1(o.size)}" text-anchor="middle" dominant-baseline="central"${o.rot ? ` transform="rotate(${o.rot} ${o.x} ${o.y})"` : ''}>${escXml(o.s)}</text>`;
    }
    return s + '</svg>';
  }

  return { disegna, svg, ante };
})();
if (typeof module !== 'undefined') module.exports = DISEGNO;
