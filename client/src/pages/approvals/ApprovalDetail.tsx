import { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Steps,
  Timeline,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  Tooltip,
  Divider,
  Empty,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  AuditOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import moment from 'moment';
import { approvalApi } from '../../services/api';
import { categoryMap, statusMap, actionMap } from './ApprovalList';

const { TextArea } = Input;
const { Option } = Select;

export default function ApprovalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [approveModal, setApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rollbackModal, setRollbackModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);

  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [rollbackForm] = Form.useForm();
  const [cancelForm] = Form.useForm();

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await approvalApi.getInstance(id!);
      setData(res.data);
    } catch (error) {
      message.error('加载审批详情失败');
    } finally {
      setLoading(false);
    }
  };

  const canApprove = () => data && ['PENDING', 'IN_PROGRESS', 'ROLLED_BACK'].includes(data.status);
  const canReject = () => data && ['PENDING', 'IN_PROGRESS', 'ROLLED_BACK'].includes(data.status);
  const canRollback = () => data && ['IN_PROGRESS'].includes(data.status) && data.currentLevel > 1;
  const canCancel = () => data && !['APPROVED', 'REJECTED', 'CANCELLED'].includes(data.status);

  const handleSubmit = async (
    formInstance: any,
    apiCall: (data: any) => Promise<any>,
    successMsg: string,
    closeModal: (v: boolean) => void
  ) => {
    setSubmitting(true);
    try {
      const values = await formInstance.validateFields();
      await apiCall(values);
      message.success(successMsg);
      closeModal(false);
      loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getNodeStatusColor = (nodeStatus: string) => {
    switch (nodeStatus) {
      case 'APPROVED': return 'green';
      case 'REJECTED': return 'red';
      case 'ROLLED_BACK': return 'orange';
      case 'PENDING': return 'gold';
      default: return 'default';
    }
  };

  const getNodeStatusIcon = (nodeStatus: string, level: number) => {
    if (level < data?.currentLevel && nodeStatus === 'APPROVED') return <CheckCircleOutlined />;
    if (nodeStatus === 'APPROVED') return <CheckCircleOutlined />;
    if (nodeStatus === 'REJECTED') return <CloseCircleOutlined />;
    if (nodeStatus === 'ROLLED_BACK') return <RollbackOutlined />;
    return <ClockCircleOutlined />;
  };

  if (!data) return null;

  const flowNodes = data.flow?.nodes || [];
  const records = data.records || [];

  const currentNodeName = flowNodes.find((n: any) => n.level === data.currentLevel)?.name || '-';

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/approvals')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0, fontSize: 20 }}>{data.title}</h2>
          <Tag color={statusMap[data.status]?.color || 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
            {statusMap[data.status]?.label || data.status}
          </Tag>
          <Tag color={categoryMap[data.category]?.color || 'default'}>
            {data.categoryLabel || data.category}
          </Tag>
          {data.isUrgent && (
            <Tag color="red" icon={<ThunderboltOutlined />}>加急</Tag>
          )}
          <Tag color="purple" style={{ fontWeight: 500 }}>{data.instanceNumber}</Tag>
        </Space>
        <Space>
          {canCancel() && (
            <Button icon={<StopOutlined />} onClick={() => { cancelForm.resetFields(); setCancelModal(true); }}>
              取消审批
            </Button>
          )}
          {canCancel() && (
            <Button icon={<ThunderboltOutlined />} onClick={async () => {
              try {
                await approvalApi.urgeInstance(id!, { message: '请尽快审批', operatorName: data.applicantName });
                message.success('催办已发送');
                loadData();
              } catch (error: any) {
                message.error(error?.response?.data?.error || '催办失败');
              }
            }}>
              催办
            </Button>
          )}
        </Space>
      </div>

      {data.isUrgent && (
        <Alert
          message="加急审批"
          description={data.urgentReason || '该审批申请已标记为加急，请优先处理'}
          type="warning"
          showIcon
          icon={<ThunderboltOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card loading={loading} style={{ borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 16 }}>
          <Space><ApartmentOutlined />审批进度</Space>
        </div>
        <Steps
          current={Math.max(0, data.currentLevel - 1)}
          status={
            data.status === 'REJECTED' ? 'error' :
            data.status === 'APPROVED' ? 'finish' :
            data.status === 'ROLLED_BACK' ? 'error' :
            'process'
          }
          items={flowNodes.map((node: any) => {
            const nodeRecord = records.find((r: any) => r.level === node.level && r.action === 'APPROVE');
            const rejectRecord = records.find((r: any) => r.level === node.level && r.action === 'REJECT');
            const rollbackRecord = records.find((r: any) => r.level === node.level && r.action === 'ROLLBACK');

            let desc = '';
            if (nodeRecord) {
              desc = `${nodeRecord.operatorName || '未知'} · ${moment(nodeRecord.actionTime).format('MM-DD HH:mm')}`;
            } else if (rejectRecord) {
              desc = `驳回: ${rejectRecord.operatorName || '未知'}`;
            } else if (rollbackRecord) {
              desc = `回退: ${rollbackRecord.operatorName || '未知'}`;
            }

            return {
              title: node.name,
              description: desc || undefined,
              icon: getNodeStatusIcon(node.nodeStatus, node.level),
            };
          })}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card style={{ borderRadius: 8, marginBottom: 16 }} size="small"
            title={<Space><FileTextOutlined style={{ color: '#1890ff' }} />审批基本信息</Space>}
            extra={<Tag color={statusMap[data.status]?.color || 'default'}>{data.statusLabel || data.status}</Tag>}
          >
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="审批编号">{data.instanceNumber}</Descriptions.Item>
              <Descriptions.Item label="审批类别">{data.categoryLabel || data.category}</Descriptions.Item>
              <Descriptions.Item label="审批标题" span={2}>
                <span style={{ fontWeight: 500, fontSize: 15 }}>{data.title}</span>
              </Descriptions.Item>
              <Descriptions.Item label="审批流程">
                {data.flow?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前节点">
                <Tag color="blue">{currentNodeName}</Tag>
                <span style={{ color: '#999', marginLeft: 4 }}>第{data.currentLevel}级 / 共{data.totalLevels}级</span>
              </Descriptions.Item>
              <Descriptions.Item label="目标类型">
                <Tag>{data.targetType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标对象">
                {data.targetName ? (
                  <Tooltip title={`ID: ${data.targetId}`}>
                    <Tag color="blue" style={{ cursor: 'pointer' }}>
                      {data.targetNumber || data.targetName}
                    </Tag>
                  </Tooltip>
                ) : <span style={{ color: '#999' }}>-</span>}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                <Space><UserOutlined />{data.applicantName || '-'}</Space>
                {data.applicantDept && <Tag color="default" style={{ marginLeft: 4 }}>{data.applicantDept}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {moment(data.applyTime || data.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="申请理由" span={2}>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>
                  {data.applyReason || '-'}
                </div>
              </Descriptions.Item>
              {data.description && (
                <Descriptions.Item label="补充说明" span={2}>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>
                    {data.description}
                  </div>
                </Descriptions.Item>
              )}
              {data.completedTime && (
                <>
                  <Descriptions.Item label="完成时间">
                    {moment(data.completedTime).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="完成人">
                    {data.completedByName || data.completedBy || '-'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>

          {data.isUrgent && (
            <Card style={{ borderRadius: 8 }} size="small"
              title={<Space><ThunderboltOutlined style={{ color: '#fa541c' }} />加急信息</Space>}
            >
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="加急原因">
                  {data.urgentReason || '未说明'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>

        <Col span={10}>
          <Card style={{ borderRadius: 8, marginBottom: 16 }} size="small"
            title={<Space><AuditOutlined style={{ color: '#52c41a' }} />审批操作</Space>}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span style={{ fontWeight: 500 }}>审批通过</span>
                  <Tag color="blue">当前: {currentNodeName}</Tag>
                </Space>
                <Button
                  type={canApprove() ? 'primary' : 'default'}
                  icon={<CheckCircleOutlined />}
                  disabled={!canApprove()}
                  onClick={() => { approveForm.resetFields(); setApproveModal(true); }}
                  block
                  style={canApprove() ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                >
                  通过审批
                </Button>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div>
                <Space style={{ marginBottom: 8 }}>
                  <RollbackOutlined style={{ color: '#fa8c16' }} />
                  <span style={{ fontWeight: 500 }}>审批回退</span>
                  {canRollback() && (
                    <Tag color="orange">
                      回退至: {flowNodes.find((n: any) => n.level === data.currentLevel - 1)?.name || '上一级'}
                    </Tag>
                  )}
                </Space>
                <Button
                  icon={<RollbackOutlined />}
                  disabled={!canRollback()}
                  onClick={() => {
                    rollbackForm.resetFields();
                    rollbackForm.setFieldsValue({
                      targetLevel: data.currentLevel - 1,
                    });
                    setRollbackModal(true);
                  }}
                  block
                >
                  回退至上一级
                </Button>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div>
                <Space style={{ marginBottom: 8 }}>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  <span style={{ fontWeight: 500 }}>驳回审批</span>
                </Space>
                <Button
                  danger={canReject()}
                  icon={<CloseCircleOutlined />}
                  disabled={!canReject()}
                  onClick={() => { rejectForm.resetFields(); setRejectModal(true); }}
                  block
                >
                  驳回（终止流程）
                </Button>
              </div>

              {canCancel() && (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <div>
                    <Space style={{ marginBottom: 8 }}>
                      <StopOutlined />
                      <span style={{ fontWeight: 500 }}>取消审批</span>
                    </Space>
                    <Button
                      icon={<StopOutlined />}
                      onClick={() => { cancelForm.resetFields(); setCancelModal(true); }}
                      block
                    >
                      取消审批申请
                    </Button>
                  </div>
                </>
              )}
            </Space>
          </Card>

          <Card style={{ borderRadius: 8 }} size="small"
            title={<Space><HistoryOutlined style={{ color: '#722ed1' }} />审批节点详情</Space>}
          >
            {flowNodes.length > 0 ? (
              <Timeline
                mode="left"
                items={flowNodes.map((node: any) => {
                  const nodeRecords = records.filter((r: any) => r.level === node.level && r.action !== 'SUBMIT');
                  const latestRecord = nodeRecords[nodeRecords.length - 1];

                  let color = 'gray';
                  let dot = <ClockCircleOutlined />;
                  if (node.nodeStatus === 'APPROVED') {
                    color = 'green';
                    dot = <CheckCircleOutlined />;
                  } else if (node.nodeStatus === 'REJECTED') {
                    color = 'red';
                    dot = <CloseCircleOutlined />;
                  } else if (node.nodeStatus === 'ROLLED_BACK') {
                    color = 'orange';
                    dot = <RollbackOutlined />;
                  } else if (node.level === data.currentLevel) {
                    color = 'blue';
                    dot = <ClockCircleOutlined />;
                  }

                  return {
                    color,
                    dot,
                    label: (
                      <div style={{ minWidth: 120 }}>
                        <div style={{ fontWeight: 500 }}>第{node.level}级</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{node.approverRole || '-'}</div>
                      </div>
                    ),
                    children: (
                      <Card size="small" style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          <Space>
                            <Tag color={getNodeStatusColor(node.nodeStatus)}>
                              {node.nodeStatus === 'APPROVED' ? '已通过' :
                               node.nodeStatus === 'REJECTED' ? '已驳回' :
                               node.nodeStatus === 'ROLLED_BACK' ? '已回退' :
                               node.level === data.currentLevel ? '待审批' : '待审批'}
                            </Tag>
                            <span>{node.name}</span>
                            {node.isRequired ? <Tag color="blue">必须</Tag> : <Tag>可选</Tag>}
                          </Space>
                        </div>
                        {latestRecord && (
                          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                            <Space>
                              <UserOutlined />
                              {latestRecord.operatorName || '未知'}
                              {latestRecord.operatorDept && <Tag>{latestRecord.operatorDept}</Tag>}
                              <span style={{ color: '#999' }}>
                                {moment(latestRecord.actionTime).format('MM-DD HH:mm')}
                              </span>
                            </Space>
                            {latestRecord.opinion && (
                              <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, color: '#333' }}>
                                意见：{latestRecord.opinion}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ),
                  };
                })}
              />
            ) : (
              <Empty description="暂无审批节点" />
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 8, marginTop: 16 }} size="small"
        title={<Space><HistoryOutlined style={{ color: '#722ed1' }} />审批操作记录 ({records.length})</Space>}
      >
        {records.length > 0 ? (
          <Timeline
            mode="left"
            items={records.map((record: any) => {
              const actionInfo = actionMap[record.action] || actionMap.SUBMIT;
              return {
                color: actionInfo.color,
                dot: actionInfo.icon,
                label: (
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 500, color: '#333' }}>
                      {moment(record.actionTime).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      <Space>
                        <UserOutlined />
                        {record.operatorName || '系统'}
                        {record.operatorDept && <Tag>{record.operatorDept}</Tag>}
                      </Space>
                    </div>
                    {record.operatorRole && (
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                        角色: {record.operatorRole}
                      </div>
                    )}
                  </div>
                ),
                children: (
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>
                      <Space>
                        {actionInfo.icon}
                        <Tag color={actionInfo.color}>{actionInfo.label}</Tag>
                        <Tag>第{record.level}级</Tag>
                        <span style={{ color: '#999', fontSize: 12 }}>
                          {record.beforeStatus} → {record.afterStatus}
                        </span>
                      </Space>
                    </div>
                    {record.opinion && (
                      <div style={{
                        whiteSpace: 'pre-wrap',
                        color: '#555',
                        lineHeight: 1.7,
                        fontSize: 13,
                        background: '#fafafa',
                        padding: '8px 12px',
                        borderRadius: 6,
                        marginTop: 4,
                      }}>
                        审批意见：{record.opinion}
                      </div>
                    )}
                    {record.remark && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        备注：{record.remark}
                      </div>
                    )}
                  </Card>
                ),
              };
            })}
          />
        ) : (
          <Empty description="暂无审批记录" />
        )}
      </Card>

      <Modal
        title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />审批通过</Space>}
        open={approveModal}
        onCancel={() => setApproveModal(false)}
        footer={null}
        width={600}
      >
        <Form form={approveForm} layout="vertical" onFinish={(values) =>
          handleSubmit(approveForm, (d) => approvalApi.approveInstance(id!, d), '审批通过', setApproveModal)
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="operatorName" label="审批人" rules={[{ required: true, message: '请输入审批人' }]}>
                <Input placeholder="审批人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operatorDept" label="审批部门">
                <Input placeholder="审批人部门" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="operatorRole" label="审批角色">
            <Select placeholder="选择角色" allowClear>
              <Option value="接报案民警">接报案民警</Option>
              <Option value="主办侦查员">主办侦查员</Option>
              <Option value="法制审核人员">法制审核人员</Option>
              <Option value="指挥人员">指挥人员</Option>
              <Option value="案管人员">案管人员</Option>
              <Option value="其他角色">其他角色</Option>
            </Select>
          </Form.Item>
          <Form.Item name="opinion" label="审批意见">
            <TextArea rows={4} placeholder="请输入审批意见（可不填）" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setApproveModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<CheckCircleOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                确认通过
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} />驳回审批</Space>}
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        footer={null}
        width={600}
      >
        <Alert
          message="驳回将终止整个审批流程"
          description="驳回后，该审批将标记为已驳回状态，不可恢复。请确认后操作。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={rejectForm} layout="vertical" onFinish={(values) =>
          handleSubmit(rejectForm, (d) => approvalApi.rejectInstance(id!, d), '审批已驳回', setRejectModal)
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="operatorName" label="审批人" rules={[{ required: true, message: '请输入审批人' }]}>
                <Input placeholder="审批人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operatorDept" label="审批部门">
                <Input placeholder="审批人部门" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="opinion" label="驳回理由" rules={[{ required: true, message: '请输入驳回理由' }]}>
            <TextArea rows={4} placeholder="请详细说明驳回理由" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRejectModal(false)}>取消</Button>
              <Button danger type="primary" htmlType="submit" loading={submitting} icon={<CloseCircleOutlined />}>
                确认驳回
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><RollbackOutlined style={{ color: '#fa8c16' }} />审批回退</Space>}
        open={rollbackModal}
        onCancel={() => setRollbackModal(false)}
        footer={null}
        width={600}
      >
        <Alert
          message="回退将把审批流程回退到指定级别"
          description={`当前为第${data.currentLevel}级审批，回退后将退回至上一级重新审批。`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={rollbackForm} layout="vertical" onFinish={(values) =>
          handleSubmit(rollbackForm, (d) => approvalApi.rollbackInstance(id!, d), '审批已回退', setRollbackModal)
        }>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="operatorName" label="操作人" rules={[{ required: true, message: '请输入操作人' }]}>
                <Input placeholder="操作人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operatorDept" label="操作部门">
                <Input placeholder="操作人部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="targetLevel" label="回退目标级别">
                <Select placeholder="选择回退级别">
                  {flowNodes
                    .filter((n: any) => n.level < data.currentLevel)
                    .map((n: any) => (
                      <Option key={n.level} value={n.level}>
                        第{n.level}级 - {n.name}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="opinion" label="回退理由" rules={[{ required: true, message: '请输入回退理由' }]}>
            <TextArea rows={4} placeholder="请详细说明回退理由" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRollbackModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<RollbackOutlined />}
                style={{ background: '#fa8c16', borderColor: '#fa8c16' }}>
                确认回退
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><StopOutlined />取消审批</Space>}
        open={cancelModal}
        onCancel={() => setCancelModal(false)}
        footer={null}
        width={500}
      >
        <Alert
          message="取消后将终止审批流程"
          description="该操作不可恢复，请确认后操作。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={cancelForm} layout="vertical" onFinish={(values) =>
          handleSubmit(cancelForm, (d) => approvalApi.cancelInstance(id!, d), '审批已取消', setCancelModal)
        }>
          <Form.Item name="reason" label="取消原因">
            <TextArea rows={3} placeholder="请说明取消原因" maxLength={500} showCount />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCancelModal(false)}>返回</Button>
              <Button danger type="primary" htmlType="submit" loading={submitting}>
                确认取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
