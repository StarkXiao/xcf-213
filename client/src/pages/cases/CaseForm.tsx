import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col, Divider } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, FileTextOutlined, TeamOutlined, PaperClipOutlined, BulbOutlined } from '@ant-design/icons';
import { caseApi, searchApi } from '../../services/api';

export default function CaseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any>({});
  const isEdit = !!id;

  useEffect(() => {
    loadOptions();
    if (isEdit) {
      loadCaseData();
    }
  }, [id]);

  const loadOptions = async () => {
    try {
      const res = await searchApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadCaseData = async () => {
    setLoading(true);
    try {
      const res = await caseApi.get(id!);
      const data = res.data;
      form.setFieldsValue({
        ...data,
        occurTime: data.occurTime ? data.occurTime : null,
        reportTime: data.reportTime ? data.reportTime : null,
      });
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
        occurTime: values.occurTime ? values.occurTime.toISOString() : null,
        reportTime: values.reportTime ? values.reportTime.toISOString() : null,
      };

      if (isEdit) {
        await caseApi.update(id!, submitData);
        message.success('更新成功');
      } else {
        await caseApi.create(submitData);
        message.success('创建成功');
      }
      navigate('/cases');
    } catch (error) {
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/cases')}>返回</Button>
          <h2 className="page-title">{isEdit ? '编辑案件' : '新增案件'}</h2>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: '待立案',
            priority: '一般',
            caseType: '刑事案件',
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="title"
                label="案件标题"
                rules={[{ required: true, message: '请输入案件标题' }]}
              >
                <Input placeholder="请输入案件标题" maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="caseType"
                label="案件类型"
                rules={[{ required: true, message: '请选择案件类型' }]}
              >
                <Select
                  placeholder="请选择案件类型"
                  options={options.caseTypes?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="status"
                label="案件状态"
                rules={[{ required: true, message: '请选择案件状态' }]}
              >
                <Select
                  placeholder="请选择案件状态"
                  options={options.caseStatuses?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select
                  placeholder="请选择优先级"
                  options={options.priorities?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="department"
                label="所属部门"
              >
                <Select
                  placeholder="请选择所属部门"
                  allowClear
                  options={options.departments?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="location" label="案发地点">
                <Input placeholder="请输入案发地点" maxLength={500} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="caseManager" label="主办民警">
                <Input placeholder="请输入主办民警姓名" maxLength={50} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="occurTime" label="案发时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择案发时间" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="reportTime" label="报案时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择报案时间" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="description"
                label="案件描述"
                rules={[{ required: true, message: '请输入案件描述' }]}
              >
                <Input.TextArea
                  rows={6}
                  placeholder="请详细描述案件情况"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="summary" label="案件摘要">
                <Input.TextArea
                  rows={4}
                  placeholder="请输入案件摘要（可选）"
                  maxLength={1000}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">
            <Space>
              <BulbOutlined style={{ color: '#faad14' }} />
              <span style={{ fontWeight: 500, fontSize: 16 }}>结构化摘要</span>
            </Space>
          </Divider>

          <Row gutter={24}>
            <Col xs={24}>
              <Form.Item name="caseAnalysis" label={
                <Space>
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                  <span>案情研判要点</span>
                </Space>
              }>
                <Input.TextArea
                  rows={4}
                  placeholder="请归纳案件核心事实、争议焦点、法律适用要点等研判内容"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="personAnalysis" label={
                <Space>
                  <TeamOutlined style={{ color: '#52c41a' }} />
                  <span>涉案人研判要点</span>
                </Space>
              }>
                <Input.TextArea
                  rows={4}
                  placeholder="请分析各涉案人员角色定位、责任划分、关系网络、作案动机等"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="evidenceAnalysis" label={
                <Space>
                  <PaperClipOutlined style={{ color: '#722ed1' }} />
                  <span>关键证据研判要点</span>
                </Space>
              }>
                <Input.TextArea
                  rows={4}
                  placeholder="请梳理关键证据清单、证明力分析、证据链完整性、存在疑点等"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="conclusion" label={
                <Space>
                  <BulbOutlined style={{ color: '#fa8c16' }} />
                  <span>研判结论</span>
                </Space>
              }>
                <Input.TextArea
                  rows={4}
                  placeholder="请填写案件初步定性、处理建议、下一步工作方向、需关注重点等结论性内容"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                {isEdit ? '保存修改' : '创建案件'}
              </Button>
              <Button onClick={() => navigate('/cases')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
