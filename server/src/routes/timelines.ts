import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import {
  TargetType,
  ActionType,
  logCreate,
  logUpdate,
  logDelete,
  createOperationLog,
  getRequestMeta,
  extractOperator,
} from '../lib/operationLog';

interface TimelineEventQuery {
  page?: number;
  pageSize?: number;
  targetType?: 'CASE' | 'CLUE';
  caseId?: string;
  clueId?: string;
  eventType?: string;
  eventTypes?: string[];
  keyword?: string;
  priority?: string;
  operatorName?: string;
  startDate?: string;
  endDate?: string;
  isImportant?: boolean;
}

interface TimelineEventCreate {
  targetType: 'CASE' | 'CLUE';
  caseId?: string;
  clueId?: string;
  eventType: string;
  eventSubtype?: string;
  title: string;
  description?: string;
  location?: string;
  eventTime: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source?: 'SYSTEM' | 'MANUAL' | 'IMPORT' | 'API';
  status?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
  operatorRole?: string;
  participantIds?: string[];
  participantNames?: string[];
  evidenceIds?: string[];
  personIds?: string[];
  taskIds?: string[];
  meetingIds?: string[];
  forensicFileIds?: string[];
  isImportant?: boolean;
  isConfidential?: boolean;
  confidentialLevel?: string;
  parentEventId?: string;
  relatedEventIds?: string[];
  remark?: string;
  metadata?: any;
}

interface TimelineEventUpdate extends Partial<TimelineEventCreate> {}

interface TimelineEventBatch {
  ids: string[];
  action: 'IMPORTANT' | 'NORMAL' | 'DELETE';
}

