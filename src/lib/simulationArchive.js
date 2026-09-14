// Fetch every page, including when the server imposes a smaller page size.
export async function loadSimulationArchive(client) {
  const rows = [];
  while (true) {
    const { data, error } = await client.from("simulazioni").select("*")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(rows.length, rows.length + 499);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

export function filterSimulations(rows, from, to, employee) {
  const normalize = (value) => String(value || "").trim().toLocaleLowerCase("it-IT");
  return rows.filter((row) => {
    const date = String(row.work_date || row.created_at || "").slice(0, 10);
    if ((from || to) && !date) return false;
    return (!from || date >= from) && (!to || date <= to) &&
      (employee === "all" || normalize(row.operator_name) === normalize(employee));
  });
}
