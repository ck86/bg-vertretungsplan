import { createFileRoute } from '@tanstack/react-router'
import { getVapidPublicKey } from '#/lib/webPush'

export const Route = createFileRoute('/api/push/vapid-public')({
  server: {
    handlers: {
      GET: async () => {
        const publicKey = getVapidPublicKey()
        if (!publicKey) {
          return new Response(
            JSON.stringify({ error: 'Push-Benachrichtigungen sind hier nicht eingerichtet.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
        return new Response(JSON.stringify({ publicKey }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
