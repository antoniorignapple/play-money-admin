# Play Money Admin 13.5

Corregge le rettifiche dell'esattore in Contabilità Conteggi: il totale è raggruppato per giro e non per esecutore. La rettifica sostituisce il totale del giro anche quando il conteggio è eseguito da un sostituto. Le rettifiche senza un giro presente non generano importi aggiuntivi.

La risoluzione del giro è condivisa con Conteggi: prima il nome salvato nel conteggio, poi il giro collegato, infine il vecchio riferimento operatore per i dati privi di giro. Il totale corretto alimenta anche saldo e PDF. I debiti mantengono l'esecutore originale.

Caso verificato 30/08/2026–16/09/2026: totale esattore rettificato 418.198 €, non 535.394 €. La differenza 117.196 € era il valore originale del giro Quitadamo rimasto attribuito a Di Bari.

## Aggiornamento dalla 13.4

Pubblicare il contenuto della cartella dist sul consueto hosting dell'applicazione, mantenendo la configurazione del proprio hosting. Poi ricaricare l'app e verificare la versione 13.5.

Non occorrono nuove query SQL, migrazioni, riaperture del periodo o reinserimenti delle rettifiche. Nessun dato Supabase viene modificato da questo aggiornamento. Il pacchetto non è stato pubblicato automaticamente.

Preservate le funzioni della 13.4, inclusi PDF automezzi e calcolo chilometri.

Verifica sorgenti: npm ci, poi npm run check. Test di regressione: tests/conteggiAccounting.test.js.
