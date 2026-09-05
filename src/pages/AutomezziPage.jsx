import { getRomeISODate } from '../lib/dates.js';
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CarFront,
  Fuel,
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [vehicleResult, recordResult, employeeResult] = await Promise.all([
      supabase.from("automezzi").select("*").order("name"),
      supabase
        .from("fondo_cassa_giornaliero")
        .select("*")
        .order("work_date", { ascending: false }),
      supabase.from("dipendenti").select(DIPENDENTI_SAFE_FIELDS).order("full_name"),
    ]);
    const error =
      vehicleResult.error || recordResult.error || employeeResult.error;
    if (error) toast.error(error.message);
    const vehicleList = vehicleResult.data || [];
    setVehicles(vehicleList);
    setRecords(recordResult.data || []);
    setEmployees(employeeResult.data || []);
    setSelectedVehicleId((current) =>
      current &&
      vehicleList.some((vehicle) => String(vehicle.id) === String(current))
        ? current
        : vehicleList.find((vehicle) => vehicle.active !== false)?.id ||
          vehicleList[0]?.id ||
          "",
    );
    setLoading(false);
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
    if (!record || !vehicle) return false;
    if (record.vehicle_id && String(record.vehicle_id) === String(vehicle.id))
      return true;
    const vehiclePlate = normalizePlate(vehicle.plate);
    const snapshotPlate = normalizePlate(record.vehicle_plate_snapshot);
    if (vehiclePlate && snapshotPlate === vehiclePlate) return true;
    const mezzo = String(record.mezzo || "").toUpperCase();
    return Boolean(
      vehiclePlate && normalizePlate(mezzo).includes(vehiclePlate),
    );
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
  const vehicleHistory = useMemo(
    () => records.filter((record) => matchesVehicle(record, selectedVehicle)),
    [records, selectedVehicle],
  );
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

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_13%_0%,rgba(226,186,99,.18),transparent_28%),linear-gradient(180deg,#f7f2e8_0%,#f3eee5_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
            <section className="relative overflow-hidden rounded-[30px] border border-[#dfc98f] bg-[linear-gradient(135deg,#fffdf8_0%,#f1dba5_100%)] px-4 py-6 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
              <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-amber-400/22 blur-3xl" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-[30px] font-black tracking-[0.15em] text-[#3d2a0b] md:text-[36px]">
                    AUTOMEZZI
                  </h1>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadData}
                    className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#d6b56b] bg-white/75 text-[#785116] shadow-lg"
                  >
                    <RefreshCw
                      size={17}
                      className={loading ? "animate-spin" : ""}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={openCreateVehicle}
                    className="flex h-12 items-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#a87318,#70480d)] px-5 text-[10px] font-black tracking-[.1em] text-white shadow-[0_14px_28px_-18px_rgba(75,45,3,.9)]"
                  >
                    <Plus size={15} /> NUOVO AUTOMEZZO
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 overflow-hidden rounded-[25px] border border-[#dfcfaa] bg-[#fffdf9] shadow-[0_20px_45px_-36px_rgba(62,38,3,.7)] md:grid-cols-4">
              {[
                ["MEZZI DISPONIBILI", activeVehicles.length],
                [
                  "UTILIZZI REGISTRATI",
                  records.filter((record) =>
                    activeVehicles.some((vehicle) =>
                      matchesVehicle(record, vehicle),
                    ),
                  ).length,
                ],
                [
                  "RIFORNIMENTI TOTALI",
                  formatEuro0(
                    records.reduce(
                      (sum, record) => sum + Number(record.rifornimento || 0),
                      0,
                    ),
                  ),
                ],
                [
                  "ULTIMO UTILIZZO",
                  records.find((record) => record.vehicle_id || record.mezzo)
                    ?.work_date
                    ? formatDate(
                        records.find(
                          (record) => record.vehicle_id || record.mezzo,
                        ).work_date,
                      )
                    : "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-r border-[#eee4d1] px-3 py-5 text-center"
                >
                  <p className="text-[9px] font-black tracking-[.14em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-[21px] font-black text-[#33250f]">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[9px] font-black tracking-[.2em] text-[#a06c17]">
                    SELEZIONA UN MEZZO
                  </p>
                  <h2 className="text-[20px] font-black tracking-[.11em] text-[#3d2a0b]">
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
                <div className="rounded-[25px] border border-[#e0d3b8] bg-white p-8">
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
                    const uses = records.filter((record) =>
                      matchesVehicle(record, vehicle),
                    );
                    return (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => setSelectedVehicleId(vehicle.id)}
                        className={`group relative min-h-[168px] overflow-hidden rounded-[24px] border p-4 text-left transition hover:-translate-y-1 active:scale-[.98] ${active ? "border-[#9d6913] bg-[linear-gradient(135deg,#3f2909,#8b5b13_58%,#c39332)] text-white shadow-[0_24px_45px_-28px_rgba(75,44,2,.95)]" : "border-[#ddc99a] bg-[linear-gradient(145deg,#fffdf8,#f5e8c9)] text-[#39270d] shadow-[0_17px_34px_-29px_rgba(71,44,4,.7)]"}`}
                      >
                        <div
                          className={`absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm ${active ? "border-white/20 bg-white/10 text-amber-100" : "border-[#e2c77f] bg-[#fff3ce] text-[#a66e13]"}`}
                        >
                          <CarFront size={25} strokeWidth={2.2} />
                        </div>
                        <div className="relative flex min-h-[136px] flex-col justify-between">
                          <div>
                            <p
                              className={`text-[9px] font-black tracking-[.16em] ${active ? "text-amber-100/75" : "text-[#a07120]"}`}
                            >
                              AUTOMEZZO
                            </p>
                            <h3 className="mt-1 max-w-[75%] text-[17px] font-black uppercase tracking-[.05em]">
                              {vehicle.name}
                            </h3>
                            <p
                              className={`mt-2 text-[19px] font-black tracking-[.13em] ${active ? "text-white" : "text-[#49300a]"}`}
                            >
                              {vehicle.plate}
                            </p>
                          </div>
                          <div className="flex items-end justify-between">
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
                            <span
                              className={`text-[9px] font-black ${active ? "text-white" : "text-[#8b5c13]"}`}
                            >
                              VEDI STORICO →
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedVehicle && (
              <section className="overflow-hidden rounded-[28px] border border-[#d8bf86] bg-[#fffdf9] shadow-[0_25px_58px_-38px_rgba(65,39,4,.8)]">
                <div className="flex flex-col gap-4 border-b border-[#ddc58f] bg-[linear-gradient(135deg,#fff4d5,#e9c977)] p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[17px] bg-[linear-gradient(135deg,#4b3008,#a26c17)] text-white shadow-xl">
                      <CarFront size={27} strokeWidth={2.2} />
                    </span>
                    <div>
                      <p className="text-[9px] font-black tracking-[.18em] text-[#9a6817]">
                        STORICO AUTOMEZZO
                      </p>
                      <h2 className="mt-1 text-[22px] font-black uppercase tracking-[.07em] text-[#34230b]">
                        {selectedVehicle.name}
                      </h2>
                      <p className="mt-1 text-[17px] font-black tracking-[.15em] text-[#69440d]">
                        {selectedVehicle.plate}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={openUsageModal}
                      className="flex h-10 items-center gap-2 rounded-[13px] bg-[linear-gradient(135deg,#956112,#5f3c08)] px-4 text-[9px] font-black tracking-[.09em] text-white"
                    >
                      <Plus size={13} /> REGISTRA UTILIZZO
                    </button>
                    <button
                      onClick={() => openEditVehicle(selectedVehicle)}
                      className="flex h-10 items-center gap-2 rounded-[13px] border border-[#cda955] bg-white/70 px-4 text-[9px] font-black text-[#755019]"
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
                <div className="grid grid-cols-2 border-b border-[#eee3cf] md:grid-cols-4">
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
                      className="border-b border-r border-[#eee5d4] px-3 py-4 text-center"
                    >
                      <p className="text-[8px] font-black tracking-[.13em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-[18px] font-black text-[#33250f]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="p-3 md:p-5">
                  {vehicleHistory.length === 0 ? (
                    <EmptyState
                      title="Nessun utilizzo registrato"
                      description="Lo storico comparirà automaticamente quando un agente utilizzerà questo mezzo."
                    />
                  ) : (
                    <div className="space-y-3">
                      {vehicleHistory.map((record, index) => (
                        <article
                          key={record.id || index}
                          className="relative overflow-hidden rounded-[19px] border border-[#e2d4b8] bg-[linear-gradient(145deg,#fffdf9,#faf3e7)] p-4 transition hover:-translate-y-0.5 hover:border-[#cfb476] hover:shadow-[0_14px_28px_-24px_rgba(72,43,3,.72)]"
                        >
                          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[linear-gradient(180deg,#d6ad52,#8e5c10)]" />
                          <div className="grid gap-4 md:grid-cols-[155px_minmax(180px,1fr)_150px_170px]">
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-[#9b6b1c]">
                                GIORNO DI UTILIZZO
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[15px] font-black text-[#30220d]">
                                <CalendarDays
                                  size={15}
                                  className="text-[#a16d18]"
                                />
                                {formatDate(record.work_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-slate-400">
                                AGENTE
                              </p>
                              <p className="mt-1 flex items-center gap-2 truncate text-[14px] font-black uppercase text-slate-800">
                                <User size={15} className="text-[#a16d18]" />
                                {employeeName(record.created_by)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black tracking-[.14em] text-slate-400">
                                CHILOMETRI INSERITI
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[18px] font-black tabular-nums text-slate-900">
                                <Gauge size={16} className="text-[#a16d18]" />
                                {record.km || "—"}{" "}
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

      {vehicleModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
          onClick={() => !saving && setVehicleModal(null)}
        >
          <div
            className="w-full max-w-[460px] overflow-hidden rounded-[30px] border border-[#d1aa55] bg-[#fffdf9] shadow-[0_40px_100px_-30px_rgba(0,0,0,.95)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-[#d9bd79] bg-[linear-gradient(135deg,#fff4d4_0%,#e4ba52_100%)] px-5 py-6 text-center">
              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/25 blur-2xl" />
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#bc9142] bg-white/65 text-[#68440c]"
              >
                <X size={15} />
              </button>
              <span className="relative mx-auto flex h-15 w-15 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#4b3008,#a26c17)] text-white shadow-[0_14px_28px_-18px_rgba(72,43,3,.9)]">
                <CarFront size={27} />
              </span>
              <p className="relative mt-3 text-[9px] font-black tracking-[.23em] text-[#9b6817]">
                GESTIONE AUTOMEZZI
              </p>
              <h2 className="relative mt-1 text-[22px] font-black tracking-[.08em] text-[#35240b]">
                {vehicleModal.mode === "edit"
                  ? "MODIFICA AUTOMEZZO"
                  : "NUOVO AUTOMEZZO"}
              </h2>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-[.13em] text-[#8b641f]">
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
                <span className="text-[9px] font-black uppercase tracking-[.13em] text-[#8b641f]">
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
                  className="h-12 rounded-[15px] border border-[#d8c8a7] bg-white text-[10px] font-black tracking-[.1em] text-slate-500"
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
                  className="h-12 rounded-[15px] bg-[linear-gradient(135deg,#a87318,#69420a)] text-[10px] font-black tracking-[.12em] text-white shadow-[0_13px_24px_-17px_rgba(75,45,3,.9)] disabled:opacity-40"
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
              className="h-10 w-full rounded-[12px] border border-[#d9caa9] bg-white px-3 text-sm"
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
          <Field label="Chilometri">
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
    </PageLayout>
  );
}
