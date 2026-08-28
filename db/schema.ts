import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, customType,
  uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const ROLES = ['org_admin', 'user'] as const
export const USER_STATUSES = ['active', 'inactive'] as const
export const PRIORITIES = ['normal', 'high', 'urgent'] as const
export const MEMO_STATUSES = [
  'draft', 'submitted', 'pending_review', 'pending_approval',
  'changes_requested', 'rejected', 'approved', 'cancelled',
] as const
export const REQUIRED_ACTIONS = ['approve', 'review'] as const
export const STEP_OUTCOMES = [
  'pending', 'approved', 'reviewed', 'rejected', 'changes_requested', 'skipped',
] as const
export const EVENT_TYPES = [
  'created', 'submitted', 'resubmitted', 'approved', 'reviewed', 'rejected',
  'changes_requested', 'comment', 'forwarded', 'completed', 'cancelled',
  'attachment_added', 'attachment_deleted', 'version_created',
  'participant_assigned', 'edited',
] as const
export const NOTIFICATION_TYPES = [
  'action_required', 'approved', 'rejected', 'changes_requested',
  'comment_added', 'resubmitted', 'workflow_completed', 'workflow_assigned',
] as const
export const DELEGATION_STATUSES = ['active', 'revoked', 'expired'] as const

export type Role = (typeof ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type MemoStatus = (typeof MEMO_STATUSES)[number]
export type RequiredAction = (typeof REQUIRED_ACTIONS)[number]
export type StepOutcome = (typeof STEP_OUTCOMES)[number]
export type EventType = (typeof EVENT_TYPES)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
export type DelegationStatus = (typeof DELEGATION_STATUSES)[number]

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  code: text('code').notNull(),
  logo: bytea('logo'),
  logoMime: text('logo_mime'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  address: text('address'),
  config: jsonb('config').$type<{ memoPrefix: string }>().notNull().default({ memoPrefix: 'MEMO' }),
  createdAt: createdAt(),
})

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('departments_org_idx').on(t.orgId)])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  designation: text('designation'),
  departmentId: uuid('department_id').references(() => departments.id),
  role: text('role', { enum: ROLES }).notNull().default('user'),
  status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
  passwordHash: text('password_hash').notNull(),
  // Set when an administrator issues the password, cleared once the user
  // picks their own. Gates the app until they do.
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('users_org_email_idx').on(t.orgId, t.email),
  index('users_org_idx').on(t.orgId),
])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index('sessions_user_idx').on(t.userId)])

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const memoCategories = pgTable('memo_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('categories_org_idx').on(t.orgId)])

export const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('templates_org_idx').on(t.orgId)])

export const workflowTemplateSteps = pgTable('workflow_template_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  templateId: uuid('template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  stepNo: integer('step_no').notNull(),
  positionTitle: text('position_title').notNull(),
  requiredAction: text('required_action', { enum: REQUIRED_ACTIONS }).notNull().default('approve'),
}, (t) => [uniqueIndex('template_step_idx').on(t.templateId, t.stepNo)])

export const memoCounters = pgTable('memo_counters', {
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  year: integer('year').notNull(),
  seq: integer('seq').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.orgId, t.year] })])

export const memos = pgTable('memos', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoNumber: text('memo_number').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull().default(''),
  authorId: uuid('author_id').notNull().references(() => users.id),
  departmentId: uuid('department_id').references(() => departments.id),
  categoryId: uuid('category_id').references(() => memoCategories.id),
  priority: text('priority', { enum: PRIORITIES }).notNull().default('normal'),
  status: text('status', { enum: MEMO_STATUSES }).notNull().default('draft'),
  templateId: uuid('template_id').references(() => workflowTemplates.id),
  currentCycle: integer('current_cycle').notNull().default(0),
  currentStepNo: integer('current_step_no'),
  currentVersion: integer('current_version').notNull().default(0),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  finalApproverId: uuid('final_approver_id').references(() => users.id),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('memos_org_number_idx').on(t.orgId, t.memoNumber),
  index('memos_org_status_idx').on(t.orgId, t.status),
  index('memos_org_author_idx').on(t.orgId, t.authorId),
  index('memos_search_idx').using(
    'gin',
    sql`to_tsvector('english', ${t.subject} || ' ' || ${t.bodyHtml})`,
  ),
])

export const memoVersions = pgTable('memo_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  versionNo: integer('version_no').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  editorId: uuid('editor_id').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('memo_version_idx').on(t.memoId, t.versionNo)])

export const memoAttachments = pgTable('memo_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  data: bytea('data').notNull(),
  uploadedById: uuid('uploaded_by_id').notNull().references(() => users.id),
  versionNo: integer('version_no').notNull().default(1),
  createdAt: createdAt(),
}, (t) => [index('attachments_memo_idx').on(t.memoId)])

export const workflowSteps = pgTable('workflow_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  cycle: integer('cycle').notNull(),
  stepNo: integer('step_no').notNull(),
  positionTitle: text('position_title'),
  assigneeUserId: uuid('assignee_user_id').notNull().references(() => users.id),
  requiredAction: text('required_action', { enum: REQUIRED_ACTIONS }).notNull().default('approve'),
  outcome: text('outcome', { enum: STEP_OUTCOMES }).notNull().default('pending'),
  actedByUserId: uuid('acted_by_user_id').references(() => users.id),
  onBehalfOfUserId: uuid('on_behalf_of_user_id').references(() => users.id),
  actedAt: timestamp('acted_at', { withTimezone: true }),
  comment: text('comment'),
}, (t) => [
  uniqueIndex('workflow_step_idx').on(t.memoId, t.cycle, t.stepNo),
  index('workflow_assignee_idx').on(t.assigneeUserId, t.outcome),
])

export const memoEvents = pgTable('memo_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  type: text('type', { enum: EVENT_TYPES }).notNull(),
  actorId: uuid('actor_id').references(() => users.id),
  onBehalfOfId: uuid('on_behalf_of_id').references(() => users.id),
  cycle: integer('cycle'),
  stepNo: integer('step_no'),
  comment: text('comment'),
  detail: text('detail'),
  createdAt: createdAt(),
}, (t) => [index('events_memo_idx').on(t.memoId, t.createdAt)])

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
  memoId: uuid('memo_id').references(() => memos.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('notifications_user_idx').on(t.userId, t.readAt)])

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  actorId: uuid('actor_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  description: text('description').notNull(),
  ip: text('ip'),
  createdAt: createdAt(),
}, (t) => [index('audit_org_idx').on(t.orgId, t.createdAt)])

export const delegations = pgTable('delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  delegatorId: uuid('delegator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delegateId: uuid('delegate_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  reason: text('reason'),
  status: text('status', { enum: DELEGATION_STATUSES }).notNull().default('active'),
  createdAt: createdAt(),
}, (t) => [index('delegations_delegate_idx').on(t.delegateId, t.status)])
