let writes = 0;
let updateFrozen = false;
export const activeWriteCount = () => writes;
export function freezeWritesForUpdate() {
  if (writes) throw new Error('Operazione ancora in corso');
  updateFrozen = true;
  return () => { updateFrozen = false; };
}
export async function trackWrite(fetcher, input, init) {
  const method = String(init?.method || input?.method || 'GET').toUpperCase();
  const writing = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (writing && updateFrozen) throw new Error('Aggiornamento in corso: attendi la riapertura dell’app');
  if (writing) writes++;
  try { return await fetcher(input, init); }
  finally { if (writing) writes--; }
}
export function updateBlockReason({ outbox = [], storage = null, activeWrites = writes } = {}) {
  if (activeWrites) return 'Attendi il completamento delle operazioni in corso.';
  if (outbox.some(row => row.status !== 'synced')) return 'Prima sincronizza i sospesi di tutti gli account presenti sul dispositivo.';
  if (storage) {
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== 'pm_movimenti_v1' && !key?.startsWith('pm_movimenti_v1_')) continue;
        const rows = JSON.parse(storage.getItem(key));
        if (!Array.isArray(rows)) return 'Impossibile verificare i movimenti locali: aggiornamento rimandato.';
        const unresolved = rows.some(row => {
          if (!['pending', 'syncing'].includes(row?.status)) return false;
          if (key === 'pm_movimenti_v1' && row.created_by) {
            const scoped = JSON.parse(storage.getItem(`pm_movimenti_v1_${row.created_by}`) || '[]');
            if (Array.isArray(scoped) && scoped.some(current => current.id === row.id && current.status === 'saved')) return false;
          }
          return true;
        });
        if (unresolved) return 'Prima sincronizza i movimenti Cassa sospesi.';
      }
    } catch { return 'Impossibile verificare i dati locali: aggiornamento rimandato.'; }
  }
  return '';
}
