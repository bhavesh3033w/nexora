import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Bot, CalendarDays, GraduationCap, KanbanSquare, LayoutDashboard, ListChecks, MessagesSquare, BarChart3, Settings as Cog } from 'lucide-react';
import { AuthProvider, RequireRole } from '../features/auth/AuthContext';
import { OnboardingGate, PrefsProvider } from '../features/personalization/PrefsContext';
import Shell, { NotificationBell, type NavItem } from '../components/Shell';
import Landing from '../pages/Landing';
import { AdminLogin, AdminRegister, ForgotPassword, NotFound, UserLogin, UserRegister } from '../pages/AuthPages';
import Onboarding from '../pages/Onboarding';
import Dashboard from '../pages/Dashboard';
import Settings from '../pages/Settings';
import Meetings from '../pages/workspaces/Meetings';
import MeetingDetail from '../pages/workspaces/MeetingDetail';
import MeetingInsights from '../pages/workspaces/MeetingInsights';
import ActionTracker from '../pages/workspaces/ActionTracker';
import Communication from '../pages/workspaces/Communication';
import Study from '../pages/workspaces/Study';
import Projects from '../pages/workspaces/Projects';
import Analytics from '../pages/workspaces/Analytics';
import Assistant from '../pages/workspaces/Assistant';
import { AdminActivity, AdminAnalytics, AdminLayout, AdminOverview, AdminProjects, AdminSettings, AdminUsers } from '../pages/admin/Admin';

const USER_NAV: NavItem[] = [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/app/meetings', label: 'Meetings', icon: CalendarDays }, { to: '/app/tracker', label: 'Action Tracker', icon: ListChecks }, { to: '/app/communication', label: 'Communication', icon: MessagesSquare },
  { to: '/app/study', label: 'Study & Learning', icon: GraduationCap }, { to: '/app/projects', label: 'Projects', icon: KanbanSquare }, { to: '/app/analytics', label: 'Analytics', icon: BarChart3 }, { to: '/app/assistant', label: 'AI Assistant', icon: Bot }, { to: '/app/settings', label: 'Settings', icon: Cog }];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><PrefsProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin/login" element={<AdminLogin />} /><Route path="/admin/register" element={<AdminRegister />} />
          <Route path="/user/login" element={<UserLogin />} /><Route path="/user/register" element={<UserRegister />} /><Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={<RequireRole role="user"><Onboarding /></RequireRole>} />
          <Route path="/app" element={<RequireRole role="user"><OnboardingGate><Shell variant="user" items={USER_NAV} extra={<NotificationBell />} /></OnboardingGate></RequireRole>}>
            <Route index element={<Dashboard />} /><Route path="meetings" element={<Meetings />} /><Route path="meetings/insights" element={<MeetingInsights />} /><Route path="meetings/:id" element={<MeetingDetail />} /><Route path="tracker" element={<ActionTracker />} /><Route path="communication" element={<Communication />} /><Route path="study" element={<Study />} />
            <Route path="projects" element={<Projects />} /><Route path="analytics" element={<Analytics />} /><Route path="assistant" element={<Assistant />} /><Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
            <Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<AdminOverview />} /><Route path="users" element={<AdminUsers />} />
            <Route path="analytics" element={<AdminAnalytics />} /><Route path="projects" element={<AdminProjects />} /><Route path="activity" element={<AdminActivity />} /><Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PrefsProvider></AuthProvider>
    </BrowserRouter>
  );
}
