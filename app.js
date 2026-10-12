'use strict';
// Rilievi Serramenti — app per prendere le misure in cantiere. Tutto resta sul telefono.
(() => {
const VERSIONE = '2.0';
const app = document.getElementById('app');

/* =========================================================
   Utilità
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const MAPPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => MAPPA_ESC[c]);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const ora = () => new Date().toISOString();
const due = n => String(n).padStart(2, '0');
const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`; };
const fmtData = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || ''); };
const fmtQuando = iso => { if (!iso) return ''; const d = new Date(iso); return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()} alle ${due(d.getHours())}:${due(d.getMinutes())}`; };
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const vuoto = v => v === null || v === undefined || v === '';
const ic = (n, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'rilievo';
const clona = o => JSON.parse(JSON.stringify(o));
const metri = v => (v / 1000).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const peso = b => b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' MB';
const plur = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
const BOM = String.fromCharCode(0xFEFF);
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALLATA = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const leggiLS = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
const scriviLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* niente */ } };

// Ogni record ha una "versione" in memoria: se non è cambiato, disegni e descrizioni non si ricalcolano
const VER = new WeakMap();
const versione = o => VER.get(o) || 0;
const tocca = o => VER.set(o, versione(o) + 1);

/* =========================================================
   Tipi di articolo e loro campi (vedi specifiche, sezione 4)
   ========================================================= */
const ANTE = ['1 Anta', '2 Ante', '3 Ante', '1 Anta e 1 Fisso', '1 Fisso'];
const MISURE = { k: 'misure', t: 'misure' };
const QUANTITA = { k: 'quantita', t: 'int', l: 'Quantità', base: true, def: 1, min: 1 };
const RIFERIMENTO = { k: 'riferimento_misura', t: 'chips', l: 'Misura presa su', o: ['Luce netta', 'Foro muratura', 'Telaio esistente', 'Misura finita'], agg: true, bv: v => 'misura su ' + v.toLowerCase() };
const NOTE = { k: 'note', t: 'note', l: 'Note', nocopia: true };
const lower = v => v.toLowerCase();

const CATEGORIE = [
  { id: 'Finestra/Porta-Finestra', breve: 'Finestra', lungo: 'Finestra / Porta-finestra', icona: 'finestra', col: 'fin', campi: [
    { k: 'tipologia', t: 'chips', l: 'Tipologia', o: ['Finestra', 'Porta-Finestra'], def: 'Finestra', req: true, nonApplicare: true },
    MISURE, QUANTITA,
    { k: 'profilo', t: 'chips', l: 'Profilo', o: ['Alluminio R40', 'Alluminio Taglio Termico', 'PVC Gealan'], altro: 'Altro…', ph: 'Scrivi il profilo' },
    { k: 'composizione_ante', t: 'chips', l: 'Composizione ante', o: ANTE, altro: 'Personalizzata…', ph: 'es. 2 Ante + sopraluce fisso' },
    { k: 'vetro', t: 'chips', l: 'Vetro', o: ['Opaco', 'Trasparente', 'Semplice'], bv: v => 'vetro ' + lower(v) },
    { k: 'wasistas', t: 'bool', l: 'Wasistas', def: false },
    { k: 'traversi_strutturali', t: 'int', l: 'Traversi strutturali aggiuntivi', def: 0, min: 0, bv: v => plur(v, 'traverso', 'traversi') },
    { k: 'colore', t: 'testo', l: 'Colore', ph: 'es. Bianco, RAL 9010, Noce', sugg: true, agg: true },
    { k: 'lato_apertura', t: 'chips', l: 'Anta principale (vista da dentro)', o: ['Sinistra', 'Destra'], agg: true, nonApplicare: true, bv: v => 'apre a ' + lower(v) },
    RIFERIMENTO, NOTE] },
  { id: 'Tapparella', breve: 'Tapparella', lungo: 'Tapparella', icona: 'tapparella', col: 'tap', campi: [
    { k: 'materiale', t: 'chips', l: 'Materiale', o: ['Acciaio', 'Alluminio', 'PVC'] },
    MISURE, QUANTITA,
    { k: 'colore_ral', t: 'testo', l: 'Colore RAL', ph: 'es. RAL 6005', sugg: true },
    { k: 'stecche_cieche_numero', t: 'int', l: 'Stecche cieche', def: 0, min: 0, bv: v => plur(v, 'stecca cieca', 'stecche cieche') },
    { k: 'paletti_sicurezza', t: 'bool', l: 'Paletti di sicurezza', def: false, breveSe: c => !(c.paletti_altezza_stecche > 0) },
    { k: 'paletti_altezza_stecche', t: 'int', l: 'Altezza paletti (in stecche)', def: 0, min: 0, se: c => c.paletti_sicurezza === true, bv: v => `paletti a ${plur(v, 'stecca', 'stecche')}` },
    { k: 'movimentazione', t: 'chips', l: 'Movimentazione', o: ['Guide fisse', 'Apparecchio a sporgere', 'Movimento a leva centrale'] },
    { k: 'finitura_guide', t: 'chips', l: 'Finitura guide', o: ['Inox', 'Zincati', 'Colore RAL'], extra: { se: 'Colore RAL', k: 'finitura_guide_ral', ph: 'Scrivi il RAL, es. RAL 9010' }, bv: v => 'guide ' + (v.startsWith('Colore RAL') ? v.slice(7) : lower(v)) },
    { k: 'comando', t: 'chips', l: 'Comando', o: ['Cinghia', 'Arganello', 'Motore'], agg: true, bv: v => 'comando a ' + lower(v) },
    RIFERIMENTO, NOTE] },
  { id: 'Persiana', breve: 'Persiana', lungo: 'Persiana', icona: 'persiana', col: 'per', campi: [
    { k: 'tipologia', t: 'chips', l: 'Tipologia', o: ['Finestra', 'Porta-Finestra'], def: 'Finestra', req: true, nonApplicare: true },
    { k: 'materiale', t: 'chips', l: 'Materiale', o: ['PVC', 'Alluminio', 'Blindata'] },
    MISURE, QUANTITA,
    { k: 'colore_ral', t: 'testo', l: 'Colore RAL', ph: 'es. RAL 6005', sugg: true },
    { k: 'tipo_stecche', t: 'chips', l: 'Tipo stecche', o: ['Normali', 'Orientabili', 'Vecchia Genova'], bv: v => 'stecche ' + (v === 'Vecchia Genova' ? 'alla Vecchia Genova' : lower(v)) },
    { k: 'composizione_ante', t: 'chips', l: 'Composizione ante', o: ANTE, altro: 'Personalizzata…', ph: 'es. 2 Ante a libro' },
    RIFERIMENTO, NOTE] },
  { id: 'Zanzariera', breve: 'Zanzariera', lungo: 'Zanzariera', icona: 'zanzariera', col: 'zan', campi: [
    { k: 'modello', t: 'testo', l: 'Modello', ph: 'es. Avvolgente verticale', sugg: true },
    MISURE, QUANTITA,
    { k: 'colore_alluminio', t: 'testo', l: 'Colore alluminio', ph: 'es. Bianco, Bronzo', sugg: true },
    RIFERIMENTO, NOTE] },
  { id: 'Motore', breve: 'Motore', lungo: 'Motore', icona: 'motore', col: 'mot', campi: [
    { k: 'modello', t: 'testo', l: 'Modello', ph: 'es. Somfy Oximo 20 Nm', sugg: true },
    { k: 'destinazione_uso', t: 'testo', l: "Destinazione d'uso", ph: 'es. Motore per tapparella salotto', nocopia: true },
    QUANTITA, NOTE] },
];
const CAT = Object.fromEntries(CATEGORIE.map(c => [c.id, c]));
const haMisure = cat => cat.campi.includes(MISURE);
const STANZE_TIPICHE = ['Cucina', 'Soggiorno', 'Sala', 'Camera', 'Cameretta', 'Bagno', 'Studio', 'Ingresso', 'Corridoio', 'Disimpegno', 'Ripostiglio', 'Lavanderia', 'Scala', 'Taverna', 'Garage', 'Balcone'];
const COLORI_PDF = { fin: '#2563eb', tap: '#e8590c', per: '#15803d', zan: '#7c3aed', mot: '#be123c' };

/* =========================================================
   Stato in memoria (letto all'avvio, poi scritto man mano)
   ========================================================= */
const S = {
  clienti: new Map(), rilievi: new Map(), articoli: new Map(),
  mini: new Map(),          // miniature foto caricate (id -> record)
  miniCaricate: new Set(),  // rilievi di cui ho già caricato le miniature
  logo: null,
  imp: { chiave: 'generali', azienda: '', tecnico: '', telefono: '', precompila: true, tastierino: true, vibrazione: true, tema: 'auto', testo: 'normale',
    ultimo_backup: null, ultima_modifica: null, backup_rimandato: null, avviso_installa_chiuso: false },
};
const UI = { tab: 'rilievi', cerca: '', cercaClienti: '', filtro: 'tutti', altro: new Set(), prec: null, focusL: null, evidenzia: null, ncAperto: false, chiuse: new Set(leggiLS('rs.chiuse', [])) };

const salva = (store, rec) => DB.salva(store, rec);
function segnaModifica() { S.imp.ultima_modifica = ora(); salva('impostazioni', S.imp); }
function modificato(rec, store) { rec.updated_at = ora(); tocca(rec); salva(store, rec); segnaModifica(); }
function toccaRilievo(rid) { const r = S.rilievi.get(rid); if (r) modificato(r, 'rilievi'); }

const attivi = m => [...m.values()].filter(x => !x.deleted_at);
const nomeCliente = c => (c && c.nome_cognome) || 'Cliente senza nome';
const titoloRilievo = r => r.titolo || r.indirizzo_cantiere || `Rilievo del ${fmtData(r.data_rilievo)}`;

function articoliDi(rid) {
  const out = [];
  for (const a of S.articoli.values()) if (a.rilievo_id === rid && !a.deleted_at) out.push(a);
  return out;
}
function struttura(r) {
  const per = new Map();
  for (const a of articoliDi(r.id)) { if (!per.has(a.stanza_id)) per.set(a.stanza_id, []); per.get(a.stanza_id).push(a); }
  return r.stanze.filter(s => !s.deleted_at).map(s => ({ stanza: s, articoli: (per.get(s.id) || []).sort((x, y) => x.ordine - y.ordine) }));
}
function posizioni(str) { const m = new Map(); let n = 0; for (const { articoli } of str) for (const a of articoli) m.set(a.id, ++n); return m; }
function articoliStanza(r, sid) { return articoliDi(r.id).filter(a => a.stanza_id === sid).sort((x, y) => x.ordine - y.ordine); }
function prossimoOrdine(r, sid) { const l = articoliStanza(r, sid); return l.length ? l[l.length - 1].ordine + 1 : 0; }

// Se un articolo punta a una stanza che non c'è (es. dati importati) la ricreo
function ripara(r) {
  let cambiato = false;
  if (!Array.isArray(r.stanze)) { r.stanze = []; cambiato = true; }
  const ids = new Set(r.stanze.map(s => s.id));
  for (const a of S.articoli.values()) {
    if (a.rilievo_id !== r.id || (a.stanza_id && ids.has(a.stanza_id))) continue;
    const nome = a.stanza_rif || 'Senza stanza';
    let s = r.stanze.find(x => x.nome === nome && !x.deleted_at);
    if (!s) { s = { id: a.stanza_id || uuid(), nome, deleted_at: null, cestino_gruppo: null }; r.stanze.push(s); ids.add(s.id); }
    a.stanza_id = s.id; salva('articoli', a); cambiato = true;
  }
  if (cambiato) salva('rilievi', r);
}

/* =========================================================
   Descrizione di un articolo (per schede, PDF, testo)
   ========================================================= */
const memoDesc = new WeakMap();
function descrivi(a) {
  const v = versione(a), m = memoDesc.get(a);
  if (m && m.v === v && m.cat === a.categoria) return m.d;
  const d = calcolaDescrizione(a);
  memoDesc.set(a, { v, cat: a.categoria, d });
  return d;
}
function calcolaDescrizione(a) {
  const cat = CAT[a.categoria] || CATEGORIE[0];
  const c = a.configurazione || {};
  let titolo = cat.breve;
  if (cat.id === 'Finestra/Porta-Finestra') titolo = c.tipologia || 'Finestra';
  if (cat.id === 'Persiana') titolo = c.tipologia === 'Porta-Finestra' ? 'Persiana porta-finestra' : 'Persiana finestra';
  const conMisure = haMisure(cat);
  const L = c.larghezza_mm, H = c.altezza_mm;
  const misure = conMisure ? `${vuoto(L) ? '—' : L} × ${vuoto(H) ? '—' : H}` : '';
  const mancano = conMisure && (vuoto(L) || vuoto(H));
  const coppie = [], brevi = [];
  const punti = conMisure && c.misura_punti && c.punti;
  if (punti) {
    const elenco = (arr, nomi) => (arr || []).map((v, i) => vuoto(v) ? null : `${nomi[i]} ${v}`).filter(Boolean).join(', ');
    const lp = elenco(c.punti.L, ['alto', 'centro', 'basso']), hp = elenco(c.punti.H, ['sinistra', 'centro', 'destra']);
    if (lp) coppie.push(['Larghezze rilevate', lp]);
    if (hp) coppie.push(['Altezze rilevate', hp]);
  }
  for (const f of cat.campi) {
    if (f.base || f.t === 'misure' || f.t === 'note' || f.k === 'tipologia') continue;
    if (f.se && !f.se(c)) continue;
    let v = c[f.k];
    if (f.t === 'bool') { if (v === true) { coppie.push([f.l, 'Sì']); if (!f.breveSe || f.breveSe(c)) brevi.push(f.l); } continue; }
    if (f.t === 'int') { if (v > 0) { coppie.push([f.l, String(v)]); brevi.push(f.bv ? f.bv(v) : `${f.l}: ${v}`); } continue; }
    if (vuoto(v)) continue;
    v = String(v).trim(); if (!v) continue;
    v = conExtra(f, c, v);
    coppie.push([f.l, v]);
    brevi.push(f.bv ? f.bv(v) : v);
  }
  return { cat, titolo, misure, L, H, mancano, punti: !!punti, coppie, brevi, note: (c.note || '').trim(), q: a.quantita || 1 };
}
// "Colore RAL" + testo scritto -> "Colore RAL 9010" (anche se si scrive "RAL 9010" o solo "9010")
function conExtra(f, c, v) {
  if (!f.extra || v !== f.extra.se) return v;
  const t = String(c[f.extra.k] || '').trim();
  if (!t) return v;
  return /^ral\b/i.test(t) ? `Colore ${t.replace(/^ral\s*/i, 'RAL ')}` : `${v} ${t}`;
}
// Conteggio dei pezzi (finestre e porte-finestre separate, così l'ufficio le legge subito)
const RIEP = [
  { k: 'Finestra', uno: 'finestra', tanti: 'finestre', titolo: 'Finestre', icona: 'finestra', col: 'fin' },
  { k: 'Porta-Finestra', uno: 'porta-finestra', tanti: 'porte-finestre', titolo: 'Porte-finestre', icona: 'finestra', col: 'fin' },
  { k: 'Tapparella', uno: 'tapparella', tanti: 'tapparelle', titolo: 'Tapparelle', icona: 'tapparella', col: 'tap' },
  { k: 'Persiana', uno: 'persiana', tanti: 'persiane', titolo: 'Persiane', icona: 'persiana', col: 'per' },
  { k: 'Zanzariera', uno: 'zanzariera', tanti: 'zanzariere', titolo: 'Zanzariere', icona: 'zanzariera', col: 'zan' },
  { k: 'Motore', uno: 'motore', tanti: 'motori', titolo: 'Motori', icona: 'motore', col: 'mot' },
];
const chiaveRiep = a => a.categoria === 'Finestra/Porta-Finestra' ? (a.configurazione.tipologia === 'Porta-Finestra' ? 'Porta-Finestra' : 'Finestra') : a.categoria;
function contaTipi(lista) {
  const cont = new Map();
  for (const a of lista) { const k = chiaveRiep(a); cont.set(k, (cont.get(k) || 0) + (a.quantita || 1)); }
  return RIEP.filter(x => cont.get(x.k)).map(x => ({ ...x, n: cont.get(x.k), nome: cont.get(x.k) === 1 ? x.uno : x.tanti }));
}
const riepilogo = r => contaTipi(articoliDi(r.id));

// Disegni (con memoria: si ricalcolano solo se l'articolo cambia)
const memoSvg = new WeakMap();
function svgMini(a) {
  const v = versione(a), m = memoSvg.get(a);
  if (m && m.v === v && m.cat === a.categoria) return m.s;
  const s = DISEGNO.svg(DISEGNO.disegna(a.categoria, a.configurazione, { w: 44, h: 54, mini: true }), 'mini');
  memoSvg.set(a, { v, cat: a.categoria, s });
  return s;
}
const svgGrande = a => DISEGNO.svg(DISEGNO.disegna(a.categoria, a.configurazione, { w: 300, h: 228, quote: true }), 'grande');

/* =========================================================
   Creazione e modifica dati
   ========================================================= */
