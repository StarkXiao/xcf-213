import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  TargetType,
  ActionType,
  logCreate,
  logUpdate,
  logDelete,
  logAssociate,
  logDisassociate,
  createOperationLog,
  getRequestMeta,
  extractOperator,
} from '../lib/operationLog';
import { checkEvidenceRules, checkLocationRules } from '../lib/ruleEngine';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

interface EvidenceQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  evidenceType?: string;
  fileType?: string;
  status?: string;
  caseId?: string;
  clueId?: string;
  batchId?: string;
}

interface EvidenceCreate {
  batchId?: string;
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

interface FileAnalysisItem {
  fileName: string;
  mimeType?: string;
  fileSize?: number;
}

interface BatchUploadMetadata {
  batchName?: string;
  description?: string;
  caseId?: string;
  clueId?: string;
  collectionMethod?: string;
  collector?: string;
  collectTime?: string;
  collectionTime?: string;
  location?: string;
  operator?: string;
  evidences?: string;
}

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

  const inferEvidenceType = (mimeType?: string, fileName?: string): string => {
    const fileType = getFileType(mimeType, fileName);
    const name = (fileName || '').toLowerCase();

    if (fileType === 'image') {
      if (/(现场|勘查|勘验|scene|site|survey)/i.test(name)) return '勘验笔录';
      if (/(伤情|鉴定|伤势|injury|identify)/i.test(name)) return '鉴定意见';
      if (/(证件|身份|身份证|id|card)/i.test(name)) return '书证';
      return '物证';
    }

    if (fileType === 'video') {
      if (/(监控|录像|surveillance|camera)/i.test(name)) return '视听资料';
      if (/(讯问|询问|笔录|interrogate|inquiry)/i.test(name)) return '视听资料';
      return '视听资料';
    }

    if (fileType === 'audio') {
      if (/(讯问|询问|通话|录音|interrogate|inquiry|record)/i.test(name)) return '犯罪嫌疑人供述';
      if (/(证人|证言|witness|testimony)/i.test(name)) return '证人证言';
      if (/(被害人|受害者|victim)/i.test(name)) return '被害人陈述';
      return '视听资料';
    }

    if (fileType === 'document') {
      if (/(鉴定|意见书|报告|identify|report)/i.test(name)) return '鉴定意见';
      if (/(勘验|笔录|现场勘查|inspection|survey)/i.test(name)) return '勘验笔录';
      if (/(证人|证言|witness)/i.test(name)) return '证人证言';
      if (/(供述|陈述|讯问|询问)/i.test(name)) {
        if (/(被害人|受害者|victim)/i.test(name)) return '被害人陈述';
        return '犯罪嫌疑人供述';
      }
      if (/(合同|协议|借条|收据|发票|单据|证明|contract|receipt|invoice)/i.test(name)) return '书证';
      return '书证';
    }

    if (fileType === 'archive') {
      if (/(电子|数据|聊天|日志|email|邮件|聊天记录|log)/i.test(name)) return '电子数据';
      return '其他';
    }

    if (/\.(db|sql|bak|log|eml|msg)$/i.test(name) || /(聊天|记录|日志|数据库|邮件|email|电子|数据)/i.test(name)) {
      return '电子数据';
    }

    return '物证';
  };

  const inferCollectionMethod = (mimeType?: string, fileName?: string): string => {
    const fileType = getFileType(mimeType, fileName);
    const name = (fileName || '').toLowerCase();

    if (/(扣押|seizure|seize)/i.test(name)) return '扣押';
    if (/(提取|extract)/i.test(name)) return '提取';
    if (/(调取|调取证据|obtain)/i.test(name)) return '调取证据';
    if (/(搜查|search)/i.test(name)) return '搜查';
    if (/(勘验|勘查|inspection|survey)/i.test(name)) return '现场勘查';
    if (/(鉴定|identify)/i.test(name)) return '鉴定';
    if (/(扣押|seizure|seize)/i.test(name)) return '扣押';

    if (fileType === 'image') {
      if (/(现场|scene|site)/i.test(name)) return '现场勘查';
      return '拍照固定';
    }
    if (fileType === 'video' || fileType === 'audio') return '录音录像';
    if (fileType === 'document') return '调取证据';
    if (fileType === 'archive') return '电子数据提取';

    return '扣押';
  };

