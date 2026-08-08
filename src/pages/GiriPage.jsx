import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, RefreshCw, Search, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { Badge, Button, Card, EmptyState, Input, Select, Stat } from '../components/ui'
import { useToast } from '../components/Toast'

export default function GiriPage() {
  const toast = useToast()
  const [state, setState] = useState({ giri: [], venues: [], assignments: [], employees: [] })
  const [selected, setSelected] = useState(new Set())
  const [target, setTarget] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('unassigned')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [g, v, a, d] = await Promise.all([
      supabase.from('giri').select('*').order('sort_order'),
      supabase.from('venues').select('*').eq('active', true).order('id'),
      supabase.from('giro_venue_assignments').select('*').is('valid_to', null),
      supabase.from('dipendenti').select('id,full_name,active').eq('active', true).order('full_name'),
    ])
    const error = g.error || v.error || a.error || d.error
    if (error) toast.error(error.message)
    else setState({ giri: g.data || [], venues: (v.data || []).filter(x => !String(x.id).toUpperCase().startsWith('D')), assignments: a.data || [], employees: d.data || [] })
    setLoading(false)
  }, [toast])
  useEffect(() => { load() }, [load])

  const byVenue = useMemo(() => Object.fromEntries(state.assignments.map(a => [a.venue_id, a.giro_id])), [state.assignments])
  const byGiro = useMemo(() => Object.fromEntries(state.giri.map(g => [g.id, g])), [state.giri])
  const filtered = useMemo(() => state.venues.filter(v => {
    const q = search.trim().toLowerCase()
    return (!q || `${v.id} ${v.name} ${v.city}`.toLowerCase().includes(q))
      && (filter === 'all' || (filter === 'unassigned' ? !byVenue[v.id] : byVenue[v.id] === filter))
  }), [state.venues, search, filter, byVenue])

  const updateGiro = async (id, values) => {
    const { error } = await supabase.from('giri').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message); else await load()
  }
  const move = async () => {
    if (!target || !selected.size) return
    setSaving(true)
    const { error } = await supabase.rpc('move_venues_to_giro', { p_giro_id: target, p_venue_ids: [...selected] })
    if (error) toast.error(error.message)
    else { toast.success(`${selected.size} locali assegnati`); setSelected(new Set()); await load() }
    setSaving(false)
  }

  return <PageLayout>
    <PageHeader title="GIRI" subtitle="Configurazione centralizzata e storico assegnazioni" actions={<Button icon={RefreshCw} onClick={load}>AGGIORNA</Button>} />
    <PageBody className="p-3 md:p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Giri attivi" value={state.giri.filter(g => g.active).length} icon={UsersRound} tone="accent" />
        <Stat label="Locali assegnati" value={state.assignments.length} tone="success" />
        <Stat label="Da assegnare" value={state.venues.length - state.assignments.length} tone="warning" />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[340px_1fr]">
        <div className="space-y-2">{state.giri.map(g => <Card key={g.id} padding className={!g.active ? 'opacity-60' : ''}>
          <div className="flex items-center justify-between"><div><p className="font-semibold text-[#3d2a0b]">{g.name}</p><p className="text-xs text-slate-500">{g.code} · {state.assignments.filter(a => a.giro_id === g.id).length} locali</p></div><Badge variant={g.active ? 'success' : 'default'}>{g.active ? 'ATTIVO' : 'NON ATTIVO'}</Badge></div>
          <label className="mt-3 block text-[11px] font-medium text-slate-500">TITOLARE ABITUALE</label>
          <Select value={g.default_employee_id || ''} onChange={e => updateGiro(g.id, { default_employee_id: e.target.value || null })}><option value="">Nessun titolare</option>{state.employees.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</Select>
          <Button className="mt-2 w-full" variant="ghost" onClick={() => updateGiro(g.id, { active: !g.active })}>{g.active ? 'DISATTIVA' : 'RIATTIVA'}</Button>
        </Card>)}</div>
        <Card>
          <div className="grid gap-2 border-b p-3 md:grid-cols-[1fr_200px]"><Input leftIcon={Search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca codice, locale o città" /><Select value={filter} onChange={e => { setFilter(e.target.value); setSelected(new Set()) }}><option value="unassigned">NON ASSEGNATI</option><option value="all">TUTTI</option>{state.giri.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></div>
          <div className="max-h-[55vh] divide-y overflow-y-auto">{loading ? <p className="p-6 text-center text-sm text-slate-500">Caricamento…</p> : filtered.length === 0 ? <EmptyState title="Nessun locale" description="Non ci sono locali per questo filtro." /> : filtered.map(v => <label key={v.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-amber-50/50"><input type="checkbox" checked={selected.has(v.id)} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n })} /><span className="w-10 font-semibold text-[#9a6817]">{v.id}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{v.name}</span><span className="text-xs text-slate-500">{v.city}</span></span>{byVenue[v.id] && <Badge variant="accent">{byGiro[byVenue[v.id]]?.name}</Badge>}</label>)}</div>
          <div className="grid gap-2 border-t bg-[#fffaf0] p-3 md:grid-cols-[1fr_auto]"><Select value={target} onChange={e => setTarget(e.target.value)}><option value="">Giro di destinazione</option>{state.giri.filter(g => g.active).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select><Button variant="primary" icon={ArrowRightLeft} disabled={!target || !selected.size || saving} onClick={move}>{saving ? 'SALVATAGGIO…' : `SPOSTA NEL GIRO (${selected.size})`}</Button></div>
        </Card>
      </div>
    </PageBody>
  </PageLayout>
}
