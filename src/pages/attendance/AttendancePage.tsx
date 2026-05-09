import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, serverTimestamp, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, BarChart3, Plus, Calendar, Filter, CheckCircle2, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AttendancePage() {
  const { profile } = useAuth();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    serviceId: '',
    totalCount: '',
    menCount: '0',
    womenCount: '0',
    childrenCount: '0',
    firstTimersCount: '0',
    notes: ''
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    // Fetch Attendances
    const qA = query(
      collection(db, 'attendance'),
      where('tenantId', '==', profile.tenantId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeA = onSnapshot(qA, (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Fetch Services for selection
    const qS = query(
      collection(db, 'services'),
      where('tenantId', '==', profile.tenantId),
      orderBy('date', 'desc'),
      limit(20)
    );

    const unsubscribeS = onSnapshot(qS, (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeA();
      unsubscribeS();
    };
  }, [profile?.tenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    const selectedService = services.find(s => s.id === formData.serviceId);
    if (!selectedService) {
      toast.error('Please select a service');
      return;
    }

    try {
      const attendanceData = {
        ...formData,
        serviceId: formData.serviceId,
        branchId: selectedService.branchId || 'main',
        tenantId: profile.tenantId,
        totalCount: parseInt(formData.totalCount) || 0,
        menCount: parseInt(formData.menCount) || 0,
        womenCount: parseInt(formData.womenCount) || 0,
        childrenCount: parseInt(formData.childrenCount) || 0,
        firstTimersCount: parseInt(formData.firstTimersCount) || 0,
        recordedBy: profile.uid,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'attendance'), attendanceData);
      
      // Update service status
      await updateDoc(doc(db, 'services', formData.serviceId), {
        attendanceCount: attendanceData.totalCount,
        status: 'completed'
      });

      toast.success('Attendance recorded effectively');
      setIsAddOpen(false);
      setFormData({
        serviceId: '',
        totalCount: '',
        menCount: '0',
        womenCount: '0',
        childrenCount: '0',
        firstTimersCount: '0',
        notes: ''
      });
    } catch (error: any) {
      toast.error('Failed to save record: ' + error.message);
    }
  };

  const totalThisWeek = attendances
    .filter(a => {
      const date = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date > weekAgo;
    })
    .reduce((acc, curr) => acc + (curr.totalCount || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Attendance Registry</h1>
           <p className="text-slate-500 mt-1">Growth tracking and headcount management across the ministry.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="bg-indigo-600 gap-2 shadow-lg shadow-indigo-100">
              <Plus className="w-4 h-4" /> New Record
            </Button>
          } />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Take Attendance</DialogTitle>
              <DialogDescription>Select a service and record the population stats.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Service / Event</Label>
                <Select value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v})}>
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Choose a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title} ({format(new Date(s.date), 'MMM d')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Headcount</Label>
                  <Input type="number" value={formData.totalCount} onChange={e => setFormData({...formData, totalCount: e.target.value})} required className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">First Timers</Label>
                  <Input type="number" value={formData.firstTimersCount} onChange={e => setFormData({...formData, firstTimersCount: e.target.value})} className="border-slate-200" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Men</Label>
                  <Input type="number" value={formData.menCount} onChange={e => setFormData({...formData, menCount: e.target.value})} className="border-slate-200 h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Women</Label>
                  <Input type="number" value={formData.womenCount} onChange={e => setFormData({...formData, womenCount: e.target.value})} className="border-slate-200 h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Children</Label>
                  <Input type="number" value={formData.childrenCount} onChange={e => setFormData({...formData, childrenCount: e.target.value})} className="border-slate-200 h-9" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">General Notes</Label>
                <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Weather, special visitor, feedback..." className="border-slate-200" />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600 font-bold uppercase tracking-widest">Commit to Registry</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> 7-Day Reach
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900 tracking-tighter">{totalThisWeek.toLocaleString()}</div>
             <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Population in View</p>
           </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" /> Retention Rate
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900 tracking-tighter">
                {attendances.length > 0 ? Math.round((attendances.reduce((acc, c) => acc + (parseInt(c.firstTimersCount) || 0), 0) / attendances.reduce((acc, c) => acc + (c.totalCount || 1), 0)) * 100) : 0}%
             </div>
             <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">First Timer Mix</p>
           </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Last Service
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-indigo-900 tracking-tighter">
                {attendances[0]?.totalCount || 0}
             </div>
             <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">
                {attendances[0] ? format(attendances[0].createdAt?.toDate?.() || new Date(), 'MMMM d') : 'No records yet'}
             </p>
           </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                 <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Attendance Log</h2>
           </div>
           <Button variant="outline" size="sm" className="h-9 border-slate-200 text-[10px] font-black uppercase tracking-widest gap-2">
              <Filter className="w-3 h-3" /> Filter Log
           </Button>
        </div>
        <Table>
          <TableHeader className="bg-slate-50/30">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Recorded At</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">M/W/C Mix</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Timers</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Syncing Registry...</TableCell>
              </TableRow>
            ) : attendances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">No attendance records found.</TableCell>
              </TableRow>
            ) : (
              attendances.map((a) => (
                <TableRow key={a.id} className="group hover:bg-slate-50/50 transition-colors">
                  <TableCell className="pl-6">
                    <p className="text-sm font-bold text-slate-900">
                      {a.createdAt?.toDate ? format(a.createdAt.toDate(), 'PPP') : 'Just now'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {a.createdAt?.toDate ? format(a.createdAt.toDate(), 'p') : 'Pending'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-lg font-black text-slate-900">{a.totalCount}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">M: {a.menCount || 0}</div>
                      <div className="bg-pink-50 text-pink-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">W: {a.womenCount || 0}</div>
                      <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">C: {a.childrenCount || 0}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex flex-col">
                        <span className="text-xs font-black text-indigo-600">{a.firstTimersCount || 0} Souls</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Registered</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-600">
                       <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
