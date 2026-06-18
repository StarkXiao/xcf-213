import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Timeline,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  message,
  Popconfirm,
  Tooltip,
  Checkbox,
  Empty,
  Row,
  Col,
  Statistic,
  Divider,
  Dropdown,
  Badge,
  Avatar,
  List,
  Radio,
  Segmented,
  AutoComplete,
  InputNumber,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  StarOutlined,
  StarFilled,
  FilterOutlined,
  SearchOutlined,
  ReloadOutlined,
  PhoneOutlined,
  WarningOutlined,
  ScanOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  PaperClipOutlined,
  SwapOutlined,
  UserOutlined,
  EyeOutlined,
  SearchOutlined as SearchIcon,
  LockOutlined,
  SafetyOutlined,
  StopOutlined,
  UnlockOutlined,
  FileTextOutlined,
  AuditOutlined,
  SolutionOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  ShareAltOutlined,
  CoffeeOutlined,
  SendOutlined,
  CheckSquareOutlined,
  BellOutlined,
  AlertOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  DownOutlined,
  DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import { timelineApi, personApi, evidenceApi, caseMeetingApi, forensicApi } from '../services/api';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const eventIconMap: Record<string, React.ReactNode> = {
  REPORT: <PhoneOutlined />,
  CRIME_OCCUR: <WarningOutlined />,
  FORENSICS: <ScanOutlined />,
  VERIFICATION: <CheckCircleOutlined />,
  INTERROGATION: <MessageOutlined />,
  EVIDENCE_COLLECT: <PaperClipOutlined />,
  EVIDENCE_TRANSFER: <SwapOutlined />,
  PERSON_INTERVIEW: <UserOutlined />,
  SURVEILLANCE: <EyeOutlined />,
  SEARCH: <SearchIcon />,
  SEIZURE: <LockOutlined />,
  ARREST: <SafetyOutlined />,
  DETENTION: <StopOutlined />,
  BAIL: <UnlockOutlined />,
  INDICTMENT: <FileTextOutlined />,
  TRIAL: <AuditOutlined />,
  JUDGMENT: <SolutionOutlined />,
  APPEAL: <RiseOutlined />,
  EXECUTION: <ThunderboltOutlined />,
  CASE_FILING: <FileAddOutlined />,
  CASE_CLOSE: <FolderOpenOutlined />,
  CASE_TRANSFER: <ShareAltOutlined />,
  MEETING: <CoffeeOutlined />,
  TASK_ASSIGN: <SendOutlined />,
  TASK_COMPLETE: <CheckSquareOutlined />,
  ALERT_TRIGGER: <BellOutlined />,
  RISK_ASSESSMENT: <AlertOutlined />,
  CLUE_FOUND: <BulbOutlined />,
  OTHER: <InfoCircleOutlined />,
};

const priorityColors: Record<string, string> = {
  LOW: '#d9d9d9',
  MEDIUM: '#1677ff',
  HIGH: '#faad14',
  CRITICAL: '#ff4d4f',
};

const priorityLabels: Record<string, string> = {
  LOW: '一般',
  MEDIUM: '重要',
  HIGH: '紧急',
  CRITICAL: '特急',
};

const statusColors: Record<string, string> = {
  '已确认': 'success',
  '待审核': 'processing',
  '已驳回': 'error',
  '已归档': 'default',
};

interface CaseTimelineProps {
  targetType: 'CASE' | 'CLUE';
  targetId: string;
  navigate?: (path: string) => void;
}

