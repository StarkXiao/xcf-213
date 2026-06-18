import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import {
  TargetType,
  ActionType,
  createOperationLog,
  getRequestMeta,
} from '../lib/operationLog';

interface ClueCheckFlowQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  currentStage?: string;
  clueId?: string;
  caseId?: string;
  priority?: string;
  registerUserName?: string;
  dispatchToUserName?: string;
  verifyUserName?: string;
  startDate?: string;
  endDate?: string;
}

interface ClueCheckRegisterCreate {
  clueId: string;
  caseId?: string;
  title: string;
  priority?: string;
  registerContent?: string;
  registerSource?: string;
  registerLocation?: string;
  registerTime?: string;
  registerUserId?: string;
  registerUserName?: string;
  registerUserDept?: string;
}

interface ClueCheckDispatchCreate {
  dispatchUserId?: string;
  dispatchUserName?: string;
  dispatchUserDept?: string;
  dispatchToUserId?: string;
  dispatchToUserName: string;
  dispatchToUserDept?: string;
  dispatchDeadline?: string;
  dispatchRemark?: string;
}

interface ClueCheckVerifyCreate {
  verifyUserId?: string;
  verifyUserName: string;
  verifyUserDept?: string;
  verifyResult: string;
  verifyConclusion?: string;
  verifyLocation?: string;
  verifyEvidenceIds?: string[];
  verifyTime?: string;
}

interface ClueCheckFeedbackCreate {
  feedbackUserId?: string;
  feedbackUserName: string;
  feedbackUserDept?: string;
  feedbackContent: string;
  feedbackResult?: string;
  feedbackEvidenceIds?: string[];
  feedbackTime?: string;
}

interface ClueCheckAdoptCreate {
  adoptUserId?: string;
  adoptUserName: string;
  adoptUserDept?: string;
  adoptResult: string;
  adoptOpinion?: string;
  adoptToCaseId?: string;
  adoptEvidenceIds?: string[];
  adoptTime?: string;
}

interface ClueCheckRejectCreate {
  rejectUserId?: string;
  rejectUserName: string;
  rejectUserDept?: string;
  rejectReason: string;
  rejectTime?: string;
}

interface ClueCheckCloseCreate {
  closeUserId?: string;
  closeUserName: string;
  closeUserDept?: string;
  closeReason?: string;
  closeTime?: string;
}

