import { createFileRoute } from '@tanstack/react-router'
import { fetchLessonPlansPayload } from '#/lib/lessonPlans'

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
          const payload = await fetchLessonPlansPayload(trimmedPassword)

          return new Response(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (err) {
          if (err instanceof Error && err.message === 'NO_PLANS_LOADED') {
            return new Response('Konnte keine Vertretungspläne laden.', { status: 502 })
          }
          return new Response(
            'Der Vertretungsplan konnte mit dem angegebenen Passwort nicht entschlüsselt werden.',
            { status: 500 },
          )
        }
      },
    },
  },
})
