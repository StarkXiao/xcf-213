import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import {
  TargetType,
  ActionType,
  logCreate,
  logUpdate,
  logDelete,
  logAssociate,
  logDisassociate,
  createOperationLog,
  getRequestMeta,
  extractOperator,
} from '../lib/operationLog';
import { checkLocationRules } from '../lib/ruleEngine';

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

interface ClueVerificationCreate {
  result: string;
  attachmentIds?: string[];
  handler?: string;
  handleTime?: string;
  note?: string;
}

interface ClueVerificationQuery {
  page?: number;
  pageSize?: number;
}

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

    await logCreate(
      TargetType.CLUE,
      clue.id,
      `创建线索：${clueNumber} - ${clue.title}`,
      request,
      clue.handler,
      {
        id: clue.id,
        clueNumber: clue.clueNumber,
        title: clue.title,
        clueType: clue.clueType,
        source: clue.source,
        credibility: clue.credibility,
        importance: clue.importance,
        status: clue.status,
        handler: clue.handler,
        caseId: clue.caseId,
      }
    );

    if (clue.caseId) {
      const caseInfo = await prisma.case.findUnique({
        where: { id: clue.caseId },
        select: { caseNumber: true, title: true },
      });
      await logAssociate(
        TargetType.CASE,
        clue.caseId,
        `新增关联线索：${clueNumber} - ${clue.title}`,
        request,
        {
          clueId: clue.id,
          clueNumber: clue.clueNumber,
          clueTitle: clue.title,
        }
      );
    }

    if (clue.location) {
      checkLocationRules(clue.location, {
        type: 'CLUE',
        id: clue.id,
        name: clue.title,
        number: clue.clueNumber,
        caseId: clue.caseId || undefined,
      }).catch(() => {});
    }

    return clue;
  });

  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueUpdate }>, reply) => {
    const data = request.body;
    try {
      const beforeClue = await prisma.clue.findUnique({
        where: { id: request.params.id },
      });

      const clue = await prisma.clue.update({
        where: { id: request.params.id },
        data: {
          ...data,
          findTime: data.findTime ? new Date(data.findTime) : undefined,
        },
      });

      await logUpdate(
        TargetType.CLUE,
        clue.id,
        `更新线索：${clue.clueNumber} - ${clue.title}`,
        request,
        {
          title: beforeClue?.title,
          clueType: beforeClue?.clueType,
          source: beforeClue?.source,
          credibility: beforeClue?.credibility,
          importance: beforeClue?.importance,
          status: beforeClue?.status,
          handler: beforeClue?.handler,
          caseId: beforeClue?.caseId,
          location: beforeClue?.location,
        },
        {
          title: clue.title,
          clueType: clue.clueType,
          source: clue.source,
          credibility: clue.credibility,
          importance: clue.importance,
          status: clue.status,
          handler: clue.handler,
          caseId: clue.caseId,
          location: clue.location,
        },
        clue.handler
      );

      if (beforeClue?.caseId !== clue.caseId) {
        if (beforeClue?.caseId) {
          const beforeCase = await prisma.case.findUnique({
            where: { id: beforeClue.caseId },
            select: { caseNumber: true, title: true },
          });
          await logDisassociate(
            TargetType.CASE,
            beforeClue.caseId,
            `移除关联线索：${beforeClue.clueNumber} - ${beforeClue.title}`,
            request,
            {
              clueId: clue.id,
              clueNumber: clue.clueNumber,
              clueTitle: clue.title,
            }
          );
        }
        if (clue.caseId) {
          const afterCase = await prisma.case.findUnique({
            where: { id: clue.caseId },
            select: { caseNumber: true, title: true },
          });
          await logAssociate(
            TargetType.CASE,
            clue.caseId,
            `新增关联线索：${clue.clueNumber} - ${clue.title}`,
            request,
            {
              clueId: clue.id,
              clueNumber: clue.clueNumber,
              clueTitle: clue.title,
            }
          );
        }
      }

      if (clue.location && clue.location !== beforeClue?.location) {
        checkLocationRules(clue.location, {
          type: 'CLUE',
          id: clue.id,
          name: clue.title,
          number: clue.clueNumber,
          caseId: clue.caseId || undefined,
        }).catch(() => {});
      }

      return clue;
    } catch (error) {
      reply.status(404).send({ error: '线索不存在' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const beforeClue = await prisma.clue.findUnique({
        where: { id: request.params.id },
      });

      const caseId = beforeClue?.caseId;

      await prisma.$transaction([
        prisma.evidence.updateMany({ where: { clueId: request.params.id }, data: { clueId: null } }),
        prisma.cluePerson.deleteMany({ where: { clueId: request.params.id } }),
        prisma.clueVerification.deleteMany({ where: { clueId: request.params.id } }),
        prisma.clue.delete({ where: { id: request.params.id } }),
      ]);

      await logDelete(
        TargetType.CLUE,
        request.params.id,
        `删除线索：${beforeClue?.clueNumber || ''} - ${beforeClue?.title || ''}`,
        request,
        beforeClue ? {
          id: beforeClue.id,
          clueNumber: beforeClue.clueNumber,
          title: beforeClue.title,
          clueType: beforeClue.clueType,
          status: beforeClue.status,
          caseId: beforeClue.caseId,
        } : undefined
      );

      if (caseId) {
        const caseInfo = await prisma.case.findUnique({
          where: { id: caseId },
          select: { caseNumber: true, title: true },
        });
        await logDisassociate(
          TargetType.CASE,
          caseId,
          `移除关联线索：${beforeClue?.clueNumber || ''} - ${beforeClue?.title || ''}`,
          request,
          {
            clueId: request.params.id,
            clueNumber: beforeClue?.clueNumber,
            clueTitle: beforeClue?.title,
          }
        );
      }

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

      const clueInfo = await prisma.clue.findUnique({
        where: { id: request.params.id },
        select: { clueNumber: true, title: true },
      });

      await logAssociate(
        TargetType.CLUE,
        request.params.id,
        `线索关联人员：${cluePerson.person.name}（${request.body.relation}）`,
        request,
        {
          personId: request.body.personId,
          personName: cluePerson.person.name,
          relation: request.body.relation,
        }
      );

      await logAssociate(
        TargetType.PERSON,
        request.body.personId,
        `关联线索：${clueInfo?.clueNumber || ''} - ${clueInfo?.title || ''}`,
        request,
        {
          clueId: request.params.id,
          clueNumber: clueInfo?.clueNumber,
          clueTitle: clueInfo?.title,
          relation: request.body.relation,
        }
      );

      return cluePerson;
    } catch (error) {
      reply.status(400).send({ error: '关联失败' });
    }
  });

  fastify.delete('/:id/persons/:personId', async (request: FastifyRequest<{ Params: { id: string; personId: string } }>, reply) => {
    try {
      const person = await prisma.person.findUnique({
        where: { id: request.params.personId },
        select: { name: true },
      });

      const clueInfo = await prisma.clue.findUnique({
        where: { id: request.params.id },
        select: { clueNumber: true, title: true },
      });

      await prisma.cluePerson.deleteMany({
        where: { clueId: request.params.id, personId: request.params.personId },
      });

      await logDisassociate(
        TargetType.CLUE,
        request.params.id,
        `解除人员关联：${person?.name || '未知人员'}`,
        request,
        {
          personId: request.params.personId,
          personName: person?.name,
        }
      );

      await logDisassociate(
        TargetType.PERSON,
        request.params.personId,
        `解除线索关联：${clueInfo?.clueNumber || ''} - ${clueInfo?.title || ''}`,
        request,
        {
          clueId: request.params.id,
          clueNumber: clueInfo?.clueNumber,
          clueTitle: clueInfo?.title,
        }
      );

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
      const cluesBefore = await prisma.clue.findMany({
        where: { id: { in: clueIds } },
        select: { id: true, caseId: true },
      });

      const sourceCaseIds: string[] = [...new Set<string>(
        cluesBefore
          .filter((c: any) => c.caseId && c.caseId !== caseId)
          .map((c: any) => c.caseId as string)
      )];

      const updateData: any = { caseId };
      if (handler) updateData.handler = handler;
      if (status) updateData.status = status;

      await prisma.clue.updateMany({
        where: { id: { in: clueIds } },
        data: updateData,
      });

      await updateCaseSummary(caseId);

      for (const cid of sourceCaseIds) {
        await updateCaseSummary(cid);
      }

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
      const cluesBefore = await prisma.clue.findMany({
        where: { id: { in: clueIds } },
        select: { id: true, caseId: true, note: true },
      });

      const sourceCaseIds: string[] = [...new Set<string>(
        cluesBefore
          .filter((c: any) => c.caseId)
          .map((c: any) => c.caseId as string)
      )];

      if (note) {
        const timestamp = new Date().toLocaleString('zh-CN');
        const returnNotePrefix = `\n\n[退回说明] ${timestamp}\n${note}`;

        for (const clue of cluesBefore) {
          const oldNote = (clue as any).note || '';
          await prisma.clue.update({
            where: { id: clue.id },
            data: {
              caseId: null,
              status: '待核实',
              note: oldNote ? `${oldNote}${returnNotePrefix}` : returnNotePrefix.trim(),
            },
          });
        }
      } else {
        await prisma.clue.updateMany({
          where: { id: { in: clueIds } },
          data: { caseId: null, status: '待核实' },
        });
      }

      for (const cid of sourceCaseIds) {
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

      const affectedCaseIds = new Set<string>();
      if (targetClue.caseId) affectedCaseIds.add(targetClue.caseId);
      for (const clue of sourceClues) {
        if (clue.caseId) affectedCaseIds.add(clue.caseId);
      }

      let mergedContent = targetClue.content;

      for (const clue of sourceClues) {
        mergedContent += `\n\n=== 合并自线索 ${clue.clueNumber} ===\n${clue.content}`;
        if (clue.caseId && !targetClue.caseId) {
          targetClue.caseId = clue.caseId;
        }
      }

      const finalCaseId = caseId || targetClue.caseId;

      if (finalCaseId) {
        affectedCaseIds.add(finalCaseId);
      }

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

      for (const cid of affectedCaseIds) {
        await updateCaseSummary(cid);
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

      const sourceCaseIds = new Set<string>();
      for (const clue of clues) {
        if (clue.caseId && clue.caseId !== caseId) {
          sourceCaseIds.add(clue.caseId);
        }
      }

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

      for (const cid of sourceCaseIds) {
        await updateCaseSummary(cid);
      }

      return { success: true, createdCount: createdEvidences.length, evidences: createdEvidences };
    } catch (error) {
      reply.status(400).send({ error: '批量转证据失败' });
    }
  });

  fastify.get('/:id/verifications', async (request: FastifyRequest<{ Params: { id: string }; Querystring: ClueVerificationQuery }>, reply) => {
    const { page = 1, pageSize = 10 } = request.query;
    const skip = (page - 1) * pageSize;

    const where = { clueId: request.params.id };

    const [items, total] = await Promise.all([
      prisma.clueVerification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          evidences: { select: { id: true, name: true, evidenceNumber: true, type: true } },
        },
      }),
      prisma.clueVerification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  fastify.post('/:id/verifications', async (request: FastifyRequest<{ Params: { id: string }; Body: ClueVerificationCreate }>, reply) => {
    const { result, attachmentIds, handler, handleTime, note } = request.body;

    try {
      const verification = await prisma.clueVerification.create({
        data: {
          clueId: request.params.id,
          result,
          attachmentIds: attachmentIds ? attachmentIds.join(',') : null,
          handler,
          handleTime: handleTime ? new Date(handleTime) : null,
          note,
        },
      });

      if (attachmentIds && attachmentIds.length > 0) {
        await prisma.evidence.updateMany({
          where: { id: { in: attachmentIds } },
          data: { clueVerificationId: verification.id },
        });
      }

      const resultWithEvidences = await prisma.clueVerification.findUnique({
        where: { id: verification.id },
        include: {
          evidences: { select: { id: true, name: true, evidenceNumber: true, type: true } },
        },
      });

      const clueInfo = await prisma.clue.findUnique({
        where: { id: request.params.id },
        select: { clueNumber: true, title: true },
      });

      await createOperationLog({
        targetType: TargetType.CLUE,
        targetId: request.params.id,
        action: ActionType.VERIFY,
        description: `添加线索核查记录：核查结果-${result}${handler ? '，处理人-' + handler : ''}`,
        operator: handler,
        afterData: {
          verificationId: verification.id,
          result,
          handler,
          note,
          evidenceCount: attachmentIds?.length || 0,
        },
        ...getRequestMeta(request),
      });

      return resultWithEvidences;
    } catch (error) {
      reply.status(400).send({ error: '添加核查记录失败' });
    }
  });

  fastify.put('/:id/verifications/:verificationId', async (request: FastifyRequest<{ Params: { id: string; verificationId: string }; Body: Partial<ClueVerificationCreate> }>, reply) => {
    const { result, attachmentIds, handler, handleTime, note } = request.body;

    try {
      const beforeVerification = await prisma.clueVerification.findUnique({
        where: { id: request.params.verificationId },
      });

      const verification = await prisma.clueVerification.update({
        where: { id: request.params.verificationId },
        data: {
          result,
          attachmentIds: attachmentIds ? attachmentIds.join(',') : undefined,
          handler,
          handleTime: handleTime ? new Date(handleTime) : undefined,
          note,
        },
      });

      if (attachmentIds !== undefined) {
        await prisma.evidence.updateMany({
          where: { clueVerificationId: verification.id },
          data: { clueVerificationId: null },
        });

        if (attachmentIds.length > 0) {
          await prisma.evidence.updateMany({
            where: { id: { in: attachmentIds } },
            data: { clueVerificationId: verification.id },
          });
        }
      }

      const resultWithEvidences = await prisma.clueVerification.findUnique({
        where: { id: verification.id },
        include: {
          evidences: { select: { id: true, name: true, evidenceNumber: true, type: true } },
        },
      });

      await createOperationLog({
        targetType: TargetType.CLUE,
        targetId: request.params.id,
        action: ActionType.VERIFY,
        description: `更新线索核查记录：核查结果-${result || beforeVerification?.result}`,
        operator: handler || beforeVerification?.handler || undefined,
        beforeData: {
          verificationId: request.params.verificationId,
          result: beforeVerification?.result,
          handler: beforeVerification?.handler,
          note: beforeVerification?.note,
        },
        afterData: {
          verificationId: verification.id,
          result: verification.result,
          handler: verification.handler,
          note: verification.note,
          evidenceCount: attachmentIds?.length,
        },
        ...getRequestMeta(request),
      });

      return resultWithEvidences;
    } catch (error) {
      reply.status(400).send({ error: '更新核查记录失败' });
    }
  });

  fastify.delete('/:id/verifications/:verificationId', async (request: FastifyRequest<{ Params: { id: string; verificationId: string } }>, reply) => {
    try {
      const beforeVerification = await prisma.clueVerification.findUnique({
        where: { id: request.params.verificationId },
      });

      await prisma.evidence.updateMany({
        where: { clueVerificationId: request.params.verificationId },
        data: { clueVerificationId: null },
      });

      await prisma.clueVerification.delete({
        where: { id: request.params.verificationId },
      });

      await createOperationLog({
        targetType: TargetType.CLUE,
        targetId: request.params.id,
        action: ActionType.VERIFY,
        description: `删除线索核查记录：核查结果-${beforeVerification?.result || ''}`,
        operator: beforeVerification?.handler || undefined,
        beforeData: beforeVerification ? {
          verificationId: beforeVerification.id,
          result: beforeVerification.result,
          handler: beforeVerification.handler,
          note: beforeVerification.note,
        } : undefined,
        ...getRequestMeta(request),
      });

      return { success: true };
    } catch (error) {
      reply.status(400).send({ error: '删除核查记录失败' });
    }
  });
}
