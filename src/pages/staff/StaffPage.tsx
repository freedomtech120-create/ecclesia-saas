import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, UserCheck, Shield, Mail, Phone, Trash2, Search, Briefcase, MapPin, Sparkles, Layers } from 'lucide-react';
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

  // Local Executive / Member Promotion States
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [executiveRole, setExecutiveRole] = useState('worker');
  const [executivePosition, setExecutivePosition] = useState('');
  const [execTempPassword, setExecTempPassword] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // Toggle for login enable status (Pure Record VS System Access)
  const [promoteEnableLogin, setPromoteEnableLogin] = useState(false);
  const [manualEnableLogin, setManualEnableLogin] = useState(false);

  const userRole = profile?.role || profile?.staffData?.role || '';
  const userBranchId = profile?.staffData?.assignedBranchId || '';

  // Pre-set assignedBranchId for pastors
  useEffect(() => {
    if (userBranchId && userRole === 'pastor') {
      setNewStaff(prev => ({ ...prev, assignedBranchId: userBranchId }));
    }
  }, [userBranchId, userRole]);

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

    // Fetch local groups
    const gQuery = query(collection(db, 'groups'), where('tenantId', '==', effectiveTenantId));
    const unsubscribeGroups = onSnapshot(gQuery, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => {
      console.error("Groups load error:", error);
    });

    // Fetch members (scoped to branch if pastor)
    const mQuery = (userRole === 'pastor' && userBranchId)
      ? query(collection(db, 'members'), where('tenantId', '==', effectiveTenantId), where('branchId', '==', userBranchId))
      : query(collection(db, 'members'), where('tenantId', '==', effectiveTenantId));
    
    const unsubscribeMembers = onSnapshot(mQuery, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Members load error:", error);
    });

    return () => {
      unsubscribeBranches();
      unsubscribeStaff();
      unsubscribeGroups();
      unsubscribeMembers();
    };
  }, [effectiveTenantId, userRole, userBranchId]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      await addDoc(collection(db, 'staff'), {
        ...newStaff,
        systemAccess: manualEnableLogin,
        tenantId: effectiveTenantId,
        createdAt: serverTimestamp(),
        status: 'active'
      });

      // Also create a claim record/user index for login only if system access is enabled
      if (manualEnableLogin && newStaff.email && newStaff.tempPassword) {
        await setDoc(doc(db, 'staff_claims', newStaff.email.toLowerCase().trim()), {
          tempPassword: newStaff.tempPassword,
          role: newStaff.role,
          tenantId: effectiveTenantId,
          firstName: newStaff.firstName,
          lastName: newStaff.lastName,
          createdAt: serverTimestamp()
        });

        try {
          const uQuery = query(collection(db, 'users'), where('email', '==', newStaff.email.trim().toLowerCase()));
          const uSnap = await getDocs(uQuery);

          if (!uSnap.empty) {
            await updateDoc(doc(db, 'users', uSnap.docs[0].id), {
              role: newStaff.role
            });
          } else {
            await addDoc(collection(db, 'users'), {
              tenantId: effectiveTenantId,
              role: newStaff.role,
              email: newStaff.email.trim().toLowerCase(),
              displayName: `${newStaff.firstName} ${newStaff.lastName}`.trim(),
              createdAt: serverTimestamp()
            });
          }
        } catch (uErr) {
          console.warn("User index sync warning during manual staff create:", uErr);
        }
      }

      toast.success('Staff record added successfully');
      setManualEnableLogin(false);
      setIsAddOpen(false);
      setNewStaff({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        phone: '', 
        role: 'worker', 
        position: '', 
        responsibility: 'none',
        assignedBranchId: userRole === 'pastor' ? userBranchId : '', 
        tempPassword: '' 
      });
    } catch (error: any) {
      toast.error('Failed to register: ' + error.message);
    }
  };

  const handlePromoteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    const member = members.find(m => m.id === selectedMemberId);
    if (!member) {
      toast.error("Please select a registered member first.");
      return;
    }

    const group = groups.find(g => g.id === selectedGroupId);
    const effectiveBranchId = userRole === 'pastor' ? userBranchId : (member.branchId || 'none');

    try {
      // 1. Create local staff document representing this promoted leader/executive
      await addDoc(collection(db, 'staff'), {
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        email: (member.email || '').trim(),
        phone: member.phone || '',
        role: executiveRole, 
        position: executivePosition || (group ? `${group.name} Leader` : 'Local Leader'),
        responsibility: group ? 'group_president' : 'none',
        assignedBranchId: effectiveBranchId,
        department: group ? group.name : '',
        systemAccess: promoteEnableLogin,
        tenantId: effectiveTenantId,
        createdAt: serverTimestamp(),
        status: 'active'
      });

      // 2. Setup login claims only if system access registration is checked/enabled
      if (promoteEnableLogin && member.email && execTempPassword) {
        await setDoc(doc(db, 'staff_claims', member.email.toLowerCase().trim()), {
          tempPassword: execTempPassword,
          role: executiveRole,
          tenantId: effectiveTenantId,
          firstName: member.firstName || '',
          lastName: member.lastName || '',
          createdAt: serverTimestamp()
        });

        // Sync or write to users collection to allow instant RBAC recognition
        try {
          const uQuery = query(collection(db, 'users'), where('email', '==', member.email.trim().toLowerCase()));
          const uSnap = await getDocs(uQuery);

          if (!uSnap.empty) {
            await updateDoc(doc(db, 'users', uSnap.docs[0].id), {
              role: executiveRole,
              department: group ? group.name : ''
            });
          } else {
            await addDoc(collection(db, 'users'), {
              tenantId: effectiveTenantId,
              role: executiveRole,
              email: member.email.trim().toLowerCase(),
              displayName: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
              department: group ? group.name : '',
              createdAt: serverTimestamp()
            });
          }
        } catch (uErr) {
          console.warn("User index sync warning:", uErr);
        }
      }

      // 3. Assign groups etc -> Updates member document's groupIds tracking list
      if (selectedGroupId) {
        const currentGroupIds = member.groupIds || [];
        if (!currentGroupIds.includes(selectedGroupId)) {
          const updatedGroupIds = [...currentGroupIds, selectedGroupId];
          await updateDoc(doc(db, 'members', member.id), {
            groupIds: updatedGroupIds
          });
        }
      }

      toast.success(`Successfully registered ${member.firstName || ''} ${member.lastName || ''} as Local executive leader!`);
      setSelectedMemberId('');
      setSelectedGroupId('');
      setExecutivePosition('');
      setExecTempPassword('');
      setPromoteEnableLogin(false);
      setIsAddOpen(false);
    } catch (error: any) {
      toast.error('Failed to register executive: ' + error.message);
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

  const filteredStaff = staff.filter(s => {
    // If user is a pastor, only show staff registered for their assigned branch
    if (userRole === 'pastor' && userBranchId) {
      if (s.assignedBranchId !== userBranchId) return false;
    }
    return `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.position || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 italic">Staff & Pastors</h1>
          <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-widest">Leadership & Worker Directory</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <UserPlus className="w-4 h-4" />
                Register Staff / Leader
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-xl border-slate-200">
            <DialogHeader className="p-6 pb-0 bg-slate-50/50">
              <DialogTitle className="text-2xl font-bold italic">Register Staff / Leader</DialogTitle>
              <DialogDescription>Add new leadership credentials or promote members to executives.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="promote" className="w-full">
              <div className="px-6 bg-slate-50/50 pb-4 border-b border-slate-100">
                <TabsList className="grid w-full grid-cols-2 bg-slate-100/80 p-1 rounded-lg">
                  <TabsTrigger value="promote" className="text-xs font-bold uppercase tracking-wider py-2">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                    Promote Member
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="text-xs font-bold uppercase tracking-wider py-2">
                    <UserPlus className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                    Manual Creation
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB 1: Member Promotion (Executive registration with group assignment) */}
              <TabsContent value="promote" className="p-6 focus-visible:outline-none focus-visible:ring-0 m-0">
                <form onSubmit={handlePromoteMember} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">1. Select Registered Member</Label>
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger className="border-slate-200 h-11 bg-white">
                        <SelectValue placeholder="Search and select from members directory" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {members.length === 0 ? (
                          <div className="text-center p-4 text-xs text-slate-400">No matching members registered.</div>
                        ) : (
                          members.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.firstName} {m.lastName} {m.email ? `(${m.email})` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">2. Assign Department/Group</Label>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger className="border-slate-200 h-11 bg-white">
                          <SelectValue placeholder="Select Group/Ministry" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.length === 0 ? (
                            <div className="text-center p-4 text-xs text-slate-400">No ministries found.</div>
                          ) : (
                            groups.map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">3. Staff Login Role</Label>
                      <Select value={executiveRole} onValueChange={setExecutiveRole}>
                        <SelectTrigger className="border-slate-200 h-11 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="worker">Worker (Leader)</SelectItem>
                          <SelectItem value="pastor">Pastor / Executive</SelectItem>
                          <SelectItem value="admin">Admin Partner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Position / Title Override</Label>
                    <Input 
                      value={executivePosition} 
                      onChange={e => setExecutivePosition(e.target.value)} 
                      placeholder="e.g. Youth President, Treasurer (Defaults based on group)" 
                      className="border-slate-200 h-11 bg-white" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Access / Login Privileges</Label>
                    <Select value={promoteEnableLogin ? 'true' : 'false'} onValueChange={v => setPromoteEnableLogin(v === 'true')}>
                      <SelectTrigger className="h-11 border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Data Record Only (Offline personnel - No login)</SelectItem>
                        <SelectItem value="true">Active System Login (Requires credentials)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {promoteEnableLogin && (
                    <div className="space-y-1.5 rounded-lg border border-indigo-100 bg-indigo-50/20 p-4 transition-all">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-800">Assign Login Credentials</Label>
                      </div>
                      <Input 
                        type="text" 
                        value={execTempPassword} 
                        onChange={e => setExecTempPassword(e.target.value)} 
                        placeholder="Configure starting temporary password" 
                        required={promoteEnableLogin}
                        className="border-slate-200 h-11 bg-white text-xs font-mono" 
                      />
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">Providing a password allows this leader to securely log in immediately via physical or mobile application panels using their registered email address.</p>
                    </div>
                  )}

                  <DialogFooter className="pt-2">
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 font-bold">
                      Promote to local executive
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              {/* TAB 2: Custom Manual Addition */}
              <TabsContent value="manual" className="p-6 focus-visible:outline-none focus-visible:ring-0 m-0">
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-[10px] font-black uppercase tracking-widest text-slate-500">First Name</Label>
                      <Input id="firstName" value={newStaff.firstName} onChange={e => setNewStaff({...newStaff, firstName: e.target.value})} placeholder="John" required className="border-slate-200 h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Name</Label>
                      <Input id="lastName" value={newStaff.lastName} onChange={e => setNewStaff({...newStaff, lastName: e.target.value})} placeholder="Doe" required className="border-slate-200 h-11" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Address</Label>
                    <Input id="email" type="email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} placeholder="john.doe@example.com" className="border-slate-200 h-11" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Access / Login Privileges</Label>
                    <Select value={manualEnableLogin ? 'true' : 'false'} onValueChange={v => setManualEnableLogin(v === 'true')}>
                      <SelectTrigger className="h-11 border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Data Record Only (Offline personnel - No login)</SelectItem>
                        <SelectItem value="true">Active System Login (Requires credentials)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {manualEnableLogin && (
                    <div className="space-y-1.5 rounded-lg border border-indigo-100 bg-indigo-50/30 p-4 transition-all col-span-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-800">Assign Login Password</Label>
                      </div>
                      <Input 
                        id="tempPassword" 
                        type="text" 
                        value={newStaff.tempPassword} 
                        onChange={e => setNewStaff({...newStaff, tempPassword: e.target.value})} 
                        placeholder="Generate a secure password" 
                        required={manualEnableLogin} 
                        className="border-slate-200 h-11 bg-white text-xs font-mono" 
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Role</Label>
                        <Select value={newStaff.role} onValueChange={v => setNewStaff({...newStaff, role: v})}>
                          <SelectTrigger className="border-slate-200 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pastor">Pastor/Manager</SelectItem>
                            <SelectItem value="worker">Worker</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Responsibility</Label>
                        <Select value={newStaff.responsibility} onValueChange={v => setNewStaff({...newStaff, responsibility: v})}>
                          <SelectTrigger className="border-slate-200 h-11">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="position" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Position/Title</Label>
                    <Input id="position" value={newStaff.position} onChange={e => setNewStaff({...newStaff, position: e.target.value})} placeholder="e.g. Lead Pastor" className="border-slate-200 h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone Number</Label>
                    <Input id="phone" value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} placeholder="+1 234 567 890" className="border-slate-200 h-11" />
                  </div>
                  
                  {userRole !== 'pastor' && (
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assigned Branch (Optional)</Label>
                       <Select value={newStaff.assignedBranchId} onValueChange={v => setNewStaff({...newStaff, assignedBranchId: v})}>
                          <SelectTrigger className="border-slate-200 h-11">
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
                  )}

                  <DialogFooter className="pt-2">
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 font-bold">Register Staff</Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
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
                        {person.systemAccess ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 w-fit flex items-center gap-1 shadow-sm">
                            <Shield className="w-2.5 h-2.5 text-blue-500" /> Active Login
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200/60 w-fit">
                            Record Only (No Login)
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
