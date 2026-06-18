"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
const operationLog_1 = require("../lib/operationLog");
const createCheckLog = async (flowId, stage, action, description, request, beforeData, afterData, operatorName, operatorDept) => {
    await prisma_1.default.clueCheckLog.create({
        data: {
            flowId,
            stage: stage,
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
async function default_1(fastify) {
    fastify.get('/', async (request, reply) => {
        const { page = 1, pageSize = 10, keyword, status, currentStage, clueId, caseId, priority, registerUserName, dispatchToUserName, verifyUserName, startDate, endDate, } = request.query;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { flowNumber: { contains: keyword, mode: 'insensitive' } },
                { registerContent: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (status)
            where.status = status;
        if (currentStage)
            where.currentStage = currentStage;
        if (clueId)
            where.clueId = clueId;
        if (caseId)
            where.caseId = caseId;
        if (priority)
            where.priority = priority;
        if (registerUserName)
            where.registerUserName = { contains: registerUserName };
        if (dispatchToUserName)
            where.dispatchToUserName = { contains: dispatchToUserName };
        if (verifyUserName)
            where.verifyUserName = { contains: verifyUserName };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate + 'T23:59:59');
        }
        const [items, total] = await Promise.all([
            prisma_1.default.clueCheckFlow.findMany({
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
            prisma_1.default.clueCheckFlow.count({ where }),
        ]);
        return { items, total, page, pageSize };
    });
    fastify.get('/stats', async (request, reply) => {
        const [total, byStatus, byStage] = await Promise.all([
            prisma_1.default.clueCheckFlow.count(),
            prisma_1.default.clueCheckFlow.groupBy({
                by: ['status'],
                _count: { status: true },
            }),
            prisma_1.default.clueCheckFlow.groupBy({
                by: ['currentStage'],
                _count: { currentStage: true },
            }),
        ]);
        const byStatusMap = {};
        byStatus.forEach((item) => {
            byStatusMap[item.status] = item._count.status;
        });
        const byStageMap = {};
        byStage.forEach((item) => {
            byStageMap[item.currentStage] = item._count.currentStage;
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = await prisma_1.default.clueCheckFlow.count({
            where: { createdAt: { gte: today } },
        });
        return {
            total,
            byStatus: byStatusMap,
            byStage: byStageMap,
            todayCount,
        };
    });
    fastify.get('/:id', async (request, reply) => {
        const flow = await prisma_1.default.clueCheckFlow.findUnique({
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
        return flow;
    });
    fastify.post('/register', async (request, reply) => {
        const data = request.body;
        try {
            const count = await prisma_1.default.clueCheckFlow.count();
            const flowNumber = `HC${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
            const flow = await prisma_1.default.clueCheckFlow.create({
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
            await createCheckLog(flow.id, 'REGISTER', 'REGISTER', `登记线索核查流程：${flowNumber} - ${flow.title}`, request, null, {
                id: flow.id,
                flowNumber,
                title: flow.title,
                clueId: flow.clueId,
                registerUserName: flow.registerUserName,
            }, data.registerUserName, data.registerUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_REGISTER,
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
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            if (data.clueId) {
                await (0, operationLog_1.createOperationLog)({
                    targetType: operationLog_1.TargetType.CLUE,
                    targetId: data.clueId,
                    action: operationLog_1.ActionType.CHECK_REGISTER,
                    description: `发起线索核查流程：${flowNumber}`,
                    operator: data.registerUserName,
                    operatorDepartment: data.registerUserDept,
                    afterData: { flowId: flow.id, flowNumber },
                    ...(0, operationLog_1.getRequestMeta)(request),
                });
            }
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '登记失败：' + (error.message || '未知错误') });
        }
    });
    fastify.post('/:id/dispatch', async (request, reply) => {
        const { id } = request.params;
        const data = request.body;
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id } });
            if (!beforeFlow) {
                reply.status(404).send({ error: '核查流程不存在' });
                return;
            }
            const flow = await prisma_1.default.clueCheckFlow.update({
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
            await createCheckLog(flow.id, 'DISPATCH', 'DISPATCH', `派发线索核查任务给 ${data.dispatchToUserName}${data.dispatchDeadline ? '，截止时间：' + data.dispatchDeadline : ''}${data.dispatchRemark ? '，备注：' + data.dispatchRemark : ''}`, request, {
                status: beforeFlow.status,
                currentStage: beforeFlow.currentStage,
                dispatchToUserName: beforeFlow.dispatchToUserName,
            }, {
                status: flow.status,
                currentStage: flow.currentStage,
                dispatchToUserName: flow.dispatchToUserName,
                dispatchDeadline: flow.dispatchDeadline,
            }, data.dispatchUserName, data.dispatchUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_DISPATCH,
                description: `派发核查任务：${flow.flowNumber} 给 ${data.dispatchToUserName}`,
                operator: data.dispatchUserName,
                operatorDepartment: data.dispatchUserDept,
                beforeData: { status: beforeFlow.status },
                afterData: {
                    status: flow.status,
                    dispatchToUserName: data.dispatchToUserName,
                    dispatchDeadline: data.dispatchDeadline,
                },
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            if (flow.clueId) {
                await (0, operationLog_1.createOperationLog)({
                    targetType: operationLog_1.TargetType.CLUE,
                    targetId: flow.clueId,
                    action: operationLog_1.ActionType.CHECK_DISPATCH,
                    description: `核查派发：${flow.flowNumber} - 派发给 ${data.dispatchToUserName}`,
                    operator: data.dispatchUserName,
                    operatorDepartment: data.dispatchUserDept,
                    afterData: { flowId: flow.id, dispatchToUserName: data.dispatchToUserName },
                    ...(0, operationLog_1.getRequestMeta)(request),
                });
            }
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '派发失败：' + (error.message || '未知错误') });
        }
    });
    fastify.post('/:id/verify', async (request, reply) => {
        const { id } = request.params;
        const data = request.body;
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id } });
            if (!beforeFlow) {
                reply.status(404).send({ error: '核查流程不存在' });
                return;
            }
            const flow = await prisma_1.default.clueCheckFlow.update({
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
            await createCheckLog(flow.id, 'VERIFY', 'VERIFY', `核实线索：${data.verifyResult}${data.verifyConclusion ? '，核实结论：' + data.verifyConclusion : ''}`, request, {
                status: beforeFlow.status,
                currentStage: beforeFlow.currentStage,
            }, {
                status: flow.status,
                currentStage: flow.currentStage,
                verifyResult: data.verifyResult,
                verifyConclusion: data.verifyConclusion,
            }, data.verifyUserName, data.verifyUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_VERIFY,
                description: `核实线索：${flow.flowNumber} - ${data.verifyResult}`,
                operator: data.verifyUserName,
                operatorDepartment: data.verifyUserDept,
                beforeData: { status: beforeFlow.status },
                afterData: {
                    status: flow.status,
                    verifyResult: data.verifyResult,
                    verifyConclusion: data.verifyConclusion,
                },
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            if (flow.clueId) {
                await (0, operationLog_1.createOperationLog)({
                    targetType: operationLog_1.TargetType.CLUE,
                    targetId: flow.clueId,
                    action: operationLog_1.ActionType.CHECK_VERIFY,
                    description: `线索核实：${flow.flowNumber} - ${data.verifyResult}`,
                    operator: data.verifyUserName,
                    operatorDepartment: data.verifyUserDept,
                    afterData: { flowId: flow.id, verifyResult: data.verifyResult },
                    ...(0, operationLog_1.getRequestMeta)(request),
                });
            }
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '核实失败：' + (error.message || '未知错误') });
        }
    });
    fastify.post('/:id/feedback', async (request, reply) => {
        const { id } = request.params;
        const data = request.body;
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id } });
            if (!beforeFlow) {
                reply.status(404).send({ error: '核查流程不存在' });
                return;
            }
            const flow = await prisma_1.default.clueCheckFlow.update({
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
            await createCheckLog(flow.id, 'FEEDBACK', 'FEEDBACK', `反馈核查结果：${data.feedbackContent.substring(0, 100)}${data.feedbackResult ? '，反馈结论：' + data.feedbackResult : ''}`, request, {
                status: beforeFlow.status,
                currentStage: beforeFlow.currentStage,
            }, {
                status: flow.status,
                currentStage: flow.currentStage,
                feedbackResult: data.feedbackResult,
            }, data.feedbackUserName, data.feedbackUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_FEEDBACK,
                description: `核查反馈：${flow.flowNumber}${data.feedbackResult ? ' - ' + data.feedbackResult : ''}`,
                operator: data.feedbackUserName,
                operatorDepartment: data.feedbackUserDept,
                beforeData: { status: beforeFlow.status },
                afterData: {
                    status: flow.status,
                    feedbackContent: data.feedbackContent,
                    feedbackResult: data.feedbackResult,
                },
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            if (flow.clueId) {
                await (0, operationLog_1.createOperationLog)({
                    targetType: operationLog_1.TargetType.CLUE,
                    targetId: flow.clueId,
                    action: operationLog_1.ActionType.CHECK_FEEDBACK,
                    description: `核查反馈：${flow.flowNumber}${data.feedbackResult ? ' - ' + data.feedbackResult : ''}`,
                    operator: data.feedbackUserName,
                    operatorDepartment: data.feedbackUserDept,
                    afterData: { flowId: flow.id, feedbackResult: data.feedbackResult },
                    ...(0, operationLog_1.getRequestMeta)(request),
                });
            }
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '反馈失败：' + (error.message || '未知错误') });
        }
    });
    fastify.post('/:id/adopt', async (request, reply) => {
        const { id } = request.params;
        const data = request.body;
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id } });
            if (!beforeFlow) {
                reply.status(404).send({ error: '核查流程不存在' });
                return;
            }
            const updateData = {
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
            const flow = await prisma_1.default.clueCheckFlow.update({
                where: { id },
                data: updateData,
                include: {
                    clue: { select: { id: true, clueNumber: true, title: true } },
                    case: { select: { id: true, caseNumber: true, title: true } },
                },
            });
            if (data.adoptToCaseId && flow.clueId) {
                await prisma_1.default.clue.update({
                    where: { id: flow.clueId },
                    data: { caseId: data.adoptToCaseId, status: '已采用' },
                });
            }
            else if (flow.clueId) {
                await prisma_1.default.clue.update({
                    where: { id: flow.clueId },
                    data: { status: '已采用' },
                });
            }
            await createCheckLog(flow.id, 'ADOPT', 'ADOPT', `采用核查结果：${data.adoptResult}${data.adoptOpinion ? '，采用意见：' + data.adoptOpinion : ''}${data.adoptToCaseId ? '，归档至案件：' + data.adoptToCaseId : ''}`, request, {
                status: beforeFlow.status,
                currentStage: beforeFlow.currentStage,
            }, {
                status: flow.status,
                currentStage: flow.currentStage,
                adoptResult: data.adoptResult,
                adoptToCaseId: data.adoptToCaseId,
            }, data.adoptUserName, data.adoptUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_ADOPT,
                description: `采用核查：${flow.flowNumber} - ${data.adoptResult}`,
                operator: data.adoptUserName,
                operatorDepartment: data.adoptUserDept,
                beforeData: { status: beforeFlow.status },
                afterData: {
                    status: flow.status,
                    adoptResult: data.adoptResult,
                    adoptToCaseId: data.adoptToCaseId,
                },
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            if (flow.clueId) {
                await (0, operationLog_1.createOperationLog)({
                    targetType: operationLog_1.TargetType.CLUE,
                    targetId: flow.clueId,
                    action: operationLog_1.ActionType.CHECK_ADOPT,
                    description: `线索已采用：${flow.flowNumber} - ${data.adoptResult}`,
                    operator: data.adoptUserName,
                    operatorDepartment: data.adoptUserDept,
                    afterData: { flowId: flow.id, adoptResult: data.adoptResult, adoptToCaseId: data.adoptToCaseId },
                    ...(0, operationLog_1.getRequestMeta)(request),
                });
            }
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '采用失败：' + (error.message || '未知错误') });
        }
    });
    fastify.post('/:id/reject', async (request, reply) => {
        const { id } = request.params;
        const data = request.body;
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id } });
            if (!beforeFlow) {
                reply.status(404).send({ error: '核查流程不存在' });
                return;
            }
            const flow = await prisma_1.default.clueCheckFlow.update({
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
                await prisma_1.default.clue.update({
                    where: { id: flow.clueId },
                    data: { status: '已排除' },
                });
            }
            await createCheckLog(flow.id, flow.currentStage, 'REJECT', `不予采用/驳回：${data.rejectReason}`, request, {
                status: beforeFlow.status,
            }, {
                status: flow.status,
                rejectReason: data.rejectReason,
            }, data.rejectUserName, data.rejectUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_REJECT,
                description: `驳回核查：${flow.flowNumber} - ${data.rejectReason}`,
                operator: data.rejectUserName,
                operatorDepartment: data.rejectUserDept,
                beforeData: { status: beforeFlow.status },
                afterData: { status: flow.status, rejectReason: data.rejectReason },
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            if (flow.clueId) {
                await (0, operationLog_1.createOperationLog)({
                    targetType: operationLog_1.TargetType.CLUE,
                    targetId: flow.clueId,
                    action: operationLog_1.ActionType.CHECK_REJECT,
                    description: `核查驳回：${flow.flowNumber} - ${data.rejectReason}`,
                    operator: data.rejectUserName,
                    operatorDepartment: data.rejectUserDept,
                    afterData: { flowId: flow.id, rejectReason: data.rejectReason },
                    ...(0, operationLog_1.getRequestMeta)(request),
                });
            }
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '驳回失败：' + (error.message || '未知错误') });
        }
    });
    fastify.post('/:id/close', async (request, reply) => {
        const { id } = request.params;
        const data = request.body;
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id } });
            if (!beforeFlow) {
                reply.status(404).send({ error: '核查流程不存在' });
                return;
            }
            const flow = await prisma_1.default.clueCheckFlow.update({
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
            await createCheckLog(flow.id, flow.currentStage, 'CLOSE', `关闭核查流程${data.closeReason ? '，原因：' + data.closeReason : ''}`, request, { status: beforeFlow.status }, { status: flow.status, closeReason: data.closeReason }, data.closeUserName, data.closeUserDept);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: flow.id,
                action: operationLog_1.ActionType.CHECK_CLOSE,
                description: `关闭核查：${flow.flowNumber}${data.closeReason ? ' - ' + data.closeReason : ''}`,
                operator: data.closeUserName,
                operatorDepartment: data.closeUserDept,
                beforeData: { status: beforeFlow.status },
                afterData: { status: flow.status, closeReason: data.closeReason },
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '关闭失败：' + (error.message || '未知错误') });
        }
    });
    fastify.delete('/:id', async (request, reply) => {
        try {
            const beforeFlow = await prisma_1.default.clueCheckFlow.findUnique({ where: { id: request.params.id } });
            await prisma_1.default.clueCheckLog.deleteMany({ where: { flowId: request.params.id } });
            await prisma_1.default.clueCheckFlow.delete({ where: { id: request.params.id } });
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.CLUE_CHECK_FLOW,
                targetId: request.params.id,
                action: operationLog_1.ActionType.DELETE,
                description: `删除线索核查流程：${beforeFlow?.flowNumber || ''} - ${beforeFlow?.title || ''}`,
                beforeData: beforeFlow ? {
                    id: beforeFlow.id,
                    flowNumber: beforeFlow.flowNumber,
                    title: beforeFlow.title,
                    status: beforeFlow.status,
                    clueId: beforeFlow.clueId,
                } : undefined,
                ...(0, operationLog_1.getRequestMeta)(request),
            });
            return { success: true };
        }
        catch (error) {
            reply.status(404).send({ error: '删除失败' });
        }
    });
    fastify.get('/:id/logs', async (request, reply) => {
        const { page = 1, pageSize = 50 } = request.query;
        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            prisma_1.default.clueCheckLog.findMany({
                where: { flowId: request.params.id },
                skip,
                take: pageSize,
                orderBy: { actionTime: 'desc' },
            }),
            prisma_1.default.clueCheckLog.count({ where: { flowId: request.params.id } }),
        ]);
        return { items, total, page, pageSize };
    });
}
