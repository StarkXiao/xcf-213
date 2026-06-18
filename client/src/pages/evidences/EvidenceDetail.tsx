import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Descriptions, Tag, Button, Space, message, Popconfirm, Image, Row, Col, Typography,
  Modal, Form, Input, DatePicker, Select, Table, Tabs
} from 'antd';
import { 
  ArrowLeftOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined, 
  VideoCameraOutlined, AudioOutlined, FileUnknownOutlined, BookOutlined, RollbackOutlined,
  HistoryOutlined, FileSearchOutlined
} from '@ant-design/icons';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { evidenceApi } from '../../services/api';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

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

const borrowStatusColors: Record<string, string> = {
  '未借阅': 'green',
  '借阅中': 'orange',
  '已归还': 'blue',
};

export default function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [borrowModalVisible, setBorrowModalVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [borrowForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [borrowRecords, setBorrowRecords] = useState<any[]>([]);
  const [operationLogs, setOperationLogs] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (id) {
      loadEvidence();
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'borrow') {
      loadBorrowRecords();
    }
    if (id && activeTab === 'logs') {
      loadOperationLogs();
    }
  }, [id, activeTab]);

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

  const loadBorrowRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await evidenceApi.getBorrowRecords(id!, { page: 1, pageSize: 50 });
      setBorrowRecords(res.data.items);
    } catch (error) {
      message.error('加载借阅记录失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadOperationLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await evidenceApi.getOperationLogs(id!, { page: 1, pageSize: 50 });
      setOperationLogs(res.data.items);
    } catch (error) {
      message.error('加载操作日志失败');
    } finally {
      setLogsLoading(false);
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

  const handleBorrow = async (values: any) => {
    try {
      const data = {
        ...values,
        expectedReturnTime: values.expectedReturnTime ? values.expectedReturnTime.toISOString() : undefined,
      };
      await evidenceApi.borrow(id!, data);
      message.success('借阅登记成功');
      setBorrowModalVisible(false);
      borrowForm.resetFields();
      loadEvidence();
      if (activeTab === 'borrow') {
        loadBorrowRecords();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '借阅登记失败');
    }
  };

  const handleReturn = async (values: any) => {
    try {
      await evidenceApi.returnEvidence(id!, values);
      message.success('归还确认成功');
      setReturnModalVisible(false);
      returnForm.resetFields();
      loadEvidence();
      if (activeTab === 'borrow') {
        loadBorrowRecords();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '归还确认失败');
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

  const borrowRecordColumns: ColumnsType<any> = [
    {
      title: '借阅人',
      dataIndex: 'borrower',
      key: 'borrower',
      width: 100,
    },
    {
      title: '所属部门',
      dataIndex: 'borrowerDepartment',
      key: 'borrowerDepartment',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '借阅原因',
      dataIndex: 'borrowReason',
      key: 'borrowReason',
      ellipsis: true,
    },
    {
      title: '借阅时间',
      dataIndex: 'borrowTime',
      key: 'borrowTime',
      width: 160,
      render: (text) => text ? moment(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '预计归还',
      dataIndex: 'expectedReturnTime',
      key: 'expectedReturnTime',
      width: 160,
      render: (text) => text ? moment(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '实际归还',
      dataIndex: 'actualReturnTime',
      key: 'actualReturnTime',
      width: 160,
      render: (text) => text ? moment(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (text) => (
        <Tag color={text === '借阅中' ? 'orange' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '经办人',
      dataIndex: 'operator',
      key: 'operator',
      width: 80,
      render: (text, record) => record.returnOperator || text || '-',
    },
  ];

  const operationLogColumns: ColumnsType<any> = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (text) => {
        const actionMap: Record<string, string> = {
          'borrow': '借阅',
          'return': '归还',
          'create': '创建',
          'update': '更新',
          'delete': '删除',
        };
        return <Tag>{actionMap[text] || text}</Tag>;
      },
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
      render: (text) => text || '-',
    },
  ];

  if (!evidence) return null;

  const fileUrl = `${import.meta.env.VITE_API_URL}${evidence.fileUrl}`;
  const isBorrowed = evidence.borrowStatus === '借阅中';

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      icon: <EyeOutlined />,
    },
    {
      key: 'borrow',
      label: '借阅记录',
      icon: <HistoryOutlined />,
    },
    {
      key: 'logs',
      label: '操作日志',
      icon: <FileSearchOutlined />,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/evidences')}>返回</Button>
          <h2 className="page-title">{evidence.name}</h2>
          <Tag color={evidenceTypeColors[evidence.evidenceType]}>{evidence.evidenceType}</Tag>
          <Tag color={borrowStatusColors[evidence.borrowStatus || '未借阅']}>
            {evidence.borrowStatus || '未借阅'}
          </Tag>
        </Space>
        <Space>
          {!isBorrowed ? (
            <Button 
              type="primary" 
              icon={<BookOutlined />} 
              onClick={() => setBorrowModalVisible(true)}
            >
              借阅登记
            </Button>
          ) : (
            <Button 
              type="primary" 
              icon={<RollbackOutlined />} 
              onClick={() => setReturnModalVisible(true)}
            >
              归还确认
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={() => window.open(fileUrl, '_blank')}>
            下载
          </Button>
          <Popconfirm title="确定删除该证据？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabItems}
        />

        {activeTab === 'info' && (
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} lg={16}>
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
            </Col>

            <Col xs={24} lg={8}>
              <Card title="基本信息" size="small">
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
                  <Descriptions.Item label="借阅状态">
                    <Tag color={borrowStatusColors[evidence.borrowStatus || '未借阅']}>
                      {evidence.borrowStatus || '未借阅'}
                    </Tag>
                  </Descriptions.Item>
                  {isBorrowed && (
                    <>
                      <Descriptions.Item label="当前借阅人">{evidence.currentBorrower}</Descriptions.Item>
                      <Descriptions.Item label="借阅时间">
                        {evidence.borrowTime ? moment(evidence.borrowTime).format('YYYY-MM-DD HH:mm') : '-'}
                      </Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              </Card>

              <Card title="关联信息" size="small" style={{ marginTop: 16 }}>
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
        )}

        {activeTab === 'borrow' && (
          <div style={{ marginTop: 16 }}>
            <Table
              columns={borrowRecordColumns}
              dataSource={borrowRecords}
              rowKey="id"
              loading={recordsLoading}
              pagination={false}
              scroll={{ x: 800 }}
            />
          </div>
        )}

        {activeTab === 'logs' && (
          <div style={{ marginTop: 16 }}>
            <Table
              columns={operationLogColumns}
              dataSource={operationLogs}
              rowKey="id"
              loading={logsLoading}
              pagination={false}
              scroll={{ x: 800 }}
            />
          </div>
        )}
      </Card>

      <Modal
        title="证据借阅登记"
        open={borrowModalVisible}
        onCancel={() => setBorrowModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={borrowForm} layout="vertical" onFinish={handleBorrow}>
          <Form.Item
            name="borrower"
            label="借阅人"
            rules={[{ required: true, message: '请输入借阅人姓名' }]}
          >
            <Input placeholder="请输入借阅人姓名" />
          </Form.Item>
          <Form.Item
            name="borrowerDepartment"
            label="所属部门"
          >
            <Input placeholder="请输入所属部门" />
          </Form.Item>
          <Form.Item
            name="borrowReason"
            label="借阅原因"
            rules={[{ required: true, message: '请输入借阅原因' }]}
          >
            <TextArea rows={3} placeholder="请输入借阅原因" />
          </Form.Item>
          <Form.Item
            name="expectedReturnTime"
            label="预计归还时间"
          >
            <DatePicker 
              showTime 
              style={{ width: '100%' }} 
              placeholder="请选择预计归还时间"
            />
          </Form.Item>
          <Form.Item
            name="operator"
            label="经办人"
          >
            <Input placeholder="请输入经办人姓名" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setBorrowModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认借阅</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="证据归还确认"
        open={returnModalVisible}
        onCancel={() => setReturnModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={returnForm} layout="vertical" onFinish={handleReturn}>
          <Form.Item
            name="returnNote"
            label="归还备注"
          >
            <TextArea rows={3} placeholder="请输入归还备注（可选）" />
          </Form.Item>
          <Form.Item
            name="returnOperator"
            label="归还经办人"
          >
            <Input placeholder="请输入归还经办人姓名" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setReturnModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认归还</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
