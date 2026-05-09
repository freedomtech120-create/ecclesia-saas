import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Search, Filter, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function MembersPage() {
  const { profile, isPastor } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [newMember, setNewMember] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    branchId: '',
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    // Fetch branches for selection
    getDocs(query(collection(db, 'branches'), where('tenantId', '==', profile.tenantId))).then(snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    let q = query(
      collection(db, 'members'),
      where('tenantId', '==', profile.tenantId)
    );

    // If pastor, restrict to their branch
    if (isPastor && profile.staffData?.assignedBranchId && profile.staffData.assignedBranchId !== 'none') {
      q = query(
        collection(db, 'members'),
        where('tenantId', '==', profile.tenantId),
        where('branchId', '==', profile.staffData.assignedBranchId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching members:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.tenantId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    try {
      await addDoc(collection(db, 'members'), {
        ...newMember,
        tenantId: profile.tenantId,
        branchId: newMember.branchId || profile.staffData?.assignedBranchId || 'main',
        createdAt: serverTimestamp(),
        status: 'active'
      });
      toast.success('Member added successfully');
      setIsAddOpen(false);
      setNewMember({ firstName: '', lastName: '', email: '', phone: '', branchId: '' });
    } catch (error: any) {
      toast.error('Failed to add member: ' + error.message);
    }
  };

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Members</h1>
          <p className="text-slate-500 mt-1">Manage your congregation and track engagement.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <UserPlus className="w-4 h-4" />
                Add Member
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
              <DialogDescription>Enter the details of the new church member.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-slate-500">First Name</Label>
                  <Input id="firstName" value={newMember.firstName} onChange={e => setNewMember({...newMember, firstName: e.target.value})} required className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Name</Label>
                  <Input id="lastName" value={newMember.lastName} onChange={e => setNewMember({...newMember, lastName: e.target.value})} required className="border-slate-200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                <Input id="email" type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</Label>
                <Input id="phone" value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} className="border-slate-200" />
              </div>
              
              {!isPastor && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Branch Assignment</Label>
                  <Select value={newMember.branchId} onValueChange={v => setNewMember({...newMember, branchId: v})}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Main/Central</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Save Member</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search members by name or email..." 
            className="pl-10 border-slate-200 bg-slate-50/50"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2 border-slate-200 text-slate-600">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400">Loading members...</TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">No members found matching your search.</TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                  <TableCell className="font-bold text-slate-900">{member.firstName} {member.lastName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                       <MapPin className="w-3 h-3 text-indigo-400" />
                       {branches.find(b => b.id === member.branchId)?.name || member.branchId || 'Main'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{member.email || '—'}</TableCell>
                  <TableCell className="text-sm text-slate-500 tabular-nums">{member.phone || '—'}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600">Active</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/members/${member.id}`);
                      }}
                    >
                      Profile
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
