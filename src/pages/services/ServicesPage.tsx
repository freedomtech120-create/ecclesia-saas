import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, Plus, Users, CheckCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { doc, updateDoc } from 'firebase/firestore';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          <Input type="number" value={data.totalCount} onChange={e => setData({...data, totalCount: e.target.value})} required />
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
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  
  const [newService, setNewService] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    type: 'Sunday Service',
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'services'),
      where('tenantId', '==', profile.tenantId)
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
  }, [profile?.tenantId]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    try {
      await addDoc(collection(db, 'services'), {
        ...newService,
        tenantId: profile.tenantId,
        branchId: profile.branchIds?.[0] || 'main',
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
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <Plus className="w-4 h-4" />
                Schedule Service
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
                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-slate-500">Service Title</Label>
                <Input id="title" value={newService.title} onChange={e => setNewService({...newService, title: e.target.value})} placeholder="e.g. Sunday Worship" required className="border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</Label>
                  <Input id="date" type="date" value={newService.date} onChange={e => setNewService({...newService, date: e.target.value})} required className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-xs font-bold uppercase tracking-wider text-slate-500">Start Time</Label>
                  <Input id="time" type="time" value={newService.startTime} onChange={e => setNewService({...newService, startTime: e.target.value})} required className="border-slate-200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-xs font-bold uppercase tracking-wider text-slate-500">Service Type</Label>
                <Input id="type" value={newService.type} onChange={e => setNewService({...newService, type: e.target.value})} placeholder="Main Service / Youth / Mid-week" className="border-slate-200" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Create Service</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
            <DialogDescription>
              Capturing attendance for {selectedService?.title} on {selectedService && format(new Date(selectedService.date), 'PPP')}.
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
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                      onClick={() => {
                        setSelectedService(service);
                        setIsAttendanceOpen(true);
                      }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Attendance
                    </Button>
                    <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">Details</Button>
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
