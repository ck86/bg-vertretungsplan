import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { getDb, schema } from '#/db'
import { isValidClassLabel } from '#/lib/planFingerprint'
import { allowSubscribeRequest, clientKeyFromRequest } from '#/lib/rateLimitSubscribe'

const { pushSubscriptions } = schema

type SubscribeBody = {
  class?: string
  subscription?: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/push/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = clientKeyFromRequest(request)
        if (!allowSubscribeRequest(key)) {
          return jsonResponse({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, 429)
        }

        let body: SubscribeBody
        try {
          body = (await request.json()) as SubscribeBody
        } catch {
          return jsonResponse({ error: 'Ungültiger JSON-Body.' }, 400)
        }

        const classLabel = body.class?.trim() ?? ''
        if (!isValidClassLabel(classLabel)) {
          return jsonResponse({ error: 'Ungültige oder fehlende Klasse.' }, 400)
        }

        const sub = body.subscription
        const endpoint = sub?.endpoint?.trim() ?? ''
        const p256dh = sub?.keys?.p256dh?.trim() ?? ''
        const auth = sub?.keys?.auth?.trim() ?? ''
        if (!endpoint || !p256dh || !auth) {
          return jsonResponse({ error: 'Ungültiges Push-Abo.' }, 400)
        }

        const db = getDb()
        const now = Date.now()

        await db
          .delete(pushSubscriptions)
          .where(
            and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.classLabel, classLabel)),
          )

        await db.insert(pushSubscriptions).values({
          endpoint,
          p256dh,
          auth,
          classLabel,
          createdAt: now,
        })

        return jsonResponse({ ok: true }, 200)
      },
    },
  },
})
