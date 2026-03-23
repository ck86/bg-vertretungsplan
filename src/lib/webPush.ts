import webpush from 'web-push'

let configured = false

/** Returns true if VAPID env vars are present and web-push was configured. */
export function ensureVapidConfigured(): boolean {
  if (configured) return true
  const subject = process.env.VAPID_SUBJECT?.trim()
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!subject || !publicKey || !privateKey) {
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function getVapidPublicKey(): string | undefined {
  return process.env.VAPID_PUBLIC_KEY?.trim()
}

export async function sendPlanUpdateNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  classLabel: string,
  siteUrl: string,
): Promise<{ statusCode?: number }> {
  if (!ensureVapidConfigured()) {
    throw new Error('VAPID_NOT_CONFIGURED')
  }

  const payload = JSON.stringify({
    title: 'Vertretungsplan',
    body: `Neue Einträge für Klasse ${classLabel}.`,
    url: siteUrl,
    classLabel,
  })

  const sub = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  }

  try {
    await webpush.sendNotification(sub, payload, {
      TTL: 60 * 60,
      urgency: 'normal',
    })
    return {}
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : undefined
    return { statusCode }
  }
}
