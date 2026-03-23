import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import FinanceProtectedRoute from './components/FinanceProtectedRoute';
import SuperUserRoute from './components/SuperUserRoute';
import { marketingApi } from './api/marketing';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const LandingPageV2 = lazy(() => import('./pages/public/LandingPageV2'));
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/public/TermsPage'));
const PersonalDataPage = lazy(() => import('./pages/public/PersonalDataPage'));
const OfferPage = lazy(() => import('./pages/public/OfferPage'));
const LegalContactsPage = lazy(() => import('./pages/public/LegalContactsPage'));
const CookiePolicyPage = lazy(() => import('./pages/public/CookiePolicyPage'));
const BlogLayoutWrapper = lazy(() => import('./components/BlogLayoutWrapper'));
const Layout = lazy(() => import('./components/Layout'));
const PublicLayout = lazy(() => import('./components/PublicLayout'));
const RootRedirect = lazy(() => import('./components/RootRedirect'));
const SaasLayout = lazy(() => import('./components/SaasLayout'));
const CookieConsentBar = lazy(() => import('./components/CookieConsentBar'));

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const NotesPageViewPage = lazy(() => import('./pages/NotesPageViewPage'));
const PersonalWikiPage = lazy(() => import('./pages/PersonalWikiPage'));
const DocumentsHubPage = lazy(() => import('./pages/DocumentsHubPage'));
const KanbanPage = lazy(() => import('./pages/KanbanPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage'));
const WorkspaceDetailPage = lazy(() => import('./pages/WorkspaceDetailPage'));
const WorkspaceDirectorPage = lazy(() => import('./pages/WorkspaceDirectorPage'));
const HrPage = lazy(() => import('./pages/hr/HrPage'));
const PayrollPage = lazy(() => import('./pages/hr/PayrollPage'));
const ContactDetailPage = lazy(() => import('./pages/hr/ContactDetailPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const AiMarketplacePage = lazy(() => import('./pages/ai/AiMarketplacePage'));
const TeamComparisonPage = lazy(() => import('./pages/ai/TeamComparisonPage'));
const MindMapsPage = lazy(() => import('./pages/MindMapsPage'));
const MindMapEditorPage = lazy(() => import('./pages/MindMapEditorPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const SubscriptionPage = lazy(() => import('./pages/account/SubscriptionPage'));
const PaymentsPage = lazy(() => import('./pages/account/PaymentsPage'));
const UpgradePage = lazy(() => import('./pages/account/UpgradePage'));
const PaymentReturnPage = lazy(() => import('./pages/account/PaymentReturnPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const SaasDashboardPage = lazy(() => import('./pages/saas/SaasDashboardPage'));
const SaasPlansPage = lazy(() => import('./pages/saas/SaasPlansPage'));
const SaasUsersPage = lazy(() => import('./pages/saas/SaasUsersPage'));
const SaasUserDetailPage = lazy(() => import('./pages/saas/SaasUserDetailPage'));
const SaasBlogPage = lazy(() => import('./pages/saas/SaasBlogPage'));
const SaasAdsPage = lazy(() => import('./pages/saas/SaasAdsPage'));
const SaasIntegrationsPage = lazy(() => import('./pages/saas/SaasIntegrationsPage'));

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

function LandingDefaultEntry() {
  const { data } = useQuery({
    queryKey: ['public-settings', 'landing-default-version'],
    queryFn: () => marketingApi.getPublicSettings(),
    staleTime: 60_000,
  });
  const v = data?.landing_default_version;
  if (v === 'v1') return <Suspense fallback={<PageFallback />}><LandingPage /></Suspense>;
  return <Suspense fallback={<PageFallback />}><LandingPageV2 /></Suspense>;
}

function App() {
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <CookieConsentBar />
      </Suspense>
      <Routes>
        <Route path="/" element={<Outlet />}>
          <Route index element={<Suspense fallback={<PageFallback />}><RootRedirect /></Suspense>} />
          <Route path="login" element={<Suspense fallback={<PageFallback />}><LoginPage /></Suspense>} />
          <Route path="register" element={<Suspense fallback={<PageFallback />}><RegisterPage /></Suspense>} />
          <Route path="forgot-password" element={<Suspense fallback={<PageFallback />}><ForgotPasswordPage /></Suspense>} />
          <Route path="landing" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<LandingDefaultEntry />} />
          </Route>
          <Route path="landing1" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><LandingPage /></Suspense>} />
          </Route>
          <Route path="landing2" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><LandingPageV2 /></Suspense>} />
          </Route>
          <Route path="privacy" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><PrivacyPage /></Suspense>} />
          </Route>
          <Route path="terms" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><TermsPage /></Suspense>} />
          </Route>
          <Route path="personal-data" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><PersonalDataPage /></Suspense>} />
          </Route>
          <Route path="offer" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><OfferPage /></Suspense>} />
          </Route>
          <Route path="legal/contacts" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><LegalContactsPage /></Suspense>} />
          </Route>
          <Route path="cookies" element={<Suspense fallback={<PageFallback />}><PublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><CookiePolicyPage /></Suspense>} />
          </Route>
          <Route path="blog" element={<Suspense fallback={<PageFallback />}><BlogLayoutWrapper /></Suspense>}>
            <Route index element={<Suspense fallback={<PageFallback />}><BlogPage /></Suspense>} />
            <Route path=":slug" element={<Suspense fallback={<PageFallback />}><BlogPostPage /></Suspense>} />
          </Route>
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageFallback />}>
                  <Layout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
            <Route path="workspaces" element={<Suspense fallback={<PageFallback />}><WorkspacesPage /></Suspense>} />
            <Route path="workspaces/:id" element={<Suspense fallback={<PageFallback />}><WorkspaceDetailPage /></Suspense>} />
            <Route path="workspaces/:id/director" element={<Suspense fallback={<PageFallback />}><WorkspaceDirectorPage /></Suspense>} />
            <Route path="projects" element={<Suspense fallback={<PageFallback />}><ProjectsPage /></Suspense>} />
            <Route path="projects/:id" element={<Suspense fallback={<PageFallback />}><ProjectDetailPage /></Suspense>} />
            <Route path="projects/:id/wiki/page/:pageId" element={<Suspense fallback={<PageFallback />}><WikiPageViewPage /></Suspense>} />
            <Route path="tasks" element={<Suspense fallback={<PageFallback />}><TasksPage /></Suspense>} />
            <Route path="tasks/:id" element={<TaskIdRedirect />} />
            <Route path="notes" element={<Suspense fallback={<PageFallback />}><NotesPage /></Suspense>} />
            <Route path="notes/page/:pageId" element={<Suspense fallback={<PageFallback />}><NotesPageViewPage /></Suspense>} />
            <Route path="documents" element={<Suspense fallback={<PageFallback />}><DocumentsHubPage /></Suspense>} />
            <Route path="documents/files" element={<Suspense fallback={<PageFallback />}><DocumentsHubPage /></Suspense>} />
            <Route path="documents/notes" element={<Suspense fallback={<PageFallback />}><DocumentsHubPage /></Suspense>} />
            <Route path="documents/notebook/:rootId" element={<Suspense fallback={<PageFallback />}><PersonalWikiPage /></Suspense>} />
            <Route path="documents/notebook/:rootId/page/:pageId" element={<Suspense fallback={<PageFallback />}><PersonalWikiPage /></Suspense>} />
            <Route path="documents/page/:pageId" element={<Suspense fallback={<PageFallback />}><PersonalWikiPage /></Suspense>} />
            <Route path="kanban/:boardId?" element={<Suspense fallback={<PageFallback />}><KanbanPage /></Suspense>} />
            <Route path="gantt" element={<Suspense fallback={<PageFallback />}><GanttPage /></Suspense>} />
            <Route path="gantt/:id" element={<Suspense fallback={<PageFallback />}><GanttPage /></Suspense>} />
            <Route path="calendar" element={<Suspense fallback={<PageFallback />}><CalendarPage /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<PageFallback />}><AnalyticsPage /></Suspense>} />
            <Route path="contacts" element={<Suspense fallback={<PageFallback />}><ContactsPage /></Suspense>} />
            <Route path="hr" element={<FinanceProtectedRoute><Suspense fallback={<PageFallback />}><HrPage /></Suspense></FinanceProtectedRoute>} />
            <Route path="hr/contacts/:id" element={<Suspense fallback={<PageFallback />}><ContactDetailPage /></Suspense>} />
            <Route path="hr/payroll" element={<FinanceProtectedRoute><Suspense fallback={<PageFallback />}><PayrollPage /></Suspense></FinanceProtectedRoute>} />
            <Route path="finance" element={<FinanceProtectedRoute><Suspense fallback={<PageFallback />}><FinancePage /></Suspense></FinanceProtectedRoute>} />
            <Route path="ai/marketplace" element={<Suspense fallback={<PageFallback />}><AiMarketplacePage /></Suspense>} />
            <Route path="ai/team-comparison" element={<Suspense fallback={<PageFallback />}><TeamComparisonPage /></Suspense>} />
            <Route path="mindmaps" element={<Suspense fallback={<PageFallback />}><MindMapsPage /></Suspense>} />
            <Route path="mindmaps/new" element={<Suspense fallback={<PageFallback />}><MindMapEditorPage /></Suspense>} />
            <Route path="mindmaps/:id" element={<Suspense fallback={<PageFallback />}><MindMapEditorPage /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>} />
            <Route path="settings/password" element={<Suspense fallback={<PageFallback />}><ChangePasswordPage /></Suspense>} />
            {/* ── Личный кабинет ── */}
            <Route path="account" element={<Suspense fallback={<PageFallback />}><AccountLayout /></Suspense>}>
              <Route index element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>} />
              <Route path="subscription" element={<Suspense fallback={<PageFallback />}><SubscriptionPage /></Suspense>} />
              <Route path="payments" element={<Suspense fallback={<PageFallback />}><PaymentsPage /></Suspense>} />
              <Route path="upgrade" element={<Suspense fallback={<PageFallback />}><UpgradePage /></Suspense>} />
              {/* R2: куда редиректит ЮКасса после оплаты (YOOKASSA_RETURN_URL) */}
              <Route path="payment-return" element={<Suspense fallback={<PageFallback />}><PaymentReturnPage /></Suspense>} />
            </Route>
          </Route>
        </Route>

        <Route path="/saas-admin" element={<SuperUserRoute><Suspense fallback={<PageFallback />}><SaasLayout /></Suspense></SuperUserRoute>}>
          <Route index element={<Suspense fallback={<PageFallback />}><SaasDashboardPage /></Suspense>} />
          <Route path="plans" element={<Suspense fallback={<PageFallback />}><SaasPlansPage /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<PageFallback />}><SaasUsersPage /></Suspense>} />
          <Route path="users/:id" element={<Suspense fallback={<PageFallback />}><SaasUserDetailPage /></Suspense>} />
          <Route path="blog" element={<Suspense fallback={<PageFallback />}><SaasBlogPage /></Suspense>} />
          <Route path="ads" element={<Suspense fallback={<PageFallback />}><SaasAdsPage /></Suspense>} />
          <Route path="integrations" element={<Suspense fallback={<PageFallback />}><SaasIntegrationsPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
