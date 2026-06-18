"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
async function default_1(fastify) {
    fastify.get('/', async (request, reply) => {
        const { caseId, personId } = request.query;
        const where = {};
        if (caseId)
            where.caseId = caseId;
        if (personId) {
            where.OR = [{ subjectId: personId }, { objectId: personId }];
        }
        const relations = await prisma_1.default.personRelation.findMany({
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
    fastify.get('/graph', async (request) => {
        const { caseId, relationTypes, personRoles, personTypes } = request.query;
        const relationWhere = {};
        if (caseId)
            relationWhere.caseId = caseId;
        if (relationTypes) {
            const types = relationTypes.split(',');
            relationWhere.relationType = { in: types };
        }
        const relations = await prisma_1.default.personRelation.findMany({
            where: relationWhere,
            include: {
                subjectPerson: true,
                objectPerson: true,
            },
        });
        let personIds = new Set();
        relations.forEach((r) => {
            personIds.add(r.subjectId);
            personIds.add(r.objectId);
        });
        const personWhere = { id: { in: Array.from(personIds) } };
        if (personTypes) {
            const types = personTypes.split(',');
            personWhere.personType = { in: types };
        }
        let persons = await prisma_1.default.person.findMany({ where: personWhere });
        const personTypeFilteredIds = new Set(persons.map((p) => p.id));
        let filteredRelations = relations.filter((r) => personTypeFilteredIds.has(r.subjectId) && personTypeFilteredIds.has(r.objectId));
        personIds = new Set();
        filteredRelations.forEach((r) => {
            personIds.add(r.subjectId);
            personIds.add(r.objectId);
        });
        persons = persons.filter((p) => personIds.has(p.id));
        let casePersons = [];
        if (caseId) {
            casePersons = await prisma_1.default.casePerson.findMany({
                where: { caseId },
                include: { case: { select: { id: true, caseNumber: true, title: true } } },
            });
        }
        else {
            casePersons = await prisma_1.default.casePerson.findMany({
                where: { personId: { in: Array.from(personIds) } },
                include: { case: { select: { id: true, caseNumber: true, title: true } } },
            });
        }
        const personRolesMap = new Map();
        const personCasesMap = new Map();
        casePersons.forEach((cp) => {
            personRolesMap.set(cp.personId, cp.role);
            if (!personCasesMap.has(cp.personId)) {
                personCasesMap.set(cp.personId, []);
            }
            personCasesMap.get(cp.personId).push({
                caseId: cp.caseId,
                caseNumber: cp.case?.caseNumber,
                caseTitle: cp.case?.title,
                role: cp.role,
            });
        });
        if (personRoles) {
            const roles = personRoles.split(',');
            persons = persons.filter((p) => {
                const role = personRolesMap.get(p.id);
                return role && roles.includes(role);
            });
            const roleFilteredIds = new Set(persons.map((p) => p.id));
            filteredRelations = filteredRelations.filter((r) => roleFilteredIds.has(r.subjectId) && roleFilteredIds.has(r.objectId));
            personIds = new Set();
            filteredRelations.forEach((r) => {
                personIds.add(r.subjectId);
                personIds.add(r.objectId);
            });
            persons = persons.filter((p) => personIds.has(p.id));
        }
        const nodes = persons.map((p) => ({
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
        const edges = filteredRelations.map((r) => ({
            id: r.id,
            source: r.subjectId,
            target: r.objectId,
            relation: r.relationType,
            description: r.description,
            caseId: r.caseId,
        }));
        return { nodes, edges };
    });
    fastify.get('/:id', async (request, reply) => {
        const relation = await prisma_1.default.personRelation.findUnique({
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
    fastify.post('/', async (request, reply) => {
        try {
            const relation = await prisma_1.default.personRelation.create({
                data: request.body,
                include: {
                    subjectPerson: true,
                    objectPerson: true,
                },
            });
            return relation;
        }
        catch (error) {
            reply.status(400).send({ error: '创建失败' });
        }
    });
    fastify.put('/:id', async (request, reply) => {
        try {
            const relation = await prisma_1.default.personRelation.update({
                where: { id: request.params.id },
                data: request.body,
            });
            return relation;
        }
        catch (error) {
            reply.status(404).send({ error: '关系不存在' });
        }
    });
    fastify.delete('/:id', async (request, reply) => {
        try {
            await prisma_1.default.personRelation.delete({
                where: { id: request.params.id },
            });
            return { success: true };
        }
        catch (error) {
            reply.status(404).send({ error: '关系不存在' });
        }
    });
}
