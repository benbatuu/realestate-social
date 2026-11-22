import type {
  IntegrationConnection,
  IntegrationConnectRequest,
  IntegrationConnectResult,
  IntegrationsResponse,
} from '@app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/http/app-error';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PrismaService } from '../infra/prisma.service';
import { LeadPilotService } from './leadpilot/leadpilot.service';

type Row = {
  id: string;
  provider: IntegrationConnection['provider'];
  name: string;
  status: IntegrationConnection['status'];
  lastSyncAt: Date | null;
  capabilitiesJson?: unknown;
  createdAt: Date;
};

function toConnection(r: Row, run: IntegrationConnection['lastRun'] = null): IntegrationConnection {
  return {
    id: r.id,
    provider: r.provider,
    name: r.name,
    status: r.status,
    lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
    lastCheck: (r.capabilitiesJson as IntegrationConnection['lastCheck'] | undefined) ?? null,
    lastRun: run,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly leadpilot: LeadPilotService,
  ) {}

  async list(tenantId: string): Promise<IntegrationsResponse> {
    const [rows, ent] = await Promise.all([
      this.prisma.crmConnection.findMany({
        where: { tenantId, systemKey: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          provider: true,
          name: true,
          status: true,
          lastSyncAt: true,
          createdAt: true,
        },
      }),
      this.entitlements.summary(tenantId),
    ]);
    const runs = await this.leadpilot.latestRuns(
      tenantId,
      rows.filter((r) => r.provider === 'LEADPILOT').map((r) => r.id),
    );
    const used = ent.usedCrmConnections;
    const max = ent.maxCrmConnections;
    return {
      connections: rows.map((r) => toConnection(r as Row, runs.get(r.id) ?? null)),
      usage: { used, max },
      canConnect: used < max,
    };
  }

  /** Connects LeadPilot after a live check. Other providers are not connectable yet. */
  async connect(
    tenantId: string,
    userId: string,
    input: IntegrationConnectRequest,
  ): Promise<IntegrationConnectResult> {
    void userId;
    const ent = await this.entitlements.summary(tenantId);
    if (ent.usedCrmConnections >= ent.maxCrmConnections) {
      throw new AppError(
        HttpStatus.CONFLICT,
        'SEAT_LIMIT_REACHED',
        'Paketinizdeki bağlantı limitine ulaştınız.',
      );
    }
    return this.leadpilot.connect(tenantId, input);
  }

  async requestSync(tenantId: string, id: string): Promise<void> {
    await this.leadpilot.requestSync(tenantId, id);
  }

  /** Removes a connection. Properties keep their data; lead forwarding to it stops. */
  async remove(tenantId: string, id: string): Promise<void> {
    const removed = await this.prisma.crmConnection.deleteMany({
      where: { id, tenantId, systemKey: null },
    });
    if (removed.count !== 1) throw AppError.notFound('Connection not found');
  }

  async disable(tenantId: string, id: string, enabled: boolean): Promise<void> {
    const moved = await this.prisma.crmConnection.updateMany({
      where: { id, tenantId, systemKey: null },
      data: { status: enabled ? 'ACTIVE' : 'DISABLED' },
    });
    if (moved.count !== 1) throw AppError.notFound('Connection not found');
  }
}
