import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Church, CheckCircle2, Heart, UserPlus, Calendar, Info, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PublicFormPage() {
  const { formId } = useParams();
  const [formConfig, setFormConfig] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchForm() {
      if (!formId) return;
      try {
        const docRef = doc(db, 'public_forms', formId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.status !== 'active') {
            setLoading(false);
            return;
          }
          setFormConfig(data);
          
          // Fetch tenant info for logo/name
          const tDoc = await getDoc(doc(db, 'tenants', data.tenantId));
          if (tDoc.exists()) setTenant(tDoc.data());
        }
      } catch (err) {
        console.error("Public fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchForm();
  }, [formId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId || !formConfig) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'form_responses'), {
        formId,
        tenantId: formConfig.tenantId,
        branchId: formConfig.branchId,
        data: formData,
        submittedAt: serverTimestamp()
      });

      // Special handling for member onboarding: also add to members collection
      if (formConfig.type === 'member-onboarding') {
        await addDoc(collection(db, 'members'), {
          tenantId: formConfig.tenantId,
          branchId: formConfig.branchId,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email || '',
          phone: formData.phone || '',
          status: 'pending', // Mark as pending for review
          createdAt: serverTimestamp(),
          source: 'public-form'
        });
      }

      setSubmitted(true);
      toast.success('Submitted successfully!');
    } catch (err: any) {
      toast.error('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 animate-pulse">
      <div className="w-12 h-12 bg-slate-200 rounded-full mb-4"></div>
      <div className="h-4 w-48 bg-slate-200 rounded mb-2"></div>
      <div className="h-3 w-32 bg-slate-200 rounded"></div>
    </div>
  );

  if (!formConfig) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
      <Card className="max-w-md w-full border-slate-200 text-center p-8">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Form Not Available</h2>
        <p className="text-slate-500 mt-2">This link has either expired or is incorrect. Please contact the administrator.</p>
        <Button variant="outline" className="mt-6" render={<Link to="/">Back to Home</Link>} />
      </Card>
    </div>
  );

  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
        <Card className="max-w-md w-full border-emerald-100 shadow-xl shadow-emerald-50 text-center p-8">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Thank You!</h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
                Your information has been securely sent to <strong>{tenant?.name}</strong>. 
                We are blessed to have you connect with us.
            </p>
            <Button className="w-full bg-slate-900 rounded-xl py-6 font-bold" onClick={() => setSubmitted(false)}>
                Submit Another Response
            </Button>
        </Card>
        <p className="mt-8 text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
            Powered by Ecclesia Platform <Church className="w-3 h-3" />
        </p>
    </div>
  );

  const getIcon = () => {
    switch (formConfig.type) {
        case 'member-onboarding': return <UserPlus className="w-8 h-8 text-indigo-600" />;
        case 'donation': return <Heart className="w-8 h-8 text-rose-500" />;
        case 'event-registration': return <Calendar className="w-8 h-8 text-amber-500" />;
        default: return <Info className="w-8 h-8 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <Church className="w-6 h-6" />
                </div>
                <span className="font-black text-xl tracking-tight text-slate-900 uppercase">{tenant?.name || 'Ecclesia'}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">{formConfig.title}</h1>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">{formConfig.description}</p>
        </div>

        <Card className="border-slate-200 shadow-xl shadow-slate-100 overflow-hidden bg-white">
          <div className="h-2 bg-indigo-600" />
          <CardHeader className="pt-8 text-center border-b border-slate-50 bg-slate-50/30 pb-8">
             <div className="mx-auto mb-2">{getIcon()}</div>
             <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Secure Submission Form</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <form id="public-form" onSubmit={handleSubmit} className="space-y-6">
              {formConfig.type === 'member-onboarding' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">First Name</Label>
                      <Input 
                        required 
                        placeholder="John"
                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                        className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Last Name</Label>
                      <Input 
                        required 
                        placeholder="Doe"
                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                        className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Email Address</Label>
                    <Input 
                      type="email" 
                      placeholder="john@example.com"
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Phone Number</Label>
                    <Input 
                      type="tel" 
                      placeholder="+1 (234) 567-8900"
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Anything we should know?</Label>
                    <textarea 
                      className="w-full h-24 rounded-xl bg-slate-50/50 border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="I'm new in town, I'd like to join the choir, etc."
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </>
              ) : formConfig.type === 'donation' ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Full Name</Label>
                    <Input 
                      required 
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Amount to Support ($)</Label>
                    <Input 
                      type="number" 
                      required 
                      placeholder="0.00"
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="h-12 rounded-xl font-bold text-lg bg-slate-50/50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Purpose of Support</Label>
                    <Input 
                      placeholder="e.g. Building Fund, Tithe, General"
                      onChange={e => setFormData({...formData, purpose: e.target.value})}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                    />
                  </div>
                </>
              ) : (
                <>
                   <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Your Full Name</Label>
                    <Input 
                      required 
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                    />
                  </div>
                   <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Details / Message</Label>
                    <textarea 
                      required
                      className="w-full h-32 rounded-xl bg-slate-50/50 border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Please enter details here..."
                      onChange={e => setFormData({...formData, message: e.target.value})}
                    />
                  </div>
                </>
              )}
            </form>
          </CardContent>
          <CardFooter className="pb-8 pt-4">
            <Button 
                form="public-form"
                type="submit" 
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 rounded-xl text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"
            >
              {submitting ? 'Sending...' : 'Complete Submission'}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-slate-400 text-xs font-medium">
            Your data is protected by Ecclesia Platform. Submitting this form constitutes agreement to {tenant?.name || 'the church'}'s privacy policy.
        </p>
      </div>
    </div>
  );
}
