# Play Money Admin 11.0

Aggiornamento della versione 10.1 fornita da Antonio. L’app Dipendenti 19.4 rimane il riferimento per i calcoli.

## Prima di usare la 11

**Questa versione richiede un aggiornamento del database. Caricare soltanto il sito non abilita i nuovi salvataggi.**

1. Nel progetto Supabase già usato dalle due app, aprire SQL Editor.
2. Eseguire per intero `supabase/migrations/20260913130401_admin_v11_complete_editor.sql`. Il file è transazionale e ripetibile; controlla preventivamente alcuni prerequisiti e non cancella i conteggi. Non rieseguire tutte le vecchie migrazioni contenute nella cartella `migrations`.
3. Caricare il codice della 11.0 nel progetto Admin esistente, conservando le variabili di ambiente dello stesso progetto. Per compilare: `npm ci`, poi `npm run build`. Il risultato è in `dist`.
4. Aggiornare l’app dal suo avviso di nuova versione. Entrare in Conteggi, aprire un locale e scegliere **Modifica completa · storico rettifiche**.
5. Verificare un conteggio con dati noti e controllare il relativo riepilogo anche su Dipendenti e nel PDF. La verifica sul database online non è stata eseguita durante la preparazione di questo pacchetto.

Se il controllo SQL segnala campi mancanti, il database online non corrisponde ancora ai prerequisiti degli ZIP 10.1/19.4. Conservare il messaggio e allineare lo schema prima di usare i nuovi editor.

## Conteggi: cosa cambia

- Modifica reale della riga originale `conteggi_tool`, non soltanto della rettifica Esattore del riepilogo.
- Locale, giro, dipendente esecutore, data contabile e data/ora di registrazione (quando presente). L’orario del campo è quello del dispositivo.
- Esattore, acconti, carta, monete, da riportare, uso cassa, debito contanti, assegno, debito virtuale e bonus.
- Recuperi giorni 2, 3 e 4 con compensazione automatica tra carta e riporto residuo.
- Totale sempre visibile, confronto prima/dopo, motivo della rettifica e conferma del riepilogo.
- Storico delle ultime 100 rettifiche del conteggio, con valori precedenti recuperabili nel modulo. Il ripristino richiede un nuovo salvataggio e produce una nuova voce nello storico.
- Blocco facoltativo delle successive modifiche del dipendente.
- Modifica dei conteggi inviati e dei periodi chiusi che conservano le righe originali.

La formula usata da Dipendenti 19.4 è:

`acconti + carta + monete + riporto + assegno − esattore − uso_cassa − debito`

Bonus e debito virtuale sono registrati ma non entrano in questa formula. Gli importi dell’editor sono in euro interi, come il flusso di salvataggio Dipendenti. Le rettifiche manuali dell’Esattore per giro rimangono esplicite e possono essere azzerate con il comando già presente.

## Centro modifiche

Nuova voce nella barra laterale, sotto Controllo:

| Sezione | Campi modificabili nel nuovo centro |
| --- | --- |
| Cassa | Data, locale, dipendente, acconto, recupero, da riportare e note |
| Simulazioni | Data, locale, dipendente, importi e note; totale ricalcolato |
| Dipendenti | Nome completo e stato attivo |
| Locali | Nome, città, codice e stato attivo |
| Change | Nome, fondo, livello attuale e stato attivo |
| Giri | Nome, dipendente titolare, ordine e stato attivo |
| Automezzi | Nome, targa e stato attivo |
| Utilizzi automezzi | Data, dipendente, mezzo, chilometri e rifornimento |

Si visualizzano 100 righe per pagina; la ricerca filtra la pagina corrente. I campi disponibili dipendono dalle colonne presenti nella riga.

Debiti, bonus, calendario, assegnazione dei locali ai giri e credenziali conservano i loro moduli dedicati. Il centro non modifica password, PIN, ruoli di sicurezza o identificativi tecnici. Non è un editor indiscriminato di ogni colonna del database.

L’audit registra inoltre le scritture amministrative riuscite nelle tabelle operative elencate nella migrazione, anche dai moduli precedenti. Per le anagrafiche dipendenti conserva solo id, nome, email, stato e ruolo, senza PIN o password.

## Coerenza contabile e limiti espliciti

- Il salvataggio del conteggio, i movimenti collegati e l’audit avvengono nella stessa transazione. In caso di errore non rimane una rettifica parziale.
- Debiti e bonus già collegati al conteggio vengono rettificati senza una seconda decurtazione. Per nuovi importi si usa l’unico debito contanti/bonus attivo del locale, quando presente. Con più collegamenti ambigui il salvataggio si ferma e indica la sezione da correggere.
- Un debito collegato deve essere azzerato prima di spostare il conteggio su un altro locale; lo stesso vale per il bonus. Non si trasferisce implicitamente un contratto di debito tra locali.
- Un conteggio chiuso aggiorna i riporti di finalizzazione non eliminati. Se il trasferimento manca e il nuovo riporto è positivo, viene creato una sola volta. I trasferimenti eliminati intenzionalmente non vengono ripristinati automaticamente.
- Un conteggio con trasferimenti verso il periodo successivo non può essere spostato in un altro periodo con un solo comando: il salvataggio è bloccato per evitare duplicazioni tra periodi. Rimangono modificabili gli altri campi.
- I vecchi archivi che contengono solo fotografie JSON e non più il conteggio originale restano consultabili. L’editor segnala l’assenza dell’originale e non inventa una ricostruzione contabile.
- Gli invii dei giri non vengono riaperti automaticamente dalla rettifica Admin: il comando di riapertura rimane separato.
- Il confronto con la riga letta rileva le modifiche concorrenti tra apertura e salvataggio Admin. I vecchi salvataggi offline con timestamp precedente alla rettifica vengono respinti. La 19.4 non invia una versione di base su ogni scrittura: per impedire anche riscritture da moduli vecchi salvati successivamente, usare il blocco dipendente. Una gestione completa dei conflitti lato telefono richiederebbe un aggiornamento anche di Dipendenti.
- I PDF generati nuovamente usano i dati aggiornati. I PDF già scaricati restano copie del momento in cui sono stati creati.

## Verifiche incluse

- `npm test`: 11 test di calcolo, input italiani, recuperi, payload, date e protezione aggiornamenti.
- `npm run test:database`: 19 scenari PostgreSQL PGlite, ripetuti sia con totale normale sia con totale generato (38 verifiche). Coprono autorizzazione, audit, concorrenza, riporti, debiti, bonus, rollback, blocchi e simulazioni.
- Build di produzione Vite/PWA.
- Prove browser con risposte simulate: modifica e conferma desktop, payload inviato, layout mobile senza scorrimento orizzontale, compensazione recuperi e apertura del Centro modifiche. Le anteprime sono in `docs` e usano dati dimostrativi.

I test SQL usano uno schema ricostruito dai file disponibili; non certificano trigger, viste o policy ulteriori presenti solo nel database online. Non sono stati eseguiti deploy, cambi di credenziali o scritture sui dati reali.
