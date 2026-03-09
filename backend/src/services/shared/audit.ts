import { logger } from "../../config/logger";

const MAX_AUDIT_JSON_LENGTH = 240;

type AuditLogDataInput = {
  entity: string;
  entityId: string;
  action: string;
  createdById?: number | null;
  beforeJson?: unknown;
  afterJson?: unknown;
};

type AuditLogWriter = {
  auditLog: {
    create: (args: {
      data: {
        entity: string;
        entityId: string;
        action: string;
        createdById?: number | null;
        beforeJson?: string | null;
        afterJson?: string | null;
      };
    }) => Promise<unknown>;
  };
};

const toAuditJson = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const raw =
    typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();

  if (raw.length <= MAX_AUDIT_JSON_LENGTH) {
    return raw;
  }

  const meta = `[truncated:${raw.length}]`;
  return `${raw.slice(0, MAX_AUDIT_JSON_LENGTH - meta.length)}${meta}`;
};

export const createAuditLog = async (client: AuditLogWriter, input: AuditLogDataInput) => {
  try {
    await client.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        createdById: input.createdById ?? null,
        beforeJson: toAuditJson(input.beforeJson),
        afterJson: toAuditJson(input.afterJson),
      },
    });
  } catch (error) {
    logger.warn("Audit log write skipped", error);
  }
};
