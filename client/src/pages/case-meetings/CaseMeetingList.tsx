import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Form, Card, Row, Col, Statistic, Modal, message, DatePicker, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { caseMeetingApi, caseApi } from '../../services/api';

interface MeetingItem {
  id: string;
  meetingNumber: string;
  caseId: string;
  case?: { id: string; caseNumber: string; title: string };
  title: string;
  meetingType: string;
  status: string;
  statusLabel: string;
  location?: string;
  meetingTime?: string;
  hostName?: string;
  hostDept?: string;
  conclusion?: string;
  _count?: {
    attendees: number;
    clueRelations: number;
    evidenceRelations: number;
    todoItems: number;
  };
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const meetingTypes = [
  { label: '案情分析会', value: '案情分析会' },
  { label: '线索研判会', value: '线索研判会' },
  { label: '证据审查会', value: '证据审查会' },
  { label: '案件协调会', value: '案件协调会' },
  { label: '专案推进会', value: '专案推进会' },
  { label: '结案评审会', value: '结案评审会' },
  { label: '其他', value: '其他' },
];

export default function CaseMeetingList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState<any>({});
  const [cases, setCases] = useState<any[]>([]);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelForm] = Form.useForm();
  const [cancelingMeeting, setCancelingMeeting] = useState<any>(null);

  useEffect(() => {
    loadStats();
    loadCases();
  }, []);

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadStats = async () => {
    try {
      const res = await caseMeetingApi.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadCases = async () => {
    try {
      const res = await caseApi.list({ pageSize: 100 });
      setCases(res.data.items || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
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
      const res = await caseMeetingApi.list(params);
      const items = res.data.items.map((item: any) => ({
        ...item,
        statusLabel: statusLabels[item.status] || item.status,
      }));
      setData(items);
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
    if (values.caseId) filters.caseId = values.caseId;
    if (values.status) filters.status = values.status;
    if (values.meetingType) filters.meetingType = values.meetingType;
    if (values.hostName) filters.hostName = values.hostName;
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
  };

  const handleDelete = async (id: string) => {
    try {
      await caseMeetingApi.delete(id);
      message.success('删除成功');
      loadData();
      loadStats();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleComplete = async (record: any) => {
    try {
      await caseMeetingApi.complete(record.id);
      message.success('已完成');
      loadData();
      loadStats();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCancel = (record: any) => {
    setCancelingMeeting(record);
    cancelForm.resetFields();
    setCancelModalVisible(true);
  };

  const handleCancelSubmit = async (values: any) => {
    try {
      await caseMeetingApi.cancel(cancelingMeeting.id, { reason: values.reason });
      message.success('已取消');
      setCancelModalVisible(false);
      loadData();
      loadStats();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns: ColumnsType<MeetingItem> = [
    {
      title: '会商编号',
      dataIndex: 'meetingNumber',
      key: 'meetingNumber',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{text}</span>,
    },
    {
      title: '会商主题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/case-meetings/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'meetingType',
      key: 'meetingType',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      key: 'status',
      width: 80,
      render: (_, record) => (
        <Tag color={statusColors[record.status]}>{record.statusLabel}</Tag>
      ),
    },
    {
      title: '关联案件',
      key: 'case',
      width: 180,
      render: (_, record) => (
        record.case ? (
          <a onClick={() => navigate(`/cases/${record.caseId}`)}>
            {record.case.caseNumber}
          </a>
        ) : '-'
      ),
    },
    {
      title: '主持人',
      dataIndex: 'hostName',
      key: 'hostName',
      width: 100,
    },
    {
      title: '会商时间',
      dataIndex: 'meetingTime',
      key: 'meetingTime',
      width: 160,
      render: (text) => text ? moment(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '参会人数',
      key: 'attendees',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tag color="purple">{record._count?.attendees || 0} 人</Tag>
      ),
    },
    {
      title: '关联线索',
      key: 'clues',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tag color="orange">{record._count?.clueRelations || 0} 条</Tag>
      ),
    },
    {
      title: '关联证据',
      key: 'evidences',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tag color="green">{record._count?.evidenceRelations || 0} 份</Tag>
      ),
    },
    {
      title: '待办事项',
      key: 'todos',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tag color="blue">{record._count?.todoItems || 0} 项</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/case-meetings/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/case-meetings/${record.id}/edit`)}>
            编辑
          </Button>
          {record.status === 'DRAFT' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record)}>
              完成
            </Button>
          )}
          {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && (
            <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleCancel(record)}>
              取消
            </Button>
          )}
          <Popconfirm title="确定删除该会商纪要？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">案件会商纪要</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/case-meetings/new')}>
            新建会商
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="会商总数"
              value={stats.total || 0}
              suffix="次"
              prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="进行中"
              value={stats.inProgress || 0}
              suffix="次"
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.completed || 0}
              suffix="次"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="草稿"
              value={stats.draft || 0}
              suffix="次"
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="会商编号/主题" allowClear style={{ width: 180 }} prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="caseId" label="案件">
            <Select
              placeholder="选择案件"
              allowClear
              style={{ width: 180 }}
              showSearch
              optionFilterProp="children"
              options={cases.map(c => ({ label: `${c.caseNumber} - ${c.title}`, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部状态" allowClear style={{ width: 120 }}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <Select.Option key={value} value={value}>{label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="meetingType" label="类型">
            <Select placeholder="全部类型" allowClear style={{ width: 140 }} options={meetingTypes} />
          </Form.Item>
          <Form.Item name="hostName" label="主持人">
            <Input placeholder="主持人姓名" allowClear style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="dateRange" label="时间范围">
            <DatePicker.RangePicker style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
          }}
        />
      </Card>

      <Modal
        title="取消会商"
        open={cancelModalVisible}
        onOk={() => cancelForm.submit()}
        onCancel={() => setCancelModalVisible(false)}
        okText="确认取消"
        okButtonProps={{ danger: true }}
      >
        <Form form={cancelForm} layout="vertical">
          <Form.Item
            name="reason"
            label="取消原因"
            rules={[{ required: true, message: '请输入取消原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入取消原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
