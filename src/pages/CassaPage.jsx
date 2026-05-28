import { useEffect, useMemo, useState } from 'react'
import {
  Calendar, User, Building2, Mail, Search, Plus, FileDown, RefreshCw,
  RotateCcw, Save,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Select, Badge, EmptyState, Card, Field, Modal,
  FilterBanner,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { SkeletonRow } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import {
  todayISO, firstDayOfMonthISO, toIT, formatDateTime, formatMoney, formatEuro0,
  dipendenteName, dipendenteId, normNumber,
} from '../lib/helpers'

/* ============ PDF EXPORT ============ */
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

async function exportMovementsToPdf({ dateLabel, operatorName, fondo, movements, totals }) {
  const mod = await import('jspdf')
  const jsPDF = mod.jsPDF || mod.default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let logoDataUrl = null
try {
  logoDataUrl = await toDataUrl(`${import.meta.env.BASE_URL}logo512.png.png`)
} catch (e) {
  console.warn('Logo PDF non caricato:', e)
}

  const pageW = doc.internal.pageSize.getWidth()
  const M = 34
  let y = M

  const C = {
    navy: [6, 16, 31], navy2: [8, 47, 73], cyan: [8, 145, 178],
    white: [255, 255, 255], text: [15, 23, 42], muted: [100, 116, 139],
    line: [226, 232, 240], soft: [248, 250, 252],
    blue: [14, 116, 144], orange: [234, 88, 12], green: [21, 128, 61],
  }

  const value = (n) => formatEuro0(Number(n) || 0)
  const label = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : String(v).trim())

  const headerH = 72
  doc.setFillColor(...C.navy)
  doc.roundedRect(M, y, pageW - M * 2, headerH, 18, 18, 'F')
  doc.setFillColor(...C.navy2)
  doc.roundedRect(M + 210, y, pageW - M * 2 - 210, headerH, 18, 18, 'F')

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', M + 16, y + 16, 38, 38) } catch {}
  }

  doc.setTextColor(180, 240, 250); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('PLAY MONEY', M + 66, y + 22)
  doc.setTextColor(...C.white); doc.setFontSize(11)
  doc.text(`Data: ${dateLabel}`, M + 66, y + 38)
  doc.text(`Operatore: ${operatorName || '—'}`, M + 66, y + 52)

  const fondoX = pageW - M - 255
  doc.setTextColor(180, 240, 250); doc.setFontSize(9)
  doc.text('FONDO CASSA', fondoX, y + 20)
  doc.setTextColor(...C.white); doc.setFontSize(9)
  doc.text(`Mezzo: ${label(fondo?.mezzo)}`, fondoX, y + 38)
  doc.text(`KM: ${label(fondo?.km)}`, fondoX + 116, y + 38)
  doc.text(`Monete: ${value(fondo?.monete)}`, fondoX, y + 56)
  doc.text(`Rif.: ${value(fondo?.rifornimento)}`, fondoX + 116, y + 56)

  y += headerH + 10

  const colHead = ['Locale', 'Ora', 'Acconto', 'Recupero', 'Da riportare']
  const colW = [(pageW - M * 2) * 0.34, 60, 100, 100, 110]
  const colX = []
  let cx = M
  colW.forEach((w) => { colX.push(cx); cx += w })

  doc.setFillColor(...C.soft); doc.rect(M, y, pageW - M * 2, 24, 'F')
  doc.setTextColor(...C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  colHead.forEach((h, i) => {
    const tx = i >= 2 ? colX[i] + colW[i] - 8 : colX[i] + 8
    doc.text(h, tx, y + 16, { align: i >= 2 ? 'right' : 'left' })
  })
  y += 24

  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text); doc.setFontSize(10)
  movements.forEach((m, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252); doc.rect(M, y, pageW - M * 2, 22, 'F')
    }
    doc.text(String(m.venueName || ''), colX[0] + 8, y + 15, { maxWidth: colW[0] - 16 })
    doc.text(String(m.operatorLabel || ''), colX[1] + 8, y + 15)
    doc.setTextColor(...C.blue); doc.text(value(m.acconto), colX[2] + colW[2] - 8, y + 15, { align: 'right' })
    doc.setTextColor(...C.orange); doc.text(value(m.recupero), colX[3] + colW[3] - 8, y + 15, { align: 'right' })
    doc.setTextColor(...C.green); doc.text(value(m.da_riportare), colX[4] + colW[4] - 8, y + 15, { align: 'right' })
    doc.setTextColor(...C.text)
    y += 22
  })

  y += 6
  doc.setDrawColor(...C.line); doc.line(M, y, pageW - M, y); y += 16

  doc.setFillColor(...C.navy); doc.roundedRect(M, y, pageW - M * 2, 120, 18, 18, 'F')
  doc.setTextColor(180, 240, 250); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('TOTALI', M + 18, y + 22)

  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.white); doc.setFontSize(11)
  doc.text(`Acconti: ${value(totals.accontiRaw)}`, M + 18, y + 44)
  doc.text(`Recuperi: ${value(totals.recuperiRaw)}`, M + 18, y + 60)
  doc.text(`Da riportare: ${value(totals.da_riportareRaw)}`, M + 18, y + 76)
  doc.text(`Monete: ${value(totals.moneteRaw)}`, M + 18, y + 92)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(180, 240, 250)
  doc.text('CASSA GENERALE', pageW - M - 18, y + 70, { align: 'right' })
  doc.setFontSize(24); doc.setTextColor(103, 232, 249)
  doc.text(value(totals.cassaGeneraleRaw), pageW - M - 18, y + 103, { align: 'right' })

  doc.save(`Movimenti_${dateLabel}.pdf`)
}

