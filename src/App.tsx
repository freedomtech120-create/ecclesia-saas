import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Toaster } from 'sonner';
import { AuthForm } from './components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Church } from 'lucide-react';
import MembersPage from './pages/members/MembersPage';
import MemberProfilePage from './pages/members/MemberProfilePage';
import StaffPage from './pages/staff/StaffPage';
import BranchesPage from './pages/branches/BranchesPage';
import BranchProfilePage from './pages/branches/BranchProfilePage';
import FinancesPage from './pages/finances/FinancesPage';
import ServicesPage from './pages/services/ServicesPage';
import AttendancePage from './pages/attendance/AttendancePage';
import BranchDashboardPage from './pages/dashboard/BranchDashboardPage';

import AdminPanel from './pages/admin/AdminPanel';

// Placeholder Pages
const LandingPage = () => (
  <div className="flex flex-col min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
    <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
          <Church className="w-5 h-5" />
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-900">Ecclesia</span>
      </div>
      <div className="flex items-center gap-6">
        <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Login</Link>
        <Link to="/login" className="px-5 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5">
          Get Started
        </Link>
      </div>
    </nav>
    
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto py-24">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        New: Multi-Branch Management
      </div>
      <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.1]">
        Manage your Church with <span className="text-indigo-600">Excellence.</span>
      </h1>
      <p className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12 leading-relaxed">
        The all-in-one cloud platform for modern churches. Organize congregations, track growth, manage finances, and empower your ministry from anywhere.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/login" className="px-8 py-4 bg-indigo-600 text-white rounded-xl text-lg font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-105">
          Start Free Trial
        </Link>
        <Button variant="outline" className="px-8 py-4 h-auto border-slate-200 text-slate-600 rounded-xl text-lg font-bold hover:bg-slate-50 transition-all">
          Book a Demo
        </Button>
      </div>
      
      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 w-full opacity-40 grayscale">
        <div className="flex items-center justify-center font-bold text-2xl tracking-tighter">TRUSTED</div>
        <div className="flex items-center justify-center font-bold text-2xl tracking-tighter">MINISTRY</div>
        <div className="flex items-center justify-center font-bold text-2xl tracking-tighter">FAITHFUL</div>
        <div className="flex items-center justify-center font-bold text-2xl tracking-tighter">HARVEST</div>
      </div>
    </main>
  </div>
);

const LoginPage = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4 font-sans">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
       <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
       <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
    </div>
    <div className="relative w-full max-w-md">
      <AuthForm />
      <p className="text-center mt-8 text-xs text-slate-400 font-medium tracking-wide uppercase">
        Protected by Ecclesia Advanced Security
      </p>
    </div>
  </div>
);

const UserDashboard = () => {
  const { profile, isPastor } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPastor && profile?.staffData?.assignedBranchId && profile.staffData.assignedBranchId !== 'none') {
      navigate('/dashboard/branch', { replace: true });
    }
  }, [isPastor, profile, navigate]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {profile?.displayName}. Here's what's happening at {tenant?.name || 'your church'}.</p>
      </div>
      
      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Members', value: '1,248', change: '+12%', trend: 'up' },
          { label: 'Monthly Revenue', value: '$42,850', change: '+5.2%', trend: 'up' },
          { label: 'Avg. Attendance', value: '842', change: '-2%', trend: 'down' },
          { label: 'Active Branches', value: '14', change: 'Stable', trend: 'neutral' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded",
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
        </div>

        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-900">Recent Activity</h3>
          </div>
          <div className="flex-1 p-4 space-y-6">
            {[
              { name: 'Sarah Jenkins', type: 'Tithe', time: '2 mins ago', amount: '$250.00', icon: '$', color: 'emerald' },
              { name: 'Youth Camp', type: 'Registration', time: '1 hr ago', amount: '$45.00', icon: 'E', color: 'indigo' },
              { name: 'Michael Thorne', type: 'Offering', time: '3 hrs ago', amount: '$1,200.00', icon: '$', color: 'emerald' },
              { name: 'Staff Salaries', type: 'Expense', time: '5 hrs ago', amount: '-$8,400.00', icon: 'B', color: 'slate' },
            ].map((act, i) => (
              <div key={i} className="flex items-center gap-4 group cursor-pointer">
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
                  "text-sm font-bold tabular-nums",
                  act.amount.startsWith('-') ? "text-slate-400" : "text-slate-900"
                )}>
                  {act.amount}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100">
            <Button variant="ghost" className="w-full text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700">
              View All Activity
            </Button>
          </div>
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
              <Route path="settings" element={<div>Church Settings</div>} />
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
