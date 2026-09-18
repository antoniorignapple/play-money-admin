# Play Money — rilascio serale e checklist residua

Data: 5 settembre 2026. Versioni preparate: Admin 9.9.0 / Dipendenti 19.4.0.

## Stato effettivo

- Backup database esportato dal PC; lettura completa con pg_restore terminata con esito 0.
- SHA-256 backup: 39269649546839a14e7e5cc516e9d55c791a81dd941c5a07fc4749a389bd0cca.
- Non è stata provata una ricostruzione completa del database. Ruoli, configurazioni e file Storage non sono certificati da questo controllo.
- SQL applicato sul progetto play-money: restrict_anonymous_play_money_tables.
- Verifica: 34 tabelle protette, zero privilegi anonimi residui su queste tabelle.
- Permessi authenticated identici prima/dopo (hash 35d273e879712dbad7828bef9b2841e9).
- Colonne login anonime preservate: id, full_name, email, active. RLS e righe aziendali non modificate.
- ZIP delle app pronti per compilazione e pubblicazione dal PC. Push e distribuzione NON ancora verificati: non dichiarare il rilascio frontend completato.

## Cosa includono le app

Dipendenti: correzioni Cassa per movimenti in attesa e risposte ritardate; date italiane nei percorsi individuati; controlli completezza cache e paginazione contabile; protezione aggiornamento PWA durante operazioni pendenti; dipendenze aggiornate. Comprende tutti i ritocchi grafici locali e il Fondo cassa 06 approvato dall'utente, sia pagina sia popup, con etichette fisse, unità a destra e gestione zero. Tab bar e relativo layout conservati.

Admin: date operative corrette, aggiornamento PWA con conferma manuale, controllo richieste in corso e aggiornamenti dipendenze. Il remaster grafico Admin non è incluso.

Le transazioni contabili PM05–07 NON sono incluse. Non sono stati completati né il remaster complessivo né la riscrittura del codice. Non sono incluse nuove immagini Change o nuovi loghi creati in altre conversazioni.

## Pubblicazione dal PC — una app alla volta

1. Prima di copiare: git status --short. Se esistono modifiche non riconosciute, fermarsi e conservarle.
2. Annotare il commit corrente con git rev-parse HEAD e fare una copia della cartella originale.
3. Estrarre lo ZIP corrispondente e copiare il contenuto nella cartella originale, senza cancellarla. Preservare .git e configurazioni locali. Gli ZIP non includono credenziali, node_modules, dist o migrazioni storiche.
4. Eseguire npm ci, poi npm run check (test e build). Fermarsi in caso di errore.
5. git status --short; git diff --stat. Controllare che non siano inclusi backup, password o file inattesi.
6. git add .; git diff --cached --check; git diff --cached --stat. Non concatenare questi comandi al push senza verificarne l'esito.
7. git commit -m "Play Money Admin 9.9.0 - date e aggiornamento PWA" (oppure Dipendenti 19.4.0 - affidabilita e Fondo cassa).
8. git push origin main; git status -sb. Attendere il successo del deploy prima dell'altra app.
9. Aprire l'app, verificare versione, login e lettura dati. Dipendenti: Cassa, Conteggi, Change, Fondo cassa, tab bar e assenza di sospesi inattesi.

Non eseguire npm audit fix e non eseguire le vecchie migrazioni presenti nei repository. Lo SQL di contenimento anonimo è già stato applicato.

## Rollback

Frontend: annullare il solo commit di questo rilascio con git revert HASH_COMMIT_RILASCIO, poi push, controllando prima le eventuali modifiche successive. Non usare reset --hard o force push. Non cancellare cache o dati PWA degli operai.

SQL: il rollback automatico valeva durante la transazione; ora completata. In caso di incompatibilità diagnosticare e ripristinare soltanto l'accesso strettamente necessario, con autorizzazione. Non riaprire indiscriminatamente i privilegi anonimi. Non ripristinare l'intero backup perdendo operazioni successive.

## Checklist residua in ordine di urgenza

