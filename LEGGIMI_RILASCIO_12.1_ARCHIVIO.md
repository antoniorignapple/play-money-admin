# Play Money Admin 12.1

Aggiornamento della versione 11.0 allegata.

## Novità 12.1
- Simulazioni indipendenti dal periodo conteggi attivo, anche prima del 01/09/2026.
- Apertura su tutto lo storico; filtri Dal, Al e Dipendente applicati alla lista e al PDF. Pulsante Tutte per azzerarli.
- Filtro sulla data della simulazione (work_date), con data di registrazione come ripiego.
- Caricamento a pagine senza il precedente tetto di 3000 simulazioni / 1000 nel cestino.
- Cestino completo, indipendente dal periodo conteggi.
- Nessuna nuova migrazione database. Restano necessarie le funzioni già previste dalla versione 11.

## Modifiche
- Rimosso il riquadro “Una rettifica trasparente” da Modifica conteggio.
- Rimosso il motivo obbligatorio della modifica da entrambi gli editor.
- Rimossi la scheda Storico rettifiche e i pulsanti storico nel Centro modifiche.
- Salvataggio diretto: modifica i campi e premi una sola volta **Salva**. Nessuna schermata Rivedi o Conferma e salva.
- Protezione immediata contro clic ripetuti durante il salvataggio; gli errori mantengono aperti i campi per correggere e riprovare.
- Mantenuti ricalcolo, confronto importi, blocco facoltativo del dipendente e controllo dei conflitti.
- Versione applicazione e metadati di aggiornamento portati a 12.0.

## Database e installazione
Non occorrono nuove migrazioni rispetto alla versione 11 funzionante. Le funzioni v11 restano compatibili: l’app invia automaticamente una descrizione tecnica della modifica, senza chiederla all’utente. Lo storico interno già presente nel database non viene cancellato.

Se l’aggiornamento database della 11 non è stato ancora installato, resta necessario seguire LEGGIMI_RILASCIO_11_ARCHIVIO.md, sezione “Prima di usare la 11”.

Lo ZIP contiene sorgenti e cartella dist ricompilata. Per ricompilare: npm ci e npm run build. Caricare dist nell’hosting Admin esistente secondo la procedura abituale.

## Verifiche
Test automatici di calcolo, date e protezioni aggiornamento; build di produzione e test database locali. Nessuna operazione eseguita sul database online. Le immagini nella cartella docs si riferiscono alla versione 11 archiviata.

Verifica 12.1: 14 test automatici superati e build produzione riuscita. ESLint segnala problemi preesistenti nella pagina Simulazioni (import inutilizzato e gestione effetti React). Nessuna verifica sul database online.
