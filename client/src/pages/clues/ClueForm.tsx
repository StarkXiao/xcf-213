import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { clueApi, caseApi, searchApi } from '../../services/api';

export default function ClueForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any>({});
  const [cases, setCases] = useState<any[]>([]);
  const isEdit = !!id;

  useEffect(() => {
    loadOptions();
    loadCases();
    if (isEdit) {
      loadClueData();
    } else {
      const caseId = searchParams.get('caseId');
      if (caseId) {
        form.setFieldsValue({ caseId });
      }
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

  const loadCases = async () => {
    try {
      const res = await caseApi.list({ pageSize: 100 });
      setCases(res.data.items.map((c: any) => ({
        label: `${c.caseNumber} - ${c.title}`,
        value: c.id,
      })));
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const loadClueData = async () => {
    setLoading(true);
    try {
      const res = await clueApi.get(id!);
      const data = res.data;
      form.setFieldsValue({
        ...data,
        findTime: data.findTime ? data.findTime : null,
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
        findTime: values.findTime ? values.findTime.toISOString() : null,
      };

      if (isEdit) {
        await clueApi.update(id!, submitData);
        message.success('更新成功');
      } else {
        await clueApi.create(submitData);
        message.success('创建成功');
      }
      navigate('/clues');
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clues')}>返回</Button>
          <h2 className="page-title">{isEdit ? '编辑线索' : '新增线索'}</h2>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: '待核实',
            credibility: '中等',
            importance: '一般',
            clueType: '人证线索',
            source: '现场勘查',
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="title"
                label="线索标题"
                rules={[{ required: true, message: '请输入线索标题' }]}
              >
                <Input placeholder="请输入线索标题" maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="caseId" label="关联案件">
                <Select
                  placeholder="选择关联案件（可选）"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={cases}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="clueType"
                label="线索类型"
                rules={[{ required: true, message: '请选择线索类型' }]}
              >
                <Select
                  placeholder="请选择线索类型"
                  options={options.clueTypes?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="source"
                label="线索来源"
                rules={[{ required: true, message: '请输入线索来源' }]}
              >
                <Input placeholder="请输入线索来源" maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select
                  placeholder="请选择状态"
                  options={options.clueStatuses?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="credibility"
                label="可信度"
                rules={[{ required: true, message: '请选择可信度' }]}
              >
                <Select
                  placeholder="请选择可信度"
                  options={options.credibilityLevels?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="importance"
                label="重要性"
                rules={[{ required: true, message: '请选择重要性' }]}
              >
                <Select
                  placeholder="请选择重要性"
                  options={options.importanceLevels?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="findTime" label="发现时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择发现时间" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="location" label="发现地点">
                <Input placeholder="请输入发现地点" maxLength={500} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="informant" label="提供人">
                <Input placeholder="请输入提供人姓名" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="handler" label="处理人">
                <Input placeholder="请输入处理人姓名" maxLength={50} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="content"
                label="线索内容"
                rules={[{ required: true, message: '请输入线索内容' }]}
              >
                <Input.TextArea
                  rows={6}
                  placeholder="请详细描述线索内容"
                  maxLength={3000}
                  showCount
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="note" label="备注">
                <Input.TextArea
                  rows={3}
                  placeholder="请输入备注信息（可选）"
                  maxLength={1000}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                {isEdit ? '保存修改' : '创建线索'}
              </Button>
              <Button onClick={() => navigate('/clues')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
