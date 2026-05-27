import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { format } from 'date-fns';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Toaster } from 'sonner';
import { AuthForm } from './components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Church, ArrowLeft } from 'lucide-react';
import MembersPage from './pages/members/MembersPage';
import MemberProfilePage from './pages/members/MemberProfilePage';
import StaffPage from './pages/staff/StaffPage';
import BranchesPage from './pages/branches/BranchesPage';
import BranchProfilePage from './pages/branches/BranchProfilePage';
import FinancesPage from './pages/finances/FinancesPage';
import ServicesPage from './pages/services/ServicesPage';
import AttendancePage from './pages/attendance/AttendancePage';
import BranchDashboardPage from './pages/dashboard/BranchDashboardPage';
import CommunicationsPage from './pages/communications/CommunicationsPage';
import GroupsPage from './pages/groups/GroupsPage';
import LandingPage from './pages/public/LandingPage';
import PublicFormPage from './pages/public/PublicFormPage';
import SettingsPage from './pages/settings/SettingsPage';
import TransfersPage from './pages/transfers/TransfersPage';
import AssessmentsPage from './pages/assessments/AssessmentsPage';
import EventsPage from './pages/events/EventsPage';
import NotificationCenterPage from './pages/notifications/NotificationCenterPage';

import AdminPanel from './pages/admin/AdminPanel';

const LoginPage = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4 font-sans">
    <Link 
      to="/" 
      className="absolute top-6 left-6 z-10 flex items-center gap-2 px-4 py-2.5 bg-white rounded-full border border-slate-200 shadow-sm text-[10px] font-black text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all hover:-translate-x-1 uppercase tracking-widest"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Return Home
    </Link>
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
       <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
       <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
    </div>
    <div className="relative w-full max-w-md">
      <AuthForm />
      <p className="text-center mt-8 text-xs text-slate-400 font-medium tracking-wide uppercase">
        Protected by Siasore Advanced Security
      </p>
    </div>
  </div>
);

