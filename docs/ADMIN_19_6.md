# Admin 19.6

## Contabilità Conteggi PDF

- A4 con palette blu, intestazione compatta, font Manrope incorporati e importi allineati.
- Destinazione e nota sono unite con ` · `; le descrizioni lunghe vanno a capo solo quando necessario.
- Totale movimenti e saldo azienda hanno spazio riservato nella prima pagina.
- Debiti selezionati dalla seconda pagina, con importi personalizzati della Contabilità.
- Se la prima pagina non contiene tutti i movimenti, il dettaglio rimanente continua dopo i debiti. Nessuna voce viene omessa.
- Verificato sul PDF fornito: nove movimenti e otto recuperi, da tre a due pagine.

## Aggiornamenti PWA

Flusso ripreso da Dipendenti: note della versione pubblicata, Aggiorna ora/Più tardi, controlli alla riapertura, al ritorno online e ogni cinque minuti. Conferma al nuovo avvio dopo l'attivazione del worker, oppure quando cambia il build già registrato sul dispositivo.

Gli aggiornamenti non partono offline, durante la compilazione o con scritture attive e movimenti Cassa sospesi. Le note e la versione sono definite in `src/config/release.js`, da cui viene generato `release.json`. Chi aggiorna dalla 19.5 entra inizialmente attraverso l'avviso presente nella vecchia versione; il nuovo flusso è incluso nella 19.6.

## Verifica

`npm run check`, test PDF su periodi lunghi, prova UI degli aggiornamenti e suite mobile. La simulazione del worker verifica attivazione e reload nel browser, senza chiamate a servizi di produzione; non sostituisce una prova su iPhone fisico.
