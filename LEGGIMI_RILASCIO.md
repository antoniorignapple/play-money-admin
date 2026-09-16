# Play Money Admin 13.2 — Zeri e chilometri mancanti

## Installazione
Dalla 13.0 o 13.1: pubblicare il contenuto di `dist` e accettare l’aggiornamento dell’app. Nessun nuovo SQL e nessuna modifica ai dati registrati.
Dalla 12.1: eseguire prima la migrazione della 13.0, come indicato in `LEGGIMI_RILASCIO_13.0_ARCHIVIO.md`.

## Calcolo corretto
Gli zeri indicano letture non inserite e vengono ignorati, insieme ai campi vuoti e non validi. Si prendono prima e ultima lettura positiva disponibili all’interno del range, in ordine cronologico, e se ne calcola la differenza.

Esempio Caddy FX045RR: 363.091 km del 10/08/2026 e 364.551 km del 31/08/2026 danno **1.460 km**. Lo zero del 29/08 non blocca più il calcolo.

La stessa regola vale per zeri all’inizio o alla fine del range. Con meno di due letture positive il dato non è determinabile. Senza utilizzi si mostrano 0 km. Una diminuzione reale tra letture positive resta segnalata, senza inventare chilometri.

Le registrazioni originali, gli utilizzi e i rifornimenti restano invariati. Date e valori effettivamente usati sono visibili nel riepilogo. Tutte le funzionalità Debiti e Bonus sono mantenute.

## Verifiche
25 test automatici, inclusi il caso fotografato, gli zeri intermedi e agli estremi, periodi senza letture sufficienti e diminuzioni reali. Build produzione e lint del calcolo. Nessuna pubblicazione o modifica al database online eseguita.

Sorgenti e `dist` compilata inclusi. Comandi: `npm ci`, `npm test`, `npm run build`.
