import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, Modal, Form, Select, Input, message, Popconfirm, Row, Col, Progress, Steps, Timeline, Statistic, Divider, Table, Alert, Avatar } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UserOutlined, SearchOutlined, PaperClipOutlined, ShareAltOutlined, ClockCircleOutlined, CheckCircleOutlined, WarningOutlined, FileSearchOutlined, TeamOutlined, FileTextOutlined, FundProjectionScreenOutlined, BulbOutlined, LinkOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
  const [searchParams] = useSearchParams();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personModal, setPersonModal] = useState(false);
  const [personForm] = Form.useForm();
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [relations, setRelations] = useState<any>({ nodes: [], edges: [] });
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [thematicData, setThematicData] = useState<any>(null);
  const [thematicLoading, setThematicLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadCaseData();
      loadAllPersons();
      loadRelations();
      if (searchParams.get('tab') === 'thematic') {
        loadThematicView();
      }
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

  const loadThematicView = async () => {
    setThematicLoading(true);
    try {
      const res = await caseApi.getThematicView(id!);
      setThematicData(res.data);
    } catch (error) {
      console.error('Failed to load thematic view:', error);
    } finally {
      setThematicLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'thematic' && !thematicData) {
      loadThematicView();
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
      key: 'summary',
      label: (
        <Space>
          <BulbOutlined style={{ color: '#faad14' }} />
          结构化摘要
        </Space>
      ),
      children: (
        <div>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#1677ff' }} />
                    <span>案情研判要点</span>
                  </Space>
                }
                size="small"
                style={{ minHeight: 200 }}
              >
                {caseData.caseAnalysis ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333' }}>
                    {caseData.caseAnalysis}
                  </div>
                ) : (
                  <div style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}>
                    <InfoCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                    <div>暂无案情研判内容</div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/cases/${id}/edit`)}
                      style={{ marginTop: 8 }}
                    >
                      前往编辑
                    </Button>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <TeamOutlined style={{ color: '#52c41a' }} />
                    <span>涉案人研判要点</span>
                  </Space>
                }
                size="small"
                style={{ minHeight: 200 }}
              >
                {caseData.personAnalysis ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333' }}>
                    {caseData.personAnalysis}
                  </div>
                ) : (
                  <div style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}>
                    <InfoCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                    <div>暂无涉案人研判内容</div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/cases/${id}/edit`)}
                      style={{ marginTop: 8 }}
                    >
                      前往编辑
                    </Button>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <PaperClipOutlined style={{ color: '#722ed1' }} />
                    <span>关键证据研判要点</span>
                  </Space>
                }
                size="small"
                style={{ minHeight: 200 }}
              >
                {caseData.evidenceAnalysis ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333' }}>
                    {caseData.evidenceAnalysis}
                  </div>
                ) : (
                  <div style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}>
                    <InfoCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                    <div>暂无关键证据研判内容</div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/cases/${id}/edit`)}
                      style={{ marginTop: 8 }}
                    >
                      前往编辑
                    </Button>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <BulbOutlined style={{ color: '#fa8c16' }} />
                    <span>研判结论</span>
                  </Space>
                }
                size="small"
                style={{ minHeight: 200 }}
              >
                {caseData.conclusion ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333' }}>
                    {caseData.conclusion}
                  </div>
                ) : (
                  <div style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}>
                    <InfoCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                    <div>暂无研判结论</div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/cases/${id}/edit`)}
                      style={{ marginTop: 8 }}
                    >
                      前往编辑
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {(caseData.caseAnalysis || caseData.personAnalysis || caseData.evidenceAnalysis || caseData.conclusion) && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/cases/${id}/edit`)}
              >
                编辑结构化摘要
              </Button>
            </div>
          )}
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
    {
      key: 'thematic',
      label: caseData.caseType === '专案' ? (
        <Space><FundProjectionScreenOutlined /> 专题视图</Space>
      ) : (
        <Space><FundProjectionScreenOutlined /> 关联汇总</Space>
      ),
      children: (
        <div>
          {!thematicData && !thematicLoading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Button type="primary" icon={<FundProjectionScreenOutlined />} onClick={loadThematicView} loading={thematicLoading}>
                加载专题视图
              </Button>
            </div>
          )}
          {thematicLoading && (
            <Card loading style={{ minHeight: 200 }} />
          )}
          {thematicData && !thematicLoading && (
            <>
              <Alert
                type="info"
                showIcon
                icon={<FundProjectionScreenOutlined />}
                message={`本专案聚合了 ${thematicData.aggregated.cases.length} 个关联案件的全部数据，共 ${thematicData.aggregated.totalPersons} 人、${thematicData.aggregated.totalClues} 条线索、${thematicData.aggregated.totalEvidences} 份证据`}
                style={{ marginBottom: 16 }}
              />

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
                    <Statistic
                      title="关联案件"
                      value={thematicData.aggregated.cases.length}
                      suffix="个"
                      prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
                      valueStyle={{ color: '#1677ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
                    <Statistic
                      title="涉案人员"
                      value={thematicData.aggregated.totalPersons}
                      suffix="人"
                      prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
                    <Statistic
                      title="关联线索"
                      value={thematicData.aggregated.totalClues}
                      suffix="条"
                      prefix={<BulbOutlined style={{ color: '#fa8c16' }} />}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
                    <Statistic
                      title="关联证据"
                      value={thematicData.aggregated.totalEvidences}
                      suffix="份"
                      prefix={<PaperClipOutlined style={{ color: '#722ed1' }} />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
              </Row>

              {thematicData.aggregated.cases.length > 0 && (
                <Card
                  title={<Space><LinkOutlined /> 关联案件</Space>}
                  size="small"
                  style={{ marginBottom: 16 }}
                >
                  <Table
                    dataSource={thematicData.aggregated.cases}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '案件编号',
                        dataIndex: 'caseNumber',
                        width: 140,
                        render: (text: string, record: any) => (
                          <a onClick={() => navigate(`/cases/${record.id}`)}>
                            <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{text}</span>
                          </a>
                        ),
                      },
                      { title: '案件标题', dataIndex: 'title', width: 200 },
                      {
                        title: '类型',
                        dataIndex: 'caseType',
                        width: 100,
                        render: (text) => <Tag color="blue">{text}</Tag>,
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 90,
                        render: (text) => <Tag color={statusColors[text]}>{text}</Tag>,
                      },
                      {
                        title: '主办人',
                        dataIndex: 'caseManager',
                        width: 80,
                      },
                      {
                        title: '线索',
                        dataIndex: 'clueCount',
                        width: 70,
                        render: (text) => <Tag color="orange">{text} 条</Tag>,
                      },
                      {
                        title: '证据',
                        dataIndex: 'evidenceCount',
                        width: 70,
                        render: (text) => <Tag color="purple">{text} 份</Tag>,
                      },
                      {
                        title: '人员',
                        dataIndex: 'personCount',
                        width: 70,
                        render: (text) => <Tag color="green">{text} 人</Tag>,
                      },
                    ]}
                  />
                </Card>
              )}

              <Card
                title={<Space><TeamOutlined style={{ color: '#52c41a' }} /> 涉案人员汇总 ({thematicData.aggregated.totalPersons})</Space>}
                size="small"
                style={{ marginBottom: 16 }}
              >
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
                  dataSource={thematicData.aggregated.casePersons}
                  renderItem={(item: any) => (
                    <List.Item>
                      <Card size="small" hoverable onClick={() => navigate(`/persons/${item.personId}`)} style={{ cursor: 'pointer' }}>
                        <Card.Meta
                          avatar={
                            <Avatar style={{
                              backgroundColor:
                                item.person?.personType === '嫌疑人' ? '#ff4d4f'
                                : item.person?.personType === '受害人' ? '#faad14'
                                : item.person?.personType === '证人' ? '#52c41a'
                                : '#1677ff',
                            }}>
                              {item.person?.name?.charAt(0)}
                            </Avatar>
                          }
                          title={
                            <Space size={4}>
                              <span style={{ fontSize: 13 }}>{item.person?.name}</span>
                              <Tag color={personTypeColors[item.person?.personType]} style={{ fontSize: 11 }}>{item.person?.personType}</Tag>
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: 12 }}>
                              <div><Tag color="blue" style={{ fontSize: 11 }}>{item.role}</Tag></div>
                              {item._sourceCase && (
                                <div style={{ marginTop: 4, color: '#999' }}>
                                  来自: <a onClick={(e) => { e.stopPropagation(); navigate(`/cases/${item._sourceCase.id}`); }}>{item._sourceCase.caseNumber}</a>
                                </div>
                              )}
                              <div style={{ marginTop: 4, color: '#666' }}>{item.person?.phone || '-'} | {item.person?.idCard || '-'}</div>
                            </div>
                          }
                        />
                      </Card>
                    </List.Item>
                  )}
                />
              </Card>

              <Card
                title={<Space><BulbOutlined style={{ color: '#fa8c16' }} /> 线索汇总 ({thematicData.aggregated.totalClues})</Space>}
                size="small"
                style={{ marginBottom: 16 }}
              >
                <List
                  dataSource={thematicData.aggregated.clues}
                  renderItem={(item: any) => (
                    <List.Item
                      actions={[
                        <Button type="link" size="small" onClick={() => navigate(`/clues/${item.id}`)}>详情</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={4}>
                            <a onClick={() => navigate(`/clues/${item.id}`)}>{item.title}</a>
                            <Tag color={statusColors[item.status]}>{item.status}</Tag>
                            {item.credibility && <Tag color={credibilityColors[item.credibility]}>可信度: {item.credibility}</Tag>}
                            {item._sourceCase && (
                              <Tag color="geekblue" icon={<LinkOutlined />}>
                                来自: <a onClick={(e) => { e.stopPropagation(); navigate(`/cases/${item._sourceCase.id}`); }} style={{ color: 'inherit' }}>{item._sourceCase.caseNumber}</a>
                              </Tag>
                            )}
                          </Space>
                        }
                        description={
                          <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>{item.content}</div>
                            <div style={{ fontSize: 12, color: '#999' }}>
                              来源: {item.source} | {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>

              <Card
                title={<Space><PaperClipOutlined style={{ color: '#722ed1' }} /> 证据汇总 ({thematicData.aggregated.totalEvidences})</Space>}
                size="small"
              >
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, xl: 4 }}
                  dataSource={thematicData.aggregated.evidences}
                  renderItem={(item: any) => (
                    <List.Item>
                      <Card size="small" hoverable onClick={() => navigate(`/evidences/${item.id}`)} style={{ cursor: 'pointer' }}>
                        <Card.Meta
                          title={
                            <Space size={4}>
                              <span style={{ fontSize: 13 }}>{item.name}</span>
                              <Tag color={evidenceTypeColors[item.type]} style={{ fontSize: 11 }}>{item.type}</Tag>
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: 12 }}>
                              <div style={{ marginBottom: 4, fontFamily: 'monospace', color: '#722ed1' }}>{item.evidenceNumber}</div>
                              {item._sourceCase && (
                                <div style={{ marginBottom: 4, color: '#999' }}>
                                  来自: <a onClick={(e) => { e.stopPropagation(); navigate(`/cases/${item._sourceCase.id}`); }}>{item._sourceCase.caseNumber}</a>
                                </div>
                              )}
                              <Tag color={statusColors[item.status]} style={{ fontSize: 11 }}>{item.status}</Tag>
                            </div>
                          }
                        />
                      </Card>
                    </List.Item>
                  )}
                />
              </Card>
            </>
          )}
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
        <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
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
