import { parseLessonPlanPdf, type LessonPlanResult, type LessonPlanRow } from '#/lib/pdfParser'

export const PLAN_URLS = [
  'https://www.barnim-gymnasium.de/fileadmin/schulen/barnim-gymnasium/Dokumente/Pl%C3%A4ne/vplan.pdf',
  'https://www.barnim-gymnasium.de/fileadmin/schulen/barnim-gymnasium/Dokumente/Pl%C3%A4ne/vplan1.pdf',
] as const

export type LessonPlanDayPayload = {
  date: string | null
  rows: LessonPlanRow[]
  sourceUrl: string
  isToday: boolean
}

export type LessonPlansApiPayload = {
  plans: LessonPlanDayPayload[]
  defaultIndex: number
}

export async function downloadAndParsePlan(
  url: string,
  password: string,
): Promise<LessonPlanResult & { sourceUrl: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch plan PDF from ${url}: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const result = await parseLessonPlanPdf(buffer, password)
  return { ...result, sourceUrl: url }
}

/**
 * Fetches all configured PDFs, merges successful parses, sorts by date, picks default (today or newest).
 */
export async function fetchLessonPlansPayload(password: string): Promise<LessonPlansApiPayload> {
  const results = await Promise.allSettled(
    PLAN_URLS.map(url => downloadAndParsePlan(url, password)),
  )

  const successful = results
    .filter(
      (r): r is PromiseFulfilledResult<LessonPlanResult & { sourceUrl: string }> =>
        r.status === 'fulfilled',
    )
    .map(r => r.value)

  if (successful.length === 0) {
    throw new Error('NO_PLANS_LOADED')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pickByDate = (candidate: LessonPlanResult | null) => {
    if (!candidate || !candidate.date) return false
    const d = new Date(candidate.date)
    d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  }

  const todaysPlan = successful.find(pickByDate) ?? null

  const fallbackPlan =
    successful
      .slice()
      .sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })[0] ?? successful[0]

  const defaultChoice = todaysPlan ?? fallbackPlan

  const sorted = successful.slice().sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  const defaultIndex = Math.max(0, sorted.findIndex(p => p === defaultChoice))

  const plans: LessonPlanDayPayload[] = sorted.map(p => ({
    date: p.date ? p.date.toISOString() : null,
    rows: p.rows,
    sourceUrl: p.sourceUrl,
    isToday: pickByDate(p),
  }))

  return { plans, defaultIndex }
}
