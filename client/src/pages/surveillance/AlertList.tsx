import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Card, Row, Col, Table, Tag, Button, Space, Input, Select, Form, Statistic,
  message, Tooltip, Empty, Modal, DatePicker, Badge, Drawer
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, BellOutlined,
  ExclamationCircleOutlined, WarningOutlined, UserOutlined,
  EnvironmentOutlined, PaperClipOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ArrowUpOutlined, PlusOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { alertApi } from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const targetTypeConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  PERSON: { label: '人员预警', icon: <UserOutlined />, color: '#1677ff', bgColor: '#e6f4ff' },
  LOCATION: { label: '地点预警', icon: <EnvironmentOutlined />, color: '#722ed1', bgColor: '#f9f0ff' },
  EVIDENCE: { label: '证据预警', icon: <PaperClipOutlined />, color: '#fa8c16', bgColor: '#fff7e6' },
};

const alertLevelConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  URGENT: { label: '紧急', color: '#ff4d4f', bgColor: '#fff1f0' },
  HIGH: { label: '高', color: '#fa8c16', bgColor: '#fff7e6' },
  MEDIUM: { label: '中', color: '#faad14', bgColor: '#fffbe6' },
  LOW: { label: '低', color: '#52c41a', bgColor: '#f6ffed' },
};

const statusConfig: Record<string, { label: string; color: string; icon: any; status: any }> = {
  PENDING: { label: '待处置', color: 'red', icon: <ExclamationCircleOutlined />, status: 'error' },
  PROCESSING: { label: '处置中', color: 'blue', icon: <ClockCircleOutlined />, status: 'processing' },
  RESOLVED: { label: '已处置', color: 'green', icon: <CheckCircleOutlined />, status: 'success' },
  DISMISSED: { label: '已忽略', color: 'default', icon: <CloseCircleOutlined />, status: 'default' },
  ESCALATED: { label: '已升级', color: 'orange', icon: <ArrowUpOutlined />, status: 'warning' },
};

