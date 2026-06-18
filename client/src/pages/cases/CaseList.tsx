import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Input, Select, DatePicker, Tag, Popconfirm, Modal, Form, message, Card, Row, Col, Badge, Tooltip, List, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ReloadOutlined, WarningOutlined, ExclamationCircleOutlined, ClockCircleOutlined, FileProtectOutlined, BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { caseApi, searchApi } from '../../services/api';

interface WarningDetail {
  id?: string;
  title?: string;
  clueNumber?: string;
  status?: string;
  lastUpdate?: string;
  daysOverdue?: number;
  days?: number;
  credibility?: string;
  importance?: string;
  subType?: string;
  label?: string;
  description?: string;
  clueId?: string;
  clueTitle?: string;
  borrowId?: string;
  evidenceId?: string;
  borrower?: string;
}

interface WarningItem {
  type: 'overdueClue' | 'missingEvidence' | 'pendingTask';
  label: string;
  level: 'danger' | 'warning';
  count: number;
  detail: WarningDetail[];
}

interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  caseType: string;
  status: string;
  priority: string;
  location: string;
  occurTime: string;
  createdAt: string;
  warnings: WarningItem[];
  warningCount: number;
  hasWarning: boolean;
  _count: {
    clues: number;
    evidences: number;
    casePersons: number;
  };
}

const statusColors: Record<string, string> = {
  '待立案': 'default',
  '侦查中': 'processing',
  '已移送起诉': 'warning',
  '已判决': 'success',
  '已结案': 'success',
  '已撤销': 'error',
};

const priorityColors: Record<string, string> = {
  '特急': 'red',
  '紧急': 'orange',
  '重要': 'blue',
  '一般': 'green',
};

const warningTypeIcons: Record<string, any> = {
  overdueClue: <ClockCircleOutlined />,
  missingEvidence: <FileProtectOutlined />,
  pendingTask: <BellOutlined />,
};

const warningLevelColors: Record<string, string> = {
  danger: 'red',
  warning: 'orange',
};

