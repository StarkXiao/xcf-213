import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Tag,
  Popconfirm,
  Modal,
  Form,
  message,
  Card,
  Row,
  Col,
  Tooltip,
  AutoComplete,
  Steps,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined,
  EnvironmentOutlined,
  SearchOutlined as SearchIcon,
  CheckSquareOutlined,
  MessageOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { clueCheckFlowApi, clueApi, caseApi } from '../../services/api';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Option } = Select;

export const checkStatusMap: Record<string, { label: string; color: string }> = {
  REGISTERED: { label: '已登记', color: 'default' },
  DISPATCHED: { label: '已派发', color: 'blue' },
  VERIFYING: { label: '核实中', color: 'processing' },
  FEEDBACKED: { label: '已反馈', color: 'cyan' },
  ADOPTED: { label: '已采用', color: 'success' },
  REJECTED: { label: '已驳回', color: 'error' },
  CLOSED: { label: '已关闭', color: 'default' },
};

export const checkStageMap: Record<string, { label: string; color: string; icon: any }> = {
  REGISTER: { label: '登记', color: 'default', icon: <FileTextOutlined /> },
  DISPATCH: { label: '派发', color: 'blue', icon: <SendOutlined /> },
  VERIFY: { label: '核实', color: 'processing', icon: <SearchIcon /> },
  FEEDBACK: { label: '反馈', color: 'cyan', icon: <MessageOutlined /> },
  ADOPT: { label: '采用', color: 'success', icon: <TrophyOutlined /> },
};

export const priorityMap: Record<string, { label: string; color: string }> = {
  极高: { label: '极高', color: 'red' },
  高: { label: '高', color: 'orange' },
  中: { label: '中', color: 'blue' },
  低: { label: '低', color: 'default' },
};

interface CheckFlowItem {
  id: string;
  flowNumber: string;
  title: string;
  status: string;
  currentStage: string;
  priority?: string;
  clueId: string;
  caseId?: string;
  clue?: any;
  case?: any;
  registerUserName?: string;
  registerTime?: string;
  dispatchToUserName?: string;
  dispatchDeadline?: string;
  verifyUserName?: string;
  verifyResult?: string;
  feedbackUserName?: string;
  feedbackResult?: string;
  adoptUserName?: string;
  adoptResult?: string;
  rejectUserName?: string;
  rejectReason?: string;
  closeUserName?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { operationLogs: number };
}

