import { prisma } from "../../config/db";

export interface LogFilterParams {
  eventType?: string;
  username?: string;
  userEmail?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function getLogs(params: LogFilterParams) {
  const where: any = {};

  if (params.eventType && params.eventType !== "all") {
    where.eventType = params.eventType;
  }

  if (params.username && params.username.trim()) {
    where.username = {
      contains: params.username.trim(),
      mode: "insensitive",
    };
  }

  if (params.userEmail && params.userEmail.trim()) {
    where.userEmail = {
      contains: params.userEmail.trim(),
      mode: "insensitive",
    };
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { eventType: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { userEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.startDate || params.endDate) {
    where.timestamp = {};
    if (params.startDate) {
      where.timestamp.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.timestamp.lte = new Date(params.endDate);
    }
  }

  const limit = Math.min(Math.max(params.limit || 50, 1), 500);
  const offset = Math.max(params.offset || 0, 0);

  const [logs, total, eventTypesRaw, usersRaw] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.log.count({ where }),
    prisma.log.findMany({
      select: { eventType: true },
      distinct: ["eventType"],
    }),
    prisma.log.findMany({
      where: { userEmail: { not: null } },
      select: { userEmail: true },
      distinct: ["userEmail"],
    }),
  ]);

  const eventTypes = eventTypesRaw.map((e) => e.eventType).sort();

  // Aggregate stats across all logs
  const [authCount, testCount, anomalyCount] = await Promise.all([
    prisma.log.count({
      where: {
        eventType: { in: ["sign_up", "sign_in", "log_out", "password_reset", "2fa_setup"] },
      },
    }),
    prisma.log.count({
      where: {
        eventType: { in: ["test_create", "test_edit", "test_delete", "test_attempt", "test_finish"] },
      },
    }),
    prisma.log.count({
      where: {
        eventType: { in: ["anomaly_detected", "fullscreen_exit", "fullscreen_event", "auto_logout"] },
      },
    }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
    eventTypes,
    stats: {
      totalLogs: total,
      uniqueUsers: usersRaw.length,
      authEvents: authCount,
      testEvents: testCount,
      anomalies: anomalyCount,
    },
  };
}
