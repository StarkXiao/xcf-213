import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Input, Select, Tag, Popconfirm, Form, message, Card,
  Row, Col, Statistic, DatePicker, Checkbox, Modal, Divider, Tooltip, Progress,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined,
  SearchOutlined, ReloadOutlined, SafetyCertificateOutlined, FileSearchOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { forensicApi } from '../../services/api';

interface ForensicFileItem {
  id: string;
  forensicNumber: string;
  fileName: string;
  fileType: string;
  fileExtension: string | null;
  fileSize: number;
  md5Hash: string | null;
  sha1Hash: string | null;
  sha256Hash: string | null;
  integrityStatus: string;
  verificationCount: number;
  lastVerificationTime: string | null;
  description: string | null;
  caseId: string | null;
  clueId: string | null;
  batchId: string | null;
  batch: { id: string; batchNumber: string; name: string } | null;
  case: { id: string; caseNumber: string; title: string } | null;
  clue: { id: string; clueNumber: string; title: string } | null;
  caseRelations: Array<{ case: { id: string; caseNumber: string; title: string } }>;
  clueRelations: Array<{ clue: { id: string; clueNumber: string; title: string } }>;
  acquisitionMethod: string | null;
  acquirer: string | null;
  tags: string | null;
  createdAt: string;
}

const fileTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
  DOCUMENT: { label: '文档', color: 'blue', icon: '📄' },
  IMAGE: { label: '图片', color: 'green', icon: '🖼️' },
  VIDEO: { label: '视频', color: 'purple', icon: '🎬' },
  AUDIO: { label: '音频', color: 'orange', icon: '🎵' },
  EMAIL: { label: '邮件', color: 'cyan', icon: '📧' },
  DATABASE: { label: '数据库', color: 'magenta', icon: '🗄️' },
  LOG: { label: '日志', color: 'geekblue', icon: '📝' },
  ARCHIVE: { label: '压缩包', color: 'volcano', icon: '📦' },
  CODE: { label: '代码', color: 'lime', icon: '💻' },
  SYSTEM_FILE: { label: '系统文件', color: 'red', icon: '⚙️' },
  OTHER: { label: '其他', color: 'default', icon: '📎' },
};

