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
}
