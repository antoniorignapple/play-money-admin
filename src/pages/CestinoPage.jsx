import { useEffect, useMemo, useState } from 'react'
import {
  Trash2, RotateCcw, Search, Play, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Badge, EmptyState, Card,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { SkeletonRow } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import {
  daysAgoISO, todayISO, formatMoney, formatDateTime, dipendenteName, dipendenteId,
} from '../lib/helpers'

export default function CestinoPage() {
  const toast = useToast()
  const [movements, setMovements] = useState([])
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [loading, setLoading] = useState(false)

  const [dateFrom, setDateFrom] = useState(daysAgoISO(180))
  const [dateTo, setDateTo] = useState(todayISO())
  const [search, setSearch] = useState('')

  const [confirmRestore, setConfirmRestore] = useState(null)
  const [confirmDeleteOne, setConfirmDeleteOne] = useState(null)
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [movRes, venRes, dipRes] = await Promise.all([
      supabase.from('movements_cassa').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('venues').select('*'),
      supabase.from('dipendenti').select('*'),
    ])
    if (movRes.error) toast.error(`Errore: ${movRes.error.message}`)
    setMovements(movRes.data || [])
    setVenues(venRes.data || [])
    setDipendenti(dipRes.data || [])
    setLoading(false)
  }

  function operatorById(id) {
    return dipendenti.find((d) => String(dipendenteId(d)) === String(id))
  }

  function venueLabel(id) {
    const v = venues.find((x) => String(x.id) === String(id))
    if (!v) return id || '—'
    const name = String(v.name || '').trim()
    if (name.toLowerCase().startsWith(String(v.id).toLowerCase())) return name
    return `${v.id} ${name}`
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movements.filter((r) => {
      const delDate = String(r.deleted_at || '').slice(0, 10)
      if (dateFrom && delDate < dateFrom) return false
      if (dateTo && delDate > dateTo) return false
      if (!q) return true
      const text = [venueLabel(r.venue_id), dipendenteName(operatorById(r.created_by))].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [movements, dateFrom, dateTo, search, venues, dipendenti])

  async function restoreOne(id) {
    const { error } = await supabase.from('movements_cassa').update({ deleted_at: null }).eq('id', id)
    if (error) throw new Error(error.message)
    setMovements((prev) => prev.filter((x) => x.id !== id))
    setConfirmRestore(null)
    toast.success('Movimento ripristinato')
  }

  async function deleteOneForever(id) {
    const { error } = await supabase.from('movements_cassa').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setMovements((prev) => prev.filter((x) => x.id !== id))
    setConfirmDeleteOne(null)
    toast.success('Movimento eliminato definitivamente')
  }

  async function restoreAll() {
    const ids = rows.map((r) => r.id)
    const { error } = await supabase.from('movements_cassa').update({ deleted_at: null }).in('id', ids)
    if (error) throw new Error(error.message)
    setMovements((prev) => prev.filter((x) => !ids.includes(x.id)))
    setConfirmRestoreAll(false)
    toast.success(`${ids.length} movimenti ripristinati`)
  }

  async function deleteAllForever() {
    const ids = rows.map((r) => r.id)
    const { error } = await supabase.from('movements_cassa').delete().in('id', ids)
    if (error) throw new Error(error.message)
    setMovements((prev) => prev.filter((x) => !ids.includes(x.id)))
    setConfirmDeleteAll(false)
    toast.success(`${ids.length} movimenti eliminati definitivamente`)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Cestino"
        subtitle={`Lista movimenti cancellati · ${movements.length} totali`}
        actions={
          rows.length > 0 && (
            <>
              <Button icon={RotateCcw} variant="success" onClick={() => setConfirmRestoreAll(true)}>
                <span className="hidden sm:inline">Ripristina tutti</span>
                <span className="sm:hidden">Tutti</span>
              </Button>
              <Button icon={Trash2} variant="danger" onClick={() => setConfirmDeleteAll(true)}>
                <span className="hidden sm:inline">Elimina tutti</span>
                <span className="sm:hidden">Del</span>
              </Button>
            </>
          )
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3 py-2.5 md:px-4 md:py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-medium text-[var(--color-text)]">Movimenti cancellati</p>
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                I movimenti in questo cestino sono recuperabili. Usa "Elimina definitivamente" solo se sei sicuro.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <Card>
            <div className="flex flex-col gap-2 p-3 md:flex-row md:flex-wrap md:items-end md:gap-3">
              <div className="flex-1 md:flex-initial">
                <p className="mb-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">dal</p>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="md:w-44" />
              </div>
              <div className="flex-1 md:flex-initial">
                <p className="mb-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">al</p>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="md:w-44" />
              </div>
              <Button icon={Play} variant="info" onClick={loadData} className="md:self-end">Esegui</Button>
              <div className="w-full md:ml-auto md:w-72">
                <Input leftIcon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca locale o agente…" />
              </div>
            </div>
          </Card>

          {/* Table desktop / Cards mobile */}
          <Card>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1000px] text-[13px]">
                <thead className="bg-[var(--color-surface)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <Th>stato</Th>
                    <Th>data cancellazione</Th>
                    <Th>Locale</Th>
                    <Th>Utente</Th>
                    <Th className="text-right">Acconto</Th>
                    <Th className="text-right">Recupero<br/>da riportare</Th>
                    <Th className="text-right">da Riportare</Th>
                    <Th className="w-32 text-right">azioni</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}

                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={8}>
                      <EmptyState icon={Trash2} title="Cestino vuoto" description="Non ci sono movimenti cancellati in questo periodo." />
                    </td></tr>
                  )}

                  {!loading && rows.map((r) => (
                    <tr key={r.id} className="group border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-surface-hover)]">
                      <Td>
                        <Badge variant="danger" size="sm">
                          <Trash2 size={9} strokeWidth={2} />
                          cancellato
                        </Badge>
                      </Td>
                      <Td className="tabular-nums text-[var(--color-danger)] line-through">{formatDateTime(r.deleted_at)}</Td>
                      <Td className="font-medium text-[var(--color-danger)] line-through">{venueLabel(r.venue_id)}</Td>
                      <Td className="text-[var(--color-danger)] line-through">{dipendenteName(operatorById(r.created_by))}</Td>
                      <Td className="text-right font-medium tabular-nums text-[var(--color-danger)] line-through">{formatMoney(r.acconto)}</Td>
                      <Td className="text-right font-medium tabular-nums text-[var(--color-danger)] line-through">{formatMoney(r.recupero)}</Td>
                      <Td className="text-right font-medium tabular-nums text-[var(--color-danger)] line-through">{formatMoney(r.da_riportare)}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setConfirmRestore(r)}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-success)] hover:underline"
                          >
                            <RotateCcw size={11} strokeWidth={2} /> Ripristina
                          </button>
                          <span className="text-[var(--color-border)]">·</span>
                          <button
                            onClick={() => setConfirmDeleteOne(r)}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-danger)] hover:underline"
                          >
                            <Trash2 size={11} strokeWidth={2} /> Elimina
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* LISTA CARD MOBILE */}
            <div className="md:hidden divide-y divide-[var(--color-border)]">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-surface-active)]" />
                </div>
              ))}

              {!loading && rows.length === 0 && (
                <div className="py-8">
                  <EmptyState icon={Trash2} title="Cestino vuoto" description="Non ci sono movimenti cancellati in questo periodo." />
                </div>
              )}

              {!loading && rows.map((r) => (
                <div key={r.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-[var(--color-danger)] line-through truncate">{venueLabel(r.venue_id)}</p>
                      <p className="text-[12px] text-[var(--color-danger)] line-through truncate">{dipendenteName(operatorById(r.created_by))}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] tabular-nums">
                        Cancellato: {formatDateTime(r.deleted_at)}
                      </p>
                    </div>
                    <Badge variant="danger" size="sm"><Trash2 size={9} strokeWidth={2} /></Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-2">
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Acconto</p>
                      <p className="text-[13px] font-semibold tabular-nums text-[var(--color-danger)] line-through">{formatMoney(r.acconto)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Recupero</p>
                      <p className="text-[13px] font-semibold tabular-nums text-[var(--color-danger)] line-through">{formatMoney(r.recupero)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Da Riportare</p>
                      <p className="text-[13px] font-semibold tabular-nums text-[var(--color-danger)] line-through">{formatMoney(r.da_riportare)}</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="success" icon={RotateCcw} onClick={() => setConfirmRestore(r)}>Ripristina</Button>
                    <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmDeleteOne(r)}>Elimina</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageBody>

      <ConfirmDialog
        open={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        title="Ripristina movimento"
        message={confirmRestore ? `Ripristinare il movimento di ${venueLabel(confirmRestore.venue_id)}?` : ''}
        confirmLabel="Sì, ripristina"
        variant="success"
        onConfirm={() => restoreOne(confirmRestore.id)}
      />

      <ConfirmDialog
        open={!!confirmDeleteOne}
        onClose={() => setConfirmDeleteOne(null)}
        title="Elimina definitivamente"
        message={confirmDeleteOne ? `Eliminare definitivamente il movimento di ${venueLabel(confirmDeleteOne.venue_id)}? Questa azione è IRREVERSIBILE.` : ''}
        confirmLabel="Sì, elimina"
        onConfirm={() => deleteOneForever(confirmDeleteOne.id)}
      />

      <ConfirmDialog
        open={confirmRestoreAll}
        onClose={() => setConfirmRestoreAll(false)}
        title="Ripristina tutti"
        message={`Ripristinare ${rows.length} movimenti?`}
        confirmLabel="Sì, ripristina tutti"
        variant="success"
        onConfirm={restoreAll}
      />

      <ConfirmDialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title="Elimina tutti definitivamente"
        message={`Eliminare definitivamente ${rows.length} movimenti? Questa azione è IRREVERSIBILE.`}
        confirmLabel="Sì, elimina tutti"
        onConfirm={deleteAllForever}
      />
    </PageLayout>
  )
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${className}`}>{children}</th>
}
function Td({ children, className = '' }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}