/* ============ PAGE ============ */
export default function CassaPage() {
  const toast = useToast()

  const [movements, setMovements] = useState([])
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [fondi, setFondi] = useState([])
  const [loading, setLoading] = useState(true)

  const [dateFrom, setDateFrom] = useState(firstDayOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [nomeLocale, setNomeLocale] = useState('')
  const [emailFilter, setEmailFilter] = useState('')

  const [showGeneric, setShowGeneric] = useState(false)
  const [pendingDeletes, setPendingDeletes] = useState(new Set())
  const [confirmSave, setConfirmSave] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [pdfDate, setPdfDate] = useState(todayISO())
  const [pdfEmployee, setPdfEmployee] = useState('all')

  const [newRow, setNewRow] = useState({
    work_date: todayISO(), venue_id: '', created_by: '',
    acconto: '', recupero: '', da_riportare: '', note: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [movRes, venRes, dipRes, fondoRes] = await Promise.all([
      supabase.from('movements_cassa').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('venues').select('*'),
      supabase.from('dipendenti').select('*'),
      supabase.from('fondo_cassa_giornaliero').select('*'),
    ])
    if (movRes.error) toast.error(`Errore movimenti: ${movRes.error.message}`)
    setMovements(movRes.data || [])
    setVenues(venRes.data || [])
    setDipendenti(dipRes.data || [])
    setFondi(fondoRes.data || [])
    setPendingDeletes(new Set())
    setLoading(false)
  }

  function venueLabel(id) {
    const v = venues.find((x) => String(x.id) === String(id))
    if (!v) return id || '—'
    const name = String(v.name || '').trim()
    if (name.toLowerCase().startsWith(String(v.id).toLowerCase())) return name
    return `${v.id} ${name}`
  }

  function operatorById(id) {
    return dipendenti.find((d) => String(dipendenteId(d)) === String(id))
  }

  const rows = useMemo(() => {
    const nome_q = nome.trim().toLowerCase()
    const cog_q = cognome.trim().toLowerCase()
    const loc_q = nomeLocale.trim().toLowerCase()
    const mail_q = emailFilter.trim().toLowerCase()
    return movements.filter((r) => {
      if (!showGeneric && !r.venue_id) return false
      if (dateFrom && r.work_date < dateFrom) return false
      if (dateTo && r.work_date > dateTo) return false
      const dip = operatorById(r.created_by)
      const fullName = dipendenteName(dip).toLowerCase()
      if (nome_q && !fullName.includes(nome_q)) return false
      if (cog_q && !fullName.includes(cog_q)) return false
      const venueText = venueLabel(r.venue_id).toLowerCase()
      if (loc_q && !venueText.includes(loc_q)) return false
      if (mail_q) {
        const email = String(dip?.email || '').toLowerCase()
        if (!email.includes(mail_q)) return false
      }
      return true
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }, [movements, dateFrom, dateTo, nome, cognome, nomeLocale, emailFilter, showGeneric, venues, dipendenti])

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.acconto += Number(r.acconto || 0)
    acc.recupero += Number(r.recupero || 0)
    acc.da_riportare += Number(r.da_riportare || 0)
    return acc
  }, { acconto: 0, recupero: 0, da_riportare: 0 }), [rows])

  function toggleRow(id) {
    setPendingDeletes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    if (pendingDeletes.size === rows.length) setPendingDeletes(new Set())
    else setPendingDeletes(new Set(rows.map((r) => r.id)))
  }

  function cancelPending() {
    setPendingDeletes(new Set())
  }

  async function confirmDeletePending() {
    const ids = Array.from(pendingDeletes)
    const { error } = await supabase
      .from('movements_cassa').update({ deleted_at: new Date().toISOString() }).in('id', ids)
    if (error) throw new Error(error.message)
    setMovements((prev) => prev.filter((x) => !pendingDeletes.has(x.id)))
    setPendingDeletes(new Set())
    setConfirmSave(false)
    toast.success(`${ids.length} movimenti cancellati`)
  }

  async function createMovement() {
    if (!newRow.work_date || !newRow.venue_id || !newRow.created_by) {
      toast.warning('Data, locale e agente sono obbligatori'); return
    }
    const { error } = await supabase.from('movements_cassa').insert({
      client_id: crypto?.randomUUID?.() || String(Date.now()),
      work_date: newRow.work_date, venue_id: newRow.venue_id, created_by: newRow.created_by,
      acconto: normNumber(newRow.acconto), recupero: normNumber(newRow.recupero),
      da_riportare: normNumber(newRow.da_riportare), note: newRow.note || null,
    })
    if (error) { toast.error(`Errore: ${error.message}`); return }
    setNewOpen(false)
    setNewRow({ work_date: todayISO(), venue_id: '', created_by: '', acconto: '', recupero: '', da_riportare: '', note: '' })
    toast.success('Movimento creato')
    await loadData()
  }

  async function generatePdf() {
    const pdfRows = movements.filter((r) => {
      if (r.work_date !== pdfDate) return false
      if (pdfEmployee !== 'all' && String(r.created_by) !== String(pdfEmployee)) return false
      return true
    })
    if (pdfRows.length === 0) { toast.warning('Nessun movimento per questo PDF'); return }
    const employee = pdfEmployee === 'all' ? 'TUTTI' : dipendenteName(operatorById(pdfEmployee))
    const fondo = fondi.find((f) => {
      if (String(f.work_date) !== String(pdfDate)) return false
      if (pdfEmployee === 'all') return true
      return String(f.created_by) === String(pdfEmployee)
    }) || {}
    const sum = (key) => pdfRows.reduce((acc, r) => acc + Number(r[key] || 0), 0)
    const moneteRaw = Number(fondo?.monete || 0)

    await exportMovementsToPdf({
      dateLabel: toIT(pdfDate), operatorName: employee, fondo,
      movements: pdfRows.map((r) => ({
        venueName: venueLabel(r.venue_id),
        operatorLabel: new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        acconto: Number(r.acconto || 0), recupero: Number(r.recupero || 0), da_riportare: Number(r.da_riportare || 0),
      })),
      totals: {
        accontiRaw: sum('acconto'), recuperiRaw: sum('recupero'), da_riportareRaw: sum('da_riportare'),
        moneteRaw, cassaGeneraleRaw: moneteRaw + sum('acconto') + sum('recupero') - sum('da_riportare'),
      },
    })
    setPdfOpen(false)
    toast.success('PDF generato')
  }

  const hasPending = pendingDeletes.size > 0
  const allChecked = rows.length > 0 && pendingDeletes.size === rows.length

  // 4 FILTER BANNERS comune a mobile/desktop
  const filterBanners = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <FilterBanner tone="info" icon={Calendar} label="Ricerca per data">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </FilterBanner>

      <FilterBanner tone="warning" icon={User} label="Utente">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
        <Input value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Cognome" />
      </FilterBanner>

      <FilterBanner tone="success" icon={Building2} label="Locale">
        <Input value={nomeLocale} onChange={(e) => setNomeLocale(e.target.value)} placeholder="nome locale" />
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="show-generic"
            checked={showGeneric}
            onChange={(e) => setShowGeneric(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          <label htmlFor="show-generic" className="cursor-pointer text-[12px] text-[var(--color-text-secondary)]">
            Mostra operazioni generiche
          </label>
        </div>
      </FilterBanner>

      <FilterBanner tone="danger" icon={Mail} label="e-mail">
        <Input
          leftIcon={Search}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          placeholder="cerca per email"
        />
      </FilterBanner>
    </div>
  )

  return (
    <PageLayout>
      <PageHeader
        title="CASSA"
        subtitle={loading ? 'Caricamento…' : `${rows.length} movimenti · ${formatMoney(totals.acconto)} € acconti`}
        actions={
          <>
            {/* Bottone filtri solo mobile */}
            <Button variant="secondary" icon={Search} onClick={() => setFiltersOpen(true)} className="md:hidden">
              Filtri
            </Button>
            <IconButton icon={RefreshCw} onClick={loadData} title="Aggiorna" />
            <Button icon={FileDown} onClick={() => setPdfOpen(true)}>
              <span className="hidden md:inline">Esporta PDF</span>
              <span className="md:hidden">PDF</span>
            </Button>
            <Button icon={Plus} variant="primary" onClick={() => setNewOpen(true)}>
              <span className="hidden md:inline">Nuovo</span>
            </Button>
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          {/* Filtri inline su desktop */}
          <div className="hidden md:block">
            {filterBanners}
          </div>

          <Card>
            <div className="flex flex-col gap-2 border-b border-[var(--color-border)] px-3 py-2 md:flex-row md:items-center md:justify-between">
              <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                Lista movimenti {rows.length > 0 && <span className="text-[var(--color-text-muted)]">({rows.length} righe)</span>}
              </p>
              {hasPending && (
                <div className="flex items-center gap-2">
                  <Badge variant="danger" size="sm">{pendingDeletes.size} da cancellare</Badge>
                  <Button size="sm" icon={RotateCcw} variant="ghost" onClick={cancelPending} className="flex-1 md:flex-initial">Annulla</Button>
                  <Button size="sm" icon={Save} variant="success" onClick={() => setConfirmSave(true)} className="flex-1 md:flex-initial">Salva</Button>
                </div>
              )}
            </div>

            {/* TABELLA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1100px] text-[13px]">
                <thead className="bg-[var(--color-surface)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox" checked={allChecked} onChange={selectAllVisible}
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-danger)]"
                      />
                    </th>
                    <Th>stato</Th>
                    <Th>data</Th>
                    <Th>Locale</Th>
                    <Th>Utente</Th>
                    <Th className="text-right">Acconto</Th>
                    <Th className="text-right">Recupero<br/>da riportare</Th>
                    <Th className="text-right">da Riportare</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}

                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={9}>
                      <EmptyState title="Nessun movimento" description="Modifica i filtri o crea un nuovo movimento." />
                    </td></tr>
                  )}

                  {!loading && rows.map((r) => {
                    const pending = pendingDeletes.has(r.id)
                    return (
                      <tr
                        key={r.id}
                        className={`group border-b border-[var(--color-border)] last:border-0 transition-colors ${
                          pending ? 'bg-[var(--color-danger-soft)]' : 'hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox" checked={pending} onChange={() => toggleRow(r.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-danger)]"
                          />
                        </td>
                        <Td>
                          <Badge variant={pending ? 'danger' : 'success'} size="sm">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${pending ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'}`} />
                            {pending ? 'cancellato' : 'attivo'}
                          </Badge>
                        </Td>
                        <Td className={`tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {formatDateTime(r.created_at)}
                        </Td>
                        <Td className={`font-medium ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                          {r.venue_id ? venueLabel(r.venue_id) : <span className="italic text-[var(--color-text-muted)]">— generico —</span>}
                        </Td>
                        <Td className={pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}>
                          {dipendenteName(operatorById(r.created_by))}
                        </Td>
                        <Td className={`text-right font-medium tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                          {formatMoney(r.acconto)}
                        </Td>
                        <Td className={`text-right font-medium tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {formatMoney(r.recupero)}
                        </Td>
                        <Td className={`text-right font-medium tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                          {formatMoney(r.da_riportare)}
                        </Td>
                        <Td>
                          <button
                            onClick={() => toggleRow(r.id)}
                            className="text-[12px] font-medium text-[var(--color-danger)] opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                          >
                            {pending ? 'Ripristina' : 'Cancella'}
                          </button>
                        </Td>
                      </tr>
                    )
                  })}

                  {!loading && rows.length > 0 && (
                    <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] font-semibold">
                      <td colSpan={5} className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Totali</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-text)]">{formatMoney(totals.acconto)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-text-secondary)]">{formatMoney(totals.recupero)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-success)]">{formatMoney(totals.da_riportare)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* LISTA CARD MOBILE */}
            <div className="md:hidden divide-y divide-[var(--color-border)]">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-surface-active)]" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[var(--color-surface-active)]" />
                </div>
              ))}

              {!loading && rows.length === 0 && (
                <div className="py-8">
                  <EmptyState title="Nessun movimento" description="Modifica i filtri o crea un nuovo movimento." />
                </div>
              )}

              {!loading && rows.map((r) => {
                const pending = pendingDeletes.has(r.id)
                return (
                  <div
                    key={r.id}
                    className={`px-3 py-3 ${pending ? 'bg-[var(--color-danger-soft)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-medium ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                          {r.venue_id ? venueLabel(r.venue_id) : <span className="italic text-[var(--color-text-muted)]">generico</span>}
                        </p>
                        <p className={`text-[12px] ${pending ? 'line-through' : 'text-[var(--color-text-secondary)]'}`}>
                          {dipendenteName(operatorById(r.created_by))}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] tabular-nums">
                          {formatDateTime(r.created_at)}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={pending}
                        onChange={() => toggleRow(r.id)}
                        className="h-5 w-5 cursor-pointer accent-[var(--color-danger)]"
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-2">
                      <div>
                        <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Acconto</p>
                        <p className={`text-[13px] font-semibold tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : ''}`}>{formatMoney(r.acconto)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Recupero</p>
                        <p className={`text-[13px] font-semibold tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>{formatMoney(r.recupero)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Da Riportare</p>
                        <p className={`text-[13px] font-semibold tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>{formatMoney(r.da_riportare)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Totali mobile */}
              {!loading && rows.length > 0 && (
                <div className="bg-[var(--color-surface)] px-3 py-3">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Totali</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Acconto</p>
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--color-text)]">{formatMoney(totals.acconto)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Recupero</p>
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--color-text-secondary)]">{formatMoney(totals.recupero)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Da Riportare</p>
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--color-success)]">{formatMoney(totals.da_riportare)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageBody>

      {/* Modal filtri mobile */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtri di ricerca" width="md"
        footer={<Button variant="primary" onClick={() => setFiltersOpen(false)}>Applica</Button>}
      >
        {filterBanners}
      </Modal>

      {/* New movement */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nuovo movimento"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Annulla</Button>
            <Button variant="primary" icon={Save} onClick={createMovement}>Crea movimento</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Data" required>
            <Input type="date" value={newRow.work_date} onChange={(e) => setNewRow((p) => ({ ...p, work_date: e.target.value }))} />
          </Field>
          <Field label="Locale" required>
            <Select value={newRow.venue_id} onChange={(e) => setNewRow((p) => ({ ...p, venue_id: e.target.value }))}>
              <option value="">Seleziona locale…</option>
              {venues.map((v) => (<option key={v.id} value={v.id}>{venueLabel(v.id)}</option>))}
            </Select>
          </Field>
          <Field label="Agente" required className="md:col-span-2">
            <Select value={newRow.created_by} onChange={(e) => setNewRow((p) => ({ ...p, created_by: e.target.value }))}>
              <option value="">Seleziona agente…</option>
              {dipendenti.map((d) => (<option key={dipendenteId(d)} value={dipendenteId(d)}>{dipendenteName(d)}</option>))}
            </Select>
          </Field>
          <Field label="Acconto">
            <Input type="number" value={newRow.acconto} onChange={(e) => setNewRow((p) => ({ ...p, acconto: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Recupero">
            <Input type="number" value={newRow.recupero} onChange={(e) => setNewRow((p) => ({ ...p, recupero: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Da riportare" className="md:col-span-2">
            <Input type="number" value={newRow.da_riportare} onChange={(e) => setNewRow((p) => ({ ...p, da_riportare: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Note" className="md:col-span-2">
            <Input value={newRow.note} onChange={(e) => setNewRow((p) => ({ ...p, note: e.target.value }))} placeholder="Note opzionali…" />
          </Field>
        </div>
      </Modal>

      {/* PDF export */}
      <Modal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        title="Esporta PDF movimenti"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPdfOpen(false)}>Annulla</Button>
            <Button icon={FileDown} variant="primary" onClick={generatePdf}>Genera PDF</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Giorno">
            <Input type="date" value={pdfDate} onChange={(e) => setPdfDate(e.target.value)} />
          </Field>
          <Field label="Agente">
            <Select value={pdfEmployee} onChange={(e) => setPdfEmployee(e.target.value)}>
              <option value="all">Tutti gli operatori</option>
              {dipendenti.map((d) => (<option key={dipendenteId(d)} value={dipendenteId(d)}>{dipendenteName(d)}</option>))}
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        title="Conferma cancellazione"
        message={`Confermi la cancellazione di ${pendingDeletes.size} movimenti? Andranno nel Cestino e potrai ripristinarli.`}
        confirmLabel="Sì, cancella"
        variant="danger"
        onConfirm={confirmDeletePending}
      />
    </PageLayout>
  )
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${className}`}>{children}</th>
}
function Td({ children, className = '' }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}
