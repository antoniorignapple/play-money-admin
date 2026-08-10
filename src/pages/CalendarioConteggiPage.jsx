import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { PageLayout, PageBody } from "../components/PageLayout";
import { useToast } from "../components/Toast";
import ProgrammazioneConteggi from "../components/ProgrammazioneConteggi";

const MONTHS = [
  "GENNAIO",
  "FEBBRAIO",
  "MARZO",
  "APRILE",
  "MAGGIO",
  "GIUGNO",
  "LUGLIO",
  "AGOSTO",
  "SETTEMBRE",
  "OTTOBRE",
  "NOVEMBRE",
  "DICEMBRE",
];
const DAYS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function italianHolidayName(year, month, day) {
  const fixed = {
    "01-01": "Capodanno",
    "01-06": "Epifania",
    "04-25": "Festa della Liberazione",
    "05-01": "Festa dei Lavoratori",
    "06-02": "Festa della Repubblica",
    "08-15": "Ferragosto",
    "11-01": "Ognissanti",
    "12-08": "Immacolata Concezione",
    "12-25": "Natale",
    "12-26": "Santo Stefano",
  };

  const md = `${pad(month + 1)}-${pad(day)}`;
  if (fixed[md]) return fixed[md];

  const easter = easterSunday(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  if (
    easterMonday.getFullYear() === year &&
    easterMonday.getMonth() === month &&
    easterMonday.getDate() === day
  )
    return "Lunedì dell'Angelo";

  return "";
}

function isBlockedDay(year, month, day) {
  const date = new Date(year, month, day);
  return date.getDay() === 0 || Boolean(italianHolidayName(year, month, day));
}

export default function CalendarioConteggiPage() {
  const toast = useToast();
  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    return [
      ...Array(offset).fill(null),
      ...Array.from({ length: total }, (_, index) => index + 1),
    ];
  }, [year, month]);

  const selectedCount = useMemo(
    () =>
      [...selected].filter((date) =>
        date.startsWith(`${year}-${pad(month + 1)}`),
      ).length,
    [selected, year, month],
  );

  async function load() {
    setLoading(true);
    const from = keyOf(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = keyOf(year, month, lastDay);

    const { data, error } = await supabase
      .from("calendario_conteggi")
      .select("data_conteggio")
      .gte("data_conteggio", from)
      .lte("data_conteggio", to);

    setLoading(false);
    if (error) return toast.error(error.message);

    const validDates = (data || [])
      .map((item) => item.data_conteggio)
      .filter((dateString) => {
        const [, monthString, dayString] = dateString.split("-");
        return !isBlockedDay(year, Number(monthString) - 1, Number(dayString));
      });

    setSelected(new Set(validDates));
  }

  useEffect(() => {
    load();
  }, [year, month]);

  function toggle(day) {
    if (isBlockedDay(year, month, day)) return;

    const key = keyOf(year, month, day);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const from = keyOf(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = keyOf(year, month, lastDay);

    const { error: deleteError } = await supabase
      .from("calendario_conteggi")
      .delete()
      .gte("data_conteggio", from)
      .lte("data_conteggio", to);

    if (deleteError) {
      setSaving(false);
      return toast.error(deleteError.message);
    }

    const validSelected = [...selected].filter((dateString) => {
      const [selectedYear, selectedMonth, selectedDay] = dateString
        .split("-")
        .map(Number);
      return !isBlockedDay(selectedYear, selectedMonth - 1, selectedDay);
    });

    if (validSelected.length) {
      const { error } = await supabase
        .from("calendario_conteggi")
        .insert(validSelected.map((data_conteggio) => ({ data_conteggio })));

      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }

    let orphanQuery = supabase
      .from("conteggio_programmazioni")
      .delete()
      .gte("data_conteggio", from)
      .lte("data_conteggio", to);
    if (validSelected.length)
      orphanQuery = orphanQuery.not(
        "data_conteggio",
        "in",
        `(${validSelected.join(",")})`,
      );
    const { error: orphanError } = await orphanQuery;
    if (orphanError && orphanError.code !== "42P01") {
      setSaving(false);
      return toast.error(
        `Calendario salvato, ma pulizia assegnazioni fallita: ${orphanError.message}`,
      );
    }

    setSaving(false);
    toast.success("Calendario conteggi aggiornato");
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[#f5f1e9] p-3 md:p-6">
          <div className="mx-auto max-w-6xl space-y-4">
            <section className="overflow-hidden rounded-[28px] border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/35 to-amber-100/55 shadow-[0_22px_65px_-38px_rgba(146,93,12,0.55)]">
              <div className="relative overflow-hidden border-b border-amber-300/70 bg-gradient-to-br from-[#fffaf0] via-white to-[#efd38d] px-5 py-6 md:px-7">
                <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
                <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-[10px] font-black tracking-[.24em] text-amber-700">
                      <Sparkles size={13} /> PIANIFICAZIONE OPERATIVA
                    </p>
                    <h1 className="mt-1 text-2xl font-black tracking-[.08em] text-slate-950 md:text-3xl">
                      CALENDARIO CONTEGGI
                    </h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Programma i giorni visibili nell’app Dipendenti.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={load}
                      disabled={loading}
                      className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300 bg-white/80 text-amber-800 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
                      title="Aggiorna calendario"
                    >
                      <RefreshCw
                        size={18}
                        className={loading ? "animate-spin" : ""}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#946000] to-[#d5a83a] px-5 text-[10px] font-black tracking-[.1em] text-white shadow-lg shadow-amber-900/15 transition hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      <Save size={16} />{" "}
                      {saving ? "SALVATAGGIO…" : `SALVA ${MONTHS[month]}`}
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-b border-amber-200/70 bg-gradient-to-r from-amber-50/90 via-white to-amber-100/70 px-5 py-5 md:px-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-100 to-white text-amber-700 shadow-sm">
                      <CalendarDays size={24} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black tracking-[0.08em] text-slate-950 md:text-lg">
                          PIANIFICAZIONE MENSILE
                        </h2>
                        <Sparkles size={16} className="text-amber-600" />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        I giorni rossi sono festivi o domeniche e non possono
                        essere selezionati.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start rounded-2xl border border-amber-200 bg-white/85 px-4 py-3 shadow-sm md:self-auto">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                        Giorni impostati
                      </p>
                      <p className="mt-0.5 text-2xl font-black text-slate-950">
                        {selectedCount}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-amber-200" />
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Periodo
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-800">
                        {MONTHS[month]} {year}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-7">
                <div className="overflow-hidden rounded-[24px] border border-amber-200/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.6)]">
                  <div className="flex items-center justify-between border-b border-amber-100 bg-gradient-to-r from-white via-amber-50/60 to-white px-3 py-4 md:px-5">
                    <button
                      type="button"
                      onClick={() => setCursor(new Date(year, month - 1, 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50"
                      aria-label="Mese precedente"
                    >
                      <ChevronLeft size={22} />
                    </button>

                    <div className="text-center">
                      <p className="text-lg font-black tracking-[0.12em] text-slate-950 md:text-xl">
                        {MONTHS[month]} {year}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Tocca un giorno lavorativo per attivarlo o disattivarlo
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCursor(new Date(year, month + 1, 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50"
                      aria-label="Mese successivo"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 border-b border-amber-100 bg-slate-950/[0.025]">
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className={`py-3 text-center text-[10px] font-black tracking-[0.12em] md:text-xs ${day === "DOM" ? "text-red-600" : "text-slate-500"}`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 bg-amber-100/80 gap-px">
                    {cells.map((day, index) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-20 bg-slate-50/70 md:min-h-24"
                          />
                        );
                      }

                      const dateKey = keyOf(year, month, day);
                      const active = selected.has(dateKey);
                      const date = new Date(year, month, day);
                      const holidayName = italianHolidayName(year, month, day);
                      const sunday = date.getDay() === 0;
                      const blocked = sunday || Boolean(holidayName);
                      const isToday =
                        today.getFullYear() === year &&
                        today.getMonth() === month &&
                        today.getDate() === day;

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => toggle(day)}
                          disabled={blocked}
                          title={
                            holidayName ||
                            (sunday
                              ? "Domenica"
                              : active
                                ? "Giorno di conteggio"
                                : "Giorno lavorativo")
                          }
                          className={`group relative min-h-20 bg-white p-2 text-left transition md:min-h-24 md:p-3 ${
                            blocked
                              ? "cursor-not-allowed bg-red-50/45"
                              : active
                                ? "bg-gradient-to-br from-amber-50 via-white to-amber-100/55"
                                : "hover:bg-amber-50/70"
                          }`}
                        >
                          <span
                            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-black transition md:h-11 md:w-11 ${
                              blocked
                                ? "border border-red-200 bg-red-50 text-red-600"
                                : active
                                  ? "border-2 border-amber-500 bg-white text-slate-950 shadow-[0_5px_16px_-8px_rgba(217,145,15,0.95)]"
                                  : isToday
                                    ? "border-2 border-slate-900 bg-slate-950 text-white shadow-sm"
                                    : "border border-transparent text-slate-800 group-hover:border-amber-200 group-hover:bg-white"
                            }`}
                          >
                            {day}
                            {isToday && !blocked && (
                              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-amber-500" />
                            )}
                          </span>

                          {active && !blocked && (
                            <span className="absolute bottom-2 left-2 right-2 text-center text-[9px] font-black uppercase tracking-[0.12em] text-amber-700 md:bottom-3 md:text-[10px]">
                              Conteggio
                            </span>
                          )}

                          {blocked && (
                            <span className="absolute bottom-2 left-1 right-1 truncate text-center text-[8px] font-bold uppercase tracking-wide text-red-500 md:bottom-3 md:text-[9px]">
                              {holidayName || "Domenica"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-amber-500 bg-white" />
                    Giorno di conteggio
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-red-200 bg-red-50" />
                    Festivo o domenica
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full bg-slate-950" />
                    Giorno corrente
                  </span>
                </div>
              </div>
            </section>
            <ProgrammazioneConteggi
              dates={[...selected].filter((date) =>
                date.startsWith(`${year}-${pad(month + 1)}`),
              )}
              monthKey={`${year}-${pad(month + 1)}`}
            />
          </div>
        </div>
      </PageBody>
    </PageLayout>
  );
}
