import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, Phone, Mail, User } from 'lucide-react';
import { toast } from 'sonner';

export default function BranchesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [newBranch, setNewBranch] = useState({
    name: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    pastorName: '',
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'branches'),
      where('tenantId', '==', profile.tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBranches(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching branches:", error);
      setLoading(false);
    });

    // Fetch staff for assignment
    const staffQuery = query(
      collection(db, 'staff'),
      where('tenantId', '==', profile.tenantId),
      where('role', 'in', ['pastor', 'worker', 'admin'])
    );
    
    getDocs(staffQuery).then(snapshot => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return unsubscribe;
  }, [profile?.tenantId]);

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    try {
      await addDoc(collection(db, 'branches'), {
        ...newBranch,
        tenantId: profile.tenantId,
        createdAt: serverTimestamp(),
      });
      toast.success('Branch added successfully');
      setIsAddOpen(false);
      setNewBranch({ name: '', address: '', contactEmail: '', contactPhone: '', pastorName: '' });
    } catch (error: any) {
      toast.error('Failed to add branch: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Branches</h1>
          <p className="text-slate-500 mt-1">Manage all your church locations from one dashboard.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <Plus className="w-4 h-4" />
                Add Branch
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Branch</DialogTitle>
              <DialogDescription>Expand your reach by adding a new location.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddBranch} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Branch Name</Label>
                <Input id="name" value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g. North Campus" required className="border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Address</Label>
                <Input id="address" value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} placeholder="123 Church St, City" required className="border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Email</Label>
                  <Input id="email" type="email" value={newBranch.contactEmail} onChange={e => setNewBranch({...newBranch, contactEmail: e.target.value})} className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Phone</Label>
                  <Input id="phone" value={newBranch.contactPhone} onChange={e => setNewBranch({...newBranch, contactPhone: e.target.value})} className="border-slate-200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pastorName" className="text-xs font-bold uppercase tracking-wider text-slate-500">Assign Lead Pastor</Label>
                <Select value={newBranch.pastorName} onValueChange={v => setNewBranch({...newBranch, pastorName: v})}>
                  <SelectTrigger className="border-slate-200">
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
              <DialogFooter>
                <Button type="submit" className="w-full bg-indigo-600">Create Branch</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="col-span-full text-center py-12 text-slate-400">Loading branches...</p>
        ) : branches.length === 0 ? (
          <div className="col-span-full bg-white p-20 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <MapPin className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No branches yet</h3>
            <p className="text-slate-500 mb-8 max-w-sm">Start by adding your first church location to scale your ministry's reach.</p>
            <Button variant="outline" className="border-slate-200 bg-white shadow-sm" onClick={() => setIsAddOpen(true)}>Add Your First Branch</Button>
          </div>
        ) : (
          branches.map((branch) => (
            <Card key={branch.id} className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 overflow-hidden group">
              <div className="h-2 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-bold text-slate-900">{branch.name}</CardTitle>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100">Live</span>
                </div>
                <CardDescription className="flex items-start gap-1.5 text-slate-500 pt-1">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                  {branch.address}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 gap-3 py-4 border-y border-slate-50">
                  <div className="flex items-center gap-3 text-sm text-slate-600 group/item">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover/item:bg-indigo-50 transition-colors">
                      <Mail className="w-4 h-4 text-slate-400 group-hover/item:text-indigo-500" />
                    </div>
                    {branch.contactEmail || 'No email provided'}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 group/item">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover/item:bg-indigo-50 transition-colors">
                      <Phone className="w-4 h-4 text-slate-400 group-hover/item:text-indigo-500" />
                    </div>
                    {branch.contactPhone || 'No phone provided'}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 group/item">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover/item:bg-indigo-50 transition-colors">
                      <User className="w-4 h-4 text-slate-400 group-hover/item:text-indigo-500" />
                    </div>
                    Pastor: <span className="font-bold text-slate-900 ml-1">{branch.pastorName || 'Unassigned'}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => navigate(`/dashboard/branches/${branch.id}`)}
                  className="w-full bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-none shadow-none font-bold text-xs uppercase tracking-widest py-5"
                >
                  Manage Location
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
