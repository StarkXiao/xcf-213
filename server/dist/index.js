"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const static_1 = __importDefault(require("@fastify/static"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cases_1 = __importDefault(require("./routes/cases"));
const clues_1 = __importDefault(require("./routes/clues"));
const persons_1 = __importDefault(require("./routes/persons"));
const relations_1 = __importDefault(require("./routes/relations"));
const evidences_1 = __importDefault(require("./routes/evidences"));
const evidenceTransfers_1 = __importDefault(require("./routes/evidenceTransfers"));
const search_1 = __importDefault(require("./routes/search"));
const operationLogs_1 = __importDefault(require("./routes/operationLogs"));
const command_1 = __importDefault(require("./routes/command"));
const analysis_1 = __importDefault(require("./routes/analysis"));
const clueCheckFlows_1 = __importDefault(require("./routes/clueCheckFlows"));
const riskProfiles_1 = __importDefault(require("./routes/riskProfiles"));
const PORT = parseInt(process.env.PORT || '3001');
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const server = (0, fastify_1.default)({
    logger: true,
});
server.register(cors_1.default, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
server.register(multipart_1.default, {
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
});
server.register(static_1.default, {
    root: path_1.default.join(__dirname, '..', 'uploads'),
    prefix: '/uploads/',
});
server.get('/health', async (request, reply) => {
    return { status: 'ok', uptime: process.uptime() };
});
server.register(cases_1.default, { prefix: '/api/cases' });
server.register(clues_1.default, { prefix: '/api/clues' });
server.register(persons_1.default, { prefix: '/api/persons' });
server.register(relations_1.default, { prefix: '/api/relations' });
server.register(evidences_1.default, { prefix: '/api/evidences' });
server.register(evidenceTransfers_1.default, { prefix: '/api/evidence-transfers' });
server.register(search_1.default, { prefix: '/api/search' });
server.register(operationLogs_1.default, { prefix: '/api/operation-logs' });
server.register(command_1.default, { prefix: '/api/command' });
server.register(analysis_1.default, { prefix: '/api/analysis' });
server.register(clueCheckFlows_1.default, { prefix: '/api/clue-check-flows' });
server.register(riskProfiles_1.default, { prefix: '/api/risk-profiles' });
const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 刑侦案件线索管理平台后端服务已启动`);
        console.log(`📍 服务地址: http://localhost:${PORT}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
