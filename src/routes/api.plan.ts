import { createFileRoute } from '@tanstack/react-router'
import { parseLessonPlanPdf, type LessonPlanResult } from '#/lib/pdfParser'

const PLAN_URLS = [
  'https://www.barnim-gymnasium.de/fileadmin/schulen/barnim-gymnasium/Dokumente/Pl%C3%A4ne/vplan.pdf',
  'https://www.barnim-gymnasium.de/fileadmin/schulen/barnim-gymnasium/Dokumente/Pl%C3%A4ne/vplan1.pdf',
] as const

async function downloadAndParsePlan(
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

export const Route = createFileRoute('/api/plan')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { password } = (await request.json()) as { password?: string }
        const trimmedPassword = password?.trim() ?? ''

        if (!trimmedPassword) {
          return new Response('Bitte gib das Passwort ein.', { status: 400 })
        }

        try {
          const results = await Promise.allSettled(
            PLAN_URLS.map(url => downloadAndParsePlan(url, trimmedPassword)),
          )

          const successful = results
            .filter(
              (r): r is PromiseFulfilledResult<LessonPlanResult & { sourceUrl: string }> =>
                r.status === 'fulfilled',
            )
            .map(r => r.value)

          if (successful.length === 0) {
            return new Response('Konnte keine Vertretungspläne laden.', { status: 502 })
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

          const defaultIndex = Math.max(
            0,
            sorted.findIndex(p => p === defaultChoice),
          )

          const plans = sorted.map(p => ({
            date: p.date ? p.date.toISOString() : null,
            rows: p.rows,
            sourceUrl: p.sourceUrl,
            isToday: pickByDate(p),
          }))

          const payload = {
            plans,
            defaultIndex,
          }

          return new Response(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (error) {
          return new Response(
            'Der Vertretungsplan konnte mit dem angegebenen Passwort nicht entschlüsselt werden.',
            { status: 500 },
          )
        }
      },
    },
  },
})
