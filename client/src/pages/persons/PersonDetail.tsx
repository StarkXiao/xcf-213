import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, message, Popconfirm, Timeline, Statistic, Row, Col, Checkbox, Empty, Spin } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, UserAddOutlined,
  SolutionOutlined, FileTextOutlined, BulbOutlined, SwapOutlined
} from '@ant-design/icons';
import moment from 'moment';
import ReactECharts from 'echarts-for-react';
import { personApi } from '../../services/api';

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const timelineEventColors: Record<string, string> = {
  case_association: '#1677ff',
  clue_association: '#52c41a',
  relation_added: '#722ed1',
  role_change: '#fa8c16',
};

const timelineEventIcons: Record<string, any> = {
  case_association: <FileTextOutlined />,
  clue_association: <BulbOutlined />,
  relation_added: <UserAddOutlined />,
  role_change: <SwapOutlined />,
};

const eventTypeLabels: Record<string, string> = {
  case_association: '案件关联',
  clue_association: '线索关联',
  relation_added: '关系新增',
  role_change: '角色变更',
};

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [personData, setPersonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relations, setRelations] = useState<any>({ nodes: [], edges: [] });
  const [timelineData, setTimelineData] = useState<any>({ events: [], stats: {} });
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [eventFilters, setEventFilters] = useState<string[]>(['case_association', 'clue_association', 'relation_added', 'role_change']);

  useEffect(() => {
    if (id) {
      loadPersonData();
      loadRelations();
      loadTimeline();
    }
  }, [id]);

  const loadPersonData = async () => {
    setLoading(true);
    try {
      const res = await personApi.get(id!);
      setPersonData(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRelations = async () => {
    try {
      const res = await personApi.getRelations(id!);
      setRelations(res.data);
    } catch (error) {
      console.error('Failed to load relations:', error);
    }
  };

  const loadTimeline = async () => {
    setTimelineLoading(true);
    try {
      const res = await personApi.getRelationTimeline(id!);
      setTimelineData(res.data);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleFilterChange = (checkedValues: string[]) => {
    setEventFilters(checkedValues);
  };

  const filteredEvents = timelineData.events?.filter((event: any) =>
    eventFilters.includes(event.type)
  ) || [];

  const handleDelete = async () => {
    try {
      await personApi.delete(id!);
      message.success('删除成功');
      navigate('/persons');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const graphOption = {
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `${params.data.name}<br/>类型: ${params.data.type}`;
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
        symbolSize: node.isCenter ? 60 : 40,
        itemStyle: {
          color: node.isCenter ? '#722ed1' :
            node.type === '受害人' ? '#faad14' :
            node.type === '嫌疑人' ? '#ff4d4f' :
            node.type === '证人' ? '#52c41a' : '#1677ff',
          borderWidth: node.isCenter ? 4 : 2,
          borderColor: node.isCenter ? '#fff' : '#ddd',
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
    }],
  };

  if (!personData) return null;

  const tabItems = [
    {
      key: 'overview',
      label: '基本信息',
      children: (
        <div>
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="姓名">{personData.name}</Descriptions.Item>
            <Descriptions.Item label="人员类型">
              <Tag color={personTypeColors[personData.personType]}>{personData.personType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="性别">{personData.gender || '-'}</Descriptions.Item>
            <Descriptions.Item label="年龄">{personData.age || '-'}</Descriptions.Item>
            <Descriptions.Item label="身份证号">
              {personData.idCard ? <span style={{ fontFamily: 'monospace' }}>{personData.idCard}</span> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">{personData.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="住址">{personData.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="职业">{personData.occupation || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{moment(personData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{moment(personData.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="人员描述" span={2}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{personData.description || '-'}</div>
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'cases',
      label: `关联案件 (${personData.casePersons?.length || 0})`,
      children: (
        <List
          dataSource={personData.casePersons}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => navigate(`/cases/${item.caseId}`)}>查看案件</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <a onClick={() => navigate(`/cases/${item.caseId}`)}>{item.case.title}</a>
                    <Tag color="blue">{item.role}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ color: '#666', fontFamily: 'monospace' }}>{item.case.caseNumber}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      关联时间: {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'clues',
      label: `关联线索 (${personData.cluePersons?.length || 0})`,
      children: (
        <List
          dataSource={personData.cluePersons}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => navigate(`/clues/${item.clueId}`)}>查看线索</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <a onClick={() => navigate(`/clues/${item.clueId}`)}>{item.clue.title}</a>
                    <Tag color="blue">{item.relation}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ color: '#666', fontFamily: 'monospace' }}>{item.clue.clueNumber}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      关联时间: {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'relations',
      label: '关系网络',
      children: (
        <div className="graph-container">
          <ReactECharts option={graphOption} style={{ height: '600px' }} />
        </div>
      ),
    },
    {
      key: 'timeline',
      label: '关系演化',
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="案件关联"
                  value={timelineData.stats?.caseAssociations || 0}
                  valueStyle={{ color: timelineEventColors.case_association }}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="线索关联"
                  value={timelineData.stats?.clueAssociations || 0}
                  valueStyle={{ color: timelineEventColors.clue_association }}
                  prefix={<BulbOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="关系新增"
                  value={timelineData.stats?.relations || 0}
                  valueStyle={{ color: timelineEventColors.relation_added }}
                  prefix={<UserAddOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="角色变更"
                  value={timelineData.stats?.roleChanges || 0}
                  valueStyle={{ color: timelineEventColors.role_change }}
                  prefix={<SwapOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <span style={{ color: '#666' }}>筛选：</span>
              <Checkbox.Group
                options={[
                  { label: '案件关联', value: 'case_association' },
                  { label: '线索关联', value: 'clue_association' },
                  { label: '关系新增', value: 'relation_added' },
                  { label: '角色变更', value: 'role_change' },
                ]}
                value={eventFilters}
                onChange={handleFilterChange}
              />
            </Space>
          </Card>

          <Spin spinning={timelineLoading} tip="加载中...">
            {filteredEvents.length === 0 ? (
              <Empty description="暂无关系演化记录" />
            ) : (
              <Timeline
                mode="left"
                items={filteredEvents.map((event: any) => ({
                  color: timelineEventColors[event.type],
                  dot: timelineEventIcons[event.type],
                  label: (
                    <div style={{ minWidth: 180, color: '#666' }}>
                      <div>{moment(event.timestamp).format('YYYY-MM-DD')}</div>
                      <div style={{ fontSize: 12 }}>{moment(event.timestamp).format('HH:mm:ss')}</div>
                    </div>
                  ),
                  children: (
                    <Card size="small" style={{ marginBottom: 8 }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Space>
                          <Tag color={timelineEventColors[event.type]}>{event.eventType}</Tag>
                          <strong>{event.title}</strong>
                        </Space>
                        <div style={{ color: '#333' }}>{event.description}</div>

                        {event.case && (
                          <div style={{ fontSize: 13, color: '#666' }}>
                            案件：
                            <a
                              onClick={() => navigate(`/cases/${event.case.id}`)}
                              style={{ marginLeft: 4 }}
                            >
                              {event.case.title}
                            </a>
                            <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>
                              {event.case.caseNumber}
                            </span>
                          </div>
                        )}

                        {event.clue && (
                          <div style={{ fontSize: 13, color: '#666' }}>
                            线索：
                            <a
                              onClick={() => navigate(`/clues/${event.clue.id}`)}
                              style={{ marginLeft: 4 }}
                            >
                              {event.clue.title}
                            </a>
                            <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>
                              {event.clue.clueNumber}
                            </span>
                          </div>
                        )}

                        {event.relatedPerson && (
                          <div style={{ fontSize: 13, color: '#666' }}>
                            关联人员：
                            <a
                              onClick={() => navigate(`/persons/${event.relatedPerson.id}`)}
                              style={{ marginLeft: 4 }}
                            >
                              {event.relatedPerson.name}
                            </a>
                            <Tag
                              color={personTypeColors[event.relatedPerson.personType]}
                              style={{ marginLeft: 8 }}
                            >
                              {event.relatedPerson.personType}
                            </Tag>
                          </div>
                        )}

                        {event.role && (
                          <div style={{ fontSize: 13, color: '#666' }}>
                            角色：<Tag color="blue">{event.role}</Tag>
                          </div>
                        )}

                        {event.oldRole && event.newRole && (
                          <Space style={{ fontSize: 13 }}>
                            <Tag color="default">{event.oldRole}</Tag>
                            <span style={{ color: '#999' }}>→</span>
                            <Tag color="orange">{event.newRole}</Tag>
                          </Space>
                        )}

                        {event.descriptionDetail && (
                          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                            备注：{event.descriptionDetail}
                          </div>
                        )}

                        {event.note && (
                          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                            备注：{event.note}
                          </div>
                        )}
                      </Space>
                    </Card>
                  ),
                }))}
              />
            )}
          </Spin>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/persons')}>返回</Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: personTypeColors[personData.personType] === 'red' ? '#ff4d4f'
                : personTypeColors[personData.personType] === 'orange' ? '#faad14'
                : personTypeColors[personData.personType] === 'green' ? '#52c41a'
                : '#1677ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
            }}>{personData.name[0]}</div>
            <h2 className="page-title" style={{ margin: 0 }}>{personData.name}</h2>
            <Tag color={personTypeColors[personData.personType]}>{personData.personType}</Tag>
          </div>
        </Space>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/persons/${id}/edit`)}>编辑</Button>
          <Popconfirm title="确定删除该人员？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
