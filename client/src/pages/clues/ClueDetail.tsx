import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, Modal, Form, Select, Input, message, Popconfirm } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, PaperClipOutlined } from '@ant-design/icons';
import moment from 'moment';
import { clueApi, personApi, caseApi } from '../../services/api';

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

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

const evidenceTypeColors: Record<string, string> = {
  '物证': 'red',
  '书证': 'orange',
  '证人证言': 'green',
  '视听资料': 'blue',
  '电子数据': 'purple',
  '鉴定意见': 'cyan',
  '勘验笔录': 'magenta',
  '其他': 'default',
};

export default function ClueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [clueData, setClueData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personModal, setPersonModal] = useState(false);
  const [personForm] = Form.useForm();
  const [allPersons, setAllPersons] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadClueData();
      loadAllPersons();
    }
  }, [id]);

  const loadClueData = async () => {
    setLoading(true);
    try {
      const res = await clueApi.get(id!);
      setClueData(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAllPersons = async () => {
    try {
      const res = await personApi.all();
      setAllPersons(res.data);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await clueApi.delete(id!);
      message.success('删除成功');
      navigate('/clues');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAddPerson = async (values: any) => {
    try {
      await clueApi.addPerson(id!, values);
      message.success('添加成功');
      setPersonModal(false);
      personForm.resetFields();
      loadClueData();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleRemovePerson = async (personId: string) => {
    try {
      await clueApi.removePerson(id!, personId);
      message.success('移除成功');
      loadClueData();
    } catch (error) {
      message.error('移除失败');
    }
  };

  if (!clueData) return null;

  const tabItems = [
    {
      key: 'overview',
      label: '基本信息',
      children: (
        <div>
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="线索编号">{clueData.clueNumber}</Descriptions.Item>
            <Descriptions.Item label="线索类型"><Tag>{clueData.clueType}</Tag></Descriptions.Item>
            <Descriptions.Item label="线索标题" span={2}>{clueData.title}</Descriptions.Item>
            <Descriptions.Item label="关联案件">
              {clueData.case ? (
                <a onClick={() => navigate(`/cases/${clueData.case.id}`)}>
                  {clueData.case.caseNumber} - {clueData.case.title}
                </a>
              ) : <span style={{ color: '#999' }}>未关联</span>}
            </Descriptions.Item>
            <Descriptions.Item label="来源">{clueData.source}</Descriptions.Item>
            <Descriptions.Item label="可信度"><Tag color={credibilityColors[clueData.credibility]}>{clueData.credibility}</Tag></Descriptions.Item>
            <Descriptions.Item label="重要性"><Tag color={importanceColors[clueData.importance]}>{clueData.importance}</Tag></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColors[clueData.status]}>{clueData.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="发现地点">{clueData.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="发现时间">{clueData.findTime ? moment(clueData.findTime).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            <Descriptions.Item label="提供人">{clueData.informant || '-'}</Descriptions.Item>
            <Descriptions.Item label="处理人">{clueData.handler || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{moment(clueData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{moment(clueData.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="线索内容" span={2}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{clueData.content}</div>
            </Descriptions.Item>
            {clueData.note && (
              <Descriptions.Item label="备注" span={2}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{clueData.note}</div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'persons',
      label: `关联人员 (${clueData.cluePersons?.length || 0})`,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPersonModal(true)}>
              添加关联人员
            </Button>
          </div>
          <List
            dataSource={clueData.cluePersons}
            renderItem={(item: any) => (
              <List.Item
                actions={[
                  <Button type="link" size="small" onClick={() => navigate(`/persons/${item.personId}`)}>查看</Button>,
                  <Popconfirm title="确定移除该人员？" onConfirm={() => handleRemovePerson(item.personId)}>
                    <Button type="link" size="small" danger>移除</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: personTypeColors[item.person.personType] === 'red' ? '#ff4d4f'
                      : personTypeColors[item.person.personType] === 'orange' ? '#faad14'
                      : personTypeColors[item.person.personType] === 'green' ? '#52c41a'
                      : '#1677ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 20,
                  }}>{item.person.name[0]}</div>}
                  title={
                    <Space>
                      <span>{item.person.name}</span>
                      <Tag color={personTypeColors[item.person.personType]}>{item.person.personType}</Tag>
                      <Tag color="blue">{item.relation}</Tag>
                    </Space>
                  }
                  description={
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {item.person.phone || '-'} | {item.person.idCard || '-'}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'evidences',
      label: `证据附件 (${clueData.evidences?.length || 0})`,
      icon: <PaperClipOutlined />,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/evidences/upload?clueId=${id}`)}>
              上传证据
            </Button>
          </div>
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
            dataSource={clueData.evidences}
            renderItem={(item: any) => (
              <List.Item>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/evidences/${item.id}`)}
                  actions={[
                    <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); navigate(`/evidences/${item.id}`); }}>详情</Button>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <span style={{ fontSize: 14 }}>{item.name}</span>
                        <Tag color={evidenceTypeColors[item.type]}>{item.type}</Tag>
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 12, color: '#666' }}>
                        <div style={{ marginBottom: 4 }}>{item.evidenceNumber}</div>
                        <div>状态: <Tag color={statusColors[item.status]}>{item.status}</Tag></div>
                        <div>{moment(item.createdAt).format('YYYY-MM-DD')}</div>
                      </div>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clues')}>返回</Button>
          <h2 className="page-title">{clueData.title}</h2>
          <Tag color={statusColors[clueData.status]}>{clueData.status}</Tag>
        </Space>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/clues/${id}/edit`)}>编辑</Button>
          <Popconfirm title="确定删除该线索？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="添加关联人员"
        open={personModal}
        onCancel={() => setPersonModal(false)}
        footer={null}
      >
        <Form form={personForm} layout="vertical" onFinish={handleAddPerson}>
          <Form.Item name="personId" label="选择人员" rules={[{ required: true }]}>
            <Select
              placeholder="请选择人员"
              showSearch
              optionFilterProp="label"
              options={allPersons.map(p => ({
                label: `${p.name} (${p.personType}) - ${p.idCard || p.phone}`,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="relation" label="与线索关系" rules={[{ required: true }]}>
            <Select
              placeholder="选择关系"
              options={['提供者', '目击者', '嫌疑人', '受害人', '其他'].map(r => ({ label: r, value: r }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="补充说明" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认添加</Button>
              <Button onClick={() => setPersonModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
