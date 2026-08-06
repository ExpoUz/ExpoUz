import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Writes an immutable audit-log entry for every admin write action (any
 * non-GET request to the admin controller) after it succeeds. Records the
 * acting admin, the route, the target id, and a sanitized snapshot of the
 * request body. Logging is best-effort and never breaks the response.
 *
 * Read the trail back via GET /v1/admin/activity-log?category=ADMIN_ACTION.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    // Only log state-changing actions; reads (GET) are not audited.
    if (req.method === 'GET') return next.handle();

    return next.handle().pipe(
      tap(() => {
        const adminId = req.user?.id;
        if (!adminId) return;

        const routePath: string = req.route?.path ?? req.originalUrl ?? req.url ?? '';
        const action = `${req.method} ${routePath}`;
        const targetId =
          req.params?.id || req.params?.matchId || req.params?.transactionId || undefined;

        // Fire-and-forget: an audit write must never fail the admin action.
        this.prisma.activityLog
          .create({
            data: {
              userId: adminId,
              action,
              category: 'ADMIN_ACTION',
              description: buildDescription(req.method, routePath, req.params),
              entityId: targetId,
              meta: {
                method: req.method,
                path: routePath,
                params: req.params ?? {},
                body: sanitizeBody(req.body),
              } as unknown as Prisma.InputJsonValue,
              ipAddress: req.ip,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}

/** Redact anything password-like before snapshotting the request body. */
function sanitizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    out[k] = /password|token|secret|key/i.test(k) ? '[redacted]' : v;
  }
  return out;
}

/** Best-effort human-readable summary for the audit feed. */
function buildDescription(
  method: string,
  path: string,
  params: Record<string, string> = {},
): string {
  const id = params?.id ?? params?.matchId ?? params?.transactionId ?? '';
  if (path.includes('/ban')) return `Toggled ban on user ${id}`;
  if (path.includes('/wallet')) return `Adjusted wallet for user ${id}`;
  if (path.includes('/role')) return `Changed role for user ${id}`;
  if (path.includes('/verify-phone')) return `Manually verified phone for user ${id}`;
  if (path.includes('/verify')) return `Reviewed pitch ${id}`;
  if (path.includes('/release')) return `Released transaction ${id}`;
  if (path.includes('/disputes')) return `Resolved dispute for match ${id}`;
  if (path.includes('matches') && method === 'DELETE')
    return `Force-cancelled match ${id}`;
  if (path.includes('settings')) return 'Updated platform settings';
  if (path.includes('announcements')) return 'Sent an announcement';
  if (path.includes('pitch-admins')) return `Managed pitch admin ${id}`;
  if (path.includes('locations')) return `Managed location ${id}`;
  return `${method} ${path}`;
}
