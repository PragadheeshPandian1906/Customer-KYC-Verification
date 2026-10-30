import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  LayoutDashboard,
  FolderKanban,
  Users,
  CheckSquare2,
  User,
  X,
  FileCheck2,
  ScrollText,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { isCustomer, isAnalyst, isSupervisor, isAdmin } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: true,
    },
    {
      label: isCustomer ? 'My KYC Cases' : isAnalyst ? 'Assigned Cases' : 'KYC Cases',
      to: '/cases',
      icon: <FolderKanban className="w-4 h-4" />,
      visible: !isAdmin,
    },
    {
      label: 'Pending Approvals',
      to: '/approvals',
      icon: <CheckSquare2 className="w-4 h-4" />,
      visible: isSupervisor,
    },
    {
      label: 'Audit Events',
      to: '/admin/audit-events',
      icon: <ScrollText className="w-4 h-4" />,
      visible: isAdmin,
    },
    {
      label: isCustomer ? 'Customer Directory' : 'Customers',
      to: '/customers',
      icon: <Users className="w-4 h-4" />,
      visible: isAnalyst || isSupervisor,
    },
    {
      label: 'My Profile',
      to: '/profile',
      icon: <User className="w-4 h-4" />,
      visible: true,
    },
  ];

  return (
    <aside className="flex flex-col h-full w-64 border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100 dark:border-slate-800/80">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">KYC Trust</span>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 -mt-1">Compliance</span>
          </div>
        </NavLink>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Operations
        </div>
        {navItems
          .filter((item) => item.visible)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all select-none',
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/70 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                )
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
      </div>

      {/* Compliance / System Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <FileCheck2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Spring Security Session Active</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          Audited & AES-256 Encrypted
        </p>
      </div>
    </aside>
  );
}
