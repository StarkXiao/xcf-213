import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Tabs,
  Tag,
  Table,
  List,
  Button,
  Select,
  Input,
  DatePicker,
  Drawer,
  Descriptions,
  Progress,
  Empty,
  Badge,
  Tooltip,
  Divider,
  Statistic,
  Spin,
  message,
  Avatar,
} from 'antd';
import {
  ClusterOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  FieldTimeOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import moment from 'moment';
import { analysisApi, searchApi, caseApi } from '../../services/api';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const riskColors: Record<string, string> = {
  high: '#ff4d4f',
  medium: '#faad14',
  low: '#52c41a',
};

const riskLabels: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

const personTypeColors: Record<string, string> = {
  '嫌疑人': '#ff4d4f',
  '受害人': '#faad14',
  '证人': '#52c41a',
  '关系人': '#1677ff',
  '其他': '#722ed1',
};

const priorityColors: Record<string, string> = {
  '特急': 'red',
  '紧急': 'orange',
  '高': 'blue',
  '中': 'cyan',
  '低': 'green',
};

const statusColors: Record<string, string> = {
  '待立案': 'default',
  '已立案': 'processing',
  '侦查中': 'processing',
  '已移送起诉': 'warning',
  '已判决': 'success',
  '已结案': 'success',
  '已撤销': 'error',
};

interface OverviewData {
  stats: {
    totalCases: number;
    totalPersons: number;
    totalClues: number;
    totalEvidences: number;
    multiCasePersons: number;
    caseWithLocation: number;
    evidenceWithHash: number;
  };
}

export default function CrossCaseAnalysis() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [crossCaseData, setCrossCaseData] = useState<any>(null);
  const [caseGroups, setCaseGroups] = useState<any[]>([]);
  const [options, setOptions] = useState<any>({});
  const [cases, setCases] = useState<any[]>([]);

  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['persons', 'locations', 'times', 'evidences']);
  const [minCaseCount, setMinCaseCount] = useState<number>(2);
  const [dateRange, setDateRange] = useState<any>(null);
  const [selectedCaseTypes, setSelectedCaseTypes] = useState<string[]>([]);
  const [selectedCaseStatuses, setSelectedCaseStatuses] = useState<string[]>([]);

  const [clusterDrawerVisible, setClusterDrawerVisible] = useState(false);
  const [clusterData, setClusterData] = useState<any>(null);
  const [clusterLoading, setClusterLoading] = useState(false);

  const [groupDrawerVisible, setGroupDrawerVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadOptions();
    loadCases();
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'cross-case') {
      loadCrossCaseAnalysis();
    } else if (activeTab === 'groups') {
      loadCaseGroups();
    }
  }, [activeTab]);

  const loadOptions = async () => {
    try {
      const res = await searchApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadCases = async () => {
    try {
      const res = await caseApi.list({ pageSize: 1000 });
      setCases(res.data.items || res.data);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const loadOverview = async () => {
    try {
      const res = await analysisApi.getOverview();
      setOverview(res.data);
    } catch (error) {
      message.error('加载概览数据失败');
    }
  };

  const loadCrossCaseAnalysis = async () => {
    setLoading(true);
    try {
      const params: any = {
        dimensions: selectedDimensions,
        minCaseCount,
      };
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (selectedCaseTypes.length > 0) params.caseTypes = selectedCaseTypes;
      if (selectedCaseStatuses.length > 0) params.caseStatuses = selectedCaseStatuses;

      const res = await analysisApi.getCrossCaseAnalysis(params);
      setCrossCaseData(res.data);
    } catch (error) {
      message.error('加载跨案分析失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCaseGroups = async () => {
    setLoading(true);
    try {
      const res = await analysisApi.getCaseGroups({ minCaseCount });
      setCaseGroups(res.data.groups || []);
    } catch (error) {
      message.error('加载案件群组失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCluster = async (caseId: string) => {
    setClusterLoading(true);
    try {
      const res = await analysisApi.getCaseCluster(caseId);
      setClusterData(res.data);
      setClusterDrawerVisible(true);
    } catch (error) {
      message.error('加载案件聚类失败');
    } finally {
      setClusterLoading(false);
    }
  };

  const handleViewGroup = (group: any) => {
    setSelectedGroup(group);
    setGroupDrawerVisible(true);
  };

  const dimensionOptions = [
    { label: '人员关联', value: 'persons', icon: <TeamOutlined /> },
    { label: '地点关联', value: 'locations', icon: <EnvironmentOutlined /> },
    { label: '时间关联', value: 'times', icon: <FieldTimeOutlined /> },
    { label: '证据关联', value: 'evidences', icon: <PaperClipOutlined /> },
  ];

  const personColumns = [
    {
      title: '人员信息',
      key: 'person',
      render: (_: any, record: any) => (
        <Space>
          <Avatar
            style={{ backgroundColor: personTypeColors[record.personType] || '#722ed1' }}
          >
            {record.name?.[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {record.personType} {record.gender ? `· ${record.gender}` : ''} {record.age ? `· ${record.age}岁` : ''}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string) => v || '-',
    },
    {
      title: '身份证号',
      dataIndex: 'idCard',
      key: 'idCard',
      render: (v: string) => v || '-',
    },
    {
      title: '涉案数',
      dataIndex: 'caseCount',
      key: 'caseCount',
      render: (v: number) => (
        <Badge count={v} style={{ backgroundColor: v >= 5 ? '#ff4d4f' : v >= 3 ? '#faad14' : '#1677ff' }} />
      ),
    },
    {
      title: '关联度',
      dataIndex: 'relationshipScore',
      key: 'relationshipScore',
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={v >= 80 ? '#ff4d4f' : v >= 50 ? '#faad14' : '#52c41a'}
        />
      ),
    },
    {
      title: '涉案角色',
      key: 'roles',
      render: (_: any, record: any) => (
        <Space wrap>
          {(record.roles || []).map((r: string) => (
            <Tag key={r} color="blue">{r}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => navigate(`/persons/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  const expandedPersonRowRender = (record: any) => (
    <div style={{ padding: '0 48px' }}>
      <Card size="small" title={`关联案件 (${record.cases?.length || 0})`} style={{ marginBottom: 8 }}>
        <List
          dataSource={record.cases || []}
          size="small"
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" size="small" onClick={() => navigate(`/cases/${item.id}`)}>查看</Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => navigate(`/cases/${item.id}`)}>
                      {item.caseNumber} - {item.title}
                    </span>
                    <Tag color={priorityColors[item.priority]}>{item.priority}</Tag>
                    <Tag color={statusColors[item.status]}>{item.status}</Tag>
                  </Space>
                }
                description={
                  <Space size="middle" style={{ fontSize: 12, color: '#666' }}>
                    <span><FileTextOutlined /> {item.caseType}</span>
                    {item.location && <span><EnvironmentOutlined /> {item.location}</span>}
                    {item.occurTime && <span><FieldTimeOutlined /> {moment(item.occurTime).format('YYYY-MM-DD')}</span>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  const locationColumns = [
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      render: (v: string) => (
        <Space>
          <EnvironmentOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 500 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (v: string) => (
        <Tag color={riskColors[v]} icon={v === 'high' ? <AlertOutlined /> : undefined}>
          {riskLabels[v]}
        </Tag>
      ),
    },
    {
      title: '涉案数',
      dataIndex: 'caseCount',
      key: 'caseCount',
      render: (v: number) => (
        <Badge count={v} style={{ backgroundColor: v >= 5 ? '#ff4d4f' : v >= 3 ? '#faad14' : '#1677ff' }} />
      ),
    },
    { title: '线索数', dataIndex: 'clueCount', key: 'clueCount' },
    { title: '证据数', dataIndex: 'evidenceCount', key: 'evidenceCount' },
    {
      title: '案件类型',
      key: 'caseTypes',
      render: (_: any, record: any) => (
        <Space wrap>
          {(record.caseTypes || []).map((t: string) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
      ),
    },
  ];

  const expandedLocationRowRender = (record: any) => (
    <div style={{ padding: '0 48px' }}>
      <Card size="small" title={`关联案件 (${record.cases?.length || 0})`}>
        <List
          dataSource={record.cases || []}
          size="small"
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" size="small" onClick={() => navigate(`/cases/${item.id}`)}>查看</Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{item.caseNumber} - {item.title}</span>
                    <Tag color={priorityColors[item.priority]}>{item.priority}</Tag>
                    <Tag color={statusColors[item.status]}>{item.status}</Tag>
                  </Space>
                }
                description={
                  <Space size="middle" style={{ fontSize: 12, color: '#666' }}>
                    <span>{item.caseType}</span>
                    {item.occurTime && <span>{moment(item.occurTime).format('YYYY-MM-DD')}</span>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  const caseGroupColumns = [
    {
      title: '群组ID',
      dataIndex: 'id',
      key: 'id',
      render: (v: string) => (
        <Space>
          <ClusterOutlined style={{ color: '#722ed1' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.substring(0, 8)}...</span>
        </Space>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (v: string) => (
        <Tag color={riskColors[v]}>{riskLabels[v]}</Tag>
      ),
    },
    {
      title: '案件数',
      dataIndex: 'caseCount',
      key: 'caseCount',
      render: (v: number) => (
        <Badge count={v} style={{ backgroundColor: v >= 5 ? '#ff4d4f' : v >= 3 ? '#faad14' : '#1677ff' }} />
      ),
    },
    {
      title: '共同人员',
      key: 'sharedPersons',
      render: (_: any, record: any) => (
        <Space wrap>
          {(record.sharedPersons || []).slice(0, 3).map((p: any) => (
            <Tag key={p.id} color={personTypeColors[p.personType]}>{p.name}</Tag>
          ))}
          {(record.sharedPersons?.length || 0) > 3 && (
            <Tag>+{record.sharedPersons.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '关联地点',
      key: 'locations',
      render: (_: any, record: any) => (
        <Space wrap>
          {(record.locations || []).slice(0, 2).map((l: string, i: number) => (
            <Tag key={i} icon={<EnvironmentOutlined />} color="cyan">{l.substring(0, 15)}{l.length > 15 ? '...' : ''}</Tag>
          ))}
          {(record.locations?.length || 0) > 2 && (
            <Tag>+{record.locations.length - 2}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '案件类型',
      key: 'caseTypes',
      render: (_: any, record: any) => (
        <Space wrap>
          {(record.caseTypes || []).map((t: string) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewGroup(record)}>
          详情
        </Button>
      ),
    },
  ];

  const personsChartOption = useMemo(() => {
    const data = crossCaseData?.persons?.slice(0, 15) || [];
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        name: '涉案数',
      },
      yAxis: {
        type: 'category',
        data: data.map((d: any) => d.name),
        inverse: true,
      },
      series: [{
        type: 'bar',
        data: data.map((d: any) => ({
          value: d.caseCount,
          itemStyle: {
            color: d.caseCount >= 5 ? '#ff4d4f' : d.caseCount >= 3 ? '#faad14' : '#1677ff',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
        },
        barWidth: '60%',
      }],
    };
  }, [crossCaseData]);

  const locationsChartOption = useMemo(() => {
    const data = crossCaseData?.locations?.slice(0, 10) || [];
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {c}件' },
        data: data.map((d: any) => ({
          value: d.caseCount,
          name: d.location.substring(0, 15),
        })),
      }],
      color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#2f54eb', '#a0d911'],
    };
  }, [crossCaseData]);

  const timesChartOption = useMemo(() => {
    const data = crossCaseData?.times?.byDate?.slice(0, 20) || [];
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((d: any) => d.date),
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: { type: 'value', name: '案件数' },
      series: [{
        type: 'line',
        data: data.map((d: any) => d.caseCount),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: '#722ed1' },
        itemStyle: { color: '#722ed1' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(114, 46, 209, 0.3)' },
              { offset: 1, color: 'rgba(114, 46, 209, 0.02)' },
            ],
          },
        },
      }],
    };
  }, [crossCaseData]);

  const renderOverview = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={6}>
        <Card className="card-shadow">
          <Statistic
            title={
              <Space>
                <ClusterOutlined style={{ color: '#722ed1' }} />
                <span>案件总数</span>
              </Space>
            }
            value={overview?.stats.totalCases || 0}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card className="card-shadow">
          <Statistic
            title={
              <Space>
                <TeamOutlined style={{ color: '#ff4d4f' }} />
                <span>多案关联人员</span>
              </Space>
            }
            value={overview?.stats.multiCasePersons || 0}
            valueStyle={{ color: '#ff4d4f' }}
            suffix="人"
          />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card className="card-shadow">
          <Statistic
            title={
              <Space>
                <EnvironmentOutlined style={{ color: '#1677ff' }} />
                <span>有地点记录案件</span>
              </Space>
            }
            value={overview?.stats.caseWithLocation || 0}
            valueStyle={{ color: '#1677ff' }}
            suffix="件"
          />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card className="card-shadow">
          <Statistic
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                <span>有指纹/哈希证据</span>
              </Space>
            }
            value={overview?.stats.evidenceWithHash || 0}
            valueStyle={{ color: '#52c41a' }}
            suffix="份"
          />
        </Card>
      </Col>

      <Col xs={24}>
        <Card
          className="card-shadow"
          title={
            <Space>
              <AlertOutlined style={{ color: '#faad14' }} />
              <span>快速入口</span>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card
                hoverable
                size="small"
                onClick={() => setActiveTab('cross-case')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <ClusterOutlined style={{ fontSize: 36, color: '#722ed1' }} />
                <div style={{ marginTop: 8, fontWeight: 500 }}>多维度关联分析</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  人员、地点、时间、证据四维联动
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                hoverable
                size="small"
                onClick={() => setActiveTab('groups')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <TeamOutlined style={{ fontSize: 36, color: '#1677ff' }} />
                <div style={{ marginTop: 8, fontWeight: 500 }}>案件群组聚类</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  自动识别高度关联的案件集合
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                hoverable
                size="small"
                onClick={() => setActiveTab('single-case')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <SearchOutlined style={{ fontSize: 36, color: '#52c41a' }} />
                <div style={{ marginTop: 8, fontWeight: 500 }}>单案深度关联</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  以案件为中心的关联网络
                </div>
              </Card>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );

  const renderCrossCase = () => (
    <div>
      <Card
        className="card-shadow"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <FilterOutlined />
            <span>分析筛选条件</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadCrossCaseAnalysis}>重新分析</Button>
          </Space>
        }
      >
        <Space style={{ width: '100%', flexWrap: 'wrap' }} size="large">
          <div>
            <div style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>关联维度</div>
            <Select
              mode="multiple"
              value={selectedDimensions}
              onChange={setSelectedDimensions}
              style={{ minWidth: 320 }}
              options={dimensionOptions}
              maxTagCount={4}
            />
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>最少关联案件数</div>
            <Select
              value={minCaseCount}
              onChange={setMinCaseCount}
              style={{ width: 120 }}
              options={[
                { label: '2件以上', value: 2 },
                { label: '3件以上', value: 3 },
                { label: '5件以上', value: 5 },
              ]}
            />
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>案发时间范围</div>
            <RangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>案件类型</div>
            <Select
              mode="multiple"
              allowClear
              value={selectedCaseTypes}
              onChange={setSelectedCaseTypes}
              style={{ minWidth: 200 }}
              options={options.caseTypes?.map((t: string) => ({ label: t, value: t }))}
              maxTagCount={2}
            />
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>案件状态</div>
            <Select
              mode="multiple"
              allowClear
              value={selectedCaseStatuses}
              onChange={setSelectedCaseStatuses}
              style={{ minWidth: 200 }}
              options={options.caseStatuses?.map((t: string) => ({ label: t, value: t }))}
              maxTagCount={2}
            />
          </div>
        </Space>
      </Card>

      {selectedDimensions.includes('persons') && crossCaseData?.persons && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <TeamOutlined style={{ color: '#ff4d4f' }} />
                  <span>人员关联分析 Top 15</span>
                  <Tag color="red">{crossCaseData.persons.length} 人</Tag>
                </Space>
              }
            >
              <ReactECharts option={personsChartOption} style={{ height: 380 }} />
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <TeamOutlined style={{ color: '#ff4d4f' }} />
                  <span>多案关联人员列表</span>
                </Space>
              }
            >
              {crossCaseData.persons.length > 0 ? (
                <Table
                  size="small"
                  dataSource={crossCaseData.persons}
                  columns={personColumns}
                  rowKey="id"
                  pagination={{ pageSize: 5, showSizeChanger: true }}
                  expandable={{ expandedRowRender: expandedPersonRowRender }}
                  scroll={{ x: 800 }}
                />
              ) : (
                <Empty description="暂无满足条件的多案关联人员" />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {selectedDimensions.includes('locations') && crossCaseData?.locations && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <EnvironmentOutlined style={{ color: '#1677ff' }} />
                  <span>高发地点分布</span>
                  <Tag color="blue">{crossCaseData.locations.length} 个</Tag>
                </Space>
              }
            >
              <ReactECharts option={locationsChartOption} style={{ height: 380 }} />
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <EnvironmentOutlined style={{ color: '#1677ff' }} />
                  <span>多案关联地点列表</span>
                </Space>
              }
            >
              {crossCaseData.locations.length > 0 ? (
                <Table
                  size="small"
                  dataSource={crossCaseData.locations}
                  columns={locationColumns}
                  rowKey="location"
                  pagination={{ pageSize: 5, showSizeChanger: true }}
                  expandable={{ expandedRowRender: expandedLocationRowRender }}
                  scroll={{ x: 800 }}
                />
              ) : (
                <Empty description="暂无满足条件的多案关联地点" />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {selectedDimensions.includes('times') && crossCaseData?.times && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <FieldTimeOutlined style={{ color: '#722ed1' }} />
                  <span>时间维度关联分析</span>
                  <Tag color="purple">按日统计 {crossCaseData.times.byDate?.length || 0} 天</Tag>
                  <Tag color="cyan">按周统计 {crossCaseData.times.byWeek?.length || 0} 周</Tag>
                </Space>
              }
            >
              <ReactECharts option={timesChartOption} style={{ height: 320 }} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <FieldTimeOutlined />
                  <span>按周案件聚合</span>
                </Space>
              }
            >
              {crossCaseData.times.byWeek?.length > 0 ? (
                <List
                  size="small"
                  dataSource={crossCaseData.times.byWeek.slice(0, 10)}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color="purple">{item.weekStart} 周</Tag>
                            <Badge count={`${item.caseCount} 件`} style={{ backgroundColor: '#722ed1' }} />
                            <Space wrap>
                              {(item.caseTypes || []).map((t: string) => (
                                <Tag key={t}>{t}</Tag>
                              ))}
                            </Space>
                          </Space>
                        }
                        description={
                          <div style={{ marginTop: 8 }}>
                            {(item.cases || []).slice(0, 5).map((c: any) => (
                              <Tooltip key={c.id} title={`${c.caseType} · ${c.location || '无地点信息'}`}>
                                <Tag
                                  key={c.id}
                                  color={statusColors[c.status]}
                                  style={{ marginBottom: 4, cursor: 'pointer' }}
                                  onClick={() => navigate(`/cases/${c.id}`)}
                                >
                                  {c.caseNumber} - {c.title}
                                </Tag>
                              </Tooltip>
                            ))}
                            {(item.cases?.length || 0) > 5 && (
                              <Tag>等共 {item.cases.length} 件</Tag>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无时间关联数据" />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {selectedDimensions.includes('evidences') && crossCaseData?.evidences && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <PaperClipOutlined style={{ color: '#52c41a' }} />
                  <span>相同指纹/哈希证据关联</span>
                  <Tag color="green">{crossCaseData.evidences.byHash?.length || 0} 组</Tag>
                </Space>
              }
            >
              {crossCaseData.evidences.byHash?.length > 0 ? (
                <List
                  size="small"
                  dataSource={crossCaseData.evidences.byHash.slice(0, 10)}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar icon={<PaperClipOutlined />} style={{ backgroundColor: '#52c41a' }} />
                        }
                        title={
                          <Space>
                            <code style={{ fontSize: 12, background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                              {item.hashDisplay}
                            </code>
                            <Badge count={`${item.caseCount}案`} style={{ backgroundColor: '#52c41a' }} />
                            <Badge count={`${item.evidenceCount}证`} style={{ backgroundColor: '#1677ff' }} />
                            <Space wrap>
                              {(item.types || []).map((t: string) => (
                                <Tag key={t} color="cyan">{t}</Tag>
                              ))}
                            </Space>
                          </Space>
                        }
                        description={
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>关联案件：</div>
                            <Space wrap>
                              {(item.cases || []).map((c: any) => (
                                <Tag
                                  key={c.id}
                                  color={statusColors[c.status]}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => navigate(`/cases/${c.id}`)}
                                >
                                  {c.caseNumber} - {c.title}
                                </Tag>
                              ))}
                            </Space>
                            <Divider style={{ margin: '8px 0' }} />
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>关联证据：</div>
                            <Space wrap>
                              {(item.evidences || []).map((e: any) => (
                                <Tag key={e.id} color="blue">{e.evidenceNumber} - {e.name}</Tag>
                              ))}
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无相同哈希证据跨案关联" />
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              className="card-shadow"
              title={
                <Space>
                  <EnvironmentOutlined style={{ color: '#faad14' }} />
                  <span>同类型同地点证据关联</span>
                  <Tag color="orange">{crossCaseData.evidences.byTypeLocation?.length || 0} 组</Tag>
                </Space>
              }
            >
              {crossCaseData.evidences.byTypeLocation?.length > 0 ? (
                <List
                  size="small"
                  dataSource={crossCaseData.evidences.byTypeLocation.slice(0, 10)}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar icon={<PaperClipOutlined />} style={{ backgroundColor: '#faad14' }} />
                        }
                        title={
                          <Space>
                            <Tag color="orange">{item.type}</Tag>
                            <Tag color="cyan" icon={<EnvironmentOutlined />}>{item.location}</Tag>
                            <Badge count={`${item.caseCount}案`} style={{ backgroundColor: '#faad14' }} />
                          </Space>
                        }
                        description={
                          <div style={{ marginTop: 8 }}>
                            <Space wrap>
                              {(item.cases || []).map((c: any) => (
                                <Tag
                                  key={c.id}
                                  color={statusColors[c.status]}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => navigate(`/cases/${c.id}`)}
                                >
                                  {c.caseNumber} - {c.title}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无同类型同地点证据关联" />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );

  const renderCaseGroups = () => (
    <Card
      className="card-shadow"
      title={
        <Space>
          <ClusterOutlined style={{ color: '#722ed1' }} />
          <span>案件群组聚类结果</span>
          <Tag color="purple">{caseGroups.length} 个群组</Tag>
        </Space>
      }
      extra={
        <Space>
          <div style={{ color: '#666', fontSize: 13 }}>最少案件数：</div>
          <Select
            value={minCaseCount}
            onChange={(v) => {
              setMinCaseCount(v);
              setTimeout(loadCaseGroups, 100);
            }}
            style={{ width: 120 }}
            options={[
              { label: '2件以上', value: 2 },
              { label: '3件以上', value: 3 },
              { label: '5件以上', value: 5 },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadCaseGroups}>刷新</Button>
        </Space>
      }
    >
      {caseGroups.length > 0 ? (
        <Table
          dataSource={caseGroups}
          columns={caseGroupColumns}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
        />
      ) : (
        <Empty description="暂无满足条件的案件群组，请尝试降低最少案件数" />
      )}
    </Card>
  );

  const renderSingleCase = () => (
    <Card
      className="card-shadow"
      title={
        <Space>
          <SearchOutlined style={{ color: '#52c41a' }} />
          <span>单案深度关联分析</span>
        </Space>
      }
    >
      <div style={{ marginBottom: 24 }}>
        <Input.Search
          placeholder="选择要分析的案件..."
          style={{ maxWidth: 500 }}
          size="large"
          enterButton={<Space><SearchOutlined /> 开始分析</Space>}
          onSearch={(value) => {
            const foundCase = cases.find((c: any) =>
              c.caseNumber === value || c.title === value || c.id === value
            );
            if (foundCase) {
              handleViewCluster(foundCase.id);
            } else {
              message.warning('未找到匹配的案件');
            }
          }}
        />
      </div>
      <Divider style={{ margin: '16px 0' }} />
      <div>
        <div style={{ color: '#666', marginBottom: 12 }}>或从最近案件中选择：</div>
        <Row gutter={[12, 12]}>
          {cases.slice(0, 12).map((c: any) => (
            <Col xs={24} md={12} key={c.id}>
              <Card
                size="small"
                hoverable
                onClick={() => handleViewCluster(c.id)}
                style={{ cursor: 'pointer' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Space>
                    <span style={{ fontWeight: 500 }}>{c.caseNumber}</span>
                    <Tag color={priorityColors[c.priority]}>{c.priority}</Tag>
                    <Tag color={statusColors[c.status]}>{c.status}</Tag>
                  </Space>
                  <span style={{ color: '#333' }}>{c.title}</span>
                  <Space size="middle" style={{ fontSize: 12, color: '#999' }}>
                    <span><FileTextOutlined /> {c.caseType}</span>
                    {c.location && <span><EnvironmentOutlined /> {c.location.substring(0, 20)}</span>}
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Card>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <ClusterOutlined />
            跨案串并分析中心
          </Space>
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadOverview(); if (activeTab === 'cross-case') loadCrossCaseAnalysis(); else if (activeTab === 'groups') loadCaseGroups(); }}>
            刷新数据
          </Button>
        </Space>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <Space>
                <EyeOutlined />
                分析概览
              </Space>
            }
            key="overview"
          />
          <TabPane
            tab={
              <Space>
                <ClusterOutlined />
                多维度关联分析
                {crossCaseData && (
                  <Badge count={
                    (crossCaseData.persons?.length || 0) +
                    (crossCaseData.locations?.length || 0)
                  } size="small" />
                )}
              </Space>
            }
            key="cross-case"
          />
          <TabPane
            tab={
              <Space>
                <TeamOutlined />
                案件群组聚类
                <Badge count={caseGroups.length} size="small" />
              </Space>
            }
            key="groups"
          />
          <TabPane
            tab={
              <Space>
                <SearchOutlined />
                单案深度关联
              </Space>
            }
            key="single-case"
          />
        </Tabs>
      </Card>

      <Spin spinning={loading}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'cross-case' && renderCrossCase()}
        {activeTab === 'groups' && renderCaseGroups()}
        {activeTab === 'single-case' && renderSingleCase()}
      </Spin>

      <Drawer
        title={
          <Space>
            <ClusterOutlined style={{ color: '#722ed1' }} />
            <span>案件群组详情</span>
            {selectedGroup && (
              <Tag color={riskColors[selectedGroup.riskLevel]}>{riskLabels[selectedGroup.riskLevel]}</Tag>
            )}
          </Space>
        }
        placement="right"
        width={720}
        open={groupDrawerVisible}
        onClose={() => setGroupDrawerVisible(false)}
      >
        {selectedGroup && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="群组案件数">{selectedGroup.caseCount} 件</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskColors[selectedGroup.riskLevel]}>{riskLabels[selectedGroup.riskLevel]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="共同人员" span={2}>
                <Space wrap>
                  {(selectedGroup.sharedPersons || []).map((p: any) => (
                    <Tag key={p.id} color={personTypeColors[p.personType]} style={{ cursor: 'pointer' }} onClick={() => navigate(`/persons/${p.id}`)}>
                      {p.name} ({p.caseCount}案)
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="关联地点" span={2}>
                <Space wrap>
                  {(selectedGroup.locations || []).map((l: string, i: number) => (
                    <Tag key={i} icon={<EnvironmentOutlined />} color="cyan">{l}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="涉及案件类型" span={2}>
                <Space wrap>
                  {(selectedGroup.caseTypes || []).map((t: string) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Card size="small" title={`群组成员案件 (${selectedGroup.cases?.length || 0})`}>
              <List
                dataSource={selectedGroup.cases || []}
                renderItem={(item: any) => (
                  <List.Item
                    actions={[
                      <Space key="actions">
                        <Button type="link" size="small" icon={<SearchOutlined />} onClick={() => handleViewCluster(item.id)}>
                          深度分析
                        </Button>
                        <Button type="link" size="small" onClick={() => navigate(`/cases/${item.id}`)}>详情</Button>
                      </Space>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1677ff' }} />
                      }
                      title={
                        <Space>
                          <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => navigate(`/cases/${item.id}`)}>
                            {item.caseNumber} - {item.title}
                          </span>
                          <Tag color={priorityColors[item.priority]}>{item.priority}</Tag>
                          <Tag color={statusColors[item.status]}>{item.status}</Tag>
                        </Space>
                      }
                      description={
                        <Space size="middle" style={{ fontSize: 12, color: '#666' }}>
                          <span><FileTextOutlined /> {item.caseType}</span>
                          {item.location && <span><EnvironmentOutlined /> {item.location}</span>}
                          {item.occurTime && <span><FieldTimeOutlined /> {moment(item.occurTime).format('YYYY-MM-DD')}</span>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </div>
        )}
      </Drawer>

      <Drawer
        title={
          <Space>
            <SearchOutlined style={{ color: '#52c41a' }} />
            <span>单案关联分析结果</span>
          </Space>
        }
        placement="right"
        width={720}
        open={clusterDrawerVisible}
        onClose={() => setClusterDrawerVisible(false)}
        loading={clusterLoading}
      >
        {clusterData && (
          <div>
            <Card
              size="small"
              style={{ marginBottom: 16 }}
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                  <span>基准案件：{clusterData.baseCase?.caseNumber} - {clusterData.baseCase?.title}</span>
                </Space>
              }
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="案件类型">{clusterData.baseCase?.caseType}</Descriptions.Item>
                <Descriptions.Item label="案件状态">
                  <Tag color={statusColors[clusterData.baseCase?.status]}>{clusterData.baseCase?.status}</Tag>
                </Descriptions.Item>
                {clusterData.baseCase?.location && (
                  <Descriptions.Item label="案发地点" span={2}>
                    <EnvironmentOutlined /> {clusterData.baseCase.location}
                  </Descriptions.Item>
                )}
                {clusterData.baseCase?.occurTime && (
                  <Descriptions.Item label="案发时间" span={2}>
                    <FieldTimeOutlined /> {moment(clusterData.baseCase.occurTime).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="关联人员" span={2}>
                  <Space wrap>
                    {(clusterData.baseCase?.persons || []).map((p: any) => (
                      <Tag key={p.id} color={personTypeColors[p.personType]} style={{ cursor: 'pointer' }} onClick={() => navigate(`/persons/${p.id}`)}>
                        {p.name}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <ClusterOutlined />
                  <span>关联案件 ({clusterData.relatedCases?.length || 0})</span>
                </Space>
              }
            >
              {clusterData.relatedCases?.length > 0 ? (
                <List
                  dataSource={clusterData.relatedCases}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Progress
                            type="circle"
                            percent={item.score}
                            size="small"
                            width={48}
                            strokeColor={item.score >= 80 ? '#ff4d4f' : item.score >= 50 ? '#faad14' : '#52c41a'}
                          />
                        }
                        title={
                          <Space>
                            <span
                              style={{ cursor: 'pointer', color: '#1677ff', fontWeight: 500 }}
                              onClick={() => navigate(`/cases/${item.case?.id}`)}
                            >
                              {item.case?.caseNumber} - {item.case?.title}
                            </span>
                            <Tag color={priorityColors[item.case?.priority]}>{item.case?.priority}</Tag>
                            <Tag color={statusColors[item.case?.status]}>{item.case?.status}</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" style={{ width: '100%' }} size={4}>
                            <Space size="middle" style={{ fontSize: 12, color: '#666' }}>
                              <span><FileTextOutlined /> {item.case?.caseType}</span>
                              {item.case?.location && <span><EnvironmentOutlined /> {item.case.location}</span>}
                              {item.case?.occurTime && <span><FieldTimeOutlined /> {moment(item.case.occurTime).format('YYYY-MM-DD')}</span>}
                            </Space>
                            <Space wrap>
                              <span style={{ fontSize: 12, color: '#666' }}>关联维度：</span>
                              {(item.dimensions || []).map((d: string) => (
                                <Tag key={d} color={d === 'persons' ? 'red' : d === 'locations' ? 'blue' : 'purple'}>
                                  {d === 'persons' ? '人员' : d === 'locations' ? '地点' : d}
                                </Tag>
                              ))}
                            </Space>
                            {item.sharedPersons?.length > 0 && (
                              <Space wrap>
                                <span style={{ fontSize: 12, color: '#666' }}>共同人员：</span>
                                {item.sharedPersons.map((p: any) => (
                                  <Tag key={p.id} color={personTypeColors[p.personType]} style={{ cursor: 'pointer' }} onClick={() => navigate(`/persons/${p.id}`)}>
                                    {p.name}
                                  </Tag>
                                ))}
                              </Space>
                            )}
                            {item.sharedLocation && (
                              <Tag color="blue" icon={<EnvironmentOutlined />}>同地点关联</Tag>
                            )}
                          </Space>
                        }
                      />
                      <Button type="link" size="small" onClick={() => navigate(`/cases/${item.case?.id}`)}>详情</Button>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="未找到直接关联的案件" />
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}
