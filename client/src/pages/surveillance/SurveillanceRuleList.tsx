import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Table, Tag, Button, Space, Input, Select, Form, Statistic,
  message, Tooltip, Empty, Modal, Switch, Popconfirm
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SafetyCertificateOutlined, UserOutlined, EnvironmentOutlined,
  PaperClipOutlined, BellOutlined, ExclamationCircleOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { surveillanceRuleApi } from '../../services/api';

const { Option } = Select;

const targetTypeConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  PERSON: { label: '重点人员', icon: <UserOutlined />, color: '#1677ff', bgColor: '#e6f4ff' },
  LOCATION: { label: '重点地点', icon: <EnvironmentOutlined />, color: '#722ed1', bgColor: '#f9f0ff' },
  EVIDENCE: { label: '重点证据', icon: <PaperClipOutlined />, color: '#fa8c16', bgColor: '#fff7e6' },
};

const alertLevelConfig: Record<string, { label: string; color: string }> = {
  URGENT: { label: '紧急', color: 'red' },
  HIGH: { label: '高', color: 'orange' },
  MEDIUM: { label: '中', color: 'gold' },
  LOW: { label: '低', color: 'green' },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  ACTIVE: { label: '启用', color: 'green', icon: <CheckCircleOutlined /> },
  INACTIVE: { label: '停用', color: 'default', icon: <ClockCircleOutlined /> },
  EXPIRED: { label: '已过期', color: 'red', icon: <ExclamationCircleOutlined /> },
};

