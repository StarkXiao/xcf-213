import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, message, Space, Row, Col, AutoComplete, Tag, InputNumber, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  FileTextOutlined,
  SearchOutlined,
  PaperClipOutlined,
  TeamOutlined,
  UserOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import moment from 'moment';
import { commandApi, caseApi, clueApi, evidenceApi, personApi } from '../../services/api';
import { taskTypeMap, taskPriorityMap, taskStatusMap } from './TaskList';

const { TextArea } = Input;
const { Option } = Select;

interface RelatedItem {
  id: string;
  name: string;
  number?: string;
  type?: string;
}

export default function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [relatedOptions, setRelatedOptions] = useState<RelatedItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedType, setRelatedType] = useState<string>('case');
  const [relatedKeyword, setRelatedKeyword] = useState('');

  const isEdit = !!id;

  const preRelatedType = searchParams.get('sourceType')?.toUpperCase();
  const preRelatedId = searchParams.get('sourceId');

  useEffect(() => {
    if (isEdit) {
      loadTask();
    } else if (preRelatedType && preRelatedId) {
      const type = preRelatedType.toLowerCase();
      setRelatedType(type);
      loadRelatedDetail(type, preRelatedId);
    }
  }, [id, preRelatedType, preRelatedId]);

  useEffect(() => {
    loadRelatedList(relatedType);
  }, [relatedType]);

  const loadTask = async () => {
    setLoading(true);
    try {
      const res = await commandApi.getTask(id!);
      const task = res.data;

      let rt = 'case';
      if (task.caseId) rt = 'case';
      else if (task.clueId) rt = 'clue';
      else if (task.evidenceId) rt = 'evidence';
      else if (task.personId) rt = 'person';

      setRelatedType(rt);

      form.setFieldsValue({
        ...task,
        dueDate: task.dueDate ? moment(task.dueDate) : null,
        startDate: task.startDate ? moment(task.startDate) : null,
        relatedType: rt,
        relatedId: task.caseId || task.clueId || task.evidenceId || task.personId,
      });
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedDetail = async (type: string, relatedId: string) => {
    try {
      let res: any;
      if (type === 'case') res = await caseApi.get(relatedId);
      else if (type === 'clue') res = await clueApi.get(relatedId);
      else if (type === 'evidence') res = await evidenceApi.get(relatedId);
      else if (type === 'person') res = await personApi.get(relatedId);

      if (res?.data) {
        form.setFieldsValue({ relatedId: res.data.id });
      }
    } catch (error) {
      console.error('Failed to load related detail:', error);
    }
  };

  const loadRelatedList = async (type: string) => {
    setRelatedLoading(true);
    try {
      let res: any;
      const params = { page: 1, pageSize: 20 };
      if (type === 'case') res = await caseApi.list(params);
      else if (type === 'clue') res = await clueApi.list(params);
      else if (type === 'evidence') res = await evidenceApi.list(params);
      else if (type === 'person') res = await personApi.list(params);

      const items: RelatedItem[] = (res?.data?.items || []).map((item: any) => {
        if (type === 'case') return { id: item.id, name: item.title, number: item.caseNumber };
        if (type === 'clue') return { id: item.id, name: item.title, number: item.clueNumber };
        if (type === 'evidence') return { id: item.id, name: item.name, number: item.evidenceNumber };
        if (type === 'person') return { id: item.id, name: item.name };
        return { id: item.id, name: item.title };
      });
      setRelatedOptions(items);
    } catch (error) {
      console.error('Failed to load related list:', error);
    } finally {
      setRelatedLoading(false);
    }
  };

  const searchRelated = async (type: string, keyword: string) => {
    if (!keyword) {
      loadRelatedList(type);
      return;
    }
    setRelatedLoading(true);
    try {
      let res: any;
      const params = { keyword, page: 1, pageSize: 20 };
      if (type === 'case') res = await caseApi.list(params);
      else if (type === 'clue') res = await clueApi.list(params);
      else if (type === 'evidence') res = await evidenceApi.list(params);
      else if (type === 'person') res = await personApi.list(params);

      const items: RelatedItem[] = (res?.data?.items || []).map((item: any) => {
        if (type === 'case') return { id: item.id, name: item.title, number: item.caseNumber };
        if (type === 'clue') return { id: item.id, name: item.title, number: item.clueNumber };
        if (type === 'evidence') return { id: item.id, name: item.name, number: item.evidenceNumber };
        if (type === 'person') return { id: item.id, name: item.name };
        return { id: item.id, name: item.title };
      });
      setRelatedOptions(items);
    } catch (error) {
      console.error('Failed to search related:', error);
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleRelatedTypeChange = (type: string) => {
    setRelatedType(type);
    setRelatedKeyword('');
    form.setFieldsValue({ relatedId: undefined });
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const data: any = {
        title: values.title,
        description: values.description,
        taskType: values.taskType,
        priority: values.priority,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : undefined,
        assigneeName: values.assigneeName || undefined,
        assigneeDept: values.assigneeDept || undefined,
        assignerName: values.assignerName || undefined,
        location: values.location || undefined,
        requirement: values.requirement || undefined,
        note: values.note || undefined,
      };

      if (values.relatedId) {
        if (values.relatedType === 'case') data.caseId = values.relatedId;
        else if (values.relatedType === 'clue') data.clueId = values.relatedId;
        else if (values.relatedType === 'evidence') data.evidenceId = values.relatedId;
        else if (values.relatedType === 'person') data.personId = values.relatedId;
      }

      if (isEdit) {
        await commandApi.updateTask(id!, data);
        message.success('更新成功');
      } else {
        await commandApi.createTask(data);
        message.success('创建成功');
      }

      navigate('/command/tasks');
    } catch (error: any) {
      message.error(isEdit ? '更新失败' : '创建失败');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const relatedTypeIconMap: Record<string, any> = {
    case: <FileTextOutlined />,
    clue: <SearchOutlined />,
    evidence: <PaperClipOutlined />,
    person: <TeamOutlined />,
  };

  const relatedTypeLabelMap: Record<string, string> = {
    case: '案件',
    clue: '线索',
    evidence: '证据',
    person: '人员',
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        style={{ borderRadius: '8px' }}
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
            <span style={{ fontSize: '18px', fontWeight: 500 }}>{isEdit ? '编辑任务' : '新建任务'}</span>
          </Space>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            taskType: 'COORDINATION',
            priority: 'MEDIUM',
            relatedType: 'case',
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}>
                <Input placeholder="请输入任务标题" maxLength={200} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
                <Select placeholder="请选择任务类型">
                  {Object.entries(taskTypeMap).map(([key, val]) => (
                    <Option key={key} value={key}>
                      <Space>{val.icon}{val.label}</Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
                <Select placeholder="请选择优先级">
                  {Object.entries(taskPriorityMap).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startDate" label="开始日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择开始日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dueDate" label="截止日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="关联对象">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="relatedType" noStyle>
                    <Select
                      style={{ width: 120 }}
                      onChange={handleRelatedTypeChange}
                    >
                      {Object.entries(relatedTypeLabelMap).map(([key, val]) => (
                        <Option key={key} value={key}>
                          <Space>{relatedTypeIconMap[key]}{val}</Space>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="relatedId" noStyle>
                    <AutoComplete
                      style={{ flex: 1 }}
                      placeholder={`搜索${relatedTypeLabelMap[relatedType]}...`}
                      loading={relatedLoading}
                      options={relatedOptions.map(item => ({
                        value: item.id,
                        label: (
                          <span>
                            {item.number && (
                              <Tag color="blue" style={{ marginRight: 8 }}>
                                {item.number}
                              </Tag>
                            )}
                            {item.name}
                          </span>
                        ),
                      }))}
                      onSearch={(value) => {
                        setRelatedKeyword(value);
                        searchRelated(relatedType, value);
                      }}
                      onSelect={(value) => {
                        form.setFieldsValue({ relatedId: value });
                      }}
                      allowClear
                    />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="执行地点">
                <Input placeholder="请输入执行地点" prefix={<EnvironmentOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="assignerName" label="指派人">
                <Input placeholder="请输入指派人姓名" prefix={<TeamOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assigneeName" label="承办人">
                <Input placeholder="请输入承办人姓名" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assigneeDept" label="承办部门">
                <Input placeholder="请输入承办部门" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="任务描述">
            <TextArea rows={4} placeholder="请详细描述任务内容" maxLength={2000} showCount />
          </Form.Item>

          <Form.Item name="requirement" label="任务要求">
            <TextArea rows={3} placeholder="请输入任务要求" maxLength={1000} showCount />
          </Form.Item>

          <Form.Item name="note" label="备注">
            <TextArea rows={2} placeholder="备注信息" maxLength={500} showCount />
          </Form.Item>

          {isEdit && (
            <Form.Item name="status" label="任务状态">
              <Select disabled>
                {Object.entries(taskStatusMap).map(([key, val]) => (
                  <Option key={key} value={key}>{val.label}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<SaveOutlined />}>
                {isEdit ? '保存修改' : '创建任务'}
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
