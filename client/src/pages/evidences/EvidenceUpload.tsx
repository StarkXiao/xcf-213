import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Button, Space, message, Row, Col, DatePicker, Upload, Progress, Alert } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, SaveOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { evidenceApi, searchApi } from '../../services/api';
import moment from 'moment';

const { TextArea } = Input;
const { Dragger } = Upload;

export default function EvidenceUpload() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [options, setOptions] = useState<any>({});
  const [cases, setCases] = useState<any[]>([]);
  const [clues, setClues] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<any>(null);

  useEffect(() => {
    loadOptions();
    loadCases();
  }, []);

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
      const res = await evidenceApi.getCases();
      setCases(res.data);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const handleCaseChange = (caseId: string) => {
    setSelectedCaseId(caseId);
    if (caseId) {
      loadClues(caseId);
    } else {
      setClues([]);
    }
    form.setFieldsValue({ clueId: undefined });
  };

  const loadClues = async (caseId: string) => {
    try {
      const res = await evidenceApi.getClues(caseId);
      setClues(res.data);
    } catch (error) {
      console.error('Failed to load clues:', error);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    showUploadList: true,
    beforeUpload: () => {
      setUploading(true);
      setUploadProgress(0);
      return false;
    },
    onChange(info) {
      if (info.file.status === 'uploading') {
        setUploadProgress(info.file.percent || 0);
      } else if (info.file.status === 'done') {
        setUploading(false);
        setUploadProgress(100);
        message.success(`${info.file.name} 文件准备就绪`);
      } else if (info.file.status === 'error') {
        setUploading(false);
        message.error(`${info.file.name} 文件上传失败`);
      }
    },
  };

  const handleSubmit = async (values: any) => {
    const formData = new FormData();
    const fileInput = document.querySelector('.ant-upload-drag input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file) {
      message.error('请选择要上传的文件');
      return;
    }

    setLoading(true);
    try {
      formData.append('file', file);
      formData.append('name', values.name || file.name);
      formData.append('evidenceType', values.evidenceType);
      formData.append('description', values.description || '');
      formData.append('collectionMethod', values.collectionMethod || '');
      formData.append('collector', values.collector || '');
      if (values.collectionTime) {
        formData.append('collectionTime', values.collectionTime.toISOString());
      }
      if (values.caseId) {
        formData.append('caseId', values.caseId);
      }
      if (values.clueId) {
        formData.append('clueId', values.clueId);
      }

      const response = await evidenceApi.upload(formData, (progress: number) => {
        setUploadProgress(progress);
      });

      message.success('证据上传成功');
      navigate(`/evidences/${response.data.id}`);
    } catch (error) {
      message.error('上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/evidences')}>返回</Button>
          <h2 className="page-title">上传证据</h2>
        </Space>
      </div>

      <Card className="card-shadow">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            evidenceType: '物证',
          }}
        >
          <Alert
            message="上传提示"
            description="支持图片、视频、音频、文档等多种格式，单个文件最大 100MB。请确保证据文件完整且来源合法。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="file"
                label="证据文件"
                rules={[{ required: true, message: '请上传证据文件' }]}
              >
                <Dragger {...uploadProps}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
                  </p>
                  <p className="ant-upload-text">点击或将文件拖拽到此处上传</p>
                  <p className="ant-upload-hint">
                    支持图片、视频、音频、文档等格式，最大 100MB
                  </p>
                </Dragger>
              </Form.Item>

              {uploading && (
                <div style={{ marginBottom: 24 }}>
                  <Progress percent={Math.round(uploadProgress)} status="active" />
                </div>
              )}

              <Form.Item
                name="name"
                label="证据名称"
                rules={[{ required: true, message: '请输入证据名称' }]}
              >
                <Input placeholder="请输入证据名称" maxLength={200} />
              </Form.Item>

              <Form.Item
                name="evidenceType"
                label="证据类型"
                rules={[{ required: true, message: '请选择证据类型' }]}
              >
                <Select
                  placeholder="请选择证据类型"
                  options={options.evidenceTypes?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item name="caseId" label="关联案件">
                <Select
                  placeholder="选择关联的案件（可选）"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  options={cases.map((c: any) => ({
                    label: `${c.caseNumber} - ${c.title}`,
                    value: c.id,
                  }))}
                  onChange={handleCaseChange}
                />
              </Form.Item>

              <Form.Item name="clueId" label="关联线索">
                <Select
                  placeholder="选择关联的线索（可选）"
                  allowClear
                  disabled={!selectedCaseId}
                  options={clues.map((c: any) => ({
                    label: `${c.clueNumber} - ${c.title}`,
                    value: c.id,
                  }))}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="collectionMethod" label="收集方式">
                    <Select
                      placeholder="请选择收集方式"
                      allowClear
                      options={options.collectionMethods?.map((t: string) => ({ label: t, value: t }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="collector" label="收集人">
                    <Input placeholder="收集人员姓名" maxLength={50} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="collectionTime" label="收集时间">
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  placeholder="选择证据收集时间"
                  disabledDate={(current) => current && current > moment().endOf('day')}
                />
              </Form.Item>

              <Form.Item name="description" label="证据描述">
                <TextArea
                  rows={4}
                  placeholder="请详细描述证据的来源、内容、特征等信息"
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading || uploading}>
                提交上传
              </Button>
              <Button onClick={() => navigate('/evidences')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