| Ordine | ID master | Da completare | Criterio di chiusura |
|---|---|---|---|
| 1 | PM03, PM26, PM35 | Pubblicazione e collaudo reale delle due versioni | Deploy riusciti, versioni visibili, login e percorsi operativi verificati, PWA/tastiera/tab bar stabili |
| 2 | PM01, PM16 | Prova ripristino e inventario completo backup | Ambiente isolato ricostruito; confronto schema/dati/totali; ruoli, Storage e configurazione documentati |
| 3 | PM05–07 | Salvataggio atomico Conteggio/debito/bonus/nota e modifiche coerenti | Tutto o nulla, retry idempotenti, concorrenza e vecchi client verificati |
| 4 | PM02, PM13–15 | Autorizzazioni tra utenti autenticati, credenziali e MFA | Matrice proprietario/altro utente/Admin; niente accessi impropri; SQL odierno copre solo anon |
| 5 | PM04, PM08–10 | Collaudo Cassa, unificazione code e riconciliazione sospesi | Rete lenta, retry, doppio invio, più schede e chiusure senza divergenze |
| 6 | PM12 | Conflitti aggiornamento Change | Revisioni concorrenti rilevate e risolte senza sovrascrittura silenziosa |
| 7 | PM17–22 | Collaudo aggiornamenti PWA, isolamento account e completezza offline | Riavvio/update/revoca account, dataset grandi e storage pieno verificati; Admin offline da definire |
| 8 | PM11, PM23–25 | Date restanti, parser importi, PDF, storico e cancellazioni | Casi limite italiani e totali coerenti tra app, export e database |
| 9 | PM27–29 | Lint, CI e verifiche ripetibili | Risolvere debito lint; pipeline test/build/audit con deploy controllato |
| 10 | PM30–31 | Header hosting, diagnostica e audit operativo | Protezioni compatibili con PWA/PDF; errori rintracciabili senza segreti nei log |
| 11 | PM32–34 | Bundle, refactoring componenti e prestazioni database | Misure prima/dopo e comportamento invariato; niente riscrittura indiscriminata |
| 12 | PM35–36 | Completare grafica Dipendenti e poi Admin | Confronti su dispositivi, tutte le schermate e stati, tab bar protetta |

PM20 (cache vuota valida), PM28 (dipendenze) e parte PM11/17 sono preparati/testati, non chiusi globalmente finché non verificati in produzione. PM13 è applicato soltanto per il contenimento anonimo.

## Valutazione: mattina → situazione serale

Valutazione tecnica soggettiva, non percentuale di completamento né certificazione.

| Momento | Voto complessivo | Motivazione |
|---|---|---|
| Stamattina, Admin 9.8.0 / Dipendenti 19.3.0 | 6,5/10 | Applicazione ricca e utilizzata, con debiti in offline, contabilità e manutenzione |
| Ora: SQL verificato, backup leggibile, candidate consolidate | 7/10 provvisorio | Miglioramenti circoscritti e verificabili; frontend non ancora confermato online |
| Dopo pubblicazione e collaudo riusciti | 7/10 da confermare | Non assegniamo in anticipo un voto a un deploy non verificato |

Il salto è concreto ma contenuto: protezioni Cassa/offline, accesso anonimo ridotto e Fondo cassa migliorato. Mancano ancora atomicità contabile, sicurezza completa tra utenti, recupero verificato e collaudo PWA esteso. La prova positiva dell'utente sul Fondo cassa non copre tutti questi aspetti.

Gli advisor segnalano ancora problemi da analizzare (fra cui policy e configurazioni di sicurezza). Nessuna dichiarazione di database completamente messo in sicurezza. Riferimento: https://supabase.com/docs/guides/database/database-linter

## Esito da compilare dopo il push

- [ ] Admin 9.9.0 pubblicato, commit e deploy verificati.
- [ ] Dipendenti 19.4.0 pubblicato, commit e deploy verificati.
- [ ] Login e lettura dati riusciti su entrambe.
- [ ] PWA, Fondo cassa e tab bar verificati su telefono.
- [ ] Nessun errore o sospeso inatteso; valutazione serale confermata.