const integrityStatusLabels: Record<string, { label: string; color: string; icon: any }> = {
  VERIFIED: { label: '校验通过', color: 'success', icon: <CheckCircleOutlined /> },
  CORRUPTED: { label: '数据损坏', color: 'error', icon: <ExclamationCircleOutlined /> },
  PENDING: { label: '待校验', color: 'warning', icon: <ClockCircleOutlined /> },
  NOT_APPLICABLE: { label: '不适用', color: 'default', icon: null },
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const truncateHash = (hash: string, length = 12) => {
  if (!hash) return '-';
  return hash.length > length ? `${hash.substring(0, length)}...` : hash;
};

export default function ForensicFileList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<ForensicFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [options, setOptions] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);

  useEffect(() => {
    loadOptions();
    loadStats();
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadOptions = async () => {
    try {
      const res = await forensicApi.getOptions();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await forensicApi.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadData = async (filters?: any) => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const res = await forensicApi.list(params);
      setData(res.data.items);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载取证文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters: any = {};
    if (values.keyword) filters.keyword = values.keyword;
    if (values.fileType) filters.fileType = values.fileType;
    if (values.integrityStatus) filters.integrityStatus = values.integrityStatus;
    if (values.caseId) filters.caseId = values.caseId;
    if (values.startDate) filters.startDate = values.startDate.startOf('day').toISOString();
    if (values.endDate) filters.endDate = values.endDate.endOf('day').toISOString();
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData(filters);
  };

  const handleReset = () => {
    form.resetFields();
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData();
  };

  const handleDelete = async (id: string) => {
    try {
      await forensicApi.delete(id);
      message.success('删除成功');
      loadData();
      loadStats();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const res = await forensicApi.download(id);
      const blob = new Blob([res.data as any]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (error) {
      message.error('下载失败');
    }
  };

  const handleVerifyHashes = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要校验的文件');
      return;
    }

    setVerifying(true);
    try {
      const res = await forensicApi.verifyHashes(selectedRowKeys as string[]);
      setVerifyResult(res.data);
      setVerifyModalVisible(true);
      loadData();
      loadStats();
    } catch (error) {
      message.error('哈希校验失败');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifySingle = async (id: string) => {
    setVerifying(true);
    try {
      const res = await forensicApi.verifyHashes([id]);
      setVerifyResult(res.data);
      setVerifyModalVisible(true);
      loadData();
      loadStats();
    } catch (error) {
      message.error('哈希校验失败');
    } finally {
      setVerifying(false);
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const columns: ColumnsType<ForensicFileItem> = [
    {
      title: '取证编号',
      dataIndex: 'forensicNumber',
      key: 'forensicNumber',
      width: 160,
      fixed: 'left',
      render: (text) => (
        <span style={{ fontFamily: 'monospace', color: '#1677ff', fontWeight: 500 }}>{text}</span>
      ),
    },
    {
      title: '文件名称',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 220,
      render: (text, record) => (
        <Tooltip title={text}>
          <a onClick={() => navigate(`/forensics/${record.id}`)} style={{
            display: 'block', maxWidth: 220, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <Space>
              <span>{fileTypeLabels[record.fileType]?.icon || '📎'}</span>
              <span>{text}</span>
            </Space>
          </a>
        </Tooltip>
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 100,
      render: (text) => {
        const type = fileTypeLabels[text] || fileTypeLabels.OTHER;
        return <Tag color={type.color}>{type.icon} {type.label}</Tag>;
      },
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (text) => formatFileSize(text),
    },
    {
      title: '完整性校验',
      dataIndex: 'integrityStatus',
      key: 'integrityStatus',
      width: 110,
      render: (text, record) => {
        const status = integrityStatusLabels[text] || integrityStatusLabels.PENDING;
        return (
          <Tooltip title={`已校验 ${record.verificationCount} 次`}>
            <Tag color={status.color} icon={status.icon}>
              {status.label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'MD5',
      dataIndex: 'md5Hash',
      key: 'md5Hash',
      width: 140,
      render: (text) => (
        <Tooltip title={text}>
          <code style={{ fontSize: 12, color: '#666' }}>{truncateHash(text)}</code>
        </Tooltip>
      ),
    },
    {
      title: 'SHA256',
      dataIndex: 'sha256Hash',
      key: 'sha256Hash',
      width: 140,
      render: (text) => (
        <Tooltip title={text}>
          <code style={{ fontSize: 12, color: '#666' }}>{truncateHash(text)}</code>
        </Tooltip>
      ),
    },
    {
      title: '关联案件',
      key: 'cases',
      width: 150,
      render: (_, record) => {
        const allCases = [
          ...(record.case ? [record.case] : []),
          ...(record.caseRelations?.map(r => r.case).filter(Boolean) || []),
        ];
        const uniqueCases = allCases.filter((c, i, arr) =>
          arr.findIndex(x => x.id === c.id) === i
        );
        if (uniqueCases.length === 0) return '-';
        return (
          <Space direction="vertical" size={2}>
            {uniqueCases.slice(0, 2).map(c => (
              <Tooltip key={c.id} title={c.title}>
                <a onClick={() => navigate(`/cases/${c.id}`)} style={{ fontSize: 12 }}>
                  {c.caseNumber}
                </a>
              </Tooltip>
            ))}
            {uniqueCases.length > 2 && (
              <Tag color="blue" style={{ fontSize: 11 }}>+{uniqueCases.length - 2}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '关联线索',
      key: 'clues',
      width: 150,
      render: (_, record) => {
        const allClues = [
          ...(record.clue ? [record.clue] : []),
          ...(record.clueRelations?.map(r => r.clue).filter(Boolean) || []),
        ];
        const uniqueClues = allClues.filter((c, i, arr) =>
          arr.findIndex(x => x.id === c.id) === i
        );
        if (uniqueClues.length === 0) return '-';
        return (
          <Space direction="vertical" size={2}>
            {uniqueClues.slice(0, 2).map(c => (
              <Tooltip key={c.id} title={c.title}>
                <a onClick={() => navigate(`/clues/${c.id}`)} style={{ fontSize: 12 }}>
                  {c.clueNumber}
                </a>
              </Tooltip>
            ))}
            {uniqueClues.length > 2 && (
              <Tag color="cyan" style={{ fontSize: 11 }}>+{uniqueClues.length - 2}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '所属批次',
      key: 'batch',
      width: 130,
      render: (_, record) => record.batch ? (
        <Tooltip title={record.batch.name}>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {record.batch.batchNumber}
          </span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '取证时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '上次校验',
      dataIndex: 'lastVerificationTime',
      key: 'lastVerificationTime',
      width: 160,
      render: (text) => text ? moment(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/forensics/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SafetyCertificateOutlined />}
            onClick={() => handleVerifySingle(record.id)}
            loading={verifying}
          >
            校验
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, record.fileName)}
          >
            下载
          </Button>
          <Popconfirm
            title="确定删除该取证文件？"
            description="删除后可在回收站恢复"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          <Space>
            <FileSearchOutlined />
            电子数据取证
          </Space>
        </h2>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Button
              icon={<SafetyCertificateOutlined />}
              onClick={handleVerifyHashes}
              loading={verifying}
            >
              批量哈希校验 ({selectedRowKeys.length})
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/forensics/import')}
          >
            批量导入取证
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="取证文件总数"
              value={stats.totalFiles || 0}
              prefix={<FileSearchOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="校验通过"
              value={stats.verifiedCount || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="数据损坏"
              value={stats.corruptedCount || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-shadow">
            <Statistic
              title="取证批次"
              value={stats.totalBatches || 0}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="文件名/编号/哈希值" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="fileType" label="文件类型">
                <Select
                  placeholder="选择类型"
                  allowClear
                  options={options.fileTypes?.map((t: any) => ({ label: t.label, value: t.value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="integrityStatus" label="校验状态">
                <Select
                  placeholder="选择状态"
                  allowClear
                  options={options.integrityStatuses?.map((t: any) => ({ label: t.label, value: t.value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="startDate" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="endDate" label="结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={24}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
                  <Button onClick={handleReset} icon={<ReloadOutlined />}>重置</Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="card-shadow">
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) =>
              setPagination({ current: page, pageSize, total: pagination.total }),
          }}
          scroll={{ x: 1800 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
            哈希校验结果
          </Space>
        }
        open={verifyModalVisible}
        onCancel={() => setVerifyModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setVerifyModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
        destroyOnClose
      >
        {verifyResult && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={8}>
                <Card size="small">
                  <Statistic title="校验总数" value={verifyResult.total} />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small">
                  <Statistic
                    title="校验通过"
                    value={verifyResult.verifiedCount}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small">
                  <Statistic
                    title="数据损坏"
                    value={verifyResult.corruptedCount}
                    valueStyle={{ color: verifyResult.corruptedCount > 0 ? '#ff4d4f' : '#52c41a' }}
                    prefix={<ExclamationCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>
            <Divider orientation="left">详细结果</Divider>
            <Table
              size="small"
              dataSource={verifyResult.results}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: '文件名称',
                  dataIndex: 'fileName',
                  key: 'fileName',
                  render: (text, record: any) => (
                    <Space>
                      <span>{record.forensicNumber && <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{record.forensicNumber}</Tag>}</span>
                      <span>{text || record.id}</span>
                    </Space>
                  ),
                },
                {
                  title: '状态',
                  key: 'status',
                  width: 120,
                  render: (_, record: any) => {
                    if (!record.success) {
                      return <Tag color="error">{record.error || '失败'}</Tag>;
                    }
                    const status = integrityStatusLabels[record.status] || integrityStatusLabels.PENDING;
                    return <Tag color={status.color} icon={status.icon}>{status.label}</Tag>;
                  },
                },
                {
                  title: 'MD5',
                  key: 'md5',
                  width: 180,
                  render: (_, record: any) => {
                    if (!record.hashes) return record.note || '-';
                    return (
                      <Tooltip title={
                        <div>
                          <div>原始: {record.hashes.originalMd5}</div>
                          <div>当前: {record.hashes.currentMd5}</div>
                        </div>
                      }>
                        <Tag color={record.matches?.md5Match ? 'success' : 'error'}>
                          MD5 {record.matches?.md5Match ? '✓' : '✗'}
                        </Tag>
                      </Tooltip>
                    );
                  },
                },
                {
                  title: 'SHA1',
                  key: 'sha1',
                  width: 180,
                  render: (_, record: any) => {
                    if (!record.hashes) return '-';
                    return (
                      <Tooltip title={
                        <div>
                          <div>原始: {record.hashes.originalSha1}</div>
                          <div>当前: {record.hashes.currentSha1}</div>
                        </div>
                      }>
                        <Tag color={record.matches?.sha1Match ? 'success' : 'error'}>
                          SHA1 {record.matches?.sha1Match ? '✓' : '✗'}
                        </Tag>
                      </Tooltip>
                    );
                  },
                },
                {
                  title: 'SHA256',
                  key: 'sha256',
                  width: 180,
                  render: (_, record: any) => {
                    if (!record.hashes) return '-';
                    return (
                      <Tooltip title={
                        <div>
                          <div>原始: {record.hashes.originalSha256}</div>
                          <div>当前: {record.hashes.currentSha256}</div>
                        </div>
                      }>
                        <Tag color={record.matches?.sha256Match ? 'success' : 'error'}>
                          SHA256 {record.matches?.sha256Match ? '✓' : '✗'}
                        </Tag>
                      </Tooltip>
                    );
                  },
                },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
