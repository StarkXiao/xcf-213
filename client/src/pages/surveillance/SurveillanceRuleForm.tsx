import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Select, Button, Space, message, Row, Col, DatePicker,
  Radio, Checkbox, Transfer, Divider, Alert
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UserOutlined, EnvironmentOutlined, PaperClipOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { surveillanceRuleApi } from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const targetTypeConfig: Record<string, { label: string; icon: any; description: string }> = {
  PERSON: { label: '重点人员布控', icon: <UserOutlined />, description: '监控指定人员的活动轨迹、关联案件和线索等' },
  LOCATION: { label: '重点地点布控', icon: <EnvironmentOutlined />, description: '监控指定区域/地点的案件、线索和人员活动' },
  EVIDENCE: { label: '重点证据布控', icon: <PaperClipOutlined />, description: '监控指定证据的状态变化、借阅和流转等' },
};

export default function SurveillanceRuleForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState<any>({ cases: [], persons: [], evidences: [] });
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const isEdit = !!id;

  const targetType = Form.useWatch('targetType', form);

  useEffect(() => {
    loadOptions();
    if (isEdit) {
      loadRuleData();
    }
  }, [id]);

  useEffect(() => {
    setSelectedTargetIds([]);
    setTargetIds([]);
  }, [targetType]);

  const loadOptions = async () => {
    try {
      const res = await surveillanceRuleApi.getOptions();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadRuleData = async () => {
    setLoading(true);
    try {
      const res = await surveillanceRuleApi.get(id!);
      const data = res.data;
      form.setFieldsValue({
        ...data,
        locationKeywords: data.locationKeywords || undefined,
        validFrom: data.validFrom ? dayjs(data.validFrom) : undefined,
        validTo: data.validTo ? dayjs(data.validTo) : undefined,
      });
      if (data.targetIds) {
        try {
          const ids = JSON.parse(data.targetIds);
          setTargetIds(ids);
          setSelectedTargetIds(ids);
        } catch (e) {
          console.error('Failed to parse targetIds:', e);
        }
      }
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getTransferData = () => {
    if (targetType === 'PERSON') {
      return options.persons.map((p: any) => ({
        key: p.id,
        title: `${p.name}（${p.personType}）`,
        description: p.id,
      }));
    } else if (targetType === 'EVIDENCE') {
      return options.evidences.map((e: any) => ({
        key: e.id,
        title: `${e.name}`,
        description: e.evidenceNumber,
      }));
    }
    return [];
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const submitData: any = {
        ...values,
        targetIds: values.targetType !== 'LOCATION' ? selectedTargetIds : [],
        locationKeywords: values.targetType === 'LOCATION' ? values.locationKeywords : null,
        validFrom: values.validFrom ? values.validFrom.toISOString() : null,
        validTo: values.validTo ? values.validTo.toISOString() : null,
        operatorName: '当前用户',
      };

      if (isEdit) {
        await surveillanceRuleApi.update(id!, submitData);
        message.success('更新成功');
      } else {
        await surveillanceRuleApi.create(submitData);
        message.success('创建成功');
      }
      navigate('/surveillance-rules');
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || (isEdit ? '更新失败' : '创建失败');
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const tConfig = targetType ? targetTypeConfig[targetType] : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
            {isEdit ? '编辑布控规则' : '新建布控规则'}
          </Space>
        </h2>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/surveillance-rules')}>
            返回
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="基本信息" className="card-shadow" loading={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                targetType: 'PERSON',
                alertLevel: 'MEDIUM',
                status: 'ACTIVE',
                notifyChannels: ['SYSTEM'],
              }}
            >
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    name="name"
                    label="规则名称"
                    rules={[{ required: true, message: '请输入规则名称' }]}
                  >
                    <Input placeholder="请输入规则名称，如：重点嫌疑人张三布控" maxLength={100} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="status"
                    label="规则状态"
                    rules={[{ required: true, message: '请选择状态' }]}
                  >
                    <Select>
                      <Option value="ACTIVE">启用</Option>
                      <Option value="INACTIVE">停用</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="description"
                label="规则描述"
              >
                <TextArea rows={3} placeholder="请详细描述布控规则的目的和范围" maxLength={500} />
              </Form.Item>

              <Divider />

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="caseId"
                    label="关联案件"
                  >
                    <Select
                      placeholder="选择关联案件（可选）"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {options.cases.map((c: any) => (
                        <Option key={c.id} value={c.id}>
                          [{c.caseNumber}] {c.title}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="alertLevel"
                    label="预警级别"
                    rules={[{ required: true, message: '请选择预警级别' }]}
                  >
                    <Select>
                      <Option value="URGENT">紧急 - 立即处置</Option>
                      <Option value="HIGH">高 - 优先处置</Option>
                      <Option value="MEDIUM">中 - 正常处置</Option>
                      <Option value="LOW">低 - 关注即可</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="validFrom" label="生效时间">
                    <DatePicker style={{ width: '100%' }} showTime placeholder="选择生效起始时间" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="validTo" label="失效时间">
                    <DatePicker style={{ width: '100%' }} showTime placeholder="选择失效时间（不选为长期有效）" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Form.Item
                name="targetType"
                label="布控类型"
                rules={[{ required: true, message: '请选择布控类型' }]}
              >
                <Radio.Group size="large">
                  {Object.entries(targetTypeConfig).map(([type, config]) => (
                    <Radio.Button key={type} value={type} style={{ padding: '12px 20px', height: 'auto' }}>
                      <Space direction="vertical" size={2} style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 18 }}>{config.icon}</span>
                        <span style={{ fontWeight: 500 }}>{config.label}</span>
                      </Space>
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>

              {tConfig && (
                <Alert
                  message={tConfig.description}
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {targetType && targetType !== 'LOCATION' && (
                <Form.Item label="选择布控对象">
                  <Transfer
                    dataSource={getTransferData()}
                    titles={['可选对象', '已选对象']}
                    targetKeys={selectedTargetIds}
                    onChange={(nextTargetKeys) => setSelectedTargetIds(nextTargetKeys as string[])}
                    render={(item: any) => ({
                      title: item.title,
                      description: item.description,
                    })}
                    listStyle={{ width: 300, height: 300 }}
                    showSearch
                  />
                </Form.Item>
              )}

              {targetType === 'LOCATION' && (
                <Form.Item
                  name="locationKeywords"
                  label="地点关键词"
                  extra="输入地点关键词，多个用逗号分隔，如：XX小区,XX商场,XX路"
                >
                  <TextArea rows={3} placeholder="请输入地点关键词" />
                </Form.Item>
              )}

              <Divider />

              <Form.Item
                name="notifyChannels"
                label="通知渠道"
              >
                <Checkbox.Group>
                  <Checkbox value="SYSTEM">系统消息</Checkbox>
                  <Checkbox value="SMS">短信通知</Checkbox>
                  <Checkbox value="EMAIL">邮件通知</Checkbox>
                  <Checkbox value="APP">APP推送</Checkbox>
                </Checkbox.Group>
              </Form.Item>

              <Form.Item
                name="notifyUsers"
                label="通知人员"
                extra="输入需要通知的人员姓名或工号，多个用逗号分隔"
              >
                <TextArea rows={2} placeholder="张警官,李队长,王探长" />
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={submitting}
                    size="large"
                  >
                    {isEdit ? '保存修改' : '创建规则'}
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate('/surveillance-rules')}
                  >
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="布控说明" className="card-shadow">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                message="重点人员布控"
                description="选择需要重点监控的人员，当系统中出现该人员的新线索、案件关联或活动记录时，将自动触发预警。"
                type="info"
                showIcon
              />
              <Alert
                message="重点地点布控"
                description="设置需要重点监控的地点关键词，当系统中出现涉及该地点的案件、线索或证据时，将自动触发预警。"
                type="info"
                showIcon
              />
              <Alert
                message="重点证据布控"
                description="选择需要重点关注的证据，当证据状态发生变化（如借阅、流转、鉴定等）时，将自动触发预警。"
                type="info"
                showIcon
              />
              <Divider />
              <div>
                <h4 style={{ marginBottom: 8 }}>预警级别说明</h4>
                <Space direction="vertical" size="small">
                  <Space><span style={{ color: '#ff4d4f', fontWeight: 600 }}>紧急</span> - 需要立即处置的重大情况</Space>
                  <Space><span style={{ color: '#fa8c16', fontWeight: 600 }}>高</span> - 需要优先处置的重要情况</Space>
                  <Space><span style={{ color: '#faad14', fontWeight: 600 }}>中</span> - 正常流程处置的情况</Space>
                  <Space><span style={{ color: '#52c41a', fontWeight: 600 }}>低</span> - 仅需关注了解的情况</Space>
                </Space>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
