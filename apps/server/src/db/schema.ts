import { pgTable, text, jsonb, timestamp, uuid, integer } from 'drizzle-orm/pg-core'

export const documents = pgTable('documents', {
  id:         uuid('id').primaryKey().defaultRandom(),
  orgId:      text('org_id').notNull(),       // Clerk org ID (or 'personal' for solo users)
  createdBy:  text('created_by').notNull(),   // Clerk user ID
  name:       text('name').notNull(),
  pdfKey:     text('pdf_key').notNull(),      // R2/S3 object key
  schema:     jsonb('schema').notNull(),      // FormSchema v2.0
  fieldCount: integer('field_count').notNull().default(0),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
})

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
