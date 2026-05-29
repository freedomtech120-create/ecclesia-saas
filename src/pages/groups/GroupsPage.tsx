import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users2, Plus, Search, MoreVertical, Edit2, Trash2, Shield, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function GroupsPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [groups, setGroups] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const userRole = profile?.role || profile?.staffData?.role || '';
  const userBranchId = profile?.staffData?.assignedBranchId || '';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'ministry',
    branchId: 'all',
  });

  const categories = [
    { value: 'ministry', label: 'Ministry' },
    { value: 'fellowship', label: 'Fellowship' },
    { value: 'department', label: 'Department' },
    { value: 'other', label: 'Other' },
  ];

  // Pre-set branchId for pastors
  useEffect(() => {
    if (userRole === 'pastor' && userBranchId) {
      setFormData(prev => ({ ...prev, branchId: userBranchId }));
    }
  }, [userRole, userBranchId]);

  useEffect(() => {
    if (!effectiveTenantId) return;

    // Fetch groups
    const q = query(
      collection(db, 'groups'),
      where('tenantId', '==', effectiveTenantId)
    );

    const unsubscribeGroups = onSnapshot(q, (snapshot) => {
      const groupData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGroups(groupData);
      setLoading(false);
    }, (error) => {
      console.error("Groups onSnapshot error:", error);
      toast.error("Failed to load groups: " + error.message);
      setLoading(false);
    });

    // Fetch branches
    const bQuery = query(
      collection(db, 'branches'),
      where('tenantId', '==', effectiveTenantId)
    );
    const unsubscribeBranches = onSnapshot(bQuery, (snapshot) => {
      setBranches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch staff
    const sQuery = query(
      collection(db, 'staff'),
      where('tenantId', '==', effectiveTenantId)
    );
    const unsubscribeStaff = onSnapshot(sQuery, (snapshot) => {
      setStaff(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeGroups();
      unsubscribeBranches();
      unsubscribeStaff();
    };
  }, [effectiveTenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'groups', editingGroup.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Group updated successfully');
      } else {
        await addDoc(collection(db, 'groups'), {
          ...formData,
          tenantId: effectiveTenantId,
          createdAt: serverTimestamp(),
        });
        toast.success('Group created successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error('Error saving group: ' + error.message);
    }
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      category: group.category,
      branchId: group.branchId || 'all',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await deleteDoc(doc(db, 'groups', id));
      toast.success('Group deleted');
    } catch (error: any) {
      toast.error('Error deleting group: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      category: 'ministry',
      branchId: userRole === 'pastor' && userBranchId ? userBranchId : 'all',
    });
  };

  const filteredGroups = groups.filter(g => {
    // Branch filter for pastors
    if (userRole === 'pastor' && userBranchId) {
      if (g.branchId !== 'all' && g.branchId !== userBranchId) {
        return false;
      }
    }
    return g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 italic">Groups & Ministries</h1>
          <p className="text-slate-500 mt-1">Manage departments, fellowships, and ministry groups across the organization.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger render={
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 gap-2 h-11 px-6">
              <Plus className="w-4 h-4" /> Create New Group
            </Button>
          } />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold italic">{editingGroup ? 'Edit Group' : 'Create Group'}</DialogTitle>
              <DialogDescription>
                Define a new group or ministry for your church organization.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Group Name</Label>
                <Input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Youth Ministry"
                  required
                  className="h-11 border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Branch Exposure</Label>
                  {userRole === 'pastor' && userBranchId ? (
                    <div className="h-11 border border-slate-200 rounded-md bg-slate-50 flex items-center px-3 text-xs font-semibold text-slate-600">
                      {branches.find(b => b.id === userBranchId)?.name || 'Local Branch'} (Restricted to Branch)
                    </div>
                  ) : (
                    <Select value={formData.branchId} onValueChange={v => setFormData({...formData, branchId: v})}>
                      <SelectTrigger className="h-11 border-slate-200">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Global (All Branches)</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</Label>
                <Textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="What is the purpose of this group?"
                  className="min-h-[100px] border-slate-200"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-8">
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search groups..." 
                className="pl-10 h-10 border-slate-200 bg-white"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Group Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Branch Exposure</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Group Representative / Leader</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400">Loading groups...</TableCell>
                </TableRow>
              ) : filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400">No groups found.</TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="font-bold text-slate-900 italic">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                          <Users2 className="w-4 h-4" />
                        </div>
                        {group.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-white capitalize text-[10px] font-bold tracking-wider py-0.5">
                        {group.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-500">
                      {group.branchId === 'all' ? (
                        <Badge variant="secondary" className="bg-slate-100 text-[10px] font-bold">Global</Badge>
                      ) : (
                        branches.find(b => b.id === group.branchId)?.name || 'Local Branch'
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {(() => {
                        const leader = staff.find(s => 
                          (s.department?.toLowerCase() === group.name?.toLowerCase()) ||
                          (s.responsibility === 'group_president' && s.department?.toLowerCase() === group.name?.toLowerCase())
                        );
                        if (leader) {
                          return (
                            <div className="flex items-center gap-1.5 bg-emerald-50/50 border border-emerald-100 rounded-full px-2.5 py-1 text-xs text-emerald-700 w-fit">
                              <Shield className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="font-bold">{leader.firstName} {leader.lastName}</span>
                              <span className="text-[10px] text-emerald-500 font-semibold italic ml-0.5">({leader.position || 'Leader'})</span>
                            </div>
                          );
                        }
                        return <span className="text-slate-400 text-xs italic">Unassigned</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                      {group.description || 'No description'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => handleEdit(group)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(group.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
