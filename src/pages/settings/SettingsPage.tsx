import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePaystackPayment } from 'react-paystack';
import { 
  Building2, 
  Palette, 
  ShieldCheck, 
  CreditCard, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Save,
  CheckCircle2,
  AlertCircle,
  UserCog,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { profile, isAdmin } = useAuth();
  const { tenant, effectiveTenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);

  const isCentralAdmin = isAdmin && !profile?.staffData?.assignedBranchId;

  const [formData, setFormData] = useState<any>({
    name: '',
    website: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    primaryColor: '#4f46e5',
    theme: 'light',
    fontFamily: 'Inter'
  });

  const plans = [
    { id: 'basic', name: 'Branch Edition', price: 100, desc: 'Ideal for single branch churches' },
    { id: 'premium', name: 'Regional Edition', price: 300, desc: 'Multi-branch support up to 5' },
    { id: 'enterprise', name: 'Global Edition', price: 500, desc: 'Unlimited branches & advanced AI' }
  ];

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        website: tenant.website || '',
        contactEmail: tenant.contactEmail || '',
        contactPhone: tenant.contactPhone || '',
        address: tenant.address || '',
        primaryColor: tenant.settings?.primaryColor || '#4f46e5',
        theme: tenant.settings?.theme || 'light',
        fontFamily: tenant.settings?.fontFamily || 'Inter'
      });
    }

    if (effectiveTenantId) {
      const q = query(collection(db, 'staff'), where('tenantId', '==', effectiveTenantId));
      const unsubscribe = onSnapshot(q, (snap) => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsubscribe;
    }
  }, [tenant, effectiveTenantId]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;
    setLoading(true);

    try {
      await setDoc(doc(db, 'tenants', effectiveTenantId), {
        name: formData.name,
        website: formData.website,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        address: formData.address,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Church profile updated successfully');
    } catch (error: any) {
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranding = async () => {
    if (!effectiveTenantId) return;
    setLoading(true);

    try {
      await setDoc(doc(db, 'tenants', effectiveTenantId), {
        'settings.primaryColor': formData.primaryColor,
        'settings.theme': formData.theme,
        'settings.fontFamily': formData.fontFamily,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Branding settings updated');
    } catch (error: any) {
      toast.error('Failed to update branding: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStaffRole = async (staffId: string, role: string, responsibility: string) => {
    try {
      await updateDoc(doc(db, 'staff', staffId), {
        role,
        responsibility,
        updatedAt: serverTimestamp()
      });
      toast.success('Staff role updated');
    } catch (error: any) {
      toast.error('Update failed: ' + error.message);
    }
  };

  const PaystackButton = ({ plan }: { plan: any }) => {
    const config = {
      reference: (new Date()).getTime().toString(),
      email: profile?.email || 'admin@church.com',
      amount: plan.price * 100, // Amount in GH pesewas
      currency: 'GHS',
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxx',
    };

    const initializePayment = usePaystackPayment(config);

    const onSuccess = async (reference: any) => {
      toast.success(`Payment successful! Ref: ${reference.reference}`);
      if (effectiveTenantId) {
        await setDoc(doc(db, 'tenants', effectiveTenantId), {
          subscriptionTier: plan.id,
          lastPaymentRef: reference.reference,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    };

    const onClose = () => {
      toast.info('Payment cancelled');
    };

    return (
      <Button 
        onClick={() => initializePayment({ onSuccess, onClose })}
        className="w-full bg-slate-900 border-0 hover:bg-slate-800"
      >
        Renew for GH₵{plan.price}
      </Button>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Church Settings</h1>
        <p className="text-slate-500 mt-1">Manage your platform configuration, branding, and billing.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="profile" className="gap-2">
            <Building2 className="w-4 h-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" /> Theme & Branding
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> staff & Roles
          </TabsTrigger>
          {isCentralAdmin && (
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="w-4 h-4" /> Subscription
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Global Church Profile</CardTitle>
              <CardDescription>Public information used across the platform and messages.</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateProfile}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Church Name</Label>
                    <Input 
                      id="name" 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      placeholder="Ecclesia International"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <Input 
                        id="website" 
                        className="pl-9"
                        value={formData.website} 
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })} 
                        placeholder="www.church.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <Input 
                        id="email" 
                        type="email"
                        className="pl-9"
                        value={formData.contactEmail} 
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} 
                        placeholder="contact@church.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <Input 
                        id="phone" 
                        className="pl-9"
                        value={formData.contactPhone} 
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} 
                        placeholder="+1 (234) 567-890"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Headquarters Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input 
                      id="address" 
                      className="pl-9"
                      value={formData.address} 
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
                      placeholder="123 Faith Lane, City, Country"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 justify-end py-3 border-t">
                {isCentralAdmin ? (
                  <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                  </Button>
                ) : (
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Only central admins can modify church profile
                  </div>
                )}
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Branding & Visual Identity</CardTitle>
              <CardDescription>Customize the look and feel of your church dashboard and public forms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Brand Color</Label>
                    <div className="flex gap-4 items-center">
                      <input 
                        type="color" 
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-12 h-12 rounded cursor-pointer border-0"
                      />
                      <Input 
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Typography</Label>
                    <select 
                      className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                      value={formData.fontFamily}
                      onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                    >
                      <option value="Inter">Inter (Modern Sans)</option>
                      <option value="Outfit">Outfit (Tech Rounded)</option>
                      <option value="Space Grotesk">Space Grotesk (Tech Geometric)</option>
                      <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Preview Card</Label>
                  <div 
                    className="p-6 rounded-xl border border-slate-200 shadow-sm"
                    style={{ borderTop: `4px solid ${formData.primaryColor}` }}
                  >
                    <div 
                      className="text-[10px] font-black uppercase tracking-widest mb-1"
                      style={{ color: formData.primaryColor }}
                    >
                      Sample Notification
                    </div>
                    <div className="font-bold text-slate-900 mb-1">New Member Registered</div>
                    <div className="text-xs text-slate-500">A new family has joined the central branch.</div>
                    <Button 
                      className="mt-4 w-full h-8 text-[10px] uppercase font-bold"
                      style={{ backgroundColor: formData.primaryColor }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 justify-end py-3 border-t">
              {isCentralAdmin ? (
                <Button onClick={handleUpdateBranding} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  <Save className="w-4 h-4 mr-2" /> Apply Branding
                </Button>
              ) : (
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Only central admins can modify branding
                </div>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Staff Roles & Responsibilities</CardTitle>
              <CardDescription>Assign specific roles and work responsibilities to your team members.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {staff.length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic">No staff members found.</div>
                )}
                {staff.map((member) => (
                  <div key={member.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                        {member.firstName?.[0]}{member.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{member.firstName} {member.lastName}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                    </div>

                      <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-slate-400">System Role</Label>
                        <select 
                          className="h-9 w-full md:w-32 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          value={member.role}
                          disabled={!isCentralAdmin}
                          onChange={(e) => updateStaffRole(member.id, e.target.value, member.responsibility || '')}
                        >
                          <option value="worker">Worker</option>
                          <option value="pastor">Pastor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-slate-400">Responsibility</Label>
                        <select 
                          className="h-9 w-full md:w-40 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          value={member.responsibility || 'none'}
                          disabled={!isCentralAdmin}
                          onChange={(e) => updateStaffRole(member.id, member.role, e.target.value)}
                        >
                          <option value="none">General</option>
                          <option value="finance">Finance Manager</option>
                          <option value="branch_manager">Branch Manager</option>
                          <option value="group_president">Group President</option>
                          <option value="secretary">Secretary</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isCentralAdmin && (
          <TabsContent value="subscription" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Platform Subscription</CardTitle>
                  <CardDescription>Active Plan: <span className="font-bold text-indigo-600 uppercase underline decoration-2 underline-offset-4">{tenant?.subscriptionTier || 'Trial'}</span></CardDescription>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 py-1 px-3">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> ACTIVE
                </Badge>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id} 
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all hover:shadow-lg flex flex-col h-full",
                        tenant?.subscriptionTier === plan.id 
                          ? "border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50" 
                          : "border-slate-100 bg-white"
                      )}
                    >
                      <div className="mb-4">
                        <div className="text-sm font-black text-slate-400 uppercase tracking-tighter mb-1">{plan.name}</div>
                        <div className="text-3xl font-black text-slate-900">GH₵{plan.price}<span className="text-sm font-medium text-slate-400">/mo</span></div>
                      </div>
                      
                      <p className="text-xs text-slate-500 mb-6 flex-grow">{plan.desc}</p>
                      
                      <PaystackButton plan={plan} />
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex gap-4 items-start">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 mt-1" />
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">Secure Payments via Paystack</div>
                    <div className="text-xs text-slate-500">All transactions are encrypted and processed in Ghana Cedis (GHS). We do not store your card details on our servers.</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
