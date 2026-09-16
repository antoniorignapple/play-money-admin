# Play Money Admin 13.1 — Correzione chilometri

## Installazione
Se la 13.0 è già installata, sostituire il contenuto dell’hosting Admin con la cartella `dist` e accettare l’aggiornamento. **Non serve eseguire nuovo SQL né modificare il database.**
Se si proviene dalla 12.1, seguire prima l’installazione SQL descritta in `LEGGIMI_RILASCIO_13.0_ARCHIVIO.md`.

## Correzione
La 13.0 includeva l’ultima lettura precedente al range e poteva attribuire al periodo chilometri percorsi in precedenza. La 13.1 usa esclusivamente le registrazioni dentro le date selezionate: ultima lettura meno prima lettura, separatamente per ogni mezzo.

Caso riportato nelle foto: Caddy FK634HC, 10/08/2026 367.007 km e 29/08/2026 368.637 km. Risultato: **1.630 km**. Una lettura precedente esterna al range non modifica più questo risultato.

Nel dettaglio del mezzo compaiono anche date e valori del contachilometri utilizzati. Nessun utilizzo dà 0 km; una sola lettura dà km non determinabili; letture mancanti sono segnalate. Una diminuzione dentro il range resta un’anomalia da verificare: non viene nascosta né corretta automaticamente. Le anomalie fuori dal range non bloccano il periodo selezionato.

Il numero rappresenta i km fra le letture disponibili nel range: non misura gli eventuali tragitti prima della prima lettura o dopo l’ultima. I dati registrati non vengono modificati.

Tutte le funzionalità Debiti e Bonus della 13.0 sono mantenute.

## Verifiche
23 test automatici, incluso il caso delle foto e range più stretti; build produzione e lint dei due file aggiornati. Nessuna operazione sul database online o pubblicazione eseguita. La resa visiva nel browser non è stata nuovamente verificata.

Sorgenti e `dist` compilata inclusi. Comandi: `npm ci`, `npm test`, `npm run build`.
