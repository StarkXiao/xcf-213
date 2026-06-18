import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma';

interface CaseQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  caseType?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
}

interface CaseCreate {
  title: string;
  description: string;
  caseType: string;
  status: string;
  priority: string;
  location?: string;
  occurTime?: string;
  reportTime?: string;
  caseManager?: string;
  department?: string;
  summary?: string;
}

interface CaseUpdate extends Partial<CaseCreate> {}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: CaseQuery }>, reply) => {
    const { page = 1, pageSize = 10, keyword, caseType, status, priority, startDate, endDate } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { caseNumber: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (caseType) where.caseType = caseType;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.case.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { clues: true, evidences: true, casePersons: true },
          },
          clues: {
            include: {
              _count: { select: { evidences: true } },
            },
          },
          evidences: true,
          evidenceBorrows: true,
        },
      }),
      prisma.case.count({ where }),
    ]);

    const CLUE_UPDATE_DAYS = 7;
    const CLUE_PENDING_DAYS = 3;
    const CASE_PENDING_DAYS = 5;
    const BORROW_OVERDUE_DAYS = 7;

    const now = new Date();
    const clueUpdateThreshold = new Date(now.getTime() - CLUE_UPDATE_DAYS * 24 * 60 * 60 * 1000);
    const cluePendingThreshold = new Date(now.getTime() - CLUE_PENDING_DAYS * 24 * 60 * 60 * 1000);
    const casePendingThreshold = new Date(now.getTime() - CASE_PENDING_DAYS * 24 * 60 * 60 * 1000);
    const borrowOverdueThreshold = new Date(now.getTime() - BORROW_OVERDUE_DAYS * 24 * 60 * 60 * 1000);

    const enrichedItems = items.map((item: any) => {
      const warnings: any[] = [];

      const overdueUnupdatedClues = item.clues.filter((c: any) =>
        ['待核实', '核实中'].includes(c.status) && new Date(c.updatedAt) < clueUpdateThreshold
      );
      if (overdueUnupdatedClues.length > 0) {
        warnings.push({
          type: 'overdueClue',
          label: '超期未更新线索',
          level: 'danger',
          count: overdueUnupdatedClues.length,
          detail: overdueUnupdatedClues.map((c: any) => ({
            id: c.id,
            title: c.title,
            clueNumber: c.clueNumber,
            status: c.status,
            lastUpdate: c.updatedAt,
            daysOverdue: Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
          })),
        });
      }

      const cluesWithoutEvidence = item.clues.filter((c: any) =>
        ['已核实', '已采用'].includes(c.status) && c._count.evidences === 0
      );
      if (cluesWithoutEvidence.length > 0) {
        warnings.push({
          type: 'missingEvidence',
          label: '未回填证据',
          level: 'warning',
          count: cluesWithoutEvidence.length,
          detail: cluesWithoutEvidence.map((c: any) => ({
            id: c.id,
            title: c.title,
            clueNumber: c.clueNumber,
            status: c.status,
            credibility: c.credibility,
            importance: c.importance,
          })),
        });
      }

      const pendingTasks: any[] = [];

      if (item.status === '待立案' && new Date(item.createdAt) < casePendingThreshold) {
        const days = Math.floor((now.getTime() - new Date(item.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        pendingTasks.push({
          subType: 'casePendingFiling',
          label: '待立案超期',
          days,
          description: `案件已创建 ${days} 天仍未立案`,
        });
      }

      const pendingClues = item.clues.filter((c: any) =>
        c.status === '待核实' && new Date(c.createdAt) < cluePendingThreshold
      );
      pendingClues.forEach((c: any) => {
        const days = Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        pendingTasks.push({
          subType: 'cluePendingVerify',
          label: '线索待核实超期',
          clueId: c.id,
          clueTitle: c.title,
          clueNumber: c.clueNumber,
          days,
          description: `线索「${c.title}」待核实已超 ${days} 天`,
        });
      });

      const overdueBorrows = item.evidenceBorrows.filter((b: any) =>
        b.status === '借阅中' && b.expectedReturnTime && new Date(b.expectedReturnTime) < now
      );
      overdueBorrows.forEach((b: any) => {
        const days = Math.floor((now.getTime() - new Date(b.expectedReturnTime!).getTime()) / (24 * 60 * 60 * 1000));
        pendingTasks.push({
          subType: 'evidenceOverdueReturn',
          label: '证据借阅超期',
          borrowId: b.id,
          evidenceId: b.evidenceId,
          borrower: b.borrower,
          days,
          description: `借阅人「${b.borrower}」证据超期 ${days} 天未归还`,
        });
      });

      const unreturnedBorrows = item.evidenceBorrows.filter((b: any) =>
        b.status === '借阅中' && (!b.expectedReturnTime || new Date(b.expectedReturnTime) >= now) &&
        new Date(b.borrowTime) < borrowOverdueThreshold
      );
      unreturnedBorrows.forEach((b: any) => {
        const days = Math.floor((now.getTime() - new Date(b.borrowTime).getTime()) / (24 * 60 * 60 * 1000));
        pendingTasks.push({
          subType: 'evidenceLongBorrow',
          label: '证据长期借阅',
          borrowId: b.id,
          evidenceId: b.evidenceId,
          borrower: b.borrower,
          days,
          description: `借阅人「${b.borrower}」证据已借阅 ${days} 天`,
        });
      });

      if (pendingTasks.length > 0) {
        warnings.push({
          type: 'pendingTask',
          label: '待办任务',
          level: pendingTasks.some((t: any) => t.days >= 5) ? 'danger' : 'warning',
          count: pendingTasks.length,
          detail: pendingTasks,
        });
      }

      const { clues, evidences, evidenceBorrows, ...rest } = item;
      return {
        ...rest,
        warnings,
        warningCount: warnings.reduce((sum: number, w: any) => sum + w.count, 0),
        hasWarning: warnings.length > 0,
      };
    });

    return { items: enrichedItems, total, page, pageSize };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const caseItem = await prisma.case.findUnique({
      where: { id: request.params.id },
      include: {
        clues: { include: { cluePersons: { include: { person: true } } } },
        evidences: true,
        casePersons: { include: { person: true } },
      },
    });

    if (!caseItem) {
      reply.status(404).send({ error: '案件不存在' });
      return;
    }

    return caseItem;
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: CaseCreate }>, reply) => {
    const data = request.body;
    const count = await prisma.case.count();
    const caseNumber = `AJ${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const caseItem = await prisma.case.create({
      data: {
        ...data,
        caseNumber,
        occurTime: data.occurTime ? new Date(data.occurTime) : null,
        reportTime: data.reportTime ? new Date(data.reportTime) : null,
      },
    });

    return caseItem;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: CaseUpdate }>, reply) => {
    const data = request.body;
    try {
      const caseItem = await prisma.case.update({
        where: { id: request.params.id },
        data: {
          ...data,
          occurTime: data.occurTime ? new Date(data.occurTime) : undefined,
          reportTime: data.reportTime ? new Date(data.reportTime) : undefined,
        },
      });
      return caseItem;
    } catch (error) {
      reply.status(404).send({ error: '案件不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await prisma.$transaction([
        prisma.evidence.deleteMany({ where: { caseId: request.params.id } }),
        prisma.clue.updateMany({ where: { caseId: request.params.id }, data: { caseId: null } }),
        prisma.casePerson.deleteMany({ where: { caseId: request.params.id } }),
        prisma.personRelation.deleteMany({ where: { caseId: request.params.id } }),
        prisma.case.delete({ where: { id: request.params.id } }),
      ]);
      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '案件不存在' });
    }
  });

  fastify.post('/:id/persons', async (request: FastifyRequest<{ Params: { id: string }; Body: { personId: string; role: string; note?: string } }>, reply) => {
    try {
      const casePerson = await prisma.casePerson.create({
        data: {
          caseId: request.params.id,
          personId: request.body.personId,
          role: request.body.role,
          note: request.body.note,
        },
        include: { person: true },
      });
      return casePerson;
    } catch (error) {
      reply.status(400).send({ error: '关联失败' });
    }
  });

  fastify.delete('/:id/persons/:personId', async (request: FastifyRequest<{ Params: { id: string; personId: string } }>, reply) => {
    try {
      await prisma.casePerson.deleteMany({
        where: { caseId: request.params.id, personId: request.params.personId },
      });
      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '取消关联失败' });
    }
  });

  fastify.get('/:id/clues', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const clues = await prisma.clue.findMany({
      where: { caseId: request.params.id },
      include: {
        _count: { select: { evidences: true, cluePersons: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return clues;
  });

  fastify.get('/:id/evidences', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const evidences = await prisma.evidence.findMany({
      where: { caseId: request.params.id },
      orderBy: { createdAt: 'desc' },
    });
    return evidences;
  });

  fastify.get('/:id/persons', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const casePersons = await prisma.casePerson.findMany({
      where: { caseId: request.params.id },
      include: { person: true },
      orderBy: { createdAt: 'desc' },
    });
    return casePersons;
  });

  fastify.get('/:id/relations', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const casePersons = await prisma.casePerson.findMany({
      where: { caseId: request.params.id },
      include: { person: true },
    });

    const personIds = casePersons.map(cp => cp.personId);

    const relations = await prisma.personRelation.findMany({
      where: {
        OR: [
          { caseId: request.params.id },
          { subjectId: { in: personIds } },
          { objectId: { in: personIds } },
        ],
      },
      include: {
        subjectPerson: true,
        objectPerson: true,
      },
    });

    const nodes = casePersons.map(cp => ({
      id: cp.person.id,
      name: cp.person.name,
      type: cp.person.personType,
      role: cp.role,
      gender: cp.person.gender,
      age: cp.person.age,
      avatar: cp.person.avatar,
    }));

    const edges = relations.map(r => ({
      id: r.id,
      source: r.subjectId,
      target: r.objectId,
      relation: r.relationType,
      description: r.description,
    }));

    return { nodes, edges };
  });
}
