import prisma from './prisma';
import type { FastifyRequest } from 'fastify';

export enum TargetType {
  CASE = 'CASE',
  CLUE = 'CLUE',
  EVIDENCE = 'EVIDENCE',
  PERSON = 'PERSON',
  EVIDENCE_BATCH = 'EVIDENCE_BATCH',
  EVIDENCE_BORROW = 'EVIDENCE_BORROW',
  EVIDENCE_TRANSFER = 'EVIDENCE_TRANSFER',
  EVIDENCE_TRANSFER_LOG = 'EVIDENCE_TRANSFER_LOG',
  CLUE_VERIFICATION = 'CLUE_VERIFICATION',
  COMMAND_TASK = 'COMMAND_TASK',
  TASK_PROGRESS = 'TASK_PROGRESS',
  FLOW_RECORD = 'FLOW_RECORD',
  CLUE_CHECK_FLOW = 'CLUE_CHECK_FLOW',
  CLUE_CHECK_LOG = 'CLUE_CHECK_LOG',
}

export enum ActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  BORROW = 'BORROW',
  RETURN = 'RETURN',
  VERIFY = 'VERIFY',
  ASSOCIATE = 'ASSOCIATE',
  DISASSOCIATE = 'DISASSOCIATE',
  BATCH_ASSIGN = 'BATCH_ASSIGN',
  BATCH_RETURN = 'BATCH_RETURN',
  BATCH_MERGE = 'BATCH_MERGE',
  BATCH_UPLOAD = 'BATCH_UPLOAD',
  TO_EVIDENCE = 'TO_EVIDENCE',
  TASK_ASSIGN = 'TASK_ASSIGN',
  TASK_TRANSFER = 'TASK_TRANSFER',
  TASK_COMPLETE = 'TASK_COMPLETE',
  TASK_CANCEL = 'TASK_CANCEL',
  TASK_PROGRESS_UPDATE = 'TASK_PROGRESS_UPDATE',
  FLOW_ASSIGN = 'FLOW_ASSIGN',
  FLOW_TRANSFER = 'FLOW_TRANSFER',
  FLOW_RECEIVE = 'FLOW_RECEIVE',
  FLOW_RETURN = 'FLOW_RETURN',
  CHECK_REGISTER = 'CHECK_REGISTER',
  CHECK_DISPATCH = 'CHECK_DISPATCH',
  CHECK_VERIFY = 'CHECK_VERIFY',
  CHECK_FEEDBACK = 'CHECK_FEEDBACK',
  CHECK_ADOPT = 'CHECK_ADOPT',
  CHECK_REJECT = 'CHECK_REJECT',
  CHECK_CLOSE = 'CHECK_CLOSE',
  TRANSFER_CREATE = 'TRANSFER_CREATE',
  TRANSFER_APPROVE = 'TRANSFER_APPROVE',
  TRANSFER_REJECT = 'TRANSFER_REJECT',
  TRANSFER_HANDLE = 'TRANSFER_HANDLE',
  TRANSFER_RECEIVE = 'TRANSFER_RECEIVE',
  TRANSFER_RETURN = 'TRANSFER_RETURN',
  TRANSFER_DESTROY = 'TRANSFER_DESTROY',
  TRANSFER_CANCEL = 'TRANSFER_CANCEL',
}

export interface CreateOperationLogParams {
  targetType: TargetType | string;
  targetId: string;
  action: ActionType | string;
  description?: string;
  operator?: string | null;
  operatorDepartment?: string | null;
  beforeData?: any;
  afterData?: any;
  ip?: string;
  userAgent?: string;
}

export const createOperationLog = async (params: CreateOperationLogParams) => {
  try {
    const {
      targetType,
      targetId,
      action,
      description,
      operator,
      operatorDepartment,
      beforeData,
      afterData,
      ip,
      userAgent,
    } = params;

    await prisma.operationLog.create({
      data: {
        targetType,
        targetId,
        action,
        description,
        operator,
        operatorDepartment,
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

export const getRequestMeta = (request: FastifyRequest) => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'] || undefined,
});

export const extractOperator = (request: FastifyRequest, body?: any) => {
  return (
    body?.operator ||
    body?.handler ||
    body?.collector ||
    body?.caseManager ||
    body?.borrower ||
    body?.returnOperator ||
    undefined
  );
};

export const logCreate = (
  targetType: TargetType | string,
  targetId: string,
  description: string,
  request: FastifyRequest,
  operator?: string | null,
  afterData?: any
) => {
  const meta = getRequestMeta(request);
  return createOperationLog({
    targetType,
    targetId,
    action: ActionType.CREATE,
    description,
    operator: operator || extractOperator(request),
    afterData,
    ...meta,
  });
};

export const logUpdate = (
  targetType: TargetType | string,
  targetId: string,
  description: string,
  request: FastifyRequest,
  beforeData: any,
  afterData: any,
  operator?: string | null
) => {
  const meta = getRequestMeta(request);
  return createOperationLog({
    targetType,
    targetId,
    action: ActionType.UPDATE,
    description,
    operator: operator || extractOperator(request),
    beforeData,
    afterData,
    ...meta,
  });
};

export const logDelete = (
  targetType: TargetType | string,
  targetId: string,
  description: string,
  request: FastifyRequest,
  beforeData?: any,
  operator?: string | null
) => {
  const meta = getRequestMeta(request);
  return createOperationLog({
    targetType,
    targetId,
    action: ActionType.DELETE,
    description,
    operator: operator || extractOperator(request),
    beforeData,
    ...meta,
  });
};

export const logAssociate = (
  targetType: TargetType | string,
  targetId: string,
  description: string,
  request: FastifyRequest,
  afterData?: any,
  operator?: string | null
) => {
  const meta = getRequestMeta(request);
  return createOperationLog({
    targetType,
    targetId,
    action: ActionType.ASSOCIATE,
    description,
    operator: operator || extractOperator(request),
    afterData,
    ...meta,
  });
};

export const logDisassociate = (
  targetType: TargetType | string,
  targetId: string,
  description: string,
  request: FastifyRequest,
  beforeData?: any,
  operator?: string | null
) => {
  const meta = getRequestMeta(request);
  return createOperationLog({
    targetType,
    targetId,
    action: ActionType.DISASSOCIATE,
    description,
    operator: operator || extractOperator(request),
    beforeData,
    ...meta,
  });
};

export default {
  TargetType,
  ActionType,
  createOperationLog,
  getRequestMeta,
  extractOperator,
  logCreate,
  logUpdate,
  logDelete,
  logAssociate,
  logDisassociate,
};
