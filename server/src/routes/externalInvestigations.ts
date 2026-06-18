import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

interface ExternalInvestigationQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  caseId?: string;
  clueId?: string;
  status?: string;
  priority?: string;
  investigationType?: string;
  targetDepartment?: string;
  applicantName?: string;
  startDate?: string;
  endDate?: string;
  deadlineStart?: string;
  deadlineEnd?: string;
  isOverdue?: boolean;
}

interface ExternalInvestigationCreate {
  caseId?: string;
  clueId?: string;
  title: string;
  investigationType: string;
  priority?: string;
  targetDepartment: string;
  targetContact?: string;
  targetPhone?: string;
  targetAddress?: string;
  sourceDepartment?: string;
  sourceContact?: string;
  sourcePhone?: string;
  requestContent: string;
  requestRequirement?: string;
  legalBasis?: string;
  deadline?: string;
  applicantId?: string;
  applicantName?: string;
  applicantDept?: string;
  isConfidential?: boolean;
  confidentialLevel?: string;
  remark?: string;
}

interface ExternalInvestigationUpdate extends Partial<ExternalInvestigationCreate> {}

interface SubmitRequest {
  approverId?: string;
  approverName?: string;
  approverDept?: string;
  approveOpinion?: string;
}

interface SendRequest {
  handlerId?: string;
  handlerName?: string;
  handlerDept?: string;
  sendTime?: string;
}

interface ResponseRequest {
  responseContent: string;
  responseResult?: string;
  responseNote?: string;
  responderId?: string;
  responderName?: string;
  responderDept?: string;
  responseTime?: string;
}

interface CompleteRequest {
  completeTime?: string;
  remark?: string;
}

const investigationTypeLabels: Record<string, string> = {
  PERSON_VERIFY: '人员核实',
  EVIDENCE_COLLECT: '证据调取',
  ASSET_QUERY: '资产查询',
  COMMUNICATION_QUERY: '通联查询',
  SURVEILLANCE: '布控协查',
  DOCUMENT_VERIFY: '文书核实',
  OTHER: '其他协查',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审批', color: 'orange' },
  SENT: { label: '已发出', color: 'blue' },
  RESPONDED: { label: '已回函', color: 'cyan' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'gray' },
  OVERDUE: { label: '已超期', color: 'red' },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  LOW: { label: '一般', color: 'default' },
  MEDIUM: { label: '重要', color: 'blue' },
  HIGH: { label: '紧急', color: 'orange' },
  URGENT: { label: '特急', color: 'red' },
};

