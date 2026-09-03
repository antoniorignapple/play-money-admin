// Fonte unica per versione visibile e note dell'ultimo aggiornamento Admin.
// A ogni rilascio le ITEMS sostituiscono integralmente quelle precedenti.
export const RELEASE = Object.freeze({
  VERSION: '9.6',
  TITLE: 'Novità della versione',
  ITEMS: Object.freeze([
    'Analisi giornaliera: i Giri Cassa inviati diventano verdi e mostrano data e ora',
    'Lucchetto Admin attivo per riaprire un Giro Cassa già consegnato',
    'Conteggi: stato inviato verde e riapertura protetta del Giro dipendente',
    'Versione mostrata sincronizzata in accesso, menu e informazioni sistema',
  ]),
})

export const APP_VERSION = RELEASE.VERSION
