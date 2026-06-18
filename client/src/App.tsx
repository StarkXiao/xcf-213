import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import CaseList from './pages/cases/CaseList';
import CaseDetail from './pages/cases/CaseDetail';
import CaseForm from './pages/cases/CaseForm';
import ClueList from './pages/clues/ClueList';
import ClueDetail from './pages/clues/ClueDetail';
import ClueForm from './pages/clues/ClueForm';
import PersonList from './pages/persons/PersonList';
import PersonDetail from './pages/persons/PersonDetail';
import PersonForm from './pages/persons/PersonForm';
import RelationGraph from './pages/relations/RelationGraph';
import EvidenceList from './pages/evidences/EvidenceList';
import EvidenceDetail from './pages/evidences/EvidenceDetail';
import EvidenceUpload from './pages/evidences/EvidenceUpload';
import AdvancedSearch from './pages/search/AdvancedSearch';
import OperationLogList from './pages/logs/OperationLogList';
import CrossCaseAnalysis from './pages/analysis/CrossCaseAnalysis';

const { Content } = Layout;

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Content style={{ minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/cases" element={<CaseList />} />
            <Route path="/cases/new" element={<CaseForm />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/cases/:id/edit" element={<CaseForm />} />

            <Route path="/clues" element={<ClueList />} />
            <Route path="/clues/new" element={<ClueForm />} />
            <Route path="/clues/:id" element={<ClueDetail />} />
            <Route path="/clues/:id/edit" element={<ClueForm />} />

            <Route path="/persons" element={<PersonList />} />
            <Route path="/persons/new" element={<PersonForm />} />
            <Route path="/persons/:id" element={<PersonDetail />} />
            <Route path="/persons/:id/edit" element={<PersonForm />} />

            <Route path="/relations" element={<RelationGraph />} />

            <Route path="/evidences" element={<EvidenceList />} />
            <Route path="/evidences/upload" element={<EvidenceUpload />} />
            <Route path="/evidences/:id" element={<EvidenceDetail />} />

            <Route path="/search" element={<AdvancedSearch />} />

            <Route path="/analysis" element={<CrossCaseAnalysis />} />

            <Route path="/operation-logs" element={<OperationLogList />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
