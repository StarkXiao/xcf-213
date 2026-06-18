import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, Tabs, Table, Tag, message, Row, Col, DatePicker, Collapse, Empty, Typography, Radio, Divider, List, Avatar, Tooltip, Modal, Descriptions, Statistic, Checkbox, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined, FileTextOutlined, BulbOutlined, TeamOutlined, PaperClipOutlined, EnvironmentOutlined, PhoneOutlined, BarcodeOutlined, WarningOutlined, FolderAddOutlined, FundProjectionScreenOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { searchApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

export default function AdvancedSearch() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [dedupeForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [options, setOptions] = useState<any>({});
  const [results, setResults] = useState<any>({ cases: [], clues: [], persons: [], evidences: [] });
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchMode, setSearchMode] = useState<'advanced' | 'dedupe'>('advanced');
  const [dedupeResults, setDedupeResults] = useState<any>({ persons: [], phones: [], locations: [], evidenceNumbers: [] });
  const [hasDeduped, setHasDeduped] = useState(false);
  const [dedupeActiveTab, setDedupeActiveTab] = useState('persons');
  const [createCaseModal, setCreateCaseModal] = useState(false);
  const [caseForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedClueIds, setSelectedClueIds] = useState<string[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);

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

  const handleDedupeSearch = async (values: any) => {
    setDedupeLoading(true);
    setHasDeduped(true);
    try {
      const params: any = {};
      if (values.dimensions && values.dimensions.length > 0) {
        params.dimensions = values.dimensions;
      }
      if (values.minCaseCount) {
        params.minCaseCount = values.minCaseCount;
      }
      const res = await searchApi.crossCaseDedupe(params);
      setDedupeResults(res.data);

      const dims = values.dimensions || ['persons', 'phones', 'locations', 'evidenceNumbers'];
      if (dims.length > 0) {
        setDedupeActiveTab(dims[0]);
      }
    } catch (error) {
      message.error('跨案筛重失败');
    } finally {
      setDedupeLoading(false);
    }
  };

  const handleDedupeReset = () => {
    dedupeForm.resetFields();
    setDedupeResults({ persons: [], phones: [], locations: [], evidenceNumbers: [] });
    setHasDeduped(false);
  };

  const openCreateCaseModal = () => {
    setSelectedCaseIds(results.cases?.map((c: any) => c.id) || []);
    setSelectedPersonIds(results.persons?.map((p: any) => p.id) || []);
    setSelectedClueIds(results.clues?.map((c: any) => c.id) || []);
    setSelectedEvidenceIds(results.evidences?.map((e: any) => e.id) || []);
    caseForm.resetFields();
    setCreateCaseModal(true);
  };

  const handleCreateCase = async (values: any) => {
    setCreating(true);
    try {
      const res = await searchApi.createCase({
        ...values,
        caseIds: selectedCaseIds,
        personIds: selectedPersonIds,
        clueIds: selectedClueIds,
        evidenceIds: selectedEvidenceIds,
      });
      message.success('专案创建成功');
      setCreateCaseModal(false);
      navigate(`/cases/${res.data.id}?tab=thematic`);
    } catch (error) {
      message.error('专案创建失败');
    } finally {
      setCreating(false);
    }
  };

  const getPersonTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      '嫌疑人': 'red',
      '受害人': 'orange',
      '证人': 'green',
      '关系人': 'blue',
      '其他': 'default',
    };
    return colorMap[type] || 'default';
  };

  const getCaseStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      '已结案': 'green',
      '侦查中': 'orange',
      '已立案': 'blue',
      '待立案': 'default',
      '已移送起诉': 'purple',
      '已判决': 'cyan',
      '已撤销': 'red',
    };
    return colorMap[status] || 'default';
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
      title: '收集方式',
      dataIndex: 'collectionMethod',
      width: 100,
      render: (text) => text || '-',
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

  const dedupePersonColumns: ColumnsType<any> = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 120,
      render: (text, record) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#52c41a' }}>
            {text?.charAt(0)}
          </Avatar>
          <a onClick={() => navigate(`/persons/${record.id}`)}>{text}</a>
        </Space>
      ),
    },
    {
      title: '人员类型',
      dataIndex: 'personType',
      width: 100,
      render: (text) => <Tag color={getPersonTypeColor(text)}>{text}</Tag>,
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
      width: 130,
      render: (text) => text || '-',
    },
    {
      title: '关联案件数',
      dataIndex: 'caseCount',
      width: 120,
      render: (text) => (
        <Tag color={text >= 3 ? 'red' : text >= 2 ? 'orange' : 'blue'}>
          {text} 个案件
        </Tag>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'cases',
      render: (cases) => (
        <Space wrap size={[4, 4]}>
          {cases?.map((c: any) => (
            <Tooltip key={c.id} title={c.title}>
              <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                {c.caseNumber}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
  ];

  const dedupePhoneColumns: ColumnsType<any> = [
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 150,
      render: (text) => (
        <Space>
          <PhoneOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '关联人数',
      dataIndex: 'personCount',
      width: 100,
      render: (text) => <Tag color="green">{text} 人</Tag>,
    },
    {
      title: '关联人员',
      dataIndex: 'persons',
      render: (persons) => (
        <Space wrap size={[4, 4]}>
          {persons?.map((p: any) => (
            <Tooltip key={p.id} title={p.personType}>
              <Tag color={getPersonTypeColor(p.personType)} style={{ cursor: 'pointer' }} onClick={() => navigate(`/persons/${p.id}`)}>
                {p.name}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: '关联案件数',
      dataIndex: 'caseCount',
      width: 120,
      render: (text) => (
        <Tag color={text >= 3 ? 'red' : text >= 2 ? 'orange' : 'blue'}>
          {text} 个案件
        </Tag>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'cases',
      render: (cases) => (
        <Space wrap size={[4, 4]}>
          {cases?.map((c: any) => (
            <Tooltip key={c.id} title={c.title}>
              <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                {c.caseNumber}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
  ];

  const dedupeLocationColumns: ColumnsType<any> = [
    {
      title: '地点',
      dataIndex: 'location',
      width: 250,
      render: (text) => (
        <Space>
          <EnvironmentOutlined style={{ color: '#fa8c16' }} />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '关联案件数',
      dataIndex: 'caseCount',
      width: 120,
      render: (text) => (
        <Tag color={text >= 3 ? 'red' : text >= 2 ? 'orange' : 'blue'}>
          {text} 个案件
        </Tag>
      ),
    },
    {
      title: '线索数量',
      dataIndex: 'clueCount',
      width: 100,
      render: (text) => <Tag color="orange">{text} 条</Tag>,
    },
    {
      title: '证据数量',
      dataIndex: 'evidenceCount',
      width: 100,
      render: (text) => <Tag color="purple">{text} 份</Tag>,
    },
    {
      title: '关联案件',
      dataIndex: 'cases',
      render: (cases) => (
        <Space wrap size={[4, 4]}>
          {cases?.map((c: any) => (
            <Tooltip key={c.id} title={c.title}>
              <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                {c.caseNumber}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
  ];

  const dedupeEvidenceColumns: ColumnsType<any> = [
    {
      title: '证据特征',
      dataIndex: 'evidenceNumber',
      width: 280,
      render: (text) => (
        <Space>
          <BarcodeOutlined style={{ color: '#722ed1' }} />
          <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#722ed1', fontSize: 12 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '证据条目数',
      dataIndex: 'evidenceCount',
      width: 120,
      render: (text) => <Tag color="purple">{text} 条</Tag>,
    },
    {
      title: '关联案件数',
      dataIndex: 'caseCount',
      width: 120,
      render: (text) => (
        <Tag color={text >= 3 ? 'red' : text >= 2 ? 'orange' : 'blue'}>
          {text} 个案件
        </Tag>
      ),
    },
    {
      title: '关联证据',
      dataIndex: 'evidences',
      render: (evidences) => (
        <Space wrap size={[4, 4]}>
          {evidences?.map((e: any) => (
            <Tooltip key={e.id} title={e.name}>
              <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => navigate(`/evidences/${e.id}`)}>
                {e.name}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'cases',
      render: (cases) => (
        <Space wrap size={[4, 4]}>
          {cases?.map((c: any) => (
            <Tooltip key={c.id} title={c.title}>
              <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                {c.caseNumber}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
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

  const dedupeTotalCount = (dedupeResults.persons?.length || 0) +
                          (dedupeResults.phones?.length || 0) +
                          (dedupeResults.locations?.length || 0) +
                          (dedupeResults.evidenceNumbers?.length || 0);

  const dedupeTabItems = [
    {
      key: 'persons',
      label: (
        <Space>
          <TeamOutlined style={{ color: '#52c41a' }} />
          人员碰撞
          <Tag color="green">{dedupeResults.persons?.length || 0}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={dedupePersonColumns}
          dataSource={dedupeResults.persons}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 16px' }}>
                <Title level={5} style={{ marginBottom: 8 }}>关联案件详情</Title>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
                  dataSource={record.cases}
                  renderItem={(item: any) => (
                    <List.Item>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => navigate(`/cases/${item.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Card.Meta
                          title={<span style={{ fontFamily: 'monospace' }}>{item.caseNumber}</span>}
                          description={item.title}
                        />
                        <div style={{ marginTop: 8 }}>
                          <Tag color="blue">{item.caseType}</Tag>
                          <Tag color={getCaseStatusColor(item.status)}>{item.status}</Tag>
                        </div>
                      </Card>
                    </List.Item>
                  )}
                />
              </div>
            ),
          }}
        />
      ),
    },
    {
      key: 'phones',
      label: (
        <Space>
          <PhoneOutlined style={{ color: '#1890ff' }} />
          手机号碰撞
          <Tag color="blue">{dedupeResults.phones?.length || 0}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={dedupePhoneColumns}
          dataSource={dedupeResults.phones}
          rowKey="phone"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 16px' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Title level={5} style={{ marginBottom: 8 }}>关联人员</Title>
                    <List
                      size="small"
                      dataSource={record.persons}
                      renderItem={(item: any) => (
                        <List.Item onClick={() => navigate(`/persons/${item.id}`)} style={{ cursor: 'pointer' }}>
                          <List.Item.Meta
                            avatar={<Avatar size="small" style={{ backgroundColor: '#52c41a' }}>{item.name?.charAt(0)}</Avatar>}
                            title={item.name}
                            description={
                              <Space>
                                <Tag color={getPersonTypeColor(item.personType)}>{item.personType}</Tag>
                                {item.idCard && <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.idCard}</span>}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Col>
                  <Col span={12}>
                    <Title level={5} style={{ marginBottom: 8 }}>关联案件</Title>
                    <List
                      size="small"
                      dataSource={record.cases}
                      renderItem={(item: any) => (
                        <List.Item onClick={() => navigate(`/cases/${item.id}`)} style={{ cursor: 'pointer' }}>
                          <List.Item.Meta
                            title={<span style={{ fontFamily: 'monospace' }}>{item.caseNumber}</span>}
                            description={
                              <Space>
                                <Tag color="blue">{item.caseType}</Tag>
                                <Tag color={getCaseStatusColor(item.status)}>{item.status}</Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Col>
                </Row>
              </div>
            ),
          }}
        />
      ),
    },
    {
      key: 'locations',
      label: (
        <Space>
          <EnvironmentOutlined style={{ color: '#fa8c16' }} />
          地点碰撞
          <Tag color="orange">{dedupeResults.locations?.length || 0}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={dedupeLocationColumns}
          dataSource={dedupeResults.locations}
          rowKey="location"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 16px' }}>
                <Title level={5} style={{ marginBottom: 8 }}>关联案件详情</Title>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
                  dataSource={record.cases}
                  renderItem={(item: any) => {
                    const sourceLabel = item.source === 'clue' ? '线索带出' : item.source === 'evidence' ? '证据带出' : '案件地点';
                    const sourceColor = item.source === 'clue' ? 'orange' : item.source === 'evidence' ? 'purple' : 'blue';
                    return (
                      <List.Item key={item.id}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => navigate(`/cases/${item.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ marginBottom: 4 }}>
                            <Tag color={sourceColor} style={{ fontSize: 11 }}>
                              {sourceLabel}
                            </Tag>
                          </div>
                          <Card.Meta
                            title={<span style={{ fontFamily: 'monospace' }}>{item.caseNumber}</span>}
                            description={item.title}
                          />
                          <div style={{ marginTop: 8 }}>
                            <Tag color="blue">{item.caseType}</Tag>
                            <Tag color={getCaseStatusColor(item.status)}>{item.status}</Tag>
                          </div>
                        </Card>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          }}
        />
      ),
    },
    {
      key: 'evidenceNumbers',
      label: (
        <Space>
          <BarcodeOutlined style={{ color: '#722ed1' }} />
          证据特征碰撞
          <Tag color="purple">{dedupeResults.evidenceNumbers?.length || 0}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={dedupeEvidenceColumns}
          dataSource={dedupeResults.evidenceNumbers}
          rowKey="evidenceNumber"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 16px' }}>
                <Title level={5} style={{ marginBottom: 8 }}>关联证据详情</Title>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
                  dataSource={record.evidences}
                  renderItem={(item: any) => (
                    <List.Item key={item.id}>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => navigate(`/evidences/${item.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ marginBottom: 4 }}>
                          <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#722ed1' }}>
                            {item.evidenceNumber}
                          </Text>
                        </div>
                        <Card.Meta
                          title={item.name}
                          description={
                            <Space>
                              <Tag color="purple">{item.type}</Tag>
                              <Tag color="default">{item.status}</Tag>
                            </Space>
                          }
                        />
                        {item.clue && (
                          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            关联线索：{item.clue.clueNumber}
                          </div>
                        )}
                      </Card>
                    </List.Item>
                  )}
                />
                <Divider style={{ margin: '16px 0' }} />
                <Title level={5} style={{ marginBottom: 8 }}>关联案件</Title>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
                  dataSource={record.cases}
                  renderItem={(item: any) => (
                    <List.Item>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => navigate(`/cases/${item.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Card.Meta
                          title={<span style={{ fontFamily: 'monospace' }}>{item.caseNumber}</span>}
                          description={item.title}
                        />
                        <div style={{ marginTop: 8 }}>
                          <Tag color="blue">{item.caseType}</Tag>
                          <Tag color={getCaseStatusColor(item.status)}>{item.status}</Tag>
                        </div>
                      </Card>
                    </List.Item>
                  )}
                />
              </div>
            ),
          }}
        />
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">高级查询</h2>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Radio.Group
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value)}
          size="large"
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="advanced">
            <Space>
              <SearchOutlined />
              高级搜索
            </Space>
          </Radio.Button>
          <Radio.Button value="dedupe">
            <Space>
              <WarningOutlined />
              跨案筛重
            </Space>
          </Radio.Button>
        </Radio.Group>

        {searchMode === 'advanced' && (
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
        )}

        {searchMode === 'dedupe' && (
          <Form form={dedupeForm} layout="vertical" onFinish={handleDedupeSearch} initialValues={{
            dimensions: ['persons', 'phones', 'locations', 'evidenceNumbers'],
            minCaseCount: 2,
          }}>
            <Row gutter={16}>
              <Col xs={24} sm={16}>
                <Form.Item name="dimensions" label="碰撞维度" rules={[{ required: true, message: '请选择至少一个碰撞维度' }]}>
                  <Select
                    mode="multiple"
                    placeholder="选择碰撞维度，可多选"
                    style={{ width: '100%' }}
                    options={[
                      { label: '人员碰撞', value: 'persons' },
                      { label: '手机号碰撞', value: 'phones' },
                      { label: '地点碰撞', value: 'locations' },
                      { label: '证据特征碰撞', value: 'evidenceNumbers' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="minCaseCount" label="最少关联案件数">
                  <Select
                    placeholder="选择最少案件数"
                    style={{ width: '100%' }}
                    options={[
                      { label: '2个及以上', value: 2 },
                      { label: '3个及以上', value: 3 },
                      { label: '5个及以上', value: 5 },
                      { label: '10个及以上', value: 10 },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ padding: '12px 16px', background: '#fff7e6', borderRadius: 8, marginBottom: 16 }}>
              <Space>
                <WarningOutlined style={{ color: '#fa8c16' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  跨案筛重功能可从多个维度（人员、手机号、地点、证据编号）查找跨案件的重复信息，帮助发现案件之间的潜在关联。
                </Text>
              </Space>
            </div>
            <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={dedupeLoading}>
                  开始碰撞分析
                </Button>
                <Button onClick={handleDedupeReset} icon={<ReloadOutlined />}>
                  重置条件
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>

      {searchMode === 'advanced' && (
        <>
          {hasSearched ? (
            totalCount > 0 ? (
              <Card className="card-shadow">
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Title level={5} style={{ margin: 0 }}>
                    搜索结果 <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>（共 {totalCount} 条）</Text>
                  </Title>
                  <Button
                    type="primary"
                    icon={<FolderAddOutlined />}
                    onClick={openCreateCaseModal}
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                    }}
                  >
                    一键建专案
                  </Button>
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
        </>
      )}

      {searchMode === 'dedupe' && (
        <>
          {hasDeduped ? (
            dedupeTotalCount > 0 ? (
              <Card className="card-shadow">
                <div style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    碰撞分析结果 <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>（共发现 {dedupeTotalCount} 条碰撞记录）</Text>
                  </Title>
                </div>
                <Tabs items={dedupeTabItems} activeKey={dedupeActiveTab} onChange={setDedupeActiveTab} />
              </Card>
            ) : (
              <Card className="card-shadow">
                <Empty
                  description="未发现跨案重复信息，所有维度均未检测到满足条件的碰撞记录"
                />
              </Card>
            )
          ) : (
            <Card className="card-shadow">
              <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                <WarningOutlined style={{ fontSize: 48, marginBottom: 16, color: '#fa8c16' }} />
                <p>请选择碰撞维度并点击"开始碰撞分析"</p>
                <Paragraph type="secondary" style={{ fontSize: 12, maxWidth: 400, margin: '0 auto' }}>
                  跨案筛重可帮助发现多起案件之间的关联线索，
                  包括共同涉案人员、相同联系方式、重复案发地点等。
                </Paragraph>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        title={
          <Space>
            <FundProjectionScreenOutlined style={{ color: '#667eea' }} />
            <span>一键建专案 — 汇总专题视图</span>
          </Space>
        }
        open={createCaseModal}
        onCancel={() => setCreateCaseModal(false)}
        width={900}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="将搜索结果中命中的案件、人员、线索、证据汇总为一个专案，形成专题视图"
          style={{ marginBottom: 16 }}
        />

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
              <Statistic
                title="关联案件"
                value={selectedCaseIds.length}
                suffix="个"
                prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff', fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
              <Statistic
                title="涉案人员"
                value={selectedPersonIds.length}
                suffix="人"
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
              <Statistic
                title="关联线索"
                value={selectedClueIds.length}
                suffix="条"
                prefix={<BulbOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16', fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
              <Statistic
                title="关联证据"
                value={selectedEvidenceIds.length}
                suffix="份"
                prefix={<PaperClipOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1', fontSize: 24 }}
              />
            </Card>
          </Col>
        </Row>

        <Collapse
          defaultActiveKey={['cases', 'persons', 'clues', 'evidences']}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'cases',
              label: (
                <Space>
                  <Checkbox
                    checked={selectedCaseIds.length === (results.cases?.length || 0) && (results.cases?.length || 0) > 0}
                    indeterminate={selectedCaseIds.length > 0 && selectedCaseIds.length < (results.cases?.length || 0)}
                    onChange={(e) => {
                      setSelectedCaseIds(e.target.checked ? (results.cases?.map((c: any) => c.id) || []) : []);
                    }}
                  />
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                  <span>关联案件</span>
                  <Tag color="blue">{selectedCaseIds.length}/{results.cases?.length || 0}</Tag>
                </Space>
              ),
              children: (
                <List
                  size="small"
                  dataSource={results.cases}
                  renderItem={(item: any) => (
                    <List.Item style={{ padding: '6px 0' }}>
                      <Space>
                        <Checkbox
                          checked={selectedCaseIds.includes(item.id)}
                          onChange={(e) => {
                            setSelectedCaseIds(e.target.checked
                              ? [...selectedCaseIds, item.id]
                              : selectedCaseIds.filter(id => id !== item.id));
                          }}
                        />
                        <Tag color="blue" style={{ fontFamily: 'monospace' }}>{item.caseNumber}</Tag>
                        <span>{item.title}</span>
                        <Tag>{item.caseType}</Tag>
                        <Tag color={item.status === '已结案' ? 'green' : item.status === '侦查中' ? 'orange' : 'blue'}>{item.status}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'persons',
              label: (
                <Space>
                  <Checkbox
                    checked={selectedPersonIds.length === (results.persons?.length || 0) && (results.persons?.length || 0) > 0}
                    indeterminate={selectedPersonIds.length > 0 && selectedPersonIds.length < (results.persons?.length || 0)}
                    onChange={(e) => {
                      setSelectedPersonIds(e.target.checked ? (results.persons?.map((p: any) => p.id) || []) : []);
                    }}
                  />
                  <TeamOutlined style={{ color: '#52c41a' }} />
                  <span>涉案人员</span>
                  <Tag color="green">{selectedPersonIds.length}/{results.persons?.length || 0}</Tag>
                </Space>
              ),
              children: (
                <List
                  size="small"
                  dataSource={results.persons}
                  renderItem={(item: any) => (
                    <List.Item style={{ padding: '6px 0' }}>
                      <Space>
                        <Checkbox
                          checked={selectedPersonIds.includes(item.id)}
                          onChange={(e) => {
                            setSelectedPersonIds(e.target.checked
                              ? [...selectedPersonIds, item.id]
                              : selectedPersonIds.filter(id => id !== item.id));
                          }}
                        />
                        <Avatar size="small" style={{ backgroundColor: item.personType === '嫌疑人' ? '#ff4d4f' : item.personType === '受害人' ? '#faad14' : '#52c41a' }}>
                          {item.name?.charAt(0)}
                        </Avatar>
                        <span>{item.name}</span>
                        <Tag color={getPersonTypeColor(item.personType)}>{item.personType}</Tag>
                        {item.idCard && <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#999' }}>{item.idCard}</Text>}
                        {item.phone && <Text style={{ fontSize: 12, color: '#999' }}>{item.phone}</Text>}
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'clues',
              label: (
                <Space>
                  <Checkbox
                    checked={selectedClueIds.length === (results.clues?.length || 0) && (results.clues?.length || 0) > 0}
                    indeterminate={selectedClueIds.length > 0 && selectedClueIds.length < (results.clues?.length || 0)}
                    onChange={(e) => {
                      setSelectedClueIds(e.target.checked ? (results.clues?.map((c: any) => c.id) || []) : []);
                    }}
                  />
                  <BulbOutlined style={{ color: '#fa8c16' }} />
                  <span>关联线索</span>
                  <Tag color="orange">{selectedClueIds.length}/{results.clues?.length || 0}</Tag>
                </Space>
              ),
              children: (
                <List
                  size="small"
                  dataSource={results.clues}
                  renderItem={(item: any) => (
                    <List.Item style={{ padding: '6px 0' }}>
                      <Space>
                        <Checkbox
                          checked={selectedClueIds.includes(item.id)}
                          onChange={(e) => {
                            setSelectedClueIds(e.target.checked
                              ? [...selectedClueIds, item.id]
                              : selectedClueIds.filter(id => id !== item.id));
                          }}
                        />
                        <Tag color="orange" style={{ fontFamily: 'monospace' }}>{item.clueNumber}</Tag>
                        <span>{item.title}</span>
                        <Tag color="orange">{item.clueType}</Tag>
                        {item.credibility && <Tag color={item.credibility === '高' ? 'green' : 'blue'}>可信度: {item.credibility}</Tag>}
                        {item.case && <Tag color="blue">来自: {item.case.caseNumber}</Tag>}
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'evidences',
              label: (
                <Space>
                  <Checkbox
                    checked={selectedEvidenceIds.length === (results.evidences?.length || 0) && (results.evidences?.length || 0) > 0}
                    indeterminate={selectedEvidenceIds.length > 0 && selectedEvidenceIds.length < (results.evidences?.length || 0)}
                    onChange={(e) => {
                      setSelectedEvidenceIds(e.target.checked ? (results.evidences?.map((e: any) => e.id) || []) : []);
                    }}
                  />
                  <PaperClipOutlined style={{ color: '#722ed1' }} />
                  <span>关联证据</span>
                  <Tag color="purple">{selectedEvidenceIds.length}/{results.evidences?.length || 0}</Tag>
                </Space>
              ),
              children: (
                <List
                  size="small"
                  dataSource={results.evidences}
                  renderItem={(item: any) => (
                    <List.Item style={{ padding: '6px 0' }}>
                      <Space>
                        <Checkbox
                          checked={selectedEvidenceIds.includes(item.id)}
                          onChange={(e) => {
                            setSelectedEvidenceIds(e.target.checked
                              ? [...selectedEvidenceIds, item.id]
                              : selectedEvidenceIds.filter(id => id !== item.id));
                          }}
                        />
                        <Tag color="purple" style={{ fontFamily: 'monospace' }}>{item.evidenceNumber}</Tag>
                        <span>{item.name}</span>
                        <Tag color="purple">{item.evidenceType || item.type}</Tag>
                        {item.case && <Tag color="blue">来自: {item.case.caseNumber}</Tag>}
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />

        <Card size="small" title="专案基本信息" style={{ marginBottom: 16 }}>
          <Form form={caseForm} layout="vertical" onFinish={handleCreateCase} initialValues={{
            caseType: '专案',
            priority: '高',
            status: '已立案',
          }}>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="title" label="专案标题" rules={[{ required: true, message: '请输入专案标题' }]}>
                  <Input placeholder="请输入专案标题" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="caseType" label="案件类型">
                  <Select
                    options={[
                      { label: '专案', value: '专案' },
                      ...((options.caseTypes || []) as string[]).map((t: string) => ({ label: t, value: t })),
                    ].filter((v, i, a) => a.findIndex(x => x.value === v.value) === i)}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="priority" label="优先级">
                  <Select
                    options={(options.priorities || ['特急', '紧急', '高', '中', '低'] as string[]).map((t: string) => ({ label: t, value: t }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="caseManager" label="主办人">
                  <Input placeholder="请输入主办人" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="department" label="所属部门">
                  <Select
                    placeholder="选择部门"
                    allowClear
                    options={(options.departments || []).map((t: string) => ({ label: t, value: t }))}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="description" label="专案描述">
                  <Input.TextArea rows={3} placeholder="选填，默认自动生成描述" />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setCreateCaseModal(false)}>取消</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={creating}
                  icon={<CheckCircleOutlined />}
                  disabled={selectedCaseIds.length + selectedPersonIds.length + selectedClueIds.length + selectedEvidenceIds.length === 0}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  确认创建专案
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      </Modal>
    </div>
  );
}
