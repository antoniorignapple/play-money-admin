# Play Money — Checklist master aggiornamenti definitivi

Data revisione: 4 settembre 2026  
Versioni analizzate: Play Money Admin 9.4.0 e Play Money Dipendenti 18.8.0  
Release stabile precedente: Play Money Admin 9.7.0 e Play Money Dipendenti 19.1.0. Nuove versioni 9.8.0/19.2.0 preparate e verificate localmente, non ancora pubblicate. Migrazioni coordinate S04, S05 e S12 applicate; backend rinforzato anche con S07, S10, S11, S13 e S14.

## Esito sintetico

| Area | Stato | Evidenza principale |
|---|---|---|
| Build | Buono | Entrambe le applicazioni generano correttamente la build di produzione. |
| Sicurezza | Critico | `dipendenti` senza RLS; Edge Function amministrativa priva di autorizzazione del chiamante; numerose RPC privilegiate eseguibili pubblicamente. |
| Integrità dati | Critico | Conteggio e movimenti collegati non sono atomici; possibili conflitti offline e operazioni respinte dopo la chiusura giornata. |
| Offline Dipendenti | Discreto ma da consolidare | IndexedDB/outbox presenti, ma Cassa usa anche una seconda coda in `localStorage` e restano diverse condizioni di gara. |
| Offline Admin | Insufficiente | Nessuna gestione esplicita dello stato rete; risposte Supabase memorizzate nella cache del service worker. |
| Qualità codice | Da migliorare | Admin: 113 problemi ESLint (85 errori, 28 avvisi). Dipendenti: nessun controllo lint configurato. |
| Test | Assenti | Non risultano test unitari, di integrazione o end-to-end. |
| Prestazioni/PWA | Da migliorare | Bundle JS Admin ~1,18 MB; Dipendenti ~1,73 MB; precache Dipendenti ~12,36 MB. |

## Blocco S — Sicurezza e accessi

