import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Church } from 'lucide-react';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [churchName, setChurchName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncUser(result.user);
      toast.success('Successfully signed in!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncUser = async (user: any, additionalData: any = {}) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // First time user - create default profile
      let role = additionalData.role || (additionalData.churchName ? 'church-admin' : 'member');
      let tenantId = additionalData.tenantId || (additionalData.staffData?.tenantId) || null;
      
      if (additionalData.churchName) {
        // Create Tenant if church name provided (Registration flow)
        const tenantRef = doc(db, 'tenants', crypto.randomUUID());
        tenantId = tenantRef.id;
        await setDoc(tenantRef, {
          name: additionalData.churchName,
          slug: additionalData.churchName.toLowerCase().replace(/\s+/g, '-'),
          status: 'active',
          subscriptionTier: 'free',
          adminId: user.uid,
          createdAt: serverTimestamp(),
        });
      }

      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || displayName,
        role: role,
        tenantId: tenantId,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (signInError: any) {
        // If user not found, check if they are a staff member with a temporary password
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          const claimDoc = await getDoc(doc(db, 'staff_claims', email.toLowerCase()));
          
          if (claimDoc.exists()) {
            const claimData = claimDoc.data();
            if (claimData.tempPassword === password) {
              // Valid temporary password - create the real auth account
              const result = await createUserWithEmailAndPassword(auth, email, password);
              await updateProfile(result.user, { 
                displayName: `${claimData.firstName} ${claimData.lastName}` 
              });
              
              // syncUser will handle the rest
              await syncUser(result.user, { 
                role: claimData.role,
                tenantId: claimData.tenantId
              });
              
              toast.success('Account claimed successfully!');
              navigate('/dashboard');
              return;
            }
          }
        }
        throw signInError;
      }
      
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await syncUser(result.user, { churchName });
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-2 border-primary/10">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Church className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome to Siasore</CardTitle>
          <CardDescription>Manage your church with ease and excellence.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register Church</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegistration} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="churchName">Church Name</Label>
                <Input id="churchName" placeholder="Grace Community Church" value={churchName} onChange={(e) => setChurchName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Admin Name</Label>
                <Input id="displayName" placeholder="John Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regEmail">Work Email</Label>
                <Input id="regEmail" type="email" placeholder="admin@church.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regPassword">Password</Label>
                <Input id="regPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Registers Church & Admin'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-neutral-500">Or continue with</span>
          </div>
        </div>

        <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignIn} disabled={loading}>
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z"
            />
          </svg>
          Google
        </Button>
      </CardContent>
    </Card>
  );
}
