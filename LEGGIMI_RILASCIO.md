# Play Money Admin 13.4 - PDF automezzi

## Novità
Pulsante PDF dentro ogni riquadro automezzo. Il report riguarda quel mezzo e il periodo di consultazione selezionato, anche se è selezionato un altro veicolo.
Il PDF comprende nome e targa, periodo, km attuali con data ultima lettura, km percorsi, numero utilizzi e totale rifornimenti.
Tabella cronologica: Data / Dipendente / Km inseriti / Rifornimento. Gli importi sono in euro con due decimali. Zeri e letture mancanti dei km compaiono come trattino.
I km attuali restano indipendenti dal periodo. I km percorsi mantengono il calcolo della 13.3.
La tabella continua su più pagine con intestazioni ripetute. Anche un periodo senza utilizzi produce un report esplicito.

## Apertura
Il PDF si apre in una nuova scheda del browser usando la stessa anteprima degli altri report. Nessun download automatico: scaricamento e stampa sono disponibili dal visualizzatore PDF del browser.
In caso di popup bloccato compare un messaggio. Con dati in caricamento, errori di caricamento o un intervallo non valido il pulsante è disabilitato.

## Installazione
Dalla 13.3: pubblicare il contenuto di dist e accettare l’aggiornamento dell’app. Nessuna migrazione o modifica al database richiesta.
Sorgenti e build di produzione inclusi. Nessuna pubblicazione online eseguita.

## Verifiche
25 test esistenti superati, compilazione produzione e lint dei file modificati superati.
PDF di prova controllati visivamente: 45 registrazioni su quattro pagine e periodo vuoto.
Verificata la logica di anteprima in nuova scheda con URL PDF e gestione popup bloccato; non effettuata una prova sul browser autenticato dell’utente.
