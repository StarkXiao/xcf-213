import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Tabs, List, Modal, Form, Select, Input, message, Popconfirm, DatePicker, Timeline, Row, Col, AutoComplete, Empty, Table, Alert } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, PaperClipOutlined, CheckCircleOutlined, UserOutlined, FileTextOutlined, CoffeeOutlined, ScanOutlined, DisconnectOutlined, ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import { clueApi, personApi, evidenceApi, caseMeetingApi, forensicApi } from '../../services/api';
import CaseTimeline from '../../components/CaseTimeline';
import ApprovalInfoPanel, { approvalStatusMap } from '../../components/ApprovalInfoPanel';

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

const forensicFileTypeLabels: Record<string, { label: string; color: string }> = {
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

const forensicIntegrityLabels: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: '校验通过', color: 'success' },
  CORRUPTED: { label: '数据损坏', color: 'error' },
  PENDING: { label: '待校验', color: 'warning' },
  NOT_APPLICABLE: { label: '不适用', color: 'default' },
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

export default function ClueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [clueData, setClueData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [personModal, setPersonModal] = useState(false);
  const [personForm] = Form.useForm();
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [verificationModal, setVerificationModal] = useState(false);
  const [verificationForm] = Form.useForm();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationPage, setVerificationPage] = useState(1);
  const [verificationPageSize, setVerificationPageSize] = useState(10);
  const [verificationTotal, setVerificationTotal] = useState(0);
  const [editingVerification, setEditingVerification] = useState<any>(null);
  const [allEvidences, setAllEvidences] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [addMeetingModal, setAddMeetingModal] = useState(false);
  const [addMeetingForm] = Form.useForm();
  const [caseMeetings, setCaseMeetings] = useState<any[]>([]);
  const [forensicFiles, setForensicFiles] = useState<any[]>([]);
  const [forensicLoading, setForensicLoading] = useState(false);
  const [forensicTotal, setForensicTotal] = useState(0);
  const [forensicPage, setForensicPage] = useState(1);
  const [forensicPageSize, setForensicPageSize] = useState(10);
  const [bindForensicModal, setBindForensicModal] = useState(false);
  const [bindForensicForm] = Form.useForm();
  const [allForensicFiles, setAllForensicFiles] = useState<any[]>([]);
  const [allForensicLoading, setAllForensicLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadClueData();
      loadAllPersons();
      loadVerifications();
      loadAllEvidences();
      loadMeetings();
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

  const loadAllEvidences = async () => {
    try {
      const res = await evidenceApi.list({ pageSize: 1000 });
      setAllEvidences(res.data.items || []);
    } catch (error) {
      console.error('Failed to load evidences:', error);
    }
  };

  const loadVerifications = async (page = 1, pageSize = 10) => {
    setVerificationLoading(true);
    try {
      const res = await clueApi.getVerifications(id!, { page, pageSize });
      setVerifications(res.data.items);
      setVerificationTotal(res.data.total);
      setVerificationPage(page);
      setVerificationPageSize(pageSize);
    } catch (error) {
      console.error('Failed to load verifications:', error);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleAddVerification = () => {
    setEditingVerification(null);
    verificationForm.resetFields();
    verificationForm.setFieldsValue({
      handleTime: moment(),
    });
    setVerificationModal(true);
  };

  const handleEditVerification = (record: any) => {
    setEditingVerification(record);
    verificationForm.setFieldsValue({
      result: record.result,
      handler: record.handler,
      handleTime: record.handleTime ? moment(record.handleTime) : moment(),
      note: record.note,
      attachmentIds: record.evidences?.map((e: any) => e.id) || [],
    });
    setVerificationModal(true);
  };

  const handleSubmitVerification = async (values: any) => {
    try {
      const data = {
        result: values.result,
        handler: values.handler,
        handleTime: values.handleTime?.format('YYYY-MM-DD HH:mm:ss'),
        note: values.note,
        attachmentIds: values.attachmentIds || [],
      };

      if (editingVerification) {
        await clueApi.updateVerification(id!, editingVerification.id, data);
        message.success('更新成功');
      } else {
        await clueApi.addVerification(id!, data);
        message.success('添加成功');
      }

      setVerificationModal(false);
      verificationForm.resetFields();
      loadVerifications(verificationPage, verificationPageSize);
      loadClueData();
    } catch (error) {
      message.error(editingVerification ? '更新失败' : '添加失败');
    }
  };

  const handleDeleteVerification = async (verificationId: string) => {
    try {
      await clueApi.deleteVerification(id!, verificationId);
      message.success('删除成功');
      loadVerifications(verificationPage, verificationPageSize);
      loadClueData();
    } catch (error) {
      message.error('删除失败');
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

  const loadMeetings = async () => {
    setMeetingsLoading(true);
    try {
      const res = await caseMeetingApi.list({ clueId: id, pageSize: 100 });
      setMeetings(res.data.items || []);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setMeetingsLoading(false);
    }
  };

  const loadCaseMeetings = async (caseId: string) => {
    try {
      const res = await caseMeetingApi.list({ caseId, pageSize: 100 });
      setCaseMeetings(res.data.items || []);
    } catch (error) {
      console.error('Failed to load case meetings:', error);
    }
  };

  const loadForensicFiles = async (page = 1, pageSize = 10) => {
    setForensicLoading(true);
    try {
      const res = await forensicApi.list({ clueId: id, page, pageSize });
      setForensicFiles(res.data.items || []);
      setForensicTotal(res.data.total || 0);
      setForensicPage(page);
      setForensicPageSize(pageSize);
    } catch (error) {
      console.error('Failed to load forensic files:', error);
    } finally {
      setForensicLoading(false);
    }
  };

  const loadAllForensicFiles = async () => {
    setAllForensicLoading(true);
    try {
      const res = await forensicApi.list({ pageSize: 1000 });
      setAllForensicFiles(res.data.items || []);
    } catch (error) {
      console.error('Failed to load all forensic files:', error);
    } finally {
      setAllForensicLoading(false);
    }
  };

  const handleBindForensic = async (values: any) => {
    try {
      await forensicApi.bindClue({
        forensicFileId: values.forensicFileId,
        clueId: id!,
        relationType: values.relationType,
        description: values.description,
      });
      message.success('绑定取证文件成功');
      setBindForensicModal(false);
      bindForensicForm.resetFields();
      loadForensicFiles(forensicPage, forensicPageSize);
      loadClueData();
    } catch (error) {
      message.error('绑定取证文件失败');
    }
  };

  const handleUnbindForensic = async (forensicFileId: string) => {
    try {
      await forensicApi.unbindClue({
        forensicFileId,
        clueId: id!,
      });
      message.success('解绑取证文件成功');
      loadForensicFiles(forensicPage, forensicPageSize);
      loadClueData();
    } catch (error) {
      message.error('解绑取证文件失败');
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'forensics') {
      loadForensicFiles();
    }
  };

  const handleAddToMeeting = () => {
    addMeetingForm.resetFields();
    if (clueData?.caseId) {
      loadCaseMeetings(clueData.caseId);
    }
    setAddMeetingModal(true);
  };

  const handleAddMeetingSubmit = async (values: any) => {
    try {
      await caseMeetingApi.addClue(values.meetingId, {
        clueId: id,
        discussionPoint: values.discussionPoint,
      });
      message.success('添加成功');
      setAddMeetingModal(false);
      addMeetingForm.resetFields();
      loadMeetings();
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

          {['待核实', '核实中', '已核实'].includes(clueData.status) && !clueData.clueAdoptApproval && (
            <Alert
              message="线索采用需通过多级审批"
              description="请点击下方「发起审批」按钮发起线索采用审批流程，审批通过后方可变更线索状态为「已采用」。"
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          <div style={{ marginTop: 24 }}>
            <ApprovalInfoPanel
              targetType="CLUE"
              targetId={id!}
              targetName={clueData.title}
              targetNumber={clueData.clueNumber}
              clueId={id}
              caseId={clueData.caseId}
              approvals={clueData.approvals}
              currentApproval={clueData.clueAdoptApproval}
              allowedCategories={['CLUE_ADOPT']}
              onApprovalCreated={loadClueData}
            />
          </div>
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
    {
      key: 'verifications',
      label: (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          核查记录 ({verificationTotal})
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVerification}>
              新增核查记录
            </Button>
          </div>
          <Card loading={verificationLoading} size="small">
            {verifications.length > 0 ? (
              <Timeline
                mode="left"
                items={verifications.map((item: any) => ({
                  color: 'green',
                  label: (
                    <div style={{ minWidth: 160 }}>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>
                        {item.handleTime ? moment(item.handleTime).format('YYYY-MM-DD HH:mm') : moment(item.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        <Space size={4}>
                          <UserOutlined />
                          {item.handler || '未指定'}
                        </Space>
                      </div>
                    </div>
                  ),
                  children: (
                    <Card size="small" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                            <Space>
                              <FileTextOutlined style={{ color: '#52c41a' }} />
                              处置结果
                            </Space>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#555' }}>
                            {item.result}
                          </div>
                          {item.note && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
                              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>备注：</div>
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#666', fontSize: 13 }}>
                                {item.note}
                              </div>
                            </div>
                          )}
                          {item.evidences && item.evidences.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
                              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                                <Space>
                                  <PaperClipOutlined />
                                  关联附件 ({item.evidences.length})
                                </Space>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {item.evidences.map((ev: any) => (
                                  <Tag
                                    key={ev.id}
                                    color={evidenceTypeColors[ev.type]}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/evidences/${ev.id}`)}
                                  >
                                    {ev.evidenceNumber} - {ev.name}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ marginLeft: 16 }}>
                          <Space>
                            <Button
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleEditVerification(item)}
                            >
                              编辑
                            </Button>
                            <Popconfirm
                              title="确定删除该核查记录？"
                              onConfirm={() => handleDeleteVerification(item.id)}
                            >
                              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        </div>
                      </div>
                    </Card>
                  ),
                }))}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
                <div style={{ marginBottom: 8 }}>暂无核查记录</div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVerification}>
                  新增第一条核查记录
                </Button>
              </div>
            )}
            {verificationTotal > 0 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <div style={{ display: 'inline-block' }}>
                  <span style={{ marginRight: 16, color: '#666', fontSize: 13 }}>
                    共 {verificationTotal} 条记录
                  </span>
                  <Space size={0} wrap={false}>
                    <Button
                      size="small"
                      disabled={verificationPage <= 1}
                      onClick={() => loadVerifications(verificationPage - 1, verificationPageSize)}
                    >
                      上一页
                    </Button>
                    <Button size="small" disabled>
                      {verificationPage} / {Math.ceil(verificationTotal / verificationPageSize)}
                    </Button>
                    <Button
                      size="small"
                      disabled={verificationPage >= Math.ceil(verificationTotal / verificationPageSize)}
                      onClick={() => loadVerifications(verificationPage + 1, verificationPageSize)}
                    >
                      下一页
                    </Button>
                  </Space>
                  <Select
                    size="small"
                    value={verificationPageSize}
                    style={{ width: 100, marginLeft: 8 }}
                    onChange={(value) => loadVerifications(1, value)}
                    options={[
                      { label: '10条/页', value: 10 },
                      { label: '20条/页', value: 20 },
                      { label: '50条/页', value: 50 },
                    ]}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'meetings',
      label: `关联会商 (${meetings.length})`,
      icon: <CoffeeOutlined />,
      children: (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddToMeeting}>
              加入会商
            </Button>
          </div>
          {meetingsLoading ? (
            <Card loading style={{ minHeight: 200 }} />
          ) : meetings.length > 0 ? (
            <List
              dataSource={meetings}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => navigate(`/case-meetings/${item.id}`)}>
                      查看会商
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <a onClick={() => navigate(`/case-meetings/${item.id}`)}>{item.title}</a>
                        <Tag color={
                          item.status === 'DRAFT' ? 'default' :
                          item.status === 'IN_PROGRESS' ? 'processing' :
                          item.status === 'COMPLETED' ? 'success' : 'error'
                        }>
                          {item.status === 'DRAFT' ? '草稿' :
                           item.status === 'IN_PROGRESS' ? '进行中' :
                           item.status === 'COMPLETED' ? '已完成' : '已取消'}
                        </Tag>
                        <Tag color="blue">{item.meetingType}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                          编号: <span style={{ fontFamily: 'monospace' }}>{item.meetingNumber}</span>
                          {item.meetingTime && (
                            <span style={{ marginLeft: 16 }}>
                              时间: {moment(item.meetingTime).format('YYYY-MM-DD HH:mm')}
                            </span>
                          )}
                        </div>
                        {item.case && (
                          <div style={{ fontSize: 12, color: '#666' }}>
                            案件: <a onClick={() => navigate(`/cases/${item.caseId}`)}>{item.case.caseNumber} - {item.case.title}</a>
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="尚未加入任何会商" />
          )}
        </div>
      ),
    },
    {
      key: 'forensics',
      label: `电子数据取证 (${forensicTotal})`,
      icon: <ScanOutlined />,
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#666', fontSize: 13 }}>
              共 {forensicTotal} 个取证文件
            </div>
            <Space>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={() => {
                  bindForensicForm.resetFields();
                  loadAllForensicFiles();
                  setBindForensicModal(true);
                }}
              >
                关联取证文件
              </Button>
              <Button
                icon={<ScanOutlined />}
                onClick={() => navigate('/forensics/import')}
              >
                去批量导入
              </Button>
            </Space>
          </div>
          <Card loading={forensicLoading} size="small">
            <Table
              dataSource={forensicFiles}
              rowKey="id"
              size="small"
              pagination={{
                current: forensicPage,
                pageSize: forensicPageSize,
                total: forensicTotal,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => loadForensicFiles(page, pageSize),
              }}
              columns={[
                {
                  title: '取证编号',
                  dataIndex: 'forensicNumber',
                  key: 'forensicNumber',
                  width: 160,
                  render: (v: string, record: any) => (
                    <a onClick={() => navigate(`/forensics/${record.id}`)} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {v}
                    </a>
                  ),
                },
                {
                  title: '文件名',
                  dataIndex: 'fileName',
                  key: 'fileName',
                  ellipsis: true,
                  render: (v: string, record: any) => (
                    <Space>
                      <span>{v}</span>
                      {forensicFileTypeLabels[record.fileType] && (
                        <Tag color={forensicFileTypeLabels[record.fileType].color}>
                          {forensicFileTypeLabels[record.fileType].label}
                        </Tag>
                      )}
                    </Space>
                  ),
                },
                {
                  title: '文件大小',
                  dataIndex: 'fileSize',
                  key: 'fileSize',
                  width: 100,
                  render: (v: number) => formatFileSize(v),
                },
                {
                  title: '完整性',
                  dataIndex: 'integrityStatus',
                  key: 'integrityStatus',
                  width: 100,
                  render: (status: string) => {
                    const info = forensicIntegrityLabels[status] || forensicIntegrityLabels.PENDING;
                    return <Tag color={info.color}>{info.label}</Tag>;
                  },
                },
                {
                  title: 'MD5',
                  dataIndex: 'md5Hash',
                  key: 'md5Hash',
                  width: 140,
                  ellipsis: true,
                  render: (v: string) => v ? (
                    <code style={{ fontSize: 11, color: '#52c41a' }}>{v.substring(0, 16)}...</code>
                  ) : '-',
                },
                {
                  title: '关联类型',
                  key: 'relationType',
                  width: 120,
                  render: (_: any, record: any) => {
                    const rel = record.clueRelations?.find((r: any) => r.clueId === id);
                    return rel?.relationType ? <Tag>{rel.relationType}</Tag> : '-';
                  },
                },
                {
                  title: '创建时间',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 150,
                  render: (v: string) => moment(v).format('YYYY-MM-DD HH:mm'),
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 120,
                  render: (_: any, record: any) => (
                    <Space size={4}>
                      <Button type="link" size="small" onClick={() => navigate(`/forensics/${record.id}`)}>
                        详情
                      </Button>
                      <Popconfirm title="确定解绑该取证文件？" onConfirm={() => handleUnbindForensic(record.id)}>
                        <Button type="link" size="small" danger icon={<DisconnectOutlined />}>
                          解绑
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'timeline',
      label: (
        <Space>
          <ClockCircleOutlined style={{ color: '#1677ff' }} />
          案件时间轴
        </Space>
      ),
      children: (
        <CaseTimeline
          targetType="CLUE"
          targetId={id!}
          navigate={navigate}
        />
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
        <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
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

      <Modal
        title={editingVerification ? '编辑核查记录' : '新增核查记录'}
        open={verificationModal}
        onCancel={() => setVerificationModal(false)}
        footer={null}
        width={600}
      >
        <Form form={verificationForm} layout="vertical" onFinish={handleSubmitVerification}>
          <Form.Item
            name="result"
            label="处置结果"
            rules={[{ required: true, message: '请输入处置结果' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细描述本次核查的处置结果..."
              showCount
              maxLength={2000}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="handler"
                label="责任人"
                rules={[{ required: true, message: '请选择或输入责任人' }]}
              >
                <AutoComplete
                  placeholder="请选择或输入责任人"
                  options={allPersons.map(p => ({
                    label: `${p.name}${p.personType ? ` (${p.personType})` : ''}${p.idCard ? ` - ${p.idCard}` : ''}`,
                    value: p.name,
                  }))}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="handleTime"
                label="处置时间"
                rules={[{ required: true, message: '请选择处置时间' }]}
              >
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="attachmentIds"
            label="附件补充"
          >
            <Select
              mode="multiple"
              placeholder="选择关联的证据附件（可多选）"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              options={allEvidences.map(ev => ({
                label: `${ev.evidenceNumber} - ${ev.name} (${ev.type})`,
                value: ev.id,
              }))}
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="note"
            label="备注说明"
          >
            <Input.TextArea
              rows={3}
              placeholder="其他需要说明的内容..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingVerification ? '确认更新' : '确认提交'}
              </Button>
              <Button onClick={() => setVerificationModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="加入会商"
        open={addMeetingModal}
        onOk={() => addMeetingForm.submit()}
        onCancel={() => setAddMeetingModal(false)}
        okText="确认加入"
        width={500}
      >
        <Form form={addMeetingForm} layout="vertical" onFinish={handleAddMeetingSubmit}>
          <Form.Item
            name="meetingId"
            label="选择会商"
            rules={[{ required: true, message: '请选择要加入的会商' }]}
          >
            <Select
              placeholder="请选择要加入的会商"
              showSearch
              optionFilterProp="children"
              options={caseMeetings.map((m: any) => ({
                label: `${m.meetingNumber} - ${m.title} (${m.meetingType})`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="discussionPoint" label="讨论要点">
            <Input.TextArea rows={3} placeholder="记录该线索在会商中的讨论要点（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关联取证文件"
        open={bindForensicModal}
        onCancel={() => setBindForensicModal(false)}
        footer={null}
        width={560}
      >
        <Form form={bindForensicForm} layout="vertical" onFinish={handleBindForensic}>
          <Form.Item
            name="forensicFileId"
            label="选择取证文件"
            rules={[{ required: true, message: '请选择要关联的取证文件' }]}
          >
            <Select
              placeholder="请选择取证文件"
              showSearch
              optionFilterProp="label"
              loading={allForensicLoading}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={allForensicFiles
                .filter((f: any) => !f.clueRelations?.some((r: any) => r.clueId === id))
                .map((f: any) => ({
                  label: `${f.forensicNumber} - ${f.fileName}`,
                  value: f.id,
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
              placeholder="说明该取证文件与线索的关联关系..."
              showCount
              maxLength={500}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认关联</Button>
              <Button onClick={() => setBindForensicModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
