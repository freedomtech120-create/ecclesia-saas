import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, Branch } from '../types';
import { useAuth } from './AuthContext';

interface TenantContextType {
  tenant: Tenant | null;
  currentBranchId: string | null;
  setCurrentBranchId: (id: string | null) => void;
  loading: boolean;
  branches: Branch[];
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  currentBranchId: null,
  setCurrentBranchId: () => {},
  loading: true,
  branches: [],
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenantData() {
      if (profile?.tenantId) {
        setLoading(true);
        try {
          const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
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
  }, [profile?.tenantId]);

  const value = {
    tenant,
    currentBranchId,
    setCurrentBranchId,
    loading,
    branches,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
