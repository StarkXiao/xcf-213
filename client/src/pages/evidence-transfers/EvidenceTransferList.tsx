import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Form, Card, Row, Col, Statistic, Modal, message, DatePicker, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, ReloadOutlined, InboxOutlined, HistoryOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { evidenceTransferApi, evidenceApi } from '../../services/api';
import EvidenceTransferForm from './EvidenceTransferForm';

interface TransferItem {
  id: string;
  transferNumber: string;
  transferType: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  priority?: string;
  evidenceId: string;
  evidence: { id: string; evidenceNumber: string; name: string; type: string };
  caseId?: string;
  case?: { id: string; caseNumber: string; title: string };
  clueId?: string;
  clue?: { id: string; clueNumber: string; title: string };
  fromPerson?: string;
  toPerson?: string;
  applicant?: string;
  reason?: string;
  createdAt: string;
}

const transferTypeColors: Record<string, string> = {
  STORAGE_IN: 'green',
  BORROW: 'blue',
  TRANSFER: 'orange',
  RETURN: 'cyan',
  DESTROY: 'red',
  SEAL: 'purple',
  UNSEAL: 'geekblue',
};

const statusColors: Record<string, string> = {
  PENDING: 'orange',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  REJECTED: 'red',
  CANCELLED: 'default',
};

export default function EvidenceTransferList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState<any>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);

  useEffect(() => {
    loadStats();
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadStats = async () => {
    try {
      const res = await evidenceTransferApi.getStats();
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
      const res = await evidenceTransferApi.list(params);
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
    if (values.transferType) filters.transferType = values.transferType;
    if (values.status) filters.status = values.status;
    if (values.applicant) filters.applicant = values.applicant;
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
      await evidenceTransferApi.delete(id);
      message.success('删除成功');
      loadData();
      loadStats();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleCreateSuccess = () => {
    setCreateModalVisible(false);
    loadData();
    loadStats();
    message.success('创建成功');
  };

  const columns: ColumnsType<TransferItem> = [
    {
      title: '流转编号',
      dataIndex: 'transferNumber',
      key: 'transferNumber',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{text}</span>,
    },
    {
      title: '流转类型',
      dataIndex: 'typeLabel',
      key: 'transferType',
      width: 80,
      render: (_, record) => (
        <Tag color={transferTypeColors[record.transferType]}>{record.typeLabel}</Tag>
      ),
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
      title: '证据信息',
      dataIndex: 'evidence',
      key: 'evidence',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.evidence?.name}</div>
          <div style={{ fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
            {record.evidence?.evidenceNumber}
          </div>
        </div>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'case',
      key: 'case',
      width: 150,
      render: (_, record) => record.case ? (
        <a onClick={() => navigate(`/cases/${record.caseId}`)} style={{ fontSize: 12 }}>
          {record.case.caseNumber}
        </a>
      ) : '-',
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 80,
      render: (text) => text || '-',
    },
    {
      title: '流转方向',
      key: 'direction',
      width: 150,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.fromPerson || '-'}</div>
          <div style={{ color: '#1677ff', textAlign: 'center' }}>↓</div>
          <div>{record.toPerson || '-'}</div>
        </div>
      ),
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/evidence-transfers/${record.id}`)}>
            详情
          </Button>
          <Popconfirm title="确定删除该流转记录？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const transferTypeOptions = [
    { label: '入库', value: 'STORAGE_IN' },
    { label: '借阅', value: 'BORROW' },
    { label: '移交', value: 'TRANSFER' },
    { label: '归还', value: 'RETURN' },
    { label: '销毁', value: 'DESTROY' },
    { label: '封存', value: 'SEAL' },
    { label: '解封', value: 'UNSEAL' },
  ];

  const statusOptions = [
    { label: '待处理', value: 'PENDING' },
    { label: '进行中', value: 'IN_PROGRESS' },
    { label: '已完成', value: 'COMPLETED' },
    { label: '已驳回', value: 'REJECTED' },
    { label: '已取消', value: 'CANCELLED' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">证据流转与保全</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          新建流转
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="总流转数"
              value={stats.total || 0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="待处理"
              value={stats.pending || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="进行中"
              value={stats.inProgress || 0}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="已完成"
              value={stats.completed || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="编号/原因" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="transferType" label="流转类型">
                <Select placeholder="选择类型" allowClear options={transferTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="status" label="状态">
                <Select placeholder="选择状态" allowClear options={statusOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="applicant" label="申请人">
                <Input placeholder="申请人姓名" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="dateRange" label="申请时间">
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={2}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
                  <Button onClick={handleReset} icon={<ReloadOutlined />}>重置</Button>
                </Space>
              </Form.Item>
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
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <EvidenceTransferForm
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
        selectedEvidence={selectedEvidence}
      />
    </div>
  );
}
