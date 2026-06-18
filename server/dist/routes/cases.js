"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
const operationLog_1 = require("../lib/operationLog");
async function default_1(fastify) {
    fastify.get('/', async (request, reply) => {
        const { page = 1, pageSize = 10, keyword, caseType, status, priority, startDate, endDate } = request.query;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { caseNumber: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (caseType)
            where.caseType = caseType;
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [items, total] = await Promise.all([
            prisma_1.default.case.findMany({
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
            prisma_1.default.case.count({ where }),
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
        const enrichedItems = items.map((item) => {
            const warnings = [];
            const overdueUnupdatedClues = item.clues.filter((c) => ['待核实', '核实中'].includes(c.status) && new Date(c.updatedAt) < clueUpdateThreshold);
            if (overdueUnupdatedClues.length > 0) {
                warnings.push({
                    type: 'overdueClue',
                    label: '超期未更新线索',
                    level: 'danger',
                    count: overdueUnupdatedClues.length,
                    detail: overdueUnupdatedClues.map((c) => ({
                        id: c.id,
                        title: c.title,
                        clueNumber: c.clueNumber,
                        status: c.status,
                        lastUpdate: c.updatedAt,
                        daysOverdue: Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
                    })),
                });
            }
            const cluesWithoutEvidence = item.clues.filter((c) => ['已核实', '已采用'].includes(c.status) && c._count.evidences === 0);
            if (cluesWithoutEvidence.length > 0) {
                warnings.push({
                    type: 'missingEvidence',
                    label: '未回填证据',
                    level: 'warning',
                    count: cluesWithoutEvidence.length,
                    detail: cluesWithoutEvidence.map((c) => ({
                        id: c.id,
                        title: c.title,
                        clueNumber: c.clueNumber,
                        status: c.status,
                        credibility: c.credibility,
                        importance: c.importance,
                    })),
                });
            }
            const pendingTasks = [];
            if (item.status === '待立案' && new Date(item.createdAt) < casePendingThreshold) {
                const days = Math.floor((now.getTime() - new Date(item.createdAt).getTime()) / (24 * 60 * 60 * 1000));
                pendingTasks.push({
                    subType: 'casePendingFiling',
                    label: '待立案超期',
                    days,
                    description: `案件已创建 ${days} 天仍未立案`,
                });
            }
            const pendingClues = item.clues.filter((c) => c.status === '待核实' && new Date(c.createdAt) < cluePendingThreshold);
            pendingClues.forEach((c) => {
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
            const overdueBorrows = item.evidenceBorrows.filter((b) => b.status === '借阅中' && b.expectedReturnTime && new Date(b.expectedReturnTime) < now);
            overdueBorrows.forEach((b) => {
                const days = Math.floor((now.getTime() - new Date(b.expectedReturnTime).getTime()) / (24 * 60 * 60 * 1000));
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
            const unreturnedBorrows = item.evidenceBorrows.filter((b) => b.status === '借阅中' && (!b.expectedReturnTime || new Date(b.expectedReturnTime) >= now) &&
                new Date(b.borrowTime) < borrowOverdueThreshold);
            unreturnedBorrows.forEach((b) => {
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
                    level: pendingTasks.some((t) => t.days >= 5) ? 'danger' : 'warning',
                    count: pendingTasks.length,
                    detail: pendingTasks,
                });
            }
            const { clues, evidences, evidenceBorrows, ...rest } = item;
            return {
                ...rest,
                warnings,
                warningCount: warnings.reduce((sum, w) => sum + w.count, 0),
                hasWarning: warnings.length > 0,
            };
        });
        return { items: enrichedItems, total, page, pageSize };
    });
    fastify.get('/:id', async (request, reply) => {
        const caseItem = await prisma_1.default.case.findUnique({
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
    fastify.post('/', async (request, reply) => {
        const data = request.body;
        const count = await prisma_1.default.case.count();
        const caseNumber = `AJ${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
        const caseItem = await prisma_1.default.case.create({
            data: {
                ...data,
                caseNumber,
                occurTime: data.occurTime ? new Date(data.occurTime) : null,
                reportTime: data.reportTime ? new Date(data.reportTime) : null,
            },
        });
        await (0, operationLog_1.logCreate)(operationLog_1.TargetType.CASE, caseItem.id, `创建案件：${caseNumber} - ${caseItem.title}`, request, caseItem.caseManager, {
            id: caseItem.id,
            caseNumber: caseItem.caseNumber,
            title: caseItem.title,
            caseType: caseItem.caseType,
            status: caseItem.status,
            priority: caseItem.priority,
            caseManager: caseItem.caseManager,
            department: caseItem.department,
        });
        return caseItem;
    });
    fastify.put('/:id', async (request, reply) => {
        const data = request.body;
        try {
            const beforeCase = await prisma_1.default.case.findUnique({
                where: { id: request.params.id },
            });
            const caseItem = await prisma_1.default.case.update({
                where: { id: request.params.id },
                data: {
                    ...data,
                    occurTime: data.occurTime ? new Date(data.occurTime) : undefined,
                    reportTime: data.reportTime ? new Date(data.reportTime) : undefined,
                },
            });
            await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.CASE, caseItem.id, `更新案件：${caseItem.caseNumber} - ${caseItem.title}`, request, {
                title: beforeCase?.title,
                caseType: beforeCase?.caseType,
                status: beforeCase?.status,
                priority: beforeCase?.priority,
                caseManager: beforeCase?.caseManager,
                department: beforeCase?.department,
                location: beforeCase?.location,
            }, {
                title: caseItem.title,
                caseType: caseItem.caseType,
                status: caseItem.status,
                priority: caseItem.priority,
                caseManager: caseItem.caseManager,
                department: caseItem.department,
                location: caseItem.location,
            }, caseItem.caseManager);
            return caseItem;
        }
        catch (error) {
            reply.status(404).send({ error: '案件不存在' });
        }
    });
    fastify.delete('/:id', async (request, reply) => {
        try {
            const beforeCase = await prisma_1.default.case.findUnique({
                where: { id: request.params.id },
            });
            await prisma_1.default.$transaction([
                prisma_1.default.caseRelation.deleteMany({ where: { sourceCaseId: request.params.id } }),
                prisma_1.default.caseRelation.deleteMany({ where: { targetCaseId: request.params.id } }),
                prisma_1.default.evidence.deleteMany({ where: { caseId: request.params.id } }),
                prisma_1.default.clue.updateMany({ where: { caseId: request.params.id }, data: { caseId: null } }),
                prisma_1.default.casePerson.deleteMany({ where: { caseId: request.params.id } }),
                prisma_1.default.personRelation.deleteMany({ where: { caseId: request.params.id } }),
                prisma_1.default.case.delete({ where: { id: request.params.id } }),
            ]);
            await (0, operationLog_1.logDelete)(operationLog_1.TargetType.CASE, request.params.id, `删除案件：${beforeCase?.caseNumber || ''} - ${beforeCase?.title || ''}`, request, beforeCase ? {
                id: beforeCase.id,
                caseNumber: beforeCase.caseNumber,
                title: beforeCase.title,
                caseType: beforeCase.caseType,
                status: beforeCase.status,
            } : undefined);
            return { success: true };
        }
        catch (error) {
            reply.status(404).send({ error: '案件不存在' });
        }
    });
    fastify.post('/:id/persons', async (request, reply) => {
        try {
            const casePerson = await prisma_1.default.casePerson.create({
                data: {
                    caseId: request.params.id,
                    personId: request.body.personId,
                    role: request.body.role,
                    note: request.body.note,
                },
                include: { person: true },
            });
            const caseInfo = await prisma_1.default.case.findUnique({
                where: { id: request.params.id },
                select: { caseNumber: true, title: true },
            });
            await (0, operationLog_1.logAssociate)(operationLog_1.TargetType.CASE, request.params.id, `案件关联人员：${casePerson.person.name}（${request.body.role}）`, request, {
                personId: request.body.personId,
                personName: casePerson.person.name,
                role: request.body.role,
            });
            await (0, operationLog_1.logAssociate)(operationLog_1.TargetType.PERSON, request.body.personId, `关联案件：${caseInfo?.caseNumber || ''} - ${caseInfo?.title || ''}`, request, {
                caseId: request.params.id,
                caseNumber: caseInfo?.caseNumber,
                caseTitle: caseInfo?.title,
                role: request.body.role,
            });
            return casePerson;
        }
        catch (error) {
            reply.status(400).send({ error: '关联失败' });
        }
    });
    fastify.delete('/:id/persons/:personId', async (request, reply) => {
        try {
            const person = await prisma_1.default.person.findUnique({
                where: { id: request.params.personId },
                select: { name: true },
            });
            const caseInfo = await prisma_1.default.case.findUnique({
                where: { id: request.params.id },
                select: { caseNumber: true, title: true },
            });
            await prisma_1.default.casePerson.deleteMany({
                where: { caseId: request.params.id, personId: request.params.personId },
            });
            await (0, operationLog_1.logDisassociate)(operationLog_1.TargetType.CASE, request.params.id, `解除人员关联：${person?.name || '未知人员'}`, request, {
                personId: request.params.personId,
                personName: person?.name,
            });
            await (0, operationLog_1.logDisassociate)(operationLog_1.TargetType.PERSON, request.params.personId, `解除案件关联：${caseInfo?.caseNumber || ''} - ${caseInfo?.title || ''}`, request, {
                caseId: request.params.id,
                caseNumber: caseInfo?.caseNumber,
                caseTitle: caseInfo?.title,
            });
            return { success: true };
        }
        catch (error) {
            reply.status(400).send({ error: '取消关联失败' });
        }
    });
    fastify.get('/:id/clues', async (request, reply) => {
        const clues = await prisma_1.default.clue.findMany({
            where: { caseId: request.params.id },
            include: {
                _count: { select: { evidences: true, cluePersons: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return clues;
    });
    fastify.get('/:id/evidences', async (request, reply) => {
        const evidences = await prisma_1.default.evidence.findMany({
            where: { caseId: request.params.id },
            orderBy: { createdAt: 'desc' },
        });
        return evidences;
    });
    fastify.get('/:id/persons', async (request, reply) => {
        const casePersons = await prisma_1.default.casePerson.findMany({
            where: { caseId: request.params.id },
            include: { person: true },
            orderBy: { createdAt: 'desc' },
        });
        return casePersons;
    });
    fastify.get('/:id/relations', async (request, reply) => {
        const casePersons = await prisma_1.default.casePerson.findMany({
            where: { caseId: request.params.id },
            include: { person: true },
        });
        const personIds = casePersons.map(cp => cp.personId);
        const relations = await prisma_1.default.personRelation.findMany({
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
    fastify.get('/:id/export', async (request, reply) => {
        const { includeClues = 'true', includeEvidences = 'true', includePersons = 'true', includeRelations = 'true' } = request.query;
        const caseItem = await prisma_1.default.case.findUnique({
            where: { id: request.params.id },
            include: {
                clues: {
                    include: {
                        cluePersons: { include: { person: true } },
                        verifications: { orderBy: { createdAt: 'desc' } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                evidences: {
                    orderBy: { createdAt: 'desc' },
                },
                casePersons: {
                    include: { person: { include: { personTags: { include: { tag: true } } } } },
                    orderBy: { createdAt: 'desc' },
                },
                sourceRelations: {
                    include: {
                        targetCase: { select: { id: true, caseNumber: true, title: true, caseType: true, status: true } },
                    },
                },
                targetRelations: {
                    include: {
                        sourceCase: { select: { id: true, caseNumber: true, title: true, caseType: true, status: true } },
                    },
                },
            },
        });
        if (!caseItem) {
            reply.status(404).send({ error: '案件不存在' });
            return;
        }
        const personIds = caseItem.casePersons.map((cp) => cp.personId);
        const personRelations = await prisma_1.default.personRelation.findMany({
            where: {
                OR: [
                    { caseId: request.params.id },
                    { subjectId: { in: personIds } },
                    { objectId: { in: personIds } },
                ],
            },
            include: {
                subjectPerson: { select: { id: true, name: true, personType: true } },
                objectPerson: { select: { id: true, name: true, personType: true } },
            },
        });
        const formatDate = (d) => d ? new Date(d).toISOString() : null;
        const archive = {
            exportInfo: {
                exportedAt: new Date().toISOString(),
                format: 'case-archive-v1',
                caseId: caseItem.id,
                caseNumber: caseItem.caseNumber,
            },
            case: {
                id: caseItem.id,
                caseNumber: caseItem.caseNumber,
                title: caseItem.title,
                description: caseItem.description,
                caseType: caseItem.caseType,
                status: caseItem.status,
                priority: caseItem.priority,
                location: caseItem.location,
                occurTime: formatDate(caseItem.occurTime),
                reportTime: formatDate(caseItem.reportTime),
                caseManager: caseItem.caseManager,
                department: caseItem.department,
                summary: caseItem.summary,
                caseAnalysis: caseItem.caseAnalysis,
                personAnalysis: caseItem.personAnalysis,
                evidenceAnalysis: caseItem.evidenceAnalysis,
                conclusion: caseItem.conclusion,
                createdAt: formatDate(caseItem.createdAt),
                updatedAt: formatDate(caseItem.updatedAt),
            },
            relatedCases: [
                ...caseItem.sourceRelations.map((r) => ({
                    relationType: r.relationType,
                    description: r.description,
                    case: r.targetCase,
                })),
                ...caseItem.targetRelations.map((r) => ({
                    relationType: r.relationType,
                    description: r.description,
                    case: r.sourceCase,
                })),
            ],
        };
        if (includeClues === 'true') {
            archive.clues = caseItem.clues.map((clue) => ({
                id: clue.id,
                clueNumber: clue.clueNumber,
                title: clue.title,
                content: clue.content,
                clueType: clue.clueType,
                source: clue.source,
                credibility: clue.credibility,
                importance: clue.importance,
                status: clue.status,
                location: clue.location,
                findTime: formatDate(clue.findTime),
                informant: clue.informant,
                handler: clue.handler,
                note: clue.note,
                createdAt: formatDate(clue.createdAt),
                updatedAt: formatDate(clue.updatedAt),
                relatedPersons: clue.cluePersons?.map((cp) => ({
                    name: cp.person?.name,
                    personType: cp.person?.personType,
                    relation: cp.relation,
                })) || [],
                verifications: clue.verifications?.map((v) => ({
                    result: v.result,
                    handler: v.handler,
                    handleTime: formatDate(v.handleTime),
                    note: v.note,
                    createdAt: formatDate(v.createdAt),
                })) || [],
            }));
        }
        if (includeEvidences === 'true') {
            archive.evidences = caseItem.evidences.map((ev) => ({
                id: ev.id,
                evidenceNumber: ev.evidenceNumber,
                name: ev.name,
                description: ev.description,
                type: ev.type,
                fileName: ev.fileName,
                fileSize: ev.fileSize,
                mimeType: ev.mimeType,
                hash: ev.hash,
                collectionMethod: ev.collectionMethod,
                collector: ev.collector,
                collectTime: formatDate(ev.collectTime),
                location: ev.location,
                status: ev.status,
                borrowStatus: ev.borrowStatus,
                note: ev.note,
                createdAt: formatDate(ev.createdAt),
                updatedAt: formatDate(ev.updatedAt),
            }));
        }
        if (includePersons === 'true') {
            archive.persons = caseItem.casePersons.map((cp) => ({
                personId: cp.personId,
                name: cp.person?.name,
                gender: cp.person?.gender,
                age: cp.person?.age,
                idCard: cp.person?.idCard,
                phone: cp.person?.phone,
                address: cp.person?.address,
                occupation: cp.person?.occupation,
                personType: cp.person?.personType,
                role: cp.role,
                note: cp.note,
                tags: cp.person?.personTags?.map((pt) => pt.tag?.name).filter(Boolean) || [],
            }));
        }
        if (includeRelations === 'true') {
            archive.personRelations = personRelations.map((r) => ({
                subject: {
                    id: r.subjectPerson?.id,
                    name: r.subjectPerson?.name,
                    personType: r.subjectPerson?.personType,
                },
                object: {
                    id: r.objectPerson?.id,
                    name: r.objectPerson?.name,
                    personType: r.objectPerson?.personType,
                },
                relationType: r.relationType,
                description: r.description,
            }));
            const relationSummary = {};
            personRelations.forEach((r) => {
                const type = r.relationType;
                if (!relationSummary[type]) {
                    relationSummary[type] = [];
                }
                relationSummary[type].push(`${r.subjectPerson?.name} → ${r.objectPerson?.name}`);
            });
            archive.relationSummary = Object.entries(relationSummary).map(([type, pairs]) => ({
                relationType: type,
                count: pairs.length,
                details: pairs,
            }));
        }
        const exportData = JSON.stringify(archive, null, 2);
        const fileName = `${caseItem.caseNumber}_${caseItem.title}_归档_${new Date().toISOString().slice(0, 10)}.json`;
        const meta = (0, operationLog_1.getRequestMeta)(request);
        await (0, operationLog_1.createOperationLog)({
            targetType: operationLog_1.TargetType.CASE,
            targetId: request.params.id,
            action: operationLog_1.ActionType.EXPORT,
            description: `导出案件归档：${caseItem.caseNumber} - ${caseItem.title}`,
            operator: undefined,
            afterData: {
                includeClues: includeClues === 'true',
                includeEvidences: includeEvidences === 'true',
                includePersons: includePersons === 'true',
                includeRelations: includeRelations === 'true',
                fileName,
            },
            ...meta,
        });
        reply.header('Content-Type', 'application/json; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        reply.header('Content-Length', Buffer.byteLength(exportData, 'utf-8'));
        return reply.send(exportData);
    });
    fastify.get('/:id/thematic-view', async (request, reply) => {
        const caseItem = await prisma_1.default.case.findUnique({
            where: { id: request.params.id },
            include: {
                clues: {
                    include: {
                        cluePersons: { include: { person: true } },
                    },
                },
                evidences: true,
                casePersons: { include: { person: true } },
                sourceRelations: {
                    include: {
                        targetCase: {
                            include: {
                                clues: {
                                    include: {
                                        cluePersons: { include: { person: true } },
                                    },
                                },
                                evidences: true,
                                casePersons: { include: { person: true } },
                            },
                        },
                    },
                },
                targetRelations: {
                    include: {
                        sourceCase: {
                            include: {
                                clues: {
                                    include: {
                                        cluePersons: { include: { person: true } },
                                    },
                                },
                                evidences: true,
                                casePersons: { include: { person: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!caseItem) {
            reply.status(404).send({ error: '案件不存在' });
            return;
        }
        const relatedCases = [
            ...caseItem.sourceRelations.map((r) => ({
                ...r.targetCase,
                _relationType: r.relationType,
            })),
            ...caseItem.targetRelations.map((r) => ({
                ...r.sourceCase,
                _relationType: r.relationType,
            })),
        ];
        const allClues = [...caseItem.clues];
        const allEvidences = [...caseItem.evidences];
        const allCasePersons = [...caseItem.casePersons];
        const personIdSet = new Set(caseItem.casePersons.map((cp) => cp.personId));
        relatedCases.forEach((rc) => {
            (rc.clues || []).forEach((clue) => {
                if (!allClues.find(c => c.id === clue.id)) {
                    allClues.push({ ...clue, _sourceCase: { id: rc.id, caseNumber: rc.caseNumber, title: rc.title } });
                }
            });
            (rc.evidences || []).forEach((evidence) => {
                if (!allEvidences.find(e => e.id === evidence.id)) {
                    allEvidences.push({ ...evidence, _sourceCase: { id: rc.id, caseNumber: rc.caseNumber, title: rc.title } });
                }
            });
            (rc.casePersons || []).forEach((cp) => {
                if (!personIdSet.has(cp.personId)) {
                    personIdSet.add(cp.personId);
                    allCasePersons.push({ ...cp, _sourceCase: { id: rc.id, caseNumber: rc.caseNumber, title: rc.title } });
                }
            });
        });
        const { sourceRelations, targetRelations, clues, evidences, casePersons, ...caseInfo } = caseItem;
        return {
            case: caseInfo,
            relatedCases: relatedCases.map((rc) => {
                const { clues, evidences, casePersons, ...rest } = rc;
                return rest;
            }),
            aggregated: {
                cases: relatedCases.map((rc) => ({
                    id: rc.id,
                    caseNumber: rc.caseNumber,
                    title: rc.title,
                    caseType: rc.caseType,
                    status: rc.status,
                    priority: rc.priority,
                    caseManager: rc.caseManager,
                    department: rc.department,
                    createdAt: rc.createdAt,
                    clueCount: rc.clues?.length || 0,
                    evidenceCount: rc.evidences?.length || 0,
                    personCount: rc.casePersons?.length || 0,
                })),
                totalClues: allClues.length,
                totalEvidences: allEvidences.length,
                totalPersons: allCasePersons.length,
                clues: allClues,
                evidences: allEvidences,
                casePersons: allCasePersons,
            },
        };
    });
}
