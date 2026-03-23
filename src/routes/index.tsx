import { HomeHeader } from "#/components/ui/home-header";
import type { LessonPlanRow } from "#/lib/pdfParser";
import { createFileRoute } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { PUSH_NOTIFY_CLASS_KEY, urlBase64ToUint8Array } from "#/lib/pushClient";
import { useEffect, useMemo, useState, type FormEvent } from "react";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/")({
  component: HomePage,
});

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<LessonPlanRow>();

const columns = [
  columnHelper.accessor("period", {
    header: "Std.",
    cell: (info) => (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(79,184,178,0.15)] text-[var(--lagoon-deep)] font-bold text-sm">
        {info.getValue()}
      </span>
    ),
    size: 60,
  }),
  columnHelper.accessor("class", {
    header: "Klasse",
    cell: (info) => (
      <span className="inline-block px-2 py-0.5 rounded-md bg-[rgba(47,106,74,0.12)] text-[var(--palm)] font-semibold text-xs">
        {info.getValue()}
      </span>
    ),
    size: 80,
  }),
  columnHelper.accessor("originalSubject", {
    header: "(Fach)",
    size: 100,
  }),
  columnHelper.accessor("originalTeacher", {
    header: "(Lehrer)",
    size: 100,
  }),
  columnHelper.accessor("teacher", {
    header: "Lehrer",
    cell: (info) => (
      <span className="font-medium text-[var(--sea-ink)]">
        {info.getValue()}
      </span>
    ),
    size: 100,
  }),
  columnHelper.accessor("subject", {
    header: "Fach",
    size: 100,
  }),
  columnHelper.accessor("room", {
    header: "Raum",
    cell: (info) =>
      info.getValue() ? (
        <span className="inline-block px-2 py-0.5 rounded-md border border-[var(--line)] text-xs font-mono text-[var(--sea-ink-soft)]">
          {info.getValue()}
        </span>
      ) : null,
    size: 80,
  }),
  columnHelper.accessor("type", {
    header: "Art",
    cell: (info) => {
      const val = info.getValue();
      if (!val) return null;
      const isEntfall =
        val.toLowerCase().includes("entfall") ||
        val.toLowerCase().includes("ausfall");
      const isVertretung = val.toLowerCase().includes("vertretung");
      return (
        <span
          className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
            isEntfall
              ? "bg-[rgba(220,60,60,0.12)] text-rose-600"
              : isVertretung
                ? "bg-[rgba(79,184,178,0.18)] text-[var(--lagoon-deep)]"
                : "bg-[rgba(79,184,178,0.1)] text-[var(--sea-ink-soft)]"
          }`}
        >
          {val}
        </span>
      );
    },
    size: 110,
  }),
  columnHelper.accessor("note", {
    header: "Text",
    cell: (info) => (
      <span className="text-sm text-[var(--sea-ink-soft)]">
        {info.getValue()}
      </span>
    ),
    size: 280,
  }),
];

// ─── Component ────────────────────────────────────────────────────────────────

type LessonPlanDay = {
  date: string | null;
  rows: LessonPlanRow[];
  sourceUrl: string | null;
  isToday: boolean;
};

type PlansApiResponse = {
  plans: LessonPlanDay[];
  defaultIndex: number;
};

function formatPlanSwitcherLabel(day: LessonPlanDay): string {
  const datePart = day.date
    ? new Date(day.date).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "Datum unbekannt";
  return day.isToday ? `${datePart} · Heute` : datePart;
}

function HomePage() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plansData, setPlansData] = useState<PlansApiResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadPlan = async (pwd: string) => {
    const trimmed = pwd.trim();
    if (!trimmed) {
      setError("Bitte gib das Passwort ein.");
      setPlansData(null);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: trimmed }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Der Plan konnte nicht geladen werden.");
      }

      const result: PlansApiResponse = await response.json();
      if (!Array.isArray(result.plans) || result.plans.length === 0) {
        throw new Error("Der Plan enthielt keine gültigen Daten.");
      }
      const safeDefault = Math.min(
        Math.max(0, result.defaultIndex),
        result.plans.length - 1,
      );
      setPlansData(result);
      setActiveIndex(safeDefault);
      // Persist successful password locally so users don't have to re-enter it.
      try {
        window.localStorage.setItem("planPassword", trimmed);
      } catch {
        // Ignore storage errors (e.g. in private mode)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Der Plan konnte nicht geladen werden.",
      );
      setPlansData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    void loadPlan(password);
  };

  useEffect(() => {
    // On first load, try to read a previously stored password and load the plan automatically.
    try {
      const stored = window.localStorage.getItem("planPassword");
      if (stored) {
        setPassword(stored);
        void loadPlan(stored);
      }
    } catch {
      // If localStorage is unavailable, just ignore and require manual input.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPushSupported("serviceWorker" in navigator && "PushManager" in window);
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    });
  }, []);

  useEffect(() => {
    if (!selectedClass || typeof window === "undefined") {
      setPushActive(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(PUSH_NOTIFY_CLASS_KEY);
        } catch {
          stored = null;
        }
        if (!cancelled) {
          setPushActive(!!sub && stored === selectedClass);
        }
      } catch {
        if (!cancelled) setPushActive(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClass, plansData]);

  const activePlan = useMemo(() => {
    if (!plansData?.plans.length) return null;
    const idx = Math.min(activeIndex, plansData.plans.length - 1);
    return plansData.plans[idx] ?? null;
  }, [plansData, activeIndex]);

  const rows = useMemo(() => activePlan?.rows ?? [], [activePlan]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (!row.class) continue;
      row.class.split(/\s+/).forEach((cls) => {
        if (!cls) return;
        const cleaned = cls.replace(/,+$/, "");
        if (cleaned) set.add(cleaned);
      });
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de-DE", { numeric: true, sensitivity: "base" }),
    );
  }, [rows]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const formattedDate = activePlan?.date
    ? new Date(activePlan.date).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const rowCount = table.getFilteredRowModel().rows.length;

  const cleanupPushSubscriptionForClass = async (classLabel: string) => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(PUSH_NOTIFY_CLASS_KEY);
    } catch {
      return;
    }
    if (stored !== classLabel) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            class: classLabel,
          }),
        });
        await sub.unsubscribe();
      }
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.removeItem(PUSH_NOTIFY_CLASS_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleClassChange = (value: string) => {
    const prev = selectedClass;
    if (prev && prev !== value) {
      void cleanupPushSubscriptionForClass(prev);
    }
    setSelectedClass(value);
    setColumnFilters((prev) => {
      const withoutClass = prev.filter((f) => f.id !== "class");
      if (!value) return withoutClass;
      return [...withoutClass, { id: "class", value }];
    });
  };

  const handlePushToggle = async (enable: boolean) => {
    if (!selectedClass || typeof window === "undefined") return;
    setPushError(null);
    setPushBusy(true);
    try {
      if (!enable) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              class: selectedClass,
            }),
          });
          await sub.unsubscribe();
        }
        try {
          window.localStorage.removeItem(PUSH_NOTIFY_CLASS_KEY);
        } catch {
          /* ignore */
        }
        setPushActive(false);
        return;
      }

      const vr = await fetch("/api/push/vapid-public");
      if (!vr.ok) {
        const j = (await vr.json().catch(() => null)) as { error?: string } | null;
        setPushError(
          j?.error ??
            "Push ist auf diesem Server nicht eingerichtet (VAPID-Schlüssel fehlen).",
        );
        return;
      }
      const { publicKey } = (await vr.json()) as { publicKey: string };
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushError(
          "Benachrichtigungen wurden nicht erlaubt. Bitte in den Browser-Einstellungen aktivieren.",
        );
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update();
      const ready = await navigator.serviceWorker.ready;
      const sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.keys?.auth || !json.keys?.p256dh) {
        setPushError("Push-Abo konnte nicht erstellt werden.");
        return;
      }
      const sr = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class: selectedClass,
          subscription: {
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
          },
        }),
      });
      if (!sr.ok) {
        const j = (await sr.json().catch(() => null)) as { error?: string } | null;
        setPushError(j?.error ?? "Speichern des Abos ist fehlgeschlagen.");
        await sub.unsubscribe().catch(() => {});
        return;
      }
      try {
        window.localStorage.setItem(PUSH_NOTIFY_CLASS_KEY, selectedClass);
      } catch {
        /* ignore */
      }
      setPushActive(true);
    } catch (e) {
      setPushError(
        e instanceof Error ? e.message : "Push konnte nicht aktiviert werden.",
      );
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <main>
      {/* Header Section */}
      <HomeHeader plan={activePlan} formattedDate={formattedDate} />

      <div className="page-wrap">
        {/* Password form (hidden once a plan is successfully loaded) */}
        {!plansData && (
          <section className="rise-in mb-6" style={{ animationDelay: "60ms" }}>
            <form
              onSubmit={handleSubmit}
              className="island-shell rounded-2xl px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 max-w-xl"
            >
              <label
                htmlFor="plan-password"
                className="text-sm font-medium text-[var(--sea-ink-soft)]"
              >
                Passwort für den Vertretungsplan
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <input
                  id="plan-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
                  placeholder="Passwort eingeben"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !password.trim()}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--lagoon-deep)] hover:bg-[var(--lagoon)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Laden…" : "Plan laden"}
                </button>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </form>
          </section>
        )}

        {/* Class filter & table – only show after plan is loaded */}
        {plansData && activePlan && (
          <>
            {plansData.plans.length > 1 && (
              <div
                className="rise-in mb-4"
                style={{ animationDelay: "72ms" }}
              >
                <p className="text-sm font-medium text-[var(--sea-ink-soft)] mb-2">
                  Tag wählen
                </p>
                <div
                  role="tablist"
                  aria-label="Vertretungsplan nach Tag"
                  className="inline-flex flex-wrap gap-1 p-1 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)]"
                >
                  {plansData.plans.map((day, i) => {
                    const selected = i === activeIndex;
                    return (
                      <button
                        key={`${day.date ?? "unknown"}-${i}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setActiveIndex(i)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selected
                            ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                            : "text-[var(--sea-ink)] hover:bg-[rgba(79,184,178,0.12)]"
                        }`}
                      >
                        {formatPlanSwitcherLabel(day)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Class filter */}
            <div className="rise-in mb-4" style={{ animationDelay: "80ms" }}>
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex flex-col">
                  <label
                    htmlFor="lesson-plan-class-filter"
                    className="text-sm font-medium text-[var(--sea-ink-soft)]"
                  >
                    Klasse filtern:
                  </label>
                  <p className="mt-0.5 text-xs text-[var(--sea-ink-soft)]">
                    Falls deine Klasse hier nicht erscheint, gibt es aktuell
                    keine Einträge.
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
                  <div className="relative">
                    <select
                      id="lesson-plan-class-filter"
                      value={selectedClass}
                      onChange={(e) => handleClassChange(e.target.value)}
                      className="w-48 pl-3 pr-8 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)] appearance-none cursor-pointer"
                    >
                      <option value="">Alle Klassen</option>
                      {classOptions.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m7 10 5 5 5-5" />
                    </svg>
                  </div>

                  <div className="flex gap-3 flex-wrap justify-end">
                    <div className="island-shell rounded-xl px-4 py-2 flex items-center gap-2">
                      <span className="text-2xl font-bold text-[var(--lagoon-deep)]">
                        {activePlan.rows.length}
                      </span>
                      <span className="text-xs text-[var(--sea-ink-soft)] font-medium leading-tight">
                        Einträge
                        <br />
                        gesamt
                      </span>
                    </div>
                    {selectedClass && (
                      <div className="island-shell rounded-xl px-4 py-2 flex items-center gap-2">
                        <span className="text-2xl font-bold text-[var(--palm)]">
                          {rowCount}
                        </span>
                        <span className="text-xs text-[var(--sea-ink-soft)] font-medium leading-tight">
                          Treffer
                          <br />
                          gefunden
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedClass && (
              <div
                className="rise-in mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 sm:px-5 sm:py-4"
                style={{ animationDelay: "100ms" }}
              >
                <div className="flex items-start gap-3">
                  <input
                    id="plan-push-notify"
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[var(--lagoon-deep)] focus:ring-[var(--lagoon)]"
                    checked={pushActive}
                    disabled={pushBusy || !pushSupported}
                    onChange={(e) => {
                      void handlePushToggle(e.target.checked);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="plan-push-notify"
                      className="text-sm font-medium text-[var(--sea-ink)] cursor-pointer"
                    >
                      Bei Änderungen für Klasse {selectedClass} per Push benachrichtigen
                    </label>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)] leading-relaxed">
                      Funktioniert auch, wenn du diese Seite schließt (je nach Gerät und
                      Browser-Einstellungen). Auf dem Server müssen dafür VAPID-Schlüssel und
                      ein regelmäßiger Cron-Job eingerichtet sein.
                    </p>
                    {!pushSupported && (
                      <p className="mt-2 text-xs text-rose-600">
                        Push wird von diesem Browser nicht unterstützt.
                      </p>
                    )}
                    {pushError && (
                      <p className="mt-2 text-sm text-rose-600">{pushError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div
              className="island-shell rise-in rounded-2xl overflow-hidden"
              style={{ animationDelay: "140ms" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr
                        key={headerGroup.id}
                        className="border-b border-[var(--line)]"
                      >
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            onClick={header.column.getToggleSortingHandler()}
                            className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-[var(--sea-ink-soft)] uppercase select-none whitespace-nowrap bg-[rgba(0,0,0,0.02)] cursor-pointer hover:text-[var(--sea-ink)] transition"
                            style={{ width: header.getSize() }}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                              {header.column.getCanSort() && (
                                <span className="text-[var(--lagoon)] opacity-60">
                                  {{ asc: "↑", desc: "↓" }[
                                    header.column.getIsSorted() as string
                                  ] ?? (
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      aria-hidden="true"
                                      className="opacity-40"
                                    >
                                      <path d="m7 15 5 5 5-5" />
                                      <path d="m7 9 5-5 5 5" />
                                    </svg>
                                  )}
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-4 py-12 text-center text-[var(--sea-ink-soft)]"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <svg
                              width="32"
                              height="32"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className="opacity-30"
                              aria-hidden="true"
                            >
                              <circle cx="11" cy="11" r="8" />
                              <path d="m21 21-4.3-4.3" />
                            </svg>
                            <span className="text-sm">
                              Keine Einträge gefunden
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row, i) => (
                        <tr
                          key={row.id}
                          className="border-b border-[var(--line)] last:border-0 hover:bg-[rgba(79,184,178,0.05)] transition-colors"
                          style={{ animationDelay: `${i * 20}ms` }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className="px-4 py-3 whitespace-nowrap"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="px-4 py-3 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--sea-ink-soft)] bg-[rgba(0,0,0,0.02)]">
                <span>
                  {rowCount} {rowCount === 1 ? "Eintrag" : "Einträge"}
                  {selectedClass ? ` gefunden` : ` gesamt`}
                </span>
                <span className="hidden sm:block opacity-60">
                  Klick auf Spaltenheader zum Sortieren
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
