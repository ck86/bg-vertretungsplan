import { createHash } from 'node:crypto'
import type { LessonPlanRow } from '#/lib/pdfParser'
import type { LessonPlanDayPayload } from '#/lib/lessonPlans'

const ROW_KEYS: (keyof LessonPlanRow)[] = [
  'period',
  'class',
  'originalSubject',
  'originalTeacher',
  'teacher',
  'subject',
  'room',
  'type',
  'note',
]

/** Tokens as used in the class dropdown (split on whitespace and commas). */
export function classTokensFromCell(classField: string): string[] {
  const set = new Set<string>()
  for (const part of classField.split(/\s+/)) {
    if (!part) continue
    const cleaned = part.replace(/,+$/, '')
    if (cleaned) set.add(cleaned)
  }
  return Array.from(set)
}

/**
 * True if the row's Klasse cell lists the given class (same idea as filtering by exact option value).
 */
export function rowMatchesClass(row: LessonPlanRow, selectedClass: string): boolean {
  if (!selectedClass.trim() || !row.class?.trim()) return false
  const tokens = classTokensFromCell(row.class)
  return tokens.includes(selectedClass.trim())
}

function stableRowSnapshot(row: LessonPlanRow): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of ROW_KEYS) {
    out[key] = String(row[key] ?? '')
  }
  return out
}

/**
 * Canonical string for all rows matching `classLabel` across plan days; hash with SHA-256.
 */
export function canonicalStringForClass(plans: LessonPlanDayPayload[], classLabel: string): string {
  const entries: { date: string; line: string }[] = []

  for (const plan of plans) {
    const dateKey = plan.date ?? ''
    for (const row of plan.rows) {
      if (!rowMatchesClass(row, classLabel)) continue
      const snap = stableRowSnapshot(row)
      const line = JSON.stringify([dateKey, snap])
      entries.push({ date: dateKey, line })
    }
  }

  entries.sort((a, b) => {
    const c = a.date.localeCompare(b.date)
    if (c !== 0) return c
    return a.line.localeCompare(b.line)
  })

  return entries.map(e => e.line).join('\n')
}

export function fingerprintForClass(plans: LessonPlanDayPayload[], classLabel: string): string {
  const canonical = canonicalStringForClass(plans, classLabel)
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/** Validate class label for subscriptions (alphanumeric + common school suffixes). */
export function isValidClassLabel(classLabel: string): boolean {
  const t = classLabel.trim()
  if (t.length < 1 || t.length > 32) return false
  return /^[0-9a-zA-ZäöüÄÖÜß./-]+$/.test(t)
}
