import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, onSnapshot, orderBy, serverTimestamp, addDoc, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Phone, Mail, User, Users, Calendar, ArrowLeft, Save, Trash2, TrendingUp, DollarSign, Plus, Wallet, History, Share2, Globe, CheckCircle2, XCircle, Copy, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function BranchMembers({ branchId, tenantId }: { branchId: string, tenantId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'members'),
      where('branchId', '==', branchId),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("BranchMembers onSnapshot error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [branchId, tenantId]);

  const approveMember = async (id: string) => {
    try {
      await updateDoc(doc(db, 'members', id), { status: 'active' });
      toast.success('Member approved');
    } catch (err: any) {
      toast.error('Failed to approve');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading congregation...</div>;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Branch Congregation</CardTitle>
        <CardDescription>Members registered at this location. Review pending onboarding here.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">No members found.</TableCell>
              </TableRow>
            ) : (
              members.map(member => (
                <TableRow key={member.id}>
                  <TableCell className="pl-6">
                    <div className="font-bold">{member.firstName} {member.lastName}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">{member.source || 'Manual'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{member.email}</div>
                    <div className="text-xs text-slate-500">{member.phone}</div>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                      member.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                      member.status === 'pending' ? "bg-amber-50 text-amber-600 animate-pulse" : "bg-slate-100 text-slate-500"
                    )}>
                      {member.status || 'Active'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {member.createdAt ? format(member.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {member.status === 'pending' && (
                      <Button size="sm" onClick={() => approveMember(member.id)} className="bg-emerald-600 text-[10px] font-black uppercase tracking-widest h-8">
                        Approve
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" render={<Link to={`/dashboard/members/${member.id}`}>View Profile</Link>} className="h-8 ml-2" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BranchPublicForms({ branchId, tenantId, branchName }: { branchId: string, tenantId: string, branchName: string }) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    title: '',
    description: '',
    type: 'member-onboarding'
  });

  useEffect(() => {
    const q = query(
      collection(db, 'public_forms'),
      where('branchId', '==', branchId),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setForms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("BranchPublicForms onSnapshot error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [branchId, tenantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'public_forms'), {
        ...newForm,
        branchId,
        tenantId,
        status: 'active',
        createdAt: serverTimestamp(),
      });
      toast.success('Public form created!');
      setIsAddOpen(false);
      setNewForm({ title: '', description: '', type: 'member-onboarding' });
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    }
  };

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/f/${id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Are you sure? This will disable the link.')) return;
    try {
      await updateDoc(doc(db, 'public_forms', id), { status: 'closed' });
      toast.success('Form closed');
    } catch (err: any) {
      toast.error('Failed to close form');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Digital Connection Points</h3>
          <p className="text-sm text-slate-500">Links members can use to register, donate, or sign up.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 font-black uppercase tracking-widest text-[10px]">
              <Plus className="w-4 h-4" /> Create Shareable Link
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Public Form</DialogTitle>
              <DialogDescription>Generate a new link for {branchName}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Link Title</Label>
                <Input value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} placeholder="e.g. New Member Welcome" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Short Description</Label>
                <Input value={newForm.description} onChange={e => setNewForm({...newForm, description: e.target.value})} placeholder="e.g. Join our family..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Form Type</Label>
                <Select value={newForm.type} onValueChange={v => setNewForm({...newForm, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member-onboarding">Member Onboarding (Profile)</SelectItem>
                    <SelectItem value="donation">Donation / Pledge</SelectItem>
                    <SelectItem value="event-registration">Event Registration</SelectItem>
                    <SelectItem value="general">General Feedback / Inquiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-indigo-600">Generate Form Link</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
             <Globe className="w-12 h-12 text-slate-200 mx-auto mb-4" />
             <p className="text-slate-400 font-bold">No public forms created yet.</p>
          </div>
        )}
        {forms.map(form => (
          <Card key={form.id} className={cn(
            "border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden",
            form.status === 'closed' && "opacity-60 grayscale"
          )}>
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
               <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded">
                 {form.type.replace('-', ' ')}
               </span>
               {form.status === 'active' ? (
                 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
               ) : (
                 <XCircle className="w-4 h-4 text-red-400" />
               )}
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold truncate">{form.title}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[40px]">{form.description || 'Public submission form.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 gap-2 border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600"
                  onClick={() => copyLink(form.id)}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 text-[10px] font-black uppercase tracking-widest hover:text-red-600"
                  onClick={() => deleteForm(form.id)}
                >
                  {form.status === 'active' ? 'Close' : 'Closed'}
                </Button>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Created {format(form.createdAt.toDate(), 'MMM d')}</span>
                <a href={`/f/${form.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                  Preview <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BranchFinances({ branchId, tenantId, branchName }: { branchId: string, tenantId: string, branchName: string }) {
  const [finances, setFinances] = useState<any[]>([]);
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
    const q = query(
      collection(db, 'finances'),
      where('branchId', '==', branchId),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setFinances(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("BranchFinances onSnapshot error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [branchId, tenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'finances'), {
        amount: parseFloat(newRecord.amount),
        type: newRecord.type,
        category: newRecord.category,
        contributor: newRecord.contributor || (newRecord.type === 'expense' ? 'Church Expense' : 'Anonymous'),
        description: newRecord.description,
        branchId,
        tenantId,
        createdAt: serverTimestamp(),
      });
      toast.success('Financial Record Added');
      setIsAddOpen(false);
      setNewRecord({ amount: '', type: 'offering', category: 'General', contributor: '', description: '' });
    } catch (error: any) {
      toast.error('Error adding record: ' + error.message);
    }
  };

  const income = finances.filter(f => f.type !== 'expense').reduce((acc, f) => acc + (f.amount || 0), 0);
  const expenses = finances.filter(f => f.type === 'expense').reduce((acc, f) => acc + (f.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 min-w-[150px]">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Branch Income</p>
            <p className="text-xl font-black text-emerald-700">${income.toLocaleString()}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 min-w-[150px]">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Branch Expenses</p>
            <p className="text-xl font-black text-red-500">${expenses.toLocaleString()}</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="bg-indigo-600 gap-2"><Plus className="w-4 h-4" /> Add Record</Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Finance for {branchName}</DialogTitle>
              <DialogDescription>Enter income or expense details for this branch.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Amount ($)</Label>
                <Input type="number" step="0.01" value={newRecord.amount} onChange={e => setNewRecord({...newRecord, amount: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Type</Label>
                  <Select value={newRecord.type} onValueChange={v => setNewRecord({...newRecord, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offering">Offering</SelectItem>
                      <SelectItem value="tithe">Tithe</SelectItem>
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Category</Label>
                  <Input value={newRecord.category} onChange={e => setNewRecord({...newRecord, category: e.target.value})} placeholder="e.g. Building Fund" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">
                  {newRecord.type === 'expense' ? 'Beneficiary / Description' : 'Contributor / Source'}
                </Label>
                <Input value={newRecord.contributor} onChange={e => setNewRecord({...newRecord, contributor: e.target.value})} placeholder={newRecord.type === 'expense' ? 'e.g. Utility Co' : 'Anonymous'} />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Post Record</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Entity</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Type</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest pr-6">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finances.map(f => (
              <TableRow key={f.id} className="hover:bg-slate-50/50">
                <TableCell className="text-[10px] font-bold text-slate-400 uppercase pl-6">
                  {f.createdAt ? format(f.createdAt.toDate(), 'MMM d, p') : 'Syncing...'}
                </TableCell>
                <TableCell className="font-bold text-slate-900">{f.contributor}</TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                    f.type === 'expense' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  )}>
                    {f.type}
                  </span>
                </TableCell>
                <TableCell className={cn(
                  "text-right font-black tabular-nums pr-6",
                  f.type === 'expense' ? 'text-red-400' : 'text-slate-900'
                )}>
                  {f.type === 'expense' ? '-' : '+'}${f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function BranchProfilePage() {
  const { branchId } = useParams();
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const navigate = useNavigate();
  const [branch, setBranch] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ members: 0, services: 0 });
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    pastorName: ''
  });

  useEffect(() => {
    async function loadBranchData() {
      if (!branchId || !effectiveTenantId) return;
      try {
        const branchDoc = await getDoc(doc(db, 'branches', branchId));
        if (branchDoc.exists()) {
          const data = { id: branchDoc.id, ...branchDoc.data() } as any;
          if (data.tenantId !== effectiveTenantId) {
            toast.error('Unauthorized access to branch record');
            navigate('/dashboard/branches');
            return;
          }
          setBranch(data);
          setFormData({
            name: data.name || '',
            address: data.address || '',
            contactEmail: data.contactEmail || '',
            contactPhone: data.contactPhone || '',
            pastorName: data.pastorName || ''
          });

          // Fetch member count for this branch
          const membersQuery = query(
            collection(db, 'members'), 
            where('tenantId', '==', effectiveTenantId),
            where('branchId', '==', branchId)
          );
          const membersSnap = await getDocs(membersQuery);
          
          const servicesQuery = query(
            collection(db, 'services'), 
            where('tenantId', '==', effectiveTenantId),
            where('branchId', '==', branchId)
          );
          const servicesSnap = await getDocs(servicesQuery);

          setStats({
            members: membersSnap.size,
            services: servicesSnap.size
          });

          // Fetch staff for assignment
          if (effectiveTenantId) {
            const staffQuery = query(
              collection(db, 'staff'),
              where('tenantId', '==', effectiveTenantId),
              where('role', 'in', ['pastor', 'worker', 'admin'])
            );
            const staffSnap = await getDocs(staffQuery);
            setStaff(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }
        } else {
          toast.error("Branch not found");
          navigate('/dashboard/branches');
        }
      } catch (error) {
        console.error("Error loading branch:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBranchData();
  }, [branchId, navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    try {
      await updateDoc(doc(db, 'branches', branchId), formData);
      setBranch({ ...branch, ...formData });
      setEditMode(false);
      toast.success("Branch profile updated successfully");
    } catch (error: any) {
      toast.error("Update failed: " + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading branch profile...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/branches')} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{branch.name}</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-1.5 italic">
            <MapPin className="w-3 h-3" /> {branch.address}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)} className="bg-indigo-600 hover:bg-indigo-700">Edit Profile</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button onClick={handleUpdate} className="bg-indigo-600 gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200">
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Users className="w-3.5 h-3.5" /> Total Members
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900">{stats.members}</div>
           </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Calendar className="w-3.5 h-3.5" /> Total Services
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900">{stats.services}</div>
           </CardContent>
        </Card>
        <Card className="bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100">
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-bold text-white/70 uppercase tracking-widest">Branch Status</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-lg font-bold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                Active Location
             </div>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="overview" className="rounded-lg px-8">Overview</TabsTrigger>
          <TabsTrigger value="members" className="rounded-lg px-8">Members</TabsTrigger>
          <TabsTrigger value="finances" className="rounded-lg px-8">Finances</TabsTrigger>
          <TabsTrigger value="connect" className="rounded-lg px-8">Connect Links</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg px-8 text-red-600">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!editMode ? (
                  <>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</p>
                        <p className="font-medium text-slate-900">{branch.contactEmail || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone Number</p>
                        <p className="font-medium text-slate-900">{branch.contactPhone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lead Pastor</p>
                        <p className="font-bold text-indigo-600">{branch.pastorName || 'Unassigned'}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                       <Label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-2">
                         <User className="w-3 h-3" /> Assign Lead Pastor
                       </Label>
                       <Select value={formData.pastorName} onValueChange={v => setFormData({...formData, pastorName: v})}>
                         <SelectTrigger className="border-indigo-100 bg-white">
                           <SelectValue placeholder="Select a Pastor" />
                         </SelectTrigger>
                         <SelectContent>
                           {staff.length === 0 ? (
                             <SelectItem value="unassigned" disabled>No staff registered yet</SelectItem>
                           ) : (
                             staff.map(s => (
                               <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>
                                 {s.firstName} {s.lastName} ({s.position || s.role})
                               </SelectItem>
                             ))
                           )}
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Branch Name</Label>
                       <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="border-slate-200" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Address</Label>
                       <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="border-slate-200" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Contact Email</Label>
                       <Input value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} className="border-slate-200" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Contact Phone</Label>
                       <Input value={formData.contactPhone} onChange={e => setFormData({...formData, contactPhone: e.target.value})} className="border-slate-200" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50 border-dashed">
               <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase text-slate-500">Ministerial Stats</CardTitle>
               </CardHeader>
               <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
                    <TrendingUp className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-slate-900">Steady Growth</h4>
                  <p className="text-xs text-slate-500 mt-2">This branch has seen a 14% increase in attendance over the last quarter.</p>
               </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
           <BranchMembers branchId={branchId!} tenantId={effectiveTenantId!} />
        </TabsContent>

        <TabsContent value="finances">
          <BranchFinances branchId={branchId!} tenantId={effectiveTenantId!} branchName={branch.name} />
        </TabsContent>

        <TabsContent value="connect">
          <BranchPublicForms branchId={branchId!} tenantId={effectiveTenantId!} branchName={branch.name} />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-red-100 bg-red-50/20">
             <CardHeader>
               <CardTitle className="text-red-700">Danger Zone</CardTitle>
               <CardDescription>Permanent actions that cannot be undone.</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-white border border-red-100 rounded-xl">
                 <div>
                    <p className="font-bold text-slate-900">Archive Branch</p>
                    <p className="text-sm text-slate-500">Temporarily deactivate this branch and its data.</p>
                 </div>
                 <Button variant="outline" className="text-red-600 border-red-100 bg-red-50/50 hover:bg-red-50">Archive</Button>
               </div>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