function nuovoCliente(d) {
  const t = ora();
  const c = { id: uuid(), nome_cognome: (d.nome_cognome || '').trim(), indirizzo: (d.indirizzo || '').trim(), telefono: (d.telefono || '').trim(), email: (d.email || '').trim(), created_at: t, updated_at: t, deleted_at: null, cestino_gruppo: null };
  S.clienti.set(c.id, c); modificato(c, 'clienti');
  return c;
}
function nuovoRilievo(cid, d) {
  const t = ora();
  const r = { id: uuid(), cliente_id: cid, data_rilievo: d.data_rilievo || oggi(), indirizzo_cantiere: (d.indirizzo_cantiere || '').trim(), titolo: (d.titolo || '').trim(), note_generali: (d.note_generali || '').trim(), stato: 'Bozza', stanze: [], firma: null, created_at: t, updated_at: t, deleted_at: null, cestino_gruppo: null };
  S.rilievi.set(r.id, r); modificato(r, 'rilievi');
  return r;
}
function nomeLibero(r, nome) {
  nome = nome.trim();
  const usati = new Set(r.stanze.filter(s => !s.deleted_at).map(s => norm(s.nome)));
  if (!usati.has(norm(nome))) return nome;
  const base = nome.replace(/\s+\d+$/, '');
  let n = 2; while (usati.has(norm(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}
function nuovaStanza(r, nome, dopoId) {
  const s = { id: uuid(), nome: nomeLibero(r, nome), deleted_at: null, cestino_gruppo: null };
  const i = dopoId ? r.stanze.findIndex(x => x.id === dopoId) : -1;
  if (i >= 0) r.stanze.splice(i + 1, 0, s); else r.stanze.push(s);
  modificato(r, 'rilievi');
  return s;
}
function configBase(cat) {
  const c = {};
  if (haMisure(cat)) { c.larghezza_mm = null; c.altezza_mm = null; }
  for (const f of cat.campi) {
    if (f.base || f.t === 'misure') continue;
    c[f.k] = f.def !== undefined ? f.def : (f.t === 'bool' ? false : f.t === 'int' ? 0 : '');
    if (f.extra) c[f.extra.k] = '';
  }
  return c;
}
function ultimoArticolo(catId, rid) {
  let migliore = null, globale = null;
  for (const a of S.articoli.values()) {
    if (a.deleted_at || a.categoria !== catId) continue;
    if (a.rilievo_id === rid && (!migliore || a.updated_at > migliore.updated_at)) migliore = a;
    if (!globale || a.updated_at > globale.updated_at) globale = a;
  }
  return migliore || globale;
}
function copiaScelte(dest, sorg, cat, perApplica) {
  for (const f of cat.campi) {
    if (f.base || f.t === 'misure' || f.nocopia || (perApplica && f.nonApplicare)) continue;
    if (sorg[f.k] !== undefined) dest[f.k] = clona(sorg[f.k]);
    if (f.extra && sorg[f.extra.k] !== undefined) dest[f.extra.k] = sorg[f.extra.k];
  }
  if (!perApplica && sorg.misura_punti) dest.misura_punti = true;
}
function nuovoArticolo(r, sid, catId) {
  const cat = CAT[catId];
  const st = r.stanze.find(s => s.id === sid);
  const config = configBase(cat);
  let da = null;
  if (S.imp.precompila) {
    const ult = ultimoArticolo(catId, r.id);
    if (ult) { da = ult; copiaScelte(config, ult.configurazione, cat); }
  }
  if (config.misura_punti) config.punti = { L: [null, null, null], H: [null, null, null] };
  const t = ora();
  const a = { id: uuid(), rilievo_id: r.id, stanza_id: sid, stanza_rif: st.nome, categoria: catId, quantita: 1, ordine: prossimoOrdine(r, sid), configurazione: config, foto: [], created_at: t, updated_at: t, deleted_at: null, cestino_gruppo: null };
  S.articoli.set(a.id, a); modificato(a, 'articoli'); toccaRilievo(r.id);
  return { a, da };
}
function duplicaArticolo(a, sid) {
  const r = S.rilievi.get(a.rilievo_id);
  const st = r.stanze.find(s => s.id === sid);
  const t = ora();
  const b = { ...clona(a), id: uuid(), stanza_id: sid, stanza_rif: st.nome, foto: [], created_at: t, updated_at: t, deleted_at: null, cestino_gruppo: null };
  if (sid === a.stanza_id) {
    // la copia va subito dopo l'originale
    const lista = articoliStanza(r, sid);
    lista.splice(lista.indexOf(a) + 1, 0, b);
    lista.forEach((x, j) => { if (x.ordine !== j) { x.ordine = j; if (x !== b) modificato(x, 'articoli'); } });
  } else b.ordine = prossimoOrdine(r, sid);
  S.articoli.set(b.id, b); modificato(b, 'articoli'); toccaRilievo(r.id);
  return b;
}
function duplicaStanza(r, s) {
  const nuova = nuovaStanza(r, s.nome.replace(/\s+\d+$/, ''), s.id);
  const t = ora();
  for (const a of articoliStanza(r, s.id)) {
    const b = { ...clona(a), id: uuid(), stanza_id: nuova.id, stanza_rif: nuova.nome, foto: [], created_at: t, updated_at: t };
    S.articoli.set(b.id, b); modificato(b, 'articoli');
  }
  toccaRilievo(r.id);
  return nuova;
}
function spostaArticolo(a, sid) {
  const r = S.rilievi.get(a.rilievo_id);
  const st = r.stanze.find(s => s.id === sid);
  a.ordine = prossimoOrdine(r, sid); a.stanza_id = sid; a.stanza_rif = st.nome;
  modificato(a, 'articoli'); toccaRilievo(r.id);
}
function spostaNellaStanza(a, d) {
  const r = S.rilievi.get(a.rilievo_id);
  const l = articoliStanza(r, a.stanza_id), i = l.indexOf(a), j = i + d;
  if (j < 0 || j >= l.length) return false;
  [l[i], l[j]] = [l[j], l[i]];
  l.forEach((x, k) => { if (x.ordine !== k) { x.ordine = k; modificato(x, 'articoli'); } });
  toccaRilievo(r.id);
  return true;
}

/* ---------- Misure (anche in 3 punti: vale la più piccola) ---------- */
function campiMisura(a) {
  const c = a.configurazione;
  if (c.misura_punti) {
    const p = c.punti || { L: [], H: [] };
    return [['L0', 'L alto'], ['L1', 'L centro'], ['L2', 'L basso'], ['H0', 'H sinistra'], ['H1', 'H centro'], ['H2', 'H destra']]
      .map(([id, et]) => ({ id, et, v: p[id[0]][+id[1]] ?? null }));
  }
  return [{ id: 'larghezza_mm', et: 'L · Larghezza', v: c.larghezza_mm ?? null }, { id: 'altezza_mm', et: 'H · Altezza', v: c.altezza_mm ?? null }];
}
function ricalcolaPunti(c) {
  const min = arr => { const n = (arr || []).filter(x => !vuoto(x)); return n.length ? Math.min(...n) : null; };
  c.larghezza_mm = min(c.punti.L); c.altezza_mm = min(c.punti.H);
}
function scriviMisura(a, id, v) {
  const c = a.configurazione;
  if (/^[LH][0-2]$/.test(id)) {
    if (!c.punti) c.punti = { L: [null, null, null], H: [null, null, null] };
    c.punti[id[0]][+id[1]] = v;
    ricalcolaPunti(c);
  } else c[id] = v;
  cambiaArticolo(a);
}

/* =========================================================
   Cestino: niente si cancella davvero, si può sempre ripristinare
   ========================================================= */
function cestina(tipo, rec, extra) {
  const g = uuid(), t = ora();
  const segna = x => { x.deleted_at = t; x.cestino_gruppo = g; };
  const cestinaRilievo = r => {
    segna(r); modificato(r, 'rilievi');
    for (const a of S.articoli.values()) if (a.rilievo_id === r.id && !a.deleted_at) { segna(a); modificato(a, 'articoli'); }
  };
  if (tipo === 'cliente') {
    segna(rec); modificato(rec, 'clienti');
    for (const r of S.rilievi.values()) if (r.cliente_id === rec.id && !r.deleted_at) cestinaRilievo(r);
  } else if (tipo === 'rilievo') cestinaRilievo(rec);
  else if (tipo === 'stanza') {
    const r = extra; segna(rec);
    for (const a of S.articoli.values()) if (a.rilievo_id === r.id && a.stanza_id === rec.id && !a.deleted_at) { segna(a); modificato(a, 'articoli'); }
    modificato(r, 'rilievi');
  } else if (tipo === 'articolo') { segna(rec); modificato(rec, 'articoli'); toccaRilievo(rec.rilievo_id); }
  else if (tipo === 'foto') {
    segna(rec); salva('miniature', rec); segnaModifica();
    const a = S.articoli.get(rec.articolo_id);
    if (a) { a.foto = a.foto.filter(id => id !== rec.id); modificato(a, 'articoli'); }
  }
  return g;
}
function ripristina(g) {
  const libera = x => { x.deleted_at = null; x.cestino_gruppo = null; };
  for (const c of S.clienti.values()) if (c.cestino_gruppo === g) { libera(c); modificato(c, 'clienti'); }
  for (const r of S.rilievi.values()) {
    if (r.cestino_gruppo === g) { libera(r); modificato(r, 'rilievi'); }
    for (const s of r.stanze) if (s.cestino_gruppo === g) { libera(s); modificato(r, 'rilievi'); }
  }
  for (const a of S.articoli.values()) if (a.cestino_gruppo === g) { libera(a); modificato(a, 'articoli'); }
  for (const m of S.mini.values()) if (m.cestino_gruppo === g) {
    libera(m); salva('miniature', m);
    const a = S.articoli.get(m.articolo_id);
    if (a && !a.foto.includes(m.id)) { a.foto.push(m.id); modificato(a, 'articoli'); }
    if (a && a.deleted_at) { libera(a); modificato(a, 'articoli'); }
  }
  sistemaGenitori();
}
// Se ripristino un articolo, devono tornare visibili anche la sua stanza, il rilievo e il cliente
function sistemaGenitori() {
  const libera = x => { x.deleted_at = null; x.cestino_gruppo = null; };
  for (const a of S.articoli.values()) {
    if (a.deleted_at) continue;
    const r = S.rilievi.get(a.rilievo_id); if (!r) continue;
    if (r.deleted_at) { libera(r); modificato(r, 'rilievi'); }
    const s = r.stanze.find(x => x.id === a.stanza_id);
    if (s && s.deleted_at) { libera(s); modificato(r, 'rilievi'); }
  }
  for (const r of S.rilievi.values()) {
    if (r.deleted_at) continue;
    const c = S.clienti.get(r.cliente_id);
    if (c && c.deleted_at) { libera(c); modificato(c, 'clienti'); }
  }
}
function cestinaConAnnulla(tipo, rec, extra, messaggio) {
  const g = cestina(tipo, rec, extra);
  toast(messaggio || 'Spostato nel cestino', { l: 'Annulla', fn: () => { ripristina(g); ridisegna(); toast('Ripristinato'); } });
  return g;
}

/* =========================================================
   Aspetto, vibrazione
   ========================================================= */
function applicaAspetto() {
  const el = document.documentElement;
  if (S.imp.tema === 'chiaro' || S.imp.tema === 'scuro') el.dataset.tema = S.imp.tema; else delete el.dataset.tema;
  el.style.setProperty('--zoom', { normale: 1, grande: 1.1, enorme: 1.22 }[S.imp.testo] || 1);
}
// Piccola vibrazione al tocco: su Android con vibrate, su iPhone (iOS 18+) col trucco dell'interruttore
const vibra = (() => {
  let lab = null;
  return () => {
    if (!S.imp.vibrazione) return;
    try {
      if (navigator.vibrate) { if (!navigator.userActivation || navigator.userActivation.isActive) navigator.vibrate(8); return; }
      if (!IOS) return;
      if (!lab) {
        lab = document.createElement('label');
        lab.setAttribute('aria-hidden', 'true');
        lab.style.cssText = 'position:fixed;left:-50px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
        const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
        lab.appendChild(i); document.body.appendChild(lab);
      }
      lab.click();
    } catch (e) { /* niente */ }
  };
})();

/* =========================================================
   Navigazione (con la cronologia, così funziona anche il gesto "indietro")
   ========================================================= */
let pila = [], rotta = null, sostituendo = false, poiVai = null, verso = 'avanti';
const scrollSalvati = new Map();
const hashAttuale = () => decodeURIComponent(location.hash.replace(/^#\/?/, ''));

function vai(h) {
  if (h === rotta) return;
  const i = pila.lastIndexOf(h);
  if (i >= 0 && i < pila.length - 1) { history.go(i - (pila.length - 1)); return; }
  verso = 'avanti';
  history.pushState(null, '', '#/' + h);
  alCambio();
}
function sostituisci(h, versoAnim = 'nessuno') { sostituendo = true; verso = versoAnim; history.replaceState(null, '', '#/' + h); alCambio(); }
function torna(h) {
  const i = pila.lastIndexOf(h);
  if (i >= 0 && i < pila.length - 1) history.go(i - (pila.length - 1));
  else sostituisci(h, 'indietro');
}
// torna a una pagina e poi aprine un'altra (es. dopo aver creato un rilievo)
function tornaEVai(base, h) {
  const i = pila.lastIndexOf(base);
  if (i >= 0 && i < pila.length - 1) { poiVai = h; history.go(i - (pila.length - 1)); }
  else { sostituisci(base); vai(h); }
}
function alCambio() {
  const h = hashAttuale();
  if (rotta !== null) scrollSalvati.set(rotta, scrollY);
  let tornando = false;
  if (sostituendo) { pila[pila.length - 1] = h; sostituendo = false; }
  else {
    const i = pila.lastIndexOf(h);
    if (i >= 0 && i < pila.length - 1) { pila.length = i + 1; tornando = true; verso = 'indietro'; }
    else if (pila[pila.length - 1] !== h) pila.push(h);
  }
  // tornando dall'articolo all'elenco, lo evidenzio
  const daArt = rotta && /^r\/[^/]+\/a\/([^/]+)$/.exec(rotta);
  if (daArt && h === rotta.split('/a/')[0]) UI.evidenzia = daArt[1];
  if (UI.prec && !h.endsWith('/a/' + UI.prec.aid)) UI.prec = null;
  rotta = h;
  if (poiVai) { const x = poiVai; poiVai = null; verso = 'avanti'; history.pushState(null, '', '#/' + x); return alCambio(); }
  scriviLS('rs.ultima', h);
  render(tornando, true);
}
window.addEventListener('popstate', () => { if (hashAttuale() !== rotta) { verso = 'indietro'; alCambio(); } });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; // lo scorrimento lo gestisco io

const ROTTE = [
  [/^$/, pHome],
  [/^nuovo$/, pNuovoCliente],
  [/^nuovo\/([^/]+)$/, pNuovoDati],
  [/^r\/([^/]+)$/, pRilievo],
  [/^r\/([^/]+)\/dati$/, pModificaRilievo],
  [/^r\/([^/]+)\/a\/([^/]+)$/, pArticolo],
  [/^c\/nuovo$/, pClienteNuovo],
  [/^c\/([^/]+)$/, pCliente],
  [/^c\/([^/]+)\/modifica$/, pClienteModifica],
  [/^impostazioni$/, pImpostazioni],
  [/^cestino$/, pCestino],
];
function render(tornando, anima) {
  chiudiSheet(true);
  TASTIERINO.chiudi();
  $('.visore')?.remove();
  if (osservatore) { osservatore.disconnect(); osservatore = null; }
  for (const [re, fn] of ROTTE) {
    const m = rotta.match(re);
    if (!m) continue;
    if (fn(...m.slice(1)) === false) { torna(''); return; }
    const y = tornando ? (scrollSalvati.get(rotta) || 0) : 0;
    scrollTo(0, y);
    if (anima && verso !== 'nessuno') { const p = $('.pag'); if (p) p.classList.add(verso === 'indietro' ? 'entra-ind' : 'entra'); }
    verso = 'avanti';
    dopoRender();
    return;
  }
  torna('');
}
function ridisegna() { const y = scrollY; render(false, false); scrollTo(0, y); }

function dopoRender() {
  // evidenzia l'articolo appena modificato
  if (UI.evidenzia) {
    const el = document.getElementById('a-' + UI.evidenzia);
    UI.evidenzia = null;
    if (el) {
      const b = el.getBoundingClientRect();
      if (b.top < 120 || b.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
    }
  }
  $$('textarea').forEach(autoAltezza);
  osservaStanze();
  // nuovo articolo o copia: misure subito pronte da scrivere
  if (UI.focusL) {
    const aid = UI.focusL; UI.focusL = null;
    const a = S.articoli.get(aid);
    if (a && rotta.endsWith('/a/' + aid)) {
      if (S.imp.tastierino) apriTastierino(a, campiMisura(a)[0].id);
      else { const i = $('#editor input[data-num][data-f]'); if (i) { i.focus(); i.select(); } }
    }
  }
}

/* =========================================================
   Pezzi di interfaccia
   ========================================================= */
function barra({ titolo, sotto, indietro, destra = '' }) {
  return `<header class="barra"><div class="barra-in">
    ${indietro ? `<button class="b-indietro" data-act="torna" data-h="${esc(indietro.h)}">${ic('indietro')}<span>${esc(indietro.l)}</span></button>` : '<span style="width:10px"></span>'}
    <div class="barra-titolo"><b>${esc(titolo)}</b>${sotto ? `<small>${esc(sotto)}</small>` : ''}</div>
    ${destra}</div></header>`;
}
const bIcona = (n, act, label, attr = '') => `<button class="b-ic" data-act="${act}" aria-label="${esc(label)}" ${attr}>${ic(n)}</button>`;
const fondo = contenuto => `<div class="fondo"><div class="fondo-in">${contenuto}</div></div>`;
const linkMappa = ind => `https://maps.apple.com/?q=${encodeURIComponent(ind)}`;
const linkTel = t => `tel:${esc(String(t).replace(/[^\d+]/g, ''))}`;
const barraH = () => ($('.barra')?.offsetHeight || 60);

/* ---------- Foglio dal basso (menu, scelte, domande) ---------- */
let SHEET = null;
function sheet({ titolo, sotto, voci = [], corpo = '', alto = false, annulla = true, onApri }) {
  chiudiSheet(true);
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet-bg" data-act="chiudi-sheet"></div>
    <div class="sheet${alto ? ' alto' : ''}" role="dialog" aria-modal="true">
      ${titolo ? `<div class="sheet-tit"><b>${esc(titolo)}</b>${sotto ? esc(sotto) : ''}</div>` : ''}
      ${corpo ? `<div class="sheet-corpo">${corpo}</div>` : ''}
      ${voci.map((v, i) => `<button class="sheet-voce ${v.cls || ''}" data-act="voce" data-i="${i}" ${v.dis ? 'disabled' : ''}>${v.ic ? ic(v.ic) : ''}<span>${esc(v.l)}${v.nota ? `<small>${esc(v.nota)}</small>` : ''}</span></button>`).join('')}
      ${annulla ? '<button class="sheet-voce annulla" data-act="chiudi-sheet">Annulla</button>' : ''}
    </div>`;
  document.body.appendChild(el);
  SHEET = { el, voci };
  el.getBoundingClientRect();
  el.classList.add('aperto');
  if (onApri) onApri(el);
  return el;
}
function chiudiSheet(subito) {
  if (!SHEET) return;
  const el = SHEET.el; SHEET = null;
  if (subito) { el.remove(); return; }
  el.classList.remove('aperto');
  setTimeout(() => el.remove(), 250);
}
function conferma({ titolo, testo, si, peric, fn }) {
  sheet({ titolo, sotto: testo, voci: [{ l: si, cls: peric ? 'peric' : 'pri', fn }] });
}
// Domanda con campo di testo (in alto, così la tastiera non lo copre)
function chiediTesto({ titolo, valore = '', ph = '', ok = 'OK', suggerimenti = [], fn }) {
  const corpo = `<input class="inp" id="sheet-inp" value="${esc(valore)}" placeholder="${esc(ph)}" autocomplete="off" enterkeyhint="done">
    ${suggerimenti.length ? `<div class="sugg" style="margin-top:12px">${suggerimenti.map(s => `<button class="chip mini" data-act="sheet-sugg" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
    <div class="fondo-in" style="margin-top:14px"><button class="btn" data-act="chiudi-sheet">Annulla</button><button class="btn pri" data-act="sheet-ok">${esc(ok)}</button></div>`;
  sheet({ titolo, corpo, alto: true, annulla: false, onApri: el => { const i = $('#sheet-inp', el); i.focus(); i.select(); } });
  SHEET.ok = v => { v = v.trim(); if (!v) { $('#sheet-inp').focus(); return; } chiudiSheet(); fn(v); };
}

/* ---------- Messaggi ---------- */
let toastTimer = null;
function toast(msg, azione, durata = 4500) {
  $('.toast')?.remove(); clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${azione ? `<button>${esc(azione.l)}</button>` : ''}`;
  if (azione) el.querySelector('button').onclick = () => { el.remove(); azione.fn(); };
  document.body.appendChild(el);
  el.getBoundingClientRect(); el.classList.add('su');
  toastTimer = setTimeout(() => { el.classList.remove('su'); setTimeout(() => el.remove(), 250); }, durata);
}
function attesa(testo) {
  const el = document.createElement('div');
  el.className = 'attesa';
  el.innerHTML = `<div><span class="gira"></span><span class="t">${esc(testo)}</span></div>`;
  document.body.appendChild(el);
  return { testo: t => { el.querySelector('.t').textContent = t; }, chiudi: () => el.remove() };
}
function avviso(titolo, testo) { sheet({ titolo, sotto: testo, voci: [], annulla: true }); $('.sheet .annulla').textContent = 'OK'; }

/* =========================================================
   HOME: rilievi e clienti
   ========================================================= */
function pHome() {
  const nR = attivi(S.rilievi).length, nC = attivi(S.clienti).length;
  const tab = UI.tab;
  app.innerHTML = barra({ titolo: 'Rilievi Serramenti', destra: bIcona('impostazioni', 'vai', 'Impostazioni', 'data-h="impostazioni"') })
    + `<main class="pag con-fondo largo">
      ${avvisiHome()}
      <div class="seg" role="tablist">
        <button class="${tab === 'rilievi' ? 'on' : ''}" data-act="tab" data-t="rilievi" role="tab" aria-selected="${tab === 'rilievi'}">Rilievi<span>${nR}</span></button>
        <button class="${tab === 'clienti' ? 'on' : ''}" data-act="tab" data-t="clienti" role="tab" aria-selected="${tab === 'clienti'}">Clienti<span>${nC}</span></button>
      </div>
      ${(tab === 'rilievi' ? nR : nC) ? `<div class="cerca">${ic('cerca')}<input type="search" id="cerca" placeholder="${tab === 'rilievi' ? 'Cerca titolo, cliente, indirizzo…' : 'Cerca cliente…'}" value="${esc(UI.cerca)}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Cerca"></div>` : ''}
      ${tab === 'rilievi' && nR ? `<div class="filtri">${[['tutti', 'Tutti'], ['Bozza', 'In bozza'], ['Completato', 'Completati']].map(([k, l]) => `<button class="filtro ${UI.filtro === k ? 'on' : ''}" data-act="filtro" data-f="${k}">${l}</button>`).join('')}</div>` : ''}
      <div id="lista">${tab === 'rilievi' ? listaRilievi() : listaClienti()}</div>
    </main>`
    + fondo(tab === 'clienti'
      ? `<button class="btn grande" data-act="vai" data-h="c/nuovo">${ic('piu')} Cliente</button><button class="btn pri grande" data-act="vai" data-h="nuovo">${ic('piu')} Rilievo</button>`
      : `<button class="btn pri grande" data-act="vai" data-h="nuovo">${ic('piu')} Nuovo rilievo</button>`);
}
function avvisiHome() {
  let h = '';
  if (IOS && !INSTALLATA && !S.imp.avviso_installa_chiuso) {
    h += `<div class="avviso installa">${ic('scarica')}<div><b>Installa l'app sull'iPhone</b>
      <ol><li>Tocca ${ic('condividi', 'piccola')} <b>Condividi</b> in basso in Safari</li><li>Scegli <b>«Aggiungi alla schermata Home»</b></li><li>Da lì in poi aprila dall'icona</li></ol>
      Così si apre come un'app, funziona senza internet e i dati restano al sicuro.
      <div class="azioni"><button class="btn piccolo" data-act="chiudi-installa">Ho capito</button></div></div></div>`;
  }
  const im = S.imp;
  const ciSonoDati = S.rilievi.size > 0;
  const mod = im.ultima_modifica && (!im.ultimo_backup || im.ultima_modifica > im.ultimo_backup);
  const giorni = im.ultimo_backup ? (Date.now() - Date.parse(im.ultimo_backup)) / 864e5 : Infinity;
  const rimandato = im.backup_rimandato && Date.now() < Date.parse(im.backup_rimandato);
  if (ciSonoDati && mod && giorni >= 7 && !rimandato) {
    h += `<div class="avviso giallo">${ic('scudo')}<div><b>${im.ultimo_backup ? `Ultimo backup ${Math.floor(giorni)} giorni fa` : 'Non hai ancora fatto un backup'}</b>
      I rilievi sono salvati solo su questo telefono. Ogni tanto salvane una copia su File, iCloud o via email.
      <div class="azioni"><button class="btn piccolo scuro" data-act="backup">Fai il backup</button><button class="btn piccolo" data-act="rimanda-backup">Più tardi</button></div></div></div>`;
  }
  return h;
}
function infoRilievi() {
  const m = new Map();
  for (const a of S.articoli.values()) {
    if (a.deleted_at) continue;
    let x = m.get(a.rilievo_id);
    if (!x) { x = { lista: [], mancanti: 0 }; m.set(a.rilievo_id, x); }
    x.lista.push(a);
    if (descrivi(a).mancano) x.mancanti++;
  }
  return m;
}
function cerca(testo, ...campi) {
  const q = norm(testo).trim(); if (!q) return true;
  const t = norm(campi.join(' '));
  return q.split(/\s+/).every(p => t.includes(p));
}
function gruppoData(iso) {
  const d = new Date(iso || 0), o = new Date();
  const g = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((g(o) - g(d)) / 864e5);
  if (diff <= 0) return 'Oggi';
  if (diff === 1) return 'Ieri';
  if (diff < 7) return 'Questa settimana';
  if (d.getFullYear() === o.getFullYear() && d.getMonth() === o.getMonth()) return 'Questo mese';
  return `${MESI[d.getMonth()]} ${d.getFullYear()}`;
}
function listaRilievi() {
  const tutti = attivi(S.rilievi);
  if (!tutti.length) return `<div class="vuoto benvenuto">${DISEGNO.svg(DISEGNO.disegna('Finestra/Porta-Finestra', { composizione_ante: '2 Ante', wasistas: true, larghezza_mm: 1200, altezza_mm: 1400 }, { w: 150, h: 150, quote: true }), 'illus')}
    <b>Benvenuto!</b><p>Tocca «Nuovo rilievo» per iniziare: scegli il cliente, aggiungi le stanze e in ogni stanza i serramenti. Le misure si salvano da sole, anche senza internet.</p></div>`;
  const info = infoRilievi();
  const l = tutti
    .filter(r => UI.filtro === 'tutti' || r.stato === UI.filtro)
    .filter(r => { const c = S.clienti.get(r.cliente_id); return cerca(UI.cerca, r.titolo, nomeCliente(c), r.indirizzo_cantiere, c?.indirizzo, r.note_generali, fmtData(r.data_rilievo)); })
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  if (!l.length) return `<div class="vuoto"><p>Nessun rilievo trovato.</p></div>`;
  const raggruppa = !UI.cerca.trim();
  let h = '', gruppo = null, aperta = false;
  for (const r of l) {
    if (raggruppa) {
      const g = gruppoData(r.updated_at);
      if (g !== gruppo) { if (aperta) h += '</div>'; h += `<div class="sez">${g}</div><div class="lista">`; gruppo = g; aperta = true; }
    } else if (!aperta) { h += '<div class="lista">'; aperta = true; }
    h += rigaRilievo(r, info.get(r.id));
  }
  return h + (aperta ? '</div>' : '');
}
function rigaRilievo(r, inf) {
  const c = S.clienti.get(r.cliente_id);
  const ns = r.stanze.filter(s => !s.deleted_at).length;
  const tipi = inf ? contaTipi(inf.lista).map(x => `<span class="mini-tipo" style="--cc:var(--c-${x.col})">${ic(x.icona)}${x.n}</span>`).join('') : '';
  return `<a class="riga riga-ril" href="#/r/${r.id}"><div class="riga-c">
    <div class="riga-t">${esc(titoloRilievo(r))}</div>
    <div class="riga-s">${esc(nomeCliente(c))}${r.indirizzo_cantiere && r.titolo ? ' · ' + esc(r.indirizzo_cantiere) : ''}</div>
    <div class="riga-m"><span>${fmtData(r.data_rilievo)} · ${plur(ns, 'stanza', 'stanze')}</span>${tipi ? `<span class="tipi">${tipi}</span>` : ''}</div>
    ${inf && inf.mancanti ? `<div class="riga-avv">${ic('avviso')}${plur(inf.mancanti, 'articolo', 'articoli')} senza misure</div>` : ''}
  </div><span class="pill ${r.stato}">${r.stato}</span></a>`;
}
function listaClienti(scegli) {
  const tutti = attivi(S.clienti);
  const testo = scegli ? UI.cercaClienti : UI.cerca;
  if (!tutti.length) return scegli ? '' : `<div class="vuoto">${ic('utente')}<b>Nessun cliente</b><p>I clienti si creano qui o quando inizi un nuovo rilievo.</p></div>`;
  const nRil = new Map();
  for (const r of S.rilievi.values()) if (!r.deleted_at) nRil.set(r.cliente_id, (nRil.get(r.cliente_id) || 0) + 1);
  const l = tutti.filter(c => cerca(testo, c.nome_cognome, c.indirizzo, c.telefono, c.email))
    .sort(scegli ? (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') : (a, b) => nomeCliente(a).localeCompare(nomeCliente(b), 'it'));
  if (!l.length) return `<div class="vuoto"><p>Nessun cliente trovato.</p></div>`;
  const iniziali = c => nomeCliente(c).split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return `<div class="lista">${l.map(c => scegli
    ? `<button class="riga" data-act="scegli-cliente" data-id="${c.id}"><span class="avatar">${esc(iniziali(c))}</span><div class="riga-c"><div class="riga-t">${esc(nomeCliente(c))}</div><div class="riga-s">${esc([c.indirizzo, c.telefono].filter(Boolean).join(' · ') || 'Nessun recapito')}</div></div>${ic('avanti')}</button>`
    : `<div class="riga riga-cl"><a class="riga-link" href="#/c/${c.id}"><span class="avatar">${esc(iniziali(c))}</span><div class="riga-c"><div class="riga-t">${esc(nomeCliente(c))}</div>
        <div class="riga-s">${esc([c.indirizzo, c.telefono].filter(Boolean).join(' · ') || 'Nessun recapito')}</div><div class="riga-m">${plur(nRil.get(c.id) || 0, 'rilievo', 'rilievi')}</div></div></a>
        ${c.telefono ? `<a class="b-tondo" href="${linkTel(c.telefono)}" aria-label="Chiama ${esc(nomeCliente(c))}">${ic('telefono')}</a>` : ''}</div>`).join('')}</div>`;
}

/* =========================================================
   CLIENTI
   ========================================================= */
const campoForm = (id, l, v, attr = '') => `<label class="f"><span>${l}</span><input id="${id}" value="${esc(v)}" ${attr}></label>`;
const campiCliente = (c = {}, salvaAuto) => {
  const s = k => salvaAuto ? `data-salva="clienti:${c.id}:${k}"` : '';
  return campoForm('c-nome', 'Nome e cognome <b class="obbl">*</b>', c.nome_cognome, `autocomplete="off" autocapitalize="words" enterkeyhint="next" ${s('nome_cognome')}`)
    + campoForm('c-ind', 'Indirizzo', c.indirizzo, `autocomplete="off" enterkeyhint="next" ${s('indirizzo')}`)
    + campoForm('c-tel', 'Telefono', c.telefono, `type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" ${s('telefono')}`)
    + campoForm('c-mail', 'Email', c.email, `type="email" inputmode="email" autocapitalize="off" autocomplete="off" enterkeyhint="done" ${s('email')}`);
};
function leggiCliente() {
  return { nome_cognome: $('#c-nome').value, indirizzo: $('#c-ind').value, telefono: $('#c-tel').value, email: $('#c-mail').value };
}
function controllaNome() {
  if ($('#c-nome').value.trim()) return true;
  $('#c-nome').closest('.f').classList.add('errore'); $('#c-nome').focus();
  toast('Scrivi almeno il nome del cliente');
  return false;
}
function pClienteNuovo() {
  app.innerHTML = barra({ titolo: 'Nuovo cliente', indietro: { h: '', l: 'Clienti' } })
    + `<main class="pag con-fondo"><div class="modulo">${campiCliente()}</div></main>`
    + fondo(`<button class="btn pri grande" data-act="crea-cliente">${ic('check')} Crea cliente</button>`);
}
function pCliente(cid) {
  const c = S.clienti.get(cid); if (!c || c.deleted_at) return false;
  const ril = attivi(S.rilievi).filter(r => r.cliente_id === cid).sort((a, b) => (b.data_rilievo || '').localeCompare(a.data_rilievo || ''));
  const info = infoRilievi();
  const righe = [
    c.indirizzo && `<a class="riga" href="${linkMappa(c.indirizzo)}" target="_blank" rel="noopener">${ic('pin')}<div class="riga-c"><div class="riga-s">Indirizzo · apri in Mappe</div><div class="riga-t" style="white-space:normal">${esc(c.indirizzo)}</div></div></a>`,
    c.telefono && `<a class="riga" href="${linkTel(c.telefono)}">${ic('telefono')}<div class="riga-c"><div class="riga-s">Telefono · chiama</div><div class="riga-t">${esc(c.telefono)}</div></div></a>`,
    c.email && `<a class="riga" href="mailto:${esc(c.email)}">${ic('posta')}<div class="riga-c"><div class="riga-s">Email · scrivi</div><div class="riga-t">${esc(c.email)}</div></div></a>`,
  ].filter(Boolean);
  app.innerHTML = barra({ titolo: nomeCliente(c), sotto: 'Cliente', indietro: { h: '', l: 'Clienti' }, destra: bIcona('matita', 'vai', 'Modifica cliente', `data-h="c/${cid}/modifica"`) })
    + `<main class="pag con-fondo">
      ${righe.length ? `<div class="lista info-cliente">${righe.join('')}</div>` : `<button class="btn blocco" data-act="vai" data-h="c/${cid}/modifica">${ic('matita')} Aggiungi indirizzo e recapiti</button>`}
      <div class="sez">Rilievi (${ril.length})</div>
      ${ril.length ? `<div class="lista">${ril.map(r => rigaRilievo(r, info.get(r.id))).join('')}</div>` : `<p class="nota">Nessun rilievo per questo cliente.</p>`}
    </main>`
    + fondo(`<button class="btn pri grande" data-act="vai" data-h="nuovo/${cid}">${ic('piu')} Nuovo rilievo per ${esc(nomeCliente(c).split(' ')[0])}</button>`);
}
function pClienteModifica(cid) {
  const c = S.clienti.get(cid); if (!c || c.deleted_at) return false;
  app.innerHTML = barra({ titolo: 'Modifica cliente', indietro: { h: `c/${cid}`, l: 'Cliente' } })
    + `<main class="pag"><div class="modulo">${campiCliente(c, true)}</div>
      <p class="nota">${ic('check', 'piccola')} Le modifiche si salvano da sole.</p>
      <div class="spazio"></div>
      <button class="btn peric blocco" data-act="cestina-cliente" data-id="${cid}">${ic('cestino')} Sposta il cliente nel cestino</button>
    </main>`;
}

/* =========================================================
   NUOVO RILIEVO (2 passi)
   ========================================================= */
function pNuovoCliente() {
  const ci = attivi(S.clienti).length > 0;
  const aperto = UI.ncAperto || !ci;
  app.innerHTML = barra({ titolo: 'Nuovo rilievo', sotto: 'Passo 1 di 2 · Cliente', indietro: { h: '', l: 'Annulla' } })
    + `<main class="pag">
      <div class="passi"><i class="on"></i><i></i></div>
      ${aperto ? `<div class="sez">Nuovo cliente</div><div class="modulo">${campiCliente()}</div>
        <div class="spazio"></div><button class="btn pri blocco grande" data-act="nc-continua">Continua ${ic('avanti')}</button>`
        : `<button class="btn blocco grande" data-act="nc-apri">${ic('piu')} Nuovo cliente</button>`}
      ${ci ? `<div class="sez">${aperto ? 'Oppure scegli un cliente esistente' : 'Scegli un cliente'}</div>
        <div class="cerca">${ic('cerca')}<input type="search" id="cerca-clienti" placeholder="Cerca cliente…" value="${esc(UI.cercaClienti)}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Cerca cliente"></div>
        <div id="lista-clienti">${listaClienti(true)}</div>` : ''}
    </main>`;
}
function pNuovoDati(cid) {
  const c = S.clienti.get(cid); if (!c || c.deleted_at) return false;
  const daScheda = pila.includes(`c/${cid}`);
  app.innerHTML = barra({ titolo: 'Nuovo rilievo', sotto: daScheda ? 'Dati del cantiere' : 'Passo 2 di 2 · Cantiere', indietro: daScheda ? { h: `c/${cid}`, l: 'Cliente' } : { h: 'nuovo', l: 'Cliente' } })
    + `<main class="pag con-fondo">
      <div class="passi"><i class="on"></i><i class="on"></i></div>
      <div class="cliente-scelto">${ic('utente')}<div><b>${esc(nomeCliente(c))}</b><small>${esc(c.indirizzo || 'Cliente scelto')}</small></div><button class="link-btn" data-act="torna" data-h="nuovo">Cambia</button></div>
      <div class="modulo">${campiRilievo({ titolo: '', data_rilievo: oggi(), indirizzo_cantiere: c.indirizzo, note_generali: '' })}</div>
      ${c.indirizzo ? '<p class="nota">L\'indirizzo del cantiere è quello del cliente: cambialo se è diverso.</p>' : ''}
    </main>`
    + fondo(`<button class="btn pri grande" data-act="crea-rilievo" data-cid="${cid}">${ic('check')} Crea e inizia il rilievo</button>`);
}
function campiRilievo(r, salvaAuto) {
  const s = k => salvaAuto ? `data-salva="rilievi:${r.id}:${k}"` : '';
  return campoForm('r-tit', 'Titolo del lavoro', r.titolo, `placeholder="es. Ristrutturazione villetta" autocomplete="off" ${s('titolo')}`)
    + campoForm('r-data', 'Data del rilievo', r.data_rilievo, `type="date" ${s('data_rilievo')}`)
    + campoForm('r-ind', 'Indirizzo del cantiere', r.indirizzo_cantiere, `autocomplete="off" ${s('indirizzo_cantiere')}`)
    + `<label class="f"><span>Note generali</span><textarea id="r-note" rows="3" placeholder="es. piano terra, accesso dal cortile, chiavi dal vicino…" ${s('note_generali')}>${esc(r.note_generali)}</textarea></label>`;
}
function pModificaRilievo(rid) {
  const r = S.rilievi.get(rid); if (!r || r.deleted_at) return false;
  const c = S.clienti.get(r.cliente_id);
  app.innerHTML = barra({ titolo: 'Dati del rilievo', indietro: { h: `r/${rid}`, l: 'Rilievo' } })
    + `<main class="pag">
      <div class="cliente-scelto">${ic('utente')}<div><b>${esc(nomeCliente(c))}</b><small>Cliente</small></div><button class="link-btn" data-act="cambia-cliente" data-id="${rid}">Cambia</button></div>
      <div class="modulo">${campiRilievo(r, true)}</div>
      <p class="nota">${ic('check', 'piccola')} Le modifiche si salvano da sole.</p>
      <div class="sez">Stato</div>
      <div class="chips">${['Bozza', 'Completato'].map(s => `<button class="chip ${r.stato === s ? 'on' : ''}" data-act="stato" data-id="${rid}" data-v="${s}" aria-pressed="${r.stato === s}">${s}</button>`).join('')}</div>
      <div class="spazio"></div><div class="spazio"></div>
      <button class="btn peric blocco" data-act="cestina-rilievo" data-id="${rid}">${ic('cestino')} Sposta il rilievo nel cestino</button>
    </main>`;
}

/* =========================================================
   RILIEVO: stanze e articoli
   ========================================================= */
function pRilievo(rid) {
  const r = S.rilievi.get(rid); if (!r || r.deleted_at) return false;
  const c = S.clienti.get(r.cliente_id);
  const str = struttura(r), pos = posizioni(str);
  const riep = riepilogo(r);
  const mancanti = str.reduce((n, s) => n + s.articoli.filter(a => descrivi(a).mancano).length, 0);
  let h = barra({ titolo: titoloRilievo(r), sotto: nomeCliente(c), indietro: { h: '', l: 'Rilievi' }, destra: bIcona('menu', 'menu-rilievo', 'Menu del rilievo', `data-id="${rid}"`) });
  h += `<main class="pag con-fondo largo">
  ${r.stato === 'Completato' ? `<div class="completato">${ic('check')}<span>Rilievo completato</span><button class="link-btn" data-act="stato" data-id="${rid}" data-v="Bozza">Riapri</button></div>` : ''}
  <section class="testata">
    <div class="testata-top"><a href="#/c/${c ? c.id : ''}">${esc(nomeCliente(c))}${ic('avanti', 'piccola')}</a>
      <button class="pill ${r.stato}" data-act="menu-stato" data-id="${rid}">${r.stato}</button></div>
    ${r.indirizzo_cantiere ? `<div class="testata-r">${ic('pin')}<a href="${linkMappa(r.indirizzo_cantiere)}" target="_blank" rel="noopener">${esc(r.indirizzo_cantiere)}</a></div>` : ''}
    <div class="testata-r">${ic('calendario')}<span>${fmtData(r.data_rilievo)}</span></div>
    ${c && c.telefono ? `<div class="testata-r">${ic('telefono')}<a href="${linkTel(c.telefono)}">${esc(c.telefono)}</a></div>` : ''}
    ${riep.length ? `<div class="conteggi">${riep.map(x => `<span class="conteggio" style="--cc:var(--c-${x.col})">${ic(x.icona)}${x.n} ${esc(x.nome)}</span>`).join('')}</div>` : ''}
    ${mancanti ? `<button class="mancanti" data-act="vai-mancante">${ic('avviso')}<span>${mancanti === 1 ? '1 articolo senza misure' : mancanti + ' articoli senza misure'}</span><b>Vai</b></button>` : ''}
    ${r.note_generali ? `<div class="note-gen">${esc(r.note_generali)}</div>` : ''}
  </section>`;

  if (str.length > 1) {
    h += `<nav class="indice" id="indice" aria-label="Stanze">${str.map(({ stanza: s, articoli }) => `<button class="indice-v" data-act="vai-stanza" data-sid="${s.id}">${esc(s.nome)}<span>${articoli.length}</span></button>`).join('')}</nav>`;
  }
  if (!str.length) {
    h += `<div class="vuoto">${ic('casa')}<b>Aggiungi la prima stanza</b><p>Tocca il nome della stanza in cui sei:</p></div>
      <div class="stanze-rapide">${STANZE_TIPICHE.slice(0, 12).map(n => `<button class="chip" data-act="stanza-rapida" data-n="${esc(n)}">${esc(n)}</button>`).join('')}
      <button class="chip altro" data-act="aggiungi-stanza">Altro nome…</button></div>`;
  }
  for (const { stanza: s, articoli } of str) {
    const chiusa = UI.chiuse.has(s.id);
    h += `<section class="stanza${chiusa ? ' chiusa' : ''}" id="s-${s.id}" style="--n:${articoli.length}">
      <div class="stanza-t"><button class="stanza-nome" data-act="apri-chiudi" data-sid="${s.id}" aria-expanded="${!chiusa}">${ic('giu', 'freccia')}<h2>${esc(s.nome)}</h2><small>${articoli.length || ''}</small></button>${bIcona('menu', 'menu-stanza', 'Menu stanza ' + s.nome, `data-sid="${s.id}"`)}</div>
      ${chiusa ? `<button class="stanza-rias" data-act="apri-chiudi" data-sid="${s.id}">${articoli.length ? esc(contaTipi(articoli).map(x => `${x.n} ${x.nome}`).join(' · ')) : 'Nessun articolo'} · tocca per aprire</button>`
        : `${articoli.length ? `<div class="arts">${articoli.map(a => schedaArticolo(a, pos.get(a.id))).join('')}</div>` : ''}
      <div class="aggiungi">${CATEGORIE.map(k => `<button class="agg" style="--cc:var(--c-${k.col})" data-act="nuovo-art" data-sid="${s.id}" data-cat="${esc(k.id)}" aria-label="Aggiungi ${esc(k.breve)} in ${esc(s.nome)}">${ic(k.icona)}<span>${esc(k.breve)}</span></button>`).join('')}</div>`}
    </section>`;
  }
  if (str.length) h += sezFirma(r);
  h += `</main>`;
  h += fondo(`<button class="btn grande" data-act="aggiungi-stanza">${ic('piu')} Stanza</button><button class="btn scuro grande" data-act="esporta" data-id="${rid}">${ic('condividi')} Esporta</button>`);
  app.innerHTML = h;
  if (r.firma && !S.mini.has(r.firma.id)) caricaMiniature(rid).then(() => { if (rotta === `r/${rid}`) { const f = $('#firma'); if (f) f.outerHTML = sezFirma(r); } });
}
function sezFirma(r) {
  const m = r.firma && S.mini.get(r.firma.id);
  return `<section class="sez-firma" id="firma"><div class="sez">Firma del cliente</div>
    ${r.firma ? `<button class="firma-v" data-act="menu-firma">${m ? `<img src="${urlMiniatura(m)}" alt="Firma">` : '<span class="img-vuota"></span>'}<span><b>Firmato da ${esc(r.firma.nome || 'cliente')}</b><small>${fmtQuando(r.firma.quando)}</small></span>${ic('menu')}</button>`
      : `<button class="btn blocco" data-act="firma">${ic('firma')} Fai firmare il cliente</button><p class="nota">Facoltativa: finisce nel PDF «per presa visione».</p>`}
  </section>`;
}
function schedaArticolo(a, n) {
  const d = descrivi(a);
  const misure = d.misure ? (d.mancano ? `<span class="art-mis manca">Misure da inserire</span>` : `<span class="art-mis">${esc(d.misure)}<small>mm</small></span>`) : '';
  return `<div class="art" id="a-${a.id}" style="--cc:var(--c-${d.cat.col})">
    <a class="art-main" href="#/r/${a.rilievo_id}/a/${a.id}">
      <span class="art-dis">${svgMini(a)}<span class="art-pos">${n}</span></span>
      <span class="art-txt">
        <span class="art-tit">${esc(d.titolo)}${d.punti ? '<span class="tag">3 punti</span>' : ''}${d.q > 1 ? `<span class="q">×${d.q}</span>` : ''}${a.foto && a.foto.length ? `<span class="nfoto">${ic('foto')}${a.foto.length}</span>` : ''}</span>
        ${misure}
        ${d.brevi.length ? `<span class="art-det">${esc(d.brevi.join(' · '))}</span>` : ''}
        ${d.note ? `<span class="art-note">${esc(d.note)}</span>` : ''}
      </span>
    </a>
    <button class="art-dup" data-act="duplica" data-id="${a.id}" aria-label="Duplica ${esc(d.titolo)} posizione ${n}">${ic('duplica')}<span>Duplica</span></button>
  </div>`;
}
// Indice delle stanze: evidenzia quella che si sta guardando
let osservatore = null;
function osservaStanze() {
  const nav = $('#indice');
  if (!nav || !('IntersectionObserver' in window)) return;
  const sopra = barraH() + nav.offsetHeight + 8;
  const visibili = new Map();
  osservatore = new IntersectionObserver(voci => {
    for (const v of voci) visibili.set(v.target.id.slice(2), v.isIntersecting ? v.boundingClientRect.top : null);
    let att = null, min = Infinity;
    for (const [sid, top] of visibili) if (top !== null && top < min) { min = top; att = sid; }
    if (!att) return;
    $$('.indice-v', nav).forEach(b => {
      const on = b.dataset.sid === att;
      if (on && !b.classList.contains('on')) nav.scrollTo({ left: b.offsetLeft - 16, behavior: 'smooth' });
      b.classList.toggle('on', on);
    });
  }, { rootMargin: `-${sopra}px 0px -55% 0px` });
  $$('.stanza').forEach(s => osservatore.observe(s));
}

/* =========================================================
   ARTICOLO: modulo dinamico per categoria
   ========================================================= */
function pArticolo(rid, aid) {
  const r = S.rilievi.get(rid), a = S.articoli.get(aid);
  if (!r || r.deleted_at || !a || a.deleted_at || a.rilievo_id !== rid) return false;
  const cat = CAT[a.categoria];
  const lista = struttura(r).flatMap(s => s.articoli);
  const i = lista.indexOf(a), prec = lista[i - 1], succ = lista[i + 1];
  const st = r.stanze.find(s => s.id === a.stanza_id);
  let banner = '';
  if (UI.prec && UI.prec.aid === aid) {
    const da = UI.prec.da;
    const dove = da.rilievo_id === rid ? `dalla Pos. ${lista.indexOf(da) + 1 || '?'} (${da.stanza_rif})` : 'dall\'ultimo articolo uguale';
    banner = `<div class="prec">${ic('duplica')}<span>Scelte copiate ${esc(dove)}</span><button class="link-btn" data-act="svuota-scelte">Svuota</button></div>`;
  }
  app.innerHTML = barra({ titolo: `Pos. ${i + 1} · ${descrivi(a).titolo}`, sotto: `${st ? st.nome : ''} · ${titoloRilievo(r)}`, indietro: { h: `r/${rid}`, l: 'Rilievo' }, destra: bIcona('menu', 'menu-articolo', 'Menu articolo') })
    + `<main class="pag con-fondo" id="editor" data-aid="${aid}" style="--cc:var(--c-${cat.col})">
      <div class="ed-nav">
        <button class="b-nav" data-act="art-vai" data-id="${prec ? prec.id : ''}" ${prec ? '' : 'disabled'} aria-label="Articolo precedente">${ic('indietro')}</button>
        <button class="ed-nav-c" data-act="sposta-articolo" aria-label="Cambia stanza"><small>${ic(cat.icona, 'piccola')} ${esc(cat.lungo)} · ${i + 1} di ${lista.length}</small><b>${esc(st ? st.nome : '—')}</b></button>
        <button class="b-nav" data-act="art-vai" data-id="${succ ? succ.id : ''}" ${succ ? '' : 'disabled'} aria-label="Articolo successivo">${ic('avanti')}</button>
      </div>
      ${banner}
      <div id="campi">${campiArticolo(a)}</div>
      <section class="campo"><div class="etichetta">Foto e schizzi <em>${a.foto.length ? '' : 'facoltativi'}</em></div><div class="foto-griglia" id="foto">${grigliaFoto(a)}</div></section>
    </main>`
    + fondo(`<button class="btn grande" data-act="duplica" data-id="${aid}">${ic('duplica')} Duplica</button><button class="btn pri grande" data-act="fatto">${ic('check')} Fatto</button>`);
  if (!S.miniCaricate.has(rid)) caricaMiniature(rid).then(() => { if (rotta === `r/${rid}/a/${aid}`) aggiornaFoto(a); });
}
const artCorrente = () => S.articoli.get($('#editor')?.dataset.aid);
function campo(a, k) { return CAT[a.categoria].campi.find(f => f.k === k || (f.extra && f.extra.k === k)); }
function leggiCampo(a, f) { return f.base ? a[f.k] : a.configurazione[f.k]; }

function sezMisure(a) {
  const c = a.configurazione, tast = S.imp.tastierino;
  const valore = (id, lett, nome, v) => tast
    ? `<button type="button" class="mis-val${vuoto(v) ? ' vuota' : ''}" data-act="tast" data-f="${id}" aria-label="${nome}: ${vuoto(v) ? 'da inserire' : v + ' millimetri'}"><span class="et"><b>${lett}</b> · ${nome} (mm)</span><span class="v">${vuoto(v) ? '0' : v}</span></button>`
    : `<label class="mis"><span class="et"><b>${lett}</b> · ${nome} (mm)</span><input data-f="${id}" data-num type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0" value="${vuoto(v) ? '' : v}"></label>`;
  const punto = (id, nome, v) => tast
    ? `<button type="button" class="punto${vuoto(v) ? ' vuota' : ''}" data-act="tast" data-f="${id}"><small>${nome}</small><span class="v">${vuoto(v) ? '—' : v}</span></button>`
    : `<label class="punto"><small>${nome}</small><input data-f="${id}" data-num type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="—" value="${vuoto(v) ? '' : v}"></label>`;
  let h = `<section class="campo sez-misure" id="sez-misure"><div class="dis-ed" id="dis-ed">${svgGrande(a)}</div>`;
  if (c.misura_punti) {
    const p = c.punti || { L: [], H: [] };
    h += `<div class="punti" id="valori">
      <div class="punti-g"><span class="et"><b>L</b> · Larghezza (mm)</span><div>${punto('L0', 'alto', p.L[0])}${punto('L1', 'centro', p.L[1])}${punto('L2', 'basso', p.L[2])}</div></div>
      <div class="punti-g"><span class="et"><b>H</b> · Altezza (mm)</span><div>${punto('H0', 'sinistra', p.H[0])}${punto('H1', 'centro', p.H[1])}${punto('H2', 'destra', p.H[2])}</div></div>
      <div class="punti-min">Misura da usare (la più piccola): <b id="min-mis">${descrivi(a).misure}</b> mm</div></div>`;
  } else {
    h += `<div class="misure" id="valori">${valore('larghezza_mm', 'L', 'Larghezza', c.larghezza_mm)}${valore('altezza_mm', 'H', 'Altezza', c.altezza_mm)}</div>`;
  }
  h += `<div class="mis-nota" id="mis-nota">${notaMisure(c)}</div>
    <label class="riga-campo mis-3p"><span><b>Misura in 3 punti</b><small>Tre larghezze e tre altezze: uso la più piccola</small></span><input type="checkbox" class="sw" role="switch" data-punti ${c.misura_punti ? 'checked' : ''}></label>
  </section>`;
  return h;
}
function campiArticolo(a) {
  const cat = CAT[a.categoria], c = a.configurazione;
  let h = '';
  for (const f of cat.campi) {
    if (f.se && !f.se(c)) continue;
    const v = leggiCampo(a, f);
    const agg = f.agg ? ' <em>facoltativo</em>' : '';
    if (f.t === 'misure') h += sezMisure(a);
    else if (f.t === 'chips') {
      const altroOn = f.altro && (UI.altro.has(a.id + '|' + f.k) || (!vuoto(v) && !f.o.includes(v)));
      h += `<section class="campo"><div class="etichetta">${esc(f.l)}${agg}</div><div class="chips" role="group" aria-label="${esc(f.l)}">
        ${f.o.map(o => `<button class="chip ${v === o ? 'on' : ''}" data-act="chip" data-k="${f.k}" data-v="${esc(o)}" aria-pressed="${v === o}">${esc(o)}</button>`).join('')}
        ${f.altro ? `<button class="chip altro ${altroOn ? 'on' : ''}" data-act="altro" data-k="${f.k}" aria-pressed="${!!altroOn}">${esc(f.altro)}</button>` : ''}
      </div>
      ${altroOn ? `<input class="inp" data-f="${f.k}" value="${esc(f.o.includes(v) ? '' : v)}" placeholder="${esc(f.ph || 'Scrivi qui')}" autocomplete="off" enterkeyhint="done">` : ''}
      ${f.extra && v === f.extra.se ? `<input class="inp" data-f="${f.extra.k}" value="${esc(c[f.extra.k] || '')}" placeholder="${esc(f.extra.ph)}" autocomplete="off" autocapitalize="characters" enterkeyhint="done">` : ''}
      </section>`;
    } else if (f.t === 'int') {
      h += `<section class="campo"><div class="riga-campo"><div class="etichetta">${esc(f.l)}</div>
        <div class="stepper"><button data-act="meno" data-k="${f.k}" aria-label="Meno">${ic('meno')}</button><input data-f="${f.k}" data-num type="text" inputmode="numeric" pattern="[0-9]*" value="${vuoto(v) ? '' : v}" autocomplete="off" aria-label="${esc(f.l)}"><button data-act="piu" data-k="${f.k}" aria-label="Più">${ic('piu')}</button></div></div></section>`;
    } else if (f.t === 'bool') {
      h += `<section class="campo"><label class="riga-campo"><span class="etichetta">${esc(f.l)}</span><input type="checkbox" class="sw" role="switch" data-f="${f.k}" ${v ? 'checked' : ''}></label></section>`;
    } else if (f.t === 'testo') {
      h += `<section class="campo"><div class="etichetta">${esc(f.l)}${agg}</div>
        <input class="inp" data-f="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" autocomplete="off" enterkeyhint="done">
        ${f.sugg ? `<div class="sugg" data-sugg="${f.k}">${suggerimenti(a, f.k, v)}</div>` : ''}</section>`;
    } else if (f.t === 'note') {
      h += `<section class="campo"><div class="etichetta">${esc(f.l)}</div><textarea class="inp" data-f="note" rows="2" placeholder="Annotazioni per l'ufficio o la posa">${esc(v)}</textarea></section>`;
    }
  }
  return h;
}
function notaMisure(c) {
  const L = c.larghezza_mm, H = c.altezza_mm;
  if (vuoto(L) && vuoto(H)) return 'Misure in millimetri: tocca L per iniziare';
  return `${vuoto(L) ? '—' : metri(L) + ' m'}  ×  ${vuoto(H) ? '—' : metri(H) + ' m'}`;
}
// aggiorna solo i pezzi delle misure (veloce: niente ridisegno di tutta la pagina)
function aggiornaMisure(a) {
  const c = a.configurazione;
  for (const b of $$('#sez-misure [data-f]')) {
    const id = b.dataset.f;
    const v = /^[LH][0-2]$/.test(id) ? (c.punti ? c.punti[id[0]][+id[1]] : null) : c[id];
    if (b.tagName === 'BUTTON') {
      const s = $('.v', b); s.textContent = vuoto(v) ? (b.classList.contains('punto') ? '—' : '0') : v;
      b.classList.toggle('vuota', vuoto(v));
    }
  }
  const n = $('#mis-nota'); if (n) n.textContent = notaMisure(c);
  const m = $('#min-mis'); if (m) m.textContent = descrivi(a).misure;
  const d = $('#dis-ed'); if (d) d.innerHTML = svgGrande(a);
}
function apriTastierino(a, id) {
  const campi = campiMisura(a);
  const i = Math.max(0, campi.findIndex(x => x.id === id));
  TASTIERINO.apri({
    campi, i, onTocco: vibra,
    onCambia: (k, v) => { scriviMisura(a, k, v); aggiornaMisure(a); },
    onSposta: k => { $$('#sez-misure [data-f]').forEach(b => b.classList.toggle('attivo', b.dataset.f === k)); },
    onChiudi: () => { $$('#sez-misure .attivo').forEach(b => b.classList.remove('attivo')); },
  });
  // la sezione delle misure deve restare visibile sopra il tastierino
  requestAnimationFrame(() => {
    const v = $('#valori'), s = $('#sez-misure'); if (!v || !s) return;
    const alto = TASTIERINO.altezza(), sopra = barraH() + 8;
    const limite = innerHeight - alto - 10;
    const rv = v.getBoundingClientRect(), rs = s.getBoundingClientRect();
    let dy = 0;
    if (rv.bottom > limite) dy = rv.bottom - limite + 36;
    if (rs.top - dy < sopra && rs.height < limite - sopra) dy = rs.top - sopra;
    if (rv.top - dy < sopra) dy = rv.top - sopra - 8;
    if (Math.abs(dy) > 2) scrollBy({ top: dy, behavior: 'smooth' });
  });
}
// Suggerimenti: i valori che hai già usato più spesso per lo stesso campo
function suggerimenti(a, k, attuale) {
  const conta = new Map();
  for (const x of S.articoli.values()) {
    if (x.deleted_at || x.id === a.id) continue;
    const v = x.configurazione && x.configurazione[k];
    if (typeof v !== 'string' || !v.trim()) continue;
    const t = v.trim(); conta.set(t, (conta.get(t) || 0) + 1);
  }
  const q = norm(attuale).trim();
  return [...conta.entries()]
    .filter(([v]) => norm(v) !== q && (!q || norm(v).includes(q)))
    .sort((x, y) => y[1] - x[1]).slice(0, 6)
    .map(([v]) => `<button class="chip mini" data-act="sugg" data-k="${k}" data-v="${esc(v)}">${esc(v)}</button>`).join('');
}
function aggiornaCampi() { const a = artCorrente(); if (a) { TASTIERINO.chiudi(); $('#campi').innerHTML = campiArticolo(a); $$('#campi textarea').forEach(autoAltezza); } }
function cambiaArticolo(a) { modificato(a, 'articoli'); toccaRilievo(a.rilievo_id); }
function aggiornaTitoloEditor(a) {
  const r = S.rilievi.get(a.rilievo_id);
  const b = $('.barra-titolo b');
  if (b) b.textContent = `Pos. ${posizioni(struttura(r)).get(a.id)} · ${descrivi(a).titolo}`;
}

/* ---------- Foto, schizzi, firma ---------- */
const urlMini = new Map();
function urlMiniatura(m) {
  if (!urlMini.has(m.id)) urlMini.set(m.id, URL.createObjectURL(new Blob([m.data], { type: 'image/jpeg' })));
  return urlMini.get(m.id);
}
async function caricaMiniature(rid) {
  if (S.miniCaricate.has(rid)) return;
  const l = await DB.perIndice('miniature', 'rilievo_id', rid);
  for (const m of l) S.mini.set(m.id, m);
  S.miniCaricate.add(rid);
}
function grigliaFoto(a) {
  return a.foto.map(id => {
    const m = S.mini.get(id);
    return `<button class="foto-th" data-act="vedi-foto" data-id="${id}" aria-label="Apri foto">${m ? `<img src="${urlMiniatura(m)}" alt="">` : ''}</button>`;
  }).join('') + `<label class="foto-add">${ic('foto')}<span>${a.foto.length ? 'Altra foto' : 'Foto'}</span><input type="file" accept="image/*" multiple data-foto></label>
    <button class="foto-add" data-act="schizzo">${ic('penna')}<span>Schizzo</span></button>`;
}
function aggiornaFoto(a) { const g = $('#foto'); if (g) g.innerHTML = grigliaFoto(a); }

function caricaImmagine(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('formato immagine non leggibile')); };
    img.src = url;
  });
}
async function riduci(sorg, sw, sh, lato, qualita) {
  const s = Math.min(1, lato / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(sorg, 0, 0, w, h);
  const blob = await new Promise((ok, ko) => cv.toBlob(b => b ? ok(b) : ko(new Error('compressione non riuscita')), 'image/jpeg', qualita));
  const dati = await blob.arrayBuffer();
  return { cv, dati, w, h };
}
// salva un'immagine (foto, schizzo, firma): versione grande per PDF e visore, miniatura per l'elenco
async function salvaImmagine(sorg, sw, sh, meta) {
  const g = await riduci(sorg, sw, sh, 1600, 0.82);
  const p = await riduci(g.cv, g.w, g.h, 360, 0.72);
  g.cv.width = g.cv.height = 0; p.cv.width = p.cv.height = 0;
  const t = ora(), id = uuid();
  const base = { id, ...meta, w: g.w, h: g.h, created_at: t, updated_at: t };
  const mini = { ...base, data: p.dati, deleted_at: null, cestino_gruppo: null };
  await DB.scrivi({ foto: [{ ...base, data: g.dati }], miniature: [mini] });
  S.mini.set(id, mini);
  segnaModifica();
  return mini;
}
async function aggiungiFoto(a, files) {
  const att = attesa('Salvo la foto…');
  let fatte = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      if (files.length > 1) att.testo(`Salvo la foto ${i + 1} di ${files.length}…`);
      const img = await caricaImmagine(files[i]);
      const m = await salvaImmagine(img, img.naturalWidth, img.naturalHeight, { rilievo_id: a.rilievo_id, articolo_id: a.id, tipo: 'foto' });
      a.foto.push(m.id); cambiaArticolo(a); fatte++;
    }
  } catch (e) {
    avviso('Foto non salvata', 'Qualcosa non ha funzionato: ' + (e.message || e));
  }
  att.chiudi();
  aggiornaFoto(a);
  if (fatte) { vibra(); toast(fatte === 1 ? 'Foto salvata' : `${fatte} foto salvate`); }
}
async function salvaDisegno(a, ris, tipo) {
  if (!ris) return;
  const att = attesa('Salvo…');
  try {
    const img = await caricaImmagine(ris.blob);
    const m = await salvaImmagine(img, img.naturalWidth, img.naturalHeight, { rilievo_id: a.rilievo_id, articolo_id: a.id, tipo });
    a.foto.push(m.id); cambiaArticolo(a);
    vibra(); toast(tipo === 'schizzo' ? 'Schizzo salvato' : 'Disegno salvato come nuova foto');
  } catch (e) { avviso('Non salvato', String(e.message || e)); }
  att.chiudi();
  aggiornaFoto(a);
}
async function nuovoSchizzo(a) {
  const verticale = innerHeight > innerWidth;
  const ris = await LAVAGNA.apri({ titolo: 'Schizzo', griglia: true, larg: verticale ? 1200 : 1600, alt: verticale ? 1600 : 1200 });
  await salvaDisegno(a, ris, 'schizzo');
}
async function vediFoto(id) {
  const rec = await DB.uno('foto', id);
  if (!rec) { toast('Foto non trovata'); return; }
  const url = URL.createObjectURL(new Blob([rec.data], { type: 'image/jpeg' }));
  const el = document.createElement('div');
  el.className = 'visore';
  el.innerHTML = `<div class="visore-barra"><button data-v="chiudi">${ic('chiudi')} Chiudi</button><span></span>
    <button data-v="disegna">${ic('penna')} Disegna sopra</button><button class="peric" data-v="cestina" aria-label="Sposta nel cestino">${ic('cestino')}</button></div>
    <div class="visore-img"><img src="${url}" alt="Foto"></div>`;
  const chiudi = () => { el.remove(); URL.revokeObjectURL(url); };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const m = S.mini.get(id), a = m && S.articoli.get(m.articolo_id);
    if (b.dataset.v === 'chiudi') chiudi();
    if (b.dataset.v === 'cestina') {
      chiudi();
      if (!m) return;
      cestinaConAnnulla('foto', m, null, 'Foto spostata nel cestino');
      if (a) aggiornaFoto(a);
    }
    if (b.dataset.v === 'disegna' && a) {
      const img = el.querySelector('img');
      const ris = await LAVAGNA.apri({ titolo: 'Disegna sulla foto', sfondo: img });
      chiudi();
      await salvaDisegno(a, ris, 'foto');
    }
  });
  document.body.appendChild(el);
}
async function firmaCliente(r) {
  const ris = await LAVAGNA.apri({ titolo: 'Firma del cliente', firma: true, larg: 1100, alt: 440 });
  if (!ris) return;
  const c = S.clienti.get(r.cliente_id);
  chiediTesto({ titolo: 'Chi ha firmato?', valore: nomeCliente(c), ph: 'Nome e cognome', ok: 'Salva firma', fn: async nome => {
    const att = attesa('Salvo la firma…');
    try {
      const img = await caricaImmagine(ris.blob);
      const m = await salvaImmagine(img, img.naturalWidth, img.naturalHeight, { rilievo_id: r.id, articolo_id: null, tipo: 'firma' });
      // la firma precedente resta nell'archivio (non si cancella mai niente)
      r.firma = { id: m.id, nome, quando: ora() };
      modificato(r, 'rilievi');
      vibra(); toast('Firma salvata');
    } catch (e) { avviso('Firma non salvata', String(e.message || e)); }
    att.chiudi();
    ridisegna();
  } });
}

/* =========================================================
   IMPOSTAZIONI E CESTINO
   ========================================================= */
const scelte = (k, opz) => `<div class="chips">${opz.map(([v, l]) => `<button class="chip ${S.imp[k] === v ? 'on' : ''}" data-act="imp-scelta" data-k="${k}" data-v="${v}" aria-pressed="${S.imp[k] === v}">${l}</button>`).join('')}</div>`;
const interruttore = (k, tit, testo) => `<label class="riga-campo"><span style="flex:1"><b style="display:block;font-size:16px">${tit}</b><span style="color:var(--ink2);font-size:14px">${testo}</span></span><input type="checkbox" class="sw" role="switch" data-imp-bool="${k}" ${S.imp[k] ? 'checked' : ''}></label>`;
let urlLogo = null;
function pImpostazioni() {
  const im = S.imp;
  const nCest = contaCestino();
  if (urlLogo) { URL.revokeObjectURL(urlLogo); urlLogo = null; }
  if (S.logo && S.logo.data) urlLogo = URL.createObjectURL(new Blob([S.logo.data], { type: 'image/jpeg' }));
  app.innerHTML = barra({ titolo: 'Impostazioni', indietro: { h: '', l: 'Rilievi' } })
    + `<main class="pag">
      <div class="sez">Backup</div>
      <div class="modulo pad">
        <p class="testo2">I dati sono salvati solo su questo telefono. Con il backup ne salvi una copia completa (foto comprese) su File, iCloud Drive, email o WhatsApp. Se cambi telefono, la ripristini da qui.</p>
        <p style="margin:0 0 12px;font-weight:600">${im.ultimo_backup ? 'Ultimo backup: ' + fmtQuando(im.ultimo_backup) : 'Non hai ancora fatto nessun backup.'}</p>
        <button class="btn pri blocco" data-act="backup">${ic('scarica')} Salva backup completo</button>
        <div class="spazio"></div>
        <label class="btn blocco">${ic('carica')} Ripristina o importa un file<input type="file" data-importa></label>
        <p class="nota" style="margin:10px 0 0">Ripristinare non cancella niente: aggiunge i dati nuovi e aggiorna quelli più vecchi. Funziona anche con il file JSON di un singolo rilievo.</p>
      </div>

      <div class="sez">Aspetto</div>
      <div class="modulo pad">
        <div class="etichetta">Tema</div>${scelte('tema', [['auto', 'Come il telefono'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']])}
        <div class="etichetta" style="margin-top:16px">Grandezza del testo</div>${scelte('testo', [['normale', 'Normale'], ['grande', 'Grande'], ['enorme', 'Molto grande']])}
      </div>

      <div class="sez">Inserimento</div>
      <div class="modulo pad lista-sw">
        ${interruttore('tastierino', 'Tastierino grande per le misure', 'Tasti grandi dentro l\'app, con «Avanti» da L ad H. Spento: si usa la tastiera del telefono.')}
        ${interruttore('precompila', 'Ricorda le ultime scelte', 'Un nuovo articolo parte con profilo, vetro, colori… dell\'ultimo dello stesso tipo. Le misure restano vuote.')}
        ${interruttore('vibrazione', 'Vibrazione al tocco', 'Una leggera vibrazione quando premi i tasti (iPhone con iOS 18 o più recente).')}
      </div>

      <div class="sez">Intestazione dei PDF</div>
      <div class="modulo">
        ${campoForm('i-az', 'Nome della ditta', im.azienda, 'data-imp="azienda" autocomplete="off" placeholder="es. Serramenti Rossi"')}
        ${campoForm('i-tec', 'Tecnico che fa il rilievo', im.tecnico, 'data-imp="tecnico" autocomplete="off" autocapitalize="words"')}
        ${campoForm('i-tel', 'Telefono', im.telefono, 'data-imp="telefono" type="tel" inputmode="tel" autocomplete="off"')}
        <div class="f"><span>Logo</span>
          <div class="logo-box">${urlLogo ? `<img src="${urlLogo}" alt="Logo della ditta">` : '<span class="nota" style="margin:0">Nessun logo</span>'}
            <div class="logo-az"><label class="btn piccolo">${ic('foto', 'piccola')} ${urlLogo ? 'Cambia' : 'Scegli immagine'}<input type="file" accept="image/*" data-logo></label>
            ${urlLogo ? '<button class="btn piccolo" data-act="togli-logo">Togli</button>' : ''}</div></div></div>
      </div>

      <div class="sez">Dati</div>
      <div class="lista">
        <a class="riga" href="#/cestino"><span class="ic-tondo">${ic('cestino')}</span><div class="riga-c"><div class="riga-t">Cestino</div><div class="riga-s">${nCest ? plur(nCest, 'elemento', 'elementi') + ' da poter ripristinare' : 'Vuoto'}</div></div>${ic('avanti')}</a>
        <div class="riga"><span class="ic-tondo">${ic('scudo')}</span><div class="riga-c"><div class="riga-t">Spazio usato</div><div class="riga-s" id="spazio">Calcolo…</div></div></div>
      </div>

      <div class="sez">Come si usa</div>
      <div class="modulo pad guida">
        <p><b>1.</b> Nuovo rilievo → scegli o crea il cliente → dati del cantiere.</p>
        <p><b>2.</b> Aggiungi le stanze, poi in ogni stanza tocca «Finestra», «Tapparella»…</p>
        <p><b>3.</b> Tocca L e scrivi le misure col tastierino: «Avanti» passa ad H. Il disegno si aggiorna da solo.</p>
        <p><b>4.</b> «Duplica» copia un articolo identico (anche in un'altra stanza): cambi solo L e H.</p>
        <p><b>5.</b> Alla fine fai firmare il cliente e tocca «Esporta»: PDF per l'ufficio, testo per WhatsApp, CSV per Excel o JSON.</p>
      </div>
      <div class="versione">Rilievi Serramenti ${VERSIONE} · funziona senza internet</div>
    </main>`;
  mostraSpazio();
}
async function mostraSpazio() {
  const el = $('#spazio'); if (!el) return;
  let t = '';
  try {
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); t = peso(e.usage || 0); }
    if (navigator.storage && navigator.storage.persisted) t += (await navigator.storage.persisted()) ? ' · archivio protetto' : (INSTALLATA ? '' : ' · installa l\'app per proteggerlo');
  } catch (e) { /* niente */ }
  el.textContent = t || 'Non disponibile';
}
async function caricaLogo(file) {
  const att = attesa('Preparo il logo…');
  try {
    const img = await caricaImmagine(file);
    const g = await riduci(img, img.naturalWidth, img.naturalHeight, 700, 0.9);
    g.cv.width = g.cv.height = 0;
    S.logo = { chiave: 'logo', data: g.dati, w: g.w, h: g.h, updated_at: ora() };
    await DB.scrivi({ impostazioni: [S.logo] });
    toast('Logo salvato: comparirà nei PDF');
  } catch (e) { avviso('Logo non salvato', String(e.message || e)); }
  att.chiudi();
  ridisegna();
}
function contaCestino() {
  const g = new Set();
  for (const m of [S.clienti, S.rilievi, S.articoli]) for (const x of m.values()) if (x.deleted_at) g.add(x.cestino_gruppo);
  for (const r of S.rilievi.values()) for (const s of r.stanze) if (s.deleted_at) g.add(s.cestino_gruppo);
  for (const m of S.mini.values()) if (m.deleted_at && m.tipo !== 'firma') g.add(m.cestino_gruppo);
  return g.size;
}
function pCestino() {
  app.innerHTML = barra({ titolo: 'Cestino', indietro: { h: 'impostazioni', l: 'Impostazioni' } }) + `<main class="pag"><div id="cestino"><div class="vuoto"><span class="gira"></span></div></div></main>`;
  DB.tutti('miniature').then(l => {
    for (const m of l) if (!S.mini.has(m.id)) S.mini.set(m.id, m);
    if (rotta === 'cestino') $('#cestino').innerHTML = vociCestino();
  });
}
function vociCestino() {
  const gruppi = new Map();
  const aggiungi = (g, livello, quando, html) => {
    const x = gruppi.get(g);
    if (!x) gruppi.set(g, { g, livello, quando, html, altri: 0 });
    else if (livello < x.livello) { gruppi.set(g, { g, livello, quando, html, altri: x.altri + 1 }); }
    else x.altri++;
  };
  for (const c of S.clienti.values()) if (c.deleted_at) aggiungi(c.cestino_gruppo, 0, c.deleted_at, `${ic('utente')}<div class="riga-c"><div class="riga-t">${esc(nomeCliente(c))}</div><div class="riga-s">Cliente`);
  for (const r of S.rilievi.values()) {
    const c = S.clienti.get(r.cliente_id);
    if (r.deleted_at) aggiungi(r.cestino_gruppo, 1, r.deleted_at, `${ic('finestra')}<div class="riga-c"><div class="riga-t">${esc(titoloRilievo(r))}</div><div class="riga-s">Rilievo · ${esc(nomeCliente(c))}`);
    for (const s of r.stanze) if (s.deleted_at) aggiungi(s.cestino_gruppo, 2, s.deleted_at, `${ic('casa')}<div class="riga-c"><div class="riga-t">${esc(s.nome)}</div><div class="riga-s">Stanza · ${esc(titoloRilievo(r))}`);
  }
  for (const a of S.articoli.values()) if (a.deleted_at) {
    const d = descrivi(a), r = S.rilievi.get(a.rilievo_id);
    aggiungi(a.cestino_gruppo, 3, a.deleted_at, `<span class="cest-dis" style="--cc:var(--c-${d.cat.col})">${svgMini(a)}</span><div class="riga-c"><div class="riga-t">${esc(d.titolo)}${d.misure ? ' ' + esc(d.misure) : ''}</div><div class="riga-s">${esc(a.stanza_rif || '')} · ${esc(r ? titoloRilievo(r) : '')}`);
  }
  for (const m of S.mini.values()) if (m.deleted_at && m.tipo !== 'firma') {
    const a = S.articoli.get(m.articolo_id);
    aggiungi(m.cestino_gruppo, 4, m.deleted_at, `<img class="mini-th" src="${urlMiniatura(m)}" alt=""><div class="riga-c"><div class="riga-t">${m.tipo === 'schizzo' ? 'Schizzo' : 'Foto'}</div><div class="riga-s">${a ? esc(descrivi(a).titolo + ' · ' + (a.stanza_rif || '')) : ''}`);
  }
  const l = [...gruppi.values()].sort((a, b) => b.quando.localeCompare(a.quando));
  if (!l.length) return `<div class="vuoto">${ic('cestino')}<b>Il cestino è vuoto</b><p>Quando sposti qualcosa nel cestino lo ritrovi qui e puoi rimetterlo a posto.</p></div>`;
  return `<p class="nota" style="margin-bottom:12px">Qui niente viene cancellato davvero: puoi sempre ripristinare.</p>
    <div class="lista">${l.map(x => `<div class="riga">${x.html}${x.altri ? ` (con ${plur(x.altri, 'altro elemento', 'altri elementi')})` : ''} · ${fmtQuando(x.quando)}</div></div>
    <button class="btn piccolo" data-act="ripristina" data-g="${x.g}">${ic('ripristina', 'piccola')} Ripristina</button></div>`).join('')}</div>`;
}

