import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Tag,
  Card,
  Row,
  Col,
  Tooltip,
  Modal,
  Form,
  InputNumber,
  message,
  Popconfirm,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  AuditOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  ThunderboltOutlined,
  UserOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { approvalApi } from '../../services/api';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Option } = Select;

export const categoryMap: Record<string, { label: string; color: string }> = {
  CASE_FILING: { label: '案件立案', color: 'blue' },
  CLUE_ADOPT: { label: '线索采用', color: 'orange' },
  EVIDENCE_CHECKOUT: { label: '证据出库', color: 'purple' },
  EVIDENCE_DESTROY: { label: '证据销毁', color: 'red' },
  CASE_TRANSFER: { label: '案件移送', color: 'geekblue' },
  CASE_CLOSE: { label: '结案归档', color: 'green' },
  FORENSIC_IMPORT: { label: '电子取证导入', color: 'cyan' },
  OTHER: { label: '其他审批', color: 'default' },
};

export const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'gold' },
  IN_PROGRESS: { label: '审批中', color: 'blue' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
  ROLLED_BACK: { label: '已回退', color: 'orange' },
  CANCELLED: { label: '已取消', color: 'default' },
};

export const actionMap: Record<string, { label: string; color: string; icon: any }> = {
  SUBMIT: { label: '提交', color: 'blue', icon: <FileTextOutlined /> },
  APPROVE: { label: '通过', color: 'green', icon: <CheckCircleOutlined /> },
  REJECT: { label: '驳回', color: 'red', icon: <CloseCircleOutlined /> },
  ROLLBACK: { label: '回退', color: 'orange', icon: <RollbackOutlined /> },
  CANCEL: { label: '取消', color: 'default', icon: <CloseCircleOutlined /> },
  URGE: { label: '催办', color: 'gold', icon: <ThunderboltOutlined /> },
};

interface InstanceItem {
  id: string;
  instanceNumber: string;
  title: string;
  category: string;
  categoryLabel?: string;
  status: string;
  statusLabel?: string;
  currentLevel: number;
  totalLevels: number;
  targetType: string;
  targetId: string;
  targetNumber?: string;
  targetName?: string;
  applicantName?: string;
  applicantDept?: string;
  applyTime: string;
  applyReason?: string;
  isUrgent: boolean;
  urgentReason?: string;
  flow?: any;
  records?: any[];
  createdAt: string;
}

interface FlowItem {
  id: string;
  flowNumber: string;
  name: string;
  category: string;
  categoryLabel?: string;
  description?: string;
  isDefault: boolean;
  status: string;
  nodes?: any[];
  instanceCount?: number;
  operatorName?: string;
  createdAt: string;
}

