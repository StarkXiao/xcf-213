import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

interface AnalysisQuery {
  dimensions?: string | string[];
  minCaseCount?: number;
  startDate?: string;
  endDate?: string;
  caseTypes?: string | string[];
  caseStatuses?: string | string[];
}

const toArray = (val?: string | string[]): string[] | undefined => {
  if (!val) return undefined;
  return Array.isArray(val) ? val : [val];
};

const normalizeLocation = (loc: string): string => {
  return loc.trim().toLowerCase();
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/overview', async () => {
    const [caseCount, personCount, clueCount, evidenceCount] = await Promise.all([
      prisma.case.count(),
      prisma.person.count(),
      prisma.clue.count(),
      prisma.evidence.count(),
    ]);

    const multiCasePersons = await prisma.casePerson.groupBy({
      by: ['personId'],
      _count: { caseId: true },
      having: { caseId: { _count: { gte: 2 } } },
    });

    const caseWithLocation = await prisma.case.count({
      where: { location: { not: null, not: '' } },
    });

    const evidenceWithHash = await prisma.evidence.count({
      where: { hash: { not: null, not: '' } },
    });

    return {
      stats: {
        totalCases: caseCount,
        totalPersons: personCount,
        totalClues: clueCount,
        totalEvidences: evidenceCount,
        multiCasePersons: multiCasePersons.length,
        caseWithLocation,
        evidenceWithHash,
      },
    };
  });

  fastify.get('/cross-case', async (request: FastifyRequest<{ Querystring: AnalysisQuery }>, reply) => {
    const { dimensions, minCaseCount = 2, startDate, endDate, caseTypes, caseStatuses } = request.query;
    const dims = toArray(dimensions) || ['persons', 'locations', 'times', 'evidences'];
    const minCount = Number(minCaseCount) || 2;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const caseFilter: any = {};
    const cTypes = toArray(caseTypes);
    if (cTypes) caseFilter.caseType = { in: cTypes };
    const cStatuses = toArray(caseStatuses);
    if (cStatuses) caseFilter.status = { in: cStatuses };
    if (Object.keys(dateFilter).length) {
      caseFilter.OR = [
        { occurTime: dateFilter },
        { createdAt: dateFilter },
      ];
    }

    const result: any = {};

    if (dims.includes('persons')) {
      const casePersons = await prisma.casePerson.findMany({
        include: {
          person: {
            select: {
              id: true,
              name: true,
              idCard: true,
              phone: true,
              personType: true,
              gender: true,
              age: true,
              address: true,
            },
          },
          case: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              caseType: true,
              status: true,
              occurTime: true,
              location: true,
              priority: true,
            },
          },
        },
      });

      const personCaseMap = new Map<string, any>();
      casePersons.forEach(cp => {
        const key = cp.person.id;
        if (!personCaseMap.has(key)) {
          personCaseMap.set(key, {
            person: cp.person,
            cases: [],
            roles: new Set<string>(),
          });
        }
        personCaseMap.get(key).cases.push(cp.case);
        if (cp.role) personCaseMap.get(key).roles.add(cp.role);
      });

      result.persons = Array.from(personCaseMap.values())
        .filter(item => item.cases.length >= minCount)
        .map(item => ({
          ...item.person,
          caseCount: item.cases.length,
          cases: item.cases,
          roles: Array.from(item.roles),
          relationshipScore: Math.min(100, item.cases.length * 20),
        }))
        .sort((a, b) => b.caseCount - a.caseCount);
    }

    if (dims.includes('locations')) {
      const caseLocations = await prisma.case.findMany({
        where: { ...caseFilter, location: { not: null, not: '' } },
        select: {
          id: true,
          caseNumber: true,
          title: true,
          caseType: true,
          status: true,
          location: true,
          occurTime: true,
          priority: true,
        },
      });

      const clueLocations = await prisma.clue.findMany({
        where: { location: { not: null, not: '' } },
        select: {
          id: true,
          caseId: true,
          location: true,
          findTime: true,
        },
      });

      const evidenceLocations = await prisma.evidence.findMany({
        where: { location: { not: null, not: '' } },
        select: {
          id: true,
          caseId: true,
          location: true,
          collectTime: true,
          type: true,
          name: true,
        },
      });

      const locationMap = new Map<string, any>();
      const allCaseIdsFromCluesAndEvidences = new Set<string>();

      caseLocations.forEach(c => {
        const key = normalizeLocation(c.location!);
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            location: c.location,
            cases: [],
            caseIds: new Set(),
            clues: [],
            evidences: [],
            caseTypes: new Set<string>(),
          });
        }
        const entry = locationMap.get(key);
        if (!entry.caseIds.has(c.id)) {
          entry.caseIds.add(c.id);
          entry.caseTypes.add(c.caseType);
          entry.cases.push(c);
        }
      });

      clueLocations.forEach(clue => {
        const key = normalizeLocation(clue.location!);
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            location: clue.location,
            cases: [],
            caseIds: new Set(),
            clues: [],
            evidences: [],
            caseTypes: new Set<string>(),
          });
        }
        const entry = locationMap.get(key);
        entry.clues.push(clue);
        if (clue.caseId && !entry.caseIds.has(clue.caseId)) {
          entry.caseIds.add(clue.caseId);
          allCaseIdsFromCluesAndEvidences.add(clue.caseId);
        }
      });

      evidenceLocations.forEach(evidence => {
        const key = normalizeLocation(evidence.location!);
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            location: evidence.location,
            cases: [],
            caseIds: new Set(),
            clues: [],
            evidences: [],
            caseTypes: new Set<string>(),
          });
        }
        const entry = locationMap.get(key);
        entry.evidences.push(evidence);
        if (evidence.caseId && !entry.caseIds.has(evidence.caseId)) {
          entry.caseIds.add(evidence.caseId);
          allCaseIdsFromCluesAndEvidences.add(evidence.caseId);
        }
      });

      if (allCaseIdsFromCluesAndEvidences.size > 0) {
        const missingCases = await prisma.case.findMany({
          where: { id: { in: Array.from(allCaseIdsFromCluesAndEvidences) } },
          select: {
            id: true,
            caseNumber: true,
            title: true,
            caseType: true,
            status: true,
            occurTime: true,
            priority: true,
            location: true,
          },
        });

        const missingCaseMap = new Map(missingCases.map(c => [c.id, c]));

        locationMap.forEach(entry => {
          entry.caseIds.forEach((caseId: string) => {
            if (!entry.cases.find((c: any) => c.id === caseId) && missingCaseMap.has(caseId)) {
              const caseDetail = missingCaseMap.get(caseId)!;
              entry.cases.push(caseDetail);
              entry.caseTypes.add(caseDetail.caseType);
            }
          });
        });
      }

      result.locations = Array.from(locationMap.values())
        .filter(item => item.caseIds.size >= minCount)
        .map(item => ({
          location: item.location,
          caseCount: item.caseIds.size,
          cases: item.cases,
          clueCount: item.clues.length,
          evidenceCount: item.evidences.length,
          caseTypes: Array.from(item.caseTypes),
          riskLevel: item.caseIds.size >= 5 ? 'high' : item.caseIds.size >= 3 ? 'medium' : 'low',
        }))
        .sort((a, b) => b.caseCount - a.caseCount);
    }

    if (dims.includes('times')) {
      const casesWithTime = await prisma.case.findMany({
        where: { ...caseFilter, occurTime: { not: null } },
        select: {
          id: true,
          caseNumber: true,
          title: true,
          caseType: true,
          status: true,
          occurTime: true,
          location: true,
          priority: true,
        },
      });

      const timeClusterMap = new Map<string, any>();

      casesWithTime.forEach(c => {
        if (c.occurTime) {
          const dateKey = c.occurTime.toISOString().split('T')[0];
          const hour = c.occurTime.getHours();
          let timeSlot = '凌晨';
          if (hour >= 6 && hour < 12) timeSlot = '上午';
          else if (hour >= 12 && hour < 14) timeSlot = '中午';
          else if (hour >= 14 && hour < 18) timeSlot = '下午';
          else if (hour >= 18 && hour < 22) timeSlot = '晚上';

          if (!timeClusterMap.has(dateKey)) {
            timeClusterMap.set(dateKey, {
              date: dateKey,
              cases: [],
              caseIds: new Set(),
              timeSlots: new Map<string, number>(),
              caseTypes: new Set<string>(),
            });
          }
          const entry = timeClusterMap.get(dateKey);
          if (!entry.caseIds.has(c.id)) {
            entry.caseIds.add(c.id);
            entry.caseTypes.add(c.caseType);
            entry.cases.push(c);
          }
          entry.timeSlots.set(timeSlot, (entry.timeSlots.get(timeSlot) || 0) + 1);
        }
      });

      const weekClusterMap = new Map<string, any>();
      casesWithTime.forEach(c => {
        if (c.occurTime) {
          const d = new Date(c.occurTime);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const weekKey = weekStart.toISOString().split('T')[0];

          if (!weekClusterMap.has(weekKey)) {
            weekClusterMap.set(weekKey, {
              weekStart: weekKey,
              cases: [],
              caseIds: new Set(),
              caseTypes: new Set<string>(),
            });
          }
          const entry = weekClusterMap.get(weekKey);
          if (!entry.caseIds.has(c.id)) {
            entry.caseIds.add(c.id);
            entry.caseTypes.add(c.caseType);
            entry.cases.push(c);
          }
        }
      });

      result.times = {
        byDate: Array.from(timeClusterMap.values())
          .filter(item => item.caseIds.size >= minCount)
          .map(item => ({
            date: item.date,
            caseCount: item.caseIds.size,
            cases: item.cases,
            caseTypes: Array.from(item.caseTypes),
            timeSlots: Object.fromEntries(item.timeSlots),
          }))
          .sort((a, b) => b.caseCount - a.caseCount),
        byWeek: Array.from(weekClusterMap.values())
          .filter(item => item.caseIds.size >= minCount)
          .map(item => ({
            weekStart: item.weekStart,
            caseCount: item.caseIds.size,
            cases: item.cases,
            caseTypes: Array.from(item.caseTypes),
          }))
          .sort((a, b) => b.caseCount - a.caseCount),
      };
    }

    if (dims.includes('evidences')) {
      const evidences = await prisma.evidence.findMany({
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              caseType: true,
              status: true,
              priority: true,
            },
          },
          clue: {
            select: {
              id: true,
              clueNumber: true,
              title: true,
            },
          },
        },
      });

      const hashMap = new Map<string, any>();
      const typeLocationMap = new Map<string, any>();

      evidences.forEach(e => {
        const hashKey = e.hash || null;
        if (hashKey) {
          if (!hashMap.has(hashKey)) {
            hashMap.set(hashKey, {
              hash: hashKey,
              hashDisplay: e.hash.substring(0, 16) + '...',
              evidences: [],
              cases: [],
              caseIds: new Set(),
              types: new Set<string>(),
            });
          }
          const entry = hashMap.get(hashKey);
          entry.evidences.push({
            id: e.id,
            evidenceNumber: e.evidenceNumber,
            name: e.name,
            type: e.type,
            status: e.status,
            collectTime: e.collectTime,
            location: e.location,
            clue: e.clue,
          });
          entry.types.add(e.type);
          if (e.case && !entry.caseIds.has(e.case.id)) {
            entry.caseIds.add(e.case.id);
            entry.cases.push(e.case);
          }
        }

        if (e.type && e.location) {
          const tlKey = `${e.type}::${normalizeLocation(e.location)}`;
          if (!typeLocationMap.has(tlKey)) {
            typeLocationMap.set(tlKey, {
              type: e.type,
              location: e.location,
              evidences: [],
              cases: [],
              caseIds: new Set(),
            });
          }
          const tlEntry = typeLocationMap.get(tlKey);
          tlEntry.evidences.push({
            id: e.id,
            evidenceNumber: e.evidenceNumber,
            name: e.name,
          });
          if (e.case && !tlEntry.caseIds.has(e.case.id)) {
            tlEntry.caseIds.add(e.case.id);
            tlEntry.cases.push(e.case);
          }
        }
      });

      result.evidences = {
        byHash: Array.from(hashMap.values())
          .filter(item => item.caseIds.size >= minCount)
          .map(item => ({
            hash: item.hash,
            hashDisplay: item.hashDisplay,
            evidenceCount: item.evidences.length,
            evidences: item.evidences,
            caseCount: item.caseIds.size,
            cases: item.cases,
            types: Array.from(item.types),
          }))
          .sort((a, b) => b.caseCount - a.caseCount),
        byTypeLocation: Array.from(typeLocationMap.values())
          .filter(item => item.caseIds.size >= minCount)
          .map(item => ({
            type: item.type,
            location: item.location,
            evidenceCount: item.evidences.length,
            evidences: item.evidences,
            caseCount: item.caseIds.size,
            cases: item.cases,
          }))
          .sort((a, b) => b.caseCount - a.caseCount),
      };
    }

    return result;
  });

  fastify.get('/case-groups', async (request: FastifyRequest<{ Querystring: AnalysisQuery }>, reply) => {
    const { minCaseCount = 2 } = request.query;
    const minCount = Number(minCaseCount) || 2;

    const casePersons = await prisma.casePerson.findMany({
      include: {
        person: { select: { id: true, name: true } },
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
            caseType: true,
            status: true,
            location: true,
            occurTime: true,
            priority: true,
          },
        },
      },
    });

    const caseToPersons = new Map<string, Set<string>>();
    const caseMap = new Map<string, any>();
    casePersons.forEach(cp => {
      if (!caseToPersons.has(cp.caseId)) {
        caseToPersons.set(cp.caseId, new Set());
        caseMap.set(cp.caseId, cp.case);
      }
      caseToPersons.get(cp.caseId)!.add(cp.personId);
    });

    const caseLocations = await prisma.case.findMany({
      where: { location: { not: null, not: '' } },
      select: { id: true, location: true },
    });
    const caseToLocation = new Map<string, string>();
    caseLocations.forEach(c => {
      caseToLocation.set(c.id, normalizeLocation(c.location!));
    });

    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
      return parent.get(x)!;
    };
    const union = (x: string, y: string) => {
      const rx = find(x), ry = find(y);
      if (rx !== ry) parent.set(rx, ry);
    };

    const caseIds = Array.from(caseToPersons.keys());
    for (let i = 0; i < caseIds.length; i++) {
      for (let j = i + 1; j < caseIds.length; j++) {
        const persons1 = caseToPersons.get(caseIds[i])!;
        const persons2 = caseToPersons.get(caseIds[j])!;
        const sharedPersons = [...persons1].filter(p => persons2.has(p));
        const loc1 = caseToLocation.get(caseIds[i]);
        const loc2 = caseToLocation.get(caseIds[j]);
        const sharedLocation = loc1 && loc2 && loc1 === loc2;
        if (sharedPersons.length > 0 || sharedLocation) {
          union(caseIds[i], caseIds[j]);
        }
      }
    }

    const groups = new Map<string, any>();
    caseIds.forEach(id => {
      const root = find(id);
      if (!groups.has(root)) {
        groups.set(root, {
          id: root,
          caseIds: new Set<string>(),
          cases: [],
          sharedPersons: new Map<string, number>(),
          locations: new Set<string>(),
          caseTypes: new Set<string>(),
        });
      }
      const g = groups.get(root);
      g.caseIds.add(id);
      g.cases.push(caseMap.get(id));
      const loc = caseToLocation.get(id);
      if (loc) g.locations.add(loc);
      if (caseMap.get(id)) g.caseTypes.add(caseMap.get(id).caseType);
      const persons = caseToPersons.get(id);
      if (persons) persons.forEach(p => g.sharedPersons.set(p, (g.sharedPersons.get(p) || 0) + 1));
    });

    const personIds = new Set<string>();
    groups.forEach(g => {
      g.sharedPersons.forEach((count: number, pid: string) => {
        if (count >= 2) personIds.add(pid);
      });
    });

    let personDetails: any[] = [];
    if (personIds.size > 0) {
      personDetails = await prisma.person.findMany({
        where: { id: { in: Array.from(personIds) } },
        select: { id: true, name: true, personType: true, phone: true },
      });
    }
    const personDetailMap = new Map(personDetails.map(p => [p.id, p]));

    const result = Array.from(groups.values())
      .filter(g => g.caseIds.size >= minCount)
      .map(g => {
        const sharedPersonList = Array.from(g.sharedPersons.entries())
          .filter(([_, count]) => count >= 2)
          .map(([pid, count]) => ({
            ...(personDetailMap.get(pid) || { id: pid, name: '未知' }),
            caseCount: count,
          }))
          .sort((a, b) => b.caseCount - a.caseCount);

        return {
          id: g.id,
          caseCount: g.caseIds.size,
          cases: Array.from(g.cases),
          sharedPersons: sharedPersonList,
          locations: Array.from(g.locations),
          caseTypes: Array.from(g.caseTypes),
          riskLevel: g.caseIds.size >= 5 ? 'high' : g.caseIds.size >= 3 ? 'medium' : 'low',
        };
      })
      .sort((a, b) => b.caseCount - a.caseCount);

    return { groups: result, totalGroups: result.length };
  });

  fastify.get('/case-cluster/:caseId', async (request: FastifyRequest<{ Params: { caseId: string } }>, reply) => {
    const { caseId } = request.params;

    const baseCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        casePersons: { include: { person: true } },
      },
    });

    if (!baseCase) {
      reply.status(404).send({ error: '案件不存在' });
      return;
    }

    const basePersonIds = new Set(baseCase.casePersons.map(cp => cp.personId));
    const baseLocation = baseCase.location ? normalizeLocation(baseCase.location) : null;

    const allCasePersons = await prisma.casePerson.findMany({
      where: { caseId: { not: caseId } },
      include: {
        person: { select: { id: true, name: true, personType: true } },
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
            caseType: true,
            status: true,
            location: true,
            occurTime: true,
            priority: true,
          },
        },
      },
    });

    const relatedCases: any[] = [];
    const caseRelationMap = new Map<string, any>();

    allCasePersons.forEach(cp => {
      if (!caseRelationMap.has(cp.caseId)) {
        caseRelationMap.set(cp.caseId, {
          case: cp.case,
          sharedPersons: [],
          sharedLocation: false,
          dimensions: [],
          score: 0,
        });
      }
      if (basePersonIds.has(cp.personId)) {
        caseRelationMap.get(cp.caseId).sharedPersons.push(cp.person);
        if (!caseRelationMap.get(cp.caseId).dimensions.includes('persons')) {
          caseRelationMap.get(cp.caseId).dimensions.push('persons');
        }
      }
    });

    if (baseLocation) {
      const otherCases = await prisma.case.findMany({
        where: {
          id: { not: caseId },
          location: { not: null, not: '' },
        },
        select: {
          id: true,
          caseNumber: true,
          title: true,
          caseType: true,
          status: true,
          location: true,
          occurTime: true,
          priority: true,
        },
      });

      otherCases.forEach(c => {
        if (normalizeLocation(c.location!) === baseLocation) {
          if (!caseRelationMap.has(c.id)) {
            caseRelationMap.set(c.id, {
              case: c,
              sharedPersons: [],
              sharedLocation: true,
              dimensions: ['locations'],
              score: 0,
            });
          } else {
            caseRelationMap.get(c.id).sharedLocation = true;
            if (!caseRelationMap.get(c.id).dimensions.includes('locations')) {
              caseRelationMap.get(c.id).dimensions.push('locations');
            }
          }
        }
      });
    }

    caseRelationMap.forEach((entry, cid) => {
      let score = 0;
      score += entry.sharedPersons.length * 30;
      if (entry.sharedLocation) score += 25;
      if (entry.sharedPersons.length > 0 && entry.sharedLocation) score += 20;
      entry.score = Math.min(100, score);
    });

    const relatedList = Array.from(caseRelationMap.values())
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      baseCase: {
        id: baseCase.id,
        caseNumber: baseCase.caseNumber,
        title: baseCase.title,
        caseType: baseCase.caseType,
        status: baseCase.status,
        location: baseCase.location,
        occurTime: baseCase.occurTime,
        persons: baseCase.casePersons.map(cp => cp.person),
      },
      relatedCases: relatedList,
      totalRelated: relatedList.length,
    };
  });
}
