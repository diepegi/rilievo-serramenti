'use strict';
// Tastierino numerico per le misure: tasti grandi (si usa anche coi guanti), risponde al primo tocco,
// «Avanti» passa alla misura successiva. Funziona anche con la tastiera fisica (PC, iPad).
const TASTIERINO = (() => {
  let el = null, st = null;

  function crea() {
    el = document.createElement('div');
    el.className = 'tast';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Tastierino delle misure');
    const t = (v, cls = '', lab = v) => `<button type="button" class="tt ${cls}" data-t="${v}" aria-label="${lab}">${lab === v ? v : ''}</button>`;
    el.innerHTML = `<div class="tast-testa"><div class="tast-campi"></div>
        <button type="button" class="tast-giu" data-t="chiudi" aria-label="Chiudi il tastierino"><svg class="ic" aria-hidden="true"><use href="#i-giu"/></svg></button></div>
      <div class="tast-griglia">
        ${t('1')}${t('2')}${t('3')}<button type="button" class="tt fn" data-t="canc" aria-label="Cancella una cifra"><svg class="ic" aria-hidden="true"><use href="#i-cancella"/></svg></button>
        ${t('4')}${t('5')}${t('6')}<button type="button" class="tt fn" data-t="svuota" aria-label="Svuota la misura">C</button>
        ${t('7')}${t('8')}${t('9')}<button type="button" class="tt fn" data-t="prec" aria-label="Misura precedente"><svg class="ic" aria-hidden="true"><use href="#i-indietro"/></svg></button>
        ${t('00')}${t('0')}<button type="button" class="tt avanti" data-t="avanti"><span>Avanti</span><svg class="ic" aria-hidden="true"><use href="#i-avanti"/></svg></button>
      </div>`;
    // pointerdown: risposta immediata, senza aspettare che il dito si alzi
    el.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-t], [data-c]');
      if (!b) return;
      e.preventDefault();
      b.classList.add('premuto');
      setTimeout(() => b.classList.remove('premuto'), 110);
      if (b.dataset.c !== undefined) { vaiA(+b.dataset.c); return; }
      premi(b.dataset.t);
    });
    el.addEventListener('click', e => e.preventDefault());
    document.body.appendChild(el);
  }

  function apri({ campi, i = 0, onCambia, onChiudi, onTocco, onSposta }) {
    if (!el) crea();
    st = { campi: campi.map(c => ({ ...c })), i: Math.max(0, Math.min(i, campi.length - 1)), onCambia, onChiudi, onTocco, onSposta, nuovo: true };
    if (onSposta) onSposta(st.campi[st.i].id);
    disegna();
    document.body.classList.add('con-tast');
    el.getBoundingClientRect();
    el.classList.add('su');
  }
  function chiudi() {
    if (!st) return;
    const f = st.onChiudi; st = null;
    document.body.classList.remove('con-tast');
    if (el) el.classList.remove('su');
    if (f) f();
  }
  function vaiA(i) {
    if (!st) return;
    st.i = Math.max(0, Math.min(i, st.campi.length - 1));
    st.nuovo = true;
    if (st.onSposta) st.onSposta(st.campi[st.i].id);
    tocco(); disegna();
  }
  function tocco() { if (st && st.onTocco) st.onTocco(); }

  function premi(t) {
    if (!st) return;
    if (t === 'chiudi') { tocco(); chiudi(); return; }
    const c = st.campi[st.i];
    let s = c.v === null || c.v === undefined ? '' : String(c.v);
    if (t === 'avanti') {
      tocco();
      if (st.i < st.campi.length - 1) vaiA(st.i + 1); else chiudi();
      return;
    }
    if (t === 'prec') { if (st.i > 0) vaiA(st.i - 1); return; }
    if (/^\d+$/.test(t)) {
      if (st.nuovo) s = '';
      s = (s + t).replace(/^0+(?=\d)/, '');
      if (s.length > 9) s = s.slice(0, 9);
    } else if (t === 'canc') s = st.nuovo ? '' : s.slice(0, -1);
    else if (t === 'svuota') s = '';
    st.nuovo = false;
    c.v = s === '' ? null : parseInt(s, 10);
    tocco();
    if (st.onCambia) st.onCambia(c.id, c.v);
    disegna();
  }

  function disegna() {
    if (!st || !el) return;
    el.querySelector('.tast-campi').innerHTML = st.campi.map((c, i) => `<button type="button" class="tast-c${i === st.i ? ' on' : ''}${i === st.i && st.nuovo && c.v !== null && c.v !== undefined ? ' sel' : ''}" data-c="${i}">
        <small>${c.et}</small><b>${c.v === null || c.v === undefined ? '—' : c.v}</b></button>`).join('');
    const ultimo = st.i === st.campi.length - 1;
    el.querySelector('.avanti span').textContent = ultimo ? 'Fatto' : 'Avanti';
    el.querySelector('.avanti').classList.toggle('fine', ultimo);
    el.querySelector('[data-t="prec"]').disabled = st.i === 0;
    const attivo = el.querySelector('.tast-c.on');
    if (attivo) { const p = attivo.parentElement; p.scrollLeft = attivo.offsetLeft - p.clientWidth / 2 + attivo.offsetWidth / 2; }
  }

  // tastiera fisica
  document.addEventListener('keydown', e => {
    if (!st || e.ctrlKey || e.metaKey || e.altKey) return;
    let t = null;
    if (/^\d$/.test(e.key)) t = e.key;
    else if (e.key === 'Backspace') t = 'canc';
    else if (e.key === 'Delete') t = 'svuota';
    else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowRight') t = 'avanti';
    else if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowLeft') t = 'prec';
    else if (e.key === 'Escape') t = 'chiudi';
    if (!t) return;
    e.preventDefault();
    premi(t);
  });

  return { apri, chiudi, aperto: () => !!st, altezza: () => (el && st ? el.offsetHeight : 0) };
})();