export default function AlertList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [stats, setStats] = useState<any>({
    total: 0,
    statusCounts: { PENDING: 0, PROCESSING: 0, RESOLVED: 0, DISMISSED: 0, ESCALATED: 0 },
    alertLevelCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
    targetTypeCounts: { PERSON: 0, LOCATION: 0, EVIDENCE: 0 },
    pendingAlerts: [],
  });

  useEffect(() => {
    const ruleId = searchParams.get('ruleId');
    if (ruleId) {
      form.setFieldsValue({ ruleId });
    }
  }, [location.search]);

  useEffect(() => {
    loadStats();
    loadData();
  }, [pagination]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await alertApi.getStats();
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
      if (values.status) params.status = values.status;
      if (values.alertLevel) params.alertLevel = values.alertLevel;
      if (values.targetType) params.targetType = values.targetType;
      if (values.ruleId) params.ruleId = values.ruleId;
      if (values.dateRange && values.dateRange.length === 2) {
        params.startDate = values.dateRange[0].format('YYYY-MM-DD');
        params.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      const res = await alertApi.list(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      message.error('加载预警消息列表失败');
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

  const columns = [
    {
      title: '预警级别',
      dataIndex: 'alertLevel',
      key: 'alertLevel',
      width: 100,
      fixed: 'left' as const,
      render: (level: string) => {
        const config = alertLevelConfig[level];
        return (
          <div style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: config?.bgColor,
            color: config?.color,
            fontWeight: 600,
            textAlign: 'center',
            display: 'inline-block',
            minWidth: 50,
          }}>
            <WarningOutlined style={{ marginRight: 4 }} />
            {config?.label}
          </div>
        );
      },
    },
    {
      title: '预警信息',
      key: 'alertInfo',
      width: 320,
      render: (_: any, record: any) => {
        const tConfig = targetTypeConfig[record.targetType];
        return (
          <Space>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: tConfig?.bgColor || '#f0f0f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: tConfig?.color || '#666', fontSize: 18,
            }}>
              {tConfig?.icon || <BellOutlined />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {record.title}
              </div>
              <Space size={4} style={{ marginTop: 4 }}>
                <Tag color={tConfig?.color} style={{ margin: 0 }}>
                  {tConfig?.label}
                </Tag>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {record.alertNumber}
                </span>
              </Space>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {record.content}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: '布控对象',
      key: 'target',
      width: 160,
      render: (_: any, record: any) => record.targetName || (
        <Space>
          {record.person?.name || record.evidence?.name || '-'}
        </Space>
      ),
    },
    {
      title: '关联信息',
      key: 'relatedInfo',
      width: 200,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
          {record.case && <span><Tag color="blue" style={{ margin: 0 }}>{record.case.caseNumber}</Tag> {record.case.title}</span>}
          {record.rule && <span style={{ color: '#666' }}>规则: {record.rule.name}</span>}
          {record.location && <span style={{ color: '#666' }}>地点: {record.location}</span>}
        </Space>
      ),
    },
    {
      title: '处置记录',
      dataIndex: '_count',
      key: 'disposalCount',
      width: 100,
      render: (count: any) => (
        <Space>
          <SafetyCertificateOutlined style={{ color: count?.disposals > 0 ? '#1677ff' : '#ccc' }} />
          <strong style={{ color: count?.disposals > 0 ? '#1677ff' : '#666' }}>{count?.disposals || 0}</strong>
          <span style={{ color: '#999' }}>条</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: any) => {
        const config = statusConfig[status];
        return (
          <Badge
            status={config?.status}
            text={
              <span style={{ color: config?.color === 'default' ? '#999' : undefined }}>
                {config?.icon} {config?.label}
              </span>
            }
          />
        );
      },
    },
    {
      title: '处置人',
      key: 'assignee',
      width: 120,
      render: (_: any, record: any) => (
        record.assigneeName ? (
          <Space>
            <UserOutlined style={{ color: '#1677ff' }} />
            <span>{record.assigneeName}</span>
            {record.assigneeDept && <span style={{ color: '#999', fontSize: 12 }}>({record.assigneeDept})</span>}
          </Space>
        ) : <span style={{ color: '#ccc' }}>未指派</span>
      ),
    },
    {
      title: '触发时间',
      dataIndex: 'triggerTime',
      key: 'triggerTime',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 140,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/alerts/${record.id}`)}
          >
            处置
          </Button>
        </Space>
      ),
    },
  ];

  const pendingAlerts = stats.pendingAlerts || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <BellOutlined style={{ color: '#fa8c16' }} />
            预警消息中心
          </Space>
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadStats(); loadData(); }}>
            刷新
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/surveillance-rules')}
          >
            新建布控规则
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #fff1f0 0%, #fff 100%)', border: '1px solid #ffa39e' }}>
            <Statistic
              title={
                <Space style={{ color: '#ff4d4f' }}>
                  <ExclamationCircleOutlined />
                  待处置
                </Space>
              }
              value={stats.statusCounts.PENDING}
              suffix="条"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #e6f4ff 0%, #fff 100%)', border: '1px solid #91caff' }}>
            <Statistic
              title={
                <Space style={{ color: '#1677ff' }}>
                  <ClockCircleOutlined />
                  处置中
                </Space>
              }
              value={stats.statusCounts.PROCESSING}
              suffix="条"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #fff7e6 0%, #fff 100%)', border: '1px solid #ffd591' }}>
            <Statistic
              title={
                <Space style={{ color: '#fa8c16' }}>
                  <ArrowUpOutlined />
                  已升级
                </Space>
              }
              value={stats.statusCounts.ESCALATED}
              suffix="条"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #fff 100%)', border: '1px solid #b7eb8f' }}>
            <Statistic
              title={
                <Space style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined />
                  已处置
                </Space>
              }
              value={stats.statusCounts.RESOLVED}
              suffix="条"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #fafafa 0%, #fff 100%)', border: '1px solid #d9d9d9' }}>
            <Statistic
              title={
                <Space style={{ color: '#999' }}>
                  <CloseCircleOutlined />
                  已忽略
                </Space>
              }
              value={stats.statusCounts.DISMISSED}
              suffix="条"
              valueStyle={{ color: '#999' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #f9f0ff 0%, #fff 100%)', border: '1px solid #d3adf7' }}>
            <Statistic
              title={
                <Space style={{ color: '#722ed1' }}>
                  <BellOutlined />
                  预警总数
                </Space>
              }
              value={stats.total}
              suffix="条"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {pendingAlerts.length > 0 && (
        <Card
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              待处置预警（紧急）
              <Badge count={pendingAlerts.length} style={{ backgroundColor: '#ff4d4f' }} />
            </Space>
          }
          className="card-shadow"
          style={{ marginBottom: 16, borderLeft: '4px solid #ff4d4f' }}
        >
          <Space wrap size="middle">
            {pendingAlerts.slice(0, 5).map((alert: any) => {
              const levelConfig = alertLevelConfig[alert.alertLevel];
              const tConfig = targetTypeConfig[alert.targetType];
              return (
                <Card
                  key={alert.id}
                  size="small"
                  hoverable
                  onClick={() => navigate(`/alerts/${alert.id}`)}
                  style={{
                    width: 280,
                    borderLeft: `4px solid ${levelConfig?.color || '#999'}`,
                    cursor: 'pointer',
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: tConfig?.bgColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: tConfig?.color, fontSize: 14,
                      }}>
                        {tConfig?.icon}
                      </div>
                      <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.title}
                      </strong>
                      <Tag color={levelConfig?.color} style={{ marginLeft: 'auto' }}>
                        {levelConfig?.label}
                      </Tag>
                    </Space>
                    <div style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.content}
                    </div>
                    <Space style={{ fontSize: 12, color: '#999' }}>
                      <BellOutlined /> {alert.alertNumber}
                      <span style={{ marginLeft: 'auto' }}>{moment(alert.triggerTime).format('MM-DD HH:mm')}</span>
                    </Space>
                  </Space>
                </Card>
              );
            })}
          </Space>
        </Card>
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="预警级别分布" className="card-shadow" loading={statsLoading}>
            <Space size="large" wrap>
              {Object.entries(alertLevelConfig).map(([level, config]) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: config.bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: config.color, fontSize: 20, fontWeight: 700,
                  }}>
                    {stats.alertLevelCounts?.[level] || 0}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: config.color }}>{config.label}级</div>
                    <div style={{ fontSize: 12, color: '#999' }}>预警消息</div>
                  </div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="布控类型分布" className="card-shadow" loading={statsLoading}>
            <Space size="large" wrap>
              {Object.entries(targetTypeConfig).map(([type, config]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: config.bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: config.color, fontSize: 20,
                  }}>
                    {config.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{config.label}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {stats.targetTypeCounts?.[type] || 0} 条预警
                    </div>
                  </div>
                </div>
              ))}
            </Space>
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
                placeholder="预警标题/编号/内容"
                allowClear
                prefix={<SearchOutlined />}
              />
            </Form.Item>
            <Form.Item name="status" label="处置状态">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="PENDING">待处置</Option>
                <Option value="PROCESSING">处置中</Option>
                <Option value="RESOLVED">已处置</Option>
                <Option value="DISMISSED">已忽略</Option>
                <Option value="ESCALATED">已升级</Option>
              </Select>
            </Form.Item>
            <Form.Item name="alertLevel" label="预警级别">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="URGENT">紧急</Option>
                <Option value="HIGH">高</Option>
                <Option value="MEDIUM">中</Option>
                <Option value="LOW">低</Option>
              </Select>
            </Form.Item>
            <Form.Item name="targetType" label="布控类型">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="PERSON">人员预警</Option>
                <Option value="LOCATION">地点预警</Option>
                <Option value="EVIDENCE">证据预警</Option>
              </Select>
            </Form.Item>
            <Form.Item name="dateRange" label="触发时间">
              <RangePicker />
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
          scroll={{ x: 1500 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条预警`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
}