const UserDashboard = () => {
  const { profile, isPastor } = useAuth();
  const { tenant, effectiveTenantId } = useTenant();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    members: 0,
    monthlyRevenue: 0,
    avgAttendance: 0,
    activeBranches: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPastor && profile?.staffData?.assignedBranchId && profile.staffData.assignedBranchId !== 'none') {
      navigate('/dashboard/branch', { replace: true });
      return;
    }

    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch counts in parallel
        const [membersSnap, branchesSnap, financesSnap, attendanceSnap] = await Promise.all([
          getDocs(query(collection(db, 'members'), where('tenantId', '==', effectiveTenantId))),
          getDocs(query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId))),
          getDocs(query(collection(db, 'finances'), where('tenantId', '==', effectiveTenantId))),
          getDocs(query(collection(db, 'attendance'), where('tenantId', '==', effectiveTenantId)))
        ]);

        // Calculate Revenue (Total Income - Total Expenses)
        let incomeSum = 0;
        let expensesSum = 0;
        const rawFinances = financesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        rawFinances.forEach((f: any) => {
          if (f.type === 'expense') {
            expensesSum += (f.amount || 0);
          } else {
            incomeSum += (f.amount || 0);
          }
        });

        // Recent Activity
        const sortedFinances = [...rawFinances].sort((a: any, b: any) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return tB - tA;
        });

        const recentActs = sortedFinances.slice(0, 4).map((f: any) => {
          const dateStr = f.createdAt?.toDate ? format(f.createdAt.toDate(), 'PPP') : 'Recently';
          return {
            name: f.contributor || f.description || 'Anonymous Contribution',
            type: f.type || 'Offering',
            time: dateStr,
            amount: f.type === 'expense' ? `-$${parseFloat(f.amount || 0).toFixed(2)}` : `+$${parseFloat(f.amount || 0).toFixed(2)}`,
            icon: f.type === 'expense' ? 'B' : '$',
            color: f.type === 'expense' ? 'slate' : 'emerald'
          };
        });

        // Calculate Average Attendance
        let attendanceSum = 0;
        let attendanceCount = 0;
        attendanceSnap.docs.forEach(doc => {
          const d = doc.data();
          if (d.presentCount !== undefined) {
            attendanceSum += d.presentCount;
            attendanceCount++;
          }
        });

        const avgAttendance = attendanceCount > 0 ? Math.round(attendanceSum / attendanceCount) : 0;

        setStats({
          members: membersSnap.size,
          monthlyRevenue: incomeSum - expensesSum,
          avgAttendance,
          activeBranches: branchesSnap.size,
        });

        setRecentActivity(recentActs);
      } catch (err) {
        console.error("Error loading user dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [effectiveTenantId, isPastor, profile, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading Analytics...</p>
      </div>
    );
  }

  const statItems = [
    { label: 'Total Members', value: stats.members.toLocaleString(), change: stats.members > 0 ? 'Active' : 'No members yet', trend: stats.members > 0 ? 'up' : 'neutral' },
    { label: 'Monthly Net Funds', value: `GH₵${stats.monthlyRevenue.toLocaleString()}`, change: stats.monthlyRevenue >= 0 ? 'Stable' : 'Deficit', trend: stats.monthlyRevenue >= 0 ? 'up' : 'down' },
    { label: 'Avg. Attendance', value: stats.avgAttendance.toLocaleString(), change: stats.avgAttendance > 0 ? 'Recorded' : 'No records yet', trend: stats.avgAttendance > 0 ? 'up' : 'neutral' },
    { label: 'Active Branches', value: stats.activeBranches.toLocaleString(), change: stats.activeBranches > 0 ? 'Registered' : 'No branches yet', trend: 'neutral' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {profile?.displayName}. Here's what's happening at {tenant?.name || 'your church'}.</p>
      </div>
      
      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                stat.trend === 'up' ? "text-emerald-600 bg-emerald-50" : 
                stat.trend === 'down' ? "text-amber-600 bg-amber-50" : 
                "text-slate-400 bg-slate-50"
              )}>
                {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Visual Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-slate-900">Attendance Trends</h3>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Youth
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-slate-200"></div> General
              </span>
            </div>
          </div>
          
          {stats.avgAttendance > 0 ? (
            <div className="flex-1 flex items-end gap-6 px-4">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                  <div className="w-full flex items-end gap-1.5 h-full max-h-[250px]">
                    <div 
                      className="flex-1 bg-slate-100 rounded-t-md transition-all duration-500 group-hover:bg-slate-200" 
                      style={{ height: `${40 + (i * 10)}%` }}
                    ></div>
                    <div 
                      className="flex-1 bg-indigo-500 rounded-t-md transition-all duration-500 group-hover:bg-indigo-600" 
                      style={{ height: `${20 + (i * 12)}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{month}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl p-8 text-center bg-slate-50/50">
              <p className="font-bold text-slate-700 text-sm">No Attendance Recorded</p>
              <p className="text-slate-400 text-xs mt-1 max-w-sm">Use the Attendance tab to take down service registries. Trends show up here automatically.</p>
              <Button size="sm" variant="outline" className="mt-4 text-xs font-bold uppercase tracking-widest" onClick={() => navigate('/dashboard/attendance')}>Register Attendance</Button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-900">Recent Activity</h3>
          </div>
          {recentActivity.length > 0 ? (
            <div className="flex-1 p-4 space-y-6">
              {recentActivity.map((act, i) => (
                <div key={i} className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/dashboard/finances')}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110",
                    act.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                    act.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {act.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{act.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{act.type} • {act.time}</div>
                  </div>
                  <div className={cn(
                    "text-xs font-bold tabular-nums",
                    act.amount.startsWith('-') ? "text-slate-400" : "text-slate-900"
                  )}>
                    {act.amount}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
              <p className="font-bold text-slate-600 text-xs uppercase tracking-wider">No Activity Yet</p>
              <p className="text-slate-400 text-[10px] mt-1.5 max-w-[200px] leading-relaxed">Transactions entered on your branch ledgers appear here.</p>
              <Button size="sm" variant="ghost" className="mt-4 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50" onClick={() => navigate('/dashboard/finances')}>Go to Finances</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading Auth...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <TenantProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/f/:formId" element={<PublicFormPage />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<UserDashboard />} />
              <Route path="branch" element={<BranchDashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:memberId" element={<MemberProfilePage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="branches" element={<BranchesPage />} />
              <Route path="branches/:branchId" element={<BranchProfilePage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="finances" element={<FinancesPage />} />
              <Route path="communications" element={<CommunicationsPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="transfers" element={<TransfersPage />} />
              <Route path="assessments" element={<AssessmentsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="notifications" element={<NotificationCenterPage />} />
            </Route>

            <Route path="/admin" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminPanel />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Toaster position="top-right" />
        </TenantProvider>
      </AuthProvider>
    </Router>
  );
}
