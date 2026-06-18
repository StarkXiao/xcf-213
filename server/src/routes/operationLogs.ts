import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface OperationLogQuery {
  page?: number;
  pageSize?: number;
  targetType?: string;
  targetId?: string;
  action?: string;
  operator?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

interface OperationLogCreate {
  targetType: string;
  targetId: string;
  action: string;
  description?: string;
  operator?: string;
  operatorDepartment?: string;
  beforeData?: string;
  afterData?: string;
  ip?: string;
  userAgent?: string;
}

export async function createOperationLog(data: OperationLogCreate) {
  return prisma.operationLog.create({
    data,
  });
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: OperationLogQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 10,
      targetType,
      targetId,
      action,
      operator,
      startDate,
      endDate,
      keyword,
    } = request.query;

    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (action) where.action = action;
    if (operator) {
      where.operator = {
        contains: operator,
        mode: 'insensitive',
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (keyword) {
      where.OR = [
        { description: { contains: keyword, mode: 'insensitive' } },
        { targetType: { contains: keyword, mode: 'insensitive' } },
        { action: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.operationLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.operationLog.count({ where }),
    ]);

    const enrichedItems = await Promise.all(
      items.map(async (item: any) => {
        const enriched: any = { ...item };
        let targetInfo: any = null;

        switch (item.targetType) {
          case 'CASE':
            targetInfo = await prisma.case.findUnique({
              where: { id: item.targetId },
              select: { id: true, caseNumber: true, title: true },
            });
            break;
          case 'CLUE':
            targetInfo = await prisma.clue.findUnique({
              where: { id: item.targetId },
              select: { id: true, clueNumber: true, title: true },
            });
            break;
          case 'EVIDENCE':
            targetInfo = await prisma.evidence.findUnique({
              where: { id: item.targetId },
              select: { id: true, evidenceNumber: true, name: true },
            });
            break;
          case 'PERSON':
            targetInfo = await prisma.person.findUnique({
              where: { id: item.targetId },
              select: { id: true, name: true, idCard: true },
            });
            break;
        }

        enriched.targetInfo = targetInfo;
        return enriched;
      })
    );

    return {
      items: enrichedItems,
      total,
      page,
      pageSize,
    };
  });

  fastify.get('/stats', async (request, reply) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCount,
      caseCount,
      clueCount,
      evidenceCount,
      personCount,
      recentLogs,
      topOperators,
    ] = await Promise.all([
      prisma.operationLog.count(),
      prisma.operationLog.count({ where: { targetType: 'CASE' } }),
      prisma.operationLog.count({ where: { targetType: 'CLUE' } }),
      prisma.operationLog.count({ where: { targetType: 'EVIDENCE' } }),
      prisma.operationLog.count({ where: { targetType: 'PERSON' } }),
      prisma.operationLog.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.$queryRaw`
        SELECT operator, COUNT(*) as count
        FROM "OperationLog"
        WHERE operator IS NOT NULL
        GROUP BY operator
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const typeStats: Record<string, number> = {};
    if (caseCount) typeStats['CASE'] = caseCount;
    if (clueCount) typeStats['CLUE'] = clueCount;
    if (evidenceCount) typeStats['EVIDENCE'] = evidenceCount;
    if (personCount) typeStats['PERSON'] = personCount;

    return {
      totalCount,
      typeStats,
      recentLogs,
      topOperators,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    const log = await prisma.operationLog.findUnique({
      where: { id },
    });

    if (!log) {
      reply.status(404);
      return { error: '操作日志不存在' };
    }

    const enriched: any = { ...log };
    let targetInfo: any = null;

    switch (log.targetType) {
      case 'CASE':
        targetInfo = await prisma.case.findUnique({
          where: { id: log.targetId },
          select: { id: true, caseNumber: true, title: true },
        });
        break;
      case 'CLUE':
        targetInfo = await prisma.clue.findUnique({
          where: { id: log.targetId },
          select: { id: true, clueNumber: true, title: true },
        });
        break;
      case 'EVIDENCE':
        targetInfo = await prisma.evidence.findUnique({
          where: { id: log.targetId },
          select: { id: true, evidenceNumber: true, name: true },
        });
        break;
      case 'PERSON':
        targetInfo = await prisma.person.findUnique({
          where: { id: log.targetId },
          select: { id: true, name: true, idCard: true },
        });
        break;
    }

    enriched.targetInfo = targetInfo;
    return enriched;
  });

  fastify.get('/target/:targetType/:targetId', async (
    request: FastifyRequest<{
      Params: { targetType: string; targetId: string };
      Querystring: { page?: number; pageSize?: number };
    }>,
    reply
  ) => {
    const { targetType, targetId } = request.params;
    const { page = 1, pageSize = 20 } = request.query;
    const skip = (page - 1) * pageSize;

    const where = { targetType, targetId };

    const [items, total] = await Promise.all([
      prisma.operationLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.operationLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/options', async (request, reply) => {
    const targetTypes = ['CASE', 'CLUE', 'EVIDENCE', 'PERSON', 'EVIDENCE_BATCH', 'EVIDENCE_BORROW', 'CLUE_VERIFICATION'];
    const actions = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'BORROW', 'RETURN', 'VERIFY', 'ASSOCIATE', 'DISASSOCIATE', 'BATCH_ASSIGN', 'BATCH_RETURN', 'BATCH_MERGE', 'BATCH_UPLOAD', 'TO_EVIDENCE'];

    const [distinctOperators, distinctActions] = await Promise.all([
      prisma.operationLog.findMany({
        distinct: ['operator'],
        select: { operator: true },
        where: { operator: { not: null } },
      }),
      prisma.operationLog.findMany({
        distinct: ['action'],
        select: { action: true },
      }),
    ]);

    return {
      targetTypes,
      actions: [...new Set([...actions, ...distinctActions.map((a: any) => a.action)])],
      operators: distinctOperators.map((o: any) => o.operator).filter(Boolean),
    };
  });
}
