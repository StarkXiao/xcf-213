import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface ClueQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  clueType?: string;
  status?: string;
  credibility?: string;
  importance?: string;
  caseId?: string;
}

interface ClueCreate {
  caseId?: string;
  title: string;
  content: string;
  clueType: string;
  source: string;
  credibility: string;
  importance: string;
  status: string;
  location?: string;
  findTime?: string;
  informant?: string;
  handler?: string;
  note?: string;
}

interface ClueUpdate extends Partial<ClueCreate> {}

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest<{ Querystring: ClueQuery }>, reply) => {
    const { page = 1, pageSize = 10, keyword, clueType, status, credibility, importance, caseId } = request.query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { clueNumber: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (clueType) where.clueType = clueType;
    if (status) where.status = status;
    if (credibility) where.credibility = credibility;
    if (importance) where.importance = importance;
    if (caseId) where.caseId = caseId;

    const [items, total] = await Promise.all([
      prisma.clue.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: { select: { evidences: true, cluePersons: true } },
        },
      }),
      prisma.clue.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const clue = await prisma.clue.findUnique({
      where: { id: request.params.id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        evidences: true,
        cluePersons: { include: { person: true } },
      },
    });

    if (!clue) {
      reply.status(404).send({ error: '线索不存在' });
      return;
    }

    return clue;
  });

  fastify.post('/', async (request: FastifyRequest<{ Body: ClueCreate }>, reply) => {
    const data = request.body;
    const count = await prisma.clue.count();
    const clueNumber = `XS${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const clue = await prisma.clue.create({
      data: {
        ...data,
        clueNumber,
        findTime: data.findTime ? new Date(data.findTime) : null,
      },
    });

    return clue;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueUpdate }>, reply) => {
    const data = request.body;
    try {
      const clue = await prisma.clue.update({
        where: { id: request.params.id },
        data: {
          ...data,
          findTime: data.findTime ? new Date(data.findTime) : undefined,
        },
      });
      return clue;
    } catch (error) {
      reply.status(404).send({ error: '线索不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await prisma.$transaction([
        prisma.evidence.updateMany({ where: { clueId: request.params.id }, data: { clueId: null } }),
        prisma.cluePerson.deleteMany({ where: { clueId: request.params.id } }),
        prisma.clue.delete({ where: { id: request.params.id } }),
      ]);
      return { success: true };
    } catch (error) {
      reply.status(404).send({ error: '线索不存在' });
    }
  });

  fastify.post('/:id/persons', async (request: FastifyRequest<{ Params: { id: string }; Body: { personId: string; relation: string; note?: string } }>, reply) => {
    try {
      const cluePerson = await prisma.cluePerson.create({
        data: {
          clueId: request.params.id,
          personId: request.body.personId,
          relation: request.body.relation,
          note: request.body.note,
        },
        include: { person: true },
      });
      return cluePerson;
    } catch (error) {
      reply.status(400).send({ error: '关联失败' });
    }
  });

  fastify.delete('/:id/persons/:personId', async (request: FastifyRequest<{ Params: { id: string; personId: string } }>, reply) => {
    try {
      await prisma.cluePerson.deleteMany({
        where: { clueId: request.params.id, personId: request.params.personId },
      });
      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '取消关联失败' });
    }
  });

  const updateCaseSummary = async (caseId: string) => {
    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        clues: { select: { id: true, title: true, status: true, cluePersons: { select: { relation: true, person: { select: { name: true } } } } } },
        evidences: { select: { id: true, name: true, status: true, type: true } },
        casePersons: { select: { role: true, person: { select: { name: true, personType: true } } } },
      },
    });

    if (!caseItem) return;

    const clueCount = caseItem.clues.length;
    const verifiedClueCount = caseItem.clues.filter((c: any) => c.status === '已核实' || c.status === '已采用').length;
    const evidenceCount = caseItem.evidences.length;
    const personCount = caseItem.casePersons.length;
    const suspectCount = caseItem.casePersons.filter((cp: any) => cp.person.personType === '嫌疑人').length;

    const summaryLines = [
      `【案件摘要】${caseItem.title}`,
      ``,
      `案件编号：${caseItem.caseNumber}`,
      `案件类型：${caseItem.caseType}`,
      ``,
      `=== 线索统计 ===`,
      `关联线索总数：${clueCount} 条`,
      `已核实/已采用：${verifiedClueCount} 条`,
      `待核实/核实中：${clueCount - verifiedClueCount} 条`,
    ];

    if (caseItem.clues.length > 0) {
      summaryLines.push(``);
      summaryLines.push(`=== 线索列表 ===`);
      caseItem.clues.forEach((clue: any, idx: number) => {
        summaryLines.push(`${idx + 1}. [${clue.status}] ${clue.title}`);
        if (clue.cluePersons.length > 0) {
          const persons = clue.cluePersons.map((cp: any) => `${cp.person.name}(${cp.relation})`).join('、');
          summaryLines.push(`   关联人员：${persons}`);
        }
      });
    }

    summaryLines.push(``);
    summaryLines.push(`=== 证据统计 ===`);
    summaryLines.push(`证据总数：${evidenceCount} 份`);

    if (caseItem.evidences.length > 0) {
      summaryLines.push(``);
      summaryLines.push(`=== 证据列表 ===`);
      caseItem.evidences.forEach((ev: any, idx: number) => {
        summaryLines.push(`${idx + 1}. [${ev.status}] ${ev.name}（${ev.type}）`);
      });
    }

    summaryLines.push(``);
    summaryLines.push(`=== 人员统计 ===`);
    summaryLines.push(`涉案人员总数：${personCount} 人`);
    summaryLines.push(`其中嫌疑人：${suspectCount} 人`);

    if (caseItem.casePersons.length > 0) {
      summaryLines.push(``);
      summaryLines.push(`=== 涉案人员 ===`);
      caseItem.casePersons.forEach((cp: any, idx: number) => {
        summaryLines.push(`${idx + 1}. [${cp.person.personType}] ${cp.person.name} - ${cp.role}`);
      });
    }

    summaryLines.push(``);
    summaryLines.push(`更新时间：${new Date().toLocaleString('zh-CN')}`);

    await prisma.case.update({
      where: { id: caseId },
      data: { summary: summaryLines.join('\n') },
    });
  };

  fastify.post('/batch/assign', async (request: FastifyRequest<{ Body: { clueIds: string[]; caseId: string; handler?: string; status?: string } }>, reply) => {
    const { clueIds, caseId, handler, status } = request.body;
    if (!clueIds || clueIds.length === 0) {
      reply.status(400).send({ error: '请选择线索' });
      return;
    }
    if (!caseId) {
      reply.status(400).send({ error: '请选择目标案件' });
      return;
    }

    try {
      const updateData: any = { caseId };
      if (handler) updateData.handler = handler;
      if (status) updateData.status = status;

      await prisma.clue.updateMany({
        where: { id: { in: clueIds } },
        data: updateData,
      });

      await updateCaseSummary(caseId);

      const clues = await prisma.clue.findMany({
        where: { id: { in: clueIds } },
        include: { case: { select: { id: true, caseNumber: true, title: true } } },
      });

      return { success: true, count: clues.length, clues };
    } catch (error) {
      reply.status(400).send({ error: '批量指派失败' });
    }
  });

  fastify.post('/batch/return', async (request: FastifyRequest<{ Body: { clueIds: string[]; note?: string } }>, reply) => {
    const { clueIds, note } = request.body;
    if (!clueIds || clueIds.length === 0) {
      reply.status(400).send({ error: '请选择线索' });
      return;
    }

    try {
      const clues = await prisma.clue.findMany({
        where: { id: { in: clueIds } },
        select: { id: true, caseId: true },
      });

      const caseIds = [...new Set(clues.filter((c: any) => c.caseId).map((c: any) => c.caseId as string))];

      const updateData: any = { status: '待核实', caseId: null };
      if (note) {
        updateData.note = {
          set: (oldNote: string | null) => oldNote ? `${oldNote}\n\n[退回说明] ${new Date().toLocaleString('zh-CN')}\n${note}` : `[退回说明] ${new Date().toLocaleString('zh-CN')}\n${note}`,
        };
      }

      await prisma.clue.updateMany({
        where: { id: { in: clueIds } },
        data: { caseId: null, status: '待核实' },
      });

      for (const cid of caseIds as string[]) {
        await updateCaseSummary(cid);
      }

      return { success: true, count: clueIds.length };
    } catch (error) {
      reply.status(400).send({ error: '批量退回失败' });
    }
  });

  fastify.post('/batch/merge', async (request: FastifyRequest<{ Body: { clueIds: string[]; targetClueId: string; caseId?: string } }>, reply) => {
    const { clueIds, targetClueId, caseId } = request.body;
    if (!clueIds || clueIds.length < 2) {
      reply.status(400).send({ error: '请至少选择2条线索进行合并' });
      return;
    }
    if (!targetClueId) {
      reply.status(400).send({ error: '请选择目标线索' });
      return;
    }

    try {
      const sourceIds = clueIds.filter(id => id !== targetClueId);
      if (sourceIds.length === 0) {
        reply.status(400).send({ error: '目标线索不能与源线索相同' });
        return;
      }

      const targetClue = await prisma.clue.findUnique({ where: { id: targetClueId } });
      if (!targetClue) {
        reply.status(404).send({ error: '目标线索不存在' });
        return;
      }

      const sourceClues = await prisma.clue.findMany({
        where: { id: { in: sourceIds } },
        include: { evidences: true, cluePersons: true },
      });

      let mergedContent = targetClue.content;
      const mergedPersonIds = new Set<string>();
      const mergedEvidenceIds = new Set<string>();

      for (const clue of sourceClues) {
        mergedContent += `\n\n=== 合并自线索 ${clue.clueNumber} ===\n${clue.content}`;
        clue.cluePersons.forEach((cp: any) => mergedPersonIds.add(cp.personId));
        clue.evidences.forEach((e: any) => mergedEvidenceIds.add(e.id));
        if (clue.caseId && !targetClue.caseId) {
          targetClue.caseId = clue.caseId;
        }
      }

      const finalCaseId = caseId || targetClue.caseId;

      await prisma.$transaction([
        prisma.clue.update({
          where: { id: targetClueId },
          data: {
            content: mergedContent,
            caseId: finalCaseId,
            status: '核实中',
          },
        }),
        prisma.cluePerson.updateMany({
          where: { clueId: { in: sourceIds } },
          data: { clueId: targetClueId },
        }),
        prisma.evidence.updateMany({
          where: { clueId: { in: sourceIds } },
          data: { clueId: targetClueId, caseId: finalCaseId || undefined },
        }),
        prisma.clue.deleteMany({
          where: { id: { in: sourceIds } },
        }),
      ]);

      if (finalCaseId) {
        await updateCaseSummary(finalCaseId);
      }

      const resultClue = await prisma.clue.findUnique({
        where: { id: targetClueId },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: { select: { evidences: true, cluePersons: true } },
        },
      });

      return { success: true, mergedClue: resultClue, mergedCount: sourceIds.length };
    } catch (error) {
      reply.status(400).send({ error: '批量合并失败' });
    }
  });

  fastify.post('/batch/to-evidence', async (request: FastifyRequest<{ Body: { clueIds: string[]; caseId: string; evidenceType?: string } }>, reply) => {
    const { clueIds, caseId, evidenceType = '书证' } = request.body;
    if (!clueIds || clueIds.length === 0) {
      reply.status(400).send({ error: '请选择线索' });
      return;
    }
    if (!caseId) {
      reply.status(400).send({ error: '请选择目标案件' });
      return;
    }

    try {
      const clues = await prisma.clue.findMany({
        where: { id: { in: clueIds } },
        include: { evidences: true, cluePersons: { include: { person: true } } },
      });

      const evidenceCount = await prisma.evidence.count();
      let currentCount = evidenceCount;
      const createdEvidences: any[] = [];

      for (const clue of clues) {
        currentCount += 1;
        const evidenceNumber = `ZJ${new Date().getFullYear()}${String(currentCount).padStart(6, '0')}`;

        const evidenceDescLines = [
          `来源线索：${clue.clueNumber} - ${clue.title}`,
          `线索类型：${clue.clueType}`,
          `线索可信度：${clue.credibility}`,
          `线索重要性：${clue.importance}`,
          `线索来源：${clue.source}`,
        ];
        if (clue.cluePersons.length > 0) {
          evidenceDescLines.push(`关联人员：${clue.cluePersons.map((cp: any) => `${cp.person.name}(${cp.relation})`).join('、')}`);
        }
        evidenceDescLines.push(``);
        evidenceDescLines.push(`线索内容：`);
        evidenceDescLines.push(clue.content);

        const evidence = await prisma.evidence.create({
          data: {
            evidenceNumber,
            name: `【线索转证据】${clue.title}`,
            description: evidenceDescLines.join('\n'),
            type: evidenceType,
            filePath: '',
            fileName: `${clue.clueNumber}_${clue.title}.txt`,
            status: '待入库',
            caseId,
            clueId: clue.id,
          },
        });

        createdEvidences.push(evidence);

        if (clue.evidences.length > 0) {
          await prisma.evidence.updateMany({
            where: { clueId: clue.id },
            data: { caseId },
          });
        }
      }

      await prisma.clue.updateMany({
        where: { id: { in: clueIds } },
        data: { status: '已采用', caseId },
      });

      await updateCaseSummary(caseId);

      return { success: true, createdCount: createdEvidences.length, evidences: createdEvidences };
    } catch (error) {
      reply.status(400).send({ error: '批量转证据失败' });
    }
  });
}
