import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Form,
  message,
  Card,
  Row,
  Col,
  DatePicker,
  Modal,
  Descriptions,
  Drawer,
  Statistic,
  Tooltip,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  SearchOutlined as ClueSearchIcon,
  PaperClipOutlined,
  TeamOutlined,
  EyeOutlined,
  HistoryOutlined,
  UserOutlined,
  ClockCircleOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { operationLogApi } from '../../services/api';

const { RangePicker } = DatePicker;

interface OperationLogItem {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  description: string | null;
  operator: string | null;
  operatorDepartment: string | null;
  beforeData: string | null;
  afterData: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  targetInfo?: {
    id: string;
    caseNumber?: string;
    clueNumber?: string;
    evidenceNumber?: string;
    title?: string;
    name?: string;
    idCard?: string;
  };
}

const targetTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode; navigatePrefix: string }> = {
  CASE: {
    label: '案件',
    color: 'geekblue',
    icon: <FileTextOutlined />,
    navigatePrefix: '/cases',
  },
  CLUE: {
    label: '线索',
    color: 'magenta',
    icon: <ClueSearchIcon />,
    navigatePrefix: '/clues',
  },
  EVIDENCE: {
    label: '证据',
    color: 'green',
    icon: <PaperClipOutlined />,
    navigatePrefix: '/evidences',
  },
  PERSON: {
    label: '人员',
    color: 'cyan',
    icon: <TeamOutlined />,
    navigatePrefix: '/persons',
  },
};

const actionConfig: Record<string, { label: string; color: string }> = {
  CREATE: { label: '创建', color: 'green' },
  UPDATE: { label: '更新', color: 'blue' },
  DELETE: { label: '删除', color: 'red' },
  VIEW: { label: '查看', color: 'purple' },
  EXPORT: { label: '导出', color: 'orange' },
  BORROW: { label: '借阅', color: 'cyan' },
  RETURN: { label: '归还', color: 'teal' },
  VERIFY: { label: '核查', color: 'magenta' },
  ASSOCIATE: { label: '关联', color: 'gold' },
  DISASSOCIATE: { label: '解除关联', color: 'default' },
};