| ID | Priorità | App/servizio | Modifica richiesta | Stato |
|---|---:|---|---|---|
| S01 | P0 | Supabase Edge | Bloccare immediatamente `admin-update-user`: validare il JWT dell’utente, verificare lato server il ruolo Admin e rifiutare `anon`. La funzione usa la `service_role` e oggi permette creazione, modifica PIN ed eliminazione account senza autorizzazione applicativa. | Applicata online: Edge v9 con JWT e ruolo Admin; test senza sessione = 401. Test operativo Admin da completare dopo pubblicazione 9.7 |
| S02 | P0 | Admin | Inviare alla Edge Function il token della sessione Admin, non `VITE_SUPABASE_ANON_KEY`. | Completata e pubblicata con Admin 9.7 |
| S03 | P0 | Dipendenti/Edge | Separare “cambio del proprio PIN” dalla gestione account Admin; imporre `caller.id === auth_user_id` nel flusso personale e controllo Admin negli altri flussi. | Completata e pubblicata: Dipendenti 19.1 + Edge protetta; collaudo dispositivo da completare |
| S04 | P0 | Database | Progettare le policy corrette e poi abilitare RLS su `public.dipendenti`; revocare a `anon` INSERT/UPDATE/DELETE/TRUNCATE e ogni permesso non necessario. Non abilitare RLS alla cieca senza le policy compatibili col login. | Applicata e verificata online: RLS attivo, 2 policy; anon limitato a 4 colonne e senza scritture; autenticati in sola lettura operativa; `touch_last_seen()` personale |
| S05 | P0 | Database/UI | Eliminare il PIN in chiaro da `dipendenti`, dalle query `select('*')`, dalla schermata Agenti e dal CSV. Conservare solo credenziali gestite da Auth o hash non reversibili. | Completata: colonna PIN e RPC legacy eliminate; 5 dipendenti e 5 collegamenti Auth verificati intatti; client 9.7/19.1 pubblicati senza PIN |
| S06 | P0 | Auth | Sostituire l’accesso Admin con credenziale forte e MFA. Riesaminare anche il PIN dipendenti a 4 cifre (`pm` + PIN), aggiungendo almeno lockout/rate limit e protezione anti-bot. | In corso con Admin 9.8: login predisposto per password, cambio con verifica credenziale attuale e regola forte. Restano MFA, rate limit/anti-bot e rimozione finale della compatibilità PIN legacy |
| S07 | P0 | Database | Correggere `is_play_money_admin()`: rimuovere completamente `user_metadata`; usare esclusivamente dati server-controlled (`app_metadata` o tabella ruoli protetta). Rimuovere la regola “account non presente in dipendenti = Admin”. | Applicata e verificata online: registro privato con 1 Admin; funzione legacy delegata alla verifica sicura; anon senza EXECUTE |
| S08 | P0 | Admin | Dopo ogni login verificare sul server il ruolo Admin prima di montare il pannello; una sessione valida non deve bastare. | Completata e pubblicata con Admin 9.7; test reale login da completare |
| S09 | P0 | Database | Rifare la matrice RLS di tutte le tabelle finanziarie. Sono presenti policy `FOR ALL USING (true)` su dati come bonus, debiti, movimenti e override. Applicare ownership per dipendenti e privilegi espliciti per Admin. | Da fare |
| S10 | P0 | Database | Correggere `conteggi_tool_delete_selected_giro` e `conteggi_tool_update_selected_giro`: oggi un autenticato può agire su righe altrui quando `giro_id` non è nullo. | Applicata e verificata online: policy vulnerabili eliminate; dipendente limitato alle proprie righe; eccezione Admin con ruolo sicuro |
| S11 | P0 | Database | Rendere le viste `security_invoker`, revocare l’accesso anonimo non necessario e proteggere `change_daily_logs_view`, che può esporre dati di `auth.users`. | Applicata e verificata online: 8 viste `security_invoker`; nessuna lettura anon; storico Change senza dipendenza da `auth.users`; rollback salvato |
| S12 | P0 | Database | Revocare esplicitamente EXECUTE a `PUBLIC` e `anon` sulle RPC `SECURITY DEFINER`; concedere solo le funzioni realmente chiamabili e inserire controlli `auth.uid()`/ruolo nel corpo. Il controllo live segnala numerose funzioni privilegiate eseguibili da anon. | Applicata e verificata online: 0 RPC privilegiate eseguibili da anon; allowlist authenticated aggiornata con il lettore archivio legacy protetto; 4 implementazioni sensibili spostate in `private`; controlli identità/Admin presenti |
| S13 | P0 | Edge Push | Autorizzare `send-push` solo per Admin o tramite evento server affidabile; oggi un token pubblico valido può attivare invii per richieste esistenti. | Applicata online: Edge v6, JWT + ruolo Admin, registro consegne server-only e deduplicazione; test senza sessione = 401 |
| S14 | P0 | Eliminazione locali | Proteggere `preview_venue_deletion` e `delete_venue_permanently` con verifica Admin rigorosa, revoche esplicite e audit. Rimuovere `user_metadata` e la scorciatoia “non dipendente = Admin”. | Applicata e verificata online: controllo Admin privato, anon senza EXECUTE, `search_path` bloccato e audit privato di anteprime/cancellazioni |
| S15 | P1 | Auth | Attivare protezione password compromesse, verificare i rate limit Auth, aggiungere CAPTCHA/Turnstile dopo tentativi falliti e registrare gli accessi anomali. | Da fare |
| S16 | P1 | Hosting | Aggiungere CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection e una strategia HSTS coerente. | Da fare |
| S17 | P1 | Pacchetti | Escludere `.env`, `supabase/.temp`, riferimenti al progetto e file editor non necessari dagli ZIP. Le chiavi pubblicabili restano configurazione di deploy, non materiale da distribuire nel sorgente. | Completata per i pacchetti 9.8/19.2: esclusi segreti, cache, dipendenze installate e file editor; controllo contenuti ZIP eseguito |
| S18 | P1 | Dipendenze | Aggiornare e fissare le versioni, rigenerare i lockfile e ripetere l’audit. Stato attuale: Admin 8 vulnerabilità (6 alte); Dipendenti 18 (12 alte), incluse versioni dirette di Vite/PostCSS interessate. | Da fare |
| S19 | P1 | Configurazione | Rimuovere URL Supabase hardcoded dai componenti e centralizzare endpoint/configurazione per ambiente. | Da fare |
| S20 | P1 | Osservabilità | Introdurre log di sicurezza e audit per creazione/eliminazione utenti, cambi credenziali, finalizzazioni, cancellazioni definitive e operazioni Admin sensibili. | Da fare |

## Blocco O — Offline, sincronizzazione e integrità dati

