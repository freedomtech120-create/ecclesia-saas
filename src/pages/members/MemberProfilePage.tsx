import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Save, 
  Trash2,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  Plus,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function VisitationTab({ memberId, tenantId, branchId }: { memberId: string, tenantId: string, branchId: string }) {
  const { profile } = useAuth();
  const [visitations, setVisitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    purpose: 'Pastoral Visit',
    outcome: '',
    notes: '',
    visitDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const q = query(
      collection(db, 'visitations'),
      where('memberId', '==', memberId),
      orderBy('visitDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setVisitations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return unsubscribe;
  }, [memberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'visitations'), {
        memberId,
        tenantId,
        branchId,
        visitorId: profile?.uid,
        recordedBy: profile?.uid,
        ...formData,
        createdAt: serverTimestamp()
      });
      toast.success('Visitation message recorded');
      setIsAddOpen(false);
      setFormData({
        purpose: 'Pastoral Visit',
        outcome: '',
        notes: '',
        visitDate: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error: any) {
      toast.error('Error saving visit: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Visitation Log</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button size="sm" className="bg-indigo-600 gap-2"><Plus className="w-4 h-4" /> Record Visit</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Visit</DialogTitle>
              <DialogDescription>Log a follow-up or pastoral visit for this member.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Visit Date</Label>
                  <Input type="date" value={formData.visitDate} onChange={e => setFormData({...formData, visitDate: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Purpose</Label>
                  <Input value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="e.g. Follow-up" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Outcome</Label>
                <Input value={formData.outcome} onChange={e => setFormData({...formData, outcome: e.target.value})} placeholder="e.g. Restored, Challenged" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Private Notes</Label>
                <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Confidential details..." />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Save Visit Record</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-center py-8 text-slate-400">Loading history...</p>
        ) : visitations.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 italic">No visits recorded for this member yet.</p>
          </div>
        ) : (
          visitations.map(v => (
            <div key={v.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start mb-2">
                <div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{v.purpose}</span>
                   <h4 className="mt-1 font-bold text-slate-900">{v.outcome || 'No outcome recorded'}</h4>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{v.visitDate}</div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed italic">{v.notes || 'No detailed notes provided.'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function MemberProfilePage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [finances, setFinances] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'active'
  });

  useEffect(() => {
    async function loadMemberData() {
      if (!memberId) return;
      try {
        const docRef = doc(db, 'members', memberId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as any;
          setMember(data);
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            status: data.status || 'active'
          });

          // Fetch recent financial contributions if any
          // Note: In the finances collection we stored 'contributor' as name/ID. 
          // For now we'll do a simple match by name or member ID if provided.
          const q = query(
            collection(db, 'finances'),
            where('contributor', '==', `${data.firstName} ${data.lastName}`),
          );
          const financeSnap = await getDocs(q);
          setFinances(financeSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        } else {
          toast.error('Member not found');
          navigate('/dashboard/members');
        }
      } catch (error) {
        console.error("Error loading member:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMemberData();
  }, [memberId, navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    try {
      await updateDoc(doc(db, 'members', memberId), formData);
      setMember({ ...member, ...formData });
      setEditMode(false);
      toast.success("Member profile updated");
    } catch (error: any) {
      toast.error("Failed to update: " + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading profile...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/members')} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-sm">
            {member.firstName?.[0]}{member.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{member.firstName} {member.lastName}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-50">
                {member.status || 'Active'}
              </span>
              <span className="text-xs text-slate-400 font-medium italic">Member since {member.joinedAt ? format(member.joinedAt.toDate(), 'MMMM yyyy') : 'Recently'}</span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">Edit Profile</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button onClick={handleUpdate} className="bg-indigo-600 gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-slate-200 shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!editMode ? (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email Address</Label>
                  <div className="flex items-center gap-2 text-slate-900 font-medium">
                    <Mail className="w-4 h-4 text-slate-300" />
                    {member.email || 'None provided'}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone Number</Label>
                  <div className="flex items-center gap-2 text-slate-900 font-medium">
                    <Phone className="w-4 h-4 text-slate-300" />
                    {member.phone || 'None provided'}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Primary Branch</Label>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <MapPin className="w-4 h-4 text-indigo-300" />
                    London Central
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">First Name</Label>
                    <Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="border-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Name</Label>
                    <Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="border-slate-200" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</Label>
                  <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="border-slate-200" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="border-slate-200" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="overview">
             <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
               <TabsTrigger value="overview" className="rounded-lg px-6">Overview</TabsTrigger>
               <TabsTrigger value="activity" className="rounded-lg px-6">Contributions</TabsTrigger>
               <TabsTrigger value="ministry" className="rounded-lg px-6">Ministry Groups</TabsTrigger>
               <TabsTrigger value="visitation" className="rounded-lg px-6">Visitations</TabsTrigger>
             </TabsList>

             <TabsContent value="overview" className="space-y-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="bg-white border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Giving</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black text-slate-900">${finances.reduce((s,r) => s + (r.amount || 0), 0).toLocaleString()}</div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Faithful Giver
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Attendance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black text-slate-900">85%</div>
                      <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">Exceeds Average</p>
                    </CardContent>
                  </Card>
               </div>

               <Card className="border-slate-200 overflow-hidden">
                 <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                   <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Recent Ministry Activity</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {[
                        { event: 'Sunday Worship Service', role: 'Attended', time: 'Last Sunday', icon: Clock },
                        { event: 'Mid-week Prayer Meeting', role: 'Intercessor', time: '3 days ago', icon: User },
                        { event: 'Monthly Tithe Recorded', role: 'Financial', time: '1 week ago', icon: DollarSign },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50/30 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <item.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.event}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.role} • {item.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                 </CardContent>
               </Card>
             </TabsContent>

             <TabsContent value="activity">
               <Card className="border-slate-200">
                 <CardHeader>
                   <CardTitle className="text-sm font-bold uppercase">Financial Ledger</CardTitle>
                   <CardDescription>History of tithes and offerings contributed by this member.</CardDescription>
                 </CardHeader>
                 <CardContent>
                   {finances.length === 0 ? (
                     <div className="py-12 text-center text-slate-400 italic">No recorded contributions found.</div>
                   ) : (
                     <div className="space-y-4">
                        {finances.map(f => (
                          <div key={f.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                               <p className="font-bold text-slate-900">{f.type || 'Offering'}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{f.category} • {f.createdAt ? format(f.createdAt.toDate(), 'PPP') : 'Recently'}</p>
                            </div>
                            <div className="text-lg font-black text-slate-900">${f.amount?.toLocaleString()}</div>
                          </div>
                        ))}
                     </div>
                   )}
                 </CardContent>
               </Card>
             </TabsContent>

             <TabsContent value="ministry">
                <Card className="border-slate-200 bg-slate-50 border-dashed p-12 text-center">
                   <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4">
                     <Users className="w-8 h-8 text-slate-300" />
                   </div>
                   <h3 className="font-bold text-slate-900">Not assigned yet</h3>
                   <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto italic">Assign this member to a ministry department (Choir, Ushering, Outreach, etc.) to track their service impact.</p>
                   <Button variant="outline" className="mt-8 border-slate-200">Assign to Ministry</Button>
                </Card>
             </TabsContent>

             <TabsContent value="visitation">
               <Card className="border-slate-200 p-6">
                 <VisitationTab memberId={memberId!} tenantId={member?.tenantId} branchId={member?.branchId} />
               </Card>
             </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
