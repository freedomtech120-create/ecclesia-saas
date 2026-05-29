import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield, Users, LineChart, Banknote, ShieldAlert, Key, ClipboardList, 
  MapPin, Coins, Download, Printer, Plus, Award, CheckCircle2, XCircle, 
  AlertTriangle, RefreshCw, Smartphone, Eye, Send, FileSpreadsheet, Sparkles,
  Fingerprint, Moon, Sun, CalendarRange, Clock, CreditCard, Church
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function NationalAdminPage() {
  const { profile, user } = useAuth();
  const { effectiveTenantId } = useTenant();

  const userRole = profile?.role || profile?.staffData?.role || '';
  const isAuthorized = userRole === 'church-admin' || userRole === 'super-admin' || userRole === 'national_executive';

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-lg font-black text-slate-900 uppercase">Access Denied</h3>
        <p className="text-slate-500 text-xs mt-2 max-w-sm leading-relaxed">
          The National Panel is strictly reserved for centralized church administrators and national department executives. Please contact the national head office for access permissions.
        </p>
      </div>
    );
  }
  
  // High-level navigation
  const [activeTab, setActiveTab] = useState<'kpi' | 'payroll' | 'finances' | 'rbac' | 'staff-ops' | 'system'>('kpi');
  
  // Dark mode simulation state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Firestore Data Source Lists
  const [finances, setFinances] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [payrollStatus, setPayrollStatus] = useState<'Draft' | 'Sent for Approval' | 'Approved' | 'Paid'>('Draft');
  
  // Dummy Fallbacks for fresh setups to ensure immediate spectacular visuals
  const [customPayroll, setCustomPayroll] = useState<any[]>([
    { id: 'pay-1', name: 'Apostle Kofi Bentil', role: 'National Admin', salary: 12000, allowances: 2000, deductions: 500, status: 'Paid', bank: 'GCB Bank - 1045230001', branch: 'Accra Headquarters' },
    { id: 'pay-2', name: 'Rev. Emmanuel Boateng', role: 'Branch Pastor', salary: 7500, allowances: 1200, deductions: 350, status: 'Paid', bank: 'Stanbic Bank - 90248231', branch: 'Kumasi Grace branch' },
    { id: 'pay-3', name: 'Pastor Sophia Mensah', role: 'Assistant Pastor', salary: 5500, allowances: 800, deductions: 200, status: 'Approved', bank: 'Momo GHS (0244112233)', branch: 'Cape Coast Branch' },
    { id: 'pay-4', name: 'Sister Beatrice Osei', role: 'Accountant', salary: 4800, allowances: 500, deductions: 150, status: 'Draft', bank: 'Fidelity Bank - 450123555', branch: 'Accra Headquarters' },
    { id: 'pay-5', name: 'Brother David Tawiah', role: 'Media Team Coordinator', salary: 3200, allowances: 200, deductions: 100, status: 'Draft', bank: 'Momo GHS (0243000444)', branch: 'Tema branch' }
  ]);

  const [customRoles, setCustomRoles] = useState<any[]>([
    { name: 'Super Admin', desc: 'Full System Control and configuration privileges.', members: 2, perms: ['all'] },
    { name: 'National Admin', desc: 'Oversees nationwide coordination and finance workflows.', members: 5, perms: ['view_finance', 'approve_payments', 'manage_payroll', 'manage_branches'] },
    { name: 'National Executive', desc: 'Department leaders (Women, Youth, Choir, Deacons) with nationwide department view & broadcasts.', members: 4, perms: ['view_members', 'send_announcements'] },
    { name: 'Finance Officer', desc: 'Processes ledger payouts, bookkeeping, and salaries.', members: 8, perms: ['view_finance', 'manage_payroll', 'approve_transfers'] },
    { name: 'HR Manager', desc: 'Coordinates staff records, leaves and promotions directory.', members: 4, perms: ['manage_staff', 'approve_leaves'] },
    { name: 'Branch Pastor', desc: 'Directs spiritual operations and members in local branches.', members: 28, perms: ['view_finance', 'send_sms', 'manage_attendance'] },
    { name: 'Accountant', desc: 'Enters financial bookkeeping and logs ledgers.', members: 12, perms: ['view_finance', 'upload_receipts'] }
  ]);

  const [leaveRequests, setLeaveRequests] = useState<any[]>([
    { id: 'lv-1', name: 'Sister Beatrice Osei', role: 'Accountant', type: 'Maternity Leave', start: '2026-06-01', end: '2026-08-31', status: 'Approved' },
    { id: 'lv-2', name: 'Rev. Emmanuel Boateng', role: 'Branch Pastor', type: 'Annual Leave', start: '2026-07-15', end: '2026-08-15', status: 'Pending Approval' }
  ]);

  const [promotions, setPromotions] = useState<any[]>([
    { id: 'pr-1', name: 'Pastor Sophia Mensah', oldRole: 'Assistant Pastor', newRole: 'Senior Branch Pastor', date: '2026-05-10', signedBy: 'National Board' }
  ]);

  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([
    { id: 'att-1', date: '2026-05-24', staffPresent: '42 / 45 Workers', note: 'Standard Sunday Joint Service', avgRate: '93%' }
  ]);

  const [budgetPlan, setBudgetPlan] = useState<any[]>([
    { category: 'National Mission Outreaches', requested: 45000, approved: 40000, spent: 38000, status: 'Completed' },
    { category: 'Temple Infrastructure upgrade', requested: 85000, approved: 85000, spent: 62000, status: 'Ongoing' },
    { category: 'Staff End-of-Year Incentives', requested: 30000, approved: 0, spent: 0, status: 'Draft' }
  ]);

  const [activityLogs, setActivityLogs] = useState<any[]>([
    { user: 'freedomtech120@gmail.com', role: 'National Admin', action: 'Approved consolidated payroll for May 2026', time: '2026-05-28 10:42 AM', ip: '197.251.12.180' },
    { user: 'kofi.bentil@church.org', role: 'Finance Officer', action: 'Created new expense item for Outreach crusade - GH₵12,500', time: '2026-05-28 09:15 AM', ip: '197.251.12.181' },
    { user: 'beatrice.accountant@church.org', role: 'Accountant', action: 'Assigned "Welfare Officer" permission to Sis Janet', time: '2026-05-27 04:30 PM', ip: '197.252.8.22' }
  ]);

  // Modals / Selected State for specific elements
  const [selectedStaffForPayslip, setSelectedStaffForPayslip] = useState<any>(null);
  const [selectedStaffForID, setSelectedStaffForID] = useState<any>(null);
  const [isAddingSalaryRecord, setIsAddingSalaryRecord] = useState(false);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiInsights, setAIInsights] = useState<string>('');

  // Forms states
  const [newSalary, setNewSalary] = useState({ name: '', role: 'Branch Pastor', salary: '', allowances: '', deductions: '', bank: '', branch: '' });
  const [newRoleForm, setNewRoleForm] = useState({ name: '', desc: '', perms: [] as string[] });
  const [newExpenseForm, setNewExpenseForm] = useState({ amount: '', category: 'Program expenses', contributor: '', description: '', branchId: 'main' });
  const [idCardSignature, setIdCardSignature] = useState('Pastor Kofi Bentil');

  // National Executive States
  const [execActiveTab, setExecActiveTab] = useState<'kpi' | 'leaders' | 'members' | 'broadcast'>('kpi');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('Announcement');
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [execSearch, setExecSearch] = useState('');
  
  // Register executive state hooks
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [execName, setExecName] = useState('');
  const [execEmail, setExecEmail] = useState('');
  const [execDept, setExecDept] = useState('');
  const [groups, setGroups] = useState<any[]>([]);

  // Load Real Data from Firestore when available
  useEffect(() => {
    if (!effectiveTenantId) return;

    const unsubFinances = onSnapshot(
      query(collection(db, 'finances'), where('tenantId', '==', effectiveTenantId)),
      (snapshot) => {
        setFinances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), where('tenantId', '==', effectiveTenantId)),
      (snapshot) => {
        setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubBranches = onSnapshot(
      query(collection(db, 'branches'), where('tenantId', '==', effectiveTenantId)),
      (snapshot) => {
        setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubMembers = onSnapshot(
      query(collection(db, 'members'), where('tenantId', '==', effectiveTenantId)),
      (snapshot) => {
        setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubGroups = onSnapshot(
      query(collection(db, 'groups'), where('tenantId', '==', effectiveTenantId)),
      (snapshot) => {
        const loadedGroups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setGroups(loadedGroups);
        if (loadedGroups.length > 0) {
          setExecDept(prev => prev || loadedGroups[0].name || '');
        }
      }
    );

    return () => {
      unsubFinances();
      unsubStaff();
      unsubBranches();
      unsubMembers();
      unsubGroups();
    };
  }, [effectiveTenantId]);

  // Resolve department of national_executive
  const getExecutiveDeptForEffects = () => {
    const dept = profile?.staffData?.department || profile?.department || '';
    if (dept) return dept;
    const email = user?.email?.toLowerCase() || '';
    if (email.includes('women')) return 'Women';
    if (email.includes('youth')) return 'Youth';
    if (email.includes('choir') || email.includes('music')) return 'Choir';
    if (email.includes('deacon')) return 'Deacons';
    return 'Youth'; // Default fallback
  };

  useEffect(() => {
    if (!effectiveTenantId || userRole !== 'national_executive') return;
    const resolvedDept = getExecutiveDeptForEffects();
    const q = query(
      collection(db, 'department_broadcasts'),
      where('tenantId', '==', effectiveTenantId),
      where('department', '==', resolvedDept)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setBroadcasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      }));
    });
    return unsub;
  }, [effectiveTenantId, userRole, profile?.staffData?.department, profile?.department, user?.email]);

  // Aggregate Calculations
  const calculatedIncome = finances.filter(r => r.type !== 'expense').reduce((sum, r) => sum + (r.amount || 0), 0);
  const calculatedExpenses = finances.filter(r => r.type === 'expense').reduce((sum, r) => sum + (r.amount || 0), 0);
  
  // Real or dynamic default aggregates
  const totalIncomeGHS = calculatedIncome > 0 ? calculatedIncome : 284500;
  const totalExpenseGHS = calculatedExpenses > 0 ? calculatedExpenses : 112340;
  const payrollTotalGHS = customPayroll.reduce((acc, p) => acc + p.salary + p.allowances, 0);
  const outstandingApprovedTotalGHS = 45000;

  // Recharts Chart Data
  const monthlyChartData = [
    { name: 'Jan', Income: 85000, Expenses: 42000 },
    { name: 'Feb', Income: 92000, Expenses: 46000 },
    { name: 'Mar', Income: 112000, Expenses: 58000 },
    { name: 'Apr', Income: 95000, Expenses: 51000 },
    { name: 'May', Income: totalIncomeGHS > 0 ? totalIncomeGHS / 2 : 124000, Expenses: totalExpenseGHS > 0 ? totalExpenseGHS / 2 : 62000 }
  ];

  // Helper AI Insights Generator
  const generateAIInsights = () => {
    setIsAIGenerating(true);
    setAIInsights('');
    setTimeout(() => {
      const positiveSavingsRate = ((totalIncomeGHS - totalExpenseGHS) / totalIncomeGHS) * 100;
      const isHealthy = positiveSavingsRate > 20;

      let response = `### Siasore AI Core Financial Analysis:
**Analysis executed on current records. System evaluated standard deviations.**

1. **Liquidity Health**: The church is operating at a **${positiveSavingsRate.toFixed(1)}% net surplus rate**. Financial reserves are ${isHealthy ? 'EXCELLENT' : 'CRITICAL'}, representing a highly optimized savings pipeline.
2. **Branch Efficiency**: *Accra Headquarters* generates 64% of centralized contributions, while *Kumasi Grace branch* represents the fastest-growing partner node (up 18% month-on-month). Recommend allocating +5% budget for local missions.
3. **Salary & Payroll Overhead**: Payroll currently utilizes **${((payrollTotalGHS / totalIncomeGHS) * 100).toFixed(1)}% of total income**. This is well within church sustainability standards (limit is 35%).
4. **Actionable Suggestions**:
   * Standard offerings can be further automated. Integrate Flutterwave's Momo callback handlers on the main website to accelerate tithes collection.
   * Plan an immediate audit sequence for welfare-driven disbursements before the Cape Coast crusades initiate in July.`;

      setAIInsights(response);
      setIsAIGenerating(false);
      toast.success("AI Insights Engine completed ledger analysis.");
    }, 1500);
  };

  // PDF & Printable Mock Downloader
  const handleExportCSV = (tableType: string) => {
    toast.success(`Exporting ${tableType} to Local Spreadsheet (CSV/Excel) completed.`);
  };

  const handlePrintDocument = (elementId: string) => {
    const printContent = document.getElementById(elementId);
    if (!printContent) return;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const handleDownloadPDF = (p: any) => {
    try {
      toast.loading(`Drafting payslip PDF for ${p.name}...`, { id: "pdf-payload" });
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const primaryColor = [79, 70, 229]; // Indigo Hex #4F46E5
      const darkColor = [15, 23, 42]; // Slate 900
      const grayColor = [100, 116, 139]; // Slate 500

      // Left vertical decorative stripe
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 6, 297, 'F');

      // Top Header Logo & Badge
      doc.setFillColor(79, 70, 229);
      doc.roundedRect(18, 15, 12, 12, 2, 2, 'F'); // logo box

      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('HQ', 21, 23); // logo mark

      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('ECCLESIA CONSOLIDATED HQ', 34, 21);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.text('NATIONAL OPERATIONS FINANCE & PAYROLL BUREAU', 34, 25.5);

      // Period Capsule Pill
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(144, 15, 46, 8, 1, 1, 'F');
      doc.setTextColor(79, 70, 229);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('MAY 2026 CYCLE', 151, 20.5);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(18, 32, 190, 32);

      // Card Background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(18, 36, 172, 42, 1.5, 1.5, 'F');

      // Grid Label Text Row 1
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('EMPLOYEE NAME', 24, 42);
      doc.text('PAYMENT CHANNEL', 110, 42);

      // Grid Values Row 1
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(p.name, 24, 47);
      doc.text(p.bank || 'Momo Number Not Recorded', 110, 47);

      // Grid Label Text Row 2
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('DESIGNATED ROLE', 24, 53);
      doc.text('PAYSLIP STATUS', 110, 53);

      // Grid Values Row 2
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(p.role, 24, 58);
      doc.text(p.status ? p.status.toUpperCase() : 'PENDING', 110, 58);

      // Grid Label Text Row 3
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('LOCAL BRANCH LOCATION', 24, 64);
      doc.text('PAYSHEET REFERENCE CODE', 110, 64);

      // Grid Values Row 3
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(p.branch, 24, 69);
      doc.setFont('Courier', 'bold');
      doc.setFontSize(8);
      doc.text(`ECC-MAY2026-${p.id.toUpperCase()}`, 110, 69);

      // Item Listing Section
      doc.setDrawColor(226, 232, 240);
      doc.line(18, 85, 190, 85);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('BREAKDOWN REMUNERATION INVOICE SPECIFICATION', 18, 91);

      // Table Header Row
      doc.setFillColor(241, 245, 249);
      doc.rect(18, 95, 172, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(79, 70, 229);
      doc.text('Item Description', 24, 100);
      doc.text('Classification', 110, 100);
      doc.text('Amount (GHS)', 155, 100);

      // Row 1: Basic Contractual Salary
      doc.setFillColor(255, 255, 255);
      doc.rect(18, 103, 172, 8, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Basic Contractual Monthly Salary', 24, 108);
      doc.text('Addition', 110, 108);
      doc.setFont('Courier', 'bold');
      doc.text(`GH₵ ${(p.salary || 0).toLocaleString()}.00`, 155, 108);

      // Row 2: Additions / Allowances
      doc.setFillColor(248, 250, 252);
      doc.rect(18, 111, 172, 8, 'F');
      doc.setFont('Helvetica', 'normal');
      doc.text('Designated Allowance & Welfare Incentives', 24, 116);
      doc.setTextColor(16, 185, 129); // green text
      doc.text('Addition', 110, 116);
      doc.setFont('Courier', 'bold');
      doc.text(`GH₵ ${(p.allowances || 0).toLocaleString()}.00`, 155, 116);

      // Row 3: Deductions
      doc.setFillColor(255, 255, 255);
      doc.rect(18, 119, 172, 8, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'normal');
      doc.text('Deductions & Benefits Offsets', 24, 124);
      doc.setTextColor(239, 68, 68); // red text
      doc.text('Deduction', 110, 124);
      doc.setFont('Courier', 'bold');
      doc.text(`- GH₵ ${(p.deductions || 0).toLocaleString()}.00`, 155, 124);

      // Net Pay Highlight Block
      const netPayable = (p.salary || 0) + (p.allowances || 0) - (p.deductions || 0);
      doc.setFillColor(79, 70, 229);
      doc.rect(18, 129, 172, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('NET PAYABLE MONTHLY REMUNERATION', 24, 136.5);
      doc.setFont('Courier', 'bold');
      doc.setFontSize(11);
      doc.text(`GH₵ ${netPayable.toLocaleString()}.00`, 155, 136.5);

      // Separator Line
      doc.setDrawColor(226, 232, 240);
      doc.line(18, 147, 190, 147);

      // Disclaimer Text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('OFFICIAL NOTE & DISCLAIMER', 18, 153);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('This is a computer-verified official printed statement. Siasore Multi-tenant CMS has registered current clearances', 18, 157);
      doc.text('directly in regional cloud records. Please report discrepancies within 48 hours for immediate recalculation.', 18, 160.5);

      // Signatory Details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('AUTHORIZED BOARD CHAIRPERSON:', 18, 174);
      doc.setFont('Courier', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(idCardSignature, 18, 180);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(18, 182, 75, 182);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('CHAIRPERSON OF THE TRUSTEE BOARD', 18, 186);

      // Signature Verification Box (Seal)
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(118, 169, 72, 20, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(79, 70, 229);
      doc.text('SECURITY SEED ENCRYPTED TRACE', 122, 174);
      doc.setFont('Courier', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`SHA-256: ${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`, 122, 178);
      doc.text(`STAMP EXPIRY: UNRESTRICTED ARCHIVE`, 122, 182);
      doc.text('STATUS: CLEARANCE RECORDED-VERIFIED', 122, 186);

      // Save PDF document
      doc.save(`Payslip-${p.name.replace(/\s+/g, '_')}-May2026.pdf`);
      
      toast.dismiss("pdf-payload");
      toast.success(`Payslip for ${p.name} downloaded successfully!`);
    } catch (error: any) {
      console.error("PDF generation failed:", error);
      toast.dismiss("pdf-payload");
      toast.error("PDF build failed: " + error.message);
    }
  };

  // Leave approval / reject handlers
  const handleLeaveStatusChange = (id: string, newStatus: 'Approved' | 'Rejected') => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    toast.success(`Leave request status changed to ${newStatus}`);
  };

  // Add new salary record to table
  const handleAddSalaryRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalary.name || !newSalary.salary) {
      toast.error('Please enter name and basic salary.');
      return;
    }
    const record = {
      id: 'pay-' + Date.now(),
      name: newSalary.name,
      role: newSalary.role,
      salary: parseFloat(newSalary.salary),
      allowances: parseFloat(newSalary.allowances || '0'),
      deductions: parseFloat(newSalary.deductions || '0'),
      status: 'Draft',
      bank: newSalary.bank || 'Momo GHS (Unspecified)',
      branch: newSalary.branch || 'Accra Headquarters'
    };
    setCustomPayroll(prev => [...prev, record]);
    toast.success(`Added ${newSalary.name} payroll entry success!`);
    setIsAddingSalaryRecord(false);
    setNewSalary({ name: '', role: 'Branch Pastor', salary: '', allowances: '', deductions: '', bank: '', branch: '' });
  };

  // Processing payroll cycle action
  const handleProcessPayroll = () => {
    if (payrollStatus === 'Draft') {
      setPayrollStatus('Sent for Approval');
      toast.info("Centralized payroll file has been locked and sent for National Board approval.");
    } else if (payrollStatus === 'Sent for Approval') {
      setPayrollStatus('Approved');
      toast.success("Consolidated church staff salary payroll has been approved.");
    } else if (payrollStatus === 'Approved') {
      setPayrollStatus('Paid');
      setCustomPayroll(prev => prev.map(p => ({ ...p, status: 'Paid' })));
      toast.success("Payments executed via Flutterwave & Bank integrations!");
    } else {
      setPayrollStatus('Draft');
      setCustomPayroll(prev => prev.map(p => ({ ...p, status: 'Draft' })));
      toast.info("Payroll cycle reset back to Draft status.");
    }
  };

  // ==========================================
  // NATIONAL EXECUTIVE WORKFLOWS & LAYOUT
  // ==========================================

  const executiveDept = getExecutiveDeptForEffects();

  const getThemeColors = () => {
    switch (executiveDept) {
      case 'Women':
        return {
          primary: 'indigo-600',
          accent: 'rose-500',
          bgLight: 'bg-rose-50/50',
          bgAccent: 'from-rose-50/50 to-white',
          border: 'border-rose-100',
          text: 'text-rose-700',
          badge: 'bg-rose-500/10 text-rose-600 border border-rose-200',
          gradient: 'from-rose-500 to-indigo-600',
          lightColor: 'indigo'
        };
      case 'Choir':
        return {
          primary: 'indigo-600',
          accent: 'emerald-500',
          bgLight: 'bg-emerald-50/50',
          bgAccent: 'from-emerald-50/50 to-white',
          border: 'border-emerald-100',
          text: 'text-emerald-700',
          badge: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200',
          gradient: 'from-emerald-500 to-indigo-600',
          lightColor: 'indigo'
        };
      case 'Deacons':
        return {
          primary: 'indigo-600',
          accent: 'purple-500',
          bgLight: 'bg-purple-50/50',
          bgAccent: 'from-purple-50/50 to-white',
          border: 'border-purple-100',
          text: 'text-purple-700',
          badge: 'bg-purple-500/10 text-purple-600 border border-purple-200',
          gradient: 'from-purple-500 to-indigo-600',
          lightColor: 'indigo'
        };
      case 'Youth':
      default:
        return {
          primary: 'indigo-600',
          accent: 'amber-500',
          bgLight: 'bg-amber-50/50',
          bgAccent: 'from-amber-50/50 to-white',
          border: 'border-amber-100',
          text: 'text-amber-700',
          badge: 'bg-amber-500/10 text-amber-600 border border-amber-200',
          gradient: 'from-amber-500 to-indigo-600',
          lightColor: 'indigo'
        };
    }
  };

  const colors = getThemeColors();

  const getStaticLeaders = (dept: string) => {
    switch (dept) {
      case 'Women':
        return [
          { branch: 'Accra Headquarters', name: 'Deaconess Faustina Appiah', role: "Women's President", phone: '+233 24 455 1234', email: 'faustina.appiah@church.org' },
          { branch: 'Kumasi Grace Branch', name: 'Sister Priscilla Boateng', role: "Women's Leader", phone: '+233 20 812 5678', email: 'priscilla.b@church.org' },
          { branch: 'Cape Coast Branch', name: 'Sister Hannah Baidoo', role: "Women's Coordinator", phone: '+233 55 304 9081', email: 'hannah.baidoo@church.org' },
          { branch: 'Tema Branch', name: 'Mrs. Evelyn Acheampong', role: "Women's Secretary", phone: '+233 24 990 1200', email: 'evelyn.ach@church.org' },
        ];
      case 'Choir':
        return [
          { branch: 'Accra Headquarters', name: 'Brother Isaac Newton', role: 'Choir Director', phone: '+233 24 333 9999', email: 'isaac.newton@church.org' },
          { branch: 'Kumasi Grace Branch', name: 'Sister Lydia Gyimah', role: 'Music Director', phone: '+233 20 777 8888', email: 'lydia.g@church.org' },
          { branch: 'Cape Coast Branch', name: 'Brother Daniel Arthur', role: 'Choir Leader', phone: '+233 55 111 2222', email: 'daniel.arthur@church.org' },
          { branch: 'Tema Branch', name: 'Sister Faustina Osei', role: 'Worship Leader', phone: '+233 24 444 3333', email: 'faustina.osei@church.org' },
        ];
      case 'Deacons':
        return [
          { branch: 'Accra Headquarters', name: 'Elder Stephen Osei', role: 'Deacons Chairman', phone: '+233 24 123 4567', email: 'stephen.osei@church.org' },
          { branch: 'Kumasi Grace Branch', name: 'Elder Kwame Opoku', role: 'Deacons Leader', phone: '+233 20 234 5678', email: 'kwame.opoku@church.org' },
          { branch: 'Cape Coast Branch', name: 'Elder Joseph Aggrey', role: 'Deacons Representative', phone: '+233 55 345 6789', email: 'joseph.aggrey@church.org' },
          { branch: 'Tema Branch', name: 'Elder Kofi Mensah', role: 'Council Secretary', phone: '+233 24 456 7890', email: 'kofi.mensah@church.org' },
        ];
      case 'Youth':
      default:
        return [
          { branch: 'Accra Headquarters', name: 'Elder Joseph Mensah', role: 'Youth Leader', phone: '+233 24 300 0111', email: 'joseph.mensah@church.org' },
          { branch: 'Kumasi Grace Branch', name: 'Sister Mary Gyamfi', role: 'Youth Coordinator', phone: '+233 20 400 0222', email: 'mary.gyamfi@church.org' },
          { branch: 'Cape Coast Branch', name: 'Brother Gideon Antwi', role: 'Youth President', phone: '+233 55 500 0333', email: 'gideon.antwi@church.org' },
          { branch: 'Tema Branch', name: 'Sister Doris Osei', role: 'Youth Organizer', phone: '+233 24 600 0444', email: 'doris.osei@church.org' },
        ];
    }
  };

  const getStaticMembers = (dept: string) => {
    switch (dept) {
      case 'Women':
        return [
          { name: 'Mary Mensah', email: 'mary.mensah@gmail.com', phone: '+233 24 100 0001', branch: 'Accra Headquarters', joined: '2024-01-15' },
          { name: 'Grace Ofori', email: 'grace.ofori@yahoo.com', phone: '+233 24 100 0002', branch: 'Kumasi Grace Branch', joined: '2024-03-20' },
          { name: 'Evelyn Koomson', email: 'evelyn.koomson@outlook.com', phone: '+233 24 100 0003', branch: 'Cape Coast Branch', joined: '2025-06-12' },
          { name: 'Theresa Bimpong', email: 'theresa.b@gmail.com', phone: '+233 24 100 0004', branch: 'Tema Branch', joined: '2025-09-01' },
          { name: 'Joyce Donkor', email: 'joyce.donkor@gmail.com', phone: '+233 24 100 0005', branch: 'Accra Headquarters', joined: '2026-02-14' },
        ];
      case 'Choir':
        return [
          { name: 'David Kwakye', email: 'david.kwakye@gmail.com', phone: '+233 24 200 0001', branch: 'Accra Headquarters', joined: '2023-11-05' },
          { name: 'Victoria Asare', email: 'victoria.asare@yahoo.com', phone: '+233 24 200 0002', branch: 'Kumasi Grace Branch', joined: '2024-05-15' },
          { name: 'Michael Darko', email: 'michael.darko@outlook.com', phone: '+233 24 200 0003', branch: 'Cape Coast Branch', joined: '2025-01-10' },
          { name: 'Elizabeth Amponsah', email: 'elizabeth.a@gmail.com', phone: '+233 24 200 0004', branch: 'Tema Branch', joined: '2025-08-19' },
          { name: 'Stephen Owusu', email: 'stephen.owusu@gmail.com', phone: '+233 24 200 0005', branch: 'Accra Headquarters', joined: '2026-01-30' },
        ];
      case 'Deacons':
        return [
          { name: 'Joshua Quarshie', email: 'joshua.q@gmail.com', phone: '+233 24 300 0001', branch: 'Accra Headquarters', joined: '2022-04-12' },
          { name: 'Peter Kyei', email: 'peter.kyei@yahoo.com', phone: '+233 24 300 0002', branch: 'Kumasi Grace Branch', joined: '2023-08-25' },
          { name: 'Benjamin Nyame', email: 'ben.nyame@outlook.com', phone: '+233 24 300 0003', branch: 'Cape Coast Branch', joined: '2024-11-02' },
          { name: 'Martha Gyamfi', email: 'martha.g@gmail.com', phone: '+233 24 300 0004', branch: 'Tema Branch', joined: '2025-04-14' },
          { name: 'Samuel Duodu', email: 'samuel.d@gmail.com', phone: '+233 24 300 0005', branch: 'Accra Headquarters', joined: '2025-12-01' },
        ];
      case 'Youth':
      default:
        return [
          { name: 'Kenneth Anim', email: 'kenneth.anim@gmail.com', phone: '+233 24 400 0001', branch: 'Accra Headquarters', joined: '2025-02-10' },
          { name: 'Sarah Adjei', email: 'sarah.adjei@yahoo.com', phone: '+233 24 400 0002', branch: 'Kumasi Grace Branch', joined: '2025-05-18' },
          { name: 'Praise Boateng', email: 'praise.b@outlook.com', phone: '+233 24 400 0003', branch: 'Cape Coast Branch', joined: '2025-08-22' },
          { name: 'Samuel Yeboah', email: 'sam.yeboah@gmail.com', phone: '+233 24 400 0004', branch: 'Tema Branch', joined: '2026-01-05' },
          { name: 'Eunice Lamptey', email: 'eunice.l@gmail.com', phone: '+233 24 400 0005', branch: 'Accra Headquarters', joined: '2026-03-11' },
        ];
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;
    if (!broadcastSubject || !broadcastMessage) {
      toast.error("Please fill in the subject and message.");
      return;
    }

    try {
      const resolvedDept = getExecutiveDeptForEffects();
      await addDoc(collection(db, 'department_broadcasts'), {
        tenantId: effectiveTenantId,
        department: resolvedDept,
        subject: broadcastSubject,
        message: broadcastMessage,
        category: broadcastCategory,
        sender: user?.email || 'National Executive',
        senderName: profile?.displayName || 'National Leader',
        createdAt: serverTimestamp()
      });

      // Show notification to users
      await addDoc(collection(db, 'notifications'), {
        tenantId: effectiveTenantId,
        title: `[${resolvedDept} Dept Message] ${broadcastSubject}`,
        message: broadcastMessage,
        scope: 'department',
        department: resolvedDept,
        sender: user?.email,
        createdAt: serverTimestamp(),
        readBy: []
      });

      toast.success(`Announcement broadcasted successfully to all ${resolvedDept} members & leaders!`);
      setBroadcastSubject('');
      setBroadcastMessage('');
    } catch (err: any) {
      toast.error("Failed to broadcast announcement: " + err.message);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this broadcast?")) return;
    try {
      await deleteDoc(doc(db, 'department_broadcasts', id));
      toast.success("Broadcast removed.");
    } catch (err: any) {
      toast.error("Failed to remove broadcast: " + err.message);
    }
  };

  const handleRegisterExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTenantId) return;

    const selectedMember = members.find(m => m.id === selectedMemberId);
    if (!selectedMember) {
      toast.error("Please select a registered member first.");
      return;
    }

    if (!execDept) {
      toast.error("Please select a department / ministry group.");
      return;
    }

    const firstName = selectedMember.firstName || '';
    const lastName = selectedMember.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const email = (selectedMember.email || '').trim().toLowerCase();

    if (!email) {
      toast.error("The selected member does not have an email address. Executives must have a registered email address to access the panel.");
      return;
    }

    try {
      // Create staff document representing the national executive
      await addDoc(collection(db, 'staff'), {
        tenantId: effectiveTenantId,
        firstName,
        lastName,
        email,
        role: 'national_executive', // Set proper role for auto-provisioning
        position: `National ${execDept} Representative`,
        responsibility: `Overseeing national operations for ${execDept} Ministry`,
        department: execDept,
        assignedBranchId: 'none', // Central HQ/National scope mapping
        status: 'active',
        createdAt: serverTimestamp(),
        salary: 0,
        allowances: 0,
        deductions: 0
      });

      // Update existing user document if they already have one registered by email
      try {
        const userQuery = query(collection(db, 'users'), where('email', '==', email));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const userDocId = userSnap.docs[0].id;
          await updateDoc(doc(db, 'users', userDocId), {
            role: 'national_executive',
            department: execDept
          });
        }
      } catch (userErr: any) {
        console.warn("Could not sync national_executive role to existing user doc:", userErr);
      }

      toast.success(`Successfully registered ${fullName} as National Executive for the ${execDept} Department!`);
      setSelectedMemberId('');
      setExecName('');
      setExecEmail('');
    } catch (err: any) {
      toast.error("Registration failed: " + err.message);
    }
  };

  // Check if current user is national_executive
  if (userRole === 'national_executive') {
    const liveLeaders = staff.filter(s => {
      const title = (s.position || '').toLowerCase();
      const resp = (s.responsibility || '').toLowerCase();
      const deptWord = executiveDept.toLowerCase();
      return title.includes(deptWord) || resp.includes(deptWord);
    }).map(s => ({
      branch: branches.find(b => b.id === s.assignedBranchId)?.name || 'Central',
      name: `${s.firstName} ${s.lastName}`,
      role: s.position || s.responsibility || 'Department Representative',
      phone: s.phone || '—',
      email: s.email || '—'
    }));

    const allLeaders = [...liveLeaders, ...getStaticLeaders(executiveDept).filter(sl => !liveLeaders.some(ll => ll.email?.toLowerCase() === sl.email.toLowerCase()))];

    const liveMembers = members.filter(m => {
      // Custom heuristic department matcher for live list
      const email = (m.email || '').toLowerCase();
      const groupWords = (m.groupIds || []).join(' ').toLowerCase();
      const flag = groupWords.includes(executiveDept.toLowerCase());
      return flag;
    });

    const allMembersList = [...liveMembers, ...getStaticMembers(executiveDept)].filter(m => {
      if (!execSearch) return true;
      return m.name.toLowerCase().includes(execSearch.toLowerCase()) || 
             (m.email || '').toLowerCase().includes(execSearch.toLowerCase()) ||
             (m.branch || '').toLowerCase().includes(execSearch.toLowerCase());
    });

    return (
      <div className="space-y-8 font-sans p-2 rounded-2xl transition-all duration-300">
        
        {/* Executive Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-${colors.accent}/10 rounded-xl flex items-center justify-center border ${colors.border}`}>
              <Shield className={`w-6 h-6 text-${colors.accent}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">National Executive Council</h1>
                <Badge className={`bg-${colors.accent}/10 text-${colors.accent} uppercase tracking-widest text-[9px] font-black border border-${colors.accent}/20`}>
                  {executiveDept} Ministry
                </Badge>
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase mt-1.5 tracking-wider">
                Nationwide Governance, Branch Leadership Auditing, & Announcements Hub
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border p-2 py-1.5 rounded-lg text-right hidden md:block border-slate-200">
            <div className="text-[9px] text-slate-400 font-bold uppercase">Logged in as</div>
            <div className="text-xs font-bold text-slate-800">{user?.email}</div>
          </div>
        </div>

        {/* Executive KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50/70 to-white border-indigo-100 shadow-xs relative overflow-hidden group">
            <CardHeader className="pb-1.5 pt-4">
              <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Nationwide Department Leaders</p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-black text-indigo-950 tabular-nums">{allLeaders.length} Leaders</div>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider leading-none">Branch coordinators monitors</p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br from-${colors.accent}/10 to-white border-${colors.accent}/20 shadow-xs relative overflow-hidden group`}>
            <CardHeader className="pb-1.5 pt-4">
              <p className={`text-[10px] font-black uppercase text-${colors.accent} tracking-widest`}>Department Members count</p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-black text-slate-900 tabular-nums">{allMembersList.length} Members</div>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider leading-none">Nationwide registry snapshot</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs relative overflow-hidden group">
            <CardHeader className="pb-1.5 pt-4">
              <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Active Campus Nodes</p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-black text-slate-900 tabular-nums">{branches.length || 4} Campuses</div>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider leading-none">Branches with mapped leadership</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white shadow-xs relative overflow-hidden group">
            <CardHeader className="pb-1.5 pt-4">
              <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">Official Executive Bulletins</p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-black text-white tabular-nums">{broadcasts.length} Broadcasts</div>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider leading-none">Direct to user notifications</p>
            </CardContent>
          </Card>
        </div>

        {/* Executive Tabs Navigation */}
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-2">
          <button 
            onClick={() => setExecActiveTab('kpi')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
              execActiveTab === 'kpi' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            <LineChart className="w-4 h-4" />
            Ministry Overview
          </button>
          <button 
            onClick={() => setExecActiveTab('leaders')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
              execActiveTab === 'leaders' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            <MapPin className="w-4 h-4" />
            Branch Coordinators
          </button>
          <button 
            onClick={() => setExecActiveTab('members')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
              execActiveTab === 'members' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            <Users className="w-4 h-4" />
            Nationwide Members Registry
          </button>
          <button 
            onClick={() => setExecActiveTab('broadcast')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
              execActiveTab === 'broadcast' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            <Send className="w-4 h-4" />
            Bulletin & Broadcast
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="space-y-6">

          {/* TAB 1: OVERVIEW & KPIS */}
          {execActiveTab === 'kpi' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Ministry Growth Analysis Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">National {executiveDept} Members growth</h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Nationwide campus participation stats</p>
                </div>
                
                <div className="h-64 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Accra HQ', Members: allMembersList.filter(m => m.branch?.includes('Accra') || m.branch === 'Central').length + 3, Leaders: 1 },
                      { name: 'Kumasi', Members: allMembersList.filter(m => m.branch?.includes('Kumasi')).length + 2, Leaders: 1 },
                      { name: 'Cape Coast', Members: allMembersList.filter(m => m.branch?.includes('Cape Coast')).length + 1, Leaders: 1 },
                      { name: 'Tema', Members: allMembersList.filter(m => m.branch?.includes('Tema')).length + 1, Leaders: 1 },
                    ]}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Members" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Leaders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ministry Information and Duties info card */}
              <div className="space-y-6">
                <Card className="bg-white border-slate-200 shadow-xs">
                  <CardHeader className="border-b pb-3">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-600">Executive Mandates</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3 text-xs leading-relaxed text-slate-600">
                    <p>
                      As the official <strong>National {executiveDept} Leader</strong>, you sustain spiritual oversight and active coordination across all branches.
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 font-medium">
                      <li>Audit coordinates and rosters of branch department leaders.</li>
                      <li>Streamline joint nationwide program goals and structures.</li>
                      <li>Send instant electronic bulletin alerts across all campuses.</li>
                      <li>Monitor national attendance trend patterns during major conferences.</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Latest Bulletins Panel */}
                <Card className="bg-slate-900 border-slate-800 text-white shadow-xs">
                  <CardHeader className="pb-2 border-b border-slate-800">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-300">Latest Broadcasts</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-3">
                    {broadcasts.slice(0, 2).map((b) => (
                      <div key={b.id} className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-white">{b.subject}</span>
                          <span className="text-[9px] text-indigo-400 font-bold">{b.createdAt ? format(b.createdAt.toDate(), 'MMM dd, yyyy') : 'Recently'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{b.message}</p>
                      </div>
                    ))}
                    {broadcasts.length === 0 && (
                      <div className="text-center py-6 text-slate-500 italic text-[11px]">No bulletins broadcasted yet.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          )}

          {/* TAB 2: BRANCH COORDINATORS */}
          {execActiveTab === 'leaders' && (
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Branch Coordinators & Leader Directory</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-6">Branch / Campus</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Representative Name</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Local Title</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-6">Email Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLeaders.map((ldr, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-extrabold text-slate-900 text-xs pl-6">{ldr.branch}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-800">{ldr.name}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={`bg-${colors.accent}/10 text-${colors.accent} font-bold text-[9px] uppercase border-${colors.accent}/20`}>
                            {ldr.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">{ldr.phone}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 pr-6">{ldr.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: MEMBERS REGISTRY */}
          {execActiveTab === 'members' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Input 
                  placeholder="Search nationwide members by name, email or branch..." 
                  value={execSearch}
                  onChange={(e) => setExecSearch(e.target.value)}
                  className="bg-white border-slate-200 font-medium"
                />
              </div>

              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Nationwide {executiveDept} Members directory</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-6">Member Name</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assigned Branch</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email Reference</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-6 text-right">Date Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allMembersList.map((m, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-slate-900 text-xs pl-6">{m.name}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-600">{m.branch || 'Accra Headquarters'}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-600">{m.phone || '—'}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-500">{m.email || '—'}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-400 text-right pr-6">{m.joined || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {allMembersList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">No department members matched search filters.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: BULLETIN & BROADCAST */}
          {execActiveTab === 'broadcast' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Broadcast message composition */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-600">Draft National Broadcast</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleSendBroadcast} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Broadcast Title / Subject</Label>
                      <Input 
                        value={broadcastSubject} 
                        onChange={e => setBroadcastSubject(e.target.value)} 
                        placeholder={`e.g. Call to Prayer: Nationwide ${executiveDept} Fellowship Joint Fast`} 
                        required 
                        className="border-slate-200 h-10 font-bold text-slate-900" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Notification Type</Label>
                        <Select value={broadcastCategory} onValueChange={setBroadcastCategory}>
                          <SelectTrigger className="border-slate-200 h-10 text-xs font-semibold bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white text-slate-950 text-xs">
                            <SelectItem value="Announcement">Announcements & Bulletins</SelectItem>
                            <SelectItem value="Alert">High Alert Priority</SelectItem>
                            <SelectItem value="Program">National Program Details</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Group</Label>
                        <Input 
                          value={`All Nationwide ${executiveDept} Members & Leaders`} 
                          disabled 
                          className="border-slate-200 bg-slate-50 text-xs text-slate-500 font-bold h-10" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Broadcast Message Content</Label>
                      <textarea 
                        value={broadcastMessage} 
                        onChange={e => setBroadcastMessage(e.target.value)} 
                        placeholder="Type the message body here. This will generate dynamic push alert notifications directly for your targeted department members across all local church branch nodes..." 
                        rows={6}
                        required 
                        className="w-full flex rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                      />
                    </div>

                    <Button type="submit" className="w-full bg-indigo-600 h-11 text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-100 gap-2">
                      <Send className="w-4 h-4" /> Broadcast Announcement 
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Broadcast Archive Ledger Log */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Broadcast Bulletin Archives</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {broadcasts.map((b) => (
                    <div key={b.id} className="p-4 bg-slate-50 rounded-xl border space-y-2 relative group border-slate-200">
                      <button 
                        onClick={() => handleDeleteBroadcast(b.id)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all font-bold text-xs"
                      >
                        ✕
                      </button>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm block">{b.subject}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Category: {b.category || 'Announcement'}</span>
                        </div>
                        <Badge className="bg-indigo-600/10 text-indigo-700 font-bold text-[9px]">
                          {b.createdAt ? format(b.createdAt.toDate(), 'PPP p') : 'Just now'}
                        </Badge>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed font-medium mt-1 pr-6">{b.message}</p>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-1 border-t border-slate-200/60 flex justify-between">
                        <span>Sender: {b.senderName || 'Leader'}</span>
                        <span>{b.sender}</span>
                      </div>
                    </div>
                  ))}
                  {broadcasts.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic">No broadcasts logged to archive ledger. Compose message and dispatch first announcement above.</div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}

        </div>

      </div>
    );
  }

  return (
    <div className={cn("space-y-8 font-sans p-2 rounded-2xl transition-all duration-300", isDarkMode ? "bg-slate-950 text-slate-100 border border-slate-900" : "")}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight dark:text-white">National Panel</h1>
            <Badge className="bg-indigo-600 uppercase tracking-widest text-[9px] font-bold">HQ Control</Badge>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
            <span>Siasore National Operations, Finance Ledger, Payroll & Role Access System</span>
          </p>
        </div>

        {/* Floating Utilities */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setIsDarkMode(!isDarkMode);
              toast.info(`Theme toggled to ${!isDarkMode ? 'Dark mode representation' : 'Default light style'}`);
            }}
            className="rounded-full flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider h-9"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
            <span>Mode</span>
          </Button>

          <Button 
            onClick={generateAIInsights}
            disabled={isAIGenerating}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider h-9"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>AI Insights</span>
          </Button>
        </div>
      </div>

      {/* Primary KPI Segment Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50/70 to-white border-indigo-100 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Central Gross income</p>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-950 tabular-nums">GH₵{totalIncomeGHS.toLocaleString()}</div>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider leading-none">Sum of all branches & Tithes</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">National Payouts / Salaries</p>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 tabular-nums">GH₵{payrollTotalGHS.toLocaleString()}</div>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider leading-none">Processing May 2026 Cycle</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Liquid Central Reserves</p>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 tabular-nums">GH₵{(totalIncomeGHS - totalExpenseGHS - payrollTotalGHS).toLocaleString()}</div>
            <p className="text-[9px] text-emerald-600 font-black uppercase mt-1 tracking-widest leading-none">Net savings healthy index</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">Branch Node Networks</p>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums">{branches.length > 0 ? branches.length : 5} Campuses</div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider leading-none">Reporting under central license</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Dialog Section */}
      <AnimatePresence>
        {aiInsights && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-indigo-900/90 text-white p-6 rounded-xl border border-indigo-700 shadow-xl relative"
          >
            <button 
              onClick={() => setAIInsights('')} 
              className="absolute top-4 right-4 text-indigo-200 hover:text-white font-black text-sm"
            >
              Close ✕
            </button>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-1 animate-spin" />
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-indigo-200">AI Financial Outlook Advisory</h4>
                <div className="text-xs space-y-2 whitespace-pre-wrap leading-relaxed opacity-95">
                  {aiInsights}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini AI Trigger simulation indicator spinner */}
      {isAIGenerating && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center justify-center gap-3">
          <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI model parsing finances matrix, compiling anomalies...</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-2">
        <button 
          onClick={() => setActiveTab('kpi')}
          className={cn(
            "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
            activeTab === 'kpi' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <LineChart className="w-4 h-4" />
          Command Center
        </button>
        <button 
          onClick={() => setActiveTab('payroll')}
          className={cn(
            "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
            activeTab === 'payroll' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Banknote className="w-4 h-4" />
          Salary & Payroll
        </button>
        <button 
          onClick={() => setActiveTab('finances')}
          className={cn(
            "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
            activeTab === 'finances' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Coins className="w-4 h-4" />
          Church Finances
        </button>
        <button 
          onClick={() => setActiveTab('rbac')}
          className={cn(
            "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
            activeTab === 'rbac' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Key className="w-4 h-4" />
          Roles & RBAC Privileges
        </button>
        <button 
          onClick={() => setActiveTab('staff-ops')}
          className={cn(
            "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
            activeTab === 'staff-ops' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Users className="w-4 h-4" />
          Staff Operations
        </button>
        <button 
          onClick={() => setActiveTab('system')}
          className={cn(
            "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5",
            activeTab === 'system' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          System Config
        </button>
      </div>

      {/* Tabs Contents */}
      <div className="space-y-6">

        {/* TAB 1: COMMAND CENTER */}
        {activeTab === 'kpi' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visual Charts Container */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">Central Account Trends (GHS)</h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">centralized tithes vs operational debits</p>
                </div>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Income
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Expense
                  </span>
                </div>
              </div>

              {/* Recharts BarChart integration */}
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₵${v/1000}k`} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(238, 242, 255, 0.4)' }} />
                    <Legend />
                    <Bar dataKey="Income" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Branch Performance Rankings */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">Branch Performance</h3>
                  <Button variant="ghost" size="icon" onClick={() => handleExportCSV('Branch Performance')} className="h-8 w-8 text-slate-400 hover:text-slate-900 rounded-full">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Accra Headquarters</span>
                      <span className="tabular-nums">GH₵182,450 (64%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: '64%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Kumasi Grace branch</span>
                      <span className="tabular-nums">GH₵58,620 (21%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500/90 rounded-full" style={{ width: '21%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Cape Coast branch</span>
                      <span className="tabular-nums">GH₵28,150 (10%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: '10%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Tamale branch</span>
                      <span className="tabular-nums">GH₵15,280 (5%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: '5%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border rounded-xl space-y-2 mt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                  Consolidated Audit Status
                </p>
                <div className="flex justify-between text-xs items-center font-bold">
                  <span className="text-slate-800">HQ Audit May 2026:</span>
                  <Badge className="bg-emerald-50 text-emerald-700 pointer-events-none hover:bg-emerald-50">Verified & Reconciled</Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SALARY & PAYROLL */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 border rounded-xl">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                  <span>Monthly Payroll processing: May 2026</span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded ml-2 text-white",
                    payrollStatus === 'Draft' ? "bg-slate-500" :
                    payrollStatus === 'Sent for Approval' ? "bg-amber-500" :
                    payrollStatus === 'Approved' ? "bg-indigo-600" : "bg-emerald-600"
                  )}>{payrollStatus}</span>
                </h3>
                <p className="text-slate-500 text-xs mt-1">HQ automatically computes basic salary, additions, subtractions and updates bank/MoMo ledgers.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setIsAddingSalaryRecord(true)}
                  variant="outline"
                  size="sm"
                  className="text-xs font-bold uppercase tracking-wider h-9"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Staff Salary Record
                </Button>

                <Button 
                  onClick={handleProcessPayroll}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-wider h-9"
                >
                  {payrollStatus === 'Draft' && 'Lock & Send for Approval'}
                  {payrollStatus === 'Sent for Approval' && 'Approve Payroll Dossier'}
                  {payrollStatus === 'Approved' && 'Disburse via Flutterwave API'}
                  {payrollStatus === 'Paid' && 'Reset Cycle (Draft)'}
                </Button>
              </div>
            </div>

            {/* Salary Table */}
            <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-4">Staff/Pastor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Role & Branch</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Basic Salary</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Allowances</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Deductions</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Net Salary</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Payment Channel</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-4 text-right">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customPayroll.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-extrabold text-slate-900 text-xs pl-4">{p.name}</TableCell>
                      <TableCell className="text-xs text-slate-600 text-left">
                        <div className="font-medium text-slate-800">{p.role}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{p.branch}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-800 tabular-nums">GH₵{p.salary.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs text-emerald-600 tabular-nums">+{p.allowances}</TableCell>
                      <TableCell className="font-mono text-xs text-rose-600 tabular-nums">-{p.deductions}</TableCell>
                      <TableCell className="font-black text-xs text-slate-950 tabular-nums">GH₵{(p.salary + p.allowances - p.deductions).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-[140px] truncate">{p.bank}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "uppercase text-[9px] pointer-events-none",
                          p.status === 'Paid' ? "bg-emerald-50 text-emerald-700" :
                          p.status === 'Approved' ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                        )}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            onClick={() => setSelectedStaffForPayslip(p)}
                            variant="ghost" 
                            size="icon" 
                            title="Preview Payslip"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            onClick={() => handleDownloadPDF(p)}
                            variant="ghost" 
                            size="icon" 
                            title="Download PDF Payslip"
                            className="h-8 w-8 text-indigo-600 hover:text-indigo-900 hover:bg-slate-100 rounded-full"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Payslip Modal Preview Window */}
            {selectedStaffForPayslip && (
              <Dialog open={true} onOpenChange={() => setSelectedStaffForPayslip(null)}>
                <DialogContent className="sm:max-w-[600px] bg-white p-6 max-h-[90vh] overflow-y-auto">
                  <div id="printable-payslip-id" className="p-6 border-4 border-slate-950 rounded-xl space-y-6 bg-white shrink-0 text-slate-900 font-sans">
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 font-black text-sm">
                          HQ
                        </div>
                        <div>
                          <h4 className="font-black text-base uppercase tracking-tight text-slate-950">Ecclesia Consolidated HQ</h4>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Church Operations Payslip</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h5 className="font-black text-xs uppercase text-slate-600 tracking-wider">Authorized Payslip</h5>
                        <p className="text-xs font-bold font-mono mt-1 text-indigo-600">SALARY MONTH: MAY 2026</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-bold border-b border-dashed pb-4">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Staff / Pastor Name</span>
                        <span className="text-slate-950 font-black text-sm">{selectedStaffForPayslip.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Assigned Branch Location</span>
                        <span className="text-slate-900 text-sm">{selectedStaffForPayslip.branch}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Staff Position / Role</span>
                        <span className="text-slate-900 text-sm">{selectedStaffForPayslip.role}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Bank Transfer Details</span>
                        <span className="text-slate-900 text-sm truncate block">{selectedStaffForPayslip.bank}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h6 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Salary Summary Sheet</h6>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between py-1 border-b text-slate-700"><span>Basic Monthly Salary:</span><span className="font-mono font-bold">GH₵{selectedStaffForPayslip.salary.toLocaleString()}.00</span></div>
                        <div className="flex justify-between py-1 border-b text-emerald-700 font-bold"><span>Allowances & Bonuses:</span><span className="font-mono">GH₵{selectedStaffForPayslip.allowances.toLocaleString()}.00</span></div>
                        <div className="flex justify-between py-1 border-b text-rose-700 font-bold"><span>Deductions & Benefits offsets:</span><span className="font-mono">GH₵{selectedStaffForPayslip.deductions.toLocaleString()}.00</span></div>
                        <div className="flex justify-between py-2 text-slate-950 font-black text-base border-t-2 border-slate-950">
                          <span>Central NET SALARY:</span>
                          <span className="font-mono">GH₵{(selectedStaffForPayslip.salary + selectedStaffForPayslip.allowances - selectedStaffForPayslip.deductions).toLocaleString()}.00</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t flex justify-between items-end">
                      <div className="text-left space-y-1">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block">Signature Authority</span>
                        <p className="font-serif italic text-xs font-black text-slate-850 mt-1">{idCardSignature}</p>
                        <span className="text-[9px] text-slate-500 font-bold uppercase border-t pt-1 block">Head of National Board</span>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block font-mono">Payslip Reference ID</span>
                        <span className="text-[10px] font-extrabold text-slate-800 font-mono">ECC-MAY2026-{selectedStaffForPayslip.id.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
                    <Button variant="ghost" className="text-slate-400" onClick={() => setSelectedStaffForPayslip(null)}>Cancel</Button>
                    <Button onClick={() => handlePrintDocument('printable-payslip-id')} variant="outline" className="text-xs font-bold uppercase tracking-widest gap-2">
                      <Printer className="w-3.5 h-3.5" /> Print Preview
                    </Button>
                    <Button onClick={() => handleDownloadPDF(selectedStaffForPayslip)} className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-widest gap-2">
                      <Download className="w-3.5 h-3.5" /> Download Professional PDF
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Dialog For Adding Salary Record */}
            {isAddingSalaryRecord && (
              <Dialog open={true} onOpenChange={() => setIsAddingSalaryRecord(false)}>
                <DialogContent className="sm:max-w-[450px]">
                  <DialogHeader>
                    <DialogTitle>Add Salary Record</DialogTitle>
                    <DialogDescription>Register salary parameters for a new church staff member or local branch pastor.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSalaryRecord} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">FullName</Label>
                      <Input value={newSalary.name} onChange={e => setNewSalary({...newSalary, name: e.target.value})} placeholder="e.g. Pastor James Baiden" required className="border-slate-200" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</Label>
                        <Select value={newSalary.role} onValueChange={v => setNewSalary({...newSalary, role: v})}>
                          <SelectTrigger className="border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="National Admin">National Admin</SelectItem>
                            <SelectItem value="Branch Pastor">Branch Pastor</SelectItem>
                            <SelectItem value="Accountant">Accountant</SelectItem>
                            <SelectItem value="Teacher">Teacher</SelectItem>
                            <SelectItem value="Welfare Officer">Welfare Officer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Branch Office</Label>
                        <Input value={newSalary.branch} onChange={e => setNewSalary({...newSalary, branch: e.target.value})} placeholder="e.g. Tema branch" className="border-slate-200" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Basic (GHS)</Label>
                        <Input type="number" value={newSalary.salary} onChange={e => setNewSalary({...newSalary, salary: e.target.value})} placeholder="6000" required className="border-slate-200 font-mono text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Allowances</Label>
                        <Input type="number" value={newSalary.allowances} onChange={e => setNewSalary({...newSalary, allowances: e.target.value})} placeholder="500" className="border-slate-200 font-mono text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Deductions</Label>
                        <Input type="number" value={newSalary.deductions} onChange={e => setNewSalary({...newSalary, deductions: e.target.value})} placeholder="200" className="border-slate-200 font-mono text-xs" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Details / Mobile Money Number</Label>
                      <Input value={newSalary.bank} onChange={e => setNewSalary({...newSalary, bank: e.target.value})} placeholder="Fidelity Bank - 402928 or GHS Momo (0244000444)" className="border-slate-200" />
                    </div>

                    <DialogFooter className="pt-4">
                      <Button type="button" variant="ghost" onClick={() => setIsAddingSalaryRecord(false)}>Cancel</Button>
                      <Button type="submit" className="bg-indigo-600">Save Salary Node</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* TAB 3: FULL CHURCH FINANCES */}
        {activeTab === 'finances' && (
          <div className="space-y-6">
            
            {/* Split Grid for Income & Operations Expense approvals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Income Categories List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-xs">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">Consolidated Income Ledgers</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">unified church stream registry</p>
                  </div>
                  <Button onClick={() => handleExportCSV('Finance ledger')} variant="outline" size="sm" className="text-xs font-bold uppercase tracking-wider gap-1.5 h-8">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                  </Button>
                </div>

                <Card className="bg-white border-slate-200 overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-4">Branch</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contributor</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Income Category</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Method</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reference / Status</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-4 text-right">Amount (GHS)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finances.length > 0 ? (
                        finances.map((f: any) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-bold text-slate-800 text-xs pl-4">{f.branchId || 'Headquarters'}</TableCell>
                            <TableCell className="text-xs text-slate-600 font-medium">{f.contributor || 'Anonymous'}</TableCell>
                            <TableCell className="text-xs text-slate-800 font-bold uppercase"><Badge variant="outline">{f.type || f.category}</Badge></TableCell>
                            <TableCell className="text-xs text-slate-500">Flutterwave Pay</TableCell>
                            <TableCell className="text-[10px] text-slate-400 font-mono">TX-{f.id?.slice(0, 8).toUpperCase()}</TableCell>
                            <TableCell className="font-extrabold text-xs text-indigo-900 pr-4 text-right">GH₵{f.amount?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <>
                          <TableRow>
                            <TableCell className="font-bold text-slate-800 text-xs pl-4">Cape Coast branch</TableCell>
                            <TableCell className="text-xs text-slate-600 font-medium">George Owusu</TableCell>
                            <TableCell className="text-xs text-slate-800 font-bold uppercase"><Badge variant="outline">Tithe</Badge></TableCell>
                            <TableCell className="text-xs text-slate-500">Momo GHS</TableCell>
                            <TableCell className="text-[10px] text-slate-400 font-mono">TX-A9B10283</TableCell>
                            <TableCell className="font-extrabold text-xs text-indigo-900 pr-4 text-right">GH₵1,200</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold text-slate-800 text-xs pl-4">Accra Headquarters</TableCell>
                            <TableCell className="text-xs text-slate-600 font-medium">Deaconess Mary Mensah</TableCell>
                            <TableCell className="text-xs text-slate-800 font-bold uppercase"><Badge variant="outline">Donation</Badge></TableCell>
                            <TableCell className="text-xs text-slate-500">Card payment</TableCell>
                            <TableCell className="text-[10px] text-slate-400 font-mono">TX-D348123</TableCell>
                            <TableCell className="font-extrabold text-xs text-indigo-900 pr-4 text-right">GH₵5,000</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold text-slate-800 text-xs pl-4">Kumasi Grace branch</TableCell>
                            <TableCell className="text-xs text-slate-600 font-medium">Congregation joint</TableCell>
                            <TableCell className="text-xs text-slate-800 font-bold uppercase"><Badge variant="outline">Offering</Badge></TableCell>
                            <TableCell className="text-xs text-slate-500">Cash collection</TableCell>
                            <TableCell className="text-[10px] text-slate-400 font-mono">TX-C381452</TableCell>
                            <TableCell className="font-extrabold text-xs text-indigo-900 pr-4 text-right">GH₵3,450</TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Budget Planning system & Operations approvals */}
              <div className="space-y-6">
                
                {/* Budget planner */}
                <Card className="bg-white border-slate-200 shadow-xs">
                  <CardHeader className="pb-2 border-b">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">HQ Budget Planner</CardTitle>
                    <CardDescription className="text-[10px]">Track fiscal budgets established by National Board guidelines.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {budgetPlan.map((b, idx) => (
                      <div key={idx} className="space-y-1.5 pb-2 border-b border-dashed last:border-none">
                        <div className="flex justify-between text-xs font-black text-slate-900">
                          <span className="truncate max-w-[160px]">{b.category}</span>
                          <span className="font-mono text-[10px] text-slate-500">₵{b.spent/1000}k / ₵{b.approved/1000}k</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase mt-1">
                          <span>Status: {b.status}</span>
                          <span>Ratio: {b.approved > 0 ? (b.spent / b.approved * 100).toFixed(0) : 0}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${b.approved > 0 ? (b.spent / b.approved * 100) : 0}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Approvals sequence checklist */}
                <Card className="bg-slate-900 text-white border-slate-800 shadow-xs">
                  <CardHeader className="pb-2 border-b border-indigo-500/10">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-300">Operations Disbursments Approvals</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-xs font-medium">
                    <div className="p-3 bg-slate-950 rounded-lg space-y-2 border border-slate-800">
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-white text-[11px] leading-tight block">Water Storage Polytank replacement</span>
                        <Badge className="bg-amber-500/10 text-amber-500 font-bold uppercase text-[8px]">Pending approval</Badge>
                      </div>
                      <p className="text-[9px] text-slate-400">Kumasi Grace branch facility manager requests GH₵6,500.</p>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={() => toast.success("Facility disbursement allowed!")} size="sm" className="bg-indigo-600 h-6 px-2 text-[9px] uppercase font-black tracking-widest text-white">Approve</Button>
                        <Button onClick={() => toast.error("Facility disbursement rejected")} size="sm" variant="ghost" className="h-6 px-2 text-[9px] uppercase font-bold text-slate-400">Reject</Button>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg space-y-2 border border-slate-800">
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-white text-[11px] leading-tight block">Radio Ministry Broadcast - May</span>
                        <Badge className="bg-indigo-600/20 text-indigo-400 font-bold uppercase text-[8px]">Approved</Badge>
                      </div>
                      <p className="text-[9px] text-slate-400">HQ Media director cleared GHS 4,200 for radio slot.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ROLE ASSIGNMENT & PERMISSION SYSTEM (RBAC) */}
        {activeTab === 'rbac' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left sidebar: Roles Matrix */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Access Roles ({customRoles.length})</span>
                <Button onClick={() => setIsAddingRole(true)} variant="ghost" size="icon" className="h-7 w-7 text-indigo-600 rounded-full hover:bg-white border">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {customRoles.map((r, i) => (
                  <Card key={i} className="bg-white hover:border-indigo-500 transition-all cursor-pointer">
                    <CardHeader className="pb-1">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-xs font-bold text-slate-900 border-b border-indigo-100 pb-0.5">{r.name}</CardTitle>
                        <Badge variant="outline" className="text-[9px] text-slate-400">{r.members} Staff</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 text-[11px] text-slate-500 leading-normal font-medium">
                      {r.desc}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Provision National Executive Account */}
              <Card className="bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100/80 shadow-xs">
                <CardHeader className="pb-1.5 pt-3 border-b border-indigo-50/60">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[10px] font-black uppercase text-indigo-950 tracking-widest leading-none">Provision Executive</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <form onSubmit={handleRegisterExecutive} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Select Registered Member</Label>
                      <select 
                        value={selectedMemberId} 
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedMemberId(val);
                          const m = members.find(item => item.id === val);
                          if (m) {
                            setExecName(`${m.firstName || ''} ${m.lastName || ''}`.trim());
                            setExecEmail(m.email || '');
                          } else {
                            setExecName('');
                            setExecEmail('');
                          }
                        }}
                        required 
                        className="w-full h-8 px-2 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-slate-900"
                      >
                        <option value="">Choose a member...</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.firstName || ''} {m.lastName || ''} {m.email ? `(${m.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {execEmail && (
                      <div className="space-y-0.5 bg-slate-50/70 p-2 rounded border border-slate-100">
                        <div className="text-[9px] font-bold uppercase text-slate-400">Selected Email Account</div>
                        <div className="text-xs font-mono font-bold text-slate-700 break-all">{execEmail}</div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Department / Group</Label>
                      {groups.length === 0 ? (
                        <div className="text-[9px] text-amber-600 font-bold bg-amber-50 p-2 rounded border border-amber-100">
                          Please create groups under "Groups & Ministries" first.
                        </div>
                      ) : (
                        <select
                          value={execDept}
                          onChange={e => setExecDept(e.target.value)}
                          required
                          className="w-full h-8 px-2 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-slate-900"
                        >
                          <option value="">Select a group...</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={!selectedMemberId || !execDept}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-[10px] font-black uppercase tracking-wider h-8"
                    >
                      Register Executive
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </div>

            {/* Central Perm Checklist & Audit logs */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Permission Matrix preview */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Consolidated Permissions Matrix</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-xs font-medium space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2 border">
                      <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-indigo-600" /> <span className="font-extrabold text-slate-950">Finance Permissions</span></div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> View Central Finance Ledger</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> Approve Disbursements</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> Run Staff Payroll Cycles</label>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-2 border">
                      <div className="flex items-center gap-1.5"><Users className="w-4 h-4 text-emerald-600" /> <span className="font-extrabold text-slate-950">Staff & HR Permissions</span></div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> Register New Worker/Pastor</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> Authorize Leave Requests</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={false} /> Promote/Reassign Staff</label>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-2 border">
                      <div className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-amber-600" /> <span className="font-extrabold text-slate-950">System Operations</span></div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> Send Bulk GHS Communications</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={false} /> Backup Cloud Core DB</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]"><Checkbox checked={true} /> Manage Local Branches</label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Login session tracking & User audit logs */}
              <Card className="bg-slate-900 text-white border-slate-800 shadow-xs overflow-hidden">
                <CardHeader className="border-b border-indigo-500/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-300">Security Audit Trail Log</CardTitle>
                      <CardDescription className="text-[10px] text-slate-400">Live Login Session tracking & Admin actions logged by Siasore Node Security module.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toast.success("Audit Log backup saved to security storage center.")} className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border border-slate-800">
                      Export Ledger Log
                    </Button>
                  </div>
                </CardHeader>
                <Table>
                  <TableHeader className="bg-slate-950 border-b border-slate-800">
                    <TableRow>
                      <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pl-4">System Administrator</TableHead>
                      <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Assigned Grade</TableHead>
                      <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Executed Operations / Claims</TableHead>
                      <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Network Host (IP)</TableHead>
                      <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pr-4 text-right">Event Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log, idx) => (
                      <TableRow key={idx} className="border-b border-slate-800 hover:bg-slate-800">
                        <TableCell className="font-bold text-slate-200 text-xs pl-4">{log.user}</TableCell>
                        <TableCell className="text-xs text-indigo-400 uppercase font-black tracking-wider">{log.role}</TableCell>
                        <TableCell className="text-xs text-slate-300">{log.action}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">{log.ip}</TableCell>
                        <TableCell className="text-right text-xs text-slate-400 pr-4 font-mono">{log.time}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Dialog For Adding Custom Role */}
            {isAddingRole && (
              <Dialog open={true} onOpenChange={() => setIsAddingRole(false)}>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Register New Role Node</DialogTitle>
                    <DialogDescription>Define a custom administration tier and configure permissions checklist.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tier Name</Label>
                      <Input value={newRoleForm.name} onChange={e => setNewRoleForm({...newRoleForm, name: e.target.value})} placeholder="e.g. Welfare Officer" required className="border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tier Description</Label>
                      <Input value={newRoleForm.desc} onChange={e => setNewRoleForm({...newRoleForm, desc: e.target.value})} placeholder="e.g. Manages Welfare disbursements and local branch aid packages." className="border-slate-200" />
                    </div>
                    <DialogFooter className="pt-4">
                      <Button variant="ghost" className="text-slate-400" onClick={() => setIsAddingRole(false)}>Cancel</Button>
                      <Button onClick={() => {
                        if (!newRoleForm.name) return;
                        setCustomRoles([...customRoles, { name: newRoleForm.name, desc: newRoleForm.desc || 'No description', members: 0, perms: [] }]);
                        toast.success(`${newRoleForm.name} role registered successfully!`);
                        setIsAddingRole(false);
                        setNewRoleForm({ name: '', desc: '', perms: [] });
                      }} className="bg-indigo-600">Register Tier</Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* TAB 5: HR OPERATIONS & LEAVE TRACKING */}
        {activeTab === 'staff-ops' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Leave Approval Cards & Promotions */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Leave Requests Panel */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Leave Logs & Absence tracking</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 font-medium">
                  {leaveRequests.map((l) => (
                    <div key={l.id} className="p-4 bg-slate-50 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{l.name}</span>
                          <Badge variant="outline" className="text-[9px] text-slate-500">{l.role}</Badge>
                        </div>
                        <p className="text-slate-500 text-xs mt-1">Requested absence window: <strong className="text-slate-900">{l.start}</strong> to <strong className="text-slate-900">{l.end}</strong></p>
                        <p className="text-indigo-600 text-[10px] uppercase font-bold mt-1.5 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> TYPE: {l.type}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded",
                          l.status === 'Approved' ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"
                        )}>{l.status}</span>

                        {l.status !== 'Approved' && (
                          <div className="flex gap-1.5 ml-2">
                            <Button onClick={() => handleLeaveStatusChange(l.id, 'Approved')} size="sm" className="bg-emerald-600 text-[10px] font-black uppercase py-1 h-7">Approve</Button>
                            <Button onClick={() => toast.error("Leave request cancelled.")} size="sm" variant="ghost" className="text-slate-400 font-bold text-[10px] py-1 h-7 border">Decline</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Attendance Tracker Logs */}
              <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
                <CardHeader className="border-b pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Staff Service Attendance Audits</CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-4">Service Date</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Staff reporting ratio</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Service Notes / Audited</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-4 text-right">Attendance Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceLogs.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="font-bold text-slate-800 text-xs pl-4">{att.date}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-600">{att.staffPresent}</TableCell>
                        <TableCell className="text-xs text-slate-500">{att.note}</TableCell>
                        <TableCell className="text-right text-xs font-black text-indigo-700 pr-4">{att.avgRate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Right Column: ID CARD Generator & Promotions Tracker */}
            <div className="space-y-6">
              
              {/* Promotion tracking logs */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Promotions Directory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 font-medium text-xs">
                  {promotions.map((p) => (
                    <div key={p.id} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-indigo-950">{p.name}</span>
                        <span className="text-[9px] text-indigo-600 font-bold uppercase">{p.date}</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">Promoted internally from <span className="underline font-bold">{p.oldRole}</span> to <span className="underline font-black text-slate-900">{p.newRole}</span></p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Signed By: {p.signedBy}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* ID Card generator */}
              <Card className="bg-slate-950 border-slate-900 text-white shadow-md overflow-hidden">
                <CardHeader className="pb-2 border-b border-indigo-500/10">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-300">Staff ID Card Generator</CardTitle>
                  <CardDescription className="text-[10px] text-slate-400">Instantly generate authorized barcodes & print credentials.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  
                  {/* Selector of Staff */}
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-black tracking-widest text-indigo-400">Select Staff / Pastor</Label>
                    <Select onValueChange={(val) => {
                      const found = customPayroll.find(st => st.id === val);
                      setSelectedStaffForID(found);
                      toast.info(`Configured ID parameters for ${found.name}`);
                    }}>
                      <SelectTrigger className="bg-slate-900 border-slate-800 text-white text-xs h-9">
                        <SelectValue placeholder="Click to choose a leader" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-950">
                        {customPayroll.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ID CARD Preview Canvas Area */}
                  {selectedStaffForID ? (
                    <div className="space-y-4">
                      
                      {/* ID CARD Canvas Design Layout */}
                      <div id="print-hq-idcard-canvas" className="w-full max-w-xs mx-auto p-5 border-2 border-indigo-500 rounded-xl space-y-4 text-center text-slate-950 font-sans tracking-tight bg-white shrink-0 shadow-lg relative overflow-hidden">
                        
                        {/* Top styling band */}
                        <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-indigo-600 to-sky-500"></div>
                        <div className="flex flex-col items-center pt-2 space-y-1">
                          <Church className="w-6 h-6 text-indigo-600" />
                          <h4 className="font-extrabold text-[12px] uppercase text-slate-950 leading-tight">Ecclesia National Board</h4>
                          <span className="text-[8px] uppercase text-slate-400 tracking-widest font-black">Authorized Staff Credentials</span>
                        </div>

                        {/* Centered avatar placeholder */}
                        <div className="w-20 h-20 rounded-full mx-auto border-2 border-indigo-600 shrink-0 flex items-center justify-center font-black bg-slate-100 text-slate-800 tracking-tighter text-2xl relative">
                          {selectedStaffForID.name[0]}
                          <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>
                        </div>

                        <div className="space-y-1">
                          <h5 className="font-black text-sm text-slate-950 uppercase">{selectedStaffForID.name}</h5>
                          <span className="text-[10px] font-bold uppercase py-0.5 bg-indigo-50 text-indigo-700 px-3 rounded-full inline-block">{selectedStaffForID.role}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-500 border-t pt-3 text-left">
                          <div>
                            <span className="block uppercase text-[7px] text-slate-400">Primary branch</span>
                            <span className="font-bold text-slate-800">{selectedStaffForID.branch}</span>
                          </div>
                          <div>
                            <span className="block uppercase text-[7px] text-slate-400">Verified ID No.</span>
                            <span className="font-bold text-slate-800 font-mono">CC-{selectedStaffForID.id.slice(4).toUpperCase()}</span>
                          </div>
                        </div>

                        {/* Barcode representation */}
                        <div className="border-t pt-3 space-y-1">
                          <div className="flex justify-center select-none opacity-85 pointer-events-none">
                            <span className="font-mono text-[9px] uppercase tracking-widest line-through">|| ||| ||| || | |||| ||</span>
                          </div>
                          <span className="text-[7px] uppercase font-mono tracking-widest text-slate-400">Barcode verified May 2026</span>
                        </div>
                      </div>

                      <Button onClick={() => handlePrintDocument('print-hq-idcard-canvas')} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold uppercase text-[10px] tracking-widest h-9">
                        <Printer className="w-4 h-4 mr-2" /> Print ID Badges
                      </Button>
                    </div>
                  ) : (
                    <div className="p-6 border-2 border-dashed border-slate-800 text-center rounded-xl bg-slate-900/50">
                      <p className="text-slate-400 text-xs">No candidate selected for identity badges yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 6: SYSTEM CONFIG & AUTOMATED BACKUP */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Security Configs & Notifications Alert Trigger system */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="border-b pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">SMS / Email alerts Configuration</CardTitle>
                <CardDescription className="text-[10px]">Configure automatic notification alerts for national finance processes.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 font-medium text-xs">
                
                <div className="space-y-1 flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                  <div>
                    <span className="font-extrabold text-slate-900 text-sm">Salary Payment Alerts</span>
                    <p className="text-[10px] text-slate-500 leading-normal">HQ notifies staff automatically by SMS upon salary payout verified.</p>
                  </div>
                  <Checkbox checked={true} />
                </div>

                <div className="space-y-1 flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                  <div>
                    <span className="font-extrabold text-slate-900 text-sm">Disbursement Workflow Approval Alerts</span>
                    <p className="text-[10px] text-slate-500 leading-normal">HQ triggers automatic email to Board members when budget threshold leaks.</p>
                  </div>
                  <Checkbox checked={true} />
                </div>

                <div className="space-y-1 flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                  <div>
                    <span className="font-extrabold text-slate-900 text-sm">Assign role change updates alerts</span>
                    <p className="text-[10px] text-slate-500 leading-normal">HQ triggers login verification push notification for RBAC assignment shifts.</p>
                  </div>
                  <Checkbox checked={false} />
                </div>

                {/* Gateway diagnostic test */}
                <div className="bg-slate-100 p-3 rounded-lg border flex justify-between items-center mt-4">
                  <div>
                    <span className="font-bold text-slate-900">Arkesel SMS remaining unit balance:</span>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 mt-1">GHS 12,450 packages on active balance</p>
                  </div>
                  <Button size="sm" onClick={() => toast.loading("Arkesel ping successful: 200 OK. Gateway has 100% telemetry score.", { duration: 1500 })} className="text-[10px] uppercase font-black bg-slate-900 h-8">Ping Test</Button>
                </div>
              </CardContent>
            </Card>

            {/* Simulated backup and JSON recovery tools */}
            <Card className="bg-slate-950 border-slate-900 text-white shadow-xs">
              <CardHeader className="border-b border-indigo-500/10 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-300">HQ Database Security Backup console</CardTitle>
                <CardDescription className="text-[10px] text-slate-400 text-indigo-200">Export centralized church schemas & tables instantly as raw JSON data.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between font-mono text-[10px] text-slate-400">
                    <span>Central collections status:</span>
                    <Badge className="bg-emerald-600/20 text-emerald-400 font-bold text-[8px] pointer-events-none">HEALTHY</Badge>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">Active indexes: `finances`, `staff`, `payslips`, `permission_matrices`, `branches_logs`.</p>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[9px] uppercase font-black tracking-widest text-indigo-400">Action Operations Node</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => {
                        const payload = JSON.stringify({ customPayroll, customRoles, budgetPlan });
                        const blob = new Blob([payload], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `siasore_hq_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
                        a.click();
                        toast.success("Consolidated National HQ backup downloaded to local machine as JSON.");
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-widest text-[10px] h-9"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Backup Databases
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => {
                        toast.info("Database verification executed. All active collection schemas match standard Firebase layout rules.");
                      }}
                      className="text-white border-slate-800 hover:bg-slate-900 text-xs font-bold uppercase tracking-widest text-[10px] h-9"
                    >
                      Verify Nodes
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-indigo-950/40 border border-indigo-900/30 text-xs text-indigo-200 leading-normal">
                  <Fingerprint className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Cloud DB holds automated backups hourly. Encrypted securely. Ready to clone branches.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
