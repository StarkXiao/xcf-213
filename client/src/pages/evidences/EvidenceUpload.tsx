import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Row,
  Col,
  DatePicker,
  Upload,
  Progress,
  Alert,
  Table,
  Tag,
  Tooltip,
  Divider,
  Modal,
  Collapse,
  Statistic,
  Badge,
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  SaveOutlined,
  InboxOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileOutlined,
  EyeOutlined,
  PaperClipOutlined,
  BulbOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import { evidenceApi, searchApi } from '../../services/api';
import moment from 'moment';

const { TextArea } = Input;
const { Dragger } = Upload;
const { Panel } = Collapse;

interface AnalyzedFile {
  uid: string;
  name: string;
  size: number;
  type: string;
  originFileObj?: File;
  fileType?: string;
  evidenceType?: string;
  collectionMethod?: string;
  suggestedName?: string;
  status: 'pending' | 'analyzing' | 'ready' | 'uploading' | 'success' | 'error';
  evidenceName: string;
  description?: string;
  customEvidenceType?: string;
  customCollectionMethod?: string;
  collector?: string;
  location?: string;
  note?: string;
}

interface BatchCommonForm {
  batchName?: string;
  description?: string;
  caseId?: string;
  clueId?: string;
  collectionMethod?: string;
  collector?: string;
  collectionTime?: any;
  location?: string;
}

const evidenceTypeColors: Record<string, string> = {
  '物证': 'red',
  '书证': 'orange',
  '证人证言': 'green',
  '被害人陈述': 'cyan',
  '犯罪嫌疑人供述': 'blue',
  '鉴定意见': 'purple',
  '勘验笔录': 'magenta',
  '视听资料': 'geekblue',
  '电子数据': 'gold',
  '其他': 'default',
};

