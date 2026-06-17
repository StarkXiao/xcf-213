import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface ClueQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  clueType?: string;
  status?: string;
  credibility?: string;
  importance?: string;
  caseId?: string;
}

interface ClueCreate {
  caseId?: string;
  title: string;
  content: string;
  clueType: string;
  source: string;
  credibility: string;
  importance: string;
  status: string;
  location?: string;
  findTime?: string;
  informant?: string;
  handler?: string;
  note?: string;
}

interface ClueUpdate extends Partial<ClueCreate> {}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: ClueQuery }>, reply) => {
    const { page = 1, pageSize = 10, keyword, clueType, status, credibility, importance, caseId } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { clueNumber: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (clueType) where.clueType = clueType;
    if (status) where.status = status;
    if (credibility) where.credibility = credibility;
    if (importance) where.importance = importance;
    if (caseId) where.caseId = caseId;

    const [items, total] = await Promise.all([
      prisma.clue.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: { select: { evidences: true, cluePersons: true } },
        },
      }),
      prisma.clue.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const clue = await prisma.clue.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        evidences: true,
        cluePersons: { include: { person: true } },
      },
    });

    if (!clue) {
      reply.status(404).send({ error: '线索不存在' });
      return;
    }

    return clue;
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: ClueCreate }>, reply) => {
    const data = request.body;
    const count = await prisma.clue.count();
    const clueNumber = `XS${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const clue = await prisma.clue.create({
      data: {
        ...data,
        clueNumber,
        findTime: data.findTime ? new Date(data.findTime) : null,
      },
    });

    return clue;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueUpdate }>, reply) => {
    const data = request.body;
    try {
      const clue = await prisma.clue.update({
        where: { id: request.params.id },
        data: {
          ...data,
          findTime: data.findTime ? new Date(data.findTime) : undefined,
        },
      });
      return clue;
    } catch (error) {
      reply.status(404).send({ error: '线索不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await prisma.$transaction([
        prisma.evidence.updateMany({ where: { clueId: request.params.id }, data: { clueId: null } }),
        prisma.cluePerson.deleteMany({ where: { clueId: request.params.id } }),
        prisma.clue.delete({ where: { id: request.params.id } }),
      ]);
      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '线索不存在' });
    }
  });

  fastify.post('/:id/persons', async (request: FastifyRequest<{ Params: { id: string }; Body: { personId: string; relation: string; note?: string } }>, reply) => {
    try {
      const cluePerson = await prisma.cluePerson.create({
        data: {
          clueId: request.params.id,
          personId: request.body.personId,
          relation: request.body.relation,
          note: request.body.note,
        },
        include: { person: true },
      });
      return cluePerson;
    } catch (error) {
      reply.status(400).send({ error: '关联失败' });
    }
  });

  fastify.delete('/:id/persons/:personId', async (request: FastifyRequest<{ Params: { id: string; personId: string } }>, reply) => {
    try {
      await prisma.cluePerson.deleteMany({
        where: { clueId: request.params.id, personId: request.params.personId },
      });
      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '取消关联失败' });
    }
  });
}