| ID | Priorità | App/servizio | Modifica richiesta | Stato |
|---|---:|---|---|---|
| O01 | P0 | Dipendenti | Unificare tutte le scritture offline in una sola outbox IndexedDB. Cassa usa ancora una seconda coda/stato in `localStorage`, separata dal centro sincronizzazione. | Da fare |
| O02 | P0 | Cassa | Correggere la cancellazione di un movimento in stato `syncing`: oggi può essere rimosso solo localmente mentre l’INSERT in volo termina sul server, creando un movimento “fantasma”. | Da fare |
| O03 | P0 | Conteggi/Database | Creare una RPC transazionale idempotente che salvi insieme conteggio, debito, bonus e decremento nota. Nessun conteggio deve risultare salvato se un effetto contabile collegato fallisce. | Da fare |
| O04 | P0 | Debiti | Rendere atomico il decremento del residuo con lock/versione server. Il percorso online usa un saldo letto prima e può sovrascrivere un saldo più recente, arrivando ad aumentarlo nuovamente. | Da fare |
| O05 | P0 | Note | Rendere atomico il decremento `conteggi_rimasti`; evitare aggiornamenti concorrenti persi. | Da fare |
| O06 | P0 | Change | Gestire i conflitti: un aggiornamento offline vecchio non deve sovrascrivere un livello più recente del server. Usare versione/revisione, timestamp server e schermata di conflitto. | Da fare |
| O07 | P0 | Cassa/Lock | Definire il comportamento degli inserimenti creati offline prima della chiusura ma sincronizzati dopo il blocco delle 21:00. Oggi il trigger li respinge e possono restare in errore per sempre. | Da fare |
| O08 | P0 | Finalizzazione | Prima di chiudere giornata/periodo mostrare lo stato dei dispositivi e richiedere conferma che tutti i sospesi siano sincronizzati; prevedere recupero controllato dei sospesi tardivi. | Da fare |
| O09 | P1 | Cache locale | Isolare o ripulire i dati sensibili per account su dispositivi condivisi. Le cache operative sono comuni al database Dexie e possono contenere righe di più operatori. | Da fare |
| O10 | P1 | Offline pack | Correggere il criterio `ready`: oggi richiede `movements > 0`, quindi un pacchetto valido senza movimenti viene dichiarato incompleto. | Da fare |
| O11 | P1 | Preload | Sostituire i limiti silenziosi 10.000/5.000 con paginazione o finestre verificabili; segnalare cache parziale per evitare totali offline incompleti. | Da fare |
| O12 | P1 | Outbox | Aggiungere stato di errore definitivo, spiegazione comprensibile, esportazione diagnostica e procedura Admin di recupero senza duplicazioni. | Da fare |
| O13 | P1 | Outbox | Ordinare e compattare UPDATE/DELETE sullo stesso record, gestire dipendenze tra operazioni e impedire gare tra salvataggio diretto e sincronizzatore. | Da fare |
| O14 | P1 | Dispositivo | Richiedere storage persistente quando disponibile, controllare quota IndexedDB/localStorage e impedire una conferma “salvato” se la persistenza non è verificata. | Da fare |
| O15 | P1 | Aggiornamenti PWA | Non attivare una nuova versione durante un’operazione o con sospesi non riconciliati; testare le migrazioni Dexie tra tutte le versioni supportate. | Da fare |

## Blocco D — Database e migrazioni

| ID | Priorità | Modifica richiesta | Stato |
|---|---:|---|---|
| D01 | P0 | Creare una baseline/versione autorevole dello schema reale. Nel progetto live risultano solo 6 migrazioni registrate, mentre gran parte dello schema è stata applicata manualmente. | Da fare |
| D02 | P0 | Eliminare il conflitto sulla finalizzazione: `migrations/05_finalizzazione_periodo.sql` cancella dati, mentre la funzione live più recente li conserva. Una nuova installazione non deve poter ripristinare il comportamento distruttivo. | Da fare |
| D03 | P1 | Rinumerare le migrazioni duplicate (`06_*` e `12_*`) e stabilire un solo ordine idempotente con `begin/commit` e verifiche finali. | Da fare |
| D04 | P0 | Unificare `is_admin()` e `is_play_money_admin()` in una sola fonte di verità protetta; oggi definizioni differenti autorizzano utenti in modo diverso. | Da fare |
| D05 | P1 | Riesaminare vincoli, chiavi esterne, indici unici e cancellazioni per tutte le entità collegate; impedire orfani e duplicati senza affidarsi solo al client. | Da fare |
| D06 | P1 | Correggere i risultati degli Advisor Supabase: 11 errori sicurezza, 61 avvisi sicurezza; poi ripetere Advisor sicurezza e prestazioni fino a eliminare i rilievi applicabili. | In corso: controllo post-release = 0 ERROR, 22 WARN, 2 INFO. Restano warning applicabili e Advisor prestazioni |
| D07 | P2 | Ripulire policy duplicate e ottimizzare le espressioni RLS con `(select auth.uid())`; il controllo prestazioni segnala 40 policy permissive multiple e 33 casi di rivalutazione Auth per riga. | Da fare |
| D08 | P2 | Verificare e aggiungere gli indici per le chiavi esterne realmente usate; l’Advisor segnala 15 foreign key non indicizzate. | Da fare |

