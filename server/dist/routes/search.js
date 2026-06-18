"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
async function default_1(fastify) {
    fastify.get('/', async (request, reply) => {
        const { keyword, type, limit = 20 } = request.query;
        if (!keyword) {
            return { cases: [], clues: [], persons: [], evidences: [] };
        }
        const whereCondition = {
            OR: [
                { title: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ],
        };
        const result = {};
        if (!type || type === 'case') {
            result.cases = await prisma_1.default.case.findMany({
                where: {
                    OR: [
                        { title: { contains: keyword, mode: 'insensitive' } },
                        { caseNumber: { contains: keyword, mode: 'insensitive' } },
                        { description: { contains: keyword, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                select: {
                    id: true,
                    caseNumber: true,
                    title: true,
                    caseType: true,
                    status: true,
                    createdAt: true,
                },
            });
        }
        if (!type || type === 'clue') {
            result.clues = await prisma_1.default.clue.findMany({
                where: {
                    OR: [
                        { title: { contains: keyword, mode: 'insensitive' } },
                        { clueNumber: { contains: keyword, mode: 'insensitive' } },
                        { content: { contains: keyword, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                select: {
                    id: true,
                    clueNumber: true,
                    title: true,
                    clueType: true,
                    status: true,
                    caseId: true,
                    createdAt: true,
                },
            });
        }
        if (!type || type === 'person') {
            result.persons = await prisma_1.default.person.findMany({
                where: {
                    OR: [
                        { name: { contains: keyword, mode: 'insensitive' } },
                        { idCard: { contains: keyword, mode: 'insensitive' } },
                        { phone: { contains: keyword, mode: 'insensitive' } },
                        { address: { contains: keyword, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                select: {
                    id: true,
                    name: true,
                    personType: true,
                    gender: true,
                    age: true,
                    phone: true,
                    idCard: true,
                },
            });
        }
        if (!type || type === 'evidence') {
            result.evidences = await prisma_1.default.evidence.findMany({
                where: {
                    OR: [
                        { name: { contains: keyword, mode: 'insensitive' } },
                        { evidenceNumber: { contains: keyword, mode: 'insensitive' } },
                        { description: { contains: keyword, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                select: {
                    id: true,
                    evidenceNumber: true,
                    name: true,
                    type: true,
                    status: true,
                    caseId: true,
                    clueId: true,
                    createdAt: true,
                },
            });
        }
        return result;
    });
    const getFileType = (mimeType, fileName) => {
        if (!mimeType && !fileName)
            return 'other';
        const mime = mimeType || '';
        const name = fileName || '';
        if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name))
            return 'image';
        if (mime.startsWith('video/') || /\.(mp4|avi|mov|mkv|flv|wmv)$/i.test(name))
            return 'video';
        if (mime.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg)$/i.test(name))
            return 'audio';
        if (/\.(doc|docx|pdf|txt|xls|xlsx|ppt|pptx)$/i.test(name) || mime.includes('pdf') || mime.includes('msword') || mime.includes('spreadsheet'))
            return 'document';
        if (/\.(zip|rar|7z|tar|gz)$/i.test(name))
            return 'archive';
        return 'other';
    };
    const toArray = (val) => {
        if (!val)
            return undefined;
        return Array.isArray(val) ? val : [val];
    };
    fastify.get('/advanced', async (request, reply) => {
        const { keyword, caseType, status, priority, clueType, source, credibility, importance, personType, gender, evidenceType, fileType, caseManager, location, department, startDate, endDate, occurStartDate, occurEndDate, tagIds, } = request.query;
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const occurDateFilter = {};
        if (occurStartDate)
            occurDateFilter.gte = new Date(occurStartDate);
        if (occurEndDate)
            occurDateFilter.lte = new Date(occurEndDate);
        const caseWhere = {};
        if (keyword) {
            caseWhere.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { caseNumber: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
                { summary: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        const caseTypes = toArray(caseType);
        if (caseTypes)
            caseWhere.caseType = { in: caseTypes };
        const statuses = toArray(status);
        if (statuses)
            caseWhere.status = { in: statuses };
        const priorities = toArray(priority);
        if (priorities)
            caseWhere.priority = { in: priorities };
        if (caseManager)
            caseWhere.caseManager = { contains: caseManager, mode: 'insensitive' };
        if (location)
            caseWhere.location = { contains: location, mode: 'insensitive' };
        if (department)
            caseWhere.department = { contains: department, mode: 'insensitive' };
        if (Object.keys(dateFilter).length)
            caseWhere.createdAt = dateFilter;
        if (Object.keys(occurDateFilter).length)
            caseWhere.occurTime = occurDateFilter;
        const clueWhere = {};
        if (keyword) {
            clueWhere.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { clueNumber: { contains: keyword, mode: 'insensitive' } },
                { content: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        const clueTypes = toArray(clueType);
        if (clueTypes)
            clueWhere.clueType = { in: clueTypes };
        const sources = toArray(source);
        if (sources)
            clueWhere.source = { in: sources };
        const credibilities = toArray(credibility);
        if (credibilities)
            clueWhere.credibility = { in: credibilities };
        const importances = toArray(importance);
        if (importances)
            clueWhere.importance = { in: importances };
        if (Object.keys(dateFilter).length)
            clueWhere.createdAt = dateFilter;
        const personWhere = {};
        if (keyword) {
            personWhere.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { idCard: { contains: keyword, mode: 'insensitive' } },
                { phone: { contains: keyword, mode: 'insensitive' } },
                { address: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        const personTypes = toArray(personType);
        if (personTypes)
            personWhere.personType = { in: personTypes };
        if (gender)
            personWhere.gender = gender;
        const personTagIds = toArray(tagIds);
        if (personTagIds) {
            personWhere.personTags = { some: { tagId: { in: personTagIds } } };
        }
        if (Object.keys(dateFilter).length)
            personWhere.createdAt = dateFilter;
        const evidenceWhere = {};
        if (keyword) {
            evidenceWhere.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { evidenceNumber: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        const evidenceTypes = toArray(evidenceType);
        if (evidenceTypes)
            evidenceWhere.type = { in: evidenceTypes };
        if (Object.keys(dateFilter).length)
            evidenceWhere.createdAt = dateFilter;
        const [cases, clues, persons, evidences] = await Promise.all([
            prisma_1.default.case.findMany({
                where: caseWhere,
                take: 100,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.clue.findMany({
                where: clueWhere,
                take: 100,
                orderBy: { createdAt: 'desc' },
                include: { case: { select: { id: true, caseNumber: true, title: true } } },
            }),
            prisma_1.default.person.findMany({
                where: personWhere,
                take: 100,
                orderBy: { createdAt: 'desc' },
                include: { personTags: { include: { tag: true } } },
            }),
            prisma_1.default.evidence.findMany({
                where: evidenceWhere,
                take: 100,
                orderBy: { createdAt: 'desc' },
                include: {
                    case: { select: { id: true, caseNumber: true, title: true } },
                    clue: { select: { id: true, clueNumber: true, title: true } },
                },
            }),
        ]);
        let transformedEvidences = evidences.map(e => ({
            ...e,
            evidenceType: e.type,
            fileType: getFileType(e.mimeType || undefined, e.fileName || undefined),
            fileUrl: e.filePath,
            collectionTime: e.collectTime,
        }));
        const fileTypes = toArray(fileType);
        if (fileTypes) {
            transformedEvidences = transformedEvidences.filter(e => fileTypes.includes(e.fileType));
        }
        return {
            cases,
            clues,
            persons,
            evidences: transformedEvidences,
        };
    });
    fastify.get('/stats', async () => {
        const [caseCount, clueCount, personCount, evidenceCount] = await Promise.all([
            prisma_1.default.case.count(),
            prisma_1.default.clue.count(),
            prisma_1.default.person.count(),
            prisma_1.default.evidence.count(),
        ]);
        const caseStats = await prisma_1.default.case.groupBy({
            by: ['status'],
            _count: true,
        });
        const clueStats = await prisma_1.default.clue.groupBy({
            by: ['status'],
            _count: true,
        });
        const recentCases = await prisma_1.default.case.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, caseNumber: true, title: true, status: true, priority: true, createdAt: true },
        });
        const recentClues = await prisma_1.default.clue.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, clueNumber: true, title: true, status: true, createdAt: true },
        });
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const caseTrendRaw = await prisma_1.default.case.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { id: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        const caseTrend = [];
        const caseStatuses = ['待立案', '已立案', '侦查中', '已移送起诉', '已判决', '已结案', '已撤销'];
        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const monthData = { month: monthStr };
            caseStatuses.forEach(status => { monthData[status] = 0; });
            monthData['新增案件'] = 0;
            caseTrend.push(monthData);
        }
        caseTrendRaw.forEach(c => {
            const monthIdx = caseTrend.findIndex(m => {
                const [year, month] = m.month.split('-').map(Number);
                return c.createdAt.getFullYear() === year && c.createdAt.getMonth() === month - 1;
            });
            if (monthIdx >= 0) {
                caseTrend[monthIdx][c.status] = caseTrend[monthIdx][c.status] + 1;
                caseTrend[monthIdx]['新增案件'] = caseTrend[monthIdx]['新增案件'] + 1;
            }
        });
        const clueTrendRaw = await prisma_1.default.clue.findMany({
            where: {
                caseId: { not: null },
                updatedAt: { gte: sixMonthsAgo }
            },
            select: { id: true, status: true, caseId: true, updatedAt: true },
            orderBy: { updatedAt: 'asc' },
        });
        const clueTrend = [];
        const clueStatuses = ['待核实', '核实中', '已核实', '已采用', '已排除'];
        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const monthData = { month: monthStr };
            clueStatuses.forEach(status => { monthData[status] = 0; });
            monthData['已转化案件'] = 0;
            clueTrend.push(monthData);
        }
        clueTrendRaw.forEach(c => {
            const monthIdx = clueTrend.findIndex(m => {
                const [year, month] = m.month.split('-').map(Number);
                return c.updatedAt.getFullYear() === year && c.updatedAt.getMonth() === month - 1;
            });
            if (monthIdx >= 0) {
                clueTrend[monthIdx][c.status] = clueTrend[monthIdx][c.status] + 1;
                clueTrend[monthIdx]['已转化案件'] = clueTrend[monthIdx]['已转化案件'] + 1;
            }
        });
        const totalConvertedClues = await prisma_1.default.clue.count({
            where: { caseId: { not: null } },
        });
        const clueConversionRate = clueCount > 0 ? Math.round((totalConvertedClues / clueCount) * 100) : 0;
        const evidenceTrendRaw = await prisma_1.default.evidence.findMany({
            where: {
                status: '已入库',
                createdAt: { gte: sixMonthsAgo }
            },
            select: { id: true, type: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        const evidenceTrend = [];
        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const monthData = { month: monthStr };
            monthData['已入库'] = 0;
            monthData['物证'] = 0;
            monthData['书证'] = 0;
            monthData['电子数据'] = 0;
            monthData['视听资料'] = 0;
            evidenceTrend.push(monthData);
        }
        evidenceTrendRaw.forEach(e => {
            const monthIdx = evidenceTrend.findIndex(m => {
                const [year, month] = m.month.split('-').map(Number);
                return e.createdAt.getFullYear() === year && e.createdAt.getMonth() === month - 1;
            });
            if (monthIdx >= 0) {
                evidenceTrend[monthIdx]['已入库'] = evidenceTrend[monthIdx]['已入库'] + 1;
                if (e.type && evidenceTrend[monthIdx].hasOwnProperty(e.type)) {
                    evidenceTrend[monthIdx][e.type] = evidenceTrend[monthIdx][e.type] + 1;
                }
            }
        });
        const keyPersonTags = await prisma_1.default.tag.findMany({
            where: {
                OR: [
                    { name: { contains: '重点', mode: 'insensitive' } },
                    { category: { contains: '重点', mode: 'insensitive' } },
                ],
            },
            select: { id: true, name: true },
        });
        const keyPersonTagIds = keyPersonTags.map(t => t.id);
        const hasKeyTags = keyPersonTagIds.length > 0;
        let keyPersonTrendRaw = [];
        let keyPersonCount = 0;
        if (hasKeyTags) {
            const keyPersonTagsRaw = await prisma_1.default.personTag.findMany({
                where: {
                    tagId: { in: keyPersonTagIds },
                    createdAt: { gte: sixMonthsAgo },
                },
                select: {
                    id: true,
                    personId: true,
                    tagId: true,
                    createdAt: true,
                    tag: { select: { name: true } },
                },
                orderBy: { createdAt: 'asc' },
            });
            const keyPersonIds = new Set();
            keyPersonTagsRaw.forEach(pt => {
                keyPersonIds.add(pt.personId);
                keyPersonTrendRaw.push(pt);
            });
            keyPersonCount = keyPersonIds.size;
            const allKeyPersonTags = await prisma_1.default.personTag.findMany({
                where: { tagId: { in: keyPersonTagIds } },
                select: { personId: true },
            });
            keyPersonCount = new Set(allKeyPersonTags.map(pt => pt.personId)).size;
        }
        else {
            const suspectPersons = await prisma_1.default.person.findMany({
                where: {
                    personType: '嫌疑人',
                    createdAt: { gte: sixMonthsAgo }
                },
                select: { id: true, personType: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            });
            keyPersonTrendRaw = suspectPersons;
            const allSuspects = await prisma_1.default.person.count({
                where: { personType: '嫌疑人' },
            });
            keyPersonCount = allSuspects;
        }
        const keyPersonTrend = [];
        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const monthData = { month: monthStr };
            monthData['新增重点人员'] = 0;
            monthData['累计重点人员'] = 0;
            keyPersonTrend.push(monthData);
        }
        const seenPersonIds = new Set();
        let cumulativeCount = 0;
        for (let i = 0; i < keyPersonTrend.length; i++) {
            const [year, month] = keyPersonTrend[i].month.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 1);
            const monthNewIds = new Set();
            keyPersonTrendRaw.forEach((item) => {
                const itemDate = item.createdAt;
                if (itemDate >= monthStart && itemDate < monthEnd) {
                    const personId = item.personId || item.id;
                    if (!seenPersonIds.has(personId)) {
                        monthNewIds.add(personId);
                        seenPersonIds.add(personId);
                    }
                }
            });
            cumulativeCount += monthNewIds.size;
            keyPersonTrend[i]['新增重点人员'] = monthNewIds.size;
            keyPersonTrend[i]['累计重点人员'] = cumulativeCount;
        }
        const keyPersonStats = hasKeyTags
            ? keyPersonTags.map(t => ({ name: t.name, count: 0 }))
            : [{ name: '嫌疑人', count: keyPersonCount }];
        return {
            totals: {
                cases: caseCount,
                clues: clueCount,
                persons: personCount,
                evidences: evidenceCount,
            },
            caseStats,
            clueStats,
            recentCases,
            recentClues,
            caseTrend,
            clueTrend,
            clueConversionRate,
            totalConvertedClues,
            evidenceTrend,
            keyPersonTrend,
            keyPersonStats,
            keyPersonCount,
            hasKeyPersonTags: hasKeyTags,
        };
    });
    fastify.get('/cross-case-dedupe', async (request, reply) => {
        const { dimensions, minCaseCount = 2 } = request.query;
        const dims = toArray(dimensions) || ['persons', 'phones', 'locations', 'evidenceNumbers'];
        const minCount = Number(minCaseCount) || 2;
        const result = {};
        if (dims.includes('persons')) {
            const casePersons = await prisma_1.default.casePerson.findMany({
                include: {
                    person: {
                        select: {
                            id: true,
                            name: true,
                            idCard: true,
                            phone: true,
                            personType: true,
                        },
                    },
                    case: {
                        select: {
                            id: true,
                            caseNumber: true,
                            title: true,
                            caseType: true,
                            status: true,
                        },
                    },
                },
            });
            const personCaseMap = new Map();
            casePersons.forEach(cp => {
                const key = cp.person.id;
                if (!personCaseMap.has(key)) {
                    personCaseMap.set(key, {
                        person: cp.person,
                        cases: [],
                    });
                }
                personCaseMap.get(key).cases.push(cp.case);
            });
            result.persons = Array.from(personCaseMap.values())
                .filter(item => item.cases.length >= minCount)
                .map(item => ({
                ...item.person,
                caseCount: item.cases.length,
                cases: item.cases,
            }))
                .sort((a, b) => b.caseCount - a.caseCount);
        }
        if (dims.includes('phones')) {
            const personsWithPhone = await prisma_1.default.person.findMany({
                where: {
                    phone: { not: null },
                },
                include: {
                    casePersons: {
                        include: {
                            case: {
                                select: {
                                    id: true,
                                    caseNumber: true,
                                    title: true,
                                    caseType: true,
                                    status: true,
                                },
                            },
                        },
                    },
                },
            });
            const phoneMap = new Map();
            personsWithPhone.forEach(person => {
                const phone = person.phone;
                if (!phoneMap.has(phone)) {
                    phoneMap.set(phone, {
                        phone,
                        persons: [],
                        cases: [],
                        caseIds: new Set(),
                    });
                }
                const entry = phoneMap.get(phone);
                entry.persons.push({
                    id: person.id,
                    name: person.name,
                    personType: person.personType,
                    idCard: person.idCard,
                });
                person.casePersons.forEach(cp => {
                    if (cp.case && !entry.caseIds.has(cp.case.id)) {
                        entry.caseIds.add(cp.case.id);
                        entry.cases.push(cp.case);
                    }
                });
            });
            result.phones = Array.from(phoneMap.values())
                .filter(item => item.cases.length >= minCount)
                .map(item => ({
                phone: item.phone,
                personCount: item.persons.length,
                persons: item.persons,
                caseCount: item.cases.length,
                cases: item.cases,
            }))
                .sort((a, b) => b.caseCount - a.caseCount);
        }
        if (dims.includes('locations')) {
            const caseLocations = await prisma_1.default.case.findMany({
                where: { location: { not: null } },
                select: {
                    id: true,
                    caseNumber: true,
                    title: true,
                    caseType: true,
                    status: true,
                    location: true,
                },
            });
            const clueLocations = await prisma_1.default.clue.findMany({
                where: { location: { not: null } },
                select: {
                    id: true,
                    caseId: true,
                    location: true,
                },
            });
            const evidenceLocations = await prisma_1.default.evidence.findMany({
                where: { location: { not: null } },
                select: {
                    id: true,
                    caseId: true,
                    location: true,
                },
            });
            const locationMap = new Map();
            const allCaseIdsFromCluesAndEvidences = new Set();
            const normalizeLocation = (loc) => {
                return loc.trim().toLowerCase();
            };
            caseLocations.forEach(c => {
                const key = normalizeLocation(c.location);
                if (!locationMap.has(key)) {
                    locationMap.set(key, {
                        location: c.location,
                        cases: [],
                        caseIds: new Set(),
                        caseIdToSource: new Map(),
                        clues: [],
                        evidences: [],
                    });
                }
                const entry = locationMap.get(key);
                if (!entry.caseIds.has(c.id)) {
                    entry.caseIds.add(c.id);
                    entry.caseIdToSource.set(c.id, 'case');
                    entry.cases.push({
                        id: c.id,
                        caseNumber: c.caseNumber,
                        title: c.title,
                        caseType: c.caseType,
                        status: c.status,
                        source: 'case',
                    });
                }
            });
            clueLocations.forEach(clue => {
                const key = normalizeLocation(clue.location);
                if (!locationMap.has(key)) {
                    locationMap.set(key, {
                        location: clue.location,
                        cases: [],
                        caseIds: new Set(),
                        caseIdToSource: new Map(),
                        clues: [],
                        evidences: [],
                    });
                }
                const entry = locationMap.get(key);
                entry.clues.push({
                    id: clue.id,
                    caseId: clue.caseId,
                });
                if (clue.caseId && !entry.caseIds.has(clue.caseId)) {
                    entry.caseIds.add(clue.caseId);
                    entry.caseIdToSource.set(clue.caseId, 'clue');
                    allCaseIdsFromCluesAndEvidences.add(clue.caseId);
                }
            });
            evidenceLocations.forEach(evidence => {
                const key = normalizeLocation(evidence.location);
                if (!locationMap.has(key)) {
                    locationMap.set(key, {
                        location: evidence.location,
                        cases: [],
                        caseIds: new Set(),
                        caseIdToSource: new Map(),
                        clues: [],
                        evidences: [],
                    });
                }
                const entry = locationMap.get(key);
                entry.evidences.push({
                    id: evidence.id,
                    caseId: evidence.caseId,
                });
                if (evidence.caseId && !entry.caseIds.has(evidence.caseId)) {
                    entry.caseIds.add(evidence.caseId);
                    entry.caseIdToSource.set(evidence.caseId, 'evidence');
                    allCaseIdsFromCluesAndEvidences.add(evidence.caseId);
                }
            });
            if (allCaseIdsFromCluesAndEvidences.size > 0) {
                const missingCases = await prisma_1.default.case.findMany({
                    where: {
                        id: { in: Array.from(allCaseIdsFromCluesAndEvidences) },
                    },
                    select: {
                        id: true,
                        caseNumber: true,
                        title: true,
                        caseType: true,
                        status: true,
                    },
                });
                const missingCaseMap = new Map(missingCases.map(c => [c.id, c]));
                locationMap.forEach(entry => {
                    entry.caseIdToSource.forEach((source, caseId) => {
                        if (source !== 'case' && missingCaseMap.has(caseId)) {
                            const caseDetail = missingCaseMap.get(caseId);
                            entry.cases.push({
                                ...caseDetail,
                                source,
                            });
                        }
                    });
                });
            }
            result.locations = Array.from(locationMap.values())
                .filter(item => item.caseIds.size >= minCount)
                .map(item => ({
                location: item.location,
                caseCount: item.caseIds.size,
                cases: item.cases,
                clueCount: item.clues.length,
                evidenceCount: item.evidences.length,
            }))
                .sort((a, b) => b.caseCount - a.caseCount);
        }
        if (dims.includes('evidenceNumbers')) {
            const evidences = await prisma_1.default.evidence.findMany({
                include: {
                    case: {
                        select: {
                            id: true,
                            caseNumber: true,
                            title: true,
                            caseType: true,
                            status: true,
                        },
                    },
                    clue: {
                        select: {
                            id: true,
                            clueNumber: true,
                            title: true,
                        },
                    },
                },
            });
            const evidenceNumMap = new Map();
            evidences.forEach(e => {
                const key = e.hash || `${e.name}-${e.type}`;
                if (!evidenceNumMap.has(key)) {
                    evidenceNumMap.set(key, {
                        evidenceNumber: e.evidenceNumber,
                        displayKey: e.hash ? `[HASH] ${e.hash.substring(0, 16)}...` : `[名称] ${e.name}`,
                        evidences: [],
                        cases: [],
                        caseIds: new Set(),
                    });
                }
                const entry = evidenceNumMap.get(key);
                entry.evidences.push({
                    id: e.id,
                    evidenceNumber: e.evidenceNumber,
                    name: e.name,
                    type: e.type,
                    status: e.status,
                    hash: e.hash,
                    clue: e.clue,
                });
                if (e.case && !entry.caseIds.has(e.case.id)) {
                    entry.caseIds.add(e.case.id);
                    entry.cases.push(e.case);
                }
            });
            result.evidenceNumbers = Array.from(evidenceNumMap.values())
                .filter(item => item.caseIds.size >= minCount)
                .map(item => ({
                evidenceNumber: item.displayKey,
                evidenceCount: item.evidences.length,
                evidences: item.evidences,
                caseCount: item.caseIds.size,
                cases: item.cases,
            }))
                .sort((a, b) => b.caseCount - a.caseCount);
        }
        return result;
    });
    fastify.post('/create-case', async (request, reply) => {
        const { title, description, caseType, caseManager, department, priority, caseIds = [], personIds = [], clueIds = [], evidenceIds = [], } = request.body;
        const count = await prisma_1.default.case.count();
        const caseNumber = `ZA${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
        const caseItem = await prisma_1.default.case.create({
            data: {
                caseNumber,
                title,
                description: description || `由搜索结果一键创建的专案，汇总案件 ${caseIds.length} 个、人员 ${personIds.length} 人、线索 ${clueIds.length} 条、证据 ${evidenceIds.length} 份`,
                caseType: caseType || '专案',
                status: '已立案',
                priority: priority || '高',
                caseManager,
                department,
            },
        });
        const relatedCaseIds = new Set(caseIds);
        if (personIds.length > 0) {
            const existingCasePersons = await prisma_1.default.casePerson.findMany({
                where: { caseId: caseItem.id, personId: { in: personIds } },
                select: { personId: true },
            });
            const existingPersonIds = new Set(existingCasePersons.map(cp => cp.personId));
            const newPersonIds = personIds.filter(id => !existingPersonIds.has(id));
            if (newPersonIds.length > 0) {
                await prisma_1.default.casePerson.createMany({
                    data: newPersonIds.map(personId => ({
                        caseId: caseItem.id,
                        personId,
                        role: '待分配',
                    })),
                    skipDuplicates: true,
                });
            }
        }
        if (clueIds.length > 0) {
            const clues = await prisma_1.default.clue.findMany({
                where: { id: { in: clueIds } },
                select: { id: true, caseId: true },
            });
            const unassignedClueIds = clues.filter(c => !c.caseId).map(c => c.id);
            if (unassignedClueIds.length > 0) {
                await prisma_1.default.clue.updateMany({
                    where: { id: { in: unassignedClueIds } },
                    data: { caseId: caseItem.id },
                });
            }
            clues.forEach(c => {
                if (c.caseId && c.caseId !== caseItem.id) {
                    relatedCaseIds.add(c.caseId);
                }
            });
        }
        if (evidenceIds.length > 0) {
            const evidences = await prisma_1.default.evidence.findMany({
                where: { id: { in: evidenceIds } },
                select: { id: true, caseId: true },
            });
            const unassignedEvidenceIds = evidences.filter(e => !e.caseId).map(e => e.id);
            if (unassignedEvidenceIds.length > 0) {
                await prisma_1.default.evidence.updateMany({
                    where: { id: { in: unassignedEvidenceIds } },
                    data: { caseId: caseItem.id },
                });
            }
            evidences.forEach(e => {
                if (e.caseId && e.caseId !== caseItem.id) {
                    relatedCaseIds.add(e.caseId);
                }
            });
        }
        relatedCaseIds.delete(caseItem.id);
        if (relatedCaseIds.size > 0) {
            await prisma_1.default.caseRelation.createMany({
                data: Array.from(relatedCaseIds).map(targetCaseId => ({
                    sourceCaseId: caseItem.id,
                    targetCaseId,
                    relationType: '专题关联',
                    description: `专案「${title}」关联案件`,
                })),
                skipDuplicates: true,
            });
        }
        const result = await prisma_1.default.case.findUnique({
            where: { id: caseItem.id },
            include: {
                clues: true,
                evidences: true,
                casePersons: { include: { person: true } },
                sourceRelations: {
                    include: {
                        targetCase: {
                            select: {
                                id: true,
                                caseNumber: true,
                                title: true,
                                caseType: true,
                                status: true,
                                priority: true,
                                caseManager: true,
                                department: true,
                                createdAt: true,
                            },
                        },
                    },
                },
            },
        });
        return result;
    });
    fastify.get('/options', async () => {
        const tagCategories = ['案件类型', '线索来源', '关系角色', '自定义'];
        const tags = await prisma_1.default.tag.findMany({
            include: { _count: { select: { personTags: true } } },
            orderBy: { name: 'asc' },
        });
        return {
            caseTypes: ['专案', '刑事案件', '治安案件', '经济案件', '毒品案件', '网络犯罪', '其他'],
            caseStatuses: ['待立案', '已立案', '侦查中', '已移送起诉', '已判决', '已结案', '已撤销'],
            priorities: ['特急', '紧急', '高', '中', '低'],
            clueTypes: ['物证线索', '人证线索', '书证线索', '电子数据', '视频监控', '通讯记录', '其他'],
            clueSources: ['群众举报', '现场勘查', '证人陈述', '监控录像', '技术侦查', '其他'],
            clueStatuses: ['待核实', '核实中', '已核实', '已采用', '已排除'],
            credibilities: ['极高', '高', '中等', '低', '极低'],
            importances: ['关键', '重要', '一般', '次要'],
            personTypes: ['嫌疑人', '受害人', '证人', '关系人', '其他'],
            genders: ['男', '女', '未知'],
            relationTypes: ['亲属', '朋友', '同事', '同学', '上下级', '交易关系', '同伙', '其他'],
            personRoles: ['主犯', '从犯', '教唆犯', '胁从犯', '受害人', '目击证人', '报案人', '其他'],
            clueRelations: ['提供者', '目击者', '嫌疑人', '受害人', '其他'],
            evidenceTypes: ['物证', '书证', '证人证言', '被害人陈述', '犯罪嫌疑人供述', '鉴定意见', '勘验笔录', '视听资料', '电子数据', '其他'],
            fileTypes: ['image', 'video', 'audio', 'document', 'archive', 'other'],
            evidenceStatuses: ['待鉴定', '已鉴定', '已入库', '已移送', '已返还', '已销毁'],
            collectionMethods: ['现场勘查提取', '搜查扣押', '调取证据', '证人提供', '犯罪嫌疑人提交', '技术侦查获取', '其他'],
            departments: ['刑侦大队', '重案中队', '技术中队', '情报中队', '派出所', '其他'],
            tagCategories,
            tags,
        };
    });
}
