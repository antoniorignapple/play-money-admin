import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Check, ChevronRight, Plus, RefreshCw, Search, Trash2, Calculator, X, AlertTriangle, FileText, ReceiptText,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { jsPDF } from 'jspdf'
import { createPdfPreviewWindow, openPdfPreview, closePdfPreviewWindow } from '../lib/pdfPreview'
import { PageLayout, PageBody } from '../components/PageLayout'
import { useToast } from '../components/Toast'

function euro(value) {
  const amount = Math.trunc(Number(value) || 0)
  return `${amount.toLocaleString('it-IT')} €`
}

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(`${value}T12:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('it-IT')
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase()

export default function ContabilitaConteggiPage() {
  const toast = useToast()
  const [periods, setPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [detail, setDetail] = useState(null)
  const [conteggi, setConteggi] = useState([])
  const [overrides, setOverrides] = useState([])
  const [venues, setVenues] = useState([])
  const [selectedDebtIds, setSelectedDebtIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [debtsOpen, setDebtsOpen] = useState(false)
  const [debtSearch, setDebtSearch] = useState('')
  const [savingDebtId, setSavingDebtId] = useState('')

  const [newOpen, setNewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ amount: '', destination: '', transfer_date: todayISO(), note: '' })
  const [manualRows, setManualRows] = useState([])

  useEffect(() => { loadPeriods() }, [])
  useEffect(() => { if (selectedPeriodId) loadAll(false, selectedPeriodId) }, [selectedPeriodId])

  async function loadPeriods(silent = false, preferId = '') {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const { data, error } = await supabase
        .from('conteggi_periods')
        .select('id,title,date_from,date_to,status,is_active,created_at')
        .order('date_from', { ascending: false })
      if (error) throw error
      const rows = data || []
      setPeriods(rows)
      const active = rows.find((p) => p.status === 'open' && p.is_active === true)
      const desired = preferId || selectedPeriodId || active?.id || rows[0]?.id || ''
      setSelectedPeriodId((current) => rows.some((p) => p.id === desired) ? desired : (active?.id || rows[0]?.id || current || ''))
      if (!rows.length) {
        setDetail(null)
        setConteggi([])
        setOverrides([])
        setSelectedDebtIds(new Set())
        setManualRows([])
      }
    } catch (e) {
      toast.error(`Contabilità Conteggi: ${e.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadAll(silent = false, periodId = selectedPeriodId) {
    if (!periodId) return
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [detailRes, conteggiRes, overrideRes, venueRes, selectedRes, manualRes] = await Promise.all([
        supabase.rpc('get_contabilita_cassa_periodo', { p_period_id: periodId }),
        supabase
          .from('conteggi_tool')
          .select('id,period_id,venue_id,conteggio_date,esattore,debito,operator_name,executor_name_snapshot,giro_name_snapshot,created_at')
          .eq('period_id', periodId)
          .order('conteggio_date', { ascending: true }),
        supabase
          .from('conteggi_admin_overrides')
          .select('id,period_id,operator_name,esattore_override')
          .eq('period_id', periodId),
        supabase.from('venues').select('id,name'),
        supabase
          .from('contabilita_conteggi_debiti_selezionati')
          .select('conteggio_id')
          .eq('period_id', periodId),
        supabase
          .from('contabilita_conteggi_righe')
          .select('id,period_id,work_date,description,amount,note,created_at')
          .eq('period_id', periodId)
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (detailRes.error) throw detailRes.error
      if (conteggiRes.error) throw conteggiRes.error
      if (overrideRes.error) throw overrideRes.error
      if (venueRes.error) throw venueRes.error
      if (selectedRes.error) throw selectedRes.error
      if (manualRes.error) throw manualRes.error

      setDetail(detailRes.data || null)
      setConteggi(conteggiRes.data || [])
      setOverrides(overrideRes.data || [])
      setVenues(venueRes.data || [])
      setSelectedDebtIds(new Set((selectedRes.data || []).map((x) => String(x.conteggio_id))))
      setManualRows(manualRes.data || [])
    } catch (e) {
      toast.error(`Contabilità Conteggi: ${e.message}`)
      setDetail(null)
      setConteggi([])
      setOverrides([])
      setSelectedDebtIds(new Set())
      setManualRows([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const period = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) || null,
    [periods, selectedPeriodId],
  )

  const venueById = useMemo(() => {
    const map = new Map()
    venues.forEach((v) => map.set(String(v.id), v.name || v.id))
    return map
  }, [venues])

  const totaleEsattore = useMemo(() => {
    const groups = new Map()
    conteggi.forEach((row) => {
      const operator = String(row.operator_name || row.executor_name_snapshot || 'Senza operatore').trim()
      const key = normalizeText(operator)
      if (!groups.has(key)) groups.set(key, { operator, value: 0 })
      groups.get(key).value += Number(row.esattore) || 0
    })

    overrides.forEach((override) => {
      const key = normalizeText(override.operator_name)
      if (!groups.has(key)) groups.set(key, { operator: override.operator_name, value: 0 })
      groups.get(key).value = Math.trunc(Number(override.esattore_override) || 0)
    })

    return Array.from(groups.values()).reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  }, [conteggi, overrides])

  const debts = useMemo(() => conteggi
    .filter((row) => Number(row.debito) > 0)
    .map((row) => ({
      ...row,
      amount: Math.trunc(Number(row.debito) || 0),
      venueName: venueById.get(String(row.venue_id)) || row.venue_id || 'Locale',
      operatorName: row.operator_name || row.executor_name_snapshot || '—',
    })), [conteggi, venueById])

  const selectedDebtTotal = useMemo(() => debts.reduce((sum, row) => (
    selectedDebtIds.has(String(row.id)) ? sum + row.amount : sum
  ), 0), [debts, selectedDebtIds])

  const totaleGlobale = totaleEsattore + selectedDebtTotal
  const transfers = Array.isArray(detail?.transfers) ? detail.transfers : []
  const allMovements = useMemo(() => [
    ...transfers.map((row) => ({ ...row, source: 'cassa', workDate: row.transfer_date, description: row.destination })),
    ...manualRows.map((row) => ({ ...row, source: 'manual', workDate: row.work_date, destination: row.description })),
  ].sort((a, b) => String(a.workDate || '').localeCompare(String(b.workDate || ''))), [transfers, manualRows])
  const totaleMovimenti = useMemo(() => allMovements.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [allMovements])
  const saldoAzienda = totaleGlobale - totaleMovimenti

  const filteredDebts = useMemo(() => {
    const q = normalizeText(debtSearch)
    if (!q) return debts
    return debts.filter((row) => normalizeText(`${row.venueName} ${row.operatorName} ${row.venue_id}`).includes(q))
  }, [debts, debtSearch])

  async function toggleDebt(row) {
    if (!period || savingDebtId) return
    const id = String(row.id)
    const isSelected = selectedDebtIds.has(id)
    setSavingDebtId(id)

    setSelectedDebtIds((current) => {
      const next = new Set(current)
      if (isSelected) next.delete(id)
      else next.add(id)
      return next
    })

    try {
      if (isSelected) {
        const { error } = await supabase
          .from('contabilita_conteggi_debiti_selezionati')
          .delete()
          .eq('period_id', period.id)
          .eq('conteggio_id', row.id)
        if (error) throw error
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const userId = authData?.user?.id
        if (!userId) throw new Error('Sessione Admin non disponibile')
        const { error } = await supabase
          .from('contabilita_conteggi_debiti_selezionati')
          .insert({ period_id: period.id, conteggio_id: row.id, selected_by: userId })
        if (error) throw error
      }
    } catch (e) {
      setSelectedDebtIds((current) => {
        const next = new Set(current)
        if (isSelected) next.add(id)
        else next.delete(id)
        return next
      })
      toast.error(`Selezione debito: ${e.message}`)
    } finally {
      setSavingDebtId('')
    }
  }

  function openNew() {
    if (!period) return
    const now = todayISO()
    setForm({
      amount: '',
      destination: '',
      transfer_date: now < period.date_from ? period.date_from : now > period.date_to ? period.date_to : now,
      note: '',
    })
    setNewOpen(true)
  }

  async function createTransfer() {
    const amount = Number(String(form.amount).replace(',', '.'))
    if (!Number.isFinite(amount)) {
      toast.warning('Inserisci un importo valido')
      return
    }
    if (!form.destination.trim()) {
      toast.warning('Inserisci la descrizione del movimento')
      return
    }
    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const userId = authData?.user?.id
      if (!userId) throw new Error('Sessione Admin non disponibile')
      const { error } = await supabase.from('contabilita_conteggi_righe').insert({
        period_id: period.id,
        work_date: form.transfer_date,
        description: form.destination.trim(),
        amount,
        note: form.note.trim() || null,
        created_by: userId,
      })
      if (error) throw error
      setNewOpen(false)
      await loadAll(true)
      toast.success(`Movimento registrato • ${euro(amount)}`)
    } catch (e) {
      toast.error(`Movimento contabile: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransfer() {
    if (!deleteRow) return
    setDeleting(true)
    try {
      if (deleteRow.source === 'cassa') {
        const { error } = await supabase.rpc('elimina_trasferimento_cassa', { p_transfer_id: deleteRow.id })
        if (error) throw error
        window.dispatchEvent(new Event('cassa-totale-refresh'))
      } else {
        const { error } = await supabase
          .from('contabilita_conteggi_righe')
          .delete()
          .eq('id', deleteRow.id)
          .eq('period_id', period.id)
        if (error) throw error
      }
      setDeleteRow(null)
      await loadAll(true)
      toast.success('Movimento eliminato')
    } catch (e) {
      toast.error(`Eliminazione: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  function generatePdf() {
    if (!period) return
    let previewWindow
    try {
      previewWindow = createPdfPreviewWindow()
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = 297, H = 210, M = 14
      doc.setTextColor(55, 39, 13)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
      doc.text('PLAY MONEY · CONTABILITA CONTEGGI', M, 18)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text(`Periodo ${fmtDate(period.date_from)} - ${fmtDate(period.date_to)}`, M, 25)
      const metrics = [
        ['TOTALE ESATTORE CONTEGGI', totaleEsattore],
        ['TOTALE RECUPERI ACCONTO AGGIO', selectedDebtTotal],
        ['TOTALE GLOBALE', totaleGlobale],
      ]
      let x=M, y=34; const bw=84
      metrics.forEach(([label,value],i)=>{
        doc.setDrawColor(205,166,64); doc.roundedRect(x+i*(bw+7), y, bw, 22, 3, 3)
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.text(label, x+4+i*(bw+7), y+7)
        doc.setFontSize(15); doc.text(euro(value), x+bw-4+i*(bw+7), y+16, {align:'right'})
      })
      y=66
      doc.setFontSize(9); doc.text('MOVIMENTI', M, y); y+=6
      doc.setFontSize(7); doc.setFont('helvetica','bold')
      doc.text('DATA',M,y); doc.text('DESCRIZIONE',M+30,y); doc.text('NOTA',M+120,y); doc.text('IMPORTO',W-M,y,{align:'right'}); y+=3
      doc.setDrawColor(210); doc.line(M,y,W-M,y); y+=5
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
      for (const row of allMovements) {
        if (y > H-30) { doc.addPage('a4','landscape'); y=18 }
        doc.text(fmtDate(row.workDate),M,y)
        doc.text(String(row.destination || row.description || '').slice(0,48),M+30,y)
        doc.text(String(row.note || '').slice(0,55),M+120,y)
        doc.setFont('helvetica','bold'); doc.text(euro(row.amount),W-M,y,{align:'right'}); doc.setFont('helvetica','normal')
        y+=7
      }
      y=Math.min(Math.max(y+4, H-25), H-20)
      doc.setDrawColor(184,137,34); doc.line(M,y-5,W-M,y-5)
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text('SALDO AZIENDA',M,y+3)
      doc.setFontSize(20); doc.text(euro(saldoAzienda),W-M,y+3,{align:'right'})
      openPdfPreview(doc, previewWindow)
    } catch (e) {
      closePdfPreviewWindow(previewWindow)
      toast.error(`PDF: ${e.message}`)
    }
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="mx-auto max-w-[1320px] space-y-5 px-3 py-4 md:px-5">
          <div className="flex items-center justify-center py-1">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#d9b45f]/35 bg-white/70 px-5 py-2.5 shadow-[0_10px_30px_-22px_rgba(95,64,11,.55)] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4e7c2] text-[#98701f]"><Calculator size={15}/></div>
              <h1 className="text-[15px] font-black uppercase tracking-[0.20em] text-[#3d2a0b] md:text-[17px]">Contabilità Conteggi</h1>
              <button onClick={() => { loadPeriods(true, selectedPeriodId); loadAll(true, selectedPeriodId) }} disabled={refreshing} title="Aggiorna"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#d9b45f]/35 bg-white text-[#98701f] disabled:opacity-40">
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/>
              </button>
            </div>
          </div>

          {period ? (
            <>
              <section className="overflow-hidden rounded-[25px] border border-[#d1a640] bg-[#fff9e9] shadow-[0_20px_55px_-38px_rgba(82,52,4,.8)]">
                <div className="border-b border-[#d9b45f]/35 bg-[linear-gradient(110deg,#fff1c7,#efd17a)] px-5 py-4 md:px-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[260px]">
                      <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#80550d]">Periodo selezionato</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={selectedPeriodId}
                          onChange={(e) => setSelectedPeriodId(e.target.value)}
                          className="h-11 min-w-[245px] rounded-[13px] border border-[#b98b2c] bg-white/85 px-3 text-[12px] font-black text-[#3d2a0b] outline-none focus:border-[#8b5d12]"
                        >
                          {periods.map((item) => (
                            <option key={item.id} value={item.id}>
                              {fmtDate(item.date_from)} → {fmtDate(item.date_to)}{item.status === 'closed' ? ' • CHIUSO' : ' • ATTUALE'}
                            </option>
                          ))}
                        </select>
                        <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] ${period.status === 'closed' ? 'bg-[#3d2a0b] text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                          {period.status === 'closed' ? 'Archivio' : 'Attuale'}
                        </span>
                      </div>
                    </div>
                    <button onClick={generatePdf} title="Apri PDF A4 orizzontale" className="inline-flex h-12 items-center gap-2.5 rounded-[14px] border border-[#a87310] bg-[linear-gradient(135deg,#fffdf7,#f4d47c)] px-5 text-[12px] font-black uppercase tracking-[.14em] text-[#6b4305] shadow-[0_8px_22px_-12px_rgba(120,75,5,.7)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(120,75,5,.8)]">
                      <FileText size={18} strokeWidth={2.4}/> PDF
                    </button>
                  </div>
                </div>

                <AccountingRow
                  label="TOTALE ESATTORE CONTEGGI"
                  value={loading ? '—' : euro(totaleEsattore)}
                />
                <AccountingRow
                  label="TOTALE RECUPERI ACCONTO AGGIO"
                  value={loading ? '—' : euro(selectedDebtTotal)}
                  action={
                    <button onClick={() => setDebtsOpen(true)}
                      className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#bd8c25] bg-white/75 px-3 text-[9px] font-black uppercase tracking-[.11em] text-[#6a460b] shadow-sm transition hover:bg-white">
                      Seleziona debiti <ChevronRight size={14}/>
                    </button>
                  }
                />
                <div className="grid min-h-[98px] grid-cols-[1fr_auto_auto] items-center gap-4 border-t-2 border-[#b88922] bg-white px-5 py-5 md:px-7">
                  <p className="text-[19px] font-black uppercase tracking-[.035em] text-[#16120b] md:text-[24px]">TOTALE GLOBALE</p>
                  <div />
                  <p className="min-w-[190px] text-right text-[30px] font-black tabular-nums tracking-[-.035em] text-[#16120b] md:min-w-[230px] md:text-[38px]">{loading ? '—' : euro(totaleGlobale)}</p>
                </div>
              </section>

              <section className="overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-sm">
                <div className="divide-y divide-black/6">
                  {loading ? (
                    <div className="p-8 text-center text-[12px] text-black/40">Caricamento…</div>
                  ) : allMovements.length === 0 ? (
                    <div className="p-8 text-center text-[12px] font-bold text-black/40">Nessun movimento presente</div>
                  ) : allMovements.map((row) => (
                    <div key={`${row.source}-${row.id}`} className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-3 px-5 py-3 md:grid-cols-[115px_1fr_180px_42px]">
                      <p className="text-[10px] font-bold tabular-nums text-black/45">{fmtDate(row.workDate)}</p>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black uppercase tracking-[.02em] text-[#33250f]">{row.destination || row.description}</p>
                        {row.note && <p className="mt-0.5 whitespace-pre-wrap text-[9px] text-black/45">{row.note}</p>}
                      </div>
                      <p className="text-right text-[14px] font-black tabular-nums text-[#33250f]">{euro(row.amount)}</p>
                      <button onClick={() => setDeleteRow(row)} title="Elimina movimento" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-black/7 p-3 text-center">
                  <button onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#3d2a0b] px-5 text-[10px] font-black uppercase tracking-[.12em] text-[#f1cf7d] shadow-md">
                    <Plus size={16}/> Aggiungi movimento
                  </button>
                </div>
              </section>

              <section className="grid min-h-[98px] grid-cols-[1fr_auto] items-center gap-4 rounded-[25px] border-2 border-[#b88922] bg-white px-5 py-5 shadow-[0_20px_55px_-38px_rgba(82,52,4,.8)] md:px-7">
                <p className="text-[19px] font-black uppercase tracking-[.035em] text-[#16120b] md:text-[24px]">SALDO AZIENDA</p>
                <p className={`min-w-[190px] text-right text-[30px] font-black tabular-nums tracking-[-.035em] md:min-w-[230px] md:text-[38px] ${saldoAzienda < 0 ? 'text-[#6f1734]' : 'text-[#16120b]'}`}>{loading ? '—' : euro(saldoAzienda)}</p>
              </section>
            </>
          ) : (
            <section className="rounded-[24px] border border-black/8 bg-white p-12 text-center shadow-sm">
              <CalendarDays size={30} className="mx-auto text-[#c8a655]"/>
              <p className="mt-3 text-[13px] font-black text-[#3d2a0b]">Nessun periodo disponibile</p>
            </section>
          )}
        </div>
      </PageBody>

      {debtsOpen && (
        <DebtDrawer
          debts={filteredDebts}
          totalCount={debts.length}
          selectedIds={selectedDebtIds}
          selectedTotal={selectedDebtTotal}
          search={debtSearch}
          setSearch={setDebtSearch}
          savingDebtId={savingDebtId}
          onToggle={toggleDebt}
          onClose={() => setDebtsOpen(false)}
        />
      )}

      {newOpen && (
        <Modal onClose={() => !saving && setNewOpen(false)} title="AGGIUNGI MOVIMENTO">
          <div className="space-y-4">
            <Field label="Importo (€)">
              <input autoFocus inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="h-12 w-full rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 text-[20px] font-black tabular-nums outline-none focus:border-[#c9a348]" placeholder="10.000"/>
            </Field>
            <Field label="Descrizione">
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="h-11 w-full rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 text-[13px] font-bold outline-none focus:border-[#c9a348]" placeholder="Es. Acconto sui conteggi N.1"/>
            </Field>
            <Field label="Data">
              <input type="date" min={period?.date_from} max={period?.date_to} value={form.transfer_date}
                onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                className="h-11 w-full rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 text-[13px] font-bold outline-none focus:border-[#c9a348]"/>
            </Field>
            <Field label="Nota (facoltativa)">
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3}
                className="w-full resize-none rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 py-3 text-[13px] outline-none focus:border-[#c9a348]" placeholder="Aggiungi una nota…"/>
            </Field>
            <button onClick={createTransfer} disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[#3d2a0b] text-[11px] font-black uppercase tracking-[0.14em] text-[#f0cc77] disabled:opacity-50">
              {saving ? <RefreshCw size={16} className="animate-spin"/> : <Plus size={16}/>} {saving ? 'Registrazione…' : 'Registra movimento'}
            </button>
          </div>
        </Modal>
      )}

      {deleteRow && (
        <Modal onClose={() => !deleting && setDeleteRow(null)} title="ELIMINA MOVIMENTO">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={24}/></div>
            <p className="mt-4 text-[13px] font-bold text-black/60">Eliminare definitivamente questo movimento?</p>
            <p className="mt-2 text-[30px] font-black tabular-nums text-red-600">{euro(deleteRow.amount)}</p>
            <p className="mt-1 text-[12px] font-bold text-[#3d2a0b]">{deleteRow.destination}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setDeleteRow(null)} disabled={deleting} className="h-11 rounded-[14px] border border-black/10 text-[11px] font-black uppercase tracking-[.12em] text-black/55">Annulla</button>
              <button onClick={deleteTransfer} disabled={deleting} className="h-11 rounded-[14px] bg-red-600 text-[11px] font-black uppercase tracking-[.12em] text-white disabled:opacity-50">{deleting ? 'Elimino…' : 'Elimina'}</button>
            </div>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}

function AccountingRow({ label, value, action = null }) {
  return (
    <div className="grid min-h-[88px] grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-[#d9b45f]/30 px-5 py-4 md:px-7">
      <p className="text-[15px] font-black uppercase tracking-[.025em] text-[#17130c] md:text-[20px]">{label}</p>
      <div className="flex justify-end">{action}</div>
      <p className="min-w-[190px] text-right text-[30px] font-black tabular-nums tracking-[-.035em] text-[#17130c] md:min-w-[230px] md:text-[38px]">{value}</p>
    </div>
  )
}

function DebtDrawer({ debts, totalCount, selectedIds, selectedTotal, search, setSearch, savingDebtId, onToggle, onClose }) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col bg-[#fbfaf6] shadow-[-25px_0_70px_-30px_rgba(0,0,0,.45)]">
        <div className="border-b border-black/8 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#a17727]">Recuperi Acconto Aggio</p>
              <h2 className="mt-1 text-[18px] font-black text-[#30220c]">Seleziona i debiti da considerare</h2>
              <p className="mt-1 text-[10px] text-black/45">Sono mostrati i debiti dei conteggi del periodo selezionato.</p>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/8 bg-white text-black/45"><X size={17}/></button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] border border-[#d8bd7a]/45 bg-[#fff8e6] px-3 py-3">
              <p className="text-[8px] font-black uppercase tracking-[.14em] text-black/35">Selezionati</p>
              <p className="mt-1 text-[20px] font-black tabular-nums text-[#3d2a0b]">{selectedIds.size} / {totalCount}</p>
            </div>
            <div className="rounded-[14px] border border-[#d8bd7a]/45 bg-[#fff8e6] px-3 py-3 text-right">
              <p className="text-[8px] font-black uppercase tracking-[.14em] text-black/35">Totale recuperi</p>
              <p className="mt-1 text-[20px] font-black tabular-nums text-[#3d2a0b]">{euro(selectedTotal)}</p>
            </div>
          </div>

          <div className="relative mt-3">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30"/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca locale o dipendente…"
              className="h-11 w-full rounded-[13px] border border-black/10 bg-[#f7f6f2] pl-10 pr-4 text-[12px] font-bold outline-none focus:border-[#c8a14b]"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {debts.length === 0 ? (
            <div className="p-10 text-center">
              <ReceiptText size={28} className="mx-auto text-[#c8a655]"/>
              <p className="mt-3 text-[12px] font-bold text-black/50">Nessun debito disponibile</p>
            </div>
          ) : debts.map((row) => {
            const selected = selectedIds.has(String(row.id))
            const saving = savingDebtId === String(row.id)
            return (
              <button key={row.id} onClick={() => onToggle(row)} disabled={saving}
                className={`mb-2 grid w-full grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[16px] border px-3 py-3 text-left transition ${selected ? 'border-[#b98a27] bg-[#fff2c8] shadow-sm' : 'border-black/8 bg-white hover:border-[#d1b36c]'} ${saving ? 'opacity-55' : ''}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-[11px] border ${selected ? 'border-[#a9791b] bg-[#a9791b] text-white' : 'border-black/12 bg-[#f7f6f2] text-transparent'}`}>
                  <Check size={16}/>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-black uppercase text-[#33250f]">{row.venueName}</span>
                  <span className="mt-0.5 block truncate text-[9px] font-bold text-black/42">{row.operatorName} • {fmtDate(row.conteggio_date)}</span>
                </span>
                <span className="text-right text-[16px] font-black tabular-nums text-[#33250f]">{euro(row.amount)}</span>
              </button>
            )
          })}
        </div>

        <div className="border-t border-black/8 bg-white p-4">
          <button onClick={onClose} className="h-12 w-full rounded-[15px] bg-[#3d2a0b] text-[11px] font-black uppercase tracking-[.14em] text-[#f1cf7d]">Conferma selezione</button>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.15em] text-black/40">{label}</span>{children}</label>
}

function Modal({ title, children, onClose }) {
  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
    <div className="w-full max-w-[480px] overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-black/7 px-5 py-4"><h3 className="text-[12px] font-black uppercase tracking-[.15em] text-[#3d2a0b]">{title}</h3><button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 hover:bg-black/5"><X size={17}/></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
}
