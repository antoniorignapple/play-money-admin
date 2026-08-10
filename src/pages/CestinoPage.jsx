import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Coins,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button, Input } from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { useToast } from "../components/Toast";
import {
  daysAgoISO,
  todayISO,
  formatMoney,
  formatDateTime,
  dipendenteName,
  dipendenteId,
} from "../lib/helpers";

export default function CestinoPage() {
  const toast = useToast();
  const [movements, setMovements] = useState([]);
  const [venues, setVenues] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(daysAgoISO(180));
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmDeleteOne, setConfirmDeleteOne] = useState(null);
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
  async function loadData() {
    setLoading(true);
    const [movRes, venRes, dipRes] = await Promise.all([
      supabase
        .from("movements_cassa")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase.from("venues").select("*"),
      supabase.from("dipendenti").select("*"),
    ]);
    if (movRes.error) toast.error(`Errore: ${movRes.error.message}`);
    setMovements(movRes.data || []);
    setVenues(venRes.data || []);
    setDipendenti(dipRes.data || []);
    setLoading(false);
  }
  function operatorById(id) {
    return dipendenti.find((d) => String(dipendenteId(d)) === String(id));
  }
  function venueLabel(id) {
    const v = venues.find((x) => String(x.id) === String(id));
    if (!v) return id || "—";
    const name = String(v.name || "").trim();
    return name.toLowerCase().startsWith(String(v.id).toLowerCase())
      ? name
      : `${v.id} ${name}`;
  }
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((r) => {
      const delDate = String(r.deleted_at || "").slice(0, 10);
      if (dateFrom && delDate < dateFrom) return false;
      if (dateTo && delDate > dateTo) return false;
      return (
        !q ||
        [venueLabel(r.venue_id), dipendenteName(operatorById(r.created_by))]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [movements, dateFrom, dateTo, search, venues, dipendenti]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          acconto: a.acconto + (Number(r.acconto) || 0),
          recupero: a.recupero + (Number(r.recupero) || 0),
          riportare: a.riportare + (Number(r.da_riportare) || 0),
        }),
        { acconto: 0, recupero: 0, riportare: 0 },
      ),
    [rows],
  );

  async function restoreOne(id) {
    const { error } = await supabase
      .from("movements_cassa")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    setMovements((p) => p.filter((x) => x.id !== id));
    setConfirmRestore(null);
    toast.success("Movimento ripristinato");
  }
  async function deleteOneForever(id) {
    const { error } = await supabase
      .from("movements_cassa")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    setMovements((p) => p.filter((x) => x.id !== id));
    setConfirmDeleteOne(null);
    toast.success("Movimento eliminato definitivamente");
  }
  async function restoreAll() {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    const { error } = await supabase
      .from("movements_cassa")
      .update({ deleted_at: null })
      .in("id", ids);
    if (error) throw new Error(error.message);
    setMovements((p) => p.filter((x) => !ids.includes(x.id)));
    setConfirmRestoreAll(false);
    toast.success(`${ids.length} movimenti ripristinati`);
  }
  async function deleteAllForever() {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    const { error } = await supabase
      .from("movements_cassa")
      .delete()
      .in("id", ids);
    if (error) throw new Error(error.message);
    setMovements((p) => p.filter((x) => !ids.includes(x.id)));
    setConfirmDeleteAll(false);
    toast.success(`${ids.length} movimenti eliminati definitivamente`);
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[#f5f1e9] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1280px] space-y-4">
            <header className="overflow-hidden rounded-[28px] border border-amber-300/70 bg-gradient-to-br from-[#fffaf0] via-white to-[#f1d99d] shadow-[0_16px_45px_rgba(120,83,12,.13)]">
              <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-7">
                <div>
                  <p className="flex items-center gap-2 text-[10px] font-black tracking-[.24em] text-amber-700">
                    <Sparkles size={13} /> ARCHIVIO PROTETTO
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                    CESTINO CASSA
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Recupera i movimenti rimossi o cancellali definitivamente.
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="grid h-11 w-11 place-items-center self-end rounded-2xl border border-amber-200 bg-white text-amber-800 shadow-sm md:self-auto"
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 border-t border-amber-200/70 bg-white/65 sm:grid-cols-4">
                <Stat value={rows.length} label="Elementi visibili" />
                <Stat value={formatMoney(totals.acconto)} label="Acconti" />
                <Stat value={formatMoney(totals.recupero)} label="Recuperi" />
                <Stat
                  value={formatMoney(totals.riportare)}
                  label="Da riportare"
                />
              </div>
            </header>
            <div className="flex items-start gap-3 rounded-[20px] border border-amber-300 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <ShieldAlert size={19} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">
                  AREA DI SICUREZZA
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Il ripristino è sempre sicuro. L’eliminazione definitiva,
                  invece, non può essere annullata.
                </p>
              </div>
            </div>
            <section className="rounded-[24px] border border-amber-200 bg-white p-4 shadow-[0_8px_25px_rgba(40,35,20,.06)]">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
                <Filter size={14} /> Filtra movimenti
              </div>
              <div className="grid gap-3 md:grid-cols-[170px_170px_1fr_auto]">
                <DateField
                  label="DAL"
                  value={dateFrom}
                  onChange={setDateFrom}
                />
                <DateField label="AL" value={dateTo} onChange={setDateTo} />
                <div>
                  <label className="mb-1.5 block text-[9px] font-black tracking-wider text-slate-400">
                    RICERCA
                  </label>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Locale o agente…"
                      className="h-11 w-full rounded-xl border border-amber-200 bg-amber-50/30 pl-10 pr-9 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={loadData}
                  className="mt-auto h-11 rounded-xl bg-gradient-to-r from-[#956100] to-[#d2a239] px-5 text-[10px] font-black text-white"
                >
                  APPLICA
                </button>
              </div>
            </section>
            {rows.length > 0 && (
              <div className="flex flex-col gap-2 rounded-[20px] border border-amber-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Azioni sui {rows.length} risultati visualizzati
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRestoreAll(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-[9px] font-black text-emerald-700 sm:flex-none"
                  >
                    <RotateCcw size={14} /> RIPRISTINA TUTTI
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-[9px] font-black text-red-600 sm:flex-none"
                  >
                    <Trash2 size={14} /> ELIMINA TUTTI
                  </button>
                </div>
              </div>
            )}
            {loading ? (
              <TrashSkeleton />
            ) : rows.length === 0 ? (
              <EmptyTrash />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {rows.map((r) => (
                  <TrashCard
                    key={r.id}
                    r={r}
                    venue={venueLabel(r.venue_id)}
                    operator={dipendenteName(operatorById(r.created_by))}
                    onRestore={() => setConfirmRestore(r)}
                    onDelete={() => setConfirmDeleteOne(r)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageBody>
      <ConfirmDialog
        open={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        mode="restore"
        title="Ripristina movimento"
        message={
          confirmRestore
            ? `Il movimento di ${venueLabel(confirmRestore.venue_id)} tornerà immediatamente nella Cassa.`
            : ""
        }
        confirm="RIPRISTINA"
        onConfirm={() => restoreOne(confirmRestore.id)}
      />
      <ConfirmDialog
        open={!!confirmDeleteOne}
        onClose={() => setConfirmDeleteOne(null)}
        mode="delete"
        title="Elimina definitivamente"
        message={
          confirmDeleteOne
            ? `Il movimento di ${venueLabel(confirmDeleteOne.venue_id)} sarà cancellato senza possibilità di recupero.`
            : ""
        }
        confirm="ELIMINA PER SEMPRE"
        onConfirm={() => deleteOneForever(confirmDeleteOne.id)}
      />
      <ConfirmDialog
        open={confirmRestoreAll}
        onClose={() => setConfirmRestoreAll(false)}
        mode="restore"
        title="Ripristina tutti"
        message={`Verranno ripristinati tutti i ${rows.length} movimenti attualmente filtrati.`}
        confirm="RIPRISTINA TUTTI"
        onConfirm={restoreAll}
      />
      <ConfirmDialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        mode="delete"
        title="Elimina tutti definitivamente"
        message={`Stai per cancellare per sempre ${rows.length} movimenti filtrati. L’operazione non è annullabile.`}
        confirm="ELIMINA TUTTI"
        onConfirm={deleteAllForever}
      />
    </PageLayout>
  );
}

function TrashCard({ r, venue, operator, onRestore, onDelete }) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-red-200 bg-white shadow-[0_8px_25px_rgba(40,35,20,.07)]">
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
            <Trash2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-slate-950">
                  {venue}
                </h3>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                  {operator}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[8px] font-black tracking-wider text-red-600">
                CANCELLATO
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-red-400">
              <CalendarDays size={12} />
              {formatDateTime(r.deleted_at)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-red-100 bg-red-50/30">
          <Money label="ACCONTO" value={r.acconto} />
          <Money label="RECUPERO" value={r.recupero} />
          <Money label="DA RIPORTARE" value={r.da_riportare} />
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-red-100">
        <button
          onClick={onRestore}
          className="flex items-center justify-center gap-2 px-3 py-3 text-[9px] font-black text-emerald-700 transition hover:bg-emerald-50"
        >
          <Undo2 size={14} /> RIPRISTINA
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 border-l border-red-100 px-3 py-3 text-[9px] font-black text-red-600 transition hover:bg-red-50"
        >
          <Trash2 size={14} /> ELIMINA
        </button>
      </div>
    </article>
  );
}
function Money({ label, value }) {
  return (
    <div className="border-r border-red-100 px-2 py-3 text-center last:border-0">
      <p className="text-[8px] font-black tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums text-slate-800">
        {formatMoney(value)}
      </p>
    </div>
  );
}
function Stat({ value, label }) {
  return (
    <div className="border-b border-r border-amber-200/70 px-2 py-4 text-center last:border-r-0 sm:border-b-0">
      <p className="text-base font-black tabular-nums text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}
function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-black tracking-wider text-slate-400">
        {label}
      </label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function TrashSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-[24px] border border-red-100 bg-white"
        />
      ))}
    </div>
  );
}
function EmptyTrash() {
  return (
    <div className="rounded-[28px] border border-dashed border-amber-300 bg-white/70 px-5 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
        <RotateCcw size={27} />
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-900">CESTINO VUOTO</h3>
      <p className="mt-1 text-xs text-slate-500">
        Nessun movimento cancellato corrisponde ai filtri scelti.
      </p>
    </div>
  );
}

function PremiumModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  tone = "gold",
}) {
  if (!open) return null;
  const danger = tone === "red";
  const green = tone === "green";
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`my-auto w-full max-w-lg overflow-hidden rounded-[26px] border bg-[#f8f4ec] shadow-2xl ${danger ? "border-red-300" : green ? "border-emerald-300" : "border-amber-300"}`}
      >
        <header
          className={`flex items-center gap-3 p-4 ${danger ? "bg-gradient-to-r from-red-50 via-white to-red-200" : green ? "bg-gradient-to-r from-emerald-50 via-white to-emerald-200" : "bg-gradient-to-r from-[#fff9ed] via-[#eed59a] to-[#d5a539]"}`}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white/80 text-slate-800"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-4 md:p-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-black/5 bg-white p-3 md:p-4">
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
  mode,
  title,
  message,
  confirm,
  onConfirm,
}) {
  const restore = mode === "restore";
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      tone={restore ? "green" : "red"}
      title={title}
      subtitle={restore ? "Recupero sicuro" : "Operazione irreversibile"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ANNULLA
          </Button>
          <Button
            variant={restore ? "success" : "danger"}
            icon={restore ? RotateCcw : Trash2}
            onClick={onConfirm}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <div
        className={`rounded-2xl border p-4 ${restore ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
      >
        <div className="flex items-start gap-3">
          {restore ? (
            <RotateCcw className="mt-0.5 shrink-0 text-emerald-600" size={19} />
          ) : (
            <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={19} />
          )}
          <p
            className={`text-sm leading-6 ${restore ? "text-emerald-900" : "text-red-900"}`}
          >
            {message}
          </p>
        </div>
      </div>
    </PremiumModal>
  );
}
