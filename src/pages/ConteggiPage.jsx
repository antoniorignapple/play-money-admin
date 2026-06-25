import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Lock, Unlock, RefreshCw, Search, Users, Building2, FileText, TrendingUp,
  Download, Eye, Trash2, ChevronDown, ChevronUp, MapPin, Calendar, Filter, Archive, RotateCcw,
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


function getArchiveClosedAt(note) {
  const text = String(note || '')
  const match = text.match(/\[ARCHIVE_CLOSED_AT:([^\]]+)\]/)
  return match?.[1] || null
}

function withArchiveClosedAt(note, closedAt) {
  const clean = String(note || '').replace(/\n?\[ARCHIVE_CLOSED_AT:[^\]]+\]/g, '').trim()
  return `${clean}${clean ? '\n' : ''}[ARCHIVE_CLOSED_AT:${closedAt}]`
}

function withoutArchiveClosedAt(note) {
  return String(note || '').replace(/\n?\[ARCHIVE_CLOSED_AT:[^\]]+\]/g, '').trim() || null
}

function isAutoDaRiportareMovement(m) {
  return Math.trunc(Number(m?.da_riportare) || 0) > 0
    && Math.trunc(Number(m?.acconto) || 0) === 0
    && Math.trunc(Number(m?.recupero) || 0) === 0
    && String(m?.note || '').toLowerCase().includes('caricato automaticamente da conteggi')
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

function getCassaDepositi(row) {
  return (Number(row?.carta) || 0) + (Number(row?.monete) || 0) - (Number(row?.uso_cassa) || 0)
}

const EMPLOYEE_DEPOSIT_CODE_BY_NAME = [
  { keys: ["D APRILE MASSIMO", "DAPRILE MASSIMO", "APRILE MASSIMO", "MASSIMO D APRILE", "MASSIMO DAPRILE"], code: 'D01' },
  { keys: ['PAPAGNI GIOVANNI', 'GIOVANNI PAPAGNI', 'PAPAGNI'], code: 'D02' },
  { keys: ['DI BARI ANTONIO', 'ANTONIO DI BARI', 'DI BARI'], code: 'D03' },
  { keys: ['QUITADAMO ALEX', 'ALEX QUITADAMO', 'QUITADAMO'], code: 'D04' },
  { keys: ['RIGNANESE ANTONIO', 'ANTONIO RIGNANESE', 'RIGNANESE'], code: 'D05' },
]

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase()

function resolveEmployeeDepositCode(text) {
  const normalized = normalizeText(text)
  if (!normalized) return null

  for (const item of EMPLOYEE_DEPOSIT_CODE_BY_NAME) {
    if (item.keys.some((k) => normalized.includes(normalizeText(k)))) return item.code
  }

  if (normalized.includes('RIGNANESE')) return 'D05'
  if (normalized.includes('PAPAGNI')) return 'D02'
  if (normalized.includes('QUITADAMO')) return 'D04'
  if (normalized.includes('BARI')) return 'D03'
  if (normalized.includes('APRILE') || normalized.includes('DAPRILE')) return 'D01'

  return null
}

function getRealDepositForOperator(realDepositsByCode, operatorName) {
  const code = resolveEmployeeDepositCode(operatorName)
  if (!code) return 0
  return Math.trunc(Number(realDepositsByCode?.[code]) || 0)
}

function getFinaleWithoutTheoreticalCassa(row) {
  return (Number(row?.totale_finale) || 0) - getCassaDepositi(row)
}

export default function ConteggiPage() {
  const toast = useToast()
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [periods, setPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [periodView, setPeriodView] = useState('active')
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [realDepositsByCode, setRealDepositsByCode] = useState({ D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 })
  const [adminOverridesByOperator, setAdminOverridesByOperator] = useState({})
  const [overrideInputsByOperator, setOverrideInputsByOperator] = useState({})
  const [savingOverrideOperator, setSavingOverrideOperator] = useState('')
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [operatorFilter, setOperatorFilter] = useState('all')
  const [venueFilter, setVenueFilter] = useState('all')
  const [signFilter, setSignFilter] = useState('all')
  const [selectedRow, setSelectedRow] = useState(null)

  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState(false)
  const [confirmArchivePeriod, setConfirmArchivePeriod] = useState(false)
  const [confirmReopenPeriod, setConfirmReopenPeriod] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [operatorsOpen, setOperatorsOpen] = useState(true)
  const [debitiOpen, setDebitiOpen] = useState(false)
  const [expandedOperators, setExpandedOperators] = useState({})

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
  const visiblePeriods = useMemo(() => (
    periodView === 'archive'
      ? periods.filter((p) => p.status === 'closed')
      : periods.filter((p) => p.status !== 'closed')
  ), [periods, periodView])

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
    const list = data || []
    setPeriods(list)
    if (list.length) {
      setSelectedPeriodId((current) => {
        if (current && list.some((p) => p.id === current)) return current
        const firstOpen = list.find((p) => p.status !== 'closed')
        return (firstOpen || list[0]).id
      })
    }
  }

  async function loadDashboard(periodId = selectedPeriodId) {
    if (!periodId) return
    try {
      setLoading(true)
      const [{ data: sumRows }, { data: detailRows, error: rowsErr }, { data: overrideRows, error: overrideErr }] = await Promise.all([
        supabase.from('conteggi_admin_summary').select('*').eq('period_id', periodId).maybeSingle(),
        supabase.from('conteggi_admin_rows').select('*').eq('period_id', periodId).order('venue_id', { ascending: true }),
        supabase.from('conteggi_admin_overrides').select('id,period_id,operator_name,esattore_override').eq('period_id', periodId),
      ])
      if (rowsErr) throw rowsErr
      if (overrideErr) throw overrideErr

      const overridesMap = {}
      const inputsMap = {}
      ;(overrideRows || []).forEach((item) => {
        const key = normalizeText(item.operator_name)
        const value = Math.trunc(Number(item.esattore_override) || 0)
        overridesMap[key] = { ...item, esattore_override: value }
        inputsMap[key] = String(value)
      })

      setSummary(sumRows || null)
      setRows(detailRows || [])
      setAdminOverridesByOperator(overridesMap)
      setOverrideInputsByOperator(inputsMap)
    } catch (e) { toast.error(`Errore: ${e.message}`) }
    finally { setLoading(false) }
  }

  async function loadRealDepositsForPeriod(period = selectedPeriod) {
    const empty = { D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 }
    if (!period?.date_from || !period?.date_to) {
      setRealDepositsByCode(empty)
      return
    }

    try {
      const { data, error } = await supabase
        .from('movements_cassa')
        .select('venue_id, acconto, work_date, deleted_at')
        .in('venue_id', ['D01', 'D02', 'D03', 'D04', 'D05'])
        .is('deleted_at', null)
        .gte('work_date', period.date_from)
        .lte('work_date', period.date_to)

      if (error) throw error

      const totals = { ...empty }
      ;(data || []).forEach((r) => {
        const code = String(r.venue_id || '').trim().toUpperCase()
        if (!Object.prototype.hasOwnProperty.call(totals, code)) return
        totals[code] += Math.trunc(Number(r.acconto) || 0)
      })

      setRealDepositsByCode(totals)
    } catch (e) {
      toast.error(`Errore depositi reali: ${e.message}`)
      setRealDepositsByCode(empty)
    }
  }

  useEffect(() => { loadBaseData(); loadPeriods() }, [])
  useEffect(() => {
    setOperatorFilter('all'); setVenueFilter('all'); setSignFilter('all'); setSearch('')
    setDebitiOpen(false); setExpandedOperators({})
    if (selectedPeriodId) loadDashboard(selectedPeriodId)
  }, [selectedPeriodId])

  useEffect(() => {
    loadRealDepositsForPeriod(selectedPeriod)
  }, [selectedPeriod?.id, selectedPeriod?.date_from, selectedPeriod?.date_to])

  useEffect(() => {
    if (!periods.length) return
    if (selectedPeriodId && visiblePeriods.some((p) => p.id === selectedPeriodId)) return
    setSelectedPeriodId(visiblePeriods[0]?.id || '')
    if (!visiblePeriods[0]) {
      setSummary(null)
      setRows([])
      setRealDepositsByCode({ D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 })
    }
  }, [periodView, periods, visiblePeriods, selectedPeriodId])

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

  const filteredSummary = useMemo(() => {
    const acc = filteredRows.reduce((a, r) => {
      const opName = getOperatorName(r)
      a.conteggi += 1
      a.locali.add(String(r.venue_id))
      a.operatori.add(opName)
      a.esattore += Number(r.esattore) || 0
      a.acconti += Number(r.acconti) || 0
      a.riporto += Number(r.riporto) || 0
      a.assegni += Number(r.assegno) || 0
      a.debiti += Number(r.debito) || 0
      a.finaleSenzaCassaTeorica += getFinaleWithoutTheoreticalCassa(r)
      return a
    }, { conteggi: 0, locali: new Set(), operatori: new Set(), esattore: 0, acconti: 0, riporto: 0, assegni: 0, debiti: 0, cassaDepositi: 0, finale: 0, finaleSenzaCassaTeorica: 0 })

    acc.operatori.forEach((opName) => {
      const override = adminOverridesByOperator[normalizeText(opName)]
      if (override) {
        const originalEsattore = filteredRows
          .filter((r) => getOperatorName(r) === opName)
          .reduce((sum, r) => sum + (Number(r.esattore) || 0), 0)
        const overrideEsattore = Math.trunc(Number(override.esattore_override) || 0)
        const deltaEsattore = overrideEsattore - originalEsattore
        acc.esattore += deltaEsattore
        acc.finaleSenzaCassaTeorica += deltaEsattore
      }
      acc.cassaDepositi += getRealDepositForOperator(realDepositsByCode, opName)
    })
    acc.finale = acc.finaleSenzaCassaTeorica + acc.cassaDepositi
    return acc
  }, [filteredRows, realDepositsByCode, dipendenti, venues, adminOverridesByOperator])

  const totalSummary = useMemo(() => {
    const acc = rows.reduce((a, r) => {
      const opName = getOperatorName(r)
      a.conteggi += 1
      a.locali.add(String(r.venue_id))
      a.operatori.add(opName)
      a.esattore += Number(r.esattore) || 0
      a.acconti += Number(r.acconti) || 0
      a.riporto += Number(r.riporto) || 0
      a.assegni += Number(r.assegno) || 0
      a.debiti += Number(r.debito) || 0
      a.finaleSenzaCassaTeorica += getFinaleWithoutTheoreticalCassa(r)
      return a
    }, { conteggi: 0, locali: new Set(), operatori: new Set(), esattore: 0, acconti: 0, riporto: 0, assegni: 0, debiti: 0, cassaDepositi: 0, finale: 0, finaleSenzaCassaTeorica: 0 })

    acc.operatori.forEach((opName) => {
      const override = adminOverridesByOperator[normalizeText(opName)]
      if (override) {
        const originalEsattore = rows
          .filter((r) => getOperatorName(r) === opName)
          .reduce((sum, r) => sum + (Number(r.esattore) || 0), 0)
        const overrideEsattore = Math.trunc(Number(override.esattore_override) || 0)
        const deltaEsattore = overrideEsattore - originalEsattore
        acc.esattore += deltaEsattore
        acc.finaleSenzaCassaTeorica += deltaEsattore
      }
      acc.cassaDepositi += getRealDepositForOperator(realDepositsByCode, opName)
    })
    acc.finale = acc.finaleSenzaCassaTeorica + acc.cassaDepositi
    return acc
  }, [rows, venues, dipendenti, realDepositsByCode, adminOverridesByOperator])

  const debitiRows = useMemo(() => filteredRows
    .filter((r) => Number(r.debito) !== 0)
    .sort((a, b) => Math.abs(Number(b.debito) || 0) - Math.abs(Number(a.debito) || 0)), [filteredRows])

  const operatorStats = useMemo(() => {
    const map = {}
    rows.forEach((r) => {
      const name = getOperatorName(r)
      if (!map[name]) {
        map[name] = {
          name,
          count: 0,
          finale: 0,
          finaleSenzaCassaTeorica: 0,
          esattore: 0,
          acconti: 0,
          riporto: 0,
          cassaDepositi: 0,
          debiti: 0,
          rows: [],
        }
      }
      map[name].count += 1
      map[name].finaleSenzaCassaTeorica += getFinaleWithoutTheoreticalCassa(r)
      map[name].esattore += Number(r.esattore) || 0
      map[name].acconti += Number(r.acconti) || 0
      map[name].riporto += Number(r.riporto) || 0
      map[name].debiti += Number(r.debito) || 0
      map[name].rows.push(r)
    })

    Object.values(map).forEach((op) => {
      const override = adminOverridesByOperator[normalizeText(op.name)]
      op.esattoreOriginal = op.esattore
      op.esattoreOverride = override ? Math.trunc(Number(override.esattore_override) || 0) : null
      op.esattoreDelta = override ? op.esattoreOverride - op.esattoreOriginal : 0
      op.esattore = override ? op.esattoreOverride : op.esattoreOriginal
      op.hasEsattoreOverride = !!override
      op.cassaDepositi = getRealDepositForOperator(realDepositsByCode, op.name)
      op.finaleSenzaCassaTeorica += op.esattoreDelta
      op.finale = op.finaleSenzaCassaTeorica + op.cassaDepositi
    })

    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [rows, dipendenti, venues, realDepositsByCode, adminOverridesByOperator])

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

  async function archivePeriod() {
    if (!selectedPeriod) return

    try {
      const closedAt = new Date().toISOString()

      const { error: rowsErr } = await supabase
        .from('conteggi_admin_rows')
        .update({ locked: true })
        .eq('period_id', selectedPeriod.id)
      if (rowsErr) throw rowsErr

      const { data: movements, error: movReadErr } = await supabase
        .from('movements_cassa')
        .select('id, work_date, venue_id, acconto, recupero, da_riportare, note, deleted_at')
        .is('deleted_at', null)
        .lte('work_date', selectedPeriod.date_to)
      if (movReadErr) throw movReadErr

      const idsToArchive = (movements || [])
        .filter((m) => {
          const day = String(m.work_date || '').slice(0, 10)

          // I Da Riportare caricati nell'ultimo giorno con il tasto di Play Money
          // sono la partenza della quindicina successiva: restano attivi.
          if (isAutoDaRiportareMovement(m) && day >= selectedPeriod.date_to) return false

          // Tutto ciò che appartiene al periodo chiuso viene congelato.
          if (day >= selectedPeriod.date_from && day <= selectedPeriod.date_to) return true

          // I Da Riportare automatici vecchi, generati da chiusure precedenti,
          // si archiviano alla chiusura successiva e non si trascinano all'infinito.
          if (isAutoDaRiportareMovement(m) && day < selectedPeriod.date_to) return true

          return false
        })
        .map((m) => m.id)
        .filter(Boolean)

      if (idsToArchive.length > 0) {
        const { error: movUpdateErr } = await supabase
          .from('movements_cassa')
          .update({ deleted_at: closedAt })
          .in('id', idsToArchive)
        if (movUpdateErr) throw movUpdateErr
      }

      const { error: periodErr } = await supabase
        .from('conteggi_periods')
        .update({
          status: 'closed',
          note: withArchiveClosedAt(selectedPeriod.note, closedAt),
        })
        .eq('id', selectedPeriod.id)
      if (periodErr) throw periodErr

      setConfirmArchivePeriod(false)
      toast.success(`Conteggi archiviati • ${idsToArchive.length} movimenti cassa congelati`)
      await loadPeriods()
      setPeriodView('archive')
      setSelectedPeriodId(selectedPeriod.id)
      await loadDashboard(selectedPeriod.id)
    } catch (e) {
      toast.error(`Chiusura archivio: ${e.message}`)
    }
  }

  async function reopenPeriod() {
    if (!selectedPeriod) return

    try {
      const closedAt = getArchiveClosedAt(selectedPeriod.note)

      const { error: rowsErr } = await supabase
        .from('conteggi_admin_rows')
        .update({ locked: false })
        .eq('period_id', selectedPeriod.id)
      if (rowsErr) throw rowsErr

      if (closedAt) {
        const { error: movErr } = await supabase
          .from('movements_cassa')
          .update({ deleted_at: null })
          .eq('deleted_at', closedAt)
        if (movErr) throw movErr
      }

      const { error: periodErr } = await supabase
        .from('conteggi_periods')
        .update({ status: 'open', note: withoutArchiveClosedAt(selectedPeriod.note) })
        .eq('id', selectedPeriod.id)
      if (periodErr) throw periodErr

      setConfirmReopenPeriod(false)
      toast.success('Contabilità riaperta')
      await loadPeriods()
      setPeriodView('active')
      setSelectedPeriodId(selectedPeriod.id)
      await loadDashboard(selectedPeriod.id)
    } catch (e) {
      toast.error(`Riapertura: ${e.message}`)
    }
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

  function getOverrideInputValue(operatorName, fallbackValue = 0) {
    const key = normalizeText(operatorName)
    if (Object.prototype.hasOwnProperty.call(overrideInputsByOperator, key)) return overrideInputsByOperator[key]
    return String(Math.trunc(Number(fallbackValue) || 0))
  }

  function setOverrideInputValue(operatorName, value) {
    const key = normalizeText(operatorName)
    setOverrideInputsByOperator((prev) => ({ ...prev, [key]: value }))
  }

  async function saveEsattoreOverride(operatorName, originalValue) {
    if (!selectedPeriodId || !operatorName) return

    const key = normalizeText(operatorName)
    const rawValue = String(getOverrideInputValue(operatorName, originalValue)).replace(',', '.').trim()
    const parsedValue = Math.trunc(Number(rawValue))

    if (!Number.isFinite(parsedValue)) {
      toast.warning('Inserisci un importo esattore valido')
      return
    }

    try {
      setSavingOverrideOperator(key)
      const { data, error } = await supabase
        .from('conteggi_admin_overrides')
        .upsert({
          period_id: selectedPeriodId,
          operator_name: operatorName,
          esattore_override: parsedValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'period_id,operator_name' })
        .select('id,period_id,operator_name,esattore_override')
        .single()
      if (error) throw error

      setAdminOverridesByOperator((prev) => ({
        ...prev,
        [key]: { ...data, esattore_override: Math.trunc(Number(data.esattore_override) || 0) },
      }))
      setOverrideInputsByOperator((prev) => ({ ...prev, [key]: String(parsedValue) }))
      toast.success(`Esattore rettificato per ${operatorName}`)
    } catch (e) {
      toast.error(`Rettifica esattore: ${e.message}`)
    } finally {
      setSavingOverrideOperator('')
    }
  }

  async function resetEsattoreOverride(operatorName) {
    if (!selectedPeriodId || !operatorName) return
    const key = normalizeText(operatorName)

    try {
      setSavingOverrideOperator(key)
      const { error } = await supabase
        .from('conteggi_admin_overrides')
        .delete()
        .eq('period_id', selectedPeriodId)
        .eq('operator_name', operatorName)
      if (error) throw error

      setAdminOverridesByOperator((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setOverrideInputsByOperator((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      toast.success(`Rettifica rimossa per ${operatorName}`)
    } catch (e) {
      toast.error(`Rimozione rettifica: ${e.message}`)
    } finally {
      setSavingOverrideOperator('')
    }
  }

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
            {selectedPeriod && !isClosed && (
              <Button
                icon={Archive}
                variant="secondary"
                onClick={() => setConfirmArchivePeriod(true)}
              >
                <span className="hidden md:inline">Chiudi e archivia conteggi</span>
                <span className="md:hidden">Archivia</span>
              </Button>
            )}
            {selectedPeriod && isClosed && (
              <Button
                icon={RotateCcw}
                variant="primary"
                onClick={() => setConfirmReopenPeriod(true)}
              >
                <span className="hidden md:inline">Riapri contabilità</span>
                <span className="md:hidden">Riapri</span>
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={periodView === 'active' ? 'primary' : 'ghost'}
              onClick={() => setPeriodView('active')}
            >
              Conteggi attivi
            </Button>
            <Button
              icon={Archive}
              variant={periodView === 'archive' ? 'primary' : 'ghost'}
              onClick={() => setPeriodView('archive')}
            >
              Archivio conteggi
            </Button>
          </div>

         {/* Period bar */}
<Card>
  <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[1fr_160px_auto] md:items-end md:gap-4 md:p-4">
    <Field label="Periodo">
      <Select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
        {visiblePeriods.length === 0 && (
          <option value="">
            {periodView === 'archive' ? 'Nessun periodo archiviato' : 'Nessun periodo attivo'}
          </option>
        )}
        {visiblePeriods.map((p) => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </Select>
    </Field>

    <Field label="Raggruppa agente">
      <Select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
        <option value="all">Tutti gli agenti</option>
        {operators.map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </Select>
    </Field>

    {selectedPeriod && (
      <div className="flex items-end justify-end gap-2">
        <IconButton icon={RefreshCw} onClick={() => loadDashboard()} title="Aggiorna" />
        <IconButton
          icon={Trash2}
          variant="danger"
          onClick={() => setConfirmDeletePeriod(true)}
          disabled={isClosed}
          title="Elimina periodo"
        />
      </div>
    )}
  </div>
</Card>


         

          {/* Operatori e dettaglio conteggi */}
<Card>
  <button
    type="button"
    onClick={() => setOperatorsOpen((v) => !v)}
    className="flex w-full items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-3 text-left md:px-4"
  >
    <div>
      <p className="text-[13px] font-semibold text-[var(--color-text)]">
        Agenti
      </p>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        {operatorStats.length} attivi · freccia per vedere i singoli conteggi
      </p>
    </div>

    {operatorsOpen ? (
      <ChevronUp
        size={15}
        className="text-[var(--color-text-muted)]"
      />
    ) : (
      <ChevronDown
        size={15}
        className="text-[var(--color-text-muted)]"
      />
    )}
  </button>

  <div className={`${operatorsOpen ? 'block' : 'hidden'} p-3 md:p-4`}>
    <div className="flex flex-col gap-3">
      {operatorStats.map((op) => {
        const expanded = !!expandedOperators[op.name]

        return (
          <div
            key={op.name}
            className="rounded-xl border border-[var(--color-border)] bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedOperators((prev) => ({
                  ...prev,
                  [op.name]: !prev[op.name],
                }))
              }
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(op.name)}`}
              >
                {initials(op.name)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">
                  {op.name}
                </p>

                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {op.count} conteggi · Esattore {fmtEuro(op.esattore)}
                </p>
              </div>

<Button
  icon={Download}
  size="sm"
  variant="primary"
  onClick={(e) => {
    e.stopPropagation()
    handleGeneratePdf(
      `PDF ${op.name}`,
      rows.filter((r) => getOperatorName(r) === op.name)
    )
  }}
>
  PDF
</Button>

{expanded ? (
  <ChevronUp size={18} />
) : (
  <ChevronDown size={18} />
)}
            </button>

<div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] px-4 py-3 md:grid-cols-6">
  <EsattoreOverrideBox
    value={getOverrideInputValue(op.name, op.esattoreOriginal)}
    originalValue={op.esattoreOriginal}
    hasOverride={op.hasEsattoreOverride}
    disabled={isClosed || savingOverrideOperator === normalizeText(op.name)}
    onChange={(value) => setOverrideInputValue(op.name, value)}
    onSave={() => saveEsattoreOverride(op.name, op.esattoreOriginal)}
    onReset={() => resetEsattoreOverride(op.name)}
  />
  <TinyMetric label="Acconti" value={fmtEuro(op.acconti)} />
  <TinyMetric label="Da riportare" value={fmtEuro(op.riporto)} />
  <TinyMetric label="Cassa/Depositi" value={fmtEuro(op.cassaDepositi)} />
  <TinyMetric label="Debiti" value={fmtEuro(op.debiti)} danger />
  <TinyMetric label="Totale finale" value={fmtSigned(op.finale)} danger={op.finale < 0} />
</div>

{expanded && (
              <div className="border-t border-[var(--color-border)] p-3">
                <div className="grid gap-2">
                  {op.rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRow(r)}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {getVenueName(r)}
                          </p>

                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {formatITDate(r.conteggio_date)}
                          </p>
                        </div>

                        <span
                          className={`font-bold ${clsSigned(Number(r.totale_finale) || 0)}`}
                        >
                          {fmtSigned(Number(r.totale_finale) || 0)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  </div>
</Card>

          {/* Riepilogo totale generale */}
          <Card>
            <div className="border-b border-[var(--color-border)] px-3 py-3 md:px-4">
              <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--color-text)]">Riepilogo totale generale</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Somma di tutti gli agenti del periodo, senza considerare i filtri attivi.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-7 md:p-4">
              <SummaryTotalBox label="Esattore" value={fmtEuro(totalSummary.esattore)} />
              <SummaryTotalBox label="Acconti" value={fmtEuro(totalSummary.acconti)} />
              <SummaryTotalBox label="Da riportare" value={fmtEuro(totalSummary.riporto)} />
              <SummaryTotalBox label="Cassa/Depositi" value={fmtEuro(totalSummary.cassaDepositi)} />
              <SummaryTotalBox label="Assegni" value={fmtEuro(totalSummary.assegni)} />
              <SummaryTotalBox label="Debiti" value={fmtEuro(totalSummary.debiti)} danger />
              <SummaryTotalBox label="Totale finale" value={fmtSigned(totalSummary.finale)} tone={totalSummary.finale > 0 ? 'success' : totalSummary.finale < 0 ? 'danger' : 'default'} strong />
            </div>
          </Card>

          {/* Missing venues */}
          <Card>
            <button
              type="button"
              onClick={() => setShowMissing((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-hover)] md:px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                  <MapPin size={13} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">Locali non conteggiati</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{missingVenues.length} locali ancora senza conteggio</p>
                </div>
              </div>
              {showMissing ? <ChevronUp size={15} className="shrink-0 text-[var(--color-text-muted)]" /> : <ChevronDown size={15} className="shrink-0 text-[var(--color-text-muted)]" />}
            </button>
            {showMissing && (
              <div className="border-t border-[var(--color-border)]">
                <div className="hidden overflow-x-auto md:block">
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
                <div className="divide-y divide-[var(--color-border)] md:hidden">
                  {missingVenues.map((v) => (
                    <div key={v.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-[44px] items-center justify-center rounded bg-[var(--color-surface)] font-mono text-[11px] font-bold text-[var(--color-text-secondary)]">{v.id}</span>
                        <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{v.name}</p>
                      </div>
                      {v.city && <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]"><MapPin size={9} strokeWidth={2} className="mr-0.5 inline" />{v.city}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </PageBody>

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
            <p className="mt-0.5 text-[14px] font-medium text-[var(--color-text)]">{formatPeriodTitle(newPeriod.date_from, newPeriod.date_to)}</p>
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

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtri"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setOperatorFilter('all'); setVenueFilter('all'); setSignFilter('all') }}>Azzera</Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>Applica</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Agente">
            <Select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
              <option value="all">Tutti gli agenti</option>
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

      <ConfirmDialog
        open={confirmArchivePeriod}
        onClose={() => setConfirmArchivePeriod(false)}
        title="Chiudi e archivia conteggi"
        message={selectedPeriod ? `Vuoi chiudere e archiviare "${selectedPeriod.title}"? Verranno congelati conteggi e movimenti cassa del periodo. I Da Riportare appena caricati per la prossima quindicina resteranno attivi.` : ''}
        confirmLabel="Chiudi e archivia"
        onConfirm={archivePeriod}
      />

      <ConfirmDialog
        open={confirmReopenPeriod}
        onClose={() => setConfirmReopenPeriod(false)}
        title="Riapri contabilità"
        message={selectedPeriod ? `Vuoi riaprire "${selectedPeriod.title}"? I movimenti congelati da questa chiusura torneranno attivi.` : ''}
        confirmLabel="Riapri"
        onConfirm={reopenPeriod}
      />

      <Modal
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title="Dettaglio conteggio"
        width="lg"
        footer={selectedRow && <Button icon={Download} variant="primary" onClick={() => handleGeneratePdf(`PDF ${getVenueName(selectedRow)}`, [selectedRow])}>Scarica PDF</Button>}
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
              <div className={`shrink-0 text-[20px] font-semibold tabular-nums md:text-[26px] ${clsSigned(Number(selectedRow.totale_finale) || 0)}`}>{fmtSigned(Number(selectedRow.totale_finale) || 0)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Detail label="Esattore" value={fmtEuro(selectedRow.esattore)} />
              <Detail label="Acconti" value={fmtEuro(selectedRow.acconti)} />
              <Detail label="Da riportare" value={fmtEuro(selectedRow.riporto)} />
              <Detail label="Cassa/Depositi teorica" value={fmtEuro(getCassaDepositi(selectedRow))} />
              <Detail label="Assegni" value={fmtEuro(selectedRow.assegno)} />
              <Detail label="Debiti" value={fmtEuro(selectedRow.debito)} danger />
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

function MainMoneyBox({ label, value, tone = 'default', big = false }) {
  const toneCls = tone === 'success'
    ? 'border-green-200 bg-green-50 text-[var(--color-success)]'
    : tone === 'danger'
      ? 'border-red-200 bg-red-50 text-[var(--color-danger)]'
      : 'border-[var(--color-border)] bg-white text-[var(--color-text)]'
  return (
    <div className={`rounded-xl border px-3 py-3 shadow-sm ${toneCls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 font-extrabold tabular-nums ${big ? 'text-[21px] md:text-[24px]' : 'text-[17px] md:text-[20px]'}`}>{value}</p>
    </div>
  )
}

function DebtBox({ value, count, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-left shadow-sm transition-colors hover:border-red-300 hover:bg-red-100/60"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-danger)]">Debiti</p>
        {open ? <ChevronUp size={14} className="text-[var(--color-danger)]" /> : <ChevronDown size={14} className="text-[var(--color-danger)]" />}
      </div>
      <p className="mt-1 text-[17px] font-extrabold tabular-nums text-[var(--color-danger)] md:text-[20px]">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-red-700">{count} singoli · clicca per aprire</p>
    </button>
  )
}


function EsattoreOverrideBox({ value, originalValue, hasOverride, disabled = false, onChange, onSave, onReset }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${hasOverride ? 'border-amber-300 bg-amber-50' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Esattore
        </p>
        {hasOverride && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
            Rettificato
          </span>
        )}
      </div>

      <Input
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-9 text-right text-[18px] font-extrabold tabular-nums md:text-[22px]"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Calcolato: {fmtEuro(originalValue)}
        </p>
        <div className="flex shrink-0 gap-1.5">
          {hasOverride && (
            <Button size="sm" variant="ghost" disabled={disabled} onClick={onReset}>
              Reset
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={disabled} onClick={onSave}>
            Salva
          </Button>
        </div>
      </div>
    </div>
  )
}

function TinyMetric({ label, value, danger = false }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-[18px] font-extrabold tabular-nums md:text-[22px] ${
          danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function SummaryTotalBox({ label, value, tone = 'default', danger = false, strong = false }) {
  const valueCls = danger || tone === 'danger'
    ? 'text-[var(--color-danger)]'
    : tone === 'success'
      ? 'text-[var(--color-success)]'
      : 'text-[var(--color-text)]'

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-white px-5 py-4 shadow-sm ${
        strong ? 'ring-2 ring-red-200 bg-red-50' : ''
      }`}
    >
      <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-[24px] font-extrabold tabular-nums md:text-[30px] ${valueCls}`}>
        {value}
      </p>
    </div>
  )
}
function Chip({ label, value, danger = false }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
      <p className="text-[9px] font-medium text-[var(--color-text-muted)] md:text-[10px]">{label}</p>
      <p className={`text-[11px] font-medium tabular-nums md:text-[12px] ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>{value}</p>
    </div>
  )
}

function Detail({ label, value, danger = false }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-0.5 text-[14px] font-semibold tabular-nums ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>{value}</p>
    </div>
  )
}
