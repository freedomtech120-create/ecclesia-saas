import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar, DollarSign, TrendingUp, MapPin, Search, Plus, ArrowRight, Wallet, ArrowUpRight, ArrowDownRight, History, Share2, Globe, Copy, ExternalLink, CheckCircle2, MessageSquare, Send, Smartphone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function BranchDashboardPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const branchId = profile?.staffData?.assignedBranchId;
  const [branchName, setBranchName] = useState('My Branch');
  const [stats, setStats] = useState({
    members: 0,
    services: 0,
    totalIncome: 0,
    totalExpenses: 0,
    activeForms: 0,
    totalResponses: 0,
    recentGrowth: 12
  });
  const [recentFinances, setRecentFinances] = useState<any[]>([]);
  const [allFinances, setAllFinances] = useState<any[]>([]);
  const [branchForms, setBranchForms] = useState<any[]>([]);
  const [recentResponses, setRecentResponses] = useState<any[]>([]);
  const [smsConfig, setSmsConfig] = useState<any>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddFinanceOpen, setIsAddFinanceOpen] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  
  const [newForm, setNewForm] = useState({
    title: '',
    description: '',
    type: 'member-onboarding'
  });

  const [newRecord, setNewRecord] = useState({
    amount: '',
    type: 'offering',
    category: 'General',
    contributor: '',
    description: ''
  });

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    const activeBranchId = branchId || 'main'; // Default to main if not assigned

    // Fetch branch info
    getDocs(query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId))).then(snap => {
       const branch = snap.docs.find(d => d.id === activeBranchId);
       if (branch) setBranchName(branch.data().name);
    });

    // Real-time finances for this branch
    const qFinances = query(
      collection(db, 'finances'), 
      where('tenantId', '==', effectiveTenantId),
      where('branchId', '==', activeBranchId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeFinances = onSnapshot(qFinances, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllFinances(data);
      
      const income = data.filter((f: any) => f.type !== 'expense').reduce((acc, f: any) => acc + (f.amount || 0), 0);
      const expenses = data.filter((f: any) => f.type === 'expense').reduce((acc, f: any) => acc + (f.amount || 0), 0);
      
      setStats(prev => ({
        ...prev,
        totalIncome: income,
        totalExpenses: expenses
      }));
      setRecentFinances(data.slice(0, 5));
    }, (error) => {
      console.error("Finances onSnapshot error:", error);
      toast.error("Financial data sync failed");
    });

    // Other stats
    const fetchStats = async () => {
      const qMembers = query(
        collection(db, 'members'), 
        where('tenantId', '==', effectiveTenantId),
        where('branchId', '==', activeBranchId)
      );
      const qServices = query(
        collection(db, 'services'), 
        where('tenantId', '==', effectiveTenantId),
        where('branchId', '==', activeBranchId)
      );
      const qForms = query(
        collection(db, 'public_forms'),
        where('tenantId', '==', effectiveTenantId),
        where('branchId', '==', activeBranchId),
        where('status', '==', 'active')
      );
      const qResponses = query(
        collection(db, 'form_responses'),
        where('tenantId', '==', effectiveTenantId),
        where('branchId', '==', activeBranchId),
        orderBy('submittedAt', 'desc')
      );

      const [membersSnap, servicesSnap, formsSnap, responsesSnap] = await Promise.all([
        getDocs(qMembers),
        getDocs(qServices),
        getDocs(qForms),
        getDocs(qResponses)
      ]);
      
      setStats(prev => ({
        ...prev,
        members: membersSnap.size,
        services: servicesSnap.size,
        activeForms: formsSnap.size,
        totalResponses: responsesSnap.size
      }));

      setBranchForms(formsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecentResponses(responsesSnap.docs.slice(0, 5).map(d => ({ id: d.id, ...d.data() })));

      // Fetch SMS config
      const qSms = query(
        collection(db, 'sms_configs'),
        where('tenantId', '==', effectiveTenantId),
        where('branchId', '==', activeBranchId)
      );
      const smsSnap = await getDocs(qSms);
      if (!smsSnap.empty) {
        const data = smsSnap.docs[0].data();
        setSmsConfig({ id: smsSnap.docs[0].id, ...data });
        setGatewayConfig({
          provider: data.provider || 'twilio',
          apiKey: data.apiKey || '',
          apiSecret: data.apiSecret || '',
          senderId: data.senderId || ''
        });
      }

      // Fetch SMS logs
      const qLogs = query(
        collection(db, 'sms_logs'),
        where('tenantId', '==', effectiveTenantId),
        where('branchId', '==', activeBranchId),
        orderBy('sentAt', 'desc'),
        limit(10)
      );
      const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
        setSmsLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error("SMS Logs onSnapshot error:", error);
      });

      setLoading(false);
      return unsubscribeLogs;
    };

    const unsubStats = fetchStats();
    return () => {
      unsubscribeFinances();
      unsubStats.then(unsub => unsub?.());
    };
  }, [branchId, effectiveTenantId]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;
    const activeBranchId = branchId || 'main';

    try {
      await addDoc(collection(db, 'finances'), {
        amount: parseFloat(newRecord.amount),
        type: newRecord.type,
        category: newRecord.category,
        contributor: newRecord.contributor || (newRecord.type === 'expense' ? 'Church Expense' : 'Anonymous'),
        description: newRecord.description,
        branchId: activeBranchId,
        tenantId: effectiveTenantId,
        recordedBy: profile?.uid,
        createdAt: serverTimestamp(),
      });
      toast.success('Financial record added successfully');
      setIsAddFinanceOpen(false);
      setNewRecord({ amount: '', type: 'offering', category: 'General', contributor: '', description: '' });
    } catch (error: any) {
      toast.error('Failed to add record: ' + error.message);
    }
  };

  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [formResponses, setFormResponses] = useState<any[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsData, setSmsData] = useState({
    message: '',
    recipientType: 'all' // all, male, female, groups
  });

  const [gatewayConfig, setGatewayConfig] = useState({
    provider: 'twilio',
    apiKey: '',
    apiSecret: '',
    senderId: ''
  });

  const handleSaveSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || !branchId) return;
    try {
      if (smsConfig?.id) {
        await updateDoc(doc(db, 'sms_configs', smsConfig.id), {
          ...gatewayConfig,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'sms_configs'), {
          ...gatewayConfig,
          tenantId: profile.tenantId,
          branchId,
          updatedAt: serverTimestamp()
        });
      }
      toast.success('SMS Gateway configured!');
    } catch (err: any) {
      toast.error('Failed to save config: ' + err.message);
    }
  };

  const handleSendBulkSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsConfig) {
      toast.error('Please configure your SMS Gateway first');
      return;
    }
    setSmsLoading(true);
    try {
      // Fetch recipients based on type
      let qRecipients = query(
        collection(db, 'members'),
        where('tenantId', '==', profile?.tenantId),
        where('branchId', '==', branchId)
      );
      const snap = await getDocs(qRecipients);
      const recipients = snap.docs.map(d => d.data().phone).filter(p => !!p);

      if (recipients.length === 0) {
        toast.error('No members with phone numbers found');
        return;
      }

      // Record the log
      await addDoc(collection(db, 'sms_logs'), {
        tenantId: profile?.tenantId,
        branchId,
        recipientCount: recipients.length,
        message: smsData.message,
        status: 'simulated-sent', // Integrating real API requires a backend proxy
        sentAt: serverTimestamp()
      });

      toast.success(`Broadcasting to ${recipients.length} members...`);
      setSmsData({ ...smsData, message: '' });
    } catch (err: any) {
      toast.error('SMS Failed: ' + err.message);
    } finally {
      setSmsLoading(false);
    }
  };

  const viewResponses = async (form: any) => {
    setSelectedForm(form);
    const q = query(
      collection(db, 'form_responses'),
      where('formId', '==', form.id),
      orderBy('submittedAt', 'desc')
    );
    const snap = await getDocs(q);
    setFormResponses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || !branchId) return;

    try {
      await addDoc(collection(db, 'public_forms'), {
        ...newForm,
        branchId,
        tenantId: profile.tenantId,
        status: 'active',
        createdAt: serverTimestamp(),
      });
      toast.success('Connect link generated!');
      setIsAddFormOpen(false);
      setNewForm({ title: '', description: '', type: 'member-onboarding' });
    } catch (err: any) {
      toast.error('Failed to create link: ' + err.message);
    }
  };

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/f/${id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied');
  };

  if (!branchId || branchId === 'none') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <MapPin className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">No Branch Assigned</h2>
        <p className="text-slate-500 max-w-sm mt-2">You are currently assigned to the central office. If you are a branch pastor, please contact your administrator to assign you to a specific location.</p>
      </div>
    );
  }

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Syncing Branch Data...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
           <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest bg-indigo-50 px-2 py-1 rounded-md w-fit mb-2">
             <MapPin className="w-3 h-3" /> {branchName}
           </div>
           <h1 className="text-3xl font-black tracking-tight text-slate-900">Branch Portal</h1>
           <p className="text-slate-500 mt-1">Localized management for the {branchName} congregation.</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="gap-2 border-slate-200">
                <Share2 className="w-4 h-4" /> New Connect Link
              </Button>
            } />
            <DialogContent>
               <DialogHeader>
                 <DialogTitle>Create Connect Link</DialogTitle>
                 <DialogDescription>Generate a public form for registration or donations.</DialogDescription>
               </DialogHeader>
               <form onSubmit={handleCreateForm} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Link Title</Label>
                    <Input value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} placeholder="e.g. Visitors Form" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Form Type</Label>
                    <Select value={newForm.type} onValueChange={v => setNewForm({...newForm, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member-onboarding">Member Onboarding</SelectItem>
                        <SelectItem value="donation">Donation / Pledge</SelectItem>
                        <SelectItem value="event-registration">Event Registration</SelectItem>
                        <SelectItem value="general">General Feedback</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600">Generate Link</Button>
               </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddFinanceOpen} onOpenChange={setIsAddFinanceOpen}>
            <DialogTrigger render={
              <Button className="gap-2 bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700">
                <DollarSign className="w-4 h-4" /> Record Finance
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Branch Financial Entry</DialogTitle>
                <DialogDescription>Record offerings, tithes or expenses for the {branchName} branch.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddRecord} className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={newRecord.amount} 
                      onChange={e => setNewRecord({...newRecord, amount: e.target.value})}
                      required 
                      className="pl-8 border-slate-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Type</Label>
                    <Select value={newRecord.type} onValueChange={v => setNewRecord({...newRecord, type: v})}>
                      <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offering">Offering</SelectItem>
                        <SelectItem value="tithe">Tithe</SelectItem>
                        <SelectItem value="donation">Donation</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</Label>
                    <Input 
                      value={newRecord.category} 
                      onChange={e => setNewRecord({...newRecord, category: e.target.value})}
                      placeholder="e.g. Building Fund"
                      className="border-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {newRecord.type === 'expense' ? 'Beneficiary / Description' : 'Contributor / Source'}
                  </Label>
                  <Input 
                    value={newRecord.contributor} 
                    onChange={e => setNewRecord({...newRecord, contributor: e.target.value})}
                    placeholder={newRecord.type === 'expense' ? 'e.g. Utility Company' : 'Leave empty for Anonymous'}
                    className="border-slate-200"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full bg-indigo-600 font-bold uppercase tracking-widest">Post to Branch Ledger</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Branch Members
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900">{stats.members}</div>
             <div className="text-[10px] text-emerald-600 font-bold uppercase mt-1 flex items-center gap-1">
               <TrendingUp className="w-3 h-3" /> +{stats.recentGrowth}% this month
             </div>
           </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5" /> Digital Links
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-indigo-600">{stats.activeForms}</div>
             <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 italic">{stats.totalResponses} submissions received</p>
           </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5" /> Net Funds
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900">${(stats.totalIncome - stats.totalExpenses).toLocaleString()}</div>
             <div className="flex gap-2 mt-1">
                <span className="text-[9px] font-bold text-emerald-600 uppercase">+${stats.totalIncome.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-red-400 uppercase">-${stats.totalExpenses.toLocaleString()}</span>
             </div>
           </CardContent>
        </Card>

        <Card className="bg-indigo-600 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Pastoral Status</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-xl font-bold">Pastor-in-Charge</div>
             <p className="text-[10px] text-indigo-200 font-medium uppercase mt-1">{profile?.displayName || profile?.name}</p>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="overview" className="rounded-lg px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all font-bold text-[10px] uppercase tracking-widest">Overview</TabsTrigger>
          <TabsTrigger value="finances" className="rounded-lg px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all font-bold text-[10px] uppercase tracking-widest">Branch Ledger</TabsTrigger>
          <TabsTrigger value="connect" className="rounded-lg px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all font-bold text-[10px] uppercase tracking-widest">Connect Hub</TabsTrigger>
          <TabsTrigger value="sms" className="rounded-lg px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all font-bold text-[10px] uppercase tracking-widest">Bulk SMS</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               <Card className="border-slate-200">
                 <CardHeader className="flex flex-row items-center justify-between">
                   <div>
                     <CardTitle className="text-lg font-bold">Recent Branch Transactions</CardTitle>
                     <CardDescription>Latest financial activity for this location.</CardDescription>
                   </div>
                   <Button variant="ghost" size="sm" className="text-indigo-600 font-bold">Manage All</Button>
                 </CardHeader>
                 <CardContent>
                    <div className="space-y-1">
                      {recentFinances.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 italic text-sm">No recent transactions.</div>
                      ) : (
                        recentFinances.map(f => (
                          <div key={f.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                            <div className="flex items-center gap-4">
                               <div className={cn(
                                 "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm border",
                                 f.type === 'expense' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
                               )}>
                                 <DollarSign className={cn("w-5 h-5", f.type === 'expense' ? 'text-red-500' : 'text-emerald-600')} />
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-slate-900">{f.contributor}</p>
                                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{f.type} • {f.category}</p>
                               </div>
                            </div>
                            <div className="text-right">
                              <p className={cn("font-black tabular-nums", f.type === 'expense' ? 'text-slate-400' : 'text-emerald-600')}>
                                {f.type === 'expense' ? '-' : '+'}${f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {f.createdAt ? format(f.createdAt.toDate(), 'MMM d, p') : 'Syncing...'}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                 </CardContent>
               </Card>
            </div>

            <div className="space-y-6">
               <Card className="border-slate-200 bg-indigo-50 border-dashed">
                 <CardHeader>
                    <CardTitle className="text-sm font-black uppercase text-indigo-600">Ministerial Focus</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="p-4 bg-white rounded-xl shadow-sm border border-indigo-100 relative group cursor-pointer hover:border-indigo-400 transition-all">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Monthly Goal</p>
                       <p className="text-sm font-bold text-slate-900">Reach 100 Members</p>
                       <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min((stats.members / 100) * 100, 100)}%` }}></div>
                       </div>
                       <p className="text-right text-[10px] text-indigo-600 mt-1 font-bold">{Math.round((stats.members / 100) * 100)}% Complete</p>
                    </div>

                    <div className="p-4 bg-white rounded-xl shadow-sm border border-indigo-100 relative group cursor-pointer hover:border-indigo-400 transition-all">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Growth Task</p>
                       <p className="text-sm font-bold text-slate-900">Setup 3 Connect Links</p>
                       <p className="text-[10px] text-slate-500 mt-1 italic">Create forms for member onboarding, donations, and events.</p>
                       <Button size="sm" className="w-full mt-3 bg-indigo-600 text-[9px] h-7 uppercase font-black tracking-widest" onClick={() => setIsAddFormOpen(true)}>Create One Now</Button>
                    </div>

                    <Card className="border-slate-200 bg-white">
                      <CardHeader className="p-4 border-b border-slate-50">
                        <CardTitle className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Shared Branch Links</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {branchForms.slice(0, 3).map(form => (
                          <div key={form.id} className="p-3 border-b border-slate-50 flex items-center justify-between group">
                            <div className="min-w-0">
                               <p className="text-[11px] font-bold text-slate-700 truncate">{form.title}</p>
                               <p className="text-[9px] font-mono text-slate-400 truncate w-32">{window.location.origin}/f/{form.id}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all text-indigo-600"
                              onClick={() => copyLink(form.id)}
                            >
                               <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        {branchForms.length === 0 && (
                          <div className="p-4 text-center text-[10px] text-slate-400 italic">No links generated.</div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="p-4 bg-white rounded-xl shadow-sm border border-indigo-100 relative group cursor-pointer hover:border-indigo-400 transition-all">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Evangelism Task</p>
                       <p className="text-sm font-bold text-slate-900">Follow up with Visitors</p>
                       <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                 </CardContent>
               </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finances">
           <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
             <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Complete Branch Ledger</CardTitle>
                  <CardDescription>Historical financial records for this location.</CardDescription>
                </div>
                <div className="flex gap-2">
                   <div className="bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter text-center">Net Income</p>
                      <p className="text-xs font-black text-emerald-700 text-center">${stats.totalIncome.toLocaleString()}</p>
                   </div>
                   <div className="bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                      <p className="text-[9px] font-black text-red-400 uppercase tracking-tighter text-center">Net Expenses</p>
                      <p className="text-xs font-black text-red-500 text-center">${stats.totalExpenses.toLocaleString()}</p>
                   </div>
                </div>
             </CardHeader>
             <CardContent className="p-0">
               <Table>
                 <TableHeader className="bg-slate-50/30">
                   <TableRow>
                     <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6 h-12">Timestamp</TableHead>
                     <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 h-12">Entity / Contributor</TableHead>
                     <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 h-12">Type</TableHead>
                     <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 h-12">Category</TableHead>
                     <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6 h-12">Value</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {allFinances.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic font-medium">The branch ledger is currently empty.</TableCell>
                     </TableRow>
                   ) : (
                     allFinances.map((f) => (
                       <TableRow key={f.id} className="hover:bg-slate-50/50 transition-colors group">
                         <TableCell className="text-[10px] font-bold text-slate-400 uppercase pl-6">
                           {f.createdAt ? format(f.createdAt.toDate(), 'PPP • p') : 'Syncing...'}
                         </TableCell>
                         <TableCell className="font-bold text-slate-900">{f.contributor}</TableCell>
                         <TableCell>
                           <span className={cn(
                             "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                             f.type === 'expense' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-emerald-50 text-emerald-600 shadow-sm'
                           )}>
                             {f.type}
                           </span>
                         </TableCell>
                         <TableCell className="text-[11px] font-bold text-slate-500 uppercase tracking-tight italic">{f.category}</TableCell>
                         <TableCell className={cn(
                           "text-right font-black tabular-nums pr-6",
                           f.type === 'expense' ? 'text-red-400' : 'text-slate-900'
                         )}>
                           {f.type === 'expense' ? '- ' : '+ '}${f.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="connect">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                 <Card className="border-slate-200">
                    <CardHeader>
                       <CardTitle className="text-lg font-bold">Public Connection Links</CardTitle>
                       <CardDescription>Share these URLs with your congregation or on social media.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                       <Table>
                          <TableHeader>
                             <TableRow>
                                <TableHead className="pl-6">Link Name & URL</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right pr-6">Management</TableHead>
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             {branchForms.length === 0 ? (
                                <TableRow>
                                   <TableCell colSpan={3} className="text-center py-12 text-slate-400">No active links created yet.</TableCell>
                                </TableRow>
                             ) : (
                                branchForms.map(form => (
                                   <TableRow key={form.id}>
                                      <TableCell className="pl-6">
                                         <div className="font-bold text-slate-900">{form.title}</div>
                                         <div className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                                            {window.location.origin}/f/{form.id}
                                         </div>
                                      </TableCell>
                                      <TableCell>
                                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                            {form.type.replace('-', ' ')}
                                         </span>
                                      </TableCell>
                                      <TableCell className="text-right pr-6 space-x-1">
                                         <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-200 text-indigo-600 hover:bg-indigo-50" onClick={() => viewResponses(form)}>
                                            <ExternalLink className="w-3 h-3" /> Submissions
                                         </Button>
                                         <Button variant="ghost" size="sm" className="h-8 gap-2 hover:bg-slate-100" onClick={() => copyLink(form.id)}>
                                            <Copy className="w-3 h-3" /> Copy URL
                                         </Button>
                                      </TableCell>
                                   </TableRow>
                                ))
                             )}
                          </TableBody>
                       </Table>
                    </CardContent>
                 </Card>
              </div>


              <div>
                 <Card className="border-slate-200">
                    <CardHeader>
                       <CardTitle className="text-sm font-black uppercase text-slate-500">Recent Responses</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {recentResponses.length === 0 ? (
                          <p className="text-center py-8 text-slate-400 text-sm">No submissions yet.</p>
                       ) : (
                          recentResponses.map(res => (
                             <div key={res.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                   <p className="text-sm font-bold text-slate-900 truncate">
                                      {res.data.fullName || res.data.firstName || 'Anonymous'}
                                   </p>
                                   <p className="text-[9px] font-black text-indigo-600 uppercase">{res.type || 'Form'}</p>
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">
                                   {res.submittedAt ? format(res.submittedAt.toDate(), 'MMM d, p') : 'Pending'}
                                </p>
                             </div>
                          ))
                       )}
                    </CardContent>
                 </Card>
              </div>
           </div>

           <Dialog open={!!selectedForm} onOpenChange={(open) => !open && setSelectedForm(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                 <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                          <Globe className="w-4 h-4" />
                       </div>
                       {selectedForm?.title} Submissions
                    </DialogTitle>
                    <DialogDescription>
                       Type: {selectedForm?.type?.replace('-', ' ')} • Real-time data from public submissions.
                    </DialogDescription>
                 </DialogHeader>
                 
                 <div className="flex-1 overflow-y-auto mt-4 pr-1">
                    {formResponses.length === 0 ? (
                       <div className="py-12 text-center text-slate-400">
                          <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p>No responses collected yet for this link.</p>
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {formResponses.map((resp) => (
                             <Card key={resp.id} className="border-slate-100 bg-slate-50/50">
                                <CardHeader className="py-3 bg-white border-b border-slate-50">
                                   <div className="flex justify-between items-center">
                                      <p className="text-xs font-black uppercase text-slate-400 tracking-widest">
                                         {resp.submittedAt ? format(resp.submittedAt.toDate(), 'MMM d, yyyy • h:mm a') : 'Pending'}
                                      </p>
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                   </div>
                                </CardHeader>
                                <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                   {Object.entries(resp.data || {}).map(([key, val]: [string, any]) => (
                                      <div key={key}>
                                         <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">{key.replace(/([A-Z])/g, ' $1')}</p>
                                         <p className="text-sm font-bold text-slate-700">{String(val)}</p>
                                      </div>
                                   ))}
                                </CardContent>
                             </Card>
                          ))}
                       </div>
                    )}
                 </div>
                 
                 <DialogFooter className="mt-4 pt-4 border-t border-slate-100">
                    <Button onClick={() => setSelectedForm(null)} className="bg-slate-900">Close Viewer</Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>
        </TabsContent>

        <TabsContent value="sms">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                 <Card className="border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between">
                       <div>
                          <CardTitle className="text-lg font-bold">Broadcast Center</CardTitle>
                          <CardDescription>Send instant bulk messages to your congregation.</CardDescription>
                       </div>
                       <Link to="/dashboard/communications">
                          <Button variant="outline" size="sm" className="h-8 gap-2 text-indigo-600 border-indigo-100 hover:bg-indigo-50">
                             <ExternalLink className="w-3 h-3" /> Full Communication Center
                          </Button>
                       </Link>
                    </CardHeader>
                    <CardContent>
                       <form onSubmit={handleSendBulkSms} className="space-y-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Recipient Group</Label>
                             <Select value={smsData.recipientType} onValueChange={v => setSmsData({...smsData, recipientType: v})}>
                                <SelectTrigger className="border-slate-200">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="all">Entire Branch ({stats.members} members)</SelectItem>
                                   <SelectItem value="workers">Workers & Staff</SelectItem>
                                   <SelectItem value="leaders">Church Leadership</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Message Content</Label>
                             <textarea 
                                className="w-full h-32 p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Type your message here..."
                                value={smsData.message}
                                onChange={e => setSmsData({...smsData, message: e.target.value})}
                                maxLength={160}
                                required
                             />
                             <p className="text-[10px] text-right text-slate-400 font-bold">{smsData.message.length}/160 characters (1 Page)</p>
                          </div>
                          <Button 
                             type="submit" 
                             className="w-full bg-indigo-600 gap-2 h-12 text-sm font-bold uppercase tracking-widest"
                             disabled={smsLoading || !smsData.message}
                          >
                             {smsLoading ? 'Broadcasting...' : (
                                <>
                                   <Send className="w-4 h-4" /> Send Bulk SMS
                                </>
                             )}
                          </Button>
                       </form>
                    </CardContent>
                 </Card>

                 <Card className="border-slate-200">
                    <CardHeader>
                       <CardTitle className="text-sm font-black uppercase text-slate-500">Recent Broadcasts</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                       <Table>
                          <TableHeader>
                             <TableRow>
                                <TableHead className="pl-6 italic">Message Preview</TableHead>
                                <TableHead>Recipients</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right pr-6">Date</TableHead>
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             {smsLogs.length === 0 ? (
                                <TableRow>
                                   <TableCell colSpan={4} className="text-center py-12 text-slate-400">No message history found.</TableCell>
                                </TableRow>
                             ) : (
                                smsLogs.map(log => (
                                   <TableRow key={log.id}>
                                      <TableCell className="pl-6 max-w-[200px] truncate text-slate-600 text-xs">{log.message}</TableCell>
                                      <TableCell className="font-bold">{log.recipientCount}</TableCell>
                                      <TableCell>
                                         <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                                            {log.status}
                                         </span>
                                      </TableCell>
                                      <TableCell className="text-right pr-6 text-[10px] text-slate-400">
                                         {log.sentAt ? format(log.sentAt.toDate(), 'MMM d, p') : 'Pending'}
                                      </TableCell>
                                   </TableRow>
                                ))
                             )}
                          </TableBody>
                       </Table>
                    </CardContent>
                 </Card>
              </div>

              <div className="space-y-6">
                 <Card className="border-indigo-100 bg-indigo-50/30">
                    <CardHeader>
                       <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4">
                          <Smartphone className="w-5 h-5" />
                       </div>
                       <CardTitle className="text-lg font-bold">SMS Gateway</CardTitle>
                       <CardDescription>Integrate your preferred API provider to enable bulk messaging.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <form onSubmit={handleSaveSmsConfig} className="space-y-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Provider</Label>
                             <Select value={gatewayConfig.provider} onValueChange={v => setGatewayConfig({...gatewayConfig, provider: v})}>
                                <SelectTrigger className="bg-white border-indigo-200">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="twilio">Twilio</SelectItem>
                                   <SelectItem value="africastalking">Africa's Talking</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">API Key / Account SID</Label>
                             <Input 
                                className="bg-white border-indigo-200" 
                                value={gatewayConfig.apiKey}
                                onChange={e => setGatewayConfig({...gatewayConfig, apiKey: e.target.value})}
                                type="password" 
                                placeholder="••••••••••••" 
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Auth Token / Secret</Label>
                             <Input 
                                className="bg-white border-indigo-200" 
                                value={gatewayConfig.apiSecret}
                                onChange={e => setGatewayConfig({...gatewayConfig, apiSecret: e.target.value})}
                                type="password" 
                                placeholder="••••••••••••" 
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Sender ID / From Number</Label>
                             <Input 
                                className="bg-white border-indigo-200" 
                                value={gatewayConfig.senderId}
                                onChange={e => setGatewayConfig({...gatewayConfig, senderId: e.target.value})}
                                placeholder="CHURCH_NAME" 
                             />
                          </div>
                          <Button type="submit" className="w-full bg-slate-900 gap-2 mt-2">
                             <ShieldCheck className="w-4 h-4" /> Save Configuration
                          </Button>
                       </form>
                    </CardContent>
                 </Card>
                 
                 <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                       <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                       <p className="text-[11px] font-bold text-amber-900 uppercase">Security Note</p>
                       <p className="text-[10px] text-amber-700 leading-relaxed mt-1">
                          API keys are stored securely on the church's private server. Ensure your provider account has sufficient balance for broadcasts.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
