# Play Money Admin 18.2

## PDF mezzi

Nuovo pulsante PDF MEZZI accanto a NUOVO AUTOMEZZO. Apre un popup con ricerca per mezzo/targa, selezione singola, Seleziona tutti, Deseleziona tutti e contatore. Tutti i mezzi attivi sono inizialmente selezionati; la ricerca non cancella le selezioni nascoste. La selezione vuota blocca Apri PDF.

Prima di generare il documento vengono riletti gli automezzi e tutto lo storico tramite le letture già presenti nell'app. Un errore interrompe la generazione: non viene prodotto un PDF con dati vecchi o incompleti. Se un mezzo selezionato è stato disattivato nel frattempo, viene richiesto di verificare di nuovo la selezione.

Il PDF riporta MEZZO, TARGA e KM ATTUALI. I km vengono dall'ultima lettura valida per data di utilizzo, poi data di creazione e ID, indipendentemente dal periodo di consultazione della pagina. Non viene scelto il numero di km più alto. Come nel riepilogo preesistente, zeri, valori mancanti/non validi e date future sono ignorati. Registrazioni eliminate escluse. Se mancano letture valide, appare NON DISPONIBILI. La data dell'ultima lettura compare discretamente sotto i km.

Documento A4 verticale, font Manrope incorporato, colori ardesia/oro, intestazione PLAY MONEY - PARCO AUTOMEZZI, data di situazione, contatore dei mezzi, righe spaziose e paginazione automatica. I nomi lunghi vanno a capo. Apertura online, senza download automatico.

## Installazione

Nessun nuovo SQL rispetto alla 18/18.1. Sono conservate tutte le modifiche precedenti. Ricompilare con la propria configurazione (`npm ci`, `npm run build`); inclusa anche la cartella dist compilata.

L'anteprima PDF inclusa usa dati dimostrativi, non saldi o letture estratti dal database aziendale. La funzione di export legge soltanto i dati e non modifica km, veicoli o registrazioni.

## Verifiche

47 test unitari superati e build di produzione completata. Test popup (`node tests/fleet-ui.mjs`): tutti/nessuno, selezione persistente durante ricerca, rilettura aggiornata e blocco export su errore. Verificato nel PDF che la nuova lettura acquisita al momento dell'export sostituisca quella precedente. Anteprima A4 controllata visivamente. Test elenco lungo su più pagine, associazione ID/targa legacy e scelta della lettura recente invece del massimo.
