import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, doc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTenant } from "@/src/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePaystackPayment } from 'react-paystack';
import { 
  MessageSquare, Send, Smartphone, TrendingUp, Users, History, Sparkles, 
  Trash2, CheckCircle2, Coins, CreditCard, ShoppingCart, Search, 
  ChevronRight, AlertCircle, RefreshCw, FileText, Download, ShieldCheck
} from "lucide-react";

export default function CommunicationsPage() {
  const { profile, user } = useAuth();
  const { effectiveTenantId } = useTenant();

  // Navigation state
  const [activeTab, setActiveTab] = useState<'send' | 'buy' | 'logs' | 'reports' | 'templates'>('send');

  // Multi-tenant selection helper states
  const [branches, setBranches] = useState<any[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState(0);

  // User local wallet and SMS balance
  const [smsBalance, setSmsBalance] = useState<number>(50); // fallback
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [smsThreshold, setSmsThreshold] = useState<number>(50);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);

  // Buy structures
  const [packages, setPackages] = useState<any[]>([
    { id: "starter-tier", name: "Starter Tier", smsCount: 100, price: 10, active: true },
    { id: "business-growth", name: "Business Growth", smsCount: 500, price: 45, active: true },
    { id: "premium-enterprise", name: "Premium Enterprise", smsCount: 1000, price: 80, active: true }
  ]);
  const [isBuyingPack, setIsBuyingPack] = useState<any>(null);
  const [paymentProvider, setPaymentProvider] = useState<'paystack' | 'flutterwave' | 'hubtel' | 'momo'>('paystack');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const PaystackSMSButton = ({ pack, disabled }: { pack: any; disabled: boolean }) => {
    const config = {
      reference: `ecclesia-paystack-${Date.now()}`,
      email: user?.email || "billing@ecclesia.com",
      amount: Math.round(pack.price * 100),
      currency: "GHS",
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_e3fd79bc9dc8c5da84ab6be4149806b7cb0bebfd",
    };

    let initializePayment: any;
    try {
      initializePayment = usePaystackPayment(config);
    } catch (e) {
      console.warn("Paystack hook initializer error:", e);
    }

    const handleCreateTransaction = async (refStr: string) => {
      setIsProcessingCheckout(true);
      try {
        toast.info("Paystack authorization received. Completing credit top-up...");
        const verifyResponse = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.uid,
            packageId: pack.id,
            paymentProvider: "PAYSTACK",
            reference: refStr
          })
        });

        const body = await verifyResponse.json();
        if (!verifyResponse.ok) {
          throw new Error(body.error || "Verification issue");
        }

        toast.success(`Refill Approved! Added ${pack.smsCount} credits successfully.`);
        setIsBuyingPack(null);
      } catch (err: any) {
        toast.error("Internal verification error: " + err.message);
      } finally {
        setIsProcessingCheckout(false);
      }
    };

    const handleSimulatedPayment = () => {
      const simulatedRef = 'SIM-' + Math.floor(10000000 + Math.random() * 90000000);
      toast.loading("Processing secure simulated payment...", { id: "sim-pay" });
      setTimeout(async () => {
        toast.dismiss("sim-pay");
        await handleCreateTransaction(simulatedRef);
      }, 1200);
    };

    const handleRealPayment = () => {
      if (!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY.includes('xxxx')) {
        toast.info("Paystack Public Key not configured. Launching instant checkout simulation...");
        handleSimulatedPayment();
        return;
      }
      if (initializePayment) {
        initializePayment({
          onSuccess: (ref: any) => handleCreateTransaction(ref.reference),
          onClose: () => toast.info('Payment window closed')
        });
      } else {
        handleSimulatedPayment();
      }
    };

    return (
      <Button 
        type="button" 
        onClick={handleRealPayment} 
        disabled={disabled}
        className="bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-wider text-xs h-9"
      >
        Pay GHC with Paystack
      </Button>
    );
  };

  // SMS writer desk state
  const [message, setMessage] = useState("");
  const [recipientType, setRecipientType] = useState<'global' | 'branch' | 'custom'>('custom');
  const [targetBranchId, setTargetBranchId] = useState<string>("all");
  const [customNumbers, setCustomNumbers] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Logging and auditing lists
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [deliveryReports, setDeliveryReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Templates list
  const [templates, setTemplates] = useState<any[]>([
    { id: '1', name: "Sunday Revival Service", content: "Dear members, please join us tomorrow at 8:30 AM for our Sunday Revival service filled with glory and powerful prayers. God bless!", category: "Service" },
    { id: '2', name: "Midweek Spiritual Battle", content: "Midweek prayer and bible studies starts tonight at 6:30 PM. Don't miss this fellowship session to lift your spirit.", category: "Service" },
    { id: '3', name: "Tithe & Fruit Seed Reminder", content: "Your support sustains the church's outreach ministry. Send your tithes and seeds using Momo paycode 989212. Blessings!", category: "Finance" }
  ]);

  // Read live statistics and balances
  useEffect(() => {
    if (!effectiveTenantId || !user?.uid) return;

    // Stream user profile values (smsBalance)
    const unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSmsBalance(typeof data.smsBalance === 'number' ? data.smsBalance : 50);
        setWalletBalance(typeof data.walletBalance === 'number' ? data.walletBalance : 0);
        setSmsThreshold(typeof data.smsBalanceThreshold === 'number' ? data.smsBalanceThreshold : 50);
      }
    });

    // Load available credit packages
    const unsubscribePackages = onSnapshot(
      query(collection(db, "sms_packages"), where("active", "==", true)),
      (snap) => {
        if (!snap.empty) {
          const pkgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setPackages(pkgs);
        }
      }
    );

    // Load outgoing transactional history
    const qLogs = query(
      collection(db, "sms_transactions"), 
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSmsLogs(logs);
    });

    // Load delivery logs
    const qReports = query(
      collection(db, "delivery_reports"),
      where("userId", "==", user.uid),
      orderBy("sentAt", "desc"),
      limit(100)
    );
    const unsubscribeReports = onSnapshot(qReports, (snap) => {
      const reps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDeliveryReports(reps);
    });

    // Load branches
    getDocs(query(collection(db, "branches"), where("tenantId", "==", effectiveTenantId))).then((snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Query members for global targeting
    getDocs(query(collection(db, "members"), where("tenantId", "==", effectiveTenantId))).then((snap) => {
      setTotalMembersCount(snap.size);
    });

    return () => {
      unsubscribeUser();
      unsubscribePackages();
      unsubscribeLogs();
      unsubscribeReports();
    };
  }, [effectiveTenantId, user?.uid]);

  // SMS calculator utilities
  const characterCount = message.length;
  const pagesCount = Math.ceil(characterCount / 160) || 1;

  // Render formatters
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

  const calculateTargetRecipientsCount = async (): Promise<string[]> => {
    if (recipientType === "custom") {
      return customNumbers
        .split(/[;,\n]/)
        .map(n => n.trim())
        .filter(n => n.length >= 8);
    }

    // Filter members database dynamically
    let membersRef = collection(db, "members");
    let q = query(membersRef, where("tenantId", "==", effectiveTenantId));

    if (recipientType === "branch" && targetBranchId !== "all") {
      q = query(q, where("branchId", "==", targetBranchId));
    }

    try {
      const snap = await getDocs(q);
      const phoneList: string[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.phoneNumber) {
          phoneList.push(d.phoneNumber);
        } else if (d.phone) {
          phoneList.push(d.phone);
        }
      });
      return phoneList;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleSaveThreshold = async (newThreshold: number) => {
    if (!user?.uid) return;
    setIsUpdatingThreshold(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        smsBalanceThreshold: newThreshold
      });
      toast.success(`Low SMS balance warning threshold updated to ${newThreshold} credits.`);
    } catch (err: any) {
      toast.error("Failed to update threshold check: " + err.message);
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      toast.warning("Broadcast message must not be empty.");
      return;
    }

    setIsSending(true);
    try {
      // 1. Resolve recipients
      const phoneNumbers = await calculateTargetRecipientsCount();
      if (phoneNumbers.length === 0) {
        toast.error("No valid filtered recipient phone numbers resolved or entered.");
        setIsSending(false);
        return;
      }

      const totalCreditsRequired = phoneNumbers.length * pagesCount;
      if (smsBalance < totalCreditsRequired) {
        toast.error(`Low Credits Balance. Requires ${totalCreditsRequired} SMS credits, but you have ${smsBalance} units.`);
        setIsSending(false);
        return;
      }

      // 2. Transmit through centralized system gateway endpoint
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          recipients: phoneNumbers,
          message: message,
          isSuperAdminBypass: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gateway response failed");
      }

      toast.success(`Successfully dispatched broadcast list containing ${phoneNumbers.length} recipients. Deducted ${totalCreditsRequired} credits.`);
      setMessage("");
      setCustomNumbers("");
    } catch (error: any) {
      toast.error("Transmission Failed: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const loadScript = (src: string, globalName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any)[globalName]) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckoutPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBuyingPack) return;
    setIsProcessingCheckout(true);

    if (paymentProvider === 'paystack') {
      try {
        const loaded = await loadScript("https://js.paystack.co/v1/inline.js", "PaystackPop");
        if (!loaded) {
          throw new Error("Unable to load Paystack script from js.paystack.co. Please check internet connection.");
        }

        const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_e3fd79bc9dc8c5da84ab6be4149806b7cb0bebfd";
        const emailAddress = user?.email || "billing@ecclesia.com";
        const totalAmountPesewas = Math.round(isBuyingPack.price * 100);

        const paystack = (window as any).PaystackPop.setup({
          key: paystackKey,
          email: emailAddress,
          amount: totalAmountPesewas,
          currency: "GHS",
          ref: `ecclesia-paystack-${Date.now()}`,
          callback: async (response: any) => {
            try {
              toast.info("Paystack authorization received. Completing credit top-up...");
              const verifyResponse = await fetch("/api/payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user?.uid,
                  packageId: isBuyingPack.id,
                  paymentProvider: "PAYSTACK",
                  reference: response.reference
                })
              });

              const body = await verifyResponse.json();
              if (!verifyResponse.ok) {
                throw new Error(body.error || "Verification issue");
              }

              toast.success(`Refill Approved! Added ${isBuyingPack.smsCount} credits successfully.`);
              setIsBuyingPack(null);
            } catch (err: any) {
              toast.error("Internal verification error: " + err.message);
            } finally {
              setIsProcessingCheckout(false);
            }
          },
          onClose: () => {
            toast.warning("Payment process cancelled.");
            setIsProcessingCheckout(false);
          }
        });

        paystack.openIframe();
      } catch (err: any) {
        toast.error("Paystack Integration error: " + err.message);
        setIsProcessingCheckout(false);
      }
    } else if (paymentProvider === 'flutterwave') {
      try {
        const loaded = await loadScript("https://checkout.flutterwave.com/v3.js", "FlutterwaveCheckout");
        if (!loaded) {
          throw new Error("Unable to load Flutterwave script from checkout.flutterwave.com.");
        }

        const flwPublicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || "FLWPUBK_TEST-e0349b1ca4ebfc68fa82a53bb89db7cf-X";
        const emailAddress = user?.email || "billing@ecclesia.com";

        const flutterwave = (window as any).FlutterwaveCheckout({
          public_key: flwPublicKey,
          tx_ref: `ecclesia-flw-${Date.now()}`,
          amount: isBuyingPack.price,
          currency: "GHS",
          payment_options: "card, mobilemoneyghana",
          customer: {
            email: emailAddress,
            phone_number: checkoutPhone || "0244000000",
            name: user?.displayName || "Church Admin"
          },
          customizations: {
            title: "Ecclesia SaaS SMS",
            description: `Payment for ${isBuyingPack.smsCount} SMS units pack`,
            logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60"
          },
          callback: async (response: any) => {
            try {
              if (response.status === "successful" || response.status === "completed") {
                toast.info("Flutterwave payment completed. Processing top-up...");
                const verifyResponse = await fetch("/api/payment/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user?.uid,
                    packageId: isBuyingPack.id,
                    paymentProvider: "FLUTTERWAVE",
                    reference: response.transaction_id || `flw-${Date.now()}`
                  })
                });

                const body = await verifyResponse.json();
                if (!verifyResponse.ok) {
                  throw new Error(body.error || "Verification failed");
                }

                toast.success(`Refill Approved! Added ${isBuyingPack.smsCount} credits successfully.`);
                setIsBuyingPack(null);
              } else {
                toast.error("Flutterwave transaction returned status: " + response.status);
              }
            } catch (err: any) {
              toast.error("Internal verification error: " + err.message);
            } finally {
              setIsProcessingCheckout(false);
            }
          },
          onclose: () => {
            toast.warning("Payment window closed.");
            setIsProcessingCheckout(false);
          }
        });
      } catch (err: any) {
        toast.error("Flutterwave Integration error: " + err.message);
        setIsProcessingCheckout(false);
      }
    } else {
      // Hubtel, Momo, or Custom simulator:
      try {
        const reference = `ecclesia-momo-${Date.now()}`;
        const response = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.uid,
            packageId: isBuyingPack.id,
            paymentProvider: paymentProvider.toUpperCase(),
            reference: reference
          })
        });

        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Verification issue");
        }

        toast.success(`Refill Approved via Mobile Money! Added ${isBuyingPack.smsCount} credits.`);
        setIsBuyingPack(null);
      } catch (err: any) {
        toast.error("Payment processing error: " + err.message);
      } finally {
        setIsProcessingCheckout(false);
      }
    }
  };

  const exportDeliveryLogsCSV = () => {
    if (deliveryReports.length === 0) {
      toast.warning("No logs to export.");
      return;
    }
    const headers = "Recipient,Message,Status,Date/Time\n";
    const rows = deliveryReports.map(rep => 
      `"${rep.recipient}","${rep.message?.replace(/"/g, '""')}","${rep.status}","${formatTimestamp(rep.sentAt)}"`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Siasore_SMS_Delivery_Report_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyTemplate = (content: string) => {
    setMessage(content);
    toast.info("Template content paired into Broadcast Desk!");
    setActiveTab('send');
  };

  const filteredReports = deliveryReports.filter(rep => 
    rep.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rep.message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Wallet Balance Widget */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-2xl opacity-10 -mr-16 -mt-16 pointer-events-none"></div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Ecclesia Consolidated SaaS Wallet</span>
          <h2 className="text-2xl font-black mt-1 flex items-center gap-2">
            <Coins className="w-6 h-6 text-yellow-500 animate-spin" />
            {smsBalance} SMS Credits
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Always routes messages via centralized Siasore Core Gateway with 100% active endpoints uptime.
          </p>
        </div>
        <Button 
          onClick={() => setActiveTab('buy')} 
          className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-wider h-10 px-5 gap-2"
        >
          <ShoppingCart className="w-4 h-4" /> Top-Up Credits Pack
        </Button>
      </div>

      {/* Primary Toggling Interface */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('send')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'send' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Broadcast Desk
        </button>
        <button
          onClick={() => setActiveTab('buy')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'buy' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Buy Credits
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'logs' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Outgoing Broadcasts
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'reports' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Recipient Audits
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
            activeTab === 'templates' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Message Assist
        </button>
      </div>

      {/* Tab Content: Broadcast Send */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Main Card */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white flex flex-col justify-between">
            <CardHeader className="py-4 border-b border-slate-50">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-indigo-605 text-indigo-600" />
                Produce SMS Broadcast
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Target Filtering options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Delivery Targeting</Label>
                  <Select value={recipientType} onValueChange={(val: any) => setRecipientType(val)}>
                    <SelectTrigger className="bg-slate-50/50">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="custom">Custom Phone List</SelectItem>
                      <SelectItem value="global">All Church Members ({totalMembersCount})</SelectItem>
                      <SelectItem value="branch">Branch Filter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recipientType === "branch" && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Specific Branch</Label>
                    <Select value={targetBranchId} onValueChange={setTargetBranchId}>
                      <SelectTrigger className="bg-slate-50/50">
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">Global (All Branches)</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {recipientType === "custom" && (
                <div className="space-y-1.5 animate-fadeIn">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Target Mobile Numbers</Label>
                  <Textarea 
                    placeholder="Enter phone numbers separated by commas or lines, e.g. 0555000000, +233544123456"
                    value={customNumbers}
                    onChange={(e) => setCustomNumbers(e.target.value)}
                    className="h-20 bg-slate-50/20 font-mono text-xs"
                  />
                  <p className="text-[9px] text-slate-450">Supports standard country prefix codes.</p>
                </div>
              )}

              {/* Message Core Input */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Message Payload</Label>
                <div className="relative">
                  <Textarea 
                    placeholder="Enter message body content here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={800}
                    className="min-h-[140px] bg-slate-50/20"
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100 mt-1">
                  <span>Character Unit Count: <b className="text-slate-900">{characterCount}</b></span>
                  <span>Calculated Pages: <b className="text-indigo-600 font-black">{pagesCount} Page(s)</b></span>
                  <span>Max limit: 800 chars</span>
                </div>
              </div>

              <div className="p-4 bg-sky-50 text-sky-800 rounded-lg flex items-start gap-2.5 border border-sky-100 text-xs">
                <ShieldCheck className="w-4.5 h-4.5 text-sky-600 mt-0.5" />
                <p>
                  Siasore anti-spam system is enabled. Messages are securely stored inside centrally audited SaaS files. Under GDPR compliance, we sanitize non-delivery metrics.
                </p>
              </div>
            </CardContent>
            <CardFooter className="py-4 border-t border-slate-50 flex justify-end">
              <Button 
                onClick={handleSendBroadcast} 
                className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-xs uppercase tracking-widest font-black py-2.5 px-6"
                disabled={isSending}
              >
                {isSending ? "Routing message..." : "Dispatch Broadcast"}
              </Button>
            </CardFooter>
          </Card>

          {/* Quick Stats Helper sidebar */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm bg-indigo-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-700">Broadcast Diagnostics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-medium">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Gateway Status</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 font-bold">ACTIVE (CENTRAL)</Badge>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Your Wallet Credits</span>
                  <span className="font-mono font-bold text-slate-900">{smsBalance} SMS</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Page length policy</span>
                  <span className="text-slate-700">160 characters per unit</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-indigo-600 animate-pulse" />
                  Alert Limit Threshold
                </CardTitle>
                <CardDescription className="text-[10px]">Configure the minimum SMS credits balance required before dispatching an in-app warning notice.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="threshold-select" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Warning Threshold Limit</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="threshold-select"
                      type="number"
                      min="5"
                      max="500"
                      value={smsThreshold}
                      onChange={(e) => setSmsThreshold(Number(e.target.value))}
                      className="font-mono text-xs w-24 h-9"
                    />
                    <span className="text-slate-400 font-bold uppercase text-[9px]">credits limit</span>
                  </div>
                </div>
                <Button
                  onClick={() => handleSaveThreshold(smsThreshold)}
                  disabled={isUpdatingThreshold}
                  className="w-full bg-slate-950 hover:bg-slate-900 border text-white font-bold tracking-wider uppercase text-[10px] h-9"
                >
                  {isUpdatingThreshold ? "Saving limit..." : "Save Configured Limit"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-655 text-slate-500">Helper tags</CardTitle>
                <CardDescription className="text-[10px]">Pair these variable templates inside customized broadcast bodies:</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-mono">
                <div className="p-2 bg-slate-50 border rounded-lg">
                  <p className="text-slate-500 font-bold">&#123;&#123;FirstName&#125;&#125;</p>
                  <p className="text-[10px] mt-0.5 text-slate-400 font-sans">Translates dynamically to member's legal first name.</p>
                </div>
                <div className="p-2 bg-slate-50 border rounded-lg">
                  <p className="text-slate-500 font-bold">&#123;&#123;ChurchName&#125;&#125;</p>
                  <p className="text-[10px] mt-0.5 text-slate-400 font-sans">Pairs the church name profile directly inside standard templates.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Buy Credits */}
      {activeTab === 'buy' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Purchase SMS Credit Packages</h3>
            <p className="text-xs text-slate-450 mt-1">Choose a credits volume tier below with secure, instantaneous digital clearing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <Card key={pkg.id} className="border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden bg-white">
                <div className="bg-slate-50 border-b border-slate-100 p-4 shrink-0 flex justify-between items-center bg-indigo-50/20">
                  <span className="text-xs font-black uppercase text-indigo-700 tracking-wider font-mono">{pkg.name}</span>
                  <Badge className="bg-slate-900 text-white font-bold">{pkg.smsCount} SMS Units</Badge>
                </div>
                <CardContent className="p-6 text-center space-y-4 flex-1 flex flex-col justify-between">
                  <div className="py-4">
                    <p className="text-4xl font-black text-slate-900 tracking-tight">GH₵{pkg.price}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2">
                      Unit Expense Rate: GH₵{(pkg.price / pkg.smsCount).toFixed(3)} per standard SMS
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setIsBuyingPack(pkg);
                      setCheckoutPhone("");
                    }}
                    className="w-full bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-wider text-xs h-10"
                  >
                    Select credit pack
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Checkout Checkout Dialog Modal */}
          {isBuyingPack && (
            <Dialog open={true} onOpenChange={() => setIsBuyingPack(null)}>
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    Complete Digital checkout
                  </DialogTitle>
                  <DialogDescription>
                    Secure payment provider interface with instant database credit topup.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCheckoutPackage} className="space-y-4 mt-2">
                  <div className="p-3.5 bg-slate-50 border rounded-lg space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Refill Package:</span><strong className="text-slate-900 font-bold">{isBuyingPack.name}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-500">Units Allocated:</span><strong className="text-indigo-600 font-black">+{isBuyingPack.smsCount} SMS</strong></div>
                    <div className="flex justify-between"><span className="text-slate-500">Total charge rate:</span><strong className="text-slate-950 text-sm font-black">GH₵{isBuyingPack.price}</strong></div>
                  </div>

                  <div className="space-y-3 border-t pt-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Select Method</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button 
                        type="button"
                        onClick={() => setPaymentProvider('paystack')}
                        className={cn("p-2 border rounded text-xs font-bold transition-all", paymentProvider === 'paystack' ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                      >
                        Paystack Gateway
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentProvider('flutterwave')}
                        className={cn("p-2 border rounded text-xs font-bold transition-all", paymentProvider === 'flutterwave' ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                      >
                        Flutterwave Pay
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentProvider('hubtel')}
                        className={cn("p-2 border rounded text-xs font-bold transition-all", paymentProvider === 'hubtel' ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                      >
                        Hubtel / MoMo
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentProvider('momo')}
                        className={cn("p-2 border rounded text-xs font-bold transition-all", paymentProvider === 'momo' ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                      >
                        MTN Mobile Money
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Mobile Billing Phone Number</Label>
                    <Input 
                      placeholder="e.g. 0244123456" 
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                      required
                      type="tel"
                      className="font-mono text-sm"
                    />
                  </div>

                  <DialogFooter className="pt-4 border-t gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsBuyingPack(null)}>Cancel</Button>
                    {paymentProvider === 'paystack' ? (
                      <PaystackSMSButton pack={isBuyingPack} disabled={isProcessingCheckout} />
                    ) : (
                      <Button type="submit" disabled={isProcessingCheckout} className="bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-wider text-xs">
                        {isProcessingCheckout 
                          ? "Launching Checkout Secure Port..." 
                          : paymentProvider === 'flutterwave'
                          ? "Pay GHC with Flutterwave"
                          : `Simulate and Collect with ${paymentProvider.toUpperCase()}`}
                      </Button>
                    )}
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {/* Tab: Outgoing Logs */}
      {activeTab === 'logs' && (
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden animate-fadeIn">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Dispatched Broadcast Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {smsLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase opacity-75 italic">
                No outbound broadcast logs registered for your user workspace yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date/Time</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sender Alpha</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recipients Count</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Credits Deducted</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dispatched Payload</TableHead>
                    <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Transmission Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smsLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-semibold text-slate-800 pl-6 text-[11px]">
                        {formatTimestamp(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-bold text-slate-600">{log.senderId}</TableCell>
                      <TableCell className="text-slate-900 font-bold">{log.recipients?.length || 1} Destinations</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-red-650 text-red-600">-{log.smsCount} Credits</TableCell>
                      <TableCell className="text-xs max-w-sm truncate text-slate-550 font-medium">{log.message}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge variant="outline" className={log.status === "delivered" ? "bg-emerald-50 text-emerald-700 font-black border-emerald-100 uppercase" : "bg-red-50 text-red-700 font-black border-red-100 uppercase"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Delivery Reports (Recipient Audits) */}
      {activeTab === 'reports' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            {/* Search Input bar */}
            <div className="relative w-full md:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <Input 
                placeholder="Search recipient number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <Button onClick={exportDeliveryLogsCSV} size="sm" className="bg-slate-900 hover:bg-slate-950 font-bold uppercase tracking-wider text-xs h-9">
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV Reports
            </Button>
          </div>

          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 flex justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">Individual Recipient Auditing reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredReports.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic">No matching recipient logs captured.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Recipient Mobile</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sent Payload Message</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Delivery Status</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Transmission Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((rep) => (
                      <TableRow key={rep.id}>
                        <TableCell className="font-mono text-xs font-bold pl-6 text-slate-900">{rep.recipient}</TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-xs truncate font-medium">{rep.message}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            <CheckCircle2 className="w-3" /> {rep.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-slate-400 text-[10px] font-bold">{formatTimestamp(rep.sentAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Message Templates Assist */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between bg-white h-full">
              <CardHeader className="pb-3 border-b bg-slate-50/30">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold text-[9px] uppercase tracking-wider">{tpl.category}</Badge>
                </div>
                <CardTitle className="text-sm font-black text-slate-800 uppercase mt-2 tracking-tight">{tpl.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-xs text-slate-550 italic leading-relaxed font-semibold text-slate-600 flex-1">
                  "{tpl.content}"
                </p>
                <Button 
                  onClick={() => copyTemplate(tpl.content)}
                  variant="outline" 
                  className="w-full text-xs font-bold uppercase tracking-wider h-9"
                >
                  Apply content copy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
