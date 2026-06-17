import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface RelationCreate {
  subjectId: string;
  objectId: string;
  relationType: string;
  description?: string;
  caseId?: string;
}

interface RelationUpdate extends Partial<RelationCreate> {}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: { caseId?: string; personId?: string } }>, reply) => {
    const { caseId, personId } = request.query;
    const where: any = {};

    if (caseId) where.caseId = caseId;
    if (personId) {
      where.OR = [{ subjectId: personId }, { objectId: personId }];
    }

    const relations = await prisma.personRelation.findMany({
      where,
      include: {
        subjectPerson: true,
        objectPerson: true,
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return relations;
  });

  fastify.get('/graph', async (request: FastifyRequest<{ Querystring: { caseId?: string; depth?: number } }>, reply) => {
    const { caseId, depth = 2 } = request.query;
    const where: any = {};

    if (caseId) where.caseId = caseId;

    const relations = await prisma.personRelation.findMany({
      where,
      include: {
        subjectPerson: true,
        objectPerson: true,
      },
    });

    const personIds = new Set<string>();
    relations.forEach(r => {
      personIds.add(r.subjectId);
      personIds.add(r.objectId);
    });

    const persons = await prisma.person.findMany({
      where: { id: { in: Array.from(personIds) } },
    });

    const casePersons = caseId ? await prisma.casePerson.findMany({
      where: { caseId },
      include: { person: true },
    }) : [];

    const personRoles = new Map<string, string>();
    casePersons.forEach(cp => personRoles.set(cp.personId, cp.role));

    const nodes = persons.map(p => ({
      id: p.id,
      name: p.name,
      type: p.personType,
      role: personRoles.get(p.id) || '相关人员',
      gender: p.gender,
      age: p.age,
      avatar: p.avatar,
      isCenter: false,
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

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const relation = await prisma.personRelation.findUnique({
      where: { id: request.params.id },
      include: {
        subjectPerson: true,
        objectPerson: true,
        case: true,
      },
    });

    if (!relation) {
      reply.status(404).send({ error: '关系不存在' });
      return;
    }

    return relation;
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: RelationCreate }>, reply) => {
    try {
      const relation = await prisma.personRelation.create({
        data: request.body,
        include: {
          subjectPerson: true,
          objectPerson: true,
        },
      });
      return relation;
    } catch (error) {
      reply.status(400).send({ error: '创建失败' });
    }
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: RelationUpdate }>, reply) => {
    try {
      const relation = await prisma.personRelation.update({
        where: { id: request.params.id },
        data: request.body,
      });
      return relation;
    } catch (error) {
      reply.status(404).send({ error: '关系不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await prisma.personRelation.delete({
        where: { id: request.params.id },
      });
      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '关系不存在' });
    }
  });
}
