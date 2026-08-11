# Play Money Admin 7.7 — Contabilità Cassa

## Aggiunte
- Nuovo pulsante **CONTABILITÀ CASSA** sotto CASSA TOTALE.
- La CASSA TOTALE esterna ora considera anche i trasferimenti del periodo.
- Nuova pagina con saldo, cassa generata, totale trasferito, numero operazioni.
- Registrazione trasferimento con importo, data, destinazione libera e nota.
- Eliminazione definitiva dei trasferimenti del periodo attivo.
- Archivio dei periodi chiusi con relativa fotografia della Cassa.

## Supabase
Migration applicata al progetto reale: `contabilita_cassa_periodi`.

Sono stati aggiunti:
- `public.cassa_trasferimenti`
- dati Cassa negli snapshot di archivio
- RPC per saldo, creazione/eliminazione e lettura archivio
- Cassa nel fingerprint della preview
- Contabilità Cassa dentro la finalizzazione atomica

La finalizzazione fotografa la Cassa e i trasferimenti prima di pulire il vecchio periodo.
Il nuovo periodo riparte con una nuova Cassa e senza i trasferimenti del periodo precedente.

## Build
Versione sorgente: 7.7.0.
La build Vite non è stata completata qui perché il registry npm non era raggiungibile.
Eseguire nel normale ambiente di sviluppo:
`npm install` oppure `npm ci`, quindi `npm run build`.
