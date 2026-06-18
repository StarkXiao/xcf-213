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

  fastify.get('/graph', async (request: FastifyRequest<{
    Querystring: {
      caseId?: string;
      depth?: number;
      relationTypes?: string;
      personRoles?: string;
      personTypes?: string;
    }
  }>) => {
    const { caseId, relationTypes, personRoles, personTypes } = request.query;

    const relationWhere: any = {};
    if (caseId) relationWhere.caseId = caseId;
    if (relationTypes) {
      const types = relationTypes.split(',');
      relationWhere.relationType = { in: types };
    }

    const relations = await prisma.personRelation.findMany({
      where: relationWhere,
      include: {
        subjectPerson: true,
        objectPerson: true,
      },
    });

    let personIds = new Set<string>();
    relations.forEach((r: any) => {
      personIds.add(r.subjectId);
      personIds.add(r.objectId);
    });

    const personWhere: any = { id: { in: Array.from(personIds) } };
    if (personTypes) {
      const types = personTypes.split(',');
      personWhere.personType = { in: types };
    }

    let persons = await prisma.person.findMany({ where: personWhere });
    const personTypeFilteredIds = new Set(persons.map((p: any) => p.id));
    let filteredRelations = relations.filter(
      (r: any) => personTypeFilteredIds.has(r.subjectId) && personTypeFilteredIds.has(r.objectId)
    );

    personIds = new Set<string>();
    filteredRelations.forEach((r: any) => {
      personIds.add(r.subjectId);
      personIds.add(r.objectId);
    });
    persons = persons.filter((p: any) => personIds.has(p.id));

    let casePersons: any[] = [];
    if (caseId) {
      casePersons = await prisma.casePerson.findMany({
        where: { caseId },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
      });
    } else {
      casePersons = await prisma.casePerson.findMany({
        where: { personId: { in: Array.from(personIds) } },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
      });
    }

    const personRolesMap = new Map<string, string>();
    const personCasesMap = new Map<string, any[]>();
    casePersons.forEach((cp: any) => {
      personRolesMap.set(cp.personId, cp.role);
      if (!personCasesMap.has(cp.personId)) {
        personCasesMap.set(cp.personId, []);
      }
      personCasesMap.get(cp.personId)!.push({
        caseId: cp.caseId,
        caseNumber: cp.case?.caseNumber,
        caseTitle: cp.case?.title,
        role: cp.role,
      });
    });

    if (personRoles) {
      const roles = personRoles.split(',');
      persons = persons.filter((p: any) => {
        const role = personRolesMap.get(p.id);
        return role && roles.includes(role);
      });
      const roleFilteredIds = new Set(persons.map((p: any) => p.id));
      filteredRelations = filteredRelations.filter(
        (r: any) => roleFilteredIds.has(r.subjectId) && roleFilteredIds.has(r.objectId)
      );
      personIds = new Set<string>();
      filteredRelations.forEach((r: any) => {
        personIds.add(r.subjectId);
        personIds.add(r.objectId);
      });
      persons = persons.filter((p: any) => personIds.has(p.id));
    }

    const nodes = persons.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.personType,
      role: personRolesMap.get(p.id) || '相关人员',
      cases: personCasesMap.get(p.id) || [],
      gender: p.gender,
      age: p.age,
      avatar: p.avatar,
      isCenter: false,
    }));

    const edges = filteredRelations.map((r: any) => ({
      id: r.id,
      source: r.subjectId,
      target: r.objectId,
      relation: r.relationType,
      description: r.description,
      caseId: r.caseId,
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
