import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Church, LayoutDashboard, Users, MapPin, Calendar, FileText, Settings, LogOut, Shield, ChevronRight, Briefcase, BarChart3 } from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';

export function DashboardLayout() {
  const { profile, isSuperAdmin } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  const adminItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['super-admin', 'church-admin', 'worker'] },
    { label: 'My Branch', icon: MapPin, href: '/dashboard/branch', roles: ['pastor'] },
    { label: 'Attendance', icon: BarChart3, href: '/dashboard/attendance', roles: ['church-admin', 'pastor', 'worker'] },
    { label: 'Branches', icon: MapPin, href: '/dashboard/branches', roles: ['church-admin'] },
    { label: 'Members', icon: Users, href: '/dashboard/members', roles: ['church-admin', 'pastor', 'worker'] },
    { label: 'Staff & Pastors', icon: Briefcase, href: '/dashboard/staff', roles: ['church-admin'] },
  ];

  const contentItems = [
    { label: 'Services', icon: Calendar, href: '/dashboard/services', roles: ['church-admin', 'pastor'] },
    { label: 'Finances', icon: FileText, href: '/dashboard/finances', roles: ['church-admin'] },
  ];

  const systemItems = [
    { label: 'Settings', icon: Settings, href: '/dashboard/settings', roles: ['church-admin', 'pastor'] },
  ];

  if (isSuperAdmin) {
    adminItems.unshift({ label: 'Global Panel', icon: Shield, href: '/admin', roles: ['super-admin'] });
  }

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const NavGroup = ({ title, items }: { title: string; items: any[] }) => {
    const filtered = items.filter(item => item.roles.includes(profile?.role || ''));
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
          <div className="bg-indigo-600 rounded-xl p-4 text-white shadow-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            <div className="text-[10px] uppercase opacity-80 font-bold tracking-widest">Plan: {tenant?.subscriptionTier || 'Free'}</div>
            <div className="text-xs mt-1 font-medium italic opacity-90">Manage Subscription</div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
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
  { label: 'Staff & Pastors', icon: Briefcase, href: '/dashboard/staff' },
  { label: 'Branches', icon: MapPin, href: '/dashboard/branches' },
  { label: 'Services', icon: Calendar, href: '/dashboard/services' },
  { label: 'Finances', icon: FileText, href: '/dashboard/finances' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  { label: 'Global Panel', icon: Shield, href: '/admin' },
];
