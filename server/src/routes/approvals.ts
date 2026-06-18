import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import {
  TargetType,
  ActionType,
  createOperationLog,
  getRequestMeta,
  extractOperator,
} from '../lib/operationLog';

const categoryLabels: Record<string, string> = {
  CASE_FILING: '案件立案',
  CLUE_ADOPT: '线索采用',
  EVIDENCE_CHECKOUT: '证据出库',
  EVIDENCE_DESTROY: '证据销毁',
  CASE_TRANSFER: '案件移送',
  CASE_CLOSE: '结案归档',
  FORENSIC_IMPORT: '电子取证导入',
  OTHER: '其他审批',
};

const statusLabels: Record<string, string> = {
  PENDING: '待审批',
  IN_PROGRESS: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  ROLLED_BACK: '已回退',
  CANCELLED: '已取消',
};

const actionLabels: Record<string, string> = {
  APPROVE: '通过',
  REJECT: '驳回',
  ROLLBACK: '回退',
  SUBMIT: '提交',
  CANCEL: '取消',
  URGE: '催办',
};

const generateFlowNumber = async () => {
  const date = new Date();
  const prefix = `SP${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const last = await prisma.approvalFlow.findFirst({
    where: { flowNumber: { startsWith: prefix } },
    orderBy: { flowNumber: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.flowNumber.substring(prefix.length), 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const generateInstanceNumber = async () => {
  const date = new Date();
  const prefix = `SPS${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const last = await prisma.approvalInstance.findFirst({
    where: { instanceNumber: { startsWith: prefix } },
    orderBy: { instanceNumber: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.instanceNumber.substring(prefix.length), 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

interface FlowCreate {
  name: string;
  category: string;
  description?: string;
  isDefault?: boolean;
  nodes: Array<{
    level: number;
    name: string;
    approverRole?: string;
    approverIds?: string[];
    description?: string;
    isRequired?: boolean;
  }>;
  operatorName?: string;
}

interface FlowUpdate {
  name?: string;
  description?: string;
  isDefault?: boolean;
  status?: string;
  category?: string;
  nodes?: Array<{
    level: number;
    name: string;
    approverRole?: string;
    approverIds?: string[];
    description?: string;
    isRequired?: boolean;
  }>;
}

interface InstanceCreate {
  flowId: string;
  title: string;
  description?: string;
  targetType: string;
  targetId: string;
  targetNumber?: string;
  targetName?: string;
  applicantName?: string;
  applicantDept?: string;
  applyReason?: string;
  isUrgent?: boolean;
  urgentReason?: string;
  caseId?: string;
  clueId?: string;
  evidenceId?: string;
}

interface InstanceApprove {
  opinion?: string;
  operatorName?: string;
  operatorDept?: string;
  operatorRole?: string;
  attachmentIds?: string[];
  remark?: string;
}

interface InstanceReject {
  opinion: string;
  operatorName?: string;
  operatorDept?: string;
  operatorRole?: string;
  attachmentIds?: string[];
  remark?: string;
}

interface InstanceRollback {
  opinion: string;
  targetLevel?: number;
  operatorName?: string;
  operatorDept?: string;
  operatorRole?: string;
  attachmentIds?: string[];
  remark?: string;
}

interface InstanceQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: string;
  status?: string;
  targetType?: string;
  targetId?: string;
  applicantName?: string;
  caseId?: string;
  clueId?: string;
  evidenceId?: string;
  startDate?: string;
  endDate?: string;
  isUrgent?: boolean;
}

interface FlowQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: string;
  status?: string;
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/options', async () => {
    return {
      categories: Object.entries(categoryLabels).map(([key, label]) => ({
        value: key,
        label,
      })),
      statuses: Object.entries(statusLabels).map(([key, label]) => ({
        value: key,
        label,
        color:
          key === 'APPROVED' ? 'green' :
          key === 'REJECTED' ? 'red' :
          key === 'IN_PROGRESS' ? 'blue' :
          key === 'ROLLED_BACK' ? 'orange' :
          key === 'CANCELLED' ? 'default' :
          'gold',
      })),
      actions: Object.entries(actionLabels).map(([key, label]) => ({
        value: key,
        label,
      })),
      categoryLabels,
      statusLabels,
    };
  });

  fastify.get('/flows', async (request: FastifyRequest<{ Querystring: FlowQuery }>, reply) => {
    const { page = 1, pageSize = 20, keyword, category, status } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { flowNumber: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.approvalFlow.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          nodes: { orderBy: { level: 'asc' } },
          _count: { select: { instances: true } },
        },
      }),
      prisma.approvalFlow.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        categoryLabel: categoryLabels[item.category] || item.category,
        instanceCount: item._count.instances,
      })),
      total,
      page,
      pageSize,
    };
  });

  fastify.get('/flows/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const flow = await prisma.approvalFlow.findUnique({
      where: { id: request.params.id },
      include: { nodes: { orderBy: { level: 'asc' } } },
    });

    if (!flow) {
      return reply.code(404).send({ error: '审批流程不存在' });
    }

    return { ...flow, categoryLabel: categoryLabels[flow.category] || flow.category };
  });

  fastify.post('/flows', async (request: FastifyRequest<{ Body: FlowCreate }>, reply) => {
    const body = request.body;

    if (!body.nodes || body.nodes.length === 0) {
      return reply.code(400).send({ error: '审批流程至少需要一个审批节点' });
    }

    const flowNumber = await generateFlowNumber();
    const operator = extractOperator(request);

    if (body.isDefault) {
      await prisma.approvalFlow.updateMany({
        where: { category: body.category as any, isDefault: true },
        data: { isDefault: false },
      });
    }

    const flow = await prisma.approvalFlow.create({
      data: {
        flowNumber,
        name: body.name,
        category: body.category as any,
        description: body.description,
        isDefault: body.isDefault || false,
        operatorName: body.operatorName || operator,
        nodes: {
          create: body.nodes.map((node) => ({
            level: node.level,
            name: node.name,
            approverRole: node.approverRole,
            approverIds: node.approverIds ? JSON.stringify(node.approverIds) : null,
            description: node.description,
            isRequired: node.isRequired !== false,
          })),
        },
      },
      include: { nodes: { orderBy: { level: 'asc' } } },
    });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_FLOW,
      targetId: flow.id,
      action: ActionType.CREATE,
      description: `创建审批流程: ${body.name} [${flowNumber}]`,
      operator: body.operatorName || operator,
      afterData: flow,
      ...meta,
    });

    return flow;
  });

  fastify.put('/flows/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: FlowUpdate }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const existing = await prisma.approvalFlow.findUnique({
      where: { id },
      include: { nodes: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: '审批流程不存在' });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.status !== undefined) updateData.status = body.status;

    if (body.isDefault && body.category) {
      await prisma.approvalFlow.updateMany({
        where: { category: body.category as any, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    if (body.nodes && body.nodes.length > 0) {
      await prisma.approvalFlowNode.deleteMany({ where: { flowId: id } });
      updateData.nodes = {
        create: body.nodes.map((node) => ({
          level: node.level,
          name: node.name,
          approverRole: node.approverRole,
          approverIds: node.approverIds ? JSON.stringify(node.approverIds) : null,
          description: node.description,
          isRequired: node.isRequired !== false,
        })),
      };
    }

    const updated = await prisma.approvalFlow.update({
      where: { id },
      data: updateData,
      include: { nodes: { orderBy: { level: 'asc' } } },
    });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_FLOW,
      targetId: id,
      action: ActionType.UPDATE,
      description: `更新审批流程: ${body.name || existing.name}`,
      operator: extractOperator(request),
      beforeData: existing,
      afterData: updateData,
      ...meta,
    });

    return updated;
  });

  fastify.delete('/flows/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    const existing = await prisma.approvalFlow.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: '审批流程不存在' });
    }

    const instanceCount = await prisma.approvalInstance.count({
      where: { flowId: id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

    if (instanceCount > 0) {
      return reply.code(400).send({ error: '该流程下存在进行中的审批实例，无法删除' });
    }

    await prisma.approvalFlow.delete({ where: { id } });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_FLOW,
      targetId: id,
      action: ActionType.DELETE,
      description: `删除审批流程: ${existing.name} [${existing.flowNumber}]`,
      operator: extractOperator(request),
      beforeData: existing,
      ...meta,
    });

    return { success: true };
  });

  fastify.get('/default/:category', async (request: FastifyRequest<{ Params: { category: string } }>, reply) => {
    const flow = await prisma.approvalFlow.findFirst({
      where: { category: request.params.category as any, isDefault: true, status: '启用' },
      include: { nodes: { orderBy: { level: 'asc' } } },
    });

    if (!flow) {
      const anyFlow = await prisma.approvalFlow.findFirst({
        where: { category: request.params.category as any, status: '启用' },
        include: { nodes: { orderBy: { level: 'asc' } } },
      });
      if (!anyFlow) {
        return reply.code(404).send({ error: '未找到该类型的审批流程' });
      }
      return anyFlow;
    }

    return flow;
  });

  fastify.get('/instances', async (request: FastifyRequest<{ Querystring: InstanceQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      category,
      status,
      targetType,
      targetId,
      applicantName,
      caseId,
      clueId,
      evidenceId,
      startDate,
      endDate,
      isUrgent,
    } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (targetType && targetId) {
      where.targetType = targetType;
      where.targetId = targetId;
    }
    if (applicantName) where.applicantName = { contains: applicantName, mode: 'insensitive' };
    if (caseId) where.caseId = caseId;
    if (clueId) where.clueId = clueId;
    if (evidenceId) where.evidenceId = evidenceId;
    if (isUrgent !== undefined) where.isUrgent = isUrgent;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { instanceNumber: { contains: keyword, mode: 'insensitive' } },
        { targetName: { contains: keyword, mode: 'insensitive' } },
        { targetNumber: { contains: keyword, mode: 'insensitive' } },
        { applicantName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.approvalInstance.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { isUrgent: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          flow: { select: { id: true, name: true, flowNumber: true } },
          records: { orderBy: { actionTime: 'asc' } },
        },
      }),
      prisma.approvalInstance.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        categoryLabel: categoryLabels[item.category] || item.category,
        statusLabel: statusLabels[item.status] || item.status,
      })),
      total,
      page,
      pageSize,
    };
  });

  fastify.get('/instances/stats', async () => {
    const [total, pending, inProgress, approved, rejected, rolledBack, byCategory] =
      await Promise.all([
        prisma.approvalInstance.count(),
        prisma.approvalInstance.count({ where: { status: 'PENDING' } }),
        prisma.approvalInstance.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.approvalInstance.count({ where: { status: 'APPROVED' } }),
        prisma.approvalInstance.count({ where: { status: 'REJECTED' } }),
        prisma.approvalInstance.count({ where: { status: 'ROLLED_BACK' } }),
        prisma.approvalInstance.groupBy({
          by: ['category'],
          _count: true,
        }),
      ]);

    const categoryStats: Record<string, number> = {};
    byCategory.forEach((item: any) => {
      categoryStats[item.category] = item._count;
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.approvalInstance.count({
      where: { createdAt: { gte: todayStart } },
    });

    const urgentCount = await prisma.approvalInstance.count({
      where: { isUrgent: true, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

    return {
      total,
      pending,
      inProgress,
      approved,
      rejected,
      rolledBack,
      todayCount,
      urgentCount,
      byCategory: categoryStats,
    };
  });

  fastify.get('/instances/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const instance = await prisma.approvalInstance.findUnique({
      where: { id: request.params.id },
      include: {
        flow: {
          include: { nodes: { orderBy: { level: 'asc' } } },
        },
        records: { orderBy: { actionTime: 'asc' } },
      },
    });

    if (!instance) {
      return reply.code(404).send({ error: '审批实例不存在' });
    }

    const nodeStatusMap: Record<number, string> = {};
    instance.records.forEach((record) => {
      if (record.action === 'APPROVE') {
        nodeStatusMap[record.level] = 'APPROVED';
      } else if (record.action === 'REJECT') {
        nodeStatusMap[record.level] = 'REJECTED';
      } else if (record.action === 'ROLLBACK') {
        nodeStatusMap[record.level] = 'ROLLED_BACK';
      }
    });

    const nodesWithStatus = instance.flow.nodes.map((node) => ({
      ...node,
      nodeStatus: node.level < instance.currentLevel
        ? (nodeStatusMap[node.level] || 'APPROVED')
        : node.level === instance.currentLevel
        ? (nodeStatusMap[node.level] || 'PENDING')
        : 'PENDING',
      approverIds: node.approverIds ? JSON.parse(node.approverIds) : null,
    }));

    return {
      ...instance,
      categoryLabel: categoryLabels[instance.category] || instance.category,
      statusLabel: statusLabels[instance.status] || instance.status,
      flow: { ...instance.flow, nodes: nodesWithStatus },
    };
  });

  fastify.post('/instances', async (request: FastifyRequest<{ Body: InstanceCreate }>, reply) => {
    const body = request.body;

    const flow = await prisma.approvalFlow.findUnique({
      where: { id: body.flowId },
      include: { nodes: { orderBy: { level: 'asc' } } },
    });

    if (!flow) {
      return reply.code(404).send({ error: '审批流程不存在' });
    }

    if (flow.status !== '启用') {
      return reply.code(400).send({ error: '该审批流程未启用' });
    }

    if (flow.nodes.length === 0) {
      return reply.code(400).send({ error: '审批流程没有配置审批节点' });
    }

    const instanceNumber = await generateInstanceNumber();
    const operator = extractOperator(request);

    const instance = await prisma.approvalInstance.create({
      data: {
        instanceNumber,
        flowId: body.flowId,
        category: flow.category,
        title: body.title,
        description: body.description,
        status: 'PENDING',
        currentLevel: 1,
        totalLevels: flow.nodes.length,
        targetType: body.targetType,
        targetId: body.targetId,
        targetNumber: body.targetNumber,
        targetName: body.targetName,
        applicantName: body.applicantName || operator,
        applicantDept: body.applicantDept,
        applyReason: body.applyReason,
        isUrgent: body.isUrgent || false,
        urgentReason: body.urgentReason,
        caseId: body.caseId,
        clueId: body.clueId,
        evidenceId: body.evidenceId,
      },
      include: {
        flow: { select: { id: true, name: true, flowNumber: true } },
      },
    });

    const firstNode = flow.nodes[0];
    await prisma.approvalRecord.create({
      data: {
        instanceId: instance.id,
        nodeId: firstNode.id,
        level: 0,
        action: 'SUBMIT',
        opinion: body.applyReason,
        operatorName: body.applicantName || operator,
        operatorDept: body.applicantDept,
        beforeStatus: 'PENDING',
        afterStatus: 'PENDING',
      },
    });

    if (flow.nodes.length === 1) {
      await prisma.approvalInstance.update({
        where: { id: instance.id },
        data: { status: 'IN_PROGRESS' },
      });
    } else {
      await prisma.approvalInstance.update({
        where: { id: instance.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_INSTANCE,
      targetId: instance.id,
      action: ActionType.APPROVAL_CREATE,
      description: `提交审批申请: ${body.title} [${instanceNumber}] - ${categoryLabels[flow.category] || flow.category}`,
      operator: body.applicantName || operator,
      afterData: instance,
      ...meta,
    });

    return { ...instance, categoryLabel: categoryLabels[flow.category], statusLabel: statusLabels[instance.status] };
  });

  fastify.post('/instances/:id/approve', async (request: FastifyRequest<{ Params: { id: string }; Body: InstanceApprove }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const instance = await prisma.approvalInstance.findUnique({
      where: { id },
      include: { flow: { include: { nodes: { orderBy: { level: 'asc' } } } } },
    });

    if (!instance) {
      return reply.code(404).send({ error: '审批实例不存在' });
    }

    if (!['PENDING', 'IN_PROGRESS', 'ROLLED_BACK'].includes(instance.status)) {
      return reply.code(400).send({ error: '当前状态不允许审批' });
    }

    const currentNode = instance.flow.nodes.find((n: any) => n.level === instance.currentLevel);
    if (!currentNode) {
      return reply.code(400).send({ error: '未找到当前审批节点' });
    }

    const isLastLevel = instance.currentLevel >= instance.totalLevels;
    const newStatus = isLastLevel ? 'APPROVED' : 'IN_PROGRESS';
    const nextLevel = isLastLevel ? instance.currentLevel : instance.currentLevel + 1;

    await prisma.approvalRecord.create({
      data: {
        instanceId: id,
        nodeId: currentNode.id,
        level: instance.currentLevel,
        action: 'APPROVE',
        opinion: body.opinion,
        operatorName: body.operatorName || extractOperator(request),
        operatorDept: body.operatorDept,
        operatorRole: body.operatorRole,
        beforeStatus: instance.status,
        afterStatus: newStatus,
        attachmentIds: body.attachmentIds ? JSON.stringify(body.attachmentIds) : null,
        remark: body.remark,
      },
    });

    const updateData: any = {
      status: newStatus as any,
      currentLevel: nextLevel,
    };

    if (isLastLevel) {
      updateData.completedTime = new Date();
      updateData.completedBy = body.operatorName || extractOperator(request);
      updateData.completedByName = body.operatorName;
    }

    const updated = await prisma.approvalInstance.update({
      where: { id },
      data: updateData,
      include: {
        flow: { select: { id: true, name: true, flowNumber: true } },
        records: { orderBy: { actionTime: 'asc' } },
      },
    });

    if (isLastLevel) {
      await handleApprovalComplete(instance);
    }

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_INSTANCE,
      targetId: id,
      action: ActionType.APPROVAL_APPROVE,
      description: `审批通过[${currentNode.name}]: ${instance.title} - ${body.opinion || '无意见'}`,
      operator: body.operatorName || extractOperator(request),
      afterData: { status: newStatus, level: instance.currentLevel },
      ...meta,
    });

    return {
      ...updated,
      categoryLabel: categoryLabels[updated.category] || updated.category,
      statusLabel: statusLabels[updated.status] || updated.status,
    };
  });

  fastify.post('/instances/:id/reject', async (request: FastifyRequest<{ Params: { id: string }; Body: InstanceReject }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const instance = await prisma.approvalInstance.findUnique({
      where: { id },
      include: { flow: { include: { nodes: { orderBy: { level: 'asc' } } } } },
    });

    if (!instance) {
      return reply.code(404).send({ error: '审批实例不存在' });
    }

    if (!['PENDING', 'IN_PROGRESS', 'ROLLED_BACK'].includes(instance.status)) {
      return reply.code(400).send({ error: '当前状态不允许驳回' });
    }

    const currentNode = instance.flow.nodes.find((n: any) => n.level === instance.currentLevel);
    if (!currentNode) {
      return reply.code(400).send({ error: '未找到当前审批节点' });
    }

    await prisma.approvalRecord.create({
      data: {
        instanceId: id,
        nodeId: currentNode.id,
        level: instance.currentLevel,
        action: 'REJECT',
        opinion: body.opinion,
        operatorName: body.operatorName || extractOperator(request),
        operatorDept: body.operatorDept,
        operatorRole: body.operatorRole,
        beforeStatus: instance.status,
        afterStatus: 'REJECTED',
        attachmentIds: body.attachmentIds ? JSON.stringify(body.attachmentIds) : null,
        remark: body.remark,
      },
    });

    const updated = await prisma.approvalInstance.update({
      where: { id },
      data: {
        status: 'REJECTED' as any,
        completedTime: new Date(),
        completedBy: body.operatorName || extractOperator(request),
        completedByName: body.operatorName,
      },
      include: {
        flow: { select: { id: true, name: true, flowNumber: true } },
        records: { orderBy: { actionTime: 'asc' } },
      },
    });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_INSTANCE,
      targetId: id,
      action: ActionType.APPROVAL_REJECT,
      description: `审批驳回[${currentNode.name}]: ${instance.title} - ${body.opinion}`,
      operator: body.operatorName || extractOperator(request),
      afterData: { status: 'REJECTED' },
      ...meta,
    });

    return {
      ...updated,
      categoryLabel: categoryLabels[updated.category] || updated.category,
      statusLabel: statusLabels[updated.status] || updated.status,
    };
  });

  fastify.post('/instances/:id/rollback', async (request: FastifyRequest<{ Params: { id: string }; Body: InstanceRollback }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const instance = await prisma.approvalInstance.findUnique({
      where: { id },
      include: { flow: { include: { nodes: { orderBy: { level: 'asc' } } } } },
    });

    if (!instance) {
      return reply.code(404).send({ error: '审批实例不存在' });
    }

    if (!['IN_PROGRESS'].includes(instance.status)) {
      return reply.code(400).send({ error: '当前状态不允许回退' });
    }

    if (instance.currentLevel <= 1) {
      return reply.code(400).send({ error: '已经是第一级审批，无法回退' });
    }

    const currentNode = instance.flow.nodes.find((n: any) => n.level === instance.currentLevel);
    const targetLevel = body.targetLevel || instance.currentLevel - 1;
    const targetNode = instance.flow.nodes.find((n: any) => n.level === targetLevel);

    if (!targetNode) {
      return reply.code(400).send({ error: '回退目标节点不存在' });
    }

    await prisma.approvalRecord.create({
      data: {
        instanceId: id,
        nodeId: currentNode?.id,
        level: instance.currentLevel,
        action: 'ROLLBACK',
        opinion: body.opinion,
        operatorName: body.operatorName || extractOperator(request),
        operatorDept: body.operatorDept,
        operatorRole: body.operatorRole,
        beforeStatus: instance.status,
        afterStatus: 'ROLLED_BACK',
        attachmentIds: body.attachmentIds ? JSON.stringify(body.attachmentIds) : null,
        remark: body.remark,
      },
    });

    const updated = await prisma.approvalInstance.update({
      where: { id },
      data: {
        status: 'ROLLED_BACK' as any,
        currentLevel: targetLevel,
      },
      include: {
        flow: { select: { id: true, name: true, flowNumber: true } },
        records: { orderBy: { actionTime: 'asc' } },
      },
    });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_INSTANCE,
      targetId: id,
      action: ActionType.APPROVAL_ROLLBACK,
      description: `审批回退[${currentNode?.name} → ${targetNode.name}]: ${instance.title} - ${body.opinion}`,
      operator: body.operatorName || extractOperator(request),
      afterData: { status: 'ROLLED_BACK', currentLevel: targetLevel },
      ...meta,
    });

    return {
      ...updated,
      categoryLabel: categoryLabels[updated.category] || updated.category,
      statusLabel: statusLabels[updated.status] || updated.status,
    };
  });

  fastify.post('/instances/:id/cancel', async (request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string; operatorName?: string } }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const instance = await prisma.approvalInstance.findUnique({ where: { id } });

    if (!instance) {
      return reply.code(404).send({ error: '审批实例不存在' });
    }

    if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(instance.status)) {
      return reply.code(400).send({ error: '当前状态不允许取消' });
    }

    await prisma.approvalRecord.create({
      data: {
        instanceId: id,
        level: instance.currentLevel,
        action: 'CANCEL',
        opinion: body.reason,
        operatorName: body.operatorName || extractOperator(request),
        beforeStatus: instance.status,
        afterStatus: 'CANCELLED',
      },
    });

    const updated = await prisma.approvalInstance.update({
      where: { id },
      data: {
        status: 'CANCELLED' as any,
        completedTime: new Date(),
        completedBy: body.operatorName || extractOperator(request),
        completedByName: body.operatorName,
      },
      include: {
        flow: { select: { id: true, name: true, flowNumber: true } },
        records: { orderBy: { actionTime: 'asc' } },
      },
    });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_INSTANCE,
      targetId: id,
      action: ActionType.APPROVAL_CANCEL,
      description: `取消审批: ${instance.title} - ${body.reason || '无原因'}`,
      operator: body.operatorName || extractOperator(request),
      afterData: { status: 'CANCELLED' },
      ...meta,
    });

    return {
      ...updated,
      categoryLabel: categoryLabels[updated.category] || updated.category,
      statusLabel: statusLabels[updated.status] || updated.status,
    };
  });

  fastify.post('/instances/:id/urge', async (request: FastifyRequest<{ Params: { id: string }; Body: { message?: string; operatorName?: string } }>, reply) => {
    const { id } = request.params;
    const body = request.body;

    const instance = await prisma.approvalInstance.findUnique({ where: { id } });

    if (!instance) {
      return reply.code(404).send({ error: '审批实例不存在' });
    }

    if (!['PENDING', 'IN_PROGRESS'].includes(instance.status)) {
      return reply.code(400).send({ error: '当前状态不允许催办' });
    }

    await prisma.approvalRecord.create({
      data: {
        instanceId: id,
        level: instance.currentLevel,
        action: 'URGE',
        opinion: body.message || '催办',
        operatorName: body.operatorName || extractOperator(request),
        beforeStatus: instance.status,
        afterStatus: instance.status,
      },
    });

    const meta = getRequestMeta(request);
    await createOperationLog({
      targetType: TargetType.APPROVAL_INSTANCE,
      targetId: id,
      action: ActionType.APPROVAL_URGE,
      description: `催办审批: ${instance.title}`,
      operator: body.operatorName || extractOperator(request),
      ...meta,
    });

    return { success: true };
  });

  fastify.get('/instances/target/:targetType/:targetId', async (
    request: FastifyRequest<{ Params: { targetType: string; targetId: string }; Querystring: { page?: number; pageSize?: number } }>,
    reply
  ) => {
    const { targetType, targetId } = request.params;
    const { page = 1, pageSize = 20 } = request.query;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.approvalInstance.findMany({
        where: { targetType, targetId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          flow: { select: { id: true, name: true, flowNumber: true } },
          records: { orderBy: { actionTime: 'asc' } },
        },
      }),
      prisma.approvalInstance.count({ where: { targetType, targetId } }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        categoryLabel: categoryLabels[item.category] || item.category,
        statusLabel: statusLabels[item.status] || item.status,
      })),
      total,
      page,
      pageSize,
    };
  });
}

const handleApprovalComplete = async (instance: any) => {
  if (instance.category === 'CASE_FILING' && instance.caseId) {
    await prisma.case.update({
      where: { id: instance.caseId },
      data: { status: '已立案' },
    });
  }

  if (instance.category === 'CLUE_ADOPT' && instance.clueId) {
    await prisma.clue.update({
      where: { id: instance.clueId },
      data: { status: '已采用' },
    });
  }

  if (instance.category === 'EVIDENCE_CHECKOUT' && instance.evidenceId) {
    await prisma.evidence.update({
      where: { id: instance.evidenceId },
      data: { status: '已出库', borrowStatus: '借阅中' },
    });
  }

  if (instance.category === 'EVIDENCE_DESTROY' && instance.evidenceId) {
    await prisma.evidence.update({
      where: { id: instance.evidenceId },
      data: { status: '已销毁', borrowStatus: '已销毁' },
    });
  }

  if (instance.category === 'CASE_CLOSE' && instance.caseId) {
    await prisma.case.update({
      where: { id: instance.caseId },
      data: { status: '已结案' },
    });
  }
};
