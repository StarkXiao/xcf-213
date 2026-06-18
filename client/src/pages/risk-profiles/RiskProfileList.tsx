import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Table, Tag, Button, Space, Input, Select, Form, Statistic,
  Progress, message, Tooltip, Empty, Badge
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, WarningOutlined,
  ExclamationCircleOutlined, UserOutlined, FileTextOutlined, BulbOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import moment from 'moment';
import { riskProfileApi } from '../../services/api';

const { Option } = Select;

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const riskLevelConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
}> = {
  CRITICAL: {
    label: '极高风险',
    color: '#ff4d4f',
    bgColor: '#fff1f0',
    borderColor: '#ffa39e',
    progressColor: '#ff4d4f',
  },
  HIGH: {
    label: '高风险',
    color: '#fa8c16',
    bgColor: '#fff7e6',
    borderColor: '#ffd591',
    progressColor: '#fa8c16',
  },
  MEDIUM: {
    label: '中风险',
    color: '#faad14',
    bgColor: '#fffbe6',
    borderColor: '#ffe58f',
    progressColor: '#faad14',
  },
  LOW: {
    label: '低风险',
    color: '#52c41a',
    bgColor: '#f6ffed',
    borderColor: '#b7eb8f',
    progressColor: '#52c41a',
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

export default function RiskProfileList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [stats, setStats] = useState<any>({
    total: 0,
    levelCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    avgScore: 0,
    highRiskList: [],
  });

  useEffect(() => {
    loadStats();
    loadData();
  }, [pagination]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await riskProfileApi.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      if (values.keyword) params.keyword = values.keyword;
      if (values.personType) params.personType = values.personType;
      if (values.riskLevel) params.riskLevel = values.riskLevel;
      if (values.sortBy) params.sortBy = values.sortBy;
      if (values.sortOrder) params.sortOrder = values.sortOrder;

      const res = await riskProfileApi.list(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      message.error('加载风险画像列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    setTimeout(() => loadData(), 0);
  };

  const handleReset = () => {
    form.resetFields();
    setPagination({ ...pagination, current: 1 });
    setTimeout(() => loadData(), 0);
  };

  const levelPieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      name: '风险等级分布',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['65%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      data: [
        { value: stats.levelCounts.CRITICAL, name: '极高风险', itemStyle: { color: riskLevelConfig.CRITICAL.color } },
        { value: stats.levelCounts.HIGH, name: '高风险', itemStyle: { color: riskLevelConfig.HIGH.color } },
        { value: stats.levelCounts.MEDIUM, name: '中风险', itemStyle: { color: riskLevelConfig.MEDIUM.color } },
        { value: stats.levelCounts.LOW, name: '低风险', itemStyle: { color: riskLevelConfig.LOW.color } },
      ],
    }],
  };

  const columns = [
    {
      title: '人员信息',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 200,
      render: (text: string, record: any) => (
        <Space>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: personTypeColors[record.personType] === 'red' ? '#ff4d4f'
              : personTypeColors[record.personType] === 'orange' ? '#faad14'
              : personTypeColors[record.personType] === 'green' ? '#52c41a'
              : '#1677ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 16, fontWeight: 'bold',
          }}>
            {text[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{text}</div>
            <Space size={4} style={{ marginTop: 4 }}>
              <Tag color={personTypeColors[record.personType]} style={{ margin: 0 }}>
                {record.personType}
              </Tag>
              {record.idCard && (
                <span style={{ fontSize: 12, color: '#999' }}>
                  {record.idCard.slice(0, 6)}***{record.idCard.slice(-4)}
                </span>
              )}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 180,
      sorter: (a: any, b: any) => a.riskScore - b.riskScore,
      render: (level: string, record: any) => {
        const config = riskLevelConfig[level] || riskLevelConfig.LOW;
        const percent = Math.min(100, Math.round((record.riskScore / 60) * 100));
        return (
          <div>
            <Badge
              status={
                level === 'CRITICAL' ? 'error' :
                level === 'HIGH' ? 'warning' :
                level === 'MEDIUM' ? 'processing' : 'success'
              }
              text={
                <span style={{ color: config.color, fontWeight: 600 }}>
                  {config.label}
                </span>
              }
              style={{ marginBottom: 8, display: 'block' }}
            />
            <Progress
              percent={percent}
              size="small"
              strokeColor={config.progressColor}
              showInfo={false}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              风险分值: <strong style={{ color: config.color }}>{record.riskScore}</strong>
            </div>
          </div>
        );
      },
    },
    {
      title: '案件关联',
      dataIndex: 'caseCount',
      key: 'caseCount',
      width: 120,
      sorter: (a: any, b: any) => a.caseCount - b.caseCount,
      render: (count: number) => (
        <Space>
          <FileTextOutlined style={{ color: '#722ed1' }} />
          <span style={{ fontWeight: 600 }}>{count}</span>
          <span style={{ color: '#999' }}>起</span>
        </Space>
      ),
    },
    {
      title: '线索关联',
      dataIndex: 'clueCount',
      key: 'clueCount',
      width: 120,
      sorter: (a: any, b: any) => a.clueCount - b.clueCount,
      render: (count: number) => (
        <Space>
          <BulbOutlined style={{ color: '#13c2c2' }} />
          <span style={{ fontWeight: 600 }}>{count}</span>
          <span style={{ color: '#999' }}>条</span>
        </Space>
      ),
    },
    {
      title: '风险构成',
      dataIndex: 'riskBreakdown',
      key: 'riskBreakdown',
      width: 220,
      render: (breakdown: any) => (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const score = breakdown?.[key] || 0;
            const barWidth = Math.max(4, Math.min(60, score * 3));
            return (
              <Tooltip
                key={key}
                title={`${label}: ${score}分`}
                placement="top"
              >
                <div
                  style={{
                    width: barWidth,
                    height: 16,
                    background: categoryColors[key],
                    borderRadius: 2,
                    opacity: score > 0 ? 1 : 0.2,
                  }}
                />
              </Tooltip>
            );
          })}
        </div>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (tags: any[]) => (
        tags?.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {tags.slice(0, 3).map((t: any) => (
              <Tag key={t.id} color={t.color || 'default'} style={{ margin: 0 }}>
                {t.name}
              </Tag>
            ))}
            {tags.length > 3 && <Tag>+{tags.length - 3}</Tag>}
          </Space>
        ) : (
          <span style={{ color: '#ccc' }}>无</span>
        )
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/risk-profiles/${record.id}`)}
          >
            查看画像
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <WarningOutlined style={{ color: '#fa8c16' }} />
            涉案人员风险画像
          </Space>
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadStats(); loadData(); }}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card
            className="card-shadow"
            style={{
              background: `linear-gradient(135deg, ${riskLevelConfig.CRITICAL.bgColor} 0%, #fff 100%)`,
              border: `1px solid ${riskLevelConfig.CRITICAL.borderColor}`,
            }}
          >
            <Statistic
              title={
                <Space style={{ color: riskLevelConfig.CRITICAL.color }}>
                  <ExclamationCircleOutlined />
                  极高风险人员
                </Space>
              }
              value={stats.levelCounts.CRITICAL}
              suffix="人"
              valueStyle={{ color: riskLevelConfig.CRITICAL.color }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="card-shadow"
            style={{
              background: `linear-gradient(135deg, ${riskLevelConfig.HIGH.bgColor} 0%, #fff 100%)`,
              border: `1px solid ${riskLevelConfig.HIGH.borderColor}`,
            }}
          >
            <Statistic
              title={
                <Space style={{ color: riskLevelConfig.HIGH.color }}>
                  <WarningOutlined />
                  高风险人员
                </Space>
              }
              value={stats.levelCounts.HIGH}
              suffix="人"
              valueStyle={{ color: riskLevelConfig.HIGH.color }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="card-shadow"
            style={{
              background: `linear-gradient(135deg, ${riskLevelConfig.MEDIUM.bgColor} 0%, #fff 100%)`,
              border: `1px solid ${riskLevelConfig.MEDIUM.borderColor}`,
            }}
          >
            <Statistic
              title={
                <Space style={{ color: riskLevelConfig.MEDIUM.color }}>
                  <UserOutlined />
                  中风险人员
                </Space>
              }
              value={stats.levelCounts.MEDIUM}
              suffix="人"
              valueStyle={{ color: riskLevelConfig.MEDIUM.color }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="card-shadow"
            style={{
              background: `linear-gradient(135deg, ${riskLevelConfig.LOW.bgColor} 0%, #fff 100%)`,
              border: `1px solid ${riskLevelConfig.LOW.borderColor}`,
            }}
          >
            <Statistic
              title="平均风险分值"
              value={stats.avgScore}
              suffix="分"
              valueStyle={{ color: riskLevelConfig.LOW.color }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="风险等级分布" className="card-shadow" loading={statsLoading}>
            <ReactECharts option={levelPieOption} style={{ height: 240 }} />
          </Card>
        </Col>
        <Col span={16}>
          <Card
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                高风险人员预警
                <Tag color="red">需重点关注</Tag>
              </Space>
            }
            className="card-shadow"
            loading={statsLoading}
          >
            {stats.highRiskList?.length > 0 ? (
              <Space wrap size="middle">
                {stats.highRiskList.map((p: any) => (
                  <Card
                    key={p.id}
                    size="small"
                    hoverable
                    onClick={() => navigate(`/risk-profiles/${p.id}`)}
                    style={{
                      width: 220,
                      borderLeft: `4px solid ${riskLevelConfig[p.riskLevel]?.color || '#999'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: personTypeColors[p.personType] === 'red' ? '#ff4d4f' : '#1677ff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 12, fontWeight: 'bold',
                        }}>
                          {p.name[0]}
                        </div>
                        <strong>{p.name}</strong>
                        <Tag
                          color={riskLevelConfig[p.riskLevel]?.color}
                          style={{ marginLeft: 'auto' }}
                        >
                          {riskLevelConfig[p.riskLevel]?.label}
                        </Tag>
                      </Space>
                      <Space style={{ fontSize: 12, color: '#666' }}>
                        <span>风险分: <strong style={{ color: riskLevelConfig[p.riskLevel]?.color }}>{p.score}</strong></span>
                      </Space>
                      <Space style={{ fontSize: 12, color: '#999' }}>
                        <FileTextOutlined /> {p.caseCount}起案件
                        <BulbOutlined /> {p.clueCount}条线索
                      </Space>
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Empty description="暂无高风险人员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <SearchOutlined />
            筛选条件
          </Space>
        }
        className="card-shadow"
        style={{ marginBottom: 16 }}
      >
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Space wrap size="middle" style={{ width: '100%' }}>
            <Form.Item name="keyword" label="关键词" style={{ minWidth: 260 }}>
              <Input
                placeholder="姓名/身份证/手机号"
                allowClear
                prefix={<SearchOutlined />}
              />
            </Form.Item>
            <Form.Item name="personType" label="人员类型">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="嫌疑人">嫌疑人</Option>
                <Option value="受害人">受害人</Option>
                <Option value="证人">证人</Option>
                <Option value="关系人">关系人</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
            <Form.Item name="riskLevel" label="风险等级">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="CRITICAL">极高风险</Option>
                <Option value="HIGH">高风险</Option>
                <Option value="MEDIUM">中风险</Option>
                <Option value="LOW">低风险</Option>
              </Select>
            </Form.Item>
            <Form.Item name="sortBy" label="排序" initialValue="score">
              <Select style={{ width: 140 }}>
                <Option value="score">按风险分</Option>
                <Option value="cases">按案件数</Option>
                <Option value="clues">按线索数</Option>
              </Select>
            </Form.Item>
            <Form.Item name="sortOrder" label="排序方式" initialValue="desc">
              <Select style={{ width: 120 }}>
                <Option value="desc">降序</Option>
                <Option value="asc">升序</Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
                <Button onClick={handleReset} icon={<ReloadOutlined />}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card className="card-shadow">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 人`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
}
