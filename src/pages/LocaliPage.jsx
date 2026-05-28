import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Plus, Search, Pencil, Trash2, Check, X, MapPin, Building2, Boxes, Calendar, User, RefreshCw,
  ArrowLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Badge, EmptyState, Card,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { FormDialog, ConfirmDialog } from '../components/FormDialog'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { venueSortFn, formatEuro, formatDateTime } from '../lib/helpers'

function getChangeImage(name = '') {
  const n = String(name).toLowerCase()
  if (n.includes('apex')) return '/change-machine/apex-icon.png'
  if (n.includes('pocket')) return '/change-machine/pocket-icon.png'
  if (n.includes('twin')) return '/change-machine/twin-icon.png'
  if (n.includes('bell')) return '/change-machine/bell-icon.png'
  return '/change-machine/generic.png'
}

export default function LocaliPage() {
  const toast = useToast()
  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [profiles, setProfiles] = useState([])

  const [editingMachineId, setEditingMachineId] = useState(null)
  const [machineDraft, setMachineDraft] = useState(null)
  const [savingKey, setSavingKey] = useState(null)

  const [createVenueOpen, setCreateVenueOpen] = useState(false)
  const [editVenueOpen, setEditVenueOpen] = useState(false)
  const [deleteVenueOpen, setDeleteVenueOpen] = useState(false)
  const [createMachineOpen, setCreateMachineOpen] = useState(false)
  const [deleteMachineTarget, setDeleteMachineTarget] = useState(null)

  const searchRef = useRef(null)

  useEffect(() => { loadVenues() }, [])

  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function loadVenues() {
    setLoading(true)
    const { data, error } = await supabase.from('venues').select('*').order('name', { ascending: true })
    const { data: profilesData } = await supabase.from('profiles').select('*')
    setProfiles(profilesData || [])
    if (error) {
      toast.error(`Errore: ${error.message}`)
      setVenues([])
    } else {
      const sorted = [...(data || [])].sort(venueSortFn)
      setVenues(sorted)
      // Su mobile NON seleziono auto il primo (così vede la lista)
      if (window.innerWidth >= 768 && !selectedVenue && sorted.length) {
        await selectVenue(sorted[0])
      }
    }
    setLoading(false)
  }

  async function selectVenue(venue) {
    const { data, error } = await supabase
      .from('machines').select('*').eq('venue_id', venue.id).order('name', { ascending: true })
    setSelectedVenue({ ...venue, machines: error ? [] : (data || []) })
    setEditingMachineId(null)
    setMachineDraft(null)
  }

  async function handleCreateVenue(v) {
    const { data, error } = await supabase.from('venues').insert({
      id: v.id, code: v.code, name: v.name, city: v.city, active: true,
      created_at: new Date().toISOString(),
    }).select('*').single()
    if (error) throw new Error(error.message)
    setVenues((c) => [...c, data].sort(venueSortFn))
    setCreateVenueOpen(false)
    await selectVenue(data)
    toast.success(`Locale "${v.name}" creato`)
  }

  async function handleEditVenue(v) {
    const { data, error } = await supabase.from('venues')
      .update({
        name: v.name, code: v.code, city: v.city,
        active: v.active === 'true' || v.active === true,
      })
      .eq('id', selectedVenue.id).select('*').single()
    if (error) throw new Error(error.message)
    setVenues((c) => c.map((x) => x.id === data.id ? { ...x, ...data } : x).sort(venueSortFn))
    setSelectedVenue((c) => ({ ...c, ...data }))
    setEditVenueOpen(false)
    toast.success('Locale aggiornato')
  }

  async function handleDeleteVenue() {
    if (!selectedVenue?.id) return
    const name = selectedVenue.name
    const { error: e1 } = await supabase.from('machines').delete().eq('venue_id', selectedVenue.id)
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await supabase.from('venues').delete().eq('id', selectedVenue.id)
    if (e2) throw new Error(e2.message)
    const next = venues.filter((v) => v.id !== selectedVenue.id)
    setVenues(next)
    setSelectedVenue(null)
    setDeleteVenueOpen(false)
    toast.success(`"${name}" eliminato`)
  }

  async function handleCreateMachine(v) {
    const { data, error } = await supabase.from('machines').insert({
      id: crypto.randomUUID(),
      venue_id: selectedVenue.id,
      name: v.name,
      fondo: Number(v.fondo || 0),
      level: 0,
      last_update: new Date().toISOString(),
    }).select('*').single()
    if (error) throw new Error(error.message)
    setSelectedVenue((c) => ({ ...c, machines: [...(c.machines || []), data] }))
    setCreateMachineOpen(false)
    toast.success(`Change "${v.name}" aggiunto`)
  }

  function startEditMachine(machine) {
    setEditingMachineId(machine.id)
    setMachineDraft({ name: machine.name || '', fondo: machine.fondo || 0 })
  }
  function cancelEditMachine() {
    setEditingMachineId(null)
    setMachineDraft(null)
  }
  async function saveEditMachine(machine) {
    if (!machineDraft) return
    setSavingKey(`machine-${machine.id}`)
    const { data, error } = await supabase.from('machines').update({
      name: machineDraft.name, fondo: Number(machineDraft.fondo || 0),
    }).eq('id', machine.id).select('*').single()
    setSavingKey(null)
    if (error) { toast.error(`Errore salvataggio: ${error.message}`); return }
    setSelectedVenue((c) => ({
      ...c, machines: (c.machines || []).map((m) => m.id === data.id ? data : m),
    }))
    setEditingMachineId(null)
    setMachineDraft(null)
    toast.success('Change aggiornato')
  }

  async function handleDeleteMachine() {
    const m = deleteMachineTarget
    const { error } = await supabase.from('machines').delete().eq('id', m.id)
    if (error) throw new Error(error.message)
    setSelectedVenue((c) => ({ ...c, machines: (c.machines || []).filter((x) => x.id !== m.id) }))
    setDeleteMachineTarget(null)
    toast.success('Change eliminato')
  }

  const sortedMachines = useMemo(() => {
    const getPriority = (name = '') => {
      const n = String(name).toLowerCase()
      if (n.includes('apex')) return 1
      if (n.includes('pocket')) return 2
      if (n.includes('twin')) return 3
      if (n.includes('bell')) return 4
      return 999
    }
    return [...(selectedVenue?.machines || [])].sort((a, b) => {
      const pa = getPriority(a.name), pb = getPriority(b.name)
      if (pa !== pb) return pa - pb
      return Number(b.fondo || 0) - Number(a.fondo || 0)
    })
  }, [selectedVenue])

  const filteredVenues = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return venues
    return venues.filter((v) =>
      String(v.name || '').toLowerCase().includes(s) ||
      String(v.code || '').toLowerCase().includes(s) ||
      String(v.city || '').toLowerCase().includes(s) ||
      String(v.id || '').toLowerCase().includes(s)
    )
  }, [venues, search])

  const groupedVenues = useMemo(() => {
    const groups = []
    let currentLetter = null
    for (const v of filteredVenues) {
      const letter = String(v.id || '?').charAt(0).toUpperCase()
      if (letter !== currentLetter) {
        currentLetter = letter
        groups.push({ letter, items: [] })
      }
      groups[groups.length - 1].items.push(v)
    }
    return groups
  }, [filteredVenues])

  return (
    <PageLayout>
      <PageHeader
        title="LOCALI"
        subtitle={`${venues.length} locali`}
        actions={
          <>
            <IconButton icon={RefreshCw} onClick={loadVenues} title="Aggiorna" />
            <Button variant="primary" icon={Plus} onClick={() => setCreateVenueOpen(true)}>
              <span className="hidden md:inline">Nuovo locale</span>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* LIST: full su mobile se nessun locale selezionato, fissa su desktop */}
        <aside className={`${selectedVenue ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-[var(--color-border)] bg-white md:w-[320px]`}>
          <div className="border-b border-[var(--color-border)] px-3 py-2.5">
            <Input
              ref={searchRef}
              leftIcon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca locale, codice, città…"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading && <SkeletonList count={8} />}

            {!loading && filteredVenues.length === 0 && (
              <EmptyState
                icon={Building2}
                title="Nessun locale"
                description={search ? `Nessun risultato per "${search}".` : 'Crea il primo locale.'}
              />
            )}

            {!loading && groupedVenues.map((group) => (
              <div key={group.letter} className="mb-2">
                <div className="sticky top-0 z-10 -mx-2 mb-0.5 bg-white px-3 pt-1 pb-1">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    {group.letter === 'K' ? 'KIOSCHI · GRUPPO K' : `GRUPPO ${group.letter}`}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((venue) => {
                    const isSelected = selectedVenue?.id === venue.id
                    return (
                      <button
                        key={venue.id}
                        onClick={() => selectVenue(venue)}
                        className={`group flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)]'
                            : 'border-transparent hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <div className={`flex h-8 w-10 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        }`}>
                          {venue.id}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{venue.name}</p>
                          {venue.city && (
                            <p className="flex items-center gap-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                              <MapPin size={9} strokeWidth={2} />{venue.city}
                            </p>
                          )}
                        </div>
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${venue.active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`}
                          title={venue.active ? 'Attivo' : 'Disattivato'}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* DETAIL */}
        <PageBody className={`${selectedVenue ? 'block' : 'hidden md:block'} bg-[var(--color-surface)]`}>
          {!selectedVenue && !loading && (
            <div className="hidden md:flex h-full items-center justify-center">
              <EmptyState
                icon={Building2}
                title="Nessun locale selezionato"
                description="Scegli un locale dalla lista per vedere i dettagli."
              />
            </div>
          )}

          {selectedVenue && (
            <div className="mx-auto max-w-[1200px] px-3 py-3 md:px-6 md:py-5">
              {/* Torna lista mobile */}
              <button
                onClick={() => setSelectedVenue(null)}
                className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-accent)] md:hidden"
              >
                <ArrowLeft size={14} strokeWidth={2} /> Torna alla lista
              </button>

              {/* Header detail */}
              <Card className="mb-3 md:mb-5">
                <div className="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between md:gap-4 md:p-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] font-mono text-[15px] font-bold text-white">
                      {selectedVenue.id}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[17px] font-semibold tracking-tight text-[var(--color-text)] md:text-[19px]">
                          {selectedVenue.name || 'Senza nome'}
                        </h2>
                        <Badge variant={selectedVenue.active ? 'success' : 'default'} size="sm">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${selectedVenue.active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`} />
                          {selectedVenue.active ? 'Attivo' : 'Disattivato'}
                        </Badge>
                      </div>
                      {selectedVenue.city && (
                        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[var(--color-text-muted)]">
                          <MapPin size={12} strokeWidth={2} />{selectedVenue.city}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button icon={Pencil} onClick={() => setEditVenueOpen(true)}>Modifica</Button>
                    <IconButton icon={Trash2} variant="danger" onClick={() => setDeleteVenueOpen(true)} title="Elimina locale" />
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-4">
                  <InfoTile label="Codice numerico" value={selectedVenue.code || '—'} mono />
                  <InfoTile label="Sigla" value={selectedVenue.id || '—'} mono />
                  <InfoTile label="Città" value={selectedVenue.city || '—'} />
                  <InfoTile label="Change" value={String(sortedMachines.length)} />
                </div>
              </Card>

              {/* Machines section */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
                  Change machines <span className="ml-1 text-[12px] font-normal text-[var(--color-text-muted)]">({sortedMachines.length})</span>
                </h3>
                <Button icon={Plus} variant="primary" onClick={() => setCreateMachineOpen(true)}>
                  <span className="hidden sm:inline">Aggiungi</span>
                </Button>
              </div>

              {sortedMachines.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Boxes}
                    title="Nessun change"
                    description="Aggiungi il primo change machine a questo locale."
                    action={<Button icon={Plus} variant="primary" onClick={() => setCreateMachineOpen(true)}>Aggiungi change</Button>}
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {sortedMachines.map((m) => (
                    <MachineCard
                      key={m.id}
                      machine={m}
                      profiles={profiles}
                      editing={editingMachineId === m.id}
                      draft={editingMachineId === m.id ? machineDraft : null}
                      saving={savingKey === `machine-${m.id}`}
                      onEditStart={() => startEditMachine(m)}
                      onEditCancel={cancelEditMachine}
                      onEditChange={(patch) => setMachineDraft((d) => ({ ...d, ...patch }))}
                      onEditSave={() => saveEditMachine(m)}
                      onDelete={() => setDeleteMachineTarget(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </PageBody>
      </div>

      {/* DIALOGS */}
      <FormDialog
        open={createVenueOpen}
        onClose={() => setCreateVenueOpen(false)}
        title="Nuovo locale"
        submitLabel="Crea locale"
        fields={[
          { name: 'name', label: 'Nome locale', required: true, placeholder: 'es. ROXY BAR', autoUpper: true },
          { name: 'id', label: 'Sigla', required: true, placeholder: 'es. K99', autoUpper: true, hint: 'Identificatore breve (K... per priorità)' },
          { name: 'code', label: 'Codice numerico', required: true, placeholder: 'es. 998899' },
          { name: 'city', label: 'Città', placeholder: 'es. Manfredonia' },
        ]}
        onSubmit={handleCreateVenue}
      />

      <FormDialog
        open={editVenueOpen}
        onClose={() => setEditVenueOpen(false)}
        title="Modifica locale"
        submitLabel="Salva"
        initialValues={{
          ...selectedVenue,
          active: selectedVenue?.active ? 'true' : 'false',
        }}
        fields={[
          { name: 'name', label: 'Nome locale', required: true, autoUpper: true },
          { name: 'code', label: 'Codice numerico', required: true },
          { name: 'city', label: 'Città' },
          { name: 'active', label: 'Stato', type: 'select', options: [
            { value: 'true', label: 'Attivo' },
            { value: 'false', label: 'Disattivato' },
          ]},
        ]}
        onSubmit={handleEditVenue}
      />

      <ConfirmDialog
        open={deleteVenueOpen}
        onClose={() => setDeleteVenueOpen(false)}
        title="Elimina locale"
        message={`Vuoi eliminare definitivamente "${selectedVenue?.name}"? Verranno eliminati anche tutti i change collegati. Operazione irreversibile.`}
        confirmLabel="Elimina"
        onConfirm={handleDeleteVenue}
      />

      <FormDialog
        open={createMachineOpen}
        onClose={() => setCreateMachineOpen(false)}
        title="Nuovo change"
        submitLabel="Aggiungi"
        fields={[
          { name: 'name', label: 'Nome change', required: true, placeholder: 'es. APEX / POCKET 2 / TWIN / BELL', autoUpper: true },
          { name: 'fondo', label: 'Fondo cassa', type: 'number', placeholder: '0', defaultValue: 0 },
        ]}
        onSubmit={handleCreateMachine}
      />

      <ConfirmDialog
        open={!!deleteMachineTarget}
        onClose={() => setDeleteMachineTarget(null)}
        title="Elimina change"
        message={deleteMachineTarget ? `Vuoi eliminare il change "${deleteMachineTarget.name}"?` : ''}
        confirmLabel="Elimina"
        onConfirm={handleDeleteMachine}
      />
    </PageLayout>
  )
}

function InfoTile({ label, value, mono = false }) {
  return (
    <div className="bg-white px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-0.5 text-[14px] font-medium text-[var(--color-text)] ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function MachineCard({
  machine, profiles, editing, draft, saving,
  onEditStart, onEditCancel, onEditChange, onEditSave, onDelete,
}) {
  const operatorName = profiles.find((p) => p.id === machine.updated_by)?.display_name
    || machine.updated_by_name || machine.operator || '—'

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm transition-colors hover:border-[var(--color-border-strong)]">
      <div className="grid grid-cols-[110px_minmax(0,1fr)] md:grid-cols-[140px_minmax(0,1fr)]">
        <div className="relative flex items-end justify-center border-r border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          <div className="absolute bottom-3 left-1/2 h-8 w-24 -translate-x-1/2 rounded-full bg-[var(--color-accent)]/10 blur-xl" />
          <img
            src="/change-machine/change-base-orange.png"
            alt=""
            className="pointer-events-none absolute bottom-2 left-1/2 z-0 w-[85px] -translate-x-1/2 opacity-90 md:w-[110px]"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <img
            src={getChangeImage(machine.name)}
            alt={machine.name}
            className="relative z-10 h-[120px] w-auto object-contain drop-shadow-md md:h-[160px]"
            draggable={false}
            onError={(e) => { e.currentTarget.src = '/change-machine/generic.png' }}
          />
        </div>

        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {editing ? (
                <Input
                  value={draft.name}
                  onChange={(e) => onEditChange({ name: e.target.value.toUpperCase() })}
                  placeholder="Nome change"
                />
              ) : (
                <p className="text-[14px] font-semibold text-[var(--color-text)]">{machine.name || '—'}</p>
              )}
            </div>
            <div className={`flex items-center gap-0.5 ${editing ? '' : 'md:opacity-0 md:transition-opacity md:group-hover:opacity-100'}`}>
              {editing ? (
                <>
                  <IconButton icon={Check} variant="accent" onClick={onEditSave} disabled={saving} title="Salva" size="sm" />
                  <IconButton icon={X} onClick={onEditCancel} disabled={saving} title="Annulla" size="sm" />
                </>
              ) : (
                <>
                  <IconButton icon={Pencil} onClick={onEditStart} title="Modifica" size="sm" />
                  <IconButton icon={Trash2} variant="danger" onClick={onDelete} title="Elimina" size="sm" />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Fondo</p>
              {editing ? (
                <Input
                  type="number"
                  value={draft.fondo}
                  onChange={(e) => onEditChange({ fondo: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--color-text)]">
                  {formatEuro(machine.fondo)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Livello</p>
              <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--color-success)]">
                {formatEuro(machine.level)}
              </p>
            </div>
          </div>

          <div className="space-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[11px] text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5">
              <User size={10} strokeWidth={2} />
              <span className="truncate">{operatorName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={10} strokeWidth={2} />
              <span className="tabular-nums">{formatDateTime(machine.last_update)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
