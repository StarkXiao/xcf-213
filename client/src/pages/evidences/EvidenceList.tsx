import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, Form, message, Card, Row, Col, Image, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, SearchOutlined, ReloadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { evidenceApi, searchApi } from '../../services/api';

interface EvidenceItem {
  id: string;
  evidenceNumber: string;
  name: string;
  evidenceType: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  description: string;
  collectionMethod: string;
  collector: string;
  collectionTime: string;
  caseId: string;
  clueId: string;
  case: { title: string; caseNumber: string };
  clue: { title: string; clueNumber: string };
  createdAt: string;
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

export default function EvidenceList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [options, setOptions] = useState<any>({});

  useEffect(() => {
    loadOptions();
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadOptions = async () => {
    try {
      const res = await searchApi.options();
      setOptions(res.data);
    } catch (error) {
      console.error('Failed to load options:', error);
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
      const res = await evidenceApi.list(params);
      setData(res.data.items);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters: any = {};
    if (values.keyword) filters.keyword = values.keyword;
    if (values.evidenceType) filters.evidenceType = values.evidenceType;
    if (values.fileType) filters.fileType = values.fileType;
    if (values.caseId) filters.caseId = values.caseId;
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
      await evidenceApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileTypeIcon = (fileType: string) => {
    return fileTypeIcons[fileType] || fileTypeIcons['other'];
  };

  const isImage = (fileType: string, fileName: string) => {
    return fileType === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const columns: ColumnsType<EvidenceItem> = [
    {
      title: '预览',
      dataIndex: 'fileUrl',
      key: 'preview',
      width: 80,
      render: (text, record) => (
        isImage(record.fileType, record.name) ? (
          <Image
            width={50}
            height={50}
            src={`${import.meta.env.VITE_API_URL}${text}`}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div style={{
            width: 50, height: 50,
            background: '#f0f0f0',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}>
            {getFileTypeIcon(record.fileType)}
          </div>
        )
      ),
    },
    {
      title: '证据编号',
      dataIndex: 'evidenceNumber',
      key: 'evidenceNumber',
      width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{text}</span>,
    },
    {
      title: '证据名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text, record) => (
        <Tooltip title={text}>
          <a onClick={() => navigate(`/evidences/${record.id}`)} style={{ display: 'block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text}
          </a>
        </Tooltip>
      ),
    },
    {
      title: '证据类型',
      dataIndex: 'evidenceType',
      key: 'evidenceType',
      width: 100,
      render: (text) => <Tag color={evidenceTypeColors[text]}>{text}</Tag>,
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 80,
      render: (text) => (
        <Tag>
          {getFileTypeIcon(text)} {text}
        </Tag>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (text) => formatFileSize(text),
    },
    {
      title: '关联案件',
      dataIndex: 'caseId',
      key: 'caseId',
      width: 150,
      render: (_, record) => record.case ? (
        <Tooltip title={record.case.title}>
          <a onClick={() => navigate(`/cases/${record.caseId}`)} style={{ fontSize: 12 }}>
            {record.case.caseNumber}
          </a>
        </Tooltip>
      ) : '-',
    },
    {
      title: '关联线索',
      dataIndex: 'clueId',
      key: 'clueId',
      width: 150,
      render: (_, record) => record.clue ? (
        <Tooltip title={record.clue.title}>
          <a onClick={() => navigate(`/clues/${record.clueId}`)} style={{ fontSize: 12 }}>
            {record.clue.clueNumber}
          </a>
        </Tooltip>
      ) : '-',
    },
    {
      title: '收集方式',
      dataIndex: 'collectionMethod',
      key: 'collectionMethod',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '收集人',
      dataIndex: 'collector',
      key: 'collector',
      width: 80,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/evidences/${record.id}`)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => window.open(`${import.meta.env.VITE_API_URL}${record.fileUrl}`, '_blank')}
          >
            下载
          </Button>
          <Popconfirm title="确定删除该证据？" onConfirm={() => handleDelete(record.id)}>
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
        <h2 className="page-title">证据管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/evidences/upload')}>
          上传证据
        </Button>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="证据名称/编号" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="evidenceType" label="证据类型">
                <Select placeholder="选择类型" allowClear options={options.evidenceTypes?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="fileType" label="文件类型">
                <Select placeholder="选择文件类型" allowClear options={options.fileTypes?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={6}>
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
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
}
