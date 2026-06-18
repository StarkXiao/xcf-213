import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, Modal, Form, Select, Input, message, Popconfirm, Row, Col, Progress, Steps, Timeline, Statistic, Divider } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UserOutlined, SearchOutlined, PaperClipOutlined, ShareAltOutlined, ClockCircleOutlined, CheckCircleOutlined, WarningOutlined, FileSearchOutlined, TeamOutlined, FileTextOutlined } from '@ant-design/icons';
import moment from 'moment';
import ReactECharts from 'echarts-for-react';
import { caseApi, personApi, clueApi, evidenceApi } from '../../services/api';

const statusColors: Record<string, string> = {
  '待立案': 'default',
  '侦查中': 'processing',
  '已移送起诉': 'warning',
  '已判决': 'success',
  '已结案': 'success',
  '已撤销': 'error',
};

const priorityColors: Record<string, string> = {
  '特急': 'red',
  '紧急': 'orange',
  '重要': 'blue',
  '一般': 'green',
};

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const credibilityColors: Record<string, string> = {
  '极高': 'red',
  '高': 'orange',
  '中等': 'blue',
  '低': 'default',
  '极低': 'default',
};

const importanceColors: Record<string, string> = {
  '关键': 'red',
  '重要': 'orange',
  '一般': 'blue',
  '次要': 'default',
};

const evidenceTypeColors: Record<string, string> = {
  '物证': 'red',
  '书证': 'orange',
  '证人证言': 'green',
  '视听资料': 'blue',
  '电子数据': 'purple',
  '鉴定意见': 'cyan',
  '勘验笔录': 'magenta',
  '其他': 'default',
};

const investigationStages = [
  { key: 'report', title: '接报案阶段', description: '接到报案，初步了解案件情况', icon: FileSearchOutlined },
  { key: 'filing', title: '立案审查阶段', description: '审查案件是否符合立案条件', icon: FileTextOutlined },
  { key: 'investigation', title: '侦查取证阶段', description: '深入侦查，收集线索和证据', icon: SearchOutlined },
  { key: 'breakthrough', title: '破案攻坚阶段', description: '锁定嫌疑人，完善证据链', icon: CheckCircleOutlined },
  { key: 'prosecution', title: '移送起诉阶段', description: '移交检察机关审查起诉', icon: PaperClipOutlined },
  { key: 'trial', title: '审理判决阶段', description: '法院审理并作出判决', icon: WarningOutlined },
  { key: 'closed', title: '结案归档阶段', description: '案件办结，整理归档', icon: FileTextOutlined },
];

