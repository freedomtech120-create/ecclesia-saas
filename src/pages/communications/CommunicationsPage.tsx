import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Send, Smartphone, ShieldCheck, TrendingUp, Users, Target, History, CalendarDays, Sparkles, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CommunicationsPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [smsConfig, setSmsConfig] = useState<any>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalMessages: 0,
    activeBranches: 0
  });
  const [loading, setLoading] = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', category: 'custom' });
  const [smsData, setSmsData] = useState({
    message: '',
    recipientType: profile?.role === 'pastor' ? 'branch-members' : 'global-members',
    targetBranchId: profile?.role === 'pastor' ? (profile?.staffData?.assignedBranchId || 'all') : 'all'
  });

  const seasonalTemplates = [
    { name: 'Easter Celebration', content: 'He is Risen! We invite you to our Easter Sunday service at 9AM. Come celebrate the victory of Christ with us. God bless!', category: 'seasonal' },
    { name: 'Christmas Message', content: 'Merry Christmas! Join us for our special Carol Service this evening. Wishing you the joy and peace of the season.', category: 'seasonal' },
    { name: 'New Year Fast', content: 'Welcome to our year of Divine Reset! We start our 21-day fasting tomorrow. Join us online at 6PM daily for prayers.', category: 'seasonal' },
    { name: 'Sunday Reminder', content: 'Happy Saturday! Just a reminder of our service tomorrow at 8AM. We look forward to worshipping together.', category: 'service' },
    { name: 'Tithes & Offerings', content: 'Your faithfulness makes our mission possible. You can give your tithes and offerings via our digital channels. God bless your seeds.', category: 'finance' }
  ];

  const [branches, setBranches] = useState<any[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState({
    provider: 'twilio',
    apiKey: '',
    apiSecret: '',
    senderId: ''
  });

  useEffect(() => {
    if (!effectiveTenantId) return;

    const isPastor = profile?.role === 'pastor';
    const branchId = profile?.staffData?.assignedBranchId || 'central';

    // Fetch branches
    getDocs(query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId))).then(snap => {
      const branchList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBranches(branchList);
      setStats(prev => ({ ...prev, activeBranches: snap.size }));
      
      if (isPastor && profile?.staffData?.assignedBranchId) {
        setSmsData(prev => ({ ...prev, targetBranchId: profile.staffData.assignedBranchId }));
      }
    });

    // Fetch total members
    let membersQuery = query(collection(db, 'members'), where('tenantId', '==', effectiveTenantId));
    if (isPastor && profile?.staffData?.assignedBranchId && profile.staffData.assignedBranchId !== 'none') {
      membersQuery = query(membersQuery, where('branchId', '==', profile.staffData.assignedBranchId));
    }
    getDocs(membersQuery).then(snap => {
      setStats(prev => ({ ...prev, totalMembers: snap.size }));
    });

    // Fetch custom templates
    const qTemplates = query(collection(db, 'sms_templates'), where('tenantId', '==', effectiveTenantId), orderBy('createdAt', 'desc'));
    const unsubscribeTemplates = onSnapshot(qTemplates, (snap) => {
      setCustomTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("SMS Templates onSnapshot error:", error);
    });

    // Fetch SMS config (Branch-specific or Central)
    const qSms = query(
      collection(db, 'sms_configs'),
      where('tenantId', '==', effectiveTenantId),
      where('branchId', '==', isPastor ? branchId : 'central')
    );
    getDocs(qSms).then(snap => {
      if (!snap.empty) {
        setSmsConfig({ id: snap.docs[0].id, ...snap.docs[0].data() });
        setGatewayConfig({
          provider: snap.docs[0].data().provider || 'twilio',
          apiKey: snap.docs[0].data().apiKey || '',
          apiSecret: snap.docs[0].data().apiSecret || '',
          senderId: snap.docs[0].data().senderId || ''
        });
      }
    });

    // Fetch SMS logs
    let logsQuery = query(
      collection(db, 'sms_logs'),
      where('tenantId', '==', effectiveTenantId),
      orderBy('sentAt', 'desc'),
      limit(20)
    );
    if (isPastor && profile?.staffData?.assignedBranchId && profile.staffData.assignedBranchId !== 'none') {
      logsQuery = query(logsQuery, where('branchId', '==', profile.staffData.assignedBranchId));
    }
    const unsubscribeLogs = onSnapshot(logsQuery, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSmsLogs(logs);
      setStats(prev => ({ ...prev, totalMessages: logs.length })); // Just an estimate for now
      setLoading(false);
    }, (error) => {
      console.error("SMS Logs onSnapshot error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeTemplates();
      unsubscribeLogs();
    };
  }, [effectiveTenantId, profile?.role, profile?.staffData?.assignedBranchId]);

  const handleSaveSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;
    const isPastor = profile?.role === 'pastor';
    const branchId = profile?.staffData?.assignedBranchId || 'central';

    try {
      if (smsConfig?.id) {
        await updateDoc(doc(db, 'sms_configs', smsConfig.id), {
          ...gatewayConfig,
          updatedAt: serverTimestamp()
        });
        toast.success(`${isPastor ? 'Branch' : 'Central'} SMS Gateway updated`);
      } else {
        await addDoc(collection(db, 'sms_configs'), {
          ...gatewayConfig,
          tenantId: effectiveTenantId,
          branchId: branchId,
          updatedAt: serverTimestamp()
        });
        toast.success(`${isPastor ? 'Branch' : 'Central'} SMS Gateway configured`);
      }
    } catch (err: any) {
      toast.error('Failed to save config: ' + err.message);
    }
  };

  const handleSendBulkSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsConfig) {
      toast.error('Please configure your central SMS Gateway first');
      return;
    }
    setSmsLoading(true);
    try {
      const tenantId = effectiveTenantId;
      const type = smsData.recipientType;
      const branchId = smsData.targetBranchId;
      
      let phoneNumbers: string[] = [];

      // 1. Fetch from Members
      if (['global-members', 'branch-all', 'branch-members'].includes(type)) {
        let q = query(collection(db, 'members'), where('tenantId', '==', tenantId));
        if (type.startsWith('branch-') && branchId !== 'all') {
          q = query(q, where('branchId', '==', branchId));
        }
        const snap = await getDocs(q);
        phoneNumbers = [...phoneNumbers, ...snap.docs.map(d => d.data().phone).filter(p => !!p)];
      }

      // 2. Fetch from Staff
      if (['global-staff', 'global-pastors', 'global-workers', 'branch-all', 'branch-staff'].includes(type)) {
        let q = query(collection(db, 'staff'), where('tenantId', '==', tenantId));
        
        if (type === 'global-pastors') {
          q = query(q, where('role', '==', 'pastor'));
        } else if (type === 'global-workers') {
          q = query(q, where('role', '==', 'worker'));
        }

        if (type.startsWith('branch-') && branchId !== 'all') {
          q = query(q, where('assignedBranchId', '==', branchId));
        }

        const snap = await getDocs(q);
        phoneNumbers = [...phoneNumbers, ...snap.docs.map(d => d.data().phone).filter(p => !!p)];
      }

      // Remove duplicates
      const uniqueNumbers = [...new Set(phoneNumbers)];

      if (uniqueNumbers.length === 0) {
        toast.error('No recipients with phone numbers found for this scope');
        return;
      }

      await addDoc(collection(db, 'sms_logs'), {
        tenantId,
        branchId: profile?.staffData?.assignedBranchId || 'central',
        recipientCount: uniqueNumbers.length,
        message: smsData.message,
        status: 'broadcasted',
        scope: type,
        sentAt: serverTimestamp()
      });

      toast.success(`Broadcasting message to ${uniqueNumbers.length} recipients!`);
      setSmsData({ ...smsData, message: '' });
    } catch (err: any) {
      toast.error('Broadcast failed: ' + err.message);
    } finally {
      setSmsLoading(false);
    }
  };

  const saveAsTemplate = async (content: string) => {
    if (!content) return;
    if (!effectiveTenantId) return;
    try {
      await addDoc(collection(db, 'sms_templates'), {
        tenantId: effectiveTenantId,
        name: `Auto-saved Template ${format(new Date(), 'HH:mm')}`,
        content,
        category: 'custom',
        createdAt: serverTimestamp()
      });
      toast.success('Message saved as a custom template');
    } catch (err: any) {
      toast.error('Failed to save template');
    }
  };

  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;
    try {
      await addDoc(collection(db, 'sms_templates'), {
        ...newTemplate,
        tenantId: effectiveTenantId,
        createdAt: serverTimestamp()
      });
      setIsTemplateModalOpen(false);
      setNewTemplate({ name: '', content: '', category: 'custom' });
      toast.success('Custom template created!');
    } catch (err: any) {
      toast.error('Failed to create template');
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold animate-pulse uppercase tracking-widest">Initialising SMS Hub...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Communications Center</h1>
        <p className="text-slate-500 mt-1 italic">Centralised SMS broadcasting and engagement portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-slate-200">
            <CardHeader className="pb-2">
               <CardTitle className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Reachable Network
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-black">{stats.totalMembers} Members</div>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Across {stats.activeBranches} branches</p>
            </CardContent>
         </Card>

         <Card className="border-slate-200 bg-indigo-600 text-white shadow-xl shadow-indigo-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-[10px] font-bold text-indigo-200 uppercase">Gateway Efficiency</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-black">{smsConfig ? 'Connected' : 'Offline'}</div>
               <p className="text-[10px] text-indigo-200 font-bold uppercase mt-1">{smsConfig?.provider || 'No provider'} configured</p>
            </CardContent>
         </Card>

         <Card className="border-slate-200">
            <CardHeader className="pb-2">
               <CardTitle className="text-[10px] font-black uppercase text-slate-400">Monthly Usage</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-black">{smsLogs.reduce((acc, l) => acc + (l.recipientCount || 0), 0)} SMS</div>
               <div className="text-[10px] text-emerald-600 font-bold uppercase mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Growth: +5% since last month
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-slate-200">
               <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Network Broadcast</CardTitle>
                    <CardDescription>Send a mass message across the entire church hierarchy.</CardDescription>
                  </div>
                  <Target className="w-5 h-5 text-indigo-600 opacity-20" />
               </CardHeader>
               <CardContent>
                  <form onSubmit={handleSendBulkSms} className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase text-slate-500">Recipient Scope</Label>
                               <Select value={smsData.recipientType} onValueChange={v => setSmsData({...smsData, recipientType: v})}>
                               <SelectTrigger className="border-slate-200 shadow-sm">
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 {profile?.role === 'church-admin' && (
                                   <>
                                     <SelectItem value="global-members">All Members (Global)</SelectItem>
                                     <SelectItem value="global-pastors">All Pastors (Global)</SelectItem>
                                     <SelectItem value="global-workers">All Workers (Global)</SelectItem>
                                     <SelectItem value="global-staff">All Personnel (Global)</SelectItem>
                                   </>
                                 )}
                                 <SelectItem value="branch-all">Branch (All Recipients)</SelectItem>
                                 <SelectItem value="branch-members">Branch (Members Only)</SelectItem>
                                 <SelectItem value="branch-staff">Branch (Staff Only)</SelectItem>
                               </SelectContent>
                            </Select>
                        </div>
                        {(smsData.recipientType.startsWith('branch-') && (profile?.role === 'church-admin' || !profile?.staffData?.assignedBranchId)) && (
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-500">Target Branch</Label>
                              <Select value={smsData.targetBranchId} onValueChange={v => setSmsData({...smsData, targetBranchId: v})}>
                                 <SelectTrigger className="border-slate-200 shadow-sm">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {branches.map(b => (
                                       <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        )}
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                             <CalendarDays className="w-3.5 h-3.5" /> Seasonal & Template Messages
                           </Label>
                           <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
                              <DialogTrigger render={
                                 <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase tracking-widest gap-1 hover:text-indigo-600">
                                    <PlusCircle className="w-3 h-3" /> New Custom Template
                                 </Button>
                              } />
                              <DialogContent>
                                 <DialogHeader>
                                    <DialogTitle>Create SMS Template</DialogTitle>
                                    <DialogDescription>Save a message to quickly reuse it later.</DialogDescription>
                                 </DialogHeader>
                                 <form onSubmit={handleCreateCustomTemplate} className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                       <Label>Template Name</Label>
                                       <Input 
                                          placeholder="e.g. Mid-week Service Reminder" 
                                          value={newTemplate.name}
                                          onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                                          required 
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <Label>Category</Label>
                                       <Select value={newTemplate.category} onValueChange={v => setNewTemplate({...newTemplate, category: v})}>
                                          <SelectTrigger>
                                             <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="seasonal">Seasonal</SelectItem>
                                             <SelectItem value="service">Service</SelectItem>
                                             <SelectItem value="notice">Notice</SelectItem>
                                             <SelectItem value="custom">Custom</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    </div>
                                    <div className="space-y-2">
                                       <Label>Content (Max 160 chars)</Label>
                                       <textarea 
                                          className="w-full h-24 p-3 rounded-lg border border-slate-200 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                          placeholder="Type message content..."
                                          maxLength={160}
                                          value={newTemplate.content}
                                          onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
                                          required
                                       />
                                    </div>
                                    <DialogFooter>
                                       <Button type="submit" className="bg-indigo-600">Save Template</Button>
                                    </DialogFooter>
                                 </form>
                              </DialogContent>
                           </Dialog>
                        </div>
                        
                        <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide">
                           {seasonalTemplates.map((t, idx) => (
                              <Button 
                                 key={idx}
                                 type="button"
                                 variant="outline" 
                                 className="h-auto py-2 px-3 flex-shrink-0 flex flex-col items-start gap-1 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all text-left"
                                 onClick={() => setSmsData({...smsData, message: t.content})}
                              >
                                 <span className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" /> {t.category}
                                 </span>
                                 <span className="text-[11px] font-bold text-slate-800">{t.name}</span>
                              </Button>
                           ))}
                           {customTemplates.map((t) => (
                              <Button 
                                 key={t.id}
                                 type="button"
                                 variant="outline" 
                                 className="h-auto py-2 px-3 flex-shrink-0 flex flex-col items-start gap-1 border-indigo-100 bg-indigo-50/20 hover:border-indigo-400 hover:bg-white transition-all text-left group"
                                 onClick={() => setSmsData({...smsData, message: t.content})}
                              >
                                 <span className="text-[9px] font-black uppercase text-indigo-600 flex items-center justify-between w-full">
                                    Custom
                                 </span>
                                 <span className="text-[11px] font-bold text-slate-800">{t.name}</span>
                              </Button>
                           ))}
                        </div>

                        <div className="space-y-2 pt-2">
                           <div className="flex items-center justify-between">
                              <Label className="text-[10px] font-black uppercase text-slate-500">Broadcast Message</Label>
                              <Button 
                                 type="button" 
                                 variant="link" 
                                 className="h-auto p-0 text-[10px] font-bold text-indigo-600"
                                 onClick={() => saveAsTemplate(smsData.message)}
                                 disabled={!smsData.message}
                              >
                                 Save current as custom template
                              </Button>
                           </div>
                           <textarea 
                              className="w-full h-32 p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner bg-slate-50/50"
                              placeholder="Church alert: Sunday service starts at 8AM sharp. Don't miss out!"
                              value={smsData.message}
                              onChange={e => setSmsData({...smsData, message: e.target.value})}
                              maxLength={160}
                              required
                           />
                           <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className={cn(smsData.message.length > 140 ? 'text-amber-600' : 'text-slate-400')}>
                                 {smsData.message.length}/160 characters
                              </span>
                              <span className="text-slate-400">1 standard SMS page</span>
                           </div>
                        </div>
                     </div>

                     <Button 
                        type="submit" 
                        disabled={smsLoading || !smsData.message} 
                        className="w-full bg-slate-900 hover:bg-slate-800 text-sm font-black uppercase tracking-widest h-14 gap-3 shadow-lg shadow-slate-100"
                     >
                        {smsLoading ? 'Broadcasting...' : (
                           <>
                              <Send className="w-5 h-5" /> Execute Broadcast
                           </>
                        )}
                     </Button>
                  </form>
               </CardContent>
            </Card>

            <Card className="border-slate-200">
               <CardHeader className="border-b border-slate-50 py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Recent Activity</CardTitle>
                  <History className="w-4 h-4 text-slate-300" />
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-slate-50/50">
                        <TableRow>
                           <TableHead className="pl-6 h-10 text-[10px] uppercase font-black">Sent At</TableHead>
                           <TableHead className="h-10 text-[10px] uppercase font-black">Message Preview</TableHead>
                           <TableHead className="h-10 text-[10px] uppercase font-black">Scope</TableHead>
                           <TableHead className="text-right pr-6 h-10 text-[10px] uppercase font-black">Count</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {smsLogs.length === 0 ? (
                           <TableRow>
                              <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic">No historical broadcasts found.</TableCell>
                           </TableRow>
                        ) : (
                           smsLogs.map(log => (
                              <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                 <TableCell className="pl-6 text-[10px] font-bold text-slate-400">
                                    {log.sentAt ? format(log.sentAt.toDate(), 'MMM d, h:mm a') : 'Pending'}
                                 </TableCell>
                                 <TableCell className="max-w-xs truncate text-xs font-medium text-slate-700">
                                    {log.message}
                                 </TableCell>
                                 <TableCell>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                                       {log.branchId === 'central' ? 'Global' : 'Local'}
                                    </span>
                                 </TableCell>
                                 <TableCell className="text-right pr-6 font-black text-indigo-600">
                                    {log.recipientCount}
                                 </TableCell>
                              </TableRow>
                           ))
                        )}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         </div>

         <div className="space-y-6">
            <Card className="border-indigo-100 bg-indigo-50/30">
               <CardHeader>
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4">
                     <Smartphone className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg font-bold">
                    {profile?.role === 'pastor' ? 'Branch Gateway' : 'Main Gateway'}
                  </CardTitle>
                  <CardDescription>
                    {profile?.role === 'pastor' 
                       ? 'Configure your local SMS API for branch-level engagement.' 
                       : 'Configure the central SMS API for network-wide broadcasts.'}
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <form onSubmit={handleSaveSmsConfig} className="space-y-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">API Provider</Label>
                        <Select value={gatewayConfig.provider} onValueChange={v => setGatewayConfig({...gatewayConfig, provider: v})}>
                           <SelectTrigger className="bg-white border-indigo-200">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="twilio">Twilio</SelectItem>
                              <SelectItem value="africastalking">Africa's Talking</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">API Key / Account SID</Label>
                        <Input 
                           className="bg-white border-indigo-200" 
                           type="password"
                           value={gatewayConfig.apiKey}
                           onChange={e => setGatewayConfig({...gatewayConfig, apiKey: e.target.value})}
                           placeholder="••••••••••••" 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Auth Token / Secret Key</Label>
                        <Input 
                           className="bg-white border-indigo-200" 
                           type="password"
                           value={gatewayConfig.apiSecret}
                           onChange={e => setGatewayConfig({...gatewayConfig, apiSecret: e.target.value})}
                           placeholder="••••••••••••" 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">System Sender ID</Label>
                        <Input 
                           className="bg-white border-indigo-200 font-bold" 
                           value={gatewayConfig.senderId}
                           onChange={e => setGatewayConfig({...gatewayConfig, senderId: e.target.value})}
                           placeholder="ECCLESIA" 
                        />
                     </div>
                     <Button type="submit" className="w-full bg-slate-900 gap-2 mt-4 font-black uppercase text-xs tracking-widest h-12 shadow-lg shadow-slate-200">
                        <ShieldCheck className="w-4 h-4" /> Hardened Save
                     </Button>
                  </form>
               </CardContent>
            </Card>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl">
               <div className="flex items-center gap-3 mb-4">
                  <Target className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-black uppercase tracking-tight">Messaging Tips</h4>
               </div>
               <div className="space-y-3">
                  <div className="flex gap-2">
                     <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full mt-1.5 shrink-0"></div>
                     <p className="text-[11px] text-slate-500 leading-snug">Keep messages under <span className="font-bold text-slate-900">160 characters</span> to avoid multi-page billing.</p>
                  </div>
                  <div className="flex gap-2">
                     <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full mt-1.5 shrink-0"></div>
                     <p className="text-[11px] text-slate-500 leading-snug">Always include church name to improve member trust.</p>
                  </div>
                  <div className="flex gap-2">
                     <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full mt-1.5 shrink-0"></div>
                     <p className="text-[11px] text-slate-500 leading-snug">Use Central broadcast for general announcements like public holidays or fasts.</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