export default function OperationLogList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<OperationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [options, setOptions] = useState<any>({});
  const [stats, setStats] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState<OperationLogItem | null>(null);
  const [diffDrawerVisible, setDiffDrawerVisible] = useState(false);

  useEffect(() => {
    loadOptions();
    loadStats();
  }, []);

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadOptions = async () => {
    try {
      const res = await operationLogApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await operationLogApi.stats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadData = async (filters?: any) => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const res = await operationLogApi.list(params);
      setData(res.data.items);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters: any = {};
    if (values.keyword) filters.keyword = values.keyword;
    if (values.targetType) filters.targetType = values.targetType;
    if (values.action) filters.action = values.action;
    if (values.operator) filters.operator = values.operator;
    if (values.dateRange && values.dateRange.length === 2) {
      filters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      filters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData(filters);
  };

  const handleReset = () => {
    form.resetFields();
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData();
    loadStats();
  };

  const handleViewDetail = async (id: string) => {
    try {
      const res = await operationLogApi.get(id);
      setCurrentLog(res.data);
      setDetailVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleViewDiff = async (log: OperationLogItem) => {
    setCurrentLog(log);
    setDiffDrawerVisible(true);
  };

  const navigateToTarget = (log: OperationLogItem) => {
    const config = targetTypeConfig[log.targetType];
    if (config) {
      navigate(`${config.navigatePrefix}/${log.targetId}`);
    }
  };

  const renderTargetInfo = (log: OperationLogItem) => {
    const config = targetTypeConfig[log.targetType];
    if (!config) return '-';

    const info = log.targetInfo;
    let numberText = '';
    let titleText = '';

    switch (log.targetType) {
      case 'CASE':
        numberText = info?.caseNumber || '';
        titleText = info?.title || '';
        break;
      case 'CLUE':
        numberText = info?.clueNumber || '';
        titleText = info?.title || '';
        break;
      case 'EVIDENCE':
        numberText = info?.evidenceNumber || '';
        titleText = info?.name || '';
        break;
      case 'PERSON':
        numberText = info?.idCard ? info.idCard.replace(/^(\d{6})\d{8}(\d{4})$/, '$1********$2') : '';
        titleText = info?.name || '';
        break;
    }

    if (!info) {
      return (
        <Tag color={config.color} icon={config.icon}>
          {config.label} (已删除)
        </Tag>
      );
    }

    return (
      <div>
        <Tag color={config.color} icon={config.icon} style={{ marginBottom: 4 }}>
          {config.label}
        </Tag>
        <div>
          <Tooltip title={`查看${config.label}详情`}>
            <a
              onClick={() => navigateToTarget(log)}
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#1677ff',
              }}
            >
              {numberText && <span style={{ fontFamily: 'monospace' }}>{numberText}</span>}
            </a>
          </Tooltip>
          {titleText && (
            <Tooltip title={titleText}>
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.65)',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: 2,
                }}
              >
                {titleText}
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  const renderActionTag = (action: string) => {
    const config = actionConfig[action] || { label: action, color: 'default' };
    return (
      <Tag color={config.color}>
        {config.label}
      </Tag>
    );
  };

  const columns: ColumnsType<OperationLogItem> = [
    {
      title: '操作对象',
      key: 'target',
      width: 200,
      render: (_, record) => renderTargetInfo(record),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (text) => renderActionTag(text),
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      render: (text) => text ? (
        <Tooltip title={text}>
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {text}
          </span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '操作人员',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
      render: (text, record) => (
        <div>
          {text ? (
            <div>
              <Space size={4}>
                <UserOutlined style={{ color: '#1677ff' }} />
                <span style={{ fontWeight: 500 }}>{text}</span>
              </Space>
              {record.operatorDepartment && (
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2, paddingLeft: 20 }}>
                  {record.operatorDepartment}
                </div>
              )}
            </div>
          ) : (
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>系统自动</span>
          )}
        </div>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (text) => (
        <div>
          <Space size={4}>
            <ClockCircleOutlined style={{ color: '#52c41a' }} />
            <span>{moment(text).format('YYYY-MM-DD HH:mm:ss')}</span>
          </Space>
        </div>
      ),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (text) => text || '-',
    },
    {
      title: '变更对比',
      key: 'diff',
      width: 100,
      render: (_, record) => (record.beforeData || record.afterData) ? (
        <Button
          type="link"
          size="small"
          icon={<DiffOutlined />}
          onClick={() => handleViewDiff(record)}
        >
          查看
        </Button>
      ) : (
        <span style={{ color: 'rgba(0,0,0,0.25)' }}>无</span>
      ),
    },
    {
      title: '操作',
      key: 'action_col',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const statsConfig = [
    { key: 'CASE', label: '案件操作', color: 'geekblue', icon: <FileTextOutlined /> },
    { key: 'CLUE', label: '线索操作', color: 'magenta', icon: <ClueSearchIcon /> },
    { key: 'EVIDENCE', label: '证据操作', color: 'green', icon: <PaperClipOutlined /> },
    { key: 'PERSON', label: '人员操作', color: 'cyan', icon: <TeamOutlined /> },
  ];

  const parseJson = (data: string | null) => {
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  };

  const renderDiffData = (title: string, data: string | null, isBefore: boolean) => {
    const parsed = parseJson(data);
    const titleColor = isBefore ? '#ff4d4f' : '#52c41a';

    if (!parsed) {
      return (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontWeight: 600,
              marginBottom: 8,
              paddingBottom: 8,
              borderBottom: `2px solid ${titleColor}`,
              color: titleColor,
            }}
          >
            {title}
          </div>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无数据" style={{ padding: '20px 0' }} />
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontWeight: 600,
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: `2px solid ${titleColor}`,
            color: titleColor,
          }}
        >
          {title}
        </div>
        <pre
          style={{
            background: '#f6f8fa',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflowX: 'auto',
            maxHeight: 300,
            overflowY: 'auto',
            lineHeight: 1.6,
          }}
        >
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </div>
    );
  };

  const renderSideBySideDiff = () => {
    const beforeData = parseJson(currentLog?.beforeData || null);
    const afterData = parseJson(currentLog?.afterData || null);

    if (!beforeData && !afterData) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无变更数据" />;
    }

    const allKeys = new Set<string>();
    if (beforeData) Object.keys(beforeData).forEach(k => allKeys.add(k));
    if (afterData) Object.keys(afterData).forEach(k => allKeys.add(k));

    const formatValue = (val: any) => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') return JSON.stringify(val);
      if (typeof val === 'string' && val.length > 100) return val.substring(0, 100) + '...';
      return String(val);
    };

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'left', width: 150 }}>
                字段
              </th>
              <th style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'left', color: '#ff4d4f' }}>
                变更前
              </th>
              <th style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'left', color: '#52c41a' }}>
                变更后
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(allKeys).map(key => {
              const beforeVal = beforeData ? beforeData[key] : undefined;
              const afterVal = afterData ? afterData[key] : undefined;
              const isChanged = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

              return (
                <tr key={key} style={{ background: isChanged ? '#fffbe6' : 'white' }}>
                  <td style={{ padding: 8, border: '1px solid #f0f0f0', fontWeight: 500 }}>
                    {key}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      border: '1px solid #f0f0f0',
                      background: isChanged ? '#fff1f0' : 'transparent',
                    }}
                  >
                    {formatValue(beforeVal)}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      border: '1px solid #f0f0f0',
                      background: isChanged ? '#f6ffed' : 'transparent',
                    }}
                  >
                    {formatValue(afterVal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space size={8}>
            <HistoryOutlined style={{ color: '#722ed1' }} />
            操作日志
          </Space>
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { handleReset(); }}>
            刷新
          </Button>
        </Space>
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', borderRadius: 8 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>操作总数</span>}
                value={stats.totalCount || 0}
                prefix={<HistoryOutlined />}
                valueStyle={{ color: '#fff' }}
              />
            </Card>
          </Col>
          {statsConfig.map(item => (
            <Col xs={24} sm={12} md={6} key={item.key}>
              <Card
                className="card-shadow"
                style={{
                  borderRadius: 8,
                  borderTop: `3px solid var(--ant-${item.color}-6)`,
                }}
              >
                <Statistic
                  title={
                    <Space size={4}>
                      <span style={{ color: `var(--ant-${item.color}-6)` }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Space>
                  }
                  value={stats.typeStats?.[item.key] || 0}
                  valueStyle={{ color: `var(--ant-${item.color}-6)` }}
                />
              </Card>
            </Col>
          ))}
          <Col xs={24} sm={12} md={6}>
            <Card className="card-shadow" style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)', borderRadius: 8 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>近30天操作</span>}
                value={stats.recentLogs || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="horizontal" onFinish={handleSearch}>
          <Row gutter={[16, 8]} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="keyword" label="关键词" style={{ marginBottom: 0 }}>
                <Input placeholder="描述/类型" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="targetType" label="对象类型" style={{ marginBottom: 0 }}>
                <Select placeholder="全部类型" allowClear>
                  {options.targetTypes?.map((t: string) => (
                    <Select.Option key={t} value={t}>
                      {targetTypeConfig[t]?.label || t}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="action" label="操作类型" style={{ marginBottom: 0 }}>
                <Select placeholder="全部操作" allowClear>
                  {options.actions?.map((a: string) => (
                    <Select.Option key={a} value={a}>
                      {actionConfig[a]?.label || a}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="operator" label="操作人员" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="选择人员"
                  allowClear
                  showSearch
                  mode={undefined}
                  filterOption={(input, option) =>
                    ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={options.operators?.map((o: string) => ({ label: o, value: o }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="dateRange" label="时间范围" style={{ marginBottom: 0 }}>
                <RangePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
                <Button onClick={handleReset} icon={<ReloadOutlined />}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="card-shadow">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 1200 }}
          onRow={(record) => ({
            onDoubleClick: () => handleViewDetail(record.id),
          })}
        />
      </Card>

      <Modal
        title={
          <Space size={8}>
            <HistoryOutlined style={{ color: '#722ed1' }} />
            操作日志详情
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={700}
        footer={[
          currentLog?.targetInfo && (
            <Button
              key="target"
              type="primary"
              onClick={() => {
                setDetailVisible(false);
                navigateToTarget(currentLog!);
              }}
            >
              查看对象详情
            </Button>
          ),
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ].filter(Boolean)}
      >
        {currentLog && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="日志ID" span={2}>
                <span style={{ fontFamily: 'monospace', color: 'rgba(0,0,0,0.45)' }}>{currentLog.id}</span>
              </Descriptions.Item>
              <Descriptions.Item label="对象类型">
                {targetTypeConfig[currentLog.targetType]?.label || currentLog.targetType}
              </Descriptions.Item>
              <Descriptions.Item label="操作类型">
                {renderActionTag(currentLog.action)}
              </Descriptions.Item>
              <Descriptions.Item label="对象ID" span={2}>
                <span style={{ fontFamily: 'monospace' }}>{currentLog.targetId}</span>
              </Descriptions.Item>
              {currentLog.targetInfo && (
                <Descriptions.Item label="对象信息" span={2}>
                  <div style={{ padding: 12, background: '#fafafa', borderRadius: 4 }}>
                    {currentLog.targetType === 'CASE' && (
                      <>
                        <div><strong>案件编号：</strong>{currentLog.targetInfo.caseNumber}</div>
                        <div><strong>案件标题：</strong>{currentLog.targetInfo.title}</div>
                      </>
                    )}
                    {currentLog.targetType === 'CLUE' && (
                      <>
                        <div><strong>线索编号：</strong>{currentLog.targetInfo.clueNumber}</div>
                        <div><strong>线索标题：</strong>{currentLog.targetInfo.title}</div>
                      </>
                    )}
                    {currentLog.targetType === 'EVIDENCE' && (
                      <>
                        <div><strong>证据编号：</strong>{currentLog.targetInfo.evidenceNumber}</div>
                        <div><strong>证据名称：</strong>{currentLog.targetInfo.name}</div>
                      </>
                    )}
                    {currentLog.targetType === 'PERSON' && (
                      <>
                        <div><strong>人员姓名：</strong>{currentLog.targetInfo.name}</div>
                        <div><strong>身份证号：</strong>{currentLog.targetInfo.idCard}</div>
                      </>
                    )}
                  </div>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="操作人员">
                {currentLog.operator || '系统自动'}
              </Descriptions.Item>
              <Descriptions.Item label="所属部门">
                {currentLog.operatorDepartment || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="操作时间">
                {moment(currentLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="IP地址">
                {currentLog.ip || '-'}
              </Descriptions.Item>
              {currentLog.userAgent && (
                <Descriptions.Item label="用户代理" span={2}>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(0,0,0,0.65)',
                    wordBreak: 'break-all',
                    maxHeight: 60,
                    overflowY: 'auto',
                  }}>
                    {currentLog.userAgent}
                  </div>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="操作描述" span={2}>
                {currentLog.description || (
                  <span style={{ color: 'rgba(0,0,0,0.25)' }}>无描述</span>
                )}
              </Descriptions.Item>
            </Descriptions>

            {(currentLog.beforeData || currentLog.afterData) && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <DiffOutlined style={{ color: '#fa8c16' }} />
                  变更数据对比
                </div>
                {renderSideBySideDiff()}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Drawer
        title={
          <Space size={8}>
            <DiffOutlined style={{ color: '#fa8c16' }} />
            变更数据详情
          </Space>
        }
        placement="right"
        width={700}
        open={diffDrawerVisible}
        onClose={() => setDiffDrawerVisible(false)}
      >
        {currentLog && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Tag color={targetTypeConfig[currentLog.targetType]?.color}>
                  {targetTypeConfig[currentLog.targetType]?.label}
                </Tag>
                {renderActionTag(currentLog.action)}
                <Tag color="purple">
                  {moment(currentLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Tag>
              </Space>
            </div>

            <div
              style={{
                fontWeight: 600,
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: '2px solid #1677ff',
                color: '#1677ff',
              }}
            >
              字段级变更对比（高亮行为变更内容）
            </div>
            {renderSideBySideDiff()}

            <div style={{ marginTop: 24 }}>
              {renderDiffData('变更前原始数据', currentLog.beforeData, true)}
              {renderDiffData('变更后原始数据', currentLog.afterData, false)}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
