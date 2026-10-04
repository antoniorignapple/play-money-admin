import { buildAutomezzoPdf } from '../lib/generateAutomezzoPdf.js';
import { buildFleetReport, recordMatchesVehicle } from '../lib/fleetReport.js';
import { generateFleetPdf } from '../lib/generateFleetPdf.js';
import { createPdfPreviewWindow, openPdfPreview, closePdfPreviewWindow } from '../lib/pdfPreview.js';
import { getRomeISODate } from '../lib/dates.js';
import { currentMonthRange, inDateRange, vehicleDistance, odometer, latestVehicleReading } from '../lib/vehiclePeriod.js';
import { fetchAllRows } from '../lib/fetchAllRows.js';
import '../styles/debitiBonus.css';
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CarFront,
  Fuel,
  FileText,
  Gauge,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button, EmptyState, Field, Input, Modal } from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { ConfirmDialog } from "../components/FormDialog";
import { useToast } from "../components/Toast";
import { dipendenteId, dipendenteName, formatEuro0 } from "../lib/helpers";
import { DIPENDENTI_SAFE_FIELDS } from "../lib/dipendentiFields";

const todayISO = () => getRomeISODate();
const normalizePlate = (value) =>
  String(value || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

export default function AutomezziPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(() => currentMonthRange());
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [vehicleModal, setVehicleModal] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ name: "", plate: "" });
  const [removeTarget, setRemoveTarget] = useState(null);
  const [usageModal, setUsageModal] = useState(false);
  const [usageForm, setUsageForm] = useState({
    work_date: todayISO(),
    created_by: "",
    km: "",
    rifornimento: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingUsage, setEditingUsage] = useState(null);
  const [editUsageForm, setEditUsageForm] = useState({ vehicle_id: '', km: '', rifornimento: '' });
  const [removeUsageTarget, setRemoveUsageTarget] = useState(null);
  const [fleetPdfOpen, setFleetPdfOpen] = useState(false);
  const [fleetPdfIds, setFleetPdfIds] = useState([]);
  const [fleetPdfSearch, setFleetPdfSearch] = useState('');
  const [fleetPdfBusy, setFleetPdfBusy] = useState(false);

  useEffect(() => {
    loadData();
    // Initial load; later refreshes are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      setLoadError('');
      const [vehicleList, allRecords, employeesList] = await Promise.all([
        fetchAllRows(() => supabase.from('automezzi').select('*').order('name').order('id')),
        fetchAllRows(() => supabase.from('fondo_cassa_giornaliero').select('*').order('work_date', { ascending: false }).order('id', { ascending: false })),
        fetchAllRows(() => supabase.from('dipendenti').select(DIPENDENTI_SAFE_FIELDS).order('full_name').order('id')),
      ]);
      setVehicles(vehicleList); setRecords(allRecords); setEmployees(employeesList);
      setSelectedVehicleId(current => current && vehicleList.some(v => String(v.id) === String(current)) ? current : vehicleList.find(v => v.active !== false)?.id || vehicleList[0]?.id || '');
      return { vehicles: vehicleList, records: allRecords };
    } catch (error) { setLoadError(error.message); toast.error(error.message); }
    finally { setLoading(false); }
  }

  function employeeName(id) {
    return (
      dipendenteName(
        employees.find(
          (employee) => String(dipendenteId(employee)) === String(id),
        ),
      ) || "Operatore non disponibile"
    );
  }

  function matchesVehicle(record, vehicle) {
    return recordMatchesVehicle(record, vehicle);
  }

  function openFleetPdf() {
    setFleetPdfIds(vehicles.filter(v => v.active !== false).map(v => String(v.id)));
    setFleetPdfSearch(''); setFleetPdfOpen(true);
  }

  async function exportFleetPdf() {
    if (fleetPdfBusy || !fleetPdfIds.length) return;
    let target;
    setFleetPdfBusy(true);
    try {
      target = createPdfPreviewWindow();
      const fresh = await loadData();
      if (!fresh) throw new Error('Dati non aggiornati: impossibile generare il PDF. Riprova.');
      const today = todayISO();
      const rows = buildFleetReport(fresh.vehicles, fresh.records, fleetPdfIds, today);
      if (rows.length !== fleetPdfIds.length) throw new Error('La disponibilità dei mezzi è cambiata. Riapri PDF mezzi e verifica la selezione.');
      openPdfPreview(generateFleetPdf(rows, today), target);
      setFleetPdfOpen(false);
    } catch (error) { closePdfPreviewWindow(target); toast.error(error.message); }
    finally { setFleetPdfBusy(false); }
  }

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.active !== false),
    [vehicles],
  );
  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeVehicles.filter(
      (vehicle) =>
        !query ||
        `${vehicle.name} ${vehicle.plate}`.toLowerCase().includes(query),
    );
  }, [activeVehicles, search]);
  const selectedVehicle =
    vehicles.find(
      (vehicle) => String(vehicle.id) === String(selectedVehicleId),
    ) || null;
  const periodRecords = useMemo(() => records.filter(record => inDateRange(record, dateRange)), [records, dateRange]);
  const fleetPeriodRecords = periodRecords.filter(record => activeVehicles.some(vehicle => matchesVehicle(record, vehicle)));
  const vehicleHistory = useMemo(
    () => periodRecords.filter(record => matchesVehicle(record, selectedVehicle)),
    [periodRecords, selectedVehicle],
  );
  const distanceByVehicle = new Map(activeVehicles.map(vehicle => [vehicle.id, vehicleDistance(records.filter(record => matchesVehicle(record, vehicle)), dateRange)]));
  const selectedDistance = distanceByVehicle.get(selectedVehicle?.id);
  const totalFuel = vehicleHistory.reduce(
    (sum, record) => sum + Number(record.rifornimento || 0),
    0,
  );
  const lastUsage = vehicleHistory[0] || null;
  const usersCount = new Set(
    vehicleHistory
      .map((record) => String(record.created_by || ""))
      .filter(Boolean),
  ).size;

  function exportVehicle(vehicle) {
    let target;
    try {
      if (loading || loadError) throw new Error('Aggiorna i dati prima di aprire il PDF');
      if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) throw new Error('Scegli un periodo valido prima di aprire il PDF');
      target = createPdfPreviewWindow();
      const doc = buildAutomezzoPdf({
        vehicle, records: records.filter(record => matchesVehicle(record, vehicle)),
        range: dateRange, employeeName,
      });
      openPdfPreview(doc, target);
    } catch (error) {
      closePdfPreviewWindow(target);
      toast.error(error.message || 'Impossibile aprire il PDF');
    }
  }

  function openCreateVehicle() {
    setVehicleForm({ name: "", plate: "" });
    setVehicleModal({ mode: "create" });
  }
  function openEditVehicle(vehicle) {
    setVehicleForm({ name: vehicle.name || "", plate: vehicle.plate || "" });
    setVehicleModal({ mode: "edit", vehicle });
  }
  async function saveVehicle() {
    const name = vehicleForm.name.trim().toUpperCase();
    const plate = normalizePlate(vehicleForm.plate);
    if (!name || !plate) return toast.warning("Nome e targa sono obbligatori");
    setSaving(true);
    const payload = {
      name,
      plate,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const result =
      vehicleModal.mode === "edit"
        ? await supabase
            .from("automezzi")
            .update(payload)
            .eq("id", vehicleModal.vehicle.id)
        : await supabase.from("automezzi").insert(payload);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    setVehicleModal(null);
    toast.success(
      vehicleModal.mode === "edit"
        ? "Automezzo aggiornato"
        : "Automezzo aggiunto",
    );
    await loadData();
  }
  async function removeVehicle() {
    const { error } = await supabase
      .from("automezzi")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", removeTarget.id);
    if (error) throw new Error(error.message);
    setRemoveTarget(null);
    toast.success("Automezzo rimosso; lo storico è stato conservato");
    await loadData();
  }
  function openUsageModal() {
    setUsageForm({
      work_date: todayISO(),
      created_by: "",
      km: "",
      rifornimento: "",
    });
    setUsageModal(true);
  }
  async function createUsage() {
    if (!selectedVehicle || !usageForm.work_date || !usageForm.created_by)
      return toast.warning("Data e agente sono obbligatori");
    if (usageForm.km !== '' && odometer(usageForm.km) === null) return toast.warning('Inserisci una lettura contachilometri valida');
    setSaving(true);
    const { error } = await supabase.from("fondo_cassa_giornaliero").insert({
      work_date: usageForm.work_date,
      created_by: usageForm.created_by,
      vehicle_id: selectedVehicle.id,
      vehicle_name_snapshot: selectedVehicle.name,
      vehicle_plate_snapshot: selectedVehicle.plate,
      mezzo: `${selectedVehicle.name} – ${selectedVehicle.plate}`,
      km: usageForm.km || null,
      rifornimento:
        usageForm.rifornimento === "" ? null : Number(usageForm.rifornimento),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setUsageModal(false);
    toast.success("Utilizzo registrato");
    await loadData();
  }

  function openEditUsage(record) {
    setEditingUsage(record);
    const vehicle = vehicles.find(item => matchesVehicle(record, item));
    setEditUsageForm({ vehicle_id: vehicle?.id || '', km: record.km == null ? '' : String(record.km), rifornimento: record.rifornimento == null ? '' : String(record.rifornimento) });
  }

  async function saveEditedUsage() {
    if (!editingUsage) return;
    const vehicle = vehicles.find(item => String(item.id) === String(editUsageForm.vehicle_id));
    if (!vehicle) return toast.warning('Seleziona un automezzo valido');
    if (editUsageForm.km.trim() !== '' && odometer(editUsageForm.km) === null) return toast.warning('Inserisci un numero di chilometri valido');
    const fuel = editUsageForm.rifornimento.trim() === '' ? null : Number(editUsageForm.rifornimento.replace(',', '.'));
    if (fuel !== null && !Number.isFinite(fuel)) return toast.warning('Inserisci un importo carburante valido');
    setSaving(true);
    const { data, error } = await supabase.from('fondo_cassa_giornaliero')
      .update({ vehicle_id: vehicle.id, vehicle_name_snapshot: vehicle.name, vehicle_plate_snapshot: vehicle.plate, mezzo: `${vehicle.name} – ${vehicle.plate}`, km: editUsageForm.km.trim() === '' ? null : String(odometer(editUsageForm.km)), rifornimento: fuel, updated_at: new Date().toISOString() })
      .eq('id', editingUsage.id).select('id,vehicle_id,vehicle_name_snapshot,vehicle_plate_snapshot,mezzo,km,rifornimento,updated_at').maybeSingle();
    setSaving(false);
    if (error || !data) return toast.error(error?.message || 'Modifica non salvata: verifica i permessi Admin');
    setRecords(current => current.map(record => String(record.id) === String(data.id) ? { ...record, ...data } : record));
    setEditingUsage(null);
    toast.success('Utilizzo aggiornato');
  }

  async function removeUsage() {
    if (!removeUsageTarget) return;
    const { data, error } = await supabase.from('fondo_cassa_giornaliero')
      .delete().eq('id', removeUsageTarget.id).select('id').maybeSingle();
    if (error || !data) throw new Error(error?.message || 'Eliminazione non riuscita: verifica i permessi Admin');
    setRecords(current => current.filter(record => String(record.id) !== String(data.id)));
    setRemoveUsageTarget(null);
    toast.success('Utilizzo eliminato');
  }

  return (
    <div className="finance-theme h-full min-h-0"><PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_13%_0%,rgba(99,177,226,.18),transparent_28%),linear-gradient(180deg,#e8f1f7_0%,#e5eef3_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
            <section className="relative overflow-hidden rounded-[30px] border border-[#8fc0df] bg-[linear-gradient(135deg,#f9fcfe_0%,#a5d4f1_100%)] px-4 py-6 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
              <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-amber-400/22 blur-3xl" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-[30px] font-black tracking-[0.15em] text-[#0b2a3d] md:text-[36px]">
                    AUTOMEZZI
                  </h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadData}
                    className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#6badd6] bg-white/75 text-[#165278] shadow-lg"
                  >
                    <RefreshCw
                      size={17}
                      className={loading ? "animate-spin" : ""}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={openCreateVehicle}
                    className="flex h-12 items-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#1871a8,#0d4a70)] px-5 text-[10px] font-black tracking-[.1em] text-white shadow-[0_14px_28px_-18px_rgba(75,45,3,.9)]"
                  >
                    <Plus size={15} /> NUOVO AUTOMEZZO
                  </button>
                  <button type="button" onClick={openFleetPdf} disabled={loading || !!loadError || !activeVehicles.length || fleetPdfBusy} className="flex h-12 items-center gap-2 rounded-[16px] border border-[#6badd6] bg-white/80 px-4 text-[11px] font-bold text-[#165278] disabled:opacity-50"><FileText size={16}/> PDF MEZZI</button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 overflow-hidden rounded-[25px] border border-[#aacbdf] bg-[#f9fdff] shadow-[0_20px_45px_-36px_rgba(62,38,3,.7)] md:grid-cols-4">
              {[
                ["MEZZI DISPONIBILI", activeVehicles.length],
                [
                  "UTILIZZI NEL PERIODO", fleetPeriodRecords.length,
                ],
                ["RIFORNIMENTI NEL PERIODO", formatEuro0(fleetPeriodRecords.reduce((sum, record) => sum + Number(record.rifornimento || 0), 0))],
                ["ULTIMO UTILIZZO NEL PERIODO", fleetPeriodRecords[0] ? formatDate(fleetPeriodRecords[0].work_date) : '—'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-r border-[#d1e3ee] px-3 py-5 text-center"
                >
                  <p className="text-[9px] font-black tracking-[.14em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-[21px] font-black text-[#0f2533]">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section aria-label="Periodo automezzi" className="rounded-[20px] border border-[#b5d0e1] bg-[#f9fcfe] p-4 md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-center gap-3 self-center"><span className="rounded-xl bg-[#d5e8f4] p-3 text-[#2c709b]"><CalendarDays size={20} /></span><div><p className="text-sm font-bold text-[#214b65]">Periodo di consultazione</p><p className="mt-1 text-[11px] text-[#668497]">Utilizzi, rifornimenti e chilometri</p></div></div>
                <div className="flex flex-wrap items-end gap-3"><label className="text-[11px] font-semibold text-[#59788b]">Dal<input aria-label="Data inizio periodo" className="mt-1 block min-h-10 w-[145px] rounded-xl border border-[#accbdf] bg-white px-3 text-sm text-[#213745]" type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} /></label><label className="text-[11px] font-semibold text-[#59788b]">Al<input aria-label="Data fine periodo" className="mt-1 block min-h-10 w-[145px] rounded-xl border border-[#accbdf] bg-white px-3 text-sm text-[#213745]" type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} /></label><button type="button" onClick={() => setDateRange(currentMonthRange())} className="min-h-10 rounded-xl border border-[#93bed9] bg-[#daecf7] px-4 text-xs font-bold text-[#26648b]">Mese corrente</button></div>
              </div>
              {(!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) && <p role="alert" className="mt-3 text-xs text-red-700">Scegli un intervallo valido: la data iniziale deve precedere quella finale.</p>}
              {loadError && <p role="alert" className="mt-3 text-xs text-red-700">Dati non aggiornati: {loadError}. Premi Aggiorna per riprovare.</p>}
            </section>

            <section>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[9px] font-black tracking-[.2em] text-[#176ba0]">
                    SELEZIONA UN MEZZO
                  </p>
                  <h2 className="text-[20px] font-black tracking-[.11em] text-[#0b2a3d]">
                    PARCO AUTOMEZZI
                  </h2>
                </div>
                <div className="w-full md:w-[330px]">
                  <Input
                    leftIcon={Search}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cerca nome o targa…"
                  />
                </div>
              </div>
              {filteredVehicles.length === 0 ? (
                <div className="rounded-[25px] border border-[#b8d1e0] bg-white p-8">
                  <EmptyState
                    icon={CarFront}
                    title="Nessun automezzo"
                    description="Aggiungi il primo mezzo aziendale."
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {filteredVehicles.map((vehicle) => {
                    const active =
                      String(selectedVehicleId) === String(vehicle.id);
                    const distance = distanceByVehicle.get(vehicle.id);
                    const currentReading = latestVehicleReading(records.filter(record => matchesVehicle(record, vehicle)));
                    const uses = periodRecords.filter((record) =>
                      matchesVehicle(record, vehicle),
                    );
                    const vehicleFuel = uses.reduce((total, record) => total + Number(record.rifornimento || 0), 0);
                    return (
                      <div
                        key={vehicle.id}
                        className={`group relative min-h-[168px] overflow-hidden rounded-[24px] border p-4 text-left transition hover:-translate-y-1 active:scale-[.98] ${active ? "border-[#13689d] bg-[linear-gradient(135deg,#092a3f,#135d8b_58%,#328bc3)] text-white shadow-[0_24px_45px_-28px_rgba(75,44,2,.95)]" : "border-[#9ac3dd] bg-[linear-gradient(145deg,#f9fcfe,#c9e4f5)] text-[#0d2839] shadow-[0_17px_34px_-29px_rgba(71,44,4,.7)]"}`}
                      >
                        <div
                          className={`absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm ${active ? "border-white/20 bg-white/10 text-amber-100" : "border-[#7fbce2] bg-[#d2ebfb] text-[#136ea6]"}`}
                        >
                          <CarFront size={25} strokeWidth={2.2} />
                        </div>
                        <div className="relative flex min-h-[136px] flex-col justify-between">
                          <button type="button" onClick={() => setSelectedVehicleId(vehicle.id)} aria-label={`Seleziona ${vehicle.name} ${vehicle.plate}`} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500">
                            <p
                              className={`text-[9px] font-black tracking-[.16em] ${active ? "text-amber-100/75" : "text-[#206fa0]"}`}
                            >
                              AUTOMEZZO
                            </p>
                            <h3 className="mt-1 max-w-[75%] text-[17px] font-black uppercase tracking-[.05em]">
                              {vehicle.name}
                            </h3>
                            <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
                              <span className="text-[16px] font-bold tracking-[.09em]">{vehicle.plate}</span>
                              <span className={`basis-full text-[11px] font-bold ${active ? 'text-amber-50' : 'text-[#225f85]'}`}><Fuel size={13} className="mr-1 inline" />Carburante nel periodo: {formatEuro0(vehicleFuel)}</span>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div title={currentReading ? `Ultima lettura valida: ${formatDate(currentReading.date)}` : 'Nessuna lettura valida registrata'} className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${active ? 'bg-white/15 text-amber-50' : 'bg-[#b9d7ea]/60 text-[#225f85]'}`}>
                                  <span className="flex flex-wrap items-center gap-1.5"><Gauge size={13} className="shrink-0" />Km attuali: {currentReading ? currentReading.km.toLocaleString('it-IT', { useGrouping: 'always' }) : '—'}</span>
                                  <span className="mt-0.5 block text-[10px] font-normal">({currentReading ? currentReading.label : 'nessun inserimento'})</span>
                                </div>
                                <div>
                                  <span title={distance.message} className={`inline-flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold ${active ? 'bg-white/15 text-amber-50' : 'bg-[#b9d7ea]/60 text-[#225f85]'}`}><Gauge size={13} className="shrink-0" />Km percorsi: {distance.km == null ? '—' : distance.km.toLocaleString('it-IT', { useGrouping: 'always' })}</span>
                                  <p className={`mt-1 text-[9px] ${active ? 'text-amber-100/75' : 'text-[#5b829a]'}`}>{distance.status === 'complete' ? 'Percorsi nel periodo' : distance.status === 'empty' ? 'Nessun utilizzo nel periodo' : distance.status === 'anomaly' ? 'Verifica contachilometri' : distance.status === 'invalid' ? 'Intervallo non valido' : distance.status === 'missing' ? 'Letture insufficienti' : 'Chilometri parziali'}</p>
                                </div>
                              </div>
                            </div>

                          </button>
                          <div className="mt-3 flex items-end justify-between">
                            <div>
                              <p
                                className={`text-[8px] font-black tracking-[.12em] ${active ? "text-amber-100/70" : "text-slate-400"}`}
                              >
                                UTILIZZI
                              </p>
                              <p className="text-[22px] font-black">
                                {uses.length}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button type="button" onClick={() => exportVehicle(vehicle)} disabled={loading || !!loadError || !dateRange.from || !dateRange.to || dateRange.from > dateRange.to} aria-label={`Apri PDF ${vehicle.name} ${vehicle.plate}`} title="Apri il PDF del periodo selezionato" className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-white/25 bg-white/15 text-white' : 'border-[#79b0d3] bg-white/70 text-[#135d8b]'}`}><FileText size={14} /> PDF</button>
                              <button type="button" onClick={() => setSelectedVehicleId(vehicle.id)} className={`text-[9px] font-black ${active ? 'text-white' : 'text-[#135d8b]'}`}>VEDI STORICO →</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedVehicle && (
              <section className="overflow-hidden rounded-[28px] border border-[#86b9d8] bg-[#f9fdff] shadow-[0_25px_58px_-38px_rgba(65,39,4,.8)]">
                <div className="flex flex-col gap-4 border-b border-[#8fbfdd] bg-[linear-gradient(135deg,#d8eefc,#77bde9)] p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[17px] bg-[linear-gradient(135deg,#08314b,#176da2)] text-white shadow-xl">
                      <CarFront size={27} strokeWidth={2.2} />
                    </span>
                    <div>
                      <p className="text-[9px] font-black tracking-[.18em] text-[#17689a]">
                        STORICO AUTOMEZZO
                      </p>
                      <h2 className="mt-1 text-[22px] font-black uppercase tracking-[.07em] text-[#0b2434]">
                        {selectedVehicle.name}
                      </h2>
                      <p className="mt-1 text-[17px] font-black tracking-[.15em] text-[#0d4669]">
                        {selectedVehicle.plate}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={openUsageModal}
                      className="flex h-10 items-center gap-2 rounded-[13px] bg-[linear-gradient(135deg,#126395,#083e5f)] px-4 text-[9px] font-black tracking-[.09em] text-white"
                    >
                      <Plus size={13} /> REGISTRA UTILIZZO
                    </button>
                    <button
                      onClick={() => openEditVehicle(selectedVehicle)}
                      className="flex h-10 items-center gap-2 rounded-[13px] border border-[#559fcd] bg-white/70 px-4 text-[9px] font-black text-[#195275]"
                    >
                      <Pencil size={13} /> MODIFICA
                    </button>
                    <button
                      onClick={() => setRemoveTarget(selectedVehicle)}
                      className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-red-200 bg-white/70 text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 border-b border-[#cfe2ee] md:grid-cols-4">
                  {[
                    ["UTILIZZI", vehicleHistory.length],
                    ["AGENTI DIVERSI", usersCount],
                    ["RIFORNIMENTO", formatEuro0(totalFuel)],
                    [
                      "ULTIMA DATA",
                      lastUsage ? formatDate(lastUsage.work_date) : "—",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="border-b border-r border-[#d4e4ee] px-3 py-4 text-center"
                    >
                      <p className="text-[8px] font-black tracking-[.13em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-[18px] font-black text-[#0f2533]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="p-3 md:p-5">
                  {selectedDistance && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#bfd8e8] bg-[#e9f3fa] px-4 py-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#3f789c]">Chilometri percorsi nel periodo</p><p className="mt-1 text-[11px] text-[#59788b]">{selectedDistance.message}</p>{selectedDistance.start && selectedDistance.end && <p className="mt-2 text-[12px] font-semibold text-[#275674]">{formatDate(selectedDistance.start.date)}: {selectedDistance.start.km.toLocaleString('it-IT', { useGrouping: 'always' })} km → {formatDate(selectedDistance.end.date)}: {selectedDistance.end.km.toLocaleString('it-IT', { useGrouping: 'always' })} km</p>}</div><strong className="text-xl text-[#26668d]">{selectedDistance.km == null ? '—' : selectedDistance.km.toLocaleString('it-IT', { useGrouping: 'always' })} km</strong></div>}
                  {vehicleHistory.length === 0 ? (
                    <EmptyState
                      title="Nessun utilizzo registrato"
                      description="Non ci sono registrazioni per questo mezzo nel periodo selezionato."
                    />
                  ) : (
                    <div className="space-y-3">
                      {vehicleHistory.map((record, index) => (
                        <article
                          key={record.id || index}
                          className="relative overflow-hidden rounded-[19px] border border-[#b8d2e2] bg-[linear-gradient(145deg,#f9fdff,#e7f3fa)] p-4 transition hover:-translate-y-0.5 hover:border-[#76adcf] hover:shadow-[0_14px_28px_-24px_rgba(72,43,3,.72)]"
                        >
                          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[linear-gradient(180deg,#52a3d6,#105e8e)]" />
                          <div className="grid gap-4 md:grid-cols-[155px_minmax(180px,1fr)_150px_170px_88px]">
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-[#1c6a9b]">
                                GIORNO DI UTILIZZO
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[15px] font-black text-[#0d2330]">
                                <CalendarDays
                                  size={15}
                                  className="text-[#186ca1]"
                                />
                                {formatDate(record.work_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-slate-400">
                                AGENTE
                              </p>
                              <p className="mt-1 flex items-center gap-2 truncate text-[14px] font-black uppercase text-slate-800">
                                <User size={15} className="text-[#186ca1]" />
                                {employeeName(record.created_by)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-slate-400">
                                CONTACHILOMETRI
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[18px] font-black tabular-nums text-slate-900">
                                <Gauge size={16} className="text-[#186ca1]" />
                                {odometer(record.km)?.toLocaleString('it-IT', { useGrouping: 'always' }) ?? '—'}{" "}
                                <span className="text-[9px] text-slate-400">
                                  KM
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-slate-400">
                                RIFORNIMENTO
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[18px] font-black tabular-nums text-emerald-700">
                                <Fuel size={16} />
                                {formatEuro0(record.rifornimento)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => openEditUsage(record)} aria-label={`Modifica utilizzo del ${formatDate(record.work_date)}`} title="Modifica mezzo, chilometri e rifornimento" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#8cbbd8] bg-white text-[#145a85] hover:bg-[#d9effc]"><Pencil size={16} /></button>
                              <button type="button" onClick={() => setRemoveUsageTarget(record)} aria-label={`Elimina utilizzo del ${formatDate(record.work_date)}`} title="Elimina utilizzo" className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </PageBody>

      <Modal open={fleetPdfOpen} onClose={() => !fleetPdfBusy && setFleetPdfOpen(false)} title="PDF mezzi" width="lg" footer={<><Button variant="ghost" onClick={() => setFleetPdfOpen(false)} disabled={fleetPdfBusy}>Annulla</Button><Button variant="primary" onClick={exportFleetPdf} disabled={fleetPdfBusy || !fleetPdfIds.length}>{fleetPdfBusy ? 'GENERAZIONE…' : 'APRI PDF'}</Button></>}>
        <p className="mb-4 text-sm text-[#3c6178]">Seleziona i mezzi da includere. Il PDF riporta mezzo, targa e ultima lettura valida dei km, indipendentemente dal periodo visualizzato.</p>
        <Input leftIcon={Search} placeholder="Cerca mezzo o targa…" value={fleetPdfSearch} disabled={fleetPdfBusy} onChange={e => setFleetPdfSearch(e.target.value)}/>
        <div className="my-4 flex flex-wrap items-center gap-3"><Button variant="ghost" disabled={fleetPdfBusy} onClick={() => setFleetPdfIds(activeVehicles.map(v => String(v.id)))}>Seleziona tutti</Button><Button variant="ghost" disabled={fleetPdfBusy} onClick={() => setFleetPdfIds([])}>Deseleziona tutti</Button><span className="ml-auto text-sm font-semibold text-[#3c6178]">{fleetPdfIds.length} selezionati</span></div>
        <div className="space-y-2">{activeVehicles.filter(v => `${v.name} ${v.plate}`.toLowerCase().includes(fleetPdfSearch.toLowerCase())).map(vehicle => {
          const id = String(vehicle.id);
          const reading = latestVehicleReading(records.filter(r => !r.deleted_at && recordMatchesVehicle(r, vehicle)));
          return <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#bcd3e2] p-4"><input type="checkbox" className="h-4 w-4 accent-[#286b95]" disabled={fleetPdfBusy} checked={fleetPdfIds.includes(id)} onChange={e => setFleetPdfIds(ids => e.target.checked ? [...ids, id] : ids.filter(item => item !== id))}/><span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase text-[#223845]">{vehicle.name}</span><span className="mt-1 block text-xs uppercase text-[#3c6178]">{vehicle.plate}</span></span><span className="text-right text-sm font-semibold text-[#223845]">{reading ? `${reading.km.toLocaleString('it-IT', { useGrouping: 'always' })} km` : 'Non disponibili'}{reading && <small className="mt-1 block text-xs font-normal text-[#59788b]">{formatDate(reading.date)}</small>}</span></label>;
        })}</div>
      </Modal>

      <Modal open={!!editingUsage} onClose={() => !saving && setEditingUsage(null)} title={`Modifica utilizzo · ${formatDate(editingUsage?.work_date)}`} width="md" footer={<><Button variant="ghost" onClick={() => setEditingUsage(null)} disabled={saving}>Annulla</Button><Button variant="primary" onClick={saveEditedUsage} disabled={saving}>{saving ? 'SALVATAGGIO…' : 'SALVA MODIFICHE'}</Button></>}>
        <p className="mb-4 text-sm text-[#3c6178]">{editingUsage ? employeeName(editingUsage.created_by) : ''} · Modifica anche le registrazioni dei periodi precedenti.</p>
        <Field label="Automezzo" required>
          <select value={editUsageForm.vehicle_id} onChange={event => setEditUsageForm(form => ({ ...form, vehicle_id: event.target.value }))} className="mb-3 h-10 w-full rounded-[12px] border border-[#a9c7d9] bg-white px-3 text-sm">
            <option value="">Seleziona automezzo…</option>
            {vehicles.filter(vehicle => vehicle.active !== false || String(vehicle.id) === String(editUsageForm.vehicle_id)).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} – {vehicle.plate}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contachilometri (km totali)"><Input type="number" value={editUsageForm.km} onChange={event => setEditUsageForm(form => ({ ...form, km: event.target.value }))} /></Field>
          <Field label="Rifornimento (€)"><Input type="number" step="0.01" value={editUsageForm.rifornimento} onChange={event => setEditUsageForm(form => ({ ...form, rifornimento: event.target.value }))} /></Field>
        </div>
      </Modal>
      {vehicleModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
          onClick={() => !saving && setVehicleModal(null)}
        >
          <div
            className="w-full max-w-[460px] overflow-hidden rounded-[30px] border border-[#55a1d1] bg-[#f9fdff] shadow-[0_40px_100px_-30px_rgba(0,0,0,.95)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-[#79b4d9] bg-[linear-gradient(135deg,#d7eefc_0%,#52ace4_100%)] px-5 py-6 text-center">
              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/25 blur-2xl" />
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#428dbc] bg-white/65 text-[#0c4568]"
              >
                <X size={15} />
              </button>
              <span className="relative mx-auto flex h-15 w-15 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#08314b,#176da2)] text-white shadow-[0_14px_28px_-18px_rgba(72,43,3,.9)]">
                <CarFront size={27} />
              </span>
              <p className="relative mt-3 text-[9px] font-black tracking-[.23em] text-[#17689b]">
                GESTIONE AUTOMEZZI
              </p>
              <h2 className="relative mt-1 text-[22px] font-black tracking-[.08em] text-[#0b2535]">
                {vehicleModal.mode === "edit"
                  ? "MODIFICA AUTOMEZZO"
                  : "NUOVO AUTOMEZZO"}
              </h2>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-[.13em] text-[#1f628b]">
                  NOME AUTOMEZZO
                </span>
                <Input
                  autoFocus
                  value={vehicleForm.name}
                  onChange={(event) =>
                    setVehicleForm((form) => ({
                      ...form,
                      name: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="ES. FIAT DOBLÒ"
                  className="mt-1 h-12 font-black"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-[.13em] text-[#1f628b]">
                  TARGA
                </span>
                <Input
                  value={vehicleForm.plate}
                  onChange={(event) =>
                    setVehicleForm((form) => ({
                      ...form,
                      plate: normalizePlate(event.target.value),
                    }))
                  }
                  placeholder="ES. FH708TL"
                  className="mt-1 h-12 font-mono text-[16px] font-black tracking-[.16em]"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setVehicleModal(null)}
                  className="h-12 rounded-[15px] border border-[#a7c5d8] bg-white text-[10px] font-black tracking-[.1em] text-slate-500"
                >
                  ANNULLA
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    !vehicleForm.name.trim() ||
                    !normalizePlate(vehicleForm.plate)
                  }
                  onClick={saveVehicle}
                  className="h-12 rounded-[15px] bg-[linear-gradient(135deg,#1871a8,#0a4569)] text-[10px] font-black tracking-[.12em] text-white shadow-[0_13px_24px_-17px_rgba(75,45,3,.9)] disabled:opacity-40"
                >
                  {saving ? "SALVATAGGIO…" : "SALVA AUTOMEZZO"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Modal
        open={usageModal}
        onClose={() => setUsageModal(false)}
        title={`Registra utilizzo · ${selectedVehicle?.name || ""}`}
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUsageModal(false)}>
              Annulla
            </Button>
            <Button variant="primary" onClick={createUsage} disabled={saving}>
              {saving ? "SALVATAGGIO…" : "REGISTRA"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Data" required>
            <Input
              type="date"
              value={usageForm.work_date}
              onChange={(event) =>
                setUsageForm((form) => ({
                  ...form,
                  work_date: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Agente" required>
            <select
              value={usageForm.created_by}
              onChange={(event) =>
                setUsageForm((form) => ({
                  ...form,
                  created_by: event.target.value,
                }))
              }
              className="h-10 w-full rounded-[12px] border border-[#a9c7d9] bg-white px-3 text-sm"
            >
              <option value="">Seleziona agente…</option>
              {employees.map((employee) => (
                <option
                  key={dipendenteId(employee)}
                  value={dipendenteId(employee)}
                >
                  {dipendenteName(employee)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contachilometri (km totali)">
            <Input
              type="number"
              value={usageForm.km}
              onChange={(event) =>
                setUsageForm((form) => ({ ...form, km: event.target.value }))
              }
            />
          </Field>
          <Field label="Rifornimento (€)">
            <Input
              type="number"
              value={usageForm.rifornimento}
              onChange={(event) =>
                setUsageForm((form) => ({
                  ...form,
                  rifornimento: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!removeUsageTarget}
        onClose={() => setRemoveUsageTarget(null)}
        title="ELIMINARE L’UTILIZZO?"
        message={removeUsageTarget ? `Eliminare la registrazione del ${formatDate(removeUsageTarget.work_date)} di ${employeeName(removeUsageTarget.created_by)}? L’operazione non può essere annullata.` : ''}
        confirmLabel="ELIMINA"
        onConfirm={removeUsage}
      />
      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="RIMUOVERE L’AUTOMEZZO?"
        message={
          removeTarget
            ? `${removeTarget.name} non sarà più selezionabile dagli agenti. Tutto lo storico rimarrà conservato.`
            : ""
        }
        confirmLabel="RIMUOVI"
        onConfirm={removeVehicle}
      />
    </PageLayout></div>
  );
}
