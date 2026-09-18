# Play Money Admin 15.0

Interfaccia Cassa e Contabilità Conteggi semplificata: rimossi i testi descrittivi indicati, titoli più corposi e pulsante Apri la Cassa con finitura lucida. Archivio Periodi conserva selezione e azioni.

Centro Modifiche rimosso. Le modifiche disponibili nelle altre sezioni restano operative.

Le schede dei dipendenti si adattano alla larghezza disponibile. L'importo Esattore occupa una riga dedicata a tutta larghezza; salvataggio e ripristino restano sulla riga superiore.

## Aggiornamento dalla versione 14

Pubblicare il contenuto della cartella dist sullo stesso hosting dell'app. Al successivo avviso di aggiornamento, salvare il lavoro e premere Aggiorna ora.

Non occorrono nuove migrazioni SQL per passare dalla 14 alla 15. Dati e formule contabili rimangono quelli della versione 14.

## Verifiche

36 test automatici superati; build di produzione completata. Verificato in ambiente DOM simulato il percorso Cassa, modifica fondo, aggiornamento dei saldi, apertura periodo chiuso, aggiunta e modifica movimento senza duplicazione e ritorno al periodo selezionato. Le anteprime HTML nella cartella docs contengono dati dimostrativi. Non è stata eseguita una verifica visiva in un browser reale.
