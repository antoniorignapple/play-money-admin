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
        <div className="min-h-full bg-[radial-gradient(circle_at_12%_0%,rgba(226,186,99,.17),transparent_28%),linear-gradient(180deg,#f7f2e8_0%,#f4f0e8_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
            <section className="relative overflow-hidden rounded-[30px] border border-[#dfc98f] bg-[linear-gradient(135deg,#fffdf8_0%,#f3e2b7_100%)] px-4 py-6 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="w-12" />
                <div className="text-center">
                  <p className="text-[9px] font-black tracking-[0.28em] text-[#a0711f]">ORGANIZZAZIONE LOCALI</p>
                  <h1 className="mt-1 text-[29px] font-black tracking-[0.16em] text-[#3d2a0b] md:text-[35px]">GESTIONE GIRI</h1>
                </div>
                <button type="button" onClick={load} title="Aggiorna" className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#d8b86c] bg-[linear-gradient(145deg,#fffaf0,#ecd18f)] text-[#755019] shadow-[0_13px_24px_-17px_rgba(116,79,17,.48)] transition hover:-translate-y-0.5 active:scale-95">
                  <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {state.giri.map((giro) => {
                const count = state.assignments.filter((item) => item.giro_id === giro.id).length
                const active = selectedGiroId === giro.id
                return (
                  <button key={giro.id} type="button" onClick={() => setSelectedGiroId(giro.id)} className={`group relative min-h-[132px] overflow-hidden rounded-[24px] border p-4 text-left transition duration-200 hover:-translate-y-1 active:scale-[.98] ${active ? 'border-[#9f6c13] bg-[linear-gradient(135deg,#4a3009_0%,#8d5c12_54%,#d2a13e_100%)] text-white shadow-[0_22px_42px_-25px_rgba(91,55,3,.9)]' : 'border-[#ddc99a] bg-[linear-gradient(145deg,#fffdf8,#f5e8c9)] text-[#3b290d] shadow-[0_16px_32px_-28px_rgba(71,44,4,.7)]'}`}>
                    <div className={`absolute -right-9 -top-10 h-28 w-28 rounded-full blur-2xl ${active ? 'bg-amber-200/25' : 'bg-amber-300/16'}`} />
                    <div className="relative flex h-full flex-col justify-between">
                      <p className={`text-[15px] font-black uppercase tracking-[0.08em] ${active ? 'text-white' : 'text-[#4a320c]'}`}>{giroTitle(giro)}</p>
                      <div className="mt-7 flex items-end justify-between">
                        <div><p className={`text-[9px] font-black uppercase tracking-[0.16em] ${active ? 'text-amber-100/80' : 'text-[#9a722d]'}`}>LOCALI ASSEGNATI</p><p className="mt-1 text-[28px] font-black tabular-nums">{count}</p></div>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${active ? 'border-white/25 bg-white/15' : 'border-[#d4ba7b] bg-white/70 text-[#8c5d14]'}`}><ArrowRight size={16} /></span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#dfcfaa] bg-[#fffdf9] shadow-[0_24px_55px_-38px_rgba(65,43,8,.68)]">
              <div className="flex flex-col gap-3 border-b border-[#e5d4af] bg-[linear-gradient(135deg,#fff4d5,#e9c977)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                <div>
                  <p className="text-[9px] font-black tracking-[0.2em] text-[#966619]">GIRO SELEZIONATO</p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[0.1em] text-[#3c290b]">{selectedGiro ? giroTitle(selectedGiro) : 'NESSUN GIRO'}</h2>
                </div>
                <button type="button" disabled={!selectedGiro} onClick={openManager} className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#4a3009,#9b6817)] px-5 text-[10px] font-black tracking-[0.1em] text-white shadow-[0_12px_24px_-16px_rgba(75,45,3,.9)] transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-40">
                  <Sparkles size={15} /> GESTISCI LOCALI
                </button>
              </div>

              <div className="p-3 md:p-5">
                {loading ? <p className="py-14 text-center text-sm font-bold text-[#9a722d]">Caricamento locali…</p> : selectedVenues.length === 0 ? <EmptyState title="Nessun locale assegnato" description="Usa Gestisci locali per comporre questo giro." /> : (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {selectedVenues.map((venue) => (
                      <div key={venue.id} className="group flex min-h-[78px] items-center gap-3 rounded-[18px] border border-[#e3d4b6] bg-[linear-gradient(145deg,#fffdf9,#faf2e3)] px-3 py-3 transition hover:-translate-y-0.5 hover:border-[#d1b36e] hover:shadow-[0_14px_28px_-24px_rgba(72,43,3,.72)]">
                        <div className="flex h-11 min-w-14 items-center justify-center rounded-[13px] border border-[#d9c38e] bg-[#f3e4c3] px-2 font-mono text-[12px] font-black text-[#795116]">{venue.id}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black uppercase text-[#30230e]">{venue.name}</p><p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400"><MapPin size={10} />{venue.city || 'Città non indicata'}</p></div>
                        <button type="button" onClick={() => setMoveVenue(venue)} className="rounded-[11px] border border-[#d5bd86] bg-white px-3 py-2 text-[9px] font-black tracking-[0.08em] text-[#805718] transition hover:bg-[#fff4d7] active:scale-95">SPOSTA</button>
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
          <div className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-[#d6b76f] bg-[#fffdf9] shadow-[0_35px_90px_-30px_rgba(0,0,0,.85)]" onClick={(event) => event.stopPropagation()}>
            <div className="relative border-b border-[#ddc58c] bg-[linear-gradient(135deg,#fff4d4,#e4bf63)] px-5 py-5 text-center">
              <button type="button" onClick={() => setManagerOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#caa354] bg-white/65 text-[#6c470d]"><X size={15} /></button>
              <p className="text-[9px] font-black tracking-[0.22em] text-[#986719]">ASSEGNAZIONE MULTIPLA</p>
              <h2 className="mt-1 text-[21px] font-black tracking-[0.08em] text-[#3c290b]">{giroTitle(selectedGiro)}</h2>
              <p className="mt-1 text-[11px] font-bold text-[#7a551a]">Seleziona uno o più locali da aggiungere o spostare in questo giro.</p>
            </div>
            <div className="border-b border-[#eadfca] p-3"><Input leftIcon={Search} value={managerSearch} onChange={(event) => setManagerSearch(event.target.value)} placeholder="Cerca sigla, locale o città" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {managerVenues.length === 0 ? <EmptyState title="Nessun locale disponibile" description="Tutti i locali sono già assegnati a questo giro." /> : <div className="grid gap-2 md:grid-cols-2">{managerVenues.map((venue) => {
                const selected = checked.has(venue.id)
                const currentGiro = giroById[byVenue[String(venue.id)]]
                return <button key={venue.id} type="button" onClick={() => setChecked((previous) => { const next = new Set(previous); next.has(venue.id) ? next.delete(venue.id) : next.add(venue.id); return next })} className={`flex items-center gap-3 rounded-[16px] border p-3 text-left transition ${selected ? 'border-[#a87318] bg-[#fff0c7] shadow-[inset_4px_0_0_#b77b18]' : 'border-[#e4dac7] bg-white hover:border-[#d3bc87]'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border ${selected ? 'border-[#9d6813] bg-[#9d6813] text-white' : 'border-[#d5c7aa] bg-[#faf7f0] text-transparent'}`}><Check size={14} /></span>
                  <span className="flex h-10 min-w-13 items-center justify-center rounded-[11px] bg-[#f1e5cc] px-2 font-mono text-[11px] font-black text-[#7b5519]">{venue.id}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-black uppercase text-slate-800">{venue.name}</span><span className="mt-0.5 block truncate text-[9px] font-bold uppercase text-slate-400">{currentGiro ? giroTitle(currentGiro) : 'NON ASSEGNATO'}{venue.city ? ` · ${venue.city}` : ''}</span></span>
                </button>
              })}</div>}
            </div>
            <div className="border-t border-[#e4d5b7] bg-[#faf2e2] p-3"><button type="button" disabled={!checked.size || saving} onClick={() => assignVenues([...checked], selectedGiroId)} className="h-12 w-full rounded-[15px] bg-[linear-gradient(135deg,#a87318,#70480d)] text-[11px] font-black tracking-[0.12em] text-white shadow-[0_12px_24px_-16px_rgba(75,45,3,.9)] disabled:opacity-45">{saving ? 'SALVATAGGIO…' : `ASSEGNA A ${giroTitle(selectedGiro)} (${checked.size})`}</button></div>
          </div>
        </div>
      )}

      {moveVenue && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !saving && setMoveVenue(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-[26px] border border-[#d7b86e] bg-[#fffdf9] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-[linear-gradient(135deg,#fff4d4,#e7c66f)] p-5 text-center"><p className="text-[9px] font-black tracking-[.2em] text-[#936117]">SPOSTA LOCALE</p><h3 className="mt-1 text-[18px] font-black text-[#3c290b]">{moveVenue.id} · {moveVenue.name}</h3></div>
            <div className="grid gap-2 p-4">{state.giri.filter((giro) => giro.id !== selectedGiroId).map((giro) => <button key={giro.id} type="button" disabled={saving} onClick={() => assignVenues([moveVenue.id], giro.id)} className="flex h-12 items-center justify-between rounded-[14px] border border-[#dfd0b2] bg-white px-4 text-[11px] font-black tracking-[.08em] text-[#573b0d] transition hover:border-[#be9140] hover:bg-[#fff5dc]"><span>{giroTitle(giro)}</span><ArrowRight size={15} /></button>)}</div>
            <div className="border-t border-[#eadfca] p-3"><button type="button" onClick={() => setMoveVenue(null)} className="h-11 w-full rounded-[13px] border border-[#d8c8a8] bg-white text-[10px] font-black text-slate-500">ANNULLA</button></div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
