import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface SearchQuery {
  keyword: string;
  type?: string;
  limit?: number;
}

interface AdvancedSearchQuery {
  keyword?: string;
  caseType?: string | string[];
  status?: string | string[];
  priority?: string | string[];
  clueType?: string | string[];
  source?: string | string[];
  credibility?: string | string[];
  importance?: string | string[];
  personType?: string | string[];
  gender?: string;
  evidenceType?: string | string[];
  fileType?: string | string[];
  caseManager?: string;
  location?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  occurStartDate?: string;
  occurEndDate?: string;
}

interface CrossCaseDedupeQuery {
  dimensions?: string | string[];
  minCaseCount?: number;
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply) => {
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

    const result: any = {};

    if (!type || type === 'case') {
      result.cases = await prisma.case.findMany({
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
      result.clues = await prisma.clue.findMany({
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
      result.persons = await prisma.person.findMany({
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
      result.evidences = await prisma.evidence.findMany({
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

  const getFileType = (mimeType?: string, fileName?: string): string => {
    if (!mimeType && !fileName) return 'other';
    const mime = mimeType || '';
    const name = fileName || '';
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|avi|mov|mkv|flv|wmv)$/i.test(name)) return 'video';
    if (mime.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg)$/i.test(name)) return 'audio';
    if (/\.(doc|docx|pdf|txt|xls|xlsx|ppt|pptx)$/i.test(name) || mime.includes('pdf') || mime.includes('msword') || mime.includes('spreadsheet')) return 'document';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive';
    return 'other';
  };

  const toArray = (val?: string | string[]): string[] | undefined => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : [val];
  };

  fastify.get('/advanced', async (request: FastifyRequest<{ Querystring: AdvancedSearchQuery }>, reply) => {
    const {
      keyword,
      caseType,
      status,
      priority,
      clueType,
      source,
      credibility,
      importance,
      personType,
      gender,
      evidenceType,
      fileType,
      caseManager,
      location,
      department,
      startDate,
      endDate,
      occurStartDate,
      occurEndDate,
    } = request.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const occurDateFilter: any = {};
    if (occurStartDate) occurDateFilter.gte = new Date(occurStartDate);
    if (occurEndDate) occurDateFilter.lte = new Date(occurEndDate);

    const caseWhere: any = {};
    if (keyword) {
      caseWhere.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { caseNumber: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { summary: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const caseTypes = toArray(caseType);
    if (caseTypes) caseWhere.caseType = { in: caseTypes };
    const statuses = toArray(status);
    if (statuses) caseWhere.status = { in: statuses };
    const priorities = toArray(priority);
    if (priorities) caseWhere.priority = { in: priorities };
    if (caseManager) caseWhere.caseManager = { contains: caseManager, mode: 'insensitive' };
    if (location) caseWhere.location = { contains: location, mode: 'insensitive' };
    if (department) caseWhere.department = { contains: department, mode: 'insensitive' };
    if (Object.keys(dateFilter).length) caseWhere.createdAt = dateFilter;
    if (Object.keys(occurDateFilter).length) caseWhere.occurTime = occurDateFilter;

    const clueWhere: any = {};
    if (keyword) {
      clueWhere.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { clueNumber: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const clueTypes = toArray(clueType);
    if (clueTypes) clueWhere.clueType = { in: clueTypes };
    const sources = toArray(source);
    if (sources) clueWhere.source = { in: sources };
    const credibilities = toArray(credibility);
    if (credibilities) clueWhere.credibility = { in: credibilities };
    const importances = toArray(importance);
    if (importances) clueWhere.importance = { in: importances };
    if (Object.keys(dateFilter).length) clueWhere.createdAt = dateFilter;

    const personWhere: any = {};
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
    if (personTypes) personWhere.personType = { in: personTypes };
    if (gender) personWhere.gender = gender;
    if (Object.keys(dateFilter).length) personWhere.createdAt = dateFilter;

    const evidenceWhere: any = {};
    if (keyword) {
      evidenceWhere.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { evidenceNumber: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const evidenceTypes = toArray(evidenceType);
    if (evidenceTypes) evidenceWhere.type = { in: evidenceTypes };
    if (Object.keys(dateFilter).length) evidenceWhere.createdAt = dateFilter;

    const [cases, clues, persons, evidences] = await Promise.all([
      prisma.case.findMany({
        where: caseWhere,
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clue.findMany({
        where: clueWhere,
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
      }),
      prisma.person.findMany({
        where: personWhere,
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.evidence.findMany({
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
      prisma.case.count(),
      prisma.clue.count(),
      prisma.person.count(),
      prisma.evidence.count(),
    ]);

    const caseStats = await prisma.case.groupBy({
      by: ['status'],
      _count: true,
    });

    const clueStats = await prisma.clue.groupBy({
      by: ['status'],
      _count: true,
    });

    const recentCases = await prisma.case.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, caseNumber: true, title: true, status: true, createdAt: true },
    });

    const recentClues = await prisma.clue.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, clueNumber: true, title: true, status: true, createdAt: true },
    });

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
    };
  });

  fastify.get('/cross-case-dedupe', async (request: FastifyRequest<{ Querystring: CrossCaseDedupeQuery }>, reply) => {
    const { dimensions, minCaseCount = 2 } = request.query;
    const dims = toArray(dimensions) || ['persons', 'phones', 'locations', 'evidenceNumbers'];
    const minCount = Number(minCaseCount) || 2;

    const result: any = {};

    if (dims.includes('persons')) {
      const casePersons = await prisma.casePerson.findMany({
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

      const personCaseMap = new Map<string, any>();
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
      const personsWithPhone = await prisma.person.findMany({
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

      const phoneMap = new Map<string, any>();
      personsWithPhone.forEach(person => {
        const phone = person.phone!;
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
      const caseLocations = await prisma.case.findMany({
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

      const clueLocations = await prisma.clue.findMany({
        where: { location: { not: null } },
        select: {
          id: true,
          caseId: true,
          location: true,
        },
      });

      const evidenceLocations = await prisma.evidence.findMany({
        where: { location: { not: null } },
        select: {
          id: true,
          caseId: true,
          location: true,
        },
      });

      const locationMap = new Map<string, any>();
      const allCaseIdsFromCluesAndEvidences = new Set<string>();

      const normalizeLocation = (loc: string): string => {
        return loc.trim().toLowerCase();
      };

      caseLocations.forEach(c => {
        const key = normalizeLocation(c.location!);
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
        const key = normalizeLocation(clue.location!);
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
        const key = normalizeLocation(evidence.location!);
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
        const missingCases = await prisma.case.findMany({
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
          entry.caseIdToSource.forEach((source: string, caseId: string) => {
            if (source !== 'case' && missingCaseMap.has(caseId)) {
              const caseDetail = missingCaseMap.get(caseId)!;
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
      const evidences = await prisma.evidence.findMany({
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

      const evidenceNumMap = new Map<string, any>();
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

  fastify.post('/create-case', async (request: FastifyRequest<{
    Body: {
      title: string;
      description?: string;
      caseType?: string;
      caseManager?: string;
      department?: string;
      priority?: string;
      caseIds?: string[];
      personIds?: string[];
      clueIds?: string[];
      evidenceIds?: string[];
    };
  }>, reply) => {
    const {
      title,
      description,
      caseType,
      caseManager,
      department,
      priority,
      caseIds = [],
      personIds = [],
      clueIds = [],
      evidenceIds = [],
    } = request.body;

    const count = await prisma.case.count();
    const caseNumber = `ZA${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const caseItem = await prisma.case.create({
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

    const relatedCaseIds = new Set<string>(caseIds);

    if (personIds.length > 0) {
      const existingCasePersons = await prisma.casePerson.findMany({
        where: { caseId: caseItem.id, personId: { in: personIds } },
        select: { personId: true },
      });
      const existingPersonIds = new Set(existingCasePersons.map(cp => cp.personId));
      const newPersonIds = personIds.filter(id => !existingPersonIds.has(id));

      if (newPersonIds.length > 0) {
        await prisma.casePerson.createMany({
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
      const clues = await prisma.clue.findMany({
        where: { id: { in: clueIds } },
        select: { id: true, caseId: true },
      });

      const unassignedClueIds = clues.filter(c => !c.caseId).map(c => c.id);
      if (unassignedClueIds.length > 0) {
        await prisma.clue.updateMany({
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
      const evidences = await prisma.evidence.findMany({
        where: { id: { in: evidenceIds } },
        select: { id: true, caseId: true },
      });

      const unassignedEvidenceIds = evidences.filter(e => !e.caseId).map(e => e.id);
      if (unassignedEvidenceIds.length > 0) {
        await prisma.evidence.updateMany({
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
      await prisma.caseRelation.createMany({
        data: Array.from(relatedCaseIds).map(targetCaseId => ({
          sourceCaseId: caseItem.id,
          targetCaseId,
          relationType: '专题关联',
          description: `专案「${title}」关联案件`,
        })),
        skipDuplicates: true,
      });
    }

    const result = await prisma.case.findUnique({
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
    };
  });
}
