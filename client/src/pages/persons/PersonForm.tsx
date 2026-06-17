import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Button, Space, message, Row, Col, InputNumber } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { personApi, searchApi } from '../../services/api';

export default function PersonForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any>({});
  const isEdit = !!id;

  useEffect(() => {
    loadOptions();
    if (isEdit) {
      loadPersonData();
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

  const loadPersonData = async () => {
    setLoading(true);
    try {
      const res = await personApi.get(id!);
      form.setFieldsValue(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (isEdit) {
        await personApi.update(id!, values);
        message.success('更新成功');
      } else {
        await personApi.create(values);
        message.success('创建成功');
      }
      navigate('/persons');
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/persons')}>返回</Button>
          <h2 className="page-title">{isEdit ? '编辑人员' : '新增人员'}</h2>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            personType: '嫌疑人',
            gender: '男',
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="personType"
                label="人员类型"
                rules={[{ required: true, message: '请选择人员类型' }]}
              >
                <Select
                  placeholder="请选择人员类型"
                  options={options.personTypes?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="gender" label="性别">
                <Select
                  placeholder="请选择性别"
                  options={options.genders?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="age" label="年龄">
                <InputNumber style={{ width: '100%' }} placeholder="请输入年龄" min={0} max={150} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="idCard" label="身份证号">
                <Input placeholder="请输入身份证号" maxLength={18} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="phone" label="联系电话">
                <Input placeholder="请输入联系电话" maxLength={20} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="address" label="住址">
                <Input placeholder="请输入住址" maxLength={500} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="occupation" label="职业">
                <Input placeholder="请输入职业" maxLength={100} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="description" label="人员描述">
                <Input.TextArea
                  rows={4}
                  placeholder="请输入人员描述信息"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                {isEdit ? '保存修改' : '创建人员'}
              </Button>
              <Button onClick={() => navigate('/persons')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
