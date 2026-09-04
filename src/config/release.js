// Fonte unica per versione visibile e note dell'ultimo aggiornamento Admin.
// A ogni rilascio le ITEMS sostituiscono integralmente quelle precedenti.
export const RELEASE = Object.freeze({
  VERSION: '9.7',
  TITLE: 'Novità della versione',
  ITEMS: Object.freeze([
    'Accesso al pannello consentito solo dopo la verifica server del ruolo Admin',
    'Creazione, modifica ed eliminazione agenti protette da autorizzazione reale',
    'PIN rimossi da schermate, esportazioni e dati leggibili nel database',
    'Notifiche simulazioni protette da duplicati e riservate all’Admin',
    'Viste, conteggi e operazioni sensibili rinforzati lato server',
  ]),
})

export const APP_VERSION = RELEASE.VERSION
