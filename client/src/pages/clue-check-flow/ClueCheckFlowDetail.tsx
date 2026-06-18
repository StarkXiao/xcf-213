import { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Steps,
  Tabs,
  Timeline,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  AutoComplete,
  Tooltip,
  Divider,
  Empty,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  SendOutlined,
  SearchOutlined as SearchIcon,
  MessageOutlined,
  TrophyOutlined,
  UserOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  PaperClipOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  PlusOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  clueCheckFlowApi,
  clueApi,
  caseApi,
  evidenceApi,
  personApi,
  operationLogApi,
} from '../../services/api';
import { checkStatusMap, checkStageMap, priorityMap } from './ClueCheckFlowList';
import ApprovalInfoPanel from '../../components/ApprovalInfoPanel';

const { TextArea } = Input;
const { Option } = Select;

const credibilityColors: Record<string, string> = {
  极高: 'red',
  高: 'orange',
  中等: 'blue',
  低: 'default',
  极低: 'default',
};

const importanceColors: Record<string, string> = {
  关键: 'red',
  重要: 'orange',
  一般: 'blue',
  次要: 'default',
};

const actionIconMap: Record<string, any> = {
  REGISTER: <FileTextOutlined />,
  DISPATCH: <SendOutlined />,
  VERIFY: <SearchIcon />,
  FEEDBACK: <MessageOutlined />,
  ADOPT: <TrophyOutlined />,
  REJECT: <CloseCircleOutlined />,
  CLOSE: <StopOutlined />,
};

const actionColorMap: Record<string, string> = {
  REGISTER: '#8c8c8c',
  DISPATCH: '#1890ff',
  VERIFY: '#faad14',
  FEEDBACK: '#13c2c2',
  ADOPT: '#52c41a',
  REJECT: '#ff4d4f',
  CLOSE: '#8c8c8c',
};

