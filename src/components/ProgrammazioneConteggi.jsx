import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Check, ChevronDown, ChevronUp, Copy, MapPin, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'

const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('it-IT', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
}).toUpperCase()

const giroLabel = (giro) => `GIRO ${String(giro?.name || '').replace(/^GIRO\s*:?\s*/i, '')}`

export default function ProgrammazioneConteggi({ dates, monthKey }) {
  const toast = useToast()
  const [data, setData] = useState({ rows: [], employees: [], giri: [], venues: [], giroVenues: [], countedVenueIds: [] })
  const [loading, setLoading] = useState(true)
  const [openDays, setOpenDays] = useState(new Set())
  const [editor, setEditor] = useState(null)
  const [editorSearch, setEditorSearch] = useState('')
  const [copyDialog, setCopyDialog] = useState(null)
  const [copySourceDays, setCopySourceDays] = useState([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [year, month] = monthKey.split('-').map(Number)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const last = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
    const [rows, employees, giri, venues, giroVenues, activePeriod] = await Promise.all([
      supabase.from('conteggio_programmazioni').select('*').gte('data_conteggio', from).lte('data_conteggio', to).order('posizione'),
      supabase.from('dipendenti').select('id,auth_user_id,full_name,active').eq('active', true).order('full_name'),
      supabase.from('giri').select('id,name,code,active,sort_order').eq('active', true).order('sort_order'),
      supabase.from('venues').select('id,name,city,code,active').eq('active', true).order('id'),
      supabase.from('giro_venue_assignments').select('giro_id,venue_id').is('valid_to', null),
      supabase.from('active_conteggi_period').select('date_from,date_to').maybeSingle(),
    ])
    let countedVenueIds = []
    if (activePeriod.data?.date_from && activePeriod.data?.date_to) {
      const counted = await supabase.from('conteggi_tool').select('venue_id')
        .gte('conteggio_date', activePeriod.data.date_from).lte('conteggio_date', activePeriod.data.date_to)
      if (!counted.error) countedVenueIds = [...new Set((counted.data || []).map((row) => String(row.venue_id)))]
    }
    const error = rows.error || employees.error || giri.error || venues.error || giroVenues.error || activePeriod.error
    if (error) toast.error(error.message)
    setData({
      rows: rows.data || [],
      employees: (employees.data || []).filter((d) => d.auth_user_id),
      giri: giri.data || [], venues: venues.data || [], giroVenues: giroVenues.data || [], countedVenueIds,
    })
    setLoading(false)
  }, [monthKey, toast])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const employeeById = useMemo(() => Object.fromEntries(data.employees.map((d) => [String(d.auth_user_id), d])), [data.employees])
  const giroById = useMemo(() => Object.fromEntries(data.giri.map((g) => [String(g.id), g])), [data.giri])
  const selectedDates = useMemo(() => [...dates].sort(), [dates])
  const selectedGiroVenueIds = useMemo(() => new Set(data.giroVenues.filter((x) => String(x.giro_id) === String(editor?.giroId || '')).map((x) => String(x.venue_id))), [data.giroVenues, editor?.giroId])

  const groupsForDay = (date) => {
    const map = new Map()
    data.rows.filter((r) => r.data_conteggio === date).forEach((row) => {
      const key = `${row.employee_id}:${row.giro_id}`
      if (!map.has(key)) map.set(key, { employeeId: row.employee_id, giroId: row.giro_id, rows: [] })
      map.get(key).rows.push(row)
    })
    return [...map.values()]
  }

  function openEditor(date, group = null) {
    const employeeId = group?.employeeId || ''
    const giroId = group?.giroId || ''
    const venueIds = group ? group.rows.sort((a, b) => a.posizione - b.posizione).map((r) => r.venue_id) : []
    setEditor({ date, originalEmployeeId: employeeId, originalGiroId: giroId, employeeId, giroId, venueIds, note: group?.rows[0]?.nota || '' })
    setEditorSearch('')
  }

  function setGiro(giroId) {
    setEditor((e) => ({ ...e, giroId, venueIds: [] }))
    setEditorSearch('')
  }

  function toggleVenue(id) {
    setEditor((e) => ({ ...e, venueIds: e.venueIds.includes(id) ? e.venueIds.filter((x) => x !== id) : [...e.venueIds, id] }))
  }

  function moveVenue(index, direction) {
    setEditor((e) => {
      const next = [...e.venueIds]
      const target = index + direction
      if (target < 0 || target >= next.length) return e
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...e, venueIds: next }
    })
  }

  async function saveEditor() {
    if (!editor.employeeId || !editor.giroId || !editor.venueIds.length) return toast.warning('Scegli dipendente, giro e almeno un locale')
    setSaving(true)
    let query = supabase.from('conteggio_programmazioni').delete().eq('data_conteggio', editor.date)
    query = query.eq('employee_id', editor.originalEmployeeId || editor.employeeId)
    query = query.eq('giro_id', editor.originalGiroId || editor.giroId)
    const { error: deleteError } = await query
    if (deleteError) { setSaving(false); return toast.error(deleteError.message) }
    const payload = editor.venueIds.map((venueId, posizione) => ({
      data_conteggio: editor.date, employee_id: editor.employeeId, giro_id: editor.giroId,
      venue_id: venueId, posizione, nota: editor.note.trim() || null, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('conteggio_programmazioni').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(`${payload.length} locali programmati per ${dateLabel(editor.date)}`)
    setEditor(null); await load()
  }

  async function deleteGroup(date, group) {
    if (!window.confirm('Eliminare questa assegnazione giornaliera?')) return
    const { error } = await supabase.from('conteggio_programmazioni').delete()
      .eq('data_conteggio', date).eq('employee_id', group.employeeId).eq('giro_id', group.giroId)
    if (error) return toast.error(error.message)
    toast.success('Assegnazione eliminata'); await load()
  }

  async function openCopyDialog(targetDate) {
    const { data: source, error } = await supabase.from('conteggio_programmazioni').select('data_conteggio').lt('data_conteggio', targetDate).order('data_conteggio', { ascending: false })
    if (error) return toast.error(error.message)
    const days = [...new Set((source || []).map((row) => row.data_conteggio))]
    if (!days.length) return toast.warning('Non ci sono ancora giornate precedenti da copiare')
    setCopySourceDays(days)
    setCopyDialog({ targetDate, sourceDate: days[0] })
  }

  async function copyDay() {
    if (!copyDialog?.sourceDate) return
    setSaving(true)
    const { data: source, error } = await supabase.from('conteggio_programmazioni').select('*').eq('data_conteggio', copyDialog.sourceDate).order('posizione')
    if (error) { setSaving(false); return toast.error(error.message) }
    const payload = source
      .filter(({ venue_id }) => !data.countedVenueIds.includes(String(venue_id)))
      .map(({ employee_id, giro_id, venue_id, posizione, nota }) => ({ data_conteggio: copyDialog.targetDate, employee_id, giro_id, venue_id, posizione, nota }))
    const { error: deleteError } = await supabase.from('conteggio_programmazioni').delete().eq('data_conteggio', copyDialog.targetDate)
    if (deleteError) { setSaving(false); return toast.error(deleteError.message) }
    const { error: insertError } = await supabase.from('conteggio_programmazioni').upsert(payload, { onConflict: 'data_conteggio,employee_id,venue_id' })
    setSaving(false)
    if (insertError) return toast.error(insertError.message)
    const skipped = source.length - payload.length
    toast.success(`Giornata copiata${skipped ? ` · ${skipped} locali già conteggiati esclusi` : ''}`)
    setCopyDialog(null); await load()
  }

  return <>
    <section className="overflow-hidden rounded-[28px] border border-[#dfc98f] bg-[#fffdf9] shadow-[0_24px_55px_-38px_rgba(65,43,8,.68)]">
      <div className="flex items-center gap-3 border-b border-[#dfc98f] bg-[linear-gradient(135deg,#fff4d5,#e9c977)] p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#79500f] text-white"><CalendarCheck2 size={22}/></span>
        <div className="min-w-0 flex-1"><p className="text-[9px] font-black tracking-[.22em] text-[#966619]">ASSEGNAZIONI OPERATIVE</p><h2 className="text-[21px] font-black tracking-[.1em] text-[#3c290b]">PROGRAMMAZIONE CONTEGGI</h2><p className="mt-1 text-[11px] font-bold text-[#805718]">I locali vengono fotografati per il giorno scelto e non cambiano se modifichi il giro.</p></div>
      </div>
      <div className="space-y-2 p-3 md:p-5">
        {loading ? <p className="py-10 text-center text-xs font-black text-amber-700">CARICAMENTO PROGRAMMAZIONE…</p> : selectedDates.length === 0 ? <p className="rounded-2xl border border-dashed border-amber-300 p-8 text-center text-sm font-bold text-slate-400">Cerchia e salva almeno un giorno nel calendario.</p> : selectedDates.map((date) => {
          const groups = groupsForDay(date); const open = openDays.has(date); const count = groups.reduce((n, g) => n + g.rows.length, 0)
          return <article key={date} className="overflow-hidden rounded-[20px] border border-[#e3d4b6] bg-white">
            <button type="button" onClick={() => setOpenDays((s) => { const n = new Set(s); n.has(date) ? n.delete(date) : n.add(date); return n })} className="flex min-h-16 w-full items-center gap-3 px-4 text-left">
              <span className={`flex h-11 min-w-11 items-center justify-center rounded-[14px] font-black ${groups.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{date.slice(-2)}</span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-black text-slate-900">{dateLabel(date)}</span><span className={`mt-1 block text-[9px] font-black uppercase ${groups.length ? 'text-emerald-600' : 'text-amber-600'}`}>{groups.length ? `${groups.length} assegnazioni · ${count} locali` : 'DA PROGRAMMARE'}</span></span>{open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>} 
            </button>
            {open && <div className="space-y-2 border-t border-[#eadfca] bg-[#faf7f0] p-3">
              {groups.map((group) => <div key={`${group.employeeId}-${group.giroId}`} className="flex items-center gap-3 rounded-2xl border border-[#e2d4b8] bg-white p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4e7ca] text-[#845817]"><UserRound size={17}/></span>
                <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-black text-slate-900">{employeeById[group.employeeId]?.full_name || 'DIPENDENTE'}</p><p className="mt-1 text-[9px] font-black text-[#9a6b1b]">{giroLabel(giroById[group.giroId])} · {group.rows.length} LOCALI</p></div>
                <button onClick={() => openEditor(date, group)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 text-amber-700"><Pencil size={14}/></button>
                <button onClick={() => deleteGroup(date, group)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 text-red-600"><Trash2 size={14}/></button>
              </div>)}
              <div className="grid grid-cols-2 gap-2"><button onClick={() => openEditor(date)} className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#a87318,#70480d)] text-[10px] font-black text-white"><Plus size={14}/> NUOVA ASSEGNAZIONE</button><button onClick={() => openCopyDialog(date)} className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d6bd84] bg-white text-[10px] font-black text-[#805718]"><Copy size={14}/> COPIA GIORNATA</button></div>
            </div>}
          </article>
        })}
      </div>
    </section>

    {editor && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"><div className="flex max-h-[94vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-[#d6b76f] bg-[#fffdf9] shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="relative bg-[linear-gradient(135deg,#4a3009,#a87318)] p-5 text-center text-white"><button onClick={() => setEditor(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><X size={16}/></button><p className="text-[9px] font-black tracking-[.22em] text-amber-200">PIANO GIORNALIERO</p><h3 className="mt-1 text-[20px] font-black">{dateLabel(editor.date)}</h3></div>
      <div className="space-y-4 overflow-y-auto p-4">
        <div className="grid gap-3 md:grid-cols-2"><label className="text-[10px] font-black text-[#805718]">DIPENDENTE<select value={editor.employeeId} onChange={(e) => setEditor((x) => ({ ...x, employeeId: e.target.value }))} className="mt-1 h-12 w-full rounded-[14px] border border-[#dac493] bg-white px-3 text-sm font-bold text-slate-800"><option value="">Seleziona…</option>{data.employees.map((d) => <option key={d.auth_user_id} value={d.auth_user_id}>{d.full_name}</option>)}</select></label><label className="text-[10px] font-black text-[#805718]">GIRO<select value={editor.giroId} onChange={(e) => setGiro(e.target.value)} className="mt-1 h-12 w-full rounded-[14px] border border-[#dac493] bg-white px-3 text-sm font-bold text-slate-800"><option value="">Seleziona…</option>{data.giri.map((g) => <option key={g.id} value={g.id}>{giroLabel(g)}</option>)}</select></label></div>
        <label className="block text-[10px] font-black text-[#805718]">NOTA DI GIRO<input value={editor.note} onChange={(e) => setEditor((x) => ({ ...x, note: e.target.value }))} placeholder="Es. Passare prima da M05" className="mt-1 h-12 w-full rounded-[14px] border border-[#dac493] bg-white px-3 text-sm font-bold outline-none"/></label>
        <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black text-[#805718]">LOCALI E ORDINE TAPPE</p><span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-800">{editor.venueIds.length} SELEZIONATI</span></div>
          <div className="relative mb-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700"/><input value={editorSearch} onChange={(e) => setEditorSearch(e.target.value)} placeholder="Cerca subito un locale…" className="h-11 w-full rounded-[14px] border border-[#dac493] bg-white pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300"/></div>
          <div className="mb-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-800">{editor.giroId ? `MOSTRATI SOLO I ${selectedGiroVenueIds.size} LOCALI DEL GIRO SELEZIONATO` : 'SELEZIONA PRIMA UN GIRO PER VISUALIZZARE I SUOI LOCALI'}</div>
          <div className="grid max-h-[390px] gap-2 overflow-y-auto md:grid-cols-2">{data.venues.filter((v) => editor.giroId && selectedGiroVenueIds.has(String(v.id))).filter((v) => !String(v.id).toUpperCase().startsWith('D')).filter((v) => { const q = editorSearch.trim().toLowerCase(); return !q || `${v.id} ${v.name} ${v.city || ''} ${v.code || ''}`.toLowerCase().includes(q) }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'it')).map((venue) => { const index = editor.venueIds.indexOf(venue.id); const checked = index >= 0; const counted = data.countedVenueIds.includes(String(venue.id)); const locked = counted && !checked; return <div key={venue.id} className={`flex items-center gap-2 rounded-[15px] border p-2 ${counted ? 'border-emerald-200 bg-emerald-50/70' : checked ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'}`}><button disabled={locked} onClick={() => toggleVenue(venue.id)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border disabled:cursor-not-allowed ${counted ? 'border-emerald-600 bg-emerald-600 text-white' : checked ? 'border-amber-700 bg-amber-700 text-white' : 'border-slate-300 text-transparent'}`}><Check size={14}/></button><button disabled={locked} onClick={() => toggleVenue(venue.id)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"><span className={`block truncate text-[11px] font-black ${counted ? 'text-emerald-800' : 'text-slate-900'}`}>{venue.name}</span><span className={`mt-0.5 flex items-center gap-1 truncate text-[9px] font-bold ${counted ? 'text-emerald-600' : 'text-slate-400'}`}>{counted ? <><Check size={9}/>GIÀ CONTEGGIATO NEL PERIODO</> : <><MapPin size={9}/>{venue.city || 'Città non indicata'}</>}</span></button>{checked && !counted && <><span className="min-w-6 text-center text-[10px] font-black text-amber-700">{index + 1}</span><div className="grid"><button onClick={() => moveVenue(index, -1)} disabled={index === 0} className="text-amber-800 disabled:opacity-20"><ChevronUp size={15}/></button><button onClick={() => moveVenue(index, 1)} disabled={index === editor.venueIds.length - 1} className="text-amber-800 disabled:opacity-20"><ChevronDown size={15}/></button></div></>}</div>})}</div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2 border-t border-[#e4d5b7] bg-[#faf2e2] p-3"><button onClick={() => setEditor(null)} className="h-12 rounded-[14px] border border-[#d8c8a8] bg-white text-[10px] font-black text-slate-500">ANNULLA</button><button disabled={saving} onClick={saveEditor} className="h-12 rounded-[14px] bg-[linear-gradient(135deg,#a87318,#70480d)] text-[11px] font-black tracking-[.1em] text-white disabled:opacity-45">{saving ? 'SALVATAGGIO…' : 'PUBBLICA PROGRAMMAZIONE'}</button></div>
    </div></div>}

    {copyDialog && <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"><div className="w-full max-w-[520px] overflow-hidden rounded-[26px] border border-[#d6b76f] bg-[#fffdf9] shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="relative bg-[linear-gradient(135deg,#4a3009,#a87318)] p-5 text-center text-white"><button onClick={() => setCopyDialog(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><X size={16}/></button><p className="text-[9px] font-black tracking-[.22em] text-amber-200">DUPLICA PROGRAMMAZIONE</p><h3 className="mt-1 text-[19px] font-black">COPIA UNA GIORNATA</h3></div><div className="space-y-4 p-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold text-amber-900">Verranno copiate tutte le assegnazioni: dipendenti, giri, locali, ordine e note. Eventuali assegnazioni già presenti nel giorno di destinazione saranno sostituite.</div><label className="block text-[10px] font-black text-[#805718]">GIORNATA DA COPIARE<select value={copyDialog.sourceDate} onChange={(e) => setCopyDialog((x) => ({ ...x, sourceDate: e.target.value }))} className="mt-1 h-12 w-full rounded-[14px] border border-[#dac493] bg-white px-3 text-sm font-bold text-slate-800">{copySourceDays.map((day, index) => <option key={day} value={day}>GIORNATA {copySourceDays.length - index} · {dateLabel(day)}</option>)}</select></label><div className="rounded-2xl border border-[#e2d4b8] bg-white p-3"><p className="text-[9px] font-black text-slate-400">DESTINAZIONE</p><p className="mt-1 text-[12px] font-black text-slate-900">{dateLabel(copyDialog.targetDate)}</p></div></div><div className="grid grid-cols-[1fr_2fr] gap-2 border-t border-[#e4d5b7] bg-[#faf2e2] p-3"><button onClick={() => setCopyDialog(null)} className="h-12 rounded-[14px] border border-[#d8c8a8] bg-white text-[10px] font-black text-slate-500">ANNULLA</button><button disabled={saving} onClick={copyDay} className="h-12 rounded-[14px] bg-[linear-gradient(135deg,#a87318,#70480d)] text-[10px] font-black text-white disabled:opacity-45">{saving ? 'COPIA IN CORSO…' : 'COPIA TUTTA LA GIORNATA'}</button></div></div></div>}
  </>
}
