# Play Money Admin 14.0 — Cassa Ufficio

## Installazione

Supabase è già stato aggiornato sul progetto Play Money il 18 settembre 2026. Il Fondo Cassa è inizializzato a 0 €. Non eseguire nuovamente gli SQL per installare questa versione sullo stesso progetto.

Pubblica il contenuto della cartella **dist** sul consueto hosting dell'applicazione. Poi ricarica l'app e, se compare l'avviso, premi **Aggiorna ora** dopo aver salvato eventuali lavori in corso. Controlla che la versione visibile sia **14.0**.

Il pacchetto comprende dist pronto, sorgenti, migrazione del database, font con licenza e test. Il sito non è stato pubblicato automaticamente.

## Cosa cambia

- Riquadro laterale CASSA centrato con il totale Cassa Ufficio e accesso alla nuova pagina.
- Nuova pagina con Fondo Cassa, Acconti, Da Rientrare e Residuo Azienda, in quest'ordine. Quattro colonne su desktop; disposizione adattata sugli schermi più piccoli.
- Totale Cassa Ufficio = Fondo Cassa + Acconti + Da Rientrare + Residuo Azienda.
- Fondo Cassa persistente tra dispositivi, modificabile dall'admin, inizialmente 0 €. Ogni variazione conserva valore precedente, nuovo valore, data e autore. La pagina mostra le ultime 100 variazioni; lo storico completo resta nel database.
- Acconti = disponibilità del periodo attivo, già al netto dei trasferimenti. Da Rientrare = Da riportare meno Recuperi.
- Residuo Azienda = Saldo Azienda del periodo chiuso con data finale più recente. Non somma tutti gli archivi. Se non esistono periodi chiusi, vale 0 €.
- Saldi negativi e centesimi mantengono il loro valore. Input italiano, per esempio 10.000 o 10.000,50, senza conversioni ambigue.
- Le modifiche effettuate nell'app aggiornano il riepilogo automaticamente. Cambiamenti da altri dispositivi vengono riletti al ritorno nell'app e ogni 30 secondi mentre è visibile.

## Contabilità dei periodi

Il pulsante **Contabilità periodo** si trova in alto a sinistra nella sezione Conteggi. Apre precisamente il periodo visualizzato. **Torna ai Conteggi del periodo** riporta allo stesso archivio.

La contabilità ha un riepilogo Esattore / Recuperi acconto aggio / Totale globale, movimenti in ordine cronologico e Saldo Azienda. Puoi aggiungere, modificare ed eliminare movimenti anche nei periodi chiusi, senza riaprire i conteggi. I trasferimenti mantengono il collegamento con la Cassa e con l'eventuale copia d'archivio.

Saldo Azienda = Esattore rettificato per giro + debiti selezionati − trasferimenti Cassa − movimenti contabili. Un movimento contabile negativo aumenta il saldo. I trasferimenti Cassa devono avere importo positivo.

Le rettifiche dell'esattore continuano a essere applicate per giro: nessun doppio conteggio quando l'esecutore è diverso. Il PDF usa lo stesso totale e si apre in anteprima.

La consultazione dei trasferimenti di un periodo passato non cambia il riepilogo attuale Cassa Ufficio. Il nuovo Fondo Cassa Ufficio è distinto dagli eventuali fondi giornalieri delle altre sezioni.

Per gli archivi storici che conservano soltanto una copia dei conteggi, vengono letti i dati d'archivio. I movimenti restano modificabili; la selezione di debiti privi del conteggio originale è disabilitata perché il collegamento richiede la riga originale.

## Anteprime

Apri nel browser i file **docs/ANTEPRIMA_CASSA_14.html** e **docs/ANTEPRIMA_CONTABILITA_14.html**. Sono anteprime statiche ottenute dai componenti dell'app, con dati dimostrativi: non accedono a Supabase e i pulsanti non effettuano operazioni.

## Verifiche

- 36 test automatici dei calcoli e delle regressioni: superati.
- Test database su Postgres locale incorporato: fondo iniziale, salvataggio, conflitti, storico protetto, trasferimenti nei periodi chiusi e negli archivi, date e permessi admin: superati.
- Test funzionale React/DOM: accesso, quattro campi, aggiornamento fondo e sidebar, apertura del periodo chiuso, aggiunta/modifica senza duplicazioni, ritorno allo stesso periodo: superato.
- Build produzione: completata. Restano gli avvisi di dimensione del bundle e importazione jsPDF, non bloccanti.
- Verifica su Supabase dopo installazione: fondo 0 €, storico vuoto, 127 conteggi, 17 trasferimenti, 7 movimenti contabili e 1 archivio, stessi conteggi di righe rilevati prima dell'installazione.
- Il controllo Supabase non segnala problemi sulle nuove tabelle e funzioni. Le segnalazioni sulle strutture preesistenti non sono state modificate da questo rilascio.
- La verifica dell'interfaccia è funzionale su DOM simulato; non equivale a una prova visiva su tutti i browser e dispositivi reali.

Per ripetere: `npm ci`, `npm run check`, `npm run test:database:v14`, `npm run test:ui:v14`. I test UI usano dati di prova isolati, non il database aziendale.