const stageStatusMap: Record<string, number> = {
  '待立案': 1,
  '侦查中': 2,
  '已移送起诉': 4,
  '已判决': 5,
  '已结案': 6,
  '已撤销': 0,
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personModal, setPersonModal] = useState(false);
  const [personForm] = Form.useForm();
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [relations, setRelations] = useState<any>({ nodes: [], edges: [] });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      loadCaseData();
      loadAllPersons();
      loadRelations();
    }
  }, [id]);

  const loadCaseData = async () => {
    setLoading(true);
    try {
      const res = await caseApi.get(id!);
      setCaseData(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAllPersons = async () => {
    try {
      const res = await personApi.all();
      setAllPersons(res.data);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const loadRelations = async () => {
    try {
      const res = await caseApi.getRelations(id!);
      setRelations(res.data);
    } catch (error) {
      console.error('Failed to load relations:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await caseApi.delete(id!);
      message.success('删除成功');
      navigate('/cases');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAddPerson = async (values: any) => {
    try {
      await caseApi.addPerson(id!, values);
      message.success('添加成功');
      setPersonModal(false);
      personForm.resetFields();
      loadCaseData();
      loadRelations();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleRemovePerson = async (personId: string) => {
    try {
      await caseApi.removePerson(id!, personId);
      message.success('移除成功');
      loadCaseData();
      loadRelations();
    } catch (error) {
      message.error('移除失败');
    }
  };

  const graphOption = {
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `${params.data.name}<br/>类型: ${params.data.type}<br/>角色: ${params.data.role || '相关人员'}`;
        }
        return `${params.data.relation}<br/>${params.data.description || ''}`;
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      label: {
        show: true,
        position: 'bottom',
        formatter: '{b}',
      },
      edgeLabel: {
        show: true,
        formatter: '{c}',
        fontSize: 12,
      },
      force: {
        repulsion: 400,
        edgeLength: 120,
      },
      data: relations.nodes.map((node: any) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        role: node.role,
        symbolSize: node.type === '受害人' ? 50 : node.type === '嫌疑人' ? 45 : 40,
        itemStyle: {
          color: node.type === '受害人' ? '#faad14' : node.type === '嫌疑人' ? '#ff4d4f' : node.type === '证人' ? '#52c41a' : '#1677ff',
        },
      })),
      links: relations.edges.map((edge: any) => ({
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        description: edge.description,
        lineStyle: {
          width: 2,
          color: '#999',
        },
      })),
      categories: [
        { name: '受害人', itemStyle: { color: '#faad14' } },
        { name: '嫌疑人', itemStyle: { color: '#ff4d4f' } },
        { name: '证人', itemStyle: { color: '#52c41a' } },
        { name: '关系人', itemStyle: { color: '#1677ff' } },
      ],
    }],
  };

  if (!caseData) return null;

  const currentStageIndex = stageStatusMap[caseData.status] ?? 0;

  const clueStats = {
    total: caseData.clues?.length || 0,
    verified: caseData.clues?.filter((c: any) => c.status === '已核实' || c.status === '已采用').length || 0,
    verifying: caseData.clues?.filter((c: any) => c.status === '核实中').length || 0,
    unused: caseData.clues?.filter((c: any) => c.status === '待核实' || c.status === '未采用').length || 0,
  };

  const evidenceStats = {
    total: caseData.evidences?.length || 0,
    collected: caseData.evidences?.filter((e: any) => e.status === '已入库' || e.status === '已鉴定').length || 0,
    authenticating: caseData.evidences?.filter((e: any) => e.status === '鉴定中' || e.status === '待鉴定').length || 0,
    pending: caseData.evidences?.filter((e: any) => e.status === '待入库').length || 0,
  };

  const personStats = {
    total: caseData.casePersons?.length || 0,
    suspects: caseData.casePersons?.filter((cp: any) => cp.person?.personType === '嫌疑人').length || 0,
    victims: caseData.casePersons?.filter((cp: any) => cp.person?.personType === '受害人').length || 0,
    witnesses: caseData.casePersons?.filter((cp: any) => cp.person?.personType === '证人').length || 0,
    related: caseData.casePersons?.filter((cp: any) => cp.person?.personType === '关系人').length || 0,
  };

  const stageProgress = {
    clueProgress: clueStats.total > 0 ? Math.round((clueStats.verified / clueStats.total) * 100) : 0,
    evidenceProgress: evidenceStats.total > 0 ? Math.round((evidenceStats.collected / evidenceStats.total) * 100) : 0,
    personProgress: personStats.total > 0 ? Math.round(((personStats.suspects + personStats.victims + personStats.witnesses) / personStats.total) * 100) : 0,
  };

  const tabItems = [
    {
      key: 'overview',
      label: '基本信息',
      children: (
        <div>
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="案件编号">{caseData.caseNumber}</Descriptions.Item>
            <Descriptions.Item label="案件类型">
              <Tag>{caseData.caseType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="案件标题" span={2}>{caseData.title}</Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={priorityColors[caseData.priority]}>{caseData.priority}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[caseData.status]}>{caseData.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="案发地点">{caseData.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="案发时间">
              {caseData.occurTime ? moment(caseData.occurTime).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="报案时间">
              {caseData.reportTime ? moment(caseData.reportTime).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="主办民警">{caseData.caseManager || '-'}</Descriptions.Item>
            <Descriptions.Item label="所属部门">{caseData.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{moment(caseData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{moment(caseData.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="案件描述" span={2}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{caseData.description}</div>
            </Descriptions.Item>
            {caseData.summary && (
              <Descriptions.Item label="案件摘要" span={2}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{caseData.summary}</div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'persons',
      label: `涉案人员 (${caseData.casePersons?.length || 0})`,
      icon: <UserOutlined />,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPersonModal(true)}>
              添加涉案人员
            </Button>
          </div>
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={caseData.casePersons}
            renderItem={(item: any) => (
              <List.Item>
                <Card
                  size="small"
                  actions={[
                    <Button type="link" size="small" onClick={() => navigate(`/persons/${item.personId}`)}>查看</Button>,
                    <Popconfirm title="确定移除该人员？" onConfirm={() => handleRemovePerson(item.personId)}>
                      <Button type="link" size="small" danger>移除</Button>
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    avatar={<div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: personTypeColors[item.person.personType] === 'red' ? '#ff4d4f'
                        : personTypeColors[item.person.personType] === 'orange' ? '#faad14'
                        : personTypeColors[item.person.personType] === 'green' ? '#52c41a'
                        : '#1677ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 20,
                    }}>{item.person.name[0]}</div>}
                    title={<Space><span>{item.person.name}</span><Tag color={personTypeColors[item.person.personType]}>{item.person.personType}</Tag></Space>}
                    description={
                      <div>
                        <div><Tag color="blue">{item.role}</Tag></div>
                        <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                          {item.person.phone || '-'} | {item.person.idCard || '-'}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'clues',
      label: `关联线索 (${caseData.clues?.length || 0})`,
      icon: <SearchOutlined />,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/clues/new?caseId=${id}`)}>
              新增线索
            </Button>
          </div>
          <List
            dataSource={caseData.clues}
            renderItem={(item: any) => (
              <List.Item
                actions={[
                  <Button type="link" onClick={() => navigate(`/clues/${item.id}`)}>详情</Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <a onClick={() => navigate(`/clues/${item.id}`)}>{item.title}</a>
                      <Tag color={statusColors[item.status]}>{item.status}</Tag>
                      <Tag color={credibilityColors[item.credibility]}>可信度: {item.credibility}</Tag>
                      <Tag color={importanceColors[item.importance]}>重要性: {item.importance}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ color: '#666', marginBottom: 4 }}>{item.content}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        来源: {item.source} | {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                      {item.cluePersons?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ color: '#666', fontSize: 12 }}>关联人员: </span>
                          {item.cluePersons.map((cp: any) => (
                            <Tag key={cp.id} color="blue">{cp.person.name} ({cp.relation})</Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'evidences',
      label: `证据附件 (${caseData.evidences?.length || 0})`,
      icon: <PaperClipOutlined />,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/evidences/upload?caseId=${id}`)}>
              上传证据
            </Button>
          </div>
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
            dataSource={caseData.evidences}
            renderItem={(item: any) => (
              <List.Item>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/evidences/${item.id}`)}
                  actions={[
                    <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); navigate(`/evidences/${item.id}`); }}>详情</Button>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <span style={{ fontSize: 14 }}>{item.name}</span>
                        <Tag color={evidenceTypeColors[item.type]}>{item.type}</Tag>
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 12, color: '#666' }}>
                        <div style={{ marginBottom: 4 }}>{item.evidenceNumber}</div>
                        <div>状态: <Tag color={statusColors[item.status]}>{item.status}</Tag></div>
                        <div>{moment(item.createdAt).format('YYYY-MM-DD')}</div>
                      </div>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'stages',
      label: '阶段推进',
      icon: <ClockCircleOutlined />,
      children: (
        <div>
          <Card
            title="案件侦查阶段推进"
            extra={<Tag color={statusColors[caseData.status]}>当前状态: {caseData.status}</Tag>}
            style={{ marginBottom: 24 }}
          >
            <Steps
              direction="vertical"
              current={currentStageIndex}
              status={
                caseData.status === '已撤销' ? 'error' :
                caseData.status === '已结案' ? 'finish' :
                'process'
              }
              items={investigationStages.map((stage, index) => {
                const isFinished = caseData.status === '已结案' || index < currentStageIndex;
                const isCurrent = index === currentStageIndex && caseData.status !== '已结案' && caseData.status !== '已撤销';
                return {
                  title: stage.title,
                  description: (
                    <div>
                      <p style={{ color: '#666', marginBottom: 8 }}>{stage.description}</p>
                      {isFinished && <Tag color="success">已完成</Tag>}
                      {isCurrent && <Tag color="processing">进行中</Tag>}
                      {index > currentStageIndex && caseData.status !== '已结案' && <Tag>待开始</Tag>}
                    </div>
                  ),
                  icon: React.createElement(stage.icon),
                };
              })}
            />
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="线索核查进度"
                  value={stageProgress.clueProgress}
                  suffix="%"
                  prefix={<SearchOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <Progress
                  percent={stageProgress.clueProgress}
                  status="active"
                  style={{ marginTop: 16 }}
                />
                <Divider />
                <div style={{ fontSize: 12, color: '#666' }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>已核实/采用:</span>
                    <Tag color="success">{clueStats.verified} 条</Tag>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>核实中:</span>
                    <Tag color="processing">{clueStats.verifying} 条</Tag>
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', width: 80 }}>待核实/未用:</span>
                    <Tag>{clueStats.unused} 条</Tag>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="证据收集进度"
                  value={stageProgress.evidenceProgress}
                  suffix="%"
                  prefix={<PaperClipOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
                <Progress
                  percent={stageProgress.evidenceProgress}
                  status="active"
                  strokeColor="#52c41a"
                  style={{ marginTop: 16 }}
                />
                <Divider />
                <div style={{ fontSize: 12, color: '#666' }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>已入库/鉴定:</span>
                    <Tag color="success">{evidenceStats.collected} 份</Tag>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>鉴定中:</span>
                    <Tag color="processing">{evidenceStats.authenticating} 份</Tag>
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', width: 80 }}>待入库:</span>
                    <Tag>{evidenceStats.pending} 份</Tag>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="人员核查覆盖"
                  value={stageProgress.personProgress}
                  suffix="%"
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
                <Progress
                  percent={stageProgress.personProgress}
                  status="active"
                  strokeColor="#faad14"
                  style={{ marginTop: 16 }}
                />
                <Divider />
                <div style={{ fontSize: 12, color: '#666' }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>嫌疑人:</span>
                    <Tag color="red">{personStats.suspects} 人</Tag>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>受害人:</span>
                    <Tag color="orange">{personStats.victims} 人</Tag>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>证人:</span>
                    <Tag color="green">{personStats.witnesses} 人</Tag>
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', width: 80 }}>关系人:</span>
                    <Tag color="blue">{personStats.related} 人</Tag>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="阶段时间线" style={{ marginTop: 24 }}>
            <Timeline
              mode="left"
              items={[
                {
                  color: (caseData.status === '已结案' || currentStageIndex > 0) ? 'green' : currentStageIndex === 0 ? 'blue' : 'gray',
                  label: caseData.reportTime ? moment(caseData.reportTime).format('YYYY-MM-DD HH:mm') : '-',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>接报案</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        接到报案，案件进入侦查流程
                      </p>
                      {(caseData.status === '已结案' || currentStageIndex > 0) ? (
                        <Tag color="success">已完成</Tag>
                      ) : currentStageIndex === 0 ? (
                        <Tag color="processing">进行中</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
                {
                  color: (caseData.status === '已结案' || currentStageIndex > 1) ? 'green' : currentStageIndex === 1 ? 'blue' : 'gray',
                  label: caseData.createdAt ? moment(caseData.createdAt).format('YYYY-MM-DD HH:mm') : '-',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>立案登记</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        案件信息录入系统，分配主办民警
                      </p>
                      {(caseData.status === '已结案' || currentStageIndex > 1) ? (
                        <Tag color="success">已完成</Tag>
                      ) : currentStageIndex === 1 ? (
                        <Tag color="processing">进行中</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
                {
                  color: (caseData.status === '已结案' || currentStageIndex > 2) ? 'green' : currentStageIndex === 2 ? 'blue' : 'gray',
                  label: (caseData.status === '已结案' || currentStageIndex > 2) ? moment(caseData.updatedAt).format('YYYY-MM-DD HH:mm') : currentStageIndex === 2 ? '进行中' : '待开始',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>侦查取证</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        收集线索 {clueStats.total} 条，固定证据 {evidenceStats.total} 份，核查人员 {personStats.total} 人
                      </p>
                      {(caseData.status === '已结案' || currentStageIndex > 2) ? (
                        <Tag color="success">已完成</Tag>
                      ) : currentStageIndex === 2 ? (
                        <Tag color="processing">进行中</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
                {
                  color: (caseData.status === '已结案' || currentStageIndex > 3) ? 'green' : currentStageIndex === 3 ? 'blue' : 'gray',
                  label: (caseData.status === '已结案' || currentStageIndex > 3) ? '-' : currentStageIndex === 3 ? '进行中' : '待开始',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>破案攻坚</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        锁定主要嫌疑人，完善证据链
                      </p>
                      {(caseData.status === '已结案' || currentStageIndex > 3) ? (
                        <Tag color="success">已完成</Tag>
                      ) : currentStageIndex === 3 ? (
                        <Tag color="processing">进行中</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
                {
                  color: (caseData.status === '已结案' || currentStageIndex > 4) ? 'green' : currentStageIndex === 4 ? 'blue' : 'gray',
                  label: (caseData.status === '已结案' || currentStageIndex > 4) ? '-' : currentStageIndex === 4 ? '进行中' : '待开始',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>移送起诉</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        移交检察机关审查起诉
                      </p>
                      {(caseData.status === '已结案' || currentStageIndex > 4) ? (
                        <Tag color="success">已完成</Tag>
                      ) : currentStageIndex === 4 ? (
                        <Tag color="processing">进行中</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
                {
                  color: (caseData.status === '已结案' || currentStageIndex > 5) ? 'green' : currentStageIndex === 5 ? 'blue' : 'gray',
                  label: (caseData.status === '已结案' || currentStageIndex > 5) ? '-' : currentStageIndex === 5 ? '进行中' : '待开始',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>审理判决</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        法院审理并作出判决
                      </p>
                      {(caseData.status === '已结案' || currentStageIndex > 5) ? (
                        <Tag color="success">已完成</Tag>
                      ) : currentStageIndex === 5 ? (
                        <Tag color="processing">进行中</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
                {
                  color: caseData.status === '已结案' ? 'green' : 'gray',
                  label: caseData.status === '已结案' ? moment(caseData.updatedAt).format('YYYY-MM-DD HH:mm') : '待开始',
                  children: (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4 }}>结案归档</p>
                      <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                        案件办结，案卷整理归档
                      </p>
                      {caseData.status === '已结案' ? (
                        <Tag color="success">已完成</Tag>
                      ) : (
                        <Tag>待开始</Tag>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'relations',
      label: '人员关系图',
      icon: <ShareAltOutlined />,
      children: (
        <div className="graph-container">
          <ReactECharts option={graphOption} style={{ height: '600px' }} />
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/cases')}>返回</Button>
          <h2 className="page-title">{caseData.title}</h2>
          <Tag color={statusColors[caseData.status]}>{caseData.status}</Tag>
        </Space>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/cases/${id}/edit`)}>编辑</Button>
          <Popconfirm title="确定删除该案件？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
      </Card>

      <Modal
        title="添加涉案人员"
        open={personModal}
        onCancel={() => setPersonModal(false)}
        footer={null}
      >
        <Form form={personForm} layout="vertical" onFinish={handleAddPerson}>
          <Form.Item name="personId" label="选择人员" rules={[{ required: true }]}>
            <Select
              placeholder="请选择人员"
              showSearch
              optionFilterProp="label"
              options={allPersons.map(p => ({
                label: `${p.name} (${p.personType}) - ${p.idCard || p.phone}`,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="role" label="在本案中角色" rules={[{ required: true }]}>
            <Select
              placeholder="选择角色"
              options={['主犯', '从犯', '教唆犯', '胁从犯', '受害人', '目击证人', '报案人', '其他'].map(r => ({ label: r, value: r }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="补充说明" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认添加</Button>
              <Button onClick={() => setPersonModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
