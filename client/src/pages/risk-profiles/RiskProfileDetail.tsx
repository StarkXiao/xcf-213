import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Tabs, List, message, Row, Col,
  Statistic, Empty, Spin, Progress, Alert, Badge, Tooltip, Divider, Timeline,
  Table
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, WarningOutlined, ExclamationCircleOutlined,
  UserOutlined, FileTextOutlined, BulbOutlined, PaperClipOutlined,
  ShareAltOutlined, InfoCircleOutlined, BarChartOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import moment from 'moment';
import ReactECharts from 'echarts-for-react';
import { riskProfileApi } from '../../services/api';

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const typeColors: Record<string, string> = {
  '嫌疑人': '#ff4d4f',
  '受害人': '#faad14',
  '证人': '#52c41a',
  '关系人': '#1677ff',
  '其他': '#722ed1',
};

const riskLevelConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
  icon: any;
}> = {
  CRITICAL: {
    label: '极高风险',
    color: '#ff4d4f',
    bgColor: '#fff1f0',
    borderColor: '#ffa39e',
    progressColor: '#ff4d4f',
    icon: <ExclamationCircleOutlined />,
  },
  HIGH: {
    label: '高风险',
    color: '#fa8c16',
    bgColor: '#fff7e6',
    borderColor: '#ffd591',
    progressColor: '#fa8c16',
    icon: <WarningOutlined />,
  },
  MEDIUM: {
    label: '中风险',
    color: '#faad14',
    bgColor: '#fffbe6',
    borderColor: '#ffe58f',
    progressColor: '#faad14',
    icon: <InfoCircleOutlined />,
  },
  LOW: {
    label: '低风险',
    color: '#52c41a',
    bgColor: '#f6ffed',
    borderColor: '#b7eb8f',
    progressColor: '#52c41a',
    icon: <SafetyCertificateOutlined />,
  },
};

const categoryColors: Record<string, string> = {
  baseScore: '#1677ff',
  caseScore: '#722ed1',
  clueScore: '#13c2c2',
  evidenceScore: '#fa8c16',
  relationScore: '#eb2f96',
};

const categoryLabels: Record<string, string> = {
  baseScore: '基础分',
  caseScore: '案件分',
  clueScore: '线索分',
  evidenceScore: '证据分',
  relationScore: '关系分',
};

const caseStatusColors: Record<string, string> = {
  '待立案': 'default',
  '侦查中': 'processing',
  '已移送起诉': 'warning',
  '已判决': 'success',
  '已结案': 'success',
  '已撤销': 'error',
};

const clueStatusColors: Record<string, string> = {
  '待核查': 'default',
  '核查中': 'processing',
  '已核实': 'success',
  '未核实': 'warning',
  '已归档': 'success',
};

const evidenceTypeColors: Record<string, string> = {
  '物证': 'red',
  '书证': 'blue',
  '证人证言': 'green',
  '被害人陈述': 'orange',
  '犯罪嫌疑人供述': 'purple',
  '鉴定意见': 'cyan',
  '勘验笔录': 'geekblue',
  '视听资料': 'magenta',
  '电子数据': 'lime',
  '其他': 'default',
};

