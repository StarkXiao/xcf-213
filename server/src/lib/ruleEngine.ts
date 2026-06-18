import prisma from './prisma';

function generateAlertNumber() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AL${dateStr}${random}`;
}

function isRuleValid(rule: any): boolean {
  if (rule.status !== 'ACTIVE') return false;
  const now = new Date();
  if (rule.validFrom && new Date(rule.validFrom) > now) return false;
  if (rule.validTo && new Date(rule.validTo) < now) return false;
  return true;
}

function matchLocationKeywords(location: string, keywordsStr: string | null): boolean {
  if (!keywordsStr || !location) return false;
  const keywords = keywordsStr
    .split(/[,，;；\n]/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
  const lowerLocation = location.toLowerCase();
  return keywords.some(kw => lowerLocation.includes(kw.toLowerCase()));
}

async function createAlert(data: {
  ruleId: string;
  title: string;
  content: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  alertLevel?: string;
  triggerSource: string;
  caseId?: string;
  clueId?: string;
  evidenceId?: string;
  personId?: string;
  location?: string;
}) {
  const alertNumber = generateAlertNumber();

  const alert = await prisma.alertMessage.create({
    data: {
      alertNumber,
      ruleId: data.ruleId,
      title: data.title,
      content: data.content,
      targetType: data.targetType as any,
      targetId: data.targetId,
      targetName: data.targetName,
      alertLevel: (data.alertLevel || 'MEDIUM') as any,
      status: 'PENDING',
      triggerSource: data.triggerSource,
      triggerTime: new Date(),
      caseId: data.caseId,
      clueId: data.clueId,
      evidenceId: data.evidenceId,
      personId: data.personId,
      location: data.location,
    },
  });

  await prisma.surveillanceRule.update({
    where: { id: data.ruleId },
    data: {
      triggerCount: { increment: 1 },
      lastTriggerTime: new Date(),
    },
  });

  return alert;
}

export async function checkPersonRules(
  personId: string,
  personName: string,
  changeType: string,
  extra?: { caseId?: string; clueId?: string }
) {
  const rules = await prisma.surveillanceRule.findMany({
    where: { targetType: 'PERSON', status: 'ACTIVE' },
  });

  const triggered: any[] = [];

  for (const rule of rules) {
    if (!isRuleValid(rule)) continue;

    let targetIds: string[] = [];
    try {
      targetIds = rule.targetIds ? JSON.parse(rule.targetIds) : [];
    } catch { continue; }

    if (!targetIds.includes(personId)) continue;

    const changeLabels: Record<string, string> = {
      CREATE: '新增人员',
      UPDATE: '人员信息变更',
      CASE_ASSOCIATION: '关联案件',
      CLUE_ASSOCIATION: '关联线索',
      RELATION_ADD: '新增人员关系',
    };

    const title = `${changeLabels[changeType] || changeType}：${personName}`;
    const content = `布控规则「${rule.name}」触发：重点人员「${personName}」发生了${changeLabels[changeType] || changeType}变更，请及时关注。`;

    const alert = await createAlert({
      ruleId: rule.id,
      title,
      content,
      targetType: 'PERSON',
      targetId: personId,
      targetName: personName,
      alertLevel: rule.alertLevel as string,
      triggerSource: `PERSON_${changeType}`,
      caseId: extra?.caseId,
      clueId: extra?.clueId,
      personId,
    });

    triggered.push(alert);
  }

  return triggered;
}

export async function checkLocationRules(
  location: string,
  source: {
    type: 'CASE' | 'CLUE' | 'EVIDENCE';
    id: string;
    name: string;
    number?: string;
    caseId?: string;
    clueId?: string;
  }
) {
  if (!location) return [];

  const rules = await prisma.surveillanceRule.findMany({
    where: { targetType: 'LOCATION', status: 'ACTIVE' },
  });

  const triggered: any[] = [];

  for (const rule of rules) {
    if (!isRuleValid(rule)) continue;

    if (!matchLocationKeywords(location, rule.locationKeywords)) continue;

    const sourceLabels: Record<string, string> = {
      CASE: '案件',
      CLUE: '线索',
      EVIDENCE: '证据',
    };

    const sourceLabel = sourceLabels[source.type] || source.type;
    const title = `${sourceLabel}涉及重点地点：${location}`;
    const content = `布控规则「${rule.name}」触发：${sourceLabel}「${source.name}」涉及重点监控地点「${location}」，请及时关注。`;

    const alertData: any = {
      ruleId: rule.id,
      title,
      content,
      targetType: 'LOCATION',
      alertLevel: rule.alertLevel as string,
      triggerSource: `LOCATION_${source.type}`,
      location,
      caseId: source.caseId,
      clueId: source.clueId,
    };

    if (source.type === 'CASE') {
      alertData.caseId = source.id;
      alertData.targetId = source.id;
      alertData.targetName = source.name;
    } else if (source.type === 'CLUE') {
      alertData.clueId = source.id;
      alertData.targetId = source.id;
      alertData.targetName = source.name;
    } else if (source.type === 'EVIDENCE') {
      alertData.evidenceId = source.id;
      alertData.targetId = source.id;
      alertData.targetName = source.name;
    }

    const alert = await createAlert(alertData);
    triggered.push(alert);
  }

  return triggered;
}

export async function checkEvidenceRules(
  evidenceId: string,
  evidenceName: string,
  evidenceNumber: string,
  changeType: string,
  extra?: { caseId?: string; clueId?: string; location?: string }
) {
  const rules = await prisma.surveillanceRule.findMany({
    where: { targetType: 'EVIDENCE', status: 'ACTIVE' },
  });

  const triggered: any[] = [];

  for (const rule of rules) {
    if (!isRuleValid(rule)) continue;

    let targetIds: string[] = [];
    try {
      targetIds = rule.targetIds ? JSON.parse(rule.targetIds) : [];
    } catch { continue; }

    if (!targetIds.includes(evidenceId)) continue;

    const changeLabels: Record<string, string> = {
      CREATE: '新增证据',
      UPDATE: '证据信息变更',
      STATUS_CHANGE: '证据状态变更',
      BORROW: '证据借阅',
      RETURN: '证据归还',
      TRANSFER: '证据流转',
    };

    const title = `${changeLabels[changeType] || changeType}：${evidenceName}`;
    const content = `布控规则「${rule.name}」触发：重点证据「${evidenceName}」（${evidenceNumber}）发生了${changeLabels[changeType] || changeType}，请及时关注。`;

    const alert = await createAlert({
      ruleId: rule.id,
      title,
      content,
      targetType: 'EVIDENCE',
      targetId: evidenceId,
      targetName: evidenceName,
      alertLevel: changeType === 'BORROW' || changeType === 'TRANSFER'
        ? (rule.alertLevel as string)
        : (rule.alertLevel as string),
      triggerSource: `EVIDENCE_${changeType}`,
      caseId: extra?.caseId,
      clueId: extra?.clueId,
      evidenceId,
      location: extra?.location,
    });

    triggered.push(alert);
  }

  return triggered;
}
