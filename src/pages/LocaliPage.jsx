import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  Gamepad2,
  MapPin,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button, EmptyState, Input } from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { ConfirmDialog } from "../components/FormDialog";
import { SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { venueSortFn, formatEuro0, formatDateTime } from "../lib/helpers";

const PROTECTED_VENUES = new Set(["D01", "D02", "D03", "D04", "D05"]);
const SLOT_MODELS = ["QUEEN 1", "QUEEN 2", "JACK", "GAMINATOR", "MARIM TOUCH"];
const impactLabels = {
  machines: "Change",
  venue_slots: "Slot installate",
  change_reports: "Report Change",
  movements_cassa: "Movimenti Cassa",
  conteggi_tool: "Conteggi",
  conteggi_admin_rows: "Riepiloghi conteggi",
  calendario_conteggi: "Calendario conteggi",
  giro_venue_assignments: "Assegnazioni Giro",
  change_favorites: "Preferiti Change",
  codici_favorites: "Preferiti Codici",
  debiti: "Debiti",
  debiti_movimenti: "Movimenti Debiti",
  bonus: "Bonus",
  bonus_movimenti: "Movimenti Bonus",
  note_generiche: "Note",
  simulazioni: "Simulazioni",
  simulazioni_richieste: "Richieste simulazioni",
};

function getChangeImage(name = "") {
  const value = String(name).toLowerCase();
  if (value.includes("apex")) return "/change-machine/apex-icon.png";
  if (value.includes("pocket")) return "/change-machine/pocket-icon.png";
  if (value.includes("twin")) return "/change-machine/twin-icon.png";
  if (value.includes("bell")) return "/change-machine/bell-icon.png";
  return "/change-machine/generic.png";
}
function generateVenueCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

function PremiumFormModal({
  open,
  onClose,
  title,
  eyebrow,
  icon: Icon = Building2,
  fields,
  initialValues = {},
  submitLabel,
  onSubmit,
}) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setError("");
    }
  }, [open]);
  if (!open) return null;
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    for (const field of fields) {
      const value = String(values[field.name] ?? "").trim();
      if (field.required && !value)
        return setError(`Compila il campo ${field.label}`);
      if (field.pattern && value && !new RegExp(field.pattern).test(value))
        return setError(field.patternError || `${field.label} non valido`);
    }
    try {
      setSaving(true);
      await onSubmit(values);
    } catch (e) {
      setError(e?.message || "Operazione non riuscita");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[#120d05]/70 p-3 backdrop-blur-md">
      <form
        onSubmit={submit}
        className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-[#d5b66c] bg-[#fffdf9] shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]"
      >
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#3f2908_0%,#895912_58%,#c89532_100%)] px-5 py-6 text-white">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl" />
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!saving) onClose();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!saving) onClose();
            }}
            aria-label="Chiudi popup"
            className="absolute right-3 top-3 z-50 flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-[12px] border border-white/25 bg-black/20 text-[25px] font-light leading-none text-white shadow-lg transition hover:bg-black/35 active:scale-90"
          >
            <span className="pointer-events-none -mt-0.5" aria-hidden="true">
              ×
            </span>
          </button>
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/20 bg-white/12 shadow-lg">
              <Icon size={25} />
            </span>
            <div>
              <p className="text-[9px] font-black tracking-[.25em] text-amber-200">
                {eyebrow}
              </p>
              <h2 className="mt-1 text-[23px] font-black tracking-[.08em]">
                {title}
              </h2>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-[18px] border border-amber-200 bg-[linear-gradient(135deg,#fff9e9,#f7e5b7)] p-3 text-[10px] font-bold leading-relaxed text-[#795116]">
            <Sparkles size={14} className="mb-1" />
            Inserisci i dati richiesti. Le informazioni saranno disponibili
            immediatamente in entrambe le app.
          </div>
          {fields.map((field) => (
            <label key={field.name} className="block">
              <span className="text-[9px] font-black uppercase tracking-[.16em] text-[#8a5d16]">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  autoFocus={field.autoFocus}
                  type={field.type || "text"}
                  inputMode={field.inputMode}
                  value={values[field.name] ?? field.defaultValue ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [field.name]: field.autoUpper
                        ? e.target.value.toUpperCase()
                        : e.target.value,
                    }))
                  }
                  placeholder={field.placeholder || ""}
                  className="h-12 min-w-0 flex-1 rounded-[15px] border border-[#d9c28d] bg-white px-3 text-[14px] font-bold text-slate-900 outline-none transition focus:border-[#a87318] focus:ring-2 focus:ring-amber-200"
                />
                {field.onRefresh && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = field.onRefresh();
                      setValues((v) => ({ ...v, [field.name]: next }));
                    }}
                    title="Genera un nuovo codice"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-[#c99b42] bg-[linear-gradient(145deg,#fff8e8,#e9ca7d)] text-[#754c0d] shadow-sm transition hover:-translate-y-0.5 active:rotate-180"
                  >
                    <RefreshCw size={17} />
                  </button>
                )}
              </div>
              {field.hint && (
                <span className="mt-1 block text-[9px] font-bold text-slate-400">
                  {field.hint}
                </span>
              )}
            </label>
          ))}
          {error && (
            <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-center text-[11px] font-black text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="border-t border-[#e5d7bb] bg-[#faf2e2] p-3">
          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-[14px] bg-[linear-gradient(135deg,#aa741b,#68420a)] text-[11px] font-black tracking-[.1em] text-white shadow-[0_14px_25px_-16px_rgba(75,45,3,.9)] disabled:opacity-45"
          >
            {saving ? "SALVATAGGIO…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}


function SlotManagementModal({ open, onClose, slots = [], onSave }) {
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const next = Object.fromEntries(SLOT_MODELS.map((model) => [model, 0]));
    for (const row of slots) {
      if (SLOT_MODELS.includes(row.model)) next[row.model] = Number(row.quantity || 0);
    }
    setQuantities(next);
    setError("");
  }, [open, slots]);

  if (!open) return null;

  const setQuantity = (model, value) => {
    const numeric = Math.max(0, Math.min(999, Number(value) || 0));
    setQuantities((current) => ({ ...current, [model]: numeric }));
  };

  const save = async () => {
    setError("");
    try {
      setSaving(true);
      await onSave(
        SLOT_MODELS.map((model) => ({
          model,
          quantity: Number(quantities[model] || 0),
        })).filter((row) => row.quantity > 0),
      );
    } catch (e) {
      setError(e?.message || "Impossibile salvare le Slot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-[#120d05]/75 p-3 backdrop-blur-md">
      <div className="max-h-[94vh] w-full max-w-[620px] overflow-hidden rounded-[30px] border border-[#d5b66c] bg-[#fffdf9] shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#3f2908_0%,#895912_58%,#c89532_100%)] px-5 py-6 text-white">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl" />
          <button
            type="button"
            disabled={saving}
            onClick={() => !saving && onClose()}
            aria-label="Chiudi popup"
            className="absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-black/20 text-white shadow-lg transition hover:bg-black/35 active:scale-90 disabled:opacity-40"
          >
            <X size={18} />
          </button>
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/20 bg-white/12 shadow-lg">
              <Gamepad2 size={26} />
            </span>
            <div>
              <p className="text-[9px] font-black tracking-[.25em] text-amber-200">
                PARCO SLOT
              </p>
              <h2 className="mt-1 text-[23px] font-black tracking-[.06em]">
                SLOT INSTALLATE NEL LOCALE
              </h2>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(94vh-190px)] overflow-y-auto p-5">
          <div className="mb-4 rounded-[18px] border border-amber-200 bg-[linear-gradient(135deg,#fff9e9,#f7e5b7)] p-3 text-[10px] font-bold leading-relaxed text-[#795116]">
            Imposta la quantità presente per ogni modello. Lascia <strong>0</strong> per i mobili non installati.
          </div>

          <div className="space-y-2.5">
            {SLOT_MODELS.map((model) => {
              const quantity = Number(quantities[model] || 0);
              return (
                <div
                  key={model}
                  className={`flex items-center gap-3 rounded-[18px] border p-3 transition ${quantity > 0 ? "border-[#c99b42] bg-[#fff8e8] shadow-[0_12px_24px_-22px_rgba(90,55,4,.9)]" : "border-[#e5d8bd] bg-white"}`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${quantity > 0 ? "bg-[#8c5d12] text-white" : "bg-[#f4ecdd] text-[#9c7c47]"}`}>
                    <Gamepad2 size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black tracking-[.14em] text-[#a06c17]">MOBILE SLOT</p>
                    <p className="truncate text-[15px] font-black text-[#33250f]">{model}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={saving || quantity <= 0}
                      onClick={() => setQuantity(model, quantity - 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#d8c08b] bg-white text-[#805718] transition active:scale-95 disabled:opacity-30"
                      aria-label={`Riduci ${model}`}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      inputMode="numeric"
                      disabled={saving}
                      value={quantity}
                      onChange={(event) => setQuantity(model, event.target.value)}
                      className="h-10 w-16 rounded-[12px] border border-[#d8c08b] bg-white text-center text-[17px] font-black tabular-nums text-[#3d2a0b] outline-none focus:border-[#a87318] focus:ring-2 focus:ring-amber-200"
                      aria-label={`Quantità ${model}`}
                    />
                    <button
                      type="button"
                      disabled={saving || quantity >= 999}
                      onClick={() => setQuantity(model, quantity + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#a97218,#70490d)] text-white transition active:scale-95 disabled:opacity-30"
                      aria-label={`Aumenta ${model}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 p-3 text-center text-[11px] font-black text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-[#e5d7bb] bg-[#faf2e2] p-3">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="h-12 w-full rounded-[14px] bg-[linear-gradient(135deg,#aa741b,#68420a)] text-[11px] font-black tracking-[.1em] text-white shadow-[0_14px_25px_-16px_rgba(75,45,3,.9)] disabled:opacity-45"
          >
            {saving ? "SALVATAGGIO…" : "SALVA SLOT INSTALLATE"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LocaliPage() {
  const toast = useToast();
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createVenueOpen, setCreateVenueOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [createMachineOpen, setCreateMachineOpen] = useState(false);
  const [editMachineTarget, setEditMachineTarget] = useState(null);
  const [deleteMachineTarget, setDeleteMachineTarget] = useState(null);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteAccepted, setDeleteAccepted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    setLoading(true);
    const [venueResult, profileResult, employeeResult] = await Promise.all([
      supabase.from("venues").select("*").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("dipendenti").select("auth_user_id,full_name"),
    ]);
    if (venueResult.error) toast.error(venueResult.error.message);
    const people = [
      ...(profileResult.data || []),
      ...(employeeResult.data || []).map((row) => ({
        id: row.auth_user_id,
        display_name: row.full_name,
      })),
    ];
    setProfiles(people);
    const list = [...(venueResult.data || [])].sort(venueSortFn);
    setVenues(list);
    if (selectedVenue) {
      const refreshed = list.find(
        (venue) => String(venue.id) === String(selectedVenue.id),
      );
      if (refreshed) await selectVenue(refreshed);
    } else if (window.innerWidth >= 768 && list.length)
      await selectVenue(list[0]);
    setLoading(false);
  }

  async function selectVenue(venue) {
    const [machineResult, slotResult] = await Promise.all([
      supabase
        .from("machines")
        .select("*")
        .eq("venue_id", venue.id)
        .order("name"),
      supabase
        .from("venue_slots")
        .select("venue_id,model,quantity,updated_at,updated_by")
        .eq("venue_id", venue.id)
        .order("model"),
    ]);
    if (machineResult.error) toast.error(machineResult.error.message);
    if (slotResult.error) toast.error(`Slot: ${slotResult.error.message}`);
    const machines = machineResult.data || [];
    const slots = slotResult.data || [];
    let reports = [];
    if (machines.length) {
      const historyResult = await supabase
        .from("machine_level_history")
        .select("*")
        .in(
          "machine_id",
          machines.map((machine) => machine.id),
        )
        .order("updated_at", { ascending: false });
      const seenReports = new Set();
      reports = (historyResult.data || []).filter((report) => {
        const level = Number(report.level ?? report.new_level ?? 0);
        const timestamp = String(
          report.updated_at || report.created_at || "",
        ).slice(0, 19);
        const author = String(report.updated_by || report.created_by || "");
        const fingerprint = `${report.machine_id}|${level}|${timestamp}|${author}`;
        if (seenReports.has(fingerprint)) return false;
        seenReports.add(fingerprint);
        return true;
      });
    }
    setSelectedVenue({ ...venue, machines, slots });
    setHistory(reports);
    setHistoryOpen({});
    setEditMachineTarget(null);
  }

  async function createVenue(values) {
    let created;
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = attempt ? generateVenueCode() : values.code;
      const result = await supabase
        .from("venues")
        .insert({
          id: values.id,
          code,
          name: values.name,
          city: values.city,
          active: true,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (!result.error) {
        created = result.data;
        break;
      }
      lastError = result.error;
      if (result.error.code !== "23505") break;
    }
    if (!created)
      throw new Error(lastError?.message || "Impossibile creare il locale");
    setCreateVenueOpen(false);
    await loadVenues();
    await selectVenue(created);
    toast.success("Locale creato");
  }

  async function editVenue(values) {
    const { data, error } = await supabase
      .from("venues")
      .update({
        name: values.name,
        code: values.code,
        city: values.city,
        active: true,
      })
      .eq("id", selectedVenue.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setEditVenueOpen(false);
    await loadVenues();
    await selectVenue(data);
    toast.success("Locale aggiornato");
  }

  async function createMachine(values) {
    const { data, error } = await supabase
      .from("machines")
      .insert({
        id: crypto.randomUUID(),
        venue_id: selectedVenue.id,
        name: values.name,
        fondo: Number(values.fondo || 0),
        level: 0,
        last_update: new Date().toISOString(),
        active: true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setCreateMachineOpen(false);
    await selectVenue(selectedVenue);
    toast.success(`Change ${data.name} aggiunto`);
  }

  async function saveMachine(values) {
    const { error } = await supabase
      .from("machines")
      .update({ name: values.name, fondo: Number(values.fondo || 0) })
      .eq("id", editMachineTarget.id);
    if (error) throw new Error(error.message);
    setEditMachineTarget(null);
    await selectVenue(selectedVenue);
    toast.success("Change aggiornato");
  }

  async function deleteMachine() {
    const { error } = await supabase
      .from("machines")
      .update({ active: false })
      .eq("id", deleteMachineTarget.id);
    if (error) throw new Error(error.message);
    setDeleteMachineTarget(null);
    await selectVenue(selectedVenue);
    toast.success("Change rimosso dalla visualizzazione");
  }

  async function saveVenueSlots(rows) {
    const { error } = await supabase.rpc("set_venue_slots", {
      p_venue_id: selectedVenue.id,
      p_slots: rows,
    });
    if (error) throw new Error(error.message);
    setSlotModalOpen(false);
    await selectVenue(selectedVenue);
    toast.success("Slot installate aggiornate");
  }

  async function deleteReport(report) {
    const reportFingerprint = (row) => {
      const level = Number(row.level ?? row.new_level ?? 0);
      const timestamp = String(row.updated_at || row.created_at || "").slice(
        0,
        19,
      );
      const author = String(row.updated_by || row.created_by || "");
      return `${row.machine_id}|${level}|${timestamp}|${author}`;
    };
    const { data: related, error: readError } = await supabase
      .from("machine_level_history")
      .select("*")
      .eq("machine_id", report.machine_id);
    if (readError) return toast.error(readError.message);
    const targetFingerprint = reportFingerprint(report);
    const duplicateIds = (related || [])
      .filter((row) => reportFingerprint(row) === targetFingerprint)
      .map((row) => row.id);
    const ids = duplicateIds.length ? duplicateIds : [report.id];
    const { error } = await supabase
      .from("machine_level_history")
      .delete()
      .in("id", ids);
    if (error) return toast.error(error.message);
    setHistory((rows) => rows.filter((row) => !ids.includes(row.id)));
    toast.success("Report eliminato");
  }

  async function openDangerArea() {
    if (PROTECTED_VENUES.has(String(selectedVenue.id).toUpperCase()))
      return toast.warning("I locali deposito D01-D05 sono protetti");
    setDangerOpen(true);
    setImpact(null);
    setImpactLoading(true);
    setDeleteConfirmation("");
    setDeleteAccepted(false);
    const { data, error } = await supabase.rpc("preview_venue_deletion", {
      p_venue_id: selectedVenue.id,
    });
    setImpactLoading(false);
    if (error)
      return toast.error(`Anteprima non disponibile: ${error.message}`);
    setImpact(data || {});
  }

  async function deleteVenuePermanently() {
    if (deleteConfirmation !== selectedVenue.id || !deleteAccepted) return;
    setDeleting(true);
    const venueId = selectedVenue.id;
    const { error } = await supabase.rpc("delete_venue_permanently", {
      p_venue_id: venueId,
      p_confirmation: deleteConfirmation,
    });
    setDeleting(false);
    if (error) return toast.error(error.message);
    setDangerOpen(false);
    setSelectedVenue(null);
    setHistory([]);
    await loadVenues();
    toast.success(`${venueId} eliminato definitivamente`);
  }

  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase();
    return venues.filter(
      (venue) =>
        !query ||
        `${venue.id} ${venue.code} ${venue.name} ${venue.city || ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [venues, search]);
  const sortedMachines = useMemo(
    () =>
      [...(selectedVenue?.machines || [])]
        .filter((machine) => machine.active !== false)
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [selectedVenue],
  );
  const sortedSlots = useMemo(
    () =>
      [...(selectedVenue?.slots || [])]
        .filter((slot) => Number(slot.quantity || 0) > 0)
        .sort(
          (a, b) =>
            SLOT_MODELS.indexOf(a.model) - SLOT_MODELS.indexOf(b.model),
        ),
    [selectedVenue],
  );
  const recentHistory = useMemo(
    () =>
      history.filter(
        (row) =>
          new Date(row.updated_at || row.created_at).getTime() >=
          Date.now() - 31 * 86400000,
      ),
    [history],
  );
  const totalLevel = sortedMachines.reduce(
    (sum, machine) => sum + Number(machine.level || 0),
    0,
  );
  const totalFondo = sortedMachines.reduce(
    (sum, machine) => sum + Number(machine.fondo || 0),
    0,
  );
  const lastUpdate = sortedMachines
    .map((machine) => machine.last_update)
    .filter(Boolean)
    .sort()
    .at(-1);
  const personName = (id) =>
    profiles.find((profile) => String(profile.id) === String(id))
      ?.display_name ||
    profiles.find((profile) => String(profile.id) === String(id))?.full_name ||
    "Operatore non disponibile";

  return (
    <PageLayout>
      <PageBody className="min-h-0 !overflow-hidden">
        <div className="flex h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(226,186,99,.18),transparent_27%),linear-gradient(180deg,#f7f2e8,#f3eee5)]">
          <aside
            className={`${selectedVenue ? "hidden md:flex" : "flex"} h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-[#dfcfaa] bg-[#fffdf9]/95 md:w-[345px]`}
          >
            <div className="border-b border-[#e5d8bd] bg-[linear-gradient(135deg,#fff7e5,#ead08b)] p-4">
              <p className="text-[9px] font-black tracking-[.22em] text-[#9b6a19]">
                ANAGRAFICA
              </p>
              <div className="mt-1 flex items-center justify-between">
                <h1 className="text-[24px] font-black tracking-[.12em] text-[#3c290b]">
                  LOCALI
                </h1>
                <button
                  onClick={() => {
                    setGeneratedCode(generateVenueCode());
                    setCreateVenueOpen(true);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,#a97218,#6d470c)] text-white shadow-lg"
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
            <div className="border-b border-[#eadfca] p-3">
              <Input
                ref={searchRef}
                leftIcon={Search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca locale, sigla, città…"
              />
            </div>
            <div className="pm-locali-scroll min-h-0 flex-1 overflow-y-scroll p-2 [scrollbar-color:#b77b18_#f3e7ce] [scrollbar-width:thin]">
              {loading ? (
                <SkeletonList count={8} />
              ) : filteredVenues.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Nessun locale"
                  description="Nessun risultato disponibile."
                />
              ) : (
                <div className="space-y-1">
                  {filteredVenues.map((venue) => {
                    const active = selectedVenue?.id === venue.id;
                    return (
                      <button
                        key={venue.id}
                        onClick={() => selectVenue(venue)}
                        className={`flex w-full items-center gap-3 rounded-[16px] border p-2.5 text-left transition ${active ? "border-[#ad781d] bg-[linear-gradient(135deg,#fff1c8,#e8c874)] shadow-[0_12px_24px_-20px_rgba(85,52,2,.8)]" : "border-transparent hover:border-[#e1d0aa] hover:bg-[#fff8e9]"}`}
                      >
                        <span
                          className={`flex h-10 min-w-14 items-center justify-center rounded-[12px] px-2 font-mono text-[11px] font-black ${active ? "bg-[#80530d] text-white" : "bg-[#f0e4cc] text-[#7b5518]"}`}
                        >
                          {venue.id}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-black uppercase text-[#33250f]">
                            {venue.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-bold text-slate-400">
                            <MapPin size={9} />
                            {venue.city || "Città non indicata"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main
            className={`${selectedVenue ? "block" : "hidden md:block"} h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-5`}
          >
            {!selectedVenue ? (
              <div className="flex min-h-[70vh] items-center justify-center">
                <EmptyState
                  icon={Building2}
                  title="Seleziona un locale"
                  description="Scegli un locale per visualizzare la sua scheda premium."
                />
              </div>
            ) : (
              <div className="mx-auto max-w-[1450px] space-y-4">
                <button
                  onClick={() => setSelectedVenue(null)}
                  className="inline-flex items-center gap-1 text-[12px] font-black text-[#8d5d13] md:hidden"
                >
                  <ArrowLeft size={14} /> TORNA AI LOCALI
                </button>
                <section className="relative overflow-hidden rounded-[30px] border border-[#d6b76c] bg-[linear-gradient(135deg,#fffdf8_0%,#f1dca9_100%)] p-5 shadow-[0_25px_60px_-38px_rgba(72,43,3,.8)] md:p-7">
                  <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl" />
                  <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-16 min-w-20 items-center justify-center rounded-[19px] bg-[linear-gradient(135deg,#4b3008,#a26c17)] px-3 font-mono text-[18px] font-black text-white shadow-xl">
                        {selectedVenue.id}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black tracking-[.2em] text-[#9b6a19]">
                          SCHEDA LOCALE
                        </p>
                        <h2 className="truncate text-[25px] font-black uppercase tracking-[.05em] text-[#30210a] md:text-[32px]">
                          {selectedVenue.name}
                        </h2>
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#76521b]">
                          <MapPin size={12} />
                          {selectedVenue.city || "Città non indicata"} · CODICE{" "}
                          {selectedVenue.code}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditVenueOpen(true)}
                        className="flex h-11 items-center gap-2 rounded-[14px] border border-[#d0b16c] bg-white/75 px-4 text-[10px] font-black text-[#775016]"
                      >
                        <Pencil size={14} /> MODIFICA
                      </button>
                      <button
                        onClick={() => setCreateMachineOpen(true)}
                        className="flex h-11 items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#a97218,#70490d)] px-4 text-[10px] font-black text-white"
                      >
                        <Plus size={14} /> NUOVO CHANGE
                      </button>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 overflow-hidden rounded-[25px] border border-[#dfcfaa] bg-[#fffdf9] shadow-[0_20px_45px_-36px_rgba(62,38,3,.7)] md:grid-cols-5">
                  {[
                    ["CHANGE", sortedMachines.length],
                    ["LIVELLO TOTALE", formatEuro0(totalLevel)],
                    ["FONDO TOTALE", formatEuro0(totalFondo)],
                    ["REPORT 31 GIORNI", recentHistory.length],
                    [
                      "ULTIMO AGGIORNAMENTO",
                      lastUpdate ? formatDateTime(lastUpdate) : "—",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="border-b border-r border-[#eee4d1] px-3 py-5 text-center"
                    >
                      <p className="text-[9px] font-black tracking-[.13em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-[17px] font-black text-[#33250f]">
                        {value}
                      </p>
                    </div>
                  ))}
                </section>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black tracking-[.2em] text-[#a06c17]">
                      PARCO MACCHINE
                    </p>
                    <h3 className="text-[21px] font-black tracking-[.1em] text-[#3d2a0b]">
                      CHANGE INSTALLATI NEL LOCALE
                    </h3>
                  </div>
                  <button
                    onClick={() => selectVenue(selectedVenue)}
                    className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#d6bd84] bg-white text-[#805718]"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                {sortedMachines.length === 0 ? (
                  <div className="rounded-[25px] border border-[#e1d4b9] bg-white p-8">
                    <EmptyState
                      title="Nessun Change"
                      description="Aggiungi il primo Change a questo locale."
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {sortedMachines.map((machine) => {
                      const reports = history.filter(
                        (row) => String(row.machine_id) === String(machine.id),
                      );
                      const open = !!historyOpen[machine.id];
                      return (
                        <article
                          key={machine.id}
                          className="overflow-hidden rounded-[26px] border border-[#d9c18a] bg-[#fffdf9] shadow-[0_22px_48px_-35px_rgba(66,39,3,.75)]"
                        >
                          <div className="grid min-h-[235px] grid-cols-[145px_1fr]">
                            <div className="relative flex items-end justify-center overflow-hidden border-r border-[#e2d3b3] bg-[radial-gradient(circle_at_50%_70%,#f0cb70,transparent_48%),linear-gradient(180deg,#fff8e6,#f1e0bd)] p-2">
                              <img
                                src={getChangeImage(machine.name)}
                                alt={machine.name}
                                className="relative z-10 max-h-[205px] w-auto object-contain drop-shadow-xl"
                                onError={(event) => {
                                  event.currentTarget.src =
                                    "/change-machine/generic.png";
                                }}
                              />
                            </div>
                            <div className="flex flex-col p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-[9px] font-black tracking-[.18em] text-[#a16d18]">
                                    CHANGE MACHINE
                                  </p>
                                  <h4 className="mt-1 text-[20px] font-black uppercase text-[#30210a]">
                                    {machine.name}
                                  </h4>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      setEditMachineTarget(machine)
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#dac493] text-[#815718]"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteMachineTarget(machine)
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-red-200 text-red-600"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <div className="rounded-[15px] bg-[#f6ecd7] p-3">
                                  <p className="text-[8px] font-black tracking-[.13em] text-[#987025]">
                                    LIVELLO ATTUALE
                                  </p>
                                  <p className="mt-1 text-[23px] font-black text-emerald-700">
                                    {formatEuro0(machine.level)}
                                  </p>
                                </div>
                                <div className="rounded-[15px] bg-[#f6ecd7] p-3">
                                  <p className="text-[8px] font-black tracking-[.13em] text-[#987025]">
                                    FONDO
                                  </p>
                                  <p className="mt-1 text-[23px] font-black text-[#39270c]">
                                    {formatEuro0(machine.fondo)}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-auto grid gap-1 pt-3 text-[10px] font-bold text-slate-400">
                                <span className="flex items-center gap-1">
                                  <User size={11} />
                                  {personName(machine.updated_by)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock3 size={11} />
                                  {formatDateTime(machine.last_update)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setHistoryOpen((current) => ({
                                ...current,
                                [machine.id]: !open,
                              }))
                            }
                            className="flex h-12 w-full items-center justify-between border-t border-[#e5d7bb] bg-[#faf2e2] px-4 text-[10px] font-black tracking-[.12em] text-[#805718]"
                          >
                            <span>VEDI STORICO · {reports.length} REPORT</span>
                            {open ? (
                              <ChevronUp size={15} />
                            ) : (
                              <ChevronDown size={15} />
                            )}
                          </button>
                          {open && (
                            <div className="max-h-[330px] overflow-y-auto border-t border-[#eadfca] p-3">
                              {reports.length === 0 ? (
                                <p className="py-6 text-center text-xs font-bold text-slate-400">
                                  Nessun report disponibile
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {reports.map((report, index) => {
                                    const current = Number(
                                      report.level ?? report.new_level ?? 0,
                                    );
                                    return (
                                      <div
                                        key={
                                          report.id || `${machine.id}-${index}`
                                        }
                                        className="flex items-center gap-3 rounded-[15px] border border-[#e6dcc8] bg-white p-3"
                                      >
                                        <span className="h-10 w-1 rounded-full bg-[#b47a19]" />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11px] font-black text-slate-800">
                                            {formatDateTime(
                                              report.updated_at ||
                                                report.created_at,
                                            )}
                                          </p>
                                          <p className="mt-0.5 truncate text-[9px] font-bold text-slate-400">
                                            {personName(
                                              report.updated_by ||
                                                report.created_by,
                                            )}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-[18px] font-black text-[#805718]">
                                            {formatEuro0(current)}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => deleteReport(report)}
                                            className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                                            aria-label="Elimina report"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}

                <section className="overflow-hidden rounded-[26px] border border-[#d9c18a] bg-[#fffdf9] shadow-[0_22px_48px_-35px_rgba(66,39,3,.75)]">
                  <div className="flex flex-col gap-3 border-b border-[#e8dcc3] bg-[linear-gradient(135deg,#fff9eb,#f1dfb4)] p-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#a97218,#70490d)] text-white shadow-lg">
                        <Gamepad2 size={20} />
                      </span>
                      <div>
                        <p className="text-[9px] font-black tracking-[.2em] text-[#a06c17]">
                          PARCO SLOT
                        </p>
                        <h3 className="text-[19px] font-black tracking-[.08em] text-[#3d2a0b] md:text-[21px]">
                          SLOT INSTALLATE NEL LOCALE
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSlotModalOpen(true)}
                      className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#a97218,#70490d)] px-5 text-[10px] font-black tracking-[.08em] text-white shadow-lg"
                    >
                      {sortedSlots.length ? <Pencil size={14} /> : <Plus size={14} />}
                      {sortedSlots.length ? "GESTISCI SLOT" : "AGGIUNGI SLOT"}
                    </button>
                  </div>

                  {sortedSlots.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={Gamepad2}
                        title="Nessuna Slot installata"
                        description="Aggiungi i mobili presenti in questo locale e indica le quantità."
                        action={
                          <button
                            type="button"
                            onClick={() => setSlotModalOpen(true)}
                            className="flex h-10 items-center gap-2 rounded-[13px] border border-[#c99b42] bg-[#fff8e8] px-4 text-[10px] font-black text-[#805718]"
                          >
                            <Plus size={14} /> AGGIUNGI SLOT
                          </button>
                        }
                      />
                    </div>
                  ) : (
                    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                      {sortedSlots.map((slot) => (
                        <article
                          key={slot.model}
                          className="flex min-h-[100px] items-center gap-3 rounded-[19px] border border-[#e1d0aa] bg-white p-4 shadow-[0_14px_28px_-26px_rgba(72,43,3,.8)]"
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-[#f5ead3] text-[#8a5d16]">
                            <Gamepad2 size={21} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[8px] font-black tracking-[.16em] text-[#a06c17]">MOBILE SLOT</p>
                            <h4 className="mt-1 truncate text-[15px] font-black text-[#33250f]">{slot.model}</h4>
                          </div>
                          <div className="shrink-0 rounded-[14px] bg-[linear-gradient(135deg,#aa741b,#68420a)] px-3 py-2 text-center text-white shadow-md">
                            <p className="text-[20px] font-black leading-none tabular-nums">{slot.quantity}</p>
                            <p className="mt-1 text-[7px] font-black tracking-[.12em] text-amber-100">SLOT</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="overflow-hidden rounded-[26px] border border-red-200 bg-white shadow-[0_20px_45px_-38px_rgba(185,28,28,.65)]">
                  <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-red-50 text-red-600">
                        <ShieldAlert size={20} />
                      </span>
                      <div>
                        <p className="text-[9px] font-black tracking-[.18em] text-red-500">
                          AREA PERICOLOSA
                        </p>
                        <h3 className="mt-1 text-[17px] font-black text-red-900">
                          ELIMINA DEFINITIVAMENTE IL LOCALE
                        </h3>
                        <p className="mt-1 text-[11px] font-bold text-red-700/65">
                          Rimuove il locale, i Change e tutti i dati collegati.
                          Operazione irreversibile.
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={PROTECTED_VENUES.has(
                        String(selectedVenue.id).toUpperCase(),
                      )}
                      onClick={openDangerArea}
                      className="h-11 rounded-[14px] border border-red-300 bg-red-600 px-5 text-[10px] font-black tracking-[.1em] text-white disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {PROTECTED_VENUES.has(
                        String(selectedVenue.id).toUpperCase(),
                      )
                        ? "LOCALE PROTETTO"
                        : "APRI AREA PERICOLOSA"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </PageBody>

      <PremiumFormModal
        open={createVenueOpen}
        onClose={() => setCreateVenueOpen(false)}
        title="NUOVO LOCALE"
        eyebrow="ANAGRAFICA PREMIUM"
        icon={Building2}
        submitLabel="CREA LOCALE"
        initialValues={{ code: generatedCode }}
        fields={[
          {
            name: "name",
            label: "Nome locale",
            required: true,
            autoUpper: true,
          },
          { name: "id", label: "Sigla", required: true, autoUpper: true },
          {
            name: "code",
            label: "Codice numerico",
            required: true,
            pattern: "^[0-9]{6}$",
            patternError: "Servono sei cifre",
            inputMode: "numeric",
            onRefresh: generateVenueCode,
            hint: "Premi il pulsante a destra per generare un nuovo codice.",
          },
          { name: "city", label: "Città" },
        ]}
        onSubmit={createVenue}
      />
      <PremiumFormModal
        open={editVenueOpen}
        onClose={() => setEditVenueOpen(false)}
        title="MODIFICA LOCALE"
        eyebrow="AGGIORNA ANAGRAFICA"
        icon={Pencil}
        submitLabel="SALVA MODIFICHE"
        initialValues={selectedVenue || {}}
        fields={[
          {
            name: "name",
            label: "Nome locale",
            required: true,
            autoUpper: true,
          },
          {
            name: "code",
            label: "Codice numerico",
            required: true,
            pattern: "^[0-9]{6}$",
            patternError: "Servono sei cifre",
            inputMode: "numeric",
          },
          { name: "city", label: "Città" },
        ]}
        onSubmit={editVenue}
      />
      <PremiumFormModal
        open={createMachineOpen}
        onClose={() => setCreateMachineOpen(false)}
        title="NUOVO CHANGE"
        eyebrow="PARCO MACCHINE"
        icon={Plus}
        submitLabel="AGGIUNGI CHANGE"
        initialValues={{ name: "", fondo: 0 }}
        fields={[
          {
            name: "name",
            label: "Nome Change",
            required: true,
            autoUpper: true,
          },
          {
            name: "fondo",
            label: "Fondo cassa",
            type: "number",
            defaultValue: 0,
          },
        ]}
        onSubmit={createMachine}
      />
      <PremiumFormModal
        open={!!editMachineTarget}
        onClose={() => setEditMachineTarget(null)}
        title="MODIFICA CHANGE"
        eyebrow="DATI MACCHINA"
        icon={Pencil}
        submitLabel="SALVA CHANGE"
        initialValues={editMachineTarget || { name: "", fondo: 0 }}
        fields={[
          {
            name: "name",
            label: "Nome Change",
            required: true,
            autoUpper: true,
          },
          {
            name: "fondo",
            label: "Fondo cassa",
            type: "number",
            defaultValue: 0,
          },
        ]}
        onSubmit={saveMachine}
      />
      <SlotManagementModal
        open={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        slots={selectedVenue?.slots || []}
        onSave={saveVenueSlots}
      />
      <ConfirmDialog
        open={!!deleteMachineTarget}
        onClose={() => setDeleteMachineTarget(null)}
        title="RIMUOVERE IL CHANGE?"
        message={
          deleteMachineTarget
            ? `Il Change ${deleteMachineTarget.name} non sarà più visibile. Lo storico resta conservato.`
            : ""
        }
        confirmLabel="RIMUOVI"
        onConfirm={deleteMachine}
      />
      {dangerOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={() => !deleting && setDangerOpen(false)}
        >
          <div
            className="max-h-[94vh] w-full max-w-[620px] overflow-y-auto rounded-[30px] border border-red-400/45 bg-[#fffdf9] shadow-[0_40px_100px_-28px_rgba(0,0,0,.95)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative bg-[linear-gradient(135deg,#4b0909,#9f1d1d)] p-5 text-center text-white">
              <button
                onClick={() => setDangerOpen(false)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/15 bg-white/10"
              >
                <X size={15} />
              </button>
              <ShieldAlert className="mx-auto" size={30} />
              <p className="mt-2 text-[9px] font-black tracking-[.24em] text-red-200">
                CANCELLAZIONE IRREVERSIBILE
              </p>
              <h2 className="mt-1 text-[21px] font-black">
                ELIMINA {selectedVenue?.id} · {selectedVenue?.name}
              </h2>
            </div>
            <div className="p-5">
              {impactLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="mx-auto animate-spin text-red-600" />
                  <p className="mt-3 text-xs font-black text-slate-500">
                    Analisi dei dati collegati…
                  </p>
                </div>
              ) : impact ? (
                <>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {Object.entries(impact).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-[15px] border border-red-100 bg-red-50/55 p-3 text-center"
                      >
                        <p className="text-[8px] font-black uppercase tracking-[.1em] text-red-500">
                          {impactLabels[key] || key}
                        </p>
                        <p className="mt-1 text-[21px] font-black text-red-900">
                          {Number(value) || 0}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[17px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-relaxed text-amber-900">
                    <Database size={15} className="mb-1" />
                    Tutti questi dati verranno eliminati in un’unica operazione.
                    Se una sola eliminazione fallisce, il database annullerà
                    tutto.
                  </div>
                  <label className="mt-4 block text-[10px] font-black uppercase tracking-[.1em] text-slate-600">
                    Scrivi esattamente {selectedVenue?.id}
                  </label>
                  <Input
                    value={deleteConfirmation}
                    onChange={(event) =>
                      setDeleteConfirmation(event.target.value.toUpperCase())
                    }
                    className="mt-1 text-center font-mono font-black"
                  />
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-[14px] border border-red-100 p-3 text-[11px] font-bold text-red-900">
                    <input
                      type="checkbox"
                      checked={deleteAccepted}
                      onChange={(event) =>
                        setDeleteAccepted(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 accent-red-600"
                    />
                    Ho compreso che il locale e tutti i dati collegati saranno
                    eliminati definitivamente.
                  </label>
                  <button
                    disabled={
                      deleteConfirmation !== selectedVenue?.id ||
                      !deleteAccepted ||
                      deleting
                    }
                    onClick={deleteVenuePermanently}
                    className="mt-4 h-13 w-full rounded-[15px] bg-[linear-gradient(135deg,#c51f1f,#7d0c0c)] text-[11px] font-black tracking-[.11em] text-white disabled:opacity-35"
                  >
                    {deleting
                      ? "ELIMINAZIONE IN CORSO…"
                      : `ELIMINA DEFINITIVAMENTE ${selectedVenue?.id}`}
                  </button>
                </>
              ) : (
                <p className="py-10 text-center text-sm font-bold text-red-700">
                  Impossibile caricare l’anteprima. Nessun dato può essere
                  eliminato.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
