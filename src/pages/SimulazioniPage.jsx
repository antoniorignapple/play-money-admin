import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button, EmptyState, Field, Select, Textarea } from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { useToast } from "../components/Toast";
import { venueSortFn } from "../lib/helpers";
import generateSimulazioniPdf from "../lib/generateSimulazioniPdf";
import {
  closePdfPreviewWindow,
  createPdfPreviewWindow,
} from "../lib/pdfPreview";

const fmtEuro0 = (n, signed = false) => {
  const value = Math.trunc(Number(n) || 0);
  return `${signed && value > 0 ? "+" : ""}${value.toLocaleString("it-IT")} €`;
};
const balanceClass = (n) =>
  Number(n) > 0
    ? "text-emerald-600"
    : Number(n) < 0
      ? "text-red-600"
      : "text-slate-950";
const isSimulazioneVenue = (v) =>
  !["D01", "D02"].includes(String(v?.id || "").toUpperCase());
const fmtDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const dateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const today = new Date();
const defaultPdfFrom = dateInputValue(
  new Date(today.getFullYear(), today.getMonth(), 1),
);
const defaultPdfTo = dateInputValue(today);
const simulationDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateInputValue(date);
};
const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("it-IT");

export default function SimulazioniPage() {
  const toast = useToast();
  const [tab, setTab] = useState("archivio");
  const [venues, setVenues] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [simulazioni, setSimulazioni] = useState([]);
  const [cestino, setCestino] = useState([]);
  const [richieste, setRichieste] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewReq, setShowNewReq] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmHard, setConfirmHard] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pdfFrom, setPdfFrom] = useState(defaultPdfFrom);
  const [pdfTo, setPdfTo] = useState(defaultPdfTo);
  const [pdfEmployee, setPdfEmployee] = useState("all");
  const [pdfLoading, setPdfLoading] = useState(false);

  const venueById = useMemo(() => {
    const m = {};
    venues.forEach((v) => {
      m[String(v.id)] = v;
    });
    return m;
  }, [venues]);
  function venueLabel(id) {
    const v = venueById[String(id)];
    if (!v) return id || "—";
    const name = String(v.name || "").trim();
    return name.toLowerCase().startsWith(String(v.id).toLowerCase())
      ? name
      : `${v.id} ${name}`;
  }
  function venueName(id) {
    const v = venueById[String(id)];
    return String(v?.name || id || "Locale")
      .replace(new RegExp(`^${String(id)}\\s*`, "i"), "")
      .trim();
  }
  function agentName(uid) {
    const d = dipendenti.find((x) => String(x.auth_user_id) === String(uid));
    return d?.full_name || "—";
  }

  const simulationOperators = useMemo(
    () =>
      Array.from(
        new Set(
          simulazioni
            .map((simulation) => String(simulation.operator_name || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" })),
    [simulazioni],
  );

  async function exportSimulationsPdf() {
    if (!pdfFrom || !pdfTo) {
      toast.warning("Seleziona entrambe le date");
      return;
    }
    if (pdfFrom > pdfTo) {
      toast.warning("La data iniziale non può superare quella finale");
      return;
    }

    const selectedRows = simulazioni.filter((simulation) => {
      const date = simulationDateKey(simulation.created_at);
      if (!date || date < pdfFrom || date > pdfTo) return false;
      if (
        pdfEmployee !== "all" &&
        normalizeName(simulation.operator_name) !== normalizeName(pdfEmployee)
      )
        return false;
      return true;
    });

    if (!selectedRows.length) {
      toast.warning("Nessuna simulazione nel periodo selezionato");
      return;
    }

    let previewWindow = null;
    try {
      previewWindow = createPdfPreviewWindow();
      setPdfLoading(true);
      await generateSimulazioniPdf({
        rows: selectedRows.map((simulation) => ({
          venue: venueLabel(simulation.venue_id),
          employee: simulation.operator_name || "-",
          createdAt: simulation.created_at,
          total: simulation.total,
        })),
        dateFrom: pdfFrom,
        dateTo: pdfTo,
        employee: pdfEmployee === "all" ? "TUTTI" : pdfEmployee,
        targetWindow: previewWindow,
      });
      toast.success("PDF aperto in anteprima");
    } catch (error) {
      closePdfPreviewWindow(previewWindow);
      toast.error(error.message || "Impossibile generare il PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const { data: period, error: periodError } = await supabase
        .from("active_conteggi_period")
        .select("id,date_from,date_to,status")
        .maybeSingle();
      if (periodError) throw periodError;

      let activeSimQuery = supabase.from("simulazioni").select("*").is("deleted_at", null);
      let deletedSimQuery = supabase.from("simulazioni").select("*").not("deleted_at", "is", null);
      if (period?.date_from) {
        activeSimQuery = activeSimQuery.gte("work_date", period.date_from);
        deletedSimQuery = deletedSimQuery.gte("work_date", period.date_from);
      }
      if (period?.date_to) {
        activeSimQuery = activeSimQuery.lte("work_date", period.date_to);
        deletedSimQuery = deletedSimQuery.lte("work_date", period.date_to);
      }

      const [
        { data: v },
        { data: dip },
        { data: sim },
        { data: del },
        { data: req },
      ] = await Promise.all([
        supabase.from("venues").select("*"),
        supabase.from("dipendenti").select("*"),
        activeSimQuery.order("created_at", { ascending: false }).limit(3000),
        deletedSimQuery.order("deleted_at", { ascending: false }).limit(1000),
        supabase
          .from("simulazioni_richieste")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      setVenues([...(v || [])].filter(isSimulazioneVenue).sort(venueSortFn));
      setDipendenti(dip || []);
      setSimulazioni(sim || []);
      setCestino(del || []);
      setRichieste(req || []);
    } catch (e) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadAll();
  }, []);

  async function createRichiesta(form) {
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    if (!form.user_id) return toast.warning("Seleziona un operatore");
    if (
      richieste.some(
        (r) =>
          r.status === "in_attesa" &&
          String(r.venue_id) === String(form.venue_id) &&
          String(r.requested_user_id) === String(form.user_id),
      )
    ) {
      return toast.error(
        "Esiste già una richiesta in attesa per questo operatore e locale",
      );
    }
    const v = venueById[String(form.venue_id)];
    const { data, error } = await supabase
      .from("simulazioni_richieste")
      .insert({
        venue_id: form.venue_id,
        venue_name: v ? v.name || v.id : form.venue_id,
        requested_user_id: form.user_id,
        note: form.note?.trim() || null,
        status: "in_attesa",
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    if (data?.id)
      supabase.functions
        .invoke("send-push", {
          body: { type: "simulazione_richiesta", richiesta_id: data.id },
        })
        .catch(() => {});
    setShowNewReq(false);
    toast.success("Richiesta inviata");
    loadAll();
  }
  async function annullaRichiesta(r) {
    const { error } = await supabase
      .from("simulazioni_richieste")
      .update({ status: "annullata" })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Richiesta annullata");
    loadAll();
  }
  async function softDelete() {
    if (!confirmDelete) return;
    const { error } = await supabase
      .from("simulazioni")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", confirmDelete.id);
    setConfirmDelete(null);
    if (error) return toast.error(error.message);
    setDetail(null);
    toast.success("Spostata nel cestino");
    loadAll();
  }
  async function restore(s) {
    const { error } = await supabase
      .from("simulazioni")
      .update({ deleted_at: null })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    setDetail(null);
    toast.success("Ripristinata");
    loadAll();
  }
  async function hardDelete() {
    if (!confirmHard) return;
    const { error } = await supabase
      .from("simulazioni")
      .delete()
      .eq("id", confirmHard.id);
    setConfirmHard(null);
    if (error) return toast.error(error.message);
    setDetail(null);
    toast.success("Eliminata definitivamente");
    loadAll();
  }

  const pending = richieste.filter((r) => r.status === "in_attesa");
  const stats =
    tab === "archivio"
      ? simulazioni.length
      : tab === "richieste"
        ? pending.length
        : cestino.length;

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[#f5f1e9] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1180px] space-y-4">
            <header className="overflow-hidden rounded-[28px] border border-amber-300/70 bg-gradient-to-br from-[#fffaf0] via-white to-[#f3dfad] shadow-[0_16px_45px_rgba(120,83,12,.13)]">
              <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-7">
                <div>
                  <p className="flex items-center gap-2 text-[10px] font-black tracking-[.24em] text-amber-700">
                    <Sparkles size={13} /> AREA OPERATIVA
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                    SIMULAZIONI
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Controlla le fotografie contabili inviate dagli operatori.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="mr-1 rounded-2xl border border-amber-200 bg-white/80 px-4 py-2 text-center shadow-sm">
                    <div className="text-xl font-black text-slate-950">
                      {stats}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-amber-700">
                      {tab}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={loadAll}
                    disabled={loading}
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-200 bg-white text-amber-800 shadow-sm transition hover:-translate-y-0.5"
                  >
                    <RefreshCw
                      size={18}
                      className={loading ? "animate-spin" : ""}
                    />
                  </button>
                  {tab === "richieste" && (
                    <button
                      type="button"
                      onClick={() => setShowNewReq(true)}
                      className="flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#9b6500] to-[#d6a934] px-4 text-xs font-black text-white shadow-lg shadow-amber-900/15"
                    >
                      <Plus size={17} /> NUOVA
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-amber-200/70 bg-white/60">
                <PremiumTab
                  active={tab === "archivio"}
                  icon={Archive}
                  label="Archivio"
                  count={simulazioni.length}
                  onClick={() => setTab("archivio")}
                />
                <PremiumTab
                  active={tab === "richieste"}
                  icon={Bell}
                  label="Richieste"
                  count={pending.length}
                  onClick={() => setTab("richieste")}
                />
                <PremiumTab
                  active={tab === "cestino"}
                  icon={Trash2}
                  label="Cestino"
                  count={cestino.length}
                  onClick={() => setTab("cestino")}
                />
              </div>
            </header>

            {tab === "archivio" && (
              <>
                <section className="rounded-[24px] border border-amber-200 bg-white p-4 shadow-[0_10px_30px_rgba(80,55,15,.08)] md:p-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.35fr_auto] xl:items-end">
                    <label className="block">
                      <span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-amber-700">Dal</span>
                      <input
                        type="date"
                        value={pdfFrom}
                        max={pdfTo || undefined}
                        onChange={(event) => setPdfFrom(event.target.value)}
                        className="h-11 w-full rounded-[14px] border border-amber-200 bg-[#fffdf8] px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-amber-700">Al</span>
                      <input
                        type="date"
                        value={pdfTo}
                        min={pdfFrom || undefined}
                        onChange={(event) => setPdfTo(event.target.value)}
                        className="h-11 w-full rounded-[14px] border border-amber-200 bg-[#fffdf8] px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-amber-700">Dipendente</span>
                      <select
                        value={pdfEmployee}
                        onChange={(event) => setPdfEmployee(event.target.value)}
                        className="h-11 w-full rounded-[14px] border border-amber-200 bg-[#fffdf8] px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500"
                      >
                        <option value="all">TUTTI I DIPENDENTI</option>
                        {simulationOperators.map((operator) => (
                          <option key={operator} value={operator}>
                            {operator}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={exportSimulationsPdf}
                      disabled={pdfLoading}
                      className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#8f5d00] to-[#d2a437] px-6 text-[11px] font-black uppercase tracking-[.12em] text-white shadow-lg shadow-amber-900/15 transition hover:-translate-y-0.5 disabled:opacity-50 md:col-span-2 xl:col-span-1"
                    >
                      {pdfLoading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <FileText size={16} />
                      )}
                      PDF
                    </button>
                  </div>
                </section>
                <SimList
                  items={simulazioni}
                  emptyIcon={Archive}
                  emptyTitle="Nessuna simulazione"
                  emptyDescription="Le simulazioni effettuate dagli operatori compariranno qui."
                  venueLabel={venueLabel}
                  onOpen={setDetail}
                  onDelete={setConfirmDelete}
                />
              </>
            )}
            {tab === "cestino" && (
              <SimList
                items={cestino}
                emptyIcon={Trash2}
                emptyTitle="Cestino vuoto"
                venueLabel={venueLabel}
                onOpen={(s) => setDetail({ ...s, _deleted: true })}
                deleted
                onRestore={restore}
                onHardDelete={setConfirmHard}
              />
            )}
            {tab === "richieste" && (
              <div className="space-y-3">
                {pending.length === 0 ? (
                  <PremiumEmpty
                    icon={Bell}
                    title="Nessuna richiesta in attesa"
                    description="Crea una richiesta per chiedere a un operatore di simulare un locale."
                  />
                ) : (
                  pending.map((r) => (
                    <article
                      key={r.id}
                      className="rounded-[22px] border border-amber-200 bg-white p-4 shadow-[0_8px_25px_rgba(40,35,20,.07)] md:p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {venueLabel(r.venue_id)}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            PER {agentName(r.requested_user_id).toUpperCase()} ·{" "}
                            {fmtDateTime(r.created_at)}
                          </p>
                          {r.note && (
                            <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
                              {r.note}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => annullaRichiesta(r)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </PageBody>

      <SnapshotDetail
        open={!!detail}
        simulation={detail}
        venueName={venueName}
        onClose={() => setDetail(null)}
        onDelete={() => setConfirmDelete(detail)}
        onRestore={() => restore(detail)}
        onHardDelete={() => setConfirmHard(detail)}
      />
      <NewRichiestaModal
        open={showNewReq}
        onClose={() => setShowNewReq(false)}
        venues={venues}
        dipendenti={dipendenti}
        onCreate={createRichiesta}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Sposta nel cestino"
        message="La simulazione sparirà dall'archivio ma potrà essere ripristinata in qualsiasi momento."
        confirmLabel="SPOSTA NEL CESTINO"
        onConfirm={softDelete}
        danger
      />
      <ConfirmDialog
        open={!!confirmHard}
        onClose={() => setConfirmHard(null)}
        title="Elimina definitivamente"
        message="Questa operazione è permanente e la simulazione non potrà più essere recuperata."
        confirmLabel="ELIMINA PER SEMPRE"
        onConfirm={hardDelete}
        danger
      />
    </PageLayout>
  );
}

function PremiumTab({ active, icon: Icon, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 px-2 py-4 text-[11px] font-black uppercase tracking-wide transition ${active ? "bg-white text-amber-800" : "text-slate-500 hover:bg-white/70"}`}
    >
      <Icon size={15} />
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[9px] ${active ? "bg-amber-100 text-amber-800" : "bg-slate-100"}`}
      >
        {count}
      </span>
      {active && (
        <span className="absolute inset-x-8 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-[#a16c05] to-[#e4bd59]" />
      )}
    </button>
  );
}

function SimList({
  items,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  venueLabel,
  onOpen,
  onDelete,
  deleted,
  onRestore,
  onHardDelete,
}) {
  if (!items.length)
    return (
      <PremiumEmpty
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  return (
    <div className="space-y-3">
      {items.map((s) => (
        <article
          key={s.id}
          className={`group overflow-hidden rounded-[22px] border bg-white shadow-[0_8px_25px_rgba(40,35,20,.07)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(120,83,12,.13)] ${deleted ? "border-slate-200 opacity-85" : "border-amber-200"}`}
        >
          <button
            type="button"
            onClick={() => onOpen(s)}
            className="flex w-full items-center gap-4 p-4 text-left md:p-5"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#8b5b00] to-[#d9ae42] text-white shadow-md">
              <Building2 size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950">
                {venueLabel(s.venue_id)}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} />
                  {fmtDateTime(s.created_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserIcon size={11} />
                  {s.operator_name || "—"}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={`text-lg font-black tabular-nums ${balanceClass(s.total)}`}
              >
                {fmtEuro0(s.total, true)}
              </p>
              <p className="mt-0.5 hidden items-center justify-end gap-1 text-[9px] font-black uppercase tracking-wider text-amber-700 sm:flex">
                <Eye size={11} /> Apri fotografia
              </p>
            </div>
            <ChevronRight
              size={18}
              className="shrink-0 text-amber-600 transition group-hover:translate-x-1"
            />
          </button>
          <div className="flex justify-end gap-2 border-t border-amber-100 bg-amber-50/40 px-4 py-2">
            {deleted ? (
              <>
                <MiniAction
                  icon={RotateCcw}
                  label="Ripristina"
                  onClick={() => onRestore(s)}
                />
                <MiniAction
                  icon={Trash2}
                  label="Elimina"
                  danger
                  onClick={() => onHardDelete(s)}
                />
              </>
            ) : (
              <MiniAction
                icon={Trash2}
                label="Cestino"
                danger
                onClick={() => onDelete(s)}
              />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniAction({ icon: Icon, label, danger, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase transition ${danger ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function PremiumEmpty({ icon: Icon, title, description }) {
  return (
    <div className="rounded-[26px] border border-dashed border-amber-300 bg-white/70 px-5 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
        <Icon size={24} />
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-900">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

function SnapshotDetail({
  open,
  simulation: s,
  venueName,
  onClose,
  onDelete,
  onRestore,
  onHardDelete,
}) {
  if (!open || !s) return null;
  const fields = [
    ["UTILE LORDO", s.utile_lordo, true],
    ["ACCONTI", s.acconti],
    ["CARTA", s.carta],
    ["MONETE", s.monete],
    ["DA RIPORTARE", s.da_riportare],
    ["DA RIPORTARE SOSPESO", s.da_riportare_sospeso],
  ];
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#e6f1f2]/95 p-2 backdrop-blur-sm md:p-5">
      <div className="mx-auto min-h-full max-w-[520px] border border-white/80 bg-[#f7f2e9] px-3 py-3 shadow-2xl md:rounded-[28px] md:px-4">
        <div className="flex min-h-[calc(100vh-2rem)] flex-col">
          <div className="flex items-center rounded-[22px] border border-amber-400 bg-gradient-to-r from-[#fff8e8] via-[#ecd190] to-[#d5a638] p-2 shadow-lg shadow-amber-900/10">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onClose();
              }}
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl border border-amber-400 bg-white/80 text-amber-800"
            >
              <X size={20} />
            </button>
            <h2 className="flex-1 text-center text-lg font-black tracking-[.08em] text-amber-600 drop-shadow-sm">
              SIMULAZIONE
            </h2>
            <div className="w-10" />
          </div>
          <div className="mt-4 flex items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <span className="rounded-xl bg-gradient-to-br from-[#8b5b00] to-[#d4a631] px-3 py-2 text-xs font-black text-white">
              {s.venue_id || "—"}
            </span>
            <span className="ml-3 flex-1 truncate text-sm font-black text-slate-950">
              {venueName(s.venue_id)}
            </span>
            <span className="text-[9px] font-black uppercase text-amber-700">
              {fmtDateTime(s.created_at)}
            </span>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-950">CHANGE</span>
              <span className="text-sm font-black text-amber-700">
                {s.change != null ? fmtEuro0(s.change) : "›"}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {fields.slice(0, 5).map(([label, value, hero]) => (
              <SnapshotValue
                key={label}
                label={label}
                value={value}
                hero={hero}
              />
            ))}
            <div className="flex items-center gap-3 py-2">
              <span className="h-px flex-1 bg-amber-800/25" />
              <span className="text-[9px] font-black tracking-[.28em] text-amber-800">
                VOCI EXTRA
              </span>
              <span className="h-px flex-1 bg-amber-800/25" />
            </div>
            <SnapshotValue label={fields[5][0]} value={fields[5][1]} />
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-xs font-black text-slate-950">NOTE</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {s.note || "Nessuna nota inserita."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <UserIcon size={11} />
                  {s.operator_name || "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={11} />
                  {fmtDateTime(s.created_at)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-8">
            <div className="rounded-[22px] border border-amber-200 bg-white p-3 shadow-[0_-10px_35px_rgba(75,55,20,.10)]">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-[10px] font-black tracking-[.18em] text-amber-800">
                  TOTALE SIMULAZIONE
                </span>
                <span
                  className={`text-2xl font-black tabular-nums ${balanceClass(s.total)}`}
                >
                  {fmtEuro0(s.total, true)}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#d7a83d] via-[#b47b0e] to-[#835100] px-4 py-3 text-xs font-black text-white shadow-lg"
              >
                CHIUDI DETTAGLIO
              </button>
              <div className="mt-2 flex justify-center gap-2">
                {s._deleted ? (
                  <>
                    <MiniAction
                      icon={RotateCcw}
                      label="Ripristina"
                      onClick={onRestore}
                    />
                    <MiniAction
                      icon={Trash2}
                      label="Elimina definitivamente"
                      danger
                      onClick={onHardDelete}
                    />
                  </>
                ) : (
                  <MiniAction
                    icon={Trash2}
                    label="Sposta nel cestino"
                    danger
                    onClick={onDelete}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SnapshotValue({ label, value, hero }) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl px-4 py-4 shadow-sm ${hero ? "border border-amber-400 bg-gradient-to-r from-[#936000] via-[#d9a82f] to-[#9b6500] text-white" : "border border-slate-200 bg-white text-slate-950"}`}
    >
      <span className="text-xs font-black">{label}</span>
      <span className="text-xl font-black tabular-nums">{fmtEuro0(value)}</span>
    </div>
  );
}

function PremiumModal({ open, onClose, title, subtitle, children, footer }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="my-auto w-full max-w-lg overflow-hidden rounded-[26px] border border-amber-300 bg-[#f8f4ec] shadow-2xl">
        <header className="flex items-center gap-3 bg-gradient-to-r from-[#fff9ed] via-[#eed59a] to-[#d5a539] p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black text-slate-950">
              {title}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900/70">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onPointerDown={(e) => {
              e.preventDefault();
              onClose();
            }}
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500 bg-white/80 text-amber-900"
          >
            <X size={20} />
          </button>
        </header>
        <div className="max-h-[65vh] overflow-y-auto p-4 md:p-5">
          {children}
        </div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-amber-200 bg-white p-3 md:p-4">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  danger,
}) {
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Conferma operazione"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ANNULLA
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-slate-600">{message}</p>
    </PremiumModal>
  );
}

function NewRichiestaModal({ open, onClose, venues, dipendenti, onCreate }) {
  const [form, setForm] = useState({ venue_id: "", user_id: "", note: "" });
  useEffect(() => {
    if (open) setForm({ venue_id: "", user_id: "", note: "" });
  }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Nuova richiesta"
      subtitle="Richiedi una simulazione a un operatore"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ANNULLA
          </Button>
          <Button variant="primary" icon={Send} onClick={() => onCreate(form)}>
            INVIA RICHIESTA
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Locale" required>
          <Select
            value={form.venue_id}
            onChange={(e) => set("venue_id", e.target.value)}
          >
            <option value="">Seleziona…</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {String(v.name || "").startsWith(String(v.id))
                  ? v.name
                  : `${v.id} ${v.name}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Operatore destinatario" required>
          <Select
            value={form.user_id}
            onChange={(e) => set("user_id", e.target.value)}
          >
            <option value="">Seleziona…</option>
            {dipendenti
              .filter((d) => d.auth_user_id)
              .map((d) => (
                <option key={d.id || d.auth_user_id} value={d.auth_user_id}>
                  {d.full_name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Messaggio (opzionale)">
          <Textarea
            rows={4}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Es. controlla l'hopper della slot 3"
          />
        </Field>
      </div>
    </PremiumModal>
  );
}
