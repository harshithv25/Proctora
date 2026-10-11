import { prisma } from "../config/db";

export interface LogEventParams {
  eventType: string;
  userId?: string | null;
  username?: string | null;
  userEmail?: string | null;
  timestamp?: Date;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Persists an audit log entry to the `logs` database table.
 * Resolves user information automatically if only userId is supplied.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    let { userId, username, userEmail, eventType, timestamp, details, ipAddress, userAgent } = params;

    // If userId is provided but username or userEmail is missing, fetch user details
    if (userId && (!username || !userEmail)) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });
        if (user) {
          username = username || user.name;
          userEmail = userEmail || user.email;
        }
      } catch {
        // Silently continue if user lookup fails
      }
    }

    await prisma.log.create({
      data: {
        eventType,
        userId: userId ?? null,
        username: username ?? null,
        userEmail: userEmail ?? null,
        timestamp: timestamp || new Date(),
        details: details ? (details as any) : undefined,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to persist event log:", err);
  }
}
