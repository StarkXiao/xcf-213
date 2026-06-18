import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import { logCreate, logUpdate, logDelete } from '../lib/operationLog';

interface SurveillanceRuleQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  targetType?: string;
  status?: string;
  alertLevel?: string;
  caseId?: string;
}

interface SurveillanceRuleCreate {
  name: string;
  description?: string;
  targetType: any;
  targetIds?: any;
  locationKeywords?: string;
  conditions?: any;
  alertLevel?: any;
  notifyChannels?: any;
  notifyUsers?: any;
  validFrom?: string;
  validTo?: string;
  status?: any;
  caseId?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface SurveillanceRuleUpdate extends Partial<SurveillanceRuleCreate> {}

interface ToggleBody {
  operatorName?: string;
}

function generateRuleNumber() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SR${dateStr}${random}`;
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/stats', async () => {
    const [total, activeRules, inactiveRules, expiredRules, alertLevelStats, targetTypeStats] =
      await Promise.all([
        prisma.surveillanceRule.count(),
        prisma.surveillanceRule.count({ where: { status: 'ACTIVE' } }),
        prisma.surveillanceRule.count({ where: { status: 'INACTIVE' } }),
        prisma.surveillanceRule.count({ where: { status: 'EXPIRED' } }),
        prisma.$queryRaw`
          SELECT "alertLevel" as level, COUNT(*) as count
          FROM "SurveillanceRule"
          GROUP BY "alertLevel"
        `,
        prisma.$queryRaw`
          SELECT "targetType" as type, COUNT(*) as count
          FROM "SurveillanceRule"
          GROUP BY "targetType"
        `,
      ]);

    const alertCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    (alertLevelStats as any[]).forEach((item: any) => {
      alertCounts[item.level] = Number(item.count);
    });

    const targetCounts: Record<string, number> = { PERSON: 0, LOCATION: 0, EVIDENCE: 0 };
    (targetTypeStats as any[]).forEach((item: any) => {
      targetCounts[item.type] = Number(item.count);
    });

    const recentRules = await prisma.surveillanceRule.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { case: { select: { id: true, caseNumber: true, title: true } } },
    });

    return {
      total,
      activeRules,
      inactiveRules,
      expiredRules,
      alertLevelCounts: alertCounts,
      targetTypeCounts: targetCounts,
      recentRules,
    };
  });

  fastify.get(
    '/',
    async (request: FastifyRequest<{ Querystring: SurveillanceRuleQuery }>, reply) => {
      const {
        page = 1,
        pageSize = 10,
        keyword,
        targetType,
        status,
        alertLevel,
        caseId,
      } = request.query;
      const skip = (page - 1) * pageSize;

      const where: any = {};

      if (keyword) {
        where.OR = [
          { name: { contains: keyword, mode: 'insensitive' } },
          { ruleNumber: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ];
      }

      if (targetType) where.targetType = targetType;
      if (status) where.status = status;
      if (alertLevel) where.alertLevel = alertLevel;
      if (caseId) where.caseId = caseId;

      const [total, items] = await Promise.all([
        prisma.surveillanceRule.count({ where }),
        prisma.surveillanceRule.findMany({
          where,
          include: {
            case: { select: { id: true, caseNumber: true, title: true } },
            _count: { select: { alerts: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      return { items, total, page, pageSize };
    }
  );

  fastify.get(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const rule = await prisma.surveillanceRule.findUnique({
        where: { id: request.params.id },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          alerts: {
            orderBy: { triggerTime: 'desc' },
            take: 20,
            include: {
              case: { select: { id: true, caseNumber: true, title: true } },
              person: { select: { id: true, name: true, personType: true } },
              clue: { select: { id: true, clueNumber: true, title: true } },
              evidence: { select: { id: true, evidenceNumber: true, name: true } },
            },
          },
        },
      });

      if (!rule) {
        reply.status(404).send({ error: '预警规则不存在' });
        return;
      }

      return rule;
    }
  );

  fastify.post(
    '/',
    async (request: FastifyRequest<{ Body: SurveillanceRuleCreate }>, reply) => {
      const {
        name,
        description,
        targetType,
        targetIds,
        locationKeywords,
        conditions,
        alertLevel,
        notifyChannels,
        notifyUsers,
        validFrom,
        validTo,
        status,
        caseId,
        operatorId,
        operatorName,
        operatorDept,
      } = request.body;

      const ruleNumber = generateRuleNumber();

      const rule = await prisma.surveillanceRule.create({
        data: {
          ruleNumber,
          name,
          description,
          targetType,
          targetIds: targetIds ? JSON.stringify(targetIds) : null,
          locationKeywords: locationKeywords || null,
          conditions: conditions ? JSON.stringify(conditions) : null,
          alertLevel,
          notifyChannels: notifyChannels ? JSON.stringify(notifyChannels) : null,
          notifyUsers: notifyUsers ? JSON.stringify(notifyUsers) : null,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
          status: status || 'ACTIVE',
          caseId,
          operatorId,
          operatorName,
          operatorDept,
        },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      await logCreate('SURVEILLANCE_RULE', rule.id, `创建预警规则: ${name}`, request, operatorName, rule);

      return rule;
    }
  );

  fastify.put(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: SurveillanceRuleUpdate }>, reply) => {
      const existing = await prisma.surveillanceRule.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警规则不存在' });
        return;
      }

      const {
        name,
        description,
        targetType,
        targetIds,
        locationKeywords,
        conditions,
        alertLevel,
        notifyChannels,
        notifyUsers,
        validFrom,
        validTo,
        status,
        caseId,
        operatorId,
        operatorName,
        operatorDept,
      } = request.body;

      const rule = await prisma.surveillanceRule.update({
        where: { id: request.params.id },
        data: {
          name,
          description,
          targetType,
          targetIds: targetIds ? JSON.stringify(targetIds) : null,
          locationKeywords: locationKeywords || null,
          conditions: conditions ? JSON.stringify(conditions) : null,
          alertLevel,
          notifyChannels: notifyChannels ? JSON.stringify(notifyChannels) : null,
          notifyUsers: notifyUsers ? JSON.stringify(notifyUsers) : null,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
          status,
          caseId,
          operatorId,
          operatorName,
          operatorDept,
        },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      await logUpdate('SURVEILLANCE_RULE', rule.id, `更新预警规则: ${name}`, request, existing, rule, operatorName);

      return rule;
    }
  );

  fastify.delete(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const existing = await prisma.surveillanceRule.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警规则不存在' });
        return;
      }

      await prisma.surveillanceRule.delete({
        where: { id: request.params.id },
      });

      await logDelete('SURVEILLANCE_RULE', existing.id, `删除预警规则: ${existing.name}`, request, existing);

      return { success: true };
    }
  );

  fastify.post(
    '/:id/toggle',
    async (request: FastifyRequest<{ Params: { id: string }; Body: ToggleBody }>, reply) => {
      const existing = await prisma.surveillanceRule.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警规则不存在' });
        return;
      }

      const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const rule = await prisma.surveillanceRule.update({
        where: { id: request.params.id },
        data: { status: newStatus },
      });

      await logUpdate(
        'SURVEILLANCE_RULE',
        rule.id,
        `${newStatus === 'ACTIVE' ? '启用' : '停用'}预警规则: ${existing.name}`,
        request,
        existing,
        rule,
        request.body?.operatorName
      );

      return rule;
    }
  );

  fastify.get('/options', async () => {
    const cases = await prisma.case.findMany({
      select: { id: true, caseNumber: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const persons = await prisma.person.findMany({
      select: { id: true, name: true, personType: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const evidences = await prisma.evidence.findMany({
      select: { id: true, evidenceNumber: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { cases, persons, evidences };
  });
}
