import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, updateDoc, setDoc, doc, serverTimestamp, orderBy, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, Building2, Users, CreditCard, ExternalLink, Eye, UserCog, 
  History, Globe, Trash2, Banknote, RefreshCw, Smartphone, Key, 
  Tag, FileText, CheckCircle2, AlertCircle, Coins, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTenant } from '@/src/contexts/TenantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const { isSuperAdmin } = useAuth();
  const { impersonateTenant } = useTenant();
  const navigate = useNavigate();

  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<'tenants' | 'gateway' | 'packages' | 'transactions'>('tenants');

  // Tenants data
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Gateway Settings state
  const [gatewayConfig, setGatewayConfig] = useState({
    provider: 'arkesel',
    apiKey: '',
    apiSecret: '',
    senderId: 'Ecclesia',
    isActive: true,
    balance: '1000'
  });
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);

  // Connectivity diagnostics state
  const [testNumber, setTestNumber] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Packages state
  const [packages, setPackages] = useState<any[]>([]);
  const [newPackage, setNewPackage] = useState({ name: '', smsCount: 100, price: 10 });
  const [isAddingPackage, setIsAddingPackage] = useState(false);

  // Platform SMS Transactions state
  const [smsTransactions, setSmsTransactions] = useState<any[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);

  // Calculate platform totals
  const totalSubRevenue = transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalWalletRevenues = walletTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalSentSMS = smsTransactions.length;

  useEffect(() => {
    if (!isSuperAdmin) return;

    // Load tenants
    const unsubscribeTenants = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTenants(data);
      setLoading(false);
    }, (error) => {
      console.error("Tenants onSnapshot error:", error);
    });

    // Load subscription payments
    const qSub = query(collection(db, 'subscription_transactions'), orderBy('createdAt', 'desc'));
    const unsubscribeSubs = onSnapshot(qSub, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    });

    // Load central gateway configurations
    const unsubscribeGateway = onSnapshot(doc(db, 'gateway_settings', 'active'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGatewayConfig({
          provider: data.provider || 'arkesel',
          apiKey: data.apiKey || '',
          apiSecret: data.apiSecret || '',
          senderId: data.senderId || 'Ecclesia',
          isActive: data.isActive !== false,
          balance: data.balance || '1000'
        });
        setGatewayStatus(data);
      }
    });

    // Load reseller packages
    const qPkg = query(collection(db, 'sms_packages'), orderBy('smsCount', 'asc'));
    const unsubscribePackages = onSnapshot(qPkg, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPackages(data);
    });

    // Load outgoing sms logs
    const qSms = query(collection(db, 'sms_transactions'), orderBy('createdAt', 'desc'));
    const unsubscribeSms = onSnapshot(qSms, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSmsTransactions(data);
    });

    // Load credit purchases
    const qWallet = query(collection(db, 'wallet_transactions'), orderBy('createdAt', 'desc'));
    const unsubscribeWallet = onSnapshot(qWallet, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWalletTransactions(data);
    });

    return () => {
      unsubscribeTenants();
      unsubscribeSubs();
      unsubscribeGateway();
      unsubscribePackages();
      unsubscribeSms();
      unsubscribeWallet();
    };
  }, [isSuperAdmin]);

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString();
    }
    if (ts instanceof Date) {
      return ts.toLocaleString();
    }
    return String(ts);
  };

  const handleUpdateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGateway(true);
    try {
      await setDoc(doc(db, 'gateway_settings', 'active'), {
        ...gatewayConfig,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success("SMS Gateway settings updated actively!");
    } catch (err: any) {
      toast.error("Failed to update configurations: " + err.message);
    } finally {
      setIsSavingGateway(false);
    }
  };

  const handleTestGatewayConnectivity = async () => {
    if (!testNumber) {
      toast.warning("Please enter a destination cell number first.");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sms/test-connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: gatewayConfig.provider,
          apiKey: gatewayConfig.apiKey,
          apiSecret: gatewayConfig.apiSecret,
          senderId: gatewayConfig.senderId,
          testRecipient: testNumber,
          testMessage: `Ecclesia central reseller gateway connectivity test. Diagnostic link OK.`
        })
      });

      const body = await res.json();
      setTestResult(body);
      if (body.success) {
        toast.success("Diagnostic check succeeded! Connection is fully functional.");
      } else {
        toast.error("Gateway connection failed check. View diagnostics logs below.");
      }
    } catch (err: any) {
      toast.error("Diagnostic request rejected: " + err.message);
      setTestResult({ success: false, diagnosis: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackage.name.trim()) return;
    setIsAddingPackage(true);
    try {
      await addDoc(collection(db, 'sms_packages'), {
        name: newPackage.name,
        smsCount: Number(newPackage.smsCount),
        price: Number(newPackage.price),
        active: true,
        createdAt: serverTimestamp()
      });
      setNewPackage({ name: '', smsCount: 100, price: 10 });
      toast.success("Reseller SMS Package created successfully!");
    } catch (err: any) {
      toast.error("Failed to add package: " + err.message);
    } finally {
      setIsAddingPackage(false);
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SMS Package?")) return;
    try {
      await deleteDoc(doc(db, 'sms_packages', id));
      toast.success("Package deleted.");
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!confirm(`Are you sure you want to toggle church status to ${newStatus}?`)) return;

    try {
      await updateDoc(doc(db, 'tenants', tenantId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Tenant updated status to ${newStatus}`);
    } catch (error: any) {
      toast.error('Failed to update status: ' + error.message);
    }
  };

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest italic">Unauthorized System Access</div>;
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-100">
              <Shield className="w-6 h-6" />
            </div>
            Siasore App Engine
          </h1>
          <p className="text-slate-550 mt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Comprehensive platform controls, gateway resale channels & settings.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" className="gap-2 font-bold text-xs uppercase tracking-wider" onClick={() => window.open('https://console.firebase.google.com/', '_blank')}>
            <ExternalLink className="w-3.5 h-3.5" /> Firebase Console
          </Button>
        </div>
      </div>

      {/* Analytics KPI Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Churches</CardTitle>
            <Building2 className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">{tenants.length}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Tenant Subscriptions</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Central revenue</CardTitle>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-950 tracking-tighter">
              GH₵{(totalSubRevenue + totalWalletRevenues).toLocaleString()}
            </div>
            <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">
              Subs: GH₵{totalSubRevenue} • SMS: GH₵{totalWalletRevenues}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Credit Orders</CardTitle>
            <Coins className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">{walletTransactions.length}</div>
            <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Credit Packages Sold</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-500"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Outgoing SMS</CardTitle>
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">{totalSentSMS}</div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">SaaS Sent Unit Sum</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('tenants')}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'tenants' ? "border-red-650 text-red-600 border-red-600" : "border-transparent text-slate-400 hover:text-slate-750 hover:bg-slate-50"
          )}
        >
          Churches & Plans
        </button>
        <button
          onClick={() => setActiveTab('gateway')}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'gateway' ? "border-red-650 text-red-600 border-red-600" : "border-transparent text-slate-400 hover:text-slate-750 hover:bg-slate-50"
          )}
        >
          Central SMS Gateway
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'packages' ? "border-red-650 text-red-600 border-red-600" : "border-transparent text-slate-400 hover:text-slate-750 hover:bg-slate-50"
          )}
        >
          Credit packages
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'transactions' ? "border-red-650 text-red-600 border-red-600" : "border-transparent text-slate-400 hover:text-slate-750 hover:bg-slate-50"
          )}
        >
          Credit Sales logs
        </button>
      </div>

      {/* Tab: Tenants */}
      {activeTab === 'tenants' && (
        <div className="space-y-6 animate-fadeIn">
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Churches</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Church Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provisioned At</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">Management</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="font-bold text-slate-900 pl-6">{t.name}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                          {t.subscriptionTier || 'Free Trial'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 font-bold' : 'bg-rose-50 text-rose-600 border-rose-100 font-bold'}>
                          {t.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {formatTimestamp(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 font-bold border-indigo-100"
                            onClick={() => {
                              impersonateTenant(t.id);
                              navigate('/dashboard');
                            }}
                          >
                            Impersonate
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                              "text-xs h-7 font-bold",
                              t.status === 'active' ? "text-red-500 hover:bg-red-50" : "text-emerald-500 hover:bg-emerald-50"
                            )}
                            onClick={() => handleToggleStatus(t.id, t.status || 'active')}
                          >
                            {t.status === 'active' ? 'Suspend' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Subscription Transactions */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Subscription History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No subscription logs recorded contextually.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-450">Church Name</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Plan</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Amount</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Pay Reference</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Payer Account</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-widest text-slate-450">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tr) => (
                      <TableRow key={tr.id}>
                        <TableCell className="font-bold text-slate-900 pl-6">{tr.tenantName}</TableCell>
                        <TableCell className="font-mono text-xs uppercase">{tr.planName || tr.planId}</TableCell>
                        <TableCell className="font-black text-slate-950">GH₵{tr.amount}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">{tr.paymentReference || 'N/A'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{tr.userEmail}</TableCell>
                        <TableCell className="text-right pr-6 text-slate-400 text-[10px] font-bold">{formatTimestamp(tr.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Gateway Settings */}
      {activeTab === 'gateway' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Form */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Key className="w-4 h-4 text-red-600" />
                Gateway Authentication Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Only Siasore Administrators can configure these API credentials. Normal SaaS pastors route calls through this setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateGateway} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Choose Gateway Provider</label>
                    <Select 
                      value={gatewayConfig.provider} 
                      onValueChange={(val) => setGatewayConfig(prev => ({ ...prev, provider: val }))}
                    >
                      <SelectTrigger className="bg-slate-50/50">
                        <SelectValue placeholder="Select gateway" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="arkesel">Arkesel Gateway (Universal)</SelectItem>
                        <SelectItem value="hubtel">Hubtel SMS Platform</SelectItem>
                        <SelectItem value="africastalking">Africa's Talking (East Africa)</SelectItem>
                        <SelectItem value="twilio">Twilio SMS Broker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Sender ID (Alpha Tag)</label>
                    <Input 
                      placeholder="e.g. Ecclesia, Church" 
                      value={gatewayConfig.senderId}
                      maxLength={11}
                      onChange={(e) => setGatewayConfig(prev => ({ ...prev, senderId: e.target.value }))}
                      className="bg-slate-50/50"
                    />
                    <p className="text-[9px] text-slate-450">Maximum 11 characters, letters only for Ghana operators.</p>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">API Key / Auth Token</label>
                    <Input 
                      type="password" 
                      placeholder="Paste primary service key" 
                      value={gatewayConfig.apiKey}
                      onChange={(e) => setGatewayConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Secret Key / Account SID (Optional)</label>
                    <Input 
                      type="password"
                      placeholder="Paste associated password parameter" 
                      value={gatewayConfig.apiSecret}
                      onChange={(e) => setGatewayConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                    />
                    <p className="text-[9px] text-slate-450">Needed for Hubtel (Client Secret) or Twilio (Account SID).</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Manual Balance Units</label>
                    <Input 
                      placeholder="e.g. 10000" 
                      value={gatewayConfig.balance}
                      onChange={(e) => setGatewayConfig(prev => ({ ...prev, balance: e.target.value }))}
                      className="bg-slate-50/50 font-mono transition-shadow focus:ring-1"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input 
                      type="checkbox" 
                      id="isActive" 
                      checked={gatewayConfig.isActive}
                      onChange={(e) => setGatewayConfig(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-slate-300 h-4 w-4 bg-slate-150 cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer select-none">
                      Enable Gateway
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-end">
                  <Button type="submit" disabled={isSavingGateway} className="bg-red-650 hover:bg-red-750 font-bold uppercase tracking-wider text-xs px-6 py-2">
                    {isSavingGateway ? "Saving Config..." : "Register Gateway Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tester diagnostics */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                  Active Service Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-500 font-bold uppercase">Central Connection</span>
                  {gatewayStatus?.isActive ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Online</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700">Offline</span>
                  )}
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-500 font-bold uppercase">Active Operator</span>
                  <span className="font-mono text-xs uppercase font-bold text-slate-800">{gatewayStatus?.provider || "Unconfigured"}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-500 font-bold uppercase">Remaining Units</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{gatewayStatus?.balance || "0"} SMS</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-white pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                  Diagnostics Testing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mobile Number (With Country Code)</label>
                  <Input 
                    placeholder="e.g. 233555909200" 
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <Button 
                  onClick={handleTestGatewayConnectivity} 
                  disabled={isTesting}
                  variant="outline"
                  className="w-full text-xs font-bold uppercase tracking-wider"
                >
                  {isTesting ? "Testing Channel..." : "Trigger Direct Gateway Ping"}
                </Button>

                {testResult && (
                  <div className="p-4 bg-slate-50 rounded border text-xs max-h-[180px] overflow-y-auto space-y-2">
                    <p className="font-bold flex items-center gap-2">
                      Result: {testResult.success ? (
                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> SUCCESS</span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> FAILED</span>
                      )}
                    </p>
                    <div className="font-mono text-[10px] text-slate-550 pt-1 border-t space-y-1">
                      {testResult.logs?.map((l: any, i: number) => (
                        <div key={i} className={cn(
                          l.status === 'error' ? "text-red-600" :
                          l.status === 'success' ? "text-emerald-600 font-bold" : "text-slate-500"
                        )}>
                          [{l.step}] {l.message}
                          {l.response && <pre className="bg-white p-1 rounded mt-0.5 text-[8px] max-w-full overflow-x-auto">{JSON.stringify(l.response, null, 2)}</pre>}
                        </div>
                      ))}
                      <p className="font-bold border-t pt-1 text-slate-700 mt-2">{testResult.diagnosis}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Credit Packages */}
      {activeTab === 'packages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Packages List */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Configured Credit Packages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {packages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-sm">No credit packages configured yet. Use the manager to seed.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Package Title</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Volume (SMS)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retail Price</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit rate</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-bold text-slate-900 pl-6">{pkg.name}</TableCell>
                        <TableCell className="font-mono text-xs font-bold">{pkg.smsCount} Units</TableCell>
                        <TableCell className="font-bold text-slate-950">GH₵{pkg.price}</TableCell>
                        <TableCell className="text-xs text-slate-400 font-medium">
                          GH₵{(pkg.price / pkg.smsCount).toFixed(3)} / unit
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            onClick={() => handleDeletePackage(pkg.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="border-slate-200 shadow-sm bg-white flex flex-col h-fit">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-600" />
                Produce New SMS package
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleAddPackage} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Package title</label>
                  <Input 
                    placeholder="e.g. Starter Tier" 
                    value={newPackage.name}
                    onChange={(e) => setNewPackage(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-50/30"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Credit Units volume</label>
                  <Input 
                    type="number"
                    min={1}
                    value={newPackage.smsCount}
                    onChange={(e) => setNewPackage(prev => ({ ...prev, smsCount: Number(e.target.value) }))}
                    className="bg-slate-50/30 font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Package retail price (GH₵)</label>
                  <Input 
                    type="number"
                    min={1}
                    value={newPackage.price}
                    onChange={(e) => setNewPackage(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="bg-slate-50/30 font-mono text-xs"
                    required
                  />
                </div>

                <Button type="submit" disabled={isAddingPackage} className="w-full bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-widest pt-2 px-3 py-2">
                  {isAddingPackage ? "Creating..." : "Promote Package Online"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Credit sales transactions */}
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Credit Refill Logs</CardTitle>
                <CardDescription className="text-[11px] font-semibold text-slate-400 mt-1">
                  Purchases made by SaaS users on the subscription reseller network.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold">{walletTransactions.length} Completed</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {walletTransactions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold text-xs uppercase opacity-60">No payment refill transactions located.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-450">User (System ID)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Package Bought</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Sms Allocated</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Amount Paid</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Operator</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Transaction Reference</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-widest text-slate-450">Clearing Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-[10px] text-slate-655 pl-6">
                          ID: {tx.userId?.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-bold text-slate-800">{tx.packageName}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">+{tx.smsCount} SMS</TableCell>
                        <TableCell className="font-black text-slate-950">GH₵{tx.amount}</TableCell>
                        <TableCell className="text-xs uppercase font-medium">{tx.paymentProvider}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">{tx.reference}</TableCell>
                        <TableCell className="text-right pr-6 text-[10px] font-bold text-slate-450">{formatTimestamp(tx.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* SaaS dispatch logs */}
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex justify-between items-center">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Dispatched SMS Auditing</CardTitle>
                <CardDescription className="text-xs text-slate-400">All messages sent from ecological channels trace here for abuse monitoring.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">{smsTransactions.length} Tracked</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {smsTransactions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-mono text-[10px] uppercase">No dispatch audits captured contextually.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-450">User Ref</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Sender Tag</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Destinations Sum</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Deducted credits</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Dispatch content</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-450">Status flag</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-widest text-slate-450">Time sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsTransactions.map((sms) => (
                      <TableRow key={sms.id}>
                        <TableCell className="font-mono text-[10px] text-slate-500 pl-6">ID: {sms.userId?.substring(0, 8)}...</TableCell>
                        <TableCell className="font-bold text-slate-700">{sms.senderId || "Ecclesia"}</TableCell>
                        <TableCell className="font-bold text-slate-900">{sms.recipients?.length || 1} Recipients</TableCell>
                        <TableCell className="font-mono text-xs text-rose-600 font-bold">-{sms.smsCount} Credits</TableCell>
                        <TableCell className="text-xs max-w-xs truncate text-slate-600 font-medium">{sms.message}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={sms.status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 font-bold' : 'bg-rose-55 bg-rose-50 text-rose-600 border-rose-100 font-bold'}>
                            {sms.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-[10px] font-bold text-slate-400">{formatTimestamp(sms.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
