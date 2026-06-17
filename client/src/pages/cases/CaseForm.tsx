import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
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
