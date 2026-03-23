import { createFileRoute } from '@tanstack/react-router'
import { isWithinBerlinPlanWatchWindow } from '#/lib/berlinCronWindow'
import { runPlanUpdateCheck } from '#/lib/runPlanUpdateCheck'

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/cron/check-plan-updates')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET?.trim()
        if (!secret) {
          return jsonResponse({ error: 'CRON_SECRET ist nicht gesetzt.' }, 503)
        }

        const auth = request.headers.get('authorization')
        const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
        if (token !== secret) {
          return jsonResponse({ error: 'Nicht autorisiert.' }, 401)
        }

        if (!process.env.PLAN_PDF_PASSWORD?.trim()) {
          return jsonResponse({ error: 'PLAN_PDF_PASSWORD ist nicht gesetzt.' }, 503)
        }

        if (!isWithinBerlinPlanWatchWindow()) {
          return jsonResponse(
            { skipped: true, reason: 'outside_berlin_window', window: '06:00–15:00 Europe/Berlin' },
            200,
          )
        }

        try {
          const result = await runPlanUpdateCheck()
          return jsonResponse(result, 200)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
          return jsonResponse({ error: message }, 500)
        }
      },
    },
  },
})
