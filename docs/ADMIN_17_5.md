# Play Money Admin 17.5

Il nuovo pulsante PDF in Locali, accanto al +, apre il report in una nuova scheda senza download automatico.

- Report A4 compatto di tutti i locali con almeno un Change, indipendente dalla ricerca corrente.
- Sigla, nome, città e totali per locale; immagine, nome, livello attuale, fondo cassa e ultimo aggiornamento per Change.
- Riepilogo con numero locali, numero Change, totale livelli e totale fondi.
- Dati riletti al clic, paginazione completa, errori segnalati senza PDF parziali.
- Date nel fuso Europe/Rome. Importi mancanti indicati e segnalati nei totali.
- Immagini riutilizzate per modello; supporto Hammer anche nella schermata Locali.
- Nessuna migrazione SQL richiesta.

Verifica: suite Node, build produzione e controllo visivo di un PDF di prova con 3 locali e 15 Change su 3 pagine. Dati di prova, nessuna verifica su sessione autenticata del database reale.
