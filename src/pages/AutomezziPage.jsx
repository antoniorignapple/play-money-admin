import { useEffect, useMemo, useState } from 'react'
import {
  Calendar, User, Car, Mail, Plus, Save, RotateCcw, RefreshCw, Pencil, Check, X, Search,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Select, Badge, EmptyState, Card, Field, Modal, FilterBanner,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { SkeletonRow } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import {
  todayISO, formatMoney, formatEuro, dipendenteName, dipendenteId, normNumber,
} from '../lib/helpers'

export default function AutomezziPage() {
  const toast = useToast()
  const [records, setRecords] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [loading, setLoading] = useState(true)

  // Default: oggi → oggi (giornata corrente)
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [targa, setTarga] = useState('')
  const [emailFilter, setEmailFilter] = useState('')

  const [pendingDeletes, setPendingDeletes] = useState(new Set())
  const [confirmSave, setConfirmSave] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  const [newOpen, setNewOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [newRow, setNewRow] = useState({
    work_date: todayISO(), created_by: '',
    mezzo: '', km: '', rifornimento: '', note: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [recRes, dipRes] = await Promise.all([
      supabase.from('fondo_cassa_giornaliero').select('*').order('work_date', { ascending: false }),
      supabase.from('dipendenti').select('*'),
    ])
    if (recRes.error) toast.error(`Errore: ${recRes.error.message}`)
    setRecords(recRes.data || [])
    setDipendenti(dipRes.data || [])
    setPendingDeletes(new Set())
    setLoading(false)
  }

  function operatorById(id) {
    return dipendenti.find((d) => String(dipendenteId(d)) === String(id))
  }

  const rows = useMemo(() => {
    const nome_q = nome.trim().toLowerCase()
    const cog_q = cognome.trim().toLowerCase()
    const targa_q = targa.trim().toLowerCase()
    const mail_q = emailFilter.trim().toLowerCase()
    return records.filter((r) => {
      if (dateFrom && r.work_date < dateFrom) return false
      if (dateTo && r.work_date > dateTo) return false
      const dip = operatorById(r.created_by)
      const fullName = dipendenteName(dip).toLowerCase()
      if (nome_q && !fullName.includes(nome_q)) return false
      if (cog_q && !fullName.includes(cog_q)) return false
      if (targa_q && !String(r.mezzo || '').toLowerCase().includes(targa_q)) return false
      if (mail_q && !String(dip?.email || '').toLowerCase().includes(mail_q)) return false
      return true
    })
  }, [records, dateFrom, dateTo, nome, cognome, targa, emailFilter, dipendenti])

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.rifornimento += Number(r.rifornimento || 0)
    return acc
  }, { rifornimento: 0 }), [rows])

  function toggleRow(id) {
    setPendingDeletes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function cancelPending() {
    setPendingDeletes(new Set())
  }

  async function confirmDeletePending() {
    const ids = Array.from(pendingDeletes)
    const { error } = await supabase.from('fondo_cassa_giornaliero').delete().in('id', ids)
    if (error) throw new Error(error.message)
    setRecords((prev) => prev.filter((x) => !pendingDeletes.has(x.id)))
    setPendingDeletes(new Set())
    setConfirmSave(false)
    toast.success(`${ids.length} record eliminati`)
  }

  function startEdit(r) {
    setEditingId(r.id)
    setEditDraft({
      mezzo: r.mezzo || '', km: r.km || '', rifornimento: r.rifornimento || 0, note: r.note || '',
    })
  }
  function cancelEdit() { setEditingId(null); setEditDraft(null) }
  async function saveEdit(r) {
    const { data, error } = await supabase.from('fondo_cassa_giornaliero').update({
      mezzo: editDraft.mezzo, km: editDraft.km,
      rifornimento: normNumber(editDraft.rifornimento), note: editDraft.note || null,
    }).eq('id', r.id).select('*').single()
    if (error) { toast.error(`Errore: ${error.message}`); return }
    setRecords((prev) => prev.map((x) => x.id === r.id ? data : x))
    cancelEdit()
    toast.success('Record aggiornato')
  }

  async function createRecord() {
    if (!newRow.work_date || !newRow.created_by) {
      toast.warning('Data e agente sono obbligatori'); return
    }
    const { error } = await supabase.from('fondo_cassa_giornaliero').insert({
      work_date: newRow.work_date, created_by: newRow.created_by,
      mezzo: (newRow.mezzo || '').toUpperCase() || null,
      km: newRow.km || null,
      rifornimento: normNumber(newRow.rifornimento) || null,
      note: newRow.note || null,
    })
    if (error) { toast.error(`Errore: ${error.message}`); return }
    setNewOpen(false)
    setNewRow({ work_date: todayISO(), created_by: '', mezzo: '', km: '', rifornimento: '', note: '' })
    toast.success('Record creato')
    await loadData()
  }

  const hasPending = pendingDeletes.size > 0

  const filterBanners = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <FilterBanner tone="info" icon={Calendar} label="Ricerca per data">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </FilterBanner>

      <FilterBanner tone="warning" icon={User} label="Agente">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
        <Input value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Cognome" />
      </FilterBanner>

      <FilterBanner tone="success" icon={Car} label="Targa">
        <Input value={targa} onChange={(e) => setTarga(e.target.value.toUpperCase())} placeholder="Targa" />
      </FilterBanner>

      <FilterBanner tone="danger" icon={Mail} label="e-mail">
        <Input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="cerca per email" />
      </FilterBanner>
    </div>
  )

  return (
    <PageLayout>
      <PageHeader
        title="AUTOMEZZI"
        subtitle={loading ? 'Caricamento…' : `${rows.length} record · ${formatEuro(totals.rifornimento)} rifornimento`}
        actions={
          <>
            <Button variant="secondary" icon={Search} onClick={() => setFiltersOpen(true)} className="md:hidden">
              Filtri
            </Button>
            <IconButton icon={RefreshCw} onClick={loadData} title="Aggiorna" />
            <Button icon={Plus} variant="primary" onClick={() => setNewOpen(true)}>
              <span className="hidden md:inline">Nuovo</span>
            </Button>
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          <div className="hidden md:block">
            {filterBanners}
          </div>

          <Card>
            <div className="flex flex-col gap-2 border-b border-[var(--color-border)] px-3 py-2 md:flex-row md:items-center md:justify-between">
              <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                Lista automezzi <span className="text-[var(--color-text-muted)]">({rows.length} record)</span>
              </p>
              {hasPending && (
                <div className="flex items-center gap-2">
                  <Badge variant="danger" size="sm">{pendingDeletes.size} da cancellare</Badge>
                  <Button size="sm" icon={RotateCcw} variant="ghost" onClick={cancelPending} className="flex-1 md:flex-initial">Annulla</Button>
                  <Button size="sm" icon={Save} variant="success" onClick={() => setConfirmSave(true)} className="flex-1 md:flex-initial">Salva</Button>
                </div>
              )}
            </div>

            {/* TABELLA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1000px] text-[13px]">
                <thead className="bg-[var(--color-surface)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="w-10 px-4 py-2.5"></th>
                    <Th>stato</Th>
                    <Th>Agente</Th>
                    <Th>Data</Th>
                    <Th>Targa</Th>
                    <Th className="text-right">Km</Th>
                    <Th className="text-right">Rifornimento</Th>
                    <Th>Note</Th>
                    <Th className="w-24 text-right">azioni</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}

                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={9}>
                      <EmptyState icon={Car} title="Nessun record" description="Modifica i filtri o crea un nuovo record." />
                    </td></tr>
                  )}

                  {!loading && rows.map((r) => {
                    const pending = pendingDeletes.has(r.id)
                    const editing = editingId === r.id
                    return (
                      <tr key={r.id} className={`group border-b border-[var(--color-border)] last:border-0 transition-colors ${pending ? 'bg-[var(--color-danger-soft)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox" checked={pending} disabled={editing}
                            onChange={() => toggleRow(r.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-danger)]"
                          />
                        </td>
                        <Td>
                          <Badge variant={pending ? 'danger' : 'success'} size="sm">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${pending ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'}`} />
                            {pending ? 'cancellato' : 'OK'}
                          </Badge>
                        </Td>
                        <Td className={`font-medium ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                          {dipendenteName(operatorById(r.created_by))}
                        </Td>
                        <Td className="tabular-nums text-[var(--color-text-secondary)]">{r.work_date}</Td>
                        <Td className="font-mono tabular-nums text-[var(--color-text)]">
                          {editing ? (
                            <Input value={editDraft.mezzo} onChange={(e) => setEditDraft((p) => ({ ...p, mezzo: e.target.value.toUpperCase() }))} className="h-7 text-[12px]" />
                          ) : (r.mezzo || '—')}
                        </Td>
                        <Td className="text-right tabular-nums text-[var(--color-text-secondary)]">
                          {editing ? (
                            <Input value={editDraft.km} onChange={(e) => setEditDraft((p) => ({ ...p, km: e.target.value }))} className="h-7 text-[12px] text-right" />
                          ) : (r.km || '—')}
                        </Td>
                        <Td className="text-right font-medium tabular-nums">
                          {editing ? (
                            <Input type="number" value={editDraft.rifornimento} onChange={(e) => setEditDraft((p) => ({ ...p, rifornimento: e.target.value }))} className="h-7 text-[12px] text-right" />
                          ) : (
                            r.rifornimento != null ? `${formatMoney(r.rifornimento)}` : '00,00'
                          )}
                        </Td>
                        <Td className="text-[var(--color-text-muted)]">
                          {editing ? (
                            <Input value={editDraft.note} onChange={(e) => setEditDraft((p) => ({ ...p, note: e.target.value }))} className="h-7 text-[12px]" placeholder="Note…" />
                          ) : (r.note || '—')}
                        </Td>
                        <Td className="text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1">
                              <IconButton icon={Check} variant="accent" size="sm" onClick={() => saveEdit(r)} title="Salva" />
                              <IconButton icon={X} size="sm" onClick={cancelEdit} title="Annulla" />
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <IconButton icon={Pencil} size="sm" onClick={() => startEdit(r)} title="Modifica" />
                              <button
                                onClick={() => toggleRow(r.id)}
                                className="text-[12px] font-medium text-[var(--color-danger)] hover:underline"
                              >
                                {pending ? 'Ripristina' : 'Cancella'}
                              </button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    )
                  })}

                  {!loading && rows.length > 0 && (
                    <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] font-semibold">
                      <td colSpan={6} className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Totale</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-text)]">{formatEuro(totals.rifornimento)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
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
                  <EmptyState icon={Car} title="Nessun record" description="Modifica i filtri o crea un nuovo record." />
                </div>
              )}

              {!loading && rows.map((r) => {
                const pending = pendingDeletes.has(r.id)
                const editing = editingId === r.id
                return (
                  <div key={r.id} className={`px-3 py-3 ${pending ? 'bg-[var(--color-danger-soft)]' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[14px] font-bold tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                            {r.mezzo || '—'}
                          </span>
                          <Badge variant={pending ? 'danger' : 'success'} size="sm">
                            {pending ? 'cancellato' : 'OK'}
                          </Badge>
                        </div>
                        <p className={`text-[12px] ${pending ? 'line-through' : 'text-[var(--color-text-secondary)]'}`}>
                          {dipendenteName(operatorById(r.created_by))}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{r.work_date}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={pending}
                        disabled={editing}
                        onChange={() => toggleRow(r.id)}
                        className="h-5 w-5 cursor-pointer accent-[var(--color-danger)]"
                      />
                    </div>

                    {editing ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
                        <div>
                          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Targa</p>
                          <Input value={editDraft.mezzo} onChange={(e) => setEditDraft((p) => ({ ...p, mezzo: e.target.value.toUpperCase() }))} className="mt-1" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Km</p>
                          <Input value={editDraft.km} onChange={(e) => setEditDraft((p) => ({ ...p, km: e.target.value }))} className="mt-1" />
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Rifornimento (€)</p>
                          <Input type="number" value={editDraft.rifornimento} onChange={(e) => setEditDraft((p) => ({ ...p, rifornimento: e.target.value }))} className="mt-1" />
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Note</p>
                          <Input value={editDraft.note} onChange={(e) => setEditDraft((p) => ({ ...p, note: e.target.value }))} className="mt-1" />
                        </div>
                        <div className="col-span-2 flex gap-2 pt-1">
                          <Button size="sm" variant="primary" icon={Check} onClick={() => saveEdit(r)} className="flex-1">Salva</Button>
                          <Button size="sm" variant="ghost" icon={X} onClick={cancelEdit} className="flex-1">Annulla</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2">
                          <div>
                            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Km</p>
                            <p className="text-[13px] font-semibold tabular-nums">{r.km || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Rifornimento</p>
                            <p className="text-[13px] font-semibold tabular-nums">
                              {r.rifornimento != null ? `${formatMoney(r.rifornimento)} €` : '—'}
                            </p>
                          </div>
                          {r.note && (
                            <div className="col-span-2">
                              <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Note</p>
                              <p className="text-[12px] text-[var(--color-text-secondary)]">{r.note}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => startEdit(r)} className="flex-1">Modifica</Button>
                          <button
                            onClick={() => toggleRow(r.id)}
                            className="flex-1 rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] py-1.5 text-[12px] font-medium text-[var(--color-danger)]"
                          >
                            {pending ? 'Ripristina' : 'Cancella'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {!loading && rows.length > 0 && (
                <div className="bg-[var(--color-surface)] px-3 py-3 font-semibold">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Totale rifornimento</p>
                    <p className="text-[14px] tabular-nums text-[var(--color-text)]">{formatEuro(totals.rifornimento)}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageBody>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtri di ricerca" width="md"
        footer={<Button variant="primary" onClick={() => setFiltersOpen(false)}>Applica</Button>}
      >
        {filterBanners}
      </Modal>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nuovo record automezzo"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Annulla</Button>
            <Button variant="primary" icon={Save} onClick={createRecord}>Crea</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Data" required>
            <Input type="date" value={newRow.work_date} onChange={(e) => setNewRow((p) => ({ ...p, work_date: e.target.value }))} />
          </Field>
          <Field label="Agente" required>
            <Select value={newRow.created_by} onChange={(e) => setNewRow((p) => ({ ...p, created_by: e.target.value }))}>
              <option value="">Seleziona agente…</option>
              {dipendenti.map((d) => (<option key={dipendenteId(d)} value={dipendenteId(d)}>{dipendenteName(d)}</option>))}
            </Select>
          </Field>
          <Field label="Targa">
            <Input value={newRow.mezzo} onChange={(e) => setNewRow((p) => ({ ...p, mezzo: e.target.value.toUpperCase() }))} placeholder="es. FH708TL" />
          </Field>
          <Field label="Km">
            <Input type="number" value={newRow.km} onChange={(e) => setNewRow((p) => ({ ...p, km: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Rifornimento (€)" className="md:col-span-2">
            <Input type="number" value={newRow.rifornimento} onChange={(e) => setNewRow((p) => ({ ...p, rifornimento: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Note" className="md:col-span-2">
            <Input value={newRow.note} onChange={(e) => setNewRow((p) => ({ ...p, note: e.target.value }))} placeholder="Note opzionali…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        title="Conferma cancellazione"
        message={`Confermi la cancellazione di ${pendingDeletes.size} record? Questa operazione è irreversibile.`}
        confirmLabel="Sì, cancella"
        onConfirm={confirmDeletePending}
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
