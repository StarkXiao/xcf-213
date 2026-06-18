import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const caseApi = {
  list: (params?: any) => api.get('/cases', { params }),
  get: (id: string) => api.get(`/cases/${id}`),
  create: (data: any) => api.post('/cases', data),
  update: (id: string, data: any) => api.put(`/cases/${id}`, data),
  delete: (id: string) => api.delete(`/cases/${id}`),
  addPerson: (id: string, data: any) => api.post(`/cases/${id}/persons`, data),
  removePerson: (id: string, personId: string) => api.delete(`/cases/${id}/persons/${personId}`),
  getClues: (id: string) => api.get(`/cases/${id}/clues`),
  getEvidences: (id: string) => api.get(`/cases/${id}/evidences`),
  getPersons: (id: string) => api.get(`/cases/${id}/persons`),
  getRelations: (id: string) => api.get(`/cases/${id}/relations`),
  getThematicView: (id: string) => api.get(`/cases/${id}/thematic-view`),
  exportArchive: (id: string, params?: { includeClues?: boolean; includeEvidences?: boolean; includePersons?: boolean; includeRelations?: boolean }) =>
    api.get(`/cases/${id}/export`, {
      params: {
        includeClues: params?.includeClues ?? true,
        includeEvidences: params?.includeEvidences ?? true,
        includePersons: params?.includePersons ?? true,
        includeRelations: params?.includeRelations ?? true,
      },
      responseType: 'blob',
    }),
};

export const clueApi = {
  list: (params?: any) => api.get('/clues', { params }),
  get: (id: string) => api.get(`/clues/${id}`),
  create: (data: any) => api.post('/clues', data),
  update: (id: string, data: any) => api.put(`/clues/${id}`, data),
  delete: (id: string) => api.delete(`/clues/${id}`),
  addPerson: (id: string, data: any) => api.post(`/clues/${id}/persons`, data),
  removePerson: (id: string, personId: string) => api.delete(`/clues/${id}/persons/${personId}`),
  getVerifications: (id: string, params?: any) => api.get(`/clues/${id}/verifications`, { params }),
  addVerification: (id: string, data: any) => api.post(`/clues/${id}/verifications`, data),
  updateVerification: (id: string, verificationId: string, data: any) => api.put(`/clues/${id}/verifications/${verificationId}`, data),
  deleteVerification: (id: string, verificationId: string) => api.delete(`/clues/${id}/verifications/${verificationId}`),
};

export const personApi = {
  list: (params?: any) => api.get('/persons', { params }),
  all: () => api.get('/persons/all'),
  get: (id: string) => api.get(`/persons/${id}`),
  create: (data: any) => api.post('/persons', data),
  update: (id: string, data: any) => api.put(`/persons/${id}`, data),
  delete: (id: string) => api.delete(`/persons/${id}`),
  getRelations: (id: string) => api.get(`/persons/${id}/relations`),
  getAllRelations: () => api.get('/persons/relations/all'),
  addRelation: (id: string, data: any) => api.post(`/persons/${id}/relations`, data),
  getRelationTimeline: (id: string) => api.get(`/persons/${id}/relation-timeline`),
  listTags: () => api.get('/persons/tags'),
  createTag: (data: { name: string; category: string; color?: string }) => api.post('/persons/tags', data),
  updateTag: (tagId: string, data: { name?: string; category?: string; color?: string }) => api.put(`/persons/tags/${tagId}`, data),
  deleteTag: (tagId: string) => api.delete(`/persons/tags/${tagId}`),
  suggestTags: (id: string) => api.get(`/persons/suggest-tags/${id}`),
};

export const relationApi = {
  list: (params?: any) => api.get('/relations', { params }),
  graph: (params?: any) => api.get('/relations/graph', { params }),
  get: (id: string) => api.get(`/relations/${id}`),
  create: (data: any) => api.post('/relations', data),
  update: (id: string, data: any) => api.put(`/relations/${id}`, data),
  delete: (id: string) => api.delete(`/relations/${id}`),
};

