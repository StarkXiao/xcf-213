import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Tabs, List, Modal, Form, Select, Input,
  message, Popconfirm, Row, Col, DatePicker, Table, Avatar, Tooltip, Divider, Empty,
  Result, InputNumber
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UserOutlined,
  SearchOutlined, PaperClipOutlined, CheckCircleOutlined, StopOutlined,
  FileTextOutlined, TeamOutlined, BulbOutlined, ClockCircleOutlined,
  SendOutlined, CalendarOutlined, ExperimentOutlined, SolutionOutlined
} from '@ant-design/icons';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { caseMeetingApi, caseApi, clueApi, evidenceApi, personApi, commandApi } from '../../services/api';

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const todoStatusColors: Record<string, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const todoStatusLabels: Record<string, string> = {
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const priorityOptions = [
  { label: '特急', value: '特急' },
  { label: '紧急', value: '紧急' },
  { label: '重要', value: '重要' },
  { label: '一般', value: '一般' },
];

const taskTypeOptions = [
  { label: '线索核查', value: 'CLUE_VERIFY' },
  { label: '证据收集', value: 'EVIDENCE_COLLECT' },
  { label: '人员排查', value: 'PERSON_INVESTIGATE' },
  { label: '案件研判', value: 'CASE_ANALYSIS' },
  { label: '其他任务', value: 'OTHER' },
];

const meetingTypeOptions = [
  '案情分析会', '线索研判会', '证据审查会',
  '案件协调会', '专案推进会', '结案评审会', '其他'
];

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

const clueStatusColors: Record<string, string> = {
  '待核实': 'default',
  '核实中': 'processing',
  '已核实': 'success',
  '已采用': 'warning',
  '已排除': 'error',
};

export default function CaseMeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [attendeeModal, setAttendeeModal] = useState(false);
  const [attendeeForm] = Form.useForm();
  const [allPersons, setAllPersons] = useState<any[]>([]);

  const [clueModal, setClueModal] = useState(false);
  const [clueForm] = Form.useForm();
  const [caseClues, setCaseClues] = useState<any[]>([]);
  const [editingClueRelation, setEditingClueRelation] = useState<any>(null);

  const [evidenceModal, setEvidenceModal] = useState(false);
  const [evidenceForm] = Form.useForm();
  const [caseEvidences, setCaseEvidences] = useState<any[]>([]);
  const [editingEvidenceRelation, setEditingEvidenceRelation] = useState<any>(null);

  const [todoModal, setTodoModal] = useState(false);
  const [todoForm] = Form.useForm();
  const [editingTodo, setEditingTodo] = useState<any>(null);

  const [taskModal, setTaskModal] = useState(false);
  const [taskForm] = Form.useForm();
  const [currentTodo, setCurrentTodo] = useState<any>(null);

  const [cancelModal, setCancelModal] = useState(false);
  const [cancelForm] = Form.useForm();

  const [clueDiscussionModal, setClueDiscussionModal] = useState(false);
  const [clueDiscussionForm] = Form.useForm();

  const [evidenceDiscussionModal, setEvidenceDiscussionModal] = useState(false);
  const [evidenceDiscussionForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      loadMeeting();
      loadAllPersons();
    }
  }, [id]);

  const loadMeeting = async () => {
    setLoading(true);
    try {
      const res = await caseMeetingApi.get(id!);
      setMeeting(res.data);
      if (res.data.caseId) {
        loadCaseClues(res.data.caseId);
        loadCaseEvidences(res.data.caseId);
      }
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAllPersons = async () => {
    try {
      const res = await personApi.all();
      setAllPersons(res.data || []);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const loadCaseClues = async (caseId: string) => {
    try {
      const res = await caseApi.getClues(caseId);
      setCaseClues(res.data || []);
    } catch (error) {
      console.error('Failed to load clues:', error);
    }
  };

  const loadCaseEvidences = async (caseId: string) => {
    try {
      const res = await caseApi.getEvidences(caseId);
      setCaseEvidences(res.data || []);
    } catch (error) {
      console.error('Failed to load evidences:', error);
    }
  };

  const handleComplete = async () => {
    try {
      await caseMeetingApi.complete(id!);
      message.success('已完成');
      loadMeeting();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCancelMeeting = () => {
    cancelForm.resetFields();
    setCancelModal(true);
  };

  const handleCancelSubmit = async (values: any) => {
    try {
      await caseMeetingApi.cancel(id!, values);
      message.success('已取消');
      setCancelModal(false);
      loadMeeting();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAddAttendee = () => {
    attendeeForm.resetFields();
    setAttendeeModal(true);
  };

  const handleAttendeeSubmit = async (values: any) => {
    try {
      const person = allPersons.find(p => p.id === values.personId);
      await caseMeetingApi.addAttendee(id!, {
        ...values,
        personName: person ? person.name : values.personName,
        personDept: person ? person.department : values.personDept,
      });
      message.success('添加成功');
      setAttendeeModal(false);
      attendeeForm.resetFields();
      loadMeeting();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    try {
      await caseMeetingApi.removeAttendee(id!, attendeeId);
      message.success('移除成功');
      loadMeeting();
    } catch (error) {
      message.error('移除失败');
    }
  };

  const handleAddClue = () => {
    setEditingClueRelation(null);
    clueForm.resetFields();
    setClueModal(true);
  };

  const handleClueSubmit = async (values: any) => {
    try {
      if (editingClueRelation) {
        await caseMeetingApi.updateClue(id!, editingClueRelation.id, values);
        message.success('更新成功');
      } else {
        await caseMeetingApi.addClue(id!, values);
        message.success('关联成功');
      }
      setClueModal(false);
      clueForm.resetFields();
      loadMeeting();
    } catch (error) {
      message.error(editingClueRelation ? '更新失败' : '关联失败');
    }
  };

  const handleRemoveClue = async (relationId: string) => {
    try {
      await caseMeetingApi.removeClue(id!, relationId);
      message.success('移除成功');
      loadMeeting();
    } catch (error) {
      message.error('移除失败');
    }
  };

  const handleEditClueDiscussion = (record: any) => {
    setEditingClueRelation(record);
    clueDiscussionForm.setFieldsValue({
      discussionPoint: record.discussionPoint,
      conclusion: record.conclusion,
    });
    setClueDiscussionModal(true);
  };

  const handleClueDiscussionSubmit = async (values: any) => {
    try {
      await caseMeetingApi.updateClue(id!, editingClueRelation.id, values);
      message.success('更新成功');
      setClueDiscussionModal(false);
      loadMeeting();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleAddEvidence = () => {
    setEditingEvidenceRelation(null);
    evidenceForm.resetFields();
    setEvidenceModal(true);
  };

  const handleEvidenceSubmit = async (values: any) => {
    try {
      if (editingEvidenceRelation) {
        await caseMeetingApi.updateEvidence(id!, editingEvidenceRelation.id, values);
        message.success('更新成功');
      } else {
        await caseMeetingApi.addEvidence(id!, values);
        message.success('关联成功');
      }
      setEvidenceModal(false);
      evidenceForm.resetFields();
      loadMeeting();
    } catch (error) {
      message.error(editingEvidenceRelation ? '更新失败' : '关联失败');
    }
  };

  const handleRemoveEvidence = async (relationId: string) => {
    try {
      await caseMeetingApi.removeEvidence(id!, relationId);
      message.success('移除成功');
      loadMeeting();
    } catch (error) {
      message.error('移除失败');
    }
  };

  const handleEditEvidenceDiscussion = (record: any) => {
    setEditingEvidenceRelation(record);
    evidenceDiscussionForm.setFieldsValue({
      discussionPoint: record.discussionPoint,
      conclusion: record.conclusion,
    });
    setEvidenceDiscussionModal(true);
  };

  const handleEvidenceDiscussionSubmit = async (values: any) => {
    try {
      await caseMeetingApi.updateEvidence(id!, editingEvidenceRelation.id, values);
      message.success('更新成功');
      setEvidenceDiscussionModal(false);
      loadMeeting();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleAddTodo = () => {
    setEditingTodo(null);
    todoForm.resetFields();
    todoForm.setFieldsValue({ priority: '一般' });
    setTodoModal(true);
  };

  const handleEditTodo = (todo: any) => {
    setEditingTodo(todo);
    todoForm.setFieldsValue({
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      dueDate: todo.dueDate ? moment(todo.dueDate) : null,
      assigneeName: todo.assigneeName,
      assigneeDept: todo.assigneeDept,
      assigneeId: todo.assigneeId,
      note: todo.note,
    });
    setTodoModal(true);
  };

  const handleTodoSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
      };

      if (editingTodo) {
        await caseMeetingApi.updateTodo(id!, editingTodo.id, data);
        message.success('更新成功');
      } else {
        await caseMeetingApi.addTodo(id!, data);
        message.success('添加成功');
      }
      setTodoModal(false);
      todoForm.resetFields();
      loadMeeting();
    } catch (error) {
      message.error(editingTodo ? '更新失败' : '添加失败');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await caseMeetingApi.deleteTodo(id!, todoId);
      message.success('删除成功');
      loadMeeting();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleTodoToTask = (todo: any) => {
    setCurrentTodo(todo);
    taskForm.resetFields();
    taskForm.setFieldsValue({
      taskType: 'CASE_ANALYSIS',
      priority: todo.priority,
    });
    setTaskModal(true);
  };

  const handleTaskSubmit = async (values: any) => {
    try {
      await caseMeetingApi.todoToTask(id!, currentTodo.id, values);
      message.success('已落地为任务');
      setTaskModal(false);
      loadMeeting();
    } catch (error) {
      message.error('落地任务失败');
    }
  };

  if (!meeting) return null;

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <FileTextOutlined />
          基本信息
        </Space>
      ),
      children: (
        <div>
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="会商编号">
              <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{meeting.meetingNumber}</span>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[meeting.status]}>{statusLabels[meeting.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="会商主题" span={2}>{meeting.title}</Descriptions.Item>
            <Descriptions.Item label="会商类型">
              <Tag color="blue">{meeting.meetingType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="关联案件">
              {meeting.case ? (
                <a onClick={() => navigate(`/cases/${meeting.caseId}`)}>
                  {meeting.case.caseNumber} - {meeting.case.title}
                </a>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="会商时间">
              {meeting.meetingTime ? moment(meeting.meetingTime).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="会商地点">{meeting.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="主持人">
              {meeting.hostName || '-'}
              {meeting.hostDept && <span style={{ color: '#999', marginLeft: 8 }}>({meeting.hostDept})</span>}
            </Descriptions.Item>
            <Descriptions.Item label="记录人">
              {meeting.recorderName || '-'}
              {meeting.recorderDept && <span style={{ color: '#999', marginLeft: 8 }}>({meeting.recorderDept})</span>}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {moment(meeting.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {moment(meeting.updatedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">分析讨论</Divider>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card size="small" title={<Space><BulbOutlined style={{ color: '#1677ff' }} />案情分析</Space>}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333', minHeight: 80 }}>
                  {meeting.caseAnalysis || <span style={{ color: '#999' }}>暂无</span>}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={<Space><SearchOutlined style={{ color: '#fa8c16' }} />线索分析</Space>}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333', minHeight: 80 }}>
                  {meeting.clueAnalysis || <span style={{ color: '#999' }}>暂无</span>}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={<Space><PaperClipOutlined style={{ color: '#52c41a' }} />证据分析</Space>}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333', minHeight: 80 }}>
                  {meeting.evidenceAnalysis || <span style={{ color: '#999' }}>暂无</span>}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={<Space><TeamOutlined style={{ color: '#722ed1' }} />人员分析</Space>}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333', minHeight: 80 }}>
                  {meeting.personAnalysis || <span style={{ color: '#999' }}>暂无</span>}
                </div>
              </Card>
            </Col>
          </Row>

          {meeting.discussionContent && (
            <Card size="small" title={<Space><FileTextOutlined style={{ color: '#13c2c2' }} />讨论内容</Space>} style={{ marginTop: 16 }}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333' }}>
                {meeting.discussionContent}
              </div>
            </Card>
          )}

          {meeting.conclusion && (
            <Card size="small" title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />会商结论</Space>} style={{ marginTop: 16 }}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333', fontSize: 15, fontWeight: 500 }}>
                {meeting.conclusion}
              </div>
            </Card>
          )}

          {meeting.note && (
            <Card size="small" title="备注" style={{ marginTop: 16 }}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#666' }}>
                {meeting.note}
              </div>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'attendees',
      label: (
        <Space>
          <TeamOutlined />
          参会人员 ({meeting.attendees?.length || 0})
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAttendee}>
              添加参会人员
            </Button>
          </div>
          {meeting.attendees?.length > 0 ? (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
              dataSource={meeting.attendees}
              renderItem={(item: any) => (
                <List.Item>
                  <Card
                    size="small"
                    actions={[
                      <Popconfirm title="确定移除？" onConfirm={() => handleRemoveAttendee(item.id)}>
                        <Button type="link" size="small" danger>移除</Button>
                      </Popconfirm>,
                    ]}
                  >
                    <Card.Meta
                      avatar={
                        <Avatar style={{ backgroundColor: '#1677ff' }}>
                          {item.personName?.charAt(0)}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <span>{item.personName}</span>
                          {item.role && <Tag color="blue" style={{ fontSize: 11 }}>{item.role}</Tag>}
                        </Space>
                      }
                      description={
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {item.personDept || '-'}
                          {item.note && <div style={{ marginTop: 4 }}>{item.note}</div>}
                        </div>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无参会人员" />
          )}
        </div>
      ),
    },
    {
      key: 'clues',
      label: (
        <Space>
          <SearchOutlined />
          关联线索 ({meeting.clueRelations?.length || 0})
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClue}>
              关联线索
            </Button>
          </div>
          {meeting.clueRelations?.length > 0 ? (
            <List
              dataSource={meeting.clueRelations}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => handleEditClueDiscussion(item)}>
                      编辑讨论
                    </Button>,
                    <Button type="link" size="small" onClick={() => navigate(`/clues/${item.clueId}`)}>
                      查看线索
                    </Button>,
                    <Popconfirm title="确定移除关联？" onConfirm={() => handleRemoveClue(item.id)}>
                      <Button type="link" size="small" danger>移除</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <a onClick={() => navigate(`/clues/${item.clueId}`)}>{item.clue?.title}</a>
                        <Tag color={clueStatusColors[item.clue?.status]}>{item.clue?.status}</Tag>
                        {item.clue?.credibility && (
                          <Tag color={credibilityColors[item.clue?.credibility]}>
                            可信度: {item.clue?.credibility}
                          </Tag>
                        )}
                        {item.clue?.importance && (
                          <Tag color={importanceColors[item.clue?.importance]}>
                            重要性: {item.clue?.importance}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
                          编号: {item.clue?.clueNumber} | 类型: {item.clue?.clueType}
                        </div>
                        {item.discussionPoint && (
                          <div style={{ background: '#f0f5ff', padding: '8px 12px', borderRadius: 4, marginBottom: 8 }}>
                            <div style={{ fontWeight: 'bold', color: '#1677ff', fontSize: 12, marginBottom: 4 }}>
                              <BulbOutlined style={{ marginRight: 4 }} />讨论要点
                            </div>
                            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{item.discussionPoint}</div>
                          </div>
                        )}
                        {item.conclusion && (
                          <div style={{ background: '#f6ffed', padding: '8px 12px', borderRadius: 4 }}>
                            <div style={{ fontWeight: 'bold', color: '#52c41a', fontSize: 12, marginBottom: 4 }}>
                              <CheckCircleOutlined style={{ marginRight: 4 }} />会商结论
                            </div>
                            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{item.conclusion}</div>
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无关联线索" />
          )}
        </div>
      ),
    },
    {
      key: 'evidences',
      label: (
        <Space>
          <PaperClipOutlined />
          关联证据 ({meeting.evidenceRelations?.length || 0})
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEvidence}>
              关联证据
            </Button>
          </div>
          {meeting.evidenceRelations?.length > 0 ? (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
              dataSource={meeting.evidenceRelations}
              renderItem={(item: any) => (
                <List.Item>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => navigate(`/evidences/${item.evidenceId}`)}
                    actions={[
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleEditEvidenceDiscussion(item); }}
                      >
                        编辑讨论
                      </Button>,
                      <Popconfirm title="确定移除关联？" onConfirm={(e) => { e?.stopPropagation(); handleRemoveEvidence(item.id); }}>
                        <Button type="link" size="small" danger onClick={(e) => e.stopPropagation()}>移除</Button>
                      </Popconfirm>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Space size={4}>
                          <span style={{ fontSize: 14 }}>{item.evidence?.name}</span>
                          <Tag color={evidenceTypeColors[item.evidence?.type]} style={{ fontSize: 11 }}>
                            {item.evidence?.type}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontFamily: 'monospace', color: '#722ed1', marginBottom: 4 }}>
                            {item.evidence?.evidenceNumber}
                          </div>
                          {item.discussionPoint && (
                            <div style={{ background: '#f0f5ff', padding: '6px 10px', borderRadius: 4, marginBottom: 6 }}>
                              <div style={{ fontWeight: 'bold', color: '#1677ff', fontSize: 11, marginBottom: 2 }}>
                                <BulbOutlined style={{ marginRight: 4 }} />讨论要点
                              </div>
                              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{item.discussionPoint}</div>
                            </div>
                          )}
                          {item.conclusion && (
                            <div style={{ background: '#f6ffed', padding: '6px 10px', borderRadius: 4 }}>
                              <div style={{ fontWeight: 'bold', color: '#52c41a', fontSize: 11, marginBottom: 2 }}>
                                <CheckCircleOutlined style={{ marginRight: 4 }} />结论
                              </div>
                              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{item.conclusion}</div>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无关联证据" />
          )}
        </div>
      ),
    },
    {
      key: 'todos',
      label: (
        <Space>
          <ClockCircleOutlined />
          待办事项 ({meeting.todoItems?.length || 0})
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTodo}>
              添加待办
            </Button>
          </div>
          {meeting.todoItems?.length > 0 ? (
            <List
              dataSource={meeting.todoItems}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    item.task ? (
                      <Button
                        type="link"
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => navigate(`/command/tasks/${item.taskId}`)}
                      >
                        查看任务
                      </Button>
                    ) : (
                      <Button
                        type="primary"
                        size="small"
                        icon={<SendOutlined />}
                        onClick={() => handleTodoToTask(item)}
                      >
                        落地为任务
                      </Button>
                    ),
                    <Button type="link" size="small" onClick={() => handleEditTodo(item)}>编辑</Button>,
                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTodo(item.id)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          backgroundColor:
                            item.priority === '特急' ? '#ff4d4f' :
                            item.priority === '紧急' ? '#fa8c16' :
                            item.priority === '重要' ? '#1677ff' : '#52c41a'
                        }}
                        icon={<ClockCircleOutlined />}
                      />
                    }
                    title={
                      <Space>
                        <span style={{ fontWeight: 'bold' }}>{item.title}</span>
                        <Tag color={todoStatusColors[item.status]}>{todoStatusLabels[item.status]}</Tag>
                        <Tag color={
                          item.priority === '特急' ? 'red' :
                          item.priority === '紧急' ? 'orange' :
                          item.priority === '重要' ? 'blue' : 'green'
                        }>
                          {item.priority}
                        </Tag>
                        {item.task && (
                          <Tag color="purple" icon={<FileTextOutlined />}>
                            已落地: {item.task.taskNumber}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        {item.description && (
                          <div style={{ color: '#333', marginBottom: 8 }}>{item.description}</div>
                        )}
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {item.assigneeName && <span>负责人: {item.assigneeName}</span>}
                          {item.assigneeDept && <span> ({item.assigneeDept})</span>}
                          {item.dueDate && (
                            <span style={{ marginLeft: 16 }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              截止: {moment(item.dueDate).format('YYYY-MM-DD')}
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                            备注: {item.note}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无待办事项" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/case-meetings')}>返回</Button>
          <h2 className="page-title">{meeting.title}</h2>
          <Tag color={statusColors[meeting.status]}>{statusLabels[meeting.status]}</Tag>
        </Space>
        <Space>
          {meeting.status === 'DRAFT' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete}>
              标记完成
            </Button>
          )}
          {meeting.status !== 'COMPLETED' && meeting.status !== 'CANCELLED' && (
            <Button danger icon={<StopOutlined />} onClick={handleCancelMeeting}>
              取消会商
            </Button>
          )}
          <Button icon={<EditOutlined />} onClick={() => navigate(`/case-meetings/${id}/edit`)}>
            编辑
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal
        title="添加参会人员"
        open={attendeeModal}
        onOk={() => attendeeForm.submit()}
        onCancel={() => setAttendeeModal(false)}
        okText="添加"
        width={500}
      >
        <Form form={attendeeForm} layout="vertical" onFinish={handleAttendeeSubmit}>
          <Form.Item name="personId" label="选择人员（可从人员库选择）">
            <Select
              placeholder="选择人员（可选）"
              allowClear
              showSearch
              optionFilterProp="children"
              options={allPersons.map(p => ({
                label: `${p.name} (${p.department || '未设置部门'})`,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="personName"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="personDept" label="部门">
            <Input placeholder="请输入部门" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select placeholder="请选择角色" allowClear>
              <Select.Option value="主持人">主持人</Select.Option>
              <Select.Option value="记录人">记录人</Select.Option>
              <Select.Option value="参会领导">参会领导</Select.Option>
              <Select.Option value="侦查员">侦查员</Select.Option>
              <Select.Option value="技术人员">技术人员</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关联线索"
        open={clueModal}
        onOk={() => clueForm.submit()}
        onCancel={() => setClueModal(false)}
        okText="关联"
        width={500}
      >
        <Form form={clueForm} layout="vertical" onFinish={handleClueSubmit}>
          <Form.Item
            name="clueId"
            label="选择线索"
            rules={[{ required: true, message: '请选择线索' }]}
          >
            <Select
              placeholder="请选择要关联的线索"
              showSearch
              optionFilterProp="children"
              disabled={!!editingClueRelation}
              options={caseClues
                .filter((c: any) => !meeting.clueRelations?.some((r: any) => r.clueId === c.id))
                .map((c: any) => ({
                  label: `${c.clueNumber} - ${c.title}`,
                  value: c.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="discussionPoint" label="讨论要点">
            <Input.TextArea rows={3} placeholder="记录针对该线索的讨论要点" />
          </Form.Item>
          <Form.Item name="conclusion" label="会商结论">
            <Input.TextArea rows={3} placeholder="记录针对该线索的会商结论" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑线索讨论"
        open={clueDiscussionModal}
        onOk={() => clueDiscussionForm.submit()}
        onCancel={() => setClueDiscussionModal(false)}
        okText="保存"
        width={500}
      >
        <Form form={clueDiscussionForm} layout="vertical" onFinish={handleClueDiscussionSubmit}>
          <Form.Item name="discussionPoint" label="讨论要点">
            <Input.TextArea rows={4} placeholder="记录针对该线索的讨论要点" />
          </Form.Item>
          <Form.Item name="conclusion" label="会商结论">
            <Input.TextArea rows={4} placeholder="记录针对该线索的会商结论" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关联证据"
        open={evidenceModal}
        onOk={() => evidenceForm.submit()}
        onCancel={() => setEvidenceModal(false)}
        okText="关联"
        width={500}
      >
        <Form form={evidenceForm} layout="vertical" onFinish={handleEvidenceSubmit}>
          <Form.Item
            name="evidenceId"
            label="选择证据"
            rules={[{ required: true, message: '请选择证据' }]}
          >
            <Select
              placeholder="请选择要关联的证据"
              showSearch
              optionFilterProp="children"
              disabled={!!editingEvidenceRelation}
              options={caseEvidences
                .filter((e: any) => !meeting.evidenceRelations?.some((r: any) => r.evidenceId === e.id))
                .map((e: any) => ({
                  label: `${e.evidenceNumber} - ${e.name}`,
                  value: e.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="discussionPoint" label="讨论要点">
            <Input.TextArea rows={3} placeholder="记录针对该证据的讨论要点" />
          </Form.Item>
          <Form.Item name="conclusion" label="会商结论">
            <Input.TextArea rows={3} placeholder="记录针对该证据的会商结论" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑证据讨论"
        open={evidenceDiscussionModal}
        onOk={() => evidenceDiscussionForm.submit()}
        onCancel={() => setEvidenceDiscussionModal(false)}
        okText="保存"
        width={500}
      >
        <Form form={evidenceDiscussionForm} layout="vertical" onFinish={handleEvidenceDiscussionSubmit}>
          <Form.Item name="discussionPoint" label="讨论要点">
            <Input.TextArea rows={4} placeholder="记录针对该证据的讨论要点" />
          </Form.Item>
          <Form.Item name="conclusion" label="会商结论">
            <Input.TextArea rows={4} placeholder="记录针对该证据的会商结论" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingTodo ? '编辑待办' : '添加待办'}
        open={todoModal}
        onOk={() => todoForm.submit()}
        onCancel={() => setTodoModal(false)}
        okText={editingTodo ? '保存' : '添加'}
        width={500}
      >
        <Form form={todoForm} layout="vertical" onFinish={handleTodoSubmit}>
          <Form.Item
            name="title"
            label="待办标题"
            rules={[{ required: true, message: '请输入待办标题' }]}
          >
            <Input placeholder="请输入待办标题" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="详细描述" />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="assigneeName" label="负责人姓名">
            <Input placeholder="负责人姓名" />
          </Form.Item>
          <Form.Item name="assigneeDept" label="负责人部门">
            <Input placeholder="负责人部门" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="落地为任务"
        open={taskModal}
        onOk={() => taskForm.submit()}
        onCancel={() => setTaskModal(false)}
        okText="确认落地"
        okButtonProps={{ type: 'primary' }}
        width={500}
      >
        {currentTodo && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#389e0d' }}>待办内容</div>
            <div>{currentTodo.title}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              优先级: {currentTodo.priority} | 负责人: {currentTodo.assigneeName || '未设置'}
            </div>
          </div>
        )}
        <Form form={taskForm} layout="vertical" onFinish={handleTaskSubmit}>
          <Form.Item
            name="taskType"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select options={taskTypeOptions} />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item name="requirement" label="任务要求">
            <Input.TextArea rows={3} placeholder="任务具体要求（可选）" />
          </Form.Item>
          <Form.Item name="assignerName" label="指派人">
            <Input placeholder="指派人姓名" />
          </Form.Item>
          <Form.Item name="assignerDept" label="指派部门">
            <Input placeholder="指派部门" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="取消会商"
        open={cancelModal}
        onOk={() => cancelForm.submit()}
        onCancel={() => setCancelModal(false)}
        okText="确认取消"
        okButtonProps={{ danger: true }}
      >
        <Form form={cancelForm} layout="vertical" onFinish={handleCancelSubmit}>
          <Form.Item
            name="reason"
            label="取消原因"
            rules={[{ required: true, message: '请输入取消原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入取消原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
