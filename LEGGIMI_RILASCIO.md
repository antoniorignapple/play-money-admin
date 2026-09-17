# Play Money Admin 13.3 — Chilometri attuali

## Novità
Nei riquadri del Parco Automezzi, accanto alla targa, compare «Km attuali» sopra «Km percorsi».
Il valore è l’ultima lettura positiva registrata per quel mezzo, indipendentemente dal periodo di consultazione.
Tra parentesi compare «inseriti oggi», «inseriti ieri» o «inseriti il GG/MM/AAAA», secondo la data operativa della registrazione e il calendario italiano.
Se oggi non ci sono chilometri validi, rimane l’ultima lettura disponibile, anche precedente a ieri. Zeri, campi vuoti e valori non validi sono ignorati. Le date operative future sono escluse.
A parità di giorno si usa la registrazione più recente per data di creazione. Senza letture valide compare «— (nessun inserimento)».
I valori vengono caricati all’apertura della pagina, con il pulsante Aggiorna e dopo la registrazione di un utilizzo.

## Installazione
Dalla 13.2: pubblicare il contenuto di `dist` e accettare l’aggiornamento dell’app.
Nessun nuovo SQL richiesto. Il calcolo dei km percorsi nel periodo resta quello della 13.2.
Dalla 12.1: eseguire prima la migrazione della 13.0, come indicato in `LEGGIMI_RILASCIO_13.0_ARCHIVIO.md`.

## Verifiche
25 test automatici esistenti superati. Verificati anche: lettura odierna, ieri, data meno recente, zeri e campi vuoti, più registrazioni nello stesso giorno, esclusione date future e cambio anno.
Sorgenti e build di produzione inclusi. Nessuna pubblicazione online eseguita.
Comandi: `npm ci`, `npm test`, `npm run build`.