export default function ApprovalList() {
  const navigate = useNavigate();
  const [filterForm] = Form.useForm();
  const [flowForm] = Form.useForm();
  const [submitForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('instances');

  const [instanceData, setInstanceData] = useState<InstanceItem[]>([]);
  const [instanceLoading, setInstanceLoading] = useState(false);
  const [instancePagination, setInstancePagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [instanceFilters, setInstanceFilters] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [flowData, setFlowData] = useState<FlowItem[]>([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowPagination, setFlowPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [flowModal, setFlowModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [flowSubmitting, setFlowSubmitting] = useState(false);
  const [submitSubmitting, setSubmitSubmitting] = useState(false);
  const [flowNodes, setFlowNodes] = useState<any[]>([{ level: 1, name: '', approverRole: '', isRequired: true }]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [selectedFlowNodes, setSelectedFlowNodes] = useState<any[]>([]);
  const [flowOptions, setFlowOptions] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadInstances();
    loadFlows();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await approvalApi.getInstanceStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadInstances = async (extraFilters?: any) => {
    setInstanceLoading(true);
    try {
      const params = {
        page: instancePagination.current,
        pageSize: instancePagination.pageSize,
        ...instanceFilters,
        ...extraFilters,
      };
      const res = await approvalApi.listInstances(params);
      setInstanceData(res.data.items);
      setInstancePagination((prev) => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载审批列表失败');
    } finally {
      setInstanceLoading(false);
    }
  };

  const loadFlows = async () => {
    setFlowLoading(true);
    try {
      const res = await approvalApi.listFlows({ page: flowPagination.current, pageSize: flowPagination.pageSize });
      setFlowData(res.data.items);
      setFlowPagination((prev) => ({ ...prev, total: res.data.total }));
      setFlowOptions(res.data.items.filter((f: any) => f.status === '启用').map((f: any) => ({
        value: f.id,
        label: `${f.name} (${categoryMap[f.category]?.label || f.category})`,
        ...f,
      })));
    } catch (error) {
      message.error('加载审批流程失败');
    } finally {
      setFlowLoading(false);
    }
  };

  const handleInstanceSearch = () => {
    const values = filterForm.getFieldsValue();
    const newFilters: any = {};
    if (values.keyword) newFilters.keyword = values.keyword;
    if (values.category) newFilters.category = values.category;
    if (values.status) newFilters.status = values.status;
    if (values.applicantName) newFilters.applicantName = values.applicantName;
    if (values.dateRange) {
      newFilters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      newFilters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    setInstanceFilters(newFilters);
    setInstancePagination((prev) => ({ ...prev, current: 1 }));
    loadInstances(newFilters);
  };

  const handleInstanceReset = () => {
    filterForm.resetFields();
    setInstanceFilters({});
    setInstancePagination((prev) => ({ ...prev, current: 1 }));
    loadInstances({});
  };

  const handleDeleteFlow = async (id: string) => {
    try {
      await approvalApi.deleteFlow(id);
      message.success('删除成功');
      loadFlows();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '删除失败');
    }
  };

  const handleFlowSubmit = async (values: any) => {
    setFlowSubmitting(true);
    try {
      const data = {
        ...values,
        nodes: flowNodes.filter((n) => n.name),
      };
      if (data.nodes.length === 0) {
        message.error('至少需要一个审批节点');
        return;
      }
      await approvalApi.createFlow(data);
      message.success('创建审批流程成功');
      setFlowModal(false);
      flowForm.resetFields();
      setFlowNodes([{ level: 1, name: '', approverRole: '', isRequired: true }]);
      loadFlows();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '创建失败');
    } finally {
      setFlowSubmitting(false);
    }
  };

  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
    const flow = flowOptions.find((f: any) => f.value === flowId);
    if (flow?.nodes) {
      setSelectedFlowNodes(flow.nodes);
    }
  };

  const handleSubmitInstance = async (values: any) => {
    setSubmitSubmitting(true);
    try {
      const data = {
        ...values,
        flowId: selectedFlowId,
      };
      await approvalApi.submitInstance(data);
      message.success('提交审批申请成功');
      setSubmitModal(false);
      submitForm.resetFields();
      setSelectedFlowId('');
      setSelectedFlowNodes([]);
      loadInstances();
      loadStats();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '提交失败');
    } finally {
      setSubmitSubmitting(false);
    }
  };

  const addFlowNode = () => {
    setFlowNodes([...flowNodes, { level: flowNodes.length + 1, name: '', approverRole: '', isRequired: true }]);
  };

  const removeFlowNode = (index: number) => {
    if (flowNodes.length <= 1) return;
    const updated = flowNodes.filter((_, i) => i !== index).map((n, i) => ({ ...n, level: i + 1 }));
    setFlowNodes(updated);
  };

  const updateFlowNode = (index: number, field: string, value: any) => {
    const updated = [...flowNodes];
    updated[index] = { ...updated[index], [field]: value };
    setFlowNodes(updated);
  };

  const instanceColumns: ColumnsType<InstanceItem> = [
    {
      title: '审批编号',
      dataIndex: 'instanceNumber',
      width: 150,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => navigate(`/approvals/${record.id}`)} style={{ fontWeight: 500 }}>
          {text}
        </a>
      ),
    },
    {
      title: '审批标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <Space>
          {record.isUrgent && <Tag color="red" icon={<ThunderboltOutlined />}>加急</Tag>}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '审批类别',
      dataIndex: 'category',
      width: 120,
      render: (category) => {
        const info = categoryMap[category] || categoryMap.OTHER;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '审批状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || statusMap.PENDING;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '审批进度',
      width: 180,
      render: (_, record) => {
        const progress = record.totalLevels > 0
          ? `${Math.min(record.currentLevel, record.totalLevels)}/${record.totalLevels}`
          : '-';
        const percent = record.totalLevels > 0
          ? Math.round((Math.min(record.currentLevel, record.totalLevels) / record.totalLevels) * 100)
          : 0;
        return (
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>第{record.currentLevel}级 {progress}</div>
            <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: record.status === 'REJECTED' ? '#ff4d4f' :
                  record.status === 'APPROVED' ? '#52c41a' : '#1890ff',
                borderRadius: 4,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        );
      },
    },
    {
      title: '目标对象',
      width: 160,
      render: (_, record) => (
        record.targetName ? (
          <Tooltip title={`${record.targetType}: ${record.targetId}`}>
            <Tag color="blue">{record.targetNumber || record.targetName}</Tag>
          </Tooltip>
        ) : <span style={{ color: '#999' }}>-</span>
      ),
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      width: 100,
      render: (name) => name ? <Space><UserOutlined />{name}</Space> : '-',
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/approvals/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  const flowColumns: ColumnsType<FlowItem> = [
    {
      title: '流程编号',
      dataIndex: 'flowNumber',
      width: 140,
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '流程名称',
      dataIndex: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '审批类别',
      dataIndex: 'category',
      width: 120,
      render: (category) => {
        const info = categoryMap[category] || categoryMap.OTHER;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '审批级数',
      width: 100,
      render: (_, record) => record.nodes?.length || 0,
    },
    {
      title: '实例数',
      dataIndex: 'instanceCount',
      width: 80,
      align: 'center',
    },
    {
      title: '默认流程',
      dataIndex: 'isDefault',
      width: 80,
      render: (v) => v ? <Tag color="blue">默认</Tag> : <Tag>普通</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v) => <Tag color={v === '启用' ? 'green' : 'default'}>{v}</Tag>,
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
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="确认删除该审批流程？"
          onConfirm={() => handleDeleteFlow(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  const statsCards = [
    { label: '审批总数', value: stats.total || 0, color: '#1890ff', icon: <AuditOutlined /> },
    { label: '待审批', value: stats.pending || 0, color: '#faad14', icon: <ClockCircleOutlined /> },
    { label: '审批中', value: stats.inProgress || 0, color: '#1890ff', icon: <ApartmentOutlined /> },
    { label: '已通过', value: stats.approved || 0, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { label: '已驳回', value: stats.rejected || 0, color: '#ff4d4f', icon: <CloseCircleOutlined /> },
    { label: '已回退', value: stats.rolledBack || 0, color: '#fa8c16', icon: <RollbackOutlined /> },
    { label: '今日新增', value: stats.todayCount || 0, color: '#13c2c2', icon: <PlusOutlined /> },
    { label: '加急待办', value: stats.urgentCount || 0, color: '#ff4d4f', icon: <ThunderboltOutlined /> },
  ];

  const instancesTab = {
    key: 'instances',
    label: (
      <Space>
        <AuditOutlined />
        审批实例
      </Space>
    ),
    children: (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {statsCards.map((card, index) => (
            <Col span={3} key={index}>
              <Card size="small" style={{ borderRadius: 8 }} loading={statsLoading}>
                <Space align="center">
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${card.color}15`,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    {card.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#262626' }}>{card.value}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{card.label}</div>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Form form={filterForm} layout="inline" onFinish={handleInstanceSearch}>
            <Form.Item name="keyword">
              <Input placeholder="编号/标题搜索" prefix={<SearchOutlined />} style={{ width: 180 }} allowClear />
            </Form.Item>
            <Form.Item name="category">
              <Select placeholder="审批类别" style={{ width: 130 }} allowClear>
                {Object.entries(categoryMap).map(([key, val]) => (
                  <Option key={key} value={key}>{val.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="status">
              <Select placeholder="审批状态" style={{ width: 120 }} allowClear>
                {Object.entries(statusMap).map(([key, val]) => (
                  <Option key={key} value={key}>{val.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="applicantName">
              <Input placeholder="申请人" prefix={<UserOutlined />} style={{ width: 120 }} allowClear />
            </Form.Item>
            <Form.Item name="dateRange">
              <RangePicker placeholder={['开始', '结束']} style={{ width: 240 }} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
                <Button onClick={handleInstanceReset} icon={<ReloadOutlined />}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
          <div style={{
            padding: 16,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 500, fontSize: 16 }}>审批实例列表</span>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => { loadInstances(); loadStats(); }}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { submitForm.resetFields(); setSelectedFlowId(''); setSelectedFlowNodes([]); setSubmitModal(true); }}>
                提交审批
              </Button>
            </Space>
          </div>
          <Table
            rowKey="id"
            columns={instanceColumns}
            dataSource={instanceData}
            loading={instanceLoading}
            scroll={{ x: 1400 }}
            pagination={{
              ...instancePagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setInstancePagination({ current: page, pageSize, total: instancePagination.total });
              },
            }}
          />
        </Card>
      </div>
    ),
  };

  const flowsTab = {
    key: 'flows',
    label: (
      <Space>
        <ApartmentOutlined />
        审批流程配置
      </Space>
    ),
    children: (
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <div style={{
          padding: 16,
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 500, fontSize: 16 }}>审批流程列表</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { flowForm.resetFields(); setFlowNodes([{ level: 1, name: '', approverRole: '', isRequired: true }]); setFlowModal(true); }}>
            新建流程
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={flowColumns}
          dataSource={flowData}
          loading={flowLoading}
          scroll={{ x: 1000 }}
          pagination={{
            ...flowPagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setFlowPagination({ current: page, pageSize, total: flowPagination.total });
            },
          }}
        />
      </Card>
    ),
  };

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ borderRadius: 8 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[instancesTab, flowsTab]} />
      </Card>

      <Modal
        title={<Space><ApartmentOutlined style={{ color: '#1890ff' }} />新建审批流程</Space>}
        open={flowModal}
        onCancel={() => setFlowModal(false)}
        footer={null}
        width={720}
        maskClosable={false}
      >
        <Form form={flowForm} layout="vertical" onFinish={handleFlowSubmit}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="流程名称" rules={[{ required: true, message: '请输入流程名称' }]}>
                <Input placeholder="如：案件立案审批流程" maxLength={100} showCount />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="审批类别" rules={[{ required: true, message: '请选择审批类别' }]}>
                <Select placeholder="选择类别">
                  {Object.entries(categoryMap).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="流程描述">
            <TextArea rows={2} placeholder="描述该审批流程的适用场景" maxLength={500} showCount />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>审批节点配置</span>
              <Button size="small" icon={<PlusOutlined />} onClick={addFlowNode}>添加节点</Button>
            </div>
            {flowNodes.map((node, index) => (
              <Card key={index} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                <Row gutter={8} align="middle">
                  <Col span={2}>
                    <Tag color="blue">第{node.level}级</Tag>
                  </Col>
                  <Col span={7}>
                    <Input
                      placeholder="节点名称"
                      value={node.name}
                      onChange={(e) => updateFlowNode(index, 'name', e.target.value)}
                      size="small"
                    />
                  </Col>
                  <Col span={7}>
                    <Input
                      placeholder="审批角色（如：法制审核人员）"
                      value={node.approverRole}
                      onChange={(e) => updateFlowNode(index, 'approverRole', e.target.value)}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <Select
                      placeholder="是否必须"
                      value={node.isRequired ? 'required' : 'optional'}
                      onChange={(v) => updateFlowNode(index, 'isRequired', v === 'required')}
                      size="small"
                    >
                      <Option value="required">必须审批</Option>
                      <Option value="optional">可选审批</Option>
                    </Select>
                  </Col>
                  <Col span={2}>
                    {flowNodes.length > 1 && (
                      <Button size="small" danger type="text" onClick={() => removeFlowNode(index)}>删除</Button>
                    )}
                  </Col>
                </Row>
              </Card>
            ))}
          </div>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setFlowModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={flowSubmitting} icon={<CheckCircleOutlined />}>
                创建流程
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><AuditOutlined style={{ color: '#1890ff' }} />提交审批申请</Space>}
        open={submitModal}
        onCancel={() => setSubmitModal(false)}
        footer={null}
        width={720}
        maskClosable={false}
      >
        <Form form={submitForm} layout="vertical" onFinish={handleSubmitInstance}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="flowId" label="选择审批流程" rules={[{ required: true, message: '请选择审批流程' }]}>
                <Select
                  placeholder="选择审批流程"
                  onChange={handleFlowSelect}
                  showSearch
                  optionFilterProp="label"
                >
                  {flowOptions.map((f: any) => (
                    <Option key={f.id} value={f.id} label={f.label}>
                      <Space>
                        <Tag color={categoryMap[f.category]?.color || 'default'}>
                          {categoryMap[f.category]?.label || f.category}
                        </Tag>
                        {f.name}
                        {f.isDefault && <Tag color="blue">默认</Tag>}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {selectedFlowNodes.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f6f6f6', borderRadius: 8 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>审批流程预览：</div>
              <Space wrap>
                {selectedFlowNodes.map((node: any, index: number) => (
                  <span key={node.id || index}>
                    <Tag color="blue">第{node.level}级: {node.name}</Tag>
                    {index < selectedFlowNodes.length - 1 && <span style={{ color: '#999' }}>→</span>}
                  </span>
                ))}
              </Space>
            </div>
          )}

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="title" label="审批标题" rules={[{ required: true, message: '请输入审批标题' }]}>
                <Input placeholder="如：关于XX案件立案审批" maxLength={200} showCount />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="审批类别快捷选择">
                <Select
                  placeholder="选择类别自动匹配流程"
                  allowClear
                  onChange={async (value) => {
                    if (value) {
                      try {
                        const res = await approvalApi.getDefaultFlow(value);
                        if (res.data) {
                          setSelectedFlowId(res.data.id);
                          submitForm.setFieldsValue({ flowId: res.data.id });
                          setSelectedFlowNodes(res.data.nodes || []);
                        }
                      } catch (e) {
                        // no default flow
                      }
                    }
                  }}
                >
                  {Object.entries(categoryMap).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="targetType" label="目标类型" rules={[{ required: true, message: '请选择目标类型' }]}>
                <Select placeholder="选择类型">
                  <Option value="CASE">案件</Option>
                  <Option value="CLUE">线索</Option>
                  <Option value="EVIDENCE">证据</Option>
                  <Option value="OTHER">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="targetId" label="目标ID" rules={[{ required: true, message: '请输入目标ID' }]}>
                <Input placeholder="关联对象ID" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="targetName" label="目标名称">
                <Input placeholder="关联对象名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="applicantName" label="申请人">
                <Input placeholder="申请人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="applicantDept" label="申请部门">
                <Input placeholder="申请人部门" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isUrgent" label="是否加急">
                <Select placeholder="选择">
                  <Option value={false}>普通</Option>
                  <Option value={true}>加急</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="applyReason" label="申请理由" rules={[{ required: true, message: '请输入申请理由' }]}>
            <TextArea rows={4} placeholder="请详细描述审批申请理由" maxLength={2000} showCount />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setSubmitModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitSubmitting} icon={<CheckCircleOutlined />}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
