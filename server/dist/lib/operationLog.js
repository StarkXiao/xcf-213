"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDisassociate = exports.logAssociate = exports.logDelete = exports.logUpdate = exports.logCreate = exports.extractOperator = exports.getRequestMeta = exports.createOperationLog = exports.ActionType = exports.TargetType = void 0;
const prisma_1 = __importDefault(require("./prisma"));
var TargetType;
(function (TargetType) {
    TargetType["CASE"] = "CASE";
    TargetType["CLUE"] = "CLUE";
    TargetType["EVIDENCE"] = "EVIDENCE";
    TargetType["PERSON"] = "PERSON";
    TargetType["EVIDENCE_BATCH"] = "EVIDENCE_BATCH";
    TargetType["EVIDENCE_BORROW"] = "EVIDENCE_BORROW";
    TargetType["EVIDENCE_TRANSFER"] = "EVIDENCE_TRANSFER";
    TargetType["EVIDENCE_TRANSFER_LOG"] = "EVIDENCE_TRANSFER_LOG";
    TargetType["CLUE_VERIFICATION"] = "CLUE_VERIFICATION";
    TargetType["COMMAND_TASK"] = "COMMAND_TASK";
    TargetType["TASK_PROGRESS"] = "TASK_PROGRESS";
    TargetType["FLOW_RECORD"] = "FLOW_RECORD";
    TargetType["CLUE_CHECK_FLOW"] = "CLUE_CHECK_FLOW";
    TargetType["CLUE_CHECK_LOG"] = "CLUE_CHECK_LOG";
})(TargetType || (exports.TargetType = TargetType = {}));
var ActionType;
(function (ActionType) {
    ActionType["CREATE"] = "CREATE";
    ActionType["UPDATE"] = "UPDATE";
    ActionType["DELETE"] = "DELETE";
    ActionType["VIEW"] = "VIEW";
    ActionType["EXPORT"] = "EXPORT";
    ActionType["BORROW"] = "BORROW";
    ActionType["RETURN"] = "RETURN";
    ActionType["VERIFY"] = "VERIFY";
    ActionType["ASSOCIATE"] = "ASSOCIATE";
    ActionType["DISASSOCIATE"] = "DISASSOCIATE";
    ActionType["BATCH_ASSIGN"] = "BATCH_ASSIGN";
    ActionType["BATCH_RETURN"] = "BATCH_RETURN";
    ActionType["BATCH_MERGE"] = "BATCH_MERGE";
    ActionType["BATCH_UPLOAD"] = "BATCH_UPLOAD";
    ActionType["TO_EVIDENCE"] = "TO_EVIDENCE";
    ActionType["TASK_ASSIGN"] = "TASK_ASSIGN";
    ActionType["TASK_TRANSFER"] = "TASK_TRANSFER";
    ActionType["TASK_COMPLETE"] = "TASK_COMPLETE";
    ActionType["TASK_CANCEL"] = "TASK_CANCEL";
    ActionType["TASK_PROGRESS_UPDATE"] = "TASK_PROGRESS_UPDATE";
    ActionType["FLOW_ASSIGN"] = "FLOW_ASSIGN";
    ActionType["FLOW_TRANSFER"] = "FLOW_TRANSFER";
    ActionType["FLOW_RECEIVE"] = "FLOW_RECEIVE";
    ActionType["FLOW_RETURN"] = "FLOW_RETURN";
    ActionType["CHECK_REGISTER"] = "CHECK_REGISTER";
    ActionType["CHECK_DISPATCH"] = "CHECK_DISPATCH";
    ActionType["CHECK_VERIFY"] = "CHECK_VERIFY";
    ActionType["CHECK_FEEDBACK"] = "CHECK_FEEDBACK";
    ActionType["CHECK_ADOPT"] = "CHECK_ADOPT";
    ActionType["CHECK_REJECT"] = "CHECK_REJECT";
    ActionType["CHECK_CLOSE"] = "CHECK_CLOSE";
    ActionType["TRANSFER_CREATE"] = "TRANSFER_CREATE";
    ActionType["TRANSFER_APPROVE"] = "TRANSFER_APPROVE";
    ActionType["TRANSFER_REJECT"] = "TRANSFER_REJECT";
    ActionType["TRANSFER_HANDLE"] = "TRANSFER_HANDLE";
    ActionType["TRANSFER_RECEIVE"] = "TRANSFER_RECEIVE";
    ActionType["TRANSFER_RETURN"] = "TRANSFER_RETURN";
    ActionType["TRANSFER_DESTROY"] = "TRANSFER_DESTROY";
    ActionType["TRANSFER_CANCEL"] = "TRANSFER_CANCEL";
})(ActionType || (exports.ActionType = ActionType = {}));
const createOperationLog = async (params) => {
    try {
        const { targetType, targetId, action, description, operator, operatorDepartment, beforeData, afterData, ip, userAgent, } = params;
        await prisma_1.default.operationLog.create({
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
    }
    catch (error) {
        console.error('创建操作日志失败:', error);
    }
};
exports.createOperationLog = createOperationLog;
const getRequestMeta = (request) => ({
    ip: request.ip,
    userAgent: request.headers['user-agent'] || undefined,
});
exports.getRequestMeta = getRequestMeta;
const extractOperator = (request, body) => {
    return (body?.operator ||
        body?.handler ||
        body?.collector ||
        body?.caseManager ||
        body?.borrower ||
        body?.returnOperator ||
        undefined);
};
exports.extractOperator = extractOperator;
const logCreate = (targetType, targetId, description, request, operator, afterData) => {
    const meta = (0, exports.getRequestMeta)(request);
    return (0, exports.createOperationLog)({
        targetType,
        targetId,
        action: ActionType.CREATE,
        description,
        operator: operator || (0, exports.extractOperator)(request),
        afterData,
        ...meta,
    });
};
exports.logCreate = logCreate;
const logUpdate = (targetType, targetId, description, request, beforeData, afterData, operator) => {
    const meta = (0, exports.getRequestMeta)(request);
    return (0, exports.createOperationLog)({
        targetType,
        targetId,
        action: ActionType.UPDATE,
        description,
        operator: operator || (0, exports.extractOperator)(request),
        beforeData,
        afterData,
        ...meta,
    });
};
exports.logUpdate = logUpdate;
const logDelete = (targetType, targetId, description, request, beforeData, operator) => {
    const meta = (0, exports.getRequestMeta)(request);
    return (0, exports.createOperationLog)({
        targetType,
        targetId,
        action: ActionType.DELETE,
        description,
        operator: operator || (0, exports.extractOperator)(request),
        beforeData,
        ...meta,
    });
};
exports.logDelete = logDelete;
const logAssociate = (targetType, targetId, description, request, afterData, operator) => {
    const meta = (0, exports.getRequestMeta)(request);
    return (0, exports.createOperationLog)({
        targetType,
        targetId,
        action: ActionType.ASSOCIATE,
        description,
        operator: operator || (0, exports.extractOperator)(request),
        afterData,
        ...meta,
    });
};
exports.logAssociate = logAssociate;
const logDisassociate = (targetType, targetId, description, request, beforeData, operator) => {
    const meta = (0, exports.getRequestMeta)(request);
    return (0, exports.createOperationLog)({
        targetType,
        targetId,
        action: ActionType.DISASSOCIATE,
        description,
        operator: operator || (0, exports.extractOperator)(request),
        beforeData,
        ...meta,
    });
};
exports.logDisassociate = logDisassociate;
exports.default = {
    TargetType,
    ActionType,
    createOperationLog: exports.createOperationLog,
    getRequestMeta: exports.getRequestMeta,
    extractOperator: exports.extractOperator,
    logCreate: exports.logCreate,
    logUpdate: exports.logUpdate,
    logDelete: exports.logDelete,
    logAssociate: exports.logAssociate,
    logDisassociate: exports.logDisassociate,
};
