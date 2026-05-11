import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: (UserProfile & { staffData?: any }) | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPastor: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isPastor: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(UserProfile & { staffData?: any }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user profile from Firestore
        let profileData: any = null;
        let profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (profileDoc.exists()) {
          profileData = profileDoc.data();
        }

        // AUTO-PROMOTE OWNER TO SUPER-ADMIN
        if (firebaseUser.email === 'freedomtech120@gmail.com' && profileData?.role !== 'super-admin') {
           const ownerProfile = {
             ...(profileData || {}),
             uid: firebaseUser.uid,
             email: firebaseUser.email,
             displayName: firebaseUser.displayName || 'App Owner',
             role: 'super-admin',
             tenantId: 'platform',
             status: 'active',
             updatedAt: serverTimestamp()
           };
           
           if (!profileData) {
             ownerProfile.createdAt = serverTimestamp();
           }

           try {
             await setDoc(doc(db, 'users', firebaseUser.uid), ownerProfile, { merge: true });
             profileData = ownerProfile;
           } catch (e) {
             console.error("Error promoting owner to super-admin:", e);
           }
        }

        // Also check if this user is a staff member by email
        if (firebaseUser.email) {
          const staffQuery = query(collection(db, 'staff'), where('email', '==', firebaseUser.email));
          const staffSnap = await getDocs(staffQuery);
          
          if (!staffSnap.empty) {
            const staffDoc = staffSnap.docs[0].data();
            
            // Auto-provision users record if missing
            if (!profileDoc.exists()) {
              const newProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || `${staffDoc.firstName} ${staffDoc.lastName}`,
                tenantId: staffDoc.tenantId,
                role: staffDoc.role, // e.g. 'pastor' or 'worker'
                status: 'active',
                createdAt: serverTimestamp()
              };
              
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
                profileData = newProfile;
              } catch (e) {
                console.error("Error auto-provisioning user profile:", e);
              }
            }

            profileData = {
              ...(profileData || {}),
              staffData: staffDoc
            };
          }
        }
        
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'church-admin' || profile?.role === 'super-admin' || user?.email === 'freedomtech120@gmail.com',
    isSuperAdmin: profile?.role === 'super-admin' || user?.email === 'freedomtech120@gmail.com',
    isPastor: profile?.role === 'pastor' || profile?.staffData?.role === 'pastor',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