export default function ClueCheckFlowList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [data, setData] = useState<CheckFlowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState<any>({});
  const [filters, setFilters] = useState<any>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [registerModal, setRegisterModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clueOptions, setClueOptions] = useState<any[]>([]);
  const [caseOptions, setCaseOptions] = useState<any[]>([]);
  const [clueLoading, setClueLoading] = useState(false);
  const [caseLoading, setCaseLoading] = useState(false);
  const [selectedClue, setSelectedClue] = useState<any>(null);

  useEffect(() => {
    loadStats();
    loadData();
    loadClueOptions();
    loadCaseOptions();
  }, [pagination.current, pagination.pageSize]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await clueCheckFlowApi.getStats();
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
      const res = await clueCheckFlowApi.list(params);
      setData(res.data.items);
      setPagination((prev) => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadClueOptions = async (keyword?: string) => {
    setClueLoading(true);
    try {
      const params: any = { page: 1, pageSize: 100 };
      if (keyword) params.keyword = keyword;
      const res = await clueApi.list(params);
      setClueOptions(res.data.items || []);
    } catch (error) {
      console.error('Failed to load clues:', error);
    } finally {
      setClueLoading(false);
    }
  };

  const loadCaseOptions = async (keyword?: string) => {
    setCaseLoading(true);
    try {
      const params: any = { page: 1, pageSize: 100 };
      if (keyword) params.keyword = keyword;
      const res = await caseApi.list(params);
      setCaseOptions(res.data.items || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setCaseLoading(false);
    }
  };

  const handleSearch = () => {
    const values = form.getFieldsValue();
    const newFilters: any = {};
    if (values.keyword) newFilters.keyword = values.keyword;
    if (values.status) newFilters.status = values.status;
    if (values.currentStage) newFilters.currentStage = values.currentStage;
    if (values.priority) newFilters.priority = values.priority;
    if (values.registerUserName) newFilters.registerUserName = values.registerUserName;
    if (values.dispatchToUserName) newFilters.dispatchToUserName = values.dispatchToUserName;
    if (values.dateRange) {
      newFilters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      newFilters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }

    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, current: 1 }));
    loadData(newFilters);
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
    loadData({});
  };

  const handleDelete = async (id: string) => {
    try {
      await clueCheckFlowApi.delete(id);
      message.success('删除成功');
      loadData();
      loadStats();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOpenRegister = () => {
    registerForm.resetFields();
    registerForm.setFieldsValue({
      registerTime: moment(),
      priority: '中',
    });
    setSelectedClue(null);
    setRegisterModal(true);
  };

  const handleClueSelect = (clueId: string) => {
    const clue = clueOptions.find((c) => c.id === clueId);
    setSelectedClue(clue || null);
    if (clue) {
      registerForm.setFieldsValue({
        title: `【线索核查】${clue.title}`,
        registerContent: clue.content,
        registerSource: clue.source,
      });
      if (clue.caseId) {
        registerForm.setFieldsValue({ caseId: clue.caseId });
      }
    }
  };

  const handleRegisterSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const data = {
        ...values,
        registerTime: values.registerTime?.format('YYYY-MM-DD HH:mm:ss'),
      };
      await clueCheckFlowApi.register(data);
      message.success('登记成功');
      setRegisterModal(false);
      registerForm.resetFields();
      setSelectedClue(null);
      loadData();
      loadStats();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '登记失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getStageProgress = (record: CheckFlowItem) => {
    const stages = ['REGISTER', 'DISPATCH', 'VERIFY', 'FEEDBACK', 'ADOPT'];
    const currentIdx = stages.indexOf(record.currentStage);
    return Math.max(0, currentIdx);
  };

  const columns: ColumnsType<CheckFlowItem> = [
    {
      title: '核查编号',
      dataIndex: 'flowNumber',
      width: 140,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => navigate(`/clue-check-flows/${record.id}`)} style={{ fontWeight: 500 }}>
          {text}
        </a>
      ),
    },
    {
      title: '核查标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text}>
          <Space>
            {record.priority && (
              <Tag color={priorityMap[record.priority]?.color || 'default'}>
                {priorityMap[record.priority]?.label || record.priority}
              </Tag>
            )}
            <span>{text}</span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '关联线索',
      dataIndex: 'clue',
      width: 160,
      render: (_, record) => (
        record.clue ? (
          <Tooltip title={record.clue.title}>
            <Tag color="orange" icon={<SearchIcon />} style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/clues/${record.clueId}`)}>
              {record.clue.clueNumber}
            </Tag>
          </Tooltip>
        ) : <Tag>-</Tag>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'case',
      width: 160,
      render: (_, record) => (
        record.case ? (
          <Tooltip title={record.case.title}>
            <Tag color="blue" icon={<FileTextOutlined />} style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/cases/${record.caseId}`)}>
              {record.case.caseNumber}
            </Tag>
          </Tooltip>
        ) : <Tag style={{ color: '#999' }}>未关联</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const info = checkStatusMap[status] || checkStatusMap.REGISTERED;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '流程进度',
      dataIndex: 'currentStage',
      width: 280,
      render: (_, record) => (
        <Steps
          size="small"
          current={getStageProgress(record)}
          status={
            record.status === 'REJECTED' || record.status === 'CLOSED'
              ? 'error'
              : record.status === 'ADOPTED'
              ? 'finish'
              : 'process'
          }
          items={Object.entries(checkStageMap).map(([key, val]) => ({
            title: val.label,
            icon: val.icon,
          }))}
        />
      ),
    },
    {
      title: '登记人/时间',
      width: 150,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: '#333' }}>
            <UserOutlined /> {record.registerUserName || '-'}
          </div>
          <div style={{ color: '#999', marginTop: 2 }}>
            {record.registerTime ? moment(record.registerTime).format('MM-DD HH:mm') : '-'}
          </div>
        </div>
      ),
    },
    {
      title: '派发/承办人',
      width: 120,
      render: (_, record) => (
        record.dispatchToUserName ? (
          <Space>
            <TeamOutlined />
            <span>{record.dispatchToUserName}</span>
          </Space>
        ) : <span style={{ color: '#999' }}>未派发</span>
      ),
    },
    {
      title: '操作留痕',
      dataIndex: ['_count', 'operationLogs'],
      width: 100,
      align: 'center',
      render: (count, record) => (
        <Tooltip title={`查看 ${count} 条操作记录`}>
          <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => navigate(`/clue-check-flows/${record.id}`)}>
            {count || 0} 条
          </Tag>
        </Tooltip>
      ),
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
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/clue-check-flows/${record.id}`)}
          >
            详情
          </Button>
          <Popconfirm
            title="确认删除该核查流程？"
            description="删除后相关操作记录也会被删除"
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
    { label: '核查总数', value: stats.total || 0, color: '#1890ff', icon: <FileTextOutlined /> },
    { label: '今日新增', value: stats.todayCount || 0, color: '#52c41a', icon: <PlusOutlined /> },
    { label: '已登记', value: stats.byStatus?.REGISTERED || 0, color: '#8c8c8c', icon: <FileTextOutlined /> },
    { label: '已派发', value: stats.byStatus?.DISPATCHED || 0, color: '#1890ff', icon: <SendOutlined /> },
    { label: '核实中', value: stats.byStatus?.VERIFYING || 0, color: '#faad14', icon: <SearchIcon /> },
    { label: '已反馈', value: stats.byStatus?.FEEDBACKED || 0, color: '#13c2c2', icon: <MessageOutlined /> },
    { label: '已采用', value: stats.byStatus?.ADOPTED || 0, color: '#52c41a', icon: <TrophyOutlined /> },
    { label: '已驳回', value: stats.byStatus?.REJECTED || 0, color: '#ff4d4f', icon: <CloseCircleOutlined /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        {statsCards.map((card, index) => (
          <Col span={3} key={index}>
            <Card size="small" style={{ borderRadius: '8px' }} loading={statsLoading}>
              <Space align="center">
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: `${card.color}15`,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#262626' }}>{card.value}</div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{card.label}</div>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ borderRadius: '8px', marginBottom: '16px' }} size="small">
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword">
            <Input placeholder="编号/标题搜索" prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />
          </Form.Item>
          <Form.Item name="status">
            <Select placeholder="状态" style={{ width: 130 }} allowClear>
              {Object.entries(checkStatusMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>
                  {val.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="currentStage">
            <Select placeholder="当前阶段" style={{ width: 130 }} allowClear>
              {Object.entries(checkStageMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>
                  {val.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority">
            <Select placeholder="优先级" style={{ width: 110 }} allowClear>
              {Object.entries(priorityMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>
                  {val.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="registerUserName">
            <Input placeholder="登记人" prefix={<UserOutlined />} style={{ width: 130 }} allowClear />
          </Form.Item>
          <Form.Item name="dispatchToUserName">
            <Input placeholder="承办人" prefix={<TeamOutlined />} style={{ width: 130 }} allowClear />
          </Form.Item>
          <Form.Item name="dateRange">
            <RangePicker placeholder={['开始', '结束']} style={{ width: 240 }} />
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
        </Form>
      </Card>

      <Card style={{ borderRadius: '8px' }} bodyStyle={{ padding: 0 }}>
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 500, fontSize: '16px' }}>线索核查闭环列表</div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadData();
                loadStats();
              }}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenRegister}>
              登记核查
            </Button>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) =>
              setPagination({ current: page, pageSize, total: pagination.total }),
          }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <CheckSquareOutlined style={{ color: '#1890ff' }} />
            登记线索核查
          </Space>
        }
        open={registerModal}
        onCancel={() => setRegisterModal(false)}
        footer={null}
        width={720}
        maskClosable={false}
      >
        <Form form={registerForm} layout="vertical" onFinish={handleRegisterSubmit}>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                name="clueId"
                label="选择线索"
                rules={[{ required: true, message: '请选择线索' }]}
              >
                <Select
                  showSearch
                  placeholder="搜索并选择要核查的线索"
                  loading={clueLoading}
                  filterOption={false}
                  onSearch={(value) => loadClueOptions(value)}
                  onSelect={handleClueSelect}
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                >
                  {clueOptions.map((clue) => (
                    <Option
                      key={clue.id}
                      value={clue.id}
                      label={`${clue.clueNumber} - ${clue.title}`}
                    >
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Space>
                          <Tag color="orange">{clue.clueNumber}</Tag>
                          <Tag color={checkStatusMap[clue.status]?.color || 'default'}>{clue.status}</Tag>
                          <span style={{ fontWeight: 500 }}>{clue.title}</span>
                        </Space>
                        <div style={{ fontSize: 12, color: '#999', paddingLeft: 4 }}>
                          来源：{clue.source} | 可信度：{clue.credibility} | 重要性：{clue.importance}
                        </div>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="核查标题"
                rules={[{ required: true, message: '请输入核查标题' }]}
              >
                <Input placeholder="请输入核查标题" maxLength={200} showCount />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <Select placeholder="请选择优先级">
                  {Object.entries(priorityMap).map(([key, val]) => (
                    <Option key={key} value={key}>
                      <Tag color={val.color}>{val.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="caseId" label="关联案件（可选）">
                <Select
                  showSearch
                  placeholder="搜索并选择关联案件"
                  loading={caseLoading}
                  filterOption={false}
                  onSearch={(value) => loadCaseOptions(value)}
                  optionFilterProp="label"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {caseOptions.map((c) => (
                    <Option key={c.id} value={c.id} label={`${c.caseNumber} - ${c.title}`}>
                      <Space>
                        <Tag color="blue">{c.caseNumber}</Tag>
                        <span>{c.title}</span>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registerSource" label="线索来源">
                <Input placeholder="线索来源/渠道" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="registerUserName" label="登记人" rules={[{ required: true, message: '请输入登记人' }]}>
                <AutoComplete
                  placeholder="请输入登记人姓名"
                  options={[]}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registerUserDept" label="登记部门">
                <Input placeholder="请输入登记部门" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="registerTime" label="登记时间" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registerLocation" label="登记地点">
                <Input placeholder="登记地点/位置" prefix={<EnvironmentOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="registerContent" label="核查内容描述" rules={[{ required: true, message: '请输入核查内容描述' }]}>
            <TextArea rows={5} placeholder="请详细描述需要核查的内容、范围、要求等" maxLength={2000} showCount />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRegisterModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<CheckCircleOutlined />}>
                确认登记
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
