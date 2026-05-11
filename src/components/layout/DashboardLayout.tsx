import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Church, LayoutDashboard, Users, MapPin, Calendar, FileText, Settings, LogOut, Shield, ChevronRight, Briefcase, BarChart3, MessageSquare, Layers, CreditCard } from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';

export function DashboardLayout() {
  const { profile, isSuperAdmin, isAdmin, isPastor } = useAuth();
  const { tenant, isImpersonating, impersonateTenant, subscriptionStatus } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  const isLocked = subscriptionStatus.isExpired && !location.pathname.includes('/members') && !location.pathname.includes('/settings');

  const userRole = profile?.role || profile?.staffData?.role || '';

  const adminItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['super-admin', 'church-admin', 'worker'] },
    { label: 'My Branch', icon: MapPin, href: '/dashboard/branch', roles: ['pastor', 'super-admin'] },
    { label: 'Attendance', icon: BarChart3, href: '/dashboard/attendance', roles: ['church-admin', 'pastor', 'worker', 'super-admin'] },
    { label: 'Branches', icon: MapPin, href: '/dashboard/branches', roles: ['church-admin', 'super-admin'] },
    { label: 'Members', icon: Users, href: '/dashboard/members', roles: ['church-admin', 'pastor', 'worker', 'super-admin'] },
    { label: 'Groups & Ministries', icon: Layers, href: '/dashboard/groups', roles: ['church-admin', 'pastor', 'super-admin'] },
    { label: 'Staff & Pastors', icon: Briefcase, href: '/dashboard/staff', roles: ['church-admin', 'super-admin'] },
    { label: 'Bulk Communications', icon: MessageSquare, href: '/dashboard/communications', roles: ['church-admin', 'pastor', 'super-admin'] },
  ];

  const contentItems = [
    { label: 'Services', icon: Calendar, href: '/dashboard/services', roles: ['church-admin', 'pastor', 'super-admin'] },
    { label: 'Finances', icon: FileText, href: '/dashboard/finances', roles: ['church-admin', 'super-admin'] },
  ];

  const systemItems = [
    { label: 'Settings', icon: Settings, href: '/dashboard/settings', roles: ['church-admin', 'pastor', 'super-admin'] },
  ];

  if (isSuperAdmin) {
    adminItems.unshift({ label: 'Global Panel', icon: Shield, href: '/admin', roles: ['super-admin'] });
  }

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const NavGroup = ({ title, items }: { title: string; items: any[] }) => {
    const filtered = items.filter(item => {
      if (isSuperAdmin) return true;
      const roles = item.roles || [];
      return roles.includes(userRole);
    });
    if (filtered.length === 0) return null;
    
    return (
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2 mt-4">{title}</div>
        {filtered.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium",
              location.pathname === item.href 
                ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className={cn("w-4 h-4", location.pathname === item.href ? "text-indigo-600" : "text-slate-400")} />
            {item.label}
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
            <Church className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-slate-900">Ecclesia</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider -mt-1">Cloud SaaS</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto scrollbar-none">
          <NavGroup title="Church Admin" items={adminItems} />
          <NavGroup title="Operations" items={contentItems} />
          <NavGroup title="System" items={systemItems} />
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className={cn(
            "rounded-xl p-4 text-white shadow-md relative overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]",
            subscriptionStatus.isExpired ? "bg-red-600" : "bg-indigo-600"
          )} onClick={() => navigate('/dashboard/settings')}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            <div className="text-[10px] uppercase opacity-80 font-bold tracking-widest">
              {subscriptionStatus.isTrial ? (subscriptionStatus.isExpired ? 'Trial Expired' : `Trial: ${subscriptionStatus.daysRemaining} days left`) : `Plan: ${tenant?.subscriptionTier || 'Free'}`}
            </div>
            <div className="text-xs mt-1 font-medium italic opacity-90">
              {subscriptionStatus.isExpired ? 'Activate Account Now' : 'Manage Subscription'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isImpersonating && (
          <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>IMPERSONATION ACTIVE: Viewing as <span className="underline">{tenant?.name}</span></span>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-6 px-3 text-[10px] bg-white text-red-600 hover:bg-slate-100 border-none font-black"
              onClick={() => {
                impersonateTenant(null);
                navigate('/admin');
              }}
            >
              STOP IMPERSONATING
            </Button>
          </div>
        )}
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm overflow-hidden">
              <span className="truncate max-w-[150px]">{tenant?.name || 'My Church'}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="font-semibold text-slate-900 truncate">
                {navItems.find(i => i.href === location.pathname)?.label || 'Dashboard'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{profile?.displayName}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mt-0.5">{profile?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold overflow-hidden ring-1 ring-slate-100">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.displayName?.[0]
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50 relative">
          {isLocked && (
            <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6 border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
                  <CreditCard className="w-10 h-10 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900">Subscription Required</h2>
                  <p className="text-slate-500 text-sm">Your 7-day free trial has expired. To continue using the branch manager, finances, and groups, please activate your plan.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-slate-900 block">Members remain accessible</span>
                    You can still manage your local members and register new ones while locked.
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                    onClick={() => navigate('/dashboard/settings')}
                  >
                    Activate Now
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 text-sm font-bold border-slate-200"
                    onClick={() => navigate('/dashboard/members')}
                  >
                    Go to Members
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'My Branch', icon: MapPin, href: '/dashboard/branch' },
  { label: 'Attendance', icon: BarChart3, href: '/dashboard/attendance' },
  { label: 'Members', icon: Users, href: '/dashboard/members' },
  { label: 'Groups & Ministries', icon: Layers, href: '/dashboard/groups' },
  { label: 'Staff & Pastors', icon: Briefcase, href: '/dashboard/staff' },
  { label: 'Branches', icon: MapPin, href: '/dashboard/branches' },
  { label: 'Services', icon: Calendar, href: '/dashboard/services' },
  { label: 'Finances', icon: FileText, href: '/dashboard/finances' },
  { label: 'Communications', icon: MessageSquare, href: '/dashboard/communications' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  { label: 'Global Panel', icon: Shield, href: '/admin' },
];
