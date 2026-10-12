'use strict';
// Lavagna: firma del cliente, schizzi a mano e disegni sopra le foto (dito o Apple Pencil).
// apri(...) restituisce una Promise con { blob, w, h } oppure null se si annulla.
const LAVAGNA = (() => {
  const COLORI = [['#e11d2e', 'Rosso'], ['#111111', 'Nero'], ['#1d4ed8', 'Blu'], ['#f5b301', 'Giallo'], ['#ffffff', 'Bianco']];
  const SPESSORI = [['Fine', 0.004], ['Medio', 0.008], ['Grosso', 0.015]];
  const ico = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  function apri(opz = {}) {
    return new Promise(risolvi => {
      const firma = !!opz.firma, sfondo = opz.sfondo || null, griglia = !!opz.griglia;
      const W = sfondo ? (sfondo.naturalWidth || sfondo.width) : (opz.larg || 1400);
      const H = sfondo ? (sfondo.naturalHeight || sfondo.height) : (opz.alt || 1000);
      const lato = Math.max(W, H);
      let colore = firma ? '#111111' : (opz.colore || '#e11d2e');
      let spessore = firma ? 0.006 : SPESSORI[1][1];
      let strumento = 'penna';
      const tratti = [];
      let corrente = null, scala = 1, uscitaChiesta = false;

      const el = document.createElement('div');
      el.className = 'lavagna' + (firma ? ' firma' : '');
      el.innerHTML = `
        <div class="lav-barra">
          <button type="button" data-l="annulla">Annulla</button>
          <b>${opz.titolo || 'Disegno'}</b>
          <button type="button" class="pri" data-l="salva">${ico('check')} Salva</button>
        </div>
        <div class="lav-area"><canvas></canvas>${firma ? '<div class="lav-riga"><span>Firma qui</span></div>' : ''}</div>
        <div class="lav-testo" hidden><input type="text" placeholder="Scrivi e premi OK (es. 1200)" enterkeyhint="done" autocomplete="off"><button type="button" data-l="testo-ok">OK</button></div>
        <div class="lav-strumenti">
          ${firma ? '' : `<div class="lav-gruppo">${COLORI.map(([c, n], i) => `<button type="button" class="lav-col${c === colore ? ' on' : ''}" data-col="${c}" style="--c:${c}" aria-label="${n}"></button>`).join('')}</div>
          <div class="lav-gruppo">${SPESSORI.map(([n, v], i) => `<button type="button" class="lav-sp${v === spessore ? ' on' : ''}" data-sp="${v}" aria-label="Tratto ${n}"><i style="--s:${4 + i * 4}px"></i></button>`).join('')}
            <button type="button" class="lav-t" data-l="testo" aria-label="Scrivi un testo">Aa</button></div>`}
          <div class="lav-gruppo"><button type="button" class="lav-b" data-l="indietro">${ico('ripristina')}<span>Annulla tratto</span></button>
            <button type="button" class="lav-b" data-l="pulisci">${ico('cestino')}<span>Cancella</span></button></div>
        </div>`;
      document.body.appendChild(el);
      document.body.classList.add('bloccato');
      const area = el.querySelector('.lav-area'), cv = el.querySelector('canvas'), cx = cv.getContext('2d');
      const boxTesto = el.querySelector('.lav-testo'), inpTesto = boxTesto.querySelector('input');
      let posTesto = null;

      function misura() {
        const r = area.getBoundingClientRect();
        const pad = firma ? 12 : 8;
        const aw = Math.max(50, r.width - pad * 2), ah = Math.max(50, r.height - pad * 2);
        scala = Math.min(aw / W, ah / H);
        const cw = Math.round(W * scala), ch = Math.round(H * scala);
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
        cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
        cx.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
        ridisegna();
      }
      function sfondoDi(c, ww, hh) {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, ww, hh);
        if (sfondo) c.drawImage(sfondo, 0, 0, ww, hh);
        else if (griglia) {
          const passo = Math.max(ww, hh) / 28;
          c.strokeStyle = '#dfe5ec'; c.lineWidth = Math.max(1, lato / 1400);
          c.beginPath();
          for (let x = passo; x < ww; x += passo) { c.moveTo(x, 0); c.lineTo(x, hh); }
          for (let y = passo; y < hh; y += passo) { c.moveTo(0, y); c.lineTo(ww, y); }
          c.stroke();
        }
      }
      function tratto(c, t) {
        if (t.tipo === 'testo') {
          const size = t.dim * lato;
          c.font = `700 ${size}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
          c.textBaseline = 'middle'; c.lineJoin = 'round';
          c.lineWidth = size * 0.18;
          c.strokeStyle = /^#(fff|ffffff|f5b301)$/i.test(t.colore) ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.92)';
          c.strokeText(t.testo, t.x * W, t.y * H);
          c.fillStyle = t.colore; c.fillText(t.testo, t.x * W, t.y * H);
          return;
        }
        const p = t.punti;
        c.strokeStyle = t.colore; c.lineWidth = t.sp * lato; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath();
        if (p.length === 1) { c.arc(p[0][0] * W, p[0][1] * H, t.sp * lato / 2, 0, Math.PI * 2); c.fillStyle = t.colore; c.fill(); return; }
        c.moveTo(p[0][0] * W, p[0][1] * H);
        for (let i = 1; i < p.length - 1; i++) {
          const mx = (p[i][0] + p[i + 1][0]) / 2 * W, my = (p[i][1] + p[i + 1][1]) / 2 * H;
          c.quadraticCurveTo(p[i][0] * W, p[i][1] * H, mx, my);
        }
        const u = p[p.length - 1]; c.lineTo(u[0] * W, u[1] * H);
        c.stroke();
      }
      function ridisegna() {
        cx.save(); sfondoDi(cx, W, H); cx.restore();
        for (const t of tratti) tratto(cx, t);
      }
      const punto = e => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };

      cv.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (strumento === 'testo') { posTesto = punto(e); boxTesto.hidden = false; inpTesto.value = ''; inpTesto.focus(); return; }
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* non indispensabile */ }
        corrente = { colore, sp: spessore, punti: [punto(e)] };
        tratti.push(corrente);
        tratto(cx, corrente);
      });
      cv.addEventListener('pointermove', e => {
        if (!corrente) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        const prima = corrente.punti[corrente.punti.length - 1];
        const nuovi = (evs.length ? evs : [e]).map(punto);
        corrente.punti.push(...nuovi);
        // disegno solo il pezzo nuovo (veloce anche con tratti lunghi)
        cx.strokeStyle = corrente.colore; cx.lineWidth = corrente.sp * lato; cx.lineCap = 'round'; cx.lineJoin = 'round';
        cx.beginPath(); cx.moveTo(prima[0] * W, prima[1] * H);
        for (const q of nuovi) cx.lineTo(q[0] * W, q[1] * H);
        cx.stroke();
      });
      const fine = () => { if (corrente) { corrente = null; ridisegna(); } };
      cv.addEventListener('pointerup', fine);
      cv.addEventListener('pointercancel', fine);

      function confermaTesto() {
        const t = inpTesto.value.trim();
        boxTesto.hidden = true; inpTesto.blur();
        if (t && posTesto) { tratti.push({ tipo: 'testo', testo: t, x: posTesto[0], y: posTesto[1], colore, dim: spessore * 4.5 + 0.018 }); ridisegna(); }
        posTesto = null;
      }
      inpTesto.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confermaTesto(); } });

      function chiudi(risultato) {
        if (ro) ro.disconnect(); else removeEventListener('resize', misura);
        document.body.classList.remove('bloccato');
        el.remove();
        risolvi(risultato);
      }
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.col) { colore = b.dataset.col; strumento = strumento === 'testo' ? 'testo' : 'penna'; el.querySelectorAll('.lav-col').forEach(x => x.classList.toggle('on', x === b)); return; }
        if (b.dataset.sp) { spessore = +b.dataset.sp; strumento = 'penna'; el.querySelectorAll('.lav-sp').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('.lav-t')?.classList.remove('on'); return; }
        const az = b.dataset.l;
        if (az === 'testo') { strumento = strumento === 'testo' ? 'penna' : 'testo'; b.classList.toggle('on', strumento === 'testo'); return; }
        if (az === 'testo-ok') { confermaTesto(); return; }
        if (az === 'indietro') { tratti.pop(); ridisegna(); return; }
        if (az === 'pulisci') { tratti.length = 0; ridisegna(); return; }
        if (az === 'annulla') {
          if (tratti.length && !uscitaChiesta) { uscitaChiesta = true; b.textContent = 'Esci senza salvare?'; b.classList.add('peric'); setTimeout(() => { uscitaChiesta = false; b.textContent = 'Annulla'; b.classList.remove('peric'); }, 3000); return; }
          chiudi(null); return;
        }
        if (az === 'salva') {
          if (!tratti.length) { chiudi(null); return; }
          const out = document.createElement('canvas'); out.width = W; out.height = H;
          const oc = out.getContext('2d');
          sfondoDi(oc, W, H);
          for (const t of tratti) tratto(oc, t);
          out.toBlob(blob => { out.width = out.height = 0; chiudi(blob ? { blob, w: W, h: H } : null); }, 'image/jpeg', 0.86);
        }
      });
      // si ridimensiona da solo (prima apertura, rotazione del telefono, finestra del PC)
      let ultimaMisura = '';
      const ro = 'ResizeObserver' in window ? new ResizeObserver(() => {
        const r = area.getBoundingClientRect(), k = Math.round(r.width) + 'x' + Math.round(r.height);
        if (k !== ultimaMisura) { ultimaMisura = k; misura(); }
      }) : null;
      if (ro) ro.observe(area); else { addEventListener('resize', misura); requestAnimationFrame(misura); }
    });
  }

  return { apri };
})();
