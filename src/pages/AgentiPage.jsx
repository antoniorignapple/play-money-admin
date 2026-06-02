import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Download, Mail, Search, KeyRound,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Badge, EmptyState, Card,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { FormDialog, ConfirmDialog } from '../components/FormDialog'
import { SkeletonRow } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { initials, avatarColor } from '../lib/helpers'

const SUPABASE_FN_URL = 'https://ufkgncqqvqgynncswkiv.supabase.co/functions/v1/admin-update-user'

// Considera "online" chi ha dato un segnale negli ultimi 2 minuti
// (l'app fa heartbeat ogni 60s).
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

function lastSeenInfo(value) {
  if (!value) return { online: false, label: 'Mai' }
  const ts = new Date(value).getTime()
  if (Number.isNaN(ts)) return { online: false, label: '—' }
  const diff = Date.now() - ts
  if (diff < ONLINE_THRESHOLD_MS) return { online: true, label: 'Online ora' }

  const min = Math.floor(diff / 60000)
  if (min < 60) return { online: false, label: `${min} min fa` }
  const h = Math.floor(min / 60)
  if (h < 24) return { online: false, label: `${h} h fa` }
  const g = Math.floor(h / 24)
  if (g < 7) return { online: false, label: `${g} g fa` }
  return {
    online: false,
    label: new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }),
  }
}

