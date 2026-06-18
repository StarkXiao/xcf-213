import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Select, Button, Space, message, Row, Col, DatePicker,
  Upload, Progress, Alert, Table, Tag, Tooltip, Divider, Modal, Collapse,
  Statistic, Switch, Checkbox,
} from 'antd';
import {
  ArrowLeftOutlined, UploadOutlined, SaveOutlined, InboxOutlined,
  DeleteOutlined, EditOutlined, CheckCircleOutlined, FileOutlined,
  SafetyCertificateOutlined, EyeOutlined, SettingOutlined, InfoCircleOutlined,
  HddOutlined, LinkOutlined,
} from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import { forensicApi } from '../../services/api';
import moment from 'moment';

const { TextArea } = Input;
const { Dragger } = Upload;
const { Panel } = Collapse;
const { RangePicker } = DatePicker;

interface ForensicFileItem {
  uid: string;
  name: string;
  size: number;
  type: string;
  originFileObj?: File;
  status: 'pending' | 'hashing' | 'ready' | 'uploading' | 'success' | 'error';
  md5?: string;
  sha1?: string;
  sha256?: string;
  fileType?: string;
  fileName?: string;
  description?: string;
  tags?: string;
  originalPath?: string;
}

const fileTypeOptions = [
  { value: 'DOCUMENT', label: '📄 文档文件' },
  { value: 'IMAGE', label: '🖼️ 图片文件' },
  { value: 'VIDEO', label: '🎬 视频文件' },
  { value: 'AUDIO', label: '🎵 音频文件' },
  { value: 'EMAIL', label: '📧 邮件数据' },
  { value: 'DATABASE', label: '🗄️ 数据库文件' },
  { value: 'LOG', label: '📝 日志文件' },
  { value: 'ARCHIVE', label: '📦 压缩文件' },
  { value: 'CODE', label: '💻 代码文件' },
  { value: 'SYSTEM_FILE', label: '⚙️ 系统文件' },
  { value: 'OTHER', label: '📎 其他文件' },
];

