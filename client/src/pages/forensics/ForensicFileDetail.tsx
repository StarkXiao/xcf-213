import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Tabs, List, Modal, Form, Select,
  Input, message, Popconfirm, Row, Col, Table, Timeline, Empty, Divider,
  Tooltip, Statistic, Alert, Avatar,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  SafetyCertificateOutlined, DownloadOutlined, LinkOutlined,
  FileSearchOutlined, HistoryOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  CopyOutlined, FileTextOutlined, SearchOutlined, DisconnectOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { forensicApi, caseApi, clueApi } from '../../services/api';

const fileTypeLabels: Record<string, { label: string; color: string }> = {
  DOCUMENT: { label: '文档', color: 'blue' },
  IMAGE: { label: '图片', color: 'green' },
  VIDEO: { label: '视频', color: 'purple' },
  AUDIO: { label: '音频', color: 'orange' },
  EMAIL: { label: '邮件', color: 'cyan' },
  DATABASE: { label: '数据库', color: 'magenta' },
  LOG: { label: '日志', color: 'geekblue' },
  ARCHIVE: { label: '压缩包', color: 'volcano' },
  CODE: { label: '代码', color: 'lime' },
  SYSTEM_FILE: { label: '系统文件', color: 'red' },
  OTHER: { label: '其他', color: 'default' },
};

const integrityStatusLabels: Record<string, { label: string; color: string; icon: any }> = {
  VERIFIED: { label: '校验通过', color: 'success', icon: <CheckCircleOutlined /> },
  CORRUPTED: { label: '数据损坏', color: 'error', icon: <ExclamationCircleOutlined /> },
  PENDING: { label: '待校验', color: 'warning', icon: <ClockCircleOutlined /> },
  NOT_APPLICABLE: { label: '不适用', color: 'default', icon: null },
};

