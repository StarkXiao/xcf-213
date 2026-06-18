import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

interface EvidenceQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  evidenceType?: string;
  fileType?: string;
  status?: string;
  caseId?: string;
  clueId?: string;
}

interface EvidenceCreate {
  caseId?: string;
  clueId?: string;
  name: string;
  description?: string;
  type: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  hash?: string;
  collectionMethod?: string;
  collector?: string;
  collectTime?: string;
  collectionTime?: string;
  location?: string;
  status: string;
  note?: string;
}

interface EvidenceUpdate extends Partial<EvidenceCreate> {}

interface BorrowCreate {
  borrower: string;
  borrowerDepartment?: string;
  borrowReason: string;
  expectedReturnTime?: string;
  operator?: string;
  caseId?: string;
  clueId?: string;
}

interface ReturnConfirm {
  returnNote?: string;
  returnOperator?: string;
}

interface OperationLogQuery {
  page?: number;
  pageSize?: number;
  targetType?: string;
  action?: string;
  operator?: string;
  startDate?: string;
  endDate?: string;
}

const createOperationLog = async (
  targetType: string,
  targetId: string,
  action: string,
  description?: string,
  operator?: string,
  beforeData?: any,
  afterData?: any,
  ip?: string,
  userAgent?: string
) => {
  try {
    await prisma.operationLog.create({
      data: {
        targetType,
        targetId,
        action,
        description,
        operator,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error('创建操作日志失败:', error);
  }
};

export default async function (fastify: FastifyInstance) {
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

  const transformEvidence = (evidence: any) => ({
    ...evidence,
    evidenceType: evidence.type,
    fileType: getFileType(evidence.mimeType, evidence.fileName),
    fileUrl: evidence.filePath,
    originalName: evidence.fileName,
    collectionTime: evidence.collectTime,
  });

  fastify.get('/', async (request: FastifyRequest<{ Querystring: EvidenceQuery }>, reply) => {
    const { page = 1, pageSize = 10, keyword, evidenceType, fileType, status, caseId, clueId } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { evidenceNumber: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (evidenceType) where.type = evidenceType;
    if (status) where.status = status;
    if (caseId) where.caseId = caseId;
    if (clueId) where.clueId = clueId;

    const [items, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      }),
      prisma.evidence.count({ where }),
    ]);

    const transformedItems = items.map(item => transformEvidence(item));

    if (fileType) {
      const filtered = transformedItems.filter(item => item.fileType === fileType);
      return { items: filtered, total: filtered.length, page, pageSize };
    }

    return { items: transformedItems, total, page, pageSize };
  });

  fastify.get('/cases', async () => {
    return prisma.case.findMany({
      select: { id: true, caseNumber: true, title: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.get('/cases/:caseId/clues', async (request: FastifyRequest<{ Params: { caseId: string } }>) => {
    return prisma.clue.findMany({
      where: { caseId: request.params.caseId },
      select: { id: true, clueNumber: true, title: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const evidence = await prisma.evidence.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
      },
    });

    if (!evidence) {
      reply.status(404).send({ error: '证据不存在' });
      return;
    }

    return transformEvidence(evidence);
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: EvidenceCreate }>, reply) => {
    const data = request.body;
    const count = await prisma.evidence.count();
    const evidenceNumber = `ZJ${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const evidence = await prisma.evidence.create({
      data: {
        ...data,
        evidenceNumber,
        collectionMethod: data.collectionMethod,
        collectTime: data.collectionTime ? new Date(data.collectionTime) : data.collectTime ? new Date(data.collectTime) : null,
      },
    });

    return transformEvidence(evidence);
  });

  fastify.post('/upload', async (request, reply) => {
    const parts = request.parts();
    const result: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        const fileId = uuidv4();
        const ext = path.extname(part.filename);
        const fileName = `${fileId}${ext}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        const fileStream = fs.createWriteStream(filePath);
        let fileSize = 0;

        for await (const chunk of part.file) {
          fileSize += chunk.length;
          fileStream.write(chunk);
        }

        fileStream.end();

        result.fileName = part.filename;
        result.storedName = fileName;
        result.filePath = `/uploads/${fileName}`;
        result.fileSize = fileSize;
        result.mimeType = part.mimetype;
      } else {
        result[part.fieldname] = part.value;
      }
    }

    const count = await prisma.evidence.count();
    const evidenceNumber = `ZJ${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const evidence = await prisma.evidence.create({
      data: {
        evidenceNumber,
        name: result.name || result.fileName,
        description: result.description,
        type: result.evidenceType || result.type || '其他',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        caseId: result.caseId,
        clueId: result.clueId,
        collectionMethod: result.collectionMethod,
        collector: result.collector,
        collectTime: result.collectionTime ? new Date(result.collectionTime) : result.collectTime ? new Date(result.collectTime) : null,
        location: result.location,
        status: result.status || '已入库',
        note: result.note,
      },
    });

    return transformEvidence(evidence);
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: EvidenceUpdate }>, reply) => {
    const data = request.body;
    try {
      const evidence = await prisma.evidence.update({
        where: { id: request.params.id },
        data: {
          ...data,
          collectTime: data.collectionTime ? new Date(data.collectionTime) : data.collectTime ? new Date(data.collectTime) : undefined,
        },
      });
      return transformEvidence(evidence);
    } catch (error) {
      reply.status(404).send({ error: '证据不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const evidence = await prisma.evidence.findUnique({
        where: { id: request.params.id },
      });

      if (evidence && evidence.filePath) {
        const localPath = path.join(__dirname, '..', '..', evidence.filePath);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }

      await prisma.evidence.delete({
        where: { id: request.params.id },
      });

      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '证据不存在' });
    }
  });

  fastify.get('/:id/download', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const evidence = await prisma.evidence.findUnique({
      where: { id: request.params.id },
    });

    if (!evidence) {
      reply.status(404).send({ error: '证据不存在' });
      return;
    }

    const localPath = path.join(__dirname, '..', '..', evidence.filePath);
    if (!fs.existsSync(localPath)) {
      reply.status(404).send({ error: '文件不存在' });
      return;
    }

    const stat = fs.statSync(localPath);
    const stream = fs.createReadStream(localPath);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.fileName)}"`);
    reply.header('Content-Type', evidence.mimeType || 'application/octet-stream');
    reply.header('Content-Length', stat.size);

    return reply.send(stream);
  });

  fastify.get('/:id/borrow-records', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; pageSize?: number } }>, reply) => {
    const { page = 1, pageSize = 10 } = request.query;
    const skip = (page - 1) * pageSize;

    const evidence = await prisma.evidence.findUnique({
      where: { id: request.params.id },
    });

    if (!evidence) {
      reply.status(404).send({ error: '证据不存在' });
      return;
    }

    const [items, total] = await Promise.all([
      prisma.evidenceBorrow.findMany({
        where: { evidenceId: request.params.id },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      }),
      prisma.evidenceBorrow.count({ where: { evidenceId: request.params.id } }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.post('/:id/borrow', async (request: FastifyRequest<{ Params: { id: string }; Body: BorrowCreate }>, reply) => {
    const evidence = await prisma.evidence.findUnique({
      where: { id: request.params.id },
    });

    if (!evidence) {
      reply.status(404).send({ error: '证据不存在' });
      return;
    }

    if (evidence.borrowStatus === '借阅中') {
      reply.status(400).send({ error: '该证据当前已被借阅，无法重复借阅' });
      return;
    }

    const data = request.body;

    try {
      const beforeData = {
        borrowStatus: evidence.borrowStatus,
        currentBorrower: evidence.currentBorrower,
        borrowTime: evidence.borrowTime,
      };

      const borrowRecord = await prisma.evidenceBorrow.create({
        data: {
          evidenceId: request.params.id,
          caseId: data.caseId || evidence.caseId,
          clueId: data.clueId || evidence.clueId,
          borrower: data.borrower,
          borrowerDepartment: data.borrowerDepartment,
          borrowReason: data.borrowReason,
          expectedReturnTime: data.expectedReturnTime ? new Date(data.expectedReturnTime) : null,
          operator: data.operator,
        },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      const updatedEvidence = await prisma.evidence.update({
        where: { id: request.params.id },
        data: {
          borrowStatus: '借阅中',
          currentBorrower: data.borrower,
          borrowTime: new Date(),
        },
      });

      await createOperationLog(
        'evidence',
        request.params.id,
        'borrow',
        `证据借阅：借阅人 ${data.borrower}，借阅原因：${data.borrowReason}`,
        data.operator,
        beforeData,
        {
          borrowStatus: '借阅中',
          currentBorrower: data.borrower,
          borrowTime: new Date().toISOString(),
        },
        request.ip,
        request.headers['user-agent']
      );

      return borrowRecord;
    } catch (error) {
      reply.status(400).send({ error: '借阅登记失败' });
    }
  });

  fastify.put('/:id/return', async (request: FastifyRequest<{ Params: { id: string }; Body: ReturnConfirm }>, reply) => {
    const evidence = await prisma.evidence.findUnique({
      where: { id: request.params.id },
    });

    if (!evidence) {
      reply.status(404).send({ error: '证据不存在' });
      return;
    }

    if (evidence.borrowStatus !== '借阅中') {
      reply.status(400).send({ error: '该证据当前未处于借阅状态，无法归还' });
      return;
    }

    const data = request.body;

    try {
      const beforeData = {
        borrowStatus: evidence.borrowStatus,
        currentBorrower: evidence.currentBorrower,
        borrowTime: evidence.borrowTime,
      };

      const activeBorrow = await prisma.evidenceBorrow.findFirst({
        where: {
          evidenceId: request.params.id,
          status: '借阅中',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeBorrow) {
        reply.status(404).send({ error: '未找到有效的借阅记录' });
        return;
      }

      const borrowRecord = await prisma.evidenceBorrow.update({
        where: { id: activeBorrow.id },
        data: {
          status: '已归还',
          actualReturnTime: new Date(),
          returnNote: data.returnNote,
          returnOperator: data.returnOperator,
        },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      await prisma.evidence.update({
        where: { id: request.params.id },
        data: {
          borrowStatus: '已归还',
          currentBorrower: null,
          borrowTime: null,
        },
      });

      await createOperationLog(
        'evidence',
        request.params.id,
        'return',
        `证据归还：${data.returnNote ? '归还备注：' + data.returnNote : '已归还'}`,
        data.returnOperator,
        beforeData,
        {
          borrowStatus: '已归还',
          currentBorrower: null,
          borrowTime: null,
        },
        request.ip,
        request.headers['user-agent']
      );

      return borrowRecord;
    } catch (error) {
      reply.status(400).send({ error: '归还确认失败' });
    }
  });

  fastify.get('/borrow-records/all', async (request: FastifyRequest<{ Querystring: { page?: number; pageSize?: number; status?: string; borrower?: string; caseId?: string; clueId?: string } }>, reply) => {
    const { page = 1, pageSize = 10, status, borrower, caseId, clueId } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (borrower) where.borrower = { contains: borrower, mode: 'insensitive' };
    if (caseId) where.caseId = caseId;
    if (clueId) where.clueId = clueId;

    const [items, total] = await Promise.all([
      prisma.evidenceBorrow.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          evidence: { select: { id: true, evidenceNumber: true, name: true, type: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      }),
      prisma.evidenceBorrow.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/:id/operation-logs', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; pageSize?: number } }>, reply) => {
    const { page = 1, pageSize = 20 } = request.query;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.operationLog.findMany({
        where: {
          targetType: 'evidence',
          targetId: request.params.id,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.operationLog.count({
        where: {
          targetType: 'evidence',
          targetId: request.params.id,
        },
      }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/operation-logs/all', async (request: FastifyRequest<{ Querystring: OperationLogQuery }>, reply) => {
    const { page = 1, pageSize = 20, targetType, action, operator, startDate, endDate } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (targetType) where.targetType = targetType;
    if (action) where.action = action;
    if (operator) where.operator = { contains: operator, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.operationLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.operationLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });
}
