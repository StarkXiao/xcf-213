import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import {
  TargetType,
  ActionType,
  createOperationLog,
  getRequestMeta,
  logCreate,
  logUpdate,
} from '../lib/operationLog';

interface TransferQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  transferType?: string;
  status?: string;
  evidenceId?: string;
  caseId?: string;
  clueId?: string;
  applicant?: string;
  fromPerson?: string;
  toPerson?: string;
  startDate?: string;
  endDate?: string;
}

interface TransferCreate {
  evidenceId: string;
  caseId?: string;
  clueId?: string;
  transferType: string;
  priority?: string;
  fromDepartment?: string;
  fromPerson?: string;
  toDepartment?: string;
  toPerson?: string;
  reason?: string;
  description?: string;
  expectedTime?: string;
  applicant?: string;
  applicantDept?: string;
  operator?: string;
  operatorDept?: string;
}

interface TransferApprove {
  approver?: string;
  approverDept?: string;
  approveOpinion?: string;
  pass: boolean;
}

interface TransferHandle {
  handler?: string;
  handlerDept?: string;
  description?: string;
}

interface TransferReceive {
  receiver?: string;
  receiverDept?: string;
  receiveRemark?: string;
}

interface TransferReturn {
  returner?: string;
  returnerDept?: string;
  returnRemark?: string;
}

interface TransferDestroy {
  destroyMethod?: string;
  destroySupervisor?: string;
  destroyWitness?: string;
  destroyCertificate?: string;
  operator?: string;
}

