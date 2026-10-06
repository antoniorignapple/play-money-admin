# Admin 19.7 — Movimenti Debiti

Da Vedi movimenti, ogni riga dello storico presenta Modifica ed Elimina: erogazione iniziale, nuove erogazioni e rimborsi. La modifica consente importo e data; l'eliminazione richiede conferma. Totale erogato e residuo vengono rettificati nella stessa transazione.

I rimborsi agganciati a un conteggio sono rettificati mediante l'editor esistente del conteggio, conservandone audit e calcoli. La data di questi rimborsi resta modificabile nella sezione Conteggi. Il controllo delle versioni impedisce di sovrascrivere saldi o movimenti cambiati su un altro dispositivo. Una diminuzione dell'erogato non può portare il totale sotto gli importi già rimborsati; occorre correggere prima i rimborsi. I divari storici preesistenti restano visibili, senza inventare movimenti.

La funzione SQL usa SECURITY INVOKER, le policy Admin esistenti e privilegi limitati ai soli autenticati con verifica del ruolo Admin. Nessun movimento esistente è stato modificato durante l'installazione. Le modifiche alle erogazioni sono registrate anche nell'audit privato.

Verifica: npm run check; node tests/database/debt-movements-v19.mjs (Postgres locale isolato, funzione reale di rettifica conteggi); node tests/debt-movements-ui.mjs (375/430/440 pixel, dati isolati). SQL installato e privilegi verificati sul progetto prima della pubblicazione.