export default function AgentiPage() {
  const toast = useToast()
  const [dipendenti, setDipendenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [revealedPins, setRevealedPins] = useState(new Set())

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [pinTarget, setPinTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('dipendenti').select('*').order('full_name', { ascending: true })
    if (error) {
      toast.error(`Errore: ${error.message}`)
      setDipendenti([])
    } else {
      setDipendenti(data || [])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return dipendenti
    return dipendenti.filter((d) =>
      String(d.full_name || '').toLowerCase().includes(s) ||
      String(d.email || '').toLowerCase().includes(s) ||
      String(d.role || '').toLowerCase().includes(s)
    )
  }, [dipendenti, search])

  function togglePin(id) {
    setRevealedPins((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function callAdminFn(body) {
    const response = await fetch(SUPABASE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Errore funzione admin')
    return result
  }

  async function handleCreate(v) {
    const full_name = String(v.full_name || '').trim()
    const result = await callAdminFn({
      action: 'create_user',
      full_name, email: v.email, pin: v.pin, role: v.role || 'operator',
    })
    setDipendenti((prev) =>
      [...prev, result.dipendente].sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')))
    )
    setCreateOpen(false)
    toast.success(`Dipendente "${full_name}" creato`)
  }

  async function handleEdit(v) {
    const full_name = String(v.full_name || '').trim()
    const { data, error } = await supabase
      .from('dipendenti')
      .update({ full_name, email: v.email, role: v.role || 'operator' })
      .eq('id', editTarget.id).select('*').single()
    if (error) throw new Error(error.message)
    setDipendenti((prev) => prev.map((x) => x.id === editTarget.id ? data : x))
    setEditTarget(null)
    toast.success('Dipendente aggiornato')
  }

  async function handleChangePin(v) {
    await callAdminFn({
      action: 'update_pin', auth_user_id: pinTarget.auth_user_id, new_pin: v.pin,
    })
    setDipendenti((prev) => prev.map((x) => x.id === pinTarget.id ? { ...x, pin: v.pin } : x))
    setPinTarget(null)
    toast.success('PIN aggiornato')
  }

  async function handleDelete() {
    await callAdminFn({ action: 'delete_user', auth_user_id: deleteTarget.auth_user_id })
    const name = deleteTarget.full_name || deleteTarget.email
    setDipendenti((prev) => prev.filter((x) => x.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success(`"${name}" eliminato`)
  }

  function downloadCsv() {
    const rows = [['Dipendente', 'Email', 'PIN', 'Ruolo', 'Stato']]
    filtered.forEach((d) => {
      rows.push([d.full_name || '', d.email || '', d.pin || '', d.role || '', d.active ? 'Attivo' : 'Disattivato'])
    })
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `agenti_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV scaricato')
  }

  function emailList() {
    const emails = filtered.filter((d) => d.email).map((d) => d.email).join(',')
    if (!emails) { toast.warning('Nessuna email disponibile'); return }
    window.location.href = `mailto:?bcc=${emails}`
  }

  return (
    <PageLayout>
      <PageHeader
        title="Agenti"
        subtitle={`Lista agenti (record: ${dipendenti.length})`}
        actions={
          <>
            <Input
              leftIcon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca…"
              className="w-full md:w-56"
            />
            <Button icon={Plus} variant="warning" onClick={() => setCreateOpen(true)}>
              <span className="hidden md:inline">Nuovo</span>
            </Button>
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Elenco agenti:</p>
                <Button size="sm" variant="ghost" icon={Download} onClick={downloadCsv}>
                  <span className="hidden sm:inline">download</span>
                </Button>
                <Button size="sm" variant="ghost" icon={Mail} onClick={emailList}>
                  <span className="hidden sm:inline">e-mail</span>
                </Button>
              </div>
              {search && (
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {filtered.length} risultati
                </span>
              )}
            </div>

            {/* TABELLA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-[var(--color-surface)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <Th className="w-12">stato</Th>
                    <Th>Dipendente</Th>
                    <Th>email</Th>
                    <Th className="w-40">Ultimo accesso</Th>
                    <Th className="w-32">password</Th>
                    <Th className="w-48 text-right">azioni</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}

                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={6}>
                      <EmptyState
                        title="Nessun agente"
                        description={search ? `Nessun risultato per "${search}".` : 'Aggiungi il primo agente.'}
                        action={!search && <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Nuovo agente</Button>}
                      />
                    </td></tr>
                  )}

                  {!loading && filtered.map((d) => {
                    const revealed = revealedPins.has(d.id)
                    return (
                      <tr key={d.id} className="group border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-surface-hover)]">
                        <Td>
                          <Badge variant={d.active ? 'success' : 'default'} size="sm">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${d.active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`} />
                            {d.active ? 'OK' : 'Off'}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(d.full_name || d.email || '')}`}>
                              {initials(d.full_name)}
                            </div>
                            <span className="font-medium text-[var(--color-text)]">{d.full_name || '—'}</span>
                          </div>
                        </Td>
                        <Td className="text-[var(--color-text-secondary)]">{d.email || '—'}</Td>
                        <Td>
                          {(() => {
                            const ls = lastSeenInfo(d.last_seen)
                            return (
                              <span className="inline-flex items-center gap-1.5">
                                <span className={`inline-block h-2 w-2 rounded-full ${ls.online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`} />
                                <span className={`text-[12px] ${ls.online ? 'font-semibold text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
                                  {ls.label}
                                </span>
                              </span>
                            )
                          })()}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                              {revealed ? (d.pin || '—') : '••••'}
                            </span>
                            <IconButton
                              icon={revealed ? EyeOff : Eye}
                              size="sm"
                              onClick={() => togglePin(d.id)}
                              title={revealed ? 'Nascondi PIN' : 'Mostra PIN'}
                            />
                          </div>
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <button onClick={() => setEditTarget(d)} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-info)] hover:underline">
                              <Pencil size={11} strokeWidth={2} /> Edit
                            </button>
                            <span className="text-[var(--color-border)]">·</span>
                            <button onClick={() => setPinTarget(d)} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-warning)] hover:underline">
                              <KeyRound size={11} strokeWidth={2} /> PIN
                            </button>
                            <span className="text-[var(--color-border)]">·</span>
                            <button onClick={() => setDeleteTarget(d)} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-danger)] hover:underline">
                              <Trash2 size={11} strokeWidth={2} /> Cancella
                            </button>
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* LISTA CARD MOBILE */}
            <div className="md:hidden divide-y divide-[var(--color-border)]">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-surface-active)]" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[var(--color-surface-active)]" />
                </div>
              ))}

              {!loading && filtered.length === 0 && (
                <div className="py-8">
                  <EmptyState
                    title="Nessun agente"
                    description={search ? `Nessun risultato per "${search}".` : 'Aggiungi il primo agente.'}
                    action={!search && <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Nuovo agente</Button>}
                  />
                </div>
              )}

              {!loading && filtered.map((d) => {
                const isAdmin = d.role === 'admin'
                const revealed = revealedPins.has(d.id)
                return (
                  <div key={d.id} className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${avatarColor(d.full_name || d.email || '')}`}>
                        {initials(d.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-medium text-[var(--color-text)] truncate">{d.full_name || '—'}</p>
                          {isAdmin && <Badge variant="accent" size="sm">⭐</Badge>}
                        </div>
                        <p className="text-[12px] text-[var(--color-text-secondary)] truncate">{d.email || '—'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={d.active ? 'success' : 'default'} size="sm">
                            {d.active ? 'OK' : 'Off'}
                          </Badge>
                          {(() => {
                            const ls = lastSeenInfo(d.last_seen)
                            return (
                              <span className="inline-flex items-center gap-1">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${ls.online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`} />
                                <span className={`text-[11px] ${ls.online ? 'font-semibold text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                  {ls.label}
                                </span>
                              </span>
                            )
                          })()}
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                              PIN: {revealed ? (d.pin || '—') : '••••'}
                            </span>
                            <IconButton
                              icon={revealed ? EyeOff : Eye}
                              size="sm"
                              onClick={() => togglePin(d.id)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditTarget(d)}>Edit</Button>
                      <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setPinTarget(d)}>PIN</Button>
                      <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteTarget(d)}>Del</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </PageBody>

      <FormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuovo dipendente"
        submitLabel="Crea"
        fields={[
          { name: 'full_name', label: 'Dipendente (nome completo)', required: true, placeholder: 'Mario Rossi', autoUpper: true },
          { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'mario@playmoney.com' },
          { name: 'pin', label: 'PIN', required: true, placeholder: '4 cifre', pattern: '^\\d{4}$', patternError: 'Il PIN deve essere di 4 cifre' },
          { name: 'role', label: 'Ruolo', type: 'select', defaultValue: 'operator', options: [
            { value: 'operator', label: 'Operator' },
            { value: 'admin', label: 'Admin (+Plus)' },
          ]},
        ]}
        onSubmit={handleCreate}
      />

      <FormDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifica dipendente"
        submitLabel="Salva"
        initialValues={editTarget ? { full_name: editTarget.full_name, email: editTarget.email, role: editTarget.role } : {}}
        fields={[
          { name: 'full_name', label: 'Dipendente', required: true, autoUpper: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'role', label: 'Ruolo', type: 'select', options: [
            { value: 'operator', label: 'Operator' },
            { value: 'admin', label: 'Admin (+Plus)' },
          ]},
        ]}
        onSubmit={handleEdit}
      />

      <FormDialog
        open={!!pinTarget}
        onClose={() => setPinTarget(null)}
        title={`Cambia PIN${pinTarget ? ` · ${pinTarget.full_name || pinTarget.email}` : ''}`}
        submitLabel="Aggiorna PIN"
        fields={[
          { name: 'pin', label: 'Nuovo PIN', required: true, placeholder: '4 cifre', pattern: '^\\d{4}$', patternError: 'Il PIN deve essere di 4 cifre' },
        ]}
        onSubmit={handleChangePin}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Elimina dipendente"
        message={deleteTarget ? `Vuoi eliminare definitivamente "${deleteTarget.full_name || deleteTarget.email}"?` : ''}
        confirmLabel="Elimina"
        onConfirm={handleDelete}
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