## Blocco F — Correttezza funzionale e contabile

| ID | Priorità | Modifica richiesta | Stato |
|---|---:|---|---|
| F01 | P0 | Centralizzare tutte le date operative nel fuso `Europe/Rome`. L’uso di `toISOString().slice(0,10)` può assegnare il giorno precedente nelle ore subito dopo mezzanotte italiana. | Da fare |
| F02 | P0 | Creare una libreria unica e testata per formule Cassa, Conteggi, Da Riportare, Recuperi, Debiti, Bonus, Uso Cassa e totali PDF, condividendo le stesse regole tra Admin e Dipendenti. | Da fare |
| F03 | P0 | Aggiungere riconciliazione prima della finalizzazione: totali sorgente, trasferimenti generati, numero locali, duplicati, sospesi e fingerprint devono coincidere. | Da fare |
| F04 | P1 | Uniformare `auth_user_id`, `dipendente.id`, `user_id`, `created_by`, `executed_by` e `default_employee_id`, con tipi e nomi non ambigui. | Da fare |
| F05 | P1 | Definire una regola monetaria unica: euro interi oppure centesimi, arrotondamento esplicito e nessun `Math.trunc` sparso nei componenti. | Da fare |
| F06 | P1 | Rendere tutte le eliminazioni normali recuperabili tramite soft delete; riservare quelle definitive a un flusso Admin con anteprima impatto, doppia conferma e audit. | Da fare |
| F07 | P1 | Verificare che PDF, riepiloghi, archivio e schermate usino gli stessi dati e lo stesso periodo; aggiungere test snapshot sui documenti. | Da fare |

## Blocco Q — Qualità, manutenzione e test

| ID | Priorità | Modifica richiesta | Stato |
|---|---:|---|---|
| Q01 | P1 | Portare Admin a zero errori ESLint. Oggi: 85 errori e 28 avvisi; 28 dipendenze Hook mancanti e 19 aggiornamenti di stato problematici negli effect. | Da fare |
| Q02 | P1 | Configurare ESLint anche su Dipendenti e aggiungere controllo automatico prima della build. | Da fare |
| Q03 | P1 | Aggiungere test unitari per date, importi, formule, idempotenza, conflitti e trasformazioni dei payload. | Da fare |
| Q04 | P1 | Aggiungere test di integrazione Supabase/RLS/RPC per ogni ruolo: anon, dipendente proprietario, altro dipendente e Admin. | Da fare |
| Q05 | P1 | Aggiungere test end-to-end: online, assenza rete, rete debole, chiusura PWA, cambio account, retry, aggiornamento PWA e finalizzazione. | Da fare |
| Q06 | P2 | Spezzare i componenti monolitici: `AccontoView` 4.709 righe, `ConteggioView` 3.193, `ConteggiPage` Admin 2.536 e `DebitiBonusPage` 2.114. Separare logica, query, stato e UI. | Da fare |
| Q07 | P1 | Introdurre monitoraggio errori in produzione con versione/build e contesto anonimizzato. Gli handler attuali non inviano alcuna diagnostica. | Da fare |
| Q08 | P1 | Aggiungere CI obbligatoria: installazione pulita, lint, test, build, audit, controllo migrazioni e verifica ZIP. | Da fare |

## Blocco P — Prestazioni e PWA

