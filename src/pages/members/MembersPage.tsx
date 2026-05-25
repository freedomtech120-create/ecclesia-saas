import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Search, Filter, MapPin, AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function MembersPage() {
  const { profile, isPastor } = useAuth();
  const { effectiveTenantId } = useTenant();
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [newMember, setNewMember] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    branchId: '',
    groupIds: [] as string[]
  });

  const [duplicateMember, setDuplicateMember] = useState<any>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isTransferFromDuplicateOpen, setIsTransferFromDuplicateOpen] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [transferToBranchId, setTransferToBranchId] = useState('');

  useEffect(() => {
    if (!effectiveTenantId) return;

    // Fetch branches for selection
    getDocs(query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId))).then(snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch groups for selection
    getDocs(query(collection(db, 'groups'), where('tenantId', '==', effectiveTenantId))).then(snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    let q = query(
      collection(db, 'members'),
      where('tenantId', '==', effectiveTenantId)
    );

    // If pastor, restrict to their branch
    if (isPastor && profile?.staffData?.assignedBranchId && profile.staffData.assignedBranchId !== 'none') {
      q = query(
        collection(db, 'members'),
        where('tenantId', '==', effectiveTenantId),
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
  }, [effectiveTenantId, isPastor, profile?.staffData?.assignedBranchId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      // 1. Fetch ALL members under this Tenant for duplicate check
      const mSnap = await getDocs(query(
        collection(db, 'members'),
        where('tenantId', '==', effectiveTenantId)
      ));
      const allMembers = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const duplicate = allMembers.find(m => {
        // Strip non-numbers from phone for comparison
        const cleanNewPhone = newMember.phone?.replace(/[^0-9]/g, '');
        const cleanExistingPhone = m.phone?.replace(/[^0-9]/g, '');
        
        if (cleanNewPhone && cleanExistingPhone && cleanNewPhone === cleanExistingPhone) {
          return true;
        }

        if (newMember.email && m.email && newMember.email.toLowerCase().trim() === m.email.toLowerCase().trim() && m.email.length > 3) {
          return true;
        }

        if (m.firstName.toLowerCase().trim() === newMember.firstName.toLowerCase().trim() &&
            m.lastName.toLowerCase().trim() === newMember.lastName.toLowerCase().trim()) {
          return true;
        }

        return false;
      });

      if (duplicate) {
        setDuplicateMember(duplicate);
        setIsAddOpen(false); // Close add form
        setIsDuplicateOpen(true); // Open duplicate warning
        return;
      }

      await addDoc(collection(db, 'members'), {
        ...newMember,
        tenantId: effectiveTenantId,
        branchId: newMember.branchId || profile?.staffData?.assignedBranchId || 'main',
        createdAt: serverTimestamp(),
        status: 'active'
      });
      toast.success('Member added successfully');
      setIsAddOpen(false);
      setNewMember({ firstName: '', lastName: '', email: '', phone: '', branchId: '', groupIds: [] });
    } catch (error: any) {
      toast.error('Failed to add member: ' + error.message);
    }
  };

  const handleDuplicateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateMember || !transferToBranchId || !transferReason) {
      toast.error('Please specify the destination branch and transfer reason');
      return;
    }

    if (duplicateMember.branchId === transferToBranchId) {
      toast.error('Member is already registered in that branch');
      return;
    }

    if (duplicateMember.transfer_status === 'pending') {
      toast.error('This member already has an active pending transfer request');
      return;
    }

    const tCode = 'TRF-' + Math.floor(100000 + Math.random() * 900000);

    try {
      // 2. Lock member
      await updateDoc(doc(db, 'members', duplicateMember.id), {
        transfer_status: 'pending'
      });

      // 1. Create transfer record
      await addDoc(collection(db, 'member_transfers'), {
        tenantId: effectiveTenantId,
        transfer_code: tCode,
        member_id: duplicateMember.id,
        member_name: `${duplicateMember.firstName} ${duplicateMember.lastName}`,
        from_branch_id: duplicateMember.branchId || 'main',
        to_branch_id: transferToBranchId,
        initiated_by: profile?.uid || 'unknown',
        initiated_by_name: profile?.displayName || 'Authorized Pastor',
        transfer_reason: transferReason,
        rejection_reason: '',
        status: 'pending',
        notes: 'Initiated automatically from branch duplicate screening check',
        initiated_at: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 3. Write compliancy audit log
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: effectiveTenantId,
        userId: profile?.uid || 'unknown',
        branchId: duplicateMember.branchId || 'main',
        action: 'Transfer Initiated',
        details: `Initiated transfer for duplicate detection member ${duplicateMember.firstName} ${duplicateMember.lastName} with code ${tCode}`,
        createdAt: serverTimestamp()
      });

      // 4. Send notification
      await addDoc(collection(db, 'notifications'), {
        tenantId: effectiveTenantId,
        branchId: transferToBranchId,
        title: 'Incoming Member Transfer',
        message: `A transfer request for duplicate detected member ${duplicateMember.firstName} ${duplicateMember.lastName} (${tCode}) was initiated.`,
        type: 'transfer_initiated',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success('Transfer request logged successfully! The receiving branch is notified.');
      setIsTransferFromDuplicateOpen(false);
      setDuplicateMember(null);
      setTransferReason('');
      setTransferToBranchId('');
    } catch (error: any) {
      toast.error('Failed to submit transfer: ' + error.message);
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

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ministry/Groups</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-slate-100 rounded-lg p-3 bg-slate-50/50 max-h-[120px] overflow-y-auto">
                   {groups.length === 0 ? (
                     <p className="text-[10px] text-slate-400 italic col-span-2">No groups created yet</p>
                   ) : groups.map(g => (
                     <label key={g.id} className="flex items-center gap-2 cursor-pointer group">
                       <input 
                         type="checkbox" 
                         className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                         checked={newMember.groupIds.includes(g.id)}
                         onChange={(e) => {
                           const ids = e.target.checked 
                             ? [...newMember.groupIds, g.id]
                             : newMember.groupIds.filter(id => id !== g.id);
                           setNewMember({...newMember, groupIds: ids});
                         }}
                       />
                       <span className="text-xs text-slate-600 group-hover:text-indigo-600 transition-colors truncate">{g.name}</span>
                     </label>
                   ))}
                </div>
              </div>
              
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

      {/* 1. Duplicate Warning Dialog Board */}
      <Dialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 animate-pulse" /> Duplicate Member Detected
            </DialogTitle>
            <DialogDescription>
              A member with matching contact details or exact name already exists in another branch of your church organization. Let's prevent double registrations.
            </DialogDescription>
          </DialogHeader>
          {duplicateMember && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 flex flex-col gap-1">
                <p className="font-bold text-slate-900 text-base">{duplicateMember.firstName} {duplicateMember.lastName}</p>
                <p className="text-xs text-slate-500 font-semibold">
                  Current Branch: <span className="text-indigo-600 font-bold">{branches.find(b => b.id === duplicateMember.branchId)?.name || duplicateMember.branchId || 'Main/Central'}</span>
                </p>
                <p className="text-xs text-slate-500">Email: {duplicateMember.email || '—'}</p>
                <p className="text-xs text-slate-500">Phone: {duplicateMember.phone || '—'}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 text-slate-700 border-slate-200"
                  onClick={() => {
                    setIsDuplicateOpen(false);
                    navigate(`/dashboard/members/${duplicateMember.id}`);
                  }}
                >
                  View Existing Profile
                </Button>
                <Button 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold"
                  onClick={() => {
                    setIsDuplicateOpen(false);
                    setIsTransferFromDuplicateOpen(true);
                  }}
                >
                  Request Transfer Instead
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. Request Transfer Modal for Duplicate Match */}
      <Dialog open={isTransferFromDuplicateOpen} onOpenChange={setIsTransferFromDuplicateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Member Transfer</DialogTitle>
            <DialogDescription>
              Request to transfer an existing member from their current branch into another branch.
            </DialogDescription>
          </DialogHeader>
          {duplicateMember && (
            <form onSubmit={handleDuplicateTransferSubmit} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Relocate Member</Label>
                <p className="text-sm font-bold text-slate-950">{duplicateMember.firstName} {duplicateMember.lastName}</p>
                <p className="text-xs text-slate-400 font-medium">Moving from: {branches.find(b => b.id === duplicateMember.branchId)?.name || 'Main/Central'}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Destination Branch</Label>
                <Select value={transferToBranchId} onValueChange={setTransferToBranchId}>
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Which campus receives them?" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                    <SelectItem value="main">Main/Central Church</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Transfer</Label>
                <Input 
                  value={transferReason} 
                  onChange={e => setTransferReason(e.target.value)} 
                  placeholder="e.g., Relocated to this town for studies" 
                  required 
                  className="border-slate-200"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-3.5 h-3.5 mr-1" /> Send Transfer Authorization
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
