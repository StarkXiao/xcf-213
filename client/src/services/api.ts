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

export default api;