export default function CaseList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [options, setOptions] = useState<any>({});
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [warningFilter, setWarningFilter] = useState<string | null>(null);

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
      const res = await caseApi.list(params);
      setData(res.data.items);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const warningStats = useMemo(() => {
    const stats = {
      totalWarningCases: 0,
      overdueClueCount: 0,
      missingEvidenceCount: 0,
      pendingTaskCount: 0,
      dangerCount: 0,
      warningCount: 0,
    };
    data.forEach(item => {
      if (item.hasWarning) {
        stats.totalWarningCases++;
      }
      item.warnings.forEach(w => {
        if (w.type === 'overdueClue') stats.overdueClueCount += w.count;
        if (w.type === 'missingEvidence') stats.missingEvidenceCount += w.count;
        if (w.type === 'pendingTask') stats.pendingTaskCount += w.count;
        if (w.level === 'danger') stats.dangerCount += w.count;
        if (w.level === 'warning') stats.warningCount += w.count;
      });
    });
    return stats;
  }, [data]);

  const filteredData = useMemo(() => {
    if (!warningFilter) return data;
    if (warningFilter === 'all') return data.filter(d => d.hasWarning);
    return data.filter(d => d.warnings.some(w => w.type === warningFilter));
  }, [data, warningFilter]);

  const handleSearch = (values: any) => {
    const filters: any = {};
    if (values.keyword) filters.keyword = values.keyword;
    if (values.caseType) filters.caseType = values.caseType;
    if (values.status) filters.status = values.status;
    if (values.priority) filters.priority = values.priority;
    if (values.dateRange) {
      filters.startDate = values.dateRange[0]?.format('YYYY-MM-DD');
      filters.endDate = values.dateRange[1]?.format('YYYY-MM-DD');
    }
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData(filters);
  };

  const handleReset = () => {
    form.resetFields();
    setWarningFilter(null);
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData();
  };

  const handleDelete = async (id: string) => {
    try {
      await caseApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const openWarningDetail = (record: CaseItem) => {
    setSelectedCase(record);
    setWarningModalVisible(true);
  };

  const renderWarningBadges = (record: CaseItem) => {
    if (!record.hasWarning) {
      return <span style={{ color: '#999' }}>—</span>;
    }
    return (
      <Space size={4} wrap>
        {record.warnings.map((w, idx) => (
          <Tooltip
            key={idx}
            title={`${w.label}: ${w.count}项`}
          >
            <Badge
              count={w.count}
              style={{
                backgroundColor: w.level === 'danger' ? '#ff4d4f' : '#fa8c16',
                cursor: 'pointer',
              }}
              showZero
              offset={[2, 0]}
            >
              <Tag
                icon={warningTypeIcons[w.type]}
                color={warningLevelColors[w.level]}
                style={{ margin: 0, cursor: 'pointer' }}
                onClick={() => openWarningDetail(record)}
              >
                {w.label}
              </Tag>
            </Badge>
          </Tooltip>
        ))}
      </Space>
    );
  };

  const renderWarningDetail = () => {
    if (!selectedCase) return null;

    return (
      <div>
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
          <div><strong>案件编号：</strong>{selectedCase.caseNumber}</div>
          <div><strong>案件标题：</strong>{selectedCase.title}</div>
        </div>

        {selectedCase.warnings.map((w, idx) => (
          <div key={idx} style={{ marginBottom: idx < selectedCase.warnings.length - 1 ? 16 : 0 }}>
            <Divider orientation="left" style={{ margin: '8px 0' }}>
              <Tag color={warningLevelColors[w.level]} icon={warningTypeIcons[w.type]}>
                {w.label}（{w.count}项）
              </Tag>
            </Divider>

            {w.type === 'overdueClue' && (
              <List
                size="small"
                dataSource={w.detail}
                renderItem={(item: WarningDetail) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<WarningOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />}
                      title={
                        <Space>
                          <a onClick={() => navigate(`/clues/${item.id}`)}>{item.clueNumber}</a>
                          <span style={{ color: '#666' }}>{item.title}</span>
                        </Space>
                      }
                      description={
                        <Space size="middle">
                          <Tag color="default">状态：{item.status}</Tag>
                          <span style={{ color: '#ff4d4f' }}>
                            超期 {item.daysOverdue} 天未更新
                          </span>
                          <span style={{ color: '#999', fontSize: 12 }}>
                            最后更新：{moment(item.lastUpdate).format('YYYY-MM-DD HH:mm')}
                          </span>
                        </Space>
                      }
                    />
                    <Button type="link" size="small" onClick={() => navigate(`/clues/${item.id}`)}>
                      去处理
                    </Button>
                  </List.Item>
                )}
              />
            )}

            {w.type === 'missingEvidence' && (
              <List
                size="small"
                dataSource={w.detail}
                renderItem={(item: WarningDetail) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<FileProtectOutlined style={{ color: '#fa8c16', fontSize: 20 }} />}
                      title={
                        <Space>
                          <a onClick={() => navigate(`/clues/${item.id}`)}>{item.clueNumber}</a>
                          <span style={{ color: '#666' }}>{item.title}</span>
                        </Space>
                      }
                      description={
                        <Space size="middle">
                          <Tag color="default">状态：{item.status}</Tag>
                          <Tag color={item.importance === '关键' ? 'red' : item.importance === '重要' ? 'orange' : 'blue'}>
                            重要性：{item.importance}
                          </Tag>
                          <span style={{ color: '#fa8c16' }}>未回填证据</span>
                        </Space>
                      }
                    />
                    <Button type="link" size="small" onClick={() => navigate(`/clues/${item.id}`)}>
                      上传证据
                    </Button>
                  </List.Item>
                )}
              />
            )}

            {w.type === 'pendingTask' && (
              <List
                size="small"
                dataSource={w.detail}
                renderItem={(item: WarningDetail) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        item.days! >= 5
                          ? <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                          : <BellOutlined style={{ color: '#fa8c16', fontSize: 20 }} />
                      }
                      title={<Tag color={item.days! >= 5 ? 'red' : 'orange'}>{item.label}</Tag>}
                      description={
                        <Space direction="vertical" size={4}>
                          <span>{item.description}</span>
                          {item.clueId && (
                            <span style={{ color: '#999', fontSize: 12 }}>
                              线索：<a onClick={() => navigate(`/clues/${item.clueId}`)}>{item.clueNumber} - {item.clueTitle}</a>
                            </span>
                          )}
                        </Space>
                      }
                    />
                    <Space>
                      {item.subType === 'casePendingFiling' && (
                        <Button type="link" size="small" onClick={() => navigate(`/cases/${selectedCase.id}/edit`)}>
                          立案处理
                        </Button>
                      )}
                      {item.subType === 'cluePendingVerify' && item.clueId && (
                        <Button type="link" size="small" onClick={() => navigate(`/clues/${item.clueId}`)}>
                          核实线索
                        </Button>
                      )}
                      {(item.subType === 'evidenceOverdueReturn' || item.subType === 'evidenceLongBorrow') && (
                        <Button type="link" size="small" onClick={() => navigate('/evidences')}>
                          查看证据
                        </Button>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const columns: ColumnsType<CaseItem> = [
    {
      title: '案件编号',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      width: 140,
      fixed: 'left',
      render: (text, record) => (
        <Space>
          <span style={{ color: '#1677ff', fontFamily: 'monospace' }}>{text}</span>
          {record.hasWarning && (
            <Tooltip title={`存在 ${record.warningCount} 项预警`}>
              <Badge
                count={record.warningCount}
                style={{
                  backgroundColor: record.warnings.some(w => w.level === 'danger') ? '#ff4d4f' : '#fa8c16',
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '案件标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/cases/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '案件类型',
      dataIndex: 'caseType',
      key: 'caseType',
      width: 100,
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (text) => <Tag color={priorityColors[text]}>{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => <Tag color={statusColors[text]}>{text}</Tag>,
    },
    {
      title: '临期预警',
      key: 'warnings',
      width: 300,
      render: (_, record) => renderWarningBadges(record),
      onCell: (record) => ({
        onClick: record.hasWarning ? () => openWarningDetail(record) : undefined,
        style: record.hasWarning ? { cursor: 'pointer' } : {},
      }),
    },
    {
      title: '关联信息',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tag color="blue">线索 {record._count.clues}</Tag>
          <Tag color="green">人员 {record._count.casePersons}</Tag>
          <Tag color="orange">证据 {record._count.evidences}</Tag>
        </Space>
      ),
    },
    {
      title: '案发地点',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
      width: 150,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/cases/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/cases/${record.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该案件？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statCards = [
    {
      title: '预警案件数',
      value: warningStats.totalWarningCases,
      icon: <WarningOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      filterKey: 'all',
      show: warningStats.totalWarningCases > 0,
    },
    {
      title: '超期未更新线索',
      value: warningStats.overdueClueCount,
      icon: <ClockCircleOutlined />,
      color: '#ff4d4f',
      bgColor: '#fff1f0',
      filterKey: 'overdueClue',
      show: warningStats.overdueClueCount > 0,
    },
    {
      title: '未回填证据',
      value: warningStats.missingEvidenceCount,
      icon: <FileProtectOutlined />,
      color: '#fa8c16',
      bgColor: '#fff7e6',
      filterKey: 'missingEvidence',
      show: warningStats.missingEvidenceCount > 0,
    },
    {
      title: '待办任务',
      value: warningStats.pendingTaskCount,
      icon: <BellOutlined />,
      color: '#1677ff',
      bgColor: '#e6f4ff',
      filterKey: 'pendingTask',
      show: warningStats.pendingTaskCount > 0,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">案件台账</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/cases/new')}>
          新增案件
        </Button>
      </div>

      {warningStats.totalWarningCases > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {statCards.filter(c => c.show).map((card, index) => (
            <Col xs={24} sm={12} md={6} key={index}>
              <div
                onClick={() => setWarningFilter(card.filterKey === warningFilter ? null : card.filterKey)}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: card.bgColor,
                  border: warningFilter === card.filterKey ? `2px solid ${card.color}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>{card.title}</div>
                  <div style={{ color: card.color, fontSize: 28, fontWeight: 'bold' }}>{card.value}</div>
                </div>
                <div style={{ fontSize: 36, color: card.color, opacity: 0.8 }}>{card.icon}</div>
              </div>
            </Col>
          ))}
          {warningFilter && (
            <Col xs={24} style={{ marginTop: -8 }}>
              <Tag
                color="blue"
                closable
                onClose={() => setWarningFilter(null)}
                style={{ padding: '4px 12px' }}
              >
                当前仅显示存在预警的案件，点击清除筛选
              </Tag>
            </Col>
          )}
        </Row>
      )}

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="案件编号/标题/描述" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="caseType" label="类型">
                <Select placeholder="选择类型" allowClear options={options.caseTypes?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="status" label="状态">
                <Select placeholder="选择状态" allowClear options={options.caseStatuses?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="priority" label="优先级">
                <Select placeholder="选择优先级" allowClear options={options.priorities?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="dateRange" label="创建时间">
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={4}>
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
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录${warningFilter ? `（已筛选出 ${filteredData.length} 条预警案件）` : ''}`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
          }}
          scroll={{ x: 1500 }}
          rowClassName={(record) => record.hasWarning ? 'warning-row' : ''}
        />
      </Card>

      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            <span>临期预警详情 - {selectedCase?.caseNumber}</span>
          </Space>
        }
        open={warningModalVisible}
        onCancel={() => setWarningModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setWarningModalVisible(false)}>
            关闭
          </Button>,
          <Button key="detail" type="primary" onClick={() => {
            setWarningModalVisible(false);
            navigate(`/cases/${selectedCase?.id}`);
          }}>
            查看案件详情
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        {renderWarningDetail()}
      </Modal>

      <style>{`
        .warning-row {
          background: linear-gradient(90deg, #fff7e6 0%, transparent 30%);
        }
        .warning-row:hover > td {
          background: #fffbe6 !important;
        }
      `}</style>
    </div>
  );
}
