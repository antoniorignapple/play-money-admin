import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Building2, CalendarDays, Check, ChevronDown, ChevronUp, Clock3, Database, MapPin, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, User, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, EmptyState, Input } from '../components/ui'
import { PageLayout, PageBody } from '../components/PageLayout'
import { FormDialog, ConfirmDialog } from '../components/FormDialog'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { venueSortFn, formatEuro0, formatDateTime } from '../lib/helpers'

const PROTECTED_VENUES = new Set(['D01', 'D02', 'D03', 'D04', 'D05'])
const impactLabels = {
  machines: 'Change', change_reports: 'Report Change', movements_cassa: 'Movimenti Cassa', conteggi_tool: 'Conteggi', conteggi_admin_rows: 'Riepiloghi conteggi', calendario_conteggi: 'Calendario conteggi',
  giro_venue_assignments: 'Assegnazioni Giro', change_favorites: 'Preferiti Change', codici_favorites: 'Preferiti Codici',
  debiti: 'Debiti', debiti_movimenti: 'Movimenti Debiti', bonus: 'Bonus', bonus_movimenti: 'Movimenti Bonus',
  note_generiche: 'Note', simulazioni: 'Simulazioni', simulazioni_richieste: 'Richieste simulazioni',
}

function getChangeImage(name = '') {
  const value = String(name).toLowerCase()
  if (value.includes('apex')) return '/change-machine/apex-icon.png'
  if (value.includes('pocket')) return '/change-machine/pocket-icon.png'
  if (value.includes('twin')) return '/change-machine/twin-icon.png'
  if (value.includes('bell')) return '/change-machine/bell-icon.png'
  return '/change-machine/generic.png'
}
function generateVenueCode() {
  const values = new Uint32Array(1); crypto.getRandomValues(values)
  return String(100000 + (values[0] % 900000))
}

