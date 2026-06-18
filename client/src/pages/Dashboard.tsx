import { useState, useEffect } from 'react';
import { Row, Col, Card, List, Tag, Button, Space } from 'antd';
import { PlusOutlined, FileTextOutlined, SearchOutlined, TeamOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import moment from 'moment';
import { searchApi } from '../services/api';

interface StatsData {
  totals: {
    cases: number;
    clues: number;
    persons: number;
    evidences: number;
  };
  caseStats: any[];
  clueStats: any[];
  recentCases: any[];
  recentClues: any[];
  caseTrend: any[];
  clueTrend: any[];
  clueConversionRate: number;
  totalConvertedClues: number;
  evidenceTrend: any[];
  keyPersonTrend: any[];
  keyPersonStats: any[];
  keyPersonCount: number;
  hasKeyPersonTags: boolean;
}

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await searchApi.stats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const caseChartOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      name: '案件状态',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: {
        label: { show: true, fontSize: 20, fontWeight: 'bold' }
      },
      data: stats?.caseStats.map(s => ({
        value: s._count,
        name: s.status
      })) || [],
    }],
    color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'],
  };

  const clueChartOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      name: '线索状态',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: {
        label: { show: true, fontSize: 20, fontWeight: 'bold' }
      },
      data: stats?.clueStats.map(s => ({
        value: s._count,
        name: s.status
      })) || [],
    }],
    color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'],
  };

  const caseTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增案件', '侦查中', '已移送起诉', '已结案', '已撤销'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: stats?.caseTrend?.map(t => t.month) || [],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '新增案件',
        type: 'line',
        smooth: true,
        data: stats?.caseTrend?.map(t => t['新增案件']) || [],
        itemStyle: { color: '#1677ff' },
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 3 },
      },
      {
        name: '侦查中',
        type: 'line',
        smooth: true,
        data: stats?.caseTrend?.map(t => t['侦查中']) || [],
        itemStyle: { color: '#faad14' },
      },
      {
        name: '已移送起诉',
        type: 'line',
        smooth: true,
        data: stats?.caseTrend?.map(t => t['已移送起诉']) || [],
        itemStyle: { color: '#722ed1' },
      },
      {
        name: '已结案',
        type: 'line',
        smooth: true,
        data: stats?.caseTrend?.map(t => t['已结案']) || [],
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '已撤销',
        type: 'line',
        smooth: true,
        data: stats?.caseTrend?.map(t => t['已撤销']) || [],
        itemStyle: { color: '#ff4d4f' },
      },
    ],
  };

  const clueTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['已转化案件', '已核实', '已采用', '已排除'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: stats?.clueTrend?.map(t => t.month) || [],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '已转化案件',
        type: 'line',
        smooth: true,
        data: stats?.clueTrend?.map(t => t['已转化案件']) || [],
        itemStyle: { color: '#52c41a' },
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 3 },
      },
      {
        name: '已核实',
        type: 'line',
        smooth: true,
        data: stats?.clueTrend?.map(t => t['已核实']) || [],
        itemStyle: { color: '#faad14' },
      },
      {
        name: '已采用',
        type: 'line',
        smooth: true,
        data: stats?.clueTrend?.map(t => t['已采用']) || [],
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '已排除',
        type: 'line',
        smooth: true,
        data: stats?.clueTrend?.map(t => t['已排除']) || [],
        itemStyle: { color: '#ff4d4f' },
      },
    ],
  };

  const evidenceTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['已入库', '物证', '书证', '电子数据', '视听资料'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: stats?.evidenceTrend?.map(t => t.month) || [],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '已入库',
        type: 'line',
        smooth: true,
        data: stats?.evidenceTrend?.map(t => t['已入库']) || [],
        itemStyle: { color: '#52c41a' },
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 3 },
      },
      {
        name: '物证',
        type: 'line',
        smooth: true,
        data: stats?.evidenceTrend?.map(t => t['物证']) || [],
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '书证',
        type: 'line',
        smooth: true,
        data: stats?.evidenceTrend?.map(t => t['书证']) || [],
        itemStyle: { color: '#faad14' },
      },
      {
        name: '电子数据',
        type: 'line',
        smooth: true,
        data: stats?.evidenceTrend?.map(t => t['电子数据']) || [],
        itemStyle: { color: '#722ed1' },
      },
      {
        name: '视听资料',
        type: 'line',
        smooth: true,
        data: stats?.evidenceTrend?.map(t => t['视听资料']) || [],
        itemStyle: { color: '#13c2c2' },
      },
    ],
  };

  const keyPersonTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增重点人员', '累计重点人员'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: stats?.keyPersonTrend?.map(t => t.month) || [],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '新增重点人员',
        type: 'bar',
        data: stats?.keyPersonTrend?.map(t => t['新增重点人员']) || [],
        itemStyle: { color: '#1677ff' },
        barWidth: '30%',
      },
      {
        name: '累计重点人员',
        type: 'line',
        smooth: true,
        data: stats?.keyPersonTrend?.map(t => t['累计重点人员']) || [],
        itemStyle: { color: '#eb2f96' },
        lineStyle: { width: 3 },
        yAxisIndex: 0,
      },
    ],
  };

  const statCards = [
    { title: '案件总数', value: stats?.totals.cases || 0, icon: <FileTextOutlined />, color: 'case', action: () => navigate('/cases') },
    { title: '线索总数', value: stats?.totals.clues || 0, icon: <SearchOutlined />, color: 'clue', action: () => navigate('/clues') },
    { title: '人员总数', value: stats?.totals.persons || 0, icon: <TeamOutlined />, color: 'person', action: () => navigate('/persons') },
    { title: '证据总数', value: stats?.totals.evidences || 0, icon: <PaperClipOutlined />, color: 'evidence', action: () => navigate('/evidences') },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">工作台</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/cases/new')}>
            新增案件
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/clues/new')}>
            新增线索
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} md={6} key={index}>
            <div className={`stat-card ${card.color}`} onClick={card.action} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-number">{card.value}</div>
                  <div className="stat-label">{card.title}</div>
                </div>
                <div style={{ fontSize: '32px', opacity: 0.8 }}>{card.icon}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} md={12}>
          <Card title="案件状态分布" className="card-shadow" loading={loading}>
            <ReactECharts option={caseChartOption} style={{ height: '300px' }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="线索状态分布" className="card-shadow" loading={loading}>
            <ReactECharts option={clueChartOption} style={{ height: '300px' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} md={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>案件推进趋势</span>
                <Tag color="blue">近6个月新增</Tag>
              </div>
            } 
            className="card-shadow" 
            loading={loading}
          >
            <ReactECharts option={caseTrendOption} style={{ height: '280px' }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>线索转化趋势</span>
                <Tag color="green">转化率 {stats?.clueConversionRate || 0}%</Tag>
              </div>
            } 
            className="card-shadow" 
            loading={loading}
          >
            <ReactECharts option={clueTrendOption} style={{ height: '280px' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} md={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>证据入库趋势</span>
                <Tag color="cyan">近6个月入库</Tag>
              </div>
            } 
            className="card-shadow" 
            loading={loading}
          >
            <ReactECharts option={evidenceTrendOption} style={{ height: '280px' }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>重点人员变化趋势</span>
                <Tag color="magenta">共 {stats?.keyPersonCount || 0} 人</Tag>
              </div>
            } 
            className="card-shadow" 
            loading={loading}
            extra={
              stats?.hasKeyPersonTags === false ? (
                <Tag color="orange">按嫌疑人统计</Tag>
              ) : undefined
            }
          >
            <ReactECharts option={keyPersonTrendOption} style={{ height: '280px' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} md={12}>
          <Card
            title="最近案件"
            className="card-shadow"
            extra={<Button type="link" onClick={() => navigate('/cases')}>查看全部</Button>}
            loading={loading}
          >
            <List
              dataSource={stats?.recentCases || []}
              renderItem={(item) => (
                <List.Item
                  actions={[<Button type="link" onClick={() => navigate(`/cases/${item.id}`)}>详情</Button>]}
                >
                  <List.Item.Meta
                    title={<span style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${item.id}`)}>{item.title}</span>}
                    description={
                      <Space>
                        <Tag color={statusColors[item.status]}>{item.status}</Tag>
                        <Tag color={priorityColors[item.priority] || 'default'}>{item.priority}</Tag>
                        <span style={{ color: '#999', fontSize: '12px' }}>
                          {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title="最近线索"
            className="card-shadow"
            extra={<Button type="link" onClick={() => navigate('/clues')}>查看全部</Button>}
            loading={loading}
          >
            <List
              dataSource={stats?.recentClues || []}
              renderItem={(item) => (
                <List.Item
                  actions={[<Button type="link" onClick={() => navigate(`/clues/${item.id}`)}>详情</Button>]}
                >
                  <List.Item.Meta
                    title={<span style={{ cursor: 'pointer' }} onClick={() => navigate(`/clues/${item.id}`)}>{item.title}</span>}
                    description={
                      <Space>
                        <Tag color={statusColors[item.status]}>{item.status}</Tag>
                        <span style={{ color: '#999', fontSize: '12px' }}>
                          {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
