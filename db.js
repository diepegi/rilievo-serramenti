'use strict';
// Archivio locale (IndexedDB): tutti i dati restano sul telefono e funzionano senza internet.
// Niente viene mai cancellato davvero: l'app segna le cose come "nel cestino" e basta.
const DB = (() => {
  const NOME = 'rilievi-serramenti', VER = 1;
  let db = null;

  const richiesta = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

  function apri() {
    return new Promise((ok, ko) => {
      if (!('indexedDB' in self)) return ko(new Error('Questo browser non permette di salvare dati.'));
      const r = indexedDB.open(NOME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        const crea = (nome, chiave, indici = []) => {
          if (d.objectStoreNames.contains(nome)) return;
          const s = d.createObjectStore(nome, { keyPath: chiave });
          for (const i of indici) s.createIndex(i, i);
        };
        crea('clienti', 'id');
        crea('rilievi', 'id', ['cliente_id']);
        crea('articoli', 'id', ['rilievo_id']);
        crea('foto', 'id', ['rilievo_id']);           // foto grandi (solo quando servono)
        crea('miniature', 'id', ['rilievo_id']);      // miniature + dati della foto
        crea('impostazioni', 'chiave');
      };
      r.onsuccess = () => {
        db = r.result;
        db.onversionchange = () => { db.close(); location.reload(); };
        ok(db);
      };
      r.onerror = () => ko(r.error);
      r.onblocked = () => ko(new Error("L'archivio è bloccato: chiudi le altre finestre dell'app e riprova."));
    });
  }

  const negozio = (nome, modo = 'readonly') => db.transaction(nome, modo).objectStore(nome);
  const tutti = nome => richiesta(negozio(nome).getAll());
  const uno = (nome, id) => richiesta(negozio(nome).get(id));
  const perIndice = (nome, indice, valore) => richiesta(negozio(nome).index(indice).getAll(valore));

  // Scrive più record in un colpo solo: { negozio: [record, ...] }
  function scrivi(gruppi) {
    return new Promise((ok, ko) => {
      const nomi = Object.keys(gruppi).filter(k => gruppi[k] && gruppi[k].length);
      if (!nomi.length) return ok();
      const t = db.transaction(nomi, 'readwrite');
      for (const n of nomi) { const s = t.objectStore(n); for (const rec of gruppi[n]) s.put(rec); }
      t.oncomplete = () => ok();
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error || new Error('Scrittura annullata'));
    });
  }

  // Cancellazione definitiva (usata solo da «Elimina per sempre» nel cestino): { negozio: [id, ...] }
  function elimina(gruppi) {
    return new Promise((ok, ko) => {
      const nomi = Object.keys(gruppi).filter(k => gruppi[k] && gruppi[k].length);
      if (!nomi.length) return ok();
      const t = db.transaction(nomi, 'readwrite');
      for (const n of nomi) { const s = t.objectStore(n); for (const id of gruppi[n]) s.delete(id); }
      t.oncomplete = () => ok();
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error || new Error('Cancellazione annullata'));
    });
  }

  // Coda di salvataggio: le modifiche si accumulano per un attimo e poi si scrivono insieme.
  // Così si può scrivere velocemente senza rallentare nulla.
  const coda = new Map();
  let timer = null, catena = Promise.resolve();
  let onErrore = () => {}, onOk = () => {};
  const chiave = (n, rec) => n + '|' + (rec.id ?? rec.chiave);

  function salva(nome, rec, subito) {
    coda.set(chiave(nome, rec), [nome, rec]);
    clearTimeout(timer);
    if (subito) return svuota();
    timer = setTimeout(svuota, 250);
    return catena;
  }

  function svuota() {
    clearTimeout(timer); timer = null;
    if (!coda.size) return catena;
    const gruppi = {};
    for (const [n, rec] of coda.values()) (gruppi[n] ||= []).push(rec);
    coda.clear();
    catena = catena.then(() => scrivi(gruppi)).then(() => onOk(), e => {
      // non è andata: rimetto tutto in coda, riproverò alla prossima modifica
      for (const n in gruppi) for (const rec of gruppi[n]) { const k = chiave(n, rec); if (!coda.has(k)) coda.set(k, [n, rec]); }
      onErrore(e);
    });
    return catena;
  }

  const inAttesa = () => coda.size > 0;

  return {
    apri, tutti, uno, perIndice, scrivi, elimina, salva, svuota, inAttesa,
    suErrore: f => { onErrore = f; }, suOk: f => { onOk = f; },
  };
})();