export const evidenceApi = {
  list: (params?: any) => api.get('/evidences', { params }),
  get: (id: string) => api.get(`/evidences/${id}`),
  create: (data: any) => api.post('/evidences', data),
  upload: (formData: FormData, onProgress?: (progress: number) => void) =>
    api.post('/evidences/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    }),
  analyze: (files: Array<{ fileName: string; mimeType?: string; fileSize?: number }>) =>
    api.post('/evidences/analyze', { files }),
  uploadBatch: (formData: FormData, onProgress?: (progress: number) => void) =>
    api.post('/evidences/upload-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    }),
  listBatches: (params?: any) => api.get('/evidences/batches', { params }),
  getBatch: (id: string) => api.get(`/evidences/batches/${id}`),
  deleteBatch: (id: string) => api.delete(`/evidences/batches/${id}`),
  update: (id: string, data: any) => api.put(`/evidences/${id}`, data),
  delete: (id: string) => api.delete(`/evidences/${id}`),
  download: (id: string) => api.get(`/evidences/${id}/download`, { responseType: 'blob' }),
  getCases: () => api.get('/evidences/cases'),
  getClues: (caseId: string) => api.get(`/evidences/cases/${caseId}/clues`),
  getBorrowRecords: (id: string, params?: any) => api.get(`/evidences/${id}/borrow-records`, { params }),
  borrow: (id: string, data: any) => api.post(`/evidences/${id}/borrow`, data),
  return: (id: string, data: any) => api.put(`/evidences/${id}/return`, data),
  listAllBorrowRecords: (params?: any) => api.get('/evidences/borrow-records/all', { params }),
};

export const evidenceTransferApi = {
  list: (params?: any) => api.get('/evidence-transfers', { params }),
  get: (id: string) => api.get(`/evidence-transfers/${id}`),
  create: (data: any) => api.post('/evidence-transfers', data),
  approve: (id: string, data: any) => api.post(`/evidence-transfers/${id}/approve`, data),
  handle: (id: string, data: any) => api.post(`/evidence-transfers/${id}/handle`, data),
  receive: (id: string, data: any) => api.post(`/evidence-transfers/${id}/receive`, data),
  return: (id: string, data: any) => api.post(`/evidence-transfers/${id}/return`, data),
  destroy: (id: string, data: any) => api.post(`/evidence-transfers/${id}/destroy`, data),
  cancel: (id: string, data: any) => api.put(`/evidence-transfers/${id}/cancel`, data),
  delete: (id: string) => api.delete(`/evidence-transfers/${id}`),
  getLogs: (id: string, params?: any) => api.get(`/evidence-transfers/${id}/logs`, { params }),
  getByEvidence: (evidenceId: string, params?: any) => api.get(`/evidence-transfers/evidence/${evidenceId}`, { params }),
  getStats: () => api.get('/evidence-transfers/stats'),
  getResponsibilityTrace: (params?: any) => api.get('/evidence-transfers/responsibility/trace', { params }),
};

export const searchApi = {
  search: (params?: any) => api.get('/search', { params }),
  advancedSearch: (params?: any) => api.get('/search/advanced', { params }),
  crossCaseDedupe: (params?: any) => api.get('/search/cross-case-dedupe', { params }),
  createCase: (data: any) => api.post('/search/create-case', data),
  stats: () => api.get('/search/stats'),
  options: () => api.get('/search/options'),
};

export const operationLogApi = {
  list: (params?: any) => api.get('/operation-logs', { params }),
  get: (id: string) => api.get(`/operation-logs/${id}`),
  stats: () => api.get('/operation-logs/stats'),
  options: () => api.get('/operation-logs/options'),
  getByTarget: (targetType: string, targetId: string, params?: any) =>
    api.get(`/operation-logs/target/${targetType}/${targetId}`, { params }),
};

export const commandApi = {
  getDashboardOverview: () => api.get('/command/dashboard/overview'),
  listTasks: (params?: any) => api.get('/command/tasks', { params }),
  getTaskStats: () => api.get('/command/tasks/stats'),
  getTaskWarnings: () => api.get('/command/tasks/warnings'),
  getTask: (id: string) => api.get(`/command/tasks/${id}`),
  createTask: (data: any) => api.post('/command/tasks', data),
  updateTask: (id: string, data: any) => api.put(`/command/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/command/tasks/${id}`),
  assignTask: (id: string, data: any) => api.post(`/command/tasks/${id}/assign`, data),
  transferTask: (id: string, data: any) => api.post(`/command/tasks/${id}/transfer`, data),
  completeTask: (id: string, data?: any) => api.post(`/command/tasks/${id}/complete`, data),
  cancelTask: (id: string, data?: any) => api.post(`/command/tasks/${id}/cancel`, data),
  listTaskProgresses: (id: string) => api.get(`/command/tasks/${id}/progresses`),
  addTaskProgress: (id: string, data: any) => api.post(`/command/tasks/${id}/progresses`, data),
  listFlows: (params?: any) => api.get('/command/flows', { params }),
  getFlowStats: () => api.get('/command/flows/stats'),
  createFlow: (data: any) => api.post('/command/flows', data),
  getFlowsBySource: (sourceType: string, sourceId: string) =>
    api.get(`/command/flows/${sourceType}/${sourceId}`),
  checkOverdue: () => api.get('/command/check-overdue'),
};

export const analysisApi = {
  getOverview: () => api.get('/analysis/overview'),
  getCrossCaseAnalysis: (params?: {
    dimensions?: string[];
    minCaseCount?: number;
    startDate?: string;
    endDate?: string;
    caseTypes?: string[];
    caseStatuses?: string[];
  }) => api.get('/analysis/cross-case', { params }),
  getCaseGroups: (params?: { minCaseCount?: number }) => api.get('/analysis/case-groups', { params }),
  getCaseCluster: (caseId: string) => api.get(`/analysis/case-cluster/${caseId}`),
};

export const clueCheckFlowApi = {
  list: (params?: any) => api.get('/clue-check-flows', { params }),
  getStats: () => api.get('/clue-check-flows/stats'),
  get: (id: string) => api.get(`/clue-check-flows/${id}`),
  register: (data: any) => api.post('/clue-check-flows/register', data),
  dispatch: (id: string, data: any) => api.post(`/clue-check-flows/${id}/dispatch`, data),
  verify: (id: string, data: any) => api.post(`/clue-check-flows/${id}/verify`, data),
  feedback: (id: string, data: any) => api.post(`/clue-check-flows/${id}/feedback`, data),
  adopt: (id: string, data: any) => api.post(`/clue-check-flows/${id}/adopt`, data),
  reject: (id: string, data: any) => api.post(`/clue-check-flows/${id}/reject`, data),
  close: (id: string, data: any) => api.post(`/clue-check-flows/${id}/close`, data),
  delete: (id: string) => api.delete(`/clue-check-flows/${id}`),
  getLogs: (id: string, params?: any) => api.get(`/clue-check-flows/${id}/logs`, { params }),
};

export const riskProfileApi = {
  list: (params?: any) => api.get('/risk-profiles', { params }),
  getStats: () => api.get('/risk-profiles/stats'),
  get: (id: string) => api.get(`/risk-profiles/${id}`),
  recalculate: (id: string) => api.get(`/risk-profiles/${id}/recalculate`),
};

export const surveillanceRuleApi = {
  list: (params?: any) => api.get('/surveillance-rules', { params }),
  getStats: () => api.get('/surveillance-rules/stats'),
  get: (id: string) => api.get(`/surveillance-rules/${id}`),
  create: (data: any) => api.post('/surveillance-rules', data),
  update: (id: string, data: any) => api.put(`/surveillance-rules/${id}`, data),
  delete: (id: string) => api.delete(`/surveillance-rules/${id}`),
  toggle: (id: string, data?: any) => api.post(`/surveillance-rules/${id}/toggle`, data),
  getOptions: () => api.get('/surveillance-rules/options'),
};

export const alertApi = {
  list: (params?: any) => api.get('/alerts', { params }),
  getStats: () => api.get('/alerts/stats'),
  get: (id: string) => api.get(`/alerts/${id}`),
  create: (data: any) => api.post('/alerts', data),
  update: (id: string, data: any) => api.put(`/alerts/${id}`, data),
  assign: (id: string, data: any) => api.post(`/alerts/${id}/assign`, data),
  resolve: (id: string, data: any) => api.post(`/alerts/${id}/resolve`, data),
  escalate: (id: string, data: any) => api.post(`/alerts/${id}/escalate`, data),
  addDisposal: (id: string, data: any) => api.post(`/alerts/${id}/disposals`, data),
  getDisposals: (id: string) => api.get(`/alerts/${id}/disposals`),
};

export const caseMeetingApi = {
  list: (params?: any) => api.get('/case-meetings', { params }),
  getStats: () => api.get('/case-meetings/stats'),
  get: (id: string) => api.get(`/case-meetings/${id}`),
  create: (data: any) => api.post('/case-meetings', data),
  update: (id: string, data: any) => api.put(`/case-meetings/${id}`, data),
  delete: (id: string) => api.delete(`/case-meetings/${id}`),
  complete: (id: string, data?: any) => api.post(`/case-meetings/${id}/complete`, data),
  cancel: (id: string, data?: any) => api.post(`/case-meetings/${id}/cancel`, data),

  getAttendees: (id: string) => api.get(`/case-meetings/${id}/attendees`),
  addAttendee: (id: string, data: any) => api.post(`/case-meetings/${id}/attendees`, data),
  removeAttendee: (id: string, attendeeId: string) => api.delete(`/case-meetings/${id}/attendees/${attendeeId}`),

  getClues: (id: string) => api.get(`/case-meetings/${id}/clues`),
  addClue: (id: string, data: any) => api.post(`/case-meetings/${id}/clues`, data),
  updateClue: (id: string, relationId: string, data: any) => api.put(`/case-meetings/${id}/clues/${relationId}`, data),
  removeClue: (id: string, relationId: string) => api.delete(`/case-meetings/${id}/clues/${relationId}`),

  getEvidences: (id: string) => api.get(`/case-meetings/${id}/evidences`),
  addEvidence: (id: string, data: any) => api.post(`/case-meetings/${id}/evidences`, data),
  updateEvidence: (id: string, relationId: string, data: any) => api.put(`/case-meetings/${id}/evidences/${relationId}`, data),
  removeEvidence: (id: string, relationId: string) => api.delete(`/case-meetings/${id}/evidences/${relationId}`),

  getTodos: (id: string) => api.get(`/case-meetings/${id}/todos`),
  addTodo: (id: string, data: any) => api.post(`/case-meetings/${id}/todos`, data),
  updateTodo: (id: string, todoId: string, data: any) => api.put(`/case-meetings/${id}/todos/${todoId}`, data),
  deleteTodo: (id: string, todoId: string) => api.delete(`/case-meetings/${id}/todos/${todoId}`),
  todoToTask: (id: string, todoId: string, data: any) => api.post(`/case-meetings/${id}/todos/${todoId}/to-task`, data),
};

export const forensicApi = {
  list: (params?: any) => api.get('/forensics', { params }),
  get: (id: string) => api.get(`/forensics/${id}`),
  create: (data: any) => api.post('/forensics', data),
  update: (id: string, data: any) => api.put(`/forensics/${id}`, data),
  delete: (id: string) => api.delete(`/forensics/${id}`),
  getStats: () => api.get('/forensics/stats'),
  getOptions: () => api.get('/forensics/options'),
  uploadBatch: (formData: FormData, onProgress?: (progress: number) => void) =>
    api.post('/forensics/upload-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    }),
  verifyHashes: (ids: string[]) => api.post('/forensics/verify-hashes', { forensicFileIds: ids }),
  download: (id: string) => api.post(`/forensics/${id}/download`, {}, { responseType: 'blob' }),
  getCases: () => api.get('/forensics/options').then(res => res.data.cases),
  getClues: (caseId: string) => api.get(`/forensics/cases/${caseId}/clues`),
  bindCase: (data: { forensicFileId: string; caseId: string; relationType?: string; description?: string }) =>
    api.post('/forensics/bind-case', data),
  unbindCase: (data: { forensicFileId: string; caseId: string }) =>
    api.post('/forensics/unbind-case', data),
  bindClue: (data: { forensicFileId: string; clueId: string; relationType?: string; description?: string }) =>
    api.post('/forensics/bind-clue', data),
  unbindClue: (data: { forensicFileId: string; clueId: string }) =>
    api.post('/forensics/unbind-clue', data),
  listBatches: (params?: any) => api.get('/forensics/batches', { params }),
  getBatch: (id: string) => api.get(`/forensics/batches/${id}`),
};

export const timelineApi = {
  list: (params?: any) => api.get('/timelines', { params }),
  get: (id: string) => api.get(`/timelines/${id}`),
  create: (data: any) => api.post('/timelines', data),
  update: (id: string, data: any) => api.put(`/timelines/${id}`, data),
  delete: (id: string) => api.delete(`/timelines/${id}`),
  batch: (data: { ids: string[]; action: 'IMPORTANT' | 'NORMAL' | 'DELETE' }) =>
    api.post('/timelines/batch', data),
  getOptions: () => api.get('/timelines/options'),
  getAggregate: (targetType: 'CASE' | 'CLUE', targetId: string) =>
    api.get(`/timelines/aggregate/${targetType}/${targetId}`),
};

export const approvalApi = {
  getOptions: () => api.get('/approvals/options'),
  listFlows: (params?: any) => api.get('/approvals/flows', { params }),
  getFlow: (id: string) => api.get(`/approvals/flows/${id}`),
  createFlow: (data: any) => api.post('/approvals/flows', data),
  updateFlow: (id: string, data: any) => api.put(`/approvals/flows/${id}`, data),
  deleteFlow: (id: string) => api.delete(`/approvals/flows/${id}`),
  getDefaultFlow: (category: string) => api.get(`/approvals/default/${category}`),
  listInstances: (params?: any) => api.get('/approvals/instances', { params }),
  getInstanceStats: () => api.get('/approvals/instances/stats'),
  getInstance: (id: string) => api.get(`/approvals/instances/${id}`),
  submitInstance: (data: any) => api.post('/approvals/instances', data),
  approveInstance: (id: string, data: any) => api.post(`/approvals/instances/${id}/approve`, data),
  rejectInstance: (id: string, data: any) => api.post(`/approvals/instances/${id}/reject`, data),
  rollbackInstance: (id: string, data: any) => api.post(`/approvals/instances/${id}/rollback`, data),
  cancelInstance: (id: string, data: any) => api.post(`/approvals/instances/${id}/cancel`, data),
  urgeInstance: (id: string, data: any) => api.post(`/approvals/instances/${id}/urge`, data),
  getByTarget: (targetType: string, targetId: string, params?: any) =>
    api.get(`/approvals/instances/target/${targetType}/${targetId}`, { params }),
};

export default api;