export default function SurveillanceRuleList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [stats, setStats] = useState<any>({
    total: 0,
    activeRules: 0,
    inactiveRules: 0,
    expiredRules: 0,
    alertLevelCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
    targetTypeCounts: { PERSON: 0, LOCATION: 0, EVIDENCE: 0 },
    recentRules: [],
  });

  useEffect(() => {
    loadStats();
    loadData();
  }, [pagination]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await surveillanceRuleApi.getStats();
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
      if (values.targetType) params.targetType = values.targetType;
      if (values.status) params.status = values.status;
      if (values.alertLevel) params.alertLevel = values.alertLevel;

      const res = await surveillanceRuleApi.list(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      message.error('加载预警规则列表失败');
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

  const handleToggle = async (record: any, checked: boolean) => {
    try {
      await surveillanceRuleApi.toggle(record.id, { operatorName: '当前用户' });
      message.success(checked ? '规则已启用' : '规则已停用');
      loadData();
      loadStats();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await surveillanceRuleApi.delete(id);
      message.success('删除成功');
      loadData();
      loadStats();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '规则信息',
      key: 'ruleInfo',
      fixed: 'left' as const,
      width: 280,
      render: (_: any, record: any) => {
        const tConfig = targetTypeConfig[record.targetType];
        return (
          <Space>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: tConfig?.bgColor || '#f0f0f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: tConfig?.color || '#666', fontSize: 20,
            }}>
              {tConfig?.icon || <SafetyCertificateOutlined />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{record.name}</div>
              <Space size={4} style={{ marginTop: 4 }}>
                <Tag color={tConfig?.color} style={{ margin: 0 }}>
                  {tConfig?.label}
                </Tag>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {record.ruleNumber}
                </span>
                {record.targetType === 'LOCATION' && record.locationKeywords && (
                  <span style={{ fontSize: 12, color: '#722ed1' }} title={record.locationKeywords}>
                    {record.locationKeywords.length > 20
                      ? record.locationKeywords.substring(0, 20) + '...'
                      : record.locationKeywords}
                  </span>
                )}
              </Space>
            </div>
          </Space>
        );
      },
    },
    {
      title: '预警级别',
      dataIndex: 'alertLevel',
      key: 'alertLevel',
      width: 120,
      render: (level: string) => {
        const config = alertLevelConfig[level];
        return <Tag color={config?.color}>{config?.label}</Tag>;
      },
    },
    {
      title: '关联案件',
      dataIndex: 'case',
      key: 'case',
      width: 200,
      render: (caseData: any) => caseData ? (
        <Tooltip title={caseData.title}>
          <span>
            <Tag color="blue">{caseData.caseNumber}</Tag>
            {caseData.title}
          </span>
        </Tooltip>
      ) : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '触发次数',
      dataIndex: 'triggerCount',
      key: 'triggerCount',
      width: 100,
      render: (count: number) => (
        <Space>
          <BellOutlined style={{ color: count > 0 ? '#fa8c16' : '#ccc' }} />
          <strong style={{ color: count > 0 ? '#fa8c16' : '#666' }}>{count || 0}</strong>
          <span style={{ color: '#999' }}>次</span>
        </Space>
      ),
    },
    {
      title: '最近触发',
      dataIndex: 'lastTriggerTime',
      key: 'lastTriggerTime',
      width: 160,
      render: (time: string) => time ? moment(time).format('YYYY-MM-DD HH:mm') : <span style={{ color: '#ccc' }}>未触发</span>,
    },
    {
      title: '有效期',
      key: 'validPeriod',
      width: 200,
      render: (_: any, record: any) => (
        record.validFrom || record.validTo ? (
          <div style={{ fontSize: 13 }}>
            <div>起: {record.validFrom ? moment(record.validFrom).format('YYYY-MM-DD') : '不限'}</div>
            <div>止: {record.validTo ? moment(record.validTo).format('YYYY-MM-DD') : '不限'}</div>
          </div>
        ) : <span style={{ color: '#ccc' }}>长期有效</span>
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
          <Space>
            <Switch
              checked={status === 'ACTIVE'}
              onChange={(checked) => handleToggle(record, checked)}
              disabled={status === 'EXPIRED'}
              size="small"
            />
            <span style={{ color: config?.color }}>
              {config?.icon} {config?.label}
            </span>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 180,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/surveillance-rules/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<BellOutlined />}
            onClick={() => navigate(`/alerts?ruleId=${record.id}`)}
          >
            预警
          </Button>
          <Popconfirm
            title="确定删除此规则？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
            布控预警中心
          </Space>
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadStats(); loadData(); }}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/surveillance-rules/new')}
          >
            新建布控规则
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #e6f4ff 0%, #fff 100%)', border: '1px solid #91caff' }}>
            <Statistic
              title={
                <Space style={{ color: '#1677ff' }}>
                  <SafetyCertificateOutlined />
                  规则总数
                </Space>
              }
              value={stats.total}
              suffix="条"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #fff 100%)', border: '1px solid #b7eb8f' }}>
            <Statistic
              title={
                <Space style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined />
                  启用中
                </Space>
              }
              value={stats.activeRules}
              suffix="条"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #fff 100%)', border: '1px solid #adc6ff' }}>
            <Statistic
              title={
                <Space style={{ color: '#2f54eb' }}>
                  <ClockCircleOutlined />
                  已停用
                </Space>
              }
              value={stats.inactiveRules}
              suffix="条"
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #fff1f0 0%, #fff 100%)', border: '1px solid #ffa39e' }}>
            <Statistic
              title={
                <Space style={{ color: '#ff4d4f' }}>
                  <ExclamationCircleOutlined />
                  已过期
                </Space>
              }
              value={stats.expiredRules}
              suffix="条"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="布控类型分布" className="card-shadow" loading={statsLoading}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {Object.entries(targetTypeConfig).map(([type, config]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Space>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: config.bgColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: config.color, fontSize: 16,
                    }}>
                      {config.icon}
                    </div>
                    <span style={{ fontWeight: 500 }}>{config.label}</span>
                  </Space>
                  <Tag color={config.color} style={{ fontSize: 14, padding: '2px 12px' }}>
                    {stats.targetTypeCounts?.[type] || 0} 条
                  </Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="预警级别分布" className="card-shadow" loading={statsLoading}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {Object.entries(alertLevelConfig).map(([level, config]) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Space>
                    <WarningOutlined style={{ color: config.color }} />
                    <span style={{ fontWeight: 500 }}>{config.label}级预警</span>
                  </Space>
                  <Tag color={config.color} style={{ fontSize: 14, padding: '2px 12px' }}>
                    {stats.alertLevelCounts?.[level] || 0} 条
                  </Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <BellOutlined style={{ color: '#fa8c16' }} />
                预警消息
              </Space>
            }
            className="card-shadow"
            extra={
              <Button type="link" onClick={() => navigate('/alerts')}>
                查看全部
              </Button>
            }
          >
            <Button
              type="primary"
              block
              size="large"
              icon={<BellOutlined />}
              onClick={() => navigate('/alerts')}
              style={{
                background: 'linear-gradient(135deg, #fa8c16 0%, #ff4d4f 100%)',
                border: 'none',
                height: 80,
                fontSize: 18,
              }}
            >
              进入预警消息中心
            </Button>
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
                placeholder="规则名称/编号/描述"
                allowClear
                prefix={<SearchOutlined />}
              />
            </Form.Item>
            <Form.Item name="targetType" label="布控类型">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="PERSON">重点人员</Option>
                <Option value="LOCATION">重点地点</Option>
                <Option value="EVIDENCE">重点证据</Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="ACTIVE">启用中</Option>
                <Option value="INACTIVE">已停用</Option>
                <Option value="EXPIRED">已过期</Option>
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
          scroll={{ x: 1400 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条规则`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
}