const acquisitionMethodLabels: Record<string, string> = {
  DIRECT_COLLECTION: '直接采集',
  FORENSIC_IMAGE: '取证镜像',
  NETWORK_CAPTURE: '网络抓包',
  EXTERNAL_PROVIDED: '外部提供',
  SEARCH_SEIZURE: '搜查扣押',
  VOLUNTARY_SUBMISSION: '主动提交',
  OTHER: '其他',
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

export default function ForensicFileDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fileData, setFileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [bindCaseModal, setBindCaseModal] = useState(false);
  const [bindCaseForm] = Form.useForm();
  const [allCases, setAllCases] = useState<any[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  const [bindClueModal, setBindClueModal] = useState(false);
  const [bindClueForm] = Form.useForm();
  const [caseClues, setCaseClues] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [cluesLoading, setCluesLoading] = useState(false);

  const [verifyModal, setVerifyModal] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      loadFileData();
      loadAllCases();
    }
  }, [id]);

  const loadFileData = async () => {
    setLoading(true);
    try {
      const res = await forensicApi.get(id!);
      setFileData(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAllCases = async () => {
    setCasesLoading(true);
    try {
      const res = await caseApi.list({ pageSize: 1000 });
      setAllCases(res.data.items || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setCasesLoading(false);
    }
  };

  const loadCaseClues = async (caseId: string) => {
    if (!caseId) {
      setCaseClues([]);
      return;
    }
    setCluesLoading(true);
    try {
      const res = await forensicApi.getClues(caseId);
      setCaseClues(res.data || []);
    } catch (error) {
      console.error('Failed to load clues:', error);
    } finally {
      setCluesLoading(false);
    }
  };

  const handleBindCase = async (values: any) => {
    try {
      await forensicApi.bindCase({
        forensicFileId: id!,
        caseId: values.caseId,
        relationType: values.relationType,
        description: values.description,
      });
      message.success('绑定案件成功');
      setBindCaseModal(false);
      bindCaseForm.resetFields();
      loadFileData();
    } catch (error) {
      message.error('绑定案件失败');
    }
  };

  const handleUnbindCase = async (caseId: string) => {
    try {
      await forensicApi.unbindCase({
        forensicFileId: id!,
        caseId,
      });
      message.success('解绑案件成功');
      loadFileData();
    } catch (error) {
      message.error('解绑案件失败');
    }
  };

  const handleBindClue = async (values: any) => {
    try {
      await forensicApi.bindClue({
        forensicFileId: id!,
        clueId: values.clueId,
        relationType: values.relationType,
        description: values.description,
      });
      message.success('绑定线索成功');
      setBindClueModal(false);
      bindClueForm.resetFields();
      setSelectedCaseId('');
      setCaseClues([]);
      loadFileData();
    } catch (error) {
      message.error('绑定线索失败');
    }
  };

  const handleUnbindClue = async (clueId: string) => {
    try {
      await forensicApi.unbindClue({
        forensicFileId: id!,
        clueId,
      });
      message.success('解绑线索成功');
      loadFileData();
    } catch (error) {
      message.error('解绑线索失败');
    }
  };

  const handleVerifyHash = async () => {
    setVerifying(true);
    try {
      const res = await forensicApi.verifyHashes([id!]);
      setVerifyModal(true);
      message.success('哈希校验完成');
      loadFileData();
    } catch (error) {
      message.error('哈希校验失败');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await forensicApi.download(id!);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileData.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (error) {
      message.error('下载失败');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await forensicApi.delete(id!);
      message.success('删除成功');
      navigate('/forensics');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label}已复制到剪贴板`);
  };

  if (!fileData) return null;

  const fileTypeInfo = fileTypeLabels[fileData.fileType] || fileTypeLabels.OTHER;
  const integrityInfo = integrityStatusLabels[fileData.integrityStatus] || integrityStatusLabels.PENDING;

  const verificationColumns: ColumnsType<any> = [
    {
      title: '校验时间',
      dataIndex: 'verifiedAt',
      key: 'verifiedAt',
      width: 180,
      render: (v: string) => v ? moment(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '校验结果',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const info = integrityStatusLabels[status] || integrityStatusLabels.PENDING;
        return <Tag color={info.color} icon={info.icon}>{info.label}</Tag>;
      },
    },
    {
      title: 'MD5匹配',
      dataIndex: 'md5Matched',
      key: 'md5Matched',
      width: 100,
      render: (v: boolean) => v === null ? '-' : (v ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag>),
    },
    {
      title: 'SHA1匹配',
      dataIndex: 'sha1Matched',
      key: 'sha1Matched',
      width: 100,
      render: (v: boolean) => v === null ? '-' : (v ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag>),
    },
    {
      title: 'SHA256匹配',
      dataIndex: 'sha256Matched',
      key: 'sha256Matched',
      width: 110,
      render: (v: boolean) => v === null ? '-' : (v ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag>),
    },
    {
      title: '校验人',
      dataIndex: 'verifierName',
      key: 'verifierName',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => v || '-',
    },
  ];

  const operationLogColumns: ColumnsType<any> = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => moment(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 120,
      render: (t: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          CREATE: { label: '创建', color: 'blue' },
          UPDATE: { label: '更新', color: 'orange' },
          DELETE: { label: '删除', color: 'red' },
          VERIFY: { label: '校验', color: 'green' },
          DOWNLOAD: { label: '下载', color: 'purple' },
          BIND_CASE: { label: '绑定案件', color: 'cyan' },
          UNBIND_CASE: { label: '解绑案件', color: 'geekblue' },
          BIND_CLUE: { label: '绑定线索', color: 'magenta' },
          UNBIND_CLUE: { label: '解绑线索', color: 'volcano' },
        };
        const info = typeMap[t] || { label: t, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '操作详情',
      dataIndex: 'details',
      key: 'details',
      render: (v: string) => v || '-',
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: '基本信息',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title={<Space><FileTextOutlined />文件元数据</Space>}>
            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="取证编号">{fileData.forensicNumber}</Descriptions.Item>
              <Descriptions.Item label="文件类型">
                <Tag color={fileTypeInfo.color}>{fileTypeInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="文件名" span={2}>{fileData.fileName}</Descriptions.Item>
              <Descriptions.Item label="原始路径" span={2}>{fileData.originalPath || '-'}</Descriptions.Item>
              <Descriptions.Item label="扩展名">{fileData.fileExtension || '-'}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatFileSize(fileData.fileSize)}</Descriptions.Item>
              <Descriptions.Item label="MIME类型">{fileData.mimeType || '-'}</Descriptions.Item>
              <Descriptions.Item label="存储路径">{fileData.storagePath || '-'}</Descriptions.Item>
              <Descriptions.Item label="文件创建时间">
                {fileData.fileCreatedTime ? moment(fileData.fileCreatedTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="文件修改时间">
                {fileData.fileModifiedTime ? moment(fileData.fileModifiedTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="文件访问时间">
                {fileData.fileAccessedTime ? moment(fileData.fileAccessedTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                {fileData.tags ? fileData.tags.split(',').map((t: string, i: number) => (
                  <Tag key={i} color="blue">{t.trim()}</Tag>
                )) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title={<Space><SafetyCertificateOutlined />哈希值校验</Space>}>
            {fileData.integrityStatus === 'CORRUPTED' && (
              <Alert
                message="数据完整性警告"
                description="该文件的哈希校验未通过，文件内容可能已被篡改或损坏！"
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Statistic
                    title={
                      <Space>
                        MD5
                        <Tooltip title="复制MD5值">
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(fileData.md5Hash, 'MD5')}
                          />
                        </Tooltip>
                      </Space>
                    }
                    value={fileData.md5Hash || '-'}
                    valueStyle={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Statistic
                    title={
                      <Space>
                        SHA1
                        <Tooltip title="复制SHA1值">
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(fileData.sha1Hash, 'SHA1')}
                          />
                        </Tooltip>
                      </Space>
                    }
                    value={fileData.sha1Hash || '-'}
                    valueStyle={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Statistic
                    title={
                      <Space>
                        SHA256
                        <Tooltip title="复制SHA256值">
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(fileData.sha256Hash, 'SHA256')}
                          />
                        </Tooltip>
                      </Space>
                    }
                    value={fileData.sha256Hash || '-'}
                    valueStyle={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}
                  />
                </Card>
              </Col>
            </Row>
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={16}>
              <Col span={6}>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="完整性状态">
                    <Tag color={integrityInfo.color} icon={integrityInfo.icon}>
                      {integrityInfo.label}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={6}>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="校验次数">{fileData.verificationCount} 次</Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={6}>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="最近校验">
                    {fileData.lastVerificationTime
                      ? moment(fileData.lastVerificationTime).format('YYYY-MM-DD HH:mm')
                      : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={6} style={{ textAlign: 'right' }}>
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  onClick={handleVerifyHash}
                  loading={verifying}
                >
                  立即校验哈希
                </Button>
              </Col>
            </Row>
          </Card>

          <Card size="small" title={<Space><FileSearchOutlined />采集信息</Space>}>
            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="采集方式">
                {acquisitionMethodLabels[fileData.acquisitionMethod] || fileData.acquisitionMethod || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="采集人">{fileData.acquirer || '-'}</Descriptions.Item>
              <Descriptions.Item label="采集时间">
                {fileData.acquisitionTime ? moment(fileData.acquisitionTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="采集地点">{fileData.acquisitionLocation || '-'}</Descriptions.Item>
              <Descriptions.Item label="来源设备">{fileData.sourceDevice || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联批次">
                {fileData.batch ? (
                  <span>{fileData.batch.batchNumber} - {fileData.batch.name}</span>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {(fileData.description || fileData.analysisNotes) && (
            <Card size="small" title={<Space><FileTextOutlined />描述与备注</Space>}>
              <Descriptions bordered column={1} size="middle">
                {fileData.description && (
                  <Descriptions.Item label="文件描述">
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{fileData.description}</div>
                  </Descriptions.Item>
                )}
                {fileData.analysisNotes && (
                  <Descriptions.Item label="分析备注">
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{fileData.analysisNotes}</div>
                  </Descriptions.Item>
                )}
              </Descriptions>
              {fileData.metadata && (
                <>
                  <Divider style={{ margin: '16px 0' }} />
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>元数据（JSON）：</div>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 200,
                    fontSize: 12,
                  }}>
                    {JSON.stringify(JSON.parse(fileData.metadata), null, 2)}
                  </pre>
                </>
              )}
            </Card>
          )}
        </Space>
      ),
    },
    {
      key: 'cases',
      label: `关联案件 (${fileData.caseRelations?.length || 0})`,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              bindCaseForm.resetFields();
              setBindCaseModal(true);
            }}>
              绑定案件
            </Button>
          </div>
          {fileData.caseRelations?.length > 0 ? (
            <List
              dataSource={fileData.caseRelations}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => navigate(`/cases/${item.caseId}`)}>
                      查看案件
                    </Button>,
                    <Popconfirm title="确定解绑该案件？" onConfirm={() => handleUnbindCase(item.caseId)}>
                      <Button type="link" size="small" danger icon={<DisconnectOutlined />}>
                        解绑
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<FileTextOutlined />}
                        style={{ backgroundColor: '#1677ff' }}
                      />
                    }
                    title={
                      <Space>
                        <a onClick={() => navigate(`/cases/${item.caseId}`)}>
                          {item.case.caseNumber} - {item.case.title}
                        </a>
                        {item.relationType && <Tag color="blue">{item.relationType}</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        {item.description && (
                          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                            关联说明：{item.description}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#999' }}>
                          绑定时间：{moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty
              description={
                <Space direction="vertical">
                  <span>尚未绑定任何案件</span>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setBindCaseModal(true)}>
                    立即绑定案件
                  </Button>
                </Space>
              }
            />
          )}
        </div>
      ),
    },
    {
      key: 'clues',
      label: `关联线索 (${fileData.clueRelations?.length || 0})`,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              bindClueForm.resetFields();
              setSelectedCaseId('');
              setCaseClues([]);
              setBindClueModal(true);
            }}>
              绑定线索
            </Button>
          </div>
          {fileData.clueRelations?.length > 0 ? (
            <List
              dataSource={fileData.clueRelations}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => navigate(`/clues/${item.clueId}`)}>
                      查看线索
                    </Button>,
                    <Popconfirm title="确定解绑该线索？" onConfirm={() => handleUnbindClue(item.clueId)}>
                      <Button type="link" size="small" danger icon={<DisconnectOutlined />}>
                        解绑
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<SearchOutlined />}
                        style={{ backgroundColor: '#52c41a' }}
                      />
                    }
                    title={
                      <Space>
                        <a onClick={() => navigate(`/clues/${item.clueId}`)}>
                          {item.clue.clueNumber} - {item.clue.title}
                        </a>
                        {item.relationType && <Tag color="green">{item.relationType}</Tag>}
                        {item.clue.case && (
                          <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${item.clue.caseId}`)}>
                            案件：{item.clue.case.caseNumber}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        {item.description && (
                          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                            关联说明：{item.description}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#999' }}>
                          绑定时间：{moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty
              description={
                <Space direction="vertical">
                  <span>尚未绑定任何线索</span>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setBindClueModal(true)}>
                    立即绑定线索
                  </Button>
                </Space>
              }
            />
          )}
        </div>
      ),
    },
    {
      key: 'verifications',
      label: `校验记录 (${fileData.hashVerifications?.length || 0})`,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              onClick={handleVerifyHash}
              loading={verifying}
            >
              执行哈希校验
            </Button>
          </div>
          <Table
            columns={verificationColumns}
            dataSource={fileData.hashVerifications || []}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </div>
      ),
    },
    {
      key: 'logs',
      label: `操作日志 (${fileData.operationLogs?.length || 0})`,
      children: (
        <Table
          columns={operationLogColumns}
          dataSource={fileData.operationLogs || []}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
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
              {fileData.fileName}
              <Tag color={fileTypeInfo.color}>{fileTypeInfo.label}</Tag>
              <Tag color={integrityInfo.color} icon={integrityInfo.icon}>
                {integrityInfo.label}
              </Tag>
            </Space>
          </h2>
        </Space>
        <Space>
          <Tooltip title="下载文件">
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              loading={downloading}
            >
              下载
            </Button>
          </Tooltip>
          <Tooltip title="校验哈希">
            <Button
              icon={<SafetyCertificateOutlined />}
              onClick={handleVerifyHash}
              loading={verifying}
            >
              哈希校验
            </Button>
          </Tooltip>
          <Popconfirm title="确定删除该取证文件？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="绑定案件"
        open={bindCaseModal}
        onCancel={() => setBindCaseModal(false)}
        footer={null}
        width={520}
      >
        <Form form={bindCaseForm} layout="vertical" onFinish={handleBindCase}>
          <Form.Item
            name="caseId"
            label="选择案件"
            rules={[{ required: true, message: '请选择要绑定的案件' }]}
          >
            <Select
              placeholder="请选择案件"
              showSearch
              optionFilterProp="label"
              loading={casesLoading}
              options={allCases
                .filter((c: any) => !fileData.caseRelations?.find((r: any) => r.caseId === c.id))
                .map((c: any) => ({
                  label: `${c.caseNumber} - ${c.title}`,
                  value: c.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="relationType" label="关联类型">
            <Select
              placeholder="选择关联类型（可选）"
              allowClear
              options={[
                { label: '案件相关文件', value: '案件相关文件' },
                { label: '证据材料', value: '证据材料' },
                { label: '参考资料', value: '参考资料' },
                { label: '嫌疑人相关', value: '嫌疑人相关' },
                { label: '作案工具相关', value: '作案工具相关' },
                { label: '其他', value: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="关联说明">
            <Input.TextArea
              rows={3}
              placeholder="说明该文件与案件的关联关系..."
              showCount
              maxLength={500}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认绑定</Button>
              <Button onClick={() => setBindCaseModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="绑定线索"
        open={bindClueModal}
        onCancel={() => setBindClueModal(false)}
        footer={null}
        width={520}
      >
        <Form form={bindClueForm} layout="vertical" onFinish={handleBindClue}>
          <Form.Item
            name="caseId"
            label="选择关联案件"
            extra="先选择案件以筛选该案件下的线索"
          >
            <Select
              placeholder="请选择案件（可选）"
              showSearch
              optionFilterProp="label"
              loading={casesLoading}
              allowClear
              value={selectedCaseId}
              onChange={(value) => {
                setSelectedCaseId(value || '');
                bindClueForm.setFieldsValue({ clueId: undefined });
                loadCaseClues(value || '');
              }}
              options={allCases.map((c: any) => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="clueId"
            label="选择线索"
            rules={[{ required: true, message: '请选择要绑定的线索' }]}
          >
            <Select
              placeholder={selectedCaseId ? '请选择线索' : '请先选择案件以加载线索列表'}
              showSearch
              optionFilterProp="label"
              loading={cluesLoading}
              disabled={!selectedCaseId}
              options={caseClues
                .filter((cl: any) => !fileData.clueRelations?.find((r: any) => r.clueId === cl.id))
                .map((cl: any) => ({
                  label: `${cl.clueNumber} - ${cl.title}`,
                  value: cl.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="relationType" label="关联类型">
            <Select
              placeholder="选择关联类型（可选）"
              allowClear
              options={[
                { label: '线索来源文件', value: '线索来源文件' },
                { label: '线索佐证材料', value: '线索佐证材料' },
                { label: '线索分析材料', value: '线索分析材料' },
                { label: '证据材料', value: '证据材料' },
                { label: '其他', value: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="关联说明">
            <Input.TextArea
              rows={3}
              placeholder="说明该文件与线索的关联关系..."
              showCount
              maxLength={500}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认绑定</Button>
              <Button onClick={() => setBindClueModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="哈希校验结果"
        open={verifyModal}
        onOk={() => setVerifyModal(false)}
        onCancel={() => setVerifyModal(false)}
        okText="确定"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          message="校验完成"
          description={`文件完整性校验已完成，状态：${integrityInfo.label}`}
          type={fileData.integrityStatus === 'VERIFIED' ? 'success' : fileData.integrityStatus === 'CORRUPTED' ? 'error' : 'warning'}
          showIcon
        />
      </Modal>
    </div>
  );
}
