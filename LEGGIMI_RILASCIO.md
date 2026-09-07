# Play Money Admin 10.0 — rilascio

Data: 7 settembre 2026.

## Novità v10.0

- La sezione `PARCO MACCHINE / CHANGE DEL LOCALE` diventa `CHANGE INSTALLATI NEL LOCALE`.
- Nuova sezione `SLOT INSTALLATE NEL LOCALE`, subito prima dell'Area Pericolosa.
- Modelli disponibili: `QUEEN 1`, `QUEEN 2`, `JACK`, `GAMINATOR`, `MARIM TOUCH`.
- Un solo popup permette di impostare tutte le quantità con pulsanti `- / quantità / +`.
- I modelli con quantità `0` non vengono mostrati nella scheda del locale.
- Se non ci sono Slot compare `AGGIUNGI SLOT`; se sono presenti compare `GESTISCI SLOT`.
- I popup premium della pagina Locali non si chiudono più cliccando sullo sfondo.
- Nei popup premium si esce senza salvare soltanto tramite la `X`; il salvataggio chiude dopo esito positivo.
- Salvataggio Slot atomico tramite RPC Supabase protetta da controllo Admin.
- La cancellazione definitiva del locale include anche le Slot installate.

## Prima del deploy — SQL OBBLIGATORIO

Nel SQL Editor del progetto Supabase eseguire **una sola volta**:

`migrations/14_venue_slots.sql`

È presente anche la stessa migrazione in:

`supabase/migrations_manual/2026-09-07_v10_venue_slots.sql`

La migrazione crea la tabella `venue_slots`, la policy di lettura autenticata, la RPC Admin `set_venue_slots` e aggiorna le RPC di cancellazione definitiva del locale.

## Pubblicazione dal PC

1. Fare una copia della cartella attuale e controllare `git status --short`.
2. Eseguire lo SQL v10 indicato sopra su Supabase.
3. Estrarre questo ZIP e copiare i file nel repository, preservando la cartella `.git`.
4. Eseguire `npm ci`.
5. Eseguire `npm run check`.
6. Controllare `git status --short` e `git diff --stat`.
7. Eseguire `git add .` e poi `git diff --cached --check`.
8. Commit consigliato: `git commit -m "Play Money Admin 10.0 - Slot installate nei locali"`.
9. Eseguire `git push origin main`.
10. Dopo il deploy verificare un locale di prova: aggiunta Slot, modifica quantità, rimozione portando a 0, riapertura popup e persistenza dati.

## Collaudo popup

Verificare in particolare:

- `MODIFICA CHANGE`: clic sullo sfondo = nessuna chiusura.
- `NUOVO CHANGE`: clic sullo sfondo = nessuna chiusura.
- `MODIFICA LOCALE` / `NUOVO LOCALE`: clic sullo sfondo = nessuna chiusura.
- `SLOT INSTALLATE NEL LOCALE`: clic sullo sfondo = nessuna chiusura.
- `X`: chiude senza salvare.
- `SALVA`: salva e chiude soltanto dopo risposta positiva.

## Nota futura

La struttura della sezione Slot è già pronta per una successiva evoluzione grafica con immagini/foto dei singoli mobili senza dover cambiare il modello dati.
