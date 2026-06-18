"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
const operationLog_1 = require("../lib/operationLog");
async function default_1(fastify) {
    const generateTransferNumber = async (type) => {
        const count = await prisma_1.default.evidenceTransfer.count();
        const prefixMap = {
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
    const createTransferLog = async (transferId, action, stage, description, beforeStatus, afterStatus, request, operatorName, operatorDept, remark) => {
        const meta = (0, operationLog_1.getRequestMeta)(request);
        await prisma_1.default.evidenceTransferLog.create({
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
    const transformTransfer = (transfer) => ({
        ...transfer,
        typeLabel: getTypeLabel(transfer.transferType),
        statusLabel: getStatusLabel(transfer.status),
    });
    const getTypeLabel = (type) => {
        const map = {
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
    const getStatusLabel = (status) => {
        const map = {
            PENDING: '待处理',
            IN_PROGRESS: '进行中',
            COMPLETED: '已完成',
            REJECTED: '已驳回',
            CANCELLED: '已取消',
        };
        return map[status] || status;
    };
    fastify.get('/', async (request, reply) => {
        const { page = 1, pageSize = 10, keyword, transferType, status, evidenceId, caseId, clueId, applicant, fromPerson, toPerson, startDate, endDate, } = request.query;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (keyword) {
            where.OR = [
                { transferNumber: { contains: keyword, mode: 'insensitive' } },
                { reason: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (transferType)
            where.transferType = transferType;
        if (status)
            where.status = status;
        if (evidenceId)
            where.evidenceId = evidenceId;
        if (caseId)
            where.caseId = caseId;
        if (clueId)
            where.clueId = clueId;
        if (applicant)
            where.applicant = { contains: applicant, mode: 'insensitive' };
        if (fromPerson)
            where.fromPerson = { contains: fromPerson, mode: 'insensitive' };
        if (toPerson)
            where.toPerson = { contains: toPerson, mode: 'insensitive' };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [items, total] = await Promise.all([
            prisma_1.default.evidenceTransfer.findMany({
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
            prisma_1.default.evidenceTransfer.count({ where }),
        ]);
        return { items: items.map(transformTransfer), total, page, pageSize };
    });
    fastify.get('/stats', async () => {
        const [total, pending, inProgress, completed, byType] = await Promise.all([
            prisma_1.default.evidenceTransfer.count(),
            prisma_1.default.evidenceTransfer.count({ where: { status: 'PENDING' } }),
            prisma_1.default.evidenceTransfer.count({ where: { status: 'IN_PROGRESS' } }),
            prisma_1.default.evidenceTransfer.count({ where: { status: 'COMPLETED' } }),
            prisma_1.default.evidenceTransfer.groupBy({
                by: ['transferType'],
                _count: true,
            }),
        ]);
        const typeStats = {};
        byType.forEach((item) => {
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
    fastify.get('/:id', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
    fastify.get('/evidence/:evidenceId', async (request, reply) => {
        const { page = 1, pageSize = 20 } = request.query;
        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            prisma_1.default.evidenceTransfer.findMany({
                where: { evidenceId: request.params.evidenceId },
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: {
                    case: { select: { id: true, caseNumber: true, title: true } },
                    clue: { select: { id: true, clueNumber: true, title: true } },
                },
            }),
            prisma_1.default.evidenceTransfer.count({ where: { evidenceId: request.params.evidenceId } }),
        ]);
        return { items: items.map(transformTransfer), total, page, pageSize };
    });
    fastify.get('/:id/logs', async (request, reply) => {
        const { page = 1, pageSize = 50 } = request.query;
        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            prisma_1.default.evidenceTransferLog.findMany({
                where: { transferId: request.params.id },
                skip,
                take: pageSize,
                orderBy: { actionTime: 'desc' },
            }),
            prisma_1.default.evidenceTransferLog.count({ where: { transferId: request.params.id } }),
        ]);
        return { items, total, page, pageSize };
    });
    fastify.post('/', async (request, reply) => {
        const data = request.body;
        const evidence = await prisma_1.default.evidence.findUnique({
            where: { id: data.evidenceId },
        });
        if (!evidence) {
            reply.status(404).send({ error: '证据不存在' });
            return;
        }
        const transferNumber = await generateTransferNumber(data.transferType);
        const transfer = await prisma_1.default.evidenceTransfer.create({
            data: {
                transferNumber,
                evidenceId: data.evidenceId,
                caseId: data.caseId || evidence.caseId,
                clueId: data.clueId || evidence.clueId,
                transferType: data.transferType,
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
        await createTransferLog(transfer.id, 'CREATE', '申请', `创建${getTypeLabel(data.transferType)}申请`, undefined, 'PENDING', request, data.applicant, data.applicantDept);
        await (0, operationLog_1.logCreate)(operationLog_1.TargetType.EVIDENCE, data.evidenceId, `创建证据流转：${transferNumber} - ${getTypeLabel(data.transferType)}`, request, data.applicant, {
            transferId: transfer.id,
            transferNumber,
            transferType: data.transferType,
            reason: data.reason,
        });
        return transformTransfer(transfer);
    });
    fastify.post('/:id/approve', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
        const updated = await prisma_1.default.evidenceTransfer.update({
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
        await createTransferLog(transfer.id, data.pass ? 'APPROVE' : 'REJECT', '审批', data.pass ? '审批通过' : '审批驳回', 'PENDING', newStatus, request, data.approver, data.approverDept, data.approveOpinion);
        await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.EVIDENCE, transfer.evidenceId, `证据流转${data.pass ? '审批通过' : '审批驳回'}：${transfer.transferNumber}`, request, { status: transfer.status }, { status: newStatus }, data.approver);
        return transformTransfer(updated);
    });
    fastify.post('/:id/handle', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
        const updated = await prisma_1.default.evidenceTransfer.update({
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
        await createTransferLog(transfer.id, 'HANDLE', '处理', '流转处理中', 'IN_PROGRESS', 'IN_PROGRESS', request, data.handler, data.handlerDept, data.description);
        return transformTransfer(updated);
    });
    fastify.post('/:id/receive', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
        const updated = await prisma_1.default.evidenceTransfer.update({
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
        await createTransferLog(transfer.id, 'RECEIVE', '签收', `签收确认：${data.receiver}`, 'IN_PROGRESS', 'COMPLETED', request, data.receiver, data.receiverDept, data.receiveRemark);
        await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.EVIDENCE, transfer.evidenceId, `证据流转签收：${transfer.transferNumber} - ${getTypeLabel(transfer.transferType)}`, request, { status: transfer.status }, { status: 'COMPLETED' }, data.receiver);
        if (transfer.transferType === 'TRANSFER') {
            await prisma_1.default.evidence.update({
                where: { id: transfer.evidenceId },
                data: {
                    collector: data.receiver,
                },
            });
        }
        if (transfer.transferType === 'STORAGE_IN') {
            await prisma_1.default.evidence.update({
                where: { id: transfer.evidenceId },
                data: {
                    status: '已入库',
                    collector: data.receiver,
                },
            });
        }
        if (transfer.transferType === 'BORROW') {
            await prisma_1.default.evidence.update({
                where: { id: transfer.evidenceId },
                data: {
                    borrowStatus: '借阅中',
                    currentBorrower: data.receiver || transfer.toPerson,
                    borrowTime: new Date(),
                },
            });
        }
        if (transfer.transferType === 'SEAL') {
            await prisma_1.default.evidence.update({
                where: { id: transfer.evidenceId },
                data: {
                    status: '已封存',
                    collector: data.receiver,
                },
            });
        }
        if (transfer.transferType === 'UNSEAL') {
            await prisma_1.default.evidence.update({
                where: { id: transfer.evidenceId },
                data: {
                    status: '已入库',
                    collector: data.receiver,
                },
            });
        }
        if (transfer.transferType === 'RETURN') {
            await prisma_1.default.evidence.update({
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
    fastify.post('/:id/return', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
        const updated = await prisma_1.default.evidenceTransfer.update({
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
        await createTransferLog(transfer.id, 'RETURN', '归还', `归还确认：${data.returner}`, 'IN_PROGRESS', 'COMPLETED', request, data.returner, data.returnerDept, data.returnRemark);
        await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.EVIDENCE, transfer.evidenceId, `证据归还：${transfer.transferNumber}`, request, { status: transfer.status }, { status: 'COMPLETED' }, data.returner);
        await prisma_1.default.evidence.update({
            where: { id: transfer.evidenceId },
            data: {
                borrowStatus: '已归还',
                currentBorrower: null,
                borrowTime: null,
            },
        });
        return transformTransfer(updated);
    });
    fastify.post('/:id/destroy', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
        const updated = await prisma_1.default.evidenceTransfer.update({
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
        await createTransferLog(transfer.id, 'DESTROY', '销毁', `证据销毁完成，销毁方式：${data.destroyMethod || '未指定'}`, transfer.status, 'COMPLETED', request, data.operator, undefined, `监督人：${data.destroySupervisor || '未指定'}，见证人：${data.destroyWitness || '未指定'}`);
        await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.EVIDENCE, transfer.evidenceId, `证据销毁：${transfer.transferNumber}`, request, { status: '已入库' }, { status: '已销毁' }, data.operator);
        await prisma_1.default.evidence.update({
            where: { id: transfer.evidenceId },
            data: {
                status: '已销毁',
                borrowStatus: '已销毁',
            },
        });
        return transformTransfer(updated);
    });
    fastify.put('/:id/cancel', async (request, reply) => {
        const transfer = await prisma_1.default.evidenceTransfer.findUnique({
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
        const updated = await prisma_1.default.evidenceTransfer.update({
            where: { id: request.params.id },
            data: {
                status: 'CANCELLED',
            },
            include: {
                evidence: { select: { id: true, evidenceNumber: true, name: true } },
            },
        });
        await createTransferLog(transfer.id, 'CANCEL', '取消', `取消流转：${data.reason || '未说明原因'}`, transfer.status, 'CANCELLED', request, data.operator, undefined, data.reason);
        await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.EVIDENCE, transfer.evidenceId, `取消证据流转：${transfer.transferNumber}`, request, { status: transfer.status }, { status: 'CANCELLED' }, data.operator);
        return transformTransfer(updated);
    });
    fastify.delete('/:id', async (request, reply) => {
        try {
            const transfer = await prisma_1.default.evidenceTransfer.findUnique({
                where: { id: request.params.id },
            });
            if (!transfer) {
                reply.status(404).send({ error: '流转记录不存在' });
                return;
            }
            await prisma_1.default.evidenceTransfer.delete({
                where: { id: request.params.id },
            });
            return { success: true };
        }
        catch (error) {
            reply.status(500).send({ error: '删除失败' });
        }
    });
    fastify.get('/responsibility/trace', async (request, reply) => {
        const { evidenceId, personName, startDate, endDate } = request.query;
        const where = {};
        if (evidenceId)
            where.evidenceId = evidenceId;
        if (startDate)
            where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
        if (endDate)
            where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
        const transfers = await prisma_1.default.evidenceTransfer.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                evidence: { select: { id: true, evidenceNumber: true, name: true } },
                flowLogs: { orderBy: { actionTime: 'asc' } },
            },
        });
        const responsibilityChain = [];
        transfers.forEach((transfer) => {
            const nodes = [];
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
                items: responsibilityChain.filter((item) => item.nodes.some((node) => node.person && node.person.includes(personName))),
            };
        }
        return { items: responsibilityChain };
    });
}
