import { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Timeline,
  Alert,
  Divider,
  Empty,
  Row,
  Col,
  Tooltip,
  Steps,
} from 'antd';
import {
  AuditOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { approvalApi } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

export const approvalCategoryMap: Record<string, { label: string; color: string }> = {
  CASE_FILING: { label: '案件立案', color: 'blue' },
  CLUE_ADOPT: { label: '线索采用', color: 'orange' },
  EVIDENCE_CHECKOUT: { label: '证据出库', color: 'purple' },
  EVIDENCE_DESTROY: { label: '证据销毁', color: 'red' },
  CASE_TRANSFER: { label: '案件移送', color: 'geekblue' },
  CASE_CLOSE: { label: '结案归档', color: 'green' },
  FORENSIC_IMPORT: { label: '电子取证导入', color: 'cyan' },
  OTHER: { label: '其他审批', color: 'default' },
};

export const approvalStatusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'gold' },
  IN_PROGRESS: { label: '审批中', color: 'blue' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
  ROLLED_BACK: { label: '已回退', color: 'orange' },
  CANCELLED: { label: '已取消', color: 'default' },
};

export const approvalActionMap: Record<string, { label: string; color: string; icon: any }> = {
  SUBMIT: { label: '提交', color: 'blue', icon: <FileTextOutlined /> },
  APPROVE: { label: '通过', color: 'green', icon: <CheckCircleOutlined /> },
  REJECT: { label: '驳回', color: 'red', icon: <CloseCircleOutlined /> },
  ROLLBACK: { label: '回退', color: 'orange', icon: <RollbackOutlined /> },
  CANCEL: { label: '取消', color: 'default', icon: <CloseCircleOutlined /> },
  URGE: { label: '催办', color: 'gold', icon: <ThunderboltOutlined /> },
};

interface ApprovalInfo {
  id: string;
  instanceNumber: string;
  title: string;
  category: string;
  categoryLabel?: string;
  status: string;
  statusLabel?: string;
  currentLevel: number;
  totalLevels: number;
  applyReason?: string;
  applicantName?: string;
  createdAt: string;
  records?: Array<{
    id: string;
    level: number;
    action: string;
    opinion?: string;
    operatorName?: string;
    operatorDept?: string;
    operatorRole?: string;
    actionTime: string;
    beforeStatus?: string;
    afterStatus?: string;
    remark?: string;
  }>;
  flow?: {
    id: string;
    name: string;
    nodes?: Array<{
      id: string;
      level: number;
      name: string;
      approverRole?: string;
      nodeStatus?: string;
      isRequired: boolean;
    }>;
  };
}

interface ApprovalInfoPanelProps {
  targetType: string;
  targetId: string;
  targetName?: string;
  targetNumber?: string;
  caseId?: string;
  clueId?: string;
  evidenceId?: string;
  approvals?: ApprovalInfo[];
  currentApproval?: ApprovalInfo | null;
  allowedCategories?: string[];
  applicantName?: string;
  onApprovalCreated?: () => void;
  onApprovalStatusChange?: () => void;
}

