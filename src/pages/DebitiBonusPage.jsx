import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Building2,
  Gift,
  Wallet,
  ChevronDown,
  ChevronUp,
  Banknote,
  Landmark,
  CheckCircle2,
  MinusCircle,
  Pause,
  Play,
  StickyNote,
  Infinity as InfinityIcon,
  Pencil,
  Sparkles,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  Button,
  IconButton,
  Input,
  Select,
  Badge,
  EmptyState,
  Field,
  Textarea,
} from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { useToast } from "../components/Toast";
import { venueSortFn } from "../lib/helpers";

const fmtEuro = (n) =>
  `${Math.trunc(Number(n) || 0).toLocaleString("it-IT")} €`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const formatITDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
const formatITDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const PERIODICITA_LABEL = {
  ogni_conteggio: "Ogni conteggio",
  ogni_fine_mese: "Ogni fine mese",
};

function Modal({ open, onClose, title, width = "md", footer, children }) {
  if (!open) return null;
  const maxWidth =
    width === "lg"
      ? "max-w-[760px]"
      : width === "sm"
        ? "max-w-[440px]"
        : "max-w-[600px]";
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-[#120d05]/70 p-3 backdrop-blur-md"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <section
        className={`flex max-h-[94vh] w-full ${maxWidth} flex-col overflow-hidden rounded-[30px] border border-[#d5b66c] bg-[#fffdf9] shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#3f2908_0%,#895912_58%,#c89532_100%)] px-5 py-6 text-white">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl" />
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            className="absolute right-3 top-3 z-50 flex h-10 w-10 select-none items-center justify-center rounded-[12px] border border-white/25 bg-black/20 text-[25px] font-light leading-none text-white shadow-lg active:scale-90"
            aria-label="Chiudi popup"
          >
            <span className="pointer-events-none -mt-0.5">×</span>
          </button>
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/20 bg-white/10">
              <Sparkles size={24} />
            </span>
            <div>
              <p className="text-[9px] font-black tracking-[.25em] text-amber-200">
                GESTIONE PREMIUM
              </p>
              <h2 className="mt-1 text-[22px] font-black uppercase tracking-[.08em]">
                {title}
              </h2>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#e5d7bb] bg-[#faf2e2] p-3">
            {footer}
          </div>
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
  confirmLabel = "CONFERMA",
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[13px] border border-[#d8c8a8] bg-white px-5 text-[10px] font-black text-slate-500"
          >
            ANNULLA
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-[13px] bg-[linear-gradient(135deg,#b42323,#711010)] px-5 text-[10px] font-black tracking-[.08em] text-white shadow-lg"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-[12px] font-bold leading-relaxed text-red-900">
        {message}
      </div>
    </Modal>
  );
}

export default function DebitiBonusPage() {
  const toast = useToast();
  const [tab, setTab] = useState("debiti");

  const [venues, setVenues] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [debiti, setDebiti] = useState([]);
  const [bonus, setBonus] = useState([]);
  const [note, setNote] = useState([]);
  const [movByDebito, setMovByDebito] = useState({});
  const [loading, setLoading] = useState(false);

  const [showNewDebito, setShowNewDebito] = useState(false);
  const [showNewBonus, setShowNewBonus] = useState(false);
  const [showNewNota, setShowNewNota] = useState(false);
  const [detailDebito, setDetailDebito] = useState(null);
  const [manualDeduct, setManualDeduct] = useState(null); // debito su cui registrare decurtazione
  const [manualAmount, setManualAmount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind, row }
  const [editItem, setEditItem] = useState(null); // { kind, row }

  const venueById = useMemo(() => {
    const map = {};
    venues.forEach((v) => {
      map[String(v.id)] = v;
    });
    return map;
  }, [venues]);

  function venueLabel(venueId) {
    const v = venueById[String(venueId)];
    if (!v) return venueId || "—";
    const id = String(v.id || "").trim();
    const name = String(v.name || "").trim();
    if (name.toLowerCase().startsWith(id.toLowerCase())) return name;
    return `${id} ${name}`;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [
        { data: venuesData },
        { data: dipData },
        { data: debitiData },
        { data: bonusData },
        { data: noteData },
      ] = await Promise.all([
        supabase.from("venues").select("*"),
        supabase.from("dipendenti").select("*"),
        supabase
          .from("debiti")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("bonus")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("note_generiche")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      setVenues([...(venuesData || [])].sort(venueSortFn));
      setDipendenti(dipData || []);
      setDebiti(debitiData || []);
      setBonus(bonusData || []);
      setNote(noteData || []);
    } catch (e) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function loadMovimenti(debitoId) {
    const { data, error } = await supabase
      .from("debiti_movimenti")
      .select("*")
      .eq("debito_id", debitoId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMovByDebito((prev) => ({ ...prev, [debitoId]: data || [] }));
  }

  function openDebitoDetail(d) {
    setDetailDebito(d);
    loadMovimenti(d.id);
  }

  // ─── CREATE DEBITO ──────────────────────────────────────────────
  async function createDebito(form) {
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const importo = Math.trunc(Number(form.importo_iniziale) || 0);
    if (importo <= 0) return toast.warning("Inserisci un importo valido");
    if (form.modalita === "contanti") {
      if (!form.periodicita) return toast.warning("Scegli la periodicità");
      if (!form.rata_tipo) return toast.warning("Scegli il tipo di rata");
      if (form.rata_tipo === "fisso" && !(Number(form.rata_importo) > 0))
        return toast.warning("Inserisci l'importo della rata");
    }
    // blocca due debiti attivi sullo stesso locale
    if (
      debiti.some(
        (d) =>
          d.status === "attivo" && String(d.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già un debito attivo");

    const payload = {
      venue_id: form.venue_id,
      agent_id: null,
      agent_name: null,
      importo_iniziale: importo,
      residuo: importo,
      modalita: form.modalita,
      periodicita: form.modalita === "contanti" ? form.periodicita : null,
      rata_tipo: form.modalita === "contanti" ? form.rata_tipo : null,
      rata_importo:
        form.modalita === "contanti" && form.rata_tipo === "fisso"
          ? Math.trunc(Number(form.rata_importo) || 0)
          : null,
      status: "attivo",
      note: form.note?.trim() || null,
    };
    const { error } = await supabase.from("debiti").insert(payload);
    if (error) return toast.error(error.message);
    setShowNewDebito(false);
    toast.success("Debito creato");
    loadAll();
  }

  // ─── DECURTAZIONE MANUALE ───────────────────────────────────────
  async function applyManualDeduct() {
    const d = manualDeduct;
    if (!d) return;
    const importo = Math.trunc(Number(manualAmount) || 0);
    if (importo <= 0) return toast.warning("Inserisci un importo valido");
    const residuoPrima = Math.trunc(Number(d.residuo) || 0);
    const residuoDopo = Math.max(0, residuoPrima - importo);

    const { error: movErr } = await supabase.from("debiti_movimenti").insert({
      debito_id: d.id,
      venue_id: d.venue_id,
      data: todayKey(),
      operator_name: "ADMIN",
      importo,
      residuo_prima: residuoPrima,
      residuo_dopo: residuoDopo,
      origine: "manuale",
      note: "Decurtazione manuale da admin",
    });
    if (movErr) return toast.error(movErr.message);

    const { error: updErr } = await supabase
      .from("debiti")
      .update({
        residuo: residuoDopo,
        status: residuoDopo <= 0 ? "estinto" : d.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    if (updErr) return toast.error(updErr.message);

    setManualDeduct(null);
    setManualAmount("");
    toast.success("Decurtazione registrata");
    await loadAll();
    if (detailDebito?.id === d.id) {
      loadMovimenti(d.id);
      setDetailDebito((prev) =>
        prev ? { ...prev, residuo: residuoDopo } : prev,
      );
    }
  }

  async function setDebitoStatus(d, status) {
    const { error } = await supabase
      .from("debiti")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success(
      status === "estinto"
        ? "Debito segnato come estinto"
        : "Debito aggiornato",
    );
    loadAll();
  }

  // ─── BONUS ──────────────────────────────────────────────────────
  async function createBonus(form) {
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const importo = Math.trunc(Number(form.importo) || 0);
    if (importo <= 0) return toast.warning("Inserisci un importo valido");
    if (!form.periodicita) return toast.warning("Scegli la periodicità");
    if (
      bonus.some(
        (b) =>
          b.status === "attivo" && String(b.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già un bonus attivo");

    const dip = dipendenti.find(
      (x) => String(x.auth_user_id) === String(form.agent_id),
    );
    const { error } = await supabase.from("bonus").insert({
      venue_id: form.venue_id,
      agent_id: form.agent_id || null,
      agent_name: dip?.full_name || null,
      importo,
      periodicita: form.periodicita,
      status: "attivo",
      note: form.note?.trim() || null,
    });
    if (error) return toast.error(error.message);
    setShowNewBonus(false);
    toast.success("Bonus creato");
    loadAll();
  }

  async function toggleBonus(b) {
    const next = b.status === "attivo" ? "sospeso" : "attivo";
    if (
      next === "attivo" &&
      bonus.some(
        (x) =>
          x.id !== b.id &&
          x.status === "attivo" &&
          String(x.venue_id) === String(b.venue_id),
      )
    )
      return toast.error("Questo locale ha già un altro bonus attivo");
    const { error } = await supabase
      .from("bonus")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success(next === "attivo" ? "Bonus riattivato" : "Bonus sospeso");
    loadAll();
  }

  // ─── NOTE GENERICHE ─────────────────────────────────────────────
  async function createNota(form) {
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const testo = (form.testo || "").trim();
    if (!testo) return toast.warning("Scrivi il testo della nota");

    let conteggiTotali = null;
    let conteggiRimasti = null;
    if (!form.sempre) {
      conteggiTotali = Math.trunc(Number(form.conteggi_totali) || 0);
      if (conteggiTotali <= 0)
        return toast.warning("Indica per quanti conteggi (almeno 1)");
      conteggiRimasti = conteggiTotali;
    }

    if (
      note.some(
        (n) =>
          n.status === "attiva" && String(n.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già una nota attiva");

    const { error } = await supabase.from("note_generiche").insert({
      venue_id: form.venue_id,
      testo,
      conteggi_totali: conteggiTotali,
      conteggi_rimasti: conteggiRimasti,
      status: "attiva",
    });
    if (error) return toast.error(error.message);
    setShowNewNota(false);
    toast.success("Nota creata");
    loadAll();
  }

  async function setNotaStatus(n, status) {
    const { error } = await supabase
      .from("note_generiche")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", n.id);
    if (error) return toast.error(error.message);
    toast.success(status === "attiva" ? "Nota riattivata" : "Nota chiusa");
    loadAll();
  }

  // ─── MODIFICA DEBITO / BONUS / NOTA ───────────────────────────
  async function updateDebito(row, form) {
    if (!row) return;
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const importoIniziale = Math.trunc(Number(form.importo_iniziale) || 0);
    if (importoIniziale <= 0)
      return toast.warning("Inserisci un importo valido");
    if (form.modalita === "contanti") {
      if (!form.periodicita) return toast.warning("Scegli la periodicità");
      if (!form.rata_tipo) return toast.warning("Scegli il tipo di rata");
      if (form.rata_tipo === "fisso" && !(Number(form.rata_importo) > 0))
        return toast.warning("Inserisci l'importo della rata");
    }

    const vecchioIniziale = Math.trunc(Number(row.importo_iniziale) || 0);
    const vecchioResiduo = Math.trunc(Number(row.residuo) || 0);
    const giaScalato = Math.max(0, vecchioIniziale - vecchioResiduo);
    const nuovoResiduo = Math.max(0, importoIniziale - giaScalato);
    const { error } = await supabase
      .from("debiti")
      .update({
        venue_id: form.venue_id,
        agent_id: null,
        agent_name: null,
        importo_iniziale: importoIniziale,
        residuo: nuovoResiduo,
        modalita: form.modalita,
        periodicita: form.modalita === "contanti" ? form.periodicita : null,
        rata_tipo: form.modalita === "contanti" ? form.rata_tipo : null,
        rata_importo:
          form.modalita === "contanti" && form.rata_tipo === "fisso"
            ? Math.trunc(Number(form.rata_importo) || 0)
            : null,
        status:
          nuovoResiduo <= 0
            ? "estinto"
            : row.status === "estinto"
              ? "attivo"
              : row.status,
        note: form.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);

    setEditItem(null);
    toast.success("Debito modificato");
    await loadAll();
    if (detailDebito?.id === row.id) {
      setDetailDebito((prev) =>
        prev
          ? {
              ...prev,
              importo_iniziale: importoIniziale,
              residuo: nuovoResiduo,
              venue_id: form.venue_id,
              agent_id: null,
              agent_name: null,
              modalita: form.modalita,
              periodicita:
                form.modalita === "contanti" ? form.periodicita : null,
              rata_tipo: form.modalita === "contanti" ? form.rata_tipo : null,
              rata_importo:
                form.modalita === "contanti" && form.rata_tipo === "fisso"
                  ? Math.trunc(Number(form.rata_importo) || 0)
                  : null,
              status:
                nuovoResiduo <= 0
                  ? "estinto"
                  : row.status === "estinto"
                    ? "attivo"
                    : row.status,
              note: form.note?.trim() || null,
            }
          : prev,
      );
    }
  }

  async function updateBonus(row, form) {
    if (!row) return;
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const importo = Math.trunc(Number(form.importo) || 0);
    if (importo <= 0) return toast.warning("Inserisci un importo valido");
    if (!form.periodicita) return toast.warning("Scegli la periodicità");
    if (
      row.status === "attivo" &&
      bonus.some(
        (b) =>
          b.id !== row.id &&
          b.status === "attivo" &&
          String(b.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già un altro bonus attivo");

    const dip = dipendenti.find(
      (x) => String(x.auth_user_id) === String(form.agent_id),
    );
    const { error } = await supabase
      .from("bonus")
      .update({
        venue_id: form.venue_id,
        agent_id: form.agent_id || null,
        agent_name: dip?.full_name || null,
        importo,
        periodicita: form.periodicita,
        note: form.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    setEditItem(null);
    toast.success("Bonus modificato");
    loadAll();
  }

  async function updateNota(row, form) {
    if (!row) return;
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const testo = (form.testo || "").trim();
    if (!testo) return toast.warning("Scrivi il testo della nota");

    let conteggiTotali = null;
    let conteggiRimasti = null;
    if (!form.sempre) {
      conteggiTotali = Math.trunc(Number(form.conteggi_totali) || 0);
      if (conteggiTotali <= 0)
        return toast.warning("Indica per quanti conteggi (almeno 1)");
      const vecchiTotali = Math.trunc(Number(row.conteggi_totali) || 0);
      const vecchiRimasti = Math.trunc(Number(row.conteggi_rimasti) || 0);
      const giaConsumati =
        vecchiTotali > 0 ? Math.max(0, vecchiTotali - vecchiRimasti) : 0;
      conteggiRimasti = Math.max(0, conteggiTotali - giaConsumati);
    }

    const { error } = await supabase
      .from("note_generiche")
      .update({
        venue_id: form.venue_id,
        testo,
        conteggi_totali: conteggiTotali,
        conteggi_rimasti: conteggiRimasti,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    setEditItem(null);
    toast.success("Nota modificata");
    loadAll();
  }

  // ─── DELETE ─────────────────────────────────────────────────────
  async function doDelete() {
    const c = confirmDelete;
    if (!c) return;
    const table =
      c.kind === "debito"
        ? "debiti"
        : c.kind === "bonus"
          ? "bonus"
          : "note_generiche";
    const { error } = await supabase.from(table).delete().eq("id", c.row.id);
    if (error) return toast.error(error.message);
    setConfirmDelete(null);
    if (c.kind === "debito" && detailDebito?.id === c.row.id)
      setDetailDebito(null);
    toast.success("Eliminato");
    loadAll();
  }

  const debitiAttivi = debiti.filter((d) => d.status === "attivo");
  const debitiChiusi = debiti.filter((d) => d.status !== "attivo");
  const debitoResiduoTotale = debitiAttivi.reduce(
    (sum, d) => sum + Math.trunc(Number(d.residuo) || 0),
    0,
  );
  const bonusAttivi = bonus.filter((b) => b.status === "attivo");
  const noteAttive = note.filter((n) => n.status === "attiva");

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_12%_0%,rgba(226,186,99,.18),transparent_27%),linear-gradient(180deg,#f7f2e8,#f3eee5)] px-3 py-3 md:px-5 md:py-5">
          <div className="mx-auto max-w-[1280px] space-y-4">
            <section className="relative overflow-hidden rounded-[30px] border border-[#d6b76c] bg-[linear-gradient(135deg,#fffdf8,#efd79c)] p-5 shadow-[0_25px_60px_-38px_rgba(72,43,3,.8)] md:p-7">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[9px] font-black tracking-[.25em] text-[#9b6a19]">
                    GESTIONE FINANZIARIA
                  </p>
                  <h1 className="mt-1 text-[27px] font-black tracking-[.12em] text-[#3d2a0b] md:text-[34px]">
                    DEBITI, BONUS E NOTE
                  </h1>
                  <p className="mt-2 text-[11px] font-bold text-[#76521b]">
                    Controllo completo delle posizioni operative dei locali.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadAll}
                    className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-[#d0b16c] bg-white/75 text-[#775016]"
                  >
                    <RefreshCw
                      size={17}
                      className={loading ? "animate-spin" : ""}
                    />
                  </button>
                  <button
                    onClick={() =>
                      tab === "debiti"
                        ? setShowNewDebito(true)
                        : tab === "bonus"
                          ? setShowNewBonus(true)
                          : setShowNewNota(true)
                    }
                    className="flex h-12 items-center gap-2 rounded-[15px] bg-[linear-gradient(135deg,#a97218,#70490d)] px-5 text-[10px] font-black tracking-[.1em] text-white shadow-lg"
                  >
                    <Plus size={15} /> NUOVO
                  </button>
                </div>
              </div>
              <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[18px] border border-red-200/70 bg-white/75 p-4">
                  <p className="text-[9px] font-black tracking-[.15em] text-red-600">
                    DEBITO RESIDUO
                  </p>
                  <p className="mt-1 text-[23px] font-black text-red-800">
                    {fmtEuro(debitoResiduoTotale)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-emerald-200/70 bg-white/75 p-4">
                  <p className="text-[9px] font-black tracking-[.15em] text-emerald-600">
                    BONUS ATTIVI
                  </p>
                  <p className="mt-1 text-[23px] font-black text-emerald-800">
                    {bonusAttivi.length}
                  </p>
                </div>
                <div className="rounded-[18px] border border-amber-200/70 bg-white/75 p-4">
                  <p className="text-[9px] font-black tracking-[.15em] text-amber-700">
                    NOTE ATTIVE
                  </p>
                  <p className="mt-1 text-[23px] font-black text-amber-900">
                    {noteAttive.length}
                  </p>
                </div>
              </div>
            </section>
            <section className="grid grid-cols-3 gap-2 rounded-[22px] border border-[#dfcfaa] bg-[#fffdf9] p-2 shadow-sm">
              {[
                {
                  id: "debiti",
                  label: "DEBITI",
                  count: debitiAttivi.length,
                  tone: "red",
                },
                {
                  id: "bonus",
                  label: "BONUS",
                  count: bonusAttivi.length,
                  tone: "emerald",
                },
                {
                  id: "note",
                  label: "NOTE",
                  count: noteAttive.length,
                  tone: "amber",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`min-h-[64px] rounded-[16px] border px-2 transition ${tab === item.id ? "border-[#9f6c13] bg-[linear-gradient(135deg,#4a3009,#a87318)] text-white shadow-lg" : "border-transparent bg-[#faf3e4] text-[#6e4a12] hover:border-[#d7bd82]"}`}
                >
                  <span className="block text-[10px] font-black tracking-[.14em]">
                    {item.label}
                  </span>
                  <span
                    className={`mt-1 block text-[18px] font-black ${tab === item.id ? "text-white" : "text-[#3d2a0b]"}`}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
            </section>

            {tab === "debiti" && (
              <div className="space-y-3">
                {debitiAttivi.length === 0 && debitiChiusi.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="Nessun debito"
                    description="Crea un nuovo debito per un locale."
                  />
                ) : (
                  <>
                    {debitiAttivi.map((d) => (
                      <DebitoCard
                        key={d.id}
                        d={d}
                        venueLabel={venueLabel}
                        onOpen={() => openDebitoDetail(d)}
                        onDeduct={() => {
                          setManualDeduct(d);
                          setManualAmount("");
                        }}
                        onEdit={() => setEditItem({ kind: "debito", row: d })}
                        onDelete={() =>
                          setConfirmDelete({ kind: "debito", row: d })
                        }
                      />
                    ))}
                    {debitiChiusi.length > 0 && (
                      <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Estinti / annullati
                      </p>
                    )}
                    {debitiChiusi.map((d) => (
                      <DebitoCard
                        key={d.id}
                        d={d}
                        venueLabel={venueLabel}
                        closed
                        onOpen={() => openDebitoDetail(d)}
                        onEdit={() => setEditItem({ kind: "debito", row: d })}
                        onDelete={() =>
                          setConfirmDelete({ kind: "debito", row: d })
                        }
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {tab === "bonus" && (
              <div className="space-y-3">
                {bonus.length === 0 ? (
                  <EmptyState
                    icon={Gift}
                    title="Nessun bonus"
                    description="Crea un nuovo bonus per un locale."
                  />
                ) : (
                  bonus.map((b) => (
                    <BonusCard
                      key={b.id}
                      b={b}
                      venueLabel={venueLabel}
                      onToggle={() => toggleBonus(b)}
                      onEdit={() => setEditItem({ kind: "bonus", row: b })}
                      onDelete={() =>
                        setConfirmDelete({ kind: "bonus", row: b })
                      }
                    />
                  ))
                )}
              </div>
            )}

            {tab === "note" && (
              <div className="space-y-3">
                {note.length === 0 ? (
                  <EmptyState
                    icon={StickyNote}
                    title="Nessuna nota"
                    description="Crea una nota generica da mostrare sul conteggio di un locale."
                  />
                ) : (
                  note.map((n) => (
                    <NotaCard
                      key={n.id}
                      n={n}
                      venueLabel={venueLabel}
                      onToggle={() =>
                        setNotaStatus(
                          n,
                          n.status === "attiva" ? "chiusa" : "attiva",
                        )
                      }
                      onEdit={() => setEditItem({ kind: "nota", row: n })}
                      onDelete={() =>
                        setConfirmDelete({ kind: "nota", row: n })
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </PageBody>

      {/* NUOVO DEBITO */}
      <NewDebitoModal
        open={showNewDebito}
        onClose={() => setShowNewDebito(false)}
        venues={venues}
        onCreate={createDebito}
      />

      {/* NUOVO BONUS */}
      <NewBonusModal
        open={showNewBonus}
        onClose={() => setShowNewBonus(false)}
        venues={venues}
        dipendenti={dipendenti}
        onCreate={createBonus}
      />

      {/* NUOVA NOTA */}
      <NewNotaModal
        open={showNewNota}
        onClose={() => setShowNewNota(false)}
        venues={venues}
        onCreate={createNota}
      />

      {/* DETTAGLIO DEBITO */}
      <Modal
        open={!!detailDebito}
        onClose={() => setDetailDebito(null)}
        title="Dettaglio debito"
        width="lg"
      >
        {detailDebito && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {venueLabel(detailDebito.venue_id)}
                </p>
                <h3 className="text-[18px] font-semibold">
                  {fmtEuro(detailDebito.residuo)}{" "}
                  <span className="text-[12px] font-normal text-[var(--color-text-muted)]">
                    residuo su {fmtEuro(detailDebito.importo_iniziale)}
                  </span>
                </h3>
              </div>
              <DebitoModeBadge d={detailDebito} />
            </div>

            <div className="flex flex-wrap gap-2">
              {detailDebito.status === "attivo" && (
                <>
                  <Button
                    icon={MinusCircle}
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setManualDeduct(detailDebito);
                      setManualAmount("");
                    }}
                  >
                    Registra decurtazione
                  </Button>
                  <Button
                    icon={CheckCircle2}
                    size="sm"
                    variant="success"
                    onClick={() => setDebitoStatus(detailDebito, "estinto")}
                  >
                    Segna estinto
                  </Button>
                </>
              )}
              <Button
                icon={Trash2}
                size="sm"
                variant="danger"
                onClick={() =>
                  setConfirmDelete({ kind: "debito", row: detailDebito })
                }
              >
                Elimina
              </Button>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Movimenti
              </p>
              <div className="space-y-2">
                {(movByDebito[detailDebito.id] || []).length === 0 ? (
                  <p className="text-[13px] text-[var(--color-text-muted)]">
                    Nessuna decurtazione registrata.
                  </p>
                ) : (
                  (movByDebito[detailDebito.id] || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">
                          − {fmtEuro(m.importo)}
                          {m.origine === "manuale" && (
                            <span className="ml-2 text-[10px] uppercase text-[var(--color-text-muted)]">
                              manuale
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          {formatITDate(m.data)} · {m.operator_name || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--color-text-secondary)]">
                        residuo {fmtEuro(m.residuo_dopo)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* DECURTAZIONE MANUALE */}
      <Modal
        open={!!manualDeduct}
        onClose={() => setManualDeduct(null)}
        title="Registra decurtazione"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManualDeduct(null)}>
              Annulla
            </Button>
            <Button variant="primary" onClick={applyManualDeduct}>
              Registra
            </Button>
          </>
        }
      >
        {manualDeduct && (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {venueLabel(manualDeduct.venue_id)} · residuo attuale{" "}
              <strong>{fmtEuro(manualDeduct.residuo)}</strong>
            </p>
            <Field label="Importo da scalare (€)">
              <Input
                type="number"
                inputMode="numeric"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="es. 250"
                autoFocus
              />
            </Field>
          </div>
        )}
      </Modal>

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        venues={venues}
        dipendenti={dipendenti}
        onSaveDebito={updateDebito}
        onSaveBonus={updateBonus}
        onSaveNota={updateNota}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={
          confirmDelete?.kind === "debito"
            ? "Elimina debito"
            : confirmDelete?.kind === "bonus"
              ? "Elimina bonus"
              : "Elimina nota"
        }
        message="L'operazione eliminerà anche lo storico collegato e non è reversibile. Procedere?"
        confirmLabel="Elimina"
        onConfirm={doDelete}
      />
    </PageLayout>
  );
}

// ════════════════════════════════════════════════════════════════
// SOTTO-COMPONENTI
// ════════════════════════════════════════════════════════════════

function DebitoModeBadge({ d }) {
  if (d.modalita === "bonifico") {
    return (
      <Badge variant="info" size="sm">
        <Landmark size={11} /> Bonifico
      </Badge>
    );
  }
  return (
    <Badge variant="warning" size="sm">
      <Banknote size={11} /> Contanti
    </Badge>
  );
}

function DebitoCard({
  d,
  venueLabel,
  onOpen,
  onDeduct,
  onEdit,
  onDelete,
  closed = false,
}) {
  const iniziale = Math.trunc(Number(d.importo_iniziale) || 0);
  const residuo = Math.trunc(Number(d.residuo) || 0);
  const pct =
    iniziale > 0
      ? Math.min(100, Math.round(((iniziale - residuo) / iniziale) * 100))
      : 0;
  const rataLabel =
    d.modalita === "contanti"
      ? d.rata_tipo === "tutto_aggio"
        ? "Tutto aggio"
        : `Rata ${fmtEuro(d.rata_importo)}`
      : "Bonifico";

  return (
    <article
      className={`overflow-hidden rounded-[22px] border bg-[#fffdf9] shadow-[0_18px_38px_-32px_rgba(70,42,3,.75)] transition hover:-translate-y-0.5 ${closed ? "border-slate-200" : "border-red-200"}`}
    >
      <div className={`p-3 md:p-4 ${closed ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-2">
              <Building2
                size={14}
                className="shrink-0 text-[var(--color-text-muted)]"
              />
              <p className="truncate text-[14px] font-semibold">
                {venueLabel(d.venue_id)}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {rataLabel}
              {d.modalita === "contanti" && d.periodicita
                ? ` · ${PERIODICITA_LABEL[d.periodicita]}`
                : ""}
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {closed ? (
              <Badge
                variant={d.status === "estinto" ? "success" : "default"}
                size="sm"
              >
                {d.status}
              </Badge>
            ) : (
              <DebitoModeBadge d={d} />
            )}
            {!closed && onDeduct && (
              <IconButton
                icon={MinusCircle}
                variant="accent"
                onClick={onDeduct}
                title="Registra decurtazione"
              />
            )}
            <IconButton
              icon={Pencil}
              variant="accent"
              onClick={onEdit}
              title="Modifica"
            />
            <IconButton
              icon={Trash2}
              variant="danger"
              onClick={onDelete}
              title="Elimina"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-3 block w-full text-left"
        >
          <div className="flex items-end justify-between">
            <p className="text-[20px] font-extrabold tabular-nums text-[var(--color-danger)]">
              {fmtEuro(residuo)}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              su {fmtEuro(iniziale)}
            </p>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
            <div
              className="h-full rounded-full bg-[var(--color-success)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
            {pct}% rimborsato
          </p>
        </button>
      </div>
    </article>
  );
}

function BonusCard({ b, venueLabel, onToggle, onEdit, onDelete }) {
  const attivo = b.status === "attivo";
  return (
    <article className="overflow-hidden rounded-[22px] border border-emerald-200 bg-[#fffdf9] shadow-[0_18px_38px_-32px_rgba(6,95,70,.55)] transition hover:-translate-y-0.5">
      <div
        className={`flex items-center justify-between gap-3 p-3 md:p-4 ${attivo ? "" : "opacity-70"}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gift
              size={14}
              className="shrink-0 text-[var(--color-text-muted)]"
            />
            <p className="truncate text-[14px] font-semibold">
              {venueLabel(b.venue_id)}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {PERIODICITA_LABEL[b.periodicita]}
            {b.agent_name ? ` · ${b.agent_name}` : ""}
          </p>
          <p className="mt-1 text-[20px] font-extrabold tabular-nums text-[var(--color-success)]">
            {fmtEuro(b.importo)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={attivo ? "success" : "default"} size="sm">
            {attivo ? "Attivo" : "Sospeso"}
          </Badge>
          <IconButton
            icon={attivo ? Pause : Play}
            variant="accent"
            onClick={onToggle}
            title={attivo ? "Sospendi" : "Riattiva"}
          />
          <IconButton
            icon={Pencil}
            variant="accent"
            onClick={onEdit}
            title="Modifica"
          />
          <IconButton
            icon={Trash2}
            variant="danger"
            onClick={onDelete}
            title="Elimina"
          />
        </div>
      </div>
    </article>
  );
}

function NotaCard({ n, venueLabel, onToggle, onEdit, onDelete }) {
  const attiva = n.status === "attiva";
  const sempre = n.conteggi_totali == null;
  return (
    <article className="overflow-hidden rounded-[22px] border border-amber-200 bg-[#fffdf9] shadow-[0_18px_38px_-32px_rgba(120,77,8,.6)] transition hover:-translate-y-0.5">
      <div className={`p-3 md:p-4 ${attiva ? "" : "opacity-70"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StickyNote
                size={14}
                className="shrink-0 text-[var(--color-text-muted)]"
              />
              <p className="truncate text-[14px] font-semibold">
                {venueLabel(n.venue_id)}
              </p>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-[var(--color-text)]">
              {n.testo}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={attiva ? "warning" : "default"} size="sm">
              {attiva ? "Attiva" : "Chiusa"}
            </Badge>
            <IconButton
              icon={attiva ? Pause : Play}
              variant="accent"
              onClick={onToggle}
              title={attiva ? "Chiudi" : "Riattiva"}
            />
            <IconButton
              icon={Pencil}
              variant="accent"
              onClick={onEdit}
              title="Modifica"
            />
            <IconButton
              icon={Trash2}
              variant="danger"
              onClick={onDelete}
              title="Elimina"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          {sempre ? (
            <>
              <InfinityIcon size={13} /> Sempre attiva
            </>
          ) : (
            <>
              Compare per {n.conteggi_rimasti}/{n.conteggi_totali} conteggi
              rimanenti
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function NewDebitoModal({ open, onClose, venues, onCreate }) {
  const [form, setForm] = useState({
    venue_id: "",
    importo_iniziale: "",
    modalita: "contanti",
    periodicita: "ogni_conteggio",
    rata_tipo: "fisso",
    rata_importo: "",
    note: "",
  });
  useEffect(() => {
    if (open)
      setForm({
        venue_id: "",
        importo_iniziale: "",
        modalita: "contanti",
        periodicita: "ogni_conteggio",
        rata_tipo: "fisso",
        rata_importo: "",
        note: "",
      });
  }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isContanti = form.modalita === "contanti";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo debito"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Crea debito
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Importo debito (€)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo_iniziale}
            onChange={(e) => set("importo_iniziale", e.target.value)}
            placeholder="es. 10000"
          />
        </Field>

        <Field label="Modalità di rimborso" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={isContanti}
              onClick={() => set("modalita", "contanti")}
              icon={Banknote}
              label="Contanti"
            />
            <ChoiceChip
              active={!isContanti}
              onClick={() => set("modalita", "bonifico")}
              icon={Landmark}
              label="Bonifico"
            />
          </div>
        </Field>

        {isContanti && (
          <>
            <Field label="Periodicità" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.periodicita === "ogni_conteggio"}
                  onClick={() => set("periodicita", "ogni_conteggio")}
                  label="Ogni conteggio"
                />
                <ChoiceChip
                  active={form.periodicita === "ogni_fine_mese"}
                  onClick={() => set("periodicita", "ogni_fine_mese")}
                  label="Ogni fine mese"
                />
              </div>
            </Field>

            <Field label="Importo da scalare" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.rata_tipo === "fisso"}
                  onClick={() => set("rata_tipo", "fisso")}
                  label="Importo rata"
                />
                <ChoiceChip
                  active={form.rata_tipo === "tutto_aggio"}
                  onClick={() => set("rata_tipo", "tutto_aggio")}
                  label="Tutto aggio"
                />
              </div>
            </Field>

            {form.rata_tipo === "fisso" && (
              <Field label="Importo rata (€)" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.rata_importo}
                  onChange={(e) => set("rata_importo", e.target.value)}
                  placeholder="es. 250"
                />
              </Field>
            )}
            {form.rata_tipo === "tutto_aggio" && (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                {"L'operatore scalerà nel conteggio "}
                <strong>{"tutto l'aggio"}</strong>
                {" guadagnato dall'esercente."}
              </p>
            )}
          </>
        )}

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function NewBonusModal({ open, onClose, venues, dipendenti, onCreate }) {
  const [form, setForm] = useState({
    venue_id: "",
    agent_id: "",
    importo: "",
    periodicita: "ogni_conteggio",
    note: "",
  });
  useEffect(() => {
    if (open)
      setForm({
        venue_id: "",
        agent_id: "",
        importo: "",
        periodicita: "ogni_conteggio",
        note: "",
      });
  }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo bonus"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Crea bonus
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Agente (opzionale)">
          <Select
            value={form.agent_id}
            onChange={(e) => set("agent_id", e.target.value)}
          >
            <option value="">—</option>
            {dipendenti.map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id || ""}>
                {d.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Importo bonus (€)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo}
            onChange={(e) => set("importo", e.target.value)}
            placeholder="es. 250"
          />
        </Field>

        <Field label="Periodicità" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={form.periodicita === "ogni_conteggio"}
              onClick={() => set("periodicita", "ogni_conteggio")}
              label="Ogni conteggio"
            />
            <ChoiceChip
              active={form.periodicita === "ogni_fine_mese"}
              onClick={() => set("periodicita", "ogni_fine_mese")}
              label="Ogni fine mese"
            />
          </div>
        </Field>

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function NewNotaModal({ open, onClose, venues, onCreate }) {
  const [form, setForm] = useState({
    venue_id: "",
    testo: "",
    sempre: false,
    conteggi_totali: "1",
  });
  useEffect(() => {
    if (open)
      setForm({ venue_id: "", testo: "", sempre: false, conteggi_totali: "1" });
  }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuova nota"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Crea nota
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Testo della nota" required>
          <Textarea
            rows={3}
            value={form.testo}
            onChange={(e) => set("testo", e.target.value)}
            placeholder="es. Ricordare di ritirare le chiavi di scorta"
          />
        </Field>

        <Field label="Per quanti conteggi deve comparire?" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={!form.sempre}
              onClick={() => set("sempre", false)}
              label="N° conteggi"
            />
            <ChoiceChip
              active={form.sempre}
              onClick={() => set("sempre", true)}
              icon={InfinityIcon}
              label="Sempre"
            />
          </div>
        </Field>

        {!form.sempre && (
          <Field
            label="Numero di conteggi"
            required
            hint="La nota sparirà da sola dopo questo numero di conteggi salvati per il locale."
          >
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={form.conteggi_totali}
              onChange={(e) => set("conteggi_totali", e.target.value)}
              placeholder="es. 3"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function SearchableVenueSelect({ venues, value, onChange }) {
  const selectedVenue = venues.find((v) => String(v.id) === String(value));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selectedVenue && !open) {
      setQuery(
        String(selectedVenue.name || "").startsWith(String(selectedVenue.id))
          ? selectedVenue.name
          : `${selectedVenue.id} ${selectedVenue.name}`,
      );
    }
    if (!value && !open) setQuery("");
  }, [selectedVenue, value, open]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredVenues = useMemo(() => {
    if (!normalizedQuery) return venues.slice(0, 30);

    return venues
      .filter((v) => {
        const id = String(v.id || "").toLowerCase();
        const name = String(v.name || "").toLowerCase();
        const label = `${id} ${name}`;
        return (
          id.includes(normalizedQuery) ||
          name.includes(normalizedQuery) ||
          label.includes(normalizedQuery)
        );
      })
      .slice(0, 30);
  }, [venues, normalizedQuery]);

  const pickVenue = (venue) => {
    const label = String(venue.name || "").startsWith(String(venue.id))
      ? venue.name
      : `${venue.id} ${venue.name}`;

    onChange(venue.id);
    setQuery(label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setOpen(true);
        }}
        placeholder="Cerca e seleziona locale..."
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white shadow-xl">
          {filteredVenues.length > 0 ? (
            filteredVenues.map((v) => {
              const label = String(v.name || "").startsWith(String(v.id))
                ? v.name
                : `${v.id} ${v.name}`;

              return (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickVenue(v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                >
                  <span className="font-semibold text-slate-900">{v.id}</span>
                  <span className="truncate text-slate-700">{v.name}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              Nessun locale trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditItemModal({
  item,
  onClose,
  venues,
  dipendenti,
  onSaveDebito,
  onSaveBonus,
  onSaveNota,
}) {
  if (!item) return null;
  if (item.kind === "debito") {
    return (
      <EditDebitoModal
        open={!!item}
        onClose={onClose}
        row={item.row}
        venues={venues}
        onSave={onSaveDebito}
      />
    );
  }
  if (item.kind === "bonus") {
    return (
      <EditBonusModal
        open={!!item}
        onClose={onClose}
        row={item.row}
        venues={venues}
        dipendenti={dipendenti}
        onSave={onSaveBonus}
      />
    );
  }
  return (
    <EditNotaModal
      open={!!item}
      onClose={onClose}
      row={item.row}
      venues={venues}
      onSave={onSaveNota}
    />
  );
}

function EditDebitoModal({ open, onClose, row, venues, onSave }) {
  const [form, setForm] = useState({
    venue_id: "",
    importo_iniziale: "",
    modalita: "contanti",
    periodicita: "ogni_conteggio",
    rata_tipo: "fisso",
    rata_importo: "",
    note: "",
  });
  useEffect(() => {
    if (open && row)
      setForm({
        venue_id: row.venue_id || "",
        importo_iniziale: String(
          Math.trunc(Number(row.importo_iniziale) || 0) || "",
        ),
        modalita: row.modalita || "contanti",
        periodicita: row.periodicita || "ogni_conteggio",
        rata_tipo: row.rata_tipo || "fisso",
        rata_importo:
          row.rata_importo != null
            ? String(Math.trunc(Number(row.rata_importo) || 0))
            : "",
        note: row.note || "",
      });
  }, [open, row]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isContanti = form.modalita === "contanti";
  const vecchioIniziale = Math.trunc(Number(row?.importo_iniziale) || 0);
  const vecchioResiduo = Math.trunc(Number(row?.residuo) || 0);
  const giaScalato = Math.max(0, vecchioIniziale - vecchioResiduo);
  const nuovoIniziale = Math.trunc(Number(form.importo_iniziale) || 0);
  const nuovoResiduo = Math.max(0, nuovoIniziale - giaScalato);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifica debito"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSave(row, form)}>
            Salva modifiche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field
          label="Importo debito (€)"
          required
          hint={`Scalature già fatte: ${fmtEuro(giaScalato)} · nuovo residuo: ${fmtEuro(nuovoResiduo)}`}
        >
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo_iniziale}
            onChange={(e) => set("importo_iniziale", e.target.value)}
            placeholder="es. 10000"
          />
        </Field>

        <Field label="Modalità di rimborso" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={isContanti}
              onClick={() => set("modalita", "contanti")}
              icon={Banknote}
              label="Contanti"
            />
            <ChoiceChip
              active={!isContanti}
              onClick={() => set("modalita", "bonifico")}
              icon={Landmark}
              label="Bonifico"
            />
          </div>
        </Field>

        {isContanti && (
          <>
            <Field label="Periodicità" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.periodicita === "ogni_conteggio"}
                  onClick={() => set("periodicita", "ogni_conteggio")}
                  label="Ogni conteggio"
                />
                <ChoiceChip
                  active={form.periodicita === "ogni_fine_mese"}
                  onClick={() => set("periodicita", "ogni_fine_mese")}
                  label="Ogni fine mese"
                />
              </div>
            </Field>

            <Field label="Importo da scalare" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.rata_tipo === "fisso"}
                  onClick={() => set("rata_tipo", "fisso")}
                  label="Importo rata"
                />
                <ChoiceChip
                  active={form.rata_tipo === "tutto_aggio"}
                  onClick={() => set("rata_tipo", "tutto_aggio")}
                  label="Tutto aggio"
                />
              </div>
            </Field>

            {form.rata_tipo === "fisso" && (
              <Field label="Importo rata (€)" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.rata_importo}
                  onChange={(e) => set("rata_importo", e.target.value)}
                  placeholder="es. 250"
                />
              </Field>
            )}
          </>
        )}

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditBonusModal({ open, onClose, row, venues, dipendenti, onSave }) {
  const [form, setForm] = useState({
    venue_id: "",
    agent_id: "",
    importo: "",
    periodicita: "ogni_conteggio",
    note: "",
  });
  useEffect(() => {
    if (open && row)
      setForm({
        venue_id: row.venue_id || "",
        agent_id: row.agent_id || "",
        importo: String(Math.trunc(Number(row.importo) || 0) || ""),
        periodicita: row.periodicita || "ogni_conteggio",
        note: row.note || "",
      });
  }, [open, row]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifica bonus"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSave(row, form)}>
            Salva modifiche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Agente (opzionale)">
          <Select
            value={form.agent_id}
            onChange={(e) => set("agent_id", e.target.value)}
          >
            <option value="">—</option>
            {dipendenti.map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id || ""}>
                {d.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Importo bonus (€)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo}
            onChange={(e) => set("importo", e.target.value)}
            placeholder="es. 250"
          />
        </Field>

        <Field label="Periodicità" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={form.periodicita === "ogni_conteggio"}
              onClick={() => set("periodicita", "ogni_conteggio")}
              label="Ogni conteggio"
            />
            <ChoiceChip
              active={form.periodicita === "ogni_fine_mese"}
              onClick={() => set("periodicita", "ogni_fine_mese")}
              label="Ogni fine mese"
            />
          </div>
        </Field>

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditNotaModal({ open, onClose, row, venues, onSave }) {
  const [form, setForm] = useState({
    venue_id: "",
    testo: "",
    sempre: false,
    conteggi_totali: "1",
  });
  useEffect(() => {
    if (open && row)
      setForm({
        venue_id: row.venue_id || "",
        testo: row.testo || "",
        sempre: row.conteggi_totali == null,
        conteggi_totali:
          row.conteggi_totali != null
            ? String(Math.trunc(Number(row.conteggi_totali) || 1))
            : "1",
      });
  }, [open, row]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const vecchiTotali = Math.trunc(Number(row?.conteggi_totali) || 0);
  const vecchiRimasti = Math.trunc(Number(row?.conteggi_rimasti) || 0);
  const giaConsumati =
    vecchiTotali > 0 ? Math.max(0, vecchiTotali - vecchiRimasti) : 0;
  const nuoviTotali = form.sempre
    ? null
    : Math.trunc(Number(form.conteggi_totali) || 0);
  const nuoviRimasti = form.sempre
    ? null
    : Math.max(0, nuoviTotali - giaConsumati);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifica nota"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSave(row, form)}>
            Salva modifiche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Testo della nota" required>
          <Textarea
            rows={3}
            value={form.testo}
            onChange={(e) => set("testo", e.target.value)}
          />
        </Field>

        <Field label="Per quanti conteggi deve comparire?" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={!form.sempre}
              onClick={() => set("sempre", false)}
              label="N° conteggi"
            />
            <ChoiceChip
              active={form.sempre}
              onClick={() => set("sempre", true)}
              icon={InfinityIcon}
              label="Sempre"
            />
          </div>
        </Field>

        {!form.sempre && (
          <Field
            label="Numero di conteggi"
            required
            hint={`Già consumati: ${giaConsumati} · nuovi rimanenti: ${nuoviRimasti}`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={form.conteggi_totali}
              onChange={(e) => set("conteggi_totali", e.target.value)}
              placeholder="es. 3"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function ChoiceChip({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-[14px] border text-[11px] font-black uppercase tracking-[.06em] transition ${
        active
          ? "border-[#a87318] bg-[linear-gradient(135deg,#fff0c7,#e8c874)] text-[#68440c] shadow-sm"
          : "border-[#ded0b3] bg-white text-slate-500 hover:border-[#c8a65c] hover:bg-[#fff8e9]"
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {label}
    </button>
  );
}