/* =========================================================
   ESPORTAZIONI
   ========================================================= */
function nomeFile(r, est) { return `Rilievo_${slug(titoloRilievo(r) + ' ' + nomeCliente(S.clienti.get(r.cliente_id)))}_${r.data_rilievo || oggi()}.${est}`; }
function datiRilievo(r) {
  const str = struttura(r); let n = 0;
  return str.map(({ stanza, articoli }) => ({ stanza, articoli: articoli.map(a => ({ a, pos: ++n, d: descrivi(a) })) }));
}
function menuEsporta(r) {
  const nFoto = articoliDi(r.id).reduce((s, a) => s + a.foto.length, 0);
  sheet({ titolo: 'Esporta e condividi', sotto: titoloRilievo(r), voci: [
    { l: "PDF per l'ufficio", nota: `Misure, disegni, distinta per tipo${nFoto ? ` e ${plur(nFoto, 'foto', 'foto')}` : ''}${r.firma ? ', firma' : ''}`, ic: 'pdf', cls: 'pri', fn: () => preparaFile(att => creaPDF(r, true, att)) },
    nFoto && { l: 'PDF senza foto', nota: 'Più leggero da inviare', ic: 'pdf', fn: () => preparaFile(att => creaPDF(r, false, att)) },
    { l: 'Testo (WhatsApp, email…)', nota: 'Riepilogo leggibile da incollare', ic: 'testo', fn: () => condividiTesto(r) },
    { l: 'Tabella CSV per Excel', nota: 'Una riga per articolo', ic: 'tabella', fn: () => preparaFile(async () => creaCSV(r)) },
    { l: 'File JSON (dati completi)', nota: nFoto ? 'Per backup o altri programmi, con foto' : 'Per backup o altri programmi', ic: 'json', fn: () => preparaFile(att => creaJSON(r, att)) },
  ].filter(Boolean) });
}
async function preparaFile(crea, dopo) {
  const att = attesa('Preparo il file…');
  await new Promise(res => setTimeout(res, 30));
  try {
    const { nome, blob } = await crea(att);
    att.chiudi();
    filePronto(nome, blob, dopo);
  } catch (e) {
    att.chiudi();
    avviso('Non sono riuscito a creare il file', String(e.message || e));
  }
}
function filePronto(nome, blob, dopo) {
  const puo = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], nome, { type: blob.type })] }));
  const icona = /\.pdf$/.test(nome) ? 'pdf' : /\.csv$/.test(nome) ? 'tabella' : /\.txt$/.test(nome) ? 'testo' : 'json';
  vibra();
  sheet({
    titolo: 'File pronto',
    corpo: `<div class="file-pronto">${ic(icona)}<div><b>${esc(nome)}</b><small>${peso(blob.size)}</small></div></div>`,
    voci: [
      puo && { l: 'Condividi o salva…', nota: 'Mail, WhatsApp, «Salva su File», Stampa…', ic: 'condividi', cls: 'pri', fn: () => condividiFile(nome, blob).then(ok => { if (ok && dopo) dopo(); }) },
      { l: puo ? 'Scarica' : 'Scarica il file', ic: 'scarica', cls: puo ? '' : 'pri', fn: () => { scarica(nome, blob); if (dopo) dopo(); } },
    ].filter(Boolean),
  });
}
async function condividiFile(nome, blob) {
  const file = new File([blob], nome, { type: blob.type });
  try { await navigator.share({ files: [file], title: nome }); return true; }
  catch (e) {
    if (e && e.name === 'AbortError') return false;
    scarica(nome, blob); return true;
  }
}
function scarica(nome, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function testoRilievo(r) {
  const c = S.clienti.get(r.cliente_id);
  const L = [];
  L.push(`RILIEVO MISURE — ${titoloRilievo(r)}`);
  L.push(`Cliente: ${nomeCliente(c)}${c && c.telefono ? ' · tel. ' + c.telefono : ''}`);
  if (r.indirizzo_cantiere) L.push(`Cantiere: ${r.indirizzo_cantiere}`);
  L.push(`Data rilievo: ${fmtData(r.data_rilievo)} · Stato: ${r.stato}`);
  const riep = riepilogo(r);
  if (riep.length) L.push(`Totale: ${riep.map(x => `${x.n} ${x.nome}`).join(', ')}`);
  if (r.note_generali) L.push(`Note: ${r.note_generali}`);
  L.push('Misure in millimetri (L × H)');
  for (const { stanza, articoli } of datiRilievo(r)) {
    L.push('', `▸ ${stanza.nome.toUpperCase()}`);
    if (!articoli.length) L.push('   (nessun articolo)');
    for (const { pos, d } of articoli) {
      L.push(`${pos}) ${d.titolo}${d.misure ? ' — ' + (d.mancano ? 'MISURE MANCANTI (' + d.misure + ')' : d.misure + ' mm') : ''}${d.q > 1 ? ' — Q.tà ' + d.q : ''}`);
      if (d.coppie.length) L.push('   ' + d.coppie.map(([k, v]) => `${k}: ${v}`).join(' · '));
      if (d.note) L.push('   Note: ' + d.note);
    }
  }
  if (r.firma) L.push('', `Firmato da ${r.firma.nome || 'cliente'} il ${fmtQuando(r.firma.quando)}`);
  const im = S.imp;
  if (im.azienda || im.tecnico) L.push('', [im.azienda, im.tecnico && 'Tecnico: ' + im.tecnico, im.telefono && 'Tel. ' + im.telefono].filter(Boolean).join(' · '));
  return L.join('\n');
}
async function condividiTesto(r) {
  const testo = testoRilievo(r);
  if (navigator.share) {
    try { await navigator.share({ title: titoloRilievo(r), text: testo }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(testo); toast('Testo copiato: incollalo dove vuoi'); }
  catch (e) { preparaFile(async () => ({ nome: nomeFile(r, 'txt'), blob: new Blob([testo], { type: 'text/plain' }) })); }
}
function creaCSV(r) {
  const colonne = [];
  const viste = new Set(['tipologia']);
  for (const cat of CATEGORIE) for (const f of cat.campi) {
    if (f.base || f.t === 'misure' || f.t === 'note' || viste.has(f.k)) continue;
    viste.add(f.k); colonne.push(f);
  }
  const testa = ['Pos', 'Stanza', 'Categoria', 'Tipologia', 'Quantità', 'Larghezza (mm)', 'Altezza (mm)', 'Larghezze rilevate', 'Altezze rilevate', ...colonne.map(f => f.l), 'Note', 'Foto'];
  const righe = [];
  for (const { stanza, articoli } of datiRilievo(r)) for (const { a, pos } of articoli) {
    const cat = CAT[a.categoria], c = a.configurazione;
    const ha = k => cat.campi.some(f => f.k === k);
    const p = c.misura_punti && c.punti;
    righe.push([pos, stanza.nome, a.categoria, c.tipologia || '', a.quantita || 1, vuoto(c.larghezza_mm) ? '' : c.larghezza_mm, vuoto(c.altezza_mm) ? '' : c.altezza_mm,
      p ? p.L.map(v => vuoto(v) ? '-' : v).join(' / ') : '', p ? p.H.map(v => vuoto(v) ? '-' : v).join(' / ') : '',
      ...colonne.map(f => {
        if (!ha(f.k)) return '';
        const fc = cat.campi.find(x => x.k === f.k);
        if (fc.se && !fc.se(c)) return '';
        const v = c[f.k];
        if (f.t === 'bool') return v ? 'Sì' : 'No';
        return vuoto(v) ? '' : conExtra(f, c, v);
      }), c.note || '', a.foto.length || '']);
  }
  const cella = v => { v = String(v ?? ''); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const testo = BOM + [testa, ...righe].map(rr => rr.map(cella).join(';')).join('\r\n');
  return { nome: nomeFile(r, 'csv'), blob: new Blob([testo], { type: 'text/csv' }) };
}
async function creaPDF(r, conFoto, att) {
  const c = S.clienti.get(r.cliente_id);
  const stanze = [];
  let nFoto = 0, fatte = 0;
  const dati = datiRilievo(r);
  if (conFoto) dati.forEach(s => s.articoli.forEach(x => { nFoto += x.a.foto.length; }));
  const perTipo = new Map();
  for (const { stanza, articoli } of dati) {
    const out = [];
    for (const { a, pos, d } of articoli) {
      const foto = [];
      if (conFoto) for (const id of a.foto) {
        const f = await DB.uno('foto', id);
        if (f) foto.push({ byte: new Uint8Array(f.data), w: f.w, h: f.h });
        if (att) att.testo(`Preparo il PDF… foto ${++fatte} di ${nFoto}`);
      }
      const schema = DISEGNO.disegna(a.categoria, a.configurazione, { w: 58, h: 68 });
      out.push({ pos, titolo: d.titolo, q: d.q, misure: d.misure, mancano: d.mancano, coppie: d.coppie, note: d.note, colore: COLORI_PDF[d.cat.col], foto, schema });
      const k = chiaveRiep(a);
      if (!perTipo.has(k)) perTipo.set(k, []);
      perTipo.get(k).push({ pos, stanza: stanza.nome, misure: d.misure, mancano: d.mancano, q: d.q, dettagli: [...d.brevi, d.note && 'Note: ' + d.note].filter(Boolean).join(' · ') });
    }
    stanze.push({ nome: stanza.nome, articoli: out });
  }
  const distinta = RIEP.filter(x => perTipo.has(x.k)).map(x => ({ titolo: x.titolo, colore: COLORI_PDF[x.col], righe: perTipo.get(x.k) }));
  let firma = null;
  if (r.firma) {
    const f = await DB.uno('foto', r.firma.id);
    if (f) firma = { byte: new Uint8Array(f.data), w: f.w, h: f.h, nome: r.firma.nome, quando: fmtQuando(r.firma.quando) };
  }
  const logo = S.logo && S.logo.data ? { byte: new Uint8Array(S.logo.data), w: S.logo.w, h: S.logo.h } : null;
  if (att) att.testo('Impagino il PDF…');
  const byte = await PDF.rilievo({
    titolo: titoloRilievo(r),
    intest: { azienda: S.imp.azienda, tecnico: S.imp.tecnico, telefono: S.imp.telefono, logo },
    info: [['Cliente', nomeCliente(c)], ['Indirizzo cantiere', r.indirizzo_cantiere], ['Telefono', c && c.telefono], ['Email', c && c.email], ['Data rilievo', fmtData(r.data_rilievo)], ['Stato', r.stato]],
    riepilogo: riepilogo(r).map(x => [x.nome, x.n]),
    note: r.note_generali,
    stanze, firma, distinta,
    piede: `${titoloRilievo(r)} · ${nomeCliente(c)} · ${fmtData(r.data_rilievo)}`,
  });
  return { nome: nomeFile(r, 'pdf'), blob: new Blob([byte], { type: 'application/pdf' }) };
}

/* ---------- JSON e backup ---------- */
function base64(buf) {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function daBase64(s) { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; }
async function fotoJSON(miniature, att) {
  const parti = []; let i = 0;
  for (const m of miniature) {
    const f = await DB.uno('foto', m.id);
    if (att) att.testo(`Preparo il file… foto ${++i} di ${miniature.length}`);
    const { data, ...meta } = m;
    parti.push(JSON.stringify({ ...meta, dati: f ? base64(f.data) : null, miniatura: base64(data) }));
  }
  return parti;
}
async function creaJSON(r, att) {
  const c = S.clienti.get(r.cliente_id);
  const articoli = [];
  for (const { stanza, articoli: l } of datiRilievo(r)) for (const { a, pos } of l) articoli.push({ posizione: pos, ...clona(a), stanza_rif: stanza.nome });
  const testa = { formato: 'rilievo-serramenti', versione: 1, esportato_il: ora(), app: 'Rilievi Serramenti ' + VERSIONE, unita_misura: 'mm', cliente: c, rilievo: r, articoli };
  const usate = new Set(articoli.flatMap(a => a.foto)); if (r.firma) usate.add(r.firma.id);
  const mini = (await DB.perIndice('miniature', 'rilievo_id', r.id)).filter(m => !m.deleted_at && usate.has(m.id));
  const foto = await fotoJSON(mini, att);
  const parti = [JSON.stringify(testa, null, 1).replace(/\}\s*$/, ''), ',\n"foto": [', foto.join(',\n'), ']}\n'];
  return { nome: nomeFile(r, 'json'), blob: new Blob(parti, { type: 'application/json' }) };
}
async function creaBackup(att) {
  await DB.svuota();
  const [cl, ri, ar, mi] = await Promise.all([DB.tutti('clienti'), DB.tutti('rilievi'), DB.tutti('articoli'), DB.tutti('miniature')]);
  const { ultimo_backup, backup_rimandato, ...imp } = S.imp;
  const logo = S.logo && S.logo.data ? { dati: base64(S.logo.data), w: S.logo.w, h: S.logo.h } : null;
  const testa = { formato: 'rilievo-serramenti-backup', versione: 1, creato_il: ora(), app: 'Rilievi Serramenti ' + VERSIONE, impostazioni: imp, logo, clienti: cl, rilievi: ri, articoli: ar };
  const foto = await fotoJSON(mi, att);
  const parti = [JSON.stringify(testa).replace(/\}\s*$/, ''), ',"foto":[', foto.join(','), ']}'];
  const d = new Date();
  return { nome: `Backup_rilievi_${oggi()}_${due(d.getHours())}${due(d.getMinutes())}.json`, blob: new Blob(parti, { type: 'application/json' }) };
}
function backupFatto() { S.imp.ultimo_backup = ora(); S.imp.backup_rimandato = null; salva('impostazioni', S.imp); toast('Backup salvato'); if (rotta === 'impostazioni' || rotta === '') ridisegna(); }

async function importa(file) {
  const att = attesa('Leggo il file…');
  let j;
  try { j = JSON.parse(await file.text()); }
  catch (e) { att.chiudi(); avviso('File non valido', 'Questo file non è un backup né un rilievo esportato da questa app.'); return; }
  att.chiudi();
  let clienti = [], rilievi = [], articoli = [], foto = [];
  if (j && j.formato === 'rilievo-serramenti-backup') { clienti = j.clienti || []; rilievi = j.rilievi || []; articoli = j.articoli || []; foto = j.foto || []; }
  else if (j && j.formato === 'rilievo-serramenti') { clienti = j.cliente ? [j.cliente] : []; rilievi = j.rilievo ? [j.rilievo] : []; articoli = j.articoli || []; foto = j.foto || []; }
  else { avviso('File non riconosciuto', 'Questo file non è un backup né un rilievo esportato da questa app.'); return; }
  const testo = [plur(clienti.length, 'cliente', 'clienti'), plur(rilievi.length, 'rilievo', 'rilievi'), plur(articoli.length, 'articolo', 'articoli'), plur(foto.length, 'foto', 'foto')].join(', ');
  conferma({ titolo: 'Importo questi dati?', testo: `Il file contiene ${testo}. Niente di quello che hai già verrà cancellato: aggiungo solo ciò che manca e aggiorno ciò che è più vecchio.`, si: 'Importa', fn: () => eseguiImporta({ clienti, rilievi, articoli, foto, imp: j.impostazioni, logo: j.logo }) });
}
async function eseguiImporta({ clienti, rilievi, articoli, foto, imp, logo }) {
  const att = attesa('Importo…');
  const piuNuovo = (nuovo, vecchio) => !vecchio || (nuovo.updated_at || '') > (vecchio.updated_at || '');
  const base = x => ({ deleted_at: null, cestino_gruppo: null, ...x });
  const n = { c: 0, r: 0, a: 0, f: 0 };
  try {
    const scr = { clienti: [], rilievi: [], articoli: [] };
    for (const x of clienti) { if (!x || !x.id) continue; const c = base(x); if (piuNuovo(c, S.clienti.get(c.id))) { S.clienti.set(c.id, c); scr.clienti.push(c); n.c++; } }
    for (const x of rilievi) {
      if (!x || !x.id) continue;
      const r = base({ stanze: [], stato: 'Bozza', firma: null, ...x });
      if (piuNuovo(r, S.rilievi.get(r.id))) {
        const vecchio = S.rilievi.get(r.id);
        // tengo anche le stanze che avevo solo io
        if (vecchio) for (const s of vecchio.stanze) if (!r.stanze.some(t => t.id === s.id)) r.stanze.push(s);
        S.rilievi.set(r.id, r); scr.rilievi.push(r); n.r++;
      }
    }
    for (const x of articoli) {
      if (!x || !x.id) continue;
      const { posizione, ...resto } = x;
      const a = base({ quantita: 1, ordine: posizione || 0, foto: [], configurazione: {}, ...resto });
      if (piuNuovo(a, S.articoli.get(a.id))) { S.articoli.set(a.id, a); scr.articoli.push(a); n.a++; }
    }
    await DB.scrivi(scr);
    let i = 0;
    for (const f of foto) {
      i++; if (foto.length > 3) att.testo(`Importo le foto… ${i} di ${foto.length}`);
      if (!f || !f.id || !f.dati) continue;
      if (await DB.uno('miniature', f.id)) continue;
      const { dati, miniatura, ...meta } = f;
      const m = { deleted_at: null, cestino_gruppo: null, ...meta, data: miniatura ? daBase64(miniatura) : daBase64(dati) };
      await DB.scrivi({ foto: [{ ...meta, data: daBase64(dati) }], miniature: [m] });
      if (S.miniCaricate.has(m.rilievo_id)) S.mini.set(m.id, m);
      n.f++;
    }
    if (imp && typeof imp === 'object') for (const k of ['azienda', 'tecnico', 'telefono']) if (!S.imp[k] && imp[k]) S.imp[k] = imp[k];
    if (logo && logo.dati && !(S.logo && S.logo.data)) { S.logo = { chiave: 'logo', data: daBase64(logo.dati), w: logo.w, h: logo.h, updated_at: ora() }; await DB.scrivi({ impostazioni: [S.logo] }); }
    for (const r of S.rilievi.values()) ripara(r);
    sistemaGenitori();
    segnaModifica();
    await DB.svuota();
    att.chiudi();
    avviso('Importazione completata', `Aggiunti o aggiornati: ${plur(n.c, 'cliente', 'clienti')}, ${plur(n.r, 'rilievo', 'rilievi')}, ${plur(n.a, 'articolo', 'articoli')}, ${plur(n.f, 'foto', 'foto')}.`);
  } catch (e) {
    att.chiudi();
    avviso('Importazione non riuscita', String(e.message || e));
  }
}

/* =========================================================
   AZIONI (tutti i tocchi passano da qui)
   ========================================================= */
function apriEditor(a, focusL) {
  if (focusL) UI.focusL = a.id;
  vai(`r/${a.rilievo_id}/a/${a.id}`);
}
function scegliStanza(r, titolo, attuale, fn, conNuova = true) {
  const stanze = r.stanze.filter(s => !s.deleted_at);
  sheet({ titolo, voci: [
    ...stanze.map(s => ({ l: s.nome, ic: 'casa', cls: s.id === attuale ? 'attuale' : '', nota: s.id === attuale ? 'stanza attuale' : plur(articoliStanza(r, s.id).length, 'articolo', 'articoli'), fn: () => fn(s.id) })),
    conNuova && { l: 'Nuova stanza…', ic: 'piu', cls: 'pri', fn: () => chiediNomeStanza(r, nome => fn(nuovaStanza(r, nome).id)) },
  ].filter(Boolean) });
}
function chiediNomeStanza(r, fn, valore = '', titolo = 'Nuova stanza') {
  const usate = new Set(r.stanze.filter(s => !s.deleted_at).map(s => norm(s.nome)));
  chiediTesto({ titolo, valore, ph: 'es. Camera 2', ok: valore ? 'Rinomina' : 'Aggiungi', suggerimenti: valore ? [] : STANZE_TIPICHE.map(n => usate.has(norm(n)) ? nomeLibero(r, n) : n), fn });
}
const rilievoCorrente = () => S.rilievi.get(rotta.split('/')[1]);

const AZ = {
  'vai': el => vai(el.dataset.h),
  'torna': el => torna(el.dataset.h),
  'chiudi-sheet': () => chiudiSheet(),
  'voce': el => { const v = SHEET && SHEET.voci[+el.dataset.i]; chiudiSheet(); if (v && v.fn) v.fn(); },
  'sheet-ok': () => { if (SHEET && SHEET.ok) SHEET.ok($('#sheet-inp').value); },
  'sheet-sugg': el => { if (SHEET && SHEET.ok) SHEET.ok(el.dataset.v); },

  // Home
  'tab': el => { UI.tab = el.dataset.t; UI.cerca = ''; ridisegna(); },
  'filtro': el => { UI.filtro = el.dataset.f; $$('.filtro').forEach(b => b.classList.toggle('on', b === el)); $('#lista').innerHTML = listaRilievi(); },
  'chiudi-installa': () => { S.imp.avviso_installa_chiuso = true; salva('impostazioni', S.imp); ridisegna(); },
  'rimanda-backup': () => { S.imp.backup_rimandato = new Date(Date.now() + 3 * 864e5).toISOString(); salva('impostazioni', S.imp); ridisegna(); },
  'backup': () => preparaFile(att => creaBackup(att), backupFatto),

  // Clienti
  'crea-cliente': () => { if (!controllaNome()) return; const c = nuovoCliente(leggiCliente()); sostituisci(`c/${c.id}`); toast('Cliente creato'); },
  'cestina-cliente': el => {
    const c = S.clienti.get(el.dataset.id);
    const n = attivi(S.rilievi).filter(r => r.cliente_id === c.id).length;
    conferma({ titolo: `Spostare ${nomeCliente(c)} nel cestino?`, testo: n ? `Insieme al cliente vanno nel cestino anche i suoi ${plur(n, 'rilievo', 'rilievi')}. Potrai ripristinare tutto dal cestino.` : 'Potrai ripristinarlo dal cestino.', si: 'Sposta nel cestino', peric: true,
      fn: () => { torna(''); cestinaConAnnulla('cliente', c, null, 'Cliente spostato nel cestino'); } });
  },

  // Nuovo rilievo
  'nc-apri': () => { UI.ncAperto = true; ridisegna(); $('#c-nome').focus(); },
  'nc-continua': () => { if (!controllaNome()) return; const c = nuovoCliente(leggiCliente()); UI.ncAperto = false; vai(`nuovo/${c.id}`); },
  'scegli-cliente': el => vai(`nuovo/${el.dataset.id}`),
  'crea-rilievo': el => {
    const r = nuovoRilievo(el.dataset.cid, { titolo: $('#r-tit').value, data_rilievo: $('#r-data').value, indirizzo_cantiere: $('#r-ind').value, note_generali: $('#r-note').value });
    UI.ncAperto = false; UI.cercaClienti = '';
    tornaEVai('', `r/${r.id}`);
  },

  // Rilievo
  'menu-rilievo': el => {
    const r = S.rilievi.get(el.dataset.id);
    sheet({ titolo: titoloRilievo(r), voci: [
      { l: 'Modifica dati del rilievo', ic: 'matita', fn: () => vai(`r/${r.id}/dati`) },
      { l: 'Esporta e condividi', ic: 'condividi', fn: () => menuEsporta(r) },
      { l: r.firma ? 'Rifai la firma del cliente' : 'Fai firmare il cliente', ic: 'firma', fn: () => firmaCliente(r) },
      { l: r.stato === 'Bozza' ? 'Segna come completato' : 'Riporta in bozza', ic: 'check', fn: () => cambiaStato(r, r.stato === 'Bozza' ? 'Completato' : 'Bozza') },
      { l: 'Apri o chiudi tutte le stanze', ic: 'giu', fn: () => apriChiudiTutte(r) },
      { l: 'Duplica tutto il rilievo', nota: 'Stesso cliente, stesse stanze e articoli', ic: 'duplica', fn: () => duplicaRilievo(r) },
      { l: 'Sposta nel cestino', ic: 'cestino', cls: 'peric', fn: () => chiediCestinaRilievo(r) },
    ] });
  },
  'menu-stato': el => { const r = S.rilievi.get(el.dataset.id); sheet({ titolo: 'Stato del rilievo', voci: ['Bozza', 'Completato'].map(s => ({ l: s, ic: s === r.stato ? 'check' : '', cls: s === r.stato ? 'attuale' : '', fn: () => cambiaStato(r, s) })) }); },
  'stato': el => { cambiaStato(S.rilievi.get(el.dataset.id), el.dataset.v); },
  'cestina-rilievo': el => chiediCestinaRilievo(S.rilievi.get(el.dataset.id)),
  'cambia-cliente': el => {
    const r = S.rilievi.get(el.dataset.id);
    sheet({ titolo: 'Scegli il cliente', voci: attivi(S.clienti).sort((a, b) => nomeCliente(a).localeCompare(nomeCliente(b), 'it')).map(c => ({ l: nomeCliente(c), nota: c.indirizzo, ic: 'utente', cls: c.id === r.cliente_id ? 'attuale' : '', fn: () => { r.cliente_id = c.id; modificato(r, 'rilievi'); ridisegna(); } })) });
  },
  'esporta': el => menuEsporta(S.rilievi.get(el.dataset.id)),
  'firma': () => firmaCliente(rilievoCorrente()),
  'menu-firma': () => {
    const r = rilievoCorrente();
    sheet({ titolo: 'Firma del cliente', sotto: `${r.firma.nome || ''} · ${fmtQuando(r.firma.quando)}`, voci: [
      { l: 'Guarda la firma', ic: 'firma', fn: () => vediFirma(r) },
      { l: 'Rifai la firma', ic: 'penna', fn: () => firmaCliente(r) },
      { l: 'Togli la firma dal rilievo', nota: 'Resta comunque nell\'archivio', ic: 'chiudi', cls: 'peric', fn: () => { const prima = r.firma; r.firma = null; modificato(r, 'rilievi'); ridisegna(); toast('Firma tolta', { l: 'Annulla', fn: () => { r.firma = prima; modificato(r, 'rilievi'); ridisegna(); } }); } },
    ] });
  },
  'vai-mancante': () => {
    const r = rilievoCorrente();
    const a = struttura(r).flatMap(s => s.articoli).find(x => descrivi(x).mancano);
    if (a) { UI.focusL = a.id; vai(`r/${r.id}/a/${a.id}`); }
  },
  'aggiungi-stanza': () => {
    const r = rilievoCorrente();
    chiediNomeStanza(r, nome => { const s = nuovaStanza(r, nome); UI.chiuse.delete(s.id); ridisegna(); document.getElementById('s-' + s.id)?.scrollIntoView({ block: 'start' }); });
  },
  'stanza-rapida': el => { const r = rilievoCorrente(); nuovaStanza(r, el.dataset.n); ridisegna(); },
  'vai-stanza': el => {
    const s = document.getElementById('s-' + el.dataset.sid); if (!s) return;
    const y = s.getBoundingClientRect().top + scrollY - barraH() - ($('#indice')?.offsetHeight || 0) - 6;
    scrollTo({ top: y, behavior: 'smooth' });
  },
  'apri-chiudi': el => {
    const sid = el.dataset.sid;
    if (UI.chiuse.has(sid)) UI.chiuse.delete(sid); else UI.chiuse.add(sid);
    scriviLS('rs.chiuse', [...UI.chiuse].slice(-500));
    ridisegna();
  },
  'menu-stanza': el => {
    const r = rilievoCorrente();
    const i = r.stanze.findIndex(s => s.id === el.dataset.sid), s = r.stanze[i];
    const vis = r.stanze.filter(x => !x.deleted_at), iv = vis.indexOf(s);
    const n = articoliStanza(r, s.id).length;
    sheet({ titolo: s.nome, voci: [
      { l: 'Rinomina', ic: 'matita', fn: () => chiediNomeStanza(r, nome => { s.nome = nome; for (const a of articoliStanza(r, s.id)) { a.stanza_rif = nome; modificato(a, 'articoli'); } modificato(r, 'rilievi'); ridisegna(); }, s.nome, 'Rinomina stanza') },
      n && { l: 'Duplica stanza', nota: `Copia anche ${n === 1 ? 'il suo articolo' : `i suoi ${n} articoli`}`, ic: 'duplica', fn: () => { const nuova = duplicaStanza(r, s); ridisegna(); document.getElementById('s-' + nuova.id)?.scrollIntoView({ block: 'start' }); toast(`Creata «${nuova.nome}»: ora cambia le misure`); } },
      iv > 0 && { l: 'Sposta su', ic: 'su', fn: () => { scambia(r, s, vis[iv - 1]); } },
      iv < vis.length - 1 && { l: 'Sposta giù', ic: 'giu', fn: () => { scambia(r, s, vis[iv + 1]); } },
      { l: 'Sposta nel cestino', nota: n ? `Con ${n === 1 ? 'il suo articolo' : `i suoi ${n} articoli`}` : '', ic: 'cestino', cls: 'peric', fn: () => { cestinaConAnnulla('stanza', s, r, `Stanza «${s.nome}» nel cestino`); ridisegna(); } },
    ].filter(Boolean) });
  },
  'nuovo-art': el => {
    const r = rilievoCorrente();
    const { a, da } = nuovoArticolo(r, el.dataset.sid, el.dataset.cat);
    UI.prec = da ? { aid: a.id, da } : null;
    apriEditor(a, haMisure(CAT[a.categoria]));
  },
  'duplica': el => {
    const a = S.articoli.get(el.dataset.id), r = S.rilievi.get(a.rilievo_id);
    const fatto = sid => {
      const b = duplicaArticolo(a, sid);
      const st = r.stanze.find(s => s.id === sid);
      UI.prec = null;
      if (haMisure(CAT[b.categoria])) UI.focusL = b.id;
      // dall'editor la copia prende il posto dell'originale (indietro torna all'elenco)
      if (rotta.includes('/a/')) sostituisci(`r/${r.id}/a/${b.id}`, 'avanti'); else vai(`r/${r.id}/a/${b.id}`);
      toast(`Copia creata${sid !== a.stanza_id ? ' in ' + st.nome : ''}: cambia L e H`);
    };
    scegliStanza(r, 'Dove metto la copia?', a.stanza_id, fatto);
  },

  // Editor articolo
  'fatto': () => { const a = artCorrente(); if (a) torna(`r/${a.rilievo_id}`); },
  'art-vai': el => { const b = S.articoli.get(el.dataset.id); if (!b) return; const a = artCorrente(); const r = S.rilievi.get(b.rilievo_id); const l = struttura(r).flatMap(s => s.articoli); sostituisci(`r/${b.rilievo_id}/a/${b.id}`, l.indexOf(b) < l.indexOf(a) ? 'indietro' : 'avanti'); },
  'tast': el => { const a = artCorrente(); if (a) apriTastierino(a, el.dataset.f); },
  'chip': el => {
    const a = artCorrente(), f = campo(a, el.dataset.k), v = el.dataset.v;
    const cur = leggiCampo(a, f);
    a.configurazione[f.k] = (cur === v && !f.req) ? '' : v;
    UI.altro.delete(a.id + '|' + f.k);
    cambiaArticolo(a); aggiornaCampi();
    if (f.k === 'tipologia') aggiornaTitoloEditor(a);
    if (f.extra && a.configurazione[f.k] === f.extra.se && !a.configurazione[f.extra.k]) $(`[data-f="${f.extra.k}"]`)?.focus();
  },
  'altro': el => {
    const a = artCorrente(), f = campo(a, el.dataset.k), k = a.id + '|' + f.k;
    const v = a.configurazione[f.k];
    const aperto = UI.altro.has(k) || (!vuoto(v) && !f.o.includes(v));
    if (aperto) { UI.altro.delete(k); a.configurazione[f.k] = ''; cambiaArticolo(a); aggiornaCampi(); return; }
    UI.altro.add(k);
    if (f.o.includes(v)) { a.configurazione[f.k] = ''; cambiaArticolo(a); }
    aggiornaCampi();
    $(`[data-f="${f.k}"]`)?.focus();
  },
  'piu': el => passo(el, +1),
  'meno': el => passo(el, -1),
  'sugg': el => {
    const a = artCorrente(), k = el.dataset.k;
    a.configurazione[k] = el.dataset.v; cambiaArticolo(a);
    const i = $(`[data-f="${k}"]`); if (i) i.value = el.dataset.v;
    const s = $(`[data-sugg="${k}"]`); if (s) s.innerHTML = suggerimenti(a, k, el.dataset.v);
  },
  'svuota-scelte': () => {
    const a = artCorrente(), cat = CAT[a.categoria], c = a.configurazione;
    const nuovo = configBase(cat);
    for (const k of ['larghezza_mm', 'altezza_mm', 'note', 'destinazione_uso', 'misura_punti', 'punti']) if (k in c) nuovo[k] = c[k];
    a.configurazione = nuovo; UI.prec = null; cambiaArticolo(a);
    $('.prec')?.remove(); aggiornaCampi(); aggiornaTitoloEditor(a);
  },
  'menu-articolo': () => {
    const a = artCorrente(), r = S.rilievi.get(a.rilievo_id);
    const l = articoliStanza(r, a.stanza_id), i = l.indexOf(a);
    const simili = articoliDi(r.id).filter(x => x.id !== a.id && x.categoria === a.categoria).length;
    sheet({ titolo: descrivi(a).titolo, voci: [
      { l: 'Duplica', ic: 'duplica', fn: () => AZ.duplica({ dataset: { id: a.id } }) },
      i > 0 && { l: 'Sposta prima', nota: 'Nell\'ordine della stanza', ic: 'su', fn: () => { spostaNellaStanza(a, -1); ridisegna(); } },
      i < l.length - 1 && { l: 'Sposta dopo', nota: 'Nell\'ordine della stanza', ic: 'giu', fn: () => { spostaNellaStanza(a, +1); ridisegna(); } },
      { l: 'Cambia stanza', ic: 'sposta', fn: () => AZ['sposta-articolo']() },
      simili && { l: 'Applica queste scelte a tutti', nota: `Agli altri ${simili} dello stesso tipo nel rilievo`, ic: 'categoria', fn: () => applicaATutti(a) },
      { l: 'Cambia tipo di articolo', nota: 'Misure e note restano', ic: 'categoria', fn: () => cambiaCategoria(a) },
      { l: 'Sposta nel cestino', ic: 'cestino', cls: 'peric', fn: () => { torna(`r/${r.id}`); cestinaConAnnulla('articolo', a, null, 'Articolo spostato nel cestino'); } },
    ].filter(Boolean) });
  },
  'sposta-articolo': () => {
    const a = artCorrente(), r = S.rilievi.get(a.rilievo_id);
    scegliStanza(r, 'Sposta in quale stanza?', a.stanza_id, sid => { if (sid === a.stanza_id) return; spostaArticolo(a, sid); ridisegna(); toast('Spostato in ' + a.stanza_rif); });
  },
  'vedi-foto': el => vediFoto(el.dataset.id),
  'schizzo': () => { const a = artCorrente(); if (a) nuovoSchizzo(a); },

  // Impostazioni e cestino
  'imp-scelta': el => { S.imp[el.dataset.k] = el.dataset.v; salva('impostazioni', S.imp); applicaAspetto(); ridisegna(); },
  'togli-logo': () => { const prima = S.logo; S.logo = { chiave: 'logo', data: null, updated_at: ora() }; DB.scrivi({ impostazioni: [S.logo] }); ridisegna(); toast('Logo tolto', { l: 'Annulla', fn: () => { S.logo = prima; DB.scrivi({ impostazioni: [prima] }); ridisegna(); } }); },
  'ripristina': el => { ripristina(el.dataset.g); $('#cestino').innerHTML = vociCestino(); toast('Ripristinato'); },
};
// tocchi che fanno vibrare leggermente il telefono
const CON_VIBRAZIONE = new Set(['chip', 'altro', 'piu', 'meno', 'nuovo-art', 'fatto', 'stanza-rapida', 'art-vai', 'tast', 'duplica', 'apri-chiudi', 'sugg']);

function passo(el, d) {
  const a = artCorrente(), f = campo(a, el.dataset.k);
  const cur = +(leggiCampo(a, f) || 0);
  const v = Math.max(f.min ?? 0, cur + d);
  if (f.base) a[f.k] = v; else a.configurazione[f.k] = v;
  const i = $(`[data-f="${f.k}"]`); if (i) i.value = v;
  cambiaArticolo(a);
  if (f.k === 'traversi_strutturali') { const dd = $('#dis-ed'); if (dd) dd.innerHTML = svgGrande(a); }
}
function scambia(r, s1, s2) {
  const i = r.stanze.indexOf(s1), j = r.stanze.indexOf(s2);
  r.stanze[i] = s2; r.stanze[j] = s1;
  modificato(r, 'rilievi'); ridisegna();
  document.getElementById('s-' + s1.id)?.scrollIntoView({ block: 'start' });
}
function apriChiudiTutte(r) {
  const ids = r.stanze.filter(s => !s.deleted_at).map(s => s.id);
  const tutteChiuse = ids.every(id => UI.chiuse.has(id));
  for (const id of ids) { if (tutteChiuse) UI.chiuse.delete(id); else UI.chiuse.add(id); }
  scriviLS('rs.chiuse', [...UI.chiuse].slice(-500));
  ridisegna();
}
function cambiaStato(r, stato) {
  if (stato === r.stato) return;
  const fai = () => { r.stato = stato; modificato(r, 'rilievi'); ridisegna(); vibra(); toast(stato === 'Completato' ? 'Rilievo completato' : 'Rilievo riportato in bozza'); };
  const mancanti = articoliDi(r.id).filter(a => descrivi(a).mancano).length;
  if (stato === 'Completato' && mancanti) conferma({ titolo: 'Mancano delle misure', testo: `${mancanti === 1 ? 'Un articolo non ha' : mancanti + ' articoli non hanno'} ancora larghezza o altezza. Lo segno comunque come completato?`, si: 'Sì, completato', fn: fai });
  else fai();
}
function chiediCestinaRilievo(r) {
  conferma({ titolo: 'Spostare il rilievo nel cestino?', testo: 'Potrai ripristinarlo quando vuoi da Impostazioni → Cestino.', si: 'Sposta nel cestino', peric: true,
    fn: () => { torna(''); cestinaConAnnulla('rilievo', r, null, 'Rilievo spostato nel cestino'); } });
}
function duplicaRilievo(r) {
  const t = ora();
  const n = { ...clona(r), id: uuid(), titolo: (r.titolo || titoloRilievo(r)) + ' (copia)', stato: 'Bozza', firma: null, data_rilievo: oggi(), created_at: t, updated_at: t, deleted_at: null, cestino_gruppo: null };
  const mappa = new Map();
  n.stanze = r.stanze.filter(s => !s.deleted_at).map(s => { const x = { ...s, id: uuid() }; mappa.set(s.id, x.id); return x; });
  S.rilievi.set(n.id, n); modificato(n, 'rilievi');
  for (const a of articoliDi(r.id)) {
    const b = { ...clona(a), id: uuid(), rilievo_id: n.id, stanza_id: mappa.get(a.stanza_id), foto: [], created_at: t, updated_at: t };
    S.articoli.set(b.id, b); modificato(b, 'articoli');
  }
  vai(`r/${n.id}`);
  toast('Rilievo duplicato (senza foto e senza firma)');
}
function applicaATutti(a) {
  const r = S.rilievi.get(a.rilievo_id), cat = CAT[a.categoria];
  const altri = articoliDi(r.id).filter(x => x.id !== a.id && x.categoria === a.categoria);
  conferma({ titolo: `Applicare a ${plur(altri.length, 'altro articolo', 'altri articoli')}?`, testo: 'Copio profilo, vetro, colori e le altre scelte su tutti gli articoli dello stesso tipo di questo rilievo. Misure, quantità, tipologia, lato di apertura e note non cambiano.', si: 'Applica a tutti',
    fn: () => {
      const prima = altri.map(x => [x, clona(x.configurazione)]);
      for (const x of altri) { copiaScelte(x.configurazione, a.configurazione, cat, true); cambiaArticolo(x); }
      vibra();
      toast(`Scelte applicate a ${plur(altri.length, 'articolo', 'articoli')}`, { l: 'Annulla', fn: () => { for (const [x, c] of prima) { x.configurazione = c; cambiaArticolo(x); } ridisegna(); } });
    } });
}
function cambiaCategoria(a) {
  sheet({ titolo: 'Che cos\'è questo articolo?', voci: CATEGORIE.map(k => ({ l: k.lungo, ic: k.icona, cls: k.id === a.categoria ? 'attuale' : '', fn: () => {
    if (k.id === a.categoria) return;
    const c = a.configurazione, nuovo = configBase(k);
    if (haMisure(k)) { nuovo.larghezza_mm = c.larghezza_mm ?? null; nuovo.altezza_mm = c.altezza_mm ?? null; if (c.misura_punti) { nuovo.misura_punti = true; nuovo.punti = c.punti; } }
    nuovo.note = c.note || '';
    a.categoria = k.id; a.configurazione = nuovo; UI.prec = null;
    cambiaArticolo(a); ridisegna();
  } })) });
}
async function vediFirma(r) {
  const rec = await DB.uno('foto', r.firma.id);
  if (!rec) { toast('Firma non trovata'); return; }
  const url = URL.createObjectURL(new Blob([rec.data], { type: 'image/jpeg' }));
  const el = document.createElement('div');
  el.className = 'visore chiaro';
  el.innerHTML = `<div class="visore-barra"><button data-v="chiudi">${ic('chiudi')} Chiudi</button><span>${esc(r.firma.nome || '')}</span><span></span></div><div class="visore-img"><img src="${url}" alt="Firma"></div>`;
  el.addEventListener('click', e => { if (e.target.closest('[data-v="chiudi"]')) { el.remove(); URL.revokeObjectURL(url); } });
  document.body.appendChild(el);
}

/* =========================================================
   Eventi
   ========================================================= */
document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#/"]');
  if (link) { e.preventDefault(); vai(decodeURIComponent(link.getAttribute('href').slice(2))); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = AZ[el.dataset.act];
  if (fn) { e.preventDefault(); if (CON_VIBRAZIONE.has(el.dataset.act)) vibra(); fn(el, e); }
});
// tocco fuori dal tastierino: lo chiudo
document.addEventListener('pointerdown', e => {
  if (TASTIERINO.aperto() && !e.target.closest('.tast, [data-act="tast"]')) TASTIERINO.chiudi();
}, true);

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'cerca') { UI.cerca = el.value; $('#lista').innerHTML = UI.tab === 'rilievi' ? listaRilievi() : listaClienti(); return; }
  if (el.id === 'cerca-clienti') { UI.cercaClienti = el.value; $('#lista-clienti').innerHTML = listaClienti(true); return; }
  if (el.tagName === 'TEXTAREA') autoAltezza(el);
  if (el.dataset.salva) {
    const [store, id, k] = el.dataset.salva.split(':');
    const rec = S[store].get(id); if (!rec) return;
    rec[k] = el.value; modificato(rec, store);
    if (k === 'nome_cognome' && el.value.trim()) el.closest('.f')?.classList.remove('errore');
    return;
  }
  if (el.dataset.imp) { S.imp[el.dataset.imp] = el.value; salva('impostazioni', S.imp); return; }
  if (el.id === 'c-nome' && el.value.trim()) el.closest('.f')?.classList.remove('errore');
  const k = el.dataset.f;
  if (!k || el.type === 'checkbox' || el.type === 'file') return;
  const a = artCorrente(); if (!a) return;
  let v = el.value;
  if (el.dataset.num !== undefined) {
    const pulito = v.replace(/\D/g, '');
    if (pulito !== v) el.value = pulito;
    v = pulito === '' ? null : parseInt(pulito, 10);
  }
  if (k === 'larghezza_mm' || k === 'altezza_mm' || /^[LH][0-2]$/.test(k)) { scriviMisura(a, k, v); aggiornaMisure(a); return; }
  if (k === 'quantita') a.quantita = v === null ? 1 : Math.max(1, v);
  else a.configurazione[k] = v;
  cambiaArticolo(a);
  if (k === 'traversi_strutturali' || k === 'composizione_ante' || k === 'modello') { const d = $('#dis-ed'); if (d) d.innerHTML = svgGrande(a); }
  const s = $(`[data-sugg="${k}"]`); if (s) s.innerHTML = suggerimenti(a, k, el.value);
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.impBool) { S.imp[el.dataset.impBool] = el.checked; salva('impostazioni', S.imp); if (el.checked && el.dataset.impBool === 'vibrazione') vibra(); return; }
  if (el.matches('input[type=checkbox][data-punti]')) {
    const a = artCorrente(); if (!a) return;
    const c = a.configurazione;
    c.misura_punti = el.checked;
    if (el.checked) {
      if (!c.punti) c.punti = { L: [null, c.larghezza_mm ?? null, null], H: [null, c.altezza_mm ?? null, null] };
      ricalcolaPunti(c);
    }
    cambiaArticolo(a); vibra(); aggiornaCampi();
    return;
  }
  if (el.matches('input[type=checkbox][data-f]')) {
    const a = artCorrente(); if (!a) return;
    a.configurazione[el.dataset.f] = el.checked; cambiaArticolo(a); vibra(); aggiornaCampi();
    return;
  }
  if (el.matches('input[type=file][data-foto]')) {
    const a = artCorrente(); const files = [...el.files]; el.value = '';
    if (a && files.length) aggiungiFoto(a, files);
    return;
  }
  if (el.matches('input[type=file][data-logo]')) {
    const f = el.files[0]; el.value = '';
    if (f) caricaLogo(f);
    return;
  }
  if (el.matches('input[type=file][data-importa]')) {
    const f = el.files[0]; el.value = '';
    if (f) importa(f);
  }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'sheet-inp') { e.preventDefault(); AZ['sheet-ok'](); return; }
  // nei moduli «Invio» passa al campo successivo
  const t = e.target;
  if (t.matches('.modulo input')) {
    const campi = $$('.modulo input:not([type=file]), .modulo textarea');
    const i = campi.indexOf(t);
    if (i >= 0 && i < campi.length - 1) { e.preventDefault(); campi[i + 1].focus(); } else t.blur();
  } else if (t.matches('#editor input:not([data-num])')) t.blur();
});

