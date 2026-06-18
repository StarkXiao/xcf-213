"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
const caseTypeRiskScores = {
    '暴力犯罪': 10,
    '经济犯罪': 8,
    '毒品犯罪': 9,
    '盗窃': 5,
    '诈骗': 7,
    '故意伤害': 9,
    '抢劫': 9,
    '杀人': 10,
    '其他': 3,
};
const personTypeRiskScores = {
    '嫌疑人': 8,
    '关系人': 3,
    '受害人': 0,
    '证人': 0,
    '其他': 1,
};
const roleRiskScores = {
    '主犯': 10,
    '从犯': 6,
    '教唆犯': 8,
    '胁从犯': 4,
    '嫌疑人': 7,
};
const evidenceTypeRiskScores = {
    '物证': 5,
    '书证': 4,
    '鉴定意见': 4,
    '勘验笔录': 3,
    '视听资料': 3,
    '电子数据': 3,
    '犯罪嫌疑人供述': 4,
    '被害人陈述': 2,
    '证人证言': 2,
    '其他': 1,
};
const evidenceStatusRiskScores = {
    '已鉴定': 3,
    '已采信': 4,
    '待鉴定': 1,
    '已入库': 1,
    '其他': 1,
};
function calculateEvidenceScore(evidences) {
    const details = [];
    let typeScore = 0;
    let evidenceTypes = new Set();
    let evidenceCount = evidences?.length || 0;
    if (!evidences || evidences.length === 0) {
        return {
            score: 0,
            breakdown: { typeScore: 0, quantityBonus: 0, chainBonus: 0 },
            details: [],
        };
    }
    evidences.forEach((e) => {
        const typeWeight = evidenceTypeRiskScores[e.type] || 1;
        const statusWeight = evidenceStatusRiskScores[e.status] || 1;
        const itemScore = typeWeight * statusWeight / 2;
        typeScore += itemScore;
        if (e.type)
            evidenceTypes.add(e.type);
        details.push(`证据「${e.name}」：${e.type}（+${itemScore.toFixed(1)}分）`);
    });
    typeScore = Math.round(typeScore * 10) / 10;
    let quantityBonus = 0;
    if (evidenceCount >= 10) {
        quantityBonus = 8;
        details.push(`证据数量充足（${evidenceCount}份，+8分）`);
    }
    else if (evidenceCount >= 5) {
        quantityBonus = 5;
        details.push(`证据数量较多（${evidenceCount}份，+5分）`);
    }
    else if (evidenceCount >= 3) {
        quantityBonus = 2;
        details.push(`证据数量中等（${evidenceCount}份，+2分）`);
    }
    let chainBonus = 0;
    if (evidenceTypes.size >= 4) {
        chainBonus = 5;
        details.push(`证据链完整（${evidenceTypes.size}种类型，+5分）`);
    }
    else if (evidenceTypes.size >= 2) {
        chainBonus = 2;
        details.push(`证据类型多样（${evidenceTypes.size}种类型，+2分）`);
    }
    const totalScore = Math.round(typeScore + quantityBonus + chainBonus);
    return {
        score: totalScore,
        breakdown: {
            typeScore: Math.round(typeScore),
            quantityBonus,
            chainBonus,
        },
        details,
    };
}
function calculateRiskScore(person, evidences = []) {
    const factors = [];
    const baseScore = personTypeRiskScores[person.personType] || 1;
    if (person.personType === '嫌疑人')
        factors.push('人员类型：嫌疑人（+8分）');
    else if (person.personType === '关系人')
        factors.push('人员类型：关系人（+3分）');
    let caseScore = 0;
    const casePersons = person.casePersons || [];
    casePersons.forEach((cp) => {
        const caseType = cp.case?.caseType;
        const typeScore = caseTypeRiskScores[caseType] || 3;
        caseScore += typeScore;
        if (cp.role && roleRiskScores[cp.role]) {
            caseScore += roleRiskScores[cp.role];
            factors.push(`案件「${cp.case?.title}」：${caseType}（+${typeScore}分），角色：${cp.role}（+${roleRiskScores[cp.role]}分）`);
        }
        else {
            factors.push(`案件「${cp.case?.title}」：${caseType}（+${typeScore}分）`);
        }
    });
    if (casePersons.length >= 5) {
        caseScore += 8;
        factors.push(`多次涉案（共${casePersons.length}起，+8分）`);
    }
    else if (casePersons.length >= 3) {
        caseScore += 5;
        factors.push(`多次涉案（共${casePersons.length}起，+5分）`);
    }
    let clueScore = 0;
    const cluePersons = person.cluePersons || [];
    cluePersons.forEach((cp) => {
        const importance = cp.clue?.importance;
        const credibility = cp.clue?.credibility;
        let clueBaseScore = 2;
        if (importance === '高')
            clueBaseScore += 3;
        else if (importance === '中')
            clueBaseScore += 1;
        if (credibility === '高')
            clueBaseScore += 2;
        else if (credibility === '中')
            clueBaseScore += 1;
        clueScore += clueBaseScore;
        factors.push(`线索「${cp.clue?.title}」：重要性${importance}、可信度${credibility}（+${clueBaseScore}分）`);
    });
    if (cluePersons.length >= 8) {
        clueScore += 5;
        factors.push(`多条线索关联（共${cluePersons.length}条，+5分）`);
    }
    else if (cluePersons.length >= 5) {
        clueScore += 3;
        factors.push(`多条线索关联（共${cluePersons.length}条，+3分）`);
    }
    const evidenceResult = calculateEvidenceScore(evidences);
    const evidenceScore = evidenceResult.score;
    if (evidenceScore > 0) {
        factors.push(`关联证据（共${evidences.length}份，合计+${evidenceScore}分）`);
        factors.push(...evidenceResult.details.map(d => `  · ${d}`));
    }
    let relationScore = 0;
    const relations = [
        ...(person.relationsAsSubject || []),
        ...(person.relationsAsObject || []),
    ];
    const suspectRelations = relations.filter((r) => {
        const otherPerson = r.subjectPerson?.personType === '嫌疑人' ||
            r.objectPerson?.personType === '嫌疑人';
        return otherPerson;
    });
    relationScore += suspectRelations.length * 2;
    if (suspectRelations.length > 0) {
        factors.push(`与${suspectRelations.length}名嫌疑人存在关联（+${suspectRelations.length * 2}分）`);
    }
    if (relations.length >= 8) {
        relationScore += 5;
        factors.push(`复杂关系网络（共${relations.length}个关系，+5分）`);
    }
    else if (relations.length >= 5) {
        relationScore += 3;
        factors.push(`复杂关系网络（共${relations.length}个关系，+3分）`);
    }
    const totalScore = baseScore + caseScore + clueScore + evidenceScore + relationScore;
    let level;
    if (totalScore >= 50)
        level = 'CRITICAL';
    else if (totalScore >= 30)
        level = 'HIGH';
    else if (totalScore >= 15)
        level = 'MEDIUM';
    else
        level = 'LOW';
    return {
        score: totalScore,
        level,
        breakdown: {
            baseScore,
            caseScore,
            clueScore,
            evidenceScore,
            relationScore,
        },
        factors,
        evidenceDetails: {
            breakdown: evidenceResult.breakdown,
            details: evidenceResult.details,
        },
    };
}
async function loadPersonWithEvidences(person) {
    const caseIds = (person.casePersons || []).map((cp) => cp.caseId);
    const clueIds = (person.cluePersons || []).map((cp) => cp.clueId);
    let evidences = [];
    if (caseIds.length > 0 || clueIds.length > 0) {
        evidences = await prisma_1.default.evidence.findMany({
            where: {
                OR: [
                    ...(caseIds.length > 0 ? [{ caseId: { in: caseIds } }] : []),
                    ...(clueIds.length > 0 ? [{ clueId: { in: clueIds } }] : []),
                ],
            },
            include: {
                case: true,
                clue: true,
            },
        });
    }
    return evidences;
}
async function default_1(fastify) {
    fastify.get('/stats', async () => {
        const persons = await prisma_1.default.person.findMany({
            include: {
                casePersons: { include: { case: true } },
                cluePersons: { include: { clue: true } },
                relationsAsSubject: { include: { objectPerson: true } },
                relationsAsObject: { include: { subjectPerson: true } },
            },
        });
        const allCaseIds = new Set();
        const allClueIds = new Set();
        persons.forEach((p) => {
            p.casePersons?.forEach((cp) => allCaseIds.add(cp.caseId));
            p.cluePersons?.forEach((cp) => allClueIds.add(cp.clueId));
        });
        const allEvidences = await prisma_1.default.evidence.findMany({
            where: {
                OR: [
                    ...(allCaseIds.size > 0 ? [{ caseId: { in: Array.from(allCaseIds) } }] : []),
                    ...(allClueIds.size > 0 ? [{ clueId: { in: Array.from(allClueIds) } }] : []),
                ],
            },
            include: { case: true, clue: true },
        });
        const evidenceByCase = new Map();
        const evidenceByClue = new Map();
        allEvidences.forEach((e) => {
            if (e.caseId) {
                if (!evidenceByCase.has(e.caseId))
                    evidenceByCase.set(e.caseId, []);
                evidenceByCase.get(e.caseId).push(e);
            }
            if (e.clueId) {
                if (!evidenceByClue.has(e.clueId))
                    evidenceByClue.set(e.clueId, []);
                evidenceByClue.get(e.clueId).push(e);
            }
        });
        const riskProfiles = persons.map((p) => {
            const personEvidences = [];
            const seenEvidenceIds = new Set();
            p.casePersons?.forEach((cp) => {
                const caseEvidences = evidenceByCase.get(cp.caseId) || [];
                caseEvidences.forEach(e => {
                    if (!seenEvidenceIds.has(e.id)) {
                        seenEvidenceIds.add(e.id);
                        personEvidences.push(e);
                    }
                });
            });
            p.cluePersons?.forEach((cp) => {
                const clueEvidences = evidenceByClue.get(cp.clueId) || [];
                clueEvidences.forEach(e => {
                    if (!seenEvidenceIds.has(e.id)) {
                        seenEvidenceIds.add(e.id);
                        personEvidences.push(e);
                    }
                });
            });
            return {
                personId: p.id,
                ...calculateRiskScore(p, personEvidences),
                evidenceCount: personEvidences.length,
            };
        });
        const levelCounts = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
        };
        riskProfiles.forEach((rp) => {
            levelCounts[rp.level]++;
        });
        const avgScore = riskProfiles.length > 0
            ? Math.round(riskProfiles.reduce((sum, rp) => sum + rp.score, 0) /
                riskProfiles.length)
            : 0;
        const highRiskList = riskProfiles
            .filter((rp) => rp.level === 'CRITICAL' || rp.level === 'HIGH')
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((rp) => {
            const person = persons.find((p) => p.id === rp.personId);
            return {
                id: person?.id,
                name: person?.name,
                personType: person?.personType,
                score: rp.score,
                level: rp.level,
                caseCount: person?.casePersons?.length || 0,
                clueCount: person?.cluePersons?.length || 0,
                evidenceCount: rp.evidenceCount,
            };
        });
        return {
            total: persons.length,
            levelCounts,
            avgScore,
            highRiskList,
        };
    });
    fastify.get('/', async (request, reply) => {
        const { page = 1, pageSize = 10, keyword, personType, riskLevel, sortBy = 'score', sortOrder = 'desc', } = request.query;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { idCard: { contains: keyword, mode: 'insensitive' } },
                { phone: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (personType)
            where.personType = personType;
        const persons = await prisma_1.default.person.findMany({
            where,
            include: {
                casePersons: { include: { case: true } },
                cluePersons: { include: { clue: true } },
                relationsAsSubject: { include: { objectPerson: true } },
                relationsAsObject: { include: { subjectPerson: true } },
                personTags: { include: { tag: true } },
                _count: {
                    select: { casePersons: true, cluePersons: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const allCaseIds = new Set();
        const allClueIds = new Set();
        persons.forEach((p) => {
            p.casePersons?.forEach((cp) => allCaseIds.add(cp.caseId));
            p.cluePersons?.forEach((cp) => allClueIds.add(cp.clueId));
        });
        let allEvidences = [];
        if (allCaseIds.size > 0 || allClueIds.size > 0) {
            allEvidences = await prisma_1.default.evidence.findMany({
                where: {
                    OR: [
                        ...(allCaseIds.size > 0 ? [{ caseId: { in: Array.from(allCaseIds) } }] : []),
                        ...(allClueIds.size > 0 ? [{ clueId: { in: Array.from(allClueIds) } }] : []),
                    ],
                },
            });
        }
        const evidenceByCase = new Map();
        const evidenceByClue = new Map();
        allEvidences.forEach((e) => {
            if (e.caseId) {
                if (!evidenceByCase.has(e.caseId))
                    evidenceByCase.set(e.caseId, []);
                evidenceByCase.get(e.caseId).push(e);
            }
            if (e.clueId) {
                if (!evidenceByClue.has(e.clueId))
                    evidenceByClue.set(e.clueId, []);
                evidenceByClue.get(e.clueId).push(e);
            }
        });
        const enriched = persons.map((p) => {
            const personEvidences = [];
            const seenEvidenceIds = new Set();
            p.casePersons?.forEach((cp) => {
                const caseEvidences = evidenceByCase.get(cp.caseId) || [];
                caseEvidences.forEach(e => {
                    if (!seenEvidenceIds.has(e.id)) {
                        seenEvidenceIds.add(e.id);
                        personEvidences.push(e);
                    }
                });
            });
            p.cluePersons?.forEach((cp) => {
                const clueEvidences = evidenceByClue.get(cp.clueId) || [];
                clueEvidences.forEach(e => {
                    if (!seenEvidenceIds.has(e.id)) {
                        seenEvidenceIds.add(e.id);
                        personEvidences.push(e);
                    }
                });
            });
            const risk = calculateRiskScore(p, personEvidences);
            return {
                id: p.id,
                name: p.name,
                personType: p.personType,
                gender: p.gender,
                age: p.age,
                idCard: p.idCard,
                phone: p.phone,
                address: p.address,
                occupation: p.occupation,
                avatar: p.avatar,
                description: p.description,
                tags: p.personTags.map((pt) => pt.tag),
                caseCount: p._count.casePersons,
                clueCount: p._count.cluePersons,
                evidenceCount: personEvidences.length,
                riskScore: risk.score,
                riskLevel: risk.level,
                riskBreakdown: risk.breakdown,
                riskFactors: risk.factors,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            };
        });
        let filtered = enriched;
        if (riskLevel) {
            filtered = enriched.filter((p) => p.riskLevel === riskLevel);
        }
        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'score') {
                comparison = a.riskScore - b.riskScore;
            }
            else if (sortBy === 'cases') {
                comparison = a.caseCount - b.caseCount;
            }
            else if (sortBy === 'clues') {
                comparison = a.clueCount - b.clueCount;
            }
            else if (sortBy === 'evidences') {
                comparison = a.evidenceCount - b.evidenceCount;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        const total = filtered.length;
        const items = filtered.slice(skip, skip + pageSize);
        return { items, total, page, pageSize };
    });
    fastify.get('/:id', async (request, reply) => {
        const person = await prisma_1.default.person.findUnique({
            where: { id: request.params.id },
            include: {
                casePersons: {
                    include: { case: true },
                    orderBy: { createdAt: 'desc' },
                },
                cluePersons: {
                    include: { clue: true },
                    orderBy: { createdAt: 'desc' },
                },
                relationsAsSubject: {
                    include: { objectPerson: true, case: true },
                    orderBy: { createdAt: 'desc' },
                },
                relationsAsObject: {
                    include: { subjectPerson: true, case: true },
                    orderBy: { createdAt: 'desc' },
                },
                personTags: { include: { tag: true } },
            },
        });
        if (!person) {
            reply.status(404).send({ error: '人员不存在' });
            return;
        }
        const caseIds = person.casePersons.map((cp) => cp.caseId);
        const clueIds = person.cluePersons.map((cp) => cp.clueId);
        const [relatedEvidences, relationGraph] = await Promise.all([
            prisma_1.default.evidence.findMany({
                where: {
                    OR: [
                        { caseId: { in: caseIds } },
                        { clueId: { in: clueIds } },
                    ],
                },
                include: {
                    case: true,
                    clue: true,
                    batch: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            (async () => {
                const directRelations = [
                    ...person.relationsAsSubject,
                    ...person.relationsAsObject,
                ];
                const relatedPersonIds = new Set();
                directRelations.forEach((r) => {
                    relatedPersonIds.add(r.subjectId);
                    relatedPersonIds.add(r.objectId);
                });
                const relatedPersons = await prisma_1.default.person.findMany({
                    where: { id: { in: Array.from(relatedPersonIds) } },
                    select: {
                        id: true,
                        name: true,
                        personType: true,
                        gender: true,
                        age: true,
                    },
                });
                const nodes = relatedPersons.map((p) => ({
                    id: p.id,
                    name: p.name,
                    type: p.personType,
                    gender: p.gender,
                    age: p.age,
                    isCenter: p.id === request.params.id,
                }));
                const edges = directRelations.map((r) => ({
                    id: r.id,
                    source: r.subjectId,
                    target: r.objectId,
                    relation: r.relationType,
                    description: r.description,
                    caseId: r.caseId,
                }));
                return { nodes, edges };
            })(),
        ]);
        const risk = calculateRiskScore(person, relatedEvidences);
        const clueHits = person.cluePersons
            .filter((cp) => cp.clue?.status === '已核实' ||
            cp.clue?.credibility === '高' ||
            cp.clue?.importance === '高')
            .map((cp) => ({
            id: cp.clueId,
            title: cp.clue?.title,
            clueNumber: cp.clue?.clueNumber,
            clueType: cp.clue?.clueType,
            source: cp.clue?.source,
            credibility: cp.clue?.credibility,
            importance: cp.clue?.importance,
            status: cp.clue?.status,
            relation: cp.relation,
            content: cp.clue?.content,
            findTime: cp.clue?.findTime,
            hitType: cp.clue?.credibility === '高' && cp.clue?.importance === '高'
                ? '关键线索'
                : cp.clue?.status === '已核实'
                    ? '已核实线索'
                    : '高价值线索',
            associatedAt: cp.createdAt,
        }));
        const { personTags, ...personRest } = person;
        return {
            ...personRest,
            tags: personTags.map((pt) => pt.tag),
            riskScore: risk.score,
            riskLevel: risk.level,
            riskBreakdown: risk.breakdown,
            riskFactors: risk.factors,
            evidenceDetails: risk.evidenceDetails,
            cases: person.casePersons.map((cp) => ({
                id: cp.caseId,
                caseNumber: cp.case?.caseNumber,
                title: cp.case?.title,
                caseType: cp.case?.caseType,
                status: cp.case?.status,
                priority: cp.case?.priority,
                location: cp.case?.location,
                occurTime: cp.case?.occurTime,
                role: cp.role,
                note: cp.note,
                associatedAt: cp.createdAt,
            })),
            clues: person.cluePersons.map((cp) => ({
                id: cp.clueId,
                clueNumber: cp.clue?.clueNumber,
                title: cp.clue?.title,
                clueType: cp.clue?.clueType,
                source: cp.clue?.source,
                credibility: cp.clue?.credibility,
                importance: cp.clue?.importance,
                status: cp.clue?.status,
                relation: cp.relation,
                note: cp.note,
                associatedAt: cp.createdAt,
            })),
            clueHits,
            evidences: relatedEvidences.map((e) => ({
                id: e.id,
                evidenceNumber: e.evidenceNumber,
                name: e.name,
                type: e.type,
                status: e.status,
                description: e.description,
                case: e.case,
                clue: e.clue,
                collectionMethod: e.collectionMethod,
                collectTime: e.collectTime,
                location: e.location,
                createdAt: e.createdAt,
            })),
            evidenceCount: relatedEvidences.length,
            relations: relationGraph,
        };
    });
    fastify.get('/:id/recalculate', async (request, reply) => {
        const person = await prisma_1.default.person.findUnique({
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
        const evidences = await loadPersonWithEvidences(person);
        const risk = calculateRiskScore(person, evidences);
        return {
            personId: person.id,
            name: person.name,
            ...risk,
            evidenceCount: evidences.length,
            calculatedAt: new Date().toISOString(),
        };
    });
}
