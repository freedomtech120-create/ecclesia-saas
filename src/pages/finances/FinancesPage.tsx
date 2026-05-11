import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Plus, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function FinancesPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [newRecord, setNewRecord] = useState({
    amount: '',
    type: 'offering',
    category: 'General',
    contributor: '',
    description: ''
  });

  useEffect(() => {
    if (!effectiveTenantId) return;

    const q = query(
      collection(db, 'finances'),
      where('tenantId', '==', effectiveTenantId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching finances:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [effectiveTenantId]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      await addDoc(collection(db, 'finances'), {
        amount: parseFloat(newRecord.amount),
        type: newRecord.type,
        category: newRecord.category,
        contributor: newRecord.contributor || (newRecord.type === 'expense' ? 'Church Expense' : 'Anonymous'),
        description: newRecord.description,
        tenantId: effectiveTenantId,
        branchId: profile?.staffData?.assignedBranchId || 'main',
        createdAt: serverTimestamp(),
      });
      toast.success('Financial record added');
      setIsAddOpen(false);
      setNewRecord({ amount: '', type: 'offering', category: 'General', contributor: '', description: '' });
    } catch (error: any) {
      toast.error('Failed to add record: ' + error.message);
    }
  };

const totalIncome = records.filter(r => r.type !== 'expense').reduce((sum, r) => sum + (r.amount || 0), 0);
const totalExpenses = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Finances</h1>
          <p className="text-slate-500 mt-1">Track tithes, offerings, and manage modular church expenses.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <Plus className="w-4 h-4" />
                Record Entry
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Financial Record</DialogTitle>
              <DialogDescription>Record a new tithe, offering, or donation with precision.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddRecord} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount ($)</Label>
                <div className="relative">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</div>
                   <Input id="amount" type="number" step="0.01" value={newRecord.amount} onChange={e => setNewRecord({...newRecord, amount: e.target.value})} placeholder="0.00" required className="pl-7 border-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Transaction Type</Label>
                  <Select value={newRecord.type} onValueChange={v => setNewRecord({...newRecord, type: v})}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offering">Offering</SelectItem>
                      <SelectItem value="tithe">Tithe</SelectItem>
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</Label>
                  <Input id="category" value={newRecord.category} onChange={e => setNewRecord({...newRecord, category: e.target.value})} placeholder="e.g. General" className="border-slate-200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contributor" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {newRecord.type === 'expense' ? 'Beneficiary / Description' : 'Contributor Name'}
                </Label>
                <Input id="contributor" value={newRecord.contributor} onChange={e => setNewRecord({...newRecord, contributor: e.target.value})} placeholder={newRecord.type === 'expense' ? 'e.g. Utility Company' : 'Anonymous'} className="border-slate-200" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Post Transaction</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-4xl font-black text-slate-900 tracking-tighter">${totalIncome.toLocaleString()}</div>
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Real-time Ledger
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fixed Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-4xl font-black text-slate-900 tracking-tighter">${totalExpenses.toLocaleString()}</div>
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2 italic">Optimal Efficiency</p>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/70">Net Liquidity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-white tracking-tighter">${(totalIncome - totalExpenses).toLocaleString()}</div>
            <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider mt-2">Ministry Ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Timestamp</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entity/Contributor</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Allocation</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">Syncing ledger records...</TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">No financial history detected.</TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <TableCell className="text-[10px] font-bold text-slate-400 uppercase tracking-tight pl-6">
                      {record.createdAt ? format(record.createdAt.toDate(), 'MMM d • HH:mm') : 'Syncing...'}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{record.contributor}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm",
                        record.type === 'expense' ? 'bg-red-50 text-red-600 shadow-red-50' : 'bg-indigo-50 text-indigo-600 shadow-indigo-50'
                      )}>
                        {record.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-500 italic">{record.category}</TableCell>
                    <TableCell className={cn(
                      "text-right font-black tabular-nums pr-6",
                      record.type === 'expense' ? 'text-red-400' : 'text-slate-900'
                    )}>
                      {record.type === 'expense' ? '—' : '+'}${record.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
