import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Row,
  Col,
  message,
  Modal,
  Form,
  Input,
  Steps,
  Timeline,
  Popconfirm,
  Divider,
  Typography,
  Avatar,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SafetyOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import { evidenceTransferApi } from '../../services/api';

const { Title, Text } = Typography;

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

export default function EvidenceTransferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [destroyModalVisible, setDestroyModalVisible] = useState(false);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [handleForm] = Form.useForm();
  const [receiveForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [destroyForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadTransfer();
      loadLogs();
    }
  }, [id]);

  const loadTransfer = async () => {
    setLoading(true);
    try {
      const res = await evidenceTransferApi.get(id!);
      setTransfer(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await evidenceTransferApi.getLogs(id!);
      setLogs(res.data.items || []);
    } catch (error) {
      console.error('加载日志失败:', error);
    }
  };

  const handleApprove = async () => {
    try {
      const values = await approveForm.validateFields();
      setActionLoading(true);
      await evidenceTransferApi.approve(id!, { ...values, pass: true });
      message.success('审批通过');
      setApproveModalVisible(false);
      approveForm.resetFields();
      loadTransfer();
      loadLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('审批失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      const values = await rejectForm.validateFields();
      setActionLoading(true);
      await evidenceTransferApi.approve(id!, { ...values, pass: false });
      message.success('已驳回');
      setRejectModalVisible(false);
      rejectForm.resetFields();
      loadTransfer();
      loadLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandle = async () => {
    try {
      const values = await handleForm.validateFields();
      setActionLoading(true);
      await evidenceTransferApi.handle(id!, values);
      message.success('处理成功');
      setHandleModalVisible(false);
      handleForm.resetFields();
      loadTransfer();
      loadLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('处理失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async () => {
    try {
      const values = await receiveForm.validateFields();
      setActionLoading(true);
      await evidenceTransferApi.receive(id!, values);
      message.success('签收成功');
      setReceiveModalVisible(false);
      receiveForm.resetFields();
      loadTransfer();
      loadLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('签收失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    try {
      const values = await returnForm.validateFields();
      setActionLoading(true);
      await evidenceTransferApi.return(id!, values);
      message.success('归还成功');
      setReturnModalVisible(false);
      returnForm.resetFields();
      loadTransfer();
      loadLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('归还失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDestroy = async () => {
    try {
      const values = await destroyForm.validateFields();
      setActionLoading(true);
      await evidenceTransferApi.destroy(id!, values);
      message.success('销毁完成');
      setDestroyModalVisible(false);
      destroyForm.resetFields();
      loadTransfer();
      loadLogs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await evidenceTransferApi.cancel(id!, { reason: '手动取消' });
      message.success('已取消');
      loadTransfer();
      loadLogs();
    } catch (error) {
      message.error('取消失败');
    }
  };

  const getStepItems = () => {
    const items: any[] = [
      { title: '申请', description: transfer?.applyTime ? moment(transfer.applyTime).format('YYYY-MM-DD HH:mm') : '', status: 'finish' },
    ];

    if (transfer?.approver || transfer?.status === 'REJECTED' || transfer?.status === 'IN_PROGRESS' || transfer?.status === 'COMPLETED') {
      items.push({
        title: '审批',
        description: transfer?.approveTime ? moment(transfer.approveTime).format('YYYY-MM-DD HH:mm') : '',
        status: transfer?.status === 'REJECTED' ? 'error' : 'finish',
      });
    } else if (transfer?.status === 'PENDING') {
      items.push({ title: '审批', status: 'process' });
    } else {
      items.push({ title: '审批', status: 'wait' });
    }

    if (transfer?.handler || transfer?.status === 'IN_PROGRESS' || transfer?.status === 'COMPLETED') {
      items.push({
        title: '处理',
        description: transfer?.handleTime ? moment(transfer.handleTime).format('YYYY-MM-DD HH:mm') : '',
        status: transfer?.status === 'COMPLETED' ? 'finish' : transfer?.handler ? 'finish' : 'process',
      });
    } else if (transfer?.status === 'IN_PROGRESS') {
      items.push({ title: '处理', status: 'process' });
    } else {
      items.push({ title: '处理', status: 'wait' });
    }

    if (transfer?.status === 'COMPLETED') {
      items.push({
        title: '完成',
        description: transfer?.actualTime ? moment(transfer.actualTime).format('YYYY-MM-DD HH:mm') : '',
        status: 'finish',
      });
    } else if (transfer?.status === 'CANCELLED') {
      items.push({ title: '已取消', status: 'error' });
    } else {
      items.push({ title: '完成', status: 'wait' });
    }

    return items;
  };

  const canApprove = transfer?.status === 'PENDING';
  const canHandle = transfer?.status === 'IN_PROGRESS' && !transfer?.handler;
  const canReceive = transfer?.status === 'IN_PROGRESS' && transfer?.handler && !transfer?.receiver && transfer?.transferType !== 'DESTROY';
  const canReturn = transfer?.status === 'IN_PROGRESS' && transfer?.transferType === 'RETURN';
  const canDestroy = transfer?.transferType === 'DESTROY' && (transfer?.status === 'PENDING' || transfer?.status === 'IN_PROGRESS');
  const canCancel = transfer?.status === 'PENDING' || transfer?.status === 'IN_PROGRESS';

  if (!transfer) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/evidence-transfers')}>返回</Button>
          <h2 className="page-title" style={{ margin: 0 }}>{transfer.transferNumber}</h2>
          <Tag color={transferTypeColors[transfer.transferType]}>{transfer.typeLabel}</Tag>
          <Tag color={statusColors[transfer.status]}>{transfer.statusLabel}</Tag>
        </Space>
        <Space>
          {canApprove && (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => setApproveModalVisible(true)}>
                审批通过
              </Button>
              <Button danger icon={<CloseOutlined />} onClick={() => setRejectModalVisible(true)}>
                驳回
              </Button>
            </>
          )}
          {canHandle && (
            <Button type="primary" onClick={() => setHandleModalVisible(true)}>
              开始处理
            </Button>
          )}
          {canReceive && (
            <Button type="primary" icon={<EyeOutlined />} onClick={() => setReceiveModalVisible(true)}>
              签收确认
            </Button>
          )}
          {canReturn && (
            <Button type="primary" onClick={() => setReturnModalVisible(true)}>
              归还确认
            </Button>
          )}
          {canDestroy && transfer?.status === 'IN_PROGRESS' && (
            <Button danger onClick={() => setDestroyModalVisible(true)}>
              执行销毁
            </Button>
          )}
          {canCancel && (
            <Popconfirm title="确定取消该流转？" onConfirm={handleCancel}>
              <Button>取消流转</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card className="card-shadow" loading={loading} title="流转进度">
            <Steps
              current={transfer.status === 'COMPLETED' ? 4 : transfer.status === 'REJECTED' ? 1 : transfer.status === 'CANCELLED' ? 4 : undefined}
              status={transfer.status === 'REJECTED' ? 'error' : transfer.status === 'CANCELLED' ? 'error' : undefined}
              items={getStepItems()}
              style={{ marginBottom: 24 }}
            />

            <Divider orientation="left">基本信息</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="流转编号">
                <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{transfer.transferNumber}</span>
              </Descriptions.Item>
              <Descriptions.Item label="流转类型">
                <Tag color={transferTypeColors[transfer.transferType]}>{transfer.typeLabel}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[transfer.status]}>{transfer.statusLabel}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">{transfer.priority || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {transfer.applyTime ? moment(transfer.applyTime).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预期完成时间">
                {transfer.expectedTime ? moment(transfer.expectedTime).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {transfer.reason && (
              <>
                <Divider orientation="left">申请原因</Divider>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{transfer.reason}</p>
              </>
            )}

            {transfer.description && (
              <>
                <Divider orientation="left">详细说明</Divider>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{transfer.description}</p>
              </>
            )}

            {transfer.transferType === 'DESTROY' && transfer.destroyMethod && (
              <>
                <Divider orientation="left">销毁信息</Divider>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="销毁方式">{transfer.destroyMethod || '-'}</Descriptions.Item>
                  <Descriptions.Item label="监督人">{transfer.destroySupervisor || '-'}</Descriptions.Item>
                  <Descriptions.Item label="见证人">{transfer.destroyWitness || '-'}</Descriptions.Item>
                  <Descriptions.Item label="销毁凭证">{transfer.destroyCertificate || '-'}</Descriptions.Item>
                </Descriptions>
              </>
            )}
          </Card>

          <Card className="card-shadow" style={{ marginTop: 16 }} title="操作日志" loading={loading}>
            <Timeline
              items={logs.map((log: any) => ({
                color: log.action === 'CREATE' ? 'blue' :
                       log.action === 'APPROVE' ? 'green' :
                       log.action === 'REJECT' ? 'red' :
                       log.action === 'RECEIVE' ? 'cyan' :
                       log.action === 'RETURN' ? 'purple' :
                       log.action === 'DESTROY' ? 'red' :
                       log.action === 'CANCEL' ? 'orange' : 'gray',
                children: (
                  <div>
                    <div style={{ fontWeight: 500 }}>{log.description || log.action}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      {log.operatorName && <span>操作人：{log.operatorName} </span>}
                      {log.operatorDept && <span>({log.operatorDept}) </span>}
                      {log.actionTime && moment(log.actionTime).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                    {log.remark && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                        {log.remark}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="card-shadow" loading={loading} title="证据信息">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ padding: 12, background: '#f0f5ff', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>证据名称</div>
                <a onClick={() => navigate(`/evidences/${transfer.evidenceId}`)} style={{ fontWeight: 'bold' }}>
                  {transfer.evidence?.name}
                </a>
                <div style={{ fontSize: 12, color: '#999', fontFamily: 'monospace', marginTop: 2 }}>
                  {transfer.evidence?.evidenceNumber}
                </div>
                <Tag style={{ marginTop: 8 }}>{transfer.evidence?.type}</Tag>
              </div>
            </Space>
          </Card>

          <Card className="card-shadow" style={{ marginTop: 16 }} loading={loading} title="流转双方">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ textAlign: 'center' }}>
                <Avatar size={48} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <div style={{ marginTop: 8, fontWeight: 500 }}>{transfer.fromPerson || '未指定'}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{transfer.fromDepartment || '来源部门'}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>送出方</div>
              </div>
              <div style={{ textAlign: 'center', color: '#d9d9d9' }}>
                ↓
              </div>
              <div style={{ textAlign: 'center' }}>
                <Avatar size={48} icon={<UserOutlined />} style={{ background: '#52c41a' }} />
                <div style={{ marginTop: 8, fontWeight: 500 }}>{transfer.toPerson || '未指定'}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{transfer.toDepartment || '目标部门'}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>接收方</div>
              </div>
            </Space>
          </Card>

          <Card className="card-shadow" style={{ marginTop: 16 }} loading={loading} title="责任追踪">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {transfer.applicant && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={32} style={{ background: '#1677ff' }}>
                    <FileTextOutlined />
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#999' }}>申请人</div>
                    <div style={{ fontWeight: 500 }}>{transfer.applicant}</div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>{transfer.applicantDept || '-'}</div>
                  </div>
                </div>
              )}
              {transfer.approver && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={32} style={{ background: '#52c41a' }}>
                    <CheckOutlined />
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#999' }}>审批人</div>
                    <div style={{ fontWeight: 500 }}>{transfer.approver}</div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>{transfer.approverDept || '-'}</div>
                  </div>
                </div>
              )}
              {transfer.handler && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={32} style={{ background: '#fa8c16' }}>
                    <ClockCircleOutlined />
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#999' }}>处理人</div>
                    <div style={{ fontWeight: 500 }}>{transfer.handler}</div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>{transfer.handlerDept || '-'}</div>
                  </div>
                </div>
              )}
              {transfer.receiver && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={32} style={{ background: '#722ed1' }}>
                    <SafetyOutlined />
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#999' }}>签收人</div>
                    <div style={{ fontWeight: 500 }}>{transfer.receiver}</div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>{transfer.receiverDept || '-'}</div>
                  </div>
                </div>
              )}
              {transfer.returner && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={32} style={{ background: '#13c2c2' }}>
                    <CheckOutlined />
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#999' }}>归还人</div>
                    <div style={{ fontWeight: 500 }}>{transfer.returner}</div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>{transfer.returnerDept || '-'}</div>
                  </div>
                </div>
              )}
            </Space>
          </Card>

          {transfer.case && (
            <Card className="card-shadow" style={{ marginTop: 16 }} title="关联信息">
              <div style={{ padding: 12, background: '#fff7e6', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>关联案件</div>
                <a onClick={() => navigate(`/cases/${transfer.caseId}`)} style={{ fontWeight: 'bold' }}>
                  {transfer.case.title}
                </a>
                <div style={{ fontSize: 12, color: '#999', fontFamily: 'monospace', marginTop: 2 }}>
                  {transfer.case.caseNumber}
                </div>
              </div>
              {transfer.clue && (
                <div style={{ padding: 12, background: '#f0f5ff', borderRadius: 6, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>关联线索</div>
                  <a onClick={() => navigate(`/clues/${transfer.clueId}`)} style={{ fontWeight: 'bold' }}>
                    {transfer.clue.title}
                  </a>
                  <div style={{ fontSize: 12, color: '#999', fontFamily: 'monospace', marginTop: 2 }}>
                    {transfer.clue.clueNumber}
                  </div>
                </div>
              )}
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="审批通过"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        onOk={handleApprove}
        confirmLoading={actionLoading}
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item name="approver" label="审批人" rules={[{ required: true, message: '请输入审批人姓名' }]}>
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item name="approverDept" label="审批部门">
            <Input placeholder="请输入审批部门" />
          </Form.Item>
          <Form.Item name="approveOpinion" label="审批意见">
            <Input.TextArea rows={4} placeholder="请输入审批意见" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回申请"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={handleReject}
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true }}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="approver" label="审批人" rules={[{ required: true, message: '请输入审批人姓名' }]}>
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item name="approverDept" label="审批部门">
            <Input placeholder="请输入审批部门" />
          </Form.Item>
          <Form.Item name="approveOpinion" label="驳回理由" rules={[{ required: true, message: '请输入驳回理由' }]}>
            <Input.TextArea rows={4} placeholder="请输入驳回理由" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="开始处理"
        open={handleModalVisible}
        onCancel={() => setHandleModalVisible(false)}
        onOk={handleHandle}
        confirmLoading={actionLoading}
      >
        <Form form={handleForm} layout="vertical">
          <Form.Item name="handler" label="处理人" rules={[{ required: true, message: '请输入处理人姓名' }]}>
            <Input placeholder="请输入处理人姓名" />
          </Form.Item>
          <Form.Item name="handlerDept" label="处理部门">
            <Input placeholder="请输入处理部门" />
          </Form.Item>
          <Form.Item name="description" label="处理说明">
            <Input.TextArea rows={4} placeholder="请输入处理说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="签收确认"
        open={receiveModalVisible}
        onCancel={() => setReceiveModalVisible(false)}
        onOk={handleReceive}
        confirmLoading={actionLoading}
      >
        <Form form={receiveForm} layout="vertical">
          <Form.Item name="receiver" label="签收人" rules={[{ required: true, message: '请输入签收人姓名' }]}>
            <Input placeholder="请输入签收人姓名" />
          </Form.Item>
          <Form.Item name="receiverDept" label="签收部门">
            <Input placeholder="请输入签收部门" />
          </Form.Item>
          <Form.Item name="receiveRemark" label="签收备注">
            <Input.TextArea rows={4} placeholder="请输入签收备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="归还确认"
        open={returnModalVisible}
        onCancel={() => setReturnModalVisible(false)}
        onOk={handleReturn}
        confirmLoading={actionLoading}
      >
        <Form form={returnForm} layout="vertical">
          <Form.Item name="returner" label="归还人" rules={[{ required: true, message: '请输入归还人姓名' }]}>
            <Input placeholder="请输入归还人姓名" />
          </Form.Item>
          <Form.Item name="returnerDept" label="归还部门">
            <Input placeholder="请输入归还部门" />
          </Form.Item>
          <Form.Item name="returnRemark" label="归还备注">
            <Input.TextArea rows={4} placeholder="请输入归还备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="执行销毁"
        open={destroyModalVisible}
        onCancel={() => setDestroyModalVisible(false)}
        onOk={handleDestroy}
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true }}
      >
        <Form form={destroyForm} layout="vertical">
          <Form.Item name="destroyMethod" label="销毁方式" rules={[{ required: true, message: '请选择/输入销毁方式' }]}>
            <Input placeholder="如：物理销毁、粉碎、焚烧等" />
          </Form.Item>
          <Form.Item name="destroySupervisor" label="监督人" rules={[{ required: true, message: '请输入监督人姓名' }]}>
            <Input placeholder="请输入监督人姓名" />
          </Form.Item>
          <Form.Item name="destroyWitness" label="见证人">
            <Input placeholder="请输入见证人姓名" />
          </Form.Item>
          <Form.Item name="destroyCertificate" label="销毁凭证号">
            <Input placeholder="请输入销毁凭证编号" />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请输入操作人姓名' }]}>
            <Input placeholder="请输入操作人姓名" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