export default function RiskProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadProfileData();
    }
  }, [id]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const res = await riskProfileApi.get(id!);
      setProfileData(res.data);
    } catch (error) {
      message.error('加载风险画像失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      const res = await riskProfileApi.recalculate(id!);
      message.success(`风险分重新计算完成，当前风险分：${res.data.score}`);
      loadProfileData();
    } catch (error) {
      message.error('重新计算失败');
    } finally {
      setRecalcLoading(false);
    }
  };

  if (!profileData) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const riskConfig = riskLevelConfig[profileData.riskLevel] || riskLevelConfig.LOW;
  const scorePercent = Math.min(100, Math.round((profileData.riskScore / 60) * 100));
  const breakdown = profileData.riskBreakdown || {};
  const totalBreakdown = Object.values(breakdown).reduce((sum: number, v: any) => sum + (v || 0), 0) || 1;

  const radarOption = {
    tooltip: {},
    radar: {
      indicator: Object.entries(categoryLabels).map(([key, label]) => ({
        name: label,
        max: 20,
      })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: 13,
      },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
      splitArea: { areaStyle: { color: ['rgba(103,194,58,0.05)', 'rgba(22,119,255,0.05)'] } },
    },
    series: [{
      type: 'radar',
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: riskConfig.color + 'cc' },
            { offset: 1, color: riskConfig.color + '20' },
          ],
        },
      },
      lineStyle: { color: riskConfig.color, width: 2 },
      itemStyle: { color: riskConfig.color },
      data: [{
        value: Object.keys(categoryLabels).map((key) => breakdown[key] || 0),
        name: '风险构成',
      }],
    }],
  };

  const barOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        const percent = totalBreakdown > 0
          ? Math.round(((breakdown[p.name] || 0) / totalBreakdown) * 100)
          : 0;
        return `${categoryLabels[p.name] || p.name}<br/>分值: ${breakdown[p.name] || 0}<br/>占比: ${percent}%`;
      },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: Object.keys(categoryLabels),
      axisLabel: {
        formatter: (value: string) => categoryLabels[value] || value,
        color: '#666',
        fontSize: 12,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#eee' } },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [{
      type: 'bar',
      data: Object.keys(categoryLabels).map((key) => ({
        value: breakdown[key] || 0,
        itemStyle: {
          color: categoryColors[key],
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barWidth: '50%',
      label: {
        show: true,
        position: 'top',
        formatter: '{c}分',
        color: '#333',
        fontWeight: 'bold',
      },
    }],
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
        fontSize: 12,
        fontWeight: 600,
      },
      edgeLabel: {
        show: true,
        formatter: '{c}',
        fontSize: 11,
        color: '#666',
      },
      force: {
        repulsion: 500,
        edgeLength: 140,
      },
      data: profileData.relations?.nodes?.map((node: any) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        symbolSize: node.isCenter ? 65 : 45,
        itemStyle: {
          color: node.isCenter ? riskConfig.color :
            typeColors[node.type] || '#722ed1',
          borderWidth: node.isCenter ? 4 : 2,
          borderColor: node.isCenter ? '#fff' : '#eee',
          shadowBlur: node.isCenter ? 25 : 10,
          shadowColor: node.isCenter ? riskConfig.color : 'rgba(0,0,0,0.2)',
        },
      })) || [],
      links: profileData.relations?.edges?.map((edge: any) => ({
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        description: edge.description,
        lineStyle: {
          width: 2.5,
          color: '#aaa',
          curveness: 0.1,
        },
      })) || [],
    }],
  };

  const hitTypeColors: Record<string, string> = {
    '关键线索': '#ff4d4f',
    '已核实线索': '#52c41a',
    '高价值线索': '#fa8c16',
  };

  const caseColumns = [
    {
      title: '案件编号',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      width: 180,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{v}</span>,
    },
    {
      title: '案件名称',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r: any) => (
        <a onClick={() => navigate(`/cases/${r.id}`)}>{v}</a>
      ),
    },
    {
      title: '案件类型',
      dataIndex: 'caseType',
      key: 'caseType',
      width: 120,
      render: (v: string) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: '涉案角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (v: string) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '案件状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => <Tag color={caseStatusColors[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '发案时间',
      dataIndex: 'occurTime',
      key: 'occurTime',
      width: 160,
      render: (v: string) => v ? moment(v).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const clueHitColumns = [
    {
      title: '命中类型',
      dataIndex: 'hitType',
      key: 'hitType',
      width: 120,
      render: (v: string) => (
        <Tag color={hitTypeColors[v]} style={{ fontWeight: 600 }}>{v}</Tag>
      ),
    },
    {
      title: '线索编号',
      dataIndex: 'clueNumber',
      key: 'clueNumber',
      width: 180,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#13c2c2' }}>{v}</span>,
    },
    {
      title: '线索标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r: any) => (
        <a onClick={() => navigate(`/clues/${r.id}`)}>{v}</a>
      ),
    },
    {
      title: '线索类型',
      dataIndex: 'clueType',
      key: 'clueType',
      width: 120,
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: '关联关系',
      dataIndex: 'relation',
      key: 'relation',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '可信度/重要性',
      key: 'level',
      width: 160,
      render: (_: any, r: any) => (
        <Space direction="vertical" size={2}>
          <Tag color={r.credibility === '高' ? 'red' : r.credibility === '中' ? 'orange' : 'green'}>
            可信度：{r.credibility}
          </Tag>
          <Tag color={r.importance === '高' ? 'red' : r.importance === '中' ? 'orange' : 'green'}>
            重要性：{r.importance}
          </Tag>
        </Space>
      ),
    },
  ];

  const evidenceColumns = [
    {
      title: '证据编号',
      dataIndex: 'evidenceNumber',
      key: 'evidenceNumber',
      width: 180,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#fa8c16' }}>{v}</span>,
    },
    {
      title: '证据名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r: any) => (
        <a onClick={() => navigate(`/evidences/${r.id}`)}>{v}</a>
      ),
    },
    {
      title: '证据类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: string) => <Tag color={evidenceTypeColors[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '关联对象',
      key: 'related',
      width: 220,
      render: (_: any, r: any) => (
        <Space direction="vertical" size={2}>
          {r.case && (
            <Tag color="purple">
              <FileTextOutlined /> 案件：{r.case.title?.length > 10 ? r.case.title.slice(0, 10) + '...' : r.case.title}
            </Tag>
          )}
          {r.clue && (
            <Tag color="cyan">
              <BulbOutlined /> 线索：{r.clue.title?.length > 10 ? r.clue.title.slice(0, 10) + '...' : r.clue.title}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '收集方式',
      dataIndex: 'collectionMethod',
      key: 'collectionMethod',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '收集时间',
      dataIndex: 'collectTime',
      key: 'collectTime',
      width: 160,
      render: (v: string) => v ? moment(v).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <BarChartOutlined />
          风险概览
        </Space>
      ),
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card
                className="card-shadow"
                style={{
                  background: `linear-gradient(135deg, ${riskConfig.bgColor} 0%, #fff 100%)`,
                  border: `2px solid ${riskConfig.borderColor}`,
                  borderRadius: 12,
                }}
              >
                <Row gutter={16} align="middle">
                  <Col span={10}>
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          width: 100,
                          height: 100,
                          borderRadius: '50%',
                          background: `conic-gradient(${riskConfig.color} ${scorePercent * 3.6}deg, #f0f0f0 0)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto',
                        }}
                      >
                        <div
                          style={{
                            width: 82,
                            height: 82,
                            borderRadius: '50%',
                            background: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontSize: 28, fontWeight: 'bold', color: riskConfig.color }}>
                            {profileData.riskScore}
                          </span>
                          <span style={{ fontSize: 11, color: '#999' }}>风险分值</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col span={14}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Space>
                        <span style={{ fontSize: 30, color: riskConfig.color }}>
                          {riskConfig.icon}
                        </span>
                        <span style={{
                          fontSize: 22,
                          fontWeight: 'bold',
                          color: riskConfig.color,
                        }}>
                          {riskConfig.label}
                        </span>
                      </Space>
                      <div style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>
                        {profileData.riskLevel === 'CRITICAL' && (
                          <>该人员存在极高涉案风险，建议立即采取<span style={{ color: riskConfig.color, fontWeight: 600 }}>重点监控</span>措施。</>
                        )}
                        {profileData.riskLevel === 'HIGH' && (
                          <>该人员存在较高涉案风险，建议列为<span style={{ color: riskConfig.color, fontWeight: 600 }}>重点关注</span>对象。</>
                        )}
                        {profileData.riskLevel === 'MEDIUM' && (
                          <>该人员存在一定涉案风险，建议<span style={{ color: riskConfig.color, fontWeight: 600 }}>定期跟踪</span>其动态。</>
                        )}
                        {profileData.riskLevel === 'LOW' && (
                          <>该人员风险较低，建议<span style={{ color: riskConfig.color, fontWeight: 600 }}>正常管理</span>。</>
                        )}
                      </div>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="风险构成雷达图" className="card-shadow">
                <ReactECharts option={radarOption} style={{ height: 260 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card title="风险构成分布" className="card-shadow">
                <ReactECharts option={barOption} style={{ height: 260 }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card className="card-shadow" size="small">
                <Statistic
                  title={
                    <Space>
                      <FileTextOutlined style={{ color: '#722ed1' }} />
                      涉案案件
                    </Space>
                  }
                  value={profileData.cases?.length || 0}
                  suffix="起"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="card-shadow" size="small">
                <Statistic
                  title={
                    <Space>
                      <BulbOutlined style={{ color: '#13c2c2' }} />
                      关联线索
                    </Space>
                  }
                  value={profileData.clues?.length || 0}
                  suffix="条"
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="card-shadow" size="small">
                <Statistic
                  title={
                    <Space>
                      <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
                      线索命中
                    </Space>
                  }
                  value={profileData.clueHits?.length || 0}
                  suffix="条"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="card-shadow" size="small">
                <Statistic
                  title={
                    <Space>
                      <PaperClipOutlined style={{ color: '#eb2f96' }} />
                      关联证据
                    </Space>
                  }
                  value={profileData.evidences?.length || 0}
                  suffix="份"
                  valueStyle={{ color: '#eb2f96' }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title={
              <Space>
                <InfoCircleOutlined />
                风险评分因素分析
              </Space>
            }
            className="card-shadow"
            size="small"
            style={{ marginBottom: 16 }}
          >
            {profileData.riskFactors?.length > 0 ? (
              <Row gutter={16}>
                <Col span={12}>
                  <Timeline
                    items={profileData.riskFactors.slice(0, Math.ceil(profileData.riskFactors.length / 2)).map((factor: string, idx: number) => ({
                      color: riskConfig.color,
                      dot: <BarChartOutlined />,
                      children: (
                        <div style={{ padding: '4px 0', fontSize: 13, color: '#333' }}>
                          {factor}
                        </div>
                      ),
                    }))}
                  />
                </Col>
                <Col span={12}>
                  <Timeline
                    items={profileData.riskFactors.slice(Math.ceil(profileData.riskFactors.length / 2)).map((factor: string, idx: number) => ({
                      color: riskConfig.color,
                      dot: <BarChartOutlined />,
                      children: (
                        <div style={{ padding: '4px 0', fontSize: 13, color: '#333' }}>
                          {factor}
                        </div>
                      ),
                    }))}
                  />
                </Col>
              </Row>
            ) : (
              <Empty description="暂无风险评分因素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'relations',
      label: (
        <Space>
          <ShareAltOutlined />
          关系网络
          <Badge
            count={
              (profileData.relations?.nodes?.length || 0) > 1
                ? (profileData.relations?.nodes?.length || 0) - 1
                : 0
            }
            style={{ backgroundColor: '#1677ff' }}
          />
        </Space>
      ),
      children: (
        <div>
          {profileData.relations?.nodes?.length > 0 ? (
            <Card className="card-shadow" style={{ minHeight: 600 }}>
              <ReactECharts option={graphOption} style={{ height: '650px' }} />
            </Card>
          ) : (
            <Card className="card-shadow">
              <Empty description="暂无关系网络数据" />
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'cases',
      label: (
        <Space>
          <FileTextOutlined />
          历史涉案
          <Badge count={profileData.cases?.length || 0} style={{ backgroundColor: '#722ed1' }} />
        </Space>
      ),
      children: (
        <div>
          <Card className="card-shadow">
            {profileData.cases?.length > 0 ? (
              <Table
                rowKey="id"
                columns={caseColumns}
                dataSource={profileData.cases}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (t) => `共 ${t} 起案件`,
                }}
              />
            ) : (
              <Empty description="暂无历史涉案记录" />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'clueHits',
      label: (
        <Space>
          <ExclamationCircleOutlined />
          线索命中
          <Badge count={profileData.clueHits?.length || 0} style={{ backgroundColor: '#fa8c16' }} />
        </Space>
      ),
      children: (
        <div>
          {profileData.clueHits?.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              message={
                <Space>
                  <ExclamationCircleOutlined />
                  <span>共命中 <strong style={{ color: '#ff4d4f' }}>{profileData.clueHits.length}</strong> 条高价值线索，请重点核查</span>
                </Space>
              }
              type="warning"
              showIcon
            />
          )}
          <Card className="card-shadow">
            {profileData.clueHits?.length > 0 ? (
              <Table
                rowKey="id"
                columns={clueHitColumns}
                dataSource={profileData.clueHits}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (t) => `共 ${t} 条命中线索`,
                }}
              />
            ) : (
              <Empty description="暂无线索命中记录" />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'evidences',
      label: (
        <Space>
          <PaperClipOutlined />
          证据关联
          <Badge count={profileData.evidences?.length || 0} style={{ backgroundColor: '#eb2f96' }} />
        </Space>
      ),
      children: (
        <div>
          <Card className="card-shadow">
            {profileData.evidences?.length > 0 ? (
              <Table
                rowKey="id"
                columns={evidenceColumns}
                dataSource={profileData.evidences}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (t) => `共 ${t} 份证据`,
                }}
              />
            ) : (
              <Empty description="暂无关联证据" />
            )}
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/risk-profiles')}>
            返回列表
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: typeColors[profileData.personType] || '#1677ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 'bold',
              border: `3px solid ${riskConfig.borderColor}`,
              boxShadow: `0 0 0 3px ${riskConfig.bgColor}`,
            }}>
              {profileData.name[0]}
            </div>
            <div>
              <Space style={{ marginBottom: 4 }}>
                <h2 className="page-title" style={{ margin: 0 }}>{profileData.name}</h2>
                <Tag color={personTypeColors[profileData.personType]} style={{ fontSize: 14, padding: '2px 10px' }}>
                  {profileData.personType}
                </Tag>
                <Tag
                  color={riskConfig.color}
                  style={{ fontSize: 14, padding: '2px 12px', fontWeight: 600 }}
                >
                  {riskConfig.icon} {riskConfig.label} · {profileData.riskScore}分
                </Tag>
              </Space>
              <Space style={{ fontSize: 13, color: '#999' }}>
                {profileData.idCard && (
                  <span><UserOutlined /> {profileData.idCard}</span>
                )}
                {profileData.phone && (
                  <span>☎ {profileData.phone}</span>
                )}
                {profileData.address && (
                  <span>📍 {profileData.address}</span>
                )}
              </Space>
            </div>
          </div>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={recalcLoading}
            onClick={handleRecalculate}
          >
            重新计算风险
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => navigate(`/persons/${id}`)}>
            查看人员档案
          </Button>
        </Space>
      </div>

      {profileData.riskLevel === 'CRITICAL' || profileData.riskLevel === 'HIGH' ? (
        <Alert
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <ExclamationCircleOutlined />
              <strong>【{riskConfig.label}预警】</strong>
              <span>
                {profileData.riskLevel === 'CRITICAL'
                  ? `该人员风险分值达 ${profileData.riskScore}，存在重大涉案嫌疑，建议立即启动调查程序！`
                  : `该人员风险分值 ${profileData.riskScore}，建议加强监控频率并深入调查相关线索。`
                }
              </span>
            </Space>
          }
          type={profileData.riskLevel === 'CRITICAL' ? 'error' : 'warning'}
          showIcon
          closable
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="基本信息" className="card-shadow" size="small">
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="姓名">{profileData.name}</Descriptions.Item>
              <Descriptions.Item label="性别">{profileData.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="年龄">{profileData.age || '-'}</Descriptions.Item>
              <Descriptions.Item label="身份证号">
                {profileData.idCard ? (
                  <span style={{ fontFamily: 'monospace' }}>{profileData.idCard}</span>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">{profileData.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="职业">{profileData.occupation || '-'}</Descriptions.Item>
              <Descriptions.Item label="住址" span={2}>{profileData.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="标签">
                {profileData.tags?.length > 0 ? (
                  <Space size={[4, 4]} wrap>
                    {profileData.tags.map((t: any) => (
                      <Tag key={t.id} color={t.color || 'default'}>{t.name}</Tag>
                    ))}
                  </Space>
                ) : (
                  <span style={{ color: '#ccc' }}>无</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={3}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {profileData.description || '-'}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <Progress
                  type="dashboard"
                  percent={scorePercent}
                  strokeColor={riskConfig.progressColor}
                  size={60}
                  format={(p) => `${profileData.riskScore}分`}
                />
                <div>
                  <div style={{ fontWeight: 600, color: riskConfig.color, fontSize: 16 }}>
                    {riskConfig.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    创建于 {moment(profileData.createdAt).format('YYYY-MM-DD')}
                  </div>
                </div>
              </Space>
            }
            className="card-shadow"
            size="small"
          >
            <Divider style={{ margin: '8px 0 12px' }} />
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {Object.entries(categoryLabels).map(([key, label]) => {
                const score = breakdown[key] || 0;
                const percent = totalBreakdown > 0
                  ? Math.round((score / totalBreakdown) * 100)
                  : 0;
                return (
                  <div key={key}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Space>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: categoryColors[key],
                          }}
                        />
                        <span style={{ color: '#666', fontSize: 12 }}>{label}</span>
                      </Space>
                      <Space>
                        <strong style={{ color: categoryColors[key] }}>{score}分</strong>
                        <span style={{ color: '#999', fontSize: 11 }}>({percent}%)</span>
                      </Space>
                    </Space>
                    <Progress
                      percent={percent}
                      size="small"
                      showInfo={false}
                      strokeColor={categoryColors[key]}
                    />
                  </div>
                );
              })}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} size="large" />
      </Card>
    </div>
  );
}
