import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, UserCheck, Shield, Mail, Phone, Trash2, Search, Briefcase, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function StaffPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'worker', // worker, pastor, admin
    position: '',
    responsibility: 'none', // none, finance, branch_manager, group_president, secretary
    assignedBranchId: '',
    tempPassword: '',
  });
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    if (!effectiveTenantId) return;

    // Fetch branches for assignment
    const bQuery = query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId));
    const unsubscribeBranches = onSnapshot(bQuery, (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Branches onSnapshot error:", error);
    });

    const q = query(
      collection(db, 'staff'),
      where('tenantId', '==', effectiveTenantId)
    );

    const unsubscribeStaff = onSnapshot(q, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaff(staffData);
      setLoading(false);
    }, (error) => {
      console.error("Staff onSnapshot error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeBranches();
      unsubscribeStaff();
    };
  }, [effectiveTenantId]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      await addDoc(collection(db, 'staff'), {
        ...newStaff,
        tenantId: effectiveTenantId,
        createdAt: serverTimestamp(),
        status: 'active'
      });

      // Also create a claim record for authentication
      if (newStaff.email && newStaff.tempPassword) {
        await setDoc(doc(db, 'staff_claims', newStaff.email.toLowerCase()), {
          tempPassword: newStaff.tempPassword,
          role: newStaff.role,
          tenantId: effectiveTenantId,
          firstName: newStaff.firstName,
          lastName: newStaff.lastName,
          createdAt: serverTimestamp()
        });
      }

      toast.success('Staff/Pastor registered successfully');
      setIsAddOpen(false);
      setNewStaff({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        phone: '', 
        role: 'worker', 
        position: '', 
        responsibility: 'none',
        assignedBranchId: '', 
        tempPassword: '' 
      });
    } catch (error: any) {
      toast.error('Failed to register: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      try {
        await deleteDoc(doc(db, 'staff', id));
        toast.success('Staff member removed');
      } catch (error: any) {
        toast.error('Error removing staff: ' + error.message);
      }
    }
  };

  const filteredStaff = staff.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff & Pastors</h1>
          <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-widest">Leadership & Worker Directory</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <UserPlus className="w-4 h-4" />
                Register Staff
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Register New Staff/Pastor</DialogTitle>
              <DialogDescription>Add a new leader or worker to your church directory.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-slate-500">First Name</Label>
                  <Input id="firstName" value={newStaff.firstName} onChange={e => setNewStaff({...newStaff, firstName: e.target.value})} placeholder="John" required className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Name</Label>
                  <Input id="lastName" value={newStaff.lastName} onChange={e => setNewStaff({...newStaff, lastName: e.target.value})} placeholder="Doe" required className="border-slate-200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                <Input id="email" type="email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} placeholder="john.doe@example.com" className="border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempPassword" className="text-xs font-bold uppercase tracking-wider text-slate-500">Initial Password</Label>
                <Input id="tempPassword" type="text" value={newStaff.tempPassword} onChange={e => setNewStaff({...newStaff, tempPassword: e.target.value})} placeholder="Generate a secure password" required={newStaff.role === 'pastor'} className="border-slate-200" />
                <p className="text-[10px] text-slate-400 font-medium">This password will be used for the first-time login.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</Label>
                    <Select value={newStaff.role} onValueChange={v => setNewStaff({...newStaff, role: v})}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pastor">Pastor</SelectItem>
                        <SelectItem value="worker">Worker</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Responsibility</Label>
                    <Select value={newStaff.responsibility} onValueChange={v => setNewStaff({...newStaff, responsibility: v})}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General</SelectItem>
                        <SelectItem value="finance">Finance Manager</SelectItem>
                        <SelectItem value="branch_manager">Branch Manager</SelectItem>
                        <SelectItem value="group_president">Group President</SelectItem>
                        <SelectItem value="secretary">Secretary</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position" className="text-xs font-bold uppercase tracking-wider text-slate-500">Position/Title</Label>
                <Input id="position" value={newStaff.position} onChange={e => setNewStaff({...newStaff, position: e.target.value})} placeholder="e.g. Lead Pastor" className="border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</Label>
                <Input id="phone" value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} placeholder="+1 234 567 890" className="border-slate-200" />
              </div>
              
              <div className="space-y-2">
                 <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Branch (Optional)</Label>
                 <Select value={newStaff.assignedBranchId} onValueChange={v => setNewStaff({...newStaff, assignedBranchId: v})}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Central / No Specific Branch</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Register</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          className="pl-10 border-slate-200 bg-white" 
          placeholder="Search by name, role or position..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Active Personnel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Display Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class/Role</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">Syncing directory...</TableCell>
                </TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">No personnel records detected.</TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((person) => (
                  <TableRow key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                        <span className="font-bold text-slate-900">{person.firstName} {person.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm w-fit",
                          person.role === 'pastor' ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-slate-100 text-slate-600 shadow-slate-100'
                        )}>
                          {person.role}
                        </span>
                        {person.responsibility && person.responsibility !== 'none' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 w-fit">
                            {person.responsibility.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-500 italic">{person.position || 'Worker'}</TableCell>
                    <TableCell>
                       <div className="flex flex-col text-[10px] font-medium text-slate-400">
                          <span className="flex items-center gap-1.5 font-bold text-slate-600">
                             <MapPin className="w-3 h-3 text-indigo-400" /> 
                             {person.assignedBranchId && person.assignedBranchId !== 'none' 
                               ? branches.find(b => b.id === person.assignedBranchId)?.name || 'Loading...'
                               : 'Central'
                             }
                          </span>
                          <span className="flex items-center gap-1.5 mt-1"><Mail className="w-3 h-3" /> {person.email || '—'}</span>
                          <span className="flex items-center gap-1.5 mt-0.5"><Phone className="w-3 h-3" /> {person.phone || '—'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                        onClick={() => handleDelete(person.id)}
                      >
                        <Trash2 className="w-4 h-4" />
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
  );
}
