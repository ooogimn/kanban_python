import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import DashboardPage from './pages/DashboardPage';
import KanbanPage from './pages/KanbanPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TasksPage from './pages/TasksPage';
import NotesPage from './pages/NotesPage';
import NotesPageViewPage from './pages/NotesPageViewPage';
import PersonalWikiPage from './pages/PersonalWikiPage';
import DocumentsHubPage from './pages/DocumentsHubPage';
import WorkspacesPage from './pages/WorkspacesPage';
import WorkspaceDetailPage from './pages/WorkspaceDetailPage';
import WorkspaceDirectorPage from './pages/WorkspaceDirectorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import InvoicesPage from './pages/InvoicesPage';
import FinancePage from './pages/FinancePage';
import ContactsPage from './pages/ContactsPage';
import AiMarketplacePage from './pages/ai/AiMarketplacePage';
import TeamComparisonPage from './pages/ai/TeamComparisonPage';
import MindMapsPage from './pages/MindMapsPage';
import MindMapEditorPage from './pages/MindMapEditorPage';
import PayrollPage from './pages/hr/PayrollPage';
import HrPage from './pages/hr/HrPage';
import ContactDetailPage from './pages/hr/ContactDetailPage';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import BlogLayoutWrapper from './components/BlogLayoutWrapper';
import ProtectedRoute from './components/ProtectedRoute';
import FinanceProtectedRoute from './components/FinanceProtectedRoute';
import SuperUserRoute from './components/SuperUserRoute';
import RootRedirect from './components/RootRedirect';
import SaasLayout from './components/SaasLayout';
import LandingPage from './pages/public/LandingPage';
import PrivacyPage from './pages/public/PrivacyPage';
import TermsPage from './pages/public/TermsPage';
import PersonalDataPage from './pages/public/PersonalDataPage';
import OfferPage from './pages/public/OfferPage';
import LegalContactsPage from './pages/public/LegalContactsPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import SaasDashboardPage from './pages/saas/SaasDashboardPage';
import SaasPlansPage from './pages/saas/SaasPlansPage';
import SaasUsersPage from './pages/saas/SaasUsersPage';
import SaasUserDetailPage from './pages/saas/SaasUserDetailPage';
import SaasBlogPage from './pages/saas/SaasBlogPage';
import SaasAdsPage from './pages/saas/SaasAdsPage';

const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const GanttPage = lazy(() => import('./pages/GanttPage'));
const WikiPageViewPage = lazy(() => import('./pages/WikiPageViewPage'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[320px] text-slate-500 dark:text-slate-400">
      Загрузка…
    </div>
  );
}

function TaskIdRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/tasks?task=${id}` : '/tasks'} replace />;
}

function App() {
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Outlet />}>
          <Route index element={<RootRedirect />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="landing" element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
          </Route>
          <Route path="privacy" element={<PublicLayout />}>
            <Route index element={<PrivacyPage />} />
          </Route>
          <Route path="terms" element={<PublicLayout />}>
            <Route index element={<TermsPage />} />
          </Route>
          <Route path="personal-data" element={<PublicLayout />}>
            <Route index element={<PersonalDataPage />} />
          </Route>
          <Route path="offer" element={<PublicLayout />}>
            <Route index element={<OfferPage />} />
          </Route>
          <Route path="legal/contacts" element={<PublicLayout />}>
            <Route index element={<LegalContactsPage />} />
          </Route>
          <Route path="blog" element={<BlogLayoutWrapper />}>
            <Route index element={<BlogPage />} />
            <Route path=":slug" element={<BlogPostPage />} />
          </Route>
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="workspaces" element={<WorkspacesPage />} />
            <Route path="workspaces/:id" element={<WorkspaceDetailPage />} />
            <Route path="workspaces/:id/director" element={<WorkspaceDirectorPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="projects/:id/wiki/page/:pageId" element={<Suspense fallback={<PageFallback />}><WikiPageViewPage /></Suspense>} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:id" element={<TaskIdRedirect />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="notes/page/:pageId" element={<NotesPageViewPage />} />
            <Route path="documents" element={<DocumentsHubPage />} />
            <Route path="documents/files" element={<DocumentsHubPage />} />
            <Route path="documents/notes" element={<DocumentsHubPage />} />
            <Route path="documents/notebook/:rootId" element={<PersonalWikiPage />} />
            <Route path="documents/notebook/:rootId/page/:pageId" element={<PersonalWikiPage />} />
            <Route path="documents/page/:pageId" element={<PersonalWikiPage />} />
            <Route path="kanban/:boardId?" element={<KanbanPage />} />
            <Route path="gantt" element={<Suspense fallback={<PageFallback />}><GanttPage /></Suspense>} />
            <Route path="gantt/:id" element={<Suspense fallback={<PageFallback />}><GanttPage /></Suspense>} />
            <Route path="calendar" element={<Suspense fallback={<PageFallback />}><CalendarPage /></Suspense>} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="hr" element={<FinanceProtectedRoute><HrPage /></FinanceProtectedRoute>} />
            <Route path="hr/contacts/:id" element={<ContactDetailPage />} />
            <Route path="hr/payroll" element={<FinanceProtectedRoute><PayrollPage /></FinanceProtectedRoute>} />
            <Route path="finance" element={<FinanceProtectedRoute><FinancePage /></FinanceProtectedRoute>} />
            <Route path="ai/marketplace" element={<AiMarketplacePage />} />
            <Route path="ai/team-comparison" element={<TeamComparisonPage />} />
            <Route path="mindmaps" element={<MindMapsPage />} />
            <Route path="mindmaps/new" element={<MindMapEditorPage />} />
            <Route path="mindmaps/:id" element={<MindMapEditorPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings/password" element={<ChangePasswordPage />} />
          </Route>
        </Route>

        <Route path="/saas-admin" element={<SuperUserRoute><SaasLayout /></SuperUserRoute>}>
          <Route index element={<SaasDashboardPage />} />
          <Route path="plans" element={<SaasPlansPage />} />
          <Route path="users" element={<SaasUsersPage />} />
          <Route path="users/:id" element={<SaasUserDetailPage />} />
          <Route path="blog" element={<SaasBlogPage />} />
          <Route path="ads" element={<SaasAdsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
