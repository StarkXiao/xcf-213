import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Button, Space, message, Descriptions, Tag, Divider,
  Form, Input, Select, Modal, Timeline, Badge, Tooltip, Empty, Radio, InputNumber
} from 'antd';
import {
  ArrowLeftOutlined, BellOutlined, UserOutlined, EnvironmentOutlined,
  PaperClipOutlined, WarningOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ArrowUpOutlined, TeamOutlined, FileTextOutlined,
  SaveOutlined, PlusOutlined, SendOutlined, EyeOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { alertApi, surveillanceRuleApi, commandApi, personApi } from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;

const targetTypeConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  PERSON: { label: '人员预警', icon: <UserOutlined />, color: '#1677ff', bgColor: '#e6f4ff' },
  LOCATION: { label: '地点预警', icon: <EnvironmentOutlined />, color: '#722ed1', bgColor: '#f9f0ff' },
  EVIDENCE: { label: '证据预警', icon: <PaperClipOutlined />, color: '#fa8c16', bgColor: '#fff7e6' },
};

const alertLevelConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  URGENT: { label: '紧急', color: '#ff4d4f', bgColor: '#fff1f0' },
  HIGH: { label: '高', color: '#fa8c16', bgColor: '#fff7e6' },
  MEDIUM: { label: '中', color: '#faad14', bgColor: '#fffbe6' },
  LOW: { label: '低', color: '#52c41a', bgColor: '#f6ffed' },
};

const statusConfig: Record<string, { label: string; color: string; icon: any; status: any }> = {
  PENDING: { label: '待处置', color: 'red', icon: <ExclamationCircleOutlined />, status: 'error' },
  PROCESSING: { label: '处置中', color: 'blue', icon: <ClockCircleOutlined />, status: 'processing' },
  RESOLVED: { label: '已处置', color: 'green', icon: <CheckCircleOutlined />, status: 'success' },
  DISMISSED: { label: '已忽略', color: 'default', icon: <CloseCircleOutlined />, status: 'default' },
  ESCALATED: { label: '已升级', color: 'orange', icon: <ArrowUpOutlined />, status: 'warning' },
};

const disposalTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  VERIFY: { label: '核实情况', icon: <EyeOutlined />, color: '#1677ff' },
  MONITOR: { label: '持续监控', icon: <BellOutlined />, color: '#13c2c2' },
  INVESTIGATE: { label: '深入调查', icon: <SafetyCertificateOutlined />, color: '#722ed1' },
  ASSIGN_TASK: { label: '指派任务', icon: <TeamOutlined />, color: '#fa8c16' },
  DISMISS: { label: '忽略预警', icon: <CloseCircleOutlined />, color: '#999' },
  ESCALATE: { label: '升级处置', icon: <ArrowUpOutlined />, color: '#ff4d4f' },
  OTHER: { label: '其他操作', icon: <FileTextOutlined />, color: '#666' },
};

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<any>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [escalateModalVisible, setEscalateModalVisible] = useState(false);
  const [disposalModalVisible, setDisposalModalVisible] = useState(false);
  const [assignForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [disposalForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [persons, setPersons] = useState<any[]>([]);

  useEffect(() => {
    loadAlertData();
    loadPersons();
  }, [id]);

  const loadAlertData = async () => {
    setLoading(true);
    try {
      const res = await alertApi.get(id!);
      setAlert(res.data);
    } catch (error) {
      message.error('加载预警详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPersons = async () => {
    try {
      const res = await personApi.all();
      setPersons(res.data);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const handleAssign = async () => {
    try {
      const values = await assignForm.validateFields();
      setSubmitting(true);
      await alertApi.assign(id!, {
        ...values,
        operatorName: '当前用户',
      });
      message.success('指派成功');
      setAssignModalVisible(false);
      assignForm.resetFields();
      loadAlertData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    try {
      const values = await resolveForm.validateFields();
      setSubmitting(true);
      await alertApi.resolve(id!, {
        ...values,
        operatorName: '当前用户',
      });
      message.success('处置完成');
      setResolveModalVisible(false);
      resolveForm.resetFields();
      loadAlertData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    try {
      const values = await escalateForm.validateFields();
      setSubmitting(true);
      await alertApi.escalate(id!, {
        ...values,
        operatorName: '当前用户',
      });
      message.success('已升级预警');
      setEscalateModalVisible(false);
      escalateForm.resetFields();
      loadAlertData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDisposal = async () => {
    try {
      const values = await disposalForm.validateFields();
      setSubmitting(true);
      await alertApi.addDisposal(id!, {
        ...values,
        operatorName: '当前用户',
        operatorDept: '刑侦大队',
      });
      message.success('处置记录已添加');
      setDisposalModalVisible(false);
      disposalForm.resetFields();
      loadAlertData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!alert) {
    return <div className="page-container"><Empty description="加载中..." /></div>;
  }

  const tConfig = targetTypeConfig[alert.targetType];
  const levelConfig = alertLevelConfig[alert.alertLevel];
  const sConfig = statusConfig[alert.status];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: levelConfig?.bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: levelConfig?.color, fontSize: 18,
            }}>
              <BellOutlined />
            </div>
            预警详情
            <Tag color={levelConfig?.color} style={{ fontSize: 14, padding: '2px 12px' }}>
              <WarningOutlined /> {levelConfig?.label}级
            </Tag>
            <Badge status={sConfig?.status} text={<span style={{ color: sConfig?.color === 'default' ? '#999' : sConfig?.color }}>
              {sConfig?.icon} {sConfig?.label}
            </span>} />
          </Space>
        </h2>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/alerts')}>
            返回列表
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            title={
              <Space>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: tConfig?.bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: tConfig?.color, fontSize: 20,
                }}>
                  {tConfig?.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{alert.title}</div>
                  <Space size={8} style={{ marginTop: 4 }}>
                    <Tag color={tConfig?.color}>{tConfig?.label}</Tag>
                    <span style={{ color: '#999', fontSize: 13 }}>{alert.alertNumber}</span>
                  </Space>
                </div>
              </Space>
            }
            className="card-shadow"
            loading={loading}
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="预警内容" span={2}>
                <div style={{ padding: '8px 0', whiteSpace: 'pre-wrap' }}>{alert.content}</div>
              </Descriptions.Item>
              <Descriptions.Item label="布控对象">
                {alert.targetName || alert.person?.name || alert.evidence?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="触发来源">
                {alert.triggerSource || '系统自动触发'}
              </Descriptions.Item>
              <Descriptions.Item label="触发时间">
                {moment(alert.triggerTime).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="预警编号">
                {alert.alertNumber}
              </Descriptions.Item>
              {alert.rule && (
                <Descriptions.Item label="关联规则" span={2}>
                  <Space>
                    <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
                    <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => navigate(`/surveillance-rules/${alert.rule.id}/edit`)}>
                      {alert.rule.name}
                    </span>
                    <Tag>{alert.rule.ruleNumber}</Tag>
                  </Space>
                </Descriptions.Item>
              )}
              {alert.case && (
                <Descriptions.Item label="关联案件" span={2}>
                  <Space>
                    <Tag color="blue">{alert.case.caseNumber}</Tag>
                    <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => navigate(`/cases/${alert.case.id}`)}>
                      {alert.case.title}
                    </span>
                  </Space>
                </Descriptions.Item>
              )}
              {alert.person && (
                <Descriptions.Item label="关联人员" span={2}>
                  <Space>
                    <UserOutlined style={{ color: '#1677ff' }} />
                    <span style={{ cursor: 'pointer', color: '#1677ff', fontWeight: 600 }} onClick={() => navigate(`/persons/${alert.person.id}`)}>
                      {alert.person.name}
                    </span>
                    <Tag>{alert.person.personType}</Tag>
                    {alert.person.phone && <span style={{ color: '#999' }}>{alert.person.phone}</span>}
                  </Space>
                </Descriptions.Item>
              )}
              {alert.evidence && (
                <Descriptions.Item label="关联证据" span={2}>
                  <Space>
                    <PaperClipOutlined style={{ color: '#fa8c16' }} />
                    <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => navigate(`/evidences/${alert.evidence.id}`)}>
                      {alert.evidence.name}
                    </span>
                    <Tag color="orange">{alert.evidence.type}</Tag>
                    <span style={{ color: '#999' }}>{alert.evidence.evidenceNumber}</span>
                  </Space>
                </Descriptions.Item>
              )}
              {alert.location && (
                <Descriptions.Item label="相关地点" span={2}>
                  <Space>
                    <EnvironmentOutlined style={{ color: '#722ed1' }} />
                    {alert.location}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Space wrap size="middle">
              {alert.status !== 'RESOLVED' && alert.status !== 'DISMISSED' && (
                <>
                  <Button
                    type="primary"
                    size="large"
                    icon={<TeamOutlined />}
                    onClick={() => setAssignModalVisible(true)}
                  >
                    指派处置人员
                  </Button>
                  <Button
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={() => setDisposalModalVisible(true)}
                  >
                    添加处置记录
                  </Button>
                  <Button
                    size="large"
                    danger
                    icon={<ArrowUpOutlined />}
                    onClick={() => setEscalateModalVisible(true)}
                  >
                    升级预警
                  </Button>
                </>
              )}
              {(alert.status === 'PENDING' || alert.status === 'PROCESSING' || alert.status === 'ESCALATED') && (
                <Button
                  type="primary"
                  size="large"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => setResolveModalVisible(true)}
                >
                  完成处置
                </Button>
              )}
            </Space>
          </Card>

          <Card
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
                处置记录
                <Tag color="blue">{alert.disposals?.length || 0} 条</Tag>
              </Space>
            }
            className="card-shadow"
            extra={
              <Button size="small" icon={<PlusOutlined />} onClick={() => setDisposalModalVisible(true)}>
                添加记录
              </Button>
            }
          >
            {alert.disposals && alert.disposals.length > 0 ? (
              <Timeline
                mode="left"
                items={alert.disposals.map((d: any) => {
                  const dConfig = disposalTypeConfig[d.disposalType];
                  return {
                    color: dConfig?.color || '#999',
                    dot: dConfig?.icon || <FileTextOutlined />,
                    label: moment(d.disposalTime).format('YYYY-MM-DD HH:mm'),
                    children: (
                      <Card size="small" style={{ marginBottom: 8 }}>
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Space>
                            <Tag color={dConfig?.color}>
                              {dConfig?.icon} {dConfig?.label}
                            </Tag>
                            <strong>{d.title}</strong>
                          </Space>
                          {d.description && (
                            <div style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{d.description}</div>
                          )}
                          {d.result && (
                            <div style={{ padding: '8px 12px', background: '#f6ffed', borderRadius: 4, color: '#389e0d' }}>
                              <strong>处置结果：</strong>{d.result}
                            </div>
                          )}
                          {d.nextAction && (
                            <div style={{ color: '#fa8c16' }}>
                              <strong>下一步：</strong>{d.nextAction}
                            </div>
                          )}
                          <Space style={{ fontSize: 12, color: '#999' }}>
                            <UserOutlined /> {d.operatorName || '系统'}
                            {d.operatorDept && <span>({d.operatorDept})</span>}
                          </Space>
                        </Space>
                      </Card>
                    ),
                  };
                })}
              />
            ) : (
              <Empty description="暂无处置记录" />
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="预警状态" className="card-shadow" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>当前状态</span>
                <Badge status={sConfig?.status} text={<span style={{ color: sConfig?.color === 'default' ? '#999' : sConfig?.color, fontWeight: 600 }}>
                  {sConfig?.icon} {sConfig?.label}
                </span>} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>预警级别</span>
                <Tag color={levelConfig?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
                  <WarningOutlined /> {levelConfig?.label}级
                </Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>处置人员</span>
                {alert.assigneeName ? (
                  <Space>
                    <UserOutlined style={{ color: '#1677ff' }} />
                    <strong>{alert.assigneeName}</strong>
                    {alert.assigneeDept && <span style={{ color: '#999' }}>({alert.assigneeDept})</span>}
                  </Space>
                ) : (
                  <span style={{ color: '#ccc' }}>未指派</span>
                )}
              </div>
              {alert.resolveTime && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>处置完成时间</span>
                  <span>{moment(alert.resolveTime).format('YYYY-MM-DD HH:mm')}</span>
                </div>
              )}
              {alert.resolveNote && (
                <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                  <div style={{ color: '#666', marginBottom: 4 }}>处置备注</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{alert.resolveNote}</div>
                </div>
              )}
            </Space>
          </Card>

          <Card title="快捷操作" className="card-shadow">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button
                block
                size="large"
                icon={<BellOutlined />}
                onClick={() => navigate('/surveillance-rules')}
              >
                管理布控规则
              </Button>
              <Button
                block
                size="large"
                icon={<SafetyCertificateOutlined />}
                onClick={() => navigate('/alerts')}
              >
                查看全部预警
              </Button>
              {alert.caseId && (
                <Button
                  block
                  size="large"
                  icon={<FileTextOutlined />}
                  onClick={() => navigate(`/cases/${alert.caseId}`)}
                >
                  查看关联案件
                </Button>
              )}
              {alert.personId && (
                <Button
                  block
                  size="large"
                  icon={<UserOutlined />}
                  onClick={() => navigate(`/persons/${alert.personId}`)}
                >
                  查看关联人员
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title="指派处置人员"
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        onOk={handleAssign}
        confirmLoading={submitting}
        okText="确认指派"
        cancelText="取消"
        width={500}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="assigneeName"
            label="处置人员"
            rules={[{ required: true, message: '请输入处置人员姓名' }]}
          >
            <Select
              showSearch
              placeholder="选择或输入处置人员"
              optionFilterProp="children"
              allowClear
              options={persons.map((p: any) => ({ label: `${p.name}（${p.personType}）`, value: p.name }))}
            />
          </Form.Item>
          <Form.Item name="assigneeDept" label="所属部门">
            <Input placeholder="请输入所属部门" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="完成处置"
        open={resolveModalVisible}
        onCancel={() => setResolveModalVisible(false)}
        onOk={handleResolve}
        confirmLoading={submitting}
        okText="确认完成"
        cancelText="取消"
        width={500}
      >
        <Form form={resolveForm} layout="vertical">
          <Form.Item
            name="status"
            label="处置结果"
            initialValue="RESOLVED"
            rules={[{ required: true, message: '请选择处置结果' }]}
          >
            <Radio.Group>
              <Radio.Button value="RESOLVED"><CheckCircleOutlined /> 已处置完成</Radio.Button>
              <Radio.Button value="DISMISSED"><CloseCircleOutlined /> 忽略此预警</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="resolveNote"
            label="处置说明"
            rules={[{ required: true, message: '请填写处置说明' }]}
          >
            <TextArea rows={4} placeholder="请详细描述处置过程和结果" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="升级预警"
        open={escalateModalVisible}
        onCancel={() => setEscalateModalVisible(false)}
        onOk={handleEscalate}
        confirmLoading={submitting}
        okText="确认升级"
        cancelText="取消"
        width={500}
      >
        <Form form={escalateForm} layout="vertical">
          <Form.Item
            name="reason"
            label="升级原因"
            rules={[{ required: true, message: '请填写升级原因' }]}
          >
            <TextArea rows={4} placeholder="请说明升级预警级别的原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加处置记录"
        open={disposalModalVisible}
        onCancel={() => setDisposalModalVisible(false)}
        onOk={handleAddDisposal}
        confirmLoading={submitting}
        okText="保存记录"
        cancelText="取消"
        width={600}
      >
        <Form form={disposalForm} layout="vertical">
          <Form.Item
            name="disposalType"
            label="处置类型"
            rules={[{ required: true, message: '请选择处置类型' }]}
            initialValue="VERIFY"
          >
            <Radio.Group>
              {Object.entries(disposalTypeConfig).map(([type, config]) => (
                <Radio.Button key={type} value={type}>
                  {config.icon} {config.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="title"
            label="处置标题"
            rules={[{ required: true, message: '请填写处置标题' }]}
          >
            <Input placeholder="简要描述本次处置操作" />
          </Form.Item>
          <Form.Item name="description" label="处置详情">
            <TextArea rows={3} placeholder="详细描述处置过程" />
          </Form.Item>
          <Form.Item name="result" label="处置结果">
            <TextArea rows={3} placeholder="描述处置结果和发现" />
          </Form.Item>
          <Form.Item name="nextAction" label="下一步计划">
            <TextArea rows={2} placeholder="说明后续需要采取的措施" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
