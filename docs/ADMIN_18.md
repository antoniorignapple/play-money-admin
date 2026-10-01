# Play Money Admin 18

## Attivazione

1. Nel SQL Editor di Supabase eseguire il file `AGGIORNAMENTO_ADMIN_18.sql` presente nella radice dello ZIP. È la stessa migrazione di `supabase/migrations/20261001161638_admin_v18_contabilita_conteggi.sql`: eseguire una delle due copie.
2. Aggiornare l’app con i sorgenti della versione 18 e la propria configurazione ambiente. Per compilare: `npm ci` e `npm run build`. La cartella `dist` inclusa è già compilata; per un deploy personale si raccomanda la compilazione con la propria configurazione.
3. Aprire Contabilità Conteggi, selezionare il periodo e premere Aggiorna.

Lo SQL aggiunge `amount_override` alla tabella delle selezioni contabili e una funzione che salva la selezione in un’unica transazione. Non aggiorna i debiti originali, i conteggi, gli acconti o i movimenti Cassa. Nessuna migrazione è stata eseguita sul database online durante la preparazione dello ZIP.

## Movimento automatico AMMANCO CONTEGGI

La cifra è il valore assoluto del saldo finale negativo del periodo: `max(0, -saldo_finale_conteggi)`. Si usa lo stesso criterio del riepilogo Conteggi: totali finali senza Cassa teorica, rettifiche Esattore dei giri e depositi reali del proprietario del giro. Il sostituto che esegue un conteggio non cambia il proprietario del deposito. Non si sommano separatamente tutti i valori negativi ignorando quelli positivi.

La voce si ricalcola all’apertura o all’aggiornamento della contabilità, appare anche con importo zero, non ha matita/elimina e non crea righe nel database. Entra nel totale movimenti e nel saldo azienda, oltre che nel PDF. Un saldo finale positivo non genera un ammanco.

Le righe manuali con descrizione esattamente `AMMANCO CONTEGGI` (senza differenza tra maiuscole e minuscole) restano nel database ma vengono mostrate con importo contabile zero e nota con il vecchio importo: la voce automatica le sostituisce senza duplicare la sottrazione. Le altre righe manuali e i trasferimenti continuano a funzionare come prima. Se esistono ammanchi manuali con descrizioni diverse, verificarli per evitare doppie contabilizzazioni.

## Selezione e modifica debiti

- Aprire Seleziona debiti: ogni riga mostra locale, data, operaio e importo originale.
- Spuntare il debito da includere e inserire l’importo da applicare solo in questa contabilità. Sono ammessi zero e centesimi, con virgola decimale; gli importi negativi non sono ammessi.
- Ripristina rimette l’importo originale; non cambia la selezione.
- Il totale nel popup considera anche le righe selezionate nascoste dal filtro di ricerca.
- Fatto salva selezioni e importi per il periodo. Annulla, la X o Escape scartano la bozza.
- Le cifre modificate non vengono scritte in `conteggi_tool`. Conteggi, Debiti e Bonus e tutte le altre sezioni mantengono il debito originale.
- Un debito deselezionato è escluso dal totale e la sua precedente rettifica viene rimossa al salvataggio; se selezionato di nuovo, riparte dall’importo originale.
- I vecchi archivi basati solo su snapshot, senza conteggi originali, conservano la limitazione preesistente: selezioni/importi non modificabili. I periodi chiusi che conservano i conteggi originali sono modificabili.

Il riquadro Recuperi acconto aggio usa esclusivamente i debiti selezionati con gli importi applicati; lo stesso totale aggiorna Totale globale, Saldo azienda e residuo contabile nella Cassa Ufficio. La Cassa riceve il residuo contabile aggiornato, non una modifica dei debiti originali.

## PDF

Apri PDF continua ad aprire l’anteprima online, senza download automatico. Riporta movimento automatico, riepiloghi e saldo azienda. Una pagina dedicata elenca solo i debiti selezionati, confrontando importo originale e importo applicato alla contabilità.

## Verifiche

- 41 test unitari superati, inclusi ammanco netto, rettifiche, sostituto, importi modificati, zero, centesimi e vecchie righe manuali.
- Test SQL locale PostgreSQL/PGlite: migrazione ripetibile, transazione, isolamento periodo, originali invariati, controllo importi, ripristino, permessi admin e blocco dipendente/anon.
- Test UI versione 18: selezione, modifica, salvataggio, riapertura, ripristino, deselezione, validazione e protezione movimento automatico.
- Test UI preesistente: Cassa, navigazione periodi, movimento manuale e saldo sidebar.
- Build di produzione completata. PDF dimostrativo generato e verificato.

Le anteprime HTML incluse usano esclusivamente dati dimostrativi; non rappresentano i saldi reali dell’azienda.
