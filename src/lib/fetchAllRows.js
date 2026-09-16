// Supabase limits each response; do not silently truncate long histories.
export async function fetchAllRows(makeQuery) {
  const rows = [];
  const size = 500;
  while (true) {
    const { data, error } = await makeQuery().range(rows.length, rows.length + size - 1);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}
