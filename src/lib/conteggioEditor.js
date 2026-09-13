export const MONEY_FIELDS = [
  ["esattore", "Esattore"],
  ["acconti", "Acconti"],
  ["carta", "Carta"],
  ["monete", "Monete"],
  ["riporto", "Da riportare residuo"],
  ["uso_cassa", "Uso cassa"],
  ["debito", "Debito contanti"],
  ["assegno", "Assegno"],
  ["debito_virt", "Debito virtuale"],
  ["bonus", "Bonus"],
  ["rp_day2", "Recupero giorno 2"],
  ["rp_day3", "Recupero giorno 3"],
  ["rp_day4", "Recupero giorno 4"],
];
export function money(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!text) return 0;
  // Italian grouping only when there is a comma or complete groups of 3 digits.
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(text)
      ? text.replace(/\./g, "")
      : text;
  const n = Number(normalized);
  if (
    !Number.isFinite(n) ||
    !/^-?\d+(\.\d+)?$/.test(normalized) ||
    !Number.isSafeInteger(n)
  )
    throw new Error("Usa importi in euro interi, senza centesimi.");
  if (Math.abs(n) > 999999999) throw new Error("Importo troppo elevato.");
  return n;
}
export function conteggioTotal(row) {
  return (
    ["acconti", "carta", "monete", "riporto", "assegno"].reduce(
      (s, key) => s + money(row[key]),
      0,
    ) -
    money(row.esattore) -
    money(row.uso_cassa) -
    money(row.debito)
  );
}
export function toDraft(row) {
  return {
    ...row,
    ...Object.fromEntries(
      MONEY_FIELDS.map(([key]) => [key, String(row[key] ?? 0)]),
    ),
    executed_by: row.executed_by || row.user_id || "",
    conteggio_date: String(row.conteggio_date || "").slice(0, 10),
    locked: !!row.locked,
  };
}
export function editorPayload(draft) {
  const values = Object.fromEntries(
    MONEY_FIELDS.map(([key]) => [key, money(draft[key])]),
  );
  for (const key of [
    "riporto",
    "rp_day2",
    "rp_day3",
    "rp_day4",
    "debito",
    "bonus",
  ]) {
    if (values[key] < 0)
      throw new Error(
        "Riporti, recuperi, debito e bonus non possono essere negativi.",
      );
  }
  if (
    !draft.venue_id ||
    !draft.giro_id ||
    !draft.executed_by ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.conteggio_date)
  )
    throw new Error("Completa locale, giro, esecutore e data.");
  const recorded = draft.created_at ? new Date(draft.created_at) : null;
  if (recorded && !Number.isFinite(recorded.getTime()))
    throw new Error("Data e ora di registrazione non valide.");
  return {
    ...values,
    ...(recorded ? { created_at: recorded.toISOString() } : {}),
    venue_id: draft.venue_id,
    giro_id: draft.giro_id,
    executed_by: draft.executed_by,
    conteggio_date: draft.conteggio_date,
    locked: !!draft.locked,
  };
}
export function changeRecovery(draft, key, value) {
  const delta = money(value) - money(draft[key]);
  return {
    ...draft,
    [key]: value,
    carta: String(money(draft.carta) + delta),
    riporto: String(money(draft.riporto) - delta),
  };
}

export function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
