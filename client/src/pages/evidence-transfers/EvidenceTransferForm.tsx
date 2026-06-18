import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, message, Row, Col } from 'antd';
import { evidenceTransferApi, evidenceApi } from '../../services/api';

interface EvidenceTransferFormProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  selectedEvidence?: any;
}

export default function EvidenceTransferForm({ visible, onCancel, onSuccess, selectedEvidence }: EvidenceTransferFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [evidences, setEvidences] = useState<any[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState(false);

  useEffect(() => {
    if (visible) {
      loadEvidences();
      if (selectedEvidence) {
        form.setFieldsValue({
          evidenceId: selectedEvidence.id,
        });
      }
    } else {
      form.resetFields();
    }
  }, [visible, selectedEvidence]);

  const loadEvidences = async () => {
    setLoadingEvidences(true);
    try {
      const res = await evidenceApi.list({ pageSize: 100 });
      setEvidences(res.data.items || []);
    } catch (error) {
      message.error('加载证据列表失败');
    } finally {
      setLoadingEvidences(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data: any = {
        ...values,
        expectedTime: values.expectedTime ? values.expectedTime.format('YYYY-MM-DD HH:mm:ss') : undefined,
      };

      await evidenceTransferApi.create(data);
      onSuccess();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const transferTypeOptions = [
    { label: '入库', value: 'STORAGE_IN' },
    { label: '借阅', value: 'BORROW' },
    { label: '移交', value: 'TRANSFER' },
    { label: '归还', value: 'RETURN' },
    { label: '销毁', value: 'DESTROY' },
    { label: '封存', value: 'SEAL' },
    { label: '解封', value: 'UNSEAL' },
  ];

  const priorityOptions = [
    { label: '普通', value: '普通' },
    { label: '紧急', value: '紧急' },
    { label: '特急', value: '特急' },
  ];

  return (
    <Modal
      title="新建证据流转"
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={700}
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="transferType"
              label="流转类型"
              rules={[{ required: true, message: '请选择流转类型' }]}
            >
              <Select placeholder="请选择流转类型" options={transferTypeOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="evidenceId"
              label="关联证据"
              rules={[{ required: true, message: '请选择证据' }]}
            >
              <Select
                placeholder="请选择证据"
                showSearch
                optionFilterProp="label"
                loading={loadingEvidences}
                options={evidences.map(e => ({
                  label: `${e.evidenceNumber} - ${e.name}`,
                  value: e.id,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="fromDepartment" label="来源部门">
              <Input placeholder="请输入来源部门" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="fromPerson" label="来源人">
              <Input placeholder="请输入来源人姓名" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="toDepartment" label="目标部门">
              <Input placeholder="请输入目标部门" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="toPerson" label="目标人">
              <Input placeholder="请输入目标人姓名" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="applicant" label="申请人">
              <Input placeholder="请输入申请人姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="applicantDept" label="申请部门">
              <Input placeholder="请输入申请部门" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="priority" label="优先级">
              <Select placeholder="请选择优先级" options={priorityOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="expectedTime" label="预期完成时间">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="reason" label="申请原因">
          <Input.TextArea rows={3} placeholder="请输入申请原因" />
        </Form.Item>

        <Form.Item name="description" label="详细说明">
          <Input.TextArea rows={4} placeholder="请输入详细说明" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="operator" label="经办人">
              <Input placeholder="请输入经办人姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="operatorDept" label="经办部门">
              <Input placeholder="请输入经办部门" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
