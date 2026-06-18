"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const prisma_1 = __importDefault(require("../lib/prisma"));
const operationLog_1 = require("../lib/operationLog");
const getOverdueInfo = (task, now) => {
    const warnings = [];
    let isOverdue = false;
    let daysOverdue = 0;
    let daysRemaining = 0;
    if (task.dueDate && ['PENDING', 'IN_PROGRESS'].includes(task.status)) {
        const due = new Date(task.dueDate);
        const diff = due.getTime() - now.getTime();
        daysRemaining = Math.ceil(diff / (24 * 60 * 60 * 1000));
        if (diff < 0) {
            isOverdue = true;
            daysOverdue = Math.abs(Math.floor(diff / (24 * 60 * 60 * 1000)));
            warnings.push({
                type: 'overdue',
                label: '任务逾期',
                level: 'danger',
                daysOverdue,
                description: `任务已逾期 ${daysOverdue} 天`,
            });
        }
        else if (daysRemaining <= 2) {
            warnings.push({
                type: 'nearDue',
                label: '即将到期',
                level: 'warning',
                daysRemaining,
                description: `任务还剩 ${daysRemaining} 天到期`,
            });
        }
    }
    if (task.status === 'IN_PROGRESS' && task.progress === 0) {
        const created = new Date(task.createdAt);
        const daysSinceCreated = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceCreated >= 3) {
            warnings.push({
                type: 'noProgress',
                label: '无进度更新',
                level: 'warning',
                days: daysSinceCreated,
                description: `任务开始 ${daysSinceCreated} 天仍无进度更新`,
            });
        }
    }
    return { warnings, isOverdue, daysOverdue, daysRemaining };
};
const getSourceInfo = async (sourceType, sourceId) => {
    switch (sourceType) {
        case 'CASE': {
            const c = await prisma_1.default.case.findUnique({ where: { id: sourceId }, select: { caseNumber: true, title: true } });
            return { sourceNumber: c?.caseNumber, sourceName: c?.title };
        }
        case 'CLUE': {
            const c = await prisma_1.default.clue.findUnique({ where: { id: sourceId }, select: { clueNumber: true, title: true } });
            return { sourceNumber: c?.clueNumber, sourceName: c?.title };
        }
        case 'EVIDENCE': {
            const e = await prisma_1.default.evidence.findUnique({ where: { id: sourceId }, select: { evidenceNumber: true, name: true } });
            return { sourceNumber: e?.evidenceNumber, sourceName: e?.name };
        }
        case 'PERSON': {
            const p = await prisma_1.default.person.findUnique({ where: { id: sourceId }, select: { name: true } });
            return { sourceNumber: undefined, sourceName: p?.name };
        }
        default:
            return {};
    }
};
async function default_1(fastify) {
    fastify.get('/tasks', async (request, reply) => {
        const { page = 1, pageSize = 10, keyword, taskType, priority, status, caseId, clueId, evidenceId, personId, assigneeId, startDate, endDate, onlyOverdue, onlyWarning, } = request.query;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: 'insensitive' } },
                { taskNumber: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
            ];
        }
        if (taskType)
            where.taskType = taskType;
        if (priority)
            where.priority = priority;
        if (status)
            where.status = status;
        if (caseId)
            where.caseId = caseId;
        if (clueId)
            where.clueId = clueId;
        if (evidenceId)
            where.evidenceId = evidenceId;
        if (personId)
            where.personId = personId;
        if (assigneeId)
            where.assigneeId = assigneeId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [items, total] = await Promise.all([
            prisma_1.default.commandTask.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [
                    { priority: 'asc' },
                    { createdAt: 'desc' },
                ],
                include: {
                    case: { select: { id: true, caseNumber: true, title: true } },
                    clue: { select: { id: true, clueNumber: true, title: true } },
                    evidence: { select: { id: true, evidenceNumber: true, name: true } },
                    person: { select: { id: true, name: true, personType: true } },
                    _count: { select: { progresses: true, flowRecords: true } },
                },
            }),
            prisma_1.default.commandTask.count({ where }),
        ]);
        const now = new Date();
        let enrichedItems = items.map((item) => {
            const overdueInfo = getOverdueInfo(item, now);
            return {
                ...item,
                ...overdueInfo,
                warningCount: overdueInfo.warnings.length,
                hasWarning: overdueInfo.warnings.length > 0,
            };
        });
        if (onlyOverdue === 'true') {
            enrichedItems = enrichedItems.filter((i) => i.isOverdue);
        }
        if (onlyWarning === 'true') {
            enrichedItems = enrichedItems.filter((i) => i.hasWarning);
        }
        return { items: enrichedItems, total, page, pageSize };
    });
    fastify.get('/tasks/stats', async () => {
        const now = new Date();
        const allTasks = await prisma_1.default.commandTask.findMany({
            include: { _count: { select: { progresses: true } } },
        });
        const stats = {
            total: allTasks.length,
            byStatus: { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0, OVERDUE: 0 },
            byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
            byType: {},
            overdueCount: 0,
            nearDueCount: 0,
            warningCount: 0,
            avgProgress: 0,
            completedRate: 0,
        };
        let totalProgress = 0;
        allTasks.forEach((task) => {
            stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
            stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
            stats.byType[task.taskType] = (stats.byType[task.taskType] || 0) + 1;
            totalProgress += task.progress;
            const { isOverdue, warnings } = getOverdueInfo(task, now);
            if (isOverdue)
                stats.overdueCount++;
            if (warnings.some((w) => w.type === 'nearDue'))
                stats.nearDueCount++;
            if (warnings.length > 0)
                stats.warningCount++;
        });
        const completed = (stats.byStatus.COMPLETED || 0);
        stats.avgProgress = allTasks.length > 0 ? Math.round(totalProgress / allTasks.length) : 0;
        stats.completedRate = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
        return stats;
    });
    fastify.get('/tasks/warnings', async () => {
        const now = new Date();
        const allTasks = await prisma_1.default.commandTask.findMany({
            where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            include: {
                case: { select: { id: true, caseNumber: true, title: true } },
                clue: { select: { id: true, clueNumber: true, title: true } },
                evidence: { select: { id: true, evidenceNumber: true, name: true } },
                person: { select: { id: true, name: true } },
            },
        });
        const allWarnings = [];
        allTasks.forEach((task) => {
            const { warnings, isOverdue, daysOverdue, daysRemaining } = getOverdueInfo(task, now);
            warnings.forEach((w) => {
                allWarnings.push({
                    ...w,
                    taskId: task.id,
                    taskNumber: task.taskNumber,
                    taskTitle: task.title,
                    taskType: task.taskType,
                    priority: task.priority,
                    status: task.status,
                    progress: task.progress,
                    isOverdue,
                    daysOverdue,
                    daysRemaining,
                    assigneeName: task.assigneeName,
                    assigneeDept: task.assigneeDept,
                    dueDate: task.dueDate,
                    case: task.case,
                    clue: task.clue,
                    evidence: task.evidence,
                    person: task.person,
                });
            });
        });
        allWarnings.sort((a, b) => {
            const levelOrder = { danger: 0, warning: 1 };
            if (levelOrder[a.level] !== levelOrder[b.level])
                return levelOrder[a.level] - levelOrder[b.level];
            return (b.daysOverdue || 0) - (a.daysOverdue || 0);
        });
        return {
            items: allWarnings,
            total: allWarnings.length,
            dangerCount: allWarnings.filter((w) => w.level === 'danger').length,
            warningCount: allWarnings.filter((w) => w.level === 'warning').length,
        };
    });
    fastify.get('/tasks/:id', async (request, reply) => {
        const task = await prisma_1.default.commandTask.findUnique({
            where: { id: request.params.id },
            include: {
                case: { select: { id: true, caseNumber: true, title: true } },
                clue: { select: { id: true, clueNumber: true, title: true } },
                evidence: { select: { id: true, evidenceNumber: true, name: true } },
                person: { select: { id: true, name: true, personType: true } },
                progresses: { orderBy: { createdAt: 'desc' } },
                flowRecords: { orderBy: { actionTime: 'desc' } },
            },
        });
        if (!task) {
            reply.status(404).send({ error: '任务不存在' });
            return;
        }
        const now = new Date();
        const overdueInfo = getOverdueInfo(task, now);
        return { ...task, ...overdueInfo, warningCount: overdueInfo.warnings.length, hasWarning: overdueInfo.warnings.length > 0 };
    });
    fastify.post('/tasks', async (request, reply) => {
        const data = request.body;
        const count = await prisma_1.default.commandTask.count();
        const taskNumber = `RW${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
        const task = await prisma_1.default.commandTask.create({
            data: {
                taskNumber,
                title: data.title,
                description: data.description,
                taskType: data.taskType,
                priority: data.priority,
                caseId: data.caseId || undefined,
                clueId: data.clueId || undefined,
                evidenceId: data.evidenceId || undefined,
                personId: data.personId || undefined,
                assigneeId: data.assigneeId || undefined,
                assigneeName: data.assigneeName || undefined,
                assigneeDept: data.assigneeDept || undefined,
                assignerId: data.assignerId || undefined,
                assignerName: data.assignerName || undefined,
                assignerDept: data.assignerDept || undefined,
                dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                location: data.location || undefined,
                requirement: data.requirement || undefined,
                note: data.note || undefined,
            },
        });
        await (0, operationLog_1.logCreate)(operationLog_1.TargetType.COMMAND_TASK, task.id, `创建任务：${taskNumber} - ${task.title}`, request, task.assignerName || (0, operationLog_1.extractOperator)(request), {
            id: task.id,
            taskNumber: task.taskNumber,
            title: task.title,
            taskType: task.taskType,
            priority: task.priority,
            status: task.status,
            assigneeName: task.assigneeName,
            caseId: task.caseId,
            clueId: task.clueId,
            evidenceId: task.evidenceId,
            personId: task.personId,
        });
        return task;
    });
    fastify.put('/tasks/:id', async (request, reply) => {
        const data = request.body;
        try {
            const beforeTask = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            const updateData = { ...data };
            if (data.dueDate)
                updateData.dueDate = new Date(data.dueDate);
            if (data.startDate)
                updateData.startDate = new Date(data.startDate);
            if (data.completedDate)
                updateData.completedDate = new Date(data.completedDate);
            if (data.actualStart)
                updateData.actualStart = new Date(data.actualStart);
            if (data.actualEnd)
                updateData.actualEnd = new Date(data.actualEnd);
            const task = await prisma_1.default.commandTask.update({
                where: { id: request.params.id },
                data: updateData,
            });
            await (0, operationLog_1.logUpdate)(operationLog_1.TargetType.COMMAND_TASK, task.id, `更新任务：${task.taskNumber} - ${task.title}`, request, {
                title: beforeTask?.title,
                taskType: beforeTask?.taskType,
                priority: beforeTask?.priority,
                status: beforeTask?.status,
                progress: beforeTask?.progress,
                assigneeName: beforeTask?.assigneeName,
                dueDate: beforeTask?.dueDate,
            }, {
                title: task.title,
                taskType: task.taskType,
                priority: task.priority,
                status: task.status,
                progress: task.progress,
                assigneeName: task.assigneeName,
                dueDate: task.dueDate,
            }, task.assignerName || (0, operationLog_1.extractOperator)(request));
            return task;
        }
        catch (error) {
            reply.status(404).send({ error: '任务不存在' });
        }
    });
    fastify.delete('/tasks/:id', async (request, reply) => {
        try {
            const beforeTask = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            await prisma_1.default.$transaction([
                prisma_1.default.taskProgress.deleteMany({ where: { taskId: request.params.id } }),
                prisma_1.default.flowRecord.deleteMany({ where: { taskId: request.params.id } }),
                prisma_1.default.commandTask.delete({ where: { id: request.params.id } }),
            ]);
            await (0, operationLog_1.logDelete)(operationLog_1.TargetType.COMMAND_TASK, request.params.id, `删除任务：${beforeTask?.taskNumber || ''} - ${beforeTask?.title || ''}`, request, beforeTask ? {
                id: beforeTask.id,
                taskNumber: beforeTask.taskNumber,
                title: beforeTask.title,
                taskType: beforeTask.taskType,
                priority: beforeTask.priority,
                status: beforeTask.status,
            } : undefined);
            return { success: true };
        }
        catch (error) {
            reply.status(404).send({ error: '任务不存在' });
        }
    });
    fastify.post('/tasks/:id/assign', async (request, reply) => {
        try {
            const task = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            if (!task) {
                reply.status(404).send({ error: '任务不存在' });
                return;
            }
            const body = request.body;
            const updated = await prisma_1.default.commandTask.update({
                where: { id: request.params.id },
                data: {
                    assigneeId: body.assigneeId,
                    assigneeName: body.assigneeName,
                    assigneeDept: body.assigneeDept,
                    assignerId: body.assignerId,
                    assignerName: body.assignerName,
                    assignerDept: body.assignerDept,
                    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                    note: body.note,
                },
            });
            const meta = (0, operationLog_1.getRequestMeta)(request);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.COMMAND_TASK,
                targetId: request.params.id,
                action: operationLog_1.ActionType.TASK_ASSIGN,
                description: `分派任务：${task.taskNumber} - ${task.title} 给 ${body.assigneeName}`,
                operator: body.assignerName || (0, operationLog_1.extractOperator)(request),
                afterData: {
                    assigneeId: body.assigneeId,
                    assigneeName: body.assigneeName,
                    assigneeDept: body.assigneeDept,
                    dueDate: body.dueDate,
                    note: body.note,
                },
                ...meta,
            });
            await prisma_1.default.flowRecord.create({
                data: {
                    taskId: task.id,
                    sourceType: task.caseId ? 'CASE' : task.clueId ? 'CLUE' : task.evidenceId ? 'EVIDENCE' : task.personId ? 'PERSON' : 'CASE',
                    sourceId: task.caseId || task.clueId || task.evidenceId || task.personId || '',
                    sourceName: task.title,
                    sourceNumber: task.taskNumber,
                    action: 'ASSIGN',
                    description: `任务分派：${body.assigneeName}`,
                    fromUserId: body.assignerId,
                    fromUserName: body.assignerName,
                    fromUserDept: body.assignerDept,
                    toUserId: body.assigneeId,
                    toUserName: body.assigneeName,
                    toUserDept: body.assigneeDept,
                    status: '已分派',
                    remark: body.note,
                    operatorId: body.assignerId,
                    operatorName: body.assignerName,
                    operatorDept: body.assignerDept,
                },
            });
            return updated;
        }
        catch (error) {
            reply.status(400).send({ error: '分派失败' });
        }
    });
    fastify.post('/tasks/:id/transfer', async (request, reply) => {
        try {
            const task = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            if (!task) {
                reply.status(404).send({ error: '任务不存在' });
                return;
            }
            const body = request.body;
            const updated = await prisma_1.default.commandTask.update({
                where: { id: request.params.id },
                data: {
                    assigneeId: body.toUserId,
                    assigneeName: body.toUserName,
                    assigneeDept: body.toUserDept,
                },
            });
            const meta = (0, operationLog_1.getRequestMeta)(request);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.COMMAND_TASK,
                targetId: request.params.id,
                action: operationLog_1.ActionType.TASK_TRANSFER,
                description: `转派任务：${task.taskNumber} - ${task.title} 从 ${body.fromUserName} 到 ${body.toUserName}`,
                operator: body.operatorName || (0, operationLog_1.extractOperator)(request),
                beforeData: {
                    assigneeId: body.fromUserId,
                    assigneeName: body.fromUserName,
                    assigneeDept: body.fromUserDept,
                },
                afterData: {
                    assigneeId: body.toUserId,
                    assigneeName: body.toUserName,
                    assigneeDept: body.toUserDept,
                    reason: body.reason,
                },
                ...meta,
            });
            await prisma_1.default.flowRecord.create({
                data: {
                    taskId: task.id,
                    sourceType: task.caseId ? 'CASE' : task.clueId ? 'CLUE' : task.evidenceId ? 'EVIDENCE' : task.personId ? 'PERSON' : 'CASE',
                    sourceId: task.caseId || task.clueId || task.evidenceId || task.personId || '',
                    sourceName: task.title,
                    sourceNumber: task.taskNumber,
                    action: 'TRANSFER',
                    description: `任务转派：${body.fromUserName} → ${body.toUserName}，原因：${body.reason || '无'}`,
                    fromUserId: body.fromUserId,
                    fromUserName: body.fromUserName,
                    fromUserDept: body.fromUserDept,
                    toUserId: body.toUserId,
                    toUserName: body.toUserName,
                    toUserDept: body.toUserDept,
                    status: '已转派',
                    remark: body.reason,
                    operatorId: body.operatorId,
                    operatorName: body.operatorName,
                    operatorDept: body.operatorDept,
                },
            });
            return updated;
        }
        catch (error) {
            reply.status(400).send({ error: '转派失败' });
        }
    });
    fastify.post('/tasks/:id/complete', async (request, reply) => {
        try {
            const task = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            if (!task) {
                reply.status(404).send({ error: '任务不存在' });
                return;
            }
            const now = new Date();
            const body = request.body;
            const updated = await prisma_1.default.commandTask.update({
                where: { id: request.params.id },
                data: {
                    status: 'COMPLETED',
                    progress: 100,
                    result: body.result,
                    completedDate: now,
                    actualEnd: now,
                },
            });
            const meta = (0, operationLog_1.getRequestMeta)(request);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.COMMAND_TASK,
                targetId: request.params.id,
                action: operationLog_1.ActionType.TASK_COMPLETE,
                description: `完成任务：${task.taskNumber} - ${task.title}`,
                operator: body.operatorName || (0, operationLog_1.extractOperator)(request),
                afterData: {
                    result: body.result,
                    note: body.note,
                    completedDate: now.toISOString(),
                },
                ...meta,
            });
            return updated;
        }
        catch (error) {
            reply.status(400).send({ error: '完成失败' });
        }
    });
    fastify.post('/tasks/:id/cancel', async (request, reply) => {
        try {
            const task = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            if (!task) {
                reply.status(404).send({ error: '任务不存在' });
                return;
            }
            const body = request.body;
            const updated = await prisma_1.default.commandTask.update({
                where: { id: request.params.id },
                data: {
                    status: 'CANCELLED',
                    note: body.reason,
                },
            });
            const meta = (0, operationLog_1.getRequestMeta)(request);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.COMMAND_TASK,
                targetId: request.params.id,
                action: operationLog_1.ActionType.TASK_CANCEL,
                description: `取消任务：${task.taskNumber} - ${task.title}，原因：${body.reason || '无'}`,
                operator: body.operatorName || (0, operationLog_1.extractOperator)(request),
                afterData: { reason: body.reason },
                ...meta,
            });
            return updated;
        }
        catch (error) {
            reply.status(400).send({ error: '取消失败' });
        }
    });
    fastify.get('/tasks/:id/progresses', async (request, reply) => {
        const progresses = await prisma_1.default.taskProgress.findMany({
            where: { taskId: request.params.id },
            orderBy: { createdAt: 'desc' },
        });
        return progresses;
    });
    fastify.post('/tasks/:id/progresses', async (request, reply) => {
        try {
            const task = await prisma_1.default.commandTask.findUnique({ where: { id: request.params.id } });
            if (!task) {
                reply.status(404).send({ error: '任务不存在' });
                return;
            }
            const body = request.body;
            const progress = await prisma_1.default.taskProgress.create({
                data: {
                    taskId: request.params.id,
                    progress: body.progress,
                    description: body.description,
                    result: body.result,
                    issue: body.issue,
                    suggestion: body.suggestion,
                    reporterId: body.reporterId,
                    reporterName: body.reporterName,
                    progressDate: body.progressDate ? new Date(body.progressDate) : new Date(),
                },
            });
            const now = new Date();
            let newStatus = task.status;
            if (task.status === 'PENDING' && body.progress > 0)
                newStatus = 'IN_PROGRESS';
            let actualStart = task.actualStart;
            if (!actualStart && body.progress > 0)
                actualStart = now;
            const updatedTask = await prisma_1.default.commandTask.update({
                where: { id: request.params.id },
                data: {
                    progress: body.progress,
                    status: newStatus,
                    actualStart,
                    updatedAt: now,
                },
            });
            const meta = (0, operationLog_1.getRequestMeta)(request);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.TASK_PROGRESS,
                targetId: progress.id,
                action: operationLog_1.ActionType.TASK_PROGRESS_UPDATE,
                description: `任务进度回填：${task.taskNumber} - ${task.title}，进度 ${body.progress}%`,
                operator: body.reporterName || (0, operationLog_1.extractOperator)(request),
                afterData: {
                    progressId: progress.id,
                    progress: body.progress,
                    description: body.description,
                    result: body.result,
                    issue: body.issue,
                    suggestion: body.suggestion,
                },
                ...meta,
            });
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.COMMAND_TASK,
                targetId: task.id,
                action: operationLog_1.ActionType.UPDATE,
                description: `任务进度更新：${task.taskNumber} - ${task.title}，当前进度 ${body.progress}%`,
                operator: body.reporterName || (0, operationLog_1.extractOperator)(request),
                beforeData: { progress: task.progress, status: task.status },
                afterData: { progress: body.progress, status: newStatus },
                ...meta,
            });
            return { progress, task: updatedTask };
        }
        catch (error) {
            reply.status(400).send({ error: '进度回填失败' });
        }
    });
    fastify.get('/flows', async (request, reply) => {
        const { page = 1, pageSize = 10, sourceType, sourceId, action, fromUserId, toUserId, taskId, startDate, endDate, } = request.query;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (sourceType)
            where.sourceType = sourceType;
        if (sourceId)
            where.sourceId = sourceId;
        if (action)
            where.action = action;
        if (fromUserId)
            where.fromUserId = fromUserId;
        if (toUserId)
            where.toUserId = toUserId;
        if (taskId)
            where.taskId = taskId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [items, total] = await Promise.all([
            prisma_1.default.flowRecord.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { actionTime: 'desc' },
                include: {
                    task: { select: { id: true, taskNumber: true, title: true, status: true } },
                },
            }),
            prisma_1.default.flowRecord.count({ where }),
        ]);
        return { items, total, page, pageSize };
    });
    fastify.get('/flows/stats', async () => {
        const allFlows = await prisma_1.default.flowRecord.findMany();
        const byAction = {};
        const bySourceType = {};
        let last7Days = 0;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        allFlows.forEach((f) => {
            byAction[f.action] = (byAction[f.action] || 0) + 1;
            bySourceType[f.sourceType] = (bySourceType[f.sourceType] || 0) + 1;
            if (f.createdAt >= sevenDaysAgo)
                last7Days++;
        });
        return {
            total: allFlows.length,
            byAction,
            bySourceType,
            last7Days,
        };
    });
    fastify.post('/flows', async (request, reply) => {
        try {
            const body = request.body;
            const sourceInfo = body.sourceName || body.sourceNumber
                ? { sourceName: body.sourceName, sourceNumber: body.sourceNumber }
                : await getSourceInfo(body.sourceType, body.sourceId);
            const flow = await prisma_1.default.flowRecord.create({
                data: {
                    taskId: body.taskId,
                    sourceType: body.sourceType,
                    sourceId: body.sourceId,
                    sourceName: sourceInfo.sourceName || body.sourceName,
                    sourceNumber: sourceInfo.sourceNumber || body.sourceNumber,
                    action: body.action,
                    description: body.description,
                    fromUserId: body.fromUserId,
                    fromUserName: body.fromUserName,
                    fromUserDept: body.fromUserDept,
                    toUserId: body.toUserId,
                    toUserName: body.toUserName,
                    toUserDept: body.toUserDept,
                    status: body.status,
                    remark: body.remark,
                    operatorId: body.operatorId,
                    operatorName: body.operatorName,
                    operatorDept: body.operatorDept,
                    actionTime: body.actionTime ? new Date(body.actionTime) : new Date(),
                },
            });
            const actionMap = {
                ASSIGN: operationLog_1.ActionType.FLOW_ASSIGN,
                TRANSFER: operationLog_1.ActionType.FLOW_TRANSFER,
                RECEIVE: operationLog_1.ActionType.FLOW_RECEIVE,
                RETURN: operationLog_1.ActionType.FLOW_RETURN,
            };
            const meta = (0, operationLog_1.getRequestMeta)(request);
            await (0, operationLog_1.createOperationLog)({
                targetType: operationLog_1.TargetType.FLOW_RECORD,
                targetId: flow.id,
                action: actionMap[body.action] || operationLog_1.ActionType.CREATE,
                description: `流转记录：${body.sourceType} ${sourceInfo.sourceNumber || body.sourceId} - ${body.action} ${body.toUserName || ''}`,
                operator: body.operatorName || (0, operationLog_1.extractOperator)(request),
                afterData: {
                    id: flow.id,
                    sourceType: flow.sourceType,
                    sourceId: flow.sourceId,
                    action: flow.action,
                    fromUserName: flow.fromUserName,
                    toUserName: flow.toUserName,
                },
                ...meta,
            });
            return flow;
        }
        catch (error) {
            reply.status(400).send({ error: '创建流转记录失败' });
        }
    });
    fastify.get('/flows/:sourceType/:sourceId', async (request, reply) => {
        const flows = await prisma_1.default.flowRecord.findMany({
            where: {
                sourceType: request.params.sourceType,
                sourceId: request.params.sourceId,
            },
            orderBy: { actionTime: 'desc' },
            include: {
                task: { select: { id: true, taskNumber: true, title: true, status: true, priority: true } },
            },
        });
        return flows;
    });
    fastify.get('/dashboard/overview', async () => {
        const now = new Date();
        const [taskCount, caseCount, clueCount, evidenceCount, personCount, flowCount] = await Promise.all([
            prisma_1.default.commandTask.count(),
            prisma_1.default.case.count(),
            prisma_1.default.clue.count(),
            prisma_1.default.evidence.count(),
            prisma_1.default.person.count(),
            prisma_1.default.flowRecord.count(),
        ]);
        const activeTasks = await prisma_1.default.commandTask.findMany({
            where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            include: {
                case: { select: { id: true, caseNumber: true, title: true } },
            },
        });
        const allWarnings = [];
        activeTasks.forEach((task) => {
            const { warnings } = getOverdueInfo(task, now);
            warnings.forEach((w) => {
                allWarnings.push({
                    ...w,
                    taskId: task.id,
                    taskNumber: task.taskNumber,
                    taskTitle: task.title,
                    priority: task.priority,
                });
            });
        });
        const taskStats = {
            total: taskCount,
            pending: activeTasks.filter((t) => t.status === 'PENDING').length,
            inProgress: activeTasks.filter((t) => t.status === 'IN_PROGRESS').length,
            completed: await prisma_1.default.commandTask.count({ where: { status: 'COMPLETED' } }),
            overdue: allWarnings.filter((w) => w.type === 'overdue').length,
            nearDue: allWarnings.filter((w) => w.type === 'nearDue').length,
        };
        const recentFlows = await prisma_1.default.flowRecord.findMany({
            take: 10,
            orderBy: { actionTime: 'desc' },
            include: {
                task: { select: { id: true, taskNumber: true, title: true } },
            },
        });
        return {
            counts: {
                tasks: taskCount,
                cases: caseCount,
                clues: clueCount,
                evidences: evidenceCount,
                persons: personCount,
                flows: flowCount,
            },
            taskStats,
            warnings: {
                items: allWarnings.slice(0, 10),
                total: allWarnings.length,
                danger: allWarnings.filter((w) => w.level === 'danger').length,
                warning: allWarnings.filter((w) => w.level === 'warning').length,
            },
            recentFlows,
        };
    });
    fastify.get('/check-overdue', async () => {
        const now = new Date();
        const tasksToUpdate = await prisma_1.default.commandTask.findMany({
            where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                dueDate: { lt: now },
            },
        });
        const updatedIds = [];
        for (const task of tasksToUpdate) {
            await prisma_1.default.commandTask.update({
                where: { id: task.id },
                data: { status: 'OVERDUE' },
            });
            updatedIds.push(task.id);
        }
        return {
            scanned: tasksToUpdate.length,
            updated: updatedIds.length,
            updatedIds,
        };
    });
}
