import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type AuditLogInput = {
  userId: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  payload?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

class AuditLogService {
  async createLog(input: AuditLogInput) {
    return prisma.auditLog.create({
      data: input,
    });
  }
}

export const auditLogService = new AuditLogService();
