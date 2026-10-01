# Play Money Admin 18.1

Aggiornamento grafico e PDF della versione 18.

- Rimosso il testo aggiuntivo del movimento automatico AMMANCO CONTEGGI.
- Descrizioni e note dei movimenti sono mostrate sempre in MAIUSCOLO nella pagina e nel PDF, anche se salvate in minuscolo. Nella pagina usano la stessa dimensione e lo stesso peso. I dati già salvati non vengono riscritti.
- PDF completamente rinnovato in A4 verticale: font Manrope incorporato, caratteri più grandi, riepiloghi leggibili, tabelle spaziose e saldo azienda evidenziato nella pagina dei movimenti.
- Nella pagina debiti compaiono solo le righe selezionate e una colonna CIFRA, con l'importo effettivamente applicato (modificato, se presente). Nessuna colonna o dicitura originale/utilizzato/in contabilità.
- Anteprima PDF online invariata; gestione dei debiti originali e dei calcoli invariata.
- Note e nomi lunghi vengono mandati a capo; elenchi estesi proseguono su altre pagine.

## Installazione

Se è già stato eseguito lo SQL della versione 18, per la 18.1 non serve altro SQL. Aggiornare l'app e ricompilare con la propria configurazione ambiente (`npm ci`, `npm run build`). È inclusa anche la cartella dist compilata.

Se si arriva dalla 17.5, eseguire prima AGGIORNAMENTO_ADMIN_18.sql. Vedere docs/ADMIN_18.md per i dettagli della versione 18.

## Verifiche

43 test unitari, build di produzione, test del popup debiti e generazione PDF. Anteprima di due pagine ricostruita dai dati del PDF allegato e controllata visivamente. Verificato separatamente che un debito modificato riporti solo la cifra applicata e che gli elenchi lunghi proseguano su altre pagine.

L'anteprima inclusa in output/pdf usa i dati del PDF fornito dall'utente; non è una lettura del database online.