const createCheckLog = async (
  flowId: string,
  stage: string,
  action: string,
  description: string,
  request: FastifyRequest,
  beforeData?: any,
  afterData?: any,
  operatorName?: string,
  operatorDept?: string
) => {
  await prisma.clueCheckLog.create({
    data: {
      flowId,
      stage: stage as any,
      action,
      description,
      beforeData: beforeData ? JSON.stringify(beforeData) : null,
      afterData: afterData ? JSON.stringify(afterData) : null,
      operatorName,
      operatorDept,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || undefined,
    },
  });
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: ClueCheckFlowQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      currentStage,
      clueId,
      caseId,
      priority,
      registerUserName,
      dispatchToUserName,
      verifyUserName,
      startDate,
      endDate,
    } = request.query;

    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { flowNumber: { contains: keyword, mode: 'insensitive' } },
        { registerContent: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (currentStage) where.currentStage = currentStage;
    if (clueId) where.clueId = clueId;
    if (caseId) where.caseId = caseId;
    if (priority) where.priority = priority;
    if (registerUserName) where.registerUserName = { contains: registerUserName };
    if (dispatchToUserName) where.dispatchToUserName = { contains: dispatchToUserName };
    if (verifyUserName) where.verifyUserName = { contains: verifyUserName };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }

    const [items, total] = await Promise.all([
      prisma.clueCheckFlow.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true, status: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: { select: { operationLogs: true } },
        },
      }),
      prisma.clueCheckFlow.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/stats', async (request, reply) => {
    const [total, byStatus, byStage] = await Promise.all([
      prisma.clueCheckFlow.count(),
      prisma.clueCheckFlow.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.clueCheckFlow.groupBy({
        by: ['currentStage'],
        _count: { currentStage: true },
      }),
    ]);

    const byStatusMap: Record<string, number> = {};
    byStatus.forEach((item: any) => {
      byStatusMap[item.status] = item._count.status;
    });

    const byStageMap: Record<string, number> = {};
    byStage.forEach((item: any) => {
      byStageMap[item.currentStage] = item._count.currentStage;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.clueCheckFlow.count({
      where: { createdAt: { gte: today } },
    });

    return {
      total,
      byStatus: byStatusMap,
      byStage: byStageMap,
      todayCount,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const flow = await prisma.clueCheckFlow.findUnique({
      where: { id: request.params.id },
      include: {
        clue: {
          select: {
            id: true,
            clueNumber: true,
            title: true,
            content: true,
            status: true,
            clueType: true,
            source: true,
            credibility: true,
            importance: true,
          },
        },
        case: { select: { id: true, caseNumber: true, title: true } },
        operationLogs: {
          orderBy: { actionTime: 'desc' },
          take: 200,
        },
      },
    });

    if (!flow) {
      reply.status(404).send({ error: '核查流程不存在' });
      return;
    }

    let approvals: any[] = [];
    let clueAdoptApproval: any = null;

    if (flow.clueId) {
      approvals = await prisma.approvalInstance.findMany({
        where: { targetId: flow.clueId, targetType: 'CLUE' },
        include: {
          records: { orderBy: { actionTime: 'desc' } },
          flow: { include: { nodes: { orderBy: { level: 'asc' } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      clueAdoptApproval = await prisma.approvalInstance.findFirst({
        where: {
          targetId: flow.clueId,
          targetType: 'CLUE',
          category: 'CLUE_ADOPT',
          status: { in: ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'ROLLED_BACK'] },
        },
        include: {
          records: { orderBy: { actionTime: 'desc' } },
          flow: { include: { nodes: { orderBy: { level: 'asc' } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const transformApproval = (a: any) => ({
      ...a,
      categoryLabel: a.category === 'CLUE_ADOPT' ? '线索采用' : a.category,
      statusLabel:
        a.status === 'PENDING' ? '待审批' :
        a.status === 'IN_PROGRESS' ? '审批中' :
        a.status === 'APPROVED' ? '已通过' :
        a.status === 'REJECTED' ? '已驳回' :
        a.status === 'ROLLED_BACK' ? '已回退' :
        a.status === 'CANCELLED' ? '已取消' : a.status,
    });

    return {
      ...flow,
      approvals: approvals.map(transformApproval),
      clueAdoptApproval: clueAdoptApproval ? transformApproval(clueAdoptApproval) : null,
    };
  });

  fastify.post('/register', async (request: FastifyRequest<{ Body: ClueCheckRegisterCreate }>, reply) => {
    const data = request.body;

    try {
      const count = await prisma.clueCheckFlow.count();
      const flowNumber = `HC${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      const flow = await prisma.clueCheckFlow.create({
        data: {
          flowNumber,
          clueId: data.clueId,
          caseId: data.caseId,
          title: data.title,
          priority: data.priority,
          registerContent: data.registerContent,
          registerSource: data.registerSource,
          registerLocation: data.registerLocation,
          registerTime: data.registerTime ? new Date(data.registerTime) : new Date(),
          registerUserId: data.registerUserId,
          registerUserName: data.registerUserName,
          registerUserDept: data.registerUserDept,
          status: 'REGISTERED',
          currentStage: 'REGISTER',
        },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      await createCheckLog(
        flow.id,
        'REGISTER',
        'REGISTER',
        `登记线索核查流程：${flowNumber} - ${flow.title}`,
        request,
        null,
        {
          id: flow.id,
          flowNumber,
          title: flow.title,
          clueId: flow.clueId,
          registerUserName: flow.registerUserName,
        },
        data.registerUserName,
        data.registerUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_REGISTER,
        description: `登记线索核查：${flowNumber} - ${flow.title}`,
        operator: data.registerUserName,
        operatorDepartment: data.registerUserDept,
        afterData: {
          id: flow.id,
          flowNumber,
          title: flow.title,
          clueId: flow.clueId,
          caseId: flow.caseId,
        },
        ...getRequestMeta(request),
      });

      if (data.clueId) {
        await createOperationLog({
          targetType: TargetType.CLUE,
          targetId: data.clueId,
          action: ActionType.CHECK_REGISTER,
          description: `发起线索核查流程：${flowNumber}`,
          operator: data.registerUserName,
          operatorDepartment: data.registerUserDept,
          afterData: { flowId: flow.id, flowNumber },
          ...getRequestMeta(request),
        });
      }

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '登记失败：' + (error.message || '未知错误') });
    }
  });

  fastify.post('/:id/dispatch', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueCheckDispatchCreate }>, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id } });
      if (!beforeFlow) {
        reply.status(404).send({ error: '核查流程不存在' });
        return;
      }

      const flow = await prisma.clueCheckFlow.update({
        where: { id },
        data: {
          dispatchTime: new Date(),
          dispatchUserId: data.dispatchUserId,
          dispatchUserName: data.dispatchUserName,
          dispatchUserDept: data.dispatchUserDept,
          dispatchToUserId: data.dispatchToUserId,
          dispatchToUserName: data.dispatchToUserName,
          dispatchToUserDept: data.dispatchToUserDept,
          dispatchDeadline: data.dispatchDeadline ? new Date(data.dispatchDeadline) : null,
          dispatchRemark: data.dispatchRemark,
          status: 'DISPATCHED',
          currentStage: 'DISPATCH',
        },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      await createCheckLog(
        flow.id,
        'DISPATCH',
        'DISPATCH',
        `派发线索核查任务给 ${data.dispatchToUserName}${data.dispatchDeadline ? '，截止时间：' + data.dispatchDeadline : ''}${data.dispatchRemark ? '，备注：' + data.dispatchRemark : ''}`,
        request,
        {
          status: beforeFlow.status,
          currentStage: beforeFlow.currentStage,
          dispatchToUserName: beforeFlow.dispatchToUserName,
        },
        {
          status: flow.status,
          currentStage: flow.currentStage,
          dispatchToUserName: flow.dispatchToUserName,
          dispatchDeadline: flow.dispatchDeadline,
        },
        data.dispatchUserName,
        data.dispatchUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_DISPATCH,
        description: `派发核查任务：${flow.flowNumber} 给 ${data.dispatchToUserName}`,
        operator: data.dispatchUserName,
        operatorDepartment: data.dispatchUserDept,
        beforeData: { status: beforeFlow.status },
        afterData: {
          status: flow.status,
          dispatchToUserName: data.dispatchToUserName,
          dispatchDeadline: data.dispatchDeadline,
        },
        ...getRequestMeta(request),
      });

      if (flow.clueId) {
        await createOperationLog({
          targetType: TargetType.CLUE,
          targetId: flow.clueId,
          action: ActionType.CHECK_DISPATCH,
          description: `核查派发：${flow.flowNumber} - 派发给 ${data.dispatchToUserName}`,
          operator: data.dispatchUserName,
          operatorDepartment: data.dispatchUserDept,
          afterData: { flowId: flow.id, dispatchToUserName: data.dispatchToUserName },
          ...getRequestMeta(request),
        });
      }

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '派发失败：' + (error.message || '未知错误') });
    }
  });

  fastify.post('/:id/verify', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueCheckVerifyCreate }>, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id } });
      if (!beforeFlow) {
        reply.status(404).send({ error: '核查流程不存在' });
        return;
      }

      const flow = await prisma.clueCheckFlow.update({
        where: { id },
        data: {
          verifyTime: data.verifyTime ? new Date(data.verifyTime) : new Date(),
          verifyUserId: data.verifyUserId,
          verifyUserName: data.verifyUserName,
          verifyUserDept: data.verifyUserDept,
          verifyResult: data.verifyResult,
          verifyConclusion: data.verifyConclusion,
          verifyLocation: data.verifyLocation,
          verifyEvidenceIds: data.verifyEvidenceIds ? data.verifyEvidenceIds.join(',') : null,
          status: 'VERIFYING',
          currentStage: 'VERIFY',
        },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      await createCheckLog(
        flow.id,
        'VERIFY',
        'VERIFY',
        `核实线索：${data.verifyResult}${data.verifyConclusion ? '，核实结论：' + data.verifyConclusion : ''}`,
        request,
        {
          status: beforeFlow.status,
          currentStage: beforeFlow.currentStage,
        },
        {
          status: flow.status,
          currentStage: flow.currentStage,
          verifyResult: data.verifyResult,
          verifyConclusion: data.verifyConclusion,
        },
        data.verifyUserName,
        data.verifyUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_VERIFY,
        description: `核实线索：${flow.flowNumber} - ${data.verifyResult}`,
        operator: data.verifyUserName,
        operatorDepartment: data.verifyUserDept,
        beforeData: { status: beforeFlow.status },
        afterData: {
          status: flow.status,
          verifyResult: data.verifyResult,
          verifyConclusion: data.verifyConclusion,
        },
        ...getRequestMeta(request),
      });

      if (flow.clueId) {
        await createOperationLog({
          targetType: TargetType.CLUE,
          targetId: flow.clueId,
          action: ActionType.CHECK_VERIFY,
          description: `线索核实：${flow.flowNumber} - ${data.verifyResult}`,
          operator: data.verifyUserName,
          operatorDepartment: data.verifyUserDept,
          afterData: { flowId: flow.id, verifyResult: data.verifyResult },
          ...getRequestMeta(request),
        });
      }

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '核实失败：' + (error.message || '未知错误') });
    }
  });

  fastify.post('/:id/feedback', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueCheckFeedbackCreate }>, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id } });
      if (!beforeFlow) {
        reply.status(404).send({ error: '核查流程不存在' });
        return;
      }

      const flow = await prisma.clueCheckFlow.update({
        where: { id },
        data: {
          feedbackTime: data.feedbackTime ? new Date(data.feedbackTime) : new Date(),
          feedbackUserId: data.feedbackUserId,
          feedbackUserName: data.feedbackUserName,
          feedbackUserDept: data.feedbackUserDept,
          feedbackContent: data.feedbackContent,
          feedbackResult: data.feedbackResult,
          feedbackEvidenceIds: data.feedbackEvidenceIds ? data.feedbackEvidenceIds.join(',') : null,
          status: 'FEEDBACKED',
          currentStage: 'FEEDBACK',
        },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      await createCheckLog(
        flow.id,
        'FEEDBACK',
        'FEEDBACK',
        `反馈核查结果：${data.feedbackContent.substring(0, 100)}${data.feedbackResult ? '，反馈结论：' + data.feedbackResult : ''}`,
        request,
        {
          status: beforeFlow.status,
          currentStage: beforeFlow.currentStage,
        },
        {
          status: flow.status,
          currentStage: flow.currentStage,
          feedbackResult: data.feedbackResult,
        },
        data.feedbackUserName,
        data.feedbackUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_FEEDBACK,
        description: `核查反馈：${flow.flowNumber}${data.feedbackResult ? ' - ' + data.feedbackResult : ''}`,
        operator: data.feedbackUserName,
        operatorDepartment: data.feedbackUserDept,
        beforeData: { status: beforeFlow.status },
        afterData: {
          status: flow.status,
          feedbackContent: data.feedbackContent,
          feedbackResult: data.feedbackResult,
        },
        ...getRequestMeta(request),
      });

      if (flow.clueId) {
        await createOperationLog({
          targetType: TargetType.CLUE,
          targetId: flow.clueId,
          action: ActionType.CHECK_FEEDBACK,
          description: `核查反馈：${flow.flowNumber}${data.feedbackResult ? ' - ' + data.feedbackResult : ''}`,
          operator: data.feedbackUserName,
          operatorDepartment: data.feedbackUserDept,
          afterData: { flowId: flow.id, feedbackResult: data.feedbackResult },
          ...getRequestMeta(request),
        });
      }

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '反馈失败：' + (error.message || '未知错误') });
    }
  });

  fastify.post('/:id/adopt', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueCheckAdoptCreate }>, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id } });
      if (!beforeFlow) {
        reply.status(404).send({ error: '核查流程不存在' });
        return;
      }

      if (beforeFlow.clueId) {
        const approvedApproval = await prisma.approvalInstance.findFirst({
          where: {
            targetId: beforeFlow.clueId,
            targetType: 'CLUE',
            category: 'CLUE_ADOPT',
            status: 'APPROVED',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!approvedApproval) {
          return reply.status(400).send({
            error: '线索采用需先通过多级审批，请先在核查详情页发起线索采用审批流程。审批通过后方可执行采用操作。',
            code: 'APPROVAL_REQUIRED',
          });
        }
      }

      const updateData: any = {
        adoptTime: data.adoptTime ? new Date(data.adoptTime) : new Date(),
        adoptUserId: data.adoptUserId,
        adoptUserName: data.adoptUserName,
        adoptUserDept: data.adoptUserDept,
        adoptResult: data.adoptResult,
        adoptOpinion: data.adoptOpinion,
        adoptEvidenceIds: data.adoptEvidenceIds ? data.adoptEvidenceIds.join(',') : null,
        status: 'ADOPTED',
        currentStage: 'ADOPT',
      };

      if (data.adoptToCaseId) {
        updateData.caseId = data.adoptToCaseId;
        updateData.adoptToCaseId = data.adoptToCaseId;
      }

      const flow = await prisma.clueCheckFlow.update({
        where: { id },
        data: updateData,
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      if (data.adoptToCaseId && flow.clueId) {
        await prisma.clue.update({
          where: { id: flow.clueId },
          data: { caseId: data.adoptToCaseId, status: '已采用' },
        });
      } else if (flow.clueId) {
        await prisma.clue.update({
          where: { id: flow.clueId },
          data: { status: '已采用' },
        });
      }

      await createCheckLog(
        flow.id,
        'ADOPT',
        'ADOPT',
        `采用核查结果：${data.adoptResult}${data.adoptOpinion ? '，采用意见：' + data.adoptOpinion : ''}${data.adoptToCaseId ? '，归档至案件：' + data.adoptToCaseId : ''}`,
        request,
        {
          status: beforeFlow.status,
          currentStage: beforeFlow.currentStage,
        },
        {
          status: flow.status,
          currentStage: flow.currentStage,
          adoptResult: data.adoptResult,
          adoptToCaseId: data.adoptToCaseId,
        },
        data.adoptUserName,
        data.adoptUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_ADOPT,
        description: `采用核查：${flow.flowNumber} - ${data.adoptResult}`,
        operator: data.adoptUserName,
        operatorDepartment: data.adoptUserDept,
        beforeData: { status: beforeFlow.status },
        afterData: {
          status: flow.status,
          adoptResult: data.adoptResult,
          adoptToCaseId: data.adoptToCaseId,
        },
        ...getRequestMeta(request),
      });

      if (flow.clueId) {
        await createOperationLog({
          targetType: TargetType.CLUE,
          targetId: flow.clueId,
          action: ActionType.CHECK_ADOPT,
          description: `线索已采用：${flow.flowNumber} - ${data.adoptResult}`,
          operator: data.adoptUserName,
          operatorDepartment: data.adoptUserDept,
          afterData: { flowId: flow.id, adoptResult: data.adoptResult, adoptToCaseId: data.adoptToCaseId },
          ...getRequestMeta(request),
        });
      }

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '采用失败：' + (error.message || '未知错误') });
    }
  });

  fastify.post('/:id/reject', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueCheckRejectCreate }>, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id } });
      if (!beforeFlow) {
        reply.status(404).send({ error: '核查流程不存在' });
        return;
      }

      const flow = await prisma.clueCheckFlow.update({
        where: { id },
        data: {
          rejectTime: data.rejectTime ? new Date(data.rejectTime) : new Date(),
          rejectUserId: data.rejectUserId,
          rejectUserName: data.rejectUserName,
          rejectUserDept: data.rejectUserDept,
          rejectReason: data.rejectReason,
          status: 'REJECTED',
        },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      if (flow.clueId) {
        await prisma.clue.update({
          where: { id: flow.clueId },
          data: { status: '已排除' },
        });
      }

      await createCheckLog(
        flow.id,
        flow.currentStage as any,
        'REJECT',
        `不予采用/驳回：${data.rejectReason}`,
        request,
        {
          status: beforeFlow.status,
        },
        {
          status: flow.status,
          rejectReason: data.rejectReason,
        },
        data.rejectUserName,
        data.rejectUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_REJECT,
        description: `驳回核查：${flow.flowNumber} - ${data.rejectReason}`,
        operator: data.rejectUserName,
        operatorDepartment: data.rejectUserDept,
        beforeData: { status: beforeFlow.status },
        afterData: { status: flow.status, rejectReason: data.rejectReason },
        ...getRequestMeta(request),
      });

      if (flow.clueId) {
        await createOperationLog({
          targetType: TargetType.CLUE,
          targetId: flow.clueId,
          action: ActionType.CHECK_REJECT,
          description: `核查驳回：${flow.flowNumber} - ${data.rejectReason}`,
          operator: data.rejectUserName,
          operatorDepartment: data.rejectUserDept,
          afterData: { flowId: flow.id, rejectReason: data.rejectReason },
          ...getRequestMeta(request),
        });
      }

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '驳回失败：' + (error.message || '未知错误') });
    }
  });

  fastify.post('/:id/close', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueCheckCloseCreate }>, reply) => {
    const { id } = request.params;
    const data = request.body;

    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id } });
      if (!beforeFlow) {
        reply.status(404).send({ error: '核查流程不存在' });
        return;
      }

      const flow = await prisma.clueCheckFlow.update({
        where: { id },
        data: {
          closeTime: data.closeTime ? new Date(data.closeTime) : new Date(),
          closeUserId: data.closeUserId,
          closeUserName: data.closeUserName,
          closeUserDept: data.closeUserDept,
          closeReason: data.closeReason,
          status: 'CLOSED',
        },
        include: {
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      });

      await createCheckLog(
        flow.id,
        flow.currentStage as any,
        'CLOSE',
        `关闭核查流程${data.closeReason ? '，原因：' + data.closeReason : ''}`,
        request,
        { status: beforeFlow.status },
        { status: flow.status, closeReason: data.closeReason },
        data.closeUserName,
        data.closeUserDept
      );

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: flow.id,
        action: ActionType.CHECK_CLOSE,
        description: `关闭核查：${flow.flowNumber}${data.closeReason ? ' - ' + data.closeReason : ''}`,
        operator: data.closeUserName,
        operatorDepartment: data.closeUserDept,
        beforeData: { status: beforeFlow.status },
        afterData: { status: flow.status, closeReason: data.closeReason },
        ...getRequestMeta(request),
      });

      return flow;
    } catch (error: any) {
      reply.status(400).send({ error: '关闭失败：' + (error.message || '未知错误') });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const beforeFlow = await prisma.clueCheckFlow.findUnique({ where: { id: request.params.id } });

      await prisma.clueCheckLog.deleteMany({ where: { flowId: request.params.id } });
      await prisma.clueCheckFlow.delete({ where: { id: request.params.id } });

      await createOperationLog({
        targetType: TargetType.CLUE_CHECK_FLOW,
        targetId: request.params.id,
        action: ActionType.DELETE,
        description: `删除线索核查流程：${beforeFlow?.flowNumber || ''} - ${beforeFlow?.title || ''}`,
        beforeData: beforeFlow ? {
          id: beforeFlow.id,
          flowNumber: beforeFlow.flowNumber,
          title: beforeFlow.title,
          status: beforeFlow.status,
          clueId: beforeFlow.clueId,
        } : undefined,
        ...getRequestMeta(request),
      });

      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '删除失败' });
    }
  });

  fastify.get('/:id/logs', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; pageSize?: number } }>, reply) => {
    const { page = 1, pageSize = 50 } = request.query;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.clueCheckLog.findMany({
        where: { flowId: request.params.id },
        skip,
        take: pageSize,
        orderBy: { actionTime: 'desc' },
      }),
      prisma.clueCheckLog.count({ where: { flowId: request.params.id } }),
    ]);

    return { items, total, page, pageSize };
  });
}
