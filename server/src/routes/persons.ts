import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface PersonQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  personType?: string;
  gender?: string;
}

interface PersonCreate {
  name: string;
  gender?: string;
  age?: number;
  idCard?: string;
  phone?: string;
  address?: string;
  occupation?: string;
  description?: string;
  avatar?: string;
  personType: string;
}

interface PersonUpdate extends Partial<PersonCreate> {}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: PersonQuery }>, reply) => {
    const { page = 1, pageSize = 10, keyword, personType, gender } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { idCard: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (personType) where.personType = personType;
    if (gender) where.gender = gender;

    const [items, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { casePersons: true, cluePersons: true, relationsAsSubject: true, relationsAsObject: true },
          },
        },
      }),
      prisma.person.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/all', async () => {
    const persons = await prisma.person.findMany({
      select: { id: true, name: true, personType: true, idCard: true, phone: true },
      orderBy: { name: 'asc' },
    });
    return persons;
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const person = await prisma.person.findUnique({
      where: { id: request.params.id },
      include: {
        casePersons: { include: { case: true } },
        cluePersons: { include: { clue: true } },
        relationsAsSubject: { include: { objectPerson: true } },
        relationsAsObject: { include: { subjectPerson: true } },
      },
    });

    if (!person) {
      reply.status(404).send({ error: '人员不存在' });
      return;
    }

    return person;
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: PersonCreate }>, reply) => {
    try {
      const person = await prisma.person.create({
        data: request.body,
      });
      return person;
    } catch (error) {
      reply.status(400).send({ error: '创建失败' });
    }
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: PersonUpdate }>, reply) => {
    try {
      const person = await prisma.person.update({
        where: { id: request.params.id },
        data: request.body,
      });
      return person;
    } catch (error) {
      reply.status(404).send({ error: '人员不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await prisma.$transaction([
        prisma.casePerson.deleteMany({ where: { personId: request.params.id } }),
        prisma.cluePerson.deleteMany({ where: { personId: request.params.id } }),
        prisma.personRelation.deleteMany({
          where: { OR: [{ subjectId: request.params.id }, { objectId: request.params.id }] },
        }),
        prisma.person.delete({ where: { id: request.params.id } }),
      ]);
      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '人员不存在' });
    }
  });

  fastify.get('/:id/cases', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const casePersons = await prisma.casePerson.findMany({
      where: { personId: request.params.id },
      include: { case: true },
      orderBy: { createdAt: 'desc' },
    });
    return casePersons;
  });

  fastify.get('/:id/clues', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const cluePersons = await prisma.cluePerson.findMany({
      where: { personId: request.params.id },
      include: { clue: true },
      orderBy: { createdAt: 'desc' },
    });
    return cluePersons;
  });

  fastify.get('/:id/relations', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const relations = await prisma.personRelation.findMany({
      where: { OR: [{ subjectId: request.params.id }, { objectId: request.params.id }] },
      include: {
        subjectPerson: true,
        objectPerson: true,
        case: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const person = await prisma.person.findUnique({ where: { id: request.params.id } });
    if (!person) {
      reply.status(404).send({ error: '人员不存在' });
      return;
    }

    const relatedPersonIds = new Set<string>();
    relations.forEach(r => {
      relatedPersonIds.add(r.subjectId);
      relatedPersonIds.add(r.objectId);
    });

    const relatedPersons = await prisma.person.findMany({
      where: { id: { in: Array.from(relatedPersonIds) } },
    });

    const nodes = relatedPersons.map(p => ({
      id: p.id,
      name: p.name,
      type: p.personType,
      gender: p.gender,
      age: p.age,
      avatar: p.avatar,
      isCenter: p.id === request.params.id,
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

  fastify.get('/relations/all', async () => {
    const [persons, relations] = await Promise.all([
      prisma.person.findMany(),
      prisma.personRelation.findMany(),
    ]);

    const nodes = persons.map(p => ({
      id: p.id,
      name: p.name,
      type: p.personType,
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

  fastify.post('/:id/relations', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { targetPersonId: string; relation: string; description?: string };
  }>) => {
    const { id } = request.params;
    const { targetPersonId, relation, description } = request.body;

    try {
      const personRelation = await prisma.personRelation.create({
        data: {
          subjectId: id,
          objectId: targetPersonId,
          relationType: relation,
          description,
        },
      });
      return personRelation;
    } catch (error) {
      return { error: '创建关系失败' };
    }
  });

  fastify.get('/:id/relation-timeline', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    const person = await prisma.person.findUnique({ where: { id } });
    if (!person) {
      reply.status(404).send({ error: '人员不存在' });
      return;
    }

    const [relations, casePersons, cluePersons] = await Promise.all([
      prisma.personRelation.findMany({
        where: { OR: [{ subjectId: id }, { objectId: id }] },
        include: {
          subjectPerson: { select: { id: true, name: true, personType: true } },
          objectPerson: { select: { id: true, name: true, personType: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.casePerson.findMany({
        where: { personId: id },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.cluePerson.findMany({
        where: { personId: id },
        include: { clue: { select: { id: true, clueNumber: true, title: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const timelineEvents: any[] = [];

    casePersons.forEach((cp) => {
      timelineEvents.push({
        id: `case-${cp.id}`,
        type: 'case_association',
        timestamp: cp.createdAt,
        date: cp.createdAt,
        title: '关联案件',
        description: `与案件「${cp.case.title}」建立关联`,
        case: cp.case,
        role: cp.role,
        note: cp.note,
        eventType: '案件关联',
      });
    });

    cluePersons.forEach((cp) => {
      timelineEvents.push({
        id: `clue-${cp.id}`,
        type: 'clue_association',
        timestamp: cp.createdAt,
        date: cp.createdAt,
        title: '关联线索',
        description: `与线索「${cp.clue.title}」建立关联，关系：${cp.relation}`,
        clue: cp.clue,
        relation: cp.relation,
        note: cp.note,
        eventType: '线索关联',
      });
    });

    relations.forEach((r) => {
      const isSubject = r.subjectId === id;
      const otherPerson = isSubject ? r.objectPerson : r.subjectPerson;
      const relationType = isSubject ? r.relationType : getReverseRelation(r.relationType);

      timelineEvents.push({
        id: `relation-${r.id}`,
        type: 'relation_added',
        timestamp: r.createdAt,
        date: r.createdAt,
        title: '新增关系',
        description: `与「${otherPerson.name}」建立「${relationType}」关系`,
        relatedPerson: otherPerson,
        relationType: r.relationType,
        descriptionDetail: r.description,
        case: r.case,
        isSubject,
        eventType: '关系新增',
      });
    });

    const caseRolesMap = new Map<string, any[]>();
    casePersons.forEach((cp) => {
      if (!caseRolesMap.has(cp.caseId)) {
        caseRolesMap.set(cp.caseId, []);
      }
      caseRolesMap.get(cp.caseId)!.push({
        role: cp.role,
        date: cp.createdAt,
        case: cp.case,
      });
    });

    caseRolesMap.forEach((roleHistory) => {
      if (roleHistory.length > 1) {
        for (let i = 1; i < roleHistory.length; i++) {
          const prev = roleHistory[i - 1];
          const curr = roleHistory[i];
          if (prev.role !== curr.role) {
            timelineEvents.push({
              id: `role-change-${curr.case.id}-${i}`,
              type: 'role_change',
              timestamp: curr.date,
              date: curr.date,
              title: '角色变化',
              description: `在案件「${curr.case.title}」中，角色由「${prev.role}」变更为「${curr.role}」`,
              case: curr.case,
              oldRole: prev.role,
              newRole: curr.role,
              eventType: '角色变更',
            });
          }
        }
      }
    });

    timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      events: timelineEvents,
      total: timelineEvents.length,
      stats: {
        caseAssociations: casePersons.length,
        clueAssociations: cluePersons.length,
        relations: relations.length,
        roleChanges: timelineEvents.filter((e) => e.type === 'role_change').length,
      },
    };
  });
}

function getReverseRelation(relation: string): string {
  const reverseMap: Record<string, string> = {
    '父亲': '子女',
    '母亲': '子女',
    '丈夫': '妻子',
    '妻子': '丈夫',
    '哥哥': '弟弟/妹妹',
    '姐姐': '弟弟/妹妹',
    '弟弟': '哥哥/姐姐',
    '妹妹': '哥哥/姐姐',
    '朋友': '朋友',
    '同事': '同事',
    '同学': '同学',
    '上司': '下属',
    '下属': '上司',
    '同伙': '同伙',
  };
  return reverseMap[relation] || `被${relation}`;
}
