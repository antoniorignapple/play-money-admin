// Campi espliciti: credenziali e ruoli di accesso restano nella gestione account.
export const ADMIN_ENTITIES = [
  {
    table: "movements_cassa",
    title: "Cassa",
    fields: [
      ["work_date", "Data", "date"],
      ["venue_id", "Locale", "venues"],
      ["created_by", "Dipendente", "employees"],
      ["acconto", "Acconto", "number"],
      ["recupero", "Recupero", "number"],
      ["da_riportare", "Da riportare", "number"],
      ["note", "Note", "text"],
    ],
  },
  {
    table: "simulazioni",
    title: "Simulazioni",
    fields: [
      ["work_date", "Data", "date"],
      ["venue_id", "Locale", "venues"],
      ["user_id", "Dipendente", "employees"],
      ["utile_lordo", "Utile lordo", "number"],
      ["acconti", "Acconti", "number"],
      ["carta", "Carta", "number"],
      ["monete", "Monete", "number"],
      ["da_riportare", "Da riportare", "number"],
      ["da_riportare_sospeso", "Da riportare sospeso", "number"],
      ["note", "Note", "text"],
    ],
  },
  {
    table: "dipendenti",
    title: "Dipendenti",
    fields: [
      ["full_name", "Nome completo", "text"],
      ["active", "Attivo", "boolean"],
    ],
  },
  {
    table: "venues",
    title: "Locali",
    fields: [
      ["name", "Nome", "text"],
      ["city", "Città", "text"],
      ["code", "Codice", "text"],
      ["active", "Attivo", "boolean"],
    ],
  },
  {
    table: "machines",
    title: "Change",
    fields: [
      ["name", "Nome", "text"],
      ["fondo", "Fondo", "number"],
      ["level", "Livello attuale", "number"],
      ["active", "Attivo", "boolean"],
    ],
  },
  {
    table: "giri",
    title: "Giri",
    fields: [
      ["name", "Nome giro", "text"],
      ["default_employee_id", "Dipendente titolare", "employeeIds"],
      ["sort_order", "Ordine", "number"],
      ["active", "Attivo", "boolean"],
    ],
  },
  {
    table: "automezzi",
    title: "Automezzi",
    fields: [
      ["name", "Nome", "text"],
      ["plate", "Targa", "text"],
      ["active", "Attivo", "boolean"],
    ],
  },
  {
    table: "fondo_cassa_giornaliero",
    title: "Utilizzi automezzi",
    fields: [
      ["work_date", "Data", "date"],
      ["created_by", "Dipendente", "employees"],
      ["vehicle_id", "Automezzo", "vehicles"],
      ["km", "Chilometri", "text"],
      ["rifornimento", "Rifornimento", "number"],
    ],
  },
];
export function entityTitle(row) {
  return (
    row.name ||
    row.full_name ||
    row.venue_name ||
    row.vehicle_name_snapshot ||
    row.venue_id ||
    row.work_date ||
    "Registrazione"
  );
}