const generateInvestigationNumber = async (): Promise<string> => {
  const date = new Date();
  const prefix = `XC${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const last = await prisma.externalInvestigation.findFirst({
    where: { investigationNumber: { startsWith: prefix } },
    orderBy: { investigationNumber: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.investigationNumber.substring(prefix.length), 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const generateTimelineEventNumber = async (): Promise<string> => {
  const date = new Date();
  const prefix = `TL${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const lastEvent = await prisma.timelineEvent.findFirst({
    where: { eventNumber: { startsWith: prefix } },
    orderBy: { eventNumber: 'desc' },
  });
  let seq = 1;
  if (lastEvent) {
    const lastSeq = parseInt(lastEvent.eventNumber.substring(prefix.length), 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const createTimelineEvent = async (
  caseId: string | null | undefined,
  clueId: string | null | undefined,
  eventType: any,
  title: string,
  description: string,
  eventTime: Date,
  operator: { id?: string; name?: string; dept?: string }
) => {
  if (!caseId && !clueId) return;

  const targetType: any = caseId ? 'CASE' : 'CLUE';
  const eventNumber = await generateTimelineEventNumber();

  try {
    await prisma.timelineEvent.create({
      data: {
        eventNumber,
        targetType,
        caseId: caseId || null,
        clueId: clueId || null,
        eventType: eventType as any,
        title,
        description,
        eventTime,
        priority: (eventType.includes('COMPLETE') ? 'HIGH' : eventType.includes('URGENT') ? 'CRITICAL' : 'MEDIUM') as any,
        source: 'SYSTEM' as any,
        status: '已确认',
        operatorId: operator.id || null,
        operatorName: operator.name || null,
        operatorDept: operator.dept || null,
      },
    });
  } catch (e) {
    console.error('创建时间轴事件失败:', e);
  }
};

const createInvestigationLog = async (
  investigationId: string,
  action: string,
  description: string,
  request: FastifyRequest,
  beforeData?: any,
  afterData?: any,
  stage?: string
) => {
  const meta = getRequestMeta(request);
  const operator = extractOperator(request);
  try {
    await prisma.externalInvestigationLog.create({
      data: {
        investigationId,
        action,
        stage,
        description,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        operatorName: operator,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  } catch (e) {
    console.error('创建协查操作日志失败:', e);
  }
};

const checkOverdue = (item: any) => {
  if (item.deadline && ['SENT'].includes(item.status) && new Date(item.deadline) < new Date()) {
    return { ...item, status: 'OVERDUE', isOverdue: true };
  }
  return { ...item, isOverdue: item.status === 'OVERDUE' };
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/options', async () => {
    return {
      investigationTypes: Object.entries(investigationTypeLabels).map(([value, label]) => ({ value, label })),
      statuses: Object.entries(statusLabels).map(([value, { label, color }]) => ({ value, label, color })),
      priorities: Object.entries(priorityLabels).map(([value, { label, color }]) => ({ value, label, color })),
    };
  });

  fastify.get('/', async (request: FastifyRequest<{ Querystring: ExternalInvestigationQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      caseId,
      clueId,
      status,
      priority,
      investigationType,
      targetDepartment,
      applicantName,
      startDate,
      endDate,
      deadlineStart,
      deadlineEnd,
      isOverdue,
    } = request.query;

    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { investigationNumber: { contains: keyword, mode: 'insensitive' } },
        { requestContent: { contains: keyword, mode: 'insensitive' } },
        { targetDepartment: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (caseId) where.caseId = caseId;
    if (clueId) where.clueId = clueId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (investigationType) where.investigationType = investigationType;
    if (targetDepartment) where.targetDepartment = { contains: targetDepartment, mode: 'insensitive' };
    if (applicantName) where.applicantName = { contains: applicantName, mode: 'insensitive' };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }

    if (deadlineStart || deadlineEnd) {
      where.deadline = {};
      if (deadlineStart) where.deadline.gte = new Date(deadlineStart);
      if (deadlineEnd) where.deadline.lte = new Date(deadlineEnd + 'T23:59:59');
    }

    const [items, total] = await Promise.all([
      prisma.externalInvestigation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
          _count: {
            select: {
              attachments: true,
              responseAttachments: true,
              operationLogs: true,
            },
          },
        },
      }),
      prisma.externalInvestigation.count({ where }),
    ]);

    const enrichedItems = items.map(item => {
      const enriched = checkOverdue(item);
      return {
        ...enriched,
        investigationTypeLabel: investigationTypeLabels[enriched.investigationType] || enriched.investigationType,
        statusLabel: statusLabels[enriched.status]?.label || enriched.status,
        statusColor: statusLabels[enriched.status]?.color || 'default',
        priorityLabel: priorityLabels[enriched.priority]?.label || enriched.priority,
        priorityColor: priorityLabels[enriched.priority]?.color || 'default',
      };
    });

    let filteredItems = enrichedItems;
    if (isOverdue === true) {
      filteredItems = enrichedItems.filter((i: any) => i.isOverdue);
    } else if (isOverdue === false) {
      filteredItems = enrichedItems.filter((i: any) => !i.isOverdue);
    }

    const stats = await prisma.externalInvestigation.groupBy({
      by: ['status', 'priority', 'investigationType'],
      where,
      _count: { id: true },
    });

    const now = new Date();
    const overdueCount = await prisma.externalInvestigation.count({
      where: {
        ...where,
        status: 'SENT',
        deadline: { lt: now },
      },
    });

    return {
      items: filteredItems,
      total: isOverdue !== undefined ? filteredItems.length : total,
      page,
      pageSize,
      stats,
      overdueCount,
      investigationTypeLabels,
      statusLabels,
      priorityLabels,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const investigation = await prisma.externalInvestigation.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
        attachments: { orderBy: { uploadTime: 'desc' } },
        responseAttachments: { orderBy: { uploadTime: 'desc' } },
        operationLogs: { orderBy: { actionTime: 'desc' } },
      },
    });

    if (!investigation) {
      reply.status(404).send({ error: '协查记录不存在' });
      return;
    }

    const enriched = checkOverdue(investigation);
    return {
      ...enriched,
      investigationTypeLabel: investigationTypeLabels[enriched.investigationType] || enriched.investigationType,
      statusLabel: statusLabels[enriched.status]?.label || enriched.status,
      statusColor: statusLabels[enriched.status]?.color || 'default',
      priorityLabel: priorityLabels[enriched.priority]?.label || enriched.priority,
      priorityColor: priorityLabels[enriched.priority]?.color || 'default',
    };
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: ExternalInvestigationCreate }>, reply) => {
    const data = request.body;
    const investigationNumber = await generateInvestigationNumber();
    const operator = extractOperator(request);

    const investigation = await prisma.externalInvestigation.create({
      data: {
        investigationNumber,
        caseId: data.caseId,
        clueId: data.clueId,
        title: data.title,
        investigationType: data.investigationType as any,
        priority: (data.priority || 'MEDIUM') as any,
        targetDepartment: data.targetDepartment,
        targetContact: data.targetContact,
        targetPhone: data.targetPhone,
        targetAddress: data.targetAddress,
        sourceDepartment: data.sourceDepartment,
        sourceContact: data.sourceContact,
        sourcePhone: data.sourcePhone,
        requestContent: data.requestContent,
        requestRequirement: data.requestRequirement,
        legalBasis: data.legalBasis,
        deadline: data.deadline ? new Date(data.deadline) : null,
        applicantId: data.applicantId,
        applicantName: data.applicantName,
        applicantDept: data.applicantDept,
        isConfidential: data.isConfidential || false,
        confidentialLevel: data.confidentialLevel,
        remark: data.remark,
        status: 'DRAFT' as any,
      },
    });

    await logCreate(
      TargetType.EXTERNAL_INVESTIGATION,
      investigation.id,
      `创建协查请求：${investigationNumber} - ${investigation.title}`,
      request,
      operator,
      {
        id: investigation.id,
        investigationNumber: investigation.investigationNumber,
        title: investigation.title,
        investigationType: investigation.investigationType,
        targetDepartment: investigation.targetDepartment,
        caseId: investigation.caseId,
        clueId: investigation.clueId,
      }
    );

    await createInvestigationLog(
      investigation.id,
      ActionType.CREATE,
      `创建协查请求：${investigationNumber} - ${investigation.title}`,
      request,
      null,
      investigation,
      'DRAFT'
    );

    if (investigation.caseId) {
      await logAssociate(
        TargetType.CASE,
        investigation.caseId,
        `创建关联协查：${investigationNumber} - ${investigation.title}`,
        request,
        {
          investigationId: investigation.id,
          investigationNumber: investigation.investigationNumber,
          title: investigation.title,
        }
      );
    }

    if (investigation.clueId) {
      await logAssociate(
        TargetType.CLUE,
        investigation.clueId,
        `创建关联协查：${investigationNumber} - ${investigation.title}`,
        request,
        {
          investigationId: investigation.id,
          investigationNumber: investigation.investigationNumber,
          title: investigation.title,
        }
      );
    }

    return investigation;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ExternalInvestigationUpdate }>, reply) => {
    const data = request.body;
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (!['DRAFT', 'PENDING'].includes(before.status)) {
        reply.status(400).send({ error: '仅草稿或待审批状态的协查可以修改' });
        return;
      }

      const investigation = await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: {
          title: data.title,
          investigationType: data.investigationType as any,
          priority: data.priority as any,
          targetDepartment: data.targetDepartment,
          targetContact: data.targetContact,
          targetPhone: data.targetPhone,
          targetAddress: data.targetAddress,
          sourceDepartment: data.sourceDepartment,
          sourceContact: data.sourceContact,
          sourcePhone: data.sourcePhone,
          requestContent: data.requestContent,
          requestRequirement: data.requestRequirement,
          legalBasis: data.legalBasis,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
          applicantId: data.applicantId,
          applicantName: data.applicantName,
          applicantDept: data.applicantDept,
          isConfidential: data.isConfidential,
          confidentialLevel: data.confidentialLevel,
          remark: data.remark,
        },
      });

      await logUpdate(
        TargetType.EXTERNAL_INVESTIGATION,
        investigation.id,
        `更新协查请求：${investigation.investigationNumber} - ${investigation.title}`,
        request,
        {
          title: before.title,
          investigationType: before.investigationType,
          priority: before.priority,
          targetDepartment: before.targetDepartment,
          requestContent: before.requestContent,
          deadline: before.deadline,
        },
        {
          title: investigation.title,
          investigationType: investigation.investigationType,
          priority: investigation.priority,
          targetDepartment: investigation.targetDepartment,
          requestContent: investigation.requestContent,
          deadline: investigation.deadline,
        }
      );

      await createInvestigationLog(
        investigation.id,
        ActionType.UPDATE,
        `更新协查请求：${investigation.investigationNumber}`,
        request,
        before,
        investigation,
        investigation.status
      );

      return investigation;
    } catch (error) {
      reply.status(404).send({ error: '协查记录不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (!['DRAFT', 'CANCELLED'].includes(before.status)) {
        reply.status(400).send({ error: '仅草稿或已取消状态的协查可以删除' });
        return;
      }

      for (const att of await prisma.externalInvestigationAttachment.findMany({ where: { investigationId: request.params.id } })) {
        const localPath = path.join(__dirname, '..', '..', att.filePath);
        if (fs.existsSync(localPath)) {
          try { fs.unlinkSync(localPath); } catch {}
        }
      }

      for (const att of await prisma.externalInvestigationResponseAttachment.findMany({ where: { investigationId: request.params.id } })) {
        const localPath = path.join(__dirname, '..', '..', att.filePath);
        if (fs.existsSync(localPath)) {
          try { fs.unlinkSync(localPath); } catch {}
        }
      }

      const caseId = before.caseId;
      const clueId = before.clueId;

      await prisma.externalInvestigation.delete({
        where: { id: request.params.id },
      });

      await logDelete(
        TargetType.EXTERNAL_INVESTIGATION,
        request.params.id,
        `删除协查请求：${before.investigationNumber} - ${before.title}`,
        request,
        {
          id: before.id,
          investigationNumber: before.investigationNumber,
          title: before.title,
          status: before.status,
        }
      );

      if (caseId) {
        await logDisassociate(
          TargetType.CASE,
          caseId,
          `删除关联协查：${before.investigationNumber} - ${before.title}`,
          request,
          {
            investigationId: before.id,
            investigationNumber: before.investigationNumber,
            title: before.title,
          }
        );
      }

      if (clueId) {
        await logDisassociate(
          TargetType.CLUE,
          clueId,
          `删除关联协查：${before.investigationNumber} - ${before.title}`,
          request,
          {
            investigationId: before.id,
            investigationNumber: before.investigationNumber,
            title: before.title,
          }
        );
      }

      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: '删除协查记录失败' });
    }
  });

  fastify.post('/:id/submit', async (request: FastifyRequest<{ Params: { id: string }; Body: SubmitRequest }>, reply) => {
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (before.status !== 'DRAFT') {
        reply.status(400).send({ error: '仅草稿状态的协查可以提交审批' });
        return;
      }

      const data = request.body;
      const now = new Date();
      const operator = extractOperator(request);

      const investigation = await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: {
          status: 'PENDING',
          approverId: data.approverId,
          approverName: data.approverName,
          approverDept: data.approverDept,
          approveOpinion: data.approveOpinion,
        },
      });

      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: investigation.id,
        action: ActionType.INVESTIGATION_SUBMIT,
        description: `提交协查审批：${investigation.investigationNumber} - ${investigation.title}`,
        operator,
        beforeData: { status: before.status },
        afterData: { status: investigation.status },
        ...getRequestMeta(request),
      });

      await createInvestigationLog(
        investigation.id,
        ActionType.INVESTIGATION_SUBMIT,
        `提交协查审批`,
        request,
        before,
        investigation,
        'PENDING'
      );

      await createTimelineEvent(
        investigation.caseId,
        investigation.clueId,
        'EXTERNAL_INVESTIGATION_REQUEST',
        `协查请求提交：${investigationTypeLabels[investigation.investigationType]}`,
        `协查编号：${investigation.investigationNumber}\n标题：${investigation.title}\n协查单位：${investigation.targetDepartment}\n内容：${investigation.requestContent}`,
        now,
        { name: operator }
      );

      return investigation;
    } catch (error) {
      reply.status(400).send({ error: '提交审批失败' });
    }
  });

  fastify.post('/:id/send', async (request: FastifyRequest<{ Params: { id: string }; Body: SendRequest }>, reply) => {
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (!['PENDING', 'DRAFT'].includes(before.status)) {
        reply.status(400).send({ error: '仅待审批或草稿状态的协查可以发出' });
        return;
      }

      const data = request.body;
      const sendTime = data.sendTime ? new Date(data.sendTime) : new Date();
      const operator = extractOperator(request);

      const investigation = await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: {
          status: 'SENT',
          sendTime,
          handlerId: data.handlerId,
          handlerName: data.handlerName,
          handlerDept: data.handlerDept,
        },
      });

      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: investigation.id,
        action: ActionType.INVESTIGATION_SEND,
        description: `发出协查：${investigation.investigationNumber} - ${investigation.title}，至${investigation.targetDepartment}`,
        operator: data.handlerName || operator,
        beforeData: { status: before.status },
        afterData: { status: investigation.status, sendTime: investigation.sendTime },
        ...getRequestMeta(request),
      });

      await createInvestigationLog(
        investigation.id,
        ActionType.INVESTIGATION_SEND,
        `发出协查至 ${investigation.targetDepartment}`,
        request,
        before,
        investigation,
        'SENT'
      );

      await createTimelineEvent(
        investigation.caseId,
        investigation.clueId,
        'EXTERNAL_INVESTIGATION_SEND',
        `协查已发出：${investigation.targetDepartment}`,
        `协查编号：${investigation.investigationNumber}\n标题：${investigation.title}\n经办人：${investigation.handlerName || '未填写'}\n要求回复时间：${investigation.deadline ? new Date(investigation.deadline).toLocaleString() : '未设置'}`,
        sendTime,
        { id: data.handlerId, name: data.handlerName, dept: data.handlerDept }
      );

      return investigation;
    } catch (error) {
      reply.status(400).send({ error: '发出协查失败' });
    }
  });

  fastify.post('/:id/respond', async (request: FastifyRequest<{ Params: { id: string }; Body: ResponseRequest }>, reply) => {
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (before.status !== 'SENT' && before.status !== 'OVERDUE') {
        reply.status(400).send({ error: '仅已发出或已超期状态的协查可以登记回函' });
        return;
      }

      const data = request.body;
      const responseTime = data.responseTime ? new Date(data.responseTime) : new Date();

      const investigation = await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: {
          status: 'RESPONDED',
          responseContent: data.responseContent,
          responseResult: data.responseResult,
          responseNote: data.responseNote,
          responseTime,
          responderId: data.responderId,
          responderName: data.responderName,
          responderDept: data.responderDept,
        },
      });

      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: investigation.id,
        action: ActionType.INVESTIGATION_RESPOND,
        description: `协查回函登记：${investigation.investigationNumber} - ${investigation.title}，回函结果：${data.responseResult || '未填写'}`,
        operator: data.responderName,
        beforeData: { status: before.status },
        afterData: {
          status: investigation.status,
          responseResult: investigation.responseResult,
          responseTime: investigation.responseTime,
        },
        ...getRequestMeta(request),
      });

      await createInvestigationLog(
        investigation.id,
        ActionType.INVESTIGATION_RESPOND,
        `协查回函登记，结果：${data.responseResult || '未填写'}`,
        request,
        before,
        investigation,
        'RESPONDED'
      );

      await createTimelineEvent(
        investigation.caseId,
        investigation.clueId,
        'EXTERNAL_INVESTIGATION_RESPONSE',
        `协查已回函：${data.responseResult || '已回复'}`,
        `协查编号：${investigation.investigationNumber}\n标题：${investigation.title}\n回函人：${data.responderName || '未填写'}\n回函内容：${data.responseContent}\n回函结果：${data.responseResult || '未填写'}\n备注：${data.responseNote || ''}`,
        responseTime,
        { id: data.responderId, name: data.responderName, dept: data.responderDept }
      );

      return investigation;
    } catch (error) {
      reply.status(400).send({ error: '登记回函失败' });
    }
  });

  fastify.post('/:id/complete', async (request: FastifyRequest<{ Params: { id: string }; Body: CompleteRequest }>, reply) => {
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (before.status !== 'RESPONDED') {
        reply.status(400).send({ error: '仅已回函状态的协查可以完成' });
        return;
      }

      const data = request.body;
      const completeTime = data.completeTime ? new Date(data.completeTime) : new Date();
      const operator = extractOperator(request);

      const investigation = await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: {
          status: 'COMPLETED',
          completeTime,
          remark: data.remark || before.remark,
        },
      });

      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: investigation.id,
        action: ActionType.INVESTIGATION_COMPLETE,
        description: `协查完成：${investigation.investigationNumber} - ${investigation.title}`,
        operator,
        beforeData: { status: before.status },
        afterData: { status: investigation.status, completeTime: investigation.completeTime },
        ...getRequestMeta(request),
      });

      await createInvestigationLog(
        investigation.id,
        ActionType.INVESTIGATION_COMPLETE,
        `协查完成归档`,
        request,
        before,
        investigation,
        'COMPLETED'
      );

      await createTimelineEvent(
        investigation.caseId,
        investigation.clueId,
        'EXTERNAL_INVESTIGATION_COMPLETE',
        `协查已完成`,
        `协查编号：${investigation.investigationNumber}\n标题：${investigation.title}\n回函结果：${investigation.responseResult || '未填写'}\n协查结论：${data.remark || investigation.responseContent || ''}`,
        completeTime,
        { name: operator }
      );

      return investigation;
    } catch (error) {
      reply.status(400).send({ error: '完成协查失败' });
    }
  });

  fastify.post('/:id/cancel', async (request: FastifyRequest<{ Params: { id: string }; Body: { remark?: string } }>, reply) => {
    try {
      const before = await prisma.externalInvestigation.findUnique({
        where: { id: request.params.id },
      });

      if (!before) {
        reply.status(404).send({ error: '协查记录不存在' });
        return;
      }

      if (['COMPLETED', 'CANCELLED'].includes(before.status)) {
        reply.status(400).send({ error: '已完成或已取消的协查无法重复取消' });
        return;
      }

      const data = request.body;
      const operator = extractOperator(request);
      const now = new Date();

      const investigation = await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: {
          status: 'CANCELLED',
          remark: data.remark ? `${before.remark || ''}\n取消原因：${data.remark}`.trim() : before.remark,
        },
      });

      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: investigation.id,
        action: ActionType.INVESTIGATION_CANCEL,
        description: `取消协查：${investigation.investigationNumber} - ${investigation.title}，原因：${data.remark || '未填写'}`,
        operator,
        beforeData: { status: before.status },
        afterData: { status: investigation.status },
        ...getRequestMeta(request),
      });

      await createInvestigationLog(
        investigation.id,
        ActionType.INVESTIGATION_CANCEL,
        `取消协查，原因：${data.remark || '未填写'}`,
        request,
        before,
        investigation,
        'CANCELLED'
      );

      return investigation;
    } catch (error) {
      reply.status(400).send({ error: '取消协查失败' });
    }
  });

  fastify.post('/:id/attachments/upload', async (request, reply) => {
    const { id } = request.params as any;

    const investigation = await prisma.externalInvestigation.findUnique({
      where: { id },
    });

    if (!investigation) {
      reply.status(404).send({ error: '协查记录不存在' });
      return;
    }

    const parts = request.parts();
    const uploadedAttachments: any[] = [];
    let description = '';
    let uploaderName = '';
    let uploaderId = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        const fileId = uuidv4();
        const ext = path.extname(part.filename);
        const storedName = `${fileId}${ext}`;
        const filePath = path.join(UPLOAD_DIR, storedName);

        const fileStream = fs.createWriteStream(filePath);
        let fileSize = 0;

        for await (const chunk of part.file) {
          fileSize += chunk.length;
          fileStream.write(chunk);
        }
        fileStream.end();

        const attachment = await prisma.externalInvestigationAttachment.create({
          data: {
            investigationId: id,
            fileName: part.filename,
            storedName,
            filePath: `/uploads/${storedName}`,
            fileSize,
            mimeType: part.mimetype,
            description,
            uploaderId: uploaderId || null,
            uploaderName: uploaderName || extractOperator(request),
          },
        });

        await prisma.externalInvestigation.update({
          where: { id },
          data: { attachmentCount: { increment: 1 } },
        });

        await createOperationLog({
          targetType: TargetType.EXTERNAL_INVESTIGATION,
          targetId: id,
          action: ActionType.INVESTIGATION_UPLOAD_ATTACHMENT,
          description: `上传协查请求附件：${part.filename}`,
          operator: uploaderName || extractOperator(request),
          afterData: {
            attachmentId: attachment.id,
            fileName: part.filename,
            fileSize,
          },
          ...getRequestMeta(request),
        });

        uploadedAttachments.push(attachment);
      } else {
        if (part.fieldname === 'description') description = part.value as string;
        if (part.fieldname === 'uploaderName') uploaderName = part.value as string;
        if (part.fieldname === 'uploaderId') uploaderId = part.value as string;
      }
    }

    return { attachments: uploadedAttachments, count: uploadedAttachments.length };
  });

  fastify.get('/:id/attachments/:attachmentId/download', async (
    request: FastifyRequest<{ Params: { id: string; attachmentId: string } }>,
    reply
  ) => {
    const attachment = await prisma.externalInvestigationAttachment.findUnique({
      where: { id: request.params.attachmentId },
    });

    if (!attachment) {
      reply.status(404).send({ error: '附件不存在' });
      return;
    }

    const localPath = path.join(__dirname, '..', '..', attachment.filePath);
    if (!fs.existsSync(localPath)) {
      reply.status(404).send({ error: '文件不存在' });
      return;
    }

    const stat = fs.statSync(localPath);
    const stream = fs.createReadStream(localPath);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    reply.header('Content-Type', attachment.mimeType || 'application/octet-stream');
    reply.header('Content-Length', stat.size);

    return reply.send(stream);
  });

  fastify.delete('/:id/attachments/:attachmentId', async (
    request: FastifyRequest<{ Params: { id: string; attachmentId: string } }>,
    reply
  ) => {
    try {
      const attachment = await prisma.externalInvestigationAttachment.findUnique({
        where: { id: request.params.attachmentId },
      });

      if (!attachment) {
        reply.status(404).send({ error: '附件不存在' });
        return;
      }

      const localPath = path.join(__dirname, '..', '..', attachment.filePath);
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch {}
      }

      await prisma.externalInvestigationAttachment.delete({
        where: { id: request.params.attachmentId },
      });

      await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: { attachmentCount: { decrement: 1 } },
      });

      const operator = extractOperator(request);
      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: request.params.id,
        action: ActionType.INVESTIGATION_DELETE_ATTACHMENT,
        description: `删除协查请求附件：${attachment.fileName}`,
        operator,
        beforeData: {
          attachmentId: attachment.id,
          fileName: attachment.fileName,
        },
        ...getRequestMeta(request),
      });

      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: '删除附件失败' });
    }
  });

  fastify.post('/:id/response-attachments/upload', async (request, reply) => {
    const { id } = request.params as any;

    const investigation = await prisma.externalInvestigation.findUnique({
      where: { id },
    });

    if (!investigation) {
      reply.status(404).send({ error: '协查记录不存在' });
      return;
    }

    const parts = request.parts();
    const uploadedAttachments: any[] = [];
    let description = '';
    let uploaderName = '';
    let uploaderId = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        const fileId = uuidv4();
        const ext = path.extname(part.filename);
        const storedName = `${fileId}${ext}`;
        const filePath = path.join(UPLOAD_DIR, storedName);

        const fileStream = fs.createWriteStream(filePath);
        let fileSize = 0;

        for await (const chunk of part.file) {
          fileSize += chunk.length;
          fileStream.write(chunk);
        }
        fileStream.end();

        const attachment = await prisma.externalInvestigationResponseAttachment.create({
          data: {
            investigationId: id,
            fileName: part.filename,
            storedName,
            filePath: `/uploads/${storedName}`,
            fileSize,
            mimeType: part.mimetype,
            description,
            uploaderId: uploaderId || null,
            uploaderName: uploaderName || extractOperator(request),
          },
        });

        await prisma.externalInvestigation.update({
          where: { id },
          data: { responseAttachmentCount: { increment: 1 } },
        });

        await createOperationLog({
          targetType: TargetType.EXTERNAL_INVESTIGATION,
          targetId: id,
          action: ActionType.INVESTIGATION_UPLOAD_RESPONSE_ATTACHMENT,
          description: `上传协查回函附件：${part.filename}`,
          operator: uploaderName || extractOperator(request),
          afterData: {
            attachmentId: attachment.id,
            fileName: part.filename,
            fileSize,
          },
          ...getRequestMeta(request),
        });

        uploadedAttachments.push(attachment);
      } else {
        if (part.fieldname === 'description') description = part.value as string;
        if (part.fieldname === 'uploaderName') uploaderName = part.value as string;
        if (part.fieldname === 'uploaderId') uploaderId = part.value as string;
      }
    }

    return { attachments: uploadedAttachments, count: uploadedAttachments.length };
  });

  fastify.get('/:id/response-attachments/:attachmentId/download', async (
    request: FastifyRequest<{ Params: { id: string; attachmentId: string } }>,
    reply
  ) => {
    const attachment = await prisma.externalInvestigationResponseAttachment.findUnique({
      where: { id: request.params.attachmentId },
    });

    if (!attachment) {
      reply.status(404).send({ error: '附件不存在' });
      return;
    }

    const localPath = path.join(__dirname, '..', '..', attachment.filePath);
    if (!fs.existsSync(localPath)) {
      reply.status(404).send({ error: '文件不存在' });
      return;
    }

    const stat = fs.statSync(localPath);
    const stream = fs.createReadStream(localPath);

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    reply.header('Content-Type', attachment.mimeType || 'application/octet-stream');
    reply.header('Content-Length', stat.size);

    return reply.send(stream);
  });

  fastify.delete('/:id/response-attachments/:attachmentId', async (
    request: FastifyRequest<{ Params: { id: string; attachmentId: string } }>,
    reply
  ) => {
    try {
      const attachment = await prisma.externalInvestigationResponseAttachment.findUnique({
        where: { id: request.params.attachmentId },
      });

      if (!attachment) {
        reply.status(404).send({ error: '附件不存在' });
        return;
      }

      const localPath = path.join(__dirname, '..', '..', attachment.filePath);
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch {}
      }

      await prisma.externalInvestigationResponseAttachment.delete({
        where: { id: request.params.attachmentId },
      });

      await prisma.externalInvestigation.update({
        where: { id: request.params.id },
        data: { responseAttachmentCount: { decrement: 1 } },
      });

      const operator = extractOperator(request);
      await createOperationLog({
        targetType: TargetType.EXTERNAL_INVESTIGATION,
        targetId: request.params.id,
        action: ActionType.INVESTIGATION_DELETE_RESPONSE_ATTACHMENT,
        description: `删除协查回函附件：${attachment.fileName}`,
        operator,
        beforeData: {
          attachmentId: attachment.id,
          fileName: attachment.fileName,
        },
        ...getRequestMeta(request),
      });

      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: '删除附件失败' });
    }
  });

  fastify.get('/:id/logs', async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; pageSize?: number } }>,
    reply
  ) => {
    const { page = 1, pageSize = 50 } = request.query;
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      prisma.externalInvestigationLog.findMany({
        where: { investigationId: request.params.id },
        skip,
        take: pageSize,
        orderBy: { actionTime: 'desc' },
      }),
      prisma.externalInvestigationLog.count({ where: { investigationId: request.params.id } }),
    ]);

    return { items: logs, total, page, pageSize };
  });

  fastify.get('/cases/:caseId/summary', async (
    request: FastifyRequest<{ Params: { caseId: string } }>,
    reply
  ) => {
    const investigations = await prisma.externalInvestigation.findMany({
      where: { caseId: request.params.caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: true,
        responseAttachments: true,
      },
    });

    const statusCounts: any = {};
    const now = new Date();
    let overdueCount = 0;

    investigations.forEach((inv: any) => {
      const status = inv.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (inv.deadline && inv.status === 'SENT' && new Date(inv.deadline) < now) {
        overdueCount++;
      }
    });

    return {
      items: investigations.map((inv: any) => ({
        ...checkOverdue(inv),
        investigationTypeLabel: investigationTypeLabels[inv.investigationType] || inv.investigationType,
        statusLabel: statusLabels[inv.status]?.label || inv.status,
        priorityLabel: priorityLabels[inv.priority]?.label || inv.priority,
      })),
      total: investigations.length,
      statusCounts,
      overdueCount,
      pendingCount: statusCounts['PENDING'] || 0,
      sentCount: statusCounts['SENT'] || 0,
      respondedCount: statusCounts['RESPONDED'] || 0,
      completedCount: statusCounts['COMPLETED'] || 0,
    };
  });

  fastify.get('/clues/:clueId/summary', async (
    request: FastifyRequest<{ Params: { clueId: string } }>,
    reply
  ) => {
    const investigations = await prisma.externalInvestigation.findMany({
      where: { clueId: request.params.clueId },
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: true,
        responseAttachments: true,
      },
    });

    const statusCounts: any = {};
    const now = new Date();
    let overdueCount = 0;

    investigations.forEach((inv: any) => {
      const status = inv.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (inv.deadline && inv.status === 'SENT' && new Date(inv.deadline) < now) {
        overdueCount++;
      }
    });

    return {
      items: investigations.map((inv: any) => ({
        ...checkOverdue(inv),
        investigationTypeLabel: investigationTypeLabels[inv.investigationType] || inv.investigationType,
        statusLabel: statusLabels[inv.status]?.label || inv.status,
        priorityLabel: priorityLabels[inv.priority]?.label || inv.priority,
      })),
      total: investigations.length,
      statusCounts,
      overdueCount,
      pendingCount: statusCounts['PENDING'] || 0,
      sentCount: statusCounts['SENT'] || 0,
      respondedCount: statusCounts['RESPONDED'] || 0,
      completedCount: statusCounts['COMPLETED'] || 0,
    };
  });

  fastify.get('/stats/overview', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, byStatus, byType, last30Days, overdue] = await Promise.all([
      prisma.externalInvestigation.count(),
      prisma.externalInvestigation.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.externalInvestigation.groupBy({
        by: ['investigationType'],
        _count: { id: true },
      }),
      prisma.externalInvestigation.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.externalInvestigation.count({
        where: {
          status: 'SENT',
          deadline: { lt: now },
        },
      }),
    ]);

    const statusMap: any = {};
    byStatus.forEach((s: any) => {
      statusMap[s.status] = s._count.id;
    });

    const typeMap: any = {};
    byType.forEach((t: any) => {
      typeMap[t.investigationType] = t._count.id;
    });

    return {
      total,
      last30Days,
      overdue,
      byStatus: {
        DRAFT: statusMap.DRAFT || 0,
        PENDING: statusMap.PENDING || 0,
        SENT: statusMap.SENT || 0,
        RESPONDED: statusMap.RESPONDED || 0,
        COMPLETED: statusMap.COMPLETED || 0,
        CANCELLED: statusMap.CANCELLED || 0,
      },
      byType: typeMap,
    };
  });
}