export default async function (fastify: FastifyInstance) {
  const generateTransferNumber = async (type: string): Promise<string> => {
    const count = await prisma.evidenceTransfer.count();
    const prefixMap: Record<string, string> = {
      STORAGE_IN: 'RK',
      BORROW: 'JY',
      TRANSFER: 'YJ',
      RETURN: 'GH',
      DESTROY: 'XH',
      SEAL: 'FD',
      UNSEAL: 'JF',
    };
    const prefix = prefixMap[type] || 'LZ';
    return `${prefix}${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
  };

  const createTransferLog = async (
    transferId: string,
    action: string,
    stage: string | undefined,
    description: string | undefined,
    beforeStatus: string | undefined,
    afterStatus: string | undefined,
    request: FastifyRequest,
    operatorName?: string,
    operatorDept?: string,
    remark?: string
  ) => {
    const meta = getRequestMeta(request);
    await prisma.evidenceTransferLog.create({
      data: {
        transferId,
        action,
        stage,
        description,
        beforeStatus,
        afterStatus,
        operatorName,
        operatorDept,
        remark,
        ...meta,
      },
    });
  };

  const transformTransfer = (transfer: any) => ({
    ...transfer,
    typeLabel: getTypeLabel(transfer.transferType),
    statusLabel: getStatusLabel(transfer.status),
  });

  const getTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      STORAGE_IN: '入库',
      BORROW: '借阅',
      TRANSFER: '移交',
      RETURN: '归还',
      DESTROY: '销毁',
      SEAL: '封存',
      UNSEAL: '解封',
    };
    return map[type] || type;
  };

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      PENDING: '待处理',
      IN_PROGRESS: '进行中',
      COMPLETED: '已完成',
      REJECTED: '已驳回',
      CANCELLED: '已取消',
    };
    return map[status] || status;
  };

  fastify.get('/', async (request: FastifyRequest<{ Querystring: TransferQuery }>, reply) => {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      transferType,
      status,
      evidenceId,
      caseId,
      clueId,
      applicant,
      fromPerson,
      toPerson,
      startDate,
      endDate,
    } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { transferNumber: { contains: keyword, mode: 'insensitive' } },
        { reason: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (transferType) where.transferType = transferType;
    if (status) where.status = status;
    if (evidenceId) where.evidenceId = evidenceId;
    if (caseId) where.caseId = caseId;
    if (clueId) where.clueId = clueId;
    if (applicant) where.applicant = { contains: applicant, mode: 'insensitive' };
    if (fromPerson) where.fromPerson = { contains: fromPerson, mode: 'insensitive' };
    if (toPerson) where.toPerson = { contains: toPerson, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.evidenceTransfer.findMany({
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
      prisma.evidenceTransfer.count({ where }),
    ]);

    return { items: items.map(transformTransfer), total, page, pageSize };
  });

  fastify.get('/stats', async () => {
    const [total, pending, inProgress, completed, byType] = await Promise.all([
      prisma.evidenceTransfer.count(),
      prisma.evidenceTransfer.count({ where: { status: 'PENDING' } }),
      prisma.evidenceTransfer.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.evidenceTransfer.count({ where: { status: 'COMPLETED' } }),
      prisma.evidenceTransfer.groupBy({
        by: ['transferType'],
        _count: true,
      }),
    ]);

    const typeStats: Record<string, number> = {};
    byType.forEach((item: any) => {
      typeStats[item.transferType] = item._count;
    });

    return {
      total,
      pending,
      inProgress,
      completed,
      byType: typeStats,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true, type: true, status: true, borrowStatus: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
        flowLogs: { orderBy: { actionTime: 'asc' } },
      },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    return transformTransfer(transfer);
  });

  fastify.get('/evidence/:evidenceId', async (request: FastifyRequest<{ Params: { evidenceId: string }; Querystring: { page?: number; pageSize?: number } }>, reply) => {
    const { page = 1, pageSize = 20 } = request.query;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.evidenceTransfer.findMany({
        where: { evidenceId: request.params.evidenceId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          clue: { select: { id: true, clueNumber: true, title: true } },
        },
      }),
      prisma.evidenceTransfer.count({ where: { evidenceId: request.params.evidenceId } }),
    ]);

    return { items: items.map(transformTransfer), total, page, pageSize };
  });

  fastify.get('/:id/logs', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; pageSize?: number } }>, reply) => {
    const { page = 1, pageSize = 50 } = request.query;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.evidenceTransferLog.findMany({
        where: { transferId: request.params.id },
        skip,
        take: pageSize,
        orderBy: { actionTime: 'desc' },
      }),
      prisma.evidenceTransferLog.count({ where: { transferId: request.params.id } }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: TransferCreate }>, reply) => {
    const data = request.body;

    const evidence = await prisma.evidence.findUnique({
      where: { id: data.evidenceId },
    });

    if (!evidence) {
      reply.status(404).send({ error: '证据不存在' });
      return;
    }

    const transferNumber = await generateTransferNumber(data.transferType);

    const transfer = await prisma.evidenceTransfer.create({
      data: {
        transferNumber,
        evidenceId: data.evidenceId,
        caseId: data.caseId || evidence.caseId,
        clueId: data.clueId || evidence.clueId,
        transferType: data.transferType as any,
        status: 'PENDING',
        priority: data.priority,
        fromDepartment: data.fromDepartment,
        fromPerson: data.fromPerson,
        toDepartment: data.toDepartment,
        toPerson: data.toPerson,
        reason: data.reason,
        description: data.description,
        expectedTime: data.expectedTime ? new Date(data.expectedTime) : null,
        applicant: data.applicant,
        applicantDept: data.applicantDept,
        operator: data.operator,
        operatorDept: data.operatorDept,
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
        clue: { select: { id: true, clueNumber: true, title: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      'CREATE',
      '申请',
      `创建${getTypeLabel(data.transferType)}申请`,
      undefined,
      'PENDING',
      request,
      data.applicant,
      data.applicantDept
    );

    await logCreate(
      TargetType.EVIDENCE,
      data.evidenceId,
      `创建证据流转：${transferNumber} - ${getTypeLabel(data.transferType)}`,
      request,
      data.applicant,
      {
        transferId: transfer.id,
        transferNumber,
        transferType: data.transferType,
        reason: data.reason,
      }
    );

    return transformTransfer(transfer);
  });

  fastify.post('/:id/approve', async (request: FastifyRequest<{ Params: { id: string }; Body: TransferApprove }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    if (transfer.status !== 'PENDING') {
      reply.status(400).send({ error: '当前状态不允许审批' });
      return;
    }

    const data = request.body;
    const newStatus = data.pass ? 'IN_PROGRESS' : 'REJECTED';

    const updated = await prisma.evidenceTransfer.update({
      where: { id: request.params.id },
      data: {
        status: newStatus,
        approver: data.approver,
        approverDept: data.approverDept,
        approveTime: new Date(),
        approveOpinion: data.approveOpinion,
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      data.pass ? 'APPROVE' : 'REJECT',
      '审批',
      data.pass ? '审批通过' : '审批驳回',
      'PENDING',
      newStatus,
      request,
      data.approver,
      data.approverDept,
      data.approveOpinion
    );

    await logUpdate(
      TargetType.EVIDENCE,
      transfer.evidenceId,
      `证据流转${data.pass ? '审批通过' : '审批驳回'}：${transfer.transferNumber}`,
      request,
      { status: transfer.status },
      { status: newStatus },
      data.approver
    );

    if (data.pass && transfer.transferType === 'STORAGE_IN') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: { status: '已入库' },
      });
    }

    if (data.pass && transfer.transferType === 'BORROW') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: {
          borrowStatus: '借阅中',
          currentBorrower: transfer.toPerson,
          borrowTime: new Date(),
        },
      });
    }

    if (data.pass && transfer.transferType === 'DESTROY') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: { status: '已销毁' },
      });
    }

    if (data.pass && transfer.transferType === 'SEAL') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: { status: '已封存' },
      });
    }

    if (data.pass && transfer.transferType === 'UNSEAL') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: { status: '已入库' },
      });
    }

    return transformTransfer(updated);
  });

  fastify.post('/:id/handle', async (request: FastifyRequest<{ Params: { id: string }; Body: TransferHandle }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    if (transfer.status !== 'IN_PROGRESS') {
      reply.status(400).send({ error: '当前状态不允许处理' });
      return;
    }

    const data = request.body;

    const updated = await prisma.evidenceTransfer.update({
      where: { id: request.params.id },
      data: {
        handler: data.handler,
        handlerDept: data.handlerDept,
        handleTime: new Date(),
        description: data.description || transfer.description,
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      'HANDLE',
      '处理',
      '流转处理中',
      'IN_PROGRESS',
      'IN_PROGRESS',
      request,
      data.handler,
      data.handlerDept,
      data.description
    );

    return transformTransfer(updated);
  });

  fastify.post('/:id/receive', async (request: FastifyRequest<{ Params: { id: string }; Body: TransferReceive }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    if (transfer.status !== 'IN_PROGRESS') {
      reply.status(400).send({ error: '当前状态不允许签收' });
      return;
    }

    const data = request.body;

    const updated = await prisma.evidenceTransfer.update({
      where: { id: request.params.id },
      data: {
        status: 'COMPLETED',
        receiver: data.receiver,
        receiverDept: data.receiverDept,
        receiveTime: new Date(),
        receiveRemark: data.receiveRemark,
        actualTime: new Date(),
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      'RECEIVE',
      '签收',
      `签收确认：${data.receiver}`,
      'IN_PROGRESS',
      'COMPLETED',
      request,
      data.receiver,
      data.receiverDept,
      data.receiveRemark
    );

    await logUpdate(
      TargetType.EVIDENCE,
      transfer.evidenceId,
      `证据流转签收：${transfer.transferNumber} - ${getTypeLabel(transfer.transferType)}`,
      request,
      { status: transfer.status },
      { status: 'COMPLETED' },
      data.receiver
    );

    if (transfer.transferType === 'TRANSFER') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: {
          collector: data.receiver,
        },
      });
    }

    if (transfer.transferType === 'RETURN') {
      await prisma.evidence.update({
        where: { id: transfer.evidenceId },
        data: {
          borrowStatus: '已归还',
          currentBorrower: null,
          borrowTime: null,
        },
      });
    }

    return transformTransfer(updated);
  });

  fastify.post('/:id/return', async (request: FastifyRequest<{ Params: { id: string }; Body: TransferReturn }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    if (transfer.status !== 'IN_PROGRESS') {
      reply.status(400).send({ error: '当前状态不允许归还' });
      return;
    }

    const data = request.body;

    const updated = await prisma.evidenceTransfer.update({
      where: { id: request.params.id },
      data: {
        status: 'COMPLETED',
        returner: data.returner,
        returnerDept: data.returnerDept,
        returnTime: new Date(),
        returnRemark: data.returnRemark,
        actualTime: new Date(),
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      'RETURN',
      '归还',
      `归还确认：${data.returner}`,
      'IN_PROGRESS',
      'COMPLETED',
      request,
      data.returner,
      data.returnerDept,
      data.returnRemark
    );

    await logUpdate(
      TargetType.EVIDENCE,
      transfer.evidenceId,
      `证据归还：${transfer.transferNumber}`,
      request,
      { status: transfer.status },
      { status: 'COMPLETED' },
      data.returner
    );

    await prisma.evidence.update({
      where: { id: transfer.evidenceId },
      data: {
        borrowStatus: '已归还',
        currentBorrower: null,
        borrowTime: null,
      },
    });

    return transformTransfer(updated);
  });

  fastify.post('/:id/destroy', async (request: FastifyRequest<{ Params: { id: string }; Body: TransferDestroy }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    if (transfer.status !== 'IN_PROGRESS' && transfer.status !== 'PENDING') {
      reply.status(400).send({ error: '当前状态不允许销毁' });
      return;
    }

    if (transfer.transferType !== 'DESTROY') {
      reply.status(400).send({ error: '该流转类型不是销毁' });
      return;
    }

    const data = request.body;

    const updated = await prisma.evidenceTransfer.update({
      where: { id: request.params.id },
      data: {
        status: 'COMPLETED',
        destroyMethod: data.destroyMethod,
        destroySupervisor: data.destroySupervisor,
        destroyWitness: data.destroyWitness,
        destroyCertificate: data.destroyCertificate,
        actualTime: new Date(),
        operator: data.operator,
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      'DESTROY',
      '销毁',
      `证据销毁完成，销毁方式：${data.destroyMethod || '未指定'}`,
      transfer.status,
      'COMPLETED',
      request,
      data.operator,
      undefined,
      `监督人：${data.destroySupervisor || '未指定'}，见证人：${data.destroyWitness || '未指定'}`
    );

    await logUpdate(
      TargetType.EVIDENCE,
      transfer.evidenceId,
      `证据销毁：${transfer.transferNumber}`,
      request,
      { status: '已入库' },
      { status: '已销毁' },
      data.operator
    );

    await prisma.evidence.update({
      where: { id: transfer.evidenceId },
      data: {
        status: '已销毁',
        borrowStatus: '已销毁',
      },
    });

    return transformTransfer(updated);
  });

  fastify.put('/:id/cancel', async (request: FastifyRequest<{ Params: { id: string }; Body: { operator?: string; reason?: string } }>, reply) => {
    const transfer = await prisma.evidenceTransfer.findUnique({
      where: { id: request.params.id },
    });

    if (!transfer) {
      reply.status(404).send({ error: '流转记录不存在' });
      return;
    }

    if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
      reply.status(400).send({ error: '当前状态不允许取消' });
      return;
    }

    const data = request.body;

    const updated = await prisma.evidenceTransfer.update({
      where: { id: request.params.id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
      },
    });

    await createTransferLog(
      transfer.id,
      'CANCEL',
      '取消',
      `取消流转：${data.reason || '未说明原因'}`,
      transfer.status,
      'CANCELLED',
      request,
      data.operator,
      undefined,
      data.reason
    );

    await logUpdate(
      TargetType.EVIDENCE,
      transfer.evidenceId,
      `取消证据流转：${transfer.transferNumber}`,
      request,
      { status: transfer.status },
      { status: 'CANCELLED' },
      data.operator
    );

    return transformTransfer(updated);
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const transfer = await prisma.evidenceTransfer.findUnique({
        where: { id: request.params.id },
      });

      if (!transfer) {
        reply.status(404).send({ error: '流转记录不存在' });
        return;
      }

      await prisma.evidenceTransfer.delete({
        where: { id: request.params.id },
      });

      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: '删除失败' });
    }
  });

  fastify.get('/responsibility/trace', async (request: FastifyRequest<{ Querystring: { evidenceId?: string; personName?: string; startDate?: string; endDate?: string } }>, reply) => {
    const { evidenceId, personName, startDate, endDate } = request.query;

    const where: any = {};
    if (evidenceId) where.evidenceId = evidenceId;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const transfers = await prisma.evidenceTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        evidence: { select: { id: true, evidenceNumber: true, name: true } },
        flowLogs: { orderBy: { actionTime: 'asc' } },
      },
    });

    const responsibilityChain: any[] = [];

    transfers.forEach((transfer: any) => {
      const nodes: any[] = [];

      if (transfer.applicant) {
        nodes.push({
          stage: '申请',
          person: transfer.applicant,
          department: transfer.applicantDept,
          time: transfer.applyTime,
          action: '提交申请',
          remark: transfer.reason,
        });
      }

      if (transfer.approver) {
        nodes.push({
          stage: '审批',
          person: transfer.approver,
          department: transfer.approverDept,
          time: transfer.approveTime,
          action: transfer.status === 'REJECTED' ? '审批驳回' : '审批通过',
          remark: transfer.approveOpinion,
        });
      }

      if (transfer.handler) {
        nodes.push({
          stage: '处理',
          person: transfer.handler,
          department: transfer.handlerDept,
          time: transfer.handleTime,
          action: '处理流转',
          remark: transfer.description,
        });
      }

      if (transfer.receiver) {
        nodes.push({
          stage: '签收',
          person: transfer.receiver,
          department: transfer.receiverDept,
          time: transfer.receiveTime,
          action: '签收确认',
          remark: transfer.receiveRemark,
        });
      }

      if (transfer.returner) {
        nodes.push({
          stage: '归还',
          person: transfer.returner,
          department: transfer.returnerDept,
          time: transfer.returnTime,
          action: '归还确认',
          remark: transfer.returnRemark,
        });
      }

      if (transfer.destroySupervisor || transfer.destroyWitness) {
        nodes.push({
          stage: '销毁',
          person: transfer.operator,
          department: undefined,
          time: transfer.actualTime,
          action: `销毁（${transfer.destroyMethod || '方式未指定'}）`,
          remark: `监督人: ${transfer.destroySupervisor || '-'}，见证人: ${transfer.destroyWitness || '-'}`,
        });
      }

      responsibilityChain.push({
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        transferType: transfer.transferType,
        typeLabel: getTypeLabel(transfer.transferType),
        status: transfer.status,
        statusLabel: getStatusLabel(transfer.status),
        evidence: transfer.evidence,
        nodes,
        createdAt: transfer.createdAt,
      });
    });

    if (personName) {
      return {
        items: responsibilityChain.filter((item: any) =>
          item.nodes.some((node: any) => node.person && node.person.includes(personName))
        ),
      };
    }

    return { items: responsibilityChain };
  });
}
