import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建演示数据...');

  await prisma.evidence.deleteMany();
  await prisma.cluePerson.deleteMany();
  await prisma.casePerson.deleteMany();
  await prisma.personRelation.deleteMany();
  await prisma.clue.deleteMany();
  await prisma.case.deleteMany();
  await prisma.person.deleteMany();

  console.log('👤 创建人员数据...');
  const persons = await Promise.all([
    prisma.person.create({
      data: {
        name: '张伟强',
        gender: '男',
        age: 38,
        idCard: '110101198601011234',
        phone: '13800138001',
        address: '北京市朝阳区建国路88号',
        occupation: '科技公司CEO',
        personType: '受害人',
        description: '某科技有限公司创始人兼CEO，在公司内被发现死亡',
      },
    }),
    prisma.person.create({
      data: {
        name: '李明辉',
        gender: '男',
        age: 35,
        idCard: '110101198905065678',
        phone: '13800138002',
        address: '北京市海淀区中关村大街1号',
        occupation: '技术总监',
        personType: '嫌疑人',
        description: '受害者公司技术总监，与受害者有股权纠纷',
      },
    }),
    prisma.person.create({
      data: {
        name: '王美玲',
        gender: '女',
        age: 32,
        idCard: '110101199208159012',
        phone: '13800138003',
        address: '北京市西城区金融街15号',
        occupation: '财务经理',
        personType: '嫌疑人',
        description: '受害者公司财务经理，负责公司财务工作',
      },
    }),
    prisma.person.create({
      data: {
        name: '赵小龙',
        gender: '男',
        age: 28,
        idCard: '110101199603203456',
        phone: '13800138004',
        address: '北京市通州区新华大街100号',
        occupation: '保安',
        personType: '证人',
        description: '公司保安，案发当晚值班',
      },
    }),
    prisma.person.create({
      data: {
        name: '陈雪芳',
        gender: '女',
        age: 36,
        idCard: '110101198811117890',
        phone: '13800138005',
        address: '北京市丰台区方庄路5号',
        occupation: '秘书',
        personType: '证人',
        description: '受害者私人秘书，最后一个见到受害者的人',
      },
    }),
    prisma.person.create({
      data: {
        name: '刘建国',
        gender: '男',
        age: 45,
        idCard: '110101197907072345',
        phone: '13800138006',
        address: '北京市东城区王府井大街200号',
        occupation: '投资人',
        personType: '关系人',
        description: '公司A轮投资人，与受害者近期有争执',
      },
    }),
  ]);

  console.log('📁 创建案件数据...');
  const case1 = await prisma.case.create({
    data: {
      caseNumber: 'AJ2024000001',
      title: '科技公司CEO办公室死亡案',
      description: '2024年1月15日，某科技有限公司创始人兼CEO张伟强被发现死于其办公室内，死因可疑。现场发现死者倒在办公桌旁，头部有明显外伤，办公室内有翻动痕迹。',
      caseType: '刑事案件',
      status: '侦查中',
      priority: '特急',
      location: '北京市朝阳区科技园区A座18层',
      occurTime: new Date('2024-01-15T22:00:00'),
      reportTime: new Date('2024-01-16T08:30:00'),
      caseManager: '李警官',
      department: '重案中队',
      summary: '本案为一起恶性凶杀案件，受害者为知名企业家。目前已锁定多名嫌疑人，正在进一步调查中。',
    },
  });

  const case2 = await prisma.case.create({
    data: {
      caseNumber: 'AJ2024000002',
      title: '公司财务数据造假案',
      description: '匿名举报称某科技公司存在严重财务造假行为，涉及金额巨大。',
      caseType: '经济案件',
      status: '侦查中',
      priority: '重要',
      location: '北京市朝阳区科技园区',
      occurTime: new Date('2023-06-01T00:00:00'),
      reportTime: new Date('2024-01-10T10:00:00'),
      caseManager: '王警官',
      department: '经济犯罪侦查大队',
    },
  });

  console.log('🔗 创建案件人员关联...');
  await Promise.all([
    prisma.casePerson.create({ data: { caseId: case1.id, personId: persons[0].id, role: '受害人' } }),
    prisma.casePerson.create({ data: { caseId: case1.id, personId: persons[1].id, role: '主犯' } }),
    prisma.casePerson.create({ data: { caseId: case1.id, personId: persons[2].id, role: '从犯' } }),
    prisma.casePerson.create({ data: { caseId: case1.id, personId: persons[3].id, role: '目击证人' } }),
    prisma.casePerson.create({ data: { caseId: case1.id, personId: persons[4].id, role: '目击证人' } }),
    prisma.casePerson.create({ data: { caseId: case1.id, personId: persons[5].id, role: '关系人' } }),
    prisma.casePerson.create({ data: { caseId: case2.id, personId: persons[2].id, role: '主犯' } }),
    prisma.casePerson.create({ data: { caseId: case2.id, personId: persons[0].id, role: '受害人' } }),
  ]);

  console.log('🔗 创建人员关系...');
  await Promise.all([
    prisma.personRelation.create({
      data: {
        subjectId: persons[0].id,
        objectId: persons[1].id,
        relationType: '上下级',
        description: '张伟强是李明辉的直接上司，两人因公司发展方向产生矛盾',
        caseId: case1.id,
      },
    }),
    prisma.personRelation.create({
      data: {
        subjectId: persons[1].id,
        objectId: persons[2].id,
        relationType: '同事',
        description: '李明辉和王美玲在工作中接触密切，据传闻两人关系非同一般',
        caseId: case1.id,
      },
    }),
    prisma.personRelation.create({
      data: {
        subjectId: persons[0].id,
        objectId: persons[4].id,
        relationType: '上下级',
        description: '陈雪芳是张伟强的私人秘书，工作关系密切',
        caseId: case1.id,
      },
    }),
    prisma.personRelation.create({
      data: {
        subjectId: persons[0].id,
        objectId: persons[5].id,
        relationType: '交易关系',
        description: '刘建国是张伟强公司的投资人，近期因股权问题产生重大分歧',
        caseId: case1.id,
      },
    }),
    prisma.personRelation.create({
      data: {
        subjectId: persons[2].id,
        objectId: persons[5].id,
        relationType: '同伙',
        description: '财务记录显示王美玲与刘建国之间存在可疑资金往来',
        caseId: case2.id,
      },
    }),
  ]);

  console.log('🔍 创建线索数据...');
  const clues = await Promise.all([
    prisma.clue.create({
      data: {
        caseId: case1.id,
        clueNumber: 'XS2024000001',
        title: '保安目击可疑人员',
        content: '据值班保安赵小龙陈述，案发当晚21:45左右，他看到一个穿黑色外套、戴口罩的人影从CEO办公室所在的楼层进入消防通道。该人身高约175cm，体型偏瘦。',
        clueType: '人证线索',
        source: '证人陈述',
        credibility: '高',
        importance: '关键',
        status: '已核实',
        location: '科技园区A座18层消防通道',
        findTime: new Date('2024-01-16T09:00:00'),
        informant: '赵小龙',
        handler: '李警官',
      },
    }),
    prisma.clue.create({
      data: {
        caseId: case1.id,
        clueNumber: 'XS2024000002',
        title: '监控视频记录',
        content: '18层走廊监控显示，案发当晚21:30，李明辉进入了CEO办公区域，21:55离开。期间该区域无其他人员出入。',
        clueType: '视频监控',
        source: '监控录像',
        credibility: '极高',
        importance: '关键',
        status: '已采用',
        location: '科技园区A座18层监控室',
        findTime: new Date('2024-01-16T10:30:00'),
        handler: '张技术员',
      },
    }),
    prisma.clue.create({
      data: {
        caseId: case1.id,
        clueNumber: 'XS2024000003',
        title: '财务异常记录',
        content: '经查，公司账户在案发前一周有多笔大额资金转出，收款人信息模糊。财务经理王美玲无法说明这些资金的去向。',
        clueType: '书证线索',
        source: '财务审计',
        credibility: '高',
        importance: '重要',
        status: '核实中',
        findTime: new Date('2024-01-17T14:00:00'),
        handler: '王警官',
      },
    }),
    prisma.clue.create({
      data: {
        caseId: case1.id,
        clueNumber: 'XS2024000004',
        title: '秘书最后接触记录',
        content: '陈雪芳称案发当晚21:00她离开公司时，张伟强还在办公室工作，当时没有异常。她还提到张伟强当天下午与刘建国发生过激烈争吵。',
        clueType: '人证线索',
        source: '证人陈述',
        credibility: '中等',
        importance: '重要',
        status: '已核实',
        findTime: new Date('2024-01-16T11:00:00'),
        informant: '陈雪芳',
        handler: '李警官',
      },
    }),
    prisma.clue.create({
      data: {
        caseId: case2.id,
        clueNumber: 'XS2024000005',
        title: '匿名举报信',
        content: '举报人详细列出了公司2023年度虚假合同12份，涉及总金额达5000万元。举报材料中包含部分合同扫描件和银行流水截图。',
        clueType: '书证线索',
        source: '匿名举报',
        credibility: '中等',
        importance: '关键',
        status: '核实中',
        findTime: new Date('2024-01-10T10:00:00'),
        handler: '王警官',
      },
    }),
  ]);

  console.log('🔗 创建线索人员关联...');
  await Promise.all([
    prisma.cluePerson.create({ data: { clueId: clues[0].id, personId: persons[3].id, relation: '提供者' } }),
    prisma.cluePerson.create({ data: { clueId: clues[1].id, personId: persons[1].id, relation: '嫌疑人' } }),
    prisma.cluePerson.create({ data: { clueId: clues[2].id, personId: persons[2].id, relation: '嫌疑人' } }),
    prisma.cluePerson.create({ data: { clueId: clues[3].id, personId: persons[4].id, relation: '提供者' } }),
    prisma.cluePerson.create({ data: { clueId: clues[3].id, personId: persons[5].id, relation: '嫌疑人' } }),
  ]);

  console.log('📄 创建证据数据...');
  await Promise.all([
    prisma.evidence.create({
      data: {
        caseId: case1.id,
        clueId: clues[1].id,
        evidenceNumber: 'ZJ2024000001',
        name: '18层走廊监控录像',
        description: '案发当晚21:00-22:00时间段18层走廊的监控视频，清晰记录了嫌疑人的出入时间。',
        type: '视听资料',
        filePath: '/uploads/placeholder.mp4',
        fileName: '监控录像_20240115_2100_2200.mp4',
        fileSize: 256000000,
        mimeType: 'video/mp4',
        collectionMethod: '调取证据',
        collector: '张技术员',
        collectTime: new Date('2024-01-16T10:30:00'),
        location: '科技园区A座监控室',
        status: '已入库',
      },
    }),
    prisma.evidence.create({
      data: {
        caseId: case1.id,
        evidenceNumber: 'ZJ2024000002',
        name: '案发现场照片',
        description: '案发现场多角度照片共48张，包含受害者位置、办公室环境、可疑痕迹等。',
        type: '物证',
        filePath: '/uploads/placeholder.pdf',
        fileName: '案发现场照片集.pdf',
        fileSize: 89000000,
        mimeType: 'application/pdf',
        collectionMethod: '现场勘查提取',
        collector: '王技术员',
        collectTime: new Date('2024-01-16T09:00:00'),
        location: '科技园区A座1801室',
        status: '已入库',
      },
    }),
    prisma.evidence.create({
      data: {
        caseId: case1.id,
        evidenceNumber: 'ZJ2024000003',
        name: '财务报表及银行流水',
        description: '公司2023年度财务报表和相关银行账户流水，显示有多笔可疑资金往来。',
        type: '书证',
        filePath: '/uploads/placeholder.xlsx',
        fileName: '财务资料_2023年度.xlsx',
        fileSize: 15600000,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        collectionMethod: '调取证据',
        collector: '王警官',
        collectTime: new Date('2024-01-17T14:00:00'),
        location: '公司财务部',
        status: '已鉴定',
      },
    }),
    prisma.evidence.create({
      data: {
        caseId: case1.id,
        clueId: clues[0].id,
        evidenceNumber: 'ZJ2024000004',
        name: '证人询问笔录',
        description: '对值班保安赵小龙的询问笔录，详细记录了案发当晚的所见所闻。',
        type: '证人证言',
        filePath: '/uploads/placeholder.pdf',
        fileName: '询问笔录_赵小龙_20240116.pdf',
        fileSize: 2400000,
        mimeType: 'application/pdf',
        collectionMethod: '证人提供',
        collector: '李警官',
        collectTime: new Date('2024-01-16T09:30:00'),
        location: '派出所询问室',
        status: '已入库',
      },
    }),
    prisma.evidence.create({
      data: {
        caseId: case2.id,
        clueId: clues[4].id,
        evidenceNumber: 'ZJ2024000005',
        name: '举报材料原件',
        description: '匿名举报信原件及所附证据材料，包括虚假合同复印件和银行流水截图。',
        type: '书证',
        filePath: '/uploads/placeholder.pdf',
        fileName: '举报材料_20240110.pdf',
        fileSize: 45000000,
        mimeType: 'application/pdf',
        collectionMethod: '其他',
        collector: '王警官',
        collectTime: new Date('2024-01-10T10:00:00'),
        location: '公安局信访办',
        status: '已鉴定',
      },
    }),
  ]);

  console.log('✅ 演示数据创建完成！');
  console.log(`
  📊 数据概览：
  ├─ 案件：2件
  ├─ 人员：6人
  ├─ 线索：5条
  ├─ 证据：5份
  ├─ 人员关系：5条
  ├─ 案件-人员关联：8条
  └─ 线索-人员关联：5条
  `);
}

main()
  .catch((e) => {
    console.error('❌ 数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
