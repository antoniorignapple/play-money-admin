import { useEffect, useMemo, useState } from 'react'
import {
  Plus, RefreshCw, Trash2, RotateCcw, Building2, Clock, User as UserIcon,
  Archive, Send, Bell, ClipboardCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Select, Field, Badge, EmptyState, Card, Modal, Tabs, Textarea,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { useToast } from '../components/Toast'
import { venueSortFn } from '../lib/helpers'

const fmtEuro0 = (n) => `${Math.trunc(Number(n) || 0).toLocaleString('it-IT')} €`
const isSimulazioneVenue = (v) => !['D01', 'D02'].includes(String(v?.id || '').toUpperCase())
const fmtDateTime = (v) => {
  if (!v) return '—'
  return new Date(v).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function SimulazioniPage() {
  const toast = useToast()
  const [tab, setTab] = useState('archivio') // archivio | richieste | cestino

  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [simulazioni, setSimulazioni] = useState([])
  const [cestino, setCestino] = useState([])
  const [richieste, setRichieste] = useState([])
  const [loading, setLoading] = useState(false)

  const [showNewReq, setShowNewReq] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // simulazione (soft)
  const [confirmHard, setConfirmHard] = useState(null)      // simulazione (hard)
  const [expanded, setExpanded] = useState(null)

  const venueById = useMemo(() => {
    const m = {}; venues.forEach((v) => { m[String(v.id)] = v }); return m
  }, [venues])
  function venueLabel(id) {
    const v = venueById[String(id)]
    if (!v) return id || '—'
    const name = String(v.name || '').trim()
    return name.toLowerCase().startsWith(String(v.id).toLowerCase()) ? name : `${v.id} ${name}`
  }
  function agentName(uid) {
    const d = dipendenti.find((x) => String(x.auth_user_id) === String(uid))
    return d?.full_name || '—'
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [{ data: v }, { data: dip }, { data: sim }, { data: del }, { data: req }] =
        await Promise.all([
          supabase.from('venues').select('*'),
          supabase.from('dipendenti').select('*'),
          supabase.from('simulazioni').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(3000),
          supabase.from('simulazioni').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(1000),
          supabase.from('simulazioni_richieste').select('*').order('created_at', { ascending: false }).limit(1000),
        ])
      setVenues([...(v || [])].filter(isSimulazioneVenue).sort(venueSortFn))
      setDipendenti(dip || [])
      setSimulazioni(sim || [])
      setCestino(del || [])
      setRichieste(req || [])
    } catch (e) {
      toast.error(`Errore: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [])

  // ─── crea richiesta ──────────────────────────────────────────────
  async function createRichiesta(form) {
    if (!form.venue_id) return toast.warning('Seleziona un locale')
    if (!form.user_id) return toast.warning('Seleziona un operatore')
    if (richieste.some((r) => r.status === 'in_attesa' &&
        String(r.venue_id) === String(form.venue_id) &&
        String(r.requested_user_id) === String(form.user_id))) {
      return toast.error('Esiste già una richiesta in attesa per questo operatore e locale')
    }
    const v = venueById[String(form.venue_id)]
    const { data: richiestaCreata, error } = await supabase.from('simulazioni_richieste').insert({
      venue_id: form.venue_id,
      venue_name: v ? (v.name || v.id) : form.venue_id,
      requested_user_id: form.user_id,
      note: form.note?.trim() || null,
      status: 'in_attesa',
    }).select('id').single()
    if (error) return toast.error(error.message)

    // Push best-effort: se fallisce, la richiesta resta comunque creata
    // e il badge realtime nell'app dipendenti continua a funzionare.
    if (richiestaCreata?.id) {
      supabase.functions.invoke('send-push', {
        body: {
          type: 'simulazione_richiesta',
          richiesta_id: richiestaCreata.id,
        },
      }).catch(() => {})
    }

    setShowNewReq(false)
    toast.success('Richiesta inviata')
    loadAll()
  }
  async function annullaRichiesta(r) {
    const { error } = await supabase.from('simulazioni_richieste')
      .update({ status: 'annullata' }).eq('id', r.id)
    if (error) return toast.error(error.message)
    toast.success('Richiesta annullata')
    loadAll()
  }

  // ─── cestino ─────────────────────────────────────────────────────
  async function softDelete() {
    const s = confirmDelete; if (!s) return
    const { error } = await supabase.from('simulazioni')
      .update({ deleted_at: new Date().toISOString() }).eq('id', s.id)
    setConfirmDelete(null)
    if (error) return toast.error(error.message)
    toast.success('Spostata nel cestino')
    loadAll()
  }
  async function restore(s) {
    const { error } = await supabase.from('simulazioni').update({ deleted_at: null }).eq('id', s.id)
    if (error) return toast.error(error.message)
    toast.success('Ripristinata')
    loadAll()
  }
  async function hardDelete() {
    const s = confirmHard; if (!s) return
    const { error } = await supabase.from('simulazioni').delete().eq('id', s.id)
    setConfirmHard(null)
    if (error) return toast.error(error.message)
    toast.success('Eliminata definitivamente')
    loadAll()
  }

  const richiesteInAttesa = richieste.filter((r) => r.status === 'in_attesa')

  return (
    <PageLayout>
      <PageHeader
        title="Simulazioni"
        subtitle={tab === 'archivio' ? `${simulazioni.length} simulazioni`
          : tab === 'richieste' ? `${richiesteInAttesa.length} in attesa`
          : `${cestino.length} nel cestino`}
        actions={
          <>
            <IconButton icon={RefreshCw} onClick={loadAll} title="Aggiorna" />
            {tab === 'richieste' && (
              <Button icon={Plus} variant="primary" onClick={() => setShowNewReq(true)}>
                <span className="hidden md:inline">Nuova richiesta</span>
                <span className="md:hidden">Nuova</span>
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        <div className="mx-auto max-w-[1100px] space-y-4 px-3 py-3 md:px-5 md:py-4">
          <Tabs value={tab} onChange={setTab} options={[
            { value: 'archivio', label: 'Archivio' },
            { value: 'richieste', label: 'Richieste' },
            { value: 'cestino', label: 'Cestino' },
          ]} />

          {tab === 'archivio' && (
            <div className="space-y-2">
              {simulazioni.length === 0 ? (
                <EmptyState icon={Archive} title="Nessuna simulazione" description="Le simulazioni effettuate dagli operatori compariranno qui." />
              ) : simulazioni.map((s) => (
                <SimRow key={s.id} s={s} venueLabel={venueLabel}
                  expanded={expanded === s.id} onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  onDelete={() => setConfirmDelete(s)} />
              ))}
            </div>
          )}

          {tab === 'richieste' && (
            <div className="space-y-2">
              {richiesteInAttesa.length === 0 ? (
                <EmptyState icon={Bell} title="Nessuna richiesta in attesa" description="Crea una richiesta per chiedere a un operatore di simulare un locale." />
              ) : richiesteInAttesa.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Send size={14} className="shrink-0 text-[var(--color-text-muted)]" />
                        <p className="truncate text-[14px] font-semibold">{venueLabel(r.venue_id)}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        Per: {agentName(r.requested_user_id)} · {fmtDateTime(r.created_at)}
                      </p>
                      {r.note && <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{r.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="warning" size="sm">In attesa</Badge>
                      <IconButton icon={Trash2} variant="danger" onClick={() => annullaRichiesta(r)} title="Annulla richiesta" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'cestino' && (
            <div className="space-y-2">
              {cestino.length === 0 ? (
                <EmptyState icon={Trash2} title="Cestino vuoto" />
              ) : cestino.map((s) => (
                <SimRow key={s.id} s={s} venueLabel={venueLabel} deleted
                  expanded={expanded === s.id} onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  onRestore={() => restore(s)} onHardDelete={() => setConfirmHard(s)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      {/* NUOVA RICHIESTA */}
      <NewRichiestaModal
        open={showNewReq}
        onClose={() => setShowNewReq(false)}
        venues={venues}
        dipendenti={dipendenti}
        onCreate={createRichiesta}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Sposta nel cestino"
        message="La simulazione verrà spostata nel Cestino Simulazioni e sparirà dall'archivio dell'app. Potrai ripristinarla. Procedere?"
        confirmLabel="Sposta nel cestino"
        onConfirm={softDelete}
      />
      <ConfirmDialog
        open={!!confirmHard}
        onClose={() => setConfirmHard(null)}
        title="Elimina definitivamente"
        message="La simulazione verrà eliminata in modo permanente e non sarà più recuperabile. Procedere?"
        confirmLabel="Elimina per sempre"
        onConfirm={hardDelete}
      />
    </PageLayout>
  )
}

function SimRow({ s, venueLabel, expanded, onToggle, onDelete, onRestore, onHardDelete, deleted = false }) {
  return (
    <Card>
      <div className={deleted ? 'opacity-80' : ''}>
        <button type="button" onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 p-3 text-left md:p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              <p className="truncate text-[14px] font-semibold">{venueLabel(s.venue_id)}</p>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1"><Clock size={11} />{fmtDateTime(s.created_at)}</span>
              <span className="inline-flex items-center gap-1"><UserIcon size={11} />{s.operator_name || '—'}</span>
            </p>
          </div>
          <span className={`shrink-0 text-[15px] font-extrabold tabular-nums ${Number(s.total) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
            {fmtEuro0(s.total)}
          </span>
        </button>

        {expanded && (
          <div className="border-t border-[var(--color-border)] px-3 py-3 md:px-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] md:grid-cols-3">
              <Cell label="Utile lordo" value={s.utile_lordo} />
              <Cell label="Acconti" value={s.acconti} />
              <Cell label="Carta" value={s.carta} />
              <Cell label="Monete" value={s.monete} />
              <Cell label="Da riportare" value={s.da_riportare} />
              <Cell label="Da rip. sospeso" value={s.da_riportare_sospeso} />
            </div>
            {s.note && (
              <div className="mt-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-[12px] text-[var(--color-text)]">
                <span className="font-bold">Note: </span>{s.note}
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              {deleted ? (
                <>
                  <Button size="sm" variant="success" icon={RotateCcw} onClick={onRestore}>Ripristina</Button>
                  <Button size="sm" variant="danger" icon={Trash2} onClick={onHardDelete}>Elimina</Button>
                </>
              ) : (
                <Button size="sm" variant="danger" icon={Trash2} onClick={onDelete}>Sposta nel cestino</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Cell({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">{fmtEuro0(value)}</span>
    </div>
  )
}

function NewRichiestaModal({ open, onClose, venues, dipendenti, onCreate }) {
  const [form, setForm] = useState({ venue_id: '', user_id: '', note: '' })
  useEffect(() => { if (open) setForm({ venue_id: '', user_id: '', note: '' }) }, [open])
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  return (
    <Modal open={open} onClose={onClose} title="Nuova richiesta di simulazione" width="md"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button variant="primary" icon={Send} onClick={() => onCreate(form)}>Invia richiesta</Button>
      </>}>
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <Select value={form.venue_id} onChange={(e) => set('venue_id', e.target.value)}>
            <option value="">Seleziona…</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{String(v.name || '').startsWith(String(v.id)) ? v.name : `${v.id} ${v.name}`}</option>
            ))}
          </Select>
        </Field>
        <Field label="Operatore destinatario" required>
          <Select value={form.user_id} onChange={(e) => set('user_id', e.target.value)}>
            <option value="">Seleziona…</option>
            {dipendenti.filter((d) => d.auth_user_id).map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id}>{d.full_name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Messaggio (opzionale)">
          <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)}
            placeholder="Es. controlla l'hopper della slot 3" />
        </Field>
      </div>
    </Modal>
  )
}
