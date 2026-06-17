import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, Form, message, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { clueApi, searchApi } from '../../services/api';

interface ClueItem {
  id: string;
  clueNumber: string;
  title: string;
  content: string;
  clueType: string;
  source: string;
  credibility: string;
  importance: string;
  status: string;
  case: { id: string; caseNumber: string; title: string } | null;
  createdAt: string;
  _count: { evidences: number; cluePersons: number };
}

const statusColors: Record<string, string> = {
  '待核实': 'default',
  '核实中': 'processing',
  '已核实': 'success',
  '已采用': 'warning',
  '已排除': 'error',
};

const credibilityColors: Record<string, string> = {
  '极高': 'red',
  '高': 'orange',
  '中等': 'blue',
  '低': 'default',
  '极低': 'default',
};

const importanceColors: Record<string, string> = {
  '关键': 'red',
  '重要': 'orange',
  '一般': 'blue',
  '次要': 'default',
};

export default function ClueList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<ClueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [options, setOptions] = useState<any>({});

  useEffect(() => {
    loadOptions();
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadOptions = async () => {
    try {
      const res = await searchApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
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
      const res = await clueApi.list(params);
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
    if (values.clueType) filters.clueType = values.clueType;
    if (values.status) filters.status = values.status;
    if (values.credibility) filters.credibility = values.credibility;
    if (values.importance) filters.importance = values.importance;
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
      await clueApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<ClueItem> = [
    {
      title: '线索编号',
      dataIndex: 'clueNumber',
      key: 'clueNumber',
      width: 140,
      render: (text) => <span style={{ color: '#1677ff', fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: '线索标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'case',
      key: 'case',
      width: 150,
      render: (caseItem) => caseItem ? (
        <a onClick={() => navigate(`/cases/${caseItem.id}`)}>{caseItem.caseNumber}</a>
      ) : <span style={{ color: '#999' }}>未关联</span>,
    },
    {
      title: '类型',
      dataIndex: 'clueType',
      key: 'clueType',
      width: 100,
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: '可信度',
      dataIndex: 'credibility',
      key: 'credibility',
      width: 80,
      render: (text) => <Tag color={credibilityColors[text]}>{text}</Tag>,
    },
    {
      title: '重要性',
      dataIndex: 'importance',
      key: 'importance',
      width: 80,
      render: (text) => <Tag color={importanceColors[text]}>{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (text) => <Tag color={statusColors[text]}>{text}</Tag>,
    },
    {
      title: '关联',
      key: 'stats',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tag color="blue">人员 {record._count.cluePersons}</Tag>
          <Tag color="orange">证据 {record._count.evidences}</Tag>
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/clues/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/clues/${record.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该线索？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
        <h2 className="page-title">线索录入</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clues/new')}>
          新增线索
        </Button>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="线索编号/标题/内容" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="clueType" label="类型">
                <Select placeholder="选择类型" allowClear options={options.clueTypes?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="status" label="状态">
                <Select placeholder="选择状态" allowClear options={options.clueStatuses?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="credibility" label="可信度">
                <Select placeholder="选择可信度" allowClear options={options.credibilities?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="importance" label="重要性">
                <Select placeholder="选择重要性" allowClear options={options.importances?.map((t: string) => ({ label: t, value: t }))} />
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
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  );
}
