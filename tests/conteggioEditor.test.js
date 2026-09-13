import test from "node:test";
import assert from "node:assert/strict";
import {
  money,
  conteggioTotal,
  toDraft,
  editorPayload,
  changeRecovery,
} from "../src/lib/conteggioEditor.js";
const base = {
  venue_id: "K01",
  giro_id: "giro",
  executed_by: "dipendente",
  conteggio_date: "2026-09-10",
  esattore: 1000,
  acconti: 500,
  carta: 300,
  monete: 100,
  riporto: 100,
  uso_cassa: 0,
  debito: 0,
};
test("Formula reale Dipendenti, assegno incluso; bonus e debito virtuale informativi", () => {
  assert.equal(
    conteggioTotal({
      ...base,
      assegno: 20,
      debito: 10,
      uso_cassa: 5,
      bonus: 999,
      debito_virt: 999,
    }),
    5,
  );
});
test("Importi italiani e valori non validi", () => {
  assert.equal(money("12.345"), 12345);
  assert.equal(money("12.345,00"), 12345);
  assert.equal(money("-20"), -20);
  for (const v of ["12,50", "ciao", "Infinity", "1e5", "1.2.3"])
    assert.throws(() => money(v));
});
test("Recuperi trasferiscono carta/riporto preservando totale e originale", () => {
  const d = toDraft(base);
  const n = changeRecovery(d, "rp_day2", "30");
  assert.equal(n.carta, "330");
  assert.equal(n.riporto, "70");
  assert.equal(conteggioTotal(n), conteggioTotal(d));
  assert.equal(money(n.riporto) + money(n.rp_day2), 100);
  const back = changeRecovery(n, "rp_day2", "10");
  assert.equal(back.riporto, "90");
});
test("Recuperi superiori al residuo non salvabili", () => {
  assert.throws(
    () => editorPayload(changeRecovery(toDraft(base), "rp_day3", "101")),
    /negativi/,
  );
});
test("Cambio esecutore non altera giro, payload esclude totale e campi tecnici", () => {
  const p = editorPayload({
    ...toDraft(base),
    executed_by: "altro",
    user_id: "attaccante",
    totale_finale: 9999,
  });
  assert.equal(p.giro_id, "giro");
  assert.equal(p.executed_by, "altro");
  assert.equal(p.user_id, undefined);
  assert.equal(p.totale_finale, undefined);
});
