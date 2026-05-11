export type UserRole = 'super-admin' | 'church-admin' | 'pastor' | 'worker' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId?: string;
  branchIds?: string[];
  photoURL?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'trial';
  subscriptionTier: 'free' | 'basic' | 'premium';
  logoUrl?: string;
  adminId: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  settings?: {
    primaryColor?: string;
    fontFamily?: string;
    theme?: 'light' | 'dark' | 'system';
  };
  createdAt: any;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  pastorId?: string;
}
