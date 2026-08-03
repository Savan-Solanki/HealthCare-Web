'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  getDoctorPath,
  getHospitalAdminPath,
  getReceptionistPath,
  DOCTOR_BASE_PATH,
  HOSPITAL_ADMIN_BASE_PATH,
  RECEPTIONIST_BASE_PATH,
} from '@/lib/routes';

export type HospitalWorkspacePortal = 'hospital-admin' | 'receptionist' | 'doctor';

type HospitalWorkspaceValue = {
  portal: HospitalWorkspacePortal;
  basePath: string;
  portalLabel: string;
  homePath: string;
  getPath: (path?: string) => string;
  canViewDashboard: boolean;
  canManageDoctors: boolean;
  canManageDepartments: boolean;
  canManageStaff: boolean;
};

const HospitalWorkspaceContext = createContext<HospitalWorkspaceValue | null>(null);

const workspaceConfigs: Record<HospitalWorkspacePortal, Omit<HospitalWorkspaceValue, 'getPath'>> = {
  'hospital-admin': {
    portal: 'hospital-admin',
    basePath: HOSPITAL_ADMIN_BASE_PATH,
    portalLabel: 'Hospital Admin',
    homePath: getHospitalAdminPath(),
    canViewDashboard: true,
    canManageDoctors: true,
    canManageDepartments: true,
    canManageStaff: true,
  },
  receptionist: {
    portal: 'receptionist',
    basePath: RECEPTIONIST_BASE_PATH,
    portalLabel: 'Receptionist',
    homePath: getReceptionistPath('/patients'),
    canViewDashboard: false,
    canManageDoctors: false,
    canManageDepartments: false,
    canManageStaff: false,
  },
  doctor: {
    portal: 'doctor',
    basePath: DOCTOR_BASE_PATH,
    portalLabel: 'Doctor',
    homePath: getDoctorPath('/patients'),
    canViewDashboard: false,
    canManageDoctors: false,
    canManageDepartments: false,
    canManageStaff: false,
  },
};

export function HospitalWorkspaceProvider({
  portal,
  children,
}: {
  portal: HospitalWorkspacePortal;
  children: ReactNode;
}) {
  const value = useMemo<HospitalWorkspaceValue>(() => {
    const config = workspaceConfigs[portal];
    const getPath =
      portal === 'receptionist'
        ? getReceptionistPath
        : portal === 'doctor'
          ? getDoctorPath
          : getHospitalAdminPath;
    return { ...config, getPath };
  }, [portal]);

  return (
    <HospitalWorkspaceContext.Provider value={value}>{children}</HospitalWorkspaceContext.Provider>
  );
}

export function useHospitalWorkspace() {
  const context = useContext(HospitalWorkspaceContext);
  if (!context) {
    throw new Error('useHospitalWorkspace must be used within HospitalWorkspaceProvider');
  }
  return context;
}
