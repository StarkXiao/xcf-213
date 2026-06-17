import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, Tabs, Table, Tag, message, Row, Col, DatePicker, Collapse, Empty, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined, FileTextOutlined, BulbOutlined, TeamOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { searchApi } from '../../services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

export default function AdvancedSearch() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any>({});
  const [results, setResults] = useState<any>({ cases: [], clues: [], persons: [], evidences: [] });
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const res = await searchApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const handleSearch = async (values: any) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params: any = { ...values };
      if (values.createdAt) {
        params.startDate = values.createdAt[0]?.toISOString();
        params.endDate = values.createdAt[1]?.toISOString();
        delete params.createdAt;
      }
      if (values.occurTime) {
        params.occurStartDate = values.occurTime[0]?.toISOString();
        params.occurEndDate = values.occurTime[1]?.toISOString();
        delete params.occurTime;
      }

      const res = await searchApi.advancedSearch(params);
      setResults(res.data);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setResults({ cases: [], clues: [], persons: [], evidences: [] });
    setHasSearched(false);
  };

  const caseColumns: ColumnsType<any> = [
    {
      title: '案件编号',
      dataIndex: 'caseNumber',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{text}</span>,
    },
    {
      title: '案件标题',
      dataIndex: 'title',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/cases/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '案件类型',
      dataIndex: 'caseType',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (text) => {
        const color = text === '已结案' ? 'green' : text === '侦查中' ? 'orange' : text === '已立案' ? 'blue' : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (text) => {
        const color = text === '紧急' ? 'red' : text === '高' ? 'orange' : text === '中' ? 'blue' : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '地点',
      dataIndex: 'location',
      width: 150,
    },
    {
      title: '主办人',
      dataIndex: 'caseManager',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const clueColumns: ColumnsType<any> = [
    {
      title: '线索编号',
      dataIndex: 'clueNumber',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace', color: '#fa8c16' }}>{text}</span>,
    },
    {
      title: '线索标题',
      dataIndex: 'title',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '线索类型',
      dataIndex: 'clueType',
      width: 100,
      render: (text) => <Tag color="orange">{text}</Tag>,
    },
    {
      title: '可信度',
      dataIndex: 'credibility',
      width: 80,
      render: (text) => {
        const color = text === '高' ? 'green' : text === '中' ? 'blue' : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '重要性',
      dataIndex: 'importance',
      width: 80,
      render: (text) => {
        const color = text === '高' ? 'red' : text === '中' ? 'orange' : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 100,
    },
    {
      title: '关联案件',
      dataIndex: 'caseId',
      width: 140,
      render: (_, record) => record.case ? (
        <a onClick={() => navigate(`/cases/${record.caseId}`)}>{record.case.caseNumber}</a>
      ) : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const personColumns: ColumnsType<any> = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
      render: (text, record) => (
        <a onClick={() => navigate(`/persons/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '人员类型',
      dataIndex: 'personType',
      width: 100,
      render: (text) => {
        const color = text === '嫌疑人' ? 'red' : text === '受害人' ? 'orange' : text === '证人' ? 'green' : 'blue';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 60,
    },
    {
      title: '年龄',
      dataIndex: 'age',
      width: 60,
    },
    {
      title: '身份证号',
      dataIndex: 'idCard',
      width: 180,
      render: (text) => text ? <span style={{ fontFamily: 'monospace' }}>{text}</span> : '-',
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      width: 120,
    },
    {
      title: '住址',
      dataIndex: 'address',
      width: 200,
    },
    {
      title: '职业',
      dataIndex: 'occupation',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const evidenceColumns: ColumnsType<any> = [
    {
      title: '证据编号',
      dataIndex: 'evidenceNumber',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace', color: '#722ed1' }}>{text}</span>,
    },
    {
      title: '证据名称',
      dataIndex: 'name',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/evidences/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '证据类型',
      dataIndex: 'evidenceType',
      width: 100,
      render: (text) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      width: 80,
    },
    {
      title: '收集人',
      dataIndex: 'collector',
      width: 80,
    },
    {
      title: '关联案件',
      dataIndex: 'caseId',
      width: 140,
      render: (_, record) => record.case ? (
        <a onClick={() => navigate(`/cases/${record.caseId}`)}>{record.case.caseNumber}</a>
      ) : '-',
    },
    {
      title: '关联线索',
      dataIndex: 'clueId',
      width: 140,
      render: (_, record) => record.clue ? (
        <a onClick={() => navigate(`/clues/${record.clueId}`)}>{record.clue.clueNumber}</a>
      ) : '-',
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const tabItems = [
    {
      key: 'all',
      label: (
        <Space>
          全部
          <Tag color="default">{
            (results.cases?.length || 0) +
            (results.clues?.length || 0) +
            (results.persons?.length || 0) +
            (results.evidences?.length || 0)
          }</Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {results.cases && results.cases.length > 0 && (
            <Card
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                  案件 ({results.cases.length})
                </Space>
              }
              size="small"
            >
              <Table
                columns={caseColumns}
                dataSource={results.cases}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1100 }}
              />
            </Card>
          )}
          {results.clues && results.clues.length > 0 && (
            <Card
              title={
                <Space>
                  <BulbOutlined style={{ color: '#fa8c16' }} />
                  线索 ({results.clues.length})
                </Space>
              }
              size="small"
            >
              <Table
                columns={clueColumns}
                dataSource={results.clues}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1100 }}
              />
            </Card>
          )}
          {results.persons && results.persons.length > 0 && (
            <Card
              title={
                <Space>
                  <TeamOutlined style={{ color: '#52c41a' }} />
                  人员 ({results.persons.length})
                </Space>
              }
              size="small"
            >
              <Table
                columns={personColumns}
                dataSource={results.persons}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1100 }}
              />
            </Card>
          )}
          {results.evidences && results.evidences.length > 0 && (
            <Card
              title={
                <Space>
                  <PaperClipOutlined style={{ color: '#722ed1' }} />
                  证据 ({results.evidences.length})
                </Space>
              }
              size="small"
            >
              <Table
                columns={evidenceColumns}
                dataSource={results.evidences}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1100 }}
              />
            </Card>
          )}
        </Space>
      ),
    },
    {
      key: 'cases',
      label: <Space><FileTextOutlined /> 案件 ({results.cases?.length || 0})</Space>,
      children: (
        <Table
          columns={caseColumns}
          dataSource={results.cases}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      ),
    },
    {
      key: 'clues',
      label: <Space><BulbOutlined /> 线索 ({results.clues?.length || 0})</Space>,
      children: (
        <Table
          columns={clueColumns}
          dataSource={results.clues}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      ),
    },
    {
      key: 'persons',
      label: <Space><TeamOutlined /> 人员 ({results.persons?.length || 0})</Space>,
      children: (
        <Table
          columns={personColumns}
          dataSource={results.persons}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      ),
    },
    {
      key: 'evidences',
      label: <Space><PaperClipOutlined /> 证据 ({results.evidences?.length || 0})</Space>,
      children: (
        <Table
          columns={evidenceColumns}
          dataSource={results.evidences}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      ),
    },
  ];

  const totalCount = (results.cases?.length || 0) + (results.clues?.length || 0) +
                     (results.persons?.length || 0) + (results.evidences?.length || 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">高级查询</h2>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Collapse defaultActiveKey={['1', '2', '3', '4']}>
            <Panel header="通用查询条件" key="1">
              <Row gutter={16}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="keyword" label="关键词搜索">
                    <Input placeholder="标题/编号/描述/姓名" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="caseManager" label="主办人/负责人">
                    <Input placeholder="输入姓名" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="location" label="地点/地址">
                    <Input placeholder="案发地点/住址" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="department" label="部门">
                    <Input placeholder="所属部门" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="createdAt" label="创建时间范围">
                    <RangePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="occurTime" label="案发时间范围">
                    <RangePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            <Panel header="案件条件" key="2">
              <Row gutter={16}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="caseType" label="案件类型">
                    <Select placeholder="选择类型" allowClear mode="multiple" maxTagCount={2}
                      options={options.caseTypes?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="status" label="案件状态">
                    <Select placeholder="选择状态" allowClear mode="multiple" maxTagCount={2}
                      options={options.caseStatuses?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="priority" label="优先级">
                    <Select placeholder="选择优先级" allowClear mode="multiple" maxTagCount={2}
                      options={options.priorities?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            <Panel header="线索条件" key="3">
              <Row gutter={16}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="clueType" label="线索类型">
                    <Select placeholder="选择类型" allowClear mode="multiple" maxTagCount={2}
                      options={options.clueTypes?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="source" label="线索来源">
                    <Select placeholder="选择来源" allowClear mode="multiple" maxTagCount={2}
                      options={options.clueSources?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="credibility" label="可信度">
                    <Select placeholder="选择可信度" allowClear mode="multiple" maxTagCount={2}
                      options={options.credibilities?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="importance" label="重要性">
                    <Select placeholder="选择重要性" allowClear mode="multiple" maxTagCount={2}
                      options={options.importances?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            <Panel header="人员和证据条件" key="4">
              <Row gutter={16}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="personType" label="人员类型">
                    <Select placeholder="选择类型" allowClear mode="multiple" maxTagCount={2}
                      options={options.personTypes?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="gender" label="性别">
                    <Select placeholder="选择性别" allowClear
                      options={options.genders?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="evidenceType" label="证据类型">
                    <Select placeholder="选择类型" allowClear mode="multiple" maxTagCount={2}
                      options={options.evidenceTypes?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="fileType" label="文件类型">
                    <Select placeholder="选择文件类型" allowClear mode="multiple" maxTagCount={2}
                      options={options.fileTypes?.map((t: string) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
              </Row>
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>
                开始搜索
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置条件
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {hasSearched ? (
        totalCount > 0 ? (
          <Card className="card-shadow">
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0 }}>
                搜索结果 <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>（共 {totalCount} 条）</Text>
              </Title>
            </div>
            <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
          </Card>
        ) : (
          <Card className="card-shadow">
            <Empty description="未找到匹配的结果，请调整搜索条件" />
          </Card>
        )
      ) : (
        <Card className="card-shadow">
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <SearchOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>请设置搜索条件并点击"开始搜索"</p>
          </div>
        </Card>
      )}
    </div>
  );
}
