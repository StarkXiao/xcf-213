import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

interface MeetingQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  caseId?: string;
  status?: string;
  meetingType?: string;
  hostName?: string;
  startDate?: string;
  endDate?: string;
}

interface MeetingCreate {
  caseId: string;
  title: string;
  meetingType: string;
  location?: string;
  meetingTime?: string;
  hostId?: string;
  hostName?: string;
  hostDept?: string;
  recorderId?: string;
  recorderName?: string;
  recorderDept?: string;
  caseAnalysis?: string;
  clueAnalysis?: string;
  evidenceAnalysis?: string;
  personAnalysis?: string;
  discussionContent?: string;
  conclusion?: string;
  note?: string;
  operatorId?: string;
  operatorName?: string;
  operatorDept?: string;
}

interface MeetingUpdate extends Partial<MeetingCreate> {
  status?: string;
}

interface AttendeeCreate {
  personId?: string;
  personName: string;
  personDept?: string;
  role?: string;
  note?: string;
}

interface ClueRelationCreate {
  clueId: string;
  discussionPoint?: string;
  conclusion?: string;
}

interface EvidenceRelationCreate {
  evidenceId: string;
  discussionPoint?: string;
  conclusion?: string;
}

interface TodoItemCreate {
  title: string;
  description?: string;
  priority: string;
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeDept?: string;
  note?: string;
}

interface TodoItemToTask {
  taskType: string;
  assignerId?: string;
  assignerName?: string;
  assignerDept?: string;
  requirement?: string;
}

const getStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    DRAFT: '草稿',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
  };
  return map[status] || status;
};

const getTodoStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    PENDING: '待处理',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
  };
  return map[status] || status;
};

const transformMeeting = (meeting: any) => ({
  ...meeting,
  statusLabel: getStatusLabel(meeting.status),
});

const transformTodoItem = (item: any) => ({
  ...item,
  statusLabel: getTodoStatusLabel(item.status),
});