// Quando la tastiera è aperta nascondo la barra in basso (su iPhone altrimenti "galleggia")
// (solo se la tastiera sullo schermo è davvero aperta: con una tastiera fisica la barra resta)
const conTastiera = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'file', 'button', 'date'].includes(el.type)));
function controllaTastiera() {
  const vv = window.visualViewport;
  const aperta = !!vv && conTastiera(document.activeElement) && vv.height * vv.scale < document.documentElement.clientHeight - 120;
  document.body.classList.toggle('tastiera', aperta);
}
if (window.visualViewport) visualViewport.addEventListener('resize', controllaTastiera);
document.addEventListener('focusin', () => setTimeout(controllaTastiera, 350));
document.addEventListener('focusout', () => setTimeout(controllaTastiera, 60));

// Quantità vuota quando esco dal campo -> torna a 1
document.addEventListener('blur', e => {
  if (e.target.dataset && e.target.dataset.f === 'quantita' && e.target.value === '') { e.target.value = '1'; }
}, true);

function autoAltezza(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

// Salvo subito quando l'app va in secondo piano (su iPhone può essere chiusa in qualsiasi momento)
document.addEventListener('visibilitychange', () => { if (document.hidden) DB.svuota(); });
addEventListener('pagehide', () => DB.svuota());

/* =========================================================
   Errori di salvataggio: mai in silenzio
   ========================================================= */
let bannerErrore = null;
DB.suErrore(e => {
  if (bannerErrore) return;
  bannerErrore = document.createElement('div');
  bannerErrore.className = 'avviso rosso errore-salva';
  bannerErrore.innerHTML = `${ic('avviso')}<div><b>Attenzione: non riesco a salvare</b>${esc(e && e.message ? e.message : 'Spazio esaurito o archivio bloccato.')} Riprovo da solo; intanto non chiudere l'app.</div>`;
  document.body.appendChild(bannerErrore);
  setTimeout(() => DB.svuota(), 3000);
});
DB.suOk(() => { if (bannerErrore) { bannerErrore.remove(); bannerErrore = null; toast('Salvataggio ripreso: tutto a posto'); } });

/* =========================================================
   Avvio
   ========================================================= */
function registraSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // in prova sul PC niente copia offline (così vedo subito le modifiche), a meno di chiederla con ?sw
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes('sw')) return;
  const avevaController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const controlla = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) controlla(); });
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => {
        if (w.state === 'activated' && avevaController) toast('È pronta una nuova versione', { l: 'Aggiorna', fn: () => DB.svuota().then(() => location.reload()) }, 12000);
      });
    });
  }).catch(() => {});
}

