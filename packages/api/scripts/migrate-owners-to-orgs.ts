/**
 * PART 2.3 — migrate existing venue owners into personal organizations.
 *
 * Before multi-tenancy, isolation was `pitch.ownerId` (one person). This gives
 * every legacy owner their own Organization so the partner panel keeps working
 * unchanged while everything downstream scopes by `organizationId`.
 *
 * For each user who owns at least one pitch with no `organizationId`:
 *   1. Reuse the org they already OWN, or create a personal Organization named
 *      after them (unique slug).
 *   2. Ensure an OrgMember(OWNER) row for them.
 *   3. Attach all their still-unassigned pitches to that org.
 *
 * Idempotent: re-running only touches pitches that are still unassigned and
 * never creates a second personal org for the same owner. Nothing changes
 * visibly for the owner — they still see exactly their own venues.
 *
 * Usage (dry-run is the DEFAULT — nothing is written without --apply):
 *   railway run npx ts-node --transpile-only scripts/migrate-owners-to-orgs.ts
 *   railway run npx ts-node --transpile-only scripts/migrate-owners-to-orgs.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function slugify(base: string): string {
  return base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** A slug that does not yet collide with an existing organization. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'venue-owner';
  let slug = root;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${root}-${++n}`;
  }
  return slug;
}

type Row = {
  ownerId: string;
  ownerName: string;
  action: 'created' | 'reused';
  orgName: string;
  pitchesAttached: number;
};

async function main() {
  // Owners that still have at least one unassigned pitch.
  const orphanPitches = await prisma.pitch.findMany({
    where: { organizationId: null },
    select: { id: true, ownerId: true },
  });

  const byOwner = new Map<string, string[]>();
  for (const p of orphanPitches) {
    if (!p.ownerId) continue;
    const list = byOwner.get(p.ownerId) ?? [];
    list.push(p.id);
    byOwner.set(p.ownerId, list);
  }

  const report: Row[] = [];

  for (const [ownerId, pitchIds] of byOwner) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    if (!owner) {
      console.warn(`⚠ pitch owner ${ownerId} not found — skipping ${pitchIds.length} pitch(es)`);
      continue;
    }
    const ownerName = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || owner.phone || ownerId.slice(0, 8);

    // 1. Reuse an org this user already OWNs, else create a personal one.
    const existingOwnership = await prisma.orgMember.findFirst({
      where: { userId: ownerId, role: 'OWNER' },
      include: { org: { select: { id: true, name: true } } },
    });

    let orgId: string;
    let orgName: string;
    let action: Row['action'];

    if (existingOwnership) {
      orgId = existingOwnership.orgId;
      orgName = existingOwnership.org.name;
      action = 'reused';
    } else {
      orgName = `${ownerName}${/s$/i.test(ownerName) ? "'" : "'s"} Venues`;
      const slug = await uniqueSlug(ownerName);
      action = 'created';
      if (APPLY) {
        const org = await prisma.organization.create({
          data: {
            name: orgName,
            slug,
            // Self-created personal org during migration (no superadmin actor).
            createdById: ownerId,
            members: { create: { userId: ownerId, role: 'OWNER', invitedBy: ownerId } },
          },
          select: { id: true },
        });
        orgId = org.id;
      } else {
        orgId = `(new:${slug})`;
      }
    }

    // 2. Ensure OWNER membership when reusing (create path already made it).
    if (action === 'reused' && APPLY) {
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId, userId: ownerId } },
        update: { role: 'OWNER' },
        create: { orgId, userId: ownerId, role: 'OWNER', invitedBy: ownerId },
      });
    }

    // 3. Attach the still-unassigned pitches.
    if (APPLY && orgId && !orgId.startsWith('(new:')) {
      await prisma.pitch.updateMany({
        where: { id: { in: pitchIds }, organizationId: null },
        data: { organizationId: orgId },
      });
    }

    report.push({ ownerId, ownerName, action, orgName, pitchesAttached: pitchIds.length });
  }

  console.log(
    `\n${APPLY ? 'APPLIED' : 'DRY-RUN'} — ${byOwner.size} owner(s), ${orphanPitches.length} unassigned pitch(es)\n`,
  );
  for (const r of report) {
    console.log(
      `• ${r.ownerName} (${r.ownerId.slice(0, 8)})\n` +
        `    org ${r.action}: "${r.orgName}" · +${r.pitchesAttached} venue(s)`,
    );
  }
  if (!APPLY) {
    console.log('\nNo changes written. Re-run with --apply after reviewing the above.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