  const generateEvidenceNumber = async (): Promise<string> => {
    const count = await prisma.evidence.count();
    return `ZJ${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
  };

  const generateBatchNumber = async (): Promise<string> => {
    const count = await prisma.evidenceBatch.count();
    return `PC${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
  };

  const computeFileHash = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
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
    const { page = 1, pageSize = 10, keyword, evidenceType, fileType, status, caseId, clueId, batchId } = request.query;
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
    if (batchId) where.batchId = batchId;

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

    const approvals = await prisma.approvalInstance.findMany({
      where: { evidenceId: request.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        records: { orderBy: { actionTime: 'asc' } },
        flow: { select: { id: true, name: true, flowNumber: true, nodes: { orderBy: { level: 'asc' } } } },
      },
    });

    const evidenceCheckoutApproval = approvals.find((a: any) => a.category === 'EVIDENCE_CHECKOUT');
    const evidenceDestroyApproval = approvals.find((a: any) => a.category === 'EVIDENCE_DESTROY');

    const transformed = transformEvidence(evidence);
    return {
      ...transformed,
      approvals: approvals.map((a: any) => ({
        ...a,
        categoryLabel: a.category === 'EVIDENCE_CHECKOUT' ? '证据出库' : a.category === 'EVIDENCE_DESTROY' ? '证据销毁' : a.category,
        statusLabel:
          a.status === 'PENDING' ? '待审批' :
          a.status === 'IN_PROGRESS' ? '审批中' :
          a.status === 'APPROVED' ? '已通过' :
          a.status === 'REJECTED' ? '已驳回' :
          a.status === 'ROLLED_BACK' ? '已回退' :
          a.status === 'CANCELLED' ? '已取消' : a.status,
      })),
      evidenceCheckoutApproval: evidenceCheckoutApproval ? {
        ...evidenceCheckoutApproval,
        categoryLabel: '证据出库',
        statusLabel:
          evidenceCheckoutApproval.status === 'PENDING' ? '待审批' :
          evidenceCheckoutApproval.status === 'IN_PROGRESS' ? '审批中' :
          evidenceCheckoutApproval.status === 'APPROVED' ? '已通过' :
          evidenceCheckoutApproval.status === 'REJECTED' ? '已驳回' :
          evidenceCheckoutApproval.status === 'ROLLED_BACK' ? '已回退' :
          evidenceCheckoutApproval.status === 'CANCELLED' ? '已取消' : evidenceCheckoutApproval.status,
      } : null,
      evidenceDestroyApproval: evidenceDestroyApproval ? {
        ...evidenceDestroyApproval,
        categoryLabel: '证据销毁',
        statusLabel:
          evidenceDestroyApproval.status === 'PENDING' ? '待审批' :
          evidenceDestroyApproval.status === 'IN_PROGRESS' ? '审批中' :
          evidenceDestroyApproval.status === 'APPROVED' ? '已通过' :
          evidenceDestroyApproval.status === 'REJECTED' ? '已驳回' :
          evidenceDestroyApproval.status === 'ROLLED_BACK' ? '已回退' :
          evidenceDestroyApproval.status === 'CANCELLED' ? '已取消' : evidenceDestroyApproval.status,
      } : null,
    };
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

    await logCreate(
      TargetType.EVIDENCE,
      evidence.id,
      `创建证据：${evidenceNumber} - ${evidence.name}`,
      request,
      evidence.collector,
      {
        id: evidence.id,
        evidenceNumber: evidence.evidenceNumber,
        name: evidence.name,
        type: evidence.type,
        status: evidence.status,
        collector: evidence.collector,
        caseId: evidence.caseId,
        clueId: evidence.clueId,
      }
    );

    if (evidence.caseId) {
      await logAssociate(
        TargetType.CASE,
        evidence.caseId,
        `新增关联证据：${evidenceNumber} - ${evidence.name}`,
        request,
        {
          evidenceId: evidence.id,
          evidenceNumber: evidence.evidenceNumber,
          evidenceName: evidence.name,
        }
      );
    }

    if (evidence.clueId) {
      await logAssociate(
        TargetType.CLUE,
        evidence.clueId,
        `新增关联证据：${evidenceNumber} - ${evidence.name}`,
        request,
        {
          evidenceId: evidence.id,
          evidenceNumber: evidence.evidenceNumber,
          evidenceName: evidence.name,
        }
      );
    }

    checkEvidenceRules(evidence.id, evidence.name, evidence.evidenceNumber, 'CREATE', {
      caseId: evidence.caseId || undefined,
      clueId: evidence.clueId || undefined,
      location: evidence.location || undefined,
    }).catch(() => {});

    if (evidence.location) {
      checkLocationRules(evidence.location, {
        type: 'EVIDENCE',
        id: evidence.id,
        name: evidence.name,
        number: evidence.evidenceNumber,
        caseId: evidence.caseId || undefined,
        clueId: evidence.clueId || undefined,
      }).catch(() => {});
    }

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

    await logCreate(
      TargetType.EVIDENCE,
      evidence.id,
      `上传证据：${evidenceNumber} - ${evidence.name}`,
      request,
      result.collector,
      {
        id: evidence.id,
        evidenceNumber: evidence.evidenceNumber,
        name: evidence.name,
        type: evidence.type,
        status: evidence.status,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        caseId: evidence.caseId,
        clueId: evidence.clueId,
      }
    );

    if (evidence.caseId) {
      await logAssociate(
        TargetType.CASE,
        evidence.caseId,
        `新增关联证据：${evidenceNumber} - ${evidence.name}`,
        request,
        {
          evidenceId: evidence.id,
          evidenceNumber: evidence.evidenceNumber,
          evidenceName: evidence.name,
        }
      );
    }

    if (evidence.clueId) {
      await logAssociate(
        TargetType.CLUE,
        evidence.clueId,
        `新增关联证据：${evidenceNumber} - ${evidence.name}`,
        request,
        {
          evidenceId: evidence.id,
          evidenceNumber: evidence.evidenceNumber,
          evidenceName: evidence.name,
        }
      );
    }

    checkEvidenceRules(evidence.id, evidence.name, evidence.evidenceNumber, 'CREATE', {
      caseId: evidence.caseId || undefined,
      clueId: evidence.clueId || undefined,
      location: evidence.location || undefined,
    }).catch(() => {});

    if (evidence.location) {
      checkLocationRules(evidence.location, {
        type: 'EVIDENCE',
        id: evidence.id,
        name: evidence.name,
        number: evidence.evidenceNumber,
        caseId: evidence.caseId || undefined,
        clueId: evidence.clueId || undefined,
      }).catch(() => {});
    }

    return transformEvidence(evidence);
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: EvidenceUpdate }>, reply) => {
    const data = request.body;
    try {
      const beforeEvidence = await prisma.evidence.findUnique({
        where: { id: request.params.id },
      });

      const evidence = await prisma.evidence.update({
        where: { id: request.params.id },
        data: {
          ...data,
          collectTime: data.collectionTime ? new Date(data.collectionTime) : data.collectTime ? new Date(data.collectTime) : undefined,
        },
      });

      await logUpdate(
        TargetType.EVIDENCE,
        evidence.id,
        `更新证据：${evidence.evidenceNumber} - ${evidence.name}`,
        request,
        {
          name: beforeEvidence?.name,
          type: beforeEvidence?.type,
          status: beforeEvidence?.status,
          description: beforeEvidence?.description,
          collector: beforeEvidence?.collector,
          caseId: beforeEvidence?.caseId,
          clueId: beforeEvidence?.clueId,
          location: beforeEvidence?.location,
        },
        {
          name: evidence.name,
          type: evidence.type,
          status: evidence.status,
          description: evidence.description,
          collector: evidence.collector,
          caseId: evidence.caseId,
          clueId: evidence.clueId,
          location: evidence.location,
        },
        evidence.collector
      );

      if (beforeEvidence?.caseId !== evidence.caseId) {
        if (beforeEvidence?.caseId) {
          await logDisassociate(
            TargetType.CASE,
            beforeEvidence.caseId,
            `移除关联证据：${beforeEvidence.evidenceNumber} - ${beforeEvidence.name}`,
            request,
            {
              evidenceId: evidence.id,
              evidenceNumber: evidence.evidenceNumber,
              evidenceName: evidence.name,
            }
          );
        }
        if (evidence.caseId) {
          await logAssociate(
            TargetType.CASE,
            evidence.caseId,
            `新增关联证据：${evidence.evidenceNumber} - ${evidence.name}`,
            request,
            {
              evidenceId: evidence.id,
              evidenceNumber: evidence.evidenceNumber,
              evidenceName: evidence.name,
            }
          );
        }
      }

      if (beforeEvidence?.clueId !== evidence.clueId) {
        if (beforeEvidence?.clueId) {
          await logDisassociate(
            TargetType.CLUE,
            beforeEvidence.clueId,
            `移除关联证据：${beforeEvidence.evidenceNumber} - ${beforeEvidence.name}`,
            request,
            {
              evidenceId: evidence.id,
              evidenceNumber: evidence.evidenceNumber,
              evidenceName: evidence.name,
            }
          );
        }
        if (evidence.clueId) {
          await logAssociate(
            TargetType.CLUE,
            evidence.clueId,
            `新增关联证据：${evidence.evidenceNumber} - ${evidence.name}`,
            request,
            {
              evidenceId: evidence.id,
              evidenceNumber: evidence.evidenceNumber,
              evidenceName: evidence.name,
            }
          );
        }
      }

      const statusChanged = beforeEvidence?.status !== evidence.status;
      checkEvidenceRules(evidence.id, evidence.name, evidence.evidenceNumber, statusChanged ? 'STATUS_CHANGE' : 'UPDATE', {
        caseId: evidence.caseId || undefined,
        clueId: evidence.clueId || undefined,
        location: evidence.location || undefined,
      }).catch(() => {});

      if (evidence.location && evidence.location !== beforeEvidence?.location) {
        checkLocationRules(evidence.location, {
          type: 'EVIDENCE',
          id: evidence.id,
          name: evidence.name,
          number: evidence.evidenceNumber,
          caseId: evidence.caseId || undefined,
          clueId: evidence.clueId || undefined,
        }).catch(() => {});
      }

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

      if (!evidence) {
        reply.status(404).send({ error: '证据不存在' });
        return;
      }

      if (evidence.filePath) {
        const localPath = path.join(__dirname, '..', '..', evidence.filePath);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }

      const caseId = evidence.caseId;
      const clueId = evidence.clueId;

      await prisma.evidence.delete({
        where: { id: request.params.id },
      });

      await logDelete(
        TargetType.EVIDENCE,
        request.params.id,
        `删除证据：${evidence.evidenceNumber} - ${evidence.name}`,
        request,
        {
          id: evidence.id,
          evidenceNumber: evidence.evidenceNumber,
          name: evidence.name,
          type: evidence.type,
          status: evidence.status,
          caseId: evidence.caseId,
          clueId: evidence.clueId,
        }
      );

      if (caseId) {
        await logDisassociate(
          TargetType.CASE,
          caseId,
          `移除关联证据：${evidence.evidenceNumber} - ${evidence.name}`,
          request,
          {
            evidenceId: evidence.id,
            evidenceNumber: evidence.evidenceNumber,
            evidenceName: evidence.name,
          }
        );
      }

      if (clueId) {
        await logDisassociate(
          TargetType.CLUE,
          clueId,
          `移除关联证据：${evidence.evidenceNumber} - ${evidence.name}`,
          request,
          {
            evidenceId: evidence.id,
            evidenceNumber: evidence.evidenceNumber,
            evidenceName: evidence.name,
          }
        );
      }

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

    const approvedApproval = await prisma.approvalInstance.findFirst({
      where: {
        evidenceId: request.params.id,
        category: 'EVIDENCE_CHECKOUT',
        status: 'APPROVED',
      },
    });
    if (!approvedApproval) {
      return reply.status(400).send({
        error: '证据出库（借阅）需先通过多级审批，请先发起证据出库审批流程。审批通过后方可执行出库操作。',
        code: 'APPROVAL_REQUIRED',
      });
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

      await createOperationLog({
        targetType: TargetType.EVIDENCE,
        targetId: request.params.id,
        action: ActionType.BORROW,
        description: `证据借阅：借阅人 ${data.borrower}，借阅原因：${data.borrowReason}`,
        operator: data.operator,
        beforeData,
        afterData: {
          borrowStatus: '借阅中',
          currentBorrower: data.borrower,
          borrowTime: new Date().toISOString(),
        },
        ...getRequestMeta(request),
      });

      checkEvidenceRules(request.params.id, updatedEvidence.name, updatedEvidence.evidenceNumber, 'BORROW', {
        caseId: data.caseId || evidence.caseId || undefined,
        clueId: data.clueId || evidence.clueId || undefined,
        location: evidence.location || undefined,
      }).catch(() => {});

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

      await createOperationLog({
        targetType: TargetType.EVIDENCE,
        targetId: request.params.id,
        action: ActionType.RETURN,
        description: `证据归还：${data.returnNote ? '归还备注：' + data.returnNote : '已归还'}`,
        operator: data.returnOperator,
        beforeData,
        afterData: {
          borrowStatus: '已归还',
          currentBorrower: null,
          borrowTime: null,
        },
        ...getRequestMeta(request),
      });

      checkEvidenceRules(request.params.id, evidence.name, evidence.evidenceNumber, 'RETURN', {
        caseId: evidence.caseId || undefined,
        clueId: evidence.clueId || undefined,
        location: evidence.location || undefined,
      }).catch(() => {});

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

  fastify.post('/analyze', async (request: FastifyRequest<{ Body: { files: FileAnalysisItem[] } }>, reply) => {
    const { files } = request.body;

    if (!files || !Array.isArray(files)) {
      reply.status(400).send({ error: '请提供文件列表' });
      return;
    }

    const analyzed = files.map((file) => {
      const fileType = getFileType(file.mimeType, file.fileName);
      const evidenceType = inferEvidenceType(file.mimeType, file.fileName);
      const collectionMethod = inferCollectionMethod(file.mimeType, file.fileName);
      const nameWithoutExt = path.basename(file.fileName, path.extname(file.fileName));

      return {
        fileName: file.fileName,
        fileType,
        evidenceType,
        collectionMethod,
        suggestedName: nameWithoutExt,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
      };
    });

    return { items: analyzed };
  });

  fastify.post('/upload-batch', async (request, reply) => {
    const parts = request.parts();
    const files: Array<{
      fileName: string;
      storedName: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
      hash?: string;
    }> = [];
    const metadata: any = {};

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

        try {
          const hash = await computeFileHash(filePath);
          files.push({
            fileName: part.filename,
            storedName: fileName,
            filePath: `/uploads/${fileName}`,
            fileSize,
            mimeType: part.mimetype,
            hash,
          });
        } catch {
          files.push({
            fileName: part.filename,
            storedName: fileName,
            filePath: `/uploads/${fileName}`,
            fileSize,
            mimeType: part.mimetype,
          });
        }
      } else {
        metadata[part.fieldname] = part.value;
      }
    }

    let evidenceOverrides: any[] = [];
    if (metadata.evidences) {
      try {
        evidenceOverrides = JSON.parse(metadata.evidences);
      } catch {
        evidenceOverrides = [];
      }
    }

    const batchNumber = await generateBatchNumber();
    const batch = await prisma.evidenceBatch.create({
      data: {
        batchNumber,
        name: metadata.batchName || `${batchNumber} 批次入库`,
        description: metadata.description,
        caseId: metadata.caseId || null,
        clueId: metadata.clueId || null,
        collectionMethod: metadata.collectionMethod || null,
        collector: metadata.collector || null,
        collectTime: metadata.collectionTime || metadata.collectTime ? new Date(metadata.collectionTime || metadata.collectTime) : null,
        location: metadata.location || null,
        status: '已入库',
        totalCount: files.length,
        operator: metadata.operator || null,
      },
    });

    const createdEvidences: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const override = evidenceOverrides[i] || {};

      try {
        const evidenceNumber = await generateEvidenceNumber();
        const inferredType = inferEvidenceType(file.mimeType, file.fileName);
        const inferredMethod = inferCollectionMethod(file.mimeType, file.fileName);
        const nameWithoutExt = path.basename(file.fileName, path.extname(file.fileName));

        const evidence = await prisma.evidence.create({
          data: {
            evidenceNumber,
            batchId: batch.id,
            name: override.name || nameWithoutExt || file.fileName,
            description: override.description || metadata.description || null,
            type: override.evidenceType || inferredType,
            filePath: file.filePath,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            hash: file.hash || null,
            collectionMethod: override.collectionMethod || metadata.collectionMethod || inferredMethod || null,
            collector: override.collector || metadata.collector || null,
            collectTime: metadata.collectionTime || metadata.collectTime ? new Date(metadata.collectionTime || metadata.collectTime) : null,
            location: override.location || metadata.location || null,
            caseId: override.caseId || metadata.caseId || null,
            clueId: override.clueId || metadata.clueId || null,
            status: '已入库',
            note: override.note || null,
          },
        });

        createdEvidences.push(transformEvidence(evidence));
        successCount++;
      } catch (err) {
        failCount++;
        createdEvidences.push({
          fileName: file.fileName,
          error: err instanceof Error ? err.message : '创建失败',
          success: false,
        });
      }
    }

    await prisma.evidenceBatch.update({
      where: { id: batch.id },
      data: { successCount, failCount },
    });

    await createOperationLog({
      targetType: TargetType.EVIDENCE_BATCH,
      targetId: batch.id,
      action: ActionType.BATCH_UPLOAD,
      description: `批量上传证据：${batch.batchNumber} - ${batch.name}，共${files.length}份，成功${successCount}份，失败${failCount}份`,
      operator: metadata.operator,
      afterData: {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        batchName: batch.name,
        totalCount: files.length,
        successCount,
        failCount,
        caseId: batch.caseId,
        clueId: batch.clueId,
      },
      ...getRequestMeta(request),
    });

    if (batch.caseId) {
      await logAssociate(
        TargetType.CASE,
        batch.caseId,
        `批量上传证据：${batch.batchNumber}，共${successCount}份证据`,
        request,
        {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          evidenceCount: successCount,
        }
      );
    }

    if (batch.clueId) {
      await logAssociate(
        TargetType.CLUE,
        batch.clueId,
        `批量上传证据：${batch.batchNumber}，共${successCount}份证据`,
        request,
        {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          evidenceCount: successCount,
        }
      );
    }

    return {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        name: batch.name,
        totalCount: batch.totalCount,
        successCount,
        failCount,
      },
      evidences: createdEvidences,
    };
  });

  fastify.get('/batches', async (request: FastifyRequest<{ Querystring: { page?: number; pageSize?: number; caseId?: string; keyword?: string } }>, reply) => {
    const { page = 1, pageSize = 10, caseId, keyword } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (keyword) {
      where.OR = [
        { batchNumber: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.evidenceBatch.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
          _count: { select: { evidences: true } },
        },
      }),
      prisma.evidenceBatch.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/batches/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const batch = await prisma.evidenceBatch.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
        evidences: true,
      },
    });

    if (!batch) {
      reply.status(404).send({ error: '批次不存在' });
      return;
    }

    return {
      ...batch,
      evidences: batch.evidences.map((e: any) => transformEvidence(e)),
    };
  });

  fastify.delete('/batches/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const batch = await prisma.evidenceBatch.findUnique({
        where: { id: request.params.id },
        include: { evidences: true },
      });

      if (!batch) {
        reply.status(404).send({ error: '批次不存在' });
        return;
      }

      const caseId = batch.caseId;
      const clueId = batch.clueId;
      const evidenceIds = batch.evidences.map(e => e.id);

      for (const evidence of batch.evidences) {
        if (evidence.filePath) {
          const localPath = path.join(__dirname, '..', '..', evidence.filePath);
          if (fs.existsSync(localPath)) {
            try { fs.unlinkSync(localPath); } catch {}
          }
        }
      }

      await prisma.evidenceBatch.delete({
        where: { id: request.params.id },
      });

      await logDelete(
        TargetType.EVIDENCE_BATCH,
        request.params.id,
        `删除证据批次：${batch.batchNumber} - ${batch.name}，共${batch.evidences.length}份证据`,
        request,
        {
          id: batch.id,
          batchNumber: batch.batchNumber,
          name: batch.name,
          evidenceCount: batch.evidences.length,
          caseId: batch.caseId,
          clueId: batch.clueId,
        }
      );

      if (caseId) {
        await logDisassociate(
          TargetType.CASE,
          caseId,
          `删除证据批次：${batch.batchNumber}，共${batch.evidences.length}份证据`,
          request,
          {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            evidenceCount: batch.evidences.length,
          }
        );
      }

      if (clueId) {
        await logDisassociate(
          TargetType.CLUE,
          clueId,
          `删除证据批次：${batch.batchNumber}，共${batch.evidences.length}份证据`,
          request,
          {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            evidenceCount: batch.evidences.length,
          }
        );
      }

      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: '删除批次失败' });
    }
  });
}
