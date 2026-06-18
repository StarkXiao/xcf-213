import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Space, Select, Button, Input, List, Tag, Drawer, message, Form, Spin, Divider } from 'antd';
import { ReloadOutlined, SearchOutlined, PlusOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsInstance } from 'echarts-for-react';
import { personApi, searchApi, caseApi, relationApi } from '../../services/api';

const typeColors: Record<string, string> = {
  '嫌疑人': '#ff4d4f',
  '受害人': '#faad14',
  '证人': '#52c41a',
  '关系人': '#1677ff',
  '其他': '#722ed1',
};

const roleColors: Record<string, string> = {
  '主犯': '#cf1322',
  '从犯': '#fa541c',
  '教唆犯': '#d4380d',
  '胁从犯': '#fa8c16',
  '受害人': '#faad14',
  '目击证人': '#52c41a',
  '报案人': '#1677ff',
  '其他': '#722ed1',
};

export default function RelationGraph() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<any>({ nodes: [], edges: [] });
  const [persons, setPersons] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [relationForm] = Form.useForm();
  const echartsRef = useRef<EChartsInstance | null>(null);
  const [options, setOptions] = useState<any>({});

  const [selectedCase, setSelectedCase] = useState<string | undefined>(undefined);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([]);
  const [selectedPersonRoles, setSelectedPersonRoles] = useState<string[]>([]);
  const [selectedPersonTypes, setSelectedPersonTypes] = useState<string[]>([]);

  useEffect(() => {
    loadOptions();
    loadPersons();
    loadCases();
  }, []);

  useEffect(() => {
    loadFilteredGraph();
  }, [selectedCase, selectedRelationTypes, selectedPersonRoles, selectedPersonTypes]);

  const loadOptions = async () => {
    try {
      const res = await searchApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadPersons = async () => {
    try {
      const res = await personApi.list({ pageSize: 1000 });
      setPersons(res.data.items);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const loadCases = async () => {
    try {
      const res = await caseApi.list({ pageSize: 1000 });
      setCases(res.data.items);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const loadFilteredGraph = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedCase) params.caseId = selectedCase;
      if (selectedRelationTypes.length > 0) params.relationTypes = selectedRelationTypes.join(',');
      if (selectedPersonRoles.length > 0) params.personRoles = selectedPersonRoles.join(',');
      if (selectedPersonTypes.length > 0) params.personTypes = selectedPersonTypes.join(',');

      const res = await relationApi.graph(params);
      setGraphData(res.data);
      setSelectedPerson(null);
    } catch (error) {
      message.error('加载关系图失败');
    } finally {
      setLoading(false);
    }
  }, [selectedCase, selectedRelationTypes, selectedPersonRoles, selectedPersonTypes]);

  const resetFilters = () => {
    setSelectedCase(undefined);
    setSelectedRelationTypes([]);
    setSelectedPersonRoles([]);
    setSelectedPersonTypes([]);
  };

  const loadPersonRelations = async (personId: string) => {
    setLoading(true);
    try {
      const res = await personApi.getRelations(personId);
      setGraphData(res.data);
    } catch (error) {
      message.error('加载人员关系失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    if (values.personId) {
      const person = persons.find(p => p.id === values.personId);
      setSelectedPerson(person);
      loadPersonRelations(values.personId);
    }
  };

  const handleGraphClick = (params: any) => {
    if (params.dataType === 'node') {
      const person = persons.find(p => p.id === params.data.id);
      if (person) {
        setSelectedPerson(person);
        loadPersonRelations(person.id);
      }
    }
  };

  const handleAddRelation = async (values: any) => {
    try {
      await personApi.addRelation(selectedPerson.id, {
        targetPersonId: values.targetPersonId,
        relation: values.relation,
        description: values.description,
      });
      message.success('添加关系成功');
      setDrawerVisible(false);
      relationForm.resetFields();
      loadPersonRelations(selectedPerson.id);
    } catch (error) {
      message.error('添加关系失败');
    }
  };

  const hasActiveFilters = !!selectedCase || selectedRelationTypes.length > 0 || selectedPersonRoles.length > 0 || selectedPersonTypes.length > 0;

  const graphOption = {
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const casesInfo = params.data.cases?.length > 0
            ? `<br/>参与案件: ${params.data.cases.map((c: any) => c.caseTitle).join('、')}`
            : '';
          return `${params.data.name}<br/>类型: ${params.data.type}<br/>角色: ${params.data.role || '相关人员'}${casesInfo}`;
        }
        return `${params.data.relation}<br/>${params.data.description || ''}`;
      },
    },
    legend: {
      data: ['嫌疑人', '受害人', '证人', '关系人', '其他'],
      orient: 'vertical',
      left: 10,
      top: 10,
      textStyle: { color: '#333' },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      label: {
        show: true,
        position: 'bottom',
        formatter: (params: any) => {
          const roleLabel = params.data.role && params.data.role !== '相关人员'
            ? `\n[${params.data.role}]`
            : '';
          return `{b|${params.data.name}}${roleLabel ? '{r|' + roleLabel + '}' : ''}`;
        },
        fontSize: 12,
        fontWeight: 'bold',
        lineHeight: 18,
        rich: {
          b: { fontSize: 12, fontWeight: 'bold', color: '#333' },
          r: { fontSize: 10, color: '#666', padding: [0, 4] },
        },
      },
      edgeLabel: {
        show: true,
        formatter: '{c}',
        fontSize: 11,
        color: '#666',
      },
      force: {
        repulsion: 600,
        edgeLength: 150,
        gravity: 0.1,
        edgeForce: 0.2,
      },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 4 },
      },
      data: graphData.nodes.map((node: any) => {
        const roleColor = node.role && roleColors[node.role] ? roleColors[node.role] : undefined;
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          role: node.role,
          cases: node.cases,
          category: node.type,
          symbolSize: node.isCenter ? 70 : 45,
          itemStyle: {
            color: typeColors[node.type] || '#722ed1',
            borderWidth: node.isCenter ? 4 : (roleColor ? 3 : 2),
            borderColor: roleColor || '#fff',
            shadowBlur: node.isCenter ? 20 : 10,
            shadowColor: typeColors[node.type] || '#722ed1',
          },
        };
      }),
      links: graphData.edges.map((edge: any) => ({
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        relation: edge.relation,
        description: edge.description,
        lineStyle: { width: 2.5, color: '#999', curveness: 0.1 },
      })),
      categories: [
        { name: '嫌疑人', itemStyle: { color: typeColors['嫌疑人'] } },
        { name: '受害人', itemStyle: { color: typeColors['受害人'] } },
        { name: '证人', itemStyle: { color: typeColors['证人'] } },
        { name: '关系人', itemStyle: { color: typeColors['关系人'] } },
        { name: '其他', itemStyle: { color: typeColors['其他'] } },
      ],
    }],
  };

  const availablePersons = persons.filter(p => p.id !== selectedPerson?.id);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">人员关系图</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置筛选</Button>
        </Space>
      </div>

      <Card
        className="card-shadow"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <FilterOutlined />
            <span>视角筛选</span>
            {hasActiveFilters && <Tag color="blue">已启用筛选</Tag>}
          </Space>
        }
      >
        <Space style={{ width: '100%', flexWrap: 'wrap' }} size="middle">
          <div>
            <span style={{ color: '#666', marginRight: 8, fontSize: 13 }}>案件：</span>
            <Select
              allowClear
              showSearch
              placeholder="选择案件视角"
              optionFilterProp="children"
              value={selectedCase}
              onChange={(v) => setSelectedCase(v)}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={cases.map((c: any) => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
              style={{ width: 320 }}
            />
          </div>

          <div>
            <span style={{ color: '#666', marginRight: 8, fontSize: 13 }}>关系类型：</span>
            <Select
              mode="multiple"
              allowClear
              placeholder="选择关系类型"
              value={selectedRelationTypes}
              onChange={(v) => setSelectedRelationTypes(v)}
              options={options.relationTypes?.map((t: string) => ({ label: t, value: t }))}
              style={{ width: 280 }}
              maxTagCount={3}
            />
          </div>

          <div>
            <span style={{ color: '#666', marginRight: 8, fontSize: 13 }}>人员角色：</span>
            <Select
              mode="multiple"
              allowClear
              placeholder="选择人员角色（案件视角）"
              value={selectedPersonRoles}
              onChange={(v) => setSelectedPersonRoles(v)}
              options={options.personRoles?.map((t: string) => ({ label: t, value: t }))}
              style={{ width: 280 }}
              maxTagCount={3}
            />
          </div>

          <div>
            <span style={{ color: '#666', marginRight: 8, fontSize: 13 }}>人员类型：</span>
            <Select
              mode="multiple"
              allowClear
              placeholder="选择人员类型"
              value={selectedPersonTypes}
              onChange={(v) => setSelectedPersonTypes(v)}
              options={options.personTypes?.map((t: string) => ({ label: t, value: t }))}
              style={{ width: 220 }}
              maxTagCount={3}
            />
          </div>

          <Button
            icon={<ClearOutlined />}
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            清除筛选
          </Button>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Space style={{ width: '100%', flexWrap: 'wrap' }}>
            <Form.Item name="personId" label="查询人员" style={{ minWidth: 300 }}>
              <Select
                showSearch
                placeholder="输入姓名搜索..."
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                options={persons.map(p => ({
                  label: `${p.name} (${p.personType})`,
                  value: p.id,
                }))}
                style={{ width: 300 }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">查询关系</Button>
            </Form.Item>
          </Space>
        </Form>
      </Card>

      {hasActiveFilters && (
        <Card className="card-shadow" style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <span style={{ color: '#666' }}>当前筛选：</span>
            {selectedCase && (
              <Tag closable onClose={() => setSelectedCase(undefined)} color="blue">
                案件: {cases.find((c: any) => c.id === selectedCase)?.title || selectedCase}
              </Tag>
            )}
            {selectedRelationTypes.map(t => (
              <Tag key={t} closable onClose={() => setSelectedRelationTypes(prev => prev.filter(x => x !== t))} color="cyan">
                关系: {t}
              </Tag>
            ))}
            {selectedPersonRoles.map(t => (
              <Tag key={t} closable onClose={() => setSelectedPersonRoles(prev => prev.filter(x => x !== t))} color="orange">
                角色: {t}
              </Tag>
            ))}
            {selectedPersonTypes.map(t => (
              <Tag key={t} closable onClose={() => setSelectedPersonTypes(prev => prev.filter(x => x !== t))} color="purple">
                类型: {t}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        <Card className="card-shadow" style={{ flex: 1, minHeight: 700 }}>
          <Spin spinning={loading}>
            {graphData.nodes.length > 0 ? (
              <ReactECharts
                ref={(e) => { if (e) echartsRef.current = e.getEchartsInstance(); }}
                option={graphOption}
                style={{ height: '650px', width: '100%' }}
                onEvents={{ click: handleGraphClick }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 100, color: '#999' }}>
                <SearchOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>暂无关系数据，请调整筛选条件或查询人员</p>
              </div>
            )}
          </Spin>
        </Card>

        <Card
          className="card-shadow"
          style={{ width: 320 }}
          title={
            selectedPerson ? (
              <Space>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: typeColors[selectedPerson.personType],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 'bold',
                }}>{selectedPerson.name[0]}</div>
                <span>{selectedPerson.name}</span>
                <Tag color={typeColors[selectedPerson.personType]}>{selectedPerson.personType}</Tag>
              </Space>
            ) : '人员信息'
          }
          extra={
            selectedPerson ? (
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
                添加关系
              </Button>
            ) : null
          }
        >
          {selectedPerson ? (
            <div>
              <List size="small" header={<div style={{ fontWeight: 'bold', marginBottom: 8 }}>基本信息</div>}>
                <List.Item><span style={{ color: '#666' }}>性别：</span>{selectedPerson.gender || '-'}</List.Item>
                <List.Item><span style={{ color: '#666' }}>年龄：</span>{selectedPerson.age || '-'}</List.Item>
                <List.Item><span style={{ color: '#666' }}>电话：</span>{selectedPerson.phone || '-'}</List.Item>
                <List.Item><span style={{ color: '#666' }}>职业：</span>{selectedPerson.occupation || '-'}</List.Item>
              </List>

              <List
                size="small"
                style={{ marginTop: 16 }}
                header={<div style={{ fontWeight: 'bold', marginBottom: 8 }}>关联关系 ({graphData.edges.length})</div>}
                dataSource={graphData.edges}
                renderItem={(item: any) => {
                  const targetNode = graphData.nodes.find((n: any) => n.id === item.target);
                  return (
                    <List.Item>
                      <Space direction="vertical" style={{ width: '100%' }} size={4}>
                        <Space>
                          <Tag color={typeColors[targetNode?.type] || 'default'}>{targetNode?.name}</Tag>
                          {targetNode?.role && targetNode.role !== '相关人员' && (
                            <Tag color={roleColors[targetNode.role] || 'default'}>{targetNode.role}</Tag>
                          )}
                        </Space>
                        <span style={{ color: '#1677ff' }}>{item.relation}</span>
                        {item.description && <div style={{ fontSize: 12, color: '#999' }}>{item.description}</div>}
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <p>点击图中节点或搜索人员查看详情</p>
            </div>
          )}
        </Card>
      </div>

      <Drawer
        title={`为 ${selectedPerson?.name} 添加关系`}
        placement="right"
        width={400}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        <Form form={relationForm} layout="vertical" onFinish={handleAddRelation}>
          <Form.Item name="targetPersonId" label="目标人员" rules={[{ required: true, message: '请选择目标人员' }]}>
            <Select
              showSearch
              placeholder="选择要建立关系的人员"
              optionFilterProp="children"
              options={availablePersons.map(p => ({ label: `${p.name} (${p.personType})`, value: p.id }))}
            />
          </Form.Item>
          <Form.Item name="relation" label="关系类型" rules={[{ required: true, message: '请输入关系类型' }]}>
            <Select
              mode="tags"
              maxTagCount={1}
              placeholder="如：同事、朋友、家人、雇佣等"
              options={options.relationTypes?.map((t: string) => ({ label: t, value: t }))}
            />
          </Form.Item>
          <Form.Item name="description" label="关系描述">
            <Input.TextArea rows={4} placeholder="描述这种关系的详细信息" maxLength={500} showCount />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">添加</Button>
              <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
