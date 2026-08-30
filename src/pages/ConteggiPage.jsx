import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Users,
  Building2,
  FileText,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Filter,
  Archive,
  TriangleAlert,
  MoreVertical,
  Pencil,
  Save,
  X,
  CheckCircle2,
  CircleX,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import generateConteggiPdf from "../lib/generateConteggiPdf";
import {
  closePdfPreviewWindow,
  createPdfPreviewWindow,
} from "../lib/pdfPreview";
import {
  Button,
  IconButton,
  Input,
  Select,
  Badge,
  EmptyState,
  Stat,
  Card,
  Field,
  Modal,
} from "../components/ui";
import { PageLayout, PageHeader, PageBody } from "../components/PageLayout";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

const fmtEuro = (n) =>
  `${Math.trunc(Number(n) || 0).toLocaleString("it-IT")} €`;
const fmtEuroPlain = (n) =>
  `${Math.trunc(Number(n) || 0).toLocaleString("it-IT")} €`;
const fmtSigned = (n) => {
  const v = Math.trunc(Number(n) || 0);
  if (v > 0) return `+${v.toLocaleString("it-IT")} €`;
  if (v < 0) return `-${Math.abs(v).toLocaleString("it-IT")} €`;
  return "0 €";
};
const clsSigned = (n) => {
  const v = Number(n) || 0;
  if (v > 0) return "text-[var(--color-success)]";
  if (v < 0) return "text-[var(--color-danger)]";
  return "text-[var(--color-text-secondary)]";
};
const formatITDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
function formatPeriodTitle(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return "Conteggi";
  return `Conteggi ${formatITDate(dateFrom)} - ${formatITDate(dateTo)}`;
}

function sortVenueIds(a, b) {
  const aId = String(a?.id || a?.venue_id || "");
  const bId = String(b?.id || b?.venue_id || "");
  const aLetter = aId.charAt(0),
    bLetter = bId.charAt(0);
  if (aLetter !== bLetter) {
    if (aLetter === "K") return -1;
    if (bLetter === "K") return 1;
  }
  const aNum = parseInt(aId.replace(/\D/g, ""), 10) || 0;
  const bNum = parseInt(bId.replace(/\D/g, ""), 10) || 0;
  return aNum - bNum;
}

function getCassaDepositi(row) {
  return (
    (Number(row?.carta) || 0) +
    (Number(row?.monete) || 0) -
    (Number(row?.uso_cassa) || 0)
  );
}

const EMPLOYEE_DEPOSIT_CODE_BY_NAME = [
  {
    keys: [
      "D APRILE MASSIMO",
      "DAPRILE MASSIMO",
      "APRILE MASSIMO",
      "MASSIMO D APRILE",
      "MASSIMO DAPRILE",
    ],
    code: "D01",
  },
  { keys: ["PAPAGNI GIOVANNI", "GIOVANNI PAPAGNI", "PAPAGNI"], code: "D02" },
  { keys: ["DI BARI ANTONIO", "ANTONIO DI BARI", "DI BARI"], code: "D03" },
  { keys: ["QUITADAMO ALEX", "ALEX QUITADAMO", "QUITADAMO"], code: "D04" },
  {
    keys: ["RIGNANESE ANTONIO", "ANTONIO RIGNANESE", "RIGNANESE"],
    code: "D05",
  },
];

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .toUpperCase();

function resolveEmployeeDepositCode(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  for (const item of EMPLOYEE_DEPOSIT_CODE_BY_NAME) {
    if (item.keys.some((k) => normalized.includes(normalizeText(k))))
      return item.code;
  }

  if (normalized.includes("RIGNANESE")) return "D05";
  if (normalized.includes("PAPAGNI")) return "D02";
  if (normalized.includes("QUITADAMO")) return "D04";
  if (normalized.includes("BARI")) return "D03";
  if (normalized.includes("APRILE") || normalized.includes("DAPRILE"))
    return "D01";

  return null;
}

function getRealDepositForOperator(realDepositsByCode, operatorName) {
  const code = resolveEmployeeDepositCode(operatorName);
  if (!code) return 0;
  return Math.trunc(Number(realDepositsByCode?.[code]) || 0);
}

function getFinaleWithoutTheoreticalCassa(row) {
  return (Number(row?.totale_finale) || 0) - getCassaDepositi(row);
}

