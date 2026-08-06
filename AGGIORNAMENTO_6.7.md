# Play Money Admin 6.7

## Ordine di installazione obbligatorio

1. Aprire Supabase SQL Editor.
2. Eseguire integralmente `migrations/05_finalizzazione_periodo.sql`.
3. Verificare che la query termini senza errori.
4. Pubblicare Play Money Admin 6.7.
5. Pubblicare Play Money Dipendenti 13.7.

Non usare `FINALIZZA` prima di avere applicato la migrazione SQL.

## Novità principali

- `AGGIORNA` è ora esterno al menu dei tre puntini.
- Il menu contiene soltanto `ARCHIVIO` e `FINALIZZA`.
- Eliminati dall'interfaccia `ELIMINA`, `NUOVO` e la vecchia chiusura.
- Finalizzazione guidata con controllo Da Riportare, avviso facoltativo dei locali non conteggiati, conferma archivio e creazione del nuovo periodo.
- Trasferimento atomico dei Da Riportare con origine `chiusura_conteggio`.
- Protezione contro doppia finalizzazione e dati modificati durante la conferma.
- Recupero dei depositi reali D01-D05 nello storico.

