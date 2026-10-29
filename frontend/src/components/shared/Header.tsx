import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Moon, Sun, LogOut, Menu, UserCircle } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const roleLabel = (role?: string) => {
    switch (role) {
      case 'COMPLIANCE_SUPERVISOR':
        return 'Compliance Supervisor';
      case 'KYC_ANALYST':
        return 'KYC Analyst';
      case 'CUSTOMER':
        return 'Customer Portal';
      case 'API_CLIENT_ADMIN':
        return 'API Administrator';
      default:
        return role || 'User';
    }
  };

  const roleVariant = (role?: string) => {
    switch (role) {
      case 'COMPLIANCE_SUPERVISOR':
        return 'purple' as const;
      case 'KYC_ANALYST':
        return 'blue' as const;
      case 'CUSTOMER':
        return 'emerald' as const;
      default:
        return 'slate' as const;
    }
  };

  const primaryRole = user?.roles?.[0];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 md:px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 transition-colors">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 md:hidden"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Badge variant={roleVariant(primaryRole)} size="sm">
            {roleLabel(primaryRole)}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Info */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <UserCircle className="w-5 h-5 text-slate-400" />
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
              {user?.displayName || 'User'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
              {user?.email}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          isLoading={isLoggingOut}
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
          className="text-xs"
        >
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