| ID | Priorità | Modifica richiesta | Stato |
|---|---:|---|---|
| P01 | P1 | Implementare code splitting per pagine e generatori PDF. Bundle principale: Admin ~1,18 MB; Dipendenti ~1,73 MB minificati. | Da fare |
| P02 | P1 | Comprimere/convertire immagini grandi e rimuovere duplicati. Dipendenti precarica ~12,36 MB; diversi PNG pesano 0,8–1,0 MB e il logo build ~1,50 MB. | Da fare |
| P03 | P0 | Rimuovere la cache generica `NetworkFirst` delle risposte Supabase in Admin: può conservare dati finanziari/autenticati per 24 ore e restituire risposte obsolete. Usare cache applicativa esplicita solo per dati sicuri. | Completata e pubblicata con Admin 9.7; collaudo dispositivo da completare |
| P04 | P1 | Aggiungere ad Admin timeout rete, indicatore online/offline, modalità consultazione esplicita e blocco sicuro delle scritture senza connessione. | Da fare |
| P05 | P1 | Uniformare la strategia aggiornamenti: Dipendenti usa conferma, Admin `autoUpdate`. Mostrare versione, note, stato e possibilità di rimandare senza interrompere il lavoro. | Da fare |
| P06 | P2 | Verificare font, audio, Lottie e icone realmente usati; precaricare soltanto gli asset necessari al primo avvio. | Da fare |

## Blocco G — Grafica, UX e accessibilità

| ID | Priorità | Modifica richiesta | Stato |
|---|---:|---|---|
| G01 | P1 | Creare un design system Play Money condiviso: colori, tipografia, spaziature, raggi, ombre, icone, pulsanti, campi e stati. Ridurre colori/valori hardcoded. | Da fare |
| G02 | P1 | Uniformare gli stati operativi in entrambe le app: caricamento, vuoto, errore, offline, rete debole, sospeso, syncing, salvato, bloccato e sola lettura. | Da fare |
| G03 | P1 | Revisione accessibilità completa: navigazione tastiera, focus visibile, etichette, dialog, annunci screen reader, dimensione minima dei target e contrasto. | Da fare |
| G04 | P1 | Collaudo responsive su iPhone piccoli/grandi, Android, tablet e desktop; correggere safe-area, tastiera virtuale, scroll annidati e modali. | Da fare |
| G05 | P2 | Uniformare animazioni e feedback tattili/sonori, rispettando `prefers-reduced-motion` e una modalità silenziosa. | Da fare |
| G06 | P1 | Uniformare conferme e azioni distruttive: etichette chiare, conseguenza visibile, prevenzione doppio tap e stato di avanzamento. | Da fare |
| G07 | P2 | Migliorare gerarchia visiva e densità delle schermate più complesse, mantenendo la velocità d’uso per gli operatori. | Da fare |

## Blocco R — Rilascio definitivo

| ID | Priorità | Modifica richiesta | Stato |
|---|---:|---|---|
| R01 | P1 | Versione e release notes generate da un’unica configurazione in entrambe le app. | Preparata 19.2/9.8: package, lockfile, UI e configurazione release sincronizzati; note sostituite con le sole novità correnti; build riuscite |
| R02 | P0 | Backup verificato del database e piano di rollback prima delle migrazioni di sicurezza/finalizzazione. | Parziale: struttura e fingerprint verificati, report e script di backup salvati; dump logico completo non ancora creato perché sul PC non risultano Docker/pg_dump |
| R03 | P1 | ZIP finali con sorgente completo, lockfile, migrazioni ordinate e `dist` verificato; senza `node_modules`, `.env`, `.temp`, file vuoti o output obsoleti. | Completata per 9.8/19.2: pacchetti coordinati verificati con test integrità e hash SHA-256, senza segreti, cache locali o dipendenze installate |
| R04 | P0 | Collaudo obbligatorio su progetto di prova o branch prima del database di produzione. | Da fare |
| R05 | P0 | Collaudo reale su dispositivi con almeno: login/logout, cambio account, 4G debole, modalità aereo, kill PWA, riapertura, retry, doppio tap, cambio giorno, lock 21:00, finalizzazione e aggiornamento PWA. | Da fare |
| R06 | P1 | Consegna finale con report migrazioni, esito test, hash pacchetti e istruzioni di pubblicazione/rollback. | Da fare |
| R07 | P1 | A ogni aggiornamento sincronizzare numero in package, lockfile, schermate, configurazione release, `release.json` e nome ZIP. Sostituire sempre le vecchie note con le sole modifiche della versione corrente. | Regola permanente |
| R08 | P0 | Prima di ogni modifica spiegare ad Antonio, in modo semplice ma dettagliato: cosa cambierà, perché è necessaria, effetti previsti, rischi, piano di verifica e possibile rollback. Applicare la modifica soltanto dopo la sua conferma esplicita. Le ispezioni in sola lettura sono consentite, ma non autorizzano modifiche successive. | Regola permanente |
| R09 | P0 | Vietare pubblicazioni, push con deploy automatico, migrazioni SQL, cambi RLS/Auth, Edge Function e configurazioni di produzione mentre gli operai lavorano: oggi fino alle 17:00 e domani dalle 08:00 alle 17:00. Prima della riapertura lasciare sempre una versione verificata e stabile. | Regola operativa vincolante |

