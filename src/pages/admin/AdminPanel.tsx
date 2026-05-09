import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Building2, Users, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminPanel() {
  const { isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const unsubscribe = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTenants(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return <div className="p-8 text-center">Unauthorized Access</div>;
  }

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
              {tenants.filter(t => t.subscriptionTier !== 'free').length}
            </div>
            <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">Paid Accounts</p>
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
                <TableRow key={tenant.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
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
                    <Button variant="ghost" size="sm" className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Manage</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
