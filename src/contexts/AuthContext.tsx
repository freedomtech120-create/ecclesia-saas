import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        setLoading(true);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        unsubscribeProfile = onSnapshot(userDocRef, async (profileDoc) => {
          let profileData: any = null;
          const docExists = profileDoc.exists();
          
          if (docExists) {
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
            try {
              const staffQuery = query(collection(db, 'staff'), where('email', '==', firebaseUser.email));
              const staffSnap = await getDocs(staffQuery);
              
              if (!staffSnap.empty) {
                const staffDoc = staffSnap.docs[0].data();
                
                // Auto-provision users record if missing
                if (!docExists) {
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
            } catch (err) {
              console.warn("Security policy: staff query skipped or not permitted yet:", err);
            }
          }
          
          setProfile(profileData);
          
          // Wait briefly during registration/signup flow to let document resolve
          if (!docExists && !profileData) {
            const timer = setTimeout(() => {
              setLoading(false);
            }, 3000);
            return () => clearTimeout(timer);
          } else {
            setLoading(false);
          }
        }, (error) => {
          console.error("Error in profile snapshot:", error);
          setLoading(false);
        });

      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
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