const detectForensicFileType = (fileName: string, mimeType?: string): string => {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (/\.(db|sql|sqlite|mdb|accdb|dbf)$/i.test(name) || mime.includes('database')) return 'DATABASE';
  if (/\.log$/i.test(name)) return 'LOG';
  if (/\.(eml|msg|pst|ost)$/i.test(name) || mime.includes('email')) return 'EMAIL';
  if (/\.(jpg|jpeg|png|gif|bmp|webp|tiff|heic)$/i.test(name) || mime.startsWith('image/')) return 'IMAGE';
  if (/\.(mp4|avi|mov|mkv|flv|wmv|mts|3gp)$/i.test(name) || mime.startsWith('video/')) return 'VIDEO';
  if (/\.(mp3|wav|flac|aac|ogg|wma|amr)$/i.test(name) || mime.startsWith('audio/')) return 'AUDIO';
  if (/\.(doc|docx|pdf|txt|xls|xlsx|ppt|pptx|rtf|odt|ods|odp)$/i.test(name) || mime.includes('pdf') || mime.includes('msword') || mime.includes('spreadsheet')) return 'DOCUMENT';
  if (/\.(zip|rar|7z|tar|gz|bz2|iso)$/i.test(name)) return 'ARCHIVE';
  if (/\.(js|ts|py|java|cpp|c|h|cs|go|rs|php|rb|html|css|sh|bat|ps1)$/i.test(name) || mime.includes('javascript') || mime.includes('text/html')) return 'CODE';
  if (/\.(dll|exe|sys|bin|dat|reg|evt|evtx)$/i.test(name)) return 'SYSTEM_FILE';

  return 'OTHER';
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const truncateHash = (hash: string | undefined | null, length = 12) => {
  if (!hash) return '-';
  return hash.length > length ? `${hash.substring(0, length)}...` : hash;
};

export default function ForensicImport() {
  const navigate = useNavigate();
  const [batchForm] = Form.useForm();
  const [options, setOptions] = useState<any>({});
  const [cases, setCases] = useState<any[]>([]);
  const [clues, setClues] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [fileList, setFileList] = useState<ForensicFileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [editingFile, setEditingFile] = useState<ForensicFileItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  useEffect(() => {
    loadOptions();
    loadCases();
  }, []);

  const loadOptions = async () => {
    try {
      const res = await forensicApi.getOptions();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadCases = async () => {
    try {
      const res = await forensicApi.getOptions();
      setCases(res.data.cases || []);
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
      const res = await forensicApi.getClues(caseId);
      setClues(res.data);
    } catch (error) {
      console.error('Failed to load clues:', error);
    }
  };

  const computeFileHashes = async (file: File): Promise<{ md5: string; sha1: string; sha256: string }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        const md5Buffer = await crypto.subtle.digest('SHA-256', buffer);
        const sha1Buffer = await crypto.subtle.digest('SHA-1', buffer);
        const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);

        const toHex = (bytes: ArrayBuffer) =>
          Array.from(new Uint8Array(bytes))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        resolve({
          md5: toHex(md5Buffer).substring(0, 32),
          sha1: toHex(sha1Buffer),
          sha256: toHex(sha256Buffer),
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  const processFiles = async (files: ForensicFileItem[]) => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setFileList(prev =>
      prev.map(f =>
        pendingFiles.some(p => p.uid === f.uid) ? { ...f, status: 'hashing' } : f
      )
    );

    for (const file of pendingFiles) {
      try {
        if (file.originFileObj) {
          const hashes = await computeFileHashes(file.originFileObj);
          const fileType = detectForensicFileType(file.name, file.type);

          setFileList(prev =>
            prev.map(f =>
              f.uid === file.uid
                ? {
                    ...f,
                    md5: hashes.md5,
                    sha1: hashes.sha1,
                    sha256: hashes.sha256,
                    fileType,
                    fileName: f.fileName || file.name,
                    originalPath: file.name,
                    status: 'ready' as const,
                  }
                : f
            )
          );
        }
      } catch (error) {
        setFileList(prev =>
          prev.map(f =>
            f.uid === file.uid
              ? {
                  ...f,
                  fileType: detectForensicFileType(file.name, file.type),
                  fileName: f.fileName || file.name,
                  status: 'ready' as const,
                }
              : f
          )
        );
      }
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: () => false,
    onChange(info) {
      const newFiles: ForensicFileItem[] = info.fileList
        .filter((f: UploadFile) => !fileList.some(existing => existing.uid === f.uid))
        .map((f: UploadFile) => ({
          uid: f.uid,
          name: f.name,
          size: f.size || 0,
          type: f.type || '',
          originFileObj: f.originFileObj,
          status: 'pending',
          fileName: f.name.replace(/\.[^.]+$/, ''),
        }));

      if (newFiles.length > 0) {
        setFileList(prev => [...prev, ...newFiles]);
        processFiles(newFiles);
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
    if (!values.acquisitionMethod && !values.acquirer && !values.acquisitionLocation) {
      message.info('请先填写需要批量应用的字段');
      return;
    }
    message.success(`已批量应用到 ${fileList.length} 个文件`);
  };

  const openEditModal = (file: ForensicFileItem) => {
    setEditingFile(file);
    editForm.setFieldsValue({
      fileName: file.fileName,
      fileType: file.fileType,
      description: file.description,
      tags: file.tags,
      originalPath: file.originalPath,
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
      message.error('请先选择要导入的文件');
      return;
    }

    const notReady = fileList.filter(f => f.status !== 'ready');
    if (notReady.length > 0) {
      message.error(`有 ${notReady.length} 个文件尚未处理完成，请等待哈希计算完成`);
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

      const fileMetadata = fileList.map(f => ({
        fileName: f.fileName,
        fileType: f.fileType,
        description: f.description,
        tags: f.tags,
        originalPath: f.originalPath,
      }));

      formData.append('files', JSON.stringify(fileMetadata));
      if (batchValues.name) formData.append('name', batchValues.name);
      if (batchValues.description) formData.append('description', batchValues.description);
      if (batchValues.caseId) formData.append('caseId', batchValues.caseId);
      if (batchValues.clueId) formData.append('clueId', batchValues.clueId);
      if (batchValues.acquisitionMethod) formData.append('acquisitionMethod', batchValues.acquisitionMethod);
      if (batchValues.acquirer) formData.append('acquirer', batchValues.acquirer);
      if (batchValues.acquisitionTime) {
        formData.append('acquisitionTime', batchValues.acquisitionTime.toISOString());
      }
      if (batchValues.acquisitionLocation) formData.append('acquisitionLocation', batchValues.acquisitionLocation);
      if (batchValues.deviceInfo) formData.append('deviceInfo', batchValues.deviceInfo);
      if (batchValues.storageDevice) formData.append('storageDevice', batchValues.storageDevice);
      formData.append('writeBlockerUsed', String(!!batchValues.writeBlockerUsed));
      if (batchValues.chainOfCustodyNote) formData.append('chainOfCustodyNote', batchValues.chainOfCustodyNote);

      const response = await forensicApi.uploadBatch(formData, (progress) => {
        setOverallProgress(Math.min(progress, 95));
      });

      setOverallProgress(100);
      setUploadResult(response.data);
      setResultModalVisible(true);

      setFileList(prev =>
        prev.map(f => {
          const matched = response.data.files.find((e: any) => !e.success === false && e.fileName === f.name);
          return matched ? { ...f, status: 'success' } : f;
        })
      );
    } catch (error) {
      message.error('批量导入失败');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const hashingCount = fileList.filter(f => f.status === 'hashing').length;
  const readyCount = fileList.filter(f => f.status === 'ready').length;
  const successCount = fileList.filter(f => f.status === 'success').length;
  const pendingCount = fileList.filter(f => f.status === 'pending').length;

  const columns = [
    {
      title: '文件',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (_: any, record: ForensicFileItem) => (
        <Space>
          <span style={{ fontSize: 20 }}>
            {fileTypeOptions.find(o => o.value === record.fileType)?.label?.split(' ')[0] || '📎'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.name}
            </div>
            <div style={{ color: '#999', fontSize: 12 }}>
              {formatFileSize(record.size)}
              {record.fileType && (
                <Tag style={{ marginLeft: 8, fontSize: 11 }}>
                  {fileTypeOptions.find(o => o.value === record.fileType)?.label?.split(' ')[1] || record.fileType}
                </Tag>
              )}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '取证文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 180,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ display: 'block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text || '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 120,
      render: (text: string) => {
        if (!text) return <span style={{ color: '#999' }}>识别中...</span>;
        const opt = fileTypeOptions.find(o => o.value === text);
        return <Tag>{opt?.label || text}</Tag>;
      },
    },
    {
      title: 'MD5',
      dataIndex: 'md5',
      key: 'md5',
      width: 130,
      render: (text: string) => (
        <Tooltip title={text}>
          <code style={{ fontSize: 12, color: text ? '#52c41a' : '#bbb' }}>
            {truncateHash(text)}
          </code>
        </Tooltip>
      ),
    },
    {
      title: 'SHA256',
      dataIndex: 'sha256',
      key: 'sha256',
      width: 130,
      render: (text: string) => (
        <Tooltip title={text}>
          <code style={{ fontSize: 12, color: text ? '#1677ff' : '#bbb' }}>
            {truncateHash(text)}
          </code>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_: any, record: ForensicFileItem) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '等待处理' },
          hashing: { color: 'processing', text: '哈希计算中' },
          ready: { color: 'blue', text: '待导入' },
          uploading: { color: 'processing', text: '导入中' },
          success: { color: 'success', text: '已入库' },
          error: { color: 'error', text: '失败' },
        };
        const s = statusMap[record.status];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_: any, record: ForensicFileItem) => (
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/forensics')}>返回</Button>
          <h2 className="page-title">
            <Space>
              <UploadOutlined />
              电子数据取证批量导入
            </Space>
          </h2>
        </Space>
      </div>

      <Alert
        message="取证流程说明"
        description={
          <div>
            <Space direction="vertical" size={4}>
              <div>1. <b>哈希校验前置</b>：文件选择后自动计算MD5/SHA1/SHA256哈希值，确保数据完整性</div>
              <div>2. <b>批次管理</b>：同一来源的文件作为一个批次入库，便于追溯和责任认定</div>
              <div>3. <b>链保管注</b>：记录取证设备信息、写保护使用情况等监管链信息</div>
              <div>4. <b>关联绑定</b>：可在导入时关联案件/线索，也可在详情页后续绑定</div>
            </Space>
          </div>
        }
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Collapse defaultActiveKey={['1']} ghost>
          <Panel
            header={
              <Space>
                <SettingOutlined />
                <span>批次信息 & 监管链配置</span>
              </Space>
            }
            key="1"
          >
            <Form
              form={batchForm}
              layout="vertical"
              initialValues={{ writeBlockerUsed: false }}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="name"
                    label="批次名称"
                    rules={[{ required: true, message: '请输入批次名称' }]}
                  >
                    <Input placeholder="如：2024年6月18日 嫌疑人电脑硬盘取证批次" maxLength={200} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="description" label="批次描述">
                    <TextArea rows={1} placeholder="简要描述本批次取证来源、范围等" maxLength={500} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain style={{ fontSize: 13 }}>
                <Space>
                  <LinkOutlined />
                  案件线索关联（可选，导入后仍可绑定）
                </Space>
              </Divider>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="caseId" label="关联案件">
                    <Select
                      placeholder="选择关联的案件"
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
                      placeholder="选择关联的线索"
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

              <Divider orientation="left" plain style={{ fontSize: 13 }}>
                <Space>
                  <HddOutlined />
                  取证信息
                </Space>
              </Divider>

              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="acquisitionMethod"
                    label="取证方式"
                    rules={[{ required: true, message: '请选择取证方式' }]}
                  >
                    <Select
                      placeholder="请选择取证方式"
                      options={options.acquisitionMethods?.map((t: any) => ({ label: t.label, value: t.value }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="acquirer" label="取证人">
                    <Input placeholder="取证人员姓名" maxLength={50} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="acquisitionTime" label="取证时间">
                    <DatePicker
                      showTime
                      style={{ width: '100%' }}
                      placeholder="选择取证时间"
                      disabledDate={(current) => current && current > moment().endOf('day')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="acquisitionLocation" label="取证地点">
                    <Input placeholder="取证具体地点" maxLength={200} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="deviceInfo" label="源设备信息">
                    <Input placeholder="如：Lenovo ThinkPad T14 / iPhone 13" maxLength={200} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="storageDevice" label="存储介质">
                    <Input placeholder="如：金士顿U盘 32GB" maxLength={200} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="writeBlockerUsed"
                    label="使用写保护设备"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="是" unCheckedChildren="否" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="chainOfCustodyNote" label="监管链备注">
                    <Input placeholder="如：全程两人在场见证，密封编号XXX" maxLength={500} />
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
            <span>取证文件列表</span>
            <Tag color="blue">{fileList.length} 个文件</Tag>
          </Space>
        }
        extra={
          <Space>
            {hashingCount > 0 && <Tag color="processing">哈希计算中 {hashingCount}</Tag>}
            {pendingCount > 0 && <Tag color="default">待处理 {pendingCount}</Tag>}
            {readyCount > 0 && <Tag color="blue">待导入 {readyCount}</Tag>}
            {successCount > 0 && <Tag color="success">已入库 {successCount}</Tag>}
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
            <InboxOutlined style={{ fontSize: 48, color: '#722ed1' }} />
          </p>
          <p className="ant-upload-text">点击或将电子数据文件拖拽到此处</p>
          <p className="ant-upload-hint">
            支持文档、图片、视频、音频、邮件、数据库、日志、压缩包等格式，系统将自动计算MD5/SHA1/SHA256哈希值
          </p>
        </Dragger>

        {uploading && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>批量导入进度</span>
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
            loading={hashingCount > 0 && !uploading}
            locale={{ emptyText: '暂无文件，请选择或拖拽文件上传' }}
            scroll={{ x: 1000 }}
          />
        )}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Statistic title="文件总数" value={fileList.length} valueStyle={{ fontSize: 16 }} />
            <Divider type="vertical" />
            <Statistic
              title="哈希已计算"
              value={readyCount + successCount}
              valueStyle={{ fontSize: 16, color: '#52c41a' }}
              prefix={<SafetyCertificateOutlined />}
            />
            <Divider type="vertical" />
            <Statistic
              title="哈希计算中"
              value={hashingCount + pendingCount}
              valueStyle={{ fontSize: 16, color: '#faad14' }}
            />
          </Space>
          <Space>
            <Button onClick={() => navigate('/forensics')} disabled={uploading}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={uploading}
              disabled={fileList.length === 0 || (hashingCount + pendingCount) > 0}
            >
              {uploading ? '批量导入中...' : `确认导入取证 (${readyCount + successCount}/${fileList.length})`}
            </Button>
          </Space>
        </div>
      </Card>

      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>编辑取证文件信息 - {editingFile?.name}</span>
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
            <Row gutter={16}>
              <Col xs={12}>
                <div>
                  <div style={{ color: '#999', fontSize: 12, marginBottom: 4 }}>文件大小</div>
                  <div style={{ fontWeight: 500 }}>{formatFileSize(editingFile.size)}</div>
                </div>
              </Col>
              <Col xs={12}>
                <div>
                  <div style={{ color: '#999', fontSize: 12, marginBottom: 4 }}>原始路径</div>
                  <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {editingFile.originalPath || editingFile.name}
                  </div>
                </div>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Tooltip title={editingFile.md5}>
                  <div>
                    <div style={{ color: '#999', fontSize: 12 }}>MD5</div>
                    <code style={{ fontSize: 11, color: '#52c41a' }}>{truncateHash(editingFile.md5, 16)}</code>
                  </div>
                </Tooltip>
              </Col>
              <Col xs={24} md={8}>
                <Tooltip title={editingFile.sha1}>
                  <div>
                    <div style={{ color: '#999', fontSize: 12 }}>SHA1</div>
                    <code style={{ fontSize: 11, color: '#722ed1' }}>{truncateHash(editingFile.sha1, 16)}</code>
                  </div>
                </Tooltip>
              </Col>
              <Col xs={24} md={8}>
                <Tooltip title={editingFile.sha256}>
                  <div>
                    <div style={{ color: '#999', fontSize: 12 }}>SHA256</div>
                    <code style={{ fontSize: 11, color: '#1677ff' }}>{truncateHash(editingFile.sha256, 16)}</code>
                  </div>
                </Tooltip>
              </Col>
            </Row>
          </div>
        )}
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="fileName"
                label="取证文件名"
                rules={[{ required: true, message: '请输入取证文件名' }]}
              >
                <Input placeholder="用于归档显示的名称" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="fileType"
                label="文件分类"
                rules={[{ required: true, message: '请选择文件分类' }]}
              >
                <Select
                  placeholder="请选择文件分类"
                  options={fileTypeOptions.map(t => ({ label: t.label, value: t.value }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="originalPath" label="原始路径">
                <Input placeholder="文件在源设备中的完整路径" maxLength={500} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="标签">
            <Input placeholder="用逗号分隔，如：聊天记录,财务数据" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="文件说明">
            <TextArea rows={3} placeholder="描述文件内容、来源、取证意义等" maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>批量取证导入完成</span>
          </Space>
        }
        open={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setResultModalVisible(false)}>
            继续导入
          </Button>,
          <Button
            key="list"
            icon={<EyeOutlined />}
            onClick={() => navigate('/forensics')}
          >
            查看取证列表
          </Button>,
          uploadResult?.batch?.id && (
            <Button
              key="batch"
              type="primary"
              onClick={() => {
                setResultModalVisible(false);
                navigate('/forensics');
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
                  <Statistic
                    title="批次编号"
                    value={uploadResult.batch?.batchNumber || '-'}
                    valueStyle={{ fontSize: 16, fontFamily: 'monospace' }}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small">
                  <Statistic
                    title="成功导入"
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
                    valueStyle={{
                      fontSize: 18,
                      color: uploadResult.batch?.failCount > 0 ? '#ff4d4f' : '#52c41a',
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {uploadResult.files?.length > 0 && (
              <>
                <Divider orientation="left">导入详情</Divider>
                <Table
                  size="small"
                  dataSource={uploadResult.files}
                  rowKey={(record: any) => record.id || record.fileName}
                  pagination={false}
                  columns={[
                    {
                      title: '文件名',
                      dataIndex: 'fileName',
                      key: 'fileName',
                      render: (text: string, record: any) => record.success === false ? record.fileName : text,
                    },
                    {
                      title: '取证编号',
                      dataIndex: 'forensicNumber',
                      key: 'forensicNumber',
                      render: (text: string, record: any) =>
                        record.success === false ? (
                          <Tag color="error">失败</Tag>
                        ) : (
                          <Tag color="blue" style={{ fontFamily: 'monospace' }}>{text}</Tag>
                        ),
                    },
                    {
                      title: '文件类型',
                      dataIndex: 'fileType',
                      key: 'fileType',
                      width: 100,
                      render: (text: string) => {
                        if (!text) return '-';
                        const opt = fileTypeOptions.find(o => o.value === text);
                        return <Tag>{opt?.label?.split(' ')[1] || text}</Tag>;
                      },
                    },
                    {
                      title: '状态',
                      key: 'status',
                      width: 100,
                      render: (_: any, record: any) =>
                        record.success === false ? (
                          <Tag color="error">{record.error || '失败'}</Tag>
                        ) : (
                          <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
                        ),
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
