import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, message, Popconfirm } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import moment from 'moment';
import ReactECharts from 'echarts-for-react';
import { personApi } from '../../services/api';

const personTypeColors: Record<string, string> = {
  '嫌疑人': 'red',
  '受害人': 'orange',
  '证人': 'green',
  '关系人': 'blue',
  '其他': 'default',
};

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [personData, setPersonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relations, setRelations] = useState<any>({ nodes: [], edges: [] });

  useEffect(() => {
    if (id) {
      loadPersonData();
      loadRelations();
    }
  }, [id]);

  const loadPersonData = async () => {
    setLoading(true);
    try {
      const res = await personApi.get(id!);
      setPersonData(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRelations = async () => {
    try {
      const res = await personApi.getRelations(id!);
      setRelations(res.data);
    } catch (error) {
      console.error('Failed to load relations:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await personApi.delete(id!);
      message.success('删除成功');
      navigate('/persons');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const graphOption = {
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `${params.data.name}<br/>类型: ${params.data.type}`;
        }
        return `${params.data.relation}<br/>${params.data.description || ''}`;
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      label: {
        show: true,
        position: 'bottom',
        formatter: '{b}',
      },
      edgeLabel: {
        show: true,
        formatter: '{c}',
        fontSize: 12,
      },
      force: {
        repulsion: 400,
        edgeLength: 120,
      },
      data: relations.nodes.map((node: any) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        symbolSize: node.isCenter ? 60 : 40,
        itemStyle: {
          color: node.isCenter ? '#722ed1' :
            node.type === '受害人' ? '#faad14' :
            node.type === '嫌疑人' ? '#ff4d4f' :
            node.type === '证人' ? '#52c41a' : '#1677ff',
          borderWidth: node.isCenter ? 4 : 2,
          borderColor: node.isCenter ? '#fff' : '#ddd',
        },
      })),
      links: relations.edges.map((edge: any) => ({
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        description: edge.description,
        lineStyle: {
          width: 2,
          color: '#999',
        },
      })),
    }],
  };

  if (!personData) return null;

  const tabItems = [
    {
      key: 'overview',
      label: '基本信息',
      children: (
        <div>
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="姓名">{personData.name}</Descriptions.Item>
            <Descriptions.Item label="人员类型">
              <Tag color={personTypeColors[personData.personType]}>{personData.personType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="性别">{personData.gender || '-'}</Descriptions.Item>
            <Descriptions.Item label="年龄">{personData.age || '-'}</Descriptions.Item>
            <Descriptions.Item label="身份证号">
              {personData.idCard ? <span style={{ fontFamily: 'monospace' }}>{personData.idCard}</span> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">{personData.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="住址">{personData.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="职业">{personData.occupation || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{moment(personData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{moment(personData.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="人员描述" span={2}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{personData.description || '-'}</div>
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'cases',
      label: `关联案件 (${personData.casePersons?.length || 0})`,
      children: (
        <List
          dataSource={personData.casePersons}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => navigate(`/cases/${item.caseId}`)}>查看案件</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <a onClick={() => navigate(`/cases/${item.caseId}`)}>{item.case.title}</a>
                    <Tag color="blue">{item.role}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ color: '#666', fontFamily: 'monospace' }}>{item.case.caseNumber}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      关联时间: {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'clues',
      label: `关联线索 (${personData.cluePersons?.length || 0})`,
      children: (
        <List
          dataSource={personData.cluePersons}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => navigate(`/clues/${item.clueId}`)}>查看线索</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <a onClick={() => navigate(`/clues/${item.clueId}`)}>{item.clue.title}</a>
                    <Tag color="blue">{item.relation}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ color: '#666', fontFamily: 'monospace' }}>{item.clue.clueNumber}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      关联时间: {moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'relations',
      label: '关系网络',
      children: (
        <div className="graph-container">
          <ReactECharts option={graphOption} style={{ height: '600px' }} />
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/persons')}>返回</Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: personTypeColors[personData.personType] === 'red' ? '#ff4d4f'
                : personTypeColors[personData.personType] === 'orange' ? '#faad14'
                : personTypeColors[personData.personType] === 'green' ? '#52c41a'
                : '#1677ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
            }}>{personData.name[0]}</div>
            <h2 className="page-title" style={{ margin: 0 }}>{personData.name}</h2>
            <Tag color={personTypeColors[personData.personType]}>{personData.personType}</Tag>
          </div>
        </Space>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/persons/${id}/edit`)}>编辑</Button>
          <Popconfirm title="确定删除该人员？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="card-shadow" loading={loading}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
