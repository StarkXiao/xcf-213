import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, message, Popconfirm, Image, Row, Col, Typography } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined, VideoCameraOutlined, AudioOutlined, FileUnknownOutlined } from '@ant-design/icons';
import moment from 'moment';
import { evidenceApi } from '../../services/api';

const { Title, Paragraph } = Typography;

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

export default function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadEvidence();
    }
  }, [id]);

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const res = await evidenceApi.get(id!);
      setEvidence(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await evidenceApi.delete(id!);
      message.success('删除成功');
      navigate('/evidences');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const isImage = (fileType: string, fileName: string) => {
    return fileType === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const isVideo = (fileType: string) => fileType === 'video';
  const isAudio = (fileType: string) => fileType === 'audio';
  const isDocument = (fileType: string) => fileType === 'document';

  const getFileIcon = (fileType: string) => {
    if (isImage(fileType, evidence?.name || '')) return <EyeOutlined style={{ fontSize: 64, color: '#1677ff' }} />;
    if (isVideo(fileType)) return <VideoCameraOutlined style={{ fontSize: 64, color: '#722ed1' }} />;
    if (isAudio(fileType)) return <AudioOutlined style={{ fontSize: 64, color: '#52c41a' }} />;
    if (isDocument(fileType)) return <FileTextOutlined style={{ fontSize: 64, color: '#fa8c16' }} />;
    return <FileUnknownOutlined style={{ fontSize: 64, color: '#8c8c8c' }} />;
  };

  if (!evidence) return null;

  const fileUrl = `${import.meta.env.VITE_API_URL}${evidence.fileUrl}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/evidences')}>返回</Button>
          <h2 className="page-title">{evidence.name}</h2>
          <Tag color={evidenceTypeColors[evidence.evidenceType]}>{evidence.evidenceType}</Tag>
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => window.open(fileUrl, '_blank')}>
            下载
          </Button>
          <Popconfirm title="确定删除该证据？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card className="card-shadow" loading={loading}>
            <div style={{ textAlign: 'center', padding: 20, background: '#fafafa', borderRadius: 8, marginBottom: 20 }}>
              {isImage(evidence.fileType, evidence.name) ? (
                <Image
                  src={fileUrl}
                  alt={evidence.name}
                  style={{ maxHeight: 400, borderRadius: 8 }}
                />
              ) : isVideo(evidence.fileType) ? (
                <video
                  src={fileUrl}
                  controls
                  style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
                />
              ) : isAudio(evidence.fileType) ? (
                <div>
                  {getFileIcon(evidence.fileType)}
                  <div style={{ marginTop: 16 }}>
                    <audio src={fileUrl} controls style={{ width: '100%' }} />
                  </div>
                </div>
              ) : (
                <div>
                  {getFileIcon(evidence.fileType)}
                  <div style={{ marginTop: 16, color: '#666' }}>
                    该文件类型不支持在线预览，请下载查看
                  </div>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    style={{ marginTop: 12 }}
                    onClick={() => window.open(fileUrl, '_blank')}
                  >
                    下载文件
                  </Button>
                </div>
              )}
            </div>

            <Title level={4}>证据描述</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>
              {evidence.description || '暂无描述'}
            </Paragraph>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="card-shadow" loading={loading} title="基本信息">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="证据编号">
                <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{evidence.evidenceNumber}</span>
              </Descriptions.Item>
              <Descriptions.Item label="证据类型">
                <Tag color={evidenceTypeColors[evidence.evidenceType]}>{evidence.evidenceType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="文件类型">{evidence.fileType}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatFileSize(evidence.fileSize)}</Descriptions.Item>
              <Descriptions.Item label="原始文件名">{evidence.originalName}</Descriptions.Item>
              <Descriptions.Item label="收集方式">{evidence.collectionMethod || '-'}</Descriptions.Item>
              <Descriptions.Item label="收集人">{evidence.collector || '-'}</Descriptions.Item>
              <Descriptions.Item label="收集时间">
                {evidence.collectionTime ? moment(evidence.collectionTime).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">{moment(evidence.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card className="card-shadow" style={{ marginTop: 16 }} title="关联信息">
            <Space direction="vertical" style={{ width: '100%' }}>
              {evidence.case && (
                <div style={{ padding: 12, background: '#f0f5ff', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>关联案件</div>
                  <a onClick={() => navigate(`/cases/${evidence.caseId}`)} style={{ fontWeight: 'bold' }}>
                    {evidence.case.title}
                  </a>
                  <div style={{ fontSize: 12, color: '#999', fontFamily: 'monospace', marginTop: 2 }}>
                    {evidence.case.caseNumber}
                  </div>
                </div>
              )}
              {evidence.clue && (
                <div style={{ padding: 12, background: '#fff7e6', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>关联线索</div>
                  <a onClick={() => navigate(`/clues/${evidence.clueId}`)} style={{ fontWeight: 'bold' }}>
                    {evidence.clue.title}
                  </a>
                  <div style={{ fontSize: 12, color: '#999', fontFamily: 'monospace', marginTop: 2 }}>
                    {evidence.clue.clueNumber}
                  </div>
                </div>
              )}
              {!evidence.case && !evidence.clue && (
                <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
                  暂无关联信息
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
