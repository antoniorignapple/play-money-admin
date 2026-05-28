import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FileDown, Users, Wallet, Car, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  IconButton, Input, EmptyState, Card, Stat,
} from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { SkeletonCard } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import {
  todayISO, toIT, formatMoney, formatEuro, formatEuro0,
  dipendenteName, dipendenteId, initials, avatarColor,
} from '../lib/helpers'

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

export default function AnalisiPage() {
  const toast = useToast()
  const [data, setData] = useState(todayISO())
  const [movements, setMovements] = useState([])
  const [fondi, setFondi] = useState([])
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedAgentId, setExpandedAgentId] = useState(null)

  useEffect(() => { loadData() }, [data])

  async function loadData() {
    setLoading(true)
    const [movRes, fondoRes, venRes, dipRes] = await Promise.all([
      supabase.from('movements_cassa').select('*').eq('work_date', data).is('deleted_at', null),
      supabase.from('fondo_cassa_giornaliero').select('*').eq('work_date', data),
      supabase.from('venues').select('*'),
      supabase.from('dipendenti').select('*'),
    ])
    if (movRes.error) toast.error(`Errore: ${movRes.error.message}`)
    setMovements(movRes.data || [])
    setFondi(fondoRes.data || [])
    setVenues(venRes.data || [])
    setDipendenti(dipRes.data || [])
    setLoading(false)
  }

  function venueLabel(id) {
    const v = venues.find((x) => String(x.id) === String(id))
    if (!v) return id || '—'
    const name = String(v.name || '').trim()
    if (name.toLowerCase().startsWith(String(v.id).toLowerCase())) return name
    return `${v.id} ${name}`
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
        acconto: m.acconto,
        recupero: m.recupero,
        da_riportare: m.da_riportare,
      })),
    })

    toast.success('PDF generato')
  }

  return (
    <PageLayout>
      <PageHeader
        title="Analisi"
        subtitle={`Riepilogo giornaliero · ${toIT(data)}`}
        actions={
          <>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full md:w-44"
            />
            <IconButton icon={RefreshCw} onClick={loadData} title="Aggiorna" />
          </>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 md:space-y-4 md:px-5 md:py-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
            <Stat label="Agenti" value={agentRows.length} icon={Users} />
            <Stat label="Acconti" value={formatEuro(grandTotals.acconti)} tone="accent" icon={Wallet} />
            <Stat label="Recuperi" value={formatEuro(grandTotals.recuperi)} />
            <Stat label="Da riportare" value={formatEuro(grandTotals.da_riportare)} tone="success" />
            <Stat label="Rifornimento" value={formatEuro(grandTotals.rifornimento)} tone="warning" icon={Car} />
          </div>

          <Card>
            <div className="border-b border-[var(--color-border)] px-3 py-3 md:px-4">
              <p className="text-[13px] font-medium text-[var(--color-text)]">
                Lista agenti <span className="text-[var(--color-text-muted)]">(record: {agentRows.length})</span>
              </p>
            </div>

            {loading && (
              <div className="space-y-2 p-3">
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

              return (
                <div
                  key={r.id}
                  className="border-b border-[var(--color-border)] px-3 py-3 last:border-0 hover:bg-[var(--color-surface-hover)] md:px-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${avatarColor(r.name)}`}>
                        {initials(r.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[var(--color-text)]">{r.name}</p>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-success)] md:text-[11px]">
                          <span>Fondo: <strong className="tabular-nums">{formatEuro(r.monete)}</strong></span>
                          <span>Flusso: <strong className="tabular-nums">{formatEuro(r.acconti + r.recuperi - r.da_riportare)}</strong></span>
                          <span>Cassa Gen: <strong className="tabular-nums">{formatEuro(cassaGenerale)}</strong></span>
                          <span>Km: <strong className="tabular-nums">{r.km || '—'}</strong></span>
                          <span>Rifornimento: <strong className="tabular-nums">{formatEuro(r.rifornimento)}</strong></span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedAgentId(isExpanded ? null : String(r.id))}
                          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Movimenti
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => exportPdf(r)}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-500 bg-blue-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      <FileDown size={14} strokeWidth={2.4} />
                      PDF
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px] border-b border-[var(--color-border)] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <div>Locale</div>
                        <div className="text-right text-blue-600">Acconto</div>
                        <div className="text-right text-orange-600">Recupero</div>
                        <div className="text-right text-emerald-600">Da riportare</div>
                      </div>

                      {agentMovements.length === 0 ? (
                        <div className="px-3 py-3 text-[12px] text-slate-500">
                          Nessun movimento trovato.
                        </div>
                      ) : (
                        agentMovements.map((m) => (
                          <div
                            key={m.id}
                            className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px] border-b border-slate-100 px-3 py-2 text-[12px] last:border-0"
                          >
                            <div className="truncate font-semibold text-slate-700">
                              {venueLabel(m.venue_id)}
                            </div>

                            <div className="text-right font-bold tabular-nums text-blue-600">
                              {formatMoney(m.acconto || 0)}
                            </div>

                            <div className="text-right font-bold tabular-nums text-orange-600">
                              {formatMoney(m.recupero || 0)}
                            </div>

                            <div className="text-right font-bold tabular-nums text-emerald-600">
                              {formatMoney(m.da_riportare || 0)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {!loading && agentRows.length > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px] border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-3 font-bold md:px-4">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Totali
                </p>

                <div className="text-right">
                  <p className="hidden text-[10px] uppercase text-blue-600 md:block">Acconti</p>
                  <p className="text-[14px] tabular-nums text-blue-600">{formatMoney(grandTotals.acconti)}</p>
                </div>

                <div className="text-right">
                  <p className="hidden text-[10px] uppercase text-orange-600 md:block">Recuperi</p>
                  <p className="text-[14px] tabular-nums text-orange-600">{formatMoney(grandTotals.recuperi)}</p>
                </div>

                <div className="text-right">
                  <p className="hidden text-[10px] uppercase text-emerald-600 md:block">Da riportare</p>
                  <p className="text-[14px] tabular-nums text-emerald-600">{formatMoney(grandTotals.da_riportare)}</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </PageBody>
    </PageLayout>
  )
}