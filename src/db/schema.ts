import { bigint, pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core'

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    classLabel: text('class_label').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  table => [uniqueIndex('push_sub_ep_class').on(table.endpoint, table.classLabel)],
)

export const classPlanFingerprints = pgTable('class_plan_fingerprints', {
  classLabel: text('class_label').primaryKey(),
  fingerprint: text('fingerprint').notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})
