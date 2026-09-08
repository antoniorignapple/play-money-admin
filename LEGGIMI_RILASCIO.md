# Play Money Admin 10.1 — rilascio

Data: 8 settembre 2026.

## Novità v10.1

- Inserite le immagini dedicate dei 5 mobili Slot nella sezione `SLOT INSTALLATE NEL LOCALE`.
- Inserite le stesse anteprime anche nel popup `AGGIUNGI / GESTISCI SLOT`.
- Aggiunta la cartella pubblica `public/slot-machine/` con i file:
  - `queen-1.png`
  - `queen-2.png`
  - `jack.png`
  - `gaminator.png`
  - `marik-touch.png`
- Tutte le immagini sono in `PNG` con trasparenza reale.
- Il frontend mantiene la compatibilità con eventuali dati salvati come `MARIM TOUCH`, mostrandoli e gestendoli come `MARIK TOUCH`.

## Misure consigliate (già corrette)

- I 5 file sorgente sono tutti **1254 × 1254 px** in formato quadrato.
- Questa misura va bene come **master definitivo**: non serve ridimensionarli a mano.
- Nell'app vengono mostrati via CSS in piccolo, quindi la qualità resta alta.
- Dimensioni consigliate a schermo:
  - popup gestione slot: circa **56 px** di area visibile;
  - card locale: circa **78 px** di area visibile.

## SQL

Per la **10.1 non serve nessuna nuova migrazione SQL**.

Bisogna avere già applicata la SQL della **10.0** relativa a `venue_slots`.

## Pubblicazione dal PC

1. Verificare che la SQL della v10 sia già presente su Supabase.
2. Estrarre questo ZIP e copiare i file nel repository, preservando la cartella `.git`.
3. Eseguire `npm ci`.
4. Eseguire `npm run check`.
5. Controllare `git status --short`.
6. Commit consigliato: `git commit -m "Play Money Admin 10.1 - immagini slot"`.
7. Eseguire `git push origin main`.

## Nota nomi e cartella

La struttura consigliata e già applicata è:

`public/slot-machine/queen-1.png`

`public/slot-machine/queen-2.png`

`public/slot-machine/jack.png`

`public/slot-machine/gaminator.png`

`public/slot-machine/marik-touch.png`

Questa nomenclatura è stabile, semplice da ricordare e coerente con la logica già usata in `public/change-machine/`.
