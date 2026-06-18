import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, message, Popconfirm, Timeline, Statistic, Row, Col, Checkbox, Empty, Spin, Modal, Select, Input, Form as AntForm } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, UserAddOutlined,
  SolutionOutlined, FileTextOutlined, BulbOutlined, SwapOutlined,
  TagsOutlined, PlusOutlined, LinkOutlined
} from '@ant-design/icons';
import moment from 'moment';
import ReactECharts from 'echarts-for-react';
import { personApi, searchApi } from '../../services/api';

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const categoryColors: Record<string, string> = {
  '案件类型': '#1677ff',
  '线索来源': '#52c41a',
  '关系角色': '#722ed1',
  '自定义': '#fa8c16',
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
  const [suggestedTags, setSuggestedTags] = useState<any[]>([]);
  const [existingTags, setExistingTags] = useState<any[]>([]);
  const [tagManageModalOpen, setTagManageModalOpen] = useState(false);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagCreateModalOpen, setTagCreateModalOpen] = useState(false);
  const [tagForm] = AntForm.useForm();
  const [tagCreating, setTagCreating] = useState(false);

  useEffect(() => {
    if (id) {
      loadPersonData();
      loadRelations();
      loadTimeline();
      loadSuggestedTags();
    }
  }, [id]);

  const loadPersonData = async () => {
    setLoading(true);
    try {
      const res = await personApi.get(id!);
      setPersonData(res.data);
      setExistingTags(res.data.tags || []);
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

  const loadSuggestedTags = async () => {
    try {
      const res = await personApi.suggestTags(id!);
      setSuggestedTags(res.data.suggested || []);
    } catch (error) {
      console.error('Failed to load suggested tags:', error);
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

  const handleOpenTagManage = async () => {
    try {
      const [tagsRes, optionsRes] = await Promise.all([
        personApi.listTags(),
        searchApi.options(),
      ]);
      setAllTags(optionsRes.data.tags || []);
      setSelectedTagIds(existingTags.map((t: any) => t.id));
      setTagManageModalOpen(true);
    } catch (error) {
      message.error('加载标签数据失败');
    }
  };

  const handleSaveTags = async () => {
    setTagSaving(true);
    try {
      await personApi.update(id!, { tagIds: selectedTagIds });
      message.success('标签更新成功');
      setTagManageModalOpen(false);
      loadPersonData();
      loadSuggestedTags();
    } catch (error) {
      message.error('标签更新失败');
    } finally {
      setTagSaving(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: any) => {
    try {
      let tagId: string;
      const existingTag = allTags.find((t: any) => t.name === suggestion.name && t.category === suggestion.category);
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const createRes = await personApi.createTag({
          name: suggestion.name,
          category: suggestion.category,
          color: categoryColors[suggestion.category],
        });
        tagId = createRes.data.id;
      }
      const currentTagIds = existingTags.map((t: any) => t.id);
      if (!currentTagIds.includes(tagId)) {
        await personApi.update(id!, { tagIds: [...currentTagIds, tagId] });
        message.success(`已添加标签「${suggestion.name}」`);
        loadPersonData();
        loadSuggestedTags();
      }
    } catch (error) {
      message.error('添加标签失败');
    }
  };

  const handleAcceptAllSuggestions = async () => {
    try {
      const newTagIds: string[] = [...existingTags.map((t: any) => t.id)];
      for (const suggestion of suggestedTags) {
        let tagId: string;
        const existingTag = allTags.find((t: any) => t.name === suggestion.name && t.category === suggestion.category);
        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const createRes = await personApi.createTag({
            name: suggestion.name,
            category: suggestion.category,
            color: categoryColors[suggestion.category],
          });
          tagId = createRes.data.id;
        }
        if (!newTagIds.includes(tagId)) {
          newTagIds.push(tagId);
        }
      }
      await personApi.update(id!, { tagIds: newTagIds });
      message.success(`已批量添加 ${suggestedTags.length} 个标签`);
      loadPersonData();
      loadSuggestedTags();
    } catch (error) {
      message.error('批量添加标签失败');
    }
  };

  const handleCreateTag = async (values: any) => {
    setTagCreating(true);
    try {
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || undefined;
      const res = await personApi.createTag({ ...values, color });
      message.success('标签创建成功');
      setSelectedTagIds(prev => [...prev, res.data.id]);
      setTagCreateModalOpen(false);
      tagForm.resetFields();
      const tagsRes = await personApi.listTags();
      setAllTags(tagsRes.data || []);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || '创建标签失败';
      message.error(errorMsg);
    } finally {
      setTagCreating(false);
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

  const groupedTags = existingTags.reduce((acc: Record<string, any[]>, t: any) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const tagSelectOptions = allTags.map((t: any) => ({
    label: (
      <Space>
        <Tag color={t.color || categoryColors[t.category] || 'default'} style={{ margin: 0 }}>
          {t.name}
        </Tag>
        <span style={{ fontSize: 12, color: '#999' }}>{t.category}</span>
      </Space>
    ),
    value: t.id,
  }));

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
            <Descriptions.Item label="标签" span={2}>
              {existingTags.length === 0 ? (
                <span style={{ color: '#ccc' }}>暂无标签</span>
              ) : (
                <Space size={[4, 8]} wrap>
                  {existingTags.map((t: any) => (
                    <Tag key={t.id} color={t.color || categoryColors[t.category] || 'default'}>
                      {t.name}
                    </Tag>
                  ))}
                </Space>
              )}
            </Descriptions.Item>
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
      key: 'tags',
      label: (
        <Space>
          <TagsOutlined />
          标签体系
        </Space>
      ),
      children: (
        <div>
          <Card title="当前标签" size="small" style={{ marginBottom: 16 }}
            extra={
              <Button type="link" icon={<EditOutlined />} onClick={handleOpenTagManage}>
                管理标签
              </Button>
            }
          >
            {Object.keys(groupedTags).length === 0 ? (
              <Empty description="暂无标签" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              Object.entries(groupedTags).map(([category, tags]: [string, any]) => (
                <div key={category} style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 6, color: categoryColors[category] || '#666', fontWeight: 500 }}>
                    {category}
                  </div>
                  <Space size={[4, 8]} wrap>
                    {tags.map((t: any) => (
                      <Tag key={t.id} color={t.color || categoryColors[t.category] || 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                        {t.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              ))
            )}
          </Card>

          {suggestedTags.length > 0 && (
            <Card
              title={
                <Space>
                  <LinkOutlined />
                  联动推荐标签
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
              extra={
                <Button type="link" size="small" onClick={handleAcceptAllSuggestions}>
                  全部采纳
                </Button>
              }
            >
              <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
                基于该人员关联的案件类型、线索来源和关系角色，系统自动推荐以下标签：
              </div>
              <Space size={[8, 12]} wrap>
                {suggestedTags.map((s: any, idx: number) => (
                  <Tag
                    key={idx}
                    style={{
                      cursor: 'pointer',
                      padding: '4px 12px',
                      borderStyle: 'dashed',
                      borderColor: categoryColors[s.category] || '#999',
                    }}
                    onClick={() => handleAcceptSuggestion(s)}
                  >
                    <PlusOutlined style={{ marginRight: 4 }} />
                    {s.name}
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>
                      {s.category} · {s.source}
                    </span>
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {existingTags.length > 0 && (
            <Card title="标签关联分析" size="small">
              <Row gutter={16}>
                {Object.entries(groupedTags).map(([category, tags]: [string, any]) => (
                  <Col span={6} key={category}>
                    <Statistic
                      title={category}
                      value={tags.length}
                      valueStyle={{ color: categoryColors[category] || '#666' }}
                      suffix="个标签"
                    />
                    <div style={{ marginTop: 8 }}>
                      {tags.map((t: any) => (
                        <Tag key={t.id} color={t.color || categoryColors[t.category] || 'default'} style={{ marginBottom: 4 }}>
                          {t.name}
                        </Tag>
                      ))}
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          )}
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
                    {item.case.caseType && (
                      <Tag color={categoryColors['案件类型']} style={{ fontSize: 11 }}>
                        {item.case.caseType}
                      </Tag>
                    )}
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
                    {item.clue.source && (
                      <Tag color={categoryColors['线索来源']} style={{ fontSize: 11 }}>
                        {item.clue.source}
                      </Tag>
                    )}
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
            {existingTags.slice(0, 3).map((t: any) => (
              <Tag key={t.id} color={t.color || categoryColors[t.category] || 'default'}>{t.name}</Tag>
            ))}
            {existingTags.length > 3 && <Tag>+{existingTags.length - 3}</Tag>}
          </div>
        </Space>
        <Space>
          <Button icon={<TagsOutlined />} onClick={handleOpenTagManage}>管理标签</Button>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/persons/${id}/edit`)}>编辑</Button>
          <Popconfirm title="确定删除该人员？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="管理标签"
        open={tagManageModalOpen}
        onCancel={() => setTagManageModalOpen(false)}
        onOk={handleSaveTags}
        confirmLoading={tagSaving}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Select
            mode="multiple"
            placeholder="选择标签"
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            options={tagSelectOptions}
            optionFilterProp="label"
            style={{ width: '100%' }}
            dropdownRender={(menu) => (
              <>
                {menu}
                <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => setTagCreateModalOpen(true)}
                    style={{ padding: 0 }}
                  >
                    新建标签
                  </Button>
                </div>
              </>
            )}
            tagRender={(props) => {
              const { value, closable, onClose } = props;
              const tag = allTags.find((t: any) => t.id === value);
              if (!tag) return <span />;
              return (
                <Tag
                  color={tag.color || categoryColors[tag.category] || 'default'}
                  closable={closable}
                  onClose={onClose}
                  style={{ marginRight: 3 }}
                >
                  {tag.name}
                </Tag>
              );
            }}
          />
        </div>

        {suggestedTags.length > 0 && (
          <div>
            <div style={{ marginBottom: 8, color: '#666', fontWeight: 500 }}>
              <LinkOutlined style={{ marginRight: 4 }} />
              联动推荐（点击采纳）
            </div>
            <Space size={[8, 8]} wrap>
              {suggestedTags.map((s: any, idx: number) => (
                <Tag
                  key={idx}
                  style={{
                    cursor: 'pointer',
                    borderStyle: 'dashed',
                    borderColor: categoryColors[s.category] || '#999',
                  }}
                  onClick={() => {
                    const existingTag = allTags.find((t: any) => t.name === s.name && t.category === s.category);
                    if (existingTag && !selectedTagIds.includes(existingTag.id)) {
                      setSelectedTagIds(prev => [...prev, existingTag.id]);
                    }
                  }}
                >
                  <PlusOutlined style={{ marginRight: 4 }} />
                  {s.name}
                  <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
                    {s.category}
                  </span>
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Modal>

      <Modal
        title="新建标签"
        open={tagCreateModalOpen}
        onCancel={() => { setTagCreateModalOpen(false); tagForm.resetFields(); }}
        onOk={() => tagForm.submit()}
        confirmLoading={tagCreating}
      >
        <AntForm form={tagForm} layout="vertical" onFinish={handleCreateTag}>
          <AntForm.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" maxLength={50} />
          </AntForm.Item>
          <AntForm.Item
            name="category"
            label="标签分类"
            rules={[{ required: true, message: '请选择标签分类' }]}
            initialValue="自定义"
          >
            <Select
              placeholder="请选择标签分类"
              options={['案件类型', '线索来源', '关系角色', '自定义'].map(c => ({
                label: (
                  <Space>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: categoryColors[c] || '#999' }} />
                    {c}
                  </Space>
                ),
                value: c,
              }))}
            />
          </AntForm.Item>
        </AntForm>
      </Modal>
    </div>
  );
}
