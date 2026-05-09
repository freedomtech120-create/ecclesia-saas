import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar, DollarSign, TrendingUp, MapPin, Search, Plus, ArrowRight, Wallet, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
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
  const branchId = profile?.staffData?.assignedBranchId;
  const [branchName, setBranchName] = useState('My Branch');
  const [stats, setStats] = useState({
    members: 0,
    services: 0,
    totalIncome: 0,
    totalExpenses: 0,
    recentGrowth: 12
  });
  const [recentFinances, setRecentFinances] = useState<any[]>([]);
  const [allFinances, setAllFinances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddFinanceOpen, setIsAddFinanceOpen] = useState(false);
  
  const [newRecord, setNewRecord] = useState({
    amount: '',
    type: 'offering',
    category: 'General',
    contributor: '',
    description: ''
  });

  useEffect(() => {
    if (!branchId || branchId === 'none') {
      setLoading(false);
      return;
    }

    // Fetch branch info
    getDocs(query(collection(db, 'branches'), where('tenantId', '==', profile?.tenantId))).then(snap => {
       const branch = snap.docs.find(d => d.id === branchId);
       if (branch) setBranchName(branch.data().name);
    });

    // Real-time finances for this branch
    const qFinances = query(
      collection(db, 'finances'), 
      where('tenantId', '==', profile.tenantId),
      where('branchId', '==', branchId),
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
    });

    // Other stats
    const fetchStats = async () => {
      const qMembers = query(
        collection(db, 'members'), 
        where('tenantId', '==', profile.tenantId),
        where('branchId', '==', branchId)
      );
      const qServices = query(
        collection(db, 'services'), 
        where('tenantId', '==', profile.tenantId),
        where('branchId', '==', branchId)
      );

      const [membersSnap, servicesSnap] = await Promise.all([
        getDocs(qMembers),
        getDocs(qServices)
      ]);
      
      setStats(prev => ({
        ...prev,
        members: membersSnap.size,
        services: servicesSnap.size,
      }));

      setLoading(false);
    };

    fetchStats();
    return () => unsubscribeFinances();
  }, [branchId, profile?.tenantId]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId || !branchId) return;

    try {
      await addDoc(collection(db, 'finances'), {
        amount: parseFloat(newRecord.amount),
        type: newRecord.type,
        category: newRecord.category,
        contributor: newRecord.contributor || (newRecord.type === 'expense' ? 'Church Expense' : 'Anonymous'),
        description: newRecord.description,
        branchId: branchId,
        tenantId: profile.tenantId,
        recordedBy: profile.uid,
        createdAt: serverTimestamp(),
      });
      toast.success('Financial record added successfully');
      setIsAddFinanceOpen(false);
      setNewRecord({ amount: '', type: 'offering', category: 'General', contributor: '', description: '' });
    } catch (error: any) {
      toast.error('Failed to add record: ' + error.message);
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <Wallet className="w-3.5 h-3.5" /> Net Branch Funds
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900">${(stats.totalIncome - stats.totalExpenses).toLocaleString()}</div>
             <div className="flex gap-2 mt-1">
                <span className="text-[9px] font-bold text-emerald-600 uppercase">+${stats.totalIncome.toLocaleString()} INC</span>
                <span className="text-[9px] font-bold text-red-400 uppercase">-${stats.totalExpenses.toLocaleString()} EXP</span>
             </div>
           </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Total Income
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900">${stats.totalIncome.toLocaleString()}</div>
             <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 italic">Lifetime Location Revenue</p>
           </CardContent>
        </Card>

        <Card className="bg-indigo-600 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Active Pastoral Status</CardTitle>
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
      </Tabs>
    </div>
  );
}
