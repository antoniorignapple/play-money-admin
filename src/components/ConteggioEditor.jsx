import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  MONEY_FIELDS,
  changeRecovery,
  conteggioTotal,
  editorPayload,
  localDateTime,
  money,
  toDraft,
} from "../lib/conteggioEditor";
import "./adminEditor.css";

const euro = (n) => `${Number(n || 0).toLocaleString("it-IT")} €`;
const dateLabel = (value) =>
  new Date(value).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
export default function ConteggioEditor({
  rowId,
  venues,
  dipendenti,
  giri,
  onClose,
  onSaved,
}) {
  const [original, setOriginal] = useState(null),
    [draft, setDraft] = useState(null);
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true);
  const [reason, setReason] = useState(""),
    [tab, setTab] = useState("edit"),
    [review, setReview] = useState(false);
  const [history, setHistory] = useState([]),
    [historyError, setHistoryError] = useState("");
  const panel = useRef(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("conteggi_tool").select("*").eq("id", rowId).maybeSingle(),
      supabase.rpc("admin_v11_history", {
        p_table: "conteggi_tool",
        p_id: String(rowId),
      }),
    ])
      .then(([record, audit]) => {
        if (!active) return;
        if (record.error || !record.data)
          setError(
            record.error?.message ||
              "Questo conteggio esiste solo nel vecchio archivio fotografico: il record originale non è più disponibile.",
          );
        else {
          setOriginal(record.data);
          setDraft(toDraft(record.data));
        }
        if (audit.error)
          setHistoryError(
            "Storico non disponibile. Verifica che l’aggiornamento database v11 sia installato.",
          );
        else setHistory(audit.data || []);
        setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [rowId]);
  const dirty =
    draft &&
    original &&
    JSON.stringify(toDraft(original)) !== JSON.stringify(draft);
  function close() {
    if (
      !saving &&
      (!dirty ||
        window.confirm("Chiudere e scartare le modifiche non salvate?"))
    )
      onClose();
  }
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    const before = (e) => {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, saving]);
  let total = null;
  try {
    if (draft) total = conteggioTotal(draft);
  } catch {
    /* form shows validation on review */
  }
  const changes =
    draft && original
      ? [
          ...MONEY_FIELDS,
          ["venue_id", "Locale"],
          ["giro_id", "Giro"],
          ["executed_by", "Effettuato da"],
          ["conteggio_date", "Data"],
          ["created_at", "Data e ora registrazione"],
          ["locked", "Blocco dipendente"],
        ].filter(
          ([key]) =>
            String(draft[key] ?? "") !== String(toDraft(original)[key] ?? ""),
        )
      : [];
  function label(key, value) {
    if (key === "venue_id")
      return venues.find((v) => String(v.id) === String(value))?.name || value;
    if (key === "giro_id")
      return giri.find((g) => g.id === value)?.name || value;
    if (key === "executed_by")
      return (
        dipendenti.find((d) => d.auth_user_id === value)?.full_name || value
      );
    if (key === "created_at")
      return value ? new Date(value).toLocaleString("it-IT") : "—";
    if (key === "locked") return value ? "Bloccato" : "Modificabile";
    if (MONEY_FIELDS.some(([k]) => k === key)) {
      try {
        return euro(money(value));
      } catch {
        return String(value);
      }
    }
    return value;
  }
  function setField(key, value) {
    setError("");
    setReview(false);
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function recover(key, value) {
    try {
      setDraft(changeRecovery(draft, key, value));
      setError("");
      setReview(false);
    } catch (e) {
      setError(e.message);
    }
  }
  async function save() {
    if (saving) return;
    try {
      const payload = editorPayload(draft);
      if (reason.trim().length < 3)
        throw new Error(
          "Indica il motivo della rettifica (almeno 3 caratteri).",
        );
      if (!changes.length) throw new Error("Non ci sono modifiche da salvare.");
      if (!review) {
        setReview(true);
        setError("");
        return;
      }
      setSaving(true);
      setError("");
      const { data, error: saveError } = await supabase.rpc(
        "admin_v11_edit_conteggio",
        {
          p_id: rowId,
          p_expected: original,
          p_patch: payload,
          p_reason: reason.trim(),
        },
      );
      if (saveError) throw saveError;
      if (!data?.success)
        throw new Error(
          "Salvataggio non confermato. Ricarica il conteggio prima di riprovare.",
        );
      onSaved(data.row);
    } catch (e) {
      setError(
        e.code === "PGRST202"
          ? "Installa prima l’aggiornamento database v11 incluso nello ZIP."
          : e.message,
      );
      setReview(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="pm11-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="pm11-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm11-title"
        ref={panel}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const nodes = [
              ...panel.current.querySelectorAll(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
              ),
            ];
            const first = nodes[0],
              last = nodes.at(-1);
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === panel.current)
            ) {
              e.preventDefault();
              last?.focus();
            }
            if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="pm11-header">
          <div>
            <div className="pm11-eyebrow">
              <ShieldCheck size={14} /> PLAY MONEY ADMIN · 11
            </div>
            <h2 id="pm11-title">Il conteggio, sotto controllo.</h2>
            <p>
              {venues.find((v) => String(v.id) === String(draft?.venue_id))
                ?.name || "Modifica completa del conteggio"}
            </p>
          </div>
          <button
            aria-label="Chiudi editor"
            className="pm11-icon"
            disabled={saving}
            onClick={close}
          >
            <X size={22} />
          </button>
        </header>
        <nav className="pm11-tabs">
          <button
            className={tab === "edit" ? "active" : ""}
            onClick={() => setTab("edit")}
          >
            <Pencil size={15} /> Modifica conteggio
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            <History size={15} /> Storico rettifiche{" "}
            <span>{history.length}</span>
          </button>
        </nav>
        <div className="pm11-body">
          {loading && (
            <p className="pm11-notice">
              <Loader2 className="animate-spin" /> Caricamento del conteggio
              originale…
            </p>
          )}
          {error && (
            <div role="alert" className="pm11-error">
              {error}
            </div>
          )}
          {tab === "history" ? (
            <div className="pm11-history">
              {historyError && <p className="pm11-error">{historyError}</p>}
              {!history.length && !historyError && (
                <p className="pm11-notice">
                  Nessuna rettifica registrata dalla versione 11.
                </p>
              )}
              {history.map((h) => (
                <article key={h.id}>
                  <div className="pm11-eyebrow">
                    {dateLabel(h.created_at)} · ADMIN
                  </div>
                  <h3>{h.reason || "Modifica amministrativa"}</h3>
                  <div className="pm11-diff">
                    {Object.keys(h.after_data || {})
                      .filter(
                        (k) =>
                          JSON.stringify(h.before_data?.[k]) !==
                            JSON.stringify(h.after_data?.[k]) &&
                          !["updated_at", "admin_edited_at"].includes(k),
                      )
                      .map((k) => (
                        <p key={k}>
                          <b>
                            {MONEY_FIELDS.find(([f]) => f === k)?.[1] ||
                              {
                                executed_by: "Effettuato da",
                                user_id: "Assegnazione",
                                venue_id: "Locale",
                                giro_id: "Giro",
                                conteggio_date: "Data",
                                locked: "Blocco dipendente",
                                totale_finale: "Totale",
                              }[k] ||
                              k}
                          </b>
                          <span>
                            {String(label(k, h.before_data?.[k]) ?? "—")} →{" "}
                            {String(label(k, h.after_data?.[k]) ?? "—")}
                          </span>
                        </p>
                      ))}
                  </div>
                  {h.before_data && (
                    <button
                      className="pm11-secondary mt-3"
                      onClick={() => {
                        setDraft(toDraft({ ...original, ...h.before_data }));
                        setReason(
                          `Ripristino valori precedenti alla rettifica del ${dateLabel(h.created_at)}`,
                        );
                        setTab("edit");
                        setReview(false);
                      }}
                    >
                      <RotateCcw size={14} /> Riprendi questi valori
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            draft && (
              <>
                <div className="pm11-grid">
                  <div className="pm11-form">
                    <section className="pm11-card">
                      <div className="pm11-section-number">
                        01 <span>ATTRIBUZIONE</span>
                      </div>
                      <div className="pm11-fields">
                        <label>
                          Locale
                          <select
                            value={draft.venue_id}
                            disabled={saving}
                            onChange={(e) =>
                              setField("venue_id", e.target.value)
                            }
                          >
                            {venues.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.id} · {v.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Giro
                          <select
                            value={draft.giro_id || ""}
                            disabled={saving}
                            onChange={(e) =>
                              setField("giro_id", e.target.value)
                            }
                          >
                            <option value="">Seleziona giro</option>
                            {giri.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Effettuato da
                          <select
                            value={draft.executed_by}
                            disabled={saving}
                            onChange={(e) =>
                              setField("executed_by", e.target.value)
                            }
                          >
                            <option value="">Seleziona dipendente</option>
                            {dipendenti
                              .filter((d) => d.auth_user_id)
                              .map((d) => (
                                <option key={d.id} value={d.auth_user_id}>
                                  {d.full_name}
                                  {d.active === false ? " · non attivo" : ""}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Data del conteggio
                          <input
                            type="date"
                            value={draft.conteggio_date}
                            disabled={saving}
                            onChange={(e) =>
                              setField("conteggio_date", e.target.value)
                            }
                          />
                        </label>
                        {original.created_at && (
                          <label>
                            Data e ora registrazione
                            <input
                              type="datetime-local"
                              step="1"
                              value={localDateTime(draft.created_at)}
                              disabled={saving}
                              onChange={(e) => {
                                const d = new Date(e.target.value);
                                if (Number.isFinite(d.getTime()))
                                  setField("created_at", d.toISOString());
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <p className="pm11-help">
                        Cambiare esecutore non sposta il giro. La data determina
                        il periodo contabile.
                      </p>
                    </section>
                    <section className="pm11-card">
                      <div className="pm11-section-number">
                        02 <span>IMPORTI DEL CONTEGGIO</span>
                      </div>
                      <div className="pm11-fields">
                        {MONEY_FIELDS.slice(0, 10).map(([key, title]) => (
                          <label key={key}>
                            {title}
                            <div className="pm11-money">
                              <input
                                inputMode="numeric"
                                aria-label={title}
                                value={draft[key]}
                                disabled={saving}
                                onChange={(e) => setField(key, e.target.value)}
                              />
                              <span>€</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="pm11-help">
                        Debito virtuale e bonus sono voci informative: come
                        nell’app Dipendenti 19.4, non entrano nel totale.
                      </p>
                    </section>
                    <section className="pm11-card">
                      <div className="pm11-section-number">
                        03 <span>RECUPERI SUCCESSIVI</span>
                      </div>
                      <div className="pm11-fields">
                        {MONEY_FIELDS.slice(10).map(([key, title]) => (
                          <label key={key}>
                            {title}
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={draft[key]}
                              disabled={saving}
                              onChange={(e) => recover(key, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                      <p className="pm11-help">
                        I recuperi aumentano la carta e riducono il da riportare
                        dello stesso importo, come nell’app Dipendenti.
                      </p>
                    </section>
                  </div>
                  <aside className="pm11-summary">
                    <div
                      className={`pm11-total ${total < 0 ? "negative" : "positive"}`}
                    >
                      <span>TOTALE AGGIORNATO</span>
                      <strong>
                        {total === null
                          ? "—"
                          : `${total > 0 ? "+" : ""}${euro(total)}`}
                      </strong>
                      <p>
                        Prima: {euro(original.totale_finale)}
                        <br />
                        Variazione:{" "}
                        {total === null
                          ? "—"
                          : euro(total - Number(original.totale_finale || 0))}
                      </p>
                    </div>
                    <div className="pm11-card">
                      <h3>Una rettifica trasparente</h3>
                      <p className="pm11-help">
                        Salvataggio unico con ricalcolo, aggiornamento dei
                        riporti trasferiti e storico prima/dopo.
                      </p>
                      <label>
                        Motivo della modifica
                        <textarea
                          value={reason}
                          maxLength={1000}
                          rows={3}
                          disabled={saving}
                          placeholder="Es. Correzione importo carta e attribuzione esecutore"
                          onChange={(e) => {
                            setReason(e.target.value);
                            setReview(false);
                          }}
                        />
                      </label>
                      <label className="pm11-check">
                        <input
                          type="checkbox"
                          checked={draft.locked}
                          disabled={saving}
                          onChange={(e) => setField("locked", e.target.checked)}
                        />{" "}
                        Blocca ulteriori modifiche del dipendente
                      </label>
                    </div>
                    {changes.length > 0 && (
                      <div className="pm11-card">
                        <h3>{changes.length} campi modificati</h3>
                        <div className="pm11-diff">
                          {changes.map(([key, title]) => (
                            <p key={key}>
                              <b>{title}</b>
                              <span>
                                {String(label(key, toDraft(original)[key]))}{" "}
                                <ArrowRight size={12} />{" "}
                                {String(label(key, draft[key]))}
                              </span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
                {review && (
                  <div className="pm11-review" role="status">
                    <Check size={20} />
                    <div>
                      <b>Controlla le variazioni, poi conferma.</b>
                      <p>
                        Il salvataggio aggiorna il conteggio originale.
                        Eventuali rettifiche manuali dell’Esattore del giro
                        rimangono attive.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
        <footer className="pm11-footer">
          {draft && (
            <div className="pm11-footer-total">
              <span>TOTALE AGGIORNATO</span>
              <strong style={{ color: total < 0 ? "#b33f30" : "#26764e" }}>
                {total === null ? "—" : euro(total)}
              </strong>
            </div>
          )}
          <button className="pm11-secondary" disabled={saving} onClick={close}>
            Annulla
          </button>
          {draft && tab === "edit" && (
            <>
              <button
                className="pm11-secondary"
                disabled={saving || !dirty}
                onClick={() => {
                  setDraft(toDraft(original));
                  setReview(false);
                  setError("");
                }}
              >
                <RotateCcw size={15} /> Ripristina campi
              </button>
              <button
                className="pm11-primary"
                disabled={saving || !changes.length}
                onClick={save}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}{" "}
                {saving
                  ? "Salvataggio…"
                  : review
                    ? "Conferma e salva"
                    : "Rivedi e salva"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
