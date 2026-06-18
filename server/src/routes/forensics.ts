import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const FORENSIC_DIR = path.join(UPLOAD_DIR, 'forensic');

if (!fs.existsSync(FORENSIC_DIR)) {
  fs.mkdirSync(FORENSIC_DIR, { recursive: true });
}

interface ForensicQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  fileType?: string;
  integrityStatus?: string;
  caseId?: string;
  clueId?: string;
  batchId?: string;
  acquisitionMethod?: string;
  startDate?: string;
  endDate?: string;
}

interface ForensicBatchCreate {
  name: string;
  description?: string;
  caseId?: string;
  clueId?: string;
  acquisitionMethod: string;
  acquirer?: string;
  acquisitionTime?: string;
  acquisitionLocation?: string;
  deviceInfo?: string;
  storageDevice?: string;
  writeBlockerUsed?: boolean;
  chainOfCustodyNote?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface ForensicFileCreate {
  batchId?: string;
  caseId?: string;
  clueId?: string;
  originalPath?: string;
  fileName: string;
  fileExtension?: string;
  fileType?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  md5Hash?: string;
  sha1Hash?: string;
  sha256Hash?: string;
  metadata?: string;
  acquisitionMethod?: string;
  acquirer?: string;
  acquisitionTime?: string;
  acquisitionLocation?: string;
  sourceDevice?: string;
  fileCreatedTime?: string;
  fileModifiedTime?: string;
  fileAccessedTime?: string;
  description?: string;
  analysisNotes?: string;
  tags?: string;
  operatorId?: string;
  operatorName?: string;
}

interface ForensicFileUpdate {
  description?: string;
  analysisNotes?: string;
  tags?: string;
  caseId?: string;
  clueId?: string;
}

interface HashVerifyRequest {
  forensicFileIds: string[];
}

interface BindRelationRequest {
  forensicFileId: string;
  caseId?: string;
  clueId?: string;
  relationType?: string;
  description?: string;
}

interface UnbindRelationRequest {
  forensicFileId: string;
  caseId?: string;
  clueId?: string;
}

const detectForensicFileType = (fileName: string, mimeType?: string): string => {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (/\.(db|sql|sqlite|mdb|accdb|dbf)$/i.test(name) || mime.includes('database')) return 'DATABASE';
  if (/\.log$/i.test(name) || /log|日志/.test(name)) return 'LOG';
  if (/\.(eml|msg|pst|ost)$/i.test(name) || mime.includes('email') || /邮件|email/.test(name)) return 'EMAIL';
  if (/\.(jpg|jpeg|png|gif|bmp|webp|tiff|heic)$/i.test(name) || mime.startsWith('image/')) return 'IMAGE';
  if (/\.(mp4|avi|mov|mkv|flv|wmv|mts|3gp)$/i.test(name) || mime.startsWith('video/')) return 'VIDEO';
  if (/\.(mp3|wav|flac|aac|ogg|wma|amr)$/i.test(name) || mime.startsWith('audio/')) return 'AUDIO';
  if (/\.(doc|docx|pdf|txt|xls|xlsx|ppt|pptx|rtf|odt|ods|odp)$/i.test(name) || mime.includes('pdf') || mime.includes('msword') || mime.includes('spreadsheet')) return 'DOCUMENT';
  if (/\.(zip|rar|7z|tar|gz|bz2|iso)$/i.test(name)) return 'ARCHIVE';
  if (/\.(js|ts|py|java|cpp|c|h|cs|go|rs|php|rb|html|css|sh|bat|ps1)$/i.test(name) || mime.includes('javascript') || mime.includes('text/html')) return 'CODE';
  if (/\.(dll|exe|sys|bin|dat|reg|evt|evtx)$/i.test(name) || /系统|system|registry|注册表/i.test(name)) return 'SYSTEM_FILE';

  return 'OTHER';
};

const generateForensicNumber = async (): Promise<string> => {
  const count = await prisma.forensicFile.count();
  return `DZQZ${new Date().getFullYear()}${String(count + 1).padStart(8, '0')}`;
};

const generateBatchNumber = async (): Promise<string> => {
  const count = await prisma.forensicBatch.count();
  return `DZPC${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
};

const computeHashes = async (filePath: string): Promise<{ md5: string; sha1: string; sha256: string }> => {
  return new Promise((resolve, reject) => {
    const md5Hash = crypto.createHash('md5');
    const sha1Hash = crypto.createHash('sha1');
    const sha256Hash = crypto.createHash('sha256');

    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      md5Hash.update(data);
      sha1Hash.update(data);
      sha256Hash.update(data);
    });

    stream.on('end', () => {
      resolve({
        md5: md5Hash.digest('hex'),
        sha1: sha1Hash.digest('hex'),
        sha256: sha256Hash.digest('hex'),
      });
    });

    stream.on('error', reject);
  });
};

const getFileMetadata = (filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
    };
  } catch {
    return null;
  }
};

const transformForensicFile = (file: any) => ({
  ...file,
  caseRelations: file.caseRelations?.map((r: any) => ({
    ...r,
    case: r.case ? { id: r.case.id, caseNumber: r.case.caseNumber, title: r.case.title } : null,
  })) || [],
  clueRelations: file.clueRelations?.map((r: any) => ({
    ...r,
    clue: r.clue ? { id: r.clue.id, clueNumber: r.clue.clueNumber, title: r.clue.title } : null,
  })) || [],
  batch: file.batch ? {
    id: file.batch.id,
    batchNumber: file.batch.batchNumber,
    name: file.batch.name,
  } : null,
  case: file.case ? {
    id: file.case.id,
    caseNumber: file.case.caseNumber,
    title: file.case.title,
  } : null,
  clue: file.clue ? {
    id: file.clue.id,
    clueNumber: file.clue.clueNumber,
    title: file.clue.title,
  } : null,
});

export default async function (fastify: FastifyInstance) {
  fastify.get('/stats', async () => {
    const [totalFiles, totalBatches, verifiedCount, corruptedCount, byType] = await Promise.all([
      prisma.forensicFile.count({ where: { isDeleted: false } }),
      prisma.forensicBatch.count(),
      prisma.forensicFile.count({ where: { isDeleted: false, integrityStatus: 'VERIFIED' } }),
      prisma.forensicFile.count({ where: { isDeleted: false, integrityStatus: 'CORRUPTED' } }),
      prisma.forensicFile.groupBy({
        by: ['fileType'],
        where: { isDeleted: false },
        _count: { fileType: true },
      }),
    ]);

    const typeStats: Record<string, number> = {};
    byType.forEach((item: any) => {
      typeStats[item.fileType] = item._count.fileType;
    });

    return {
      totalFiles,
      totalBatches,
      verifiedCount,
      corruptedCount,
      pendingCount: totalFiles - verifiedCount - corruptedCount,
      byType: typeStats,
    };
  });

  fastify.get('/options', async () => {
    return {
      fileTypes: [
        { value: 'DOCUMENT', label: '文档文件' },
        { value: 'IMAGE', label: '图片文件' },
        { value: 'VIDEO', label: '视频文件' },
        { value: 'AUDIO', label: '音频文件' },
        { value: 'EMAIL', label: '邮件数据' },
        { value: 'DATABASE', label: '数据库文件' },
        { value: 'LOG', label: '日志文件' },
        { value: 'ARCHIVE', label: '压缩文件' },
        { value: 'CODE', label: '代码文件' },
        { value: 'SYSTEM_FILE', label: '系统文件' },
        { value: 'OTHER', label: '其他文件' },
      ],
      acquisitionMethods: [
        { value: 'DISK_IMAGE', label: '磁盘镜像' },
        { value: 'FILE_COPY', label: '文件复制' },
        { value: 'MEMORY_DUMP', label: '内存镜像' },
        { value: 'NETWORK_CAPTURE', label: '网络抓包' },
        { value: 'EMAIL_EXPORT', label: '邮件导出' },
        { value: 'DATABASE_EXTRACT', label: '数据库提取' },
        { value: 'LOG_EXPORT', label: '日志导出' },
        { value: 'CLOUD_SYNC', label: '云端同步' },
        { value: 'MANUAL_COLLECT', label: '人工收集' },
        { value: 'OTHER', label: '其他方式' },
      ],
      integrityStatuses: [
        { value: 'VERIFIED', label: '校验通过' },
        { value: 'CORRUPTED', label: '数据损坏' },
        { value: 'PENDING', label: '待校验' },
        { value: 'NOT_APPLICABLE', label: '不适用' },
      ],
      cases: await prisma.case.findMany({
        select: { id: true, caseNumber: true, title: true },
        orderBy: { createdAt: 'desc' },
      }),
    };
  });

  fastify.get('/', async (request: FastifyRequest<{ Querystring: ForensicQuery }>, reply) => {
    const { page = 1, pageSize = 10, keyword, fileType, integrityStatus, caseId, clueId, batchId, acquisitionMethod, startDate, endDate } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = { isDeleted: false };

    if (keyword) {
      where.OR = [
        { fileName: { contains: keyword, mode: 'insensitive' } },
        { forensicNumber: { contains: keyword, mode: 'insensitive' } },
        { originalPath: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { md5Hash: { contains: keyword, mode: 'insensitive' } },
        { sha1Hash: { contains: keyword, mode: 'insensitive' } },
        { sha256Hash: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (fileType) where.fileType = fileType as any;
    if (integrityStatus) where.integrityStatus = integrityStatus as any;
    if (batchId) where.batchId = batchId;
    if (acquisitionMethod) where.acquisitionMethod = acquisitionMethod as any;

    if (caseId || clueId) {
      where.AND = [];
      if (caseId) {
        where.AND.push({
          OR: [
            { caseId },
            { caseRelations: { some: { caseId } } },
          ],
        });
      }
      if (clueId) {
        where.AND.push({
          OR: [
            { clueId },
            { clueRelations: { some: { clueId } } },
          ],
        });
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.forensicFile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          batch: { select: { id: true, batchNumber: true, name: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
          caseRelations: { include: { case: { select: { id: true, caseNumber: true, title: true } } } },
          clueRelations: { include: { clue: { select: { id: true, clueNumber: true, title: true } } } },
        },
      }),
      prisma.forensicFile.count({ where }),
    ]);

    return { items: items.map(transformForensicFile), total, page, pageSize };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const file = await prisma.forensicFile.findUnique({
      where: { id: request.params.id },
      include: {
        batch: true,
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
        caseRelations: { include: { case: { select: { id: true, caseNumber: true, title: true } } } },
        clueRelations: { include: { clue: { select: { id: true, clueNumber: true, title: true } } } },
        hashVerifications: { orderBy: { verificationTime: 'desc' } },
      },
    });

    if (!file || file.isDeleted) {
      reply.status(404).send({ error: '取证文件不存在' });
      return;
    }

    return transformForensicFile(file);
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: ForensicFileCreate }>, reply) => {
    const data = request.body;
    const forensicNumber = await generateForensicNumber();

    const createData: any = {
      ...data,
      forensicNumber,
      fileType: data.fileType || 'OTHER',
      integrityStatus: 'PENDING',
    };

    const file = await prisma.forensicFile.create({
      data: createData,
    });

    return file;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ForensicFileUpdate }>, reply) => {
    const data = request.body;
    try {
      const file = await prisma.forensicFile.update({
        where: { id: request.params.id },
        data,
      });
      return file;
    } catch (error) {
      reply.status(404).send({ error: '取证文件不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const file = await prisma.forensicFile.findUnique({ where: { id: request.params.id } });
      if (!file) {
        reply.status(404).send({ error: '取证文件不存在' });
        return;
      }

      await prisma.forensicFile.update({
        where: { id: request.params.id },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: '删除失败' });
    }
  });

  fastify.post('/upload-batch', async (request, reply) => {
    const parts = request.parts();
    const files: any[] = [];
    const metadata: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        const fileId = uuidv4();
        const ext = path.extname(part.filename);
        const storedName = `${fileId}${ext}`;
        const filePath = path.join(FORENSIC_DIR, storedName);

        const fileStream = fs.createWriteStream(filePath);
        let fileSize = 0;

        for await (const chunk of part.file) {
          fileSize += chunk.length;
          fileStream.write(chunk);
        }
        fileStream.end();

        const hashes = await computeHashes(filePath);
        const fileMeta = getFileMetadata(filePath);

        files.push({
          originalName: part.filename,
          storedName,
          storagePath: `/uploads/forensic/${storedName}`,
          localPath: filePath,
          fileSize,
          mimeType: part.mimetype,
          md5: hashes.md5,
          sha1: hashes.sha1,
          sha256: hashes.sha256,
          fileCreatedTime: fileMeta?.created,
          fileModifiedTime: fileMeta?.modified,
          fileAccessedTime: fileMeta?.accessed,
        });
      } else {
        metadata[part.fieldname] = part.value;
      }
    }

    let fileOverrides: any[] = [];
    if (metadata.files) {
      try {
        fileOverrides = JSON.parse(metadata.files);
      } catch { fileOverrides = []; }
    }

    const batchNumber = await generateBatchNumber();
    const batch = await prisma.forensicBatch.create({
      data: {
        batchNumber,
        name: metadata.name || `${batchNumber} 取证批次`,
        description: metadata.description,
        caseId: metadata.caseId || null,
        clueId: metadata.clueId || null,
        acquisitionMethod: (metadata.acquisitionMethod || 'FILE_COPY') as any,
        acquirer: metadata.acquirer || null,
        acquisitionTime: metadata.acquisitionTime ? new Date(metadata.acquisitionTime) : null,
        acquisitionLocation: metadata.acquisitionLocation || null,
        deviceInfo: metadata.deviceInfo || null,
        storageDevice: metadata.storageDevice || null,
        writeBlockerUsed: metadata.writeBlockerUsed === 'true',
        chainOfCustodyNote: metadata.chainOfCustodyNote || null,
        status: '已完成',
        totalFileCount: files.length,
        operatorName: metadata.operatorName || null,
      },
    });

    const createdFiles: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const override = fileOverrides[i] || {};

      try {
        const forensicNumber = await generateForensicNumber();
        const fileType = detectForensicFileType(file.originalName, file.mimeType);

        const created = await prisma.forensicFile.create({
          data: {
            batchId: batch.id,
            caseId: override.caseId || metadata.caseId || null,
            clueId: override.clueId || metadata.clueId || null,
            forensicNumber,
            originalPath: override.originalPath || file.originalName,
            fileName: override.fileName || file.originalName,
            fileExtension: path.extname(file.originalName),
            fileType: (override.fileType || fileType) as any,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            storagePath: file.storagePath,
            md5Hash: file.md5,
            sha1Hash: file.sha1,
            sha256Hash: file.sha256,
            integrityStatus: 'VERIFIED',
            lastVerificationTime: new Date(),
            verificationCount: 1,
            metadata: JSON.stringify({
              fileCreatedTime: file.fileCreatedTime,
              fileModifiedTime: file.fileModifiedTime,
              fileAccessedTime: file.fileAccessedTime,
            }),
            acquisitionMethod: (override.acquisitionMethod || metadata.acquisitionMethod) as any || 'FILE_COPY',
            acquirer: override.acquirer || metadata.acquirer || null,
            acquisitionTime: metadata.acquisitionTime ? new Date(metadata.acquisitionTime) : null,
            acquisitionLocation: override.acquisitionLocation || metadata.acquisitionLocation || null,
            sourceDevice: metadata.deviceInfo || null,
            fileCreatedTime: file.fileCreatedTime,
            fileModifiedTime: file.fileModifiedTime,
            fileAccessedTime: file.fileAccessedTime,
            description: override.description || null,
            tags: override.tags || null,
            operatorName: metadata.operatorName || null,
          },
        });

        await prisma.forensicHashVerification.create({
          data: {
            forensicFileId: created.id,
            batchId: batch.id,
            verificationType: 'INITIAL',
            originalMd5: file.md5,
            originalSha1: file.sha1,
            originalSha256: file.sha256,
            currentMd5: file.md5,
            currentSha1: file.sha1,
            currentSha256: file.sha256,
            md5Match: true,
            sha1Match: true,
            sha256Match: true,
            overallResult: 'VERIFIED',
            verificationTool: 'CryptoJS Built-in',
            algorithmVersion: 'MD5/SHA1/SHA256',
          },
        });

        createdFiles.push(created);
        successCount++;
      } catch (err) {
        failCount++;
        createdFiles.push({
          fileName: file.originalName,
          error: err instanceof Error ? err.message : '创建失败',
          success: false,
        });
      }
    }

    await prisma.forensicBatch.update({
      where: { id: batch.id },
      data: { successCount, failCount },
    });

    return {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        name: batch.name,
        totalCount: batch.totalFileCount,
        successCount,
        failCount,
      },
      files: createdFiles,
    };
  });

  fastify.post('/verify-hashes', async (request: FastifyRequest<{ Body: HashVerifyRequest }>, reply) => {
    const { forensicFileIds } = request.body;

    if (!forensicFileIds || !Array.isArray(forensicFileIds) || forensicFileIds.length === 0) {
      reply.status(400).send({ error: '请提供要校验的取证文件ID列表' });
      return;
    }

    const results: any[] = [];

    for (const fileId of forensicFileIds) {
      try {
        const file = await prisma.forensicFile.findUnique({ where: { id: fileId } });

        if (!file || file.isDeleted) {
          results.push({ id: fileId, success: false, error: '文件不存在' });
          continue;
        }

        const localPath = path.join(__dirname, '..', '..', file.storagePath);
        if (!fs.existsSync(localPath)) {
          await prisma.forensicFile.update({
            where: { id: fileId },
            data: { integrityStatus: 'CORRUPTED' },
          });

          await prisma.forensicHashVerification.create({
            data: {
              forensicFileId: fileId,
              verificationType: 'MANUAL',
              originalMd5: file.md5Hash,
              originalSha1: file.sha1Hash,
              originalSha256: file.sha256Hash,
              overallResult: 'CORRUPTED',
              note: '源文件缺失，无法校验',
            },
          });

          results.push({
            id: fileId,
            forensicNumber: file.forensicNumber,
            fileName: file.fileName,
            success: true,
            verified: false,
            status: 'CORRUPTED',
            note: '源文件缺失',
          });
          continue;
        }

        const currentHashes = await computeHashes(localPath);
        const md5Match = file.md5Hash === currentHashes.md5;
        const sha1Match = file.sha1Hash === currentHashes.sha1;
        const sha256Match = file.sha256Hash === currentHashes.sha256;
        const allMatch = md5Match && sha1Match && sha256Match;
        const overallResult = allMatch ? 'VERIFIED' : 'CORRUPTED';

        await prisma.forensicFile.update({
          where: { id: fileId },
          data: {
            integrityStatus: overallResult as any,
            lastVerificationTime: new Date(),
            verificationCount: { increment: 1 },
          },
        });

        await prisma.forensicHashVerification.create({
          data: {
            forensicFileId: fileId,
            verificationType: 'MANUAL',
            originalMd5: file.md5Hash,
            originalSha1: file.sha1Hash,
            originalSha256: file.sha256Hash,
            currentMd5: currentHashes.md5,
            currentSha1: currentHashes.sha1,
            currentSha256: currentHashes.sha256,
            md5Match,
            sha1Match,
            sha256Match,
            overallResult: overallResult as any,
            verificationTool: 'CryptoJS Built-in',
            algorithmVersion: 'MD5/SHA1/SHA256',
          },
        });

        results.push({
          id: fileId,
          forensicNumber: file.forensicNumber,
          fileName: file.fileName,
          success: true,
          verified: allMatch,
          status: overallResult,
          hashes: {
            originalMd5: file.md5Hash,
            originalSha1: file.sha1Hash,
            originalSha256: file.sha256Hash,
            currentMd5: currentHashes.md5,
            currentSha1: currentHashes.sha1,
            currentSha256: currentHashes.sha256,
          },
          matches: { md5Match, sha1Match, sha256Match },
        });
      } catch (err) {
        results.push({
          id: fileId,
          success: false,
          error: err instanceof Error ? err.message : '校验失败',
        });
      }
    }

    const verifiedCount = results.filter((r) => r.verified).length;
    const corruptedCount = results.filter((r) => r.status === 'CORRUPTED').length;

    return {
      total: results.length,
      verifiedCount,
      corruptedCount,
      results,
    };
  });

  fastify.post('/:id/download', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const file = await prisma.forensicFile.findUnique({ where: { id: request.params.id } });

    if (!file || file.isDeleted) {
      reply.status(404).send({ error: '取证文件不存在' });
      return;
    }

    const localPath = path.join(__dirname, '..', '..', file.storagePath);
    if (!fs.existsSync(localPath)) {
      reply.status(404).send({ error: '源文件不存在' });
      return;
    }

    const stat = fs.statSync(localPath);
    const stream = fs.createReadStream(localPath);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    reply.header('Content-Type', file.mimeType || 'application/octet-stream');
    reply.header('Content-Length', stat.size);
    reply.header('X-File-Hash-MD5', file.md5Hash || '');
    reply.header('X-File-Hash-SHA256', file.sha256Hash || '');

    return reply.send(stream);
  });

  fastify.get('/cases/:caseId/clues', async (request: FastifyRequest<{ Params: { caseId: string } }>) => {
    return prisma.clue.findMany({
      where: { caseId: request.params.caseId },
      select: { id: true, clueNumber: true, title: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.post('/bind-case', async (request: FastifyRequest<{ Body: BindRelationRequest }>, reply) => {
    const { forensicFileId, caseId, relationType, description } = request.body;

    if (!forensicFileId || !caseId) {
      reply.status(400).send({ error: '取证文件ID和案件ID必填' });
      return;
    }

    try {
      const relation = await prisma.forensicFileCase.create({
        data: {
          forensicFileId,
          caseId,
          relationType: relationType || '关联证据',
          description,
        },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
      });

      return { success: true, relation };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        reply.status(400).send({ error: '已存在该关联关系' });
        return;
      }
      reply.status(500).send({ error: '绑定失败' });
    }
  });

  fastify.post('/unbind-case', async (request: FastifyRequest<{ Body: UnbindRelationRequest }>, reply) => {
    const { forensicFileId, caseId } = request.body;

    if (!forensicFileId || !caseId) {
      reply.status(400).send({ error: '取证文件ID和案件ID必填' });
      return;
    }

    await prisma.forensicFileCase.deleteMany({
      where: { forensicFileId, caseId },
    });

    return { success: true };
  });

  fastify.post('/bind-clue', async (request: FastifyRequest<{ Body: BindRelationRequest }>, reply) => {
    const { forensicFileId, clueId, relationType, description } = request.body;

    if (!forensicFileId || !clueId) {
      reply.status(400).send({ error: '取证文件ID和线索ID必填' });
      return;
    }

    try {
      const relation = await prisma.forensicFileClue.create({
        data: {
          forensicFileId,
          clueId,
          relationType: relationType || '关联线索',
          description,
        },
        include: { clue: { select: { id: true, clueNumber: true, title: true } } },
      });

      return { success: true, relation };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        reply.status(400).send({ error: '已存在该关联关系' });
        return;
      }
      reply.status(500).send({ error: '绑定失败' });
    }
  });

  fastify.post('/unbind-clue', async (request: FastifyRequest<{ Body: UnbindRelationRequest }>, reply) => {
    const { forensicFileId, clueId } = request.body;

    if (!forensicFileId || !clueId) {
      reply.status(400).send({ error: '取证文件ID和线索ID必填' });
      return;
    }

    await prisma.forensicFileClue.deleteMany({
      where: { forensicFileId, clueId },
    });

    return { success: true };
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
      prisma.forensicBatch.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
          _count: { select: { forensicFiles: true } },
        },
      }),
      prisma.forensicBatch.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/batches/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const batch = await prisma.forensicBatch.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
        forensicFiles: true,
        hashVerifications: true,
      },
    });

    if (!batch) {
      reply.status(404).send({ error: '批次不存在' });
      return;
    }

    return batch;
  });
}
