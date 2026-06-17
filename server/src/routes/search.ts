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
      fileType: getFileType(e.mimeType, e.fileName),
      fileUrl: e.filePath,
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

  fastify.get('/options', async () => {
    return {
      caseTypes: ['刑事案件', '治安案件', '经济案件', '毒品案件', '网络犯罪', '其他'],
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
      departments: ['刑侦大队', '重案中队', '技术中队', '情报中队', '派出所', '其他'],
    };
  });
}
