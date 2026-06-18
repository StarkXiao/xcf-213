import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, Form, message, Card, Row, Col, Modal, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ReloadOutlined, AppstoreAddOutlined, RollbackOutlined, MergeOutlined, FileProtectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { clueApi, searchApi, caseApi } from '../../services/api';

interface ClueItem {
  id: string;
  clueNumber: string;
  title: string;
  content: string;
  clueType: string;
  source: string;
  credibility: string;
  importance: string;
  status: string;
  case: { id: string; caseNumber: string; title: string } | null;
  createdAt: string;
  _count: { evidences: number; cluePersons: number };
}

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

const statusColors: Record<string, string> = {
  '待核实': 'default',
  '核实中': 'processing',
  '已核实': 'success',
  '已采用': 'warning',
  '已排除': 'error',
};

const credibilityColors: Record<string, string> = {
  '极高': 'red',
  '高': 'orange',
  '中等': 'blue',
  '低': 'default',
  '极低': 'default',
};

const importanceColors: Record<string, string> = {
  '关键': 'red',
  '重要': 'orange',
  '一般': 'blue',
  '次要': 'default',
};

export default function ClueList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState<ClueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [options, setOptions] = useState<any>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<ClueItem[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);

  const [assignModal, setAssignModal] = useState(false);
  const [assignForm] = Form.useForm();

  const [returnModal, setReturnModal] = useState(false);
  const [returnForm] = Form.useForm();

  const [mergeModal, setMergeModal] = useState(false);
  const [mergeForm] = Form.useForm();

  const [toEvidenceModal, setToEvidenceModal] = useState(false);
  const [toEvidenceForm] = Form.useForm();

  useEffect(() => {
    loadOptions();
    loadData();
    loadCases();
  }, [pagination.current, pagination.pageSize]);

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
      const res = await caseApi.list({ page: 1, pageSize: 100 });
      setCases(res.data.items.map((c: any) => ({ id: c.id, caseNumber: c.caseNumber, title: c.title })));
    } catch (error) {
      console.error('Failed to load cases:', error);
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
      const res = await clueApi.list(params);
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
    if (values.clueType) filters.clueType = values.clueType;
    if (values.status) filters.status = values.status;
    if (values.credibility) filters.credibility = values.credibility;
    if (values.importance) filters.importance = values.importance;
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
      await clueApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: ClueItem[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  const handleBatchAssign = async (values: any) => {
    try {
      const res = await clueApi.batchAssign({
        clueIds: selectedRowKeys as string[],
        caseId: values.caseId,
        handler: values.handler,
        status: values.status,
      });
      message.success(`成功指派 ${res.data.count} 条线索`);
      setAssignModal(false);
      assignForm.resetFields();
      setSelectedRowKeys([]);
      setSelectedRows([]);
      loadData();
    } catch (error) {
      message.error('批量指派失败');
    }
  };

  const handleBatchReturn = async (values: any) => {
    try {
      const res = await clueApi.batchReturn({
        clueIds: selectedRowKeys as string[],
        note: values.note,
      });
      message.success(`成功退回 ${res.data.count} 条线索`);
      setReturnModal(false);
      returnForm.resetFields();
      setSelectedRowKeys([]);
      setSelectedRows([]);
      loadData();
    } catch (error) {
      message.error('批量退回失败');
    }
  };

  const handleBatchMerge = async (values: any) => {
    try {
      const res = await clueApi.batchMerge({
        clueIds: selectedRowKeys as string[],
        targetClueId: values.targetClueId,
        caseId: values.caseId,
      });
      message.success(`成功合并 ${res.data.mergedCount} 条线索到目标线索`);
      setMergeModal(false);
      mergeForm.resetFields();
      setSelectedRowKeys([]);
      setSelectedRows([]);
      loadData();
    } catch (error) {
      message.error('批量合并失败');
    }
  };

  const handleBatchToEvidence = async (values: any) => {
    try {
      const res = await clueApi.batchToEvidence({
        clueIds: selectedRowKeys as string[],
        caseId: values.caseId,
        evidenceType: values.evidenceType,
      });
      message.success(`成功转换 ${res.data.createdCount} 条线索为证据`);
      setToEvidenceModal(false);
      toEvidenceForm.resetFields();
      setSelectedRowKeys([]);
      setSelectedRows([]);
      loadData();
    } catch (error) {
      message.error('批量转证据失败');
    }
  };

  const columns: ColumnsType<ClueItem> = [
    {
      title: '线索编号',
      dataIndex: 'clueNumber',
      key: 'clueNumber',
      width: 140,
      render: (text) => <span style={{ color: '#1677ff', fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: '线索标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '关联案件',
      dataIndex: 'case',
      key: 'case',
      width: 150,
      render: (caseItem) => caseItem ? (
        <a onClick={() => navigate(`/cases/${caseItem.id}`)}>{caseItem.caseNumber}</a>
      ) : <span style={{ color: '#999' }}>未关联</span>,
    },
    {
      title: '类型',
      dataIndex: 'clueType',
      key: 'clueType',
      width: 100,
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: '可信度',
      dataIndex: 'credibility',
      key: 'credibility',
      width: 80,
      render: (text) => <Tag color={credibilityColors[text]}>{text}</Tag>,
    },
    {
      title: '重要性',
      dataIndex: 'importance',
      key: 'importance',
      width: 80,
      render: (text) => <Tag color={importanceColors[text]}>{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (text) => <Tag color={statusColors[text]}>{text}</Tag>,
    },
    {
      title: '关联',
      key: 'stats',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tag color="blue">人员 {record._count.cluePersons}</Tag>
          <Tag color="orange">证据 {record._count.evidences}</Tag>
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
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
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/clues/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/clues/${record.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该线索？" onConfirm={() => handleDelete(record.id)}>
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
        <h2 className="page-title">线索录入</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clues/new')}>
          新增线索
        </Button>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="线索编号/标题/内容" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="clueType" label="类型">
                <Select placeholder="选择类型" allowClear options={options.clueTypes?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="status" label="状态">
                <Select placeholder="选择状态" allowClear options={options.clueStatuses?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="credibility" label="可信度">
                <Select placeholder="选择可信度" allowClear options={options.credibilities?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="importance" label="重要性">
                <Select placeholder="选择重要性" allowClear options={options.importances?.map((t: string) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={2}>
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
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<AppstoreAddOutlined />}
              disabled={!hasSelected}
              onClick={() => setAssignModal(true)}
            >
              批量指派
            </Button>
            <Button
              icon={<RollbackOutlined />}
              disabled={!hasSelected}
              onClick={() => setReturnModal(true)}
            >
              批量退回
            </Button>
            <Button
              icon={<MergeOutlined />}
              disabled={selectedRowKeys.length < 2}
              onClick={() => {
                mergeForm.resetFields();
                setMergeModal(true);
              }}
            >
              批量合并
            </Button>
            <Button
              icon={<FileProtectOutlined />}
              disabled={!hasSelected}
              onClick={() => setToEvidenceModal(true)}
            >
              批量转证据
            </Button>
            {hasSelected && (
              <span style={{ color: '#666' }}>
                已选择 <a style={{ color: '#1677ff', fontWeight: 'bold' }}>{selectedRowKeys.length}</a> 条线索
                <Button type="link" size="small" onClick={() => { setSelectedRowKeys([]); setSelectedRows([]); }}>取消选择</Button>
              </span>
            )}
          </Space>
        </div>

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
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
          }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title="批量指派线索"
        open={assignModal}
        onCancel={() => setAssignModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={assignForm} layout="vertical" onFinish={handleBatchAssign}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            已选择 <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{selectedRowKeys.length}</span> 条线索进行指派
          </div>
          <Form.Item name="caseId" label="目标案件" rules={[{ required: true, message: '请选择目标案件' }]}>
            <Select
              placeholder="请选择目标案件"
              showSearch
              optionFilterProp="label"
              options={cases.map(c => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="handler" label="处理人">
            <Input placeholder="请输入处理人姓名" />
          </Form.Item>
          <Form.Item name="status" label="线索状态">
            <Select
              placeholder="选择更新后的状态（可选）"
              allowClear
              options={['待核实', '核实中', '已核实', '已采用', '已排除'].map(s => ({ label: s, value: s }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认指派</Button>
              <Button onClick={() => setAssignModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量退回线索"
        open={returnModal}
        onCancel={() => setReturnModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={returnForm} layout="vertical" onFinish={handleBatchReturn}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            已选择 <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{selectedRowKeys.length}</span> 条线索进行退回
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              退回后线索状态将重置为"待核实"，并取消与案件的关联
            </div>
          </div>
          <Form.Item name="note" label="退回说明">
            <Input.TextArea rows={4} placeholder="请输入退回说明（可选）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认退回</Button>
              <Button onClick={() => setReturnModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量合并线索"
        open={mergeModal}
        onCancel={() => setMergeModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={mergeForm} layout="vertical" onFinish={handleBatchMerge}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            已选择 <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{selectedRowKeys.length}</span> 条线索进行合并
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              合并后其他线索的内容、关联人员、证据将合并到目标线索，其他线索将被删除
            </div>
          </div>
          <Form.Item name="targetClueId" label="目标线索" rules={[{ required: true, message: '请选择目标线索' }]}>
            <Select
              placeholder="请选择保留的目标线索"
              showSearch
              optionFilterProp="label"
              options={selectedRows.map(r => ({
                label: `${r.clueNumber} - ${r.title}`,
                value: r.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="caseId" label="关联案件（可选）">
            <Select
              placeholder="选择目标案件（可选）"
              allowClear
              showSearch
              optionFilterProp="label"
              options={cases.map(c => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认合并</Button>
              <Button onClick={() => setMergeModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量转证据"
        open={toEvidenceModal}
        onCancel={() => setToEvidenceModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={toEvidenceForm} layout="vertical" onFinish={handleBatchToEvidence}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            已选择 <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{selectedRowKeys.length}</span> 条线索转换为证据
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              转换后将为每条线索创建对应的证据记录，线索状态更新为"已采用"
            </div>
          </div>
          <Form.Item name="caseId" label="目标案件" rules={[{ required: true, message: '请选择目标案件' }]}>
            <Select
              placeholder="请选择证据所属案件"
              showSearch
              optionFilterProp="label"
              options={cases.map(c => ({
                label: `${c.caseNumber} - ${c.title}`,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="evidenceType" label="证据类型" rules={[{ required: true, message: '请选择证据类型' }]} initialValue="书证">
            <Radio.Group>
              <Radio value="物证">物证</Radio>
              <Radio value="书证">书证</Radio>
              <Radio value="证人证言">证人证言</Radio>
              <Radio value="视听资料">视听资料</Radio>
              <Radio value="电子数据">电子数据</Radio>
              <Radio value="鉴定意见">鉴定意见</Radio>
              <Radio value="勘验笔录">勘验笔录</Radio>
              <Radio value="其他">其他</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认转换</Button>
              <Button onClick={() => setToEvidenceModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