export default function ApprovalInfoPanel({
  targetType,
  targetId,
  targetName,
  targetNumber,
  caseId,
  clueId,
  evidenceId,
  approvals = [],
  currentApproval,
  allowedCategories,
  applicantName,
  onApprovalCreated,
  onApprovalStatusChange,
}: ApprovalInfoPanelProps) {
  const navigate = useNavigate();
  const [submitModal, setSubmitModal] = useState(false);
  const [submitForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [flowOptions, setFlowOptions] = useState<any[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);

  const loadDefaultFlow = async (category: string) => {
    if (!category) return;
    setLoadingFlows(true);
    try {
      const res = await approvalApi.getDefaultFlow(category);
      if (res.data) {
        setSelectedFlow(res.data);
        const allRes = await approvalApi.listFlows({ category, status: '启用', pageSize: 100 });
        setFlowOptions(allRes.data.items || []);
        submitForm.setFieldsValue({ flowId: res.data.id });
      } else {
        message.warning('该审批类别暂无启用的流程，请先在审批管理中配置');
      }
    } catch (error) {
      message.warning('暂无该类别的审批流程，请先配置');
      setSelectedFlow(null);
      setFlowOptions([]);
    } finally {
      setLoadingFlows(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedFlow(null);
    loadDefaultFlow(category);
  };

  const handleFlowSelect = (flowId: string) => {
    const flow = flowOptions.find((f: any) => f.id === flowId);
    setSelectedFlow(flow || null);
  };

  const handleSubmitApproval = async (values: any) => {
    setSubmitting(true);
    try {
      const data = {
        ...values,
        flowId: selectedFlow?.id,
        category: selectedCategory,
        title: values.title || `${approvalCategoryMap[selectedCategory]?.label || selectedCategory} - ${targetName || targetNumber}`,
        targetType,
        targetId,
        targetName,
        targetNumber,
        caseId,
        clueId,
        evidenceId,
        applicantName: values.applicantName || applicantName,
        applicantDept: values.applicantDept,
        applyReason: values.applyReason,
        isUrgent: values.isUrgent || false,
        urgentReason: values.urgentReason,
      };
      await approvalApi.submitInstance(data);
      message.success('审批申请提交成功');
      setSubmitModal(false);
      submitForm.resetFields();
      setSelectedCategory('');
      setSelectedFlow(null);
      if (onApprovalCreated) onApprovalCreated();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const availableCategories = allowedCategories || Object.keys(approvalCategoryMap);

  const displayApproval = currentApproval || approvals[0];

  const renderProgressSteps = (approval: ApprovalInfo) => {
    const nodes = approval.flow?.nodes || [];
    if (nodes.length === 0) return null;

    return (
      <Steps
        size="small"
        current={Math.max(0, approval.currentLevel - 1)}
        status={
          approval.status === 'REJECTED' ? 'error' :
          approval.status === 'APPROVED' ? 'finish' :
          approval.status === 'ROLLED_BACK' ? 'error' :
          'process'
        }
        items={nodes.map((node) => {
          const approvedRecord = approval.records?.find(
            (r) => r.level === node.level && r.action === 'APPROVE'
          );
          const rejectRecord = approval.records?.find(
            (r) => r.level === node.level && r.action === 'REJECT'
          );
          const rollbackRecord = approval.records?.find(
            (r) => r.level === node.level && r.action === 'ROLLBACK'
          );

          let desc = '';
          if (approvedRecord) {
            desc = `${approvedRecord.operatorName || '未知'} · ${moment(approvedRecord.actionTime).format('MM-DD HH:mm')}`;
          } else if (rejectRecord) {
            desc = `驳回: ${rejectRecord.operatorName || '未知'}`;
          } else if (rollbackRecord) {
            desc = `回退: ${rollbackRecord.operatorName || '未知'}`;
          }

          return {
            title: node.name,
            description: desc || undefined,
            subTitle: node.approverRole ? <Tag color="default" style={{ fontSize: 11 }}>{node.approverRole}</Tag> : undefined,
          };
        })}
      />
    );
  };

  const renderApprovalRecords = (approval: ApprovalInfo) => {
    const records = approval.records || [];
    if (records.length === 0) {
      return <Empty description="暂无审批记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <Timeline
        mode="left"
        items={records.map((record) => {
          const actionInfo = approvalActionMap[record.action] || approvalActionMap.SUBMIT;
          return {
            color: actionInfo.color,
            dot: actionInfo.icon,
            label: (
              <div style={{ minWidth: 140 }}>
                <div style={{ fontWeight: 500, color: '#333' }}>
                  {moment(record.actionTime).format('YYYY-MM-DD HH:mm')}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  <Space>
                    <UserOutlined />
                    {record.operatorName || '系统'}
                    {record.operatorDept && <Tag style={{ fontSize: 11, padding: '0 4px' }}>{record.operatorDept}</Tag>}
                  </Space>
                </div>
                {record.operatorRole && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    角色: {record.operatorRole}
                  </div>
                )}
              </div>
            ),
            children: (
              <div style={{ marginBottom: 8 }}>
                <Space style={{ marginBottom: 4 }}>
                  <Tag color={actionInfo.color}>{actionInfo.label}</Tag>
                  <Tag>第{record.level}级</Tag>
                  {record.beforeStatus && record.afterStatus && (
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {record.beforeStatus} → {record.afterStatus}
                    </span>
                  )}
                </Space>
                {record.opinion && (
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      color: '#555',
                      lineHeight: 1.7,
                      fontSize: 13,
                      background: '#fafafa',
                      padding: '8px 12px',
                      borderRadius: 6,
                      marginTop: 4,
                    }}
                  >
                    {record.opinion}
                  </div>
                )}
                {record.remark && (
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    备注：{record.remark}
                  </div>
                )}
              </div>
            ),
          };
        })}
      />
    );
  };

  return (
    <Card
      size="small"
      style={{ borderRadius: 8 }}
      title={
        <Space>
          <AuditOutlined style={{ color: '#722ed1' }} />
          <span>多级审批</span>
          {currentApproval && (
            <Tag color={approvalStatusMap[currentApproval.status]?.color || 'default'}>
              {currentApproval.statusLabel || currentApproval.status}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          {!displayApproval || !['PENDING', 'IN_PROGRESS', 'ROLLED_BACK'].includes(displayApproval.status) ? (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                submitForm.resetFields();
                setSelectedCategory('');
                setSelectedFlow(null);
                setSubmitModal(true);
              }}
            >
              发起审批
            </Button>
          ) : (
            <Tooltip title="当前有进行中的审批">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/approvals/${displayApproval.id}`)}
              >
                查看审批
              </Button>
            </Tooltip>
          )}
        </Space>
      }
    >
      {!displayApproval ? (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <AuditOutlined style={{ fontSize: 36, color: '#d9d9d9', marginBottom: 8 }} />
          <div style={{ color: '#999', fontSize: 13 }}>暂无审批记录</div>
          <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>
            点击右上角"发起审批"开始审批流程
          </div>
        </div>
      ) : (
        <div>
          {displayApproval.status === 'IN_PROGRESS' && (
            <Alert
              message="审批进行中"
              description={`当前为第 ${displayApproval.currentLevel} 级审批，请等待审批完成。如需催办请进入审批详情页。`}
              type="info"
              showIcon
              icon={<ClockCircleOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}
          {displayApproval.status === 'ROLLED_BACK' && (
            <Alert
              message="审批已回退"
              description={`已回退至第 ${displayApproval.currentLevel} 级，请查看回退意见并修改后重新提交。`}
              type="warning"
              showIcon
              icon={<RollbackOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}
          {displayApproval.status === 'APPROVED' && (
            <Alert
              message="审批已通过"
              description="该业务操作的多级审批已全部通过，可以执行后续操作。"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}
          {displayApproval.status === 'REJECTED' && (
            <Alert
              message="审批已驳回"
              description="该审批申请已被驳回，请查看驳回原因。"
              type="error"
              showIcon
              icon={<CloseCircleOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}
          {displayApproval.status === 'CANCELLED' && (
            <Alert
              message="审批已取消"
              description="该审批申请已被取消。"
              type="info"
              style={{ marginBottom: 12 }}
            />
          )}

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>审批类别</div>
              <Space>
                <Tag color={approvalCategoryMap[displayApproval.category]?.color || 'default'}>
                  {displayApproval.categoryLabel || displayApproval.category}
                </Tag>
                {displayApproval.title && <span style={{ fontSize: 13 }}>{displayApproval.title}</span>}
              </Space>
            </Col>
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>审批编号</div>
              <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{displayApproval.instanceNumber}</span>
            </Col>
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>当前进度</div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                第 {Math.min(displayApproval.currentLevel, displayApproval.totalLevels)} 级 / 共 {displayApproval.totalLevels} 级
              </span>
            </Col>
          </Row>

          {displayApproval.flow && displayApproval.flow.nodes && displayApproval.flow.nodes.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: '#333' }}>
                <Space><FileTextOutlined />审批流程</Space>
              </div>
              {renderProgressSteps(displayApproval)}
            </div>
          )}

          {displayApproval.applyReason && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>申请理由</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: '#555' }}>
                {displayApproval.applyReason}
              </div>
            </div>
          )}

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: '#333' }}>
              <Space><FileTextOutlined />审批记录 ({displayApproval.records?.length || 0})</Space>
            </div>
            {renderApprovalRecords(displayApproval)}
          </div>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/approvals/${displayApproval.id}`)}
            >
              进入审批详情页
            </Button>
          </div>
        </div>
      )}

      <Modal
        title={
          <Space>
            <AuditOutlined style={{ color: '#722ed1' }} />
            发起审批申请
          </Space>
        }
        open={submitModal}
        onCancel={() => setSubmitModal(false)}
        footer={null}
        width={640}
        maskClosable={false}
      >
        <Form form={submitForm} layout="vertical" onFinish={handleSubmitApproval}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="审批类别"
                rules={[{ required: true, message: '请选择审批类别' }]}
              >
                <Select
                  placeholder="选择审批类别"
                  onChange={handleCategoryChange}
                  options={availableCategories.map((key) => ({
                    value: key,
                    label: approvalCategoryMap[key]?.label || key,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="flowId"
                label="审批流程"
                rules={[{ required: true, message: '请选择审批流程' }]}
              >
                <Select
                  placeholder="选择审批流程"
                  loading={loadingFlows}
                  disabled={!selectedCategory}
                  onChange={handleFlowSelect}
                  showSearch
                  optionFilterProp="label"
                  options={flowOptions.map((f: any) => ({
                    value: f.id,
                    label: `${f.name}${f.isDefault ? ' (默认)' : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {selectedFlow && selectedFlow.nodes && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
              <div style={{ fontWeight: 500, marginBottom: 8, color: '#389e0d' }}>
                流程预览：{selectedFlow.name}（{selectedFlow.nodes.length}级审批）
              </div>
              <Space wrap>
                {selectedFlow.nodes.map((node: any, index: number) => (
                  <span key={node.id || index}>
                    <Tag color="blue">第{node.level}级: {node.name}</Tag>
                    {index < selectedFlow.nodes.length - 1 && (
                      <span style={{ color: '#999', margin: '0 4px' }}>→</span>
                    )}
                  </span>
                ))}
              </Space>
            </div>
          )}

          <Form.Item
            name="title"
            label="审批标题"
            rules={[{ required: true, message: '请输入审批标题' }]}
          >
            <Input placeholder="请输入审批标题" maxLength={200} showCount />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="applicantName" label="申请人">
                <Input placeholder="申请人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="applicantDept" label="申请部门">
                <Input placeholder="申请部门" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isUrgent" label="紧急程度" initialValue={false}>
                <Select placeholder="选择紧急程度">
                  <Option value={false}>普通</Option>
                  <Option value={true}>加急</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="urgentReason"
                label="加急理由"
                rules={[
                  { required: submitForm.getFieldValue('isUrgent') === true, message: '加急请填写理由' },
                ]}
              >
                <Input placeholder="加急理由" disabled={submitForm.getFieldValue('isUrgent') !== true} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="applyReason"
            label="申请理由"
            rules={[{ required: true, message: '请输入申请理由' }]}
          >
            <TextArea rows={4} placeholder="请详细描述审批申请理由" maxLength={2000} showCount />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setSubmitModal(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<CheckCircleOutlined />}
                disabled={!selectedFlow}
              >
                提交审批申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
