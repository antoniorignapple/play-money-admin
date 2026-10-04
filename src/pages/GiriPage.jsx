import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, MapPin, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageLayout, PageBody } from '../components/PageLayout'
import { EmptyState, Input } from '../components/ui'
import { useToast } from '../components/Toast'

const giroTitle = (giro) => `GIRO ${String(giro?.name || '').replace(/^GIRO\s*:?[\s-]*/i, '').trim()}`

export default function GiriPage() {
  const toast = useToast()
  const [state, setState] = useState({ giri: [], venues: [], assignments: [] })
  const [selectedGiroId, setSelectedGiroId] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerSearch, setManagerSearch] = useState('')
  const [checked, setChecked] = useState(new Set())
  const [moveVenue, setMoveVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [g, v, a] = await Promise.all([
      supabase.from('giri').select('*').order('sort_order'),
      supabase.from('venues').select('*').eq('active', true).order('id'),
      supabase.from('giro_venue_assignments').select('*').is('valid_to', null),
    ])
    const error = g.error || v.error || a.error
    if (error) toast.error(error.message)
    else {
      const giri = g.data || []
      setState({
        giri,
        venues: (v.data || []).filter((venue) => !String(venue.id).toUpperCase().startsWith('D')),
        assignments: a.data || [],
      })
      setSelectedGiroId((current) => current && giri.some((item) => item.id === current) ? current : (giri[0]?.id || ''))
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const byVenue = useMemo(() => Object.fromEntries(state.assignments.map((item) => [String(item.venue_id), item.giro_id])), [state.assignments])
  const giroById = useMemo(() => Object.fromEntries(state.giri.map((giro) => [giro.id, giro])), [state.giri])
  const selectedGiro = giroById[selectedGiroId]
  const selectedVenues = useMemo(() => state.venues.filter((venue) => byVenue[String(venue.id)] === selectedGiroId), [state.venues, byVenue, selectedGiroId])
  const managerVenues = useMemo(() => {
    const query = managerSearch.trim().toLowerCase()
    return state.venues.filter((venue) => {
      if (byVenue[String(venue.id)] === selectedGiroId) return false
      return !query || `${venue.id} ${venue.name} ${venue.city || ''}`.toLowerCase().includes(query)
    })
  }, [state.venues, byVenue, selectedGiroId, managerSearch])

  function openManager() {
    setChecked(new Set())
    setManagerSearch('')
    setManagerOpen(true)
  }

  async function assignVenues(venueIds, giroId) {
    if (!venueIds.length || !giroId) return
    setSaving(true)
    const { error } = await supabase.rpc('move_venues_to_giro', { p_giro_id: giroId, p_venue_ids: venueIds })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(venueIds.length === 1 ? 'Locale spostato' : `${venueIds.length} locali assegnati`)
    setManagerOpen(false)
    setMoveVenue(null)
    setChecked(new Set())
    await load()
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_12%_0%,rgba(99,177,226,.17),transparent_28%),linear-gradient(180deg,#e8f1f7_0%,#e8eff4_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
            <section className="relative overflow-hidden rounded-[30px] border border-[#8fc0df] bg-[linear-gradient(135deg,#f9fcfe_0%,#b7dcf3_100%)] px-4 py-6 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="w-12" />
                <div className="text-center">
                  <p className="text-[9px] font-black tracking-[0.28em] text-[#1f6fa0]">ORGANIZZAZIONE LOCALI</p>
                  <h1 className="mt-1 text-[29px] font-black tracking-[0.16em] text-[#0b2a3d] md:text-[35px]">GESTIONE GIRI</h1>
                </div>
                <button type="button" onClick={load} title="Aggiorna" className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#6cafd8] bg-[linear-gradient(145deg,#f1f9fe,#8fc8ec)] text-[#195275] shadow-[0_13px_24px_-17px_rgba(116,79,17,.48)] transition hover:-translate-y-0.5 active:scale-95">
                  <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {state.giri.map((giro) => {
                const count = state.assignments.filter((item) => item.giro_id === giro.id).length
                const active = selectedGiroId === giro.id
                return (
                  <button key={giro.id} type="button" onClick={() => setSelectedGiroId(giro.id)} className={`group relative min-h-[132px] overflow-hidden rounded-[24px] border p-4 text-left transition duration-200 hover:-translate-y-1 active:scale-[.98] ${active ? 'border-[#13699f] bg-[linear-gradient(135deg,#09314a_0%,#125e8d_54%,#3e99d2_100%)] text-white shadow-[0_22px_42px_-25px_rgba(91,55,3,.9)]' : 'border-[#9ac3dd] bg-[linear-gradient(145deg,#f9fcfe,#c9e4f5)] text-[#0d293b] shadow-[0_16px_32px_-28px_rgba(71,44,4,.7)]'}`}>
                    <div className={`absolute -right-9 -top-10 h-28 w-28 rounded-full blur-2xl ${active ? 'bg-amber-200/25' : 'bg-amber-300/16'}`} />
                    <div className="relative flex h-full flex-col justify-between">
                      <p className={`text-[15px] font-black uppercase tracking-[0.08em] ${active ? 'text-white' : 'text-[#0c324a]'}`}>{giroTitle(giro)}</p>
                      <div className="mt-7 flex items-end justify-between">
                        <div><p className={`text-[9px] font-black uppercase tracking-[0.16em] ${active ? 'text-amber-100/80' : 'text-[#2d709a]'}`}>LOCALI ASSEGNATI</p><p className="mt-1 text-[28px] font-black tabular-nums">{count}</p></div>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${active ? 'border-white/25 bg-white/15' : 'border-[#7bb2d4] bg-white/70 text-[#145e8c]'}`}><ArrowRight size={16} /></span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#aacbdf] bg-[#f9fdff] shadow-[0_24px_55px_-38px_rgba(65,43,8,.68)]">
              <div className="flex flex-col gap-3 border-b border-[#afd0e5] bg-[linear-gradient(135deg,#d8eefc,#77bde9)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                <div>
                  <p className="text-[9px] font-black tracking-[0.2em] text-[#196696]">GIRO SELEZIONATO</p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[0.1em] text-[#0b293c]">{selectedGiro ? giroTitle(selectedGiro) : 'NESSUN GIRO'}</h2>
                </div>
                <button type="button" disabled={!selectedGiro} onClick={openManager} className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#09314a,#17689b)] px-5 text-[10px] font-black tracking-[0.1em] text-white shadow-[0_12px_24px_-16px_rgba(75,45,3,.9)] transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-40">
                  <Sparkles size={15} /> GESTISCI LOCALI
                </button>
              </div>

              <div className="p-3 md:p-5">
                {loading ? <p className="py-14 text-center text-sm font-bold text-[#2d709a]">Caricamento locali…</p> : selectedVenues.length === 0 ? <EmptyState title="Nessun locale assegnato" description="Usa Gestisci locali per comporre questo giro." /> : (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {selectedVenues.map((venue) => (
                      <div key={venue.id} className="group flex min-h-[78px] items-center gap-3 rounded-[18px] border border-[#b6d2e3] bg-[linear-gradient(145deg,#f9fdff,#e3f1fa)] px-3 py-3 transition hover:-translate-y-0.5 hover:border-[#6eabd1] hover:shadow-[0_14px_28px_-24px_rgba(72,43,3,.72)]">
                        <div className="flex h-11 min-w-14 items-center justify-center rounded-[13px] border border-[#8ebcd9] bg-[#c3e1f3] px-2 font-mono text-[12px] font-black text-[#165379]">{venue.id}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black uppercase text-[#0e2330]">{venue.name}</p><p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400"><MapPin size={10} />{venue.city || 'Città non indicata'}</p></div>
                        <button type="button" onClick={() => setMoveVenue(venue)} className="rounded-[11px] border border-[#86b7d5] bg-white px-3 py-2 text-[9px] font-black tracking-[0.08em] text-[#185880] transition hover:bg-[#daeffc] active:scale-95">SPOSTA</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </PageBody>

      {managerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={() => !saving && setManagerOpen(false)}>
          <div className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-[#6fafd6] bg-[#f9fdff] shadow-[0_35px_90px_-30px_rgba(0,0,0,.85)]" onClick={(event) => event.stopPropagation()}>
            <div className="relative border-b border-[#8cbedd] bg-[linear-gradient(135deg,#d7eefc,#63b3e4)] px-5 py-5 text-center">
              <button type="button" onClick={() => setManagerOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#549dca] bg-white/65 text-[#0d486c]"><X size={15} /></button>
              <p className="text-[9px] font-black tracking-[0.22em] text-[#196798]">ASSEGNAZIONE MULTIPLA</p>
              <h2 className="mt-1 text-[21px] font-black tracking-[0.08em] text-[#0b293c]">{giroTitle(selectedGiro)}</h2>
              <p className="mt-1 text-[11px] font-bold text-[#1a557a]">Seleziona uno o più locali da aggiungere o spostare in questo giro.</p>
            </div>
            <div className="border-b border-[#cadeea] p-3"><Input leftIcon={Search} value={managerSearch} onChange={(event) => setManagerSearch(event.target.value)} placeholder="Cerca sigla, locale o città" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {managerVenues.length === 0 ? <EmptyState title="Nessun locale disponibile" description="Tutti i locali sono già assegnati a questo giro." /> : <div className="grid gap-2 md:grid-cols-2">{managerVenues.map((venue) => {
                const selected = checked.has(venue.id)
                const currentGiro = giroById[byVenue[String(venue.id)]]
                return <button key={venue.id} type="button" onClick={() => setChecked((previous) => { const next = new Set(previous); next.has(venue.id) ? next.delete(venue.id) : next.add(venue.id); return next })} className={`flex items-center gap-3 rounded-[16px] border p-3 text-left transition ${selected ? 'border-[#1871a8] bg-[#cbe9fb] shadow-[inset_4px_0_0_#187ab7]' : 'border-[#c7d9e4] bg-white hover:border-[#87b6d3]'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border ${selected ? 'border-[#13689d] bg-[#13689d] text-white' : 'border-[#aac5d5] bg-[#f0f6fa] text-transparent'}`}><Check size={14} /></span>
                  <span className="flex h-10 min-w-13 items-center justify-center rounded-[11px] bg-[#cce3f1] px-2 font-mono text-[11px] font-black text-[#19557b]">{venue.id}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-black uppercase text-slate-800">{venue.name}</span><span className="mt-0.5 block truncate text-[9px] font-bold uppercase text-slate-400">{currentGiro ? giroTitle(currentGiro) : 'NON ASSEGNATO'}{venue.city ? ` · ${venue.city}` : ''}</span></span>
                </button>
              })}</div>}
            </div>
            <div className="border-t border-[#b7d3e4] bg-[#e2f1fa] p-3"><button type="button" disabled={!checked.size || saving} onClick={() => assignVenues([...checked], selectedGiroId)} className="h-12 w-full rounded-[15px] bg-[linear-gradient(135deg,#1871a8,#0d4a70)] text-[11px] font-black tracking-[0.12em] text-white shadow-[0_12px_24px_-16px_rgba(75,45,3,.9)] disabled:opacity-45">{saving ? 'SALVATAGGIO…' : `ASSEGNA A ${giroTitle(selectedGiro)} (${checked.size})`}</button></div>
          </div>
        </div>
      )}

      {moveVenue && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !saving && setMoveVenue(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-[26px] border border-[#6eafd7] bg-[#f9fdff] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-[linear-gradient(135deg,#d7eefc,#6fb9e7)] p-5 text-center"><p className="text-[9px] font-black tracking-[.2em] text-[#176393]">SPOSTA LOCALE</p><h3 className="mt-1 text-[18px] font-black text-[#0b293c]">{moveVenue.id} · {moveVenue.name}</h3></div>
            <div className="grid gap-2 p-4">{state.giri.filter((giro) => giro.id !== selectedGiroId).map((giro) => <button key={giro.id} type="button" disabled={saving} onClick={() => assignVenues([moveVenue.id], giro.id)} className="flex h-12 items-center justify-between rounded-[14px] border border-[#b2cedf] bg-white px-4 text-[11px] font-black tracking-[.08em] text-[#0d3b57] transition hover:border-[#408ebe] hover:bg-[#dff1fc]"><span>{giroTitle(giro)}</span><ArrowRight size={15} /></button>)}</div>
            <div className="border-t border-[#cadeea] p-3"><button type="button" onClick={() => setMoveVenue(null)} className="h-11 w-full rounded-[13px] border border-[#a8c6d8] bg-white text-[10px] font-black text-slate-500">ANNULLA</button></div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
