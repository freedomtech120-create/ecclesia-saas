import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, Branch } from '../types';
import { useAuth } from './AuthContext';

export interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
}

interface TenantContextType {
  tenant: Tenant | null;
  effectiveTenantId: string | null;
  currentBranchId: string | null;
  setCurrentBranchId: (id: string | null) => void;
  loading: boolean;
  branches: Branch[];
  impersonateTenant: (tenantId: string | null) => void;
  isImpersonating: boolean;
  subscriptionStatus: SubscriptionStatus;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  effectiveTenantId: null,
  currentBranchId: null,
  setCurrentBranchId: () => {},
  loading: true,
  branches: [],
  impersonateTenant: () => {},
  isImpersonating: false,
  subscriptionStatus: { isActive: false, isTrial: true, isExpired: false, daysRemaining: 7 },
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { profile, isSuperAdmin } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [impersonatedTenantId, setImpersonatedTenantId] = useState<string | null>(localStorage.getItem('impersonatedTenantId'));
  const [loading, setLoading] = useState(true);

  const subscriptionStatus = (() => {
    // If the logged in user is the super-admin or app owner, subscription is always fully active and never trial/expired.
    if (isSuperAdmin) {
      return { isActive: true, isTrial: false, isExpired: false, daysRemaining: 99999 };
    }

    if (!tenant) return { isActive: false, isTrial: false, isExpired: false, daysRemaining: 0 };
    
    const isPaid = tenant.subscriptionTier !== 'free';
    if (isPaid) return { isActive: true, isTrial: false, isExpired: false, daysRemaining: 0 };

    const createdAt = tenant.createdAt?.toDate?.() || new Date(tenant.createdAt) || new Date();
    const trialDuration = 7 * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(createdAt.getTime() + trialDuration);
    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    const isExpired = diff <= 0;

    return {
      isActive: !isExpired,
      isTrial: true,
      isExpired,
      daysRemaining
    };
  })();

  const impersonateTenant = (tenantId: string | null) => {
    if (tenantId) {
      localStorage.setItem('impersonatedTenantId', tenantId);
    } else {
      localStorage.removeItem('impersonatedTenantId');
    }
    setImpersonatedTenantId(tenantId);
  };

  const effectiveTenantId = (isSuperAdmin && impersonatedTenantId) ? impersonatedTenantId : profile?.tenantId || null;

  useEffect(() => {
    async function loadTenantData() {
      if (effectiveTenantId) {
        setLoading(true);
        try {
          const tenantDoc = await getDoc(doc(db, 'tenants', effectiveTenantId));
          if (tenantDoc.exists()) {
            setTenant({ id: tenantDoc.id, ...tenantDoc.data() } as Tenant);
          }
          
          // In a real app, we'd query the branches subcollection or global branches
          // For now, we'll implement a service to fetch this.
        } catch (error) {
          console.error("Error loading tenant data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setTenant(null);
        setLoading(false);
      }
    }

    loadTenantData();
  }, [effectiveTenantId]);

  const value = {
    tenant,
    effectiveTenantId,
    currentBranchId,
    setCurrentBranchId,
    loading,
    branches,
    impersonateTenant,
    isImpersonating: !!(isSuperAdmin && impersonatedTenantId),
    subscriptionStatus,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
