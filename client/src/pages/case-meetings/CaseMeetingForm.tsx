import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, Space, Row, Col, message, Steps, Divider } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import { caseMeetingApi, caseApi, personApi } from '../../services/api';

const { TextArea } = Input;

const meetingTypes = [
  { label: '案情分析会', value: '案情分析会' },
  { label: '线索研判会', value: '线索研判会' },
  { label: '证据审查会', value: '证据审查会' },
  { label: '案件协调会', value: '案件协调会' },
  { label: '专案推进会', value: '专案推进会' },
  { label: '结案评审会', value: '结案评审会' },
  { label: '其他', value: '其他' },
];

const meetingSteps = [
  {
    key: 'basic',
    title: '基本信息',
    description: '填写会商基本信息',
  },
  {
    key: 'analysis',
    title: '分析讨论',
    description: '记录案情线索证据分析',
  },
  {
    key: 'conclusion',
    title: '结论待办',
    description: '记录结论和待办事项',
  },
];

export default function CaseMeetingForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cases, setCases] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const isEdit = !!id;

  useEffect(() => {
    loadCases();
    loadAllPersons();
    if (isEdit) {
      loadMeetingData();
    } else {
      const caseId = searchParams.get('caseId');
      if (caseId) {
        form.setFieldsValue({ caseId });
      }
    }
  }, [id]);

  const loadCases = async () => {
    try {
      const res = await caseApi.list({ pageSize: 100 });
      setCases(res.data.items || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const loadAllPersons = async () => {
    try {
      const res = await personApi.all();
      setAllPersons(res.data || []);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const loadMeetingData = async () => {
    setLoading(true);
    try {
      const res = await caseMeetingApi.get(id!);
      const data = res.data;
      form.setFieldsValue({
        ...data,
        meetingTime: data.meetingTime ? moment(data.meetingTime) : null,
      });
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const data = {
        ...values,
        meetingTime: values.meetingTime?.format('YYYY-MM-DD HH:mm:ss'),
      };

      if (isEdit) {
        await caseMeetingApi.update(id!, data);
        message.success('更新成功');
        navigate(`/case-meetings/${id}`);
      } else {
        const res = await caseMeetingApi.create(data);
        message.success('创建成功');
        navigate(`/case-meetings/${res.data.id}`);
      }
    } catch (error) {
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndContinue = async () => {
    try {
      const values = await form.validateFields();
      await handleSubmit(values);
    } catch (error) {
      // validation error
    }
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const renderBasicStep = () => (
    <div>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="caseId"
            label="关联案件"
            rules={[{ required: true, message: '请选择关联案件' }]}
          >
            <Select
              placeholder="请选择关联案件"
              showSearch
              optionFilterProp="children"
              disabled={isEdit}
              options={cases.map(c => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="meetingType"
            label="会商类型"
            rules={[{ required: true, message: '请选择会商类型' }]}
          >
            <Select placeholder="请选择会商类型" options={meetingTypes} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="title"
        label="会商主题"
        rules={[{ required: true, message: '请输入会商主题' }]}
      >
        <Input placeholder="请输入会商主题" maxLength={200} showCount />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="meetingTime" label="会商时间">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              placeholder="请选择会商时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="location" label="会商地点">
            <Input placeholder="请输入会商地点" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">人员信息</Divider>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="hostName" label="主持人">
            <Input placeholder="主持人姓名" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="hostDept" label="主持人部门">
            <Input placeholder="主持人部门" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="hostId" label="主持人ID">
            <Input placeholder="系统用户ID（可选）" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="recorderName" label="记录人">
            <Input placeholder="记录人姓名" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="recorderDept" label="记录人部门">
            <Input placeholder="记录人部门" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="recorderId" label="记录人ID">
            <Input placeholder="系统用户ID（可选）" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  const renderAnalysisStep = () => (
    <div>
      <Form.Item name="caseAnalysis" label="案情分析">
        <TextArea rows={6} placeholder="请输入案情分析内容" showCount maxLength={5000} />
      </Form.Item>

      <Form.Item name="clueAnalysis" label="线索分析">
        <TextArea rows={6} placeholder="请输入线索分析内容" showCount maxLength={5000} />
      </Form.Item>

      <Form.Item name="evidenceAnalysis" label="证据分析">
        <TextArea rows={6} placeholder="请输入证据分析内容" showCount maxLength={5000} />
      </Form.Item>

      <Form.Item name="personAnalysis" label="人员分析">
        <TextArea rows={6} placeholder="请输入人员分析内容" showCount maxLength={5000} />
      </Form.Item>

      <Form.Item name="discussionContent" label="讨论内容">
        <TextArea rows={8} placeholder="请输入主要讨论内容" showCount maxLength={10000} />
      </Form.Item>
    </div>
  );

  const renderConclusionStep = () => (
    <div>
      <Form.Item
        name="conclusion"
        label="会商结论"
        rules={[{ required: isEdit, message: '请输入会商结论' }]}
      >
        <TextArea rows={8} placeholder="请输入会商结论" showCount maxLength={10000} />
      </Form.Item>

      <Form.Item name="note" label="备注">
        <TextArea rows={4} placeholder="其他备注信息" showCount maxLength={2000} />
      </Form.Item>

      <Divider />

      <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#389e0d' }}>
          <CheckCircleOutlined style={{ marginRight: 8 }} />
          提示
        </div>
        <div style={{ color: '#389e0d', fontSize: 14 }}>
          保存后可在会商详情页中：
          <ul style={{ margin: '8px 0 0 20px' }}>
            <li>添加参会人员</li>
            <li>关联案件线索</li>
            <li>关联证据附件</li>
            <li>添加待办事项并落地为任务</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const stepContents = [renderBasicStep, renderAnalysisStep, renderConclusionStep];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <h2 className="page-title">{isEdit ? '编辑会商纪要' : '新建会商纪要'}</h2>
        </Space>
        <Space>
          <Button onClick={() => navigate(-1)}>取消</Button>
          <Button icon={<SaveOutlined />} onClick={handleSaveAndContinue} loading={submitting}>
            保存
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep}
          onChange={handleStepChange}
          items={meetingSteps.map((step, index) => ({
            title: step.title,
            description: step.description,
          }))}
        />
      </Card>

      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            meetingType: '案情分析会',
          }}
        >
          {stepContents[currentStep]()}

          <Divider />

          <div style={{ textAlign: 'right' }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={() => handleStepChange(currentStep - 1)}>
                  上一步
                </Button>
              )}
              {currentStep < meetingSteps.length - 1 ? (
                <Button type="primary" onClick={() => handleStepChange(currentStep + 1)}>
                  下一步
                </Button>
              ) : (
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitting}>
                  {isEdit ? '保存修改' : '创建会商'}
                </Button>
              )}
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
}