export default function ClueCheckFlowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [flowData, setFlowData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [dispatchModal, setDispatchModal] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [adoptModal, setAdoptModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  const [dispatchForm] = Form.useForm();
  const [verifyForm] = Form.useForm();
  const [feedbackForm] = Form.useForm();
  const [adoptForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  const [submitting, setSubmitting] = useState(false);
  const [caseOptions, setCaseOptions] = useState<any[]>([]);
  const [evidenceOptions, setEvidenceOptions] = useState<any[]>([]);
  const [opLogs, setOpLogs] = useState<any[]>([]);
  const [opLogsLoading, setOpLogsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadFlowData();
      loadCaseOptions();
      loadEvidenceOptions();
      loadOpLogs();
    }
  }, [id]);

  const loadFlowData = async () => {
    setLoading(true);
    try {
      const res = await clueCheckFlowApi.get(id!);
      setFlowData(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCaseOptions = async (keyword?: string) => {
    try {
      const params: any = { page: 1, pageSize: 200 };
      if (keyword) params.keyword = keyword;
      const res = await caseApi.list(params);
      setCaseOptions(res.data.items || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const loadEvidenceOptions = async () => {
    try {
      const res = await evidenceApi.list({ page: 1, pageSize: 500 });
      setEvidenceOptions(res.data.items || []);
    } catch (error) {
      console.error('Failed to load evidences:', error);
    }
  };

  const loadOpLogs = async () => {
    setOpLogsLoading(true);
    try {
      const res = await operationLogApi.getByTarget('CLUE_CHECK_FLOW', id!);
      setOpLogs(res.data.items || []);
    } catch (error) {
      console.error('Failed to load op logs:', error);
    } finally {
      setOpLogsLoading(false);
    }
  };

  const getStageIndex = () => {
    const stages = ['REGISTER', 'DISPATCH', 'VERIFY', 'FEEDBACK', 'ADOPT'];
    return stages.indexOf(flowData?.currentStage || 'REGISTER');
  };

  const canDispatch = () =>
    flowData && ['REGISTERED'].includes(flowData.status);
  const canVerify = () =>
    flowData && ['DISPATCHED'].includes(flowData.status);
  const canFeedback = () =>
    flowData && ['VERIFYING'].includes(flowData.status);
  const canAdopt = () =>
    flowData && ['FEEDBACKED'].includes(flowData.status);
  const canAdoptWithApproval = () =>
    canAdopt() && flowData.clueAdoptApproval && flowData.clueAdoptApproval.status === 'APPROVED';
  const hasPendingApproval = () =>
    canAdopt() && flowData.clueAdoptApproval &&
    ['PENDING', 'IN_PROGRESS'].includes(flowData.clueAdoptApproval.status);
  const canReject = () =>
    flowData && ['FEEDBACKED', 'VERIFYING', 'DISPATCHED'].includes(flowData.status);
  const canClose = () =>
    flowData && ['ADOPTED', 'REJECTED'].includes(flowData.status);

  const openDispatch = () => {
    dispatchForm.resetFields();
    dispatchForm.setFieldsValue({
      dispatchUserName: flowData?.registerUserName,
    });
    setDispatchModal(true);
  };

  const openVerify = () => {
    verifyForm.resetFields();
    verifyForm.setFieldsValue({
      verifyUserName: flowData?.dispatchToUserName,
    });
    setVerifyModal(true);
  };

  const openFeedback = () => {
    feedbackForm.resetFields();
    feedbackForm.setFieldsValue({
      feedbackUserName: flowData?.verifyUserName,
    });
    setFeedbackModal(true);
  };

  const openAdopt = () => {
    adoptForm.resetFields();
    adoptForm.setFieldsValue({
      adoptToCaseId: flowData?.caseId,
    });
    setAdoptModal(true);
  };

  const handleSubmit = async (
    action: string,
    form: any,
    apiCall: (data: any) => Promise<any>,
    successMsg: string
  ) => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const data = { ...values };
      if (data.dispatchDeadline) {
        data.dispatchDeadline = data.dispatchDeadline.format('YYYY-MM-DD HH:mm:ss');
      }
      if (data.verifyTime) {
        data.verifyTime = data.verifyTime.format('YYYY-MM-DD HH:mm:ss');
      }
      if (data.feedbackTime) {
        data.feedbackTime = data.feedbackTime.format('YYYY-MM-DD HH:mm:ss');
      }
      if (data.adoptTime) {
        data.adoptTime = data.adoptTime.format('YYYY-MM-DD HH:mm:ss');
      }
      if (data.rejectTime) {
        data.rejectTime = data.rejectTime.format('YYYY-MM-DD HH:mm:ss');
      }
      if (data.closeTime) {
        data.closeTime = data.closeTime.format('YYYY-MM-DD HH:mm:ss');
      }

      await apiCall(data);
      message.success(successMsg);
      setDispatchModal(false);
      setVerifyModal(false);
      setFeedbackModal(false);
      setAdoptModal(false);
      setRejectModal(false);
      setCloseModal(false);
      loadFlowData();
      loadOpLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const parseIds = (str?: string) => (str ? str.split(',').filter(Boolean) : []);

  const renderEvidences = (idsStr?: string) => {
    const ids = parseIds(idsStr);
    if (ids.length === 0) return <span style={{ color: '#999' }}>无</span>;
    return (
      <Space wrap>
        {ids.map((eid) => {
          const ev = evidenceOptions.find((e) => e.id === eid);
          return ev ? (
            <Tag
              key={eid}
              color="purple"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/evidences/${eid}`)}
            >
              {ev.evidenceNumber} - {ev.name}
            </Tag>
          ) : (
            <Tag key={eid} color="default">
              {eid.substring(0, 8)}...
            </Tag>
          );
        })}
      </Space>
    );
  };

  if (!flowData) return null;

  const overviewTab = {
    key: 'overview',
    label: (
      <Space>
        <FileTextOutlined />
        核查概览
      </Space>
    ),
    children: (
      <div>
        <Steps
          current={getStageIndex()}
          status={
            flowData.status === 'REJECTED'
              ? 'error'
              : flowData.status === 'CLOSED'
              ? 'error'
              : flowData.status === 'ADOPTED'
              ? 'finish'
              : 'process'
          }
          size="default"
          style={{ marginBottom: 24, padding: '16px 8px' }}
          items={Object.entries(checkStageMap).map(([key, val]) => ({
            title: val.label,
            icon: val.icon,
            description:
              flowData[key.toLowerCase() + 'UserName'] ||
              flowData[key.toLowerCase() + 'Time']
                ? `${flowData[key.toLowerCase() + 'UserName'] || '未知'} · ${
                    flowData[key.toLowerCase() + 'Time']
                      ? moment(flowData[key.toLowerCase() + 'Time']).format('MM-DD HH:mm')
                      : ''
                  }`
                : undefined,
          }))}
        />

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              size="small"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#8c8c8c' }} />
                  基础信息
                </Space>
              }
              extra={
                <Tag color={checkStatusMap[flowData.status]?.color || 'default'}>
                  {checkStatusMap[flowData.status]?.label || flowData.status}
                </Tag>
              }
            >
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="核查编号">{flowData.flowNumber}</Descriptions.Item>
                <Descriptions.Item label="优先级">
                  {flowData.priority ? (
                    <Tag color={priorityMap[flowData.priority]?.color || 'default'}>
                      {priorityMap[flowData.priority]?.label || flowData.priority}
                    </Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="核查标题" span={2}>
                  <span style={{ fontWeight: 500, fontSize: 15 }}>{flowData.title}</span>
                </Descriptions.Item>
                <Descriptions.Item label="关联线索">
                  {flowData.clue ? (
                    <a onClick={() => navigate(`/clues/${flowData.clueId}`)}>
                      <Tag color="orange">{flowData.clue.clueNumber}</Tag>
                      {flowData.clue.title}
                    </a>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="关联案件">
                  {flowData.case ? (
                    <a onClick={() => navigate(`/cases/${flowData.caseId}`)}>
                      <Tag color="blue">{flowData.case.caseNumber}</Tag>
                      {flowData.case.title}
                    </a>
                  ) : (
                    <span style={{ color: '#999' }}>未关联</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {moment(flowData.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {moment(flowData.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <SearchIcon style={{ color: '#fa8c16' }} />
                  关联线索详情
                </Space>
              }
              extra={
                flowData.clue && (
                  <Button size="small" onClick={() => navigate(`/clues/${flowData.clueId}`)}>
                    查看线索
                  </Button>
                )
              }
            >
              {flowData.clue ? (
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="线索编号">{flowData.clue.clueNumber}</Descriptions.Item>
                  <Descriptions.Item label="线索标题">{flowData.clue.title}</Descriptions.Item>
                  <Descriptions.Item label="线索类型">
                    <Tag>{flowData.clue.clueType}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="线索来源">{flowData.clue.source}</Descriptions.Item>
                  <Descriptions.Item label="可信度">
                    <Tag color={credibilityColors[flowData.clue.credibility] || 'default'}>
                      {flowData.clue.credibility}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="重要性">
                    <Tag color={importanceColors[flowData.clue.importance] || 'default'}>
                      {flowData.clue.importance}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="当前状态">
                    <Tag>{flowData.clue.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="线索内容">
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        maxHeight: 160,
                        overflow: 'auto',
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    >
                      {flowData.clue.content}
                    </div>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty description="暂无线索信息" />
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <HistoryOutlined style={{ color: '#722ed1' }} />
                  阶段操作区
                </Space>
              }
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <SendOutlined style={{ color: '#1890ff' }} />
                    <span style={{ fontWeight: 500 }}>派发任务</span>
                    {flowData.dispatchToUserName && <Tag color="blue">已完成</Tag>}
                  </Space>
                  <Button
                    type={canDispatch() ? 'primary' : 'default'}
                    icon={<SendOutlined />}
                    disabled={!canDispatch()}
                    onClick={openDispatch}
                    block
                  >
                    {flowData.dispatchToUserName ? '重新派发' : '派发核查任务'}
                  </Button>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <SearchIcon style={{ color: '#faad14' }} />
                    <span style={{ fontWeight: 500 }}>线索核实</span>
                    {flowData.verifyResult && <Tag color="orange">已完成</Tag>}
                  </Space>
                  <Button
                    type={canVerify() ? 'primary' : 'default'}
                    icon={<SearchIcon />}
                    disabled={!canVerify()}
                    onClick={openVerify}
                    block
                  >
                    {flowData.verifyResult ? '补充核实' : '填写核实结果'}
                  </Button>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <MessageOutlined style={{ color: '#13c2c2' }} />
                    <span style={{ fontWeight: 500 }}>核查反馈</span>
                    {flowData.feedbackResult && <Tag color="cyan">已完成</Tag>}
                  </Space>
                  <Button
                    type={canFeedback() ? 'primary' : 'default'}
                    icon={<MessageOutlined />}
                    disabled={!canFeedback()}
                    onClick={openFeedback}
                    block
                  >
                    {flowData.feedbackResult ? '补充反馈' : '提交核查反馈'}
                  </Button>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                <Row gutter={8}>
                  <Col span={12}>
                    <div>
                      <Space style={{ marginBottom: 8 }}>
                        <TrophyOutlined style={{ color: '#52c41a' }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>采用</span>
                        {canAdoptWithApproval() && <Tag color="green">审批已通过</Tag>}
                        {hasPendingApproval() && <Tag color="blue">审批中</Tag>}
                      </Space>
                      {canAdoptWithApproval() ? (
                        <Button
                          type="primary"
                          icon={<TrophyOutlined />}
                          onClick={openAdopt}
                          block
                          style={{ background: '#52c41a' }}
                        >
                          执行采用
                        </Button>
                      ) : canAdopt() && !hasPendingApproval() ? (
                        <Tooltip title="需先发起线索采用审批，审批通过后方可采用">
                          <Button
                            type="primary"
                            icon={<AuditOutlined />}
                            onClick={() => {
                              const el = document.getElementById('clue-check-approval-panel');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            block
                          >
                            发起采用审批
                          </Button>
                        </Tooltip>
                      ) : (
                        <Button
                          type="default"
                          icon={<TrophyOutlined />}
                          disabled
                          block
                        >
                          {hasPendingApproval() ? '审批中，请等待' : '采纳结果'}
                        </Button>
                      )}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <Space style={{ marginBottom: 8 }}>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>驳回</span>
                      </Space>
                      <Button
                        danger={canReject()}
                        icon={<CloseCircleOutlined />}
                        disabled={!canReject()}
                        onClick={() => {
                          rejectForm.resetFields();
                          setRejectModal(true);
                        }}
                        block
                      >
                        不予采用
                      </Button>
                    </div>
                  </Col>
                </Row>

                {canClose() && (
                  <>
                    <Divider style={{ margin: '4px 0' }} />
                    <div>
                      <Space style={{ marginBottom: 8 }}>
                        <StopOutlined />
                        <span style={{ fontWeight: 500 }}>关闭流程</span>
                      </Space>
                      <Button
                        icon={<StopOutlined />}
                        onClick={() => {
                          closeForm.resetFields();
                          setCloseModal(true);
                        }}
                        block
                      >
                        关闭核查流程
                      </Button>
                    </div>
                  </>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#8c8c8c' }} />
                  登记信息
                </Space>
              }
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="登记人">
                  <Space>
                    <UserOutlined />
                    {flowData.registerUserName || '-'}
                    {flowData.registerUserDept && (
                      <Tag color="default" style={{ marginLeft: 4 }}>
                        {flowData.registerUserDept}
                      </Tag>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="登记时间">
                  {flowData.registerTime
                    ? moment(flowData.registerTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="登记地点">
                  {flowData.registerLocation ? (
                    <Space>
                      <EnvironmentOutlined />
                      {flowData.registerLocation}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="线索来源">
                  {flowData.registerSource || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="核查内容描述">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      maxHeight: 120,
                      overflow: 'auto',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.registerContent || '-'}
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <SendOutlined style={{ color: '#1890ff' }} />
                  派发信息
                </Space>
              }
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="派发人">
                  {flowData.dispatchUserName ? (
                    <Space>
                      <TeamOutlined />
                      {flowData.dispatchUserName}
                      {flowData.dispatchUserDept && (
                        <Tag color="default">{flowData.dispatchUserDept}</Tag>
                      )}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>未派发</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="派发时间">
                  {flowData.dispatchTime
                    ? moment(flowData.dispatchTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="承办人">
                  {flowData.dispatchToUserName ? (
                    <Space>
                      <UserOutlined />
                      <span style={{ fontWeight: 500 }}>{flowData.dispatchToUserName}</span>
                      {flowData.dispatchToUserDept && (
                        <Tag color="blue">{flowData.dispatchToUserDept}</Tag>
                      )}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="截止期限">
                  {flowData.dispatchDeadline ? (
                    <Space>
                      <ClockCircleOutlined />
                      {moment(flowData.dispatchDeadline).format('YYYY-MM-DD HH:mm')}
                      {moment().isAfter(flowData.dispatchDeadline) && (
                        <Tag color="red">已逾期</Tag>
                      )}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="派发备注">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.dispatchRemark || '-'}
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <SearchIcon style={{ color: '#faad14' }} />
                  核实信息
                </Space>
              }
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="核实人">
                  {flowData.verifyUserName ? (
                    <Space>
                      <UserOutlined />
                      {flowData.verifyUserName}
                      {flowData.verifyUserDept && <Tag>{flowData.verifyUserDept}</Tag>}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>未核实</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="核实时间">
                  {flowData.verifyTime
                    ? moment(flowData.verifyTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="核实地点">
                  {flowData.verifyLocation ? (
                    <Space>
                      <EnvironmentOutlined />
                      {flowData.verifyLocation}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="核实结果">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.verifyResult || '-'}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="核实结论">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.verifyConclusion || '-'}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="关联附件">
                  {renderEvidences(flowData.verifyEvidenceIds)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <MessageOutlined style={{ color: '#13c2c2' }} />
                  反馈信息
                </Space>
              }
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="反馈人">
                  {flowData.feedbackUserName ? (
                    <Space>
                      <UserOutlined />
                      {flowData.feedbackUserName}
                      {flowData.feedbackUserDept && <Tag color="cyan">{flowData.feedbackUserDept}</Tag>}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>未反馈</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="反馈时间">
                  {flowData.feedbackTime
                    ? moment(flowData.feedbackTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="反馈结论">
                  {flowData.feedbackResult ? (
                    <Tag color="cyan" style={{ fontSize: 13 }}>
                      {flowData.feedbackResult}
                    </Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="反馈内容">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.feedbackContent || '-'}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="反馈附件">
                  {renderEvidences(flowData.feedbackEvidenceIds)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <TrophyOutlined style={{ color: '#52c41a' }} />
                  采用信息
                </Space>
              }
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="采用人">
                  {flowData.adoptUserName ? (
                    <Space>
                      <UserOutlined />
                      {flowData.adoptUserName}
                      {flowData.adoptUserDept && <Tag color="green">{flowData.adoptUserDept}</Tag>}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>未采用</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="采用时间">
                  {flowData.adoptTime
                    ? moment(flowData.adoptTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="采用结果">
                  {flowData.adoptResult ? (
                    <Tag color="green" style={{ fontSize: 13 }}>
                      {flowData.adoptResult}
                    </Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="采用意见">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.adoptOpinion || '-'}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="归档至案件">
                  {flowData.adoptToCaseId ? (
                    <Tag
                      color="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/cases/${flowData.adoptToCaseId}`)}
                    >
                      {flowData.case?.caseNumber || flowData.adoptToCaseId}
                    </Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="采用附件">
                  {renderEvidences(flowData.adoptEvidenceIds)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  驳回/关闭信息
                </Space>
              }
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="驳回人">
                  {flowData.rejectUserName ? (
                    <Space>
                      <UserOutlined />
                      {flowData.rejectUserName}
                      {flowData.rejectUserDept && <Tag color="red">{flowData.rejectUserDept}</Tag>}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="驳回时间">
                  {flowData.rejectTime
                    ? moment(flowData.rejectTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="驳回原因">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.rejectReason || '-'}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="关闭人">
                  {flowData.closeUserName ? (
                    <Space>
                      <UserOutlined />
                      {flowData.closeUserName}
                      {flowData.closeUserDept && <Tag>{flowData.closeUserDept}</Tag>}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="关闭时间">
                  {flowData.closeTime
                    ? moment(flowData.closeTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="关闭原因">
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {flowData.closeReason || '-'}
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {canAdopt() && !canAdoptWithApproval() && (
          <Alert
            message="线索采用需通过多级审批"
            description={
              hasPendingApproval()
                ? '线索采用审批正在进行中，请等待审批完成。审批通过后方可执行采用操作。'
                : '请点击下方「发起采用审批」按钮发起线索采用审批流程，审批通过后方可执行采用操作。'
            }
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <div id="clue-check-approval-panel" style={{ marginTop: 16 }}>
          <Card
            size="small"
            title={
              <Space>
                <AuditOutlined style={{ color: '#722ed1' }} />
                审批信息
              </Space>
            }
          >
            <ApprovalInfoPanel
              targetType="CLUE"
              targetId={flowData.clueId || id!}
              targetName={flowData.clue?.title || flowData.title}
              targetNumber={flowData.clue?.clueNumber || flowData.flowNumber}
              clueId={flowData.clueId}
              caseId={flowData.caseId}
              approvals={flowData.approvals}
              currentApproval={flowData.clueAdoptApproval}
              allowedCategories={['CLUE_ADOPT']}
              onApprovalCreated={loadFlowData}
              onApprovalStatusChange={loadFlowData}
            />
          </Card>
        </div>
      </div>
    ),
  };

  const operationLogsTab = {
    key: 'logs',
    label: (
      <Space>
        <HistoryOutlined />
        操作留痕 ({flowData.operationLogs?.length || 0})
      </Space>
    ),
    children: (
      <Card size="small">
        {flowData.operationLogs && flowData.operationLogs.length > 0 ? (
          <Timeline
            mode="left"
            items={[...flowData.operationLogs]
              .sort((a: any, b: any) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime())
              .map((log: any) => ({
                color: actionColorMap[log.action] || '#8c8c8c',
                dot: actionIconMap[log.action] || <EditOutlined />,
                label: (
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 500, color: '#333' }}>
                      {moment(log.actionTime).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      <Space size={4}>
                        <UserOutlined />
                        {log.operatorName || '系统'}
                        {log.operatorDept && (
                          <Tag color="default" style={{ marginLeft: 4 }}>
                            {log.operatorDept}
                          </Tag>
                        )}
                      </Space>
                    </div>
                    {log.ip && (
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>IP: {log.ip}</div>
                    )}
                  </div>
                ),
                children: (
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 6, color: '#333' }}>
                      <Space>
                        {actionIconMap[log.action] || <EditOutlined />}
                        <span style={{ color: actionColorMap[log.action] || '#333' }}>
                          [{log.stage}] {log.action}
                        </span>
                      </Space>
                    </div>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        color: '#555',
                        lineHeight: 1.7,
                        fontSize: 13,
                      }}
                    >
                      {log.description || '-'}
                    </div>
                  </Card>
                ),
              }))}
          />
        ) : (
          <Empty description="暂无操作记录" />
        )}
      </Card>
    ),
  };

  const auditLogsTab = {
    key: 'audit',
    label: (
      <Space>
        <FileTextOutlined />
        审计日志 ({opLogs.length})
      </Space>
    ),
    children: (
      <Card size="small" loading={opLogsLoading}>
        {opLogs.length > 0 ? (
          <Timeline
            mode="left"
            items={opLogs.map((log: any) => ({
              color: log.action === 'DELETE' ? 'red' : log.action === 'CREATE' ? 'green' : 'blue',
              label: (
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 500, color: '#333' }}>
                    {moment(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    <Space>
                      <UserOutlined />
                      {log.operator || '系统'}
                      {log.operatorDepartment && <Tag>{log.operatorDepartment}</Tag>}
                    </Space>
                  </div>
                </div>
              ),
              children: (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 500, marginBottom: 6 }}>
                    <Tag color={log.action === 'DELETE' ? 'red' : log.action === 'CREATE' ? 'green' : 'blue'}>
                      {log.action}
                    </Tag>
                    <Tag>{log.targetType}</Tag>
                  </div>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      color: '#555',
                      lineHeight: 1.7,
                      fontSize: 13,
                    }}
                  >
                    {log.description || '-'}
                  </div>
                </Card>
              ),
            }))}
          />
        ) : (
          <Empty description="暂无审计日志" />
        )}
      </Card>
    ),
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clue-check-flows')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0, fontSize: 20 }}>{flowData.title}</h2>
          <Tag color={checkStatusMap[flowData.status]?.color || 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
            {checkStatusMap[flowData.status]?.label || flowData.status}
          </Tag>
          {flowData.priority && (
            <Tag color={priorityMap[flowData.priority]?.color || 'default'}>
              优先级：{priorityMap[flowData.priority]?.label || flowData.priority}
            </Tag>
          )}
          <Tag color="purple" style={{ fontWeight: 500 }}>
            {flowData.flowNumber}
          </Tag>
        </Space>
        <Space>
          <Button icon={<HistoryOutlined />} onClick={() => setActiveTab('logs')}>
            操作留痕
          </Button>
        </Space>
      </div>

      <Card loading={loading} style={{ borderRadius: '8px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[overviewTab, operationLogsTab, auditLogsTab]}
        />
      </Card>

      {/* 派发 Modal */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: '#1890ff' }} />
            派发核查任务
          </Space>
        }
        open={dispatchModal}
        onCancel={() => setDispatchModal(false)}
        footer={null}
        width={640}
      >
        <Form form={dispatchForm} layout="vertical" onFinish={(values) =>
          handleSubmit('DISPATCH', dispatchForm, (d) => clueCheckFlowApi.dispatch(id!, d), '派发成功')
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dispatchUserName" label="派发人" rules={[{ required: true }]}>
                <Input placeholder="请输入派发人姓名" prefix={<TeamOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dispatchUserDept" label="派发部门">
                <Input placeholder="派发人所在部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dispatchToUserName" label="承办人" rules={[{ required: true, message: '请输入承办人' }]}>
                <AutoComplete placeholder="请输入或选择承办人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dispatchToUserDept" label="承办部门">
                <Input placeholder="承办人所属部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dispatchDeadline" label="截止期限">
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dispatchRemark" label="派发备注/要求">
            <TextArea rows={3} placeholder="派发时的工作要求、注意事项等" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setDispatchModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<SendOutlined />}>
                确认派发
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 核实 Modal */}
      <Modal
        title={
          <Space>
            <SearchIcon style={{ color: '#faad14' }} />
            填写核实结果
          </Space>
        }
        open={verifyModal}
        onCancel={() => setVerifyModal(false)}
        footer={null}
        width={680}
      >
        <Form form={verifyForm} layout="vertical" onFinish={(values) =>
          handleSubmit('VERIFY', verifyForm, (d) => clueCheckFlowApi.verify(id!, d), '核实成功')
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="verifyUserName" label="核实人" rules={[{ required: true }]}>
                <Input placeholder="请输入核实人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="verifyUserDept" label="核实部门">
                <Input placeholder="核实人所属部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="verifyTime" label="核实时间">
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="verifyLocation" label="核实地点">
                <Input placeholder="核实发生的地点" prefix={<EnvironmentOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="verifyResult" label="核实结果" rules={[{ required: true, message: '请输入核实结果' }]}>
            <TextArea rows={4} placeholder="请详细描述核实的过程、发现、结果等" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="verifyConclusion" label="核实结论">
            <TextArea rows={2} placeholder="简要结论，如：属实/部分属实/不属实 等" maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="verifyEvidenceIds" label="关联证据附件">
            <Select
              mode="multiple"
              placeholder="选择关联的证据（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              allowClear
              options={evidenceOptions.map((ev) => ({
                label: `${ev.evidenceNumber} - ${ev.name} (${ev.type})`,
                value: ev.id,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setVerifyModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<CheckCircleOutlined />}>
                确认核实
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 反馈 Modal */}
      <Modal
        title={
          <Space>
            <MessageOutlined style={{ color: '#13c2c2' }} />
            提交核查反馈
          </Space>
        }
        open={feedbackModal}
        onCancel={() => setFeedbackModal(false)}
        footer={null}
        width={680}
      >
        <Form form={feedbackForm} layout="vertical" onFinish={(values) =>
          handleSubmit('FEEDBACK', feedbackForm, (d) => clueCheckFlowApi.feedback(id!, d), '反馈成功')
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="feedbackUserName" label="反馈人" rules={[{ required: true }]}>
                <Input placeholder="请输入反馈人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="feedbackUserDept" label="反馈部门">
                <Input placeholder="反馈人所属部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="feedbackTime" label="反馈时间">
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="feedbackResult" label="反馈结论">
                <Select placeholder="选择反馈结论" allowClear>
                  <Option value="建议采用">建议采用</Option>
                  <Option value="部分采用">部分采用</Option>
                  <Option value="建议补充核实">建议补充核实</Option>
                  <Option value="建议排除">建议排除</Option>
                  <Option value="待进一步核查">待进一步核查</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="feedbackContent" label="反馈内容" rules={[{ required: true, message: '请输入反馈内容' }]}>
            <TextArea rows={5} placeholder="请详细描述核查后的反馈内容、工作建议、后续处理意见等" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="feedbackEvidenceIds" label="反馈附件">
            <Select
              mode="multiple"
              placeholder="选择关联的证据（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              allowClear
              options={evidenceOptions.map((ev) => ({
                label: `${ev.evidenceNumber} - ${ev.name} (${ev.type})`,
                value: ev.id,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setFeedbackModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<MessageOutlined />}>
                提交反馈
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 采用 Modal */}
      <Modal
        title={
          <Space>
            <TrophyOutlined style={{ color: '#52c41a' }} />
            采纳核查结果
          </Space>
        }
        open={adoptModal}
        onCancel={() => setAdoptModal(false)}
        footer={null}
        width={680}
      >
        <Form form={adoptForm} layout="vertical" onFinish={(values) =>
          handleSubmit('ADOPT', adoptForm, (d) => clueCheckFlowApi.adopt(id!, d), '采用成功')
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="adoptUserName" label="采用人" rules={[{ required: true }]}>
                <Input placeholder="请输入采用人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="adoptUserDept" label="采用部门">
                <Input placeholder="采用人所属部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="adoptTime" label="采用时间">
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="adoptResult" label="采用结果" rules={[{ required: true }]}>
                <Select placeholder="选择采用结果">
                  <Option value="完全采纳">完全采纳</Option>
                  <Option value="部分采纳">部分采纳</Option>
                  <Option value="转化为证据">转化为证据</Option>
                  <Option value="立案侦查">立案侦查</Option>
                  <Option value="并案处理">并案处理</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="adoptToCaseId" label="归档至案件">
            <Select
              showSearch
              placeholder="选择要归档的目标案件（线索将自动关联至此案件）"
              optionFilterProp="label"
              allowClear
              onSearch={(v) => loadCaseOptions(v)}
              options={caseOptions.map((c) => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="adoptOpinion" label="采用意见">
            <TextArea rows={3} placeholder="采用说明、领导批示、后续工作安排等" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item name="adoptEvidenceIds" label="采用附件">
            <Select
              mode="multiple"
              placeholder="选择关联的证据（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              allowClear
              options={evidenceOptions.map((ev) => ({
                label: `${ev.evidenceNumber} - ${ev.name} (${ev.type})`,
                value: ev.id,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAdoptModal(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<TrophyOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                确认采用
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回 Modal */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            驳回/不予采用
          </Space>
        }
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        footer={null}
        width={560}
      >
        <Form form={rejectForm} layout="vertical" onFinish={(values) =>
          handleSubmit('REJECT', rejectForm, (d) => clueCheckFlowApi.reject(id!, d), '驳回成功')
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rejectUserName" label="驳回人" rules={[{ required: true }]}>
                <Input placeholder="请输入驳回人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rejectUserDept" label="驳回部门">
                <Input placeholder="驳回人所属部门" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="rejectTime" label="驳回时间">
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="rejectReason" label="驳回原因" rules={[{ required: true, message: '请输入驳回原因' }]}>
            <TextArea rows={4} placeholder="请详细说明不予采用的原因、依据、建议等" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRejectModal(false)}>取消</Button>
              <Button danger htmlType="submit" loading={submitting} icon={<CloseCircleOutlined />}>
                确认驳回
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 关闭 Modal */}
      <Modal
        title={
          <Space>
            <StopOutlined />
            关闭核查流程
          </Space>
        }
        open={closeModal}
        onCancel={() => setCloseModal(false)}
        footer={null}
        width={560}
      >
        <Form form={closeForm} layout="vertical" onFinish={(values) =>
          handleSubmit('CLOSE', closeForm, (d) => clueCheckFlowApi.close(id!, d), '关闭成功')
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="closeUserName" label="关闭人" rules={[{ required: true }]}>
                <Input placeholder="请输入关闭人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="closeUserDept" label="关闭部门">
                <Input placeholder="关闭人所属部门" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="closeTime" label="关闭时间">
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="closeReason" label="关闭说明">
            <TextArea rows={3} placeholder="关闭原因、后续归档说明等（可选）" maxLength={500} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCloseModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<StopOutlined />}>
                确认关闭
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