async function avvio() {
  try {
    await DB.apri();
    const [cl, ri, ar, imp, logo] = await Promise.all([DB.tutti('clienti'), DB.tutti('rilievi'), DB.tutti('articoli'), DB.uno('impostazioni', 'generali'), DB.uno('impostazioni', 'logo')]);
    for (const c of cl) S.clienti.set(c.id, c);
    for (const r of ri) S.rilievi.set(r.id, r);
    for (const a of ar) S.articoli.set(a.id, a);
    if (imp) Object.assign(S.imp, imp);
    if (logo) S.logo = logo;
    for (const r of S.rilievi.values()) ripara(r);
  } catch (e) {
    app.innerHTML = `<main class="pag" style="padding-top:calc(var(--sat) + 40px)"><div class="avviso rosso">${ic('avviso')}<div><b>Non riesco ad aprire l'archivio</b>${esc(e.message || e)}<br><br>Se stai usando Safari in modalità privata, aprila in una finestra normale o installala sulla schermata Home.</div></div></main>`;
    return;
  }
  applicaAspetto();
  // Riapro dove ero rimasto (su iPhone l'app può essere chiusa dal sistema)
  let h = hashAttuale();
  const ultima = leggiLS('rs.ultima', '');
  if (!h && /^r\//.test(ultima)) h = ultima;
  const m = /^r\/([^/]+)(?:\/(a\/[^/]+|dati))?$/.exec(h);
  history.replaceState(null, '', '#/');
  pila = [''];
  if (m && S.rilievi.get(m[1]) && !S.rilievi.get(m[1]).deleted_at) {
    history.pushState(null, '', '#/r/' + m[1]); pila.push('r/' + m[1]);
    if (m[2]) { history.pushState(null, '', '#/' + h); pila.push(h); }
  } else if (h && !/^r\//.test(h)) {
    history.pushState(null, '', '#/' + h); pila.push(h);
  }
  rotta = pila[pila.length - 1];
  render(false, false);
  registraSW();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  document.addEventListener('touchstart', () => {}, { passive: true }); // attiva gli effetti al tocco su iPhone
}
avvio();
})();