export default function LocaliPage() {
  const toast = useToast()
  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createVenueOpen, setCreateVenueOpen] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [editVenueOpen, setEditVenueOpen] = useState(false)
  const [createMachineOpen, setCreateMachineOpen] = useState(false)
  const [editingMachineId, setEditingMachineId] = useState(null)
  const [machineDraft, setMachineDraft] = useState(null)
  const [deleteMachineTarget, setDeleteMachineTarget] = useState(null)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [impact, setImpact] = useState(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteAccepted, setDeleteAccepted] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => { loadVenues() }, [])

  async function loadVenues() {
    setLoading(true)
    const [venueResult, profileResult, employeeResult] = await Promise.all([
      supabase.from('venues').select('*').order('name'),
      supabase.from('profiles').select('*'),
      supabase.from('dipendenti').select('auth_user_id,full_name'),
    ])
    if (venueResult.error) toast.error(venueResult.error.message)
    const people = [...(profileResult.data || []), ...(employeeResult.data || []).map((row) => ({ id: row.auth_user_id, display_name: row.full_name }))]
    setProfiles(people)
    const list = [...(venueResult.data || [])].sort(venueSortFn)
    setVenues(list)
    if (selectedVenue) {
      const refreshed = list.find((venue) => String(venue.id) === String(selectedVenue.id))
      if (refreshed) await selectVenue(refreshed)
    } else if (window.innerWidth >= 768 && list.length) await selectVenue(list[0])
    setLoading(false)
  }

  async function selectVenue(venue) {
    const machineResult = await supabase.from('machines').select('*').eq('venue_id', venue.id).order('name')
    const machines = machineResult.data || []
    let reports = []
    if (machines.length) {
      const historyResult = await supabase.from('machine_level_history').select('*').in('machine_id', machines.map((machine) => machine.id)).order('updated_at', { ascending: false })
      reports = historyResult.data || []
    }
    setSelectedVenue({ ...venue, machines })
    setHistory(reports)
    setHistoryOpen({})
    setEditingMachineId(null)
    setMachineDraft(null)
  }

  async function createVenue(values) {
    let created; let lastError
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = attempt ? generateVenueCode() : values.code
      const result = await supabase.from('venues').insert({ id: values.id, code, name: values.name, city: values.city, active: true, created_at: new Date().toISOString() }).select('*').single()
      if (!result.error) { created = result.data; break }
      lastError = result.error
      if (result.error.code !== '23505') break
    }
    if (!created) throw new Error(lastError?.message || 'Impossibile creare il locale')
    setCreateVenueOpen(false); await loadVenues(); await selectVenue(created); toast.success('Locale creato')
  }

  async function editVenue(values) {
    const { data, error } = await supabase.from('venues').update({ name: values.name, code: values.code, city: values.city, active: true }).eq('id', selectedVenue.id).select('*').single()
    if (error) throw new Error(error.message)
    setEditVenueOpen(false); await loadVenues(); await selectVenue(data); toast.success('Locale aggiornato')
  }

  async function createMachine(values) {
    const { data, error } = await supabase.from('machines').insert({ id: crypto.randomUUID(), venue_id: selectedVenue.id, name: values.name, fondo: Number(values.fondo || 0), level: 0, last_update: new Date().toISOString(), active: true }).select('*').single()
    if (error) throw new Error(error.message)
    setCreateMachineOpen(false); await selectVenue(selectedVenue); toast.success(`Change ${data.name} aggiunto`)
  }

  async function saveMachine(machine) {
    const { error } = await supabase.from('machines').update({ name: machineDraft.name, fondo: Number(machineDraft.fondo || 0) }).eq('id', machine.id)
    if (error) return toast.error(error.message)
    setEditingMachineId(null); setMachineDraft(null); await selectVenue(selectedVenue); toast.success('Change aggiornato')
  }

  async function deleteMachine() {
    const { error } = await supabase.from('machines').update({ active: false }).eq('id', deleteMachineTarget.id)
    if (error) throw new Error(error.message)
    setDeleteMachineTarget(null); await selectVenue(selectedVenue); toast.success('Change rimosso dalla visualizzazione')
  }

  async function openDangerArea() {
    if (PROTECTED_VENUES.has(String(selectedVenue.id).toUpperCase())) return toast.warning('I locali deposito D01-D05 sono protetti')
    setDangerOpen(true); setImpact(null); setImpactLoading(true); setDeleteConfirmation(''); setDeleteAccepted(false)
    const { data, error } = await supabase.rpc('preview_venue_deletion', { p_venue_id: selectedVenue.id })
    setImpactLoading(false)
    if (error) return toast.error(`Anteprima non disponibile: ${error.message}`)
    setImpact(data || {})
  }

  async function deleteVenuePermanently() {
    if (deleteConfirmation !== selectedVenue.id || !deleteAccepted) return
    setDeleting(true)
    const venueId = selectedVenue.id
    const { error } = await supabase.rpc('delete_venue_permanently', { p_venue_id: venueId, p_confirmation: deleteConfirmation })
    setDeleting(false)
    if (error) return toast.error(error.message)
    setDangerOpen(false); setSelectedVenue(null); setHistory([]); await loadVenues(); toast.success(`${venueId} eliminato definitivamente`)
  }

  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase()
    return venues.filter((venue) => !query || `${venue.id} ${venue.code} ${venue.name} ${venue.city || ''}`.toLowerCase().includes(query))
  }, [venues, search])
  const sortedMachines = useMemo(() => [...(selectedVenue?.machines || [])].filter((machine) => machine.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name))), [selectedVenue])
  const recentHistory = useMemo(() => history.filter((row) => new Date(row.updated_at || row.created_at).getTime() >= Date.now() - 31 * 86400000), [history])
  const totalLevel = sortedMachines.reduce((sum, machine) => sum + Number(machine.level || 0), 0)
  const totalFondo = sortedMachines.reduce((sum, machine) => sum + Number(machine.fondo || 0), 0)
  const lastUpdate = sortedMachines.map((machine) => machine.last_update).filter(Boolean).sort().at(-1)
  const personName = (id) => profiles.find((profile) => String(profile.id) === String(id))?.display_name || profiles.find((profile) => String(profile.id) === String(id))?.full_name || 'Operatore non disponibile'

  return (
    <PageLayout>
      <PageBody>
        <div className="flex min-h-full bg-[radial-gradient(circle_at_12%_0%,rgba(226,186,99,.18),transparent_27%),linear-gradient(180deg,#f7f2e8,#f3eee5)]">
          <aside className={`${selectedVenue ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-[#dfcfaa] bg-[#fffdf9]/95 md:w-[345px]`}>
            <div className="border-b border-[#e5d8bd] bg-[linear-gradient(135deg,#fff7e5,#ead08b)] p-4"><p className="text-[9px] font-black tracking-[.22em] text-[#9b6a19]">ANAGRAFICA</p><div className="mt-1 flex items-center justify-between"><h1 className="text-[24px] font-black tracking-[.12em] text-[#3c290b]">LOCALI</h1><button onClick={() => { setGeneratedCode(generateVenueCode()); setCreateVenueOpen(true) }} className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,#a97218,#6d470c)] text-white shadow-lg"><Plus size={17}/></button></div></div>
            <div className="border-b border-[#eadfca] p-3"><Input ref={searchRef} leftIcon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca locale, sigla, città…" /></div>
            <div className="flex-1 overflow-y-auto p-2">{loading ? <SkeletonList count={8}/> : filteredVenues.length === 0 ? <EmptyState icon={Building2} title="Nessun locale" description="Nessun risultato disponibile."/> : <div className="space-y-1">{filteredVenues.map((venue) => { const active = selectedVenue?.id === venue.id; return <button key={venue.id} onClick={() => selectVenue(venue)} className={`flex w-full items-center gap-3 rounded-[16px] border p-2.5 text-left transition ${active ? 'border-[#ad781d] bg-[linear-gradient(135deg,#fff1c8,#e8c874)] shadow-[0_12px_24px_-20px_rgba(85,52,2,.8)]' : 'border-transparent hover:border-[#e1d0aa] hover:bg-[#fff8e9]'}`}><span className={`flex h-10 min-w-14 items-center justify-center rounded-[12px] px-2 font-mono text-[11px] font-black ${active ? 'bg-[#80530d] text-white' : 'bg-[#f0e4cc] text-[#7b5518]'}`}>{venue.id}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-black uppercase text-[#33250f]">{venue.name}</span><span className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-bold text-slate-400"><MapPin size={9}/>{venue.city || 'Città non indicata'}</span></span></button>})}</div>}</div>
          </aside>

          <main className={`${selectedVenue ? 'block' : 'hidden md:block'} min-w-0 flex-1 overflow-y-auto p-3 md:p-5`}>
            {!selectedVenue ? <div className="flex min-h-[70vh] items-center justify-center"><EmptyState icon={Building2} title="Seleziona un locale" description="Scegli un locale per visualizzare la sua scheda premium."/></div> : <div className="mx-auto max-w-[1450px] space-y-4">
              <button onClick={() => setSelectedVenue(null)} className="inline-flex items-center gap-1 text-[12px] font-black text-[#8d5d13] md:hidden"><ArrowLeft size={14}/> TORNA AI LOCALI</button>
              <section className="relative overflow-hidden rounded-[30px] border border-[#d6b76c] bg-[linear-gradient(135deg,#fffdf8_0%,#f1dca9_100%)] p-5 shadow-[0_25px_60px_-38px_rgba(72,43,3,.8)] md:p-7"><div className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl"/><div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex min-w-0 items-center gap-4"><span className="flex h-16 min-w-20 items-center justify-center rounded-[19px] bg-[linear-gradient(135deg,#4b3008,#a26c17)] px-3 font-mono text-[18px] font-black text-white shadow-xl">{selectedVenue.id}</span><div className="min-w-0"><p className="text-[9px] font-black tracking-[.2em] text-[#9b6a19]">SCHEDA LOCALE</p><h2 className="truncate text-[25px] font-black uppercase tracking-[.05em] text-[#30210a] md:text-[32px]">{selectedVenue.name}</h2><p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#76521b]"><MapPin size={12}/>{selectedVenue.city || 'Città non indicata'} · CODICE {selectedVenue.code}</p></div></div><div className="flex gap-2"><button onClick={() => setEditVenueOpen(true)} className="flex h-11 items-center gap-2 rounded-[14px] border border-[#d0b16c] bg-white/75 px-4 text-[10px] font-black text-[#775016]"><Pencil size={14}/> MODIFICA</button><button onClick={() => setCreateMachineOpen(true)} className="flex h-11 items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#a97218,#70490d)] px-4 text-[10px] font-black text-white"><Plus size={14}/> NUOVO CHANGE</button></div></div></section>

              <section className="grid grid-cols-2 overflow-hidden rounded-[25px] border border-[#dfcfaa] bg-[#fffdf9] shadow-[0_20px_45px_-36px_rgba(62,38,3,.7)] md:grid-cols-5">{[['CHANGE',sortedMachines.length],['LIVELLO TOTALE',formatEuro0(totalLevel)],['FONDO TOTALE',formatEuro0(totalFondo)],['REPORT 31 GIORNI',recentHistory.length],['ULTIMO AGGIORNAMENTO',lastUpdate ? formatDateTime(lastUpdate) : '—']].map(([label,value])=><div key={label} className="border-b border-r border-[#eee4d1] px-3 py-5 text-center"><p className="text-[9px] font-black tracking-[.13em] text-slate-400">{label}</p><p className="mt-2 text-[17px] font-black text-[#33250f]">{value}</p></div>)}</section>

              <div className="flex items-center justify-between"><div><p className="text-[9px] font-black tracking-[.2em] text-[#a06c17]">PARCO MACCHINE</p><h3 className="text-[21px] font-black tracking-[.1em] text-[#3d2a0b]">CHANGE DEL LOCALE</h3></div><button onClick={() => selectVenue(selectedVenue)} className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#d6bd84] bg-white text-[#805718]"><RefreshCw size={15}/></button></div>
              {sortedMachines.length === 0 ? <div className="rounded-[25px] border border-[#e1d4b9] bg-white p-8"><EmptyState title="Nessun Change" description="Aggiungi il primo Change a questo locale."/></div> : <div className="grid gap-4 xl:grid-cols-2">{sortedMachines.map((machine) => { const reports = history.filter((row) => String(row.machine_id) === String(machine.id)); const open = !!historyOpen[machine.id]; const editing = editingMachineId === machine.id; return <article key={machine.id} className="overflow-hidden rounded-[26px] border border-[#d9c18a] bg-[#fffdf9] shadow-[0_22px_48px_-35px_rgba(66,39,3,.75)]"><div className="grid min-h-[235px] grid-cols-[145px_1fr]"><div className="relative flex items-end justify-center overflow-hidden border-r border-[#e2d3b3] bg-[radial-gradient(circle_at_50%_70%,#f0cb70,transparent_48%),linear-gradient(180deg,#fff8e6,#f1e0bd)] p-2"><img src={getChangeImage(machine.name)} alt={machine.name} className="relative z-10 max-h-[205px] w-auto object-contain drop-shadow-xl" onError={(event) => { event.currentTarget.src='/change-machine/generic.png' }}/></div><div className="flex flex-col p-4"><div className="flex items-start justify-between gap-2">{editing ? <Input value={machineDraft.name} onChange={(event)=>setMachineDraft((draft)=>({...draft,name:event.target.value.toUpperCase()}))}/> : <div><p className="text-[9px] font-black tracking-[.18em] text-[#a16d18]">CHANGE MACHINE</p><h4 className="mt-1 text-[20px] font-black uppercase text-[#30210a]">{machine.name}</h4></div>}<div className="flex gap-1">{editing ? <><button onClick={()=>saveMachine(machine)} className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#8e6015] text-white"><Check size={14}/></button><button onClick={()=>{setEditingMachineId(null);setMachineDraft(null)}} className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#ddd0b5]"><X size={14}/></button></> : <><button onClick={()=>{setEditingMachineId(machine.id);setMachineDraft({name:machine.name,fondo:machine.fondo})}} className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#dac493] text-[#815718]"><Pencil size={14}/></button><button onClick={()=>setDeleteMachineTarget(machine)} className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-red-200 text-red-600"><Trash2 size={14}/></button></>}</div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-[15px] bg-[#f6ecd7] p-3"><p className="text-[8px] font-black tracking-[.13em] text-[#987025]">LIVELLO ATTUALE</p><p className="mt-1 text-[23px] font-black text-emerald-700">{formatEuro0(machine.level)}</p></div><div className="rounded-[15px] bg-[#f6ecd7] p-3"><p className="text-[8px] font-black tracking-[.13em] text-[#987025]">FONDO</p>{editing ? <Input type="number" value={machineDraft.fondo} onChange={(event)=>setMachineDraft((draft)=>({...draft,fondo:event.target.value}))}/> : <p className="mt-1 text-[23px] font-black text-[#39270c]">{formatEuro0(machine.fondo)}</p>}</div></div><div className="mt-auto grid gap-1 pt-3 text-[10px] font-bold text-slate-400"><span className="flex items-center gap-1"><User size={11}/>{personName(machine.updated_by)}</span><span className="flex items-center gap-1"><Clock3 size={11}/>{formatDateTime(machine.last_update)}</span></div></div></div><button onClick={()=>setHistoryOpen((current)=>({...current,[machine.id]:!open}))} className="flex h-12 w-full items-center justify-between border-t border-[#e5d7bb] bg-[#faf2e2] px-4 text-[10px] font-black tracking-[.12em] text-[#805718]"><span>VEDI STORICO · {reports.length} REPORT</span>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>{open&&<div className="max-h-[330px] overflow-y-auto border-t border-[#eadfca] p-3">{reports.length===0?<p className="py-6 text-center text-xs font-bold text-slate-400">Nessun report disponibile</p>:<div className="space-y-2">{reports.map((report,index)=>{const current=Number(report.level ?? report.new_level ?? 0); const previous=Number(report.previous_level ?? reports[index+1]?.level ?? current); const delta=current-previous; return <div key={report.id || `${machine.id}-${index}`} className="flex items-center gap-3 rounded-[15px] border border-[#e6dcc8] bg-white p-3"><span className={`h-10 w-1 rounded-full ${delta>0?'bg-emerald-500':delta<0?'bg-red-500':'bg-amber-400'}`}/><div className="min-w-0 flex-1"><p className="text-[11px] font-black text-slate-800">{formatDateTime(report.updated_at || report.created_at)}</p><p className="mt-0.5 truncate text-[9px] font-bold text-slate-400">{personName(report.updated_by || report.created_by)}</p></div><div className="text-right"><p className="text-[13px] font-black text-slate-800">{formatEuro0(previous)} → {formatEuro0(current)}</p><p className={`text-[10px] font-black ${delta>0?'text-emerald-600':delta<0?'text-red-600':'text-amber-600'}`}>{delta>0?'+':''}{formatEuro0(delta)}</p></div></div>})}</div>}</div>}</article>})}</div>}

              <section className="overflow-hidden rounded-[26px] border border-red-200 bg-white shadow-[0_20px_45px_-38px_rgba(185,28,28,.65)]"><div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-red-50 text-red-600"><ShieldAlert size={20}/></span><div><p className="text-[9px] font-black tracking-[.18em] text-red-500">AREA PERICOLOSA</p><h3 className="mt-1 text-[17px] font-black text-red-900">ELIMINA DEFINITIVAMENTE IL LOCALE</h3><p className="mt-1 text-[11px] font-bold text-red-700/65">Rimuove il locale, i Change e tutti i dati collegati. Operazione irreversibile.</p></div></div><button disabled={PROTECTED_VENUES.has(String(selectedVenue.id).toUpperCase())} onClick={openDangerArea} className="h-11 rounded-[14px] border border-red-300 bg-red-600 px-5 text-[10px] font-black tracking-[.1em] text-white disabled:cursor-not-allowed disabled:opacity-35">{PROTECTED_VENUES.has(String(selectedVenue.id).toUpperCase())?'LOCALE PROTETTO':'APRI AREA PERICOLOSA'}</button></div></section>
            </div>}
          </main>
        </div>
      </PageBody>

      <FormDialog open={createVenueOpen} onClose={()=>setCreateVenueOpen(false)} title="Nuovo locale" submitLabel="Crea locale" initialValues={{code:generatedCode}} fields={[{name:'name',label:'Nome locale',required:true,autoUpper:true},{name:'id',label:'Sigla',required:true,autoUpper:true},{name:'code',label:'Codice numerico',required:true,pattern:'^[0-9]{6}$',patternError:'Servono sei cifre'},{name:'city',label:'Città'}]} onSubmit={createVenue}/>
      <FormDialog open={editVenueOpen} onClose={()=>setEditVenueOpen(false)} title="Modifica locale" submitLabel="Salva" initialValues={selectedVenue || {}} fields={[{name:'name',label:'Nome locale',required:true,autoUpper:true},{name:'code',label:'Codice numerico',required:true,pattern:'^[0-9]{6}$',patternError:'Servono sei cifre'},{name:'city',label:'Città'}]} onSubmit={editVenue}/>
      <FormDialog open={createMachineOpen} onClose={()=>setCreateMachineOpen(false)} title="Nuovo Change" submitLabel="Aggiungi" fields={[{name:'name',label:'Nome Change',required:true,autoUpper:true},{name:'fondo',label:'Fondo cassa',type:'number',defaultValue:0}]} onSubmit={createMachine}/>
      <ConfirmDialog open={!!deleteMachineTarget} onClose={()=>setDeleteMachineTarget(null)} title="RIMUOVERE IL CHANGE?" message={deleteMachineTarget?`Il Change ${deleteMachineTarget.name} non sarà più visibile. Lo storico resta conservato.`:''} confirmLabel="RIMUOVI" onConfirm={deleteMachine}/>

      {dangerOpen&&<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={()=>!deleting&&setDangerOpen(false)}><div className="max-h-[94vh] w-full max-w-[620px] overflow-y-auto rounded-[30px] border border-red-400/45 bg-[#fffdf9] shadow-[0_40px_100px_-28px_rgba(0,0,0,.95)]" onClick={(event)=>event.stopPropagation()}><div className="relative bg-[linear-gradient(135deg,#4b0909,#9f1d1d)] p-5 text-center text-white"><button onClick={()=>setDangerOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/15 bg-white/10"><X size={15}/></button><ShieldAlert className="mx-auto" size={30}/><p className="mt-2 text-[9px] font-black tracking-[.24em] text-red-200">CANCELLAZIONE IRREVERSIBILE</p><h2 className="mt-1 text-[21px] font-black">ELIMINA {selectedVenue?.id} · {selectedVenue?.name}</h2></div><div className="p-5">{impactLoading?<div className="py-12 text-center"><RefreshCw className="mx-auto animate-spin text-red-600"/><p className="mt-3 text-xs font-black text-slate-500">Analisi dei dati collegati…</p></div>:impact?<><div className="grid grid-cols-2 gap-2 md:grid-cols-3">{Object.entries(impact).map(([key,value])=><div key={key} className="rounded-[15px] border border-red-100 bg-red-50/55 p-3 text-center"><p className="text-[8px] font-black uppercase tracking-[.1em] text-red-500">{impactLabels[key]||key}</p><p className="mt-1 text-[21px] font-black text-red-900">{Number(value)||0}</p></div>)}</div><div className="mt-4 rounded-[17px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-relaxed text-amber-900"><Database size={15} className="mb-1"/>Tutti questi dati verranno eliminati in un’unica operazione. Se una sola eliminazione fallisce, il database annullerà tutto.</div><label className="mt-4 block text-[10px] font-black uppercase tracking-[.1em] text-slate-600">Scrivi esattamente {selectedVenue?.id}</label><Input value={deleteConfirmation} onChange={(event)=>setDeleteConfirmation(event.target.value.toUpperCase())} className="mt-1 text-center font-mono font-black"/><label className="mt-3 flex cursor-pointer items-start gap-2 rounded-[14px] border border-red-100 p-3 text-[11px] font-bold text-red-900"><input type="checkbox" checked={deleteAccepted} onChange={(event)=>setDeleteAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600"/>Ho compreso che il locale e tutti i dati collegati saranno eliminati definitivamente.</label><button disabled={deleteConfirmation!==selectedVenue?.id||!deleteAccepted||deleting} onClick={deleteVenuePermanently} className="mt-4 h-13 w-full rounded-[15px] bg-[linear-gradient(135deg,#c51f1f,#7d0c0c)] text-[11px] font-black tracking-[.11em] text-white disabled:opacity-35">{deleting?'ELIMINAZIONE IN CORSO…':`ELIMINA DEFINITIVAMENTE ${selectedVenue?.id}`}</button></>:<p className="py-10 text-center text-sm font-bold text-red-700">Impossibile caricare l’anteprima. Nessun dato può essere eliminato.</p>}</div></div></div>}
    </PageLayout>
  )
}
