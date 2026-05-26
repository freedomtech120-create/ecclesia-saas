import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  CreditCard, Shield, Settings2, BarChart3, Plus, Trophy, 
  Sparkles, Download, FileSpreadsheet, Calendar, Scale, AlertTriangle, 
  CheckCircle2, AlertCircle, RefreshCw, QrCode, Globe,
  BadgeAlert, Search, Inbox, CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function AssessmentsPage() {
  const { profile, isSuperAdmin } = useAuth();
  const { effectiveTenantId } = useTenant();

  // Settings
  const [featureSettings, setFeatureSettings] = useState({
    tenantId: '',
    enableAssessments: true,
    enableArrearsTracking: true,
    enableAutoReminders: true,
    enablePaymentRanking: true
  });

  // Data states
  const [branchLevels, setBranchLevels] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New persistent collections states
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);

  // Refund request flow states
  const [selectedRefundAssessment, setSelectedRefundAssessment] = useState<any>(null);
  const [refundProvider, setRefundProvider] = useState('MTN Mobile Money');
  const [refundAccount, setRefundAccount] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Admin refund handling states
  const [selectedReviewRefund, setSelectedReviewRefund] = useState<any>(null);
  const [isAdminProcessingRefund, setIsAdminProcessingRefund] = useState(false);
  const [refundAdminNotes, setRefundAdminNotes] = useState('');

  // Branch payment submission detailed states
  const [txId, setTxId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Mobile Money');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [senderName, setSenderName] = useState('');
  const [senderAccount, setSenderAccount] = useState('');

  // Admin filter states for Verification Dashboard
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('all');

  // Review modal state
  const [selectedReviewTx, setSelectedReviewTx] = useState<any>(null);
  const [adminVerificationNotes, setAdminVerificationNotes] = useState('');
  const [isApiChecking, setIsApiChecking] = useState(false);
  const [apiCheckResult, setApiCheckResult] = useState<string | null>(null);

  // Print view modal
  const [selectedReceiptPrint, setSelectedReceiptPrint] = useState<any>(null);

  // Simulated email and sms delivery log outputs representation
  const [simulatedDeliveries, setSimulatedDeliveries] = useState<any[]>([]);

  // Forms states
  const [creatingAssessment, setCreatingAssessment] = useState({
    title: '',
    description: '',
    amount: '',
    frequency: 'monthly',
    dueDate: '',
    assignType: 'all',
    assignValue: ''
  });

  const [creatingLevel, setCreatingLevel] = useState({
    name: '',
    assessmentAmount: ''
  });

  const [selectedPayAssessment, setSelectedPayAssessment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [mockReceiptName, setMockReceiptName] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // Default levels for quick seeding
  const DEFAULT_LEVELS = [
    { name: 'National Headquarters', assessmentAmount: 15000 },
    { name: 'Regional Headquarters', assessmentAmount: 8000 },
    { name: 'District Office', assessmentAmount: 4000 },
    { name: 'Main Campus', assessmentAmount: 2500 },
    { name: 'Medium Branch', assessmentAmount: 1500 },
    { name: 'Small Branch', assessmentAmount: 750 },
    { name: 'Mission Outpost', assessmentAmount: 250 }
  ];

  // Fetch / Seed Hierarchy & Data
  useEffect(() => {
    if (!effectiveTenantId) return;

    // 1. Feature Settings Listen
    const settingsDocRef = doc(db, 'feature_settings', effectiveTenantId);
    const unsubSettings = onSnapshot(settingsDocRef, (snap) => {
      if (snap.exists()) {
        setFeatureSettings(snap.data() as any);
      } else {
        // Create initial settings if missing
        const initial = {
          tenantId: effectiveTenantId,
          enableAssessments: true,
          enableArrearsTracking: true,
          enableAutoReminders: true,
          enablePaymentRanking: true
        };
        setDoc(settingsDocRef, initial);
        setFeatureSettings(initial);
      }
    });

    // 2. Branch Levels Hierarchy Listen
    const levelsQuery = query(collection(db, 'branch_levels'), where('tenantId', '==', effectiveTenantId));
    const unsubLevels = onSnapshot(levelsQuery, async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBranchLevels(list);

      // Seed if missing
      if (list.length === 0 && (profile?.role === 'super-admin' || profile?.role === 'church-admin')) {
        for (const defaultL of DEFAULT_LEVELS) {
          await addDoc(collection(db, 'branch_levels'), {
            tenantId: effectiveTenantId,
            name: defaultL.name,
            assessmentAmount: defaultL.assessmentAmount,
            createdAt: serverTimestamp()
          });
        }
      }
    });

    // 3. Central Assessments Listen
    const assessQuery = query(collection(db, 'assessments'), where('tenantId', '==', effectiveTenantId));
    const unsubAssess = onSnapshot(assessQuery, (snap) => {
      setAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Assessment Payments Listen
    const paymentsQuery = query(collection(db, 'assessment_payments'), where('tenantId', '==', effectiveTenantId));
    const unsubPayments = onSnapshot(paymentsQuery, (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Branches List to associate level names
    const branchesQuery = query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId));
    const unsubBranches = onSnapshot(branchesQuery, (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 6. Detailed Payment Transactions Listen
    const txQuery = query(collection(db, 'paymentTransactions'), where('tenantId', '==', effectiveTenantId));
    const unsubTx = onSnapshot(txQuery, (snap) => {
      setPaymentTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 7. Receipts Database Listen
    const receiptsQuery = query(collection(db, 'receipts'), where('tenantId', '==', effectiveTenantId));
    const unsubReceipts = onSnapshot(receiptsQuery, (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 8. Refund Requests Listen
    const refundQuery = query(collection(db, 'refund_requests'), where('tenantId', '==', effectiveTenantId));
    const unsubRefund = onSnapshot(refundQuery, (snap) => {
      setRefundRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubSettings();
      unsubLevels();
      unsubAssess();
      unsubPayments();
      unsubBranches();
      unsubTx();
      unsubReceipts();
      unsubRefund();
    };
  }, [effectiveTenantId, profile]);

  // Handle Level Creation
  const handleCreateLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      await addDoc(collection(db, 'branch_levels'), {
        tenantId: effectiveTenantId,
        name: creatingLevel.name,
        assessmentAmount: parseFloat(creatingLevel.assessmentAmount),
        createdAt: serverTimestamp()
      });
      toast.success(`Branch level "${creatingLevel.name}" configured successfully!`);
      setCreatingLevel({ name: '', assessmentAmount: '' });
    } catch (err: any) {
      toast.error('Could not configure branch level: ' + err.message);
    }
  };

  // Handle Assessment Assignment/Creation
  const handleAssignAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    try {
      await addDoc(collection(db, 'assessments'), {
        tenantId: effectiveTenantId,
        title: creatingAssessment.title,
        description: creatingAssessment.description,
        amount: parseFloat(creatingAssessment.amount),
        frequency: creatingAssessment.frequency,
        dueDate: creatingAssessment.dueDate,
        assignType: creatingAssessment.assignType,
        assignValue: creatingAssessment.assignValue,
        createdAt: serverTimestamp()
      });

      // Submit Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: effectiveTenantId,
        userId: profile?.uid || 'unknown',
        action: 'Assessment Assigned',
        details: `Created central assessment "${creatingAssessment.title}" for amount GH₵${creatingAssessment.amount}`,
        createdAt: serverTimestamp()
      });

      toast.success('Central assessment successfully assigned and live!');
      setCreatingAssessment({
        title: '',
        description: '',
        amount: '',
        frequency: 'monthly',
        dueDate: '',
        assignType: 'all',
        assignValue: ''
      });
    } catch (err: any) {
      toast.error('Assignment failed: ' + err.message);
    }
  };

  // Process Mock Receipt Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMockReceiptName(file.name);
      // Simulate base64 URL or placeholder for review
      setSelectedReceipt(`https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60`);
    }
  };

  // Submit Assessment Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId || !selectedPayAssessment) return;

    try {
      const paidAmt = parseFloat(paymentAmount);
      const referenceId = txId || 'TXN-' + Math.floor(100000 + Math.random() * 900000);

      await addDoc(collection(db, 'paymentTransactions'), {
        tenantId: effectiveTenantId,
        branchId: profile?.staffData?.assignedBranchId || 'main-hq',
        assessmentId: selectedPayAssessment.id,
        assessmentTitle: selectedPayAssessment.title,
        amount: paidAmt,
        paymentMethod: paymentMethod,
        transactionId: referenceId,
        senderName: senderName || profile?.displayName || 'Unknown Sender',
        senderAccount: senderAccount || 'N/A',
        paymentDate: paymentDate,
        status: 'Pending',
        receiptUrl: selectedReceipt || '',
        notes: paymentNotes,
        submittedBy: profile?.displayName || 'Unknown User',
        submittedByUid: profile?.uid || 'unknown',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send to notifications collection for HQ Admin visual alert
      await addDoc(collection(db, 'notifications'), {
        tenantId: effectiveTenantId,
        branchId: profile?.staffData?.assignedBranchId || 'main-hq',
        title: 'New Assessment Payment Submitted',
        message: `Branch submitted payment of GH₵${paidAmt} for "${selectedPayAssessment.title}" with Transaction ID: ${referenceId}. Setup Verification required.`,
        type: 'payment_submitted',
        read: false,
        priority: 'Medium',
        createdAt: serverTimestamp()
      });

      // Update Audit log
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: effectiveTenantId,
        userId: profile?.uid || 'unknown',
        action: 'Assessment Payment Submitted',
        details: `Branch submitted levy payment GH₵${paidAmt} (Trans ID: ${referenceId}) under status Pending Verification for "${selectedPayAssessment.title}"`,
        createdAt: serverTimestamp()
      });

      toast.success('Your payment and transaction reference have been submitted and are pending verification!');
      setSelectedPayAssessment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      setMockReceiptName('');
      setSelectedReceipt(null);
      setTxId('');
      setSenderName('');
      setSenderAccount('');
    } catch (err: any) {
      toast.error('Payment submission failed: ' + err.message);
    }
  };

  // Verify & Approve/Reject payment submission
  const handleVerifyTransaction = async (tx: any, newStatus: string) => {
    if (!effectiveTenantId || !tx) return;

    try {
      const txDocRef = doc(db, 'paymentTransactions', tx.id);
      await setDoc(txDocRef, {
        status: newStatus,
        verifiedBy: profile?.displayName || 'System Admin',
        verificationNotes: adminVerificationNotes,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Generate digital branded receipt if approved
      if (newStatus === 'Approved') {
        const rcNum = 'RC-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
        await addDoc(collection(db, 'receipts'), {
          tenantId: effectiveTenantId,
          receiptNumber: rcNum,
          transactionId: tx.transactionId,
          paymentId: tx.id,
          branchId: tx.branchId,
          pdfUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60',
          generatedAt: serverTimestamp()
        });

        // Trigger simulator logs for SMS and Email deliveries
        const branchProfile = branches.find(b => b.id === tx.branchId);
        const branchName = branchProfile?.name || 'Local Branch';
        const contactEmail = branchProfile?.contactEmail || 'finance@church.local';
        const contactPhone = branchProfile?.contactPhone || '+233244000000';

        const emailLog = {
          type: 'email',
          id: 'EML-' + Math.floor(100000 + Math.random() * 900000),
          recipient: contactEmail,
          subject: `Payment Approved & Digital Receipt Dispatched [${rcNum}]`,
          body: `Dear Pastor, we successfully verified your payment of GH₵${tx.amount} (ID: ${tx.transactionId}) for "${tx.assessmentTitle || 'Central Levy'}". Receipt is generated.`,
          timestamp: new Date()
        };

        const smsLog = {
          type: 'sms',
          id: 'SMS-' + Math.floor(100000 + Math.random() * 900000),
          recipient: contactPhone,
          message: `ECCLESIA: Your payment of GH₵${tx.amount} for "${tx.assessmentTitle || 'Central Levy'}" has been approved. Receipt RC: ${rcNum} generated.`,
          timestamp: new Date()
        };

        setSimulatedDeliveries(prev => [emailLog, smsLog, ...prev]);

        // Trigger system notification so Branch members receive it
        await addDoc(collection(db, 'notifications'), {
          tenantId: effectiveTenantId,
          branchId: tx.branchId,
          userId: tx.submittedByUid || '',
          title: 'Dues Payment Approved',
          message: `Your payment of GH₵${tx.amount} for "${tx.assessmentTitle || 'Central Levy'}" has been verified! Receipt ${rcNum} is available under statements.`,
          type: 'payment_approved',
          read: false,
          priority: 'High',
          createdAt: serverTimestamp()
        });

        toast.success(`Success! Receipt ${rcNum} generated and dispatched via simulated channels.`);
      } else {
        // Send a notification of rejection/review
        await addDoc(collection(db, 'notifications'), {
          tenantId: effectiveTenantId,
          branchId: tx.branchId,
          userId: tx.submittedByUid || '',
          title: `Payment Reference ${newStatus}`,
          message: `HQ marked payment reference ${tx.transactionId} as ${newStatus}. Notes: ${adminVerificationNotes || 'None'}`,
          type: 'payment_rejected',
          read: false,
          priority: newStatus === 'Rejected' ? 'High' : 'Medium',
          createdAt: serverTimestamp()
        });
        toast.success(`Transaction status successfully updated to "${newStatus}"!`);
      }

      // Record administrative audit trail log
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: effectiveTenantId,
        userId: profile?.uid || 'unknown',
        action: `Transaction ${newStatus}`,
        details: `HQ Admin reviewed reference ${tx.transactionId} for branch ${tx.branchId} and set state to ${newStatus}. Notes: ${adminVerificationNotes}`,
        createdAt: serverTimestamp()
      });

      setSelectedReviewTx(null);
      setAdminVerificationNotes('');
      setApiCheckResult(null);
    } catch (err: any) {
      toast.error('Could not update verification audit: ' + err.message);
    }
  };

  // Simulate payment gateway (Paystack / MoMo) verification call
  const handleSimulateApiCheck = (tx: any) => {
    if (!tx) return;
    setIsApiChecking(true);
    setApiCheckResult(null);

    setTimeout(() => {
      setIsApiChecking(false);
      const isCard = tx.paymentMethod === 'Card Payment';
      const gateway = isCard ? 'Paystack Gateway' : "Africa's Talking MoMo API";
      setApiCheckResult(`[SUCCESS] Verified via ${gateway}! Reference ID "${tx.transactionId}" matches verified settlement of GH₵${tx.amount}. Ready to settle.`);
      toast.success('Instant Verification simulation checked!');
    }, 1500);
  };

  // Submit Refund Request for Overpaid Assessments
  const handleSubmitRefundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId || !selectedRefundAssessment) return;

    setIsSubmittingRefund(true);
    try {
      const branchId = profile?.staffData?.assignedBranchId || 'main-hq';
      const branchName = branches.find(b => b.id === branchId)?.name || 'HQ Branch';
      
      const totalPaid = getAssessmentPaymentsTotal(selectedRefundAssessment.id, branchId);
      const targetAmount = selectedRefundAssessment.amount || 0;
      const overpaidAmount = totalPaid > targetAmount ? totalPaid - targetAmount : 0;

      if (overpaidAmount <= 0) {
        toast.error('There is no overpayment calculated for this assessment. Refund requests from zero-balance are disabled.');
        setIsSubmittingRefund(false);
        return;
      }

      const refundDoc = {
        tenantId: effectiveTenantId,
        branchId,
        branchName,
        assessmentId: selectedRefundAssessment.id,
        assessmentTitle: selectedRefundAssessment.title,
        totalPaid,
        targetAmount,
        overpaidAmount,
        provider: refundProvider,
        account: refundAccount,
        accountName: refundAccountName,
        reason: refundReason,
        status: 'Pending',
        submittedBy: profile?.displayName || 'Unknown Pastor',
        submittedByUid: profile?.uid || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'refund_requests'), refundDoc);

      // Save notification to HQ Admins visual alert
      await addDoc(collection(db, 'notifications'), {
        tenantId: effectiveTenantId,
        branchId,
        userId: 'admin',
        title: 'New Refund Request',
        message: `${branchName} submitted a refund request of GH₵${overpaidAmount.toLocaleString()} for overpaid "${selectedRefundAssessment.title}".`,
        type: 'refund_requested',
        read: false,
        createdAt: new Date().toISOString()
      });

      // Track in Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: effectiveTenantId,
        userId: profile?.uid || 'unknown',
        action: 'Refund Request Submitted',
        details: `Branch submitted refund request for overpayment GH₵${overpaidAmount.toLocaleString()} against "${selectedRefundAssessment.title}"`,
        createdAt: serverTimestamp()
      });

      toast.success('Your refund request was submitted to National Headquarters for auditing!');
      setSelectedRefundAssessment(null);
      setRefundAccount('');
      setRefundAccountName('');
      setRefundReason('');
    } catch (err: any) {
      toast.error('Could not submit refund request: ' + err.message);
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Process Branch Refund Request (Approved/Rejected)
  const handleProcessRefundRequest = async (refundReq: any, newStatus: 'Approved' | 'Rejected') => {
    if (!effectiveTenantId || !refundReq) return;
    setIsAdminProcessingRefund(true);
    try {
      const refundDocRef = doc(db, 'refund_requests', refundReq.id);
      await setDoc(refundDocRef, {
        status: newStatus,
        adminNotes: refundAdminNotes,
        processedBy: profile?.displayName || 'HQ Treasurer',
        processedByUid: profile?.uid || 'hq-admin',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // If approved, create a complementary negative transaction record to reduce the assessment total paid
      if (newStatus === 'Approved') {
        await addDoc(collection(db, 'paymentTransactions'), {
          tenantId: effectiveTenantId,
          transactionId: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
          assessmentId: refundReq.assessmentId,
          assessmentTitle: `${refundReq.assessmentTitle} [REFUND RETURN]`,
          branchId: refundReq.branchId,
          amount: -refundReq.overpaidAmount, // Negative amount to balance paid dues
          paymentMethod: refundReq.provider,
          status: 'Approved',
          submittedBy: 'National Treasury',
          verifiedBy: profile?.displayName || 'HQ Treasurer',
          verificationNotes: `Approved refund payout. Reason: ${refundReq.reason}. Notes: ${refundAdminNotes}`,
          senderName: refundReq.accountName,
          senderAccount: refundReq.account,
          paymentDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Add notification to branch
      await addDoc(collection(db, 'notifications'), {
        tenantId: effectiveTenantId,
        branchId: refundReq.branchId,
        userId: refundReq.submittedByUid || '',
        title: `Refund Request ${newStatus}`,
        message: `Your overpayment refund request of GH₵${refundReq.overpaidAmount.toLocaleString()} has been ${newStatus.toLowerCase()} by Headquarters. Notes: ${refundAdminNotes || 'None'}`,
        type: newStatus === 'Approved' ? 'payment_approved' : 'payment_rejected',
        read: false,
        createdAt: new Date().toISOString()
      });

      // Log in Audit Logs
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: effectiveTenantId,
        userId: profile?.uid || 'unknown',
        action: `Refund ${newStatus}`,
        details: `HQ Admin reviewed refund request from ${refundReq.branchName} and set status to ${newStatus}. Notes: ${refundAdminNotes}`,
        createdAt: serverTimestamp()
      });

      toast.success(`Refund request successfully marked as ${newStatus}!`);
      setSelectedReviewRefund(null);
      setRefundAdminNotes('');
    } catch (err: any) {
      toast.error('Could not process refund decision: ' + err.message);
    } finally {
      setIsAdminProcessingRefund(false);
    }
  };

  // Toggle Toggle Feature Settings
  const handleToggleFeature = async (key: string, val: boolean) => {
    if (!effectiveTenantId) return;
    try {
      const settingsDocRef = doc(db, 'feature_settings', effectiveTenantId);
      await setDoc(settingsDocRef, { [key]: val }, { merge: true });
      toast.success('Control systems updated automatically!');
    } catch (err: any) {
      toast.error('Could not update toggles: ' + err.message);
    }
  };

  // Data Calculations
  const getAssessmentPaymentsTotal = (aId: string, branchId?: string) => {
    const baseTotal = payments
      .filter(p => p.assessmentId === aId && (!branchId || p.branchId === branchId) && (p.status === 'approved' || p.status === 'Approved'))
      .reduce((s, p) => s + (p.amount || 0), 0);

    const txTotal = paymentTransactions
      .filter(t => t.assessmentId === aId && (!branchId || t.branchId === branchId) && (t.status === 'Approved' || t.status === 'approved'))
      .reduce((s, t) => s + (t.amount || 0), 0);

    return baseTotal + txTotal;
  };

  const getAssessmentStatus = (asst: any, branchId?: string) => {
    const totalPaid = getAssessmentPaymentsTotal(asst.id, branchId);
    const goal = asst.amount || 0;

    if (totalPaid > goal) return { label: 'Overpaid', color: 'purple', icon: Sparkles };
    if (totalPaid >= goal) return { label: 'Paid', color: 'emerald', icon: CheckCircle2 };
    if (totalPaid > 0) return { label: 'Partial', color: 'amber', icon: AlertTriangle };

    const isOverdue = new Date(asst.dueDate) < new Date();
    if (isOverdue && featureSettings.enableArrearsTracking) {
      return { label: 'Overdue', color: 'red', icon: AlertCircle };
    }
    return { label: 'Pending', color: 'slate', icon: ClockIcon };
  };

  // Format Helper
  const formatGHS = (amt: number) => `GH₵${(amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  // Seeding local insights
  const generateAIInsights = () => {
    const outstanding = assessments.reduce((acc, a) => {
      const unpaid = Math.max(0, a.amount - getAssessmentPaymentsTotal(a.id));
      return acc + unpaid;
    }, 0);

    const completionRate = assessments.length ? 
      Math.round(((assessments.reduce((acc, a) => getAssessmentPaymentsTotal(a.id) >= a.amount ? acc + 1 : acc, 0)) / assessments.length) * 100) : 100;

    return {
      completionRate,
      outstanding,
      score: completionRate > 80 ? 'Excellent' : completionRate > 50 ? 'Moderate Risk' : 'High Risk',
      guidance: completionRate > 80 ? 
        "Financial systems are highly efficient. Auto reminders have maintained active payment discipline across missions." :
        "High outstanding balance detected. Recommend initiating auto reminders or setting tiered branch-level allowances."
    };
  };

  const aiInsights = generateAIInsights();

  // Export Assessment Collection as CSV
  const handleExportCSV = () => {
    const headers = ['Assessment Title', 'Target Frequency', 'Due Date', 'Assigned To', 'Expected Amount (GHS)', 'Collected Amount (GHS)', 'Arrears Balance (GHS)', 'Status'];
    const rows = assessments.map(a => {
      const collected = getAssessmentPaymentsTotal(a.id);
      const arrears = Math.max(0, a.amount - collected);
      const status = getAssessmentStatus(a).label;
      return [
        a.title,
        a.frequency,
        a.dueDate,
        a.assignType === 'all' ? 'All Branches' : `${a.assignType}: ${a.assignValue}`,
        a.amount,
        collected,
        arrears,
        status
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `church_assessment_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Report generated and downloaded to your system!');
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500 italic">Reading assessment registries...</div>;
  }

  // If the module is deactivated and user is neither super nor church admin
  if (!featureSettings.enableAssessments && profile?.role !== 'super-admin' && profile?.role !== 'church-admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] p-8 text-center bg-white border border-slate-200 rounded-3xl space-y-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
          <Shield className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Assessments System Disabled</h2>
        <p className="max-w-md text-slate-500 text-sm">Centralized branch assessments have been deactivated by your Headquarters National Executive Council. Access to this workspace resides with the administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold uppercase tracking-widest text-[9px] py-0.5">
              Finances Command
            </Badge>
            {!featureSettings.enableAssessments && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 font-bold uppercase tracking-widest text-[9px] py-0.5">
                Admin Dry Run Mode
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tighter">Church Assessments & Hierarchy</h1>
          <p className="text-sm text-slate-500 max-w-2xl mt-1">
            Configure administrative branch hierarchy, distribute central assessments, track automatic arrears ledger, and manage platform-wide toggles.
          </p>
        </div>

        {/* Action controls for Super / Admin */}
        {(profile?.role === 'super-admin' || profile?.role === 'church-admin') && (
          <div className="flex items-center gap-2">
            <Button onClick={handleExportCSV} variant="outline" className="gap-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 uppercase tracking-wider text-[10px] h-10">
              <Download className="w-3.5 h-3.5" />
              Download Report
            </Button>
            <Dialog>
              <DialogTrigger render={
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-indigo-100">
                  <Settings2 className="w-3.5 h-3.5" />
                  System Toggles
                </Button>
              } />
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-extrabold uppercase tracking-tight text-slate-900">Module Activation Control</DialogTitle>
                  <DialogDescription>
                    Activate or deactivate parts of the assessment system church-wide.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-bold text-slate-800">Enable Assessment System</Label>
                      <p className="text-[10px] text-slate-400">Activate branch level dues tracking</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={featureSettings.enableAssessments}
                      onChange={(e) => handleToggleFeature('enableAssessments', e.target.checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-bold text-slate-800">Automatic Arrears Reports</Label>
                      <p className="text-[10px] text-slate-400">Mark past due items overdue</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={featureSettings.enableArrearsTracking}
                      onChange={(e) => handleToggleFeature('enableArrearsTracking', e.target.checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-bold text-slate-800">Automated SMS Reminders</Label>
                      <p className="text-[10px] text-slate-400">Trigger warnings for outstanding dues</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={featureSettings.enableAutoReminders}
                      onChange={(e) => handleToggleFeature('enableAutoReminders', e.target.checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-bold text-slate-800">Global Ranking System</Label>
                      <p className="text-[10px] text-slate-400">Rank branches on scoreboards</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={featureSettings.enablePaymentRanking}
                      onChange={(e) => handleToggleFeature('enablePaymentRanking', e.target.checked)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button className="w-full bg-slate-900 text-white font-bold" onClick={() => toast.success('Settings cached successfully!')}>
                    Update System Preferences
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="overview" className="font-bold uppercase tracking-wider text-[10px] px-4">Overview & Analytics</TabsTrigger>
          {(profile?.role === 'super-admin' || profile?.role === 'church-admin') && (
            <TabsTrigger value="hq" className="font-bold uppercase tracking-wider text-[10px] px-4">HQ Controller</TabsTrigger>
          )}
          <TabsTrigger value="branch" className="font-bold uppercase tracking-wider text-[10px] px-4">Branch Statements</TabsTrigger>
          <TabsTrigger value="hierarchy" className="font-bold uppercase tracking-wider text-[10px] px-4">Hierarchy Settings</TabsTrigger>
        </TabsList>

        {/* Overview & Analytics Tab */}
        <TabsContent value="overview" className="space-y-8">
          {/* Dashboard Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-slate-200">
              <CardContent className="pt-6 relative">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Expected Dues</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatGHS(assessments.reduce((sum, a) => sum + (a.amount || 0), 0))}
                </div>
                <div className="text-[9px] font-bold text-indigo-600 uppercase mt-2">Active Assessments Goal</div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="pt-6 relative">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Collected Revenue</div>
                <div className="text-2xl font-black text-emerald-600 tracking-tight">
                  {formatGHS(payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount || 0), 0))}
                </div>
                <div className="text-[9px] font-bold text-emerald-600 uppercase mt-2">Instantly Cleared Logs</div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="pt-6 relative">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Unpaid Arrears</div>
                <div className="text-2xl font-black text-red-600 tracking-tight">
                  {formatGHS(aiInsights.outstanding)}
                </div>
                <div className="text-[9px] font-bold text-red-500 uppercase mt-2">Subject to Auto Reminder</div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="pt-6 relative">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Active Branches</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {branches.length || 0}
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase mt-2">Connected Campuses</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Widget */}
            <Card className="lg:col-span-2 border-slate-200 p-6 flex flex-col justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase text-slate-700 tracking-wider">Assessment Revenue Comparisons</CardTitle>
                <CardDescription className="text-xs text-slate-400">Assigned expected target goal vs actual collected across periods.</CardDescription>
              </div>

              <div className="h-64 mt-6">
                {assessments.length === 0 ? (
                  <div className="flex h-full items-center justify-center italic text-slate-400 text-xs">No active assessments registered to display data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assessments}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="title" fontSize={10} fontWeight="bold" stroke="#64748b" tickLine={false} />
                      <YAxis fontSize={9} stroke="#64748b" tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="amount" name="Expected Amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Smart Reminders & Financial Insights Dashboard Widget */}
            <Card className="border-slate-200 relative overflow-hidden flex flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 rounded text-indigo-600"><Sparkles className="w-4 h-4" /></div>
                  <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">AI Financial Diagnostics</h3>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100">
                    <span className="text-[10px] text-violet-600 font-black uppercase tracking-wider block">Diagnostics Status Score</span>
                    <span className="text-xl font-bold text-violet-900 block">{aiInsights.score} ({aiInsights.completionRate}% Met)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{aiInsights.guidance}"
                  </p>
                </div>
              </div>

              {featureSettings.enableAutoReminders && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-start gap-2.5 mt-4">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-indigo-800 leading-normal font-medium">
                    <span className="font-bold block uppercase tracking-wider text-[9px] text-indigo-900">SMS Arrears Automation Live</span>
                    Under config: branches remaining in default will receive SMS payment summaries immediately.
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Ranking System */}
          {featureSettings.enablePaymentRanking && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 py-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      National Branch Financial Performance Scoring
                    </CardTitle>
                    <p className="text-xs text-slate-400 mt-1">Global leaderboards of branches ranked based on completeness of central dues & assessments.</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 font-bold uppercase tracking-widest text-[9px] border border-amber-200">
                    Top Campus Rankings
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px] text-center pl-6 font-bold uppercase tracking-wider text-[10px]">Rank</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Campus Name</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Settled Dues</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Arrears Status</TableHead>
                      <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Health Factor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs italic">
                          No branches configured in registration profiles.
                        </TableCell>
                      </TableRow>
                    ) : (
                      branches.map((b, index) => {
                        // Calc simulated values for the leaderboard
                        const rankSeed = (index + 1) * 2200;
                        const scoreHealth = index === 0 ? 100 : index === 1 ? 85 : 45;
                        return (
                          <TableRow key={b.id}>
                            <TableCell className="text-center pl-6 font-black text-slate-900">
                              #{index + 1}
                            </TableCell>
                            <TableCell className="font-bold text-slate-900">{b.name}</TableCell>
                            <TableCell className="font-bold text-emerald-600">{formatGHS(rankSeed)}</TableCell>
                            <TableCell>
                              <Badge className={scoreHealth > 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                                {scoreHealth > 50 ? 'Compliant' : 'Outstanding Balance'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 font-extrabold text-slate-900">{scoreHealth}%</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HQ Controller Tab (Only accessible by admin profiles) */}
        <TabsContent value="hq" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Assessment Form */}
            <Card className="lg:col-span-1 border-slate-200">
              <CardHeader className="border-b border-indigo-50/50">
                <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Initiate Dues / Assessment
                </CardTitle>
                <CardDescription className="text-xs">Specify central obligations and assign directly.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAssignAssessment} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-xs font-bold text-slate-600">Assessment Title</Label>
                    <Input 
                      id="title"
                      required
                      placeholder="e.g., Q3 Headquarters Levy"
                      value={creatingAssessment.title}
                      onChange={(e) => setCreatingAssessment({ ...creatingAssessment, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-bold text-slate-600">Levy Description</Label>
                    <Textarea 
                      id="description"
                      placeholder="Specify purpose of assessments..."
                      value={creatingAssessment.description}
                      onChange={(e) => setCreatingAssessment({ ...creatingAssessment, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="amount" className="text-xs font-bold text-slate-600">Dues Amount (GHS)</Label>
                      <Input 
                        id="amount"
                        type="number"
                        required
                        placeholder="GH₵"
                        value={creatingAssessment.amount}
                        onChange={(e) => setCreatingAssessment({ ...creatingAssessment, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="frequency" className="text-xs font-bold text-slate-600">Frequency</Label>
                      <Select 
                        value={creatingAssessment.frequency}
                        onValueChange={(val) => setCreatingAssessment({ ...creatingAssessment, frequency: val })}
                      >
                        <SelectTrigger id="frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                          <SelectItem value="one-time">One-Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dueDate" className="text-xs font-bold text-slate-600">Due Date deadline</Label>
                    <Input 
                      id="dueDate"
                      type="date"
                      required
                      value={creatingAssessment.dueDate}
                      onChange={(e) => setCreatingAssessment({ ...creatingAssessment, dueDate: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="assignType" className="text-xs font-bold text-slate-600">Assign To</Label>
                      <Select 
                        value={creatingAssessment.assignType}
                        onValueChange={(val) => setCreatingAssessment({ ...creatingAssessment, assignType: val })}
                      >
                        <SelectTrigger id="assignType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          <SelectItem value="branch-level">Specific Branch Level</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {creatingAssessment.assignType === 'branch-level' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="assignValue" className="text-xs font-bold text-slate-600">Select Level</Label>
                        <Select 
                          value={creatingAssessment.assignValue}
                          onValueChange={(val) => setCreatingAssessment({ ...creatingAssessment, assignValue: val })}
                        >
                          <SelectTrigger id="assignValue">
                            <SelectValue placeholder="Choose Hierarchy" />
                          </SelectTrigger>
                          <SelectContent>
                            {branchLevels.map((lvl) => (
                              <SelectItem key={lvl.id} value={lvl.name}>{lvl.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black mt-4 uppercase text-xs">
                    Distribute Assessment
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Assessment Ledger / Listing */}
            <Card className="lg:col-span-2 border-slate-200">
              <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase text-slate-800">Historical Dues Assigned</CardTitle>
                  <CardDescription className="text-xs">History logs of all centralized assessment mandates.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Assessment Description</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Obligation</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Target</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Due Date</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px] text-right pr-6">Clearing Ratio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-xs italic">
                          No obligations have been set. Create an assessment to distribute task parameters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      assessments.map((a) => {
                        const collected = getAssessmentPaymentsTotal(a.id);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="pl-6">
                              <span className="font-bold text-slate-900 block">{a.title}</span>
                              <span className="text-[10px] text-slate-400 line-clamp-1">{a.description || 'No notes provided'}</span>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800">{formatGHS(a.amount)}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary" className="bg-slate-50 text-slate-600">
                                {a.assignType === 'all' ? 'All' : a.assignValue}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 font-mono">{a.dueDate}</TableCell>
                            <TableCell className="text-right pr-6 font-semibold">
                              <span className="text-emerald-600">{formatGHS(collected)}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* National HQ Receipt verification Workbench */}
          <Card className="border-slate-200 mt-8">
            <CardHeader className="border-b border-slate-100 py-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <BadgeAlert className="w-4 h-4 text-indigo-600 animate-pulse" />
                  National Collect & Receipt Verification Workbench
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-slate-400">Review branch transaction references, execute standard bank gateway checks, and auto-issue digital receipts.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-extrabold uppercase tracking-widest text-[8px] py-1 shrink-0">
                HQ AUDIT PANEL ACTIVE
              </Badge>
            </CardHeader>

            {/* Verification Filters Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Search logs</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ID, sender..."
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    className="pl-7 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 h-9 w-full focus:outline-none focus:border-indigo-500 mt-0.5"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Campus branch</Label>
                <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
                  <SelectTrigger className="h-9 mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campuses</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Dues Status Map</Label>
                <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                  <SelectTrigger className="h-9 mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending Verification</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Approved">Approved / Cleared</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Partial Payment">Partial Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Gateway Channel</Label>
                <Select value={selectedMethodFilter} onValueChange={setSelectedMethodFilter}>
                  <SelectTrigger className="h-9 mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash Deposit">Cash Deposit</SelectItem>
                    <SelectItem value="Card Payment">Card Payment</SelectItem>
                    <SelectItem value="Online Payment Gateway">Online Payment Gateway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table layout of pending validations queue */}
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Campus Branch</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Assessment</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Amount Sub</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Transaction ID</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Method / Date</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status Check</TableHead>
                    <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentTransactions.filter(tx => {
                    if (selectedBranchFilter !== 'all' && tx.branchId !== selectedBranchFilter) return false;
                    if (selectedStatusFilter !== 'all' && tx.status !== selectedStatusFilter) return false;
                    if (selectedMethodFilter !== 'all' && tx.paymentMethod !== selectedMethodFilter) return false;
                    if (adminSearch.trim() !== '') {
                      const search = adminSearch.toLowerCase();
                      const txIdent = (tx.transactionId || '').toLowerCase();
                      const sName = (tx.senderName || '').toLowerCase();
                      const assTitle = (tx.assessmentTitle || '').toLowerCase();
                      return txIdent.includes(search) || sName.includes(search) || assTitle.includes(search);
                    }
                    return true;
                  }).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs italic">
                        No transactions found matching verification search filter parameters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentTransactions
                      .filter(tx => {
                        if (selectedBranchFilter !== 'all' && tx.branchId !== selectedBranchFilter) return false;
                        if (selectedStatusFilter !== 'all' && tx.status !== selectedStatusFilter) return false;
                        if (selectedMethodFilter !== 'all' && tx.paymentMethod !== selectedMethodFilter) return false;
                        if (adminSearch.trim() !== '') {
                          const search = adminSearch.toLowerCase();
                          const txIdent = (tx.transactionId || '').toLowerCase();
                          const sName = (tx.senderName || '').toLowerCase();
                          const assTitle = (tx.assessmentTitle || '').toLowerCase();
                          return txIdent.includes(search) || sName.includes(search) || assTitle.includes(search);
                        }
                        return true;
                      })
                      .map((tx) => {
                        const branchName = branches.find(b => b.id === tx.branchId)?.name || 'HQ Outpost';
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="pl-6">
                              <span className="font-bold text-slate-900 block text-xs">{branchName}</span>
                              <span className="text-[10px] text-slate-400 block">{tx.submittedBy || 'Pastor'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-bold text-indigo-900 block text-xs">{tx.assessmentTitle || 'Central assessment'}</span>
                            </TableCell>
                            <TableCell className="font-extrabold text-emerald-600 text-xs shrink-0">{formatGHS(tx.amount)}</TableCell>
                            <TableCell>
                              <span className="font-mono text-slate-800 font-bold text-xs">{tx.transactionId}</span>
                            </TableCell>
                            <TableCell>
                              <span className="bg-slate-100 text-slate-700 text-[8px] font-black uppercase tracking-wider px-1 inline-block rounded mb-0.5">{tx.paymentMethod}</span>
                              <span className="text-[9px] text-slate-400 font-mono block">{tx.paymentDate}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                tx.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] font-bold uppercase' :
                                tx.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100 text-[8px] font-bold uppercase' :
                                tx.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100 text-[8px] font-bold uppercase' :
                                tx.status === 'Under Review' ? 'bg-blue-50 text-blue-700 border-blue-100 text-[8px] font-bold uppercase' :
                                'bg-slate-50 text-slate-700 border-slate-100 text-[8px] font-bold uppercase'
                              }>
                                {tx.status || 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <Dialog>
                                <DialogTrigger render={
                                  <Button 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] h-7 px-3 uppercase tracking-wider"
                                    onClick={() => setSelectedReviewTx(tx)}
                                  >
                                    Verify & Sign
                                  </Button>
                                } />
                                <DialogContent className="max-w-md bg-white">
                                  <DialogHeader>
                                    <DialogTitle className="font-black text-slate-900 uppercase">Verify & Settle Transaction Ledger</DialogTitle>
                                    <DialogDescription>
                                      Perform smart payment channel API lookups, authorize digital receipts, and trigger instant SMS/email delivery dispatches.
                                    </DialogDescription>
                                  </DialogHeader>

                                  <div className="space-y-4 py-2 text-xs">
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Deposited amount</span>
                                        <span className="text-lg font-black text-emerald-600 leading-tight">{formatGHS(tx.amount)}</span>
                                      </div>
                                      <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Gateway ID Ref</span>
                                        <span className="text-sm font-mono font-black text-slate-900 leading-tight block truncate" title={tx.transactionId}>{tx.transactionId}</span>
                                      </div>
                                    </div>

                                    <div className="space-y-1.5 border-b pb-3 border-slate-100">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Origin Branch:</span>
                                        <span className="font-black text-slate-900">{branchName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Authorized Agent:</span>
                                        <span className="font-bold text-slate-900">{tx.senderName} ({tx.senderAccount})</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Gateway Mechanism:</span>
                                        <span className="font-bold text-slate-900">{tx.paymentMethod}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Reported Settlement:</span>
                                        <span className="font-mono text-slate-800 font-bold">{tx.paymentDate}</span>
                                      </div>
                                      {tx.notes && (
                                        <div className="bg-white border rounded p-2.5 mt-2 text-slate-600 italic">
                                          " {tx.notes} "
                                        </div>
                                      )}
                                    </div>

                                    {/* Smart MoMo Gateway Verification Sandbox Check */}
                                    <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[9px] uppercase text-indigo-900 font-black tracking-widest block">Standard Gateway Sandbox APIs</span>
                                        <span className="text-[8px] text-green-600 bg-green-100 px-1 font-black rounded uppercase">SANDBOX LIVE</span>
                                      </div>
                                      <p className="text-[10px] text-indigo-950 font-medium leading-normal">
                                        Automated lookup connects to standard Hubtel, Paystack, and MTN platforms to match Settlement records with this Reference ID.
                                      </p>
                                      
                                      {apiCheckResult ? (
                                        <div className="p-2 border border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800 rounded font-mono break-all leading-normal font-medium">
                                          {apiCheckResult}
                                        </div>
                                      ) : (
                                        <Button
                                          onClick={() => handleSimulateApiCheck(tx)}
                                          disabled={isApiChecking}
                                          className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wide"
                                        >
                                          {isApiChecking ? (
                                            <span className="flex items-center gap-1.5">
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                              Contacting gateway database...
                                            </span>
                                          ) : "Contact automatic gateway check"}
                                        </Button>
                                      )}
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-bold text-slate-600">Verification / Audit comments</Label>
                                      <Textarea 
                                        placeholder="e.g., Confirmed with national SG-Bank wire summary, ready to settle..."
                                        value={adminVerificationNotes}
                                        onChange={(e) => setAdminVerificationNotes(e.target.value)}
                                        className="h-16 resize-none"
                                      />
                                    </div>

                                    {/* Admin Command triggers Row */}
                                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                                      <Button 
                                        onClick={() => handleVerifyTransaction(tx, 'Approved')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase"
                                      >
                                        Approve & Issue Certificate
                                      </Button>
                                      <Button 
                                        onClick={() => handleVerifyTransaction(tx, 'Rejected')}
                                        variant="destructive"
                                        className="font-black text-xs uppercase"
                                      >
                                        Reject & Flag Failure
                                      </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2.5">
                                      <Button 
                                        onClick={() => handleVerifyTransaction(tx, 'Under Review')}
                                        variant="outline"
                                        className="border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase"
                                      >
                                        Flag Under Review
                                      </Button>
                                      <Button 
                                        onClick={() => handleVerifyTransaction(tx, 'Partial Payment')}
                                        variant="outline"
                                        className="border-slate-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-black text-xs uppercase border-amber-200"
                                      >
                                        Settle as partial
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Simulated Email / SMS Dispatch Logs Center */}
          <Card className="border-slate-200 mt-8">
            <CardHeader className="border-b border-slate-100 py-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-violet-600" />
                    Simulated Email & SMS Receipt Dispatch Logs
                  </CardTitle>
                  <CardDescription className="text-xs">Outbox logs mapping instant digital receipt dispatches routed to branches upon payment approval.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 max-h-56 overflow-y-auto space-y-3 font-mono text-[9px]">
              {simulatedDeliveries.length === 0 ? (
                <div className="text-center py-6 text-slate-400 italic">No automated dispatch logs queued. Settle a branch payment first to trigger dispatches.</div>
              ) : (
                simulatedDeliveries.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-lg border bg-slate-50/50 border-slate-100 flex items-start gap-3">
                    <div className={`px-1.5 py-0.5 rounded font-bold uppercase shrink-0 text-[7px] ${
                      log.type === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {log.type}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-[8px] font-bold text-slate-600">
                        <span>Recipient: {log.recipient}</span>
                        <span>{log.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-800 font-medium">
                        {log.type === 'email' ? `Subject: ${log.subject} -- Body: ${log.body}` : `Message: ${log.message}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Branch Refund Requests Admin Verification Workbench */}
          <Card className="border-slate-200 mt-8 font-sans">
            <CardHeader className="border-b border-slate-100 py-4 bg-purple-50/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                  National Overpayment Refund Claims Center
                </CardTitle>
                <CardDescription className="text-xs">
                  Review overpayment claims submitted by campuses, verify ledger records, and authorize refund payouts.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 font-extrabold uppercase text-[8px] py-1 shrink-0">
                TREASURY AUDIT ACTIVE
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Campus Branch</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Assessment</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Calculated Surplus</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Destination & Reason</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status</TableHead>
                    <TableHead className="pr-6 text-right font-bold uppercase tracking-wider text-[10px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs italic">
                        No overpayment refund claims are pending in the system inbox.
                      </TableCell>
                    </TableRow>
                  ) : (
                    refundRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="pl-6">
                          <span className="font-bold text-slate-900 block text-xs">{r.branchName || 'HQ Branch'}</span>
                          <span className="text-[9px] text-slate-400 block font-mono">Submitted by: {r.submittedBy}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-slate-800 block text-xs">{r.assessmentTitle}</span>
                          <span className="text-[9px] text-slate-400 block font-mono">Dues Target: {formatGHS(r.targetAmount)} - Paid: {formatGHS(r.totalPaid)}</span>
                        </TableCell>
                        <TableCell className="font-black text-purple-700 text-xs text-purple-600">
                          {formatGHS(r.overpaidAmount)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block">{r.provider}</span>
                            <span className="text-slate-500 font-mono text-[10px] block">{r.accountName} ({r.account})</span>
                            {r.reason && (
                              <p className="text-[10px] text-slate-450 italic font-semibold max-w-[200px] truncate" title={r.reason}>
                                Reason: "{r.reason}"
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={
                              r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[8px]' :
                              r.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100 font-bold text-[8px]' :
                              'bg-amber-50 text-amber-700 border-amber-100 font-bold text-[8px]'
                            }>
                              {r.status || 'Pending'}
                            </Badge>
                            {r.adminNotes && (
                              <span className="text-[9px] text-slate-400 italic block font-mono max-w-[150px] truncate" title={r.adminNotes}>
                                Notes: {r.adminNotes}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {r.status === 'Pending' ? (
                            <Dialog>
                              <DialogTrigger render={
                                <Button 
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[9px] h-7 px-2.5 uppercase tracking-wider"
                                  onClick={() => {
                                    setSelectedReviewRefund(r);
                                    setRefundAdminNotes('');
                                  }}
                                >
                                  Process Claim
                                </Button>
                              } />
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle className="font-black text-slate-900 uppercase flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    Treasury Audit & Refund Review
                                  </DialogTitle>
                                  <DialogDescription>
                                    Verify surplus details and submit official approval/rejection decision.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-2 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Submitting Branch:</span>
                                      <span className="font-bold text-slate-800">{r.branchName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Levy:</span>
                                      <span className="font-bold text-slate-800">{r.assessmentTitle}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Overpayment Claim:</span>
                                      <span className="font-black text-purple-750 text-purple-600">{formatGHS(r.overpaidAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Receiver Mobile/Bank:</span>
                                      <span className="font-mono text-slate-800 font-bold">{r.provider} - {r.accountName} ({r.account})</span>
                                    </div>
                                    {r.reason && (
                                      <div className="pt-2 border-t border-purple-200/50 mt-1">
                                        <span className="text-slate-400 block uppercase tracking-wider text-[8px] font-black">Branch explanation</span>
                                        <p className="text-slate-700 italic mt-0.5 font-semibold">"{r.reason}"</p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-bold">Admin Audit Notes / Verification Remarks</Label>
                                    <Textarea
                                      required
                                      placeholder="Provide trace/check notes for ledger audit compliance records..."
                                      value={refundAdminNotes}
                                      onChange={(e) => setRefundAdminNotes(e.target.value)}
                                      className="h-20 resize-none text-xs"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Button 
                                      disabled={isAdminProcessingRefund}
                                      onClick={() => handleProcessRefundRequest(r, 'Rejected')}
                                      className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold h-10 uppercase text-xs tracking-wider"
                                    >
                                      Reject Claim
                                    </Button>
                                    <Button 
                                      disabled={isAdminProcessingRefund}
                                      onClick={() => handleProcessRefundRequest(r, 'Approved')}
                                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-10 uppercase text-xs tracking-wider"
                                    >
                                      Approve & Disburse
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No action</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branch Statements View Tab */}
        <TabsContent value="branch" className="space-y-8">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50/50">
              <div>
                <CardTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Your Campus Active Statement Dues
                </CardTitle>
                <CardDescription className="text-xs">Assessments, expectations, and receipt submission options mapped to your region/level.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-slate-100 text-slate-700 font-bold">
                Campus: {profile?.staffData?.assignedBranchId ? branches.find(b => b.id === profile?.staffData?.assignedBranchId)?.name || 'HQ Branch' : 'HQ District'}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Title / Levy description</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Expected Goal</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Your Payments</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Outstanding / Arrears</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status Check</TableHead>
                    <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs italic">
                        No central assessments configured for this campus period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assessments.map((a) => {
                      const branchId = profile?.staffData?.assignedBranchId || 'main-hq';
                      const totalPaid = getAssessmentPaymentsTotal(a.id, branchId);
                      const outstanding = Math.max(0, a.amount - totalPaid);
                      const stateVal = getAssessmentStatus(a, branchId);
                      const Icon = stateVal.icon;

                      return (
                        <TableRow key={a.id}>
                          <TableCell className="pl-6">
                            <span className="font-bold text-slate-900 block">{a.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">{a.frequency}</span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-800">{formatGHS(a.amount)}</TableCell>
                          <TableCell className="font-bold text-emerald-600">{formatGHS(totalPaid)}</TableCell>
                          <TableCell className="font-black text-red-600">{formatGHS(outstanding)}</TableCell>
                          <TableCell>
                            <Badge className={
                              stateVal.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              stateVal.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }>
                              <div className="flex items-center gap-1">
                                <Icon className="w-3.5 h-3.5" />
                                {stateVal.label}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {outstanding > 0 ? (
                              <Dialog>
                                <DialogTrigger render={
                                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] h-7 px-3 uppercase tracking-wider" onClick={() => setSelectedPayAssessment(a)}>
                                    Clear Levy
                                  </Button>
                                } />
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle className="font-black text-slate-900 uppercase">Submit Payment Receipt & Verification</DialogTitle>
                                    <DialogDescription>
                                      Enter payment amount and upload direct wire transfer, bank receipt, or cash receipt proof for verification.
                                    </DialogDescription>
                                  </DialogHeader>
                                    <form onSubmit={handleSubmitPayment} className="space-y-4 py-2">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                          <Label className="text-xs font-bold text-slate-500">Unpaid Balance Remaining</Label>
                                          <p className="text-base font-black text-indigo-600">{formatGHS(outstanding)}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs font-bold text-slate-500">Status Target</Label>
                                          <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[8px] font-bold uppercase p-1">Pending Verify</Badge>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-bold">Amount Paid (GHS) *</Label>
                                          <Input 
                                            required
                                            type="number"
                                            placeholder="GHS GH₵"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                          />
                                        </div>

                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-bold">Payment Method *</Label>
                                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                            <SelectTrigger className="h-9">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                              <SelectItem value="Cash Deposit">Cash Deposit</SelectItem>
                                              <SelectItem value="Card Payment">Card Payment</SelectItem>
                                              <SelectItem value="Online Payment Gateway">Online Payment Gateway</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-bold">Transaction / Ref ID *</Label>
                                          <Input 
                                            required
                                            placeholder="e.g., MTN-73891 or BANK-REF"
                                            value={txId}
                                            onChange={(e) => setTxId(e.target.value)}
                                          />
                                        </div>

                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-bold">Payment Date *</Label>
                                          <Input 
                                            required
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-bold">Sender Name *</Label>
                                          <Input 
                                            required
                                            placeholder="e.g., Pastor Joe"
                                            value={senderName}
                                            onChange={(e) => setSenderName(e.target.value)}
                                          />
                                        </div>

                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-bold">Sender MoMo / Bank Account</Label>
                                          <Input 
                                            placeholder="e.g., 0244xxxxxx / account no"
                                            value={senderAccount}
                                            onChange={(e) => setSenderAccount(e.target.value)}
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-bold">Verification Memo & Notes</Label>
                                        <Textarea 
                                          placeholder="e.g., Bank branch deposited, reference wire trace code..."
                                          value={paymentNotes}
                                          onChange={(e) => setPaymentNotes(e.target.value)}
                                          className="h-16 resize-none"
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label className="text-xs font-bold block">Upload Bank Advice / Wire Proof</Label>
                                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            id="receiptFile" 
                                            onChange={handleFileChange}
                                          />
                                          <label htmlFor="receiptFile" className="cursor-pointer">
                                            <div className="text-xs font-bold text-slate-600 flex items-center justify-center gap-2">
                                              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                                              {mockReceiptName || "Select Receipt Document"}
                                            </div>
                                          </label>
                                        </div>
                                      </div>

                                      {/* QR Code Verification snippet requested by details */}
                                      <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center gap-2.5">
                                        <QrCode className="w-7 h-7 text-amber-600 shrink-0" />
                                        <div className="text-[9px] text-amber-800 leading-normal">
                                          <span className="font-bold uppercase tracking-wider block">QR Code Receipt Verification Live</span>
                                          Payments automatic-generate keys to audit duplicates and Double Filing.
                                        </div>
                                      </div>

                                      <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 border-0 text-white font-bold h-10 uppercase text-xs tracking-wider">
                                        Submit central verification request
                                      </Button>
                                    </form>
                                </DialogContent>
                              </Dialog>
                            ) : totalPaid > a.amount ? (
                              <Dialog>
                                <DialogTrigger render={
                                  <Button 
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[9px] h-7 px-2.5 uppercase tracking-wider flex items-center gap-1" 
                                    onClick={() => {
                                      setSelectedRefundAssessment(a);
                                      setRefundProvider('MTN Mobile Money');
                                      setRefundAccount('');
                                      setRefundAccountName('');
                                      setRefundReason('');
                                    }}
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    Refund overpayment
                                  </Button>
                                } />
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle className="font-black text-slate-900 uppercase flex items-center gap-2">
                                      <Sparkles className="w-5 h-5 text-purple-600" />
                                      Overpayment Refund Request
                                    </DialogTitle>
                                    <DialogDescription>
                                      Enter payment payout path to claim back the surplus funds for this central assessment period.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleSubmitRefundRequest} className="space-y-4 py-2">
                                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-2">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Assessment Title:</span>
                                        <span className="font-bold text-slate-800">{a.title}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Expected Levy:</span>
                                        <span className="font-medium text-slate-800">{formatGHS(a.amount)}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-slate-500 font-bold text-purple-700">Total Paid:</span>
                                        <span className="font-bold text-purple-700">{formatGHS(totalPaid)}</span>
                                      </div>
                                      <div className="pt-2 border-t border-purple-200/50 flex justify-between text-sm font-black text-purple-900">
                                        <span>Surplus / Overpayment:</span>
                                        <span>{formatGHS(totalPaid - a.amount)}</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-bold">Provider *</Label>
                                        <Select value={refundProvider} onValueChange={setRefundProvider}>
                                          <SelectTrigger className="h-9">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="MTN Mobile Money">MTN Mobile Money</SelectItem>
                                            <SelectItem value="Telecel Cash">Telecel Cash</SelectItem>
                                            <SelectItem value="AirtelTigo Cash">AirtelTigo Cash</SelectItem>
                                            <SelectItem value="GCB Bank Transfer">GCB Bank Transfer</SelectItem>
                                            <SelectItem value="Ecobank Transfer">Ecobank Transfer</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-bold">Account / MoMo Number *</Label>
                                        <Input 
                                          required
                                          placeholder="e.g., 0541234567"
                                          value={refundAccount}
                                          onChange={(e) => setRefundAccount(e.target.value)}
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-bold">Account Holder Name *</Label>
                                      <Input 
                                        required
                                        placeholder="e.g., Hope Temple Assembly"
                                        value={refundAccountName}
                                        onChange={(e) => setRefundAccountName(e.target.value)}
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-bold">Reason for Refund Claim</Label>
                                      <Textarea 
                                        placeholder="Explain how double payment / overpayment occurred..."
                                        value={refundReason}
                                        onChange={(e) => setRefundReason(e.target.value)}
                                        className="h-16 resize-none"
                                      />
                                    </div>

                                    <Button 
                                      type="submit" 
                                      disabled={isSubmittingRefund}
                                      className="w-full bg-purple-600 hover:bg-purple-700 border-0 text-white font-bold h-10 uppercase text-xs tracking-wider"
                                    >
                                      {isSubmittingRefund ? 'Submitting...' : 'Submit Refund Claim'}
                                    </Button>
                                  </form>
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <Badge className="bg-emerald-50 text-emerald-700 font-bold">Completed</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detailed Submission History & Digital Receipt Delivery */}
          <Card className="border-slate-200 mt-8">
            <CardHeader className="border-b border-slate-100 py-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Submitted Verification Logs & Digital Receipts
                  </CardTitle>
                  <CardDescription className="text-xs">Audit ledger of payments submitted to national headquarters for security verification checks.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Reference / Tx ID</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Assessment</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Sender Details</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Payment Method</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Submitted Amount</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status</TableHead>
                    <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentTransactions.filter(tx => tx.branchId === (profile?.staffData?.assignedBranchId || 'main-hq')).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs italic">
                        No verification requests submitted for this branch yet. Use "Clear Levy" to initiate.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentTransactions
                      .filter(tx => tx.branchId === (profile?.staffData?.assignedBranchId || 'main-hq'))
                      .map((tx) => {
                        const rec = receipts.find(r => r.transactionId === tx.transactionId);
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="pl-6">
                              <span className="font-mono font-bold text-slate-800 block text-xs">{tx.transactionId}</span>
                              <span className="text-[9px] text-slate-400 font-mono block">{tx.paymentDate}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-bold text-slate-900 block text-xs">{tx.assessmentTitle || 'Central Levy'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-slate-800 font-medium block">{tx.senderName}</span>
                              <span className="text-[10px] text-slate-400 block">{tx.senderAccount}</span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 font-medium">{tx.paymentMethod}</TableCell>
                            <TableCell className="font-extrabold text-slate-900 text-xs">{formatGHS(tx.amount)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge className={
                                  tx.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[8px]' :
                                  tx.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100 font-bold text-[8px]' :
                                  tx.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100 font-bold text-[8px]' :
                                  tx.status === 'Under Review' ? 'bg-blue-50 text-blue-700 border-blue-100 font-bold text-[8px]' :
                                  'bg-slate-50 text-slate-700 border-slate-100 font-bold text-[8px]'
                                }>
                                  {tx.status || 'Pending'}
                                </Badge>
                                {tx.verificationNotes && (
                                  <span className="text-[9px] text-slate-400 italic block px-1 truncate max-w-[120px]" title={tx.verificationNotes}>
                                    Note: {tx.verificationNotes}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              {rec ? (
                                <Dialog>
                                  <DialogTrigger render={
                                    <Button 
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] h-7 px-2 uppercase tracking-tight flex items-center gap-1"
                                      onClick={() => setSelectedReceiptPrint({ tx, rec })}
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      Digital Receipt
                                    </Button>
                                  } />
                                  <DialogContent className="max-w-md bg-white p-0 overflow-hidden border-0 shadow-2xl">
                                    <div className="p-6 bg-slate-900 text-white relative">
                                      <div className="absolute right-6 top-6 opacity-25">
                                        <QrCode className="w-16 h-16" />
                                      </div>
                                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">Official Receipt</span>
                                      <h3 className="text-xl font-black mt-2 tracking-tight">NATIONAL HEADQUARTERS</h3>
                                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">ECCLESIA CENTRAL SYSTEM</p>
                                    </div>

                                    {/* Receipt Ticket Shape */}
                                    <div className="p-6 space-y-4 relative bg-slate-50/50">
                                      <div className="flex justify-between items-start border-b border-dashed border-slate-200 pb-4">
                                        <div>
                                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Receipt Serial</span>
                                          <span className="font-mono text-xs font-black text-slate-800">{rec.receiptNumber}</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Settled date</span>
                                          <span className="font-mono text-xs font-black text-slate-800">{tx.paymentDate}</span>
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500 font-medium">Payment Entity:</span>
                                          <span className="font-black text-slate-800">
                                            {branches.find(b => b.id === tx.branchId)?.name || 'HQ Branch'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500 font-medium">Category / Dues Name:</span>
                                          <span className="font-black text-slate-800">{tx.assessmentTitle || 'Central Levy'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500 font-medium">Payment Gateway Method:</span>
                                          <span className="font-bold text-slate-800">{tx.paymentMethod}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500 font-medium">Transaction Reference:</span>
                                          <span className="font-mono text-slate-800 font-bold">{tx.transactionId}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500 font-medium">Deposited By/Sender:</span>
                                          <span className="font-bold text-slate-800">{tx.senderName} ({tx.senderAccount})</span>
                                        </div>
                                      </div>

                                      <div className="border-t border-dashed border-slate-200 pt-4 flex flex-col items-center justify-between gap-3 mt-2 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                        <div className="text-center">
                                          <span className="text-[9px] uppercase text-emerald-800 font-black tracking-widest block">Total Amount Approved</span>
                                          <span className="text-3xl font-black text-emerald-700 tracking-tighter">{formatGHS(tx.amount)}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 mt-2">
                                        <QrCode className="w-10 h-10 text-slate-700 shrink-0" />
                                        <div className="text-[8px] text-slate-400 leading-normal">
                                          <span className="font-black text-slate-700 block uppercase">QR Code Audit Signature Secured</span>
                                          Verify ledger authentication trace using standard camera scanner at any church district office.
                                        </div>
                                      </div>
                                    </div>

                                    {/* Print action footer */}
                                    <div className="p-4 bg-slate-100 border-t flex gap-2">
                                      <Button 
                                        onClick={() => window.print()}
                                        className="w-full bg-slate-900 text-white font-bold text-xs uppercase tracking-wider py-2"
                                      >
                                        Print Official Receipt
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Pending approval</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Branch Refund Requests Ledger */}
          <Card className="border-slate-200 mt-8">
            <CardHeader className="border-b border-slate-100 py-4 bg-purple-50/20">
              <div>
                <CardTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Your Branch Refund Claims & Requests
                </CardTitle>
                <CardDescription className="text-xs">
                  Ledger of submitted refund claims for calculated overpaid assessments awaiting HQ treasury audit.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Assessment</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Finances (Goal / Paid)</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Surplus (Refund Claim)</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Refund Destination</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status</TableHead>
                    <TableHead className="pr-6 text-right font-bold uppercase tracking-wider text-[10px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundRequests.filter(r => r.branchId === (profile?.staffData?.assignedBranchId || 'main-hq')).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs italic">
                        No refund requests submitted for this branch. Overpay any central assessment above the target goal to create refund requests.
                      </TableCell>
                    </TableRow>
                  ) : (
                    refundRequests
                      .filter(r => r.branchId === (profile?.staffData?.assignedBranchId || 'main-hq'))
                      .map((r) => {
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="pl-6">
                              <span className="font-bold text-slate-900 block text-xs">{r.assessmentTitle}</span>
                              <span className="text-[9px] text-slate-400 font-mono block">Submitted: {new Date(r.createdAt || '').toLocaleDateString()}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="space-y-0.5">
                                <span className="block text-slate-500">Target: {formatGHS(r.targetAmount)}</span>
                                <span className="block font-medium text-slate-800">Total Paid: {formatGHS(r.totalPaid)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-black text-purple-750 text-xs text-purple-600">
                              {formatGHS(r.overpaidAmount)}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-semibold text-slate-800 block">{r.provider}</span>
                              <span className="text-slate-500 font-mono text-[10px] block">{r.accountName} - {r.account}</span>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge className={
                                  r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[8px]' :
                                  r.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100 font-bold text-[8px]' :
                                  'bg-amber-50 text-amber-700 border-amber-100 font-bold text-[8px]'
                                }>
                                  {r.status || 'Pending'}
                                </Badge>
                                {r.adminNotes && (
                                  <span className="text-[10px] text-slate-400 italic block px-1 max-w-[200px] truncate" title={r.adminNotes}>
                                    Notes: {r.adminNotes}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <span className="text-[10px] text-slate-400 italic">No action</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hierarchy Configuration Tab */}
        <TabsContent value="hierarchy" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Hierarchy Level Form */}
            <Card className="lg:col-span-1 border-slate-200">
              <CardHeader className="border-b border-indigo-50/30">
                <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-600" />
                  Define Campus Hierarchy Level
                </CardTitle>
                <CardDescription className="text-xs">Establish different assessment categories across branch sizes.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateLevel} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="levelName" className="text-xs font-bold text-slate-600">Level Name / Tier</Label>
                    <Input 
                      id="levelName"
                      required
                      placeholder="e.g., Mission outpost"
                      value={creatingLevel.name}
                      onChange={(e) => setCreatingLevel({ ...creatingLevel, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lvlAmount" className="text-xs font-bold text-slate-600">Standard Baseline Dues (GHS)</Label>
                    <Input 
                      id="lvlAmount"
                      type="number"
                      required
                      placeholder="GH₵"
                      value={creatingLevel.assessmentAmount}
                      onChange={(e) => setCreatingLevel({ ...creatingLevel, assessmentAmount: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs">
                    Save Level Profile
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Hierarchy Levels Listing */}
            <Card className="lg:col-span-2 border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-sm font-black uppercase text-slate-800">Operational Hierarchy Levels</CardTitle>
                <CardDescription className="text-xs font-medium text-slate-400">Different expectations config matching church sizes and missionary presence.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Tier Category</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px]">Standard Expected Amount</TableHead>
                      <TableHead className="font-bold uppercase tracking-wider text-[10px] text-right pr-6">Clearing Ratio Obligation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchLevels.map((lvl) => (
                      <TableRow key={lvl.id}>
                        <TableCell className="pl-6 font-bold text-slate-900">{lvl.name}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{formatGHS(lvl.assessmentAmount)}</TableCell>
                        <TableCell className="text-right pr-6 text-slate-400 font-medium text-xs">Derived Obligations</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple clock icon replacement helper 
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
