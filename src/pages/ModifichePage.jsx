import { useCallback, useEffect, useRef, useState } from "react";
import {
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { ADMIN_ENTITIES, entityTitle } from "../lib/adminEntities";
import { DIPENDENTI_SAFE_FIELDS } from "../lib/dipendentiFields";
import { money } from "../lib/conteggioEditor";
import "../components/adminEditor.css";

export default function ModifichePage() {
  const [entity, setEntity] = useState(ADMIN_ENTITIES[0]),
    [rows, setRows] = useState([]),
    [query, setQuery] = useState("");
  const [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [target, setTarget] = useState(null),
    [draft, setDraft] = useState({}),
    [reason, setReason] = useState(""),
    [saving, setSaving] = useState(false),
    [review, setReview] = useState(false);
  const [lookups, setLookups] = useState({
      venues: [],
      employees: [],
      employeeIds: [],
      vehicles: [],
    }),
    [history, setHistory] = useState(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from("venues").select("id,name"),
      supabase.from("dipendenti").select(DIPENDENTI_SAFE_FIELDS),
      supabase.from("automezzi").select("id,name,plate"),
    ])
      .then(([v, d, a]) => {
        if (!live) return;
        setLookups({
          venues: (v.data || []).map((r) => ({
            id: r.id,
            label: `${r.id} · ${r.name}`,
          })),
          employees: (d.data || [])
            .filter((r) => r.auth_user_id)
            .map((r) => ({ id: r.auth_user_id, label: r.full_name })),
          employeeIds: (d.data || []).map((r) => ({
            id: r.id,
            label: r.full_name,
          })),
          vehicles: (a.data || []).map((r) => ({
            id: r.id,
            label: `${r.name} · ${r.plate}`,
          })),
        });
        if (v.error || d.error || a.error)
          setError(
            "Alcuni elenchi di selezione non sono disponibili. Aggiorna prima di modificare.",
          );
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await supabase
      .from(entity.table)
      .select(entity.table === "dipendenti" ? DIPENDENTI_SAFE_FIELDS : "*")
      .order("id")
      .range(page * 100, page * 100 + 100);
    if (result.error) {
      setRows([]);
      setError(result.error.message);
    } else {
      setRows((result.data || []).slice(0, 100));
      setMore((result.data || []).length > 100);
    }
    setLoading(false);
  }, [entity, page]);
  useEffect(() => {
    let active = true;
    supabase
      .from(entity.table)
      .select(entity.table === "dipendenti" ? DIPENDENTI_SAFE_FIELDS : "*")
      .order("id")
      .range(page * 100, page * 100 + 100)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setRows([]);
          setError(error.message);
        } else {
          setRows((data || []).slice(0, 100));
          setMore((data || []).length > 100);
        }
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
  }, [entity, page]);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!target) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [target]);
  useEffect(() => {
    const before = (e) => {
      if (
        target &&
        (saving || JSON.stringify(draft) !== JSON.stringify(target))
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [target, draft, saving]);
  const fields = entity.fields.filter(
    ([key]) => target && Object.hasOwn(target, key),
  );
  function open(row) {
    setTarget(row);
    setDraft({ ...row });
    setReason("");
    setError("");
    setReview(false);
    setHistory(null);
  }
  function close() {
    if (
      !saving &&
      (JSON.stringify(draft) === JSON.stringify(target) ||
        window.confirm("Scartare le modifiche non salvate?"))
    )
      setTarget(null);
  }
  async function audit(row) {
    setTarget(row);
    setDraft({ ...row });
    setHistory([]);
    setError("");
    const { data, error } = await supabase.rpc("admin_v11_history", {
      p_table: entity.table,
      p_id: String(row.id),
    });
    if (error)
      setError("Installa l’aggiornamento database v11 per usare lo storico.");
    else setHistory(data || []);
  }
  async function save() {
    if (saving) return;
    try {
      const patch = {};
      for (const [key, , type] of fields) {
        if (String(draft[key] ?? "") !== String(target[key] ?? ""))
          patch[key] =
            type === "number"
              ? money(draft[key])
              : type === "boolean"
                ? !!draft[key]
                : draft[key] === ""
                  ? null
                  : draft[key];
      }
      if (!Object.keys(patch).length)
        throw new Error("Nessuna modifica da salvare.");
      if (reason.trim().length < 3)
        throw new Error("Indica il motivo della modifica.");
      if (!review) {
        setReview(true);
        return;
      }
      setSaving(true);
      setError("");
      const { data, error } = await supabase.rpc("admin_v11_edit_record", {
        p_table: entity.table,
        p_id: String(target.id),
        p_expected: target,
        p_patch: patch,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Salvataggio non confermato");
      setTarget(null);
      setNotice("Modifica salvata e registrata nello storico.");
      await load();
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
  const shown = rows.filter((r) =>
    JSON.stringify(r)
      .toLocaleLowerCase("it")
      .includes(query.toLocaleLowerCase("it")),
  );
  return (
    <div className="pm11-hub">
      <header className="pm11-hub-head">
        <div className="pm11-eyebrow">
          <ShieldCheck size={15} /> ADMIN 11 · CENTRO MODIFICHE
        </div>
        <h1>Ogni correzione, al posto giusto.</h1>
        <p>
          Modifica i dati operativi e consulta lo storico. Per i conteggi usa
          “Modifica completa” nel dettaglio del locale.
        </p>
      </header>
      {notice && (
        <div role="status" className="pm11-review">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Chiudi avviso">
            <X size={16} />
          </button>
        </div>
      )}
      {!target && error && (
        <div role="alert" className="pm11-error">
          {error}
        </div>
      )}
      <div className="pm11-hub-grid">
        <nav className="pm11-hub-menu">
          {ADMIN_ENTITIES.map((e) => (
            <button
              key={e.table}
              className={e.table === entity.table ? "active" : ""}
              onClick={() => {
                if (e.table === entity.table) return;
                setLoading(true);
                setError("");
                setEntity(e);
                setPage(0);
                setQuery("");
              }}
            >
              {e.title}
            </button>
          ))}
        </nav>
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Search size={17} />
            <input
              aria-label="Cerca nelle righe caricate"
              placeholder="Cerca nelle 100 righe della pagina…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="pm11-secondary"
              disabled={loading}
              onClick={load}
              aria-label="Aggiorna"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="pm11-card" style={{ padding: 0 }}>
            {loading ? (
              <p className="pm11-notice">
                <Loader2 className="animate-spin" /> Caricamento…
              </p>
            ) : (
              shown.map((row) => (
                <div className="pm11-hub-row" key={row.id}>
                  <div>
                    <strong>{entityTitle(row)}</strong>
                    <p>
                      {[
                        row.work_date,
                        row.city,
                        row.plate,
                        row.note,
                        row.active === false ? "Non attivo" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="pm11-secondary"
                      aria-label={`Storico ${entityTitle(row)}`}
                      onClick={() => audit(row)}
                    >
                      <History size={15} />
                    </button>
                    <button className="pm11-primary" onClick={() => open(row)}>
                      <Pencil size={14} /> Modifica
                    </button>
                  </div>
                </div>
              ))
            )}
            {!loading && !shown.length && (
              <p className="pm11-notice">
                Nessuna registrazione in questa pagina.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              className="pm11-secondary"
              disabled={!page || loading}
              onClick={() => { setLoading(true); setError(""); setPage((p) => p - 1); }}
            >
              Precedente
            </button>
            <span className="text-xs">Pagina {page + 1}</span>
            <button
              className="pm11-secondary"
              disabled={!more || loading}
              onClick={() => { setLoading(true); setError(""); setPage((p) => p + 1); }}
            >
              Successiva
            </button>
          </div>
          <p className="pm11-help">
            Debiti, bonus, calendario, assegnazioni dei giri e credenziali si
            gestiscono nelle rispettive sezioni. Le rettifiche amministrative
            vengono registrate dalla versione 11.
          </p>
        </section>
      </div>
      {target && (
        <div className="pm11-overlay">
          <section
            className="pm11-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pm11-record-title"
            tabIndex={-1}
            ref={dialogRef}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Tab") {
                const nodes = [
                  ...dialogRef.current.querySelectorAll(
                    "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
                  ),
                ];
                const first = nodes[0],
                  last = nodes.at(-1);
                if (
                  e.shiftKey &&
                  (document.activeElement === first ||
                    document.activeElement === dialogRef.current)
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
            style={{ maxWidth: 760 }}
          >
            <header className="pm11-header">
              <div>
                <div className="pm11-eyebrow">{entity.title}</div>
                <h2 id="pm11-record-title">
                  {history ? "Storico modifiche" : entityTitle(target)}
                </h2>
              </div>
              <button
                className="pm11-icon"
                disabled={saving}
                onClick={close}
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </header>
            <div className="pm11-body">
              {error && (
                <div role="alert" className="pm11-error">
                  {error}
                </div>
              )}
              {history ? (
                <div className="pm11-history">
                  {!history.length && (
                    <p>Nessuna modifica registrata dalla versione 11.</p>
                  )}
                  {history.map((h) => (
                    <article key={h.id}>
                      <div className="pm11-eyebrow">
                        {new Date(h.created_at).toLocaleString("it-IT")}
                      </div>
                      <h3>{h.reason || "Modifica amministrativa"}</h3>
                      {entity.fields
                        .filter(
                          ([k]) =>
                            JSON.stringify(h.before_data?.[k]) !==
                            JSON.stringify(h.after_data?.[k]),
                        )
                        .map(([k, l, type]) => {
                          const display = (v) =>
                            lookups[type]?.find(
                              (o) => String(o.id) === String(v),
                            )?.label ??
                            (type === "boolean"
                              ? v
                                ? "Sì"
                                : "No"
                              : String(v ?? "—"));
                          return (
                            <p className="pm11-help" key={k}>
                              {l}: {display(h.before_data?.[k])} →{" "}
                              {display(h.after_data?.[k])}
                            </p>
                          );
                        })}
                    </article>
                  ))}
                </div>
              ) : (
                <>
                  <div className="pm11-fields">
                    {fields.map(([key, label, type]) => (
                      <label key={key}>
                        {label}
                        {type === "boolean" ? (
                          <select
                            disabled={saving}
                            value={String(!!draft[key])}
                            onChange={(e) => {
                              setDraft({
                                ...draft,
                                [key]: e.target.value === "true",
                              });
                              setReview(false);
                            }}
                          >
                            <option value="true">Sì</option>
                            <option value="false">No</option>
                          </select>
                        ) : lookups[type] ? (
                          <select
                            disabled={saving}
                            value={draft[key] || ""}
                            onChange={(e) => {
                              setDraft({ ...draft, [key]: e.target.value });
                              setReview(false);
                            }}
                          >
                            <option value="">Seleziona…</option>
                            {lookups[type].map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            disabled={saving}
                            type={type === "date" ? "date" : "text"}
                            inputMode={
                              type === "number" ? "numeric" : undefined
                            }
                            value={draft[key] ?? ""}
                            onChange={(e) => {
                              setDraft({ ...draft, [key]: e.target.value });
                              setReview(false);
                            }}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                  <label className="mt-5">
                    Motivo della modifica
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={reason}
                      disabled={saving}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setReview(false);
                      }}
                    />
                  </label>
                  {review && (
                    <div className="pm11-review">
                      <div>
                        <b>Conferma queste modifiche</b>
                        {fields
                          .filter(
                            ([k]) =>
                              String(target[k] ?? "") !==
                              String(draft[k] ?? ""),
                          )
                          .map(([k, l, type]) => {
                            const display = (v) =>
                              lookups[type]?.find(
                                (o) => String(o.id) === String(v),
                              )?.label ?? String(v ?? "—");
                            return (
                              <p key={k}>
                                {l}: {display(target[k])} → {display(draft[k])}
                              </p>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <footer className="pm11-footer">
              <button
                className="pm11-secondary"
                disabled={saving}
                onClick={close}
              >
                Chiudi
              </button>
              {!history && (
                <button
                  className="pm11-primary"
                  disabled={saving}
                  onClick={save}
                >
                  <Save size={15} />
                  {saving
                    ? "Salvataggio…"
                    : review
                      ? "Conferma e salva"
                      : "Rivedi e salva"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
