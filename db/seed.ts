// Plain env + type imports only at module scope — everything else is
// dynamically imported inside main() below. Static imports are hoisted
// ahead of any code in this file (including the dotenv config() call), so a
// statically-imported '@/lib/db' would read process.env.DATABASE_URL before
// .env.local is ever loaded.
import { config } from 'dotenv'
config({ path: '.env.local' })

import type { TenantContext } from '@/lib/tenant'
import type { SessionUser } from '@/lib/auth'

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password123!'

async function main() {
  const { sql, eq, and } = await import('drizzle-orm')
  const { db } = await import('@/lib/db')
  const { departments, users, memos, workflowSteps, memoAttachments } = await import('@/db/schema')
  const { createOrganization } = await import('@/lib/org-setup')
  const { hashPassword } = await import('@/lib/auth')
  const { submitMemo, actOnMemo, resubmitMemo, cancelMemo } = await import('@/lib/workflow')

  function ctxOf(u: SessionUser): TenantContext {
    return { orgId: u.orgId, user: u }
  }

  async function truncateAll() {
    await db.execute(sql`
      DO $$
      DECLARE t text;
      BEGIN
        FOR t IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
        LOOP
          EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
        END LOOP;
      END $$;
    `)
  }

  async function addUser(
    orgId: string, deptId: string, name: string, email: string,
    opts?: { designation?: string; role?: 'org_admin' | 'user' },
  ): Promise<SessionUser> {
    const [u] = await db.insert(users).values({
      orgId, departmentId: deptId, name, email: email.toLowerCase(),
      designation: opts?.designation ?? null, role: opts?.role ?? 'user',
      passwordHash: await hashPassword(SEED_PASSWORD),
    }).returning()
    return {
      id: u.id, orgId: u.orgId, name: u.name, email: u.email, role: u.role,
      status: u.status, departmentId: u.departmentId, designation: u.designation,
      mustChangePassword: u.mustChangePassword,
    }
  }

  async function addDept(orgId: string, name: string, description: string) {
    const [d] = await db.insert(departments).values({ orgId, name, description }).returning()
    return d
  }

  async function draftMemo(o: {
    orgId: string; prefix: string; author: SessionUser; deptId: string
    subject: string; body: string; priority?: 'normal' | 'high' | 'urgent'
  }) {
    const year = new Date().getUTCFullYear()
    const rows = (await db.execute(sql`
      INSERT INTO memo_counters (org_id, year, seq) VALUES (${o.orgId}, ${year}, 1)
      ON CONFLICT (org_id, year) DO UPDATE SET seq = memo_counters.seq + 1
      RETURNING seq
    `)) as unknown as { seq: number }[]
    const memoNumber = `${o.prefix}-${year}-${String(rows[0].seq).padStart(4, '0')}`

    const [memo] = await db.insert(memos).values({
      orgId: o.orgId, memoNumber, subject: o.subject, bodyHtml: `<p>${o.body}</p>`,
      authorId: o.author.id, departmentId: o.deptId, priority: o.priority ?? 'normal', status: 'draft',
    }).returning()
    return memo
  }

  async function setParticipants(
    orgId: string, memoId: string,
    steps: { title: string; assignee: SessionUser; action?: 'approve' | 'review' }[],
  ) {
    await db.insert(workflowSteps).values(steps.map((s, i) => ({
      orgId, memoId, cycle: 1, stepNo: i + 1,
      positionTitle: s.title, assigneeUserId: s.assignee.id, requiredAction: s.action ?? 'approve',
    })))
  }

  console.log('Seeding demo data — this truncates every table first.')
  await truncateAll()

  // ---------------------------------------------------------------------
  // Northbridge University
  // ---------------------------------------------------------------------
  const nbuSetup = await createOrganization({
    orgName: 'Northbridge University', orgCode: 'NBU',
    adminName: 'Dr. Farida Chowdhury', adminEmail: 'admin@nbu.demo', password: SEED_PASSWORD,
    contactEmail: 'registrar@nbu.demo', contactPhone: '+1 555-0142', address: '400 Campus Drive, Northbridge',
  })
  if (!nbuSetup.ok) throw new Error(nbuSetup.error)
  const nbuId = nbuSetup.orgId

  const [nbuAdminRow] = await db.select().from(users).where(eq(users.id, nbuSetup.userId))
  const nbuAdmin: SessionUser = {
    id: nbuAdminRow.id, orgId: nbuAdminRow.orgId, name: nbuAdminRow.name, email: nbuAdminRow.email,
    role: nbuAdminRow.role, status: nbuAdminRow.status, departmentId: nbuAdminRow.departmentId,
    designation: nbuAdminRow.designation, mustChangePassword: nbuAdminRow.mustChangePassword,
  }

  const [{ id: administrationDeptId }] = await db.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.orgId, nbuId), eq(departments.name, 'Administration')))
  const financeDept = await addDept(nbuId, 'Finance', 'Budgets, expenditure and procurement approval')
  const csDept = await addDept(nbuId, 'Computer Science', 'Academic department: Computer Science')
  const hrDept = await addDept(nbuId, 'Human Resources', 'Personnel, leave and recruitment')
  const procurementDept = await addDept(nbuId, 'Procurement', 'Purchasing and vendor management')

  const ayesha = await addUser(nbuId, csDept.id, 'Ayesha Rahman', 'ayesha@nbu.demo', { designation: 'Lecturer' })
  const karim = await addUser(nbuId, csDept.id, 'Karim Uddin', 'karim@nbu.demo', { designation: 'Department Head, Computer Science' })
  const nadia = await addUser(nbuId, financeDept.id, 'Nadia Haque', 'nadia@nbu.demo', { designation: 'Finance Manager' })
  const imran = await addUser(nbuId, administrationDeptId, 'Imran Chowdhury', 'imran@nbu.demo', { designation: 'Director' })
  const sabrina = await addUser(nbuId, hrDept.id, 'Sabrina Islam', 'sabrina@nbu.demo', { designation: 'HR Officer' })
  const rafi = await addUser(nbuId, procurementDept.id, 'Rafi Ahmed', 'rafi@nbu.demo', { designation: 'Procurement Officer' })
  const tania = await addUser(nbuId, csDept.id, 'Tania Ferdous', 'tania@nbu.demo', { designation: 'Senior Lecturer (delegate)' })

  // 1. Draft — nothing submitted yet.
  await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: ayesha, deptId: csDept.id,
    subject: 'Laboratory software licenses for Fall term',
    body: 'Requesting renewal of MATLAB and SPSS site licenses for the CS teaching lab ahead of the Fall term.',
    priority: 'normal',
  })

  // 2. Submitted, sitting at step 1.
  const memoStep1 = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: ayesha, deptId: csDept.id,
    subject: 'Conference travel — ICSE 2027',
    body: 'Requesting approval and funding to attend and present at ICSE 2027.',
    priority: 'normal',
  })
  await setParticipants(nbuId, memoStep1.id, [
    { title: 'Department Head', assignee: karim }, { title: 'Finance Manager', assignee: nadia },
    { title: 'Director', assignee: imran },
  ])
  await submitMemo(ctxOf(ayesha), memoStep1.id)

  // 3. Submitted, one approval recorded, sitting at step 2.
  const memoStep2 = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: ayesha, deptId: csDept.id,
    subject: 'New GPU workstation for the research lab',
    body: 'Requesting approval to purchase one GPU workstation for graduate research supervision.',
    priority: 'high',
  })
  await setParticipants(nbuId, memoStep2.id, [
    { title: 'Department Head', assignee: karim }, { title: 'Finance Manager', assignee: nadia },
    { title: 'Director', assignee: imran },
  ])
  await submitMemo(ctxOf(ayesha), memoStep2.id)
  await actOnMemo(ctxOf(karim), memoStep2.id, 'approve', 'Justified by current lab capacity.')

  // 4. Changes requested, resubmitted once — two versions on record.
  const memoChanges = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: ayesha, deptId: csDept.id,
    subject: 'Adjunct instructor appointment — Spring term',
    body: 'Requesting approval to appoint an adjunct instructor for the Spring term introductory course.',
    priority: 'normal',
  })
  await setParticipants(nbuId, memoChanges.id, [
    { title: 'Department Head', assignee: karim }, { title: 'HR Officer', assignee: sabrina },
  ])
  await submitMemo(ctxOf(ayesha), memoChanges.id)
  await actOnMemo(ctxOf(karim), memoChanges.id, 'request_changes', "Please attach the candidate's CV and confirm the course load.")
  await db.update(memos).set({
    bodyHtml: '<p>Requesting approval to appoint an adjunct instructor for the Spring term introductory course. CV attached; course load confirmed at 2 sections.</p>',
  }).where(eq(memos.id, memoChanges.id))
  await resubmitMemo(ctxOf(ayesha), memoChanges.id, 'resume')

  // 5. Rejected.
  const memoRejected = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: rafi, deptId: procurementDept.id,
    subject: 'Vendor contract — off-campus catering',
    body: 'Requesting approval to sign a one-year catering contract with an off-campus vendor.',
    priority: 'normal',
  })
  await setParticipants(nbuId, memoRejected.id, [
    { title: 'Finance Manager', assignee: nadia }, { title: 'Director', assignee: imran },
  ])
  await submitMemo(ctxOf(rafi), memoRejected.id)
  await actOnMemo(ctxOf(nadia), memoRejected.id, 'reject', 'Vendor quote exceeds the approved catering budget for this fiscal year.')

  // 6. Fully approved, complete history, with an attachment.
  const memoApproved = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: sabrina, deptId: hrDept.id,
    subject: 'Annual leave calendar — publication',
    body: 'Requesting sign-off to publish the finalized annual leave calendar for all staff.',
    priority: 'normal',
  })
  await setParticipants(nbuId, memoApproved.id, [
    { title: 'Department Head', assignee: karim }, { title: 'Director', assignee: imran },
  ])
  await submitMemo(ctxOf(sabrina), memoApproved.id)
  await db.insert(memoAttachments).values({
    orgId: nbuId, memoId: memoApproved.id, filename: 'leave-calendar-draft.txt',
    mime: 'text/plain', sizeBytes: 42, data: Buffer.from('Draft leave calendar — see attached schedule.'),
    uploadedById: sabrina.id, versionNo: 1,
  })
  await actOnMemo(ctxOf(karim), memoApproved.id, 'approve', 'Consistent with department staffing.')
  await actOnMemo(ctxOf(imran), memoApproved.id, 'approve', 'Approved for publication.')

  // 7. Cancelled by its author.
  const memoCancelled = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: ayesha, deptId: csDept.id,
    subject: 'Guest lecture honorarium — withdrawn',
    body: 'Requesting an honorarium payment for a guest lecture.',
    priority: 'normal',
  })
  await setParticipants(nbuId, memoCancelled.id, [{ title: 'Finance Manager', assignee: nadia }])
  await submitMemo(ctxOf(ayesha), memoCancelled.id)
  await cancelMemo(ctxOf(ayesha), memoCancelled.id, 'Guest lecture was rescheduled to next term.')

  // 8. Urgent, pending review.
  const memoUrgent = await draftMemo({
    orgId: nbuId, prefix: 'NBU', author: rafi, deptId: procurementDept.id,
    subject: 'Emergency HVAC repair — server room',
    body: 'The server room cooling unit has failed. Requesting urgent approval for emergency repair.',
    priority: 'urgent',
  })
  await setParticipants(nbuId, memoUrgent.id, [
    { title: 'Director', assignee: imran, action: 'review' }, { title: 'Finance Manager', assignee: nadia },
  ])
  await submitMemo(ctxOf(rafi), memoUrgent.id)

  // ---------------------------------------------------------------------
  // Aurora Logistics — a second, fully independent organization.
  // ---------------------------------------------------------------------
  const auroraSetup = await createOrganization({
    orgName: 'Aurora Logistics', orgCode: 'AUR',
    adminName: 'Tanvir Alam', adminEmail: 'admin@aurora.demo', password: SEED_PASSWORD,
    contactEmail: 'ops@aurora.demo', contactPhone: '+1 555-0199', address: '12 Harbor Way, Port Aurora',
  })
  if (!auroraSetup.ok) throw new Error(auroraSetup.error)
  const aurId = auroraSetup.orgId

  const [aurAdminRow] = await db.select().from(users).where(eq(users.id, auroraSetup.userId))
  const aurAdmin: SessionUser = {
    id: aurAdminRow.id, orgId: aurAdminRow.orgId, name: aurAdminRow.name, email: aurAdminRow.email,
    role: aurAdminRow.role, status: aurAdminRow.status, departmentId: aurAdminRow.departmentId,
    designation: aurAdminRow.designation, mustChangePassword: aurAdminRow.mustChangePassword,
  }

  const [{ id: aurAdministrationDeptId }] = await db.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.orgId, aurId), eq(departments.name, 'Administration')))
  const opsDept = await addDept(aurId, 'Operations', 'Fleet and warehouse operations')
  const aurFinanceDept = await addDept(aurId, 'Finance', 'Accounts and budgeting')

  const meera = await addUser(aurId, opsDept.id, 'Meera Fernandes', 'meera@aurora.demo', { designation: 'Operations Lead' })
  const dev = await addUser(aurId, opsDept.id, 'Devendra Rao', 'devendra@aurora.demo', { designation: 'Warehouse Supervisor' })
  const priya = await addUser(aurId, aurFinanceDept.id, 'Priya Nair', 'priya@aurora.demo', { designation: 'Finance Officer' })
  await addUser(aurId, aurAdministrationDeptId, 'Yusuf Kader', 'yusuf@aurora.demo', { designation: 'Compliance Officer' })

  const aurMemo = await draftMemo({
    orgId: aurId, prefix: 'AUR', author: meera, deptId: opsDept.id,
    subject: 'Forklift maintenance contract renewal',
    body: 'Requesting approval to renew the annual forklift maintenance contract with our current vendor.',
    priority: 'normal',
  })
  await setParticipants(aurId, aurMemo.id, [
    { title: 'Warehouse Supervisor', assignee: dev }, { title: 'Finance Officer', assignee: priya },
  ])
  await submitMemo(ctxOf(meera), aurMemo.id)

  // ---------------------------------------------------------------------
  // Credential summary
  // ---------------------------------------------------------------------
  console.log('\nSeed complete. Demo credentials (password for every account below):')
  console.log(`  Password: ${SEED_PASSWORD}\n`)
  console.log('Northbridge University (NBU):')
  for (const u of [nbuAdmin, ayesha, karim, nadia, imran, sabrina, rafi, tania]) {
    console.log(`  ${u.email.padEnd(22)} ${u.role === 'org_admin' ? '(admin)' : ''} ${u.designation ?? ''}`)
  }
  console.log('\nAurora Logistics (AUR):')
  for (const u of [aurAdmin, meera, dev, priya]) {
    console.log(`  ${u.email.padEnd(22)} ${u.role === 'org_admin' ? '(admin)' : ''} ${u.designation ?? ''}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