const generateEventNumber = async () => {
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

const eventTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
  REPORT: { label: '报案事件', color: 'red', icon: 'PhoneOutlined' },
  CRIME_OCCUR: { label: '案发事件', color: 'volcano', icon: 'WarningOutlined' },
  FORENSICS: { label: '取证事件', color: 'purple', icon: 'ScanOutlined' },
  VERIFICATION: { label: '核查事件', color: 'green', icon: 'CheckCircleOutlined' },
  INTERROGATION: { label: '询问/讯问', color: 'orange', icon: 'MessageOutlined' },
  EVIDENCE_COLLECT: { label: '证据收集', color: 'cyan', icon: 'PaperClipOutlined' },
  EVIDENCE_TRANSFER: { label: '证据流转', color: 'geekblue', icon: 'SwapOutlined' },
  PERSON_INTERVIEW: { label: '人员走访', color: 'lime', icon: 'UserOutlined' },
  SURVEILLANCE: { label: '布控监控', color: 'magenta', icon: 'EyeOutlined' },
  SEARCH: { label: '搜查行动', color: 'red', icon: 'SearchOutlined' },
  SEIZURE: { label: '扣押查封', color: 'volcano', icon: 'LockOutlined' },
  ARREST: { label: '抓捕行动', color: 'red', icon: 'SafetyOutlined' },
  DETENTION: { label: '拘留羁押', color: 'orange', icon: 'StopOutlined' },
  BAIL: { label: '取保候审', color: 'gold', icon: 'UnlockOutlined' },
  INDICTMENT: { label: '移送起诉', color: 'geekblue', icon: 'FileTextOutlined' },
  TRIAL: { label: '开庭审理', color: 'purple', icon: 'AuditOutlined' },
  JUDGMENT: { label: '判决裁定', color: 'green', icon: 'SolutionOutlined' },
  APPEAL: { label: '上诉申诉', color: 'orange', icon: 'RiseOutlined' },
  EXECUTION: { label: '判决执行', color: 'cyan', icon: 'ThunderboltOutlined' },
  CASE_FILING: { label: '立案登记', color: 'blue', icon: 'FileAddOutlined' },
  CASE_CLOSE: { label: '结案归档', color: 'green', icon: 'FolderOpenOutlined' },
  CASE_TRANSFER: { label: '案件移送', color: 'geekblue', icon: 'ShareAltOutlined' },
  MEETING: { label: '会商研讨', color: 'purple', icon: 'CoffeeOutlined' },
  TASK_ASSIGN: { label: '任务指派', color: 'blue', icon: 'SendOutlined' },
  TASK_COMPLETE: { label: '任务完成', color: 'green', icon: 'CheckSquareOutlined' },
  ALERT_TRIGGER: { label: '预警触发', color: 'red', icon: 'BellOutlined' },
  RISK_ASSESSMENT: { label: '风险评估', color: 'orange', icon: 'AlertOutlined' },
  CLUE_FOUND: { label: '线索发现', color: 'cyan', icon: 'BulbOutlined' },
  OTHER: { label: '其他事件', color: 'default', icon: 'InfoCircleOutlined' },
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/options', async () => {
    return {
      eventTypes: Object.entries(eventTypeLabels).map(([key, val]) => ({
        value: key,
        label: val.label,
        color: val.color,
        icon: val.icon,
      })),
      priorities: [
        { value: 'LOW', label: '一般', color: 'default' },
        { value: 'MEDIUM', label: '重要', color: 'blue' },
        { value: 'HIGH', label: '紧急', color: 'orange' },
        { value: 'CRITICAL', label: '特急', color: 'red' },
      ],
      sources: [
        { value: 'SYSTEM', label: '系统自动' },
        { value: 'MANUAL', label: '手工录入' },
        { value: 'IMPORT', label: '批量导入' },
        { value: 'API', label: '接口同步' },
      ],
      statuses: [
        { value: '已确认', label: '已确认' },
        { value: '待审核', label: '待审核' },
        { value: '已驳回', label: '已驳回' },
        { value: '已归档', label: '已归档' },
      ],
      operatorRoles: [
        { value: '接报案民警', label: '接报案民警' },
        { value: '主办侦查员', label: '主办侦查员' },
        { value: '协办侦查员', label: '协办侦查员' },
        { value: '技术勘查人员', label: '技术勘查人员' },
        { value: '法医鉴定人员', label: '法医鉴定人员' },
        { value: '审讯人员', label: '审讯人员' },
        { value: '情报分析人员', label: '情报分析人员' },
        { value: '法制审核人员', label: '法制审核人员' },
        { value: '指挥人员', label: '指挥人员' },
        { value: '案管人员', label: '案管人员' },
        { value: '其他角色', label: '其他角色' },
      ],
      eventTypeLabels,
    };
  });

  fastify.get('/', async (request: FastifyRequest<{ Querystring: TimelineEventQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 20,
      targetType,
      caseId,
      clueId,
      eventType,
      eventTypes,
      keyword,
      priority,
      operatorName,
      startDate,
      endDate,
      isImportant,
    } = request.query;

    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (targetType) where.targetType = targetType;
    if (caseId) where.caseId = caseId;
    if (clueId) where.clueId = clueId;
    if (eventType) where.eventType = eventType;
    if (eventTypes && eventTypes.length > 0) where.eventType = { in: eventTypes };
    if (priority) where.priority = priority;
    if (operatorName) where.operatorName = { contains: operatorName };
    if (isImportant !== undefined) where.isImportant = isImportant;

    if (startDate || endDate) {
      where.eventTime = {};
      if (startDate) where.eventTime.gte = new Date(startDate);
      if (endDate) where.eventTime.lte = new Date(endDate + 'T23:59:59');
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { eventNumber: { contains: keyword, mode: 'insensitive' } },
        { location: { contains: keyword, mode: 'insensitive' } },
        { operatorName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.timelineEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { isImportant: 'desc' },
          { eventTime: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.timelineEvent.count({ where }),
    ]);

    const stats = await prisma.timelineEvent.groupBy({
      by: ['eventType', 'priority'],
      where,
      _count: { eventType: true },
    });

    return {
      items,
      total,
      page,
      pageSize,
      stats,
      eventTypeLabels,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const event = await prisma.timelineEvent.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
        parentEvent: { select: { id: true, eventNumber: true, title: true, eventType: true } },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: '时间轴事件不存在' });
    }

    return { ...event, eventTypeLabels };
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: TimelineEventCreate }>, reply) => {
    const body = request.body;

    if (!body.targetType || (!body.caseId && !body.clueId)) {
      return reply.code(400).send({ error: '请指定目标类型和目标ID' });
    }

    const eventNumber = await generateEventNumber();
    const operator = extractOperator(request);
    const meta = getRequestMeta(request);

    const data: any = {
      eventNumber,
      targetType: body.targetType,
      caseId: body.caseId,
      clueId: body.clueId,
      eventType: body.eventType,
      eventSubtype: body.eventSubtype,
      title: body.title,
      description: body.description,
      location: body.location,
      eventTime: new Date(body.eventTime),
      priority: body.priority || 'MEDIUM',
      source: body.source || 'MANUAL',
      status: body.status || '已确认',
      operatorId: body.operatorId || operator.id,
      operatorName: body.operatorName || operator.name,
      operatorDept: body.operatorDept || operator.dept,
      operatorRole: body.operatorRole,
      participantIds: body.participantIds ? JSON.stringify(body.participantIds) : null,
      participantNames: body.participantNames ? JSON.stringify(body.participantNames) : null,
      evidenceIds: body.evidenceIds ? JSON.stringify(body.evidenceIds) : null,
      personIds: body.personIds ? JSON.stringify(body.personIds) : null,
      taskIds: body.taskIds ? JSON.stringify(body.taskIds) : null,
      meetingIds: body.meetingIds ? JSON.stringify(body.meetingIds) : null,
      forensicFileIds: body.forensicFileIds ? JSON.stringify(body.forensicFileIds) : null,
      isImportant: body.isImportant || false,
      isConfidential: body.isConfidential || false,
      confidentialLevel: body.confidentialLevel,
      parentEventId: body.parentEventId,
      relatedEventIds: body.relatedEventIds ? JSON.stringify(body.relatedEventIds) : null,
      remark: body.remark,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    };

    const event = await prisma.timelineEvent.create({ data });

    await createOperationLog({
      targetType: body.targetType === 'CASE' ? TargetType.CASE : TargetType.CLUE,
      targetId: (body.caseId || body.clueId)!,
      action: ActionType.CREATE,
      description: `创建时间轴事件: ${body.title} [${eventNumber}]`,
      operator: operator.name,
      operatorDepartment: operator.dept,
      beforeData: null,
      afterData: JSON.stringify(data),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return event;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: TimelineEventUpdate }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const existing = await prisma.timelineEvent.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: '时间轴事件不存在' });
    }

    const operator = extractOperator(request);
    const meta = getRequestMeta(request);

    const data: any = {};
    if (body.eventType !== undefined) data.eventType = body.eventType;
    if (body.eventSubtype !== undefined) data.eventSubtype = body.eventSubtype;
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.location !== undefined) data.location = body.location;
    if (body.eventTime !== undefined) data.eventTime = new Date(body.eventTime);
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.status !== undefined) data.status = body.status;
    if (body.operatorId !== undefined) data.operatorId = body.operatorId;
    if (body.operatorName !== undefined) data.operatorName = body.operatorName;
    if (body.operatorDept !== undefined) data.operatorDept = body.operatorDept;
    if (body.operatorRole !== undefined) data.operatorRole = body.operatorRole;
    if (body.participantIds !== undefined) data.participantIds = JSON.stringify(body.participantIds);
    if (body.participantNames !== undefined) data.participantNames = JSON.stringify(body.participantNames);
    if (body.evidenceIds !== undefined) data.evidenceIds = JSON.stringify(body.evidenceIds);
    if (body.personIds !== undefined) data.personIds = JSON.stringify(body.personIds);
    if (body.taskIds !== undefined) data.taskIds = JSON.stringify(body.taskIds);
    if (body.meetingIds !== undefined) data.meetingIds = JSON.stringify(body.meetingIds);
    if (body.forensicFileIds !== undefined) data.forensicFileIds = JSON.stringify(body.forensicFileIds);
    if (body.isImportant !== undefined) data.isImportant = body.isImportant;
    if (body.isConfidential !== undefined) data.isConfidential = body.isConfidential;
    if (body.confidentialLevel !== undefined) data.confidentialLevel = body.confidentialLevel;
    if (body.parentEventId !== undefined) data.parentEventId = body.parentEventId;
    if (body.relatedEventIds !== undefined) data.relatedEventIds = JSON.stringify(body.relatedEventIds);
    if (body.remark !== undefined) data.remark = body.remark;
    if (body.metadata !== undefined) data.metadata = JSON.stringify(body.metadata);

    const updated = await prisma.timelineEvent.update({ where: { id }, data });

    await createOperationLog({
      targetType: existing.targetType === 'CASE' ? TargetType.CASE : TargetType.CLUE,
      targetId: (existing.caseId || existing.clueId)!,
      action: ActionType.UPDATE,
      description: `更新时间轴事件: ${body.title || existing.title} [${existing.eventNumber}]`,
      operator: operator.name,
      operatorDepartment: operator.dept,
      beforeData: JSON.stringify(existing),
      afterData: JSON.stringify(data),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    const existing = await prisma.timelineEvent.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: '时间轴事件不存在' });
    }

    const operator = extractOperator(request);
    const meta = getRequestMeta(request);

    await prisma.timelineEvent.delete({ where: { id } });

    await createOperationLog({
      targetType: existing.targetType === 'CASE' ? TargetType.CASE : TargetType.CLUE,
      targetId: (existing.caseId || existing.clueId)!,
      action: ActionType.DELETE,
      description: `删除时间轴事件: ${existing.title} [${existing.eventNumber}]`,
      operator: operator.name,
      operatorDepartment: operator.dept,
      beforeData: JSON.stringify(existing),
      afterData: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { success: true };
  });

  fastify.post('/batch', async (request: FastifyRequest<{ Body: TimelineEventBatch }>, reply) => {
    const { ids, action } = request.body;
    const operator = extractOperator(request);
    const meta = getRequestMeta(request);

    if (action === 'DELETE') {
      const events = await prisma.timelineEvent.findMany({ where: { id: { in: ids } } });
      await prisma.timelineEvent.deleteMany({ where: { id: { in: ids } } });

      for (const ev of events) {
        await createOperationLog({
          targetType: ev.targetType === 'CASE' ? TargetType.CASE : TargetType.CLUE,
          targetId: (ev.caseId || ev.clueId)!,
          action: ActionType.DELETE,
          description: `批量删除时间轴事件: ${ev.title} [${ev.eventNumber}]`,
          operator: operator.name,
          operatorDepartment: operator.dept,
          beforeData: JSON.stringify(ev),
          afterData: null,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
      return { success: true, deletedCount: ids.length };
    }

    const updateData = action === 'IMPORTANT' ? { isImportant: true } : { isImportant: false };
    const events = await prisma.timelineEvent.findMany({ where: { id: { in: ids } } });
    const result = await prisma.timelineEvent.updateMany({ where: { id: { in: ids } }, data: updateData });

    for (const ev of events) {
      await createOperationLog({
        targetType: ev.targetType === 'CASE' ? TargetType.CASE : TargetType.CLUE,
        targetId: (ev.caseId || ev.clueId)!,
        action: ActionType.UPDATE,
        description: `${action === 'IMPORTANT' ? '标记为重要' : '取消重要标记'}时间轴事件: ${ev.title}`,
        operator: operator.name,
        operatorDepartment: operator.dept,
        beforeData: JSON.stringify(ev),
        afterData: JSON.stringify(updateData),
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    return { success: true, updatedCount: result.count };
  });

  fastify.get('/aggregate/:targetType/:targetId', async (
    request: FastifyRequest<{ Params: { targetType: 'CASE' | 'CLUE'; targetId: string } }>,
    reply
  ) => {
    const { targetType, targetId } = request.params;
    const where: any = { targetType };
    if (targetType === 'CASE') where.caseId = targetId;
    else where.clueId = targetId;

    const events = await prisma.timelineEvent.findMany({
      where,
      orderBy: [
        { isImportant: 'desc' },
        { eventTime: 'asc' },
      ],
    });

    const verifications = targetType === 'CLUE'
      ? await prisma.clueVerification.findMany({
          where: { clueId: targetId },
          include: { evidences: true },
        })
      : [];

    const evidences = await prisma.evidence.findMany({
      where: targetType === 'CASE' ? { caseId: targetId } : { clueId: targetId },
    });

    const forensicFiles = await prisma.forensicFile.findMany({
      where: targetType === 'CASE' ? { caseId: targetId } : { clueId: targetId },
    });

    const meetings = await prisma.caseMeetingMinutes.findMany({
      where: targetType === 'CASE'
        ? { caseId: targetId }
        : {
            clueRelations: { some: { clueId: targetId } },
          },
    });

    return {
      events,
      verifications,
      evidences,
      forensicFiles,
      meetings,
      eventTypeLabels,
    };
  });
}
