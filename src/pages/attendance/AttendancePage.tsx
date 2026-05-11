import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, serverTimestamp, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, BarChart3, Plus, Calendar, Filter, CheckCircle2, MoreHorizontal, UserCheck, Plane, HeartPulse, XCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function MemberChecklist({ serviceId, tenantId, branchId, onComplete }: { serviceId: string, tenantId: string, branchId: string, onComplete: () => void }) {
  const { profile } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendance, setAttendance] = useState<Record<string, { status: string, report: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const q = query(
        collection(db, 'members'),
        where('tenantId', '==', tenantId),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Load existing attendance if any for this service
      const aQ = query(
        collection(db, 'member_attendance'),
        where('tenantId', '==', tenantId),
        where('serviceId', '==', serviceId)
      );
      const aSnap = await getDocs(aQ);
      const initial: Record<string, any> = {};
      aSnap.docs.forEach(doc => {
        const d = doc.data();
        initial[d.memberId] = { status: d.status, report: d.report || '', docId: doc.id };
      });
      setAttendance(initial);
      setLoading(false);
    };

    fetchMembers();
  }, [serviceId, tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      for (const memberId of Object.keys(attendance)) {
        const data = attendance[memberId];
        const docRef = doc(collection(db, 'member_attendance'));
        batch.set(docRef, {
          tenantId,
          branchId,
          serviceId,
          memberId,
          status: data.status,
          report: data.report || '',
          recordedBy: profile?.uid,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      toast.success('Member attendance saved');
      onComplete();
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    present: Object.values(attendance).filter((a: any) => a.status === 'present').length,
    travel: Object.values(attendance).filter((a: any) => a.status === 'travel').length,
    sick: Object.values(attendance).filter((a: any) => a.status === 'sick').length,
    absent: Object.values(attendance).filter((a: any) => a.status === 'absent').length,
  };

  const totalMarked = Object.values(attendance).filter((a: any) => a.status).length;
  const totalInList = members.length;

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading congregation list...</div>;

  return (
    <div className="space-y-4">
      {/* Summary Summary Card */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Present</p>
          <p className="text-lg font-black text-emerald-700">{counts.present}</p>
        </div>
        <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 text-center">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Travel</p>
          <p className="text-lg font-black text-blue-700">{counts.travel}</p>
        </div>
        <div className="bg-red-50 p-2 rounded-xl border border-red-100 text-center">
          <p className="text-[10px] font-black text-red-600 uppercase tracking-tighter">Sick</p>
          <p className="text-lg font-black text-red-700">{counts.sick}</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Absent</p>
          <p className="text-lg font-black text-slate-600">{counts.absent}</p>
        </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
           <div className={cn(
             "h-2 w-2 rounded-full",
             totalMarked === totalInList ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
           )} />
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
             {totalMarked} of {totalInList} Members Balanced
           </p>
        </div>
        {totalMarked < totalInList && (
          <p className="text-[9px] font-black text-amber-600 uppercase">{totalInList - totalMarked} Remaining</p>
        )}
      </div>

      <div className="relative">
        <Input 
          placeholder="Start typing name to filter..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-11 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white transition-all shadow-sm"
        />
        <Users className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 pb-4 pt-2">
        {filteredMembers.length === 0 ? (
          <p className="text-center py-12 text-slate-400 italic">No members found matching "{searchTerm}"</p>
        ) : (
          filteredMembers.map(member => (
            <div key={member.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-3 hover:bg-slate-50/50 transition-colors">
              <div className="flex justify-between items-center">
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{member.firstName} {member.lastName}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.phone || 'No Phone'}</p>
                </div>
                <div className="flex gap-1">
                  {[
                    { id: 'present', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Present' },
                    { id: 'travel', icon: Plane, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Travel' },
                    { id: 'sick', icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50', label: 'Sick' },
                    { id: 'absent', icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Absent' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAttendance({...attendance, [member.id]: { ...attendance[member.id], status: opt.id }})}
                      title={opt.label}
                      className={cn(
                        "p-2 rounded-lg transition-all border-2",
                        attendance[member.id]?.status === opt.id 
                          ? `${opt.bg} border-indigo-500 ${opt.color}` 
                          : "bg-white border-transparent text-slate-300 hover:bg-slate-100"
                      )}
                    >
                      <opt.icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              <Input 
                placeholder="Add a report or note for this member..." 
                value={attendance[member.id]?.report || ''}
                onChange={e => setAttendance({...attendance, [member.id]: { ...attendance[member.id], report: e.target.value }})}
                className="h-8 text-xs bg-white border-slate-100"
              />
            </div>
          ))
        )}
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 h-12 font-black uppercase tracking-widest shadow-xl shadow-indigo-100 rounded-xl">
        {saving ? 'Syncing...' : 'Save Checklist'}
      </Button>
    </div>
  );
}

export default function AttendancePage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    serviceId: '',
    totalCount: '',
    menCount: '0',
    womenCount: '0',
    childrenCount: '0',
    firstTimersCount: '0',
    notes: ''
  });

  const [calculatedTotal, setCalculatedTotal] = useState(0);

  useEffect(() => {
    const men = parseInt(formData.menCount) || 0;
    const women = parseInt(formData.womenCount) || 0;
    const children = parseInt(formData.childrenCount) || 0;
    const total = men + women + children;
    setCalculatedTotal(total);
    
    // Auto-update totalCount if it's currently empty or strictly matches the previous sum
    if (formData.totalCount === '' || formData.totalCount === '0' || parseInt(formData.totalCount) === 0) {
      setFormData(prev => ({ ...prev, totalCount: total.toString() }));
    }
  }, [formData.menCount, formData.womenCount, formData.childrenCount]);

  const isBalanced = parseInt(formData.totalCount) === calculatedTotal;

  useEffect(() => {
    if (!effectiveTenantId) return;

    // Fetch Attendances
    const qA = query(
      collection(db, 'attendance'),
      where('tenantId', '==', effectiveTenantId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeA = onSnapshot(qA, (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Attendance onSnapshot error:", error);
      toast.error("Failed to sync attendance records");
      setLoading(false);
    });

    // Fetch Services for selection
    const qS = query(
      collection(db, 'services'),
      where('tenantId', '==', effectiveTenantId),
      orderBy('date', 'desc'),
      limit(20)
    );

    const unsubscribeS = onSnapshot(qS, (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Services onSnapshot error:", error);
    });

    return () => {
      unsubscribeA();
      unsubscribeS();
    };
  }, [effectiveTenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced && !confirm(`The total (${formData.totalCount}) does not match the sum of Men+Women+Children (${calculatedTotal}). Save anyway?`)) {
      return;
    }
    if (!effectiveTenantId) return;

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
        tenantId: effectiveTenantId,
        totalCount: parseInt(formData.totalCount) || 0,
        menCount: parseInt(formData.menCount) || 0,
        womenCount: parseInt(formData.womenCount) || 0,
        childrenCount: parseInt(formData.childrenCount) || 0,
        firstTimersCount: parseInt(formData.firstTimersCount) || 0,
        recordedBy: profile?.uid,
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
            <Button className="bg-indigo-600 gap-2 shadow-lg shadow-indigo-100 font-bold uppercase tracking-widest px-6">
              <Plus className="w-4 h-4" /> Log Service Headcount
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
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={formData.totalCount} 
                      onChange={e => setFormData({...formData, totalCount: e.target.value})} 
                      required 
                      className={cn(
                        "border-slate-200 font-bold",
                        !isBalanced && formData.totalCount !== '' && "border-amber-400 focus-visible:ring-amber-400"
                      )} 
                    />
                    {!isBalanced && formData.totalCount !== '' && (
                      <div className="absolute -bottom-5 left-0 text-[9px] font-black text-amber-600 uppercase tracking-tighter">
                        Mismatch: Sum is {calculatedTotal}
                      </div>
                    )}
                    {isBalanced && formData.totalCount !== '' && formData.totalCount !== '0' && (
                      <div className="absolute -bottom-5 left-0 text-[10px] font-black text-emerald-600 uppercase tracking-tighter flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Perfectly Balanced
                      </div>
                    )}
                  </div>
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

      <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Individual Attendance Checklist</DialogTitle>
            <DialogDescription>
              Marking members for {selectedService?.title || 'service'}.
            </DialogDescription>
          </DialogHeader>
          {selectedService && (
            <MemberChecklist 
              serviceId={selectedService.id || selectedService.serviceId} 
              tenantId={profile?.tenantId || ''} 
              branchId={profile?.branchIds?.[0] || 'main'} 
              onComplete={() => setIsChecklistOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

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
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 border-slate-200 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                        onClick={() => {
                          setSelectedService(a);
                          setIsChecklistOpen(true);
                        }}
                      >
                         <Users className="w-3 h-3" /> Member List
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-slate-600">
                         <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
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
