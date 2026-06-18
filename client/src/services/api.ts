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
};

export const clueApi = {
  list: (params?: any) => api.get('/clues', { params }),
  get: (id: string) => api.get(`/clues/${id}`),
  create: (data: any) => api.post('/clues', data),
  update: (id: string, data: any) => api.put(`/clues/${id}`, data),
  delete: (id: string) => api.delete(`/clues/${id}`),
  addPerson: (id: string, data: any) => api.post(`/clues/${id}/persons`, data),
  removePerson: (id: string, personId: string) => api.delete(`/clues/${id}/persons/${personId}`),
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
  update: (id: string, data: any) => api.put(`/evidences/${id}`, data),
  delete: (id: string) => api.delete(`/evidences/${id}`),
  download: (id: string) => api.get(`/evidences/${id}/download`, { responseType: 'blob' }),
  getCases: () => api.get('/evidences/cases'),
  getClues: (caseId: string) => api.get(`/evidences/cases/${caseId}/clues`),
};

export const searchApi = {
  search: (params?: any) => api.get('/search', { params }),
  advancedSearch: (params?: any) => api.get('/search/advanced', { params }),
  stats: () => api.get('/search/stats'),
  options: () => api.get('/search/options'),
};

export default api;
