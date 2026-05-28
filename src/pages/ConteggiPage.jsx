import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Lock, Unlock, RefreshCw, Search, Users, Building2, FileText, TrendingUp,
  Download, Eye, Trash2, ChevronDown, ChevronUp, MapPin, Calendar, Filter,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import generateConteggiPdf from '../lib/generateConteggiPdf'
import {
  Button, IconButton, Input, Select, Badge, EmptyState, Stat, Card, Field, Modal,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { initials, avatarColor } from '../lib/helpers'

const fmtEuro = (n) => `${Math.trunc(Number(n) || 0).toLocaleString('it-IT')} €`
const fmtSigned = (n) => {
  const v = Math.trunc(Number(n) || 0)
  if (v > 0) return `+${v.toLocaleString('it-IT')} €`
  if (v < 0) return `-${Math.abs(v).toLocaleString('it-IT')} €`
  return '0 €'
}
const clsSigned = (n) => {
  const v = Number(n) || 0
  if (v > 0) return 'text-[var(--color-success)]'
  if (v < 0) return 'text-[var(--color-danger)]'
  return 'text-[var(--color-text-secondary)]'
}
const formatITDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
const monthIT = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function formatPeriodTitle(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 'Conteggi'
  const [yf, mf, df] = String(dateFrom).split('-')
  const [yt, mt, dt] = String(dateTo).split('-')
  if (mf === mt && yf === yt) return `Conteggi ${Number(df)}-${Number(dt)} ${monthIT[Number(mf)]} ${yf}`
  return `Conteggi ${formatITDate(dateFrom)} - ${formatITDate(dateTo)}`
}

const todayKey = () => new Date().toISOString().slice(0, 10)

function sortVenueIds(a, b) {
  const aId = String(a?.id || a?.venue_id || '')
  const bId = String(b?.id || b?.venue_id || '')
  const aLetter = aId.charAt(0), bLetter = bId.charAt(0)
  if (aLetter !== bLetter) {
    if (aLetter === 'K') return -1
    if (bLetter === 'K') return 1
  }
  const aNum = parseInt(aId.replace(/\D/g, ''), 10) || 0
  const bNum = parseInt(bId.replace(/\D/g, ''), 10) || 0
  return aNum - bNum
}

export default function ConteggiPage() {
  const toast = useToast()
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [periods, setPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [operatorFilter, setOperatorFilter] = useState('all')
  const [venueFilter, setVenueFilter] = useState('all')
  const [signFilter, setSignFilter] = useState('all')
  const [selectedRow, setSelectedRow] = useState(null)

  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [operatorsOpen, setOperatorsOpen] = useState(false)

  const [newPeriod, setNewPeriod] = useState({ date_from: todayKey(), date_to: todayKey() })

  const venueById = useMemo(() => {
    const map = {}
    venues.forEach((v) => { map[String(v.id)] = v })
    return map
  }, [venues])

  const dipendenteByAuthId = useMemo(() => {
    const map = {}
    dipendenti.forEach((dip) => { if (dip.auth_user_id) map[String(dip.auth_user_id)] = dip })
    return map
  }, [dipendenti])

  const selectedPeriod = useMemo(() => periods.find((p) => p.id === selectedPeriodId) || null, [periods, selectedPeriodId])
  const isClosed = selectedPeriod?.status === 'closed'

  function getVenueName(row) {
    const venue = venueById[String(row.venue_id)]
    if (!venue) return row.venue_id || 'Locale sconosciuto'
    const id = String(venue.id || '').trim()
    const name = String(venue.name || '').trim()
    if (name.toLowerCase().startsWith(id.toLowerCase())) return name
    return `${id} ${name}`
  }

  function getOperatorName(row) {
    if (!row) return 'Operaio sconosciuto'
    if (row.operator_name) return String(row.operator_name)
    if (row.user_id) {
      const dip = dipendenteByAuthId[String(row.user_id)]
      if (dip) return dip.full_name || dip.nome_completo || dip.display_name || dip.nome || dip.email || String(row.user_id).slice(0, 8)
      return String(row.user_id).slice(0, 8)
    }
    return 'Operaio sconosciuto'
  }

  async function loadBaseData() {
    const [{ data: venuesData }, { data: dipendentiData }] = await Promise.all([
      supabase.from('venues').select('*'),
      supabase.from('dipendenti').select('*'),
    ])
    setVenues([...(venuesData || [])].sort(sortVenueIds))
    setDipendenti(dipendentiData || [])
  }

  async function loadPeriods() {
    const { data, error } = await supabase
      .from('conteggi_periods').select('id,title,date_from,date_to,status,note')
      .order('date_from', { ascending: false })
    if (error) { toast.error(`Errore: ${error.message}`); return }
    setPeriods(data || [])
    if (data?.length) setSelectedPeriodId((current) => current || data[0].id)
  }

  async function loadDashboard(periodId = selectedPeriodId) {
    if (!periodId) return
    try {
      setLoading(true)
      const { data: sumRows } = await supabase
        .from('conteggi_admin_summary').select('*').eq('period_id', periodId).maybeSingle()
      const { data: detailRows, error: rowsErr } = await supabase
        .from('conteggi_admin_rows').select('*').eq('period_id', periodId).order('venue_id', { ascending: true })
      if (rowsErr) throw rowsErr
      setSummary(sumRows || null)
      setRows(detailRows || [])
    } catch (e) { toast.error(`Errore: ${e.message}`) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadBaseData(); loadPeriods() }, [])
  useEffect(() => {
    setOperatorFilter('all'); setVenueFilter('all'); setSignFilter('all'); setSearch('')
    if (selectedPeriodId) loadDashboard(selectedPeriodId)
  }, [selectedPeriodId])

  const operators = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => set.add(getOperatorName(r)))
    return Array.from(set).sort()
  }, [rows, dipendenti])

  const countedVenues = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      if (!map.has(String(r.venue_id))) {
        map.set(String(r.venue_id), { id: r.venue_id, name: getVenueName(r) })
      }
    })
    return Array.from(map.values()).sort(sortVenueIds)
  }, [rows, venues])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const venueName = getVenueName(r).toLowerCase()
      const opName = getOperatorName(r).toLowerCase()
      const finale = Number(r.totale_finale) || 0
      const matchSearch = !q || venueName.includes(q) || opName.includes(q)
      const matchOperator = operatorFilter === 'all' || getOperatorName(r) === operatorFilter
      const matchVenue = venueFilter === 'all' || String(r.venue_id) === String(venueFilter)
      const matchSign = signFilter === 'all'
        || (signFilter === 'positive' && finale > 0)
        || (signFilter === 'negative' && finale < 0)
        || (signFilter === 'zero' && finale === 0)
      return matchSearch && matchOperator && matchVenue && matchSign
    })
  }, [rows, search, operatorFilter, venueFilter, signFilter, venues, dipendenti])

  const filteredSummary = useMemo(() => filteredRows.reduce((a, r) => {
    a.conteggi += 1
    a.locali.add(String(r.venue_id))
    a.operatori.add(getOperatorName(r))
    a.esattore += Number(r.esattore) || 0
    a.ricevute += Number(r.acconti) || 0
    a.riporto += Number(r.riporto) || 0
    a.assegni += Number(r.assegno) || 0
    a.debiti += Number(r.debito) || 0
    a.cassaDepositi += (Number(r.carta) || 0) + (Number(r.monete) || 0) - (Number(r.uso_cassa) || 0)
    a.finale += Number(r.totale_finale) || 0
    return a
  }, { conteggi: 0, locali: new Set(), operatori: new Set(), esattore: 0, ricevute: 0, riporto: 0, assegni: 0, debiti: 0, cassaDepositi: 0, finale: 0 }), [filteredRows])

  const operatorStats = useMemo(() => {
    const map = {}
    rows.forEach((r) => {
      const name = getOperatorName(r)
      if (!map[name]) map[name] = { name, count: 0, finale: 0, esattore: 0, ricevute: 0 }
      map[name].count += 1
      map[name].finale += Number(r.totale_finale) || 0
      map[name].esattore += Number(r.esattore) || 0
      map[name].ricevute += Number(r.acconti) || 0
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [rows, dipendenti])

  const missingVenues = useMemo(() => {
    const counted = new Set(rows.map((r) => String(r.venue_id)))
    return venues.filter((v) => !counted.has(String(v.id))).sort(sortVenueIds)
  }, [rows, venues])

  async function createPeriod() {
    if (!newPeriod.date_from || !newPeriod.date_to) return toast.warning('Inserisci le date')
    const title = formatPeriodTitle(newPeriod.date_from, newPeriod.date_to)
    const { error } = await supabase.from('conteggi_periods').insert({
      title, date_from: newPeriod.date_from, date_to: newPeriod.date_to, status: 'open', note: null,
    })
    if (error) return toast.error(error.message)
    setShowNewPeriod(false)
    setNewPeriod({ date_from: todayKey(), date_to: todayKey() })
    toast.success(`Periodo "${title}" creato`)
    await loadPeriods()
  }

  async function deletePeriod() {
    if (!selectedPeriod) return
    const title = selectedPeriod.title
    await supabase.from('conteggi_admin_rows').update({ period_id: null, locked: false }).eq('period_id', selectedPeriod.id)
    const { error } = await supabase.from('conteggi_periods').delete().eq('id', selectedPeriod.id)
    if (error) { toast.error(error.message); return }
    setSelectedPeriodId('')
    setConfirmDeletePeriod(false)
    toast.success(`"${title}" eliminato`)
    await loadPeriods()
  }

  async function togglePeriodStatus() {
    if (!selectedPeriod) return
    const nextStatus = selectedPeriod.status === 'closed' ? 'open' : 'closed'
    const { error } = await supabase.from('conteggi_periods').update({ status: nextStatus }).eq('id', selectedPeriod.id)
    if (error) return toast.error(error.message)
    await supabase.from('conteggi_admin_rows').update({ locked: nextStatus === 'closed' }).eq('period_id', selectedPeriod.id)
    toast.success(nextStatus === 'closed' ? 'Periodo chiuso' : 'Periodo riaperto')
    await loadPeriods()
    await loadDashboard(selectedPeriod.id)
  }

  async function handleGeneratePdf(title, pdfRows) {
    const venuesSelected = pdfRows.map((r) => {
      const venue = venueById[String(r.venue_id)]
      return { id: r.venue_id, name: venue?.name || r.venue_id || 'Locale sconosciuto' }
    })
    const toolData = {}
    pdfRows.forEach((r) => { toolData[r.venue_id] = { ...r, ricevute: r.acconti } })
    await generateConteggiPdf({
      venuesSelected, totalsByVenueId: {}, toolData,
      dateFrom: selectedPeriod?.date_from, dateTo: selectedPeriod?.date_to,
      dipendenteName: title, userEmail: '', targetWin: null,
    })
    toast.success('PDF generato')
  }

  const activeFiltersCount =
    (operatorFilter !== 'all' ? 1 : 0) +
    (venueFilter !== 'all' ? 1 : 0) +
    (signFilter !== 'all' ? 1 : 0)

  return (
    <PageLayout>
      <PageHeader
        title="Conteggi"
        subtitle={selectedPeriod ? selectedPeriod.title : 'Nessun periodo'}
        actions={
          <>
            <Button icon={Plus} onClick={() => setShowNewPeriod(true)} disabled={isClosed}>
              <span className="hidden md:inline">Nuovo periodo</span>
              <span className="md:hidden">Nuovo</span>
            </Button>
            {selectedPeriod && (
              <Button
                icon={isClosed ? Unlock : Lock}
                variant={isClosed ? 'primary' : 'secondary'}
                onClick={togglePeriodStatus}
              >
                <span className="hidden md:inline">{isClosed ? 'Riapri periodo' : 'Chiudi periodo'}</span>
                <span className="md:hidden">{isClosed ? 'Riapri' : 'Chiudi'}</span>
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          {/* Period bar */}
          <Card>
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end md:gap-4 md:p-4">
              <Field label="Periodo">
                <Select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                  {periods.length === 0 && <option value="">Nessun periodo</option>}
                  {periods.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                </Select>
              </Field>
              <div>
                <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">Date</p>
                <p className="text-[13px] font-medium text-[var(--color-text)] tabular-nums">
                  {selectedPeriod ? `${formatITDate(selectedPeriod.date_from)} → ${formatITDate(selectedPeriod.date_to)}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">Stato</p>
                {selectedPeriod ? (
                  <Badge variant={isClosed ? 'warning' : 'success'} size="sm">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${isClosed ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'}`} />
                    {isClosed ? 'Chiuso' : 'Aperto'}
                  </Badge>
                ) : <span className="text-[12px] text-[var(--color-text-muted)]">—</span>}
              </div>
              {selectedPeriod && (
                <IconButton icon={Trash2} variant="danger" onClick={() => setConfirmDeletePeriod(true)} disabled={isClosed} title="Elimina periodo" />
              )}
            </div>
          </Card>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <Stat
              label="Totale finale"
              value={fmtSigned(filteredSummary.finale)}
              hint={`${filteredSummary.conteggi} conteggi · ${filteredSummary.locali.size} locali`}
              tone={filteredSummary.finale > 0 ? 'success' : filteredSummary.finale < 0 ? 'danger' : 'default'}
              icon={TrendingUp}
            />
            <Stat label="Conteggi" value={filteredSummary.conteggi} icon={FileText} />
            <Stat label="Locali" value={filteredSummary.locali.size} icon={Building2} />
            <Stat label="Operatori" value={filteredSummary.operatori.size} icon={Users} />
          </div>

          {/* Mini totals */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <MiniStat label="Esattore" value={fmtEuro(filteredSummary.esattore)} />
            <MiniStat label="Ricevute" value={fmtEuro(filteredSummary.ricevute)} />
            <MiniStat label="Da riportare" value={fmtEuro(filteredSummary.riporto)} />
            <MiniStat label="Cassa/Dep." value={fmtEuro(filteredSummary.cassaDepositi)} />
            <MiniStat label="Assegni" value={fmtEuro(filteredSummary.assegni)} />
            <MiniStat label="Debiti" value={fmtEuro(filteredSummary.debiti)} />
          </div>

          {/* Filters toolbar */}
          <Card>
            {/* Desktop filters */}
            <div className="hidden md:flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-[240px] flex-1">
                <Input leftIcon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca locale o operaio…" />
              </div>
              <Select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)} className="w-44">
                <option value="all">Tutti gli operatori</option>
                {operators.map((op) => (<option key={op} value={op}>{op}</option>))}
              </Select>
              <Select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)} className="w-44">
                <option value="all">Tutti i locali</option>
                {countedVenues.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
              </Select>
              <Select value={signFilter} onChange={(e) => setSignFilter(e.target.value)} className="w-40">
                <option value="all">Tutti i risultati</option>
                <option value="positive">Solo positivi</option>
                <option value="negative">Solo negativi</option>
                <option value="zero">Solo zero</option>
              </Select>
              <IconButton icon={RefreshCw} onClick={() => loadDashboard()} title="Aggiorna" />
              <Button icon={Download} variant="primary" onClick={() => handleGeneratePdf('PDF Conteggi Periodo', filteredRows)}>
                PDF
              </Button>
            </div>

            {/* Mobile toolbar */}
            <div className="flex flex-col gap-2 p-3 md:hidden">
              <Input leftIcon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca locale o operaio…" />
              <div className="flex gap-2">
                <Button variant="secondary" icon={Filter} onClick={() => setFiltersOpen(true)} className="flex-1">
                  Filtri {activeFiltersCount > 0 && <Badge variant="accent" size="sm" className="ml-1">{activeFiltersCount}</Badge>}
                </Button>
                <IconButton icon={RefreshCw} onClick={() => loadDashboard()} title="Aggiorna" />
                <Button icon={Download} variant="primary" onClick={() => handleGeneratePdf('PDF Conteggi Periodo', filteredRows)}>
                  PDF
                </Button>
              </div>
            </div>
          </Card>

          {/* Operatori — collapsible su mobile, sidebar desktop */}
          <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            {/* Operators panel */}
            <Card className="xl:order-first">
              <button
                type="button"
                onClick={() => setOperatorsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2.5 text-left md:cursor-default md:px-4 md:py-3 xl:pointer-events-none"
              >
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text)]">Operatori</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {operatorStats.length} attivi
                    {operatorFilter !== 'all' && ' · filtro attivo'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {operatorFilter !== 'all' && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOperatorFilter('all') }}>Reset</Button>
                  )}
                  <span className="xl:hidden">
                    {operatorsOpen ? <ChevronUp size={15} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={15} className="text-[var(--color-text-muted)]" />}
                  </span>
                </div>
              </button>
              <div className={`${operatorsOpen ? 'block' : 'hidden'} xl:block max-h-[400px] xl:max-h-[600px] overflow-y-auto p-2`}>
                {operatorStats.length === 0 && (
                  <EmptyState icon={Users} title="Nessun operatore" description="Non ci sono conteggi in questo periodo." />
                )}
                <div className="flex flex-col gap-1">
                  {operatorStats.map((op) => {
                    const active = operatorFilter === op.name
                    return (
                      <button
                        key={op.name}
                        onClick={() => setOperatorFilter(active ? 'all' : op.name)}
                        className={`group flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)]'
                            : 'border-transparent hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(op.name)}`}>
                          {initials(op.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{op.name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                            {op.count} conteggi · {fmtEuro(op.esattore)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-[13px] font-semibold tabular-nums ${clsSigned(op.finale)}`}>
                            {fmtSigned(op.finale)}
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              handleGeneratePdf(`PDF ${op.name}`, rows.filter((r) => getOperatorName(r) === op.name))
                            }}
                            className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--color-text-muted)] transition-opacity hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] md:opacity-0 md:group-hover:opacity-100"
                            title="PDF operatore"
                          >
                            <Download size={11} strokeWidth={2} />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>

            {/* Details / conteggi list */}
            <Card>
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5 md:px-4 md:py-3">
                <p className="text-[13px] font-medium text-[var(--color-text)]">Dettaglio conteggi</p>
                <Badge variant="default" size="sm">{filteredRows.length} risultati</Badge>
              </div>
              <div className="max-h-[600px] overflow-y-auto p-2 md:p-3">
                {loading && (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-[var(--color-border)] p-3">
                        <Skeleton variant="text" className="w-1/3 mb-2" />
                        <Skeleton variant="text" className="w-1/2" />
                      </div>
                    ))}
                  </div>
                )}
                {!loading && filteredRows.length === 0 && (
                  <EmptyState title="Nessun conteggio" description="Modifica i filtri per vedere risultati." />
                )}
                <div className="flex flex-col gap-2">
                  {!loading && filteredRows.map((r) => (
                    <div
                      key={r.id}
                      className="group rounded-lg border border-[var(--color-border)] bg-white p-3 transition-colors hover:border-[var(--color-border-strong)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">{r.venue_id}</span>
                            <span className="text-[var(--color-text-muted)]">·</span>
                            <p className="text-[13px] font-medium text-[var(--color-text)] md:text-[14px]">{getVenueName(r)}</p>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
                            <span className="inline-flex items-center gap-1"><Users size={11} strokeWidth={2} />{getOperatorName(r)}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 tabular-nums"><Calendar size={11} strokeWidth={2} />{formatITDate(r.conteggio_date)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[14px] font-semibold tabular-nums md:text-[15px] ${clsSigned(r.totale_finale)}`}>
                            {fmtSigned(r.totale_finale)}
                          </span>
                          <div className="flex items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                            <IconButton icon={Eye} size="sm" onClick={() => setSelectedRow(r)} title="Dettagli" />
                            <IconButton
                              icon={Download} size="sm"
                              onClick={() => handleGeneratePdf(`PDF ${getVenueName(r)}`, [r])}
                              title="PDF"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-7">
                        <Chip label="Esattore" value={fmtEuro(r.esattore)} />
                        <Chip label="Ricevute" value={fmtEuro(r.acconti)} />
                        <Chip label="Riporto" value={fmtEuro(r.riporto)} />
                        <Chip label="Assegni" value={fmtEuro(r.assegno)} />
                        <Chip label="Debiti" value={fmtEuro(r.debito)} />
                        <Chip label="Bonus" value={fmtEuro(r.bonus)} />
                        <Chip
                          label="Cassa"
                          value={fmtEuro((Number(r.carta) || 0) + (Number(r.monete) || 0) - (Number(r.uso_cassa) || 0))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Missing venues */}
          <Card>
            <button
              type="button"
              onClick={() => setShowMissing((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-hover)] md:px-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                  <MapPin size={13} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">Locali non conteggiati</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    {missingVenues.length} locali ancora senza conteggio
                  </p>
                </div>
              </div>
              {showMissing ? <ChevronUp size={15} className="shrink-0 text-[var(--color-text-muted)]" /> : <ChevronDown size={15} className="shrink-0 text-[var(--color-text-muted)]" />}
            </button>
            {showMissing && (
              <div className="border-t border-[var(--color-border)]">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Codice</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Locale</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Città</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingVenues.map((v) => (
                        <tr key={v.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]">
                          <td className="px-4 py-2 font-mono text-[12px] tabular-nums text-[var(--color-text-muted)]">{v.id}</td>
                          <td className="px-4 py-2 font-medium text-[var(--color-text)]">{v.name}</td>
                          <td className="px-4 py-2 text-[var(--color-text-muted)]">{v.city || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[var(--color-border)]">
                  {missingVenues.map((v) => (
                    <div key={v.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-[44px] items-center justify-center rounded bg-[var(--color-surface)] font-mono text-[11px] font-bold text-[var(--color-text-secondary)]">{v.id}</span>
                        <p className="text-[13px] font-medium text-[var(--color-text)] truncate">{v.name}</p>
                      </div>
                      {v.city && (
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          <MapPin size={9} strokeWidth={2} className="inline mr-0.5" />{v.city}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </PageBody>

      {/* Modal nuovo periodo */}
      <Modal
        open={showNewPeriod}
        onClose={() => setShowNewPeriod(false)}
        title="Nuovo periodo"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewPeriod(false)}>Annulla</Button>
            <Button variant="primary" onClick={createPeriod}>Crea periodo</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Titolo automatico</p>
            <p className="mt-0.5 text-[14px] font-medium text-[var(--color-text)]">
              {formatPeriodTitle(newPeriod.date_from, newPeriod.date_to)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dal">
              <Input type="date" value={newPeriod.date_from} onChange={(e) => setNewPeriod((p) => ({ ...p, date_from: e.target.value }))} />
            </Field>
            <Field label="Al">
              <Input type="date" value={newPeriod.date_to} onChange={(e) => setNewPeriod((p) => ({ ...p, date_to: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Modal filtri mobile */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtri"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setOperatorFilter('all'); setVenueFilter('all'); setSignFilter('all')
            }}>Azzera</Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>Applica</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Operatore">
            <Select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
              <option value="all">Tutti gli operatori</option>
              {operators.map((op) => (<option key={op} value={op}>{op}</option>))}
            </Select>
          </Field>
          <Field label="Locale">
            <Select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
              <option value="all">Tutti i locali</option>
              {countedVenues.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </Select>
          </Field>
          <Field label="Risultato">
            <Select value={signFilter} onChange={(e) => setSignFilter(e.target.value)}>
              <option value="all">Tutti i risultati</option>
              <option value="positive">Solo positivi</option>
              <option value="negative">Solo negativi</option>
              <option value="zero">Solo zero</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeletePeriod}
        onClose={() => setConfirmDeletePeriod(false)}
        title="Elimina periodo"
        message={selectedPeriod ? `Vuoi eliminare il periodo "${selectedPeriod.title}"? I conteggi non verranno cancellati ma scollegati dal periodo.` : ''}
        confirmLabel="Elimina"
        onConfirm={deletePeriod}
      />

      {/* Detail row modal */}
      <Modal
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title="Dettaglio conteggio"
        width="lg"
        footer={
          selectedRow && (
            <Button icon={Download} variant="primary" onClick={() => handleGeneratePdf(`PDF ${getVenueName(selectedRow)}`, [selectedRow])}>
              Scarica PDF
            </Button>
          )
        }
      >
        {selectedRow && (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--color-text-muted)]">
                  <span className="font-mono tabular-nums">{selectedRow.venue_id}</span>
                  <span>·</span>
                  <span className="truncate">{getOperatorName(selectedRow)}</span>
                  <span>·</span>
                  <span className="tabular-nums">{formatITDate(selectedRow.conteggio_date)}</span>
                </div>
                <h3 className="mt-1 text-[16px] font-semibold text-[var(--color-text)] md:text-[18px]">{getVenueName(selectedRow)}</h3>
              </div>
              <div className={`text-[20px] font-semibold tabular-nums shrink-0 md:text-[26px] ${clsSigned(selectedRow.totale_finale)}`}>
                {fmtSigned(selectedRow.totale_finale)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Detail label="Esattore" value={fmtEuro(selectedRow.esattore)} />
              <Detail label="Ricevute" value={fmtEuro(selectedRow.acconti)} />
              <Detail label="Da riportare" value={fmtEuro(selectedRow.riporto)} />
              <Detail label="Assegni" value={fmtEuro(selectedRow.assegno)} />
              <Detail label="Debiti" value={fmtEuro(selectedRow.debito)} />
              <Detail label="Debito virtuale" value={fmtEuro(selectedRow.debito_virt)} />
              <Detail label="Carta" value={fmtEuro(selectedRow.carta)} />
              <Detail label="Monete" value={fmtEuro(selectedRow.monete)} />
              <Detail label="Uso cassa" value={fmtEuro(selectedRow.uso_cassa)} />
              <Detail label="Bonus" value={fmtEuro(selectedRow.bonus)} />
            </div>
          </>
        )}
      </Modal>
    </PageLayout>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-2 shadow-sm md:px-3">
      <p className="text-[9px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide md:text-[10px]">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-[var(--color-text)] md:text-[13px]">{value}</p>
    </div>
  )
}

function Chip({ label, value }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
      <p className="text-[9px] font-medium text-[var(--color-text-muted)] md:text-[10px]">{label}</p>
      <p className="text-[11px] font-medium tabular-nums text-[var(--color-text)] md:text-[12px]">{value}</p>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--color-text)]">{value}</p>
    </div>
  )
}
