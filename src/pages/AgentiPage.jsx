import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button, Field, Input, Select } from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { useToast } from "../components/Toast";
import { initials, avatarColor } from "../lib/helpers";

const SUPABASE_FN_URL =
  "https://ufkgncqqvqgynncswkiv.supabase.co/functions/v1/admin-update-user";
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function lastSeenInfo(value) {
  if (!value) return { online: false, label: "Mai collegato" };
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return { online: false, label: "—" };
  const diff = Date.now() - ts;
  if (diff < ONLINE_THRESHOLD_MS) return { online: true, label: "Online ora" };
  const min = Math.floor(diff / 60000);
  if (min < 60) return { online: false, label: `${min} min fa` };
  const h = Math.floor(min / 60);
  if (h < 24) return { online: false, label: `${h} h fa` };
  const g = Math.floor(h / 24);
  if (g < 7) return { online: false, label: `${g} g fa` };
  return {
    online: false,
    label: new Date(value).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
  };
}

export default function AgentiPage() {
  const toast = useToast();
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revealedPins, setRevealedPins] = useState(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [pinTarget, setPinTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
  }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("dipendenti")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) {
      toast.error(`Errore: ${error.message}`);
      setDipendenti([]);
    } else setDipendenti(data || []);
    setLoading(false);
  }
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return dipendenti;
    return dipendenti.filter((d) =>
      [d.full_name, d.email, d.role].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(s),
      ),
    );
  }, [dipendenti, search]);
  const online = dipendenti.filter(
    (d) => lastSeenInfo(d.last_seen).online,
  ).length;
  const admins = dipendenti.filter((d) => d.role === "admin").length;

  function togglePin(id) {
    setRevealedPins((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  async function callAdminFn(body) {
    const response = await fetch(SUPABASE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Errore funzione admin");
    return result;
  }
  async function handleCreate(v) {
    const full_name = String(v.full_name || "").trim();
    const result = await callAdminFn({
      action: "create_user",
      full_name,
      email: v.email,
      pin: v.pin,
      role: v.role || "operator",
    });
    setDipendenti((prev) =>
      [...prev, result.dipendente].sort((a, b) =>
        String(a.full_name || "").localeCompare(String(b.full_name || "")),
      ),
    );
    setCreateOpen(false);
    toast.success(`Dipendente "${full_name}" creato`);
  }
  async function handleEdit(v) {
    const full_name = String(v.full_name || "").trim();
    const { data, error } = await supabase
      .from("dipendenti")
      .update({ full_name, email: v.email, role: v.role || "operator" })
      .eq("id", editTarget.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setDipendenti((prev) =>
      prev.map((x) => (x.id === editTarget.id ? data : x)),
    );
    setEditTarget(null);
    toast.success("Dipendente aggiornato");
  }
  async function handleChangePin(v) {
    await callAdminFn({
      action: "update_pin",
      auth_user_id: pinTarget.auth_user_id,
      new_pin: v.pin,
    });
    setDipendenti((prev) =>
      prev.map((x) => (x.id === pinTarget.id ? { ...x, pin: v.pin } : x)),
    );
    setPinTarget(null);
    toast.success("PIN aggiornato");
  }
  async function handleDelete() {
    await callAdminFn({
      action: "delete_user",
      auth_user_id: deleteTarget.auth_user_id,
    });
    const name = deleteTarget.full_name || deleteTarget.email;
    setDipendenti((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success(`"${name}" eliminato`);
  }
  function downloadCsv() {
    const rows = [["Dipendente", "Email", "PIN", "Ruolo", "Stato"]];
    filtered.forEach((d) =>
      rows.push([
        d.full_name || "",
        d.email || "",
        d.pin || "",
        d.role || "",
        d.active ? "Attivo" : "Disattivato",
      ]),
    );
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenti_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV scaricato");
  }
  function emailList() {
    const emails = filtered
      .filter((d) => d.email)
      .map((d) => d.email)
      .join(",");
    if (!emails) return toast.warning("Nessuna email disponibile");
    window.location.href = `mailto:?bcc=${emails}`;
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
                    <Sparkles size={13} /> TEAM CONTROL
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                    AGENTI
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Account, accessi e autorizzazioni in un unico posto.
                  </p>
                </div>
                <div className="flex gap-2">
                  <RoundButton icon={RefreshCw} onClick={load} spin={loading} />
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#946000] to-[#d5a83a] px-4 text-xs font-black text-white shadow-lg"
                  >
                    <Plus size={17} /> NUOVO AGENTE
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-amber-200/70 bg-white/65">
                <Stat icon={Users} value={dipendenti.length} label="Agenti" />
                <Stat icon={Wifi} value={online} label="Online ora" green />
                <Stat
                  icon={ShieldCheck}
                  value={admins}
                  label="Amministratori"
                />
              </div>
            </header>
            <section className="rounded-[22px] border border-amber-200 bg-white p-3 shadow-sm md:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-700"
                    size={17}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cerca per nome, email o ruolo…"
                    className="h-12 w-full rounded-2xl border border-amber-200 bg-amber-50/40 pl-11 pr-10 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <ToolButton
                    icon={Download}
                    label="ESPORTA CSV"
                    onClick={downloadCsv}
                  />
                  <ToolButton
                    icon={Mail}
                    label="INVIA EMAIL"
                    onClick={emailList}
                  />
                </div>
              </div>
              {search && (
                <p className="mt-2 px-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                  {filtered.length} risultati trovati
                </p>
              )}
            </section>
            {loading ? (
              <AgentSkeleton />
            ) : filtered.length === 0 ? (
              <PremiumEmpty
                onCreate={!search ? () => setCreateOpen(true) : null}
                search={search}
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filtered.map((d) => (
                  <AgentCard
                    key={d.id}
                    d={d}
                    revealed={revealedPins.has(d.id)}
                    onToggle={() => togglePin(d.id)}
                    onEdit={() => setEditTarget(d)}
                    onPin={() => setPinTarget(d)}
                    onDelete={() => setDeleteTarget(d)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageBody>
      <AgentForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuovo agente"
        subtitle="Crea credenziali e profilo operativo"
        submit="CREA AGENTE"
        includePin
        onSubmit={handleCreate}
      />
      <AgentForm
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifica agente"
        subtitle={editTarget?.full_name}
        submit="SALVA MODIFICHE"
        initial={editTarget}
        onSubmit={handleEdit}
      />
      <PinForm
        open={!!pinTarget}
        onClose={() => setPinTarget(null)}
        target={pinTarget}
        onSubmit={handleChangePin}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Elimina agente"
        message={
          deleteTarget
            ? `Stai per eliminare definitivamente ${deleteTarget.full_name || deleteTarget.email}. L'accesso all'app verrà revocato.`
            : ""
        }
        confirm="ELIMINA AGENTE"
        onConfirm={handleDelete}
      />
    </PageLayout>
  );
}

function AgentCard({ d, revealed, onToggle, onEdit, onPin, onDelete }) {
  const ls = lastSeenInfo(d.last_seen);
  const admin = d.role === "admin";
  return (
    <article className="group overflow-hidden rounded-[24px] border border-amber-200 bg-white shadow-[0_8px_25px_rgba(40,35,20,.07)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(120,83,12,.14)]">
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black shadow-sm ${avatarColor(d.full_name || d.email || "")}`}
          >
            {initials(d.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-black text-slate-950">
                {d.full_name || "—"}
              </h3>
              {admin && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black tracking-wider text-amber-800">
                  ADMIN PLUS
                </span>
              )}
              <span
                className={`ml-auto h-2.5 w-2.5 rounded-full ${d.active ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" : "bg-slate-300"}`}
              />
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {d.email || "—"}
            </p>
            <p
              className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase ${ls.online ? "text-emerald-600" : "text-slate-400"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${ls.online ? "bg-emerald-500" : "bg-slate-300"}`}
              />
              {ls.label}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
          <div>
            <p className="text-[8px] font-black tracking-[.16em] text-amber-700">
              PIN DI ACCESSO
            </p>
            <p className="mt-0.5 font-mono text-sm font-black tracking-[.22em] text-slate-800">
              {revealed ? d.pin || "—" : "••••"}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white text-amber-700 shadow-sm"
          >
            {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-amber-100 bg-amber-50/30">
        <CardAction icon={Pencil} label="MODIFICA" onClick={onEdit} />
        <CardAction icon={KeyRound} label="CAMBIA PIN" onClick={onPin} />
        <CardAction icon={Trash2} label="ELIMINA" danger onClick={onDelete} />
      </div>
    </article>
  );
}
function CardAction({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 border-r border-amber-100 px-2 py-3 text-[9px] font-black transition last:border-0 ${danger ? "text-red-600 hover:bg-red-50" : "text-amber-800 hover:bg-amber-50"}`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
function Stat({ icon: Icon, value, label, green }) {
  return (
    <div className="flex items-center justify-center gap-2 border-r border-amber-200/70 px-2 py-4 last:border-0">
      <Icon
        size={16}
        className={green ? "text-emerald-600" : "text-amber-700"}
      />
      <div>
        <p
          className={`text-lg font-black leading-none ${green ? "text-emerald-600" : "text-slate-950"}`}
        >
          {value}
        </p>
        <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>
      </div>
    </div>
  );
}
function RoundButton({ icon: Icon, onClick, spin }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-200 bg-white text-amber-800 shadow-sm"
    >
      <Icon size={18} className={spin ? "animate-spin" : ""} />
    </button>
  );
}
function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-[9px] font-black text-amber-800 transition hover:bg-amber-50 md:flex-none"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
function AgentSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-[24px] border border-amber-100 bg-white"
        />
      ))}
    </div>
  );
}
function PremiumEmpty({ onCreate, search }) {
  return (
    <div className="rounded-[26px] border border-dashed border-amber-300 bg-white/70 px-5 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
        <Users size={24} />
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-900">Nessun agente</h3>
      <p className="mt-1 text-xs text-slate-500">
        {search
          ? `Nessun risultato per “${search}”.`
          : "Crea il primo profilo operativo."}
      </p>
      {onCreate && (
        <button
          onClick={onCreate}
          className="mt-4 rounded-xl bg-amber-700 px-4 py-2 text-[10px] font-black text-white"
        >
          NUOVO AGENTE
        </button>
      )}
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
            <h2 className="text-base font-black text-slate-950">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-amber-900/70">
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
function AgentForm({
  open,
  onClose,
  title,
  subtitle,
  submit,
  includePin,
  initial,
  onSubmit,
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    pin: "",
    role: "operator",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open)
      setForm({
        full_name: initial?.full_name || "",
        email: initial?.email || "",
        pin: "",
        role: initial?.role || "operator",
      });
  }, [open, initial]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  async function save() {
    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      (includePin && !/^\d{4}$/.test(form.pin))
    )
      return;
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ANNULLA
          </Button>
          <Button
            variant="primary"
            icon={UserCheck}
            disabled={busy}
            onClick={save}
          >
            {busy ? "ATTENDI…" : submit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome completo" required>
          <Input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value.toUpperCase())}
            placeholder="MARIO ROSSI"
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="mario@playmoney.com"
          />
        </Field>
        {includePin && (
          <Field label="PIN di accesso" required>
            <Input
              inputMode="numeric"
              maxLength={4}
              value={form.pin}
              onChange={(e) =>
                set("pin", e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="4 cifre"
            />
          </Field>
        )}
        <Field label="Ruolo">
          <Select
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          >
            <option value="operator">Operatore</option>
            <option value="admin">Admin (+Plus)</option>
          </Select>
        </Field>
      </div>
    </PremiumModal>
  );
}
function PinForm({ open, onClose, target, onSubmit }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPin("");
  }, [open]);
  async function save() {
    if (!/^\d{4}$/.test(pin)) return;
    setBusy(true);
    try {
      await onSubmit({ pin });
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Cambia PIN"
      subtitle={target?.full_name || target?.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ANNULLA
          </Button>
          <Button
            variant="primary"
            icon={KeyRound}
            disabled={busy || pin.length !== 4}
            onClick={save}
          >
            AGGIORNA PIN
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-amber-200 bg-white p-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
          Nuovo PIN di accesso
        </p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          className="mt-4 h-16 w-44 rounded-2xl border border-amber-300 bg-amber-50 text-center font-mono text-3xl font-black tracking-[.35em] outline-none focus:ring-4 focus:ring-amber-100"
          placeholder="••••"
        />
        <p className="mt-3 text-xs text-slate-500">
          Inserisci esattamente quattro cifre.
        </p>
      </div>
    </PremiumModal>
  );
}
function ConfirmDialog({ open, onClose, title, message, confirm, onConfirm }) {
  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Operazione irreversibile"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ANNULLA
          </Button>
          <Button variant="danger" icon={Trash2} onClick={onConfirm}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm leading-6 text-red-900">{message}</p>
      </div>
    </PremiumModal>
  );
}
