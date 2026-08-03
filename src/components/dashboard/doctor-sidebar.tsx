'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  CircleDollarSign,
  FilePlus2,
  FlaskConical,
  LayoutDashboard,
  ShieldCheck,
  Syringe,
  UserPlus,
  UsersRound,
  Bed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDoctorPath } from '@/lib/routes';

const navItems = [
  { href: getDoctorPath(), label: 'Dashboard', icon: LayoutDashboard },
  { href: getDoctorPath('/patients'), label: 'Add Patient', icon: UserPlus },
  { href: getDoctorPath('/my-patients'), label: 'My Patients', icon: UsersRound },
  { href: getDoctorPath('/appointments'), label: 'Appointments', icon: CalendarDays },
  { href: getDoctorPath('/prescription'), label: 'Prescription', icon: FilePlus2 },
  { href: getDoctorPath('/lab-results'), label: 'Lab Results', icon: FlaskConical },
  { href: getDoctorPath('/certificates'), label: 'Certificates', icon: ShieldCheck },
  { href: getDoctorPath('/vaccination'), label: 'Vaccination', icon: Syringe },
  { href: getDoctorPath('/receipts'), label: 'Receipts', icon: CircleDollarSign },
];

export function DoctorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-primary">
            <Image
              src="/logo.jpg"
              alt="healthcare Logo"
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">healthcare</p>
            <p className="text-xs font-medium text-primary">Doctor</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-gray-50 hover:text-foreground'
                )}
              >
                <Icon size={16} className={cn(isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