## Modifiche indicate da Antonio

Questa sezione resta aperta per le modifiche funzionali e grafiche che Antonio aggiungerà durante il lavoro. Ogni nuova richiesta riceverà un ID `Axx`, priorità, dipendenze e stato.

| ID | Richiesta | Priorità | Dipendenze | Stato |
|---|---|---:|---|---|
| A01 | Eliminare il riquadro `ESPORTA` dalla sezione Conteggi Dipendenti. | P1 | — | Completata 18.9 |
| A02 | Rendere compatto il periodo ufficiale con `PERIODO CONTEGGI` e intervallo date entrambi centrati, su due righe ravvicinate; lucchetto Admin ancorato a destra. | P1 | G01–G04 | Completata 18.9 (rifinita) |
| A03 | Compattare il Giro in una singola riga: `GIRO RIGNANESE • N LOCALI`, con `CAMBIA` a destra. | P1 | — | Completata 18.9 |
| A04 | Disporre `NUOVO`, `MODIFICA` e `DEPOSITA` su una sola riga, senza rettangoli esterni: icone circolari sospese e scritte. | P1 | A01, G03–G04 | Completata 18.9 |
| A05 | Conservare la struttura verticale del precedente `RIEPILOGO ATTUALE`, migliorandone finiture e leggibilità, senza barra di avanzamento e mantenendo formule, formati e selezione Depositi teorici/reali. | P1 | F02, G01–G03 | Completata 18.9 (rifinita) |
| A06 | Aggiungere l'accordion `RIEPILOGO DA RIPORTARE`, chiuso/apribile, con totale e numero locali nell'intestazione. Mostrare solo conteggi con `riporto > 0`; ogni riga: nome locale, codice ufficiale a 6 cifre e importo del `riporto` del conteggio corrente. | P1 | F02 | Completata 18.9 |
| A07 | Creare uno stato di consegna separato per la combinazione `periodo + giro`, con proprietario registrato, senza confonderlo con finalizzazione o `locked` delle singole righe. Stati: `IN LAVORAZIONE`, `INVIATO`, `RIAPERTO`. | P0 | D01, S07–S12 | Completata DB |
| A08 | Consentire l'invio anche con locali non conteggiati: sarà l'Admin a controllarli nella propria sezione. Richiedere soltanto connessione e assenza di sincronizzazioni sospese; il popup mostra numero conteggi, Da Riportare e avviso sulla riapertura Admin. | P0 | O03, O07–O08, O12 | Completata 18.9 |
| A09 | Dopo conferma server, rendere il Giro in sola lettura: bloccare `NUOVO`, `MODIFICA` e `DEPOSITA`; mostrare `GIRO INVIATO` e data/ora. | P0 | A07–A08 | Completata 18.9 |
| A10 | In Conteggi Admin usare arancione + `IN LAVORAZIONE`, verde + `INVIATO`; mostrare data/ora senza affidarsi al solo colore. | P1 | A07, G03 | Completata 9.5 |
| A11 | Aggiungere nell'Admin il lucchetto di riapertura con conferma e autorizzazione server. Il dipendente torna modificabile e vede `RIAPERTO DALL'ADMIN`. | P0 | A07, S07–S12, S20 | Completata 9.5/DB |
| A12 | Rendere invio e riapertura atomici e idempotenti tramite RPC protette e RLS; aggiornare entrambe le app in tempo reale. Non considerare inviato un Giro rimasto offline. | P0 | A07–A11, O01–O03 | Completata DB |
| A13 | Verificare doppio invio, blocco modifica dopo invio, riapertura Admin e modifica successiva tramite test transazionale con rollback; completare in seguito i test end-to-end su dispositivi. | P1 | Q03–Q05 | Test DB completato; E2E da fare |
| A14 | In Cassa eliminare i loghi grandi da `CALENDARIO` e `CONTEGGI OGGI`, alzare i titoli e ridurre l'altezza delle due sezioni. | P1 | G01–G04 | Completata 18.9 |
| A15 | Rifare completamente il richiamo `FONDO CASSA DA INSERIRE` con aspetto integrato oro/avorio, gerarchia più pulita e testo secondario. | P1 | G01–G04 | Completata 18.9 |
| A16 | Inserire nella testata della tendina `MENU ACCONTI`, a destra della data, il pulsante compatto `INVIA GIRO`; usare stile scuro/avorio e dimensioni diverse da `INSERISCI`, con popup riepilogativo e avviso di sola lettura. | P0 | O01, O08, G03–G06 | Completata 19.0 (rifinita) |
| A17 | Consentire l’invio Cassa anche senza movimenti per tutti i locali; richiedere connessione e assenza di dati Cassa/Fondo ancora sospesi o in sincronizzazione. | P0 | O01, O08, O12 | Completata 19.0 |
| A18 | Dopo conferma server, bloccare al dipendente inserimento, modifica ed eliminazione di movimenti e Fondo cassa; mostrare `GIRO INVIATO`, data e ora. | P0 | A16–A17 | Completata 19.0/DB |
| A19 | In `Admin → Analisi giornaliera`, rendere verde la barra del dipendente che ha inviato, aggiungere stato testuale `INVIATO` con data/ora e mantenere il lucchetto chiuso attivo. | P1 | A18, G03 | Completata 9.6 |
| A20 | Permettere soltanto all’Admin di riaprire il Giro Cassa; dopo la conferma la barra torna oro, compare `RIAPERTO DALL’ADMIN` e il dipendente può nuovamente modificare. | P0 | A18–A19, S07–S12 | Completata 9.6/DB |
| A21 | Rendere invio e riapertura Cassa atomici e idempotenti tramite RPC protette, RLS, trigger di blocco, audit e aggiornamento realtime; mantenere separato lo stato Cassa da `INVIA GIRO CONTEGGI`. | P0 | A16–A20, D01, S07–S12 | Completata DB e test transazionale |
| A22 | In Conteggi Dipendenti rendere `CAMBIA` un vero interruttore: primo clic apre la scelta Giro, secondo clic la richiude. | P1 | A03, G03 | Completata 19.0 |
| A23 | Mostrare l’amministratore reale in `Admin → Agenti` come identità separata `ADMIN GIOVANNI`, correggere il contatore Admin e permettere il cambio della propria password con verifica della credenziale attuale e requisiti forti. | P0 | S06–S08 | Completata nei sorgenti Admin 9.8; build riuscita, collaudo login/cambio password prima della pubblicazione |
| A24 | Aggiungere in Conteggi Dipendenti l’archivio periodi dal più recente al più vecchio. I periodi storici sono in sola lettura: `NUOVO` disabilitato, `CONSULTA` senza modifica/eliminazione, niente Deposita o invio, riepilogo solo reale, ritorno rapido all’attuale e reset uscendo dalla sezione. Ingrandire i codici a 6 cifre del Da Riportare. | P1 | F07, G02–G04 | Completata 19.2 + DB: i periodi nuovi usano le righe normali; soltanto il primo periodo 30/07–14/08 usa la RPC protetta di compatibilità. Test autorizzazione e build riusciti; collaudo dispositivo richiesto |
| A25 | Non aprire automaticamente la preparazione Fondo cassa. Lasciare il badge manuale visibile e pulsante finché il fondo manca, interrompendo il richiamo dopo il salvataggio e rispettando `prefers-reduced-motion`. | P1 | G03–G05 | Completata nei sorgenti 19.2; build riuscita, collaudo dispositivo richiesto |

## Ordine tecnico consigliato

1. Flussi di consegna richiesti da Antonio: Conteggi A01–A13 e Cassa A16–A21 completati; proseguire con le prossime modifiche nell’ordine deciso da Antonio.
2. Contenimento immediato: S01–S14 e P03.
3. Baseline database e migrazioni: D01–D06, R02, R04.
4. Integrità contabile/offline: O01–O15 e F01–F07.
5. Qualità e test automatici: Q01–Q08.
6. Prestazioni/PWA: P01–P06.
7. Grafica e accessibilità: G01–G07.
8. Collaudo e rilascio: R01–R06.

L’ordine effettivo delle modifiche verrà deciso da Antonio. I punti P0 di sicurezza sono bloccanti per una pubblicazione sicura.
