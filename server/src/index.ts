import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';

import caseRoutes from './routes/cases';
import clueRoutes from './routes/clues';
import personRoutes from './routes/persons';
import relationRoutes from './routes/relations';
import evidenceRoutes from './routes/evidences';
import searchRoutes from './routes/search';
import operationLogRoutes from './routes/operationLogs';
import commandRoutes from './routes/command';

const PORT = parseInt(process.env.PORT || '3001');
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const server = fastify({
  logger: true,
});

server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

server.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

server.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
});

server.get('/health', async (request, reply) => {
  return { status: 'ok', uptime: process.uptime() };
});

server.register(caseRoutes, { prefix: '/api/cases' });
server.register(clueRoutes, { prefix: '/api/clues' });
server.register(personRoutes, { prefix: '/api/persons' });
server.register(relationRoutes, { prefix: '/api/relations' });
server.register(evidenceRoutes, { prefix: '/api/evidences' });
server.register(searchRoutes, { prefix: '/api/search' });
server.register(operationLogRoutes, { prefix: '/api/operation-logs' });
server.register(commandRoutes, { prefix: '/api/command' });

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 刑侦案件线索管理平台后端服务已启动`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
