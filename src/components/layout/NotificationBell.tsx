import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, updateDoc, doc, limit, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Bell, Check, Trash2, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function NotificationBell() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const assignedBranchId = profile?.staffData?.assignedBranchId;
  const userRole = profile?.role || profile?.staffData?.role;

  useEffect(() => {
    if (!effectiveTenantId) return;

    // Filter notifications for active tenant without orderBy to avoid needing composite indexes
    let q = query(
      collection(db, 'notifications'),
      where('tenantId', '==', effectiveTenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client side as composite indexes may take time to deploy
      data.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
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

      // Limit to 25 client-side
      if (data.length > 25) {
        data = data.slice(0, 25);
      }

      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error("Notifications list error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [effectiveTenantId, assignedBranchId, userRole, profile?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notifyId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifyId), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const promises = notifications.filter(n => !n.read).map(n => 
        updateDoc(doc(db, 'notifications', n.id), { read: true })
      );
      await Promise.all(promises);
      toast.success('All notifications marked as read');
    } catch (e: any) {
      toast.error('Failed to update notifications: ' + e.message);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'transfer_initiated':
        return <RefreshCw className="w-4 h-4 text-amber-500 animate-spin-slow" />;
      case 'transfer_approved':
      case 'payment_approved':
        return <Check className="w-4 h-4 text-emerald-500 animate-pulse" />;
      case 'transfer_rejected':
      case 'payment_rejected':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'transfer_cancelled':
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors",
          isOpen && "bg-slate-50 text-slate-800"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-[10px] font-black text-white rounded-full flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> Alerts & Inbox
              </span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider underline underline-offset-2 bg-transparent border-none cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">Loading alerts...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center py-12 text-slate-400">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-400 italic">No new activity reported.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-4 flex gap-3 hover:bg-slate-50/50 transition-colors relative group",
                      !n.read && "bg-indigo-50/30 font-medium"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 self-start mt-0.5 shadow-sm">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-xs font-bold text-slate-900 truncate pr-4">{n.title}</p>
                        {!n.read && (
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            className="absolute top-4 right-4 w-4 h-4 hover:bg-white border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Mark read"
                          >
                            <Check className="w-2.5 h-2.5 text-slate-400 hover:text-indigo-600" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1.5 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {n.createdAt ? formatDistanceToNow(n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt), { addSuffix: true }) : 'Just now'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
              <Link 
                to="/dashboard/notifications" 
                onClick={() => setIsOpen(false)}
                className="text-[10px] font-black tracking-widest uppercase text-indigo-600 hover:text-indigo-800 block py-1.5 transition-colors"
              >
                Open Notification Center
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