export default async function (fastify: FastifyInstance) {
  const generateMeetingNumber = async (): Promise<string> => {
    const count = await prisma.caseMeetingMinutes.count();
    return `HY${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
  };

  fastify.get('/', async (request: FastifyRequest<{ Querystring: MeetingQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      caseId,
      status,
      meetingType,
      hostName,
      startDate,
      endDate,
    } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { meetingNumber: { contains: keyword, mode: 'insensitive' } },
        { title: { contains: keyword, mode: 'insensitive' } },
        { conclusion: { contains: keyword, mode: 'insensitive' } },
        { discussionContent: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;
    if (meetingType) where.meetingType = meetingType;
    if (hostName) where.hostName = { contains: hostName, mode: 'insensitive' };
    if (startDate || endDate) {
      where.meetingTime = {};
      if (startDate) where.meetingTime.gte = new Date(startDate);
      if (endDate) where.meetingTime.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.caseMeetingMinutes.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: {
            select: { attendees: true, clueRelations: true, evidenceRelations: true, todoItems: true },
          },
        },
      }),
      prisma.caseMeetingMinutes.count({ where }),
    ]);

    return { items: items.map(transformMeeting), total, page, pageSize };
  });

  fastify.get('/stats', async () => {
    const [total, draft, inProgress, completed, byType] = await Promise.all([
      prisma.caseMeetingMinutes.count(),
      prisma.caseMeetingMinutes.count({ where: { status: 'DRAFT' } }),
      prisma.caseMeetingMinutes.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.caseMeetingMinutes.count({ where: { status: 'COMPLETED' } }),
      prisma.caseMeetingMinutes.groupBy({
        by: ['meetingType'],
        _count: true,
      }),
    ]);

    const typeStats: Record<string, number> = {};
    byType.forEach((item: any) => {
      typeStats[item.meetingType] = item._count;
    });

    return {
      total,
      draft,
      inProgress,
      completed,
      byType: typeStats,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const meeting = await prisma.caseMeetingMinutes.findUnique({
      where: { id: request.params.id },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
            description: true,
            caseType: true,
            status: true,
          },
        },
        attendees: {
          orderBy: { createdAt: 'asc' },
        },
        clueRelations: {
          include: {
            clue: {
              select: {
                id: true,
                clueNumber: true,
                title: true,
                clueType: true,
                status: true,
                credibility: true,
                importance: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        evidenceRelations: {
          include: {
            evidence: {
              select: {
                id: true,
                evidenceNumber: true,
                name: true,
                type: true,
                status: true,
                fileName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        todoItems: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!meeting) {
      reply.status(404).send({ error: '会商纪要不存在' });
      return;
    }

    return {
      ...transformMeeting(meeting),
      todoItems: meeting.todoItems.map(transformTodoItem),
    };
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: MeetingCreate }>, reply) => {
    const data = request.body;

    const caseItem = await prisma.case.findUnique({
      where: { id: data.caseId },
    });
    if (!caseItem) {
      reply.status(404).send({ error: '案件不存在' });
      return;
    }

    const meetingNumber = await generateMeetingNumber();

    const meeting = await prisma.caseMeetingMinutes.create({
      data: {
        meetingNumber,
        caseId: data.caseId,
        title: data.title,
        meetingType: data.meetingType,
        status: 'DRAFT',
        location: data.location,
        meetingTime: data.meetingTime ? new Date(data.meetingTime) : null,
        hostId: data.hostId,
        hostName: data.hostName,
        hostDept: data.hostDept,
        recorderId: data.recorderId,
        recorderName: data.recorderName,
        recorderDept: data.recorderDept,
        caseAnalysis: data.caseAnalysis,
        clueAnalysis: data.clueAnalysis,
        evidenceAnalysis: data.evidenceAnalysis,
        personAnalysis: data.personAnalysis,
        discussionContent: data.discussionContent,
        conclusion: data.conclusion,
        note: data.note,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        operatorDept: data.operatorDept,
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    await logCreate(
      TargetType.CASE_MEETING,
      meeting.id,
      `创建会商纪要：${meetingNumber} - ${meeting.title}`,
      request,
      meeting.operatorName || extractOperator(request),
      {
        id: meeting.id,
        meetingNumber: meeting.meetingNumber,
        title: meeting.title,
        meetingType: meeting.meetingType,
        caseId: meeting.caseId,
        caseNumber: meeting.case?.caseNumber,
      }
    );

    return transformMeeting(meeting);
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: MeetingUpdate }>, reply) => {
    try {
      const beforeMeeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!beforeMeeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const data = request.body;
      const updateData: any = { ...data };
      if (data.meetingTime) updateData.meetingTime = new Date(data.meetingTime);

      const meeting = await prisma.caseMeetingMinutes.update({
        where: { id: request.params.id },
        data: updateData,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      await logUpdate(
        TargetType.CASE_MEETING,
        meeting.id,
        `更新会商纪要：${meeting.meetingNumber} - ${meeting.title}`,
        request,
        {
          title: beforeMeeting.title,
          meetingType: beforeMeeting.meetingType,
          status: beforeMeeting.status,
          hostName: beforeMeeting.hostName,
          meetingTime: beforeMeeting.meetingTime,
        },
        {
          title: meeting.title,
          meetingType: meeting.meetingType,
          status: meeting.status,
          hostName: meeting.hostName,
          meetingTime: meeting.meetingTime,
        },
        meeting.operatorName || extractOperator(request)
      );

      return transformMeeting(meeting);
    } catch (error) {
      reply.status(404).send({ error: '会商纪要不存在' });
    }
  });

  fastify.post('/:id/complete', async (request: FastifyRequest<{ Params: { id: string }; Body: { operatorName?: string } }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const updated = await prisma.caseMeetingMinutes.update({
        where: { id: request.params.id },
        data: { status: 'COMPLETED' },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.CASE_MEETING,
        targetId: request.params.id,
        action: ActionType.MEETING_COMPLETE,
        description: `完成会商纪要：${meeting.meetingNumber} - ${meeting.title}`,
        operator: request.body.operatorName || extractOperator(request),
        beforeData: { status: meeting.status },
        afterData: { status: 'COMPLETED' },
        ...meta,
      });

      return transformMeeting(updated);
    } catch (error) {
      reply.status(400).send({ error: '完成失败' });
    }
  });

  fastify.post('/:id/cancel', async (request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string; operatorName?: string } }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const updated = await prisma.caseMeetingMinutes.update({
        where: { id: request.params.id },
        data: { status: 'CANCELLED', note: request.body.reason || meeting.note },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.CASE_MEETING,
        targetId: request.params.id,
        action: ActionType.MEETING_CANCEL,
        description: `取消会商纪要：${meeting.meetingNumber} - ${meeting.title}，原因：${request.body.reason || '无'}`,
        operator: request.body.operatorName || extractOperator(request),
        beforeData: { status: meeting.status },
        afterData: { status: 'CANCELLED', reason: request.body.reason },
        ...meta,
      });

      return transformMeeting(updated);
    } catch (error) {
      reply.status(400).send({ error: '取消失败' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const beforeMeeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });

      await prisma.$transaction([
        prisma.meetingAttendee.deleteMany({ where: { meetingId: request.params.id } }),
        prisma.meetingClue.deleteMany({ where: { meetingId: request.params.id } }),
        prisma.meetingEvidence.deleteMany({ where: { meetingId: request.params.id } }),
        prisma.meetingTodoItem.deleteMany({ where: { meetingId: request.params.id } }),
        prisma.caseMeetingMinutes.delete({ where: { id: request.params.id } }),
      ]);

      await logDelete(
        TargetType.CASE_MEETING,
        request.params.id,
        `删除会商纪要：${beforeMeeting?.meetingNumber || ''} - ${beforeMeeting?.title || ''}`,
        request,
        beforeMeeting ? {
          id: beforeMeeting.id,
          meetingNumber: beforeMeeting.meetingNumber,
          title: beforeMeeting.title,
          meetingType: beforeMeeting.meetingType,
          status: beforeMeeting.status,
        } : undefined
      );

      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '会商纪要不存在' });
    }
  });

  fastify.get('/:id/attendees', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const attendees = await prisma.meetingAttendee.findMany({
      where: { meetingId: request.params.id },
      orderBy: { createdAt: 'asc' },
    });
    return attendees;
  });

  fastify.post('/:id/attendees', async (request: FastifyRequest<{ Params: { id: string }; Body: AttendeeCreate }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const data = request.body;
      const attendee = await prisma.meetingAttendee.create({
        data: {
          meetingId: request.params.id,
          personId: data.personId,
          personName: data.personName,
          personDept: data.personDept,
          role: data.role,
          note: data.note,
        },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_ATTENDEE,
        targetId: attendee.id,
        action: ActionType.MEETING_ATTENDEE_ADD,
        description: `添加参会人员：${data.personName}（${data.role || '未指定角色'}）- 会商：${meeting.meetingNumber}`,
        operator: extractOperator(request),
        afterData: {
          meetingId: request.params.id,
          personId: data.personId,
          personName: data.personName,
          personDept: data.personDept,
          role: data.role,
        },
        ...meta,
      });

      return attendee;
    } catch (error) {
      reply.status(400).send({ error: '添加参会人员失败' });
    }
  });

  fastify.delete('/:id/attendees/:attendeeId', async (request: FastifyRequest<{ Params: { id: string; attendeeId: string } }>, reply) => {
    try {
      const attendee = await prisma.meetingAttendee.findUnique({
        where: { id: request.params.attendeeId },
      });
      if (!attendee) {
        reply.status(404).send({ error: '参会人员不存在' });
        return;
      }

      await prisma.meetingAttendee.delete({
        where: { id: request.params.attendeeId },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_ATTENDEE,
        targetId: request.params.attendeeId,
        action: ActionType.MEETING_ATTENDEE_REMOVE,
        description: `移除参会人员：${attendee.personName}`,
        operator: extractOperator(request),
        beforeData: {
          meetingId: request.params.id,
          personId: attendee.personId,
          personName: attendee.personName,
        },
        ...meta,
      });

      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '移除参会人员失败' });
    }
  });

  fastify.get('/:id/clues', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const clues = await prisma.meetingClue.findMany({
      where: { meetingId: request.params.id },
      include: {
        clue: {
          select: {
            id: true,
            clueNumber: true,
            title: true,
            clueType: true,
            status: true,
            credibility: true,
            importance: true,
            content: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return clues;
  });

  fastify.post('/:id/clues', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueRelationCreate }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const clue = await prisma.clue.findUnique({
        where: { id: request.body.clueId },
        select: { clueNumber: true, title: true },
      });
      if (!clue) {
        reply.status(404).send({ error: '线索不存在' });
        return;
      }

      const data = request.body;
      const relation = await prisma.meetingClue.create({
        data: {
          meetingId: request.params.id,
          clueId: data.clueId,
          discussionPoint: data.discussionPoint,
          conclusion: data.conclusion,
        },
        include: {
          clue: {
            select: {
              id: true,
              clueNumber: true,
              title: true,
            },
          },
        },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_CLUE,
        targetId: relation.id,
        action: ActionType.MEETING_CLUE_ADD,
        description: `关联线索：${clue.clueNumber} - ${clue.title} - 会商：${meeting.meetingNumber}`,
        operator: extractOperator(request),
        afterData: {
          meetingId: request.params.id,
          clueId: data.clueId,
          clueNumber: clue.clueNumber,
          clueTitle: clue.title,
          discussionPoint: data.discussionPoint,
          conclusion: data.conclusion,
        },
        ...meta,
      });

      return relation;
    } catch (error) {
      reply.status(400).send({ error: '关联线索失败' });
    }
  });

  fastify.put('/:id/clues/:relationId', async (request: FastifyRequest<{ Params: { id: string; relationId: string }; Body: { discussionPoint?: string; conclusion?: string } }>, reply) => {
    try {
      const relation = await prisma.meetingClue.findUnique({
        where: { id: request.params.relationId },
      });
      if (!relation) {
        reply.status(404).send({ error: '线索关联不存在' });
        return;
      }

      const data = request.body;
      const updated = await prisma.meetingClue.update({
        where: { id: request.params.relationId },
        data: {
          discussionPoint: data.discussionPoint,
          conclusion: data.conclusion,
        },
        include: {
          clue: {
            select: {
              id: true,
              clueNumber: true,
              title: true,
            },
          },
        },
      });

      return updated;
    } catch (error) {
      reply.status(400).send({ error: '更新失败' });
    }
  });

  fastify.delete('/:id/clues/:relationId', async (request: FastifyRequest<{ Params: { id: string; relationId: string } }>, reply) => {
    try {
      const relation = await prisma.meetingClue.findUnique({
        where: { id: request.params.relationId },
        include: { clue: { select: { clueNumber: true, title: true } } },
      });
      if (!relation) {
        reply.status(404).send({ error: '线索关联不存在' });
        return;
      }

      await prisma.meetingClue.delete({
        where: { id: request.params.relationId },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_CLUE,
        targetId: request.params.relationId,
        action: ActionType.MEETING_CLUE_REMOVE,
        description: `移除关联线索：${relation.clue?.clueNumber} - ${relation.clue?.title}`,
        operator: extractOperator(request),
        beforeData: {
          meetingId: request.params.id,
          clueId: relation.clueId,
        },
        ...meta,
      });

      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '移除关联线索失败' });
    }
  });

  fastify.get('/:id/evidences', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const evidences = await prisma.meetingEvidence.findMany({
      where: { meetingId: request.params.id },
      include: {
        evidence: {
          select: {
            id: true,
            evidenceNumber: true,
            name: true,
            type: true,
            status: true,
            fileName: true,
            fileSize: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return evidences;
  });

  fastify.post('/:id/evidences', async (request: FastifyRequest<{ Params: { id: string }; Body: EvidenceRelationCreate }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const evidence = await prisma.evidence.findUnique({
        where: { id: request.body.evidenceId },
        select: { evidenceNumber: true, name: true },
      });
      if (!evidence) {
        reply.status(404).send({ error: '证据不存在' });
        return;
      }

      const data = request.body;
      const relation = await prisma.meetingEvidence.create({
        data: {
          meetingId: request.params.id,
          evidenceId: data.evidenceId,
          discussionPoint: data.discussionPoint,
          conclusion: data.conclusion,
        },
        include: {
          evidence: {
            select: {
              id: true,
              evidenceNumber: true,
              name: true,
            },
          },
        },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_EVIDENCE,
        targetId: relation.id,
        action: ActionType.MEETING_EVIDENCE_ADD,
        description: `关联证据：${evidence.evidenceNumber} - ${evidence.name} - 会商：${meeting.meetingNumber}`,
        operator: extractOperator(request),
        afterData: {
          meetingId: request.params.id,
          evidenceId: data.evidenceId,
          evidenceNumber: evidence.evidenceNumber,
          evidenceName: evidence.name,
          discussionPoint: data.discussionPoint,
          conclusion: data.conclusion,
        },
        ...meta,
      });

      return relation;
    } catch (error) {
      reply.status(400).send({ error: '关联证据失败' });
    }
  });

  fastify.put('/:id/evidences/:relationId', async (request: FastifyRequest<{ Params: { id: string; relationId: string }; Body: { discussionPoint?: string; conclusion?: string } }>, reply) => {
    try {
      const relation = await prisma.meetingEvidence.findUnique({
        where: { id: request.params.relationId },
      });
      if (!relation) {
        reply.status(404).send({ error: '证据关联不存在' });
        return;
      }

      const data = request.body;
      const updated = await prisma.meetingEvidence.update({
        where: { id: request.params.relationId },
        data: {
          discussionPoint: data.discussionPoint,
          conclusion: data.conclusion,
        },
        include: {
          evidence: {
            select: {
              id: true,
              evidenceNumber: true,
              name: true,
            },
          },
        },
      });

      return updated;
    } catch (error) {
      reply.status(400).send({ error: '更新失败' });
    }
  });

  fastify.delete('/:id/evidences/:relationId', async (request: FastifyRequest<{ Params: { id: string; relationId: string } }>, reply) => {
    try {
      const relation = await prisma.meetingEvidence.findUnique({
        where: { id: request.params.relationId },
        include: { evidence: { select: { evidenceNumber: true, name: true } } },
      });
      if (!relation) {
        reply.status(404).send({ error: '证据关联不存在' });
        return;
      }

      await prisma.meetingEvidence.delete({
        where: { id: request.params.relationId },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_EVIDENCE,
        targetId: request.params.relationId,
        action: ActionType.MEETING_EVIDENCE_REMOVE,
        description: `移除关联证据：${relation.evidence?.evidenceNumber} - ${relation.evidence?.name}`,
        operator: extractOperator(request),
        beforeData: {
          meetingId: request.params.id,
          evidenceId: relation.evidenceId,
        },
        ...meta,
      });

      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '移除关联证据失败' });
    }
  });

  fastify.get('/:id/todos', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const todos = await prisma.meetingTodoItem.findMany({
      where: { meetingId: request.params.id },
      include: {
        task: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return todos.map(transformTodoItem);
  });

  fastify.post('/:id/todos', async (request: FastifyRequest<{ Params: { id: string }; Body: TodoItemCreate }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const data = request.body;
      const todoItem = await prisma.meetingTodoItem.create({
        data: {
          meetingId: request.params.id,
          title: data.title,
          description: data.description,
          priority: data.priority,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          assigneeId: data.assigneeId,
          assigneeName: data.assigneeName,
          assigneeDept: data.assigneeDept,
          status: 'PENDING',
          note: data.note,
        },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_TODO,
        targetId: todoItem.id,
        action: ActionType.MEETING_TODO_ADD,
        description: `添加会商待办：${data.title} - 会商：${meeting.meetingNumber}`,
        operator: extractOperator(request),
        afterData: {
          meetingId: request.params.id,
          title: data.title,
          priority: data.priority,
          assigneeName: data.assigneeName,
          dueDate: data.dueDate,
        },
        ...meta,
      });

      return transformTodoItem(todoItem);
    } catch (error) {
      reply.status(400).send({ error: '添加待办失败' });
    }
  });

  fastify.put('/:id/todos/:todoId', async (request: FastifyRequest<{ Params: { id: string; todoId: string }; Body: { title?: string; description?: string; priority?: string; dueDate?: string; assigneeId?: string; assigneeName?: string; assigneeDept?: string; status?: string; note?: string } }>, reply) => {
    try {
      const todoItem = await prisma.meetingTodoItem.findUnique({
        where: { id: request.params.todoId },
      });
      if (!todoItem) {
        reply.status(404).send({ error: '待办项不存在' });
        return;
      }

      const data = request.body;
      const updateData: any = { ...data };
      if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

      const updated = await prisma.meetingTodoItem.update({
        where: { id: request.params.todoId },
        data: updateData,
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_TODO,
        targetId: request.params.todoId,
        action: ActionType.MEETING_TODO_UPDATE,
        description: `更新会商待办：${todoItem.title}`,
        operator: extractOperator(request),
        beforeData: {
          title: todoItem.title,
          priority: todoItem.priority,
          status: todoItem.status,
          assigneeName: todoItem.assigneeName,
        },
        afterData: {
          title: updated.title,
          priority: updated.priority,
          status: updated.status,
          assigneeName: updated.assigneeName,
        },
        ...meta,
      });

      return transformTodoItem(updated);
    } catch (error) {
      reply.status(400).send({ error: '更新待办失败' });
    }
  });

  fastify.delete('/:id/todos/:todoId', async (request: FastifyRequest<{ Params: { id: string; todoId: string } }>, reply) => {
    try {
      const todoItem = await prisma.meetingTodoItem.findUnique({
        where: { id: request.params.todoId },
      });
      if (!todoItem) {
        reply.status(404).send({ error: '待办项不存在' });
        return;
      }

      await prisma.meetingTodoItem.delete({
        where: { id: request.params.todoId },
      });

      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '删除待办失败' });
    }
  });

  fastify.post('/:id/todos/:todoId/to-task', async (request: FastifyRequest<{ Params: { id: string; todoId: string }; Body: TodoItemToTask }>, reply) => {
    try {
      const meeting = await prisma.caseMeetingMinutes.findUnique({
        where: { id: request.params.id },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
      });
      if (!meeting) {
        reply.status(404).send({ error: '会商纪要不存在' });
        return;
      }

      const todoItem = await prisma.meetingTodoItem.findUnique({
        where: { id: request.params.todoId },
      });
      if (!todoItem) {
        reply.status(404).send({ error: '待办项不存在' });
        return;
      }

      if (todoItem.taskId) {
        reply.status(400).send({ error: '该待办项已落地为任务' });
        return;
      }

      const data = request.body;
      const taskCount = await prisma.commandTask.count();
      const taskNumber = `RW${new Date().getFullYear()}${String(taskCount + 1).padStart(6, '0')}`;

      const task = await prisma.commandTask.create({
        data: {
          taskNumber,
          title: todoItem.title,
          description: todoItem.description || `来自会商纪要：${meeting.meetingNumber} - ${meeting.title}`,
          taskType: data.taskType as any,
          priority: todoItem.priority as any,
          status: 'PENDING',
          progress: 0,
          caseId: meeting.caseId,
          assigneeId: todoItem.assigneeId,
          assigneeName: todoItem.assigneeName,
          assigneeDept: todoItem.assigneeDept,
          assignerId: data.assignerId,
          assignerName: data.assignerName,
          assignerDept: data.assignerDept,
          dueDate: todoItem.dueDate,
          requirement: data.requirement || todoItem.note,
          note: `会商纪要来源：${meeting.meetingNumber} - ${meeting.title}\n待办项ID：${todoItem.id}`,
        },
      });

      const updatedTodo = await prisma.meetingTodoItem.update({
        where: { id: request.params.todoId },
        data: {
          taskId: task.id,
          status: 'IN_PROGRESS',
        },
        include: {
          task: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              priority: true,
            },
          },
        },
      });

      const meta = getRequestMeta(request);
      await createOperationLog({
        targetType: TargetType.MEETING_TODO,
        targetId: request.params.todoId,
        action: ActionType.MEETING_TODO_TO_TASK,
        description: `会商待办落地为任务：${todoItem.title} → ${taskNumber}`,
        operator: data.assignerName || extractOperator(request),
        afterData: {
          meetingId: request.params.id,
          todoId: request.params.todoId,
          taskId: task.id,
          taskNumber,
          taskType: data.taskType,
        },
        ...meta,
      });

      await logCreate(
        TargetType.COMMAND_TASK,
        task.id,
        `创建任务（来自会商待办）：${taskNumber} - ${task.title}`,
        request,
        task.assignerName || extractOperator(request),
        {
          id: task.id,
          taskNumber: task.taskNumber,
          title: task.title,
          taskType: task.taskType,
          priority: task.priority,
          status: task.status,
          assigneeName: task.assigneeName,
          caseId: task.caseId,
          source: 'meeting_todo',
          meetingId: request.params.id,
          meetingNumber: meeting.meetingNumber,
          todoId: request.params.todoId,
        }
      );

      return transformTodoItem(updatedTodo);
    } catch (error) {
      console.error('落地任务失败:', error);
      reply.status(400).send({ error: '落地任务失败' });
    }
  });
}
