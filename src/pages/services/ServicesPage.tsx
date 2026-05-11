import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, Plus, Users, CheckCircle, BarChart3, UserCheck, Plane, HeartPulse, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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
      toast.success('Checklist updated');
      onComplete();
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
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

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading congregation...</div>;

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
          placeholder="Search member name..." 
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 truncate">{member.firstName} {member.lastName}</h4>
                    {member.status === 'pending' && (
                      <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Pending Review</span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.phone || 'No Phone'}</p>
                </div>
                <div className="flex gap-1">
                  {[
                    { id: 'present', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { id: 'travel', icon: Plane, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { id: 'sick', icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50' },
                    { id: 'absent', icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-100' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAttendance({...attendance, [member.id]: { ...attendance[member.id], status: opt.id }})}
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
                placeholder="Report note or feedback..." 
                value={attendance[member.id]?.report || ''}
                onChange={e => setAttendance({...attendance, [member.id]: { ...attendance[member.id], report: e.target.value }})}
                className="h-8 text-xs bg-white border-slate-100 placeholder:text-slate-300"
              />
            </div>
          ))
        )}
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 h-12 font-black uppercase tracking-widest shadow-xl shadow-indigo-100 rounded-xl">
        {saving ? 'Syncing...' : 'Complete & Sync Checklist'}
      </Button>
    </div>
  );
}

function AttendanceDialog({ service, onSuccess }: { service: any, onSuccess: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    totalCount: service.attendanceCount || '',
    menCount: service.menCount || '',
    womenCount: service.womenCount || '',
    childrenCount: service.childrenCount || '',
    firstTimersCount: service.firstTimersCount || '',
    notes: service.notes || ''
  });

  const [calculatedTotal, setCalculatedTotal] = useState(0);

  useEffect(() => {
    const men = parseInt(data.menCount as string) || 0;
    const women = parseInt(data.womenCount as string) || 0;
    const children = parseInt(data.childrenCount as string) || 0;
    const total = men + women + children;
    setCalculatedTotal(total);
    
    // Auto-update totalCount if it's currently empty or strictly matches the previous sum
    // This allows manual overrides but helps with initial entry
    if (data.totalCount === '' || parseInt(data.totalCount as string) === 0) {
      setData(prev => ({ ...prev, totalCount: total.toString() }));
    }
  }, [data.menCount, data.womenCount, data.childrenCount]);

  const isBalanced = parseInt(data.totalCount as string) === calculatedTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced && !confirm(`The total (${data.totalCount}) does not match the sum of Men+Women+Children (${calculatedTotal}). Do you want to save anyway?`)) {
       return;
    }
    setLoading(true);
    try {
      const attendanceData = {
        serviceId: service.id,
        branchId: service.branchId,
        tenantId: service.tenantId,
        totalCount: parseInt(data.totalCount as string) || 0,
        menCount: parseInt(data.menCount as string) || 0,
        womenCount: parseInt(data.womenCount as string) || 0,
        childrenCount: parseInt(data.childrenCount as string) || 0,
        firstTimersCount: parseInt(data.firstTimersCount as string) || 0,
        notes: data.notes || '',
        recordedBy: profile?.uid,
        createdAt: serverTimestamp(),
      };

      // Create attendance record
      await addDoc(collection(db, 'attendance'), attendanceData);
      
      // Update service with headcount and status
      await updateDoc(doc(db, 'services', service.id), {
        attendanceCount: attendanceData.totalCount,
        menCount: attendanceData.menCount,
        womenCount: attendanceData.womenCount,
        childrenCount: attendanceData.childrenCount,
        firstTimersCount: attendanceData.firstTimersCount,
        notes: attendanceData.notes,
        status: 'completed'
      });

      toast.success('Attendance recorded');
      onSuccess();
    } catch (error: any) {
      toast.error('Error saving attendance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Attendance</Label>
          <div className="relative">
            <Input 
              type="number" 
              value={data.totalCount} 
              onChange={e => setData({...data, totalCount: e.target.value})} 
              required 
              className={cn(
                "font-bold",
                !isBalanced && data.totalCount !== '' && "border-amber-400 focus-visible:ring-amber-400"
              )}
            />
            {!isBalanced && data.totalCount !== '' && (
              <div className="absolute -bottom-5 left-0 text-[9px] font-black text-amber-600 uppercase tracking-tighter">
                Mismatch: Sum is {calculatedTotal}
              </div>
            )}
            {isBalanced && data.totalCount !== '' && data.totalCount !== '0' && (
              <div className="absolute -bottom-5 left-0 text-[10px] font-black text-emerald-600 uppercase tracking-tighter flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" /> Perfectly Balanced
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">First Timers</Label>
          <Input type="number" value={data.firstTimersCount} onChange={e => setData({...data, firstTimersCount: e.target.value})} />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Men</Label>
          <Input type="number" value={data.menCount} onChange={e => setData({...data, menCount: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Women</Label>
          <Input type="number" value={data.womenCount} onChange={e => setData({...data, womenCount: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Children</Label>
          <Input type="number" value={data.childrenCount} onChange={e => setData({...data, childrenCount: e.target.value})} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Service Notes</Label>
        <Input value={data.notes} onChange={e => setData({...data, notes: e.target.value})} placeholder="Pastor's message, special highlights..." />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading} className="w-full bg-indigo-600">
          {loading ? 'Saving...' : 'Post Attendance'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ServicesPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  
  const [newService, setNewService] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    type: 'Sunday Service',
  });

  useEffect(() => {
    if (!effectiveTenantId) return;

    const q = query(
      collection(db, 'services'),
      where('tenantId', '==', effectiveTenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setServices(data.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching services:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [effectiveTenantId]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      await addDoc(collection(db, 'services'), {
        ...newService,
        tenantId: effectiveTenantId,
        branchId: profile?.staffData?.assignedBranchId || 'main',
        createdAt: serverTimestamp(),
        attendanceCount: 0,
        status: 'scheduled',
      });
      toast.success('Service scheduled successfully');
      setIsAddOpen(false);
    } catch (error: any) {
      toast.error('Error creating service: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Services & Events</h1>
          <p className="text-slate-500 mt-1">Schedule church services, events and track ministerial engagement.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold uppercase tracking-widest px-6">
                <Plus className="w-4 h-4" />
                Create Service or Event
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Schedule New Service</DialogTitle>
              <DialogDescription>Add a new service or event to the pastoral calendar.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateService} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-black uppercase tracking-widest text-indigo-600">Event Date</Label>
                <Input id="date" type="date" value={newService.date} onChange={e => setNewService({...newService, date: e.target.value})} required className="border-slate-200 text-lg font-bold h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-slate-500">Service / Event Title</Label>
                <Input id="title" value={newService.title} onChange={e => setNewService({...newService, title: e.target.value})} placeholder="e.g. Sunday Celebration Service" required className="border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-xs font-bold uppercase tracking-wider text-slate-500">Kick-off Time</Label>
                  <Input id="time" type="time" value={newService.startTime} onChange={e => setNewService({...newService, startTime: e.target.value})} required className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-xs font-bold uppercase tracking-wider text-slate-500">Classification</Label>
                  <Select value={newService.type} onValueChange={v => setNewService({...newService, type: v})}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sunday Service">Sunday Service</SelectItem>
                      <SelectItem value="Mid-week">Mid-week Service</SelectItem>
                      <SelectItem value="Event">Event / Program</SelectItem>
                      <SelectItem value="Special">Special Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600 font-bold uppercase tracking-widest h-12 shadow-lg shadow-indigo-100">Create Service Event</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Total Attendance Record</DialogTitle>
            <DialogDescription>
              Capturing headcounts for {selectedService?.title} on {selectedService && format(new Date(selectedService.date), 'PPP')}.
            </DialogDescription>
          </DialogHeader>
          {selectedService && (
            <AttendanceDialog 
              service={selectedService} 
              onSuccess={() => setIsAttendanceOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Individual Checklist</DialogTitle>
            <DialogDescription>
              Marking member statuses for {selectedService?.title}.
            </DialogDescription>
          </DialogHeader>
          {selectedService && (
            <MemberChecklist 
              serviceId={selectedService.id} 
              tenantId={profile?.tenantId || ''} 
              branchId={selectedService.branchId} 
              onComplete={() => setIsChecklistOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <p className="text-center py-12 text-slate-400">Loading schedule...</p>
        ) : services.length === 0 ? (
          <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <CalendarIcon className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No services scheduled</h3>
            <p className="text-slate-500 mb-8 max-w-sm">Keep your congregation informed by scheduling upcoming services and events.</p>
            <Button variant="outline" className="border-slate-200 bg-white shadow-sm" onClick={() => setIsAddOpen(true)}>Schedule Now</Button>
          </div>
        ) : (
          services.map((service) => (
            <Card key={service.id} className="overflow-hidden border-slate-200 hover:shadow-md transition-all group">
              <div className="flex flex-col md:flex-row">
                <div className="bg-slate-50 p-6 flex flex-col items-center justify-center min-w-[140px] border-r border-slate-100 group-hover:bg-indigo-50/30 transition-colors">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(service.date), 'MMM')}</span>
                   <span className="text-4xl font-black text-slate-900 tabular-nums">{format(new Date(service.date), 'dd')}</span>
                   <span className="text-[10px] font-bold text-slate-400 tracking-wider">{format(new Date(service.date), 'yyyy')}</span>
                </div>
                <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">{service.title}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm",
                        service.status === 'completed' ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100' : 'bg-indigo-50 text-indigo-600 shadow-indigo-100'
                      )}>
                        {service.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {service.startTime}</span>
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> <span className="font-bold text-slate-900">{service.attendanceCount || 0}</span> Attended</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase tracking-tighter text-slate-600">{service.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all text-[10px] font-bold uppercase"
                      onClick={() => {
                        setSelectedService(service);
                        setIsAttendanceOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Headcount
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all text-[10px] font-bold uppercase"
                      onClick={() => {
                        setSelectedService(service);
                        setIsChecklistOpen(true);
                      }}
                    >
                      <UserCheck className="w-3 h-3" />
                      Check-list
                    </Button>
                    <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold uppercase">Details</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
