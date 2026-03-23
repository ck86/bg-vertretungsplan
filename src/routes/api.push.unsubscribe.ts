import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { getDb, schema } from '#/db'
import { isValidClassLabel } from '#/lib/planFingerprint'
import { allowSubscribeRequest, clientKeyFromRequest } from '#/lib/rateLimitSubscribe'

const { pushSubscriptions, classPlanFingerprints } = schema

type UnsubscribeBody = {
  class?: string
  endpoint?: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/push/unsubscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = clientKeyFromRequest(request)
        if (!allowSubscribeRequest(key)) {
          return jsonResponse({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, 429)
        }

        let body: UnsubscribeBody
        try {
          body = (await request.json()) as UnsubscribeBody
        } catch {
          return jsonResponse({ error: 'Ungültiger JSON-Body.' }, 400)
        }

        const endpoint = body.endpoint?.trim() ?? ''
        if (!endpoint) {
          return jsonResponse({ error: 'endpoint fehlt.' }, 400)
        }

        const classLabel = body.class?.trim()
        const db = getDb()

        if (classLabel) {
          if (!isValidClassLabel(classLabel)) {
            return jsonResponse({ error: 'Ungültige Klasse.' }, 400)
          }
          await db
            .delete(pushSubscriptions)
            .where(
              and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.classLabel, classLabel)),
            )
          const remaining = await db
            .select({ id: pushSubscriptions.id })
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.classLabel, classLabel))
            .limit(1)
          if (remaining.length === 0) {
            await db
              .delete(classPlanFingerprints)
              .where(eq(classPlanFingerprints.classLabel, classLabel))
          }
        } else {
          const rows = await db
            .select({ classLabel: pushSubscriptions.classLabel })
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint))
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
          for (const row of rows) {
            const still = await db
              .select({ id: pushSubscriptions.id })
              .from(pushSubscriptions)
              .where(eq(pushSubscriptions.classLabel, row.classLabel))
              .limit(1)
            if (still.length === 0) {
              await db
                .delete(classPlanFingerprints)
                .where(eq(classPlanFingerprints.classLabel, row.classLabel))
            }
          }
        }

        return jsonResponse({ ok: true }, 200)
      },
    },
  },
})
