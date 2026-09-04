// Fonte unica per versione visibile e note dell'ultimo aggiornamento Admin.
// A ogni rilascio le ITEMS sostituiscono integralmente quelle precedenti.
export const RELEASE = Object.freeze({
  VERSION: '9.8',
  TITLE: 'Novità della versione',
  ITEMS: Object.freeze([
    'ADMIN GIOVANNI ora compare correttamente nella sezione Agenti',
    'Conteggio separato e corretto per agenti e amministratori',
    'Nuova gestione della password personale dell’amministratore',
    'Verifica obbligatoria della password attuale prima del cambio',
    'Accesso Admin predisposto per password forti e credenziali legacy',
  ]),
})

export const APP_VERSION = RELEASE.VERSION
