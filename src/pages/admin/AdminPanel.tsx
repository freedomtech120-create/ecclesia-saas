import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, updateDoc, setDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Building2, Users, CreditCard, ExternalLink, Eye, UserCog, History, Globe, Trash2, Banknote, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTenant } from '@/src/contexts/TenantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const { isSuperAdmin } = useAuth();
  const { impersonateTenant } = useTenant();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const unsubscribe = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTenants(data);
      setLoading(false);
    }, (error) => {
      console.error("Tenants onSnapshot error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'subscription_transactions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    }, (error) => {
      console.error("transactions error:", error);
    });

    return unsubscribe;
  }, [isSuperAdmin]);

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString();
    }
    if (ts instanceof Date) {
      return ts.toLocaleString();
    }
    return String(ts);
  };

  const totalRevenue = transactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest italic">Unauthorized System Access</div>;
  }

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!confirm(`Are you sure you want to set ${selectedTenant?.name} to ${newStatus}?`)) return;

    try {
      await setDoc(doc(db, 'tenants', tenantId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success(`Tenant ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      toast.error('Failed to update status: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-100">
              <Shield className="w-6 h-6" />
            </div>
            Global Administration
          </h1>
          <p className="text-slate-500 mt-2">Comprehensive platform overview for Ecclesia Cloud SaaS.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => window.open('https://console.firebase.google.com/', '_blank')}>
            <ExternalLink className="w-4 h-4" /> Firebase Console
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Churches</CardTitle>
            <Building2 className="w-4 h-4 text-slate-300" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">{tenants.length}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Onboarded Tenants</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Subscriptions</CardTitle>
            <CreditCard className="w-4 h-4 text-indigo-300" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">
              {tenants.filter(t => t.subscriptionTier !== 'free' && t.subscriptionTier !== undefined).length}
            </div>
            <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">Paid Accounts</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Revenue</CardTitle>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-950 tracking-tighter">GH₵{totalRevenue.toLocaleString()}</div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Platform Revenue (GHS)</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transactions Logged</CardTitle>
            <RefreshCw className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">{transactions.length}</div>
            <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Total Orders</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Platform Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Church Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provisioned At</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">Management</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id} className="hover:bg-slate-50/50 transition-colors group">
                  <TableCell className="font-bold text-slate-900 pl-6">{tenant.name}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm",
                      tenant.subscriptionTier === 'premium' ? "bg-indigo-600 text-white shadow-indigo-100" : "bg-slate-100 text-slate-600"
                    )}>
                      {tenant.subscriptionTier}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                      tenant.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {tenant.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {tenant.createdAt?.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Dialog>
                        <DialogTrigger 
                          render={
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedTenant(tenant)}>
                              <Eye className="w-4 h-4 text-slate-400" />
                            </Button>
                          }
                        />
                        <DialogContent className="max-w-2xl bg-white">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Building2 className="w-5 h-5 text-indigo-600" />
                              {selectedTenant?.name} Details
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-6 mt-4">
                            <div className="space-y-4">
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tenant ID</label>
                                <p className="font-mono text-xs">{selectedTenant?.id}</p>
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</label>
                                <div className="mt-1">
                                  <Badge className={selectedTenant?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                                    {selectedTenant?.status}
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plan</label>
                                <p className="font-bold">{selectedTenant?.subscriptionTier || 'Free'}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Created At</label>
                                <p className="font-bold">{selectedTenant?.createdAt?.toDate().toLocaleString()}</p>
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Settings</label>
                                <div className="space-y-1 mt-1">
                                  <p className="text-xs flex items-center gap-2">
                                    <Globe className="w-3 h-3 text-slate-400" /> {selectedTenant?.domain || 'No custom domain'}
                                  </p>
                                  <p className="text-xs flex items-center gap-2">
                                    <History className="w-3 h-3 text-slate-400" /> Last Audit: {selectedTenant?.updatedAt?.toDate().toLocaleDateString() || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-3 mt-8 pt-6 border-t">
                            <Button 
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700" 
                              onClick={() => {
                                impersonateTenant(selectedTenant.id);
                                navigate('/dashboard');
                              }}
                            >
                              <UserCog className="w-4 h-4 mr-2" /> Impersonate Tenant
                            </Button>
                            <Button 
                              variant="outline" 
                              className={cn(
                                "flex-1",
                                selectedTenant?.status === 'active' 
                                  ? "text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100" 
                                  : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-100"
                              )}
                              onClick={() => handleToggleStatus(selectedTenant.id, selectedTenant.status)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> 
                              {selectedTenant?.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-indigo-600 font-bold hover:bg-indigo-50"
                        onClick={() => {
                          impersonateTenant(tenant.id);
                          navigate('/dashboard');
                        }}
                      >
                        Impersonate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white mt-8">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Global Subscription Transactions Log
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">Real-time listing of church platform subscription purchase events.</p>
          </div>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold">
            {transactions.length} Received
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-sm">
              No subscription payment transactions registered on the platform yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Church / Tenant</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount Paid</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reference Barcode</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payer Account</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">Clearing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tr) => (
                  <TableRow key={tr.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-semibold text-slate-900 pl-6">
                      {tr.tenantName || 'Unregistered Church'}
                      <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{tr.tenantId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {tr.planName || tr.planId}
                      </span>
                    </TableCell>
                    <TableCell className="font-black text-slate-950">
                      GH₵{tr.amount?.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-500 uppercase tracking-tight">
                      {tr.paymentReference || 'N/A'}
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      {formatTimestamp(tr.createdAt)}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {tr.userEmail}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Success
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