const fileTypeIcons: Record<string, string> = {
  'image': '🖼️',
  'video': '🎬',
  'audio': '🎵',
  'document': '📄',
  'archive': '📦',
  'other': '📎',
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export default function EvidenceUpload() {
  const navigate = useNavigate();
  const [batchForm] = Form.useForm<BatchCommonForm>();
  const [options, setOptions] = useState<any>({});
  const [cases, setCases] = useState<any[]>([]);
  const [clues, setClues] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [fileList, setFileList] = useState<AnalyzedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [editingFile, setEditingFile] = useState<AnalyzedFile | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
    batchForm.setFieldsValue({ clueId: undefined });
  };

  const loadClues = async (caseId: string) => {
    try {
      const res = await evidenceApi.getClues(caseId);
      setClues(res.data);
    } catch (error) {
      console.error('Failed to load clues:', error);
    }
  };

  const analyzeFiles = async (files: AnalyzedFile[]) => {
    if (files.length === 0) return;

    setAnalyzing(true);
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'analyzing');
    if (pendingFiles.length === 0) {
      setAnalyzing(false);
      return;
    }

    setFileList(prev =>
      prev.map(f =>
        pendingFiles.some(p => p.uid === f.uid) ? { ...f, status: 'analyzing' } : f
      )
    );

    try {
      const res = await evidenceApi.analyze(
        pendingFiles.map(f => ({
          fileName: f.name,
          mimeType: f.type,
          fileSize: f.size,
        }))
      );

      const analyzed = res.data.items || [];

      setFileList(prev =>
        prev.map(f => {
          const matched = analyzed.find((a: any) => a.fileName === f.name);
          if (matched) {
            return {
              ...f,
              fileType: matched.fileType,
              evidenceType: matched.evidenceType,
              collectionMethod: matched.collectionMethod,
              suggestedName: matched.suggestedName,
              evidenceName: f.evidenceName || matched.suggestedName || f.name,
              customEvidenceType: matched.evidenceType,
              customCollectionMethod: matched.collectionMethod,
              status: 'ready' as const,
            };
          }
          return f;
        })
      );
    } catch (error) {
      message.error('文件智能分析失败，将使用默认类型');
      setFileList(prev =>
        prev.map(f => ({
          ...f,
          evidenceType: f.evidenceType || '物证',
          evidenceName: f.evidenceName || f.name,
          customEvidenceType: f.customEvidenceType || '物证',
          status: 'ready' as const,
        }))
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: () => false,
    onChange(info) {
      const newFiles: AnalyzedFile[] = info.fileList
        .filter((f: UploadFile) => !fileList.some(existing => existing.uid === f.uid))
        .map((f: UploadFile) => ({
          uid: f.uid,
          name: f.name,
          size: f.size || 0,
          type: f.type || '',
          originFileObj: f.originFileObj,
          status: 'pending',
          evidenceName: f.name.replace(/\.[^.]+$/, ''),
        }));

      if (newFiles.length > 0) {
        setFileList(prev => [...prev, ...newFiles]);
        analyzeFiles(newFiles);
      }
    },
  };

  const removeFile = (uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
  };

  const clearAllFiles = () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有已选择的文件吗？',
      onOk: () => setFileList([]),
    });
  };

  const applyBatchToAll = () => {
    const values = batchForm.getFieldsValue();
    if (!values.collectionMethod && !values.collector && !values.location) {
      message.info('请先填写需要批量应用的字段');
      return;
    }

    setFileList(prev =>
      prev.map(f => ({
        ...f,
        customCollectionMethod: values.collectionMethod || f.customCollectionMethod,
        collector: values.collector || f.collector,
        location: values.location || f.location,
      }))
    );
    message.success(`已批量应用到 ${fileList.length} 个文件`);
  };

  const openEditModal = (file: AnalyzedFile) => {
    setEditingFile(file);
    editForm.setFieldsValue({
      evidenceName: file.evidenceName,
      evidenceType: file.customEvidenceType || file.evidenceType,
      collectionMethod: file.customCollectionMethod || file.collectionMethod,
      collector: file.collector,
      location: file.location,
      description: file.description,
      note: file.note,
    });
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    editForm.validateFields().then((values) => {
      if (!editingFile) return;
      setFileList(prev =>
        prev.map(f =>
          f.uid === editingFile.uid
            ? { ...f, ...values, status: 'ready' }
            : f
        )
      );
      setEditModalVisible(false);
      setEditingFile(null);
      message.success('已更新文件信息');
    });
  };

  const handleSubmit = async () => {
    if (fileList.length === 0) {
      message.error('请先选择要上传的文件');
      return;
    }

    const notReady = fileList.filter(f => f.status !== 'ready');
    if (notReady.length > 0) {
      message.error(`有 ${notReady.length} 个文件尚未准备完成，请等待分析完成`);
      return;
    }

    const invalid = fileList.filter(f => !f.evidenceName || !f.customEvidenceType);
    if (invalid.length > 0) {
      message.error('有文件缺少必要信息，请检查并填写证据名称和类型');
      return;
    }

    const batchValues = batchForm.getFieldsValue();

    setUploading(true);
    setOverallProgress(0);

    try {
      const formData = new FormData();

      fileList.forEach(f => {
        if (f.originFileObj) {
          formData.append('files', f.originFileObj);
        }
      });

      const evidenceMetadata = fileList.map(f => ({
        name: f.evidenceName,
        evidenceType: f.customEvidenceType,
        collectionMethod: f.customCollectionMethod,
        collector: f.collector,
        location: f.location,
        description: f.description,
        note: f.note,
      }));

      formData.append('evidences', JSON.stringify(evidenceMetadata));
      if (batchValues.batchName) formData.append('batchName', batchValues.batchName);
      if (batchValues.description) formData.append('description', batchValues.description);
      if (batchValues.caseId) formData.append('caseId', batchValues.caseId);
      if (batchValues.clueId) formData.append('clueId', batchValues.clueId);
      if (batchValues.collectionMethod) formData.append('collectionMethod', batchValues.collectionMethod);
      if (batchValues.collector) formData.append('collector', batchValues.collector);
      if (batchValues.collectionTime) {
        formData.append('collectionTime', batchValues.collectionTime.toISOString());
      }
      if (batchValues.location) formData.append('location', batchValues.location);

      const response = await evidenceApi.uploadBatch(formData, (progress) => {
        setOverallProgress(Math.min(progress, 95));
      });

      setOverallProgress(100);
      setUploadResult(response.data);
      setResultModalVisible(true);

      setFileList(prev =>
        prev.map(f => {
          const matched = response.data.evidences.find((e: any) => e.originalName === f.name);
          if (matched && matched.success !== false) {
            return { ...f, status: 'success' };
          }
          return { ...f, status: 'error' };
        })
      );
    } catch (error) {
      message.error('批量上传失败');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const stats = useMemo(() => ({
    total: fileList.length,
    ready: fileList.filter(f => f.status === 'ready').length,
    success: fileList.filter(f => f.status === 'success').length,
    error: fileList.filter(f => f.status === 'error').length,
    analyzing: fileList.filter(f => f.status === 'analyzing').length,
  }), [fileList]);

  const columns = [
    {
      title: '文件',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: AnalyzedFile) => (
        <Space>
          <span style={{ fontSize: 20 }}>
            {fileTypeIcons[record.fileType || 'other']}
          </span>
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <div style={{ color: '#999', fontSize: 12 }}>
              {formatFileSize(record.size)}
              {record.fileType && <Tag style={{ marginLeft: 8 }}>{record.fileType}</Tag>}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '证据名称',
      dataIndex: 'evidenceName',
      key: 'evidenceName',
      render: (text: string, record: AnalyzedFile) => (
        <Space>
          <span>{text || '-'}</span>
          {record.suggestedName && record.suggestedName !== text && (
            <Tooltip title={`系统建议名称：${record.suggestedName}`}>
              <BulbOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '证据类型',
      dataIndex: 'customEvidenceType',
      key: 'evidenceType',
      render: (text: string, record: AnalyzedFile) => {
        const displayed = text || record.evidenceType;
        const autoDetected = record.evidenceType && !text;
        return (
          <Space>
            {displayed ? (
              <Tag color={evidenceTypeColors[displayed] || 'default'}>{displayed}</Tag>
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
            {autoDetected && (
              <Tooltip title="系统自动识别">
                <BulbOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '收集方式',
      dataIndex: 'customCollectionMethod',
      key: 'collectionMethod',
      render: (text: string, record: AnalyzedFile) => {
        const displayed = text || record.collectionMethod;
        const autoDetected = record.collectionMethod && !text;
        return (
          <Space>
            <span>{displayed || '-'}</span>
            {autoDetected && (
              <Tooltip title="系统自动识别">
                <BulbOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '收集人',
      dataIndex: 'collector',
      key: 'collector',
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: AnalyzedFile) => {
        const statusMap: Record<string, { color: string; text: string; icon?: any }> = {
          pending: { color: 'default', text: '待分析' },
          analyzing: { color: 'processing', text: '分析中' },
          ready: { color: 'blue', text: '待上传', icon: <PaperClipOutlined /> },
          uploading: { color: 'processing', text: '上传中' },
          success: { color: 'success', text: '已入库', icon: <CheckCircleOutlined /> },
          error: { color: 'error', text: '失败', icon: <ExclamationCircleOutlined /> },
        };
        const s = statusMap[record.status];
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: AnalyzedFile) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            disabled={uploading}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeFile(record.uid)}
            disabled={uploading}
          >
            移除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/evidences')}>返回</Button>
          <h2 className="page-title">批量证据入库</h2>
        </Space>
      </div>

      <Alert
        message="批量入库说明"
        description={
          <div>
            <div>1. 支持多文件同时上传，系统将自动识别文件类型并推荐证据类型和收集方式</div>
            <div>2. 可先填写批次公共信息（关联案件、收集人等），一键应用到所有文件</div>
            <div>3. 每个文件的信息支持单独编辑调整</div>
            <div>4. 所有文件将作为同一批次入库，便于追溯和管理</div>
          </div>
        }
        type="info"
        showIcon
        icon={<BulbOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Collapse defaultActiveKey={['1']} ghost>
          <Panel
            header={
              <Space>
                <SettingOutlined />
                <span>批次公共信息（可批量应用到所有文件）</span>
              </Space>
            }
            key="1"
          >
            <Form
              form={batchForm}
              layout="vertical"
              initialValues={{}}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="batchName" label="批次名称">
                    <Input placeholder="如：2024年1月现场勘查照片批次" maxLength={200} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="description" label="批次描述">
                    <Input placeholder="简要描述本批次证据" maxLength={500} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
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
                </Col>
                <Col xs={24} md={12}>
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
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item name="collectionMethod" label="收集方式">
                    <Select
                      placeholder="请选择收集方式"
                      allowClear
                      options={options.collectionMethods?.map((t: string) => ({ label: t, value: t }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="collector" label="收集人">
                    <Input placeholder="收集人员姓名" maxLength={50} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="collectionTime" label="收集时间">
                    <DatePicker
                      showTime
                      style={{ width: '100%' }}
                      placeholder="选择证据收集时间"
                      disabledDate={(current) => current && current > moment().endOf('day')}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24}>
                  <Form.Item name="location" label="收集地点">
                    <Input placeholder="证据收集地点" maxLength={200} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={applyBatchToAll}
                  disabled={fileList.length === 0}
                >
                  批量应用到所有文件
                </Button>
              </Form.Item>
            </Form>
          </Panel>
        </Collapse>
      </Card>

      <Card
        className="card-shadow"
        title={
          <Space>
            <FileOutlined />
            <span>证据文件列表</span>
            <Badge count={stats.total} showZero />
          </Space>
        }
        extra={
          <Space>
            {stats.analyzing > 0 && (
              <Tag color="processing">智能识别中 {stats.analyzing}</Tag>
            )}
            {stats.ready > 0 && (
              <Tag color="blue">待上传 {stats.ready}</Tag>
            )}
            {stats.success > 0 && (
              <Tag color="success">已入库 {stats.success}</Tag>
            )}
            {stats.error > 0 && (
              <Tag color="error">失败 {stats.error}</Tag>
            )}
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearAllFiles}
              disabled={fileList.length === 0 || uploading}
            >
              清空列表
            </Button>
          </Space>
        }
      >
        <Dragger {...uploadProps} style={{ marginBottom: 24 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          </p>
          <p className="ant-upload-text">点击或将多个文件拖拽到此处</p>
          <p className="ant-upload-hint">
            支持图片、视频、音频、文档、压缩包等格式，单文件最大 100MB，可批量选择多个文件
          </p>
        </Dragger>

        {uploading && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>批量上传进度</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress percent={Math.round(overallProgress)} status="active" />
          </div>
        )}

        {fileList.length > 0 && (
          <Table
            columns={columns}
            dataSource={fileList}
            rowKey="uid"
            pagination={false}
            size="middle"
            loading={analyzing}
            locale={{ emptyText: '暂无文件，请选择或拖拽文件上传' }}
          />
        )}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Statistic title="文件总数" value={stats.total} valueStyle={{ fontSize: 16 }} />
            <Divider type="vertical" />
            <Statistic
              title="已就绪"
              value={stats.ready}
              valueStyle={{ fontSize: 16, color: '#1677ff' }}
            />
            <Divider type="vertical" />
            <Statistic
              title="识别中"
              value={stats.analyzing}
              valueStyle={{ fontSize: 16, color: '#faad14' }}
            />
          </Space>
          <Space>
            <Button onClick={() => navigate('/evidences')} disabled={uploading}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={uploading}
              disabled={fileList.length === 0 || stats.analyzing > 0}
            >
              {uploading ? '批量入库中...' : `批量入库 (${stats.ready}/${stats.total})`}
            </Button>
          </Space>
        </div>
      </Card>

      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>编辑证据信息 - {editingFile?.name}</span>
          </Space>
        }
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingFile(null);
        }}
        onOk={saveEdit}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        {editingFile && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
            <Space>
              <span style={{ fontSize: 24 }}>
                {fileTypeIcons[editingFile.fileType || 'other']}
              </span>
              <div>
                <div style={{ fontWeight: 500 }}>{editingFile.name}</div>
                <div style={{ color: '#999', fontSize: 12 }}>
                  {formatFileSize(editingFile.size)} · {editingFile.type || '未知类型'}
                </div>
              </div>
              {editingFile.evidenceType && (
                <Tag icon={<BulbOutlined />} color="blue">
                  系统识别：{editingFile.evidenceType}
                </Tag>
              )}
              {editingFile.collectionMethod && (
                <Tag color="cyan">
                  推荐收集方式：{editingFile.collectionMethod}
                </Tag>
              )}
            </Space>
          </div>
        )}
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="evidenceName"
                label="证据名称"
                rules={[{ required: true, message: '请输入证据名称' }]}
              >
                <Input placeholder="请输入证据名称" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
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
            <Col xs={24} md={12}>
              <Form.Item name="collectionMethod" label="收集方式">
                <Select
                  placeholder="请选择收集方式"
                  allowClear
                  options={options.collectionMethods?.map((t: string) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="collector" label="收集人">
                <Input placeholder="收集人员姓名" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="location" label="收集地点">
                <Input placeholder="证据收集地点" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="证据描述">
            <TextArea rows={3} placeholder="详细描述证据的来源、内容、特征等" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <TextArea rows={2} placeholder="其他备注信息" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>批量入库完成</span>
          </Space>
        }
        open={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setResultModalVisible(false)}>
            继续上传
          </Button>,
          <Button
            key="list"
            icon={<EyeOutlined />}
            onClick={() => navigate('/evidences')}
          >
            查看证据列表
          </Button>,
          uploadResult?.batch?.id && (
            <Button
              key="batch"
              type="primary"
              onClick={() => {
                setResultModalVisible(false);
                navigate('/evidences');
              }}
            >
              查看批次详情
            </Button>
          ),
        ]}
        width={720}
        destroyOnClose
      >
        {uploadResult && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={8}>
                <Card size="small">
                  <Statistic title="批次编号" value={uploadResult.batch?.batchNumber || '-'} valueStyle={{ fontSize: 18 }} />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small">
                  <Statistic
                    title="成功入库"
                    value={uploadResult.batch?.successCount || 0}
                    valueStyle={{ fontSize: 18, color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small">
                  <Statistic
                    title="失败数量"
                    value={uploadResult.batch?.failCount || 0}
                    valueStyle={{ fontSize: 18, color: uploadResult.batch?.failCount > 0 ? '#ff4d4f' : '#52c41a' }}
                    prefix={<ExclamationCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {uploadResult.evidences?.length > 0 && (
              <>
                <Divider orientation="left">入库详情</Divider>
                <Table
                  size="small"
                  dataSource={uploadResult.evidences}
                  rowKey={(record: any) => record.id || record.fileName}
                  pagination={false}
                  columns={[
                    {
                      title: '文件名',
                      dataIndex: 'originalName',
                      key: 'originalName',
                      render: (text: string, record: any) => record.success === false ? record.fileName : text,
                    },
                    {
                      title: '证据名称',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text: string, record: any) => record.success === false ? '-' : text,
                    },
                    {
                      title: '证据编号',
                      dataIndex: 'evidenceNumber',
                      key: 'evidenceNumber',
                      render: (text: string, record: any) => record.success === false
                        ? <Tag color="error">失败</Tag>
                        : <Tag color="blue" style={{ fontFamily: 'monospace' }}>{text}</Tag>,
                    },
                    {
                      title: '类型',
                      dataIndex: 'evidenceType',
                      key: 'evidenceType',
                      render: (text: string) => text ? <Tag color={evidenceTypeColors[text] || 'default'}>{text}</Tag> : '-',
                    },
                    {
                      title: '状态',
                      key: 'status',
                      render: (_: any, record: any) => record.success === false
                        ? <Tag color="error">{record.error || '失败'}</Tag>
                        : <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>,
                    },
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
