import { createFileRoute } from '@tanstack/react-router'
import type { LessonPlanRow } from '#/lib/pdfParser'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/')({
  component: HomePage,
})

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<LessonPlanRow>()

const columns = [
  columnHelper.accessor('period', {
    header: 'Std.',
    cell: info => (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(79,184,178,0.15)] text-[var(--lagoon-deep)] font-bold text-sm">
        {info.getValue()}
      </span>
    ),
    size: 60,
  }),
  columnHelper.accessor('class', {
    header: 'Klasse',
    cell: info => (
      <span className="inline-block px-2 py-0.5 rounded-md bg-[rgba(47,106,74,0.12)] text-[var(--palm)] font-semibold text-xs">
        {info.getValue()}
      </span>
    ),
    size: 80,
  }),
  columnHelper.accessor('originalSubject', {
    header: '(Fach)',
    size: 100,
  }),
  columnHelper.accessor('originalTeacher', {
    header: '(Lehrer)',
    size: 100,
  }),
  columnHelper.accessor('teacher', {
    header: 'Lehrer',
    cell: info => (
      <span className="font-medium text-[var(--sea-ink)]">{info.getValue()}</span>
    ),
    size: 100,
  }),
  columnHelper.accessor('subject', {
    header: 'Fach',
    size: 100,
  }),
  columnHelper.accessor('room', {
    header: 'Raum',
    cell: info => info.getValue() ? (
      <span className="inline-block px-2 py-0.5 rounded-md border border-[var(--line)] text-xs font-mono text-[var(--sea-ink-soft)]">
        {info.getValue()}
      </span>
    ) : null,
    size: 80,
  }),
  columnHelper.accessor('type', {
    header: 'Art',
    cell: info => {
      const val = info.getValue()
      if (!val) return null
      const isEntfall = val.toLowerCase().includes('entfall') || val.toLowerCase().includes('ausfall')
      const isVertretung = val.toLowerCase().includes('vertretung')
      return (
        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${isEntfall
          ? 'bg-[rgba(220,60,60,0.12)] text-rose-600'
          : isVertretung
            ? 'bg-[rgba(79,184,178,0.18)] text-[var(--lagoon-deep)]'
            : 'bg-[rgba(79,184,178,0.1)] text-[var(--sea-ink-soft)]'
          }`}>
          {val}
        </span>
      )
    },
    size: 110,
  }),
  columnHelper.accessor('note', {
    header: 'Text',
    cell: info => (
      <span className="text-sm text-[var(--sea-ink-soft)]">{info.getValue()}</span>
    ),
    size: 280,
  }),
]

// ─── Component ────────────────────────────────────────────────────────────────

type LessonPlanPayload = {
  date: string | null
  rows: LessonPlanRow[]
}

function HomePage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<LessonPlanPayload | null>(null)

  const loadPlan = async (pwd: string) => {
    const trimmed = pwd.trim()
    if (!trimmed) {
      setError('Bitte gib das Passwort ein.')
      setPlan(null)
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: trimmed }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Der Plan konnte nicht geladen werden.')
      }

      const result: LessonPlanPayload = await response.json()
      setPlan(result)
      // Persist successful password locally so users don't have to re-enter it.
      try {
        window.localStorage.setItem('planPassword', trimmed)
      } catch {
        // Ignore storage errors (e.g. in private mode)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Plan konnte nicht geladen werden.')
      setPlan(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    void loadPlan(password)
  }

  useEffect(() => {
    // On first load, try to read a previously stored password and load the plan automatically.
    try {
      const stored = window.localStorage.getItem('planPassword')
      if (stored) {
        setPassword(stored)
        void loadPlan(stored)
      }
    } catch {
      // If localStorage is unavailable, just ignore and require manual input.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [selectedClass, setSelectedClass] = useState('')

  const rows = useMemo(() => plan?.rows ?? [], [plan])

  const classOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (!row.class) continue
      row.class.split(/\s+/).forEach(cls => {
        if (!cls) return
        const cleaned = cls.replace(/,+$/, '')
        if (cleaned) set.add(cleaned)
      })
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'de-DE', { numeric: true, sensitivity: 'base' }),
    )
  }, [rows])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const formattedDate = plan?.date
    ? new Date(plan.date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    : null

  const rowCount = table.getFilteredRowModel().rows.length

  const handleClassChange = (value: string) => {
    setSelectedClass(value)
    setColumnFilters(prev => {
      const withoutClass = prev.filter(f => f.id !== 'class')
      if (!value) return withoutClass
      return [...withoutClass, { id: 'class', value }]
    })
  }

  return (
    <main className="page-wrap px-4 pb-12 pt-10">

      {/* Header Section */}
      <section className="rise-in mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display-title text-4xl sm:text-5xl font-bold text-[var(--sea-ink)] leading-tight mb-2">
              Vertretungsplan
            </h1>
            {!plan && (
              <p className="text-sm text-[var(--sea-ink-soft)] max-w-xl">
                Um den Vertretungsplan zu laden, gib bitte das bekannte Passwort ein.
                Das Passwort wird ausschließlich verwendet, um die geschützte PDF vom Schulserver zu öffnen und wird
                nicht gespeichert.
              </p>
            )}
            {formattedDate && (
              <p className="text-base text-[var(--sea-ink-soft)] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                {formattedDate}
              </p>
            )}
          </div>

          {/* Stats badges */}
          {plan && (
            <div className="flex gap-3 flex-wrap">
              <div className="island-shell rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--lagoon-deep)]">{plan.rows.length}</span>
                <span className="text-xs text-[var(--sea-ink-soft)] font-medium leading-tight">Einträge<br />gesamt</span>
              </div>
              {selectedClass && (
                <div className="island-shell rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="text-2xl font-bold text-[var(--palm)]">{rowCount}</span>
                  <span className="text-xs text-[var(--sea-ink-soft)] font-medium leading-tight">Treffer<br />gefunden</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Password form (hidden once a plan is successfully loaded) */}
      {!plan && (
        <section className="rise-in mb-6" style={{ animationDelay: '60ms' }}>
          <form
            onSubmit={handleSubmit}
            className="island-shell rounded-2xl px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 max-w-xl"
          >
            <label htmlFor="plan-password" className="text-sm font-medium text-[var(--sea-ink-soft)]">
              Passwort für den Vertretungsplan
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                id="plan-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
                placeholder="Passwort eingeben"
              />
              <button
                type="submit"
                disabled={isSubmitting || !password.trim()}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--lagoon-deep)] hover:bg-[var(--lagoon)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Laden…' : 'Plan laden'}
              </button>
            </div>
            {error && (
              <p className="text-sm text-rose-600">
                {error}
              </p>
            )}
          </form>
        </section>
      )}

      {/* Class filter & table – only show after plan is loaded */}
      {plan && (
        <>
          {/* Class filter */}
          <div className="rise-in mb-4" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center gap-3">
              <label
                htmlFor="lesson-plan-class-filter"
                className="text-sm font-medium text-[var(--sea-ink-soft)]"
              >
                Klasse filtern:
              </label>
              <div className="relative">
                <select
                  id="lesson-plan-class-filter"
                  value={selectedClass}
                  onChange={e => handleClassChange(e.target.value)}
                  className="w-48 pl-3 pr-8 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)] appearance-none cursor-pointer"
                >
                  <option value="">Alle Klassen</option>
                  {classOptions.map(cls => (
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
            </div>
          </div>

          {/* Table */}
          <div
            className="island-shell rise-in rounded-2xl overflow-hidden"
            style={{ animationDelay: '140ms' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="border-b border-[var(--line)]">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-[var(--sea-ink-soft)] uppercase select-none whitespace-nowrap bg-[rgba(0,0,0,0.02)] cursor-pointer hover:text-[var(--sea-ink)] transition"
                          style={{ width: header.getSize() }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-[var(--lagoon)] opacity-60">
                                {{ asc: '↑', desc: '↓' }[header.column.getIsSorted() as string] ?? (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="opacity-40">
                                    <path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />
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
                      <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--sea-ink-soft)]">
                        <div className="flex flex-col items-center gap-2">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-30" aria-hidden="true">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                          </svg>
                          <span className="text-sm">Keine Einträge gefunden</span>
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
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                {rowCount} {rowCount === 1 ? 'Eintrag' : 'Einträge'}
                {selectedClass ? ` gefunden` : ` gesamt`}
              </span>
              <span className="hidden sm:block opacity-60">Klick auf Spaltenheader zum Sortieren</span>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
