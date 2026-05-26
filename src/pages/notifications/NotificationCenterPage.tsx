import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { 
  Bell, Check, Trash2, Calendar, AlertCircle, RefreshCw, Filter, 
  Layers, BadgeAlert, Coins, Sparkles, Inbox, CheckCircle, Search, Trash 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function NotificationCenterPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'financial' | 'events' | 'admin'>('all');
  const [searchText, setSearchText] = useState('');

  const assignedBranchId = profile?.staffData?.assignedBranchId;
  const userRole = profile?.role || profile?.staffData?.role;

  // Real-time listener for tenant's notifications
  useEffect(() => {
    if (!effectiveTenantId) return;

    let q = query(
      collection(db, 'notifications'),
      where('tenantId', '==', effectiveTenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client side as composite indexes may take time to deploy
      data.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
        return dateB.getTime() - dateA.getTime();
      });

      // Filter logically based on branch pastor scope if needed
      if (userRole === 'pastor' && assignedBranchId && assignedBranchId !== 'none') {
        data = data.filter((n: any) => 
          !n.branchId || n.branchId === assignedBranchId || n.userId === profile?.uid
        );
      } else if (userRole === 'worker') {
        data = data.filter((n: any) => n.userId === profile?.uid);
      }

      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error("Notifications fetch error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [effectiveTenantId, assignedBranchId, userRole, profile?.uid]);

  // Priority analyzer helper
  const getPriority = (n: any) => {
    if (n.priority) return n.priority;
    const msgLower = n.message?.toLowerCase() || '';
    const titleLower = n.title?.toLowerCase() || '';
    if (msgLower.includes('overdue') || msgLower.includes('urgent') || titleLower.includes('rejected') || msgLower.includes('critical')) {
      return 'High';
    }
    if (msgLower.includes('approved') || msgLower.includes('submitted')) {
      return 'Medium';
    }
    return 'Low';
  };

  // Category analyzer helper
  const getCategory = (n: any) => {
    if (n.category) return n.category.toLowerCase();
    const type = n.type || '';
    if (type.startsWith('payment_') || type.startsWith('assessment_') || type.includes('dues') || type.includes('levy') || n.title?.toLowerCase().includes('payment')) {
      return 'financial';
    }
    if (type.startsWith('event_') || type.includes('attendance') || type.includes('contribution') || n.title?.toLowerCase().includes('event')) {
      return 'events';
    }
    return 'admin';
  };

  // Filter & Search logic
  const filteredNotifications = notifications.filter((n) => {
    const category = getCategory(n);
    if (activeTab !== 'all' && category !== activeTab) {
      return false;
    }
    
    if (searchText.trim() !== '') {
      const search = searchText.toLowerCase();
      const title = (n.title || '').toLowerCase();
      const message = (n.message || '').toLowerCase();
      return title.includes(search) || message.includes(search);
    }
    
    return true;
  });

  const handleMarkAsRead = async (notifyId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifyId), { read: true });
      toast.success('Alert marked as read');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to update: ' + e.message);
    }
  };

  const handleDeleteNotification = async (notifyId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notifyId));
      toast.success('Alert removed');
    } catch (e: any) {
      console.error(e);
      toast.error('Could not delete: ' + e.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadAlerts = filteredNotifications.filter(n => !n.read);
      if (unreadAlerts.length === 0) {
        toast.info('All listed alerts are already read.');
        return;
      }

      const promises = unreadAlerts.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { read: true })
      );
      await Promise.all(promises);
      toast.success(`Marked ${unreadAlerts.length} alerts as read`);
    } catch (e: any) {
      toast.error('Fail to mark all read: ' + e.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete all listed notifications? This action cannot be undone.')) {
      return;
    }
    try {
      const ids = filteredNotifications.map(n => n.id);
      const promises = ids.map(id => deleteDoc(doc(db, 'notifications', id)));
      await Promise.all(promises);
      toast.success(`Removed ${ids.length} notifications`);
    } catch (e: any) {
      toast.error('Could not clean notifications: ' + e.message);
    }
  };

  // Calculations
  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    financial: notifications.filter(n => getCategory(n) === 'financial').length,
    events: notifications.filter(n => getCategory(n) === 'events').length,
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400';
    }
  };

  const getIcon = (n: any) => {
    const category = getCategory(n);
    switch (category) {
      case 'financial':
        return <Coins className="w-4 h-4 text-emerald-600" />;
      case 'events':
        return <Calendar className="w-4 h-4 text-violet-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold uppercase tracking-widest text-[9px] py-0.5">
            Communication Centre
          </Badge>
        </div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tighter">Notification Center</h1>
        <p className="text-sm text-slate-500 max-w-2xl mt-1">
          Monitor instant system alerts, verify national assessment responses, check event schedules, and clear administrative notifications.
        </p>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Unread Alerts</div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.unread}</span>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 font-bold text-[9px]">
                Requires Review
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Financial Alerts</div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600 tracking-tight">{stats.financial}</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Event Updates</div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-violet-600 tracking-tight">{stats.events}</span>
              <Calendar className="w-4 h-4 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Logs</div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.total}</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter toolbar and list */}
      <Card className="border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 border rounded-lg max-w-full overflow-x-auto self-start">
            {[
              { id: 'all', label: 'All Alerts' },
              { id: 'financial', label: 'Financial' },
              { id: 'events', label: 'Events' },
              { id: 'admin', label: 'Administrative' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all whitespace-nowrap cursor-pointer",
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-8 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 h-9 w-full sm:w-48 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-[10px] tracking-wider uppercase h-9 shrink-0"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
              Mark listed read
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
              className="font-bold text-[10px] tracking-wider uppercase h-9 shrink-0"
            >
              <Trash className="w-3.5 h-3.5 mr-1.5" />
              Clear listed
            </Button>
          </div>
        </div>

        {/* List Content */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="text-center py-16 text-xs text-slate-400 italic">Synchronizing alert state...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-20 px-8 text-slate-400 max-w-md mx-auto">
              <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">Inbox is empty</h3>
              <p className="text-xs text-slate-400 mt-1">No alerts or messages matching the current filter filters found in your inbox.</p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const priority = getPriority(n);
              return (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-5 flex gap-4 hover:bg-slate-50/40 transition-colors relative group",
                    !n.read && "bg-indigo-50/15"
                  )}
                >
                  {/* Category Circle */}
                  <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center shrink-0 shadow-sm">
                    {getIcon(n)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-12">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={cn(
                        "text-xs text-slate-900 tracking-tight",
                        n.read ? "font-medium" : "font-black text-indigo-950"
                      )}>
                        {n.title}
                      </h3>
                      
                      {/* Priority Badge */}
                      <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-1 py-0", getPriorityBadgeColor(priority))}>
                        {priority} Priority
                      </Badge>

                      {/* Read status tag */}
                      {!n.read && (
                        <Badge className="bg-indigo-600 text-white font-black text-[8px] uppercase px-1 py-0">
                          NEW
                        </Badge>
                      )}
                    </div>

                    <p className={cn(
                      "text-xs leading-relaxed max-w-3xl",
                      n.read ? "text-slate-500" : "text-slate-700 font-medium"
                    )}>
                      {n.message}
                    </p>

                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-2 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {n.createdAt ? formatDistanceToNow(n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt), { addSuffix: true }) : 'Just now'}
                    </span>
                  </div>

                  {/* Actions (Trash / Check) when hover */}
                  <div className="absolute top-5 right-5 flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.read && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="w-7 h-7 bg-white hover:bg-slate-50 border rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-colors cursor-pointer"
                        title="Mark as Read"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotification(n.id)}
                      className="w-7 h-7 bg-white hover:bg-slate-50 border rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 shadow-sm transition-colors cursor-pointer"
                      title="Clear Alert"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
