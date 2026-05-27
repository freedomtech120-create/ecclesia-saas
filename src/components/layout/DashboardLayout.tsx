import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Church, LayoutDashboard, Users, MapPin, Calendar, FileText, Settings, LogOut, Shield, ChevronRight, Briefcase, BarChart3, MessageSquare, Layers, CreditCard, ArrowLeftRight, Scale, Bell, Menu, X } from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';
import NotificationBell from './NotificationBell';

export function DashboardLayout() {
  const { profile, isSuperAdmin, isAdmin, isPastor } = useAuth();
  const { tenant, isImpersonating, impersonateTenant, subscriptionStatus } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLocked = !isSuperAdmin && !isPastor && subscriptionStatus.isExpired && !location.pathname.includes('/members') && !location.pathname.includes('/settings');

  const userRole = profile?.role || profile?.staffData?.role || '';

  const adminItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['super-admin', 'church-admin', 'worker'] },
    { label: 'My Branch', icon: MapPin, href: '/dashboard/branch', roles: ['pastor', 'super-admin'] },
    { label: 'Attendance', icon: BarChart3, href: '/dashboard/attendance', roles: ['church-admin', 'pastor', 'worker', 'super-admin'] },
    { label: 'Branches', icon: MapPin, href: '/dashboard/branches', roles: ['church-admin', 'super-admin'] },
    { label: 'Members', icon: Users, href: '/dashboard/members', roles: ['church-admin', 'pastor', 'worker', 'super-admin'] },
    { label: 'Member Transfers', icon: ArrowLeftRight, href: '/dashboard/transfers', roles: ['super-admin', 'church-admin', 'pastor'] },
    { label: 'Groups & Ministries', icon: Layers, href: '/dashboard/groups', roles: ['church-admin', 'pastor', 'super-admin'] },
    { label: 'Staff & Pastors', icon: Briefcase, href: '/dashboard/staff', roles: ['church-admin', 'super-admin'] },
    { label: 'Bulk Communications', icon: MessageSquare, href: '/dashboard/communications', roles: ['church-admin', 'pastor', 'super-admin'] },
  ];

  const contentItems = [
    { label: 'Services', icon: Calendar, href: '/dashboard/services', roles: ['church-admin', 'pastor', 'super-admin'] },
    { label: 'Finances', icon: FileText, href: '/dashboard/finances', roles: ['church-admin', 'super-admin'] },
    { label: 'Assessments & Dues', icon: Scale, href: '/dashboard/assessments', roles: ['church-admin', 'pastor', 'super-admin', 'worker'] },
    { label: 'Event Calendars', icon: Calendar, href: '/dashboard/events', roles: ['church-admin', 'pastor', 'super-admin', 'worker'] },
  ];

  const systemItems = [
    { label: 'Notifications', icon: Bell, href: '/dashboard/notifications', roles: ['church-admin', 'pastor', 'super-admin', 'worker'] },
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
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-sm font-medium touch-manipulation min-h-[44px]",
              location.pathname === item.href 
                ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className={cn("w-5 h-5 lg:w-4 lg:h-4 shrink-0", location.pathname === item.href ? "text-indigo-600" : "text-slate-400")} />
            {item.label}
          </Link>
        ))}
      </div>
    );
  };

  // Setup mobile bottom nav items based on role clearances
  const bottomNavOptions = [
    { label: 'Home', icon: LayoutDashboard, href: isPastor ? '/dashboard/branch' : '/dashboard' },
    { label: 'Members', icon: Users, href: '/dashboard/members', roles: ['super-admin', 'church-admin', 'pastor', 'worker'] },
    { label: 'Finances', icon: FileText, href: '/dashboard/finances', roles: ['super-admin', 'church-admin'] },
    { label: 'Attendance', icon: BarChart3, href: '/dashboard/attendance', roles: ['pastor', 'worker'] },
    { label: 'Settings', icon: Settings, href: '/dashboard/settings', roles: ['super-admin', 'church-admin', 'pastor'] },
  ];

  const activeBottomNav = bottomNavOptions.filter(item => {
    if (isSuperAdmin) return true;
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  }).slice(0, 4);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans relative">
      
      {/* Mobile Drawer Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-905/40 bg-black/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - responsive sliding panel */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col shadow-xl lg:shadow-none z-50 transition-transform duration-300 lg:translate-x-0 lg:static shrink-0 h-full",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
              <Church className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-slate-900">Siasore</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider -mt-1">Cloud SaaS</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden h-9 w-9 text-slate-400 hover:text-slate-600 rounded-full"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto scrollbar-none pb-24">
          <NavGroup title="Church Admin" items={adminItems} />
          <NavGroup title="Operations" items={contentItems} />
          <NavGroup title="System" items={systemItems} />
        </nav>

        {!isPastor && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 mb-1 lg:mb-0">
            {isSuperAdmin ? (
              <div 
                className="rounded-xl p-4 text-white bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-500/10 shadow-md relative overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]" 
                onClick={() => { navigate('/dashboard/settings'); setSidebarOpen(false); }}
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-xl group-hover:scale-110 transition-all duration-500"></div>
                <div className="text-[10px] uppercase opacity-90 font-black tracking-widest text-indigo-300">
                  SYSTEM OWNER
                </div>
                <div className="text-xs mt-1 font-bold">
                  Lifetime Super Admin
                </div>
                <div className="text-[9px] mt-0.5 opacity-85 italic">
                  Subscription Bypassed
                </div>
              </div>
            ) : (
              <div className={cn(
                "rounded-xl p-4 text-white shadow-md relative overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]",
                subscriptionStatus.isExpired ? "bg-red-600" : "bg-indigo-600"
              )} onClick={() => { navigate('/dashboard/settings'); setSidebarOpen(false); }}>
                <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                <div className="text-[10px] uppercase opacity-80 font-bold tracking-widest">
                  {subscriptionStatus.isTrial ? (subscriptionStatus.isExpired ? 'Trial Expired' : `Trial: ${subscriptionStatus.daysRemaining} days left`) : `Plan: ${tenant?.subscriptionTier || 'Free'}`}
                </div>
                <div className="text-xs mt-1 font-medium italic opacity-90">
                  {subscriptionStatus.isExpired ? 'Activate Account Now' : 'Manage Subscription'}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {isImpersonating && (
          <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-300 shrink-0">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">IMPERSONATION: <span className="underline font-black">{tenant?.name}</span></span>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-6 px-2 text-[9px] bg-white text-red-600 hover:bg-slate-100 border-none font-black ml-2"
              onClick={() => {
                impersonateTenant(null);
                navigate('/admin');
              }}
            >
              STOP
            </Button>
          </div>
        )}
        
        {/* Sticky Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm z-10 sticky top-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Hamburger Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 text-slate-500 hover:text-slate-900 rounded-full shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>

            <div className="flex items-center gap-1.5 text-slate-400 text-xs sm:text-sm overflow-hidden whitespace-nowrap">
              <span className="truncate max-w-[100px] sm:max-w-[150px] text-slate-700 font-medium">{tenant?.name || 'My Church'}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate">
                {navItems.find(i => i.href === location.pathname)?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">{profile?.displayName}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-none mt-0.5">{profile?.role}</p>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold overflow-hidden ring-1 ring-slate-100">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover animate-fade-in" referrerpolicy="no-referrer" />
                ) : (
                  profile?.displayName?.[0]
                )}
              </div>
            </div>
            <NotificationBell />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full h-9 w-9 sm:h-10 sm:w-10" 
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 relative pb-24 lg:pb-16">
          {isLocked && (
            <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6 border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
                  <CreditCard className="w-8 h-8 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">Subscription Required</h2>
                  <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">Your registered church's free trial has expired. To continue using the branch manager, finances, and groups, please activate your plan. Under our model, all church campuses and branches benefit from your central subscription and do not need separate payments.</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-slate-600 leading-normal">
                    <span className="font-bold text-slate-900 block text-xs">Members remain accessible</span>
                    You can still manage your local members and register new ones while locked.
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                    onClick={() => navigate('/dashboard/settings')}
                  >
                    Activate Now
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full h-11 text-xs font-bold border-slate-200"
                    onClick={() => navigate('/dashboard/members')}
                  >
                    Go to Members
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Native-Style Bottom Navigation Tab-Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-30 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {activeBottomNav.map((item) => {
            const isActive = location.pathname === item.href || (item.label === 'Home' && location.pathname.startsWith('/dashboard/branch'));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-slate-50/50 transition-all select-none relative",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
                <item.icon className="w-5.5 h-5.5 mb-0.5 transition-transform duration-200 active:scale-90" />
                <span className="text-[10px] font-black tracking-tight">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Menu Drawer Toggle Link */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 text-slate-400 hover:bg-slate-50/50 transition-all select-none active:scale-95"
          >
            <Menu className="w-5.5 h-5.5 mb-0.5" />
            <span className="text-[10px] font-black tracking-tight">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'My Branch', icon: MapPin, href: '/dashboard/branch' },
  { label: 'Attendance', icon: BarChart3, href: '/dashboard/attendance' },
  { label: 'Members', icon: Users, href: '/dashboard/members' },
  { label: 'Member Transfers', icon: ArrowLeftRight, href: '/dashboard/transfers' },
  { label: 'Groups & Ministries', icon: Layers, href: '/dashboard/groups' },
  { label: 'Staff & Pastors', icon: Briefcase, href: '/dashboard/staff' },
  { label: 'Branches', icon: MapPin, href: '/dashboard/branches' },
  { label: 'Services', icon: Calendar, href: '/dashboard/services' },
  { label: 'Finances', icon: FileText, href: '/dashboard/finances' },
  { label: 'Communications', icon: MessageSquare, href: '/dashboard/communications' },
  { label: 'Notifications', icon: Bell, href: '/dashboard/notifications' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  { label: 'Global Panel', icon: Shield, href: '/admin' },
];
