import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FileDown, Users, ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2, CalendarDays, Lock, Unlock, Building2, Plus, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Input, EmptyState, Modal, Button, Field,
} from '../components/ui'
import { PageLayout, PageBody } from '../components/PageLayout'
import { SkeletonCard } from '../components/Skeleton'
import { ConfirmDialog } from '../components/FormDialog'
import { useToast } from '../components/Toast'
import {
  todayISO, toIT, formatEuro0,
  dipendenteName, dipendenteId,
} from '../lib/helpers'

function formatInsertedAt(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(parsed)
}

async function toDataUrl(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function exportAgentPdf({ dateLabel, agente, riepilogo, movements }) {
  const mod = await import('jspdf')
  const jsPDF = mod.jsPDF || mod.default
  if (!jsPDF) throw new Error('jsPDF missing')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let logoDataUrl = null
  try {
    logoDataUrl = await toDataUrl(`${window.location.origin}/logo512.png.png`)
  } catch (e) {
    console.warn('Logo PDF non caricato', e)
  }

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const M = 34
  let y = M

  const C = {
    navy: [6, 16, 31],
    navy2: [8, 47, 73],
    text: [15, 23, 42],
    muted: [100, 116, 139],
    line: [226, 232, 240],
    soft: [248, 250, 252],
    white: [255, 255, 255],
    blue: [14, 116, 144],
    orange: [234, 88, 12],
    green: [21, 128, 61],
  }

  const isEmptyField = (v) =>
    v === null || v === undefined || String(v).trim() === ''

  const numberOrZero = (v) => {
    if (isEmptyField(v)) return 0
    const cleaned = String(v).replace(/[^\d.]/g, '')
    return Number(cleaned) || 0
  }

  const formatValue = (n) => formatEuro0(Number(n) || 0)
  const labelOrBlank = (v) => (isEmptyField(v) ? '—' : String(v).trim())

  const moneyOrBlank = (n) => {
    const v = Number(n) || 0
    return v > 0 ? formatEuro0(v) : ''
  }

  const fondo = {
    mezzo: riepilogo?.mezzo || '',
    km: riepilogo?.km || '',
    monete: riepilogo?.monete || 0,
    rifornimento: riepilogo?.rifornimento || 0,
  }

  const totals = {
    accontiRaw: riepilogo?.acconti || 0,
    recuperiRaw: riepilogo?.recuperi || 0,
    da_riportareRaw: riepilogo?.da_riportare || 0,
    moneteRaw: riepilogo?.monete || 0,
    cassaGeneraleRaw: riepilogo?.cassaGenerale || 0,
  }

  const ensureSpace = (needed) => {
    if (y + needed > pageH - M) {
      doc.addPage()
      y = M
      drawSmallHeader()
    }
  }

  const roundedCard = (x, yy, w, h, fill = C.white) => {
    doc.setDrawColor(...C.line)
    doc.setFillColor(...fill)
    doc.roundedRect(x, yy, w, h, 14, 14, 'FD')
  }

  const drawSmallHeader = () => {
    doc.setFillColor(...C.navy)
    doc.roundedRect(M, y, pageW - M * 2, 42, 14, 14, 'F')

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', M + 14, y + 8, 26, 26)
      } catch {}
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...C.white)
    doc.text('PLAY MONEY • MOVIMENTI', M + 48, y + 26)

    doc.setFontSize(9)
    doc.setTextColor(180, 220, 230)
    doc.text(dateLabel, pageW - M - 14, y + 26, { align: 'right' })

    y += 56
  }

  const headerH = 72

  doc.setFillColor(...C.navy)
  doc.roundedRect(M, y, pageW - M * 2, headerH, 18, 18, 'F')

  doc.setFillColor(...C.navy2)
  doc.roundedRect(M + 210, y, pageW - M * 2 - 210, headerH, 18, 18, 'F')

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', M + 16, y + 10, 50, 50)
    } catch (e) {
      console.warn('Errore addImage:', e)
    }
  }

  doc.setTextColor(180, 240, 250)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('PLAY MONEY', M + 82, y + 22)

  doc.setTextColor(...C.white)
  doc.setFontSize(11)
  doc.text(`Data: ${dateLabel}`, M + 82, y + 38)

  doc.setFontSize(11)
  doc.text(`Operatore: ${agente || '—'}`, M + 82, y + 52)

  const fondoHeaderX = pageW - M - 255

  doc.setTextColor(180, 240, 250)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('FONDO CASSA', fondoHeaderX, y + 20)

  doc.setTextColor(...C.white)
  doc.setFontSize(9)
  doc.text(`Mezzo: ${labelOrBlank(fondo?.mezzo)}`, fondoHeaderX, y + 38)
  doc.text(`KM: ${labelOrBlank(fondo?.km)}`, fondoHeaderX + 116, y + 38)

  doc.text(
    `Monete: ${isEmptyField(fondo?.monete) ? '—' : formatValue(numberOrZero(fondo?.monete))}`,
    fondoHeaderX,
    y + 56
  )

  doc.text(
    `Rifornimento: ${isEmptyField(fondo?.rifornimento) ? '—' : formatValue(numberOrZero(fondo?.rifornimento))}`,
    fondoHeaderX + 116,
    y + 56
  )

  y += headerH + 10

  ensureSpace(100)

  const tableX = M
  const tableW = pageW - M * 2
  const headH = 22
  const rowH = 24

  const colLocale = 275
  const colA = 85
  const colR = 92

  doc.setFillColor(...C.navy)
  doc.roundedRect(tableX, y, tableW, headH, 8, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.white)

  doc.text('LOCALE', tableX + 10, y + 14)
  doc.text('ACCONTO', tableX + colLocale + 8, y + 14)
  doc.text('RECUPERO', tableX + colLocale + colA + 8, y + 14)
  doc.text('DA RIPORTARE', tableX + colLocale + colA + colR + 8, y + 14)

  y += headH + 3

  if (!movements?.length) {
    roundedCard(M, y, tableW, 38, C.soft)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.muted)
    doc.text('Nessun movimento registrato per questa data.', M + 12, y + 23)

    y += 44
  } else {
    movements.forEach((m, idx) => {
      ensureSpace(rowH + 4)

      doc.setFillColor(
        idx % 2 === 0 ? 255 : 248,
        idx % 2 === 0 ? 255 : 250,
        idx % 2 === 0 ? 255 : 252
      )
      doc.setDrawColor(...C.line)
      doc.roundedRect(tableX, y, tableW, rowH, 7, 7, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.6)
      doc.setTextColor(...C.text)
      doc.text(String(m.venueName || '—').slice(0, 34), tableX + 9, y + 15)

      const a = moneyOrBlank(m.acconto)
      const r = moneyOrBlank(m.recupero)
      const d = moneyOrBlank(m.da_riportare)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)

      if (a) {
        doc.setTextColor(...C.blue)
        doc.text(a, tableX + colLocale + 8, y + 15)
      }

      if (r) {
        doc.setTextColor(...C.orange)
        doc.text(r, tableX + colLocale + colA + 8, y + 15)
      }

      if (d) {
        doc.setTextColor(...C.green)
        doc.text(d, tableX + colLocale + colA + colR + 8, y + 15)
      }

      y += rowH + 3
    })
  }

  y += 8

  const totalH = 112
  const totalY = pageH - M - totalH - 18
  y = Math.max(y, totalY)

  doc.setDrawColor(8, 47, 73)
  doc.setFillColor(...C.navy)
  doc.roundedRect(M, y, pageW - M * 2, totalH, 18, 18, 'FD')

  doc.setFillColor(...C.navy2)
  doc.roundedRect(M + 260, y, pageW - M * 2 - 260, totalH, 18, 18, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(180, 240, 250)
  doc.text('RIEPILOGO', M + 18, y + 25)

  const boxY = y + 38
  const boxH = 34
  const gap = 7
  const boxW = (pageW - M * 2 - 36 - gap * 3) / 4
  const startX = M + 18

  const summaryItems = [
    ['ACCONTI', formatValue(totals.accontiRaw), C.blue],
    ['RECUPERI', formatValue(totals.recuperiRaw), C.orange],
    ['DA RIP.', formatValue(totals.da_riportareRaw), C.green],
    ['FONDO', formatValue(totals.moneteRaw || 0), [0, 0, 0]],
  ]

  summaryItems.forEach(([label, value, color], i) => {
    const x = startX + i * (boxW + gap)

    doc.setDrawColor(255, 255, 255)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, boxY, boxW, boxH, 9, 9, 'F')

    doc.setFontSize(6.5)
    doc.setTextColor(...C.muted)
    doc.text(label, x + 7, boxY + 12)

    doc.setFontSize(9.5)
    doc.setTextColor(...color)
    doc.text(value, x + boxW - 7, boxY + 25, { align: 'right' })
  })

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.5)
  doc.line(M + 18, y + 82, pageW - M - 18, y + 82)

  doc.setFontSize(12)
  doc.setTextColor(...C.white)
  doc.text('CASSA GENERALE', M + 18, y + 101)

  doc.setFontSize(24)
  doc.setTextColor(103, 232, 249)
  doc.text(formatValue(totals.cassaGeneraleRaw), pageW - M - 18, y + 103, {
    align: 'right',
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text('Documento generato automaticamente da Play Money', M, pageH - 18)

  doc.save(`Movimenti_${dateLabel}.pdf`)
}

function AnalisiMoneyRow({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-[19px] border border-[#e4dbc9] bg-white px-4 shadow-[0_8px_22px_rgba(39,27,5,.04)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[#e1c888] bg-[#fff7e5] text-[#a26e13]"><Icon size={17}/></span>
      <span className="flex-1 text-[14px] font-black text-[#7b8799]">{label}</span>
      <div className="relative w-[132px]">
        <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
          className="h-11 w-full rounded-[13px] border border-[#e0cfaa] bg-[#fffdf8] px-3 pr-8 text-right text-[16px] font-black tabular-nums text-[#3c2a0c] outline-none focus:border-[#c9982d] focus:ring-2 focus:ring-[#d9ae50]/20" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-black text-[#a6751e]">€</span>
      </div>
    </div>
  )
}

export default function AnalisiPage() {
  const toast = useToast()
  const [data, setData] = useState(todayISO())
  const [movements, setMovements] = useState([])
  const [fondi, setFondi] = useState([])
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [locks, setLocks] = useState([])
  const [lockSavingId, setLockSavingId] = useState(null)
  const [lockTarget, setLockTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedAgentId, setExpandedAgentId] = useState(null)

  // Modifica / eliminazione movimento dalla tendina
  const [editMov, setEditMov] = useState(null) // movimento in modifica
  const [editDraft, setEditDraft] = useState({ acconto: '', recupero: '', da_riportare: '' })
  const [deleteMov, setDeleteMov] = useState(null) // movimento da eliminare
  const [savingMov, setSavingMov] = useState(false)

  useEffect(() => { loadData() }, [data])

  function moveDay(amount) {
    const [year, month, day] = data.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1, day + amount))
    setData(next.toISOString().slice(0, 10))
  }

  function isGenericMovement(row) {
    return Number(row?.acconto || 0) === 0 &&
      Number(row?.recupero || 0) === 0 &&
      Number(row?.da_riportare || 0) === 0
  }

  async function loadData() {
    setLoading(true)
    const [movRes, fondoRes, venRes, dipRes, lockRes] = await Promise.all([
      supabase
  .from('movements_cassa')
  .select('*')
  .eq('work_date', data)
  .neq('origine', 'chiusura_conteggio')
  .is('deleted_at', null),
      supabase.from('fondo_cassa_giornaliero').select('*').eq('work_date', data),
      supabase.from('venues').select('*'),
      supabase.from('dipendenti').select('*'),
      supabase.from('daily_edit_locks').select('*').eq('work_date', data),
    ])
    if (movRes.error) toast.error(`Errore: ${movRes.error.message}`)
    setMovements(movRes.data || [])
    setFondi(fondoRes.data || [])
    setVenues(venRes.data || [])
    setDipendenti(dipRes.data || [])
    if (lockRes.error) toast.error(`Lucchetti non disponibili: ${lockRes.error.message}`)
    setLocks(lockRes.data || [])
    setLoading(false)
  }

  function isAgentLocked(agentId) {
    return locks.some((row) => String(row.created_by) === String(agentId) && row.locked)
  }

  async function toggleAgentLock(agentId) {
    const nextLocked = !isAgentLocked(agentId)
    setLockSavingId(String(agentId))
    const { data: updated, error } = await supabase.rpc('set_daily_edit_lock', {
      p_work_date: data,
      p_created_by: agentId,
      p_locked: nextLocked,
    })
    setLockSavingId(null)
    if (error) return toast.error(error.message)
    setLocks((prev) => [
      ...prev.filter((row) => String(row.created_by) !== String(agentId)),
      updated,
    ])
    toast.success(nextLocked ? 'Giornata bloccata' : 'Modifiche riaperte')
    setLockTarget(null)
  }

  function venueLabel(id) {
    const v = venues.find((x) => String(x.id) === String(id))
    if (!v) return id || '—'
    const name = String(v.name || '').trim()
    if (name.toLowerCase().startsWith(String(v.id).toLowerCase())) return name
    return `${v.id} ${name}`
  }

  // ─── MODIFICA / ELIMINAZIONE MOVIMENTO (dalla tendina) ──────────
  function openEditMov(m) {
    setEditMov(m)
    setEditDraft({
      acconto: String(Math.trunc(Number(m.acconto) || 0)),
      recupero: String(Math.trunc(Number(m.recupero) || 0)),
      da_riportare: String(Math.trunc(Number(m.da_riportare) || 0)),
    })
  }

  async function saveMovimento() {
    if (!editMov) return
    setSavingMov(true)
    const payload = {
      acconto: Math.trunc(Number(editDraft.acconto) || 0),
      recupero: Math.trunc(Number(editDraft.recupero) || 0),
      da_riportare: Math.trunc(Number(editDraft.da_riportare) || 0),
    }
    const { error } = await supabase
      .from('movements_cassa')
      .update(payload)
      .eq('id', editMov.id)
    setSavingMov(false)
    if (error) return toast.error(error.message)
    // aggiorna in locale senza ricaricare tutto
    setMovements((prev) => prev.map((x) => (x.id === editMov.id ? { ...x, ...payload } : x)))
    setEditMov(null)
    toast.success('Movimento aggiornato')
  }

  async function doDeleteMovimento() {
    if (!deleteMov) return
    // soft-delete: va nel Cestino e sparisce subito da Play Money
    const { error } = await supabase
      .from('movements_cassa')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deleteMov.id)
    if (error) return toast.error(error.message)
    setMovements((prev) => prev.filter((x) => x.id !== deleteMov.id))
    setDeleteMov(null)
    toast.success('Movimento eliminato')
  }

  const agentRows = useMemo(() => {
    const map = new Map()
    dipendenti.forEach((dip) => {
      const id = dipendenteId(dip)
      map.set(String(id), {
        id,
        dipendente: dip,
        name: dipendenteName(dip),
        email: dip.email || '',
        acconti: 0,
        recuperi: 0,
        da_riportare: 0,
        count: 0,
        monete: 0,
        km: '',
        mezzo: '',
        rifornimento: 0,
      })
    })

    movements.forEach((m) => {
      const row = map.get(String(m.created_by))
      if (!row) return
      row.acconti += Number(m.acconto || 0)
      row.recuperi += Number(m.recupero || 0)
      row.da_riportare += Number(m.da_riportare || 0)
      row.count += 1
    })

    fondi.forEach((f) => {
      const row = map.get(String(f.created_by))
      if (!row) return
      row.monete = Number(f.monete || 0)
      row.km = f.km || ''
      row.mezzo = f.mezzo || ''
      row.rifornimento = Number(f.rifornimento || 0)
    })

    return Array.from(map.values())
      .filter((r) => r.count > 0 || r.monete > 0 || r.km || r.mezzo)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [movements, fondi, dipendenti])

  const grandTotals = useMemo(() => agentRows.reduce((acc, r) => {
    acc.acconti += r.acconti
    acc.recuperi += r.recuperi
    acc.da_riportare += r.da_riportare
    acc.monete += r.monete
    acc.rifornimento += r.rifornimento
    return acc
  }, {
    acconti: 0,
    recuperi: 0,
    da_riportare: 0,
    monete: 0,
    rifornimento: 0,
  }), [agentRows])

  async function exportPdf(row) {
    const userMovements = movements.filter((m) => String(m.created_by) === String(row.id))

    await exportAgentPdf({
      dateLabel: toIT(data),
      agente: row.name,
      riepilogo: {
        monete: row.monete,
        cassaGenerale: row.monete + row.acconti + row.recuperi - row.da_riportare,
        acconti: row.acconti,
        recuperi: row.recuperi,
        da_riportare: row.da_riportare,
        flussoCassa: row.acconti + row.recuperi - row.da_riportare,
        km: row.km,
        mezzo: row.mezzo,
        rifornimento: row.rifornimento,
      },
      movements: userMovements.map((m) => ({
        venueName: venueLabel(m.venue_id),
        insertedAt: formatInsertedAt(m.created_at),
        acconto: m.acconto,
        recupero: m.recupero,
        da_riportare: m.da_riportare,
      })),
    })

    toast.success('PDF generato')
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_15%_0%,rgba(226,186,99,.16),transparent_28%),linear-gradient(180deg,#f7f2e8_0%,#f4f0e8_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
            <section className="relative overflow-hidden rounded-[30px] border border-[#dfc98f] bg-[linear-gradient(135deg,#fffdf8_0%,#f4e5bf_100%)] px-4 py-5 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
              <div className="pointer-events-none absolute -left-16 -top-24 h-60 w-60 rounded-full bg-white/75 blur-3xl" />
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
              <div className="relative flex min-h-[92px] flex-col items-center justify-center text-center">
                <h1 className="text-[29px] font-black tracking-[0.13em] text-[#3d2a0b] md:text-[35px]">ANALISI GIORNALIERA</h1>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={() => moveDay(-1)} title="Giorno precedente" aria-label="Vai al giorno precedente" className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#d8b86c] bg-[linear-gradient(145deg,#fffaf0,#ecd18f)] text-[#755019] shadow-[0_10px_20px_-16px_rgba(116,79,17,.48)] transition hover:-translate-y-0.5 active:scale-95">
                    <ChevronLeft size={19} strokeWidth={2.7} />
                  </button>
                  <label className="group flex h-10 items-center gap-2 rounded-[13px] border border-[#d8b86c] bg-white/70 px-3 text-[#755019] shadow-[0_10px_20px_-16px_rgba(116,79,17,.48)] transition hover:bg-white">
                    <CalendarDays size={15} />
                    <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 w-[132px] border-0 bg-transparent p-0 text-[11px] font-black text-[#5d3e0c] shadow-none" />
                  </label>
                  <button type="button" onClick={() => moveDay(1)} title="Giorno successivo" aria-label="Vai al giorno successivo" className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#d8b86c] bg-[linear-gradient(145deg,#fffaf0,#ecd18f)] text-[#755019] shadow-[0_10px_20px_-16px_rgba(116,79,17,.48)] transition hover:-translate-y-0.5 active:scale-95">
                    <ChevronRight size={19} strokeWidth={2.7} />
                  </button>
                  <button type="button" onClick={loadData} title="Aggiorna" className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#d8b86c] bg-[linear-gradient(145deg,#fffaf0,#ecd18f)] text-[#755019] shadow-[0_10px_20px_-16px_rgba(116,79,17,.48)] transition hover:-translate-y-0.5 active:scale-95">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#dfcfaa] bg-[#fffdf9] shadow-[0_24px_55px_-38px_rgba(65,43,8,.68)]">
              <div className="border-b border-[#eadfca] px-4 py-4 text-center">
                <h2 className="text-[21px] font-black tracking-[0.18em] text-[#946318] md:text-[26px]">RIEPILOGO GENERALE</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {[
                  ['AGENTI', agentRows.length],
                  ['ACCONTI', formatEuro0(grandTotals.acconti)],
                  ['RECUPERI', formatEuro0(grandTotals.recuperi)],
                  ['DA RIPORTARE', formatEuro0(grandTotals.da_riportare)],
                  ['MONETE', formatEuro0(grandTotals.monete)],
                  ['RIFORNIMENTO', formatEuro0(grandTotals.rifornimento)],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-r border-[#eee5d4] px-3 py-6 text-center xl:border-b-0">
                    <p className="text-[10px] font-black tracking-[0.16em] text-slate-500 md:text-[11px]">{label}</p>
                    <p className="mt-3 text-[23px] font-black tabular-nums text-[#33250f] md:text-[27px]">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-4 text-center">
                <h2 className="text-[20px] font-black tracking-[0.17em] text-[#8d5f17] md:text-[24px]">LISTA AGENTI</h2>
              </div>

            {loading && (
              <div className="space-y-2 rounded-[24px] border border-[#e3d8c2] bg-white p-3">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {!loading && agentRows.length === 0 && (
              <EmptyState icon={Users} title="Nessun dato" description="Nessun agente ha lavorato in questa data." />
            )}

            {!loading && agentRows.map((r) => {
              const cassaGenerale = r.monete + r.acconti + r.recuperi - r.da_riportare
              const agentMovements = movements.filter((m) => String(m.created_by) === String(r.id))
              const isExpanded = expandedAgentId === String(r.id)
              const agentLocked = isAgentLocked(r.id)

              return (
                <article
                  key={r.id}
                  className="mb-3 overflow-hidden rounded-[24px] border border-[#d5b76e] bg-[#fffdf9] shadow-[0_20px_42px_-34px_rgba(61,39,4,.75)] last:mb-0"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[#eee3cf] bg-[linear-gradient(135deg,#fff4d5,#e9c977)] px-3 py-3 md:px-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[22px] font-black uppercase tracking-[0.04em] text-[#2f210b] md:text-[25px]">{r.name}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-black uppercase tracking-[0.06em] md:text-[14px]">
                          <span className="text-slate-500">MEZZO <strong className="ml-1 text-[#281d0b]">{r.mezzo || '—'}</strong></span>
                          <span className="text-slate-500">KM: <strong className="ml-1 tabular-nums text-[#281d0b]">{r.km || '—'}</strong></span>
                          <span className="text-slate-500">RIFORNIMENTO: <strong className="ml-1 tabular-nums text-[#281d0b]">{formatEuro0(r.rifornimento)}</strong></span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedAgentId(isExpanded ? null : String(r.id))}
                          className="mt-3 inline-flex h-8 items-center gap-1 rounded-[10px] border border-[#d2b36a] bg-white/70 px-2.5 text-[10px] font-black tracking-[0.08em] text-[#68450e] transition hover:bg-white active:scale-95"
                        >
                          Movimenti
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setLockTarget({ id: r.id, name: r.name, locked: agentLocked })}
                        disabled={lockSavingId === String(r.id)}
                        title={agentLocked ? 'Riapri le modifiche' : 'Blocca le modifiche'}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-[13px] border transition active:scale-95 disabled:opacity-50 ${agentLocked ? 'border-red-300 bg-red-600 text-white shadow-[0_10px_20px_-14px_rgba(220,38,38,.8)]' : 'border-[#d3b469] bg-white/75 text-[#68450e]'}`}
                      >
                        {agentLocked ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                      <button
                        onClick={() => exportPdf(r)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] border border-[#d3b469] bg-[linear-gradient(145deg,#fff8e6,#e9cd86)] px-3.5 text-[10px] font-black tracking-[0.11em] text-[#68450e] shadow-[0_10px_20px_-14px_rgba(111,72,10,.52)] transition hover:-translate-y-0.5 active:scale-95"
                      >
                        <FileDown size={14} strokeWidth={2.4} /> PDF
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="overflow-x-auto border-b border-[#e8dcc5] bg-[#faf7f1] p-3">
                     <div className="min-w-[820px] overflow-hidden rounded-[16px] border border-[#e2d4b9] bg-white">
                      <div className="grid grid-cols-[minmax(180px,1fr)_150px_90px_90px_110px_72px] border-b border-[#e4d6bc] bg-[#f2e5cd] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#79571f]">
                        <div>Locale</div>
                        <div>Data e ora inserimento</div>
                        <div className="text-right">Acconto</div>
                        <div className="text-right">Recupero</div>
                        <div className="text-right">Da riportare</div>
                        <div className="text-right">Azioni</div>
                      </div>

                      {agentMovements.length === 0 ? (
                        <div className="px-3 py-3 text-[12px] text-slate-500">
                          Nessun movimento trovato.
                        </div>
                      ) : (
                        agentMovements.map((m) => (
                          <div
                            key={m.id}
                            className="grid grid-cols-[minmax(180px,1fr)_150px_90px_90px_110px_72px] items-center border-b border-[#eee7da] px-3 py-2.5 text-[11px] last:border-0 even:bg-[#fffaf1]"
                          >
                            <div className="truncate font-semibold text-slate-700">
                              {venueLabel(m.venue_id)}
                            </div>

                            <div className="font-bold tabular-nums text-slate-500">{formatInsertedAt(m.created_at)}</div>

                            {isGenericMovement(m) ? (
                              <div className="col-span-3 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#946318]">OPERAZIONE GENERICA</div>
                            ) : (
                              <>
                                <div className="text-right font-black tabular-nums text-slate-800">{formatEuro0(m.acconto || 0)}</div>
                                <div className="text-right font-black tabular-nums text-slate-800">{formatEuro0(m.recupero || 0)}</div>
                                <div className="text-right font-black tabular-nums text-slate-800">{formatEuro0(m.da_riportare || 0)}</div>
                              </>
                            )}

                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditMov(m)}
                                title="Modifica movimento"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil size={13} strokeWidth={2.2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteMov(m)}
                                title="Elimina movimento"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-[var(--color-danger)] transition hover:bg-red-50"
                              >
                                <Trash2 size={13} strokeWidth={2.2} />
                              </button>
                            </div>
                          </div>
                        ))
)}
                     </div>
                    </div>
                  )}

                  {/* Totali del singolo agente */}
                  <div className="grid grid-cols-2 divide-x divide-y divide-[#eee5d4] border-t border-[#eee5d4] bg-[#fffdf9] md:grid-cols-5 md:divide-y-0">
                    <div className="bg-[#fff6dc] px-3 py-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#946318]">Totale</p>
                      <p className="mt-1 text-[23px] font-black tabular-nums text-[#241806]">{formatEuro0(cassaGenerale)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Fondo cassa</p>
                      <p className="mt-1 text-[17px] font-black tabular-nums text-[#33250f]">{formatEuro0(r.monete)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Acconti</p>
                      <p className="mt-1 text-[17px] font-black tabular-nums text-[#33250f]">{formatEuro0(r.acconti)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Recuperi</p>
                      <p className="mt-1 text-[17px] font-black tabular-nums text-[#33250f]">{formatEuro0(r.recuperi)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Da riportare</p>
                      <p className="mt-1 text-[17px] font-black tabular-nums text-[#33250f]">{formatEuro0(r.da_riportare)}</p>
                    </div>
                  </div>
                </article>
              )
            })}

            </section>
          </div>
        </div>
      </PageBody>

      {/* MODIFICA MOVIMENTO */}
      <ConfirmDialog
        open={!!lockTarget}
        onClose={() => setLockTarget(null)}
        title={lockTarget?.locked ? 'RIAPRIRE IL GIRO?' : 'CHIUDERE IL GIRO?'}
        message={lockTarget?.locked
          ? `${lockTarget?.name} tornerà a poter aggiungere, modificare ed eliminare movimenti e Fondo cassa.`
          : `${lockTarget?.name} potrà consultare i dati, ma non aggiungere, modificare o eliminare movimenti e Fondo cassa.`}
        confirmLabel="OK"
        variant={lockTarget?.locked ? 'success' : 'danger'}
        onConfirm={() => toggleAgentLock(lockTarget.id)}
      />

      <Modal
        open={!!editMov}
        onClose={() => setEditMov(null)}
        title="MODIFICA MOVIMENTO"
        width="sm"
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        {editMov && (
          <div className="space-y-4 rounded-[24px] bg-[#fbf8f1] p-1">
            <div className="rounded-[21px] border border-[#e3cb91] bg-[linear-gradient(135deg,#fffdf8,#f8edcf)] p-4 shadow-[0_12px_30px_rgba(111,76,14,.08)]">
              <p className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#8a641d]"><Building2 size={13}/> LOCALE</p>
              <p className="text-[15px] font-black text-[#3d2a0b]">{venueLabel(editMov.venue_id)}</p>
            </div>
            <div className="space-y-3">
              <AnalisiMoneyRow label="Acconto" icon={Plus} value={editDraft.acconto} onChange={(v) => setEditDraft((p) => ({ ...p, acconto: v }))} />
              <AnalisiMoneyRow label="Recupero" icon={RotateCcw} value={editDraft.recupero} onChange={(v) => setEditDraft((p) => ({ ...p, recupero: v }))} />
              <AnalisiMoneyRow label="Da riportare" icon={RefreshCw} value={editDraft.da_riportare} onChange={(v) => setEditDraft((p) => ({ ...p, da_riportare: v }))} />
            </div>
            <button onClick={saveMovimento} disabled={savingMov}
              className="w-full rounded-[18px] bg-[linear-gradient(135deg,#d49a26,#b88016)] py-4 text-[12px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_26px_rgba(181,128,22,.25)] disabled:opacity-50">
              {savingMov ? 'SALVATAGGIO…' : 'SALVA MODIFICHE'}
            </button>
          </div>
        )}
      </Modal>

      {/* ELIMINA MOVIMENTO */}
      <ConfirmDialog
        open={!!deleteMov}
        onClose={() => setDeleteMov(null)}
        title="Elimina movimento"
        message="Il movimento andrà nel Cestino e sparirà subito dall'app dipendente. Potrai ripristinarlo dal Cestino. Procedere?"
        confirmLabel="Elimina"
        onConfirm={doDeleteMovimento}
      />
    </PageLayout>
  )
}
