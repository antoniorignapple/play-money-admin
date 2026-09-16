# Play Money Admin 13.0

Aggiornamento completo della versione 12.1 allegata.

## Installazione — prima il database, poi l’app
1. Nel SQL Editor dello stesso progetto Supabase già usato dall’app, eseguire tutto il file `supabase/migrations/20260916175917_admin_v13_debiti_erogazioni.sql`.
2. Attendere l’esito positivo. Lo script è transazionale e rieseguibile; non cancella debiti o rimborsi esistenti.
3. Pubblicare il contenuto della cartella `dist` nell’hosting Admin esistente, con la procedura abituale.
4. Riaprire l’app e accettare l’aggiornamento alla 13.0 quando proposto.

Il pacchetto contiene i sorgenti e `dist` già compilata. Per ricompilare: `npm ci` e `npm run build`.
Non è stata effettuata alcuna pubblicazione né applicata la migrazione al database online.

## Debiti e Bonus
- Interfaccia avorio e oro, saldo in evidenza, ricerca locale, schede e pulsanti coerenti.
- In Modifica: importo iniziale in sola lettura, residuo sotto e Nuova erogazione con data a fianco.
- Ogni aggiunta viene salvata separatamente nello storico ma concorre al totale e al residuo.
- Tabella Data / Erogato / Rimborsato, ordinata dalla data più vecchia.
- Azioni direttamente sulla scheda: Modifica, Decurtazione, PDF, Elimina.
- PDF per locale in una nuova scheda: nessun download automatico; intestazione ripetuta su più pagine, totali e residuo finale.
- Rimborsi con data, saldo aggiornato, blocco degli importi superiori al residuo e dei clic ripetuti.
- Rimborsa tutto apre la decurtazione precompilata: l’estinzione corrisponde a un rimborso effettivamente registrato.
- La modifica delle condizioni e l’aggiunta dell’erogazione avvengono in una sola transazione. Controllo di conflitto quando il saldo cambia su un altro dispositivo.
- Locale non riassegnabile durante la modifica per conservare la coerenza dello storico.
- Euro interi come nell’app originaria; i decimali non vengono troncati silenziosamente nelle nuove operazioni debito.

## Cosa cambia nel database
- `debiti.importo_originario`: fotografia dell’importo iniziale disponibile al momento dell’aggiornamento.
- `debiti.data_erogazione`: data iniziale, ricavata per i vecchi record dalla creazione in Europe/Rome.
- `debiti.importo_iniziale` mantiene il significato tecnico di totale erogato: le altre sezioni e le app precedenti continuano a leggerlo senza cambiare contratto.
- Nuova tabella `debiti_erogazioni`, collegata al debito con cancellazione a cascata e accesso riservato agli Admin mediante RLS.
- Nuove funzioni `admin_v13_save_debito` e `admin_v13_rimborso_debito`, con autorizzazione Admin, controllo del saldo e operazioni atomiche. Rispettano le policy RLS già esistenti.
- Le decurtazioni da conteggio continuano a usare `debiti_movimenti`; la nuova tabella separata evita interferenze con quel flusso.

Lo ZIP originale non include la definizione completa delle tabelle debiti installate sul progetto online. Le funzioni sono state provate in un database locale con uno schema compatibile con i campi usati dalla 12.1, non contro il database di produzione.

### Storico pregresso
L’app non può ricostruire erogazioni o rimborsi che la vecchia versione non aveva registrato. Se un importo iniziale era già stato sovrascritto, viene conservato quello attualmente presente. In caso di differenza tra movimenti e residuo, la tabella e il PDF segnalano l’anomalia senza inventare movimenti. Anche le vecchie posizioni segnate estinte con residuo positivo vengono evidenziate.

## Automezzi
- Range Dal / Al sotto il riepilogo, con pulsante Mese corrente.
- Ogni ingresso nella sezione riparte dal primo all’ultimo giorno del mese corrente, secondo Europe/Rome; il filtro non viene salvato.
- Utilizzi, rifornimenti, ultima data e storico seguono lo stesso range. Mezzi disponibili indica tutti i mezzi attivi.
- Accanto alla targa sono mostrati i chilometri percorsi nel periodo.
- Il calcolo usa le differenze tra contachilometri, inclusa l’ultima lettura valida precedente al periodo. Non somma le letture assolute.
- Una lettura precedente distante dall’inizio del range può includere tragitti antecedenti non distinguibili dai dati disponibili: i km sono quelli ricavabili dalle registrazioni, non una misura GPS esatta ai confini del periodo.
- Letture mancanti o base assente producono un dato parziale; letture in diminuzione producono un avviso senza mostrare chilometri negativi o inventati.
- Nessun utilizzo: 0 km. Una sola lettura senza base: km non determinabili.
- I rifornimenti generali si riferiscono ai mezzi attivi del parco, in coerenza con il contatore utilizzi.

## Verifiche
- 22 test automatici superati: calcoli, date, storico, range, letture mancanti e paginazione.
- Test SQL locale superato: migrazione ripetibile, erogazioni, rimborsi, estinzione e riapertura, controlli sugli importi, rollback, conflitti, autorizzazioni e cancellazione collegata.
- Build di produzione riuscita; controlli ESLint sulle due pagine aggiornate e sui nuovi helper senza errori.
- PDF breve e multipagina generati; layout PDF renderizzato e ispezionato.
- L’anteprima grafica dell’app nel browser non è stata verificata: il browser della sessione blocca l’accesso alla copia locale. La struttura responsive è implementata ma richiede una verifica nell’ambiente di installazione.
- Le vecchie immagini nella cartella `docs` appartengono alla versione 11.

Comandi: `npm test`, `npm run test:database:v13`, `npm run test:database`, `npm run build`.
