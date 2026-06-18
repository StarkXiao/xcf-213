import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Input, Select, DatePicker, Tag, Popconfirm, Modal, Form, message, Card, Row, Col, Progress, Tooltip, Drawer } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  SearchOutlined as SearchIcon,
  PaperClipOutlined,
  TeamOutlined,
  SendOutlined,
  SwapOutlined,
  FlagOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { commandApi, caseApi, clueApi, evidenceApi, personApi } from '../../services/api';

const { RangePicker } = DatePicker;

export const taskTypeMap: Record<string, { label: string; color: string; icon: any }> = {
  CASE_INVESTIGATION: { label: '案件侦查', color: 'blue', icon: <FileTextOutlined /> },
  CLUE_VERIFICATION: { label: '线索核实', color: 'orange', icon: <SearchIcon /> },
  EVIDENCE_COLLECTION: { label: '证据采集', color: 'purple', icon: <PaperClipOutlined /> },
  PERSON_INTERROGATION: { label: '人员讯问', color: 'cyan', icon: <TeamOutlined /> },
  ANALYSIS_REPORT: { label: '分析报告', color: 'geekblue', icon: <FileTextOutlined /> },
  COORDINATION: { label: '协同指挥', color: 'gold', icon: <SendOutlined /> },
  OTHER: { label: '其他', color: 'default', icon: <FileTextOutlined /> },
};

export const taskStatusMap: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: '待处理', color: 'default', icon: <ClockCircleOutlined /> },
  IN_PROGRESS: { label: '进行中', color: 'processing', icon: <FlagOutlined /> },
  COMPLETED: { label: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { label: '已取消', color: 'default', icon: <CloseCircleOutlined /> },
  OVERDUE: { label: '已逾期', color: 'error', icon: <ExclamationCircleOutlined /> },
};

export const taskPriorityMap: Record<string, { label: string; color: string }> = {
  LOW: { label: '低', color: 'green' },
  MEDIUM: { label: '中', color: 'blue' },
  HIGH: { label: '高', color: 'orange' },
  URGENT: { label: '紧急', color: 'red' },
};

const relatedTypeMap: Record<string, { label: string; icon: any; color: string }> = {
  case: { label: '案件', icon: <FileTextOutlined />, color: 'blue' },
  clue: { label: '线索', icon: <SearchIcon />, color: 'orange' },
  evidence: { label: '证据', icon: <PaperClipOutlined />, color: 'purple' },
  person: { label: '人员', icon: <TeamOutlined />, color: 'cyan' },
};

interface TaskItem {
  id: string;
  taskNumber: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  status: string;
  progress: number;
  assigneeId?: string;
  assigneeName?: string;
  assigneeDept?: string;
  assignerName?: string;
  dueDate?: string;
  startDate?: string;
  completedDate?: string;
  actualStart?: string;
  case?: { id: string; caseNumber: string; title: string };
  clue?: { id: string; clueNumber: string; title: string };
  evidence?: { id: string; evidenceNumber: string; name: string };
  person?: { id: string; name: string; personType: string };
  warnings: any[];
  isOverdue: boolean;
  daysOverdue: number;
  daysRemaining: number;
  warningCount: number;
  hasWarning: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { progresses: number; flowRecords: number };
}

