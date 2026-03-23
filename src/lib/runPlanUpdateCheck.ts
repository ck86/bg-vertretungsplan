import { and, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '#/db'
import { fetchLessonPlansPayload } from '#/lib/lessonPlans'
import { fingerprintForClass } from '#/lib/planFingerprint'
import { ensureVapidConfigured, sendPlanUpdateNotification } from '#/lib/webPush'

const { pushSubscriptions, classPlanFingerprints } = schema

export type PlanUpdateCheckResult = {
  classesChecked: number
  classesNotified: number
  pushesSent: number
  errors: string[]
}

export async function runPlanUpdateCheck(): Promise<PlanUpdateCheckResult> {
  const password = process.env.PLAN_PDF_PASSWORD?.trim()
  if (!password) {
    throw new Error('PLAN_PDF_PASSWORD is not set')
  }

  if (!ensureVapidConfigured()) {
    throw new Error('VAPID keys are not configured')
  }

  const siteUrl = process.env.PUBLIC_APP_URL?.trim() || ''

  const payload = await fetchLessonPlansPayload(password)
  const { plans } = payload

  const db = getDb()

  const classRows = await db
    .select({ classLabel: pushSubscriptions.classLabel })
    .from(pushSubscriptions)
    .groupBy(pushSubscriptions.classLabel)

  const classes = classRows.map(r => r.classLabel)
  const result: PlanUpdateCheckResult = {
    classesChecked: classes.length,
    classesNotified: 0,
    pushesSent: 0,
    errors: [],
  }

  if (classes.length === 0) {
    return result
  }

  const now = Date.now()

  for (const classLabel of classes) {
    const nextFp = fingerprintForClass(plans, classLabel)

    const [existing] = await db
      .select()
      .from(classPlanFingerprints)
      .where(eq(classPlanFingerprints.classLabel, classLabel))
      .limit(1)

    if (!existing) {
      await db
        .insert(classPlanFingerprints)
        .values({ classLabel, fingerprint: nextFp, updatedAt: now })
      continue
    }

    if (existing.fingerprint === nextFp) {
      continue
    }

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.classLabel, classLabel))

    result.classesNotified += 1

    const deadEndpoints: string[] = []

    for (const sub of subs) {
      const r = await sendPlanUpdateNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        classLabel,
        siteUrl || '/',
      )
      if (r.statusCode === 410 || r.statusCode === 404) {
        deadEndpoints.push(sub.endpoint)
      } else if (r.statusCode != null && r.statusCode >= 400) {
        result.errors.push(`Push HTTP ${r.statusCode}`)
      } else {
        result.pushesSent += 1
      }
    }

    if (deadEndpoints.length > 0) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.classLabel, classLabel),
            inArray(pushSubscriptions.endpoint, deadEndpoints),
          ),
        )
    }

    await db
      .update(classPlanFingerprints)
      .set({ fingerprint: nextFp, updatedAt: now })
      .where(eq(classPlanFingerprints.classLabel, classLabel))
  }

  return result
}