const CaseTimeline: React.FC<CaseTimelineProps> = ({ targetType, targetId, navigate }) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [aggregateData, setAggregateData] = useState<any>(null);
  const [options, setOptions] = useState<any>({ eventTypes: [], priorities: [], operatorRoles: [], eventTypeLabels: {} });

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const [detailModal, setDetailModal] = useState(false);
  const [detailEvent, setDetailEvent] = useState<any>(null);

  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<any>(null);
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [allEvidences, setAllEvidences] = useState<any[]>([]);
  const [allMeetings, setAllMeetings] = useState<any[]>([]);
  const [allForensicFiles, setAllForensicFiles] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aggRes, optRes, personsRes, evidencesRes, meetingsRes, forensicsRes] = await Promise.all([
        timelineApi.getAggregate(targetType, targetId),
        timelineApi.getOptions(),
        personApi.all(),
        evidenceApi.list({ pageSize: 1000 }),
        caseMeetingApi.list({ [targetType === 'CASE' ? 'caseId' : 'clueId']: targetId, pageSize: 100 }),
        forensicApi.list({ pageSize: 1000 }),
      ]);
      setAggregateData(aggRes.data);
      setOptions(optRes.data);
      setAllPersons(personsRes.data);
      setAllEvidences(evidencesRes.data.items || []);
      setAllMeetings(meetingsRes.data.items || []);
      setAllForensicFiles(forensicsRes.data.items || []);
      mergeAggregatedEvents(aggRes.data);
    } catch (error) {
      console.error('Failed to load timeline data:', error);
      message.error('加载时间轴数据失败');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  const mergeAggregatedEvents = (data: any) => {
    const mergedEvents: any[] = [...(data.events || [])];

    (data.verifications || []).forEach((v: any) => {
      if (!mergedEvents.some((e: any) => e.id === `verification-${v.id}`)) {
        mergedEvents.push({
          id: `verification-${v.id}`,
          _source: 'verification',
          eventType: 'VERIFICATION',
          title: `核查记录: ${(v.result || '').substring(0, 30)}${(v.result || '').length > 30 ? '...' : ''}`,
          description: v.result,
          eventTime: v.handleTime || v.createdAt,
          operatorName: v.handler,
          operatorRole: '核查人员',
          status: '已确认',
          priority: 'MEDIUM',
          source: 'SYSTEM',
          _related: v,
          evidences: v.evidences,
        });
      }
    });

    (data.evidences || []).forEach((e: any) => {
      if (!mergedEvents.some((ev: any) => ev.id === `evidence-${e.id}`)) {
        mergedEvents.push({
          id: `evidence-${e.id}`,
          _source: 'evidence',
          eventType: 'EVIDENCE_COLLECT',
          title: `证据收集: ${e.name}`,
          description: e.description || `证据编号: ${e.evidenceNumber}`,
          eventTime: e.collectTime || e.createdAt,
          operatorName: e.collector,
          operatorRole: '证据收集人员',
          location: e.location,
          status: '已确认',
          priority: 'MEDIUM',
          source: 'SYSTEM',
          _related: e,
        });
      }
    });

    (data.forensicFiles || []).forEach((f: any) => {
      if (!mergedEvents.some((ev: any) => ev.id === `forensic-${f.id}`)) {
        mergedEvents.push({
          id: `forensic-${f.id}`,
          _source: 'forensic',
          eventType: 'FORENSICS',
          title: `电子数据取证: ${f.fileName}`,
          description: `取证编号: ${f.forensicNumber}, 文件大小: ${formatFileSize(f.fileSize)}`,
          eventTime: f.acquisitionTime || f.createdAt,
          operatorName: f.acquirer,
          operatorRole: '技术勘查人员',
          location: f.acquisitionLocation,
          status: '已确认',
          priority: 'MEDIUM',
          source: 'SYSTEM',
          _related: f,
        });
      }
    });

    (data.meetings || []).forEach((m: any) => {
      if (!mergedEvents.some((ev: any) => ev.id === `meeting-${m.id}`)) {
        mergedEvents.push({
          id: `meeting-${m.id}`,
          _source: 'meeting',
          eventType: 'MEETING',
          title: `会商研讨: ${m.title}`,
          description: m.discussionContent || `编号: ${m.meetingNumber}, 类型: ${m.meetingType}`,
          eventTime: m.meetingTime || m.createdAt,
          operatorName: m.hostName,
          operatorRole: '主持人',
          location: m.location,
          status: '已确认',
          priority: 'HIGH',
          source: 'SYSTEM',
          _related: m,
        });
      }
    });

    setEvents(mergedEvents);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  useEffect(() => {
    if (targetId) {
      loadData();
    }
  }, [loadData, targetId]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (eventTypeFilter.length > 0) {
      result = result.filter(e => eventTypeFilter.includes(e.eventType));
    }

    if (priorityFilter !== 'ALL') {
      result = result.filter(e => e.priority === priorityFilter);
    }

    if (onlyImportant) {
      result = result.filter(e => e.isImportant || e.priority === 'CRITICAL' || e.priority === 'HIGH');
    }

    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(e =>
        (e.title || '').toLowerCase().includes(s) ||
        (e.description || '').toLowerCase().includes(s) ||
        (e.operatorName || '').toLowerCase().includes(s) ||
        (e.location || '').toLowerCase().includes(s)
      );
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day').valueOf();
      const end = dateRange[1].endOf('day').valueOf();
      result = result.filter(e => {
        const t = moment(e.eventTime).valueOf();
        return t >= start && t <= end;
      });
    }

    result.sort((a, b) => {
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      const ta = moment(a.eventTime).valueOf();
      const tb = moment(b.eventTime).valueOf();
      return sortOrder === 'asc' ? ta - tb : tb - ta;
    });

    return result;
  }, [events, eventTypeFilter, priorityFilter, searchText, dateRange, onlyImportant, sortOrder]);

  const stats = useMemo(() => {
    const count: Record<string, number> = {};
    events.forEach(e => {
      count[e.eventType] = (count[e.eventType] || 0) + 1;
    });
    const importantCount = events.filter(e => e.isImportant || e.priority === 'CRITICAL' || e.priority === 'HIGH').length;
    return { count, total: events.length, importantCount };
  }, [events]);

  const getEventTypeInfo = (type: string) => {
    return options.eventTypeLabels?.[type] || { label: type, color: 'default', icon: 'InfoCircleOutlined' };
  };

  const handleAddEvent = () => {
    addForm.resetFields();
    addForm.setFieldsValue({
      eventType: 'OTHER',
      priority: 'MEDIUM',
      status: '已确认',
      eventTime: moment(),
      isImportant: false,
      isConfidential: false,
      source: 'MANUAL',
    });
    setAddModal(true);
  };

  const handleEditEvent = (event: any) => {
    if (event._source) {
      message.info('系统自动生成的事件不可编辑');
      return;
    }
    setEditingEvent(event);
    editForm.setFieldsValue({
      eventType: event.eventType,
      eventSubtype: event.eventSubtype,
      title: event.title,
      description: event.description,
      location: event.location,
      eventTime: moment(event.eventTime),
      priority: event.priority,
      status: event.status,
      operatorName: event.operatorName,
      operatorDept: event.operatorDept,
      operatorRole: event.operatorRole,
      participantNames: event.participantNames ? JSON.parse(event.participantNames) : [],
      evidenceIds: event.evidenceIds ? JSON.parse(event.evidenceIds) : [],
      personIds: event.personIds ? JSON.parse(event.personIds) : [],
      meetingIds: event.meetingIds ? JSON.parse(event.meetingIds) : [],
      forensicFileIds: event.forensicFileIds ? JSON.parse(event.forensicFileIds) : [],
      isImportant: event.isImportant,
      isConfidential: event.isConfidential,
      confidentialLevel: event.confidentialLevel,
      remark: event.remark,
    });
    setEditModal(true);
  };

  const handleSubmitAdd = async (values: any) => {
    setSubmitting(true);
    try {
      const data = {
        targetType,
        [targetType === 'CASE' ? 'caseId' : 'clueId']: targetId,
        eventType: values.eventType,
        eventSubtype: values.eventSubtype,
        title: values.title,
        description: values.description,
        location: values.location,
        eventTime: values.eventTime?.format('YYYY-MM-DD HH:mm:ss'),
        priority: values.priority,
        source: values.source,
        status: values.status,
        operatorName: values.operatorName,
        operatorDept: values.operatorDept,
        operatorRole: values.operatorRole,
        participantNames: values.participantNames || [],
        evidenceIds: values.evidenceIds || [],
        personIds: values.personIds || [],
        meetingIds: values.meetingIds || [],
        forensicFileIds: values.forensicFileIds || [],
        isImportant: values.isImportant,
        isConfidential: values.isConfidential,
        confidentialLevel: values.confidentialLevel,
        remark: values.remark,
      };

      await timelineApi.create(data);
      message.success('添加时间轴事件成功');
      setAddModal(false);
      addForm.resetFields();
      loadData();
    } catch (error) {
      message.error('添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (values: any) => {
    if (!editingEvent) return;
    setSubmitting(true);
    try {
      const data = {
        eventType: values.eventType,
        eventSubtype: values.eventSubtype,
        title: values.title,
        description: values.description,
        location: values.location,
        eventTime: values.eventTime?.format('YYYY-MM-DD HH:mm:ss'),
        priority: values.priority,
        status: values.status,
        operatorName: values.operatorName,
        operatorDept: values.operatorDept,
        operatorRole: values.operatorRole,
        participantNames: values.participantNames || [],
        evidenceIds: values.evidenceIds || [],
        personIds: values.personIds || [],
        meetingIds: values.meetingIds || [],
        forensicFileIds: values.forensicFileIds || [],
        isImportant: values.isImportant,
        isConfidential: values.isConfidential,
        confidentialLevel: values.confidentialLevel,
        remark: values.remark,
      };

      await timelineApi.update(editingEvent.id, data);
      message.success('更新成功');
      setEditModal(false);
      setEditingEvent(null);
      loadData();
    } catch (error) {
      message.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: any) => {
    if (event._source) {
      message.info('系统自动生成的事件不可删除');
      return;
    }
    try {
      await timelineApi.delete(event.id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggleImportant = async (event: any) => {
    if (event._source) {
      message.info('系统自动生成的事件暂不支持标记');
      return;
    }
    try {
      await timelineApi.update(event.id, { isImportant: !event.isImportant });
      message.success(event.isImportant ? '已取消重要标记' : '已标记为重要');
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleViewDetail = (event: any) => {
    setDetailEvent(event);
    setDetailModal(true);
  };

  const handleExport = () => {
    message.info('导出功能开发中');
  };

  const handlePrint = () => {
    window.print();
  };

  const renderTimelineItem = (event: any) => {
    const typeInfo = getEventTypeInfo(event.eventType);
    const isEditable = !event._source;
    const participants = event.participantNames ? JSON.parse(event.participantNames) : [];
    const evidenceIds = event.evidenceIds ? JSON.parse(event.evidenceIds) : [];

    return (
      <div key={event.id} style={{ marginBottom: 24 }}>
        <Card
          size="small"
          style={{
            borderLeft: `4px solid ${priorityColors[event.priority] || '#d9d9d9'}`,
            background: event.isImportant ? '#fffbe6' : undefined,
          }}
          className="timeline-card"
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <Space wrap size={[8, 8]} style={{ marginBottom: 8 }}>
                <Tag color={typeInfo.color} icon={eventIconMap[event.eventType] || <InfoCircleOutlined />}>
                  {typeInfo.label}
                </Tag>
                {event.eventSubtype && <Tag>{event.eventSubtype}</Tag>}
                <Tag color={priorityColors[event.priority]}>
                  {priorityLabels[event.priority] || event.priority}
                </Tag>
                {event.status && <Tag color={statusColors[event.status] || 'default'}>{event.status}</Tag>}
                {event.isImportant && (
                  <Tag color="gold" icon={<StarFilled />}>重要事件</Tag>
                )}
                {event.isConfidential && (
                  <Tag color="red" icon={<LockOutlined />}>
                    {event.confidentialLevel || '机密'}
                  </Tag>
                )}
                {event._source && (
                  <Tag color="geekblue" bordered={false} style={{ opacity: 0.85 }}>
                    系统生成
                  </Tag>
                )}
              </Space>

              <div
                onClick={() => handleViewDetail(event)}
                style={{ cursor: 'pointer', marginBottom: 8 }}
              >
                <h4 style={{ margin: 0, color: event.isImportant ? '#d46b08' : '#1f1f1f' }}>
                  {event.title}
                </h4>
              </div>

              {event.description && (
                <div style={{ color: '#595959', lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                  {event.description.length > 200 ? event.description.substring(0, 200) + '...' : event.description}
                </div>
              )}

              <Space wrap size={[16, 8]} style={{ fontSize: 12, color: '#8c8c8c' }}>
                {event.eventTime && (
                  <span>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {moment(event.eventTime).format('YYYY-MM-DD HH:mm')}
                  </span>
                )}
                {event.operatorName && (
                  <span>
                    <UserOutlined style={{ marginRight: 4 }} />
                    {event.operatorName}
                    {event.operatorRole && <span style={{ color: '#bfbfbf' }}> ({event.operatorRole})</span>}
                  </span>
                )}
                {event.operatorDept && (
                  <span>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    {event.operatorDept}
                  </span>
                )}
                {event.location && (
                  <span>
                    <EnvironmentOutlined style={{ marginRight: 4 }} />
                    {event.location}
                  </span>
                )}
                {participants.length > 0 && (
                  <span>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    参与人员: {participants.length}人
                  </span>
                )}
                {evidenceIds.length > 0 && (
                  <span>
                    <PaperClipOutlined style={{ marginRight: 4 }} />
                    关联证据: {evidenceIds.length}件
                  </span>
                )}
              </Space>
            </div>

            <Space style={{ marginLeft: 16 }}>
              <Tooltip title="查看详情">
                <Button
                  type="link"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  onClick={() => handleViewDetail(event)}
                />
              </Tooltip>
              <Tooltip title={event.isImportant ? '取消重要标记' : '标记为重要'}>
                <Button
                  type="link"
                  size="small"
                  icon={event.isImportant ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                  onClick={() => handleToggleImportant(event)}
                />
              </Tooltip>
              {isEditable && (
                <>
                  <Tooltip title="编辑">
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditEvent(event)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定删除该时间轴事件？"
                    description="删除后无法恢复"
                    onConfirm={() => handleDeleteEvent(event)}
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </>
              )}
            </Space>
          </div>

          {(event._source === 'verification' && event.evidences?.length > 0) && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #f0f0f0' }}>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                <PaperClipOutlined /> 关联证据附件
              </div>
              <Space wrap>
                {event.evidences.map((ev: any) => (
                  <Tag
                    key={ev.id}
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate && navigate(`/evidences/${ev.id}`)}
                  >
                    {ev.evidenceNumber} - {ev.name}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderTimelineView = () => {
    const timelineItems = filteredEvents.map((event: any) => {
      const typeInfo = getEventTypeInfo(event.eventType);
      return {
        color: event.isImportant ? '#faad14' : typeInfo.color,
        dot: eventIconMap[event.eventType] || <InfoCircleOutlined />,
        label: (
          <div style={{ minWidth: 180, paddingRight: 16 }}>
            <div style={{ fontWeight: 600, color: '#262626' }}>
              {moment(event.eventTime).format('YYYY-MM-DD')}
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              {moment(event.eventTime).format('HH:mm')}
            </div>
            {event.operatorName && (
              <div style={{ fontSize: 12, color: '#595959', marginTop: 6 }}>
                <UserOutlined style={{ marginRight: 4 }} />
                {event.operatorName}
              </div>
            )}
          </div>
        ),
        children: renderTimelineItem(event),
      };
    });

    return (
      <Timeline
        mode="left"
        items={timelineItems}
        style={{ padding: '16px 0' }}
      />
    );
  };

  const renderListView = () => {
    return (
      <List
        dataSource={filteredEvents}
        renderItem={(event: any) => (
          <List.Item style={{ padding: 0, marginBottom: 12 }}>
            {renderTimelineItem(event)}
          </List.Item>
        )}
      />
    );
  };

  const eventFormFields = (form: any) => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="eventType"
            label="事件类型"
            rules={[{ required: true, message: '请选择事件类型' }]}
          >
            <Select
              placeholder="请选择事件类型"
              options={options.eventTypes}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="eventSubtype" label="事件子类型">
            <Input placeholder="事件子类型（可选）" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="title"
        label="事件标题"
        rules={[{ required: true, message: '请输入事件标题' }]}
      >
        <Input placeholder="请简要描述事件内容" maxLength={200} showCount />
      </Form.Item>

      <Form.Item name="description" label="详细描述">
        <TextArea
          rows={4}
          placeholder="请详细描述事件经过、关键信息等"
          maxLength={2000}
          showCount
        />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="eventTime"
            label="事件时间"
            rules={[{ required: true, message: '请选择事件时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="location" label="事件地点">
            <Input placeholder="事件发生地点" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true }]}
          >
            <Select
              options={options.priorities}
              optionRender={(opt: any) => (
                <Space>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: priorityColors[opt.data.value],
                    }}
                  />
                  {opt.data.label}
                </Space>
              )}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="status" label="状态">
            <Select
              options={(options.statuses || []).map((s: any) => ({ value: s.value, label: s.label }))}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="source" label="数据来源">
            <Select
              options={(options.sources || []).map((s: any) => ({ value: s.value, label: s.label }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
        <span style={{ fontWeight: 500 }}>人员信息</span>
      </Divider>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="operatorName" label="责任人/操作人">
            <AutoComplete
              placeholder="请选择或输入责任人"
              options={allPersons.map(p => ({
                label: `${p.name}${p.personType ? ` (${p.personType})` : ''}`,
                value: p.name,
              }))}
              allowClear
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="operatorRole" label="角色">
            <Select
              placeholder="请选择角色"
              options={(options.operatorRoles || []).map((r: any) => ({ value: r.value, label: r.label }))}
              allowClear
              showSearch
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="operatorDept" label="所属部门">
            <Input placeholder="所属部门" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="participantNames" label="参与人员">
        <Select
          mode="tags"
          placeholder="输入参与人员姓名，回车确认（可多选）"
          tokenSeparators={[',', '，']}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
        <span style={{ fontWeight: 500 }}>关联资源</span>
      </Divider>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="personIds" label="关联人员">
            <Select
              mode="multiple"
              placeholder="选择关联人员（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              options={allPersons.map(p => ({
                label: `${p.name} (${p.personType}) - ${p.idCard || p.phone || ''}`,
                value: p.id,
              }))}
              allowClear
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="evidenceIds" label="关联证据">
            <Select
              mode="multiple"
              placeholder="选择关联证据（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              options={allEvidences.map(e => ({
                label: `${e.evidenceNumber} - ${e.name} (${e.type})`,
                value: e.id,
              }))}
              allowClear
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="meetingIds" label="关联会商">
            <Select
              mode="multiple"
              placeholder="选择关联会商（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              options={allMeetings.map(m => ({
                label: `${m.meetingNumber} - ${m.title}`,
                value: m.id,
              }))}
              allowClear
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="forensicFileIds" label="关联取证文件">
            <Select
              mode="multiple"
              placeholder="选择关联取证文件（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              options={allForensicFiles.map(f => ({
                label: `${f.forensicNumber} - ${f.fileName}`,
                value: f.id,
              }))}
              allowClear
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" plain style={{ margin: '12px 0' }}>
        <span style={{ fontWeight: 500 }}>其他设置</span>
      </Divider>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="isImportant" valuePropName="checked">
            <Checkbox>标记为重要事件</Checkbox>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="isConfidential" valuePropName="checked">
            <Checkbox>标记为机密事件</Checkbox>
          </Form.Item>
        </Col>
      </Row>

      {form.getFieldValue('isConfidential') && (
        <Form.Item name="confidentialLevel" label="保密级别">
          <Select
            placeholder="请选择保密级别"
            options={[
              { value: '秘密', label: '秘密' },
              { value: '机密', label: '机密' },
              { value: '绝密', label: '绝密' },
            ]}
            allowClear
          />
        </Form.Item>
      )}

      <Form.Item name="remark" label="备注">
        <TextArea rows={3} placeholder="其他需要说明的信息" maxLength={500} showCount />
      </Form.Item>
    </>
  );

  return (
    <div className="case-timeline">
      <Card
        size="small"
        className="card-shadow"
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 600 }}>案件时间轴</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {stats.total} 条事件
            </Tag>
            {stats.importantCount > 0 && (
              <Tag color="gold" icon={<StarFilled />}>
                重要 {stats.importantCount}
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
            >
              刷新
            </Button>
            <Dropdown
              menu={{
                items: [
                  { key: 'export', label: '导出时间轴', icon: <DownloadOutlined />, onClick: handleExport },
                  { key: 'print', label: '打印时间轴', icon: <PrinterOutlined />, onClick: handlePrint },
                ],
              }}
            >
              <Button>
                更多 <DownOutlined />
              </Button>
            </Dropdown>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddEvent}
            >
              补录事件
            </Button>
          </Space>
        }
      >
        <Card
          size="small"
          style={{ marginBottom: 16, background: '#fafafa' }}
          bordered={false}
        >
          <Space wrap size={[12, 12]} style={{ width: '100%' }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索事件标题、内容、人员..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />

            <Select
              mode="multiple"
              placeholder="事件类型筛选"
              value={eventTypeFilter}
              onChange={setEventTypeFilter}
              style={{ minWidth: 220, maxWidth: 400 }}
              maxTagCount="responsive"
              options={options.eventTypes}
              allowClear
            />

            <Select
              placeholder="优先级筛选"
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: 140 }}
              options={[
                { value: 'ALL', label: '全部优先级' },
                ...(options.priorities || []).map((p: any) => ({ value: p.value, label: p.label })),
              ]}
              allowClear={false}
            />

            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 280 }}
              placeholder={['开始日期', '结束日期']}
            />

            <Checkbox
              checked={onlyImportant}
              onChange={e => setOnlyImportant(e.target.checked)}
            >
              仅看重要事件
            </Checkbox>

            <div style={{ flex: 1 }} />

            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'timeline', label: '时间轴视图' },
                { value: 'list', label: '列表视图' },
              ]}
            />

            <Segmented
              value={sortOrder}
              onChange={setSortOrder}
              options={[
                { value: 'desc', label: '最新在前' },
                { value: 'asc', label: '最早在前' },
              ]}
            />
          </Space>
        </Card>

        {Object.keys(stats.count).length > 0 && (
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            bordered={false}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <Row gutter={[12, 12]}>
              {options.eventTypes.map((type: any) => {
                const count = stats.count[type.value] || 0;
                return count > 0 ? (
                  <Col key={type.value} xs={12} sm={8} md={6} lg={4}>
                    <div
                      onClick={() => {
                        setEventTypeFilter(eventTypeFilter.includes(type.value)
                          ? eventTypeFilter.filter(t => t !== type.value)
                          : [...eventTypeFilter, type.value]);
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: 12,
                        borderRadius: 8,
                        background: eventTypeFilter.includes(type.value) ? '#e6f4ff' : '#fafafa',
                        border: `1px solid ${eventTypeFilter.includes(type.value) ? '#1677ff' : '#f0f0f0'}`,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Space size={8}>
                        <Tag color={type.color} style={{ margin: 0 }}>
                          {type.label}
                        </Tag>
                      </Space>
                      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 600, color: '#262626' }}>
                        {count}
                      </div>
                    </div>
                  </Col>
                ) : null;
              })}
            </Row>
          </Card>
        )}

        <Card loading={loading} bordered={false} bodyStyle={{ padding: 0 }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <div style={{ marginBottom: 16, color: '#8c8c8c' }}>
                      {events.length === 0 ? '暂无时间轴事件' : '没有符合筛选条件的事件'}
                    </div>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEvent}>
                        补录第一条事件
                      </Button>
                      {events.length > 0 && (
                        <Button onClick={() => {
                          setSearchText('');
                          setEventTypeFilter([]);
                          setPriorityFilter('ALL');
                          setDateRange([]);
                          setOnlyImportant(false);
                        }}>
                          清除筛选
                        </Button>
                      )}
                    </Space>
                  </div>
                }
              />
            </div>
          ) : viewMode === 'timeline' ? renderTimelineView() : renderListView()}
        </Card>
      </Card>

      <Modal
        title="补录时间轴事件"
        open={addModal}
        onCancel={() => setAddModal(false)}
        width={760}
        footer={null}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={handleSubmitAdd}>
          {eventFormFields(addForm)}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                确认提交
              </Button>
              <Button onClick={() => setAddModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑时间轴事件"
        open={editModal}
        onCancel={() => { setEditModal(false); setEditingEvent(null); }}
        width={760}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleSubmitEdit}>
          {eventFormFields(editForm)}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                确认更新
              </Button>
              <Button onClick={() => { setEditModal(false); setEditingEvent(null); }}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            {detailEvent && (
              <Tag color={getEventTypeInfo(detailEvent.eventType).color}>
                {getEventTypeInfo(detailEvent.eventType).label}
              </Tag>
            )}
            <span>{detailEvent?.title}</span>
          </Space>
        }
        open={detailModal}
        onCancel={() => { setDetailModal(false); setDetailEvent(null); }}
        width={720}
        footer={
          <Space>
            {detailEvent && !detailEvent._source && (
              <>
                <Button onClick={() => {
                  setDetailModal(false);
                  handleEditEvent(detailEvent);
                }} icon={<EditOutlined />}>
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除该事件？"
                  onConfirm={() => {
                    handleDeleteEvent(detailEvent);
                    setDetailModal(false);
                  }}
                >
                  <Button danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </>
            )}
            <Button onClick={() => { setDetailModal(false); setDetailEvent(null); }}>关闭</Button>
          </Space>
        }
      >
        {detailEvent && (
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="事件编号">
              {detailEvent.eventNumber || `系统生成 (${detailEvent.id.substring(0, 8)})`}
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={priorityColors[detailEvent.priority]}>
                {priorityLabels[detailEvent.priority]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="事件时间">
              <Space>
                <ClockCircleOutlined />
                {moment(detailEvent.eventTime).format('YYYY-MM-DD HH:mm:ss')}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[detailEvent.status] || 'default'}>
                {detailEvent.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="事件地点">
              {detailEvent.location ? (
                <Space>
                  <EnvironmentOutlined />
                  {detailEvent.location}
                </Space>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="数据来源">
              {detailEvent.source === 'SYSTEM' ? '系统自动生成' :
                detailEvent.source === 'MANUAL' ? '手工录入' :
                detailEvent.source === 'IMPORT' ? '批量导入' :
                detailEvent.source === 'API' ? '接口同步' : detailEvent.source}
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              {detailEvent.operatorName ? (
                <Space>
                  <UserOutlined />
                  {detailEvent.operatorName}
                  {detailEvent.operatorRole && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>{detailEvent.operatorRole}</Tag>
                  )}
                </Space>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="所属部门">
              {detailEvent.operatorDept || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="重要标记">
              {detailEvent.isImportant ? (
                <Tag color="gold" icon={<StarFilled />}>重要事件</Tag>
              ) : '普通事件'}
            </Descriptions.Item>
            <Descriptions.Item label="保密级别">
              {detailEvent.isConfidential ? (
                <Tag color="red" icon={<LockOutlined />}>
                  {detailEvent.confidentialLevel || '机密'}
                </Tag>
              ) : '公开'}
            </Descriptions.Item>
            <Descriptions.Item label="事件标题" span={2}>
              {detailEvent.title}
            </Descriptions.Item>
            <Descriptions.Item label="详细描述" span={2}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {detailEvent.description || '-'}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}

        {detailEvent?.remark && (
          <Card size="small" title="备注" style={{ marginBottom: 16 }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{detailEvent.remark}</div>
          </Card>
        )}

        {detailEvent?.participantNames && JSON.parse(detailEvent.participantNames).length > 0 && (
          <Card size="small" title="参与人员" style={{ marginBottom: 16 }}>
            <Space wrap>
              {JSON.parse(detailEvent.participantNames).map((name: string, idx: number) => (
                <Tag key={idx} color="blue">
                  <UserOutlined style={{ marginRight: 4 }} />
                  {name}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {detailEvent?._source === 'verification' && detailEvent?.evidences?.length > 0 && (
          <Card size="small" title="关联证据" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={detailEvent.evidences}
              renderItem={(ev: any) => (
                <List.Item
                  actions={[
                    navigate && (
                      <Button type="link" size="small" onClick={() => navigate(`/evidences/${ev.id}`)}>
                        查看详情
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{ev.name}</span>
                        <Tag>{ev.type}</Tag>
                      </Space>
                    }
                    description={`证据编号: ${ev.evidenceNumber}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default CaseTimeline;
