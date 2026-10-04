# Play Money Admin 19.0 — mobile

Il telefono ha ora una navigazione dedicata: Cassa a sinistra, Analisi al centro e Conteggi a destra. Tutte le sezioni sono disponibili nel menu in alto a sinistra, con ricerca, selezione corrente e uscita dall'account.

## Interfaccia

- Barra inferiore con tre schede e indicatore animato, ripresa dal TabItem di Play Money Dipendenti.
- Menu chiaro con schede, icone e dettagli ispirati al drawer di AccontoView. Dialog nativo con gestione del focus e chiusura con Escape/backdrop.
- SplashLogo copiato da Dipendenti: stesse animazioni e geometria, logo blu Admin.
- Login con lo stesso layout, sfondo, pannello e animazioni di Dipendenti. Il profilo è Admin e il campo è la password amministratore; restano le credenziali e la compatibilità del PIN Admin già esistenti. La lista dei dipendenti non viene usata per autorizzare l'Admin.
- Verifica della sessione tramite getUser e is_play_money_admin_secure conservata.
- Sistema mobile comune: Manrope, comandi da almeno 48 px, campi a 16 px, icone più grandi, stati premuti e focus visibile. Aree sicure iOS e altezza della tastiera considerate nelle finestre comuni.
- Desktop: sidebar e layout delle pagine conservati. Login e splash condividono la nuova presentazione richiesta.

## Schermate operative

- **Cassa:** schede movimento apribili, selezione per cancellazione distinta dalla modifica, filtri dedicati su mobile, nuovo movimento e totali in basso.
- **Analisi:** data compatta, riepilogo leggibile, azioni agente disposte senza sovrapposizioni, movimenti in schede verticali con etichette per importo.
- **Conteggi:** azioni del periodo e PDF separate dal titolo, riepilogo compatto, locali disponibili in schede con importi e stato. La tabella desktop larga 980 px resta sul desktop.
- **Locali:** nomi lunghi leggibili, schede Change ridimensionate, azioni e importi adattati al telefono; parco slot e note continuano a usare i flussi esistenti.
- **Calendario:** Agenda come vista mobile iniziale, scelta Agenda/Mese, selezione sincronizzata tra le viste; festivi e domeniche conservano i blocchi esistenti.
- **Sezioni secondarie:** Cassa Ufficio, Contabilità Conteggi, Debiti/Bonus, Simulazioni, Agenti, Giri, Automezzi e Cestino beneficiano dei comandi, campi, testo e finestre comuni adattati al telefono. I flussi e i calcoli contabili esistenti sono conservati.

## Verifiche

- `npm run check`: 52 test unitari e build di produzione.
- `npm run test:ui:mobile`: browser con dati isolati, navigazione, separazione selezione/modifica, popup e filtri Cassa, dettaglio stato locale, Agenda/Mese, campi a 16 px, layout a 375/430/440 px e sidebar desktop a 1440 px. Accesso Admin, errore di password, compatibilità PIN e rifiuto di un account senza ruolo Admin.
- `node tests/accounting-ui-v18.mjs`: selezione e importi dei debiti, ripristino, movimento automatico protetto e debito originale invariato.
- `node tests/office-ui.mjs`: saldo ufficio, modifica fondo, navigazione periodo e ritorno ai Conteggi. Attesa iniziale adeguata alla nuova animazione splash.
- `node tests/slot-ui.mjs`: quantità, note e cambio locale.
- `node tests/fleet-ui.mjs`: filtri, selezioni e PDF.
- Componenti nuovi verificati con ESLint. Il lint generale contiene errori preesistenti nella repository; non è un controllo verde.

Per il test browser: `npx playwright install chromium`, poi `npm run test:ui:mobile`. Per rigenerare le anteprime: `npm run test:ui:mobile -- --screenshots`. Un browser già installato può essere indicato con `MOBILE_BROWSER_EXECUTABLE`.

Le immagini in `docs/mobile-v19` sono schermate vere del codice aggiornato con dati dimostrativi. Le verifiche sono in Chromium con simulazione touch: resta da validare l'uso su Safari/PWA in un iPhone fisico, soprattutto con tastiera, aree sicure e PDF. Nessuna migrazione o modifica allo schema database è richiesta da questo aggiornamento.

## Aggiornamento 19.1

Palette decorativa bianco e azzurro in tutte le sezioni, login, splash e report. Titoli maiuscoli; menu mobile senza sottotitoli. Aggiornamento per Cassa, Analisi e Conteggi nella barra superiore accanto alla ricerca; rimossi i titoli duplicati su mobile, mantenuta la navigazione delle date. Riepilogo Conteggi con titolo e comandi su righe distinte. Test browser aggiunti per titoli duplicati, posizione del riepilogo e pulsante aggiornamento.