export default function CommandTaskList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [data, setData] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState<any>({});
  const [filters, setFilters] = useState<any>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const preSelectedType = searchParams.get('sourceType');
  const preSelectedId = searchParams.get('sourceId');

  useEffect(() => {
    loadStats();
    loadData();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (preSelectedType && preSelectedId) {
      const filterKey = `${preSelectedType.toLowerCase()}Id`;
      setFilters({ [filterKey]: preSelectedId });
      loadData({ [filterKey]: preSelectedId });
    }
  }, [preSelectedType, preSelectedId]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await commandApi.getTaskStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadData = async (extraFilters?: any) => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
        ...extraFilters,
      };
      const res = await commandApi.listTasks(params);
      setData(res.data.items);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = form.getFieldsValue();
    const newFilters: any = {};
    if (values.keyword) newFilters.keyword = values.keyword;
    if (values.taskType) newFilters.taskType = values.taskType;
    if (values.priority) newFilters.priority = values.priority;
    if (values.status) newFilters.status = values.status;
    if (values.dateRange) {
      newFilters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      newFilters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    if (values.onlyWarning) newFilters.onlyWarning = 'true';
    if (values.onlyOverdue) newFilters.onlyOverdue = 'true';

    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData(newFilters);
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData({});
  };

  const handleDelete = async (id: string) => {
    try {
      await commandApi.deleteTask(id);
      message.success('删除成功');
      loadData();
      loadStats();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getRelatedInfo = (record: TaskItem) => {
    if (record.case) return { type: 'case', data: record.case, number: record.case.caseNumber, name: record.case.title };
    if (record.clue) return { type: 'clue', data: record.clue, number: record.clue.clueNumber, name: record.clue.title };
    if (record.evidence) return { type: 'evidence', data: record.evidence, number: record.evidence.evidenceNumber, name: record.evidence.name };
    if (record.person) return { type: 'person', data: record.person, number: '', name: record.person.name };
    return null;
  };

  const columns: ColumnsType<TaskItem> = [
    {
      title: '任务编号',
      dataIndex: 'taskNumber',
      width: 140,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => navigate(`/command/tasks/${record.id}`)} style={{ fontWeight: 500 }}>
          {text}
        </a>
      ),
    },
    {
      title: '任务标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text}>
          <Space>
            {record.hasWarning && (
              <Tooltip title={record.warnings.map(w => w.description).join('\n')}>
                <ExclamationCircleOutlined style={{ color: record.isOverdue ? '#ff4d4f' : '#faad14' }} />
              </Tooltip>
            )}
            <span>{text}</span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'taskType',
      width: 100,
      render: (type) => {
        const info = taskTypeMap[type] || taskTypeMap.OTHER;
        return (
          <Tag color={info.color} icon={info.icon}>
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (priority) => {
        const info = taskPriorityMap[priority] || taskPriorityMap.MEDIUM;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const info = taskStatusMap[status] || taskStatusMap.PENDING;
        return (
          <Tag color={info.color} icon={info.icon}>
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 160,
      render: (progress, record) => (
        <Progress
          percent={progress}
          size="small"
          status={record.status === 'OVERDUE' ? 'exception' : progress === 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '关联对象',
      dataIndex: 'related',
      width: 180,
      render: (_, record) => {
        const related = getRelatedInfo(record);
        if (!related) return <Tag>无关联</Tag>;
        const typeInfo = relatedTypeMap[related.type];
        return (
          <Tooltip title={`${typeInfo.label}: ${related.name}`}>
            <Tag color={typeInfo.color} icon={typeInfo.icon}>
              {related.number || related.name}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '承办人',
      dataIndex: 'assigneeName',
      width: 100,
      render: (name, record) => (
        <Space>
          <UserOutlined />
          <span>{name || '未分派'}</span>
        </Space>
      ),
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      width: 120,
      render: (date, record) => {
        if (!date) return <span style={{ color: '#999' }}>-</span>;
        const color = record.isOverdue ? '#ff4d4f' : record.daysRemaining <= 2 ? '#faad14' : undefined;
        return (
          <Space>
            <ClockCircleOutlined style={{ color }} />
            <span style={{ color }}>{moment(date).format('YYYY-MM-DD')}</span>
            {record.isOverdue && <Tag color="red">逾期{record.daysOverdue}天</Tag>}
            {!record.isOverdue && record.daysRemaining <= 2 && <Tag color="orange">还剩{record.daysRemaining}天</Tag>}
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/command/tasks/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/command/tasks/${record.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该任务？"
            description="删除后相关进度和流转记录也会被删除"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsCards = [
    { label: '全部任务', value: stats.total || 0, color: '#1890ff', icon: <FileTextOutlined /> },
    { label: '待处理', value: stats.byStatus?.PENDING || 0, color: '#faad14', icon: <ClockCircleOutlined /> },
    { label: '进行中', value: stats.byStatus?.IN_PROGRESS || 0, color: '#1890ff', icon: <FlagOutlined /> },
    { label: '已完成', value: stats.byStatus?.COMPLETED || 0, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { label: '已逾期', value: stats.overdueCount || 0, color: '#ff4d4f', icon: <ExclamationCircleOutlined /> },
    { label: '即将到期', value: stats.nearDueCount || 0, color: '#fa8c16', icon: <BellOutlined /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        {statsCards.map((card, index) => (
          <Col span={4} key={index}>
            <Card size="small" style={{ borderRadius: '8px' }}>
              <Space align="center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: `${card.color}15`,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#262626' }}>{card.value}</div>
                  <div style={{ fontSize: '13px', color: '#8c8c8c' }}>{card.label}</div>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ borderRadius: '8px', marginBottom: '16px' }} size="small">
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword">
            <Input placeholder="搜索任务编号/标题" prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />
          </Form.Item>
          <Form.Item name="taskType">
            <Select placeholder="任务类型" style={{ width: 140 }} allowClear>
              {Object.entries(taskTypeMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>{val.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority">
            <Select placeholder="优先级" style={{ width: 120 }} allowClear>
              {Object.entries(taskPriorityMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>{val.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status">
            <Select placeholder="状态" style={{ width: 120 }} allowClear>
              {Object.entries(taskStatusMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>{val.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dateRange">
            <RangePicker placeholder={['开始日期', '结束日期']} style={{ width: 260 }} />
          </Form.Item>
          <Form.Item name="onlyOverdue" valuePropName="checked">
            <Tag color="red" style={{ cursor: 'pointer', margin: 0 }} onClick={() => {
              form.setFieldsValue({ onlyOverdue: !form.getFieldValue('onlyOverdue') });
              form.submit();
            }}>
              <ExclamationCircleOutlined /> 只看逾期
            </Tag>
          </Form.Item>
          <Form.Item name="onlyWarning" valuePropName="checked">
            <Tag color="orange" style={{ cursor: 'pointer', margin: 0 }} onClick={() => {
              form.setFieldsValue({ onlyWarning: !form.getFieldValue('onlyWarning') });
              form.submit();
            }}>
              <WarningOutlined /> 只看预警
            </Tag>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ borderRadius: '8px' }} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 500, fontSize: '16px' }}>任务列表</div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadStats(); }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/command/tasks/new')}>
              新建任务
            </Button>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1400 }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
          }}
        />
      </Card>
    </div>
  );
}
