import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTenant } from "@/src/contexts/TenantContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Send,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Users,
  Target,
  History,
  CalendarDays,
  Sparkles,
  PlusCircle,
  Trash2,
  Edit3,
  Link2,
  Unlink,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function CommunicationsPage() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useTenant();
  const [smsConfig, setSmsConfig] = useState<any>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalMessages: 0,
    activeBranches: 0,
  });
  const [loading, setLoading] = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    content: "",
    category: "custom",
  });
  const [smsData, setSmsData] = useState({
    message: "",
    recipientType:
      profile?.role === "pastor" ? "branch-members" : "global-members",
    targetBranchId:
      profile?.role === "pastor"
        ? profile?.staffData?.assignedBranchId || "all"
        : "all",
  });

  const [smsConfigsList, setSmsConfigsList] = useState<any[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({
    name: "",
    provider: "twilio",
    apiKey: "",
    apiSecret: "",
    senderId: "",
    customUrl: "",
    customMethod: "POST",
    customBodyJson: '{\n  "recipient": "{{to}}",\n  "message": "{{message}}",\n  "sender": "{{sender}}"\n}',
    customHeadersJson: '{\n  "Content-Type": "application/json"\n}',
  });

  // Arkesel API v2 Connectivity Tester variables
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testSelectedConfig, setTestSelectedConfig] = useState<any>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [testSenderId, setTestSenderId] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testLogs, setTestLogs] = useState<any[]>([]);
  const [testDiagnosis, setTestDiagnosis] = useState("");
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  const handleOpenTestModal = (config: any) => {
    setTestSelectedConfig(config);
    setTestSenderId(config.senderId || "");
    setTestRecipient("");
    setTestMessage(`ECCLESIA Connection Test Alert: [${new Date().toLocaleTimeString("en-GB")}]`);
    setTestLogs([]);
    setTestDiagnosis("");
    setTestSuccess(null);
    setIsTestModalOpen(true);
  };

  const handleRunConnectivityTest = async () => {
    if (!testSelectedConfig) return;
    if (!testRecipient) {
      toast.error("Please enter a test recipient phone number.");
      return;
    }

    setTestRunning(true);
    setTestLogs([]);
    setTestDiagnosis("");
    setTestSuccess(null);

    try {
      const response = await fetch("/api/sms/test-connectivity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: testSelectedConfig.apiKey,
          senderId: testSenderId,
          recipient: testRecipient,
          message: testMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} test failed`);
      }

      const data = await response.json();
      setTestLogs(data.logs || []);
      setTestDiagnosis(data.diagnosis || "");
      setTestSuccess(data.success);
      if (data.success) {
        toast.success("Diagnostics call completed successfully!");
      } else {
        toast.error("Diagnostics check finished with routing warnings.");
      }
    } catch (err: any) {
      toast.error("Failed to run connectivity diagnostic: " + err.message);
      setTestLogs(() => [
        { step: "Fatal Client Fetch Error", status: "error", message: err.message }
      ]);
      setTestDiagnosis("A networking or client error occurred while invoking the connectivity dashboard side-server: " + err.message);
      setTestSuccess(false);
    } finally {
      setTestRunning(false);
    }
  };

  const seasonalTemplates = [
    {
      name: "Easter Celebration",
      content:
        "He is Risen! We invite you to our Easter Sunday service at 9AM. Come celebrate the victory of Christ with us. God bless!",
      category: "seasonal",
    },
    {
      name: "Christmas Message",
      content:
        "Merry Christmas! Join us for our special Carol Service this evening. Wishing you the joy and peace of the season.",
      category: "seasonal",
    },
    {
      name: "New Year Fast",
      content:
        "Welcome to our year of Divine Reset! We start our 21-day fasting tomorrow. Join us online at 6PM daily for prayers.",
      category: "seasonal",
    },
    {
      name: "Sunday Reminder",
      content:
        "Happy Saturday! Just a reminder of our service tomorrow at 8AM. We look forward to worshipping together.",
      category: "service",
    },
    {
      name: "Tithes & Offerings",
      content:
        "Your faithfulness makes our mission possible. You can give your tithes and offerings via our digital channels. God bless your seeds.",
      category: "finance",
    },
  ];

  const [branches, setBranches] = useState<any[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState({
    provider: "twilio",
    apiKey: "",
    apiSecret: "",
    senderId: "",
  });

  useEffect(() => {
    if (!effectiveTenantId) return;

    const isPastor = profile?.role === "pastor";
    const branchId = profile?.staffData?.assignedBranchId || "central";

    // Fetch branches
    getDocs(
      query(
        collection(db, "branches"),
        where("tenantId", "==", effectiveTenantId),
      ),
    ).then((snap) => {
      const branchList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBranches(branchList);
      setStats((prev) => ({ ...prev, activeBranches: snap.size }));

      if (isPastor && profile?.staffData?.assignedBranchId) {
        setSmsData((prev) => ({
          ...prev,
          targetBranchId: profile.staffData.assignedBranchId,
        }));
      }
    });

    // Fetch total members
    let membersQuery = query(
      collection(db, "members"),
      where("tenantId", "==", effectiveTenantId),
    );
    if (
      isPastor &&
      profile?.staffData?.assignedBranchId &&
      profile.staffData.assignedBranchId !== "none"
    ) {
      membersQuery = query(
        membersQuery,
        where("branchId", "==", profile.staffData.assignedBranchId),
      );
    }
    getDocs(membersQuery).then((snap) => {
      setStats((prev) => ({ ...prev, totalMembers: snap.size }));
    });

    // Fetch custom templates
    const qTemplates = query(
      collection(db, "sms_templates"),
      where("tenantId", "==", effectiveTenantId),
      orderBy("createdAt", "desc"),
    );
    const unsubscribeTemplates = onSnapshot(
      qTemplates,
      (snap) => {
        setCustomTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("SMS Templates onSnapshot error:", error);
      },
    );

    // Fetch SMS config (real-time stream of all configs, auto-identifying the linked one)
    const qSmsAll = query(
      collection(db, "sms_configs"),
      where("tenantId", "==", effectiveTenantId),
    );
    const unsubscribeAllSms = onSnapshot(qSmsAll, (snap) => {
      const allConfigs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
      setSmsConfigsList(allConfigs);

      const activeLink = isPastor ? branchId : "central";
      const linked = allConfigs.find((c) => c.branchId === activeLink);

      if (linked) {
        setSmsConfig(linked);
        setGatewayConfig({
          provider: linked.provider || "twilio",
          apiKey: linked.apiKey || "",
          apiSecret: linked.apiSecret || "",
          senderId: linked.senderId || "",
        });
      } else {
        setSmsConfig(null);
      }
    });

    // Fetch SMS logs
    let logsQuery = query(
      collection(db, "sms_logs"),
      where("tenantId", "==", effectiveTenantId),
      orderBy("sentAt", "desc"),
      limit(20),
    );
    if (
      isPastor &&
      profile?.staffData?.assignedBranchId &&
      profile.staffData.assignedBranchId !== "none"
    ) {
      logsQuery = query(
        logsQuery,
        where("branchId", "==", profile.staffData.assignedBranchId),
      );
    }
    const unsubscribeLogs = onSnapshot(
      logsQuery,
      (snap) => {
        const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSmsLogs(logs);
        setStats((prev) => ({ ...prev, totalMessages: logs.length })); // Just an estimate for now
        setLoading(false);
      },
      (error) => {
        console.error("SMS Logs onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => {
      unsubscribeTemplates();
      unsubscribeAllSms();
      unsubscribeLogs();
    };
  }, [effectiveTenantId, profile?.role, profile?.staffData?.assignedBranchId]);

  const handleAddOrUpdateSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      if (editingConfigId) {
        await updateDoc(doc(db, "sms_configs", editingConfigId), {
          name: configForm.name || "Unnamed Gateway",
          provider: configForm.provider,
          apiKey: configForm.apiKey,
          apiSecret: configForm.apiSecret,
          senderId: configForm.senderId,
          customUrl: configForm.customUrl || "",
          customMethod: configForm.customMethod || "POST",
          customBodyJson: configForm.customBodyJson || "",
          customHeadersJson: configForm.customHeadersJson || "",
          updatedAt: serverTimestamp(),
        });
        toast.success("SMS Gateway profile updated successfully!");
      } else {
        await addDoc(collection(db, "sms_configs"), {
          tenantId: effectiveTenantId,
          name: configForm.name || "Unnamed Gateway",
          provider: configForm.provider,
          apiKey: configForm.apiKey,
          apiSecret: configForm.apiSecret,
          senderId: configForm.senderId,
          customUrl: configForm.customUrl || "",
          customMethod: configForm.customMethod || "POST",
          customBodyJson: configForm.customBodyJson || "",
          customHeadersJson: configForm.customHeadersJson || "",
          branchId: "unlinked",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success("New SMS Gateway profile created successfully!");
      }
      setIsConfigModalOpen(false);
      setEditingConfigId(null);
      setConfigForm({
        name: "",
        provider: "twilio",
        apiKey: "",
        apiSecret: "",
        senderId: "",
        customUrl: "",
        customMethod: "POST",
        customBodyJson: '{\n  "recipient": "{{to}}",\n  "message": "{{message}}",\n  "sender": "{{sender}}"\n}',
        customHeadersJson: '{\n  "Content-Type": "application/json"\n}',
      });
    } catch (err: any) {
      toast.error("Failed to save SMS config profile: " + err.message);
    }
  };

  const handleLinkConfig = async (configId: string) => {
    if (!effectiveTenantId) return;
    const isPastor = profile?.role === "pastor";
    const activeLink = isPastor
      ? profile?.staffData?.assignedBranchId || "central"
      : "central";

    try {
      // Unlink other profiles at the same branch level
      const otherLinkedConfigs = smsConfigsList.filter(
        (c) => c.branchId === activeLink,
      );
      for (const c of otherLinkedConfigs) {
        if (c.id !== configId) {
          await updateDoc(doc(db, "sms_configs", c.id), {
            branchId: "unlinked",
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Link this specific one
      await updateDoc(doc(db, "sms_configs", configId), {
        branchId: activeLink,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        `Gateway successfully linked to your current ${isPastor ? "Branch" : "Central"} broadcasts!`,
      );
    } catch (err: any) {
      toast.error("Failed to link gateway profile: " + err.message);
    }
  };

  const handleUnlinkConfig = async (configId: string) => {
    try {
      await updateDoc(doc(db, "sms_configs", configId), {
        branchId: "unlinked",
        updatedAt: serverTimestamp(),
      });
      toast.success("Gateway profile unlinked successfully.");
    } catch (err: any) {
      toast.error("Failed to unlink: " + err.message);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this SMS Gateway Profile? This action is irreversible.",
      )
    )
      return;
    try {
      await updateDoc(doc(db, "sms_configs", configId), {
        tenantId: "deleted_" + effectiveTenantId,
        branchId: "unlinked",
        updatedAt: serverTimestamp(),
      });
      toast.success("Gateway profile removed successfully.");
    } catch (err: any) {
      toast.error("Failed to delete gateway config: " + err.message);
    }
  };

  const handleSendBulkSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsConfig) {
      toast.error("Please configure your central SMS Gateway first");
      return;
    }
    setSmsLoading(true);
    try {
      const tenantId = effectiveTenantId;
      const type = smsData.recipientType;
      const branchId = smsData.targetBranchId;

      let phoneNumbers: string[] = [];

      // 1. Fetch from Members
      if (["global-members", "branch-all", "branch-members"].includes(type)) {
        let q = query(
          collection(db, "members"),
          where("tenantId", "==", tenantId),
        );
        if (type.startsWith("branch-") && branchId !== "all") {
          q = query(q, where("branchId", "==", branchId));
        }
        const snap = await getDocs(q);
        phoneNumbers = [
          ...phoneNumbers,
          ...snap.docs.map((d) => d.data().phone).filter((p) => !!p),
        ];
      }

      // 2. Fetch from Staff
      if (
        [
          "global-staff",
          "global-pastors",
          "global-workers",
          "branch-all",
          "branch-staff",
        ].includes(type)
      ) {
        let q = query(
          collection(db, "staff"),
          where("tenantId", "==", tenantId),
        );

        if (type === "global-pastors") {
          q = query(q, where("role", "==", "pastor"));
        } else if (type === "global-workers") {
          q = query(q, where("role", "==", "worker"));
        }

        if (type.startsWith("branch-") && branchId !== "all") {
          q = query(q, where("assignedBranchId", "==", branchId));
        }

        const snap = await getDocs(q);
        phoneNumbers = [
          ...phoneNumbers,
          ...snap.docs.map((d) => d.data().phone).filter((p) => !!p),
        ];
      }

      // Remove duplicates
      const uniqueNumbers = [...new Set(phoneNumbers)];

      if (uniqueNumbers.length === 0) {
        toast.error("No recipients with phone numbers found for this scope");
        return;
      }

      // Dispatch the real SMS via local server API proxy to mask API credentials and handle protocols
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          config: smsConfig,
          recipients: uniqueNumbers,
          message: smsData.message
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status} sending failed`);
      }

      await addDoc(collection(db, "sms_logs"), {
        tenantId,
        branchId: profile?.staffData?.assignedBranchId || "central",
        recipientCount: uniqueNumbers.length,
        message: smsData.message,
        status: "broadcasted",
        scope: type,
        sentAt: serverTimestamp(),
      });

      toast.success(
        `Successfully broadcasted via "${smsConfig.name || "Main Gateway"}" [${smsConfig.provider.toUpperCase()}] to ${uniqueNumbers.length} recipients!`,
      );
      setSmsData({ ...smsData, message: "" });
    } catch (err: any) {
      toast.error("Broadcast failed: " + err.message);
    } finally {
      setSmsLoading(false);
    }
  };

  const saveAsTemplate = async (content: string) => {
    if (!content) return;
    if (!effectiveTenantId) return;
    try {
      await addDoc(collection(db, "sms_templates"), {
        tenantId: effectiveTenantId,
        name: `Auto-saved Template ${format(new Date(), "HH:mm")}`,
        content,
        category: "custom",
        createdAt: serverTimestamp(),
      });
      toast.success("Message saved as a custom template");
    } catch (err: any) {
      toast.error("Failed to save template");
    }
  };

  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;
    try {
      await addDoc(collection(db, "sms_templates"), {
        ...newTemplate,
        tenantId: effectiveTenantId,
        createdAt: serverTimestamp(),
      });
      setIsTemplateModalOpen(false);
      setNewTemplate({ name: "", content: "", category: "custom" });
      toast.success("Custom template created!");
    } catch (err: any) {
      toast.error("Failed to create template");
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center text-slate-400 font-bold animate-pulse uppercase tracking-widest">
        Initialising SMS Hub...
      </div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
          Communications Center
        </h1>
        <p className="text-slate-500 mt-1 italic">
          Centralised SMS broadcasting and engagement portal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> Reachable Network
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {stats.totalMembers} Members
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Across {stats.activeBranches} branches
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-indigo-600 text-white shadow-xl shadow-indigo-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-indigo-200 uppercase">
              Gateway Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {smsConfig ? "Connected" : "Offline"}
            </div>
            <p className="text-[10px] text-indigo-200 font-bold uppercase mt-1">
              {smsConfig?.provider || "No provider"} configured
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-slate-400">
              Monthly Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {smsLogs.reduce((acc, l) => acc + (l.recipientCount || 0), 0)} SMS
            </div>
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
                <CardTitle className="text-lg font-bold">
                  Network Broadcast
                </CardTitle>
                <CardDescription>
                  Send a mass message across the entire church hierarchy.
                </CardDescription>
              </div>
              <Target className="w-5 h-5 text-indigo-600 opacity-20" />
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendBulkSms} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">
                      Recipient Scope
                    </Label>
                    <Select
                      value={smsData.recipientType}
                      onValueChange={(v) =>
                        setSmsData({ ...smsData, recipientType: v })
                      }
                    >
                      <SelectTrigger className="border-slate-200 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {profile?.role === "church-admin" && (
                          <>
                            <SelectItem value="global-members">
                              All Members (Global)
                            </SelectItem>
                            <SelectItem value="global-pastors">
                              All Pastors (Global)
                            </SelectItem>
                            <SelectItem value="global-workers">
                              All Workers (Global)
                            </SelectItem>
                            <SelectItem value="global-staff">
                              All Personnel (Global)
                            </SelectItem>
                          </>
                        )}
                        <SelectItem value="branch-all">
                          Branch (All Recipients)
                        </SelectItem>
                        <SelectItem value="branch-members">
                          Branch (Members Only)
                        </SelectItem>
                        <SelectItem value="branch-staff">
                          Branch (Staff Only)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {smsData.recipientType.startsWith("branch-") &&
                    (profile?.role === "church-admin" ||
                      !profile?.staffData?.assignedBranchId) && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">
                          Target Branch
                        </Label>
                        <Select
                          value={smsData.targetBranchId}
                          onValueChange={(v) =>
                            setSmsData({ ...smsData, targetBranchId: v })
                          }
                        >
                          <SelectTrigger className="border-slate-200 shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5" /> Seasonal &
                      Template Messages
                    </Label>
                    <Dialog
                      open={isTemplateModalOpen}
                      onOpenChange={setIsTemplateModalOpen}
                    >
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[9px] font-bold uppercase tracking-widest gap-1 hover:text-indigo-600"
                          >
                            <PlusCircle className="w-3 h-3" /> New Custom
                            Template
                          </Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create SMS Template</DialogTitle>
                          <DialogDescription>
                            Save a message to quickly reuse it later.
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          onSubmit={handleCreateCustomTemplate}
                          className="space-y-4 mt-4"
                        >
                          <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input
                              placeholder="e.g. Mid-week Service Reminder"
                              value={newTemplate.name}
                              onChange={(e) =>
                                setNewTemplate({
                                  ...newTemplate,
                                  name: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                              value={newTemplate.category}
                              onValueChange={(v) =>
                                setNewTemplate({ ...newTemplate, category: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="seasonal">
                                  Seasonal
                                </SelectItem>
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
                              onChange={(e) =>
                                setNewTemplate({
                                  ...newTemplate,
                                  content: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" className="bg-indigo-600">
                              Save Template
                            </Button>
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
                        onClick={() =>
                          setSmsData({ ...smsData, message: t.content })
                        }
                      >
                        <span className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> {t.category}
                        </span>
                        <span className="text-[11px] font-bold text-slate-800">
                          {t.name}
                        </span>
                      </Button>
                    ))}
                    {customTemplates.map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        variant="outline"
                        className="h-auto py-2 px-3 flex-shrink-0 flex flex-col items-start gap-1 border-indigo-100 bg-indigo-50/20 hover:border-indigo-400 hover:bg-white transition-all text-left group"
                        onClick={() =>
                          setSmsData({ ...smsData, message: t.content })
                        }
                      >
                        <span className="text-[9px] font-black uppercase text-indigo-600 flex items-center justify-between w-full">
                          Custom
                        </span>
                        <span className="text-[11px] font-bold text-slate-800">
                          {t.name}
                        </span>
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-slate-500">
                        Broadcast Message
                      </Label>
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
                      onChange={(e) =>
                        setSmsData({ ...smsData, message: e.target.value })
                      }
                      maxLength={160}
                      required
                    />
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span
                        className={cn(
                          smsData.message.length > 140
                            ? "text-amber-600"
                            : "text-slate-400",
                        )}
                      >
                        {smsData.message.length}/160 characters
                      </span>
                      <span className="text-slate-400">
                        1 standard SMS page
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={smsLoading || !smsData.message}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-sm font-black uppercase tracking-widest h-14 gap-3 shadow-lg shadow-slate-100"
                >
                  {smsLoading ? (
                    "Broadcasting..."
                  ) : (
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
              <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                Recent Activity
              </CardTitle>
              <History className="w-4 h-4 text-slate-300" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-6 h-10 text-[10px] uppercase font-black">
                      Sent At
                    </TableHead>
                    <TableHead className="h-10 text-[10px] uppercase font-black">
                      Message Preview
                    </TableHead>
                    <TableHead className="h-10 text-[10px] uppercase font-black">
                      Scope
                    </TableHead>
                    <TableHead className="text-right pr-6 h-10 text-[10px] uppercase font-black">
                      Count
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smsLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-12 text-slate-400 italic"
                      >
                        No historical broadcasts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    smsLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <TableCell className="pl-6 text-[10px] font-bold text-slate-400">
                          {log.sentAt
                            ? format(log.sentAt.toDate(), "MMM d, h:mm a")
                            : "Pending"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs font-medium text-slate-700">
                          {log.message}
                        </TableCell>
                        <TableCell>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                            {log.branchId === "central" ? "Global" : "Local"}
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
          <Card className="border-indigo-100 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-tight flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  SMS Gateways Admin
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Add and assign active custom SMS profiles.
                </CardDescription>
              </div>
              <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogTrigger
                  render={
                    <Button
                      onClick={() => {
                        setEditingConfigId(null);
                        setConfigForm({
                          name: "",
                          provider: "twilio",
                          apiKey: "",
                          apiSecret: "",
                          senderId: "",
                          customUrl: "",
                          customMethod: "POST",
                          customBodyJson: '{\n  "recipient": "{{to}}",\n  "message": "{{message}}",\n  "sender": "{{sender}}"\n}',
                          customHeadersJson: '{\n  "Content-Type": "application/json"\n}',
                        });
                      }}
                      className="h-8 text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1 px-3 rounded-lg text-white"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Profile
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle className="text-base font-black uppercase text-slate-900">
                      {editingConfigId ? "Edit Gateway Profile" : "New SMS Gateway Profile"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Configure built-in integration clients (Twilio, Africa's Talking, Mnotify, Arkasel) or save a custom HTTP REST template.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddOrUpdateSmsConfig} className="space-y-4 mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Gateway Profile Name</Label>
                      <Input
                        placeholder="e.g. Ghana HQ Primary SMS"
                        value={configForm.name}
                        onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Provider / Client SDK</Label>
                      <Select
                        value={configForm.provider}
                        onValueChange={(v) => {
                          let defaultUrl = "";
                          let defaultBody = "";
                          let defaultHeaders = '{\n  "Content-Type": "application/json"\n}';
                          
                          if (v === "mnotify") {
                            defaultUrl = "https://api.mnotify.com/v1/sms/quick";
                            defaultBody = '{\n  "recipient": ["{{to}}"],\n  "sender": "{{sender}}",\n  "message": "{{message}}",\n  "is_schedule": false\n}';
                          } else if (v === "arkasel") {
                            defaultUrl = "https://sms.arkasel.com/sms/api?action=send-sms";
                            defaultBody = ""; // Arkasel typically uses URL queries for GET parameters
                          } else if (v === "custom") {
                            defaultUrl = "https://your-custom-gateway.com/api/send";
                            defaultBody = '{\n  "to": "{{to}}",\n  "msg": "{{message}}",\n  "from": "{{sender}}"\n}';
                          }

                          setConfigForm({ 
                            ...configForm, 
                            provider: v,
                            customUrl: defaultUrl,
                            customBodyJson: defaultBody,
                            customHeadersJson: defaultHeaders
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="twilio">Twilio</SelectItem>
                          <SelectItem value="africastalking">Africa's Talking</SelectItem>
                          <SelectItem value="mnotify">Mnotify SMS (Ghana)</SelectItem>
                          <SelectItem value="arkasel">Arkasel SMS (Ghana)</SelectItem>
                          <SelectItem value="custom">Generic HTTP REST Webhook</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {configForm.provider === "twilio" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Account SID</Label>
                          <Input
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={configForm.apiSecret}
                            onChange={(e) => setConfigForm({ ...configForm, apiSecret: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Auth Token</Label>
                          <Input
                            type="password"
                            placeholder="•••••••••••••••••••••"
                            value={configForm.apiKey}
                            onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">System From Number</Label>
                          <Input
                            placeholder="e.g. +14155552671"
                            value={configForm.senderId}
                            onChange={(e) => setConfigForm({ ...configForm, senderId: e.target.value })}
                            required
                          />
                        </div>
                      </>
                    )}

                    {configForm.provider === "africastalking" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Username</Label>
                          <Input
                            placeholder="e.g. sandbox or globalchurch"
                            value={configForm.apiSecret}
                            onChange={(e) => setConfigForm({ ...configForm, apiSecret: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">API Key</Label>
                          <Input
                            type="password"
                            placeholder="•••••••••••••••••••••"
                            value={configForm.apiKey}
                            onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Sender ID (Alpha tag)</Label>
                          <Input
                            placeholder="e.g. ECCLESIA (Optional)"
                            value={configForm.senderId}
                            onChange={(e) => setConfigForm({ ...configForm, senderId: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {configForm.provider === "mnotify" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">mNotify API Key</Label>
                          <Input
                            type="password"
                            placeholder="e.g. mm1234567890abcdef..."
                            value={configForm.apiKey}
                            onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                            required
                          />
                          <p className="text-[9px] text-zinc-400">Obtained from portal.mnotify.com developer options.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Sender ID (Pre-approved)</Label>
                          <Input
                            placeholder="e.g. ECCLESIA"
                            maxLength={11}
                            value={configForm.senderId}
                            onChange={(e) => setConfigForm({ ...configForm, senderId: e.target.value })}
                            required
                          />
                          <p className="text-[9px] text-zinc-400">Max 11 alphanumeric characters. Must be whitelisted on mNotify.</p>
                        </div>
                      </>
                    )}

                    {configForm.provider === "arkasel" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Arkesel API v2 token (Key)</Label>
                          <Input
                            type="password"
                            placeholder="e.g. ark_token_..."
                            value={configForm.apiKey}
                            onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                            required
                          />
                          <p className="text-[9px] text-zinc-400">Grab from Arkasel API dashboard integration section.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Approved Sender ID</Label>
                          <Input
                            placeholder="e.g. ECCLESIA"
                            maxLength={11}
                            value={configForm.senderId}
                            onChange={(e) => setConfigForm({ ...configForm, senderId: e.target.value })}
                            required
                          />
                          <p className="text-[9px] text-amber-600 font-medium">This must be registered and approved on Arkesel.</p>
                        </div>

                        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg text-[10px] text-amber-900 space-y-1.5 mt-2">
                          <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                            <span>⚠️</span> Credit Deducted but SMS Not Delivered?
                          </p>
                          <p className="text-zinc-600 leading-normal">
                            If Arkesel successfully charges credits but the messages are not received on live devices, please verify the following:
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-zinc-600 leading-normal">
                            <li>
                              <strong className="text-zinc-800">Sender ID Whitelisting:</strong> In Ghana, you cannot use any Sender ID until it is registered and explicitly approved on your Arkesel Portal. Releasing messages with unregistered names will deduct credit at submission but fail at the carrier level.
                            </li>
                            <li>
                              <strong className="text-zinc-800">Do-Not-Disturb (DND):</strong> If a recipient phone number has DND configuration active (common on MTN and Telecel), the carriers reject delivery. You will still be charged for the routing resources.
                            </li>
                            <li>
                              <strong className="text-zinc-800">KYC Status:</strong> Telecommunications regulations require a fully validated and approved Arkesel customer identity profile before routing live traffic.
                            </li>
                          </ul>
                        </div>
                      </>
                    )}

                    {configForm.provider === "custom" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Endpoint Webhook API URL</Label>
                          <Input
                            placeholder="e.g. https://api.mysmsengine.com/send"
                            type="url"
                            value={configForm.customUrl}
                            onChange={(e) => setConfigForm({ ...configForm, customUrl: e.target.value })}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">HTTP Method</Label>
                            <Select
                              value={configForm.customMethod}
                              onValueChange={(v) => setConfigForm({ ...configForm, customMethod: v })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="POST">POST (JSON Body)</SelectItem>
                                <SelectItem value="GET">GET (Query Params)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">API Secret Key (Optional)</Label>
                            <Input
                              type="password"
                              placeholder="For authorization headers"
                              value={configForm.apiKey}
                              onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Required Headers (JSON)</Label>
                          <textarea
                            className="w-full min-h-[50px] font-mono text-[10px] p-2 border rounded-md"
                            value={configForm.customHeadersJson}
                            onChange={(e) => setConfigForm({ ...configForm, customHeadersJson: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Request Body Template / Template Map</Label>
                          <textarea
                            className="w-full min-h-[70px] font-mono text-[10px] p-2 border rounded-md"
                            value={configForm.customBodyJson}
                            onChange={(e) => setConfigForm({ ...configForm, customBodyJson: e.target.value })}
                          />
                          <p className="text-[8px] text-rose-500 font-bold mt-1 leading-normal">
                            Interpolates: {"{{to}}"} (phone number), {"{{message}}"} (URLencoded text), {"{{sender}}"} (SenderID)
                          </p>
                        </div>
                      </>
                    )}

                    <DialogFooter className="pt-2">
                      <Button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-slate-900 font-bold uppercase tracking-wider text-xs h-11 text-white"
                      >
                        {editingConfigId ? "Update Configuration" : "Save Connection Profile"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                Saved Connections
              </div>
              {smsConfigsList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 italic text-xs border border-dashed rounded-xl border-slate-205">
                  No SMS Gateway profiles created yet. Use 'Add Profile' to link one.
                </div>
              ) : (
                <div className="space-y-3">
                  {smsConfigsList.map((c) => {
                    const isPastor = profile?.role === "pastor";
                    const activeLink = isPastor
                      ? profile?.staffData?.assignedBranchId || "central"
                      : "central";
                    const isLinkedToMe = c.branchId === activeLink;

                    // Try to look up linked branch name if it's connected to a branch
                    let linkLabel = "Draft / Unlinked";
                    if (c.branchId === "central") {
                      linkLabel = "Linked: HQ Broadcast";
                    } else if (c.branchId && c.branchId !== "unlinked") {
                      const b = branches.find((branch) => branch.id === c.branchId);
                      linkLabel = `Linked: ${b ? b.name : c.branchId}`;
                    }

                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all flex flex-col gap-2.5",
                          isLinkedToMe
                            ? "border-emerald-200 bg-emerald-50/15"
                            : "border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                              {c.name}
                              {isLinkedToMe && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <div className="flex gap-2 items-center text-[9px] font-bold uppercase text-slate-400">
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-mono">
                                {c.provider}
                              </span>
                              <span>
                                Sender:{" "}
                                <strong className="font-mono text-slate-650">
                                  {c.senderId || "N/A"}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <span
                            className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider",
                              isLinkedToMe
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600",
                            )}
                          >
                            {linkLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/60 font-medium">
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingConfigId(c.id);
                                setConfigForm({
                                  name: c.name || "Unnamed Gateway",
                                  provider: c.provider || "twilio",
                                  apiKey: c.apiKey || "",
                                  apiSecret: c.apiSecret || "",
                                  senderId: c.senderId || "",
                                  customUrl: c.customUrl || "",
                                  customMethod: c.customMethod || "POST",
                                  customBodyJson: c.customBodyJson || '{\n  "recipient": "{{to}}",\n  "message": "{{message}}",\n  "sender": "{{sender}}"\n}',
                                  customHeadersJson: c.customHeadersJson || '{\n  "Content-Type": "application/json"\n}',
                                });
                                setIsConfigModalOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteConfig(c.id)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            {(c.provider === "arkasel" || c.provider === "arkesel") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenTestModal(c)}
                                className="h-7 px-2 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:bg-indigo-50/50 flex items-center gap-1 rounded"
                                title="Run manual connectivity and delivery tracer diagnostics for Arkesel"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> Test API Connection
                              </Button>
                            )}
                          </div>

                          {isLinkedToMe ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlinkConfig(c.id)}
                              className="h-7 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 py-0 px-2 gap-1 rounded border-slate-200"
                            >
                              <Unlink className="w-3 h-3 text-slate-400" /> Unlink
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={() => handleLinkConfig(c.id)}
                              className="h-7 text-[9px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white py-0 px-2.5 gap-1 rounded"
                            >
                              <Link2 className="w-3.5 h-3.5 shrink-0" /> Link/Activate
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                <p className="text-[11px] text-slate-500 leading-snug">
                  Multiple configurations allow you to configure independent keys for specific branches
                  or sub-ministries.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full mt-1.5 shrink-0"></div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Simply click <span className="font-bold text-indigo-600">Link/Activate</span> to link any
                  credential profile to your current level instantly.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full mt-1.5 shrink-0"></div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Keep messages under <span className="font-bold text-slate-900">160 characters</span> to
                  avoid multi-page billing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Arkesel Connectivity Diagnostic Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-0">
          <DialogHeader className="bg-slate-50 border-b border-zinc-100 px-6 py-4">
            <DialogTitle className="text-sm font-black uppercase text-indigo-950 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              Arkesel v2 API Diagnostics Suite
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manually test endpoint routing, format validation, and trace cellular carrier response logs for <strong>{testSelectedConfig?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Parameters Overview */}
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-100/90 rounded-xl text-xs">
              <div>
                <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-0.5">Integration Token (v2 Key)</span>
                <code className="text-[11px] font-mono text-indigo-800">
                  {testSelectedConfig?.apiKey ? (
                    testSelectedConfig.apiKey.length > 8 
                      ? `${testSelectedConfig.apiKey.substring(0, 4)}......${testSelectedConfig.apiKey.substring(testSelectedConfig.apiKey.length - 4)}` 
                      : "****"
                  ) : "Missing"}
                </code>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-0.5">Target Provider</span>
                <span className="font-semibold uppercase text-slate-700 font-mono text-[11px]">{testSelectedConfig?.provider}</span>
              </div>
            </div>

            {/* Test Arguments Input form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-slate-650">Approved Sender ID (Ghana Carriers)</Label>
                  <Input
                    placeholder="e.g. ECCLESIA"
                    maxLength={11}
                    value={testSenderId}
                    onChange={(e) => setTestSenderId(e.target.value)}
                  />
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    Must match an approved, whitelisted Sender ID on your Arkesel dashboard. letters/numbers only, max 11 chars.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-slate-655">Test Recipient Phone #</Label>
                  <Input
                    placeholder="e.g. 0241234567 or 233241234567"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    Enter the phone number of a test device to receive the connectivity diagnostic SMS.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-655">Test Message Payload</Label>
                <textarea
                  className="w-full text-xs p-3 border rounded-xl font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  rows={2}
                  maxLength={160}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Type a custom query text..."
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                  <span>Standard 1-page limits is 160 characters</span>
                  <span>{testMessage.length}/160</span>
                </div>
              </div>
            </div>

            {/* Execution Trace */}
            {testLogs.length > 0 && (
              <div className="space-y-2.5">
                <Label className="text-[10px] uppercase font-black text-slate-500 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-550 animate-pulse"></span>
                  Chronological Diagnostic Execution Log
                </Label>
                <div className="p-3 bg-zinc-950 rounded-xl font-mono text-[11px] text-zinc-300 space-y-2 border border-zinc-900 max-h-[160px] overflow-y-auto">
                  {testLogs.map((log, idx) => {
                    const statusColors = {
                      info: "text-blue-400",
                      success: "text-emerald-400 font-semibold",
                      warning: "text-amber-400 font-semibold",
                      error: "text-rose-400 font-bold"
                    }[log.status as "info" | "success" | "warning" | "error"] || "text-zinc-400";

                    const icon = {
                      info: "ℹ️",
                      success: "✅",
                      warning: "⚠️",
                      error: "❌"
                    }[log.status as "info" | "success" | "warning" | "error"] || "•";

                    return (
                      <div key={idx} className="leading-snug">
                        <span className="text-zinc-500">[{idx+1}]</span>{" "}
                        <span className={statusColors}>{icon} {log.step}:</span>{" "}
                        <span className="text-zinc-200">{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Diagnosis Summary */}
            {testDiagnosis && (
              <div className={cn(
                "p-4 border rounded-xl space-y-2 text-left",
                testSuccess 
                  ? "bg-emerald-50/20 border-emerald-200/50 text-emerald-950" 
                  : "bg-amber-50/20 border-amber-200/50 text-amber-950"
              )}>
                <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-1.5">
                  {testSuccess ? (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">INFO PASSED</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">DIAGNOSTICS TRIGGERED</span>
                  )}
                  Diagnostic Findings Summary
                </h4>
                <div className="text-[11px] leading-relaxed whitespace-pre-line text-slate-700 font-medium">
                  {testDiagnosis}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 border-t border-zinc-100 px-6 py-4 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={testRunning}
              onClick={() => setIsTestModalOpen(false)}
              className="px-4 text-xs font-semibold hover:bg-white border-slate-200"
            >
              Close Diagnostic Suite
            </Button>
            <Button
              type="button"
              disabled={testRunning}
              onClick={handleRunConnectivityTest}
              className="bg-indigo-600 hover:bg-zinc-900 text-white px-5 text-xs font-bold uppercase tracking-wider h-10 shrink-0"
            >
              {testRunning ? "Spawning Trace..." : "Run Connectivity Diagnostic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