export default function ConteggiPage() {
  const toast = useToast();
  const [venues, setVenues] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [giri, setGiri] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [periodView, setPeriodView] = useState("active");
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [realDepositsByCode, setRealDepositsByCode] = useState({
    D01: 0,
    D02: 0,
    D03: 0,
    D04: 0,
    D05: 0,
  });
  const [missingVenueDeposits, setMissingVenueDeposits] = useState({});
  const [adminOverridesByOperator, setAdminOverridesByOperator] = useState({});
  const [overrideInputsByOperator, setOverrideInputsByOperator] = useState({});
  const [savingOverrideOperator, setSavingOverrideOperator] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [signFilter, setSignFilter] = useState("all");
  const [selectedRow, setSelectedRow] = useState(null);

  const [finalization, setFinalization] = useState({
    open: false,
    step: "carryovers",
    preview: null,
    newDateTo: "",
    loading: false,
    progress: 1,
    progressMessage: "",
    error: "",
  });
  const [showMissing, setShowMissing] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [operatorsOpen, setOperatorsOpen] = useState(true);
  const [debitiOpen, setDebitiOpen] = useState(false);
  const [expandedOperators, setExpandedOperators] = useState({});
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [venueStatusPopup, setVenueStatusPopup] = useState(null);

  const venueById = useMemo(() => {
    const map = {};
    venues.forEach((v) => {
      map[String(v.id)] = v;
    });
    return map;
  }, [venues]);

  const dipendenteByAuthId = useMemo(() => {
    const map = {};
    dipendenti.forEach((dip) => {
      if (dip.auth_user_id) map[String(dip.auth_user_id)] = dip;
    });
    return map;
  }, [dipendenti]);

  const dipendenteById = useMemo(() => {
    const map = {};
    dipendenti.forEach((dip) => {
      if (dip.id) map[String(dip.id)] = dip;
    });
    return map;
  }, [dipendenti]);

  const giroById = useMemo(() => {
    const map = {};
    giri.forEach((giro) => {
      if (giro.id) map[String(giro.id)] = giro;
    });
    return map;
  }, [giri]);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) || null,
    [periods, selectedPeriodId],
  );
  const isClosed = selectedPeriod?.status === "closed";
  const visiblePeriods = useMemo(
    () =>
      periodView === "archive"
        ? periods.filter((p) => p.status === "closed")
        : periods.filter((p) => p.status !== "closed"),
    [periods, periodView],
  );

  function getVenueName(row) {
    const venue = venueById[String(row.venue_id)];
    if (!venue) return row.venue_id || "Locale sconosciuto";
    const id = String(venue.id || "").trim();
    const name = String(venue.name || "").trim();
    if (name.toLowerCase().startsWith(id.toLowerCase())) return name;
    return `${id} ${name}`;
  }

  function getOperatorName(row) {
    if (!row) return "Operaio sconosciuto";
    if (row.operator_name) return String(row.operator_name);
    if (row.user_id) {
      const dip = dipendenteByAuthId[String(row.user_id)];
      if (dip)
        return (
          dip.full_name ||
          dip.nome_completo ||
          dip.display_name ||
          dip.nome ||
          dip.email ||
          String(row.user_id).slice(0, 8)
        );
      return String(row.user_id).slice(0, 8);
    }
    return "Operaio sconosciuto";
  }

  function getGiroName(operator) {
    const snapshot = operator?.rows?.find((row) =>
      String(row.giro_name_snapshot || "").trim(),
    )?.giro_name_snapshot;
    if (snapshot)
      return String(snapshot)
        .replace(/^GIRO\s*:?[\s-]*/i, "")
        .trim();
    const linkedGiro = operator?.rows
      ?.map((row) => giroById[String(row.giro_id)])
      .find(Boolean);
    if (linkedGiro?.name)
      return String(linkedGiro.name)
        .replace(/^GIRO\s*:?[\s-]*/i, "")
        .trim();
    return (
      String(operator?.name || "")
        .replace(/^GIRO\s*:?[\s-]*/i, "")
        .trim() || "—"
    );
  }

  function getAccountingName(row) {
    const snapshot = String(row?.giro_name_snapshot || "")
      .replace(/^GIRO\s*:?[\s-]*/i, "")
      .trim();
    if (snapshot) return snapshot;
    const linkedGiro = giroById[String(row?.giro_id)];
    if (linkedGiro?.name)
      return String(linkedGiro.name)
        .replace(/^GIRO\s*:?[\s-]*/i, "")
        .trim();
    return getOperatorName(row);
  }

  function getDepositCodeForRow(row) {
    const linkedGiro = giroById[String(row?.giro_id)];
    const owner = linkedGiro?.default_employee_id
      ? dipendenteById[String(linkedGiro.default_employee_id)] ||
        dipendenteByAuthId[String(linkedGiro.default_employee_id)]
      : null;

    const explicitCode = [linkedGiro?.code, owner?.deposit_venue_id]
      .map((value) =>
        String(value || "")
          .trim()
          .toUpperCase(),
      )
      .find((value) => /^D0[1-5]$/.test(value));
    if (explicitCode) return explicitCode;

    // Compatibilità con il giro storico "Massimo", proprietario D'Aprile (D01),
    // anche se default_employee_id non è valorizzato nei vecchi record.
    const normalizedGiroName = normalizeText(
      linkedGiro?.name || row?.giro_name_snapshot,
    );
    if (
      normalizedGiroName === "MASSIMO" ||
      normalizedGiroName.includes("APRILE")
    )
      return "D01";

    return resolveEmployeeDepositCode(
      [
        owner?.full_name,
        owner?.email,
        linkedGiro?.name,
        linkedGiro?.code,
        getAccountingName(row),
        getOperatorName(row),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  function getRealDepositForRows(operatorRows) {
    const code = (operatorRows || []).map(getDepositCodeForRow).find(Boolean);
    return code ? Math.trunc(Number(realDepositsByCode?.[code]) || 0) : 0;
  }

  async function loadBaseData() {
    const [{ data: venuesData }, { data: dipendentiData }, { data: giriData }] =
      await Promise.all([
        supabase.from("venues").select("*"),
        supabase.from("dipendenti").select("*"),
        supabase.from("giri").select("id,name,code,default_employee_id"),
      ]);
    setVenues([...(venuesData || [])].sort(sortVenueIds));
    setDipendenti(dipendentiData || []);
    setGiri(giriData || []);
  }

  async function loadPeriods() {
    const { data, error } = await supabase
      .from("conteggi_periods")
      .select("id,title,date_from,date_to,status,note")
      .order("date_from", { ascending: false });
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    const list = data || [];
    setPeriods(list);
    if (list.length) {
      setSelectedPeriodId((current) => {
        if (current && list.some((p) => p.id === current)) return current;
        const firstOpen = list.find((p) => p.status !== "closed");
        return (firstOpen || list[0]).id;
      });
    }
  }

  async function loadDashboard(
    periodId = selectedPeriodId,
    forceArchive = false,
  ) {
    if (!periodId) return;
    const periodForDashboard = periods.find((p) => p.id === periodId);
    try {
      setLoading(true);

      let hasLiveClosedData = false;
      if (forceArchive || periodForDashboard?.status === "closed") {
        const { data: liveRows, error: liveRowsErr } = await supabase
          .from("conteggi_tool")
          .select("id")
          .eq("period_id", periodId)
          .limit(1);
        if (liveRowsErr) throw liveRowsErr;
        hasLiveClosedData = Array.isArray(liveRows) && liveRows.length > 0;
      }

      // Periodi finalizzati dal nuovo sistema restano nelle tabelle reali.
      // Lo snapshot viene usato soltanto come fallback per i vecchi periodi,
      // finalizzati quando i dati originali venivano ancora cancellati.
      if ((forceArchive || periodForDashboard?.status === "closed") && !hasLiveClosedData) {
        const { data: snapshot, error: snapshotErr } = await supabase
          .from("conteggi_archive_snapshots")
          .select(
            "conteggi_data,movimenti_cassa_data,overrides_data,riepilogo_data",
          )
          .eq("period_id", periodId)
          .maybeSingle();
        if (snapshotErr) throw snapshotErr;
        if (!snapshot) throw new Error("Fotografia archivio non trovata");

        const archivedRows = Array.isArray(
          snapshot.conteggi_data?.conteggi_admin_rows,
        )
          ? snapshot.conteggi_data.conteggi_admin_rows
          : snapshot.conteggi_data?.conteggi_tool || [];
        const archivedToolRows = Array.isArray(
          snapshot.conteggi_data?.conteggi_tool,
        )
          ? snapshot.conteggi_data.conteggi_tool
          : [];
        // Nello snapshot storico conteggi_admin_rows può non contenere il Giro,
        // mentre conteggi_tool conserva sia il Giro sia l'esecutore reale.
        // Sono due concetti distinti: il raggruppamento usa il Giro; la riga
        // continua a mostrare chi ha materialmente effettuato il conteggio.
        const archivedGiroById = new Map(
          archivedToolRows.map((row) => [String(row.id), row]),
        );
        const enrichedArchivedRows = archivedRows.map((row) => {
          const source = archivedGiroById.get(String(row.id));
          if (!source) return row;
          return {
            ...row,
            giro_id: row.giro_id || source.giro_id || null,
            giro_name_snapshot:
              row.giro_name_snapshot || source.giro_name_snapshot || null,
            executed_by: row.executed_by || source.executed_by || null,
            executor_name_snapshot:
              row.executor_name_snapshot ||
              source.executor_name_snapshot ||
              null,
          };
        });
        const archivedOverrides = Array.isArray(snapshot.overrides_data)
          ? snapshot.overrides_data
          : [];
        const archivedMovements = Array.isArray(snapshot.movimenti_cassa_data)
          ? snapshot.movimenti_cassa_data
          : [];
        const overridesMap = {};
        const inputsMap = {};
        archivedOverrides.forEach((item) => {
          const key = normalizeText(item.operator_name);
          const value = Math.trunc(Number(item.esattore_override) || 0);
          overridesMap[key] = { ...item, esattore_override: value };
          inputsMap[key] = String(value);
        });
        const depositMap = {};
        const archivedRealDeposits = { D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 };
        archivedMovements.forEach((item) => {
          const venueId = String(item.venue_id || "").trim();
          if (!venueId) return;
          if (
            Object.prototype.hasOwnProperty.call(
              archivedRealDeposits,
              venueId.toUpperCase(),
            )
          ) {
            archivedRealDeposits[venueId.toUpperCase()] += Math.trunc(
              Number(item.acconto) || 0,
            );
            return;
          }
          if (venueId.toUpperCase().startsWith("D")) return;
          if (!depositMap[venueId])
            depositMap[venueId] = { acconti: 0, recuperi: 0, daRiportare: 0 };
          depositMap[venueId].acconti += Math.trunc(Number(item.acconto) || 0);
          depositMap[venueId].recuperi += Math.trunc(
            Number(item.recupero) || 0,
          );
          depositMap[venueId].daRiportare += Math.trunc(
            Number(item.da_riportare) || 0,
          );
        });

        setSummary(snapshot.riepilogo_data || null);
        setRows(enrichedArchivedRows);
        setAdminOverridesByOperator(overridesMap);
        setOverrideInputsByOperator(inputsMap);
        setMissingVenueDeposits(depositMap);
        setRealDepositsByCode(archivedRealDeposits);
        return;
      }

      let activeDepositsQuery = supabase
        .from("movements_cassa")
        .select(
          "venue_id, acconto, recupero, da_riportare, deleted_at, work_date",
        )
        .is("deleted_at", null);

      if (periodForDashboard?.date_from) {
        activeDepositsQuery = activeDepositsQuery.gte(
          "work_date",
          periodForDashboard.date_from,
        );
      }
      if (periodForDashboard?.date_to) {
        activeDepositsQuery = activeDepositsQuery.lte(
          "work_date",
          periodForDashboard.date_to,
        );
      }

      const [
        { data: sumRows },
        { data: detailRows, error: rowsErr },
        { data: overrideRows, error: overrideErr },
        { data: activeDepositsRows, error: activeDepositsErr },
        { data: giroSourceRows, error: giroSourceErr },
      ] = await Promise.all([
        supabase
          .from("conteggi_admin_summary")
          .select("*")
          .eq("period_id", periodId)
          .maybeSingle(),
        supabase
          .from("conteggi_admin_rows")
          .select("*")
          .eq("period_id", periodId)
          .order("venue_id", { ascending: true }),
        supabase
          .from("conteggi_admin_overrides")
          .select("id,period_id,operator_name,esattore_override")
          .eq("period_id", periodId),
        activeDepositsQuery,
        supabase
          .from("conteggi_tool")
          .select("id,giro_id,giro_name_snapshot,rp_day2,rp_day3,rp_day4")
          .eq("period_id", periodId),
      ]);
      if (rowsErr) throw rowsErr;
      if (overrideErr) throw overrideErr;
      if (activeDepositsErr) throw activeDepositsErr;
      if (giroSourceErr) throw giroSourceErr;

      const giroSnapshotById = new Map(
        (giroSourceRows || []).map((row) => [String(row.id), row]),
      );
      const enrichedDetailRows = (detailRows || []).map((row) => ({
        ...row,
        rp_day2: Number(giroSnapshotById.get(String(row.id))?.rp_day2) || 0,
        rp_day3: Number(giroSnapshotById.get(String(row.id))?.rp_day3) || 0,
        rp_day4: Number(giroSnapshotById.get(String(row.id))?.rp_day4) || 0,
        giro_id:
          row.giro_id || giroSnapshotById.get(String(row.id))?.giro_id || null,
        giro_name_snapshot:
          row.giro_name_snapshot ||
          giroSnapshotById.get(String(row.id))?.giro_name_snapshot ||
          null,
      }));

      const overridesMap = {};
      const inputsMap = {};
      (overrideRows || []).forEach((item) => {
        const key = normalizeText(item.operator_name);
        const value = Math.trunc(Number(item.esattore_override) || 0);
        overridesMap[key] = { ...item, esattore_override: value };
        inputsMap[key] = String(value);
      });

      const depositMap = {};
      const liveRealDeposits = { D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 };
      (activeDepositsRows || []).forEach((item) => {
        const venueId = String(item.venue_id || "").trim();
        if (!venueId) return;
        const upperVenueId = venueId.toUpperCase();
        if (Object.prototype.hasOwnProperty.call(liveRealDeposits, upperVenueId)) {
          liveRealDeposits[upperVenueId] += Math.trunc(Number(item.acconto) || 0);
          return;
        }
        if (upperVenueId.startsWith("D")) return;
        if (!depositMap[venueId]) {
          depositMap[venueId] = { acconti: 0, recuperi: 0, daRiportare: 0 };
        }
        depositMap[venueId].acconti += Math.trunc(Number(item.acconto) || 0);
        depositMap[venueId].recuperi += Math.trunc(Number(item.recupero) || 0);
        depositMap[venueId].daRiportare += Math.trunc(
          Number(item.da_riportare) || 0,
        );
      });

      setSummary(sumRows || null);
      setRows(enrichedDetailRows);
      setAdminOverridesByOperator(overridesMap);
      setOverrideInputsByOperator(inputsMap);
      setMissingVenueDeposits(depositMap);
      setRealDepositsByCode(liveRealDeposits);
    } catch (e) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadRealDepositsForPeriod(period = selectedPeriod) {
    const empty = { D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 };
    if (!period?.date_from || !period?.date_to) {
      setRealDepositsByCode(empty);
      return;
    }

    if (period.status === "closed") {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("movements_cassa")
        .select("venue_id, acconto, work_date, deleted_at")
        .in("venue_id", ["D01", "D02", "D03", "D04", "D05"])
        .is("deleted_at", null)
        .gte("work_date", period.date_from)
        .lte("work_date", period.date_to);

      if (error) throw error;

      const totals = { ...empty };
      (data || []).forEach((r) => {
        const code = String(r.venue_id || "")
          .trim()
          .toUpperCase();
        if (!Object.prototype.hasOwnProperty.call(totals, code)) return;
        totals[code] += Math.trunc(Number(r.acconto) || 0);
      });

      setRealDepositsByCode(totals);
    } catch (e) {
      toast.error(`Errore depositi reali: ${e.message}`);
      setRealDepositsByCode(empty);
    }
  }

  useEffect(() => {
    loadBaseData();
    loadPeriods();
  }, []);
  useEffect(() => {
    setOperatorFilter("all");
    setVenueFilter("all");
    setSignFilter("all");
    setSearch("");
    setDebitiOpen(false);
    setExpandedOperators({});
    if (selectedPeriodId) loadDashboard(selectedPeriodId);
  }, [selectedPeriodId]);

  useEffect(() => {
    loadRealDepositsForPeriod(selectedPeriod);
  }, [
    selectedPeriod?.id,
    selectedPeriod?.date_from,
    selectedPeriod?.date_to,
    selectedPeriod?.status,
  ]);

  useEffect(() => {
    if (!periods.length) return;
    if (
      selectedPeriodId &&
      visiblePeriods.some((p) => p.id === selectedPeriodId)
    )
      return;
    setSelectedPeriodId(visiblePeriods[0]?.id || "");
    if (!visiblePeriods[0]) {
      setSummary(null);
      setRows([]);
      setRealDepositsByCode({ D01: 0, D02: 0, D03: 0, D04: 0, D05: 0 });
      setMissingVenueDeposits({});
    }
  }, [periodView, periods, visiblePeriods, selectedPeriodId]);

  const operators = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(getAccountingName(r)));
    return Array.from(set).sort();
  }, [rows, dipendenti, giri]);

  const countedVenues = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(String(r.venue_id))) {
        map.set(String(r.venue_id), { id: r.venue_id, name: getVenueName(r) });
      }
    });
    return Array.from(map.values()).sort(sortVenueIds);
  }, [rows, venues]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const venueName = getVenueName(r).toLowerCase();
      const opName = getAccountingName(r).toLowerCase();
      const finale = Number(r.totale_finale) || 0;
      const matchSearch = !q || venueName.includes(q) || opName.includes(q);
      const matchOperator =
        operatorFilter === "all" || getAccountingName(r) === operatorFilter;
      const matchVenue =
        venueFilter === "all" || String(r.venue_id) === String(venueFilter);
      const matchSign =
        signFilter === "all" ||
        (signFilter === "positive" && finale > 0) ||
        (signFilter === "negative" && finale < 0) ||
        (signFilter === "zero" && finale === 0);
      return matchSearch && matchOperator && matchVenue && matchSign;
    });
  }, [
    rows,
    search,
    operatorFilter,
    venueFilter,
    signFilter,
    venues,
    dipendenti,
    giri,
  ]);

  const filteredSummary = useMemo(() => {
    const acc = filteredRows.reduce(
      (a, r) => {
        const opName = getAccountingName(r);
        a.conteggi += 1;
        a.locali.add(String(r.venue_id));
        a.operatori.add(opName);
        a.esattore += Number(r.esattore) || 0;
        a.acconti += Number(r.acconti) || 0;
        a.riporto += Number(r.riporto) || 0;
        a.assegni += Number(r.assegno) || 0;
        a.debiti += Number(r.debito) || 0;
        a.finaleSenzaCassaTeorica += getFinaleWithoutTheoreticalCassa(r);
        return a;
      },
      {
        conteggi: 0,
        locali: new Set(),
        operatori: new Set(),
        esattore: 0,
        acconti: 0,
        riporto: 0,
        assegni: 0,
        debiti: 0,
        cassaDepositi: 0,
        finale: 0,
        finaleSenzaCassaTeorica: 0,
      },
    );

    acc.operatori.forEach((opName) => {
      const override = adminOverridesByOperator[normalizeText(opName)];
      if (override) {
        const originalEsattore = filteredRows
          .filter((r) => getAccountingName(r) === opName)
          .reduce((sum, r) => sum + (Number(r.esattore) || 0), 0);
        const overrideEsattore = Math.trunc(
          Number(override.esattore_override) || 0,
        );
        const deltaEsattore = overrideEsattore - originalEsattore;
        acc.esattore += deltaEsattore;
        acc.finaleSenzaCassaTeorica -= deltaEsattore;
      }
      acc.cassaDepositi += getRealDepositForRows(
        filteredRows.filter((r) => getAccountingName(r) === opName),
      );
    });
    acc.finale = acc.finaleSenzaCassaTeorica + acc.cassaDepositi;
    return acc;
  }, [
    filteredRows,
    realDepositsByCode,
    dipendenti,
    venues,
    giri,
    adminOverridesByOperator,
  ]);

  const totalSummary = useMemo(() => {
    const acc = rows.reduce(
      (a, r) => {
        const opName = getAccountingName(r);
        a.conteggi += 1;
        a.locali.add(String(r.venue_id));
        a.operatori.add(opName);
        a.esattore += Number(r.esattore) || 0;
        a.acconti += Number(r.acconti) || 0;
        a.riporto += Number(r.riporto) || 0;
        a.assegni += Number(r.assegno) || 0;
        a.debiti += Number(r.debito) || 0;
        a.finaleSenzaCassaTeorica += getFinaleWithoutTheoreticalCassa(r);
        return a;
      },
      {
        conteggi: 0,
        locali: new Set(),
        operatori: new Set(),
        esattore: 0,
        acconti: 0,
        riporto: 0,
        assegni: 0,
        debiti: 0,
        cassaDepositi: 0,
        finale: 0,
        finaleSenzaCassaTeorica: 0,
      },
    );

    acc.operatori.forEach((opName) => {
      const override = adminOverridesByOperator[normalizeText(opName)];
      if (override) {
        const originalEsattore = rows
          .filter((r) => getAccountingName(r) === opName)
          .reduce((sum, r) => sum + (Number(r.esattore) || 0), 0);
        const overrideEsattore = Math.trunc(
          Number(override.esattore_override) || 0,
        );
        const deltaEsattore = overrideEsattore - originalEsattore;
        acc.esattore += deltaEsattore;
        acc.finaleSenzaCassaTeorica -= deltaEsattore;
      }
      acc.cassaDepositi += getRealDepositForRows(
        rows.filter((r) => getAccountingName(r) === opName),
      );
    });
    acc.finale = acc.finaleSenzaCassaTeorica + acc.cassaDepositi;
    return acc;
  }, [
    rows,
    venues,
    dipendenti,
    giri,
    realDepositsByCode,
    adminOverridesByOperator,
  ]);

  const debitiRows = useMemo(
    () =>
      filteredRows
        .filter((r) => Number(r.debito) !== 0)
        .sort(
          (a, b) =>
            Math.abs(Number(b.debito) || 0) - Math.abs(Number(a.debito) || 0),
        ),
    [filteredRows],
  );

  const operatorStats = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const name = getAccountingName(r);
      if (!map[name]) {
        map[name] = {
          name,
          count: 0,
          finale: 0,
          finaleSenzaCassaTeorica: 0,
          esattore: 0,
          acconti: 0,
          riporto: 0,
          cassaDepositi: 0,
          debiti: 0,
          rows: [],
        };
      }
      map[name].count += 1;
      map[name].finaleSenzaCassaTeorica += getFinaleWithoutTheoreticalCassa(r);
      map[name].esattore += Number(r.esattore) || 0;
      map[name].acconti += Number(r.acconti) || 0;
      map[name].riporto += Number(r.riporto) || 0;
      map[name].debiti += Number(r.debito) || 0;
      map[name].rows.push(r);
    });

    Object.values(map).forEach((op) => {
      const override = adminOverridesByOperator[normalizeText(op.name)];
      op.esattoreOriginal = op.esattore;
      op.esattoreOverride = override
        ? Math.trunc(Number(override.esattore_override) || 0)
        : null;
      op.esattoreDelta = override
        ? op.esattoreOverride - op.esattoreOriginal
        : 0;
      op.esattore = override ? op.esattoreOverride : op.esattoreOriginal;
      op.hasEsattoreOverride = !!override;
      op.cassaDepositi = getRealDepositForRows(op.rows);
      op.finaleSenzaCassaTeorica -= op.esattoreDelta;
      op.finale = op.finaleSenzaCassaTeorica + op.cassaDepositi;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [
    rows,
    dipendenti,
    venues,
    giri,
    realDepositsByCode,
    adminOverridesByOperator,
  ]);

  const missingVenues = useMemo(() => {
    const counted = new Set(rows.map((r) => String(r.venue_id)));
    return venues
      .filter(
        (v) =>
          v.active !== false &&
          !String(v.id || "")
            .toUpperCase()
            .startsWith("D") &&
          !counted.has(String(v.id)),
      )
      .map((v) => {
        const movements = missingVenueDeposits[String(v.id)] || {};
        const availableAcconti = Math.trunc(Number(movements.acconti) || 0);
        const recuperi = Math.trunc(Number(movements.recuperi) || 0);
        const daRiportare = Math.trunc(Number(movements.daRiportare) || 0);
        return {
          ...v,
          availableAcconti,
          recuperi,
          daRiportare,
          status:
            recuperi === daRiportare
              ? "ok"
              : recuperi < daRiportare
                ? "warning"
                : "error",
          difference: Math.abs(daRiportare - recuperi),
        };
      })
      .sort(sortVenueIds);
  }, [rows, venues, missingVenueDeposits]);

  async function openFinalization() {
    if (!selectedPeriod || isClosed) return;
    setPeriodMenuOpen(false);
    setFinalization({
      open: true,
      step: "carryovers",
      preview: null,
      newDateTo: "",
      loading: true,
    });
    try {
      const { data, error } = await supabase.rpc(
        "prepara_finalizzazione_conteggi",
        {
          p_period_id: selectedPeriod.id,
        },
      );
      if (error) throw error;
      setFinalization({
        open: true,
        step: "carryovers",
        preview: data,
        newDateTo: data?.suggested_date_to || data?.new_date_from || "",
        loading: false,
      });
    } catch (e) {
      setFinalization({
        open: false,
        step: "carryovers",
        preview: null,
        newDateTo: "",
        loading: false,
      });
      toast.error(`Preparazione finalizzazione: ${e.message}`);
    }
  }

  function closeFinalization() {
    if (finalization.loading) return;
    setFinalization({
      open: false,
      step: "carryovers",
      preview: null,
      newDateTo: "",
      loading: false,
    });
  }

  function advanceFinalization() {
    const hasMissing = (finalization.preview?.missing_venues || []).length > 0;
    setFinalization((current) => ({
      ...current,
      step:
        current.step === "carryovers"
          ? hasMissing
            ? "missing"
            : "archive"
          : current.step === "missing"
            ? "archive"
            : current.step === "archive"
              ? "new-period"
              : current.step,
    }));
  }

  function backFinalization() {
    const hasMissing = (finalization.preview?.missing_venues || []).length > 0;
    setFinalization((current) => ({
      ...current,
      step:
        current.step === "new-period"
          ? "archive"
          : current.step === "archive"
            ? hasMissing
              ? "missing"
              : "carryovers"
            : "carryovers",
    }));
  }

  async function finalizePeriod() {
    const preview = finalization.preview;
    if (!selectedPeriod || !preview) return;
    if (
      !finalization.newDateTo ||
      finalization.newDateTo < preview.new_date_from
    ) {
      toast.warning(
        "La data finale deve essere uguale o successiva alla data iniziale",
      );
      return;
    }
    let timer;
    try {
      setFinalization((current) => ({
        ...current,
        loading: true,
        step: "processing",
        progress: 1,
        progressMessage: "Preparazione dati",
        error: "",
      }));
      const started = Date.now();
      timer = window.setInterval(() => {
        setFinalization((current) => {
          if (current.step !== "processing") return current;
          const elapsed = Date.now() - started;
          const next = Math.min(
            93,
            Math.max(current.progress + 1, Math.round(1 + elapsed / 120)),
          );
          const message =
            next < 18
              ? "Preparazione dati"
              : next < 36
                ? "Verifica conteggi"
                : next < 55
                  ? "Archiviazione periodo"
                  : next < 72
                    ? "Trasferimento Da riportare"
                    : "Creazione nuovo periodo";
          return { ...current, progress: next, progressMessage: message };
        });
      }, 120);
      const { data, error } = await supabase.rpc("finalizza_periodo_conteggi", {
        p_period_id: selectedPeriod.id,
        p_new_date_to: finalization.newDateTo,
        p_preview_fingerprint: preview.fingerprint,
        p_missing_venues_confirmed: (preview.missing_venues || []).length > 0,
      });
      if (error) throw error;
      if (!data?.success)
        throw new Error("La finalizzazione non è stata confermata dal server");
      window.clearInterval(timer);
      setFinalization((current) => ({
        ...current,
        progress: 100,
        progressMessage: "Operazione completata",
        loading: false,
      }));
      await loadPeriods();
      setPeriodView("active");
      setSelectedPeriodId(data.new_period_id);
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      setFinalization({
        open: false,
        step: "carryovers",
        preview: null,
        newDateTo: "",
        loading: false,
        progress: 1,
        progressMessage: "",
        error: "",
      });
      toast.success(
        `Periodo finalizzato • ${fmtEuro(data.da_riportare_trasferiti)} trasferiti`,
      );
    } catch (e) {
      window.clearInterval(timer);
      const changed = /cambiati|fingerprint|controlla nuovamente/i.test(
        e?.message || "",
      );
      if (changed) {
        toast.warning(
          "I dati sono cambiati: controlla nuovamente i Da Riportare",
        );
        await openFinalization();
      } else {
        setFinalization((current) => ({
          ...current,
          step: "new-period",
          loading: false,
          error: e.message,
          progressMessage: "Operazione interrotta",
        }));
        toast.error(`Finalizzazione: ${e.message}`);
      }
    }
  }

  async function handleGeneratePdf(title, pdfRows) {
    if (!pdfRows.length) {
      toast.warning("Nessun conteggio da esportare");
      return;
    }
    let previewWindow = null;
    try {
      previewWindow = createPdfPreviewWindow();
      const venuesSelected = pdfRows.map((r) => {
      const venue = venueById[String(r.venue_id)];
      return {
        id: r.venue_id,
        name: venue?.name || r.venue_id || "Locale sconosciuto",
      };
    });
      const toolData = {};
      pdfRows.forEach((r) => {
      toolData[r.venue_id] = { ...r, ricevute: r.acconti };
    });
      const operatorNames = Array.from(
        new Set(pdfRows.map((r) => getAccountingName(r)).filter(Boolean)),
      );
      const realCassaDepositi = operatorNames.reduce(
      (sum, name) =>
        sum +
        getRealDepositForRows(
          pdfRows.filter((r) => getAccountingName(r) === name),
        ),
      0,
    );
      const esattoreOverride = operatorNames.length
      ? operatorNames.reduce((sum, name) => {
          const operatorRows = pdfRows.filter(
            (r) => getAccountingName(r) === name,
          );
          const original = operatorRows.reduce(
            (acc, r) => acc + (Number(r.esattore) || 0),
            0,
          );
          const override = adminOverridesByOperator[normalizeText(name)];
          return (
            sum +
            (override
              ? Math.trunc(Number(override.esattore_override) || 0)
              : original)
          );
        }, 0)
      : null;

      await generateConteggiPdf({
      venuesSelected,
      totalsByVenueId: {},
      toolData,
      dateFrom: selectedPeriod?.date_from,
      dateTo: selectedPeriod?.date_to,
      dipendenteName: title,
      userEmail: "",
      targetWin: previewWindow,
      realCassaDepositi,
      esattoreOverride,
      });
      toast.success("PDF aperto in anteprima");
    } catch (error) {
      closePdfPreviewWindow(previewWindow);
      toast.error(error.message || "Impossibile generare il PDF");
    }
  }

  const activeFiltersCount =
    (operatorFilter !== "all" ? 1 : 0) +
    (venueFilter !== "all" ? 1 : 0) +
    (signFilter !== "all" ? 1 : 0);

  function getOverrideInputValue(operatorName, fallbackValue = 0) {
    const key = normalizeText(operatorName);
    if (Object.prototype.hasOwnProperty.call(overrideInputsByOperator, key))
      return overrideInputsByOperator[key];
    return String(Math.trunc(Number(fallbackValue) || 0));
  }

  function setOverrideInputValue(operatorName, value) {
    const key = normalizeText(operatorName);
    setOverrideInputsByOperator((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEsattoreOverride(operatorName, originalValue) {
    if (!selectedPeriodId || !operatorName) return;

    const key = normalizeText(operatorName);
    const rawValue = String(getOverrideInputValue(operatorName, originalValue))
      .replace(",", ".")
      .trim();
    const parsedValue = Math.trunc(Number(rawValue));

    if (!Number.isFinite(parsedValue)) {
      toast.warning("Inserisci un importo esattore valido");
      return;
    }

    try {
      setSavingOverrideOperator(key);
      const { data, error } = await supabase
        .from("conteggi_admin_overrides")
        .upsert(
          {
            period_id: selectedPeriodId,
            operator_name: operatorName,
            esattore_override: parsedValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "period_id,operator_name" },
        )
        .select("id,period_id,operator_name,esattore_override")
        .single();
      if (error) throw error;

      setAdminOverridesByOperator((prev) => ({
        ...prev,
        [key]: {
          ...data,
          esattore_override: Math.trunc(Number(data.esattore_override) || 0),
        },
      }));
      setOverrideInputsByOperator((prev) => ({
        ...prev,
        [key]: String(parsedValue),
      }));
      toast.success(`Esattore rettificato per ${operatorName}`);
    } catch (e) {
      toast.error(`Rettifica esattore: ${e.message}`);
    } finally {
      setSavingOverrideOperator("");
    }
  }

  async function resetEsattoreOverride(operatorName) {
    if (!selectedPeriodId || !operatorName) return;
    const key = normalizeText(operatorName);

    try {
      setSavingOverrideOperator(key);
      const { error } = await supabase
        .from("conteggi_admin_overrides")
        .delete()
        .eq("period_id", selectedPeriodId)
        .eq("operator_name", operatorName);
      if (error) throw error;

      setAdminOverridesByOperator((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setOverrideInputsByOperator((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success(`Rettifica rimossa per ${operatorName}`);
    } catch (e) {
      toast.error(`Rimozione rettifica: ${e.message}`);
    } finally {
      setSavingOverrideOperator("");
    }
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_15%_0%,rgba(226,186,99,.16),transparent_28%),linear-gradient(180deg,#f7f2e8_0%,#f4f0e8_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
            <section className="relative overflow-visible rounded-[30px] border border-[#dfc98f] bg-[linear-gradient(135deg,#fffdf8_0%,#f4e5bf_100%)] px-4 py-5 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
              <div className="pointer-events-none absolute -left-16 -top-24 h-60 w-60 rounded-full bg-white/75 blur-3xl" />
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />

              <div className="relative min-h-[92px]">
                <div className="mx-auto flex max-w-[900px] flex-col items-center justify-center px-14 text-center">
                  <h1 className="text-[29px] font-black tracking-[0.13em] text-[#3d2a0b] md:text-[35px]">
                    SEZIONE CONTEGGI
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[#6d4a11]">
                    <span className="text-[10px] font-black tracking-[0.22em] text-[#a47624]">
                      {periodView === "archive" ? "PERIODO ARCHIVIATO" : "PERIODO ATTIVO"}
                    </span>
                    <span className="text-[16px] font-black tabular-nums md:text-[19px]">
                      {selectedPeriod
                        ? `${formatITDate(selectedPeriod.date_from)} — ${formatITDate(selectedPeriod.date_to)}`
                        : "NESSUN PERIODO SELEZIONATO"}
                    </span>
                    {selectedPeriod && isClosed && (
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-black tracking-[0.15em] text-white">
                        CHIUSO
                      </span>
                    )}
                  </div>
                </div>

                <div className="absolute right-0 top-0 z-40 flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => loadDashboard()}
                    disabled={!selectedPeriodId || loading}
                    className="flex h-12 items-center justify-center gap-2 rounded-[16px] border border-[#d8b86c] bg-white px-4 text-[10px] font-black tracking-[0.08em] text-[#755019] shadow-[0_13px_24px_-17px_rgba(116,79,17,.48)] transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-45"
                  >
                    <RefreshCw
                      size={15}
                      className={loading ? "animate-spin" : ""}
                    />{" "}
                    AGGIORNA
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPeriodMenuOpen((v) => !v)}
                      className={`group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[16px] border transition-all duration-200 active:scale-95 ${periodMenuOpen ? "border-[#c89d4b] bg-[linear-gradient(145deg,#fff4d3,#e6c371)] text-[#69450e] shadow-[0_15px_28px_-18px_rgba(116,79,17,.55)]" : "border-[#d8b86c] bg-[linear-gradient(145deg,#fffaf0,#ecd18f)] text-[#755019] shadow-[0_13px_24px_-17px_rgba(116,79,17,.48)] hover:-translate-y-0.5 hover:brightness-102"}`}
                      aria-label="Apri gestione periodo"
                    >
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_18%,rgba(255,236,177,.28),transparent_46%)]" />
                      {periodMenuOpen ? (
                        <X size={19} className="relative z-10" />
                      ) : (
                        <MoreVertical
                          size={22}
                          strokeWidth={2.9}
                          className="relative z-10"
                        />
                      )}
                    </button>

                    {periodMenuOpen && (
                      <div className="absolute right-0 mt-2 w-[300px] overflow-hidden rounded-[22px] border border-[#d9c28d] bg-[#fffdf8] p-3 shadow-[0_28px_70px_-30px_rgba(45,28,4,.85)]">
                        <p className="px-1 pb-2 text-[9px] font-black tracking-[0.22em] text-[#a0711f]">
                          CONTEGGI
                        </p>
                        <div className="grid gap-2">
                          <button
                            onClick={() => {
                              setPeriodView(
                                periodView === "active" ? "archive" : "active",
                              );
                              setPeriodMenuOpen(false);
                            }}
                            className="flex h-11 items-center justify-center gap-2 rounded-[13px] border border-[#dfcfad] bg-white text-[10px] font-black text-slate-600"
                          >
                            {periodView === "active" ? (
                              <Archive size={14} />
                            ) : (
                              <Calendar size={14} />
                            )}{" "}
                            {periodView === "active"
                              ? "ARCHIVIO"
                              : "PERIODO ATTIVO"}
                          </button>
                          {periodView === "archive" && visiblePeriods.length > 0 && (
                            <div className="max-h-[280px] overflow-y-auto rounded-[14px] border border-[#e4d5b5] bg-[#fbf7ee] p-2">
                              <p className="px-2 pb-2 text-[8px] font-black tracking-[0.16em] text-[#9b742d]">
                                PERIODI ARCHIVIATI
                              </p>
                              <div className="grid gap-1.5">
                                {visiblePeriods.map((period) => (
                                  <button
                                    key={period.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPeriodId(period.id);
                                      setPeriodMenuOpen(false);
                                    }}
                                    className={`rounded-[11px] border px-3 py-2.5 text-left transition ${selectedPeriodId === period.id ? "border-[#b7892f] bg-[#fff1c7]" : "border-[#e5d8bd] bg-white hover:bg-[#fffaf0]"}`}
                                  >
                                    <span className="block text-[10px] font-black tabular-nums text-[#4b350f]">
                                      {formatITDate(period.date_from)} — {formatITDate(period.date_to)}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[8px] font-bold text-black/40">
                                      {period.title || "Periodo conteggi"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {!isClosed && selectedPeriod && (
                            <button
                              onClick={openFinalization}
                              className="flex h-11 items-center justify-center gap-2 rounded-[13px] bg-[linear-gradient(135deg,#c99635,#8d5d13)] text-[10px] font-black tracking-[0.08em] text-white"
                            >
                              <CheckCircle2 size={15} />
                              FINALIZZA
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#dfcfaa] bg-[#fffdf9] shadow-[0_24px_55px_-38px_rgba(65,43,8,.68)]">
              <div className="relative border-b border-[#eadfca] px-4 py-4 text-center">
                <h2 className="text-[21px] font-black tracking-[0.18em] text-[#946318] md:text-[26px]">
                  RIEPILOGO GENERALE
                </h2>
                <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleGeneratePdf("Riepilogo generale", rows)
                    }
                    disabled={!rows.length}
                    className="group flex h-10 min-w-[94px] items-center justify-center gap-2 rounded-[13px] border border-[#d3b469] bg-[linear-gradient(145deg,#fff8e6,#e9cd86)] px-3.5 text-[10px] font-black tracking-[0.11em] text-[#68450e] shadow-[0_10px_20px_-14px_rgba(111,72,10,.52)] transition hover:-translate-y-0.5 hover:brightness-102 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileText size={14} /> PDF
                  </button>
                  <span className="flex h-10 min-w-[94px] items-center justify-center rounded-[13px] border border-[#b98529] bg-[linear-gradient(145deg,#fff5d8,#e6c675)] px-3.5 text-[9px] font-black text-[#70480d] shadow-[0_9px_18px_-14px_rgba(111,72,10,.72)]">
                    {totalSummary.conteggi}{" "}
                    {totalSummary.conteggi === 1 ? "CONTEGGIO" : "CONTEGGI"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {[
                  ["ESATTORE", totalSummary.esattore],
                  ["ACCONTI", totalSummary.acconti],
                  ["DA RIPORTARE", totalSummary.riporto],
                  ["DEPOSITI", totalSummary.cassaDepositi],
                  ["DEBITI", totalSummary.debiti],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-r border-[#eee5d4] px-5 py-8 text-center xl:border-b-0"
                  >
                    <p className="text-[11px] font-black tracking-[0.18em] text-slate-500 md:text-[12px]">
                      {label}
                    </p>
                    <p className="mt-3 text-[27px] font-black tabular-nums text-[#33250f] md:text-[31px]">
                      {fmtEuro(value)}
                    </p>
                  </div>
                ))}
                <div
                  className={`relative overflow-hidden px-5 py-8 text-center ${totalSummary.finale > 0 ? "bg-emerald-50" : totalSummary.finale < 0 ? "bg-rose-50" : "bg-[#f7efdf]"}`}
                >
                  <div className="absolute right-[-30px] top-[-35px] h-24 w-24 rounded-full bg-white/55 blur-2xl" />
                  <p className="relative text-[11px] font-black tracking-[0.18em] text-[#8c641f] md:text-[12px]">
                    TOTALE
                  </p>
                  <p
                    className={`relative mt-3 text-[32px] font-black tabular-nums md:text-[36px] ${clsSigned(totalSummary.finale)}`}
                  >
                    {fmtSigned(totalSummary.finale)}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 text-center">
                <h2 className="text-[16px] font-black tracking-[0.15em] text-[#a06d18] md:text-[19px]">
                  RIEPILOGHI SINGOLI DIPENDENTI
                </h2>
              </div>
              {loading ? (
                <div className="rounded-[24px] border border-[#e3d8c2] bg-white p-8 text-center text-sm font-bold text-slate-400">
                  Caricamento conteggi…
                </div>
              ) : operatorStats.length === 0 ? (
                <div className="rounded-[24px] border border-[#e3d8c2] bg-white p-8 text-center">
                  <Users className="mx-auto text-[#b58a3e]" />
                  <p className="mt-3 font-black text-slate-700">
                    Nessun conteggio nel periodo
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {operatorStats.map((op) => {
                    const open = !!expandedOperators[op.name];
                    const key = normalizeText(op.name);
                    const hasOverride = Boolean(adminOverridesByOperator[key]);
                    const saving = savingOverrideOperator === key;
                    const hasConteggi = op.rows.length > 0;
                    return (
                      <article
                        key={op.name}
                        className={`overflow-hidden rounded-[24px] border bg-[#fffdf9] shadow-[0_20px_42px_-34px_rgba(61,39,4,.75)] transition ${open ? "border-[#c99a43]" : hasConteggi ? "border-[#d5b76e]" : "border-[#e2d6bf]"}`}
                      >
                        <div
                          className={`relative overflow-hidden border-b border-[#eee3cf] px-3 py-3 ${hasConteggi ? "bg-[linear-gradient(135deg,#fff4d5,#e9c977)]" : "bg-[linear-gradient(135deg,#fffaf0,#f0e5cf)]"}`}
                        >
                          <div className="absolute -right-8 -top-12 h-28 w-28 rounded-full bg-amber-300/20 blur-3xl" />
                          <div className="relative flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOperators((prev) => ({
                                  ...prev,
                                  [op.name]: !prev[op.name],
                                }))
                              }
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <p className="min-w-0 flex-1 truncate text-[15px] font-black uppercase tracking-[0.055em] text-[#3b2a0e]">
                                GIRO: {getGiroName(op)}
                              </p>
                            </button>
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-[#d1b266] bg-[linear-gradient(145deg,#fff6db,#e8c97c)] px-2 text-[10px] font-black tabular-nums text-[#68450e] shadow-[0_6px_12px_-9px_rgba(98,60,5,.38)]">
                              {op.rows.length}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleGeneratePdf(
                                  `GIRO ${getGiroName(op)}`,
                                  op.rows,
                                );
                              }}
                              className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-[#cda957] bg-white/75 px-2.5 text-[9px] font-black tracking-[0.08em] text-[#795116] shadow-sm transition hover:-translate-y-0.5 hover:bg-white active:scale-95"
                              title={`Genera PDF del Giro ${getGiroName(op)}`}
                              aria-label={`Genera PDF del Giro ${getGiroName(op)}`}
                            >
                              <FileText size={13} />
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOperators((prev) => ({
                                  ...prev,
                                  [op.name]: !prev[op.name],
                                }))
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#8f651d] transition hover:bg-white/55"
                              aria-label={`Apri dettagli ${op.name}`}
                            >
                              {open ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="relative overflow-hidden border-b border-[#d6b36b] bg-[linear-gradient(135deg,#3f2b0d_0%,#765018_55%,#b8862f_100%)] px-3 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
                          <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-200/20 blur-2xl" />
                          <div className="relative flex items-center gap-2">
                            <div className="flex h-10 shrink-0 items-center gap-2 px-1">
                              <span className="text-[10px] font-black tracking-[0.18em] text-amber-100">
                                ESATTORE
                              </span>
                              <Pencil size={13} className="text-amber-200" />
                            </div>
                            <div className="relative min-w-0 flex-1">
                              <input
                                inputMode="numeric"
                                value={getOverrideInputValue(
                                  op.name,
                                  op.esattore,
                                )}
                                onChange={(e) =>
                                  setOverrideInputValue(
                                    op.name,
                                    e.target.value.replace(/[^0-9-]/g, ""),
                                  )
                                }
                                className="h-10 w-full rounded-[12px] border border-white/20 bg-black/20 px-3 pr-8 text-right text-[17px] font-black tabular-nums text-white outline-none focus:border-amber-200"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-black text-amber-100">
                                €
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                saveEsattoreOverride(op.name, op.esattore)
                              }
                              disabled={saving}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(145deg,#fff0a8,#d6a837)] text-[#4b3209] shadow-[0_9px_18px_-12px_rgba(255,215,94,.95)] transition active:scale-95 disabled:opacity-50"
                            >
                              {saving ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Save size={15} />
                              )}
                            </button>
                            {hasOverride && (
                              <button
                                onClick={() => resetEsattoreOverride(op.name)}
                                disabled={saving}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-white/20 bg-white/10 text-white transition active:scale-95"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOperators((prev) => ({
                              ...prev,
                              [op.name]: !prev[op.name],
                            }))
                          }
                          className="w-full text-left"
                        >
                          <div className="divide-y divide-[#eee7da] px-3">
                            {[
                              ["ACCONTI", op.acconti],
                              ["DA RIPORTARE", op.riporto],
                              ["DEPOSITI", op.cassaDepositi],
                              ["DEBITI", op.debiti],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="flex items-center justify-between py-2.5"
                              >
                                <span className="text-[9px] font-black tracking-[0.12em] text-slate-400">
                                  {label}
                                </span>
                                <span className="text-[13px] font-black tabular-nums text-slate-800">
                                  {fmtEuro(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div
                            className={`flex items-center justify-between px-4 py-3 ${op.finale > 0 ? "bg-emerald-50" : op.finale < 0 ? "bg-rose-50" : "bg-[#f6eedf]"}`}
                          >
                            <span className="text-[10px] font-black tracking-[0.14em] text-[#7d5819]">
                              TOTALE
                            </span>
                            <span
                              className={`text-[20px] font-black tabular-nums ${clsSigned(op.finale)}`}
                            >
                              {fmtSigned(op.finale)}
                            </span>
                          </div>
                        </button>
                        {open && (
                          <div className="border-t border-[#e8dcc5] bg-[#faf7f1] p-3">
                            <div className="space-y-2">
                              {op.rows.map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => setSelectedRow(r)}
                                  className="flex w-full items-center justify-between rounded-[13px] border border-[#e8dfcf] bg-white px-3 py-2 text-left"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-black text-slate-800">
                                      {getVenueName(r)}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400">
                                      {formatITDate(r.conteggio_date)} ·
                                      Effettuato da {getOperatorName(r)}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[12px] font-black ${clsSigned(r.totale_finale)}`}
                                  >
                                    {fmtSigned(r.totale_finale)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#d9c79f] bg-[linear-gradient(180deg,#f7edd8_0%,#f2e5cd_100%)] shadow-[0_22px_48px_-36px_rgba(65,43,8,.65)]">
              <div className="border-b border-[#dfcfaf] bg-[linear-gradient(135deg,#f8edd7,#ead5aa)] px-4 py-4 text-center">
                <h2 className="text-[20px] font-black tracking-[0.17em] text-[#8d5f17] md:text-[24px]">
                  LOCALI DISPONIBILI
                </h2>
              </div>
              {missingVenues.length === 0 ? (
                <div className="p-8 text-center text-sm font-black text-emerald-700">
                  Tutti i locali sono stati conteggiati
                </div>
              ) : (
                <div className="overflow-x-auto p-3 md:p-4">
                  <div
                    className="min-w-[980px] items-center gap-3 border-b border-[#d8c7a8] px-4 pb-3"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(300px, 1.6fr) repeat(3, minmax(150px, 0.72fr)) 96px",
                    }}
                  >
                    <p className="text-[10px] font-black tracking-[0.16em] text-[#7c5a20]">
                      LOCALE
                    </p>
                    <p className="text-center text-[10px] font-black tracking-[0.16em] text-blue-600/75">
                      ACCONTI
                    </p>
                    <p className="text-center text-[10px] font-black tracking-[0.16em] text-orange-600/75">
                      RECUPERI
                    </p>
                    <p className="text-center text-[10px] font-black tracking-[0.14em] text-emerald-600/75">
                      DA RIPORTARE
                    </p>
                    <p className="text-center text-[10px] font-black tracking-[0.16em] text-[#7c5a20]">
                      STATO
                    </p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {missingVenues.map((v, index) => {
                      const statusStyles =
                        v.status === "ok"
                          ? "border-emerald-300/75 bg-emerald-100/60 text-emerald-700 hover:bg-emerald-100"
                          : v.status === "warning"
                            ? "border-orange-300/75 bg-orange-100/60 text-orange-700 hover:bg-orange-100"
                            : "border-rose-300/75 bg-rose-100/60 text-rose-700 hover:bg-rose-100";
                      const rowGlow =
                        v.status === "warning"
                          ? "shadow-[inset_4px_0_0_rgba(251,146,60,.26)]"
                          : v.status === "error"
                            ? "shadow-[inset_4px_0_0_rgba(244,63,94,.22)]"
                            : "shadow-[inset_4px_0_0_rgba(16,185,129,.12)]";
                      return (
                        <div
                          key={v.id}
                          className={`min-h-[62px] min-w-[980px] items-center gap-3 rounded-[16px] border border-[#ddcdb0] px-4 py-2.5 transition hover:-translate-y-[1px] hover:border-[#cfb981] hover:shadow-[0_12px_24px_-20px_rgba(72,45,7,.45)] ${index % 2 === 0 ? "bg-[#fffaf1]" : "bg-[#f9f0df]"} ${rowGlow}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "minmax(300px, 1.6fr) repeat(3, minmax(150px, 0.72fr)) 96px",
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 min-w-14 items-center justify-center rounded-[12px] border border-[#ddc99f] bg-[#f2e3c5] px-2 font-mono text-[11px] font-black text-[#7c5315]">
                              {v.id}
                            </div>
                            <p className="min-w-0 truncate text-[14px] font-black text-[#302610] md:text-[15px]">
                              {v.name}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="hidden">ACCONTI</p>
                            <p className="text-[15px] font-black tabular-nums text-blue-700 md:text-[16px]">
                              {fmtEuro(v.availableAcconti)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="hidden">RECUPERI</p>
                            <p className="text-[15px] font-black tabular-nums text-orange-700 md:text-[16px]">
                              {fmtEuro(v.recuperi)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="hidden">DA RIPORTARE</p>
                            <p className="text-[15px] font-black tabular-nums text-emerald-700 md:text-[16px]">
                              {fmtEuro(v.daRiportare)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setVenueStatusPopup(v)}
                            title="Clicca per i dettagli"
                            className={`group flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border transition hover:-translate-y-0.5 active:scale-95 ${statusStyles}`}
                            aria-label={`Apri dettagli stato ${v.name}`}
                          >
                            {v.status === "ok" ? (
                              <CheckCircle2 size={17} />
                            ) : v.status === "warning" ? (
                              <TriangleAlert size={17} />
                            ) : (
                              <CircleX size={17} />
                            )}
                            <ChevronRight
                              size={15}
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </PageBody>
      {venueStatusPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setVenueStatusPopup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-[420px] overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,#07111f_0%,#0d1728_58%,#07111f_100%)] p-5 shadow-[0_30px_80px_-28px_rgba(0,0,0,.95)] ${venueStatusPopup.status === "ok" ? "border-emerald-400/35" : venueStatusPopup.status === "warning" ? "border-orange-400/35" : "border-rose-400/35"}`}
          >
            <div
              className={`absolute -left-10 -top-10 h-32 w-32 rounded-full blur-3xl ${venueStatusPopup.status === "ok" ? "bg-emerald-400/25" : venueStatusPopup.status === "warning" ? "bg-orange-400/25" : "bg-rose-400/25"}`}
            />
            <button
              type="button"
              onClick={() => setVenueStatusPopup(null)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/5 text-white"
            >
              <X size={15} />
            </button>
            <div
              className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${venueStatusPopup.status === "ok" ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-300" : venueStatusPopup.status === "warning" ? "border-orange-300/45 bg-orange-500/15 text-orange-300" : "border-rose-300/45 bg-rose-500/15 text-rose-300"}`}
            >
              {venueStatusPopup.status === "ok" ? (
                <CheckCircle2 size={29} />
              ) : venueStatusPopup.status === "warning" ? (
                <TriangleAlert size={29} />
              ) : (
                <CircleX size={29} />
              )}
            </div>
            <p className="relative mt-4 text-center text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
              {venueStatusPopup.id} · {venueStatusPopup.name}
            </p>
            <h3 className="relative mt-2 text-center text-[19px] font-black text-white">
              {venueStatusPopup.status === "ok"
                ? "Situazione regolare"
                : venueStatusPopup.status === "warning"
                  ? "Da Riportare ancora presente"
                  : "Anomalia nei recuperi"}
            </h3>
            <p className="relative mt-3 text-center text-[13px] font-bold leading-relaxed text-slate-300">
              {venueStatusPopup.status === "ok"
                ? "Recuperi e Da Riportare coincidono."
                : venueStatusPopup.status === "warning"
                  ? `È presente ancora un Da Riportare di ${fmtEuro(venueStatusPopup.daRiportare - venueStatusPopup.recuperi)}.`
                  : "Recuperi più alti dei Da Riportare."}
            </p>
            <button
              type="button"
              onClick={() => setVenueStatusPopup(null)}
              className={`relative mt-5 h-12 w-full rounded-[16px] text-[12px] font-black uppercase tracking-[0.12em] text-white ${venueStatusPopup.status === "ok" ? "bg-[linear-gradient(135deg,#059669,#047857)]" : venueStatusPopup.status === "warning" ? "bg-[linear-gradient(135deg,#d97706,#c2410c)]" : "bg-[linear-gradient(135deg,#e11d48,#be123c)]"}`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtri"
        width="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOperatorFilter("all");
                setVenueFilter("all");
                setSignFilter("all");
              }}
            >
              Azzera
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Applica
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Agente">
            <Select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
            >
              <option value="all">Tutti gli agenti</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Locale">
            <Select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
            >
              <option value="all">Tutti i locali</option>
              {countedVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Risultato">
            <Select
              value={signFilter}
              onChange={(e) => setSignFilter(e.target.value)}
            >
              <option value="all">Tutti i risultati</option>
              <option value="positive">Solo positivi</option>
              <option value="negative">Solo negativi</option>
              <option value="zero">Solo zero</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <FinalizationWizard
        state={finalization}
        period={selectedPeriod}
        onClose={closeFinalization}
        onNext={advanceFinalization}
        onBack={backFinalization}
        onDateToChange={(value) =>
          setFinalization((current) => ({ ...current, newDateTo: value }))
        }
        onFinalize={finalizePeriod}
      />

      {selectedRow && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-[470px] flex-col overflow-hidden rounded-[30px] border border-[#c99635] bg-[linear-gradient(180deg,#f8f4eb_0%,#f2ede3_100%)] shadow-[0_38px_100px_-30px_rgba(0,0,0,.95)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#d9c49a] bg-[linear-gradient(135deg,#fff9eb,#ead18e)] px-5 py-4 text-center">
              <p className="text-[9px] font-black tracking-[0.24em] text-[#986619]">
                FOTOGRAFIA DEL CONTEGGIO
              </p>
              <p className="mt-1 text-[11px] font-bold text-[#74501a]">
                {formatITDate(selectedRow.conteggio_date)} · Effettuato da{" "}
                {getOperatorName(selectedRow)}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="rounded-[18px] border border-[#ddd7cc] bg-white/90 px-4 py-3 shadow-[0_10px_20px_-20px_rgba(23,32,50,.6)]">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#a06b13]">
                  LOCALE · {selectedRow.venue_id}
                </p>
                <p className="mt-1 text-[16px] font-black uppercase text-slate-900">
                  {getVenueName(selectedRow)}
                </p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                  {venueById[String(selectedRow.venue_id)]?.city ||
                    "Città non indicata"}
                </p>
              </div>

              <div className="mt-3 flex min-h-[68px] items-center justify-between rounded-[20px] border border-[#9d670e] bg-[linear-gradient(110deg,#8a5806_0%,#d9a70f_58%,#936009_100%)] px-4 text-white shadow-[0_18px_32px_-24px_rgba(108,66,1,.9)]">
                <span className="text-[15px] font-black uppercase">
                  ESATTORE
                </span>
                <span className="text-[29px] font-black tabular-nums">
                  {fmtEuro(selectedRow.esattore)}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <SnapshotRow label="ACCONTI" value={selectedRow.acconti} />
                <SnapshotRow label="CARTA" value={selectedRow.carta} />
                <SnapshotRow label="MONETE" value={selectedRow.monete} />
                <SnapshotRow label="DA RIPORTARE" value={selectedRow.riporto} />
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    ["DA RIPORTARE ORIGINALE", (Number(selectedRow.riporto) || 0) + (Number(selectedRow.rp_day2) || 0) + (Number(selectedRow.rp_day3) || 0) + (Number(selectedRow.rp_day4) || 0)],
                    ["GIORNO 2", selectedRow.rp_day2],
                    ["GIORNO 3", selectedRow.rp_day3],
                    ["GIORNO 4", selectedRow.rp_day4],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-[14px] border border-[#dcc89d] bg-[#fff9ec] px-2 py-2.5 text-center shadow-[0_8px_18px_-18px_rgba(91,57,5,.8)]">
                      <p className="min-h-[22px] text-[6.5px] font-black uppercase leading-[1.15] tracking-[.07em] text-[#8b5b12]">{label}</p>
                      <p className="mt-1 text-[12px] font-black tabular-nums text-slate-900">{Number(value) ? fmtEuro(value) : "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#d9c8a4]" />
                <span className="text-[9px] font-black tracking-[0.22em] text-[#8c5b0e]">
                  VOCI EXTRA
                </span>
                <span className="h-px flex-1 bg-[#d9c8a4]" />
              </div>
              <div className="space-y-2">
                <SnapshotRow label="USO CASSA" value={selectedRow.uso_cassa} />
                <SnapshotRow label="DEBITO" value={selectedRow.debito} danger />
              </div>
            </div>

            <div className="border-t border-[#cda85d] bg-[#f6efe1] p-4 shadow-[0_-16px_30px_-28px_rgba(62,38,2,.8)]">
              <div className="mb-2 flex items-end justify-between px-1">
                <span className="pb-1 text-[11px] font-black tracking-[0.12em] text-slate-900">
                  TOTALE
                </span>
                <span
                  className={`text-[36px] font-black tabular-nums ${clsSigned(selectedRow.totale_finale)}`}
                >
                  {fmtSigned(selectedRow.totale_finale)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="h-12 w-full rounded-[15px] border border-[#95600b] bg-[linear-gradient(110deg,#7c4d03,#d4a10d,#855405)] text-[12px] font-black tracking-[0.14em] text-white shadow-[0_13px_24px_-17px_rgba(91,55,3,.9)] transition active:scale-[.98]"
              >
                CHIUDI DETTAGLIO
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function FinalizationWizard({
  state,
  period,
  onClose,
  onNext,
  onBack,
  onDateToChange,
  onFinalize,
}) {
  if (!state.open) return null;
  const preview = state.preview;
  const employees = preview?.employee_totals || [];
  const missing = preview?.missing_venues || [];
  const isFirst = state.step === "carryovers";
  const isLast = state.step === "new-period";
  const titles = {
    carryovers: "CONFERMA DA RIPORTARE",
    missing: "LOCALI NON CONTEGGIATI",
    archive: "CHIUSURA PERIODO",
    "new-period": "NUOVO PERIODO",
    processing: "FINALIZZAZIONE IN CORSO",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-[620px] overflow-hidden rounded-[28px] border border-[#d8bd7e] bg-[#fffdf8] shadow-[0_35px_90px_-30px_rgba(0,0,0,.85)]">
        <div className="border-b border-[#e6d8ba] bg-[linear-gradient(135deg,#fff4d4,#e8c875)] px-5 py-4 text-center">
          <p className="text-[9px] font-black tracking-[0.22em] text-[#9a6a18]">
            FINALIZZA PERIODO
          </p>
          <h2 className="mt-1 text-[19px] font-black tracking-[0.08em] text-[#3e2a0b]">
            {titles[state.step]}
          </h2>
          {period && (
            <p className="mt-1 text-[11px] font-bold text-[#7a5619]">
              {formatITDate(period.date_from)} — {formatITDate(period.date_to)}
            </p>
          )}
        </div>

        <div className="max-h-[66vh] overflow-y-auto p-5">
          {state.step === "processing" ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-2 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#ead7aa] bg-white shadow-inner">
                <span className="text-[22px] font-black tabular-nums text-[#8b5d14]">
                  {state.progress || 1}%
                </span>
              </div>
              <div className="mt-6 h-3 w-full overflow-hidden rounded-full border border-[#dfc98f] bg-[#f5ead0]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#e7c977,#a96f16)] transition-[width] duration-200"
                  style={{ width: `${state.progress || 1}%` }}
                />
              </div>
              <p className="mt-4 text-[13px] font-black uppercase tracking-[.12em] text-[#6d480d]">
                {state.progressMessage}
              </p>
              {state.error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-700">
                  {state.error}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">
                  Non chiudere la pagina. Il 100% apparirà solo dopo la conferma
                  di Supabase.
                </p>
              )}
            </div>
          ) : state.loading && !preview ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-[#8b641f]">
              <RefreshCw size={26} className="animate-spin" />
              <p className="text-[11px] font-black uppercase tracking-[0.12em]">
                Controllo dati in corso…
              </p>
            </div>
          ) : state.step === "carryovers" ? (
            <>
              <p className="mb-4 text-center text-[13px] font-bold text-slate-700">
                Confermi che i Da Riportare indicati di seguito sono corretti?
              </p>
              <div className="overflow-hidden rounded-[18px] border border-[#e3d7c0]">
                {employees.map((employee) => (
                  <div
                    key={employee.auth_user_id || employee.full_name}
                    className="flex items-center justify-between border-b border-[#eee5d5] bg-white px-4 py-3 last:border-b-0"
                  >
                    <span className="text-[12px] font-black uppercase text-slate-700">
                      {employee.full_name}
                    </span>
                    <span className="text-[15px] font-black tabular-nums text-[#785116]">
                      {fmtEuro(employee.total_da_riportare)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-[#f5e8cc] px-4 py-4">
                  <span className="text-[11px] font-black tracking-[0.12em] text-[#6a4710]">
                    TOTALE GENERALE
                  </span>
                  <span className="text-[20px] font-black tabular-nums text-[#5e3e0d]">
                    {fmtEuro(preview?.total_da_riportare)}
                  </span>
                </div>
              </div>
            </>
          ) : state.step === "missing" ? (
            <>
              <div className="rounded-[18px] border border-orange-200 bg-orange-50 p-4 text-center">
                <TriangleAlert className="mx-auto text-orange-600" size={28} />
                <p className="mt-2 text-[13px] font-black text-orange-900">
                  Questi locali non sono stati conteggiati. Proseguire
                  ugualmente?
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {missing.map((venue) => (
                  <div
                    key={venue.id}
                    className="flex items-center gap-3 rounded-[14px] border border-[#e4dac7] bg-white px-4 py-3"
                  >
                    <span className="font-mono text-[11px] font-black text-[#8c621c]">
                      {venue.id}
                    </span>
                    <span className="text-[12px] font-black text-slate-700">
                      {venue.name}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : state.step === "archive" ? (
            <div className="rounded-[20px] border border-[#dfcfad] bg-[#fbf6eb] p-5 text-center">
              <Archive className="mx-auto text-[#99691b]" size={30} />
              <p className="mt-4 text-[15px] font-black text-[#3d2b0f]">
                Il periodo finirà nell’Archivio.
              </p>
              <p className="mt-3 text-[13px] font-bold leading-relaxed text-slate-600">
                Sarà possibile visualizzare ed esportare i dati, ma conteggi,
                rettifiche e movimenti archiviati non saranno mai più
                modificabili, eliminabili o riapribili. Anche la Contabilità
                Cassa del periodo verrà fotografata con tutti i trasferimenti.
                Confermi?
              </p>
              <div className="mt-4 grid gap-2 rounded-[16px] border border-[#e1d2b3] bg-white p-4 text-left text-[12px] font-bold text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>Cassa generata</span>
                  <strong className="tabular-nums text-[#5f430f]">{fmtEuro(preview?.cassa_summary?.cassa_generata)}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Trasferimenti registrati</span>
                  <strong className="tabular-nums text-red-600">− {fmtEuro(preview?.cassa_summary?.trasferimenti_totale)}</strong>
                </div>
                <div className="flex justify-between gap-3 border-t border-[#ece2cf] pt-2">
                  <span>Cassa finale del periodo</span>
                  <strong className="tabular-nums text-[#5f430f]">{fmtEuro(preview?.cassa_summary?.cassa_disponibile)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-4 text-center text-[13px] font-bold text-slate-700">
                Indica la data finale del nuovo periodo.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-[16px] border border-[#dfd2b8] bg-[#f8f1e3] p-3">
                  <span className="text-[9px] font-black tracking-[0.12em] text-slate-500">
                    DATA INIZIALE · BLOCCATA
                  </span>
                  <input
                    type="date"
                    value={preview?.new_date_from || ""}
                    disabled
                    className="mt-2 h-11 w-full rounded-[12px] border border-[#ded2bc] bg-white px-3 font-black text-slate-600"
                  />
                </label>
                <label className="rounded-[16px] border border-[#d7b96e] bg-[#fff9eb] p-3">
                  <span className="text-[9px] font-black tracking-[0.12em] text-[#8c621b]">
                    DATA FINALE · OBBLIGATORIA
                  </span>
                  <input
                    type="date"
                    min={preview?.new_date_from || ""}
                    value={state.newDateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    className="mt-2 h-11 w-full rounded-[12px] border border-[#d2b56e] bg-white px-3 font-black text-slate-800 outline-none"
                  />
                </label>
              </div>
              <div className="mt-4 rounded-[16px] border border-[#e3d8c2] bg-white p-4 text-[12px] font-bold text-slate-600">
                <div className="flex justify-between">
                  <span>Conteggi da archiviare</span>
                  <strong>{preview?.conteggi_count || 0}</strong>
                </div>
                <div className="mt-2 flex justify-between">
                  <span>Da Riportare trasferiti</span>
                  <strong>{fmtEuro(preview?.total_da_riportare)}</strong>
                </div>
                <div className="mt-2 flex justify-between border-t border-[#eee5d5] pt-2">
                  <span>Cassa finale archiviata</span>
                  <strong>{fmtEuro(preview?.cassa_summary?.cassa_disponibile)}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        {state.step !== "processing" && (
          <div className="grid grid-cols-2 gap-2 border-t border-[#e8ddc7] bg-white p-4">
            <button
              type="button"
              onClick={isFirst ? onClose : onBack}
              disabled={state.loading}
              className="h-12 rounded-[15px] border border-[#ddd1bb] bg-white text-[11px] font-black text-slate-600 disabled:opacity-50"
            >
              {isFirst ? "NO, ANNULLA" : "INDIETRO"}
            </button>
            <button
              type="button"
              onClick={isLast ? onFinalize : onNext}
              disabled={
                state.loading ||
                !preview ||
                (isLast &&
                  (!state.newDateTo || state.newDateTo < preview.new_date_from))
              }
              className="h-12 rounded-[15px] bg-[linear-gradient(135deg,#c99635,#8d5d13)] px-3 text-[11px] font-black text-white shadow-[0_12px_24px_-16px_rgba(100,61,5,.8)] disabled:opacity-45"
            >
              {state.loading
                ? "FINALIZZAZIONE…"
                : isLast
                  ? "FINALIZZA E CREA IL NUOVO PERIODO"
                  : state.step === "missing"
                    ? "PROSEGUI UGUALMENTE"
                    : "SÌ, PROSEGUI"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MainMoneyBox({ label, value, tone = "default", big = false }) {
  const toneCls =
    tone === "success"
      ? "border-green-200 bg-green-50 text-[var(--color-success)]"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-[var(--color-danger)]"
        : "border-[var(--color-border)] bg-white text-[var(--color-text)]";
  return (
    <div className={`rounded-xl border px-3 py-3 shadow-sm ${toneCls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-extrabold tabular-nums ${big ? "text-[21px] md:text-[24px]" : "text-[17px] md:text-[20px]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DebtBox({ value, count, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-left shadow-sm transition-colors hover:border-red-300 hover:bg-red-100/60"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-danger)]">
          Debiti
        </p>
        {open ? (
          <ChevronUp size={14} className="text-[var(--color-danger)]" />
        ) : (
          <ChevronDown size={14} className="text-[var(--color-danger)]" />
        )}
      </div>
      <p className="mt-1 text-[17px] font-extrabold tabular-nums text-[var(--color-danger)] md:text-[20px]">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium text-red-700">
        {count} singoli · clicca per aprire
      </p>
    </button>
  );
}

function EsattoreOverrideBox({
  value,
  originalValue,
  hasOverride,
  disabled = false,
  onChange,
  onSave,
  onReset,
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${hasOverride ? "border-amber-300 bg-amber-50" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Esattore
        </p>
        {hasOverride && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
            Rettificato
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 min-w-0 flex-1 text-right text-[18px] font-extrabold tabular-nums md:text-[20px]"
        />
        <Button
          size="sm"
          variant="primary"
          disabled={disabled}
          onClick={onSave}
        >
          Salva
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Calcolato: {fmtEuro(originalValue)}
        </p>
        {hasOverride && (
          <button
            type="button"
            disabled={disabled}
            onClick={onReset}
            className="text-[10px] font-bold text-amber-700 hover:text-amber-800 disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function TinyMetric({ label, value, danger = false, tone = "default" }) {
  const valueCls =
    danger || tone === "danger"
      ? "text-[var(--color-danger)]"
      : tone === "success"
        ? "text-[var(--color-success)]"
        : "text-[var(--color-text)]";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-[18px] font-black tabular-nums md:text-[21px] ${valueCls}`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryTotalBox({
  label,
  value,
  tone = "default",
  danger = false,
  strong = false,
}) {
  const valueCls =
    danger || tone === "danger"
      ? "text-[var(--color-danger)]"
      : tone === "success"
        ? "text-[var(--color-success)]"
        : "text-[var(--color-text)]";

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-white px-5 py-4 shadow-sm ${
        strong ? "ring-2 ring-red-200 bg-red-50" : ""
      }`}
    >
      <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-[24px] font-extrabold tabular-nums md:text-[30px] ${valueCls}`}
      >
        {value}
      </p>
    </div>
  );
}
function Chip({ label, value, danger = false }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
      <p className="text-[9px] font-medium text-[var(--color-text-muted)] md:text-[10px]">
        {label}
      </p>
      <p
        className={`text-[11px] font-medium tabular-nums md:text-[12px] ${danger ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function SnapshotRow({ label, value, danger = false }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between rounded-[17px] border border-[#ded8cd] bg-white/95 px-4 shadow-[0_10px_20px_-21px_rgba(24,31,45,.7)]">
      <p
        className={`text-[13px] font-black uppercase ${danger ? "text-[#681515]" : "text-slate-900"}`}
      >
        {label}
      </p>
      <p
        className={`text-[21px] font-black tabular-nums ${danger ? "text-[#681515]" : "text-slate-900"}`}
      >
        {fmtEuro(value)}
      </p>
    </div>
  );
}
