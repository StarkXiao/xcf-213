import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Button, Space, message, Row, Col, InputNumber, Tag, Modal, ColorPicker } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined } from '@ant-design/icons';
import { personApi, searchApi } from '../../services/api';

const categoryColors: Record<string, string> = {
  '案件类型': '#1677ff',
  '线索来源': '#52c41a',
  '关系角色': '#722ed1',
  '自定义': '#fa8c16',
};

export default function PersonForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagForm] = Form.useForm();
  const [tagCreating, setTagCreating] = useState(false);
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
      const data = res.data;
      form.setFieldsValue(data);
      if (data.tags) {
        setSelectedTagIds(data.tags.map((t: any) => t.id));
      }
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const submitData = { ...values, tagIds: selectedTagIds };
      if (isEdit) {
        await personApi.update(id!, submitData);
        message.success('更新成功');
      } else {
        await personApi.create(submitData);
        message.success('创建成功');
      }
      navigate('/persons');
    } catch (error) {
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (values: any) => {
    setTagCreating(true);
    try {
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || undefined;
      const res = await personApi.createTag({ ...values, color });
      message.success('标签创建成功');
      setSelectedTagIds(prev => [...prev, res.data.id]);
      setTagModalOpen(false);
      tagForm.resetFields();
      loadOptions();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || '创建标签失败';
      message.error(errorMsg);
    } finally {
      setTagCreating(false);
    }
  };

  const tagOptions = options.tags || [];
  const tagSelectOptions = tagOptions.map((t: any) => ({
    label: (
      <Space>
        <Tag color={t.color || categoryColors[t.category] || 'default'} style={{ margin: 0 }}>
          {t.name}
        </Tag>
        <span style={{ fontSize: 12, color: '#999' }}>{t.category}</span>
      </Space>
    ),
    value: t.id,
    tag: t,
  }));

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
              <Form.Item label="标签">
                <Select
                  mode="multiple"
                  placeholder="选择或搜索标签"
                  value={selectedTagIds}
                  onChange={setSelectedTagIds}
                  options={tagSelectOptions}
                  optionFilterProp="label"
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                        <Button
                          type="link"
                          icon={<PlusOutlined />}
                          onClick={() => setTagModalOpen(true)}
                          style={{ padding: 0 }}
                        >
                          新建标签
                        </Button>
                      </div>
                    </>
                  )}
                  tagRender={(props) => {
                    const { value, closable, onClose } = props;
                    const tag = tagOptions.find((t: any) => t.id === value);
                    if (!tag) return <span />;
                    return (
                      <Tag
                        color={tag.color || categoryColors[tag.category] || 'default'}
                        closable={closable}
                        onClose={onClose}
                        style={{ marginRight: 3 }}
                      >
                        {tag.name}
                      </Tag>
                    );
                  }}
                />
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

      <Modal
        title="新建标签"
        open={tagModalOpen}
        onCancel={() => { setTagModalOpen(false); tagForm.resetFields(); }}
        onOk={() => tagForm.submit()}
        confirmLoading={tagCreating}
      >
        <Form form={tagForm} layout="vertical" onFinish={handleCreateTag}>
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="category"
            label="标签分类"
            rules={[{ required: true, message: '请选择标签分类' }]}
            initialValue="自定义"
          >
            <Select
              placeholder="请选择标签分类"
              options={(options.tagCategories || ['案件类型', '线索来源', '关系角色', '自定义']).map((c: string) => ({
                label: (
                  <Space>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: categoryColors[c] || '#999' }} />
                    {c}
                  </Space>
                ),
                value: c,
              }))}
            />
          </Form.Item>
          <Form.Item name="color" label="标签颜色">
            <ColorPicker />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
