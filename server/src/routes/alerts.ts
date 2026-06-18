import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import { logCreate, logUpdate } from '../lib/operationLog';

interface AlertQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  alertLevel?: string;
  targetType?: string;
  ruleId?: string;
  caseId?: string;
  personId?: string;
  startDate?: string;
  endDate?: string;
}

interface AlertCreate {
  ruleId?: string;
  title: string;
  content: string;
  targetType: any;
  targetId?: string;
  targetName?: string;
  alertLevel?: any;
  triggerSource?: string;
  triggerTime?: string;
  caseId?: string;
  clueId?: string;
  evidenceId?: string;
  personId?: string;
  location?: string;
  metadata?: any;
  assigneeId?: string;
  assigneeName?: string;
  assigneeDept?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface AlertUpdate {
  title?: string;
  content?: string;
  status?: any;
  alertLevel?: any;
  assigneeId?: string;
  assigneeName?: string;
  assigneeDept?: string;
  resolveNote?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface AssignBody {
  assigneeId?: string;
  assigneeName?: string;
  assigneeDept?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface ResolveBody {
  status?: any;
  resolveNote?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface EscalateBody {
  reason?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface DisposalCreate {
  disposalType: any;
  title: string;
  description?: string;
  result?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
  nextAction?: string;
  taskId?: string;
  attachments?: any;
}

function generateAlertNumber() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AL${dateStr}${random}`;
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/stats', async () => {
    const [total, pendingCount, processingCount, resolvedCount, dismissedCount, escalatedCount, levelStats, typeStats, recentAlerts] =
      await Promise.all([
        prisma.alertMessage.count(),
        prisma.alertMessage.count({ where: { status: 'PENDING' } }),
        prisma.alertMessage.count({ where: { status: 'PROCESSING' } }),
        prisma.alertMessage.count({ where: { status: 'RESOLVED' } }),
        prisma.alertMessage.count({ where: { status: 'DISMISSED' } }),
        prisma.alertMessage.count({ where: { status: 'ESCALATED' } }),
        prisma.$queryRaw`
          SELECT "alertLevel" as level, COUNT(*) as count
          FROM "AlertMessage"
          GROUP BY "alertLevel"
        `,
        prisma.$queryRaw`
          SELECT "targetType" as type, COUNT(*) as count
          FROM "AlertMessage"
          GROUP BY "targetType"
        `,
        prisma.alertMessage.findMany({
          where: { status: { in: ['PENDING', 'PROCESSING'] } },
          orderBy: { triggerTime: 'desc' },
          take: 10,
          include: {
            rule: { select: { id: true, ruleNumber: true, name: true } },
            case: { select: { id: true, caseNumber: true, title: true } },
            person: { select: { id: true, name: true, personType: true } },
            clue: { select: { id: true, clueNumber: true, title: true } },
            evidence: { select: { id: true, evidenceNumber: true, name: true } },
          },
        }),
      ]);

    const alertLevelCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    (levelStats as any[]).forEach((item: any) => {
      alertLevelCounts[item.level] = Number(item.count);
    });

    const targetTypeCounts: Record<string, number> = { PERSON: 0, LOCATION: 0, EVIDENCE: 0 };
    (typeStats as any[]).forEach((item: any) => {
      targetTypeCounts[item.type] = Number(item.count);
    });

    return {
      total,
      statusCounts: {
        PENDING: pendingCount,
        PROCESSING: processingCount,
        RESOLVED: resolvedCount,
        DISMISSED: dismissedCount,
        ESCALATED: escalatedCount,
      },
      alertLevelCounts,
      targetTypeCounts,
      pendingAlerts: recentAlerts,
    };
  });

  fastify.get(
    '/',
    async (request: FastifyRequest<{ Querystring: AlertQuery }>, reply) => {
      const {
        page = 1,
        pageSize = 10,
        keyword,
        status,
        alertLevel,
        targetType,
        ruleId,
        caseId,
        personId,
        startDate,
        endDate,
      } = request.query;
      const skip = (page - 1) * pageSize;

      const where: any = {};

      if (keyword) {
        where.OR = [
          { title: { contains: keyword, mode: 'insensitive' } },
          { alertNumber: { contains: keyword, mode: 'insensitive' } },
          { content: { contains: keyword, mode: 'insensitive' } },
          { targetName: { contains: keyword, mode: 'insensitive' } },
        ];
      }

      if (status) where.status = status;
      if (alertLevel) where.alertLevel = alertLevel;
      if (targetType) where.targetType = targetType;
      if (ruleId) where.ruleId = ruleId;
      if (caseId) where.caseId = caseId;
      if (personId) where.personId = personId;

      if (startDate || endDate) {
        where.triggerTime = {};
        if (startDate) where.triggerTime.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.triggerTime.lte = end;
        }
      }

      const [total, items] = await Promise.all([
        prisma.alertMessage.count({ where }),
        prisma.alertMessage.findMany({
          where,
          include: {
            rule: { select: { id: true, ruleNumber: true, name: true } },
            case: { select: { id: true, caseNumber: true, title: true } },
            person: { select: { id: true, name: true, personType: true } },
            clue: { select: { id: true, clueNumber: true, title: true } },
            evidence: { select: { id: true, evidenceNumber: true, name: true } },
            _count: { select: { disposals: true } },
          },
          orderBy: { triggerTime: 'desc' },
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
      const alert = await prisma.alertMessage.findUnique({
        where: { id: request.params.id },
        include: {
          rule: { select: { id: true, ruleNumber: true, name: true, alertLevel: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          person: { select: { id: true, name: true, personType: true, phone: true, idCard: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
          evidence: { select: { id: true, evidenceNumber: true, name: true, type: true, status: true } },
          disposals: {
            orderBy: { disposalTime: 'desc' },
          },
        },
      });

      if (!alert) {
        reply.status(404).send({ error: '预警消息不存在' });
        return;
      }

      return alert;
    }
  );

  fastify.post(
    '/',
    async (request: FastifyRequest<{ Body: AlertCreate }>, reply) => {
      const {
        ruleId,
        title,
        content,
        targetType,
        targetId,
        targetName,
        alertLevel,
        triggerSource,
        triggerTime,
        caseId,
        clueId,
        evidenceId,
        personId,
        location,
        metadata,
        assigneeId,
        assigneeName,
        assigneeDept,
        operatorId,
        operatorName,
        operatorDept,
      } = request.body;

      const alertNumber = generateAlertNumber();

      const alert = await prisma.alertMessage.create({
        data: {
          alertNumber,
          ruleId,
          title,
          content,
          targetType,
          targetId,
          targetName,
          alertLevel: alertLevel || 'MEDIUM',
          status: 'PENDING',
          triggerSource,
          triggerTime: triggerTime ? new Date(triggerTime) : undefined,
          caseId,
          clueId,
          evidenceId,
          personId,
          location,
          metadata: metadata ? JSON.stringify(metadata) : null,
          assigneeId,
          assigneeName,
          assigneeDept,
        },
        include: {
          rule: { select: { id: true, ruleNumber: true, name: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          person: { select: { id: true, name: true, personType: true } },
        },
      });

      if (ruleId) {
        await prisma.surveillanceRule.update({
          where: { id: ruleId },
          data: {
            triggerCount: { increment: 1 },
            lastTriggerTime: new Date(),
          },
        });
      }

      await logCreate('ALERT_MESSAGE', alert.id, `生成预警: ${title}`, request, operatorName, alert);

      return alert;
    }
  );

  fastify.put(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: AlertUpdate }>, reply) => {
      const existing = await prisma.alertMessage.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警消息不存在' });
        return;
      }

      const {
        title,
        content,
        status,
        alertLevel,
        assigneeId,
        assigneeName,
        assigneeDept,
        resolveNote,
        operatorId,
        operatorName,
        operatorDept,
      } = request.body;

      const updateData: any = {
        title,
        content,
        status,
        alertLevel,
        assigneeId,
        assigneeName,
        assigneeDept,
        resolveNote,
      };

      if ((status === 'RESOLVED' || status === 'DISMISSED') && !existing.resolveTime) {
        updateData.resolveTime = new Date();
      }

      const alert = await prisma.alertMessage.update({
        where: { id: request.params.id },
        data: updateData,
        include: {
          rule: { select: { id: true, ruleNumber: true, name: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          person: { select: { id: true, name: true, personType: true } },
        },
      });

      await logUpdate('ALERT_MESSAGE', alert.id, `更新预警: ${title || existing.title}`, request, existing, alert, operatorName);

      return alert;
    }
  );

  fastify.post(
    '/:id/assign',
    async (request: FastifyRequest<{ Params: { id: string }; Body: AssignBody }>, reply) => {
      const existing = await prisma.alertMessage.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警消息不存在' });
        return;
      }

      const { assigneeId, assigneeName, assigneeDept, operatorId, operatorName } = request.body;

      const alert = await prisma.alertMessage.update({
        where: { id: request.params.id },
        data: {
          assigneeId,
          assigneeName,
          assigneeDept,
          status: 'PROCESSING',
        },
      });

      await prisma.alertDisposal.create({
        data: {
          alertId: request.params.id,
          disposalType: 'ASSIGN_TASK',
          title: `指派处置人员: ${assigneeName}`,
          description: `指派给 ${assigneeDept || ''} ${assigneeName} 进行处置`,
          operatorId,
          operatorName,
        },
      });

      await logUpdate('ALERT_MESSAGE', alert.id, `指派预警给: ${assigneeName}`, request, existing, alert, operatorName);

      return alert;
    }
  );

  fastify.post(
    '/:id/resolve',
    async (request: FastifyRequest<{ Params: { id: string }; Body: ResolveBody }>, reply) => {
      const existing = await prisma.alertMessage.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警消息不存在' });
        return;
      }

      const { status = 'RESOLVED', resolveNote, operatorId, operatorName, operatorDept } = request.body;

      const alert = await prisma.alertMessage.update({
        where: { id: request.params.id },
        data: {
          status,
          resolveNote,
          resolveTime: new Date(),
        },
      });

      await logUpdate('ALERT_MESSAGE', alert.id, `处置预警: ${status}`, request, existing, alert, operatorName);

      return alert;
    }
  );

  fastify.post(
    '/:id/escalate',
    async (request: FastifyRequest<{ Params: { id: string }; Body: EscalateBody }>, reply) => {
      const existing = await prisma.alertMessage.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警消息不存在' });
        return;
      }

      const { reason, operatorId, operatorName, operatorDept } = request.body;

      const alert = await prisma.alertMessage.update({
        where: { id: request.params.id },
        data: {
          status: 'ESCALATED',
          alertLevel: 'URGENT',
        },
      });

      await prisma.alertDisposal.create({
        data: {
          alertId: request.params.id,
          disposalType: 'ESCALATE',
          title: '预警升级',
          description: reason,
          operatorId,
          operatorName,
          operatorDept,
        },
      });

      await logUpdate('ALERT_MESSAGE', alert.id, `升级预警，原因: ${reason}`, request, existing, alert, operatorName);

      return alert;
    }
  );

  fastify.post(
    '/:id/disposals',
    async (request: FastifyRequest<{ Params: { id: string }; Body: DisposalCreate }>, reply) => {
      const existing = await prisma.alertMessage.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        reply.status(404).send({ error: '预警消息不存在' });
        return;
      }

      const {
        disposalType,
        title,
        description,
        result,
        operatorId,
        operatorName,
        operatorDept,
        nextAction,
        taskId,
        attachments,
      } = request.body;

      const disposal = await prisma.alertDisposal.create({
        data: {
          alertId: request.params.id,
          disposalType,
          title,
          description,
          result,
          operatorId,
          operatorName,
          operatorDept,
          nextAction,
          taskId,
          attachments: attachments ? JSON.stringify(attachments) : null,
        },
      });

      if (existing.status === 'PENDING') {
        await prisma.alertMessage.update({
          where: { id: request.params.id },
          data: { status: 'PROCESSING' },
        });
      }

      await logCreate('ALERT_DISPOSAL', disposal.id, `添加预警处置记录: ${title}`, request, operatorName, disposal);

      return disposal;
    }
  );

  fastify.get(
    '/:id/disposals',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const disposals = await prisma.alertDisposal.findMany({
        where: { alertId: request.params.id },
        orderBy: { disposalTime: 'desc' },
      });

      return disposals;
    }
  );
}
