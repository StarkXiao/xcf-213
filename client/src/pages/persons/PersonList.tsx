import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, Form, message, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { personApi, searchApi } from '../../services/api';

interface PersonItem {
  id: string;
  name: string;
  gender: string;
  age: number;
  idCard: string;
  phone: string;
  address: string;
  occupation: string;
  personType: string;
  createdAt: string;
  tags: { id: string; name: string; category: string; color?: string }[];
  _count: { casePersons: number; cluePersons: number };
}

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const categoryColors: Record<string, string> = {
  '案件类型': '#1677ff',
  '线索来源': '#52c41a',
  '关系角色': '#722ed1',
  '自定义': '#fa8c16',
};

export default function PersonList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<PersonItem[]>([]);
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
      const res = await personApi.list(params);
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
    if (values.personType) filters.personType = values.personType;
    if (values.gender) filters.gender = values.gender;
    if (values.tags && values.tags.length > 0) filters.tags = values.tags.join(',');
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
      await personApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<PersonItem> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (text, record) => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: personTypeColors[record.personType] === 'red' ? '#ff4d4f'
              : personTypeColors[record.personType] === 'orange' ? '#faad14'
              : personTypeColors[record.personType] === 'green' ? '#52c41a'
              : '#1677ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 'bold',
          }}>{text[0]}</div>
          <a onClick={() => navigate(`/persons/${record.id}`)}>{text}</a>
        </Space>
      ),
    },
    {
      title: '人员类型',
      dataIndex: 'personType',
      key: 'personType',
      width: 100,
      render: (text) => <Tag color={personTypeColors[text]}>{text}</Tag>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 220,
      render: (tags: PersonItem['tags']) => {
        if (!tags || tags.length === 0) return <span style={{ color: '#ccc' }}>-</span>;
        const display = tags.slice(0, 3);
        const extra = tags.length - 3;
        return (
          <Space size={[4, 4]} wrap>
            {display.map(t => (
              <Tag key={t.id} color={t.color || categoryColors[t.category] || 'default'} style={{ margin: 0 }}>
                {t.name}
              </Tag>
            ))}
            {extra > 0 && <Tag style={{ margin: 0 }}>+{extra}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 60,
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 60,
    },
    {
      title: '身份证号',
      dataIndex: 'idCard',
      key: 'idCard',
      width: 180,
      render: (text) => text ? <span style={{ fontFamily: 'monospace' }}>{text}</span> : '-',
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: '职业',
      dataIndex: 'occupation',
      key: 'occupation',
      width: 100,
    },
    {
      title: '关联',
      key: 'stats',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tag color="blue">案件 {record._count.casePersons}</Tag>
          <Tag color="orange">线索 {record._count.cluePersons}</Tag>
        </Space>
      ),
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
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/persons/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/persons/${record.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该人员？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tagOptions = options.tags || [];
  const groupedTags = tagOptions.reduce((acc: Record<string, any[]>, t: any) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">人员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/persons/new')}>
          新增人员
        </Button>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="姓名/身份证/电话" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="personType" label="类型">
                <Select placeholder="选择类型" allowClear options={options.personTypes?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="gender" label="性别">
                <Select placeholder="选择性别" allowClear options={options.genders?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="tags" label="标签">
                <Select
                  mode="multiple"
                  placeholder="按标签筛选"
                  allowClear
                  maxTagCount="responsive"
                  style={{ minWidth: 200 }}
                  options={Object.entries(groupedTags).map(([category, tags]: [string, any]) => ({
                    label: (
                      <span style={{ color: categoryColors[category] || '#666', fontWeight: 500 }}>
                        {category}
                      </span>
                    ),
                    options: (tags as any[]).map(t => ({
                      label: t.name,
                      value: t.id,
                    })),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={4}>
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
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
}
