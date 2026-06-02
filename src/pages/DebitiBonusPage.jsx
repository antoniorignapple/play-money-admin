import { useEffect, useMemo, useState } from 'react'
import {
  Plus, RefreshCw, Trash2, Building2, Gift, Wallet, ChevronDown, ChevronUp,
  Banknote, Landmark, CheckCircle2, MinusCircle, Pause, Play,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Select, Badge, EmptyState, Card, Field, Modal, Tabs, Textarea,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { useToast } from '../components/Toast'
import { venueSortFn } from '../lib/helpers'

const fmtEuro = (n) => `${Math.trunc(Number(n) || 0).toLocaleString('it-IT')} €`
const todayKey = () => new Date().toISOString().slice(0, 10)
const formatITDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
const formatITDateTime = (v) => {
  if (!v) return '—'
  return new Date(v).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const PERIODICITA_LABEL = {
  ogni_conteggio: 'Ogni conteggio',
  ogni_fine_mese: 'Ogni fine mese',
}

export default function DebitiBonusPage() {
  const toast = useToast()
  const [tab, setTab] = useState('debiti')

  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [debiti, setDebiti] = useState([])
  const [bonus, setBonus] = useState([])
  const [movByDebito, setMovByDebito] = useState({})
  const [loading, setLoading] = useState(false)

  const [showNewDebito, setShowNewDebito] = useState(false)
  const [showNewBonus, setShowNewBonus] = useState(false)
  const [detailDebito, setDetailDebito] = useState(null)
  const [manualDeduct, setManualDeduct] = useState(null) // debito su cui registrare decurtazione
  const [manualAmount, setManualAmount] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // { kind, row }

  const venueById = useMemo(() => {
    const map = {}
    venues.forEach((v) => { map[String(v.id)] = v })
    return map
  }, [venues])

  function venueLabel(venueId) {
    const v = venueById[String(venueId)]
    if (!v) return venueId || '—'
    const id = String(v.id || '').trim()
    const name = String(v.name || '').trim()
    if (name.toLowerCase().startsWith(id.toLowerCase())) return name
    return `${id} ${name}`
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [{ data: venuesData }, { data: dipData }, { data: debitiData }, { data: bonusData }] =
        await Promise.all([
          supabase.from('venues').select('*'),
          supabase.from('dipendenti').select('*'),
          supabase.from('debiti').select('*').order('created_at', { ascending: false }),
          supabase.from('bonus').select('*').order('created_at', { ascending: false }),
        ])
      setVenues([...(venuesData || [])].sort(venueSortFn))
      setDipendenti(dipData || [])
      setDebiti(debitiData || [])
      setBonus(bonusData || [])
    } catch (e) {
      toast.error(`Errore: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function loadMovimenti(debitoId) {
    const { data, error } = await supabase
      .from('debiti_movimenti').select('*').eq('debito_id', debitoId)
      .order('created_at', { ascending: false })
    if (error) { toast.error(error.message); return }
    setMovByDebito((prev) => ({ ...prev, [debitoId]: data || [] }))
  }

  function openDebitoDetail(d) {
    setDetailDebito(d)
    loadMovimenti(d.id)
  }

  // ─── CREATE DEBITO ──────────────────────────────────────────────
  async function createDebito(form) {
    if (!form.venue_id) return toast.warning('Seleziona un locale')
    const importo = Math.trunc(Number(form.importo_iniziale) || 0)
    if (importo <= 0) return toast.warning('Inserisci un importo valido')
    if (form.modalita === 'contanti') {
      if (!form.periodicita) return toast.warning('Scegli la periodicità')
      if (!form.rata_tipo) return toast.warning('Scegli il tipo di rata')
      if (form.rata_tipo === 'fisso' && !(Number(form.rata_importo) > 0))
        return toast.warning("Inserisci l'importo della rata")
    }
    // blocca due debiti attivi sullo stesso locale
    if (debiti.some((d) => d.status === 'attivo' && String(d.venue_id) === String(form.venue_id)))
      return toast.error('Questo locale ha già un debito attivo')

    const dip = dipendenti.find((x) => String(x.auth_user_id) === String(form.agent_id))
    const payload = {
      venue_id: form.venue_id,
      agent_id: form.agent_id || null,
      agent_name: dip?.full_name || null,
      importo_iniziale: importo,
      residuo: importo,
      modalita: form.modalita,
      periodicita: form.modalita === 'contanti' ? form.periodicita : null,
      rata_tipo: form.modalita === 'contanti' ? form.rata_tipo : null,
      rata_importo:
        form.modalita === 'contanti' && form.rata_tipo === 'fisso'
          ? Math.trunc(Number(form.rata_importo) || 0)
          : null,
      status: 'attivo',
      note: form.note?.trim() || null,
    }
    const { error } = await supabase.from('debiti').insert(payload)
    if (error) return toast.error(error.message)
    setShowNewDebito(false)
    toast.success('Debito creato')
    loadAll()
  }

  // ─── DECURTAZIONE MANUALE ───────────────────────────────────────
  async function applyManualDeduct() {
    const d = manualDeduct
    if (!d) return
    const importo = Math.trunc(Number(manualAmount) || 0)
    if (importo <= 0) return toast.warning('Inserisci un importo valido')
    const residuoPrima = Math.trunc(Number(d.residuo) || 0)
    const residuoDopo = Math.max(0, residuoPrima - importo)

    const { error: movErr } = await supabase.from('debiti_movimenti').insert({
      debito_id: d.id,
      venue_id: d.venue_id,
      data: todayKey(),
      operator_name: 'ADMIN',
      importo,
      residuo_prima: residuoPrima,
      residuo_dopo: residuoDopo,
      origine: 'manuale',
      note: 'Decurtazione manuale da admin',
    })
    if (movErr) return toast.error(movErr.message)

    const { error: updErr } = await supabase
      .from('debiti')
      .update({
        residuo: residuoDopo,
        status: residuoDopo <= 0 ? 'estinto' : d.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.id)
    if (updErr) return toast.error(updErr.message)

    setManualDeduct(null)
    setManualAmount('')
    toast.success('Decurtazione registrata')
    await loadAll()
    if (detailDebito?.id === d.id) {
      loadMovimenti(d.id)
      setDetailDebito((prev) => prev ? { ...prev, residuo: residuoDopo } : prev)
    }
  }

  async function setDebitoStatus(d, status) {
    const { error } = await supabase
      .from('debiti').update({ status, updated_at: new Date().toISOString() }).eq('id', d.id)
    if (error) return toast.error(error.message)
    toast.success(status === 'estinto' ? 'Debito segnato come estinto' : 'Debito aggiornato')
    loadAll()
  }

  // ─── BONUS ──────────────────────────────────────────────────────
  async function createBonus(form) {
    if (!form.venue_id) return toast.warning('Seleziona un locale')
    const importo = Math.trunc(Number(form.importo) || 0)
    if (importo <= 0) return toast.warning('Inserisci un importo valido')
    if (!form.periodicita) return toast.warning('Scegli la periodicità')
    if (bonus.some((b) => b.status === 'attivo' && String(b.venue_id) === String(form.venue_id)))
      return toast.error('Questo locale ha già un bonus attivo')

    const dip = dipendenti.find((x) => String(x.auth_user_id) === String(form.agent_id))
    const { error } = await supabase.from('bonus').insert({
      venue_id: form.venue_id,
      agent_id: form.agent_id || null,
      agent_name: dip?.full_name || null,
      importo,
      periodicita: form.periodicita,
      status: 'attivo',
      note: form.note?.trim() || null,
    })
    if (error) return toast.error(error.message)
    setShowNewBonus(false)
    toast.success('Bonus creato')
    loadAll()
  }

  async function toggleBonus(b) {
    const next = b.status === 'attivo' ? 'sospeso' : 'attivo'
    if (next === 'attivo' && bonus.some((x) => x.id !== b.id && x.status === 'attivo' && String(x.venue_id) === String(b.venue_id)))
      return toast.error('Questo locale ha già un altro bonus attivo')
    const { error } = await supabase
      .from('bonus').update({ status: next, updated_at: new Date().toISOString() }).eq('id', b.id)
    if (error) return toast.error(error.message)
    toast.success(next === 'attivo' ? 'Bonus riattivato' : 'Bonus sospeso')
    loadAll()
  }

  // ─── DELETE ─────────────────────────────────────────────────────
  async function doDelete() {
    const c = confirmDelete
    if (!c) return
    const table = c.kind === 'debito' ? 'debiti' : 'bonus'
    const { error } = await supabase.from(table).delete().eq('id', c.row.id)
    if (error) return toast.error(error.message)
    setConfirmDelete(null)
    if (c.kind === 'debito' && detailDebito?.id === c.row.id) setDetailDebito(null)
    toast.success('Eliminato')
    loadAll()
  }

  const debitiAttivi = debiti.filter((d) => d.status === 'attivo')
  const debitiChiusi = debiti.filter((d) => d.status !== 'attivo')

  return (
    <PageLayout>
      <PageHeader
        title="Debiti & Bonus"
        subtitle={tab === 'debiti'
          ? `${debitiAttivi.length} debiti attivi`
          : `${bonus.filter((b) => b.status === 'attivo').length} bonus attivi`}
        actions={
          <>
            <IconButton icon={RefreshCw} onClick={loadAll} title="Aggiorna" />
            {tab === 'debiti' ? (
              <Button icon={Plus} variant="primary" onClick={() => setShowNewDebito(true)}>
                <span className="hidden md:inline">Nuovo debito</span>
                <span className="md:hidden">Nuovo</span>
              </Button>
            ) : (
              <Button icon={Plus} variant="primary" onClick={() => setShowNewBonus(true)}>
                <span className="hidden md:inline">Nuovo bonus</span>
                <span className="md:hidden">Nuovo</span>
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1200px] space-y-4 px-3 py-3 md:px-5 md:py-4">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'debiti', label: 'Debiti' },
              { value: 'bonus', label: 'Bonus' },
            ]}
          />

          {tab === 'debiti' && (
            <div className="space-y-3">
              {debitiAttivi.length === 0 && debitiChiusi.length === 0 ? (
                <EmptyState icon={Wallet} title="Nessun debito" description="Crea un nuovo debito per un locale." />
              ) : (
                <>
                  {debitiAttivi.map((d) => (
                    <DebitoCard
                      key={d.id} d={d} venueLabel={venueLabel}
                      onOpen={() => openDebitoDetail(d)}
                      onDeduct={() => { setManualDeduct(d); setManualAmount('') }}
                      onDelete={() => setConfirmDelete({ kind: 'debito', row: d })}
                    />
                  ))}
                  {debitiChiusi.length > 0 && (
                    <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Estinti / annullati
                    </p>
                  )}
                  {debitiChiusi.map((d) => (
                    <DebitoCard
                      key={d.id} d={d} venueLabel={venueLabel} closed
                      onOpen={() => openDebitoDetail(d)}
                      onDelete={() => setConfirmDelete({ kind: 'debito', row: d })}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'bonus' && (
            <div className="space-y-3">
              {bonus.length === 0 ? (
                <EmptyState icon={Gift} title="Nessun bonus" description="Crea un nuovo bonus per un locale." />
              ) : (
                bonus.map((b) => (
                  <BonusCard
                    key={b.id} b={b} venueLabel={venueLabel}
                    onToggle={() => toggleBonus(b)}
                    onDelete={() => setConfirmDelete({ kind: 'bonus', row: b })}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </PageBody>

      {/* NUOVO DEBITO */}
      <NewDebitoModal
        open={showNewDebito}
        onClose={() => setShowNewDebito(false)}
        venues={venues}
        dipendenti={dipendenti}
        onCreate={createDebito}
      />

      {/* NUOVO BONUS */}
      <NewBonusModal
        open={showNewBonus}
        onClose={() => setShowNewBonus(false)}
        venues={venues}
        dipendenti={dipendenti}
        onCreate={createBonus}
      />

      {/* DETTAGLIO DEBITO */}
      <Modal
        open={!!detailDebito}
        onClose={() => setDetailDebito(null)}
        title="Dettaglio debito"
        width="lg"
      >
        {detailDebito && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--color-text-muted)]">{venueLabel(detailDebito.venue_id)}</p>
                <h3 className="text-[18px] font-semibold">{fmtEuro(detailDebito.residuo)} <span className="text-[12px] font-normal text-[var(--color-text-muted)]">residuo su {fmtEuro(detailDebito.importo_iniziale)}</span></h3>
              </div>
              <DebitoModeBadge d={detailDebito} />
            </div>

            <div className="flex flex-wrap gap-2">
              {detailDebito.status === 'attivo' && (
                <>
                  <Button icon={MinusCircle} size="sm" variant="primary"
                    onClick={() => { setManualDeduct(detailDebito); setManualAmount('') }}>
                    Registra decurtazione
                  </Button>
                  <Button icon={CheckCircle2} size="sm" variant="success"
                    onClick={() => setDebitoStatus(detailDebito, 'estinto')}>
                    Segna estinto
                  </Button>
                </>
              )}
              <Button icon={Trash2} size="sm" variant="danger"
                onClick={() => setConfirmDelete({ kind: 'debito', row: detailDebito })}>
                Elimina
              </Button>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Movimenti
              </p>
              <div className="space-y-2">
                {(movByDebito[detailDebito.id] || []).length === 0 ? (
                  <p className="text-[13px] text-[var(--color-text-muted)]">Nessuna decurtazione registrata.</p>
                ) : (
                  (movByDebito[detailDebito.id] || []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">
                          − {fmtEuro(m.importo)}
                          {m.origine === 'manuale' && <span className="ml-2 text-[10px] uppercase text-[var(--color-text-muted)]">manuale</span>}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          {formatITDate(m.data)} · {m.operator_name || '—'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--color-text-secondary)]">
                        residuo {fmtEuro(m.residuo_dopo)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* DECURTAZIONE MANUALE */}
      <Modal
        open={!!manualDeduct}
        onClose={() => setManualDeduct(null)}
        title="Registra decurtazione"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManualDeduct(null)}>Annulla</Button>
            <Button variant="primary" onClick={applyManualDeduct}>Registra</Button>
          </>
        }
      >
        {manualDeduct && (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {venueLabel(manualDeduct.venue_id)} · residuo attuale <strong>{fmtEuro(manualDeduct.residuo)}</strong>
            </p>
            <Field label="Importo da scalare (€)">
              <Input type="number" inputMode="numeric" value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)} placeholder="es. 250" autoFocus />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.kind === 'debito' ? 'Elimina debito' : 'Elimina bonus'}
        message="L'operazione eliminerà anche lo storico collegato e non è reversibile. Procedere?"
        confirmLabel="Elimina"
        onConfirm={doDelete}
      />
    </PageLayout>
  )
}

// ════════════════════════════════════════════════════════════════
// SOTTO-COMPONENTI
// ════════════════════════════════════════════════════════════════

function DebitoModeBadge({ d }) {
  if (d.modalita === 'bonifico') {
    return <Badge variant="info" size="sm"><Landmark size={11} /> Bonifico</Badge>
  }
  return <Badge variant="warning" size="sm"><Banknote size={11} /> Contanti</Badge>
}

function DebitoCard({ d, venueLabel, onOpen, onDeduct, onDelete, closed = false }) {
  const iniziale = Math.trunc(Number(d.importo_iniziale) || 0)
  const residuo = Math.trunc(Number(d.residuo) || 0)
  const pct = iniziale > 0 ? Math.min(100, Math.round(((iniziale - residuo) / iniziale) * 100)) : 0
  const rataLabel = d.modalita === 'contanti'
    ? (d.rata_tipo === 'tutto_aggio' ? 'Tutto aggio' : `Rata ${fmtEuro(d.rata_importo)}`)
    : 'Bonifico'

  return (
    <Card>
      <div className={`p-3 md:p-4 ${closed ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              <p className="truncate text-[14px] font-semibold">{venueLabel(d.venue_id)}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {rataLabel}
              {d.modalita === 'contanti' && d.periodicita ? ` · ${PERIODICITA_LABEL[d.periodicita]}` : ''}
              {d.agent_name ? ` · ${d.agent_name}` : ''}
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {closed
              ? <Badge variant={d.status === 'estinto' ? 'success' : 'default'} size="sm">{d.status}</Badge>
              : <DebitoModeBadge d={d} />}
            {!closed && onDeduct && (
              <IconButton icon={MinusCircle} variant="accent" onClick={onDeduct} title="Registra decurtazione" />
            )}
            <IconButton icon={Trash2} variant="danger" onClick={onDelete} title="Elimina" />
          </div>
        </div>

        <button type="button" onClick={onOpen} className="mt-3 block w-full text-left">
          <div className="flex items-end justify-between">
            <p className="text-[20px] font-extrabold tabular-nums text-[var(--color-danger)]">{fmtEuro(residuo)}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">su {fmtEuro(iniziale)}</p>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
            <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{pct}% rimborsato</p>
        </button>
      </div>
    </Card>
  )
}

function BonusCard({ b, venueLabel, onToggle, onDelete }) {
  const attivo = b.status === 'attivo'
  return (
    <Card>
      <div className={`flex items-center justify-between gap-3 p-3 md:p-4 ${attivo ? '' : 'opacity-70'}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gift size={14} className="shrink-0 text-[var(--color-text-muted)]" />
            <p className="truncate text-[14px] font-semibold">{venueLabel(b.venue_id)}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {PERIODICITA_LABEL[b.periodicita]}{b.agent_name ? ` · ${b.agent_name}` : ''}
          </p>
          <p className="mt-1 text-[20px] font-extrabold tabular-nums text-[var(--color-success)]">{fmtEuro(b.importo)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={attivo ? 'success' : 'default'} size="sm">{attivo ? 'Attivo' : 'Sospeso'}</Badge>
          <IconButton icon={attivo ? Pause : Play} variant="accent" onClick={onToggle}
            title={attivo ? 'Sospendi' : 'Riattiva'} />
          <IconButton icon={Trash2} variant="danger" onClick={onDelete} title="Elimina" />
        </div>
      </div>
    </Card>
  )
}

function NewDebitoModal({ open, onClose, venues, dipendenti, onCreate }) {
  const [form, setForm] = useState({
    venue_id: '', agent_id: '', importo_iniziale: '', modalita: 'contanti',
    periodicita: 'ogni_conteggio', rata_tipo: 'fisso', rata_importo: '', note: '',
  })
  useEffect(() => {
    if (open) setForm({
      venue_id: '', agent_id: '', importo_iniziale: '', modalita: 'contanti',
      periodicita: 'ogni_conteggio', rata_tipo: 'fisso', rata_importo: '', note: '',
    })
  }, [open])
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const isContanti = form.modalita === 'contanti'

  return (
    <Modal
      open={open} onClose={onClose} title="Nuovo debito" width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={() => onCreate(form)}>Crea debito</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <Select value={form.venue_id} onChange={(e) => set('venue_id', e.target.value)}>
            <option value="">Seleziona…</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{String(v.name || '').startsWith(String(v.id)) ? v.name : `${v.id} ${v.name}`}</option>
            ))}
          </Select>
        </Field>

        <Field label="Agente (opzionale)">
          <Select value={form.agent_id} onChange={(e) => set('agent_id', e.target.value)}>
            <option value="">—</option>
            {dipendenti.map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id || ''}>{d.full_name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Importo debito (€)" required>
          <Input type="number" inputMode="numeric" value={form.importo_iniziale}
            onChange={(e) => set('importo_iniziale', e.target.value)} placeholder="es. 10000" />
        </Field>

        <Field label="Modalità di rimborso" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip active={isContanti} onClick={() => set('modalita', 'contanti')} icon={Banknote} label="Contanti" />
            <ChoiceChip active={!isContanti} onClick={() => set('modalita', 'bonifico')} icon={Landmark} label="Bonifico" />
          </div>
        </Field>

        {isContanti && (
          <>
            <Field label="Periodicità" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip active={form.periodicita === 'ogni_conteggio'} onClick={() => set('periodicita', 'ogni_conteggio')} label="Ogni conteggio" />
                <ChoiceChip active={form.periodicita === 'ogni_fine_mese'} onClick={() => set('periodicita', 'ogni_fine_mese')} label="Ogni fine mese" />
              </div>
            </Field>

            <Field label="Importo da scalare" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip active={form.rata_tipo === 'fisso'} onClick={() => set('rata_tipo', 'fisso')} label="Importo rata" />
                <ChoiceChip active={form.rata_tipo === 'tutto_aggio'} onClick={() => set('rata_tipo', 'tutto_aggio')} label="Tutto aggio" />
              </div>
            </Field>

            {form.rata_tipo === 'fisso' && (
              <Field label="Importo rata (€)" required>
                <Input type="number" inputMode="numeric" value={form.rata_importo}
                  onChange={(e) => set('rata_importo', e.target.value)} placeholder="es. 250" />
              </Field>
            )}
            {form.rata_tipo === 'tutto_aggio' && (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                {"L'operatore scalerà nel conteggio "}<strong>{"tutto l'aggio"}</strong>{" guadagnato dall'esercente."}
              </p>
            )}
          </>
        )}

        <Field label="Note (opzionale)">
          <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function NewBonusModal({ open, onClose, venues, dipendenti, onCreate }) {
  const [form, setForm] = useState({ venue_id: '', agent_id: '', importo: '', periodicita: 'ogni_conteggio', note: '' })
  useEffect(() => {
    if (open) setForm({ venue_id: '', agent_id: '', importo: '', periodicita: 'ogni_conteggio', note: '' })
  }, [open])
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <Modal
      open={open} onClose={onClose} title="Nuovo bonus" width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={() => onCreate(form)}>Crea bonus</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <Select value={form.venue_id} onChange={(e) => set('venue_id', e.target.value)}>
            <option value="">Seleziona…</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{String(v.name || '').startsWith(String(v.id)) ? v.name : `${v.id} ${v.name}`}</option>
            ))}
          </Select>
        </Field>

        <Field label="Agente (opzionale)">
          <Select value={form.agent_id} onChange={(e) => set('agent_id', e.target.value)}>
            <option value="">—</option>
            {dipendenti.map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id || ''}>{d.full_name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Importo bonus (€)" required>
          <Input type="number" inputMode="numeric" value={form.importo}
            onChange={(e) => set('importo', e.target.value)} placeholder="es. 250" />
        </Field>

        <Field label="Periodicità" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip active={form.periodicita === 'ogni_conteggio'} onClick={() => set('periodicita', 'ogni_conteggio')} label="Ogni conteggio" />
            <ChoiceChip active={form.periodicita === 'ogni_fine_mese'} onClick={() => set('periodicita', 'ogni_fine_mese')} label="Ogni fine mese" />
          </div>
        </Field>

        <Field label="Note (opzionale)">
          <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ChoiceChip({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-1.5 rounded-md border text-[13px] font-medium transition-colors ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {label}
    </button>
  )
}
