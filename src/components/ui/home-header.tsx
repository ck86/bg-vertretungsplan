type LessonPlanPayloadLike = {
  date: string | null
  rows: Array<unknown>
  sourceUrl: string | null
  isToday: boolean
}

type HomeHeaderProps = {
  plan: LessonPlanPayloadLike | null
  formattedDate: string | null
}

export function HomeHeader({
  plan,
  formattedDate,
}: HomeHeaderProps) {
  return (
    <header className="rise-in mb-8 w-full bg-white px-4 py-6 shadow-sm">
      <div className="page-wrap flex flex-wrap items-end justify-between gap-4">
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
              <svg
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
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              {formattedDate}
            </p>
          )}
        </div>

        {plan && plan.sourceUrl && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm text-[var(--sea-ink-soft)]">
              <span>
                {plan.isToday
                  ? 'Original-PDF für heute ohne Filter im Browser öffnen:'
                  : 'Original-PDF für diesen Tag ohne Filter im Browser öffnen:'}
              </span>
              <a
                href={`${plan.sourceUrl}?t=${Date.now()}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--lagoon-deep)] border border-[var(--lagoon-deep)] bg-transparent hover:bg-[rgba(79,184,178,0.08)] transition-colors w-max"
              >
                Original-PDF öffnen
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

