import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  CreditCard,
  Settings,
  HelpCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity,
  Globe,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/transactions', label: 'Transactions', icon: CreditCard },
  { 
    path: '/compliance', 
    label: 'Compliance', 
    icon: Shield,
    subItems: [
      { path: '/compliance', label: 'MLRO Flags', icon: AlertTriangle },
      { path: '/compliance/reports', label: 'Compliance Reports', icon: FileText },
    ]
  },
  { path: '/operations', label: 'Operations', icon: Activity },
  { 
    path: '/integration-results', 
    label: 'Integration', 
    icon: Globe,
    subItems: [
      { path: '/integration-results?tab=kyc', label: 'KYC', icon: Users },
      { path: '/integration-results?tab=aml', label: 'AML', icon: Shield },
      { path: '/integration-results?tab=payments', label: 'Payments', icon: CreditCard },
      { path: '/integration-results?tab=payouts', label: 'Payouts', icon: Activity },
      { path: '/integration-results?tab=jobs', label: 'Background Jobs', icon: RefreshCw },
      { path: '/integration-results?tab=webhooks', label: 'Webhooks', icon: Globe },
    ]
  },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/support', label: 'Support', icon: HelpCircle },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, mobileOpen, onMobileClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (path: string) => {
    setExpandedItems(prev => 
      prev.includes(path) 
        ? prev.filter(item => item !== path)
        : [...prev, path]
    );
  };

  const handleSubItemClick = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Parse URL parameters for Integration Results
    if (path.includes('integration-results?tab=')) {
      const urlParams = new URLSearchParams(path.split('?')[1]);
      const tab = urlParams.get('tab');
      navigate('/integration-results');
      
      // Set the tab after navigation
      setTimeout(() => {
        const event = new CustomEvent('setIntegrationTab', { detail: tab });
        window.dispatchEvent(event);
      }, 100);
    } else {
      navigate(path);
    }
    
    if (onMobileClose) onMobileClose();
  };

  const isItemActive = (path: string, subItems?: any[]) => {
    if (location.pathname === path) return true;
    if (subItems) {
      return subItems.some(sub => location.pathname === sub.path);
    }
    return false;
  };

  return (
    <>
      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-sidebar-bg z-50 transform transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 flex flex-col`}
      >
        {/* Mobile Header */}
        <div className="flex items-center h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-white font-bold text-xl">Mercii</span>
          </div>
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-sidebar-text hover:text-white transition-all duration-300"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.path, item.subItems);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedItems.includes(item.path);

            return (
              <div key={item.path}>
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      toggleExpanded(item.path);
                    } else {
                      navigate(item.path);
                      if (onMobileClose) onMobileClose();
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-blue-600/20 text-white'
                      : 'text-sidebar-text hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                  )}
                  <Icon
                    size={20}
                    className={`flex-shrink-0 transition-colors duration-200 ${
                      isActive ? 'text-blue-400' : 'group-hover:text-blue-400'
                    }`}
                  />
                  <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">
                    {item.label}
                  </span>
                  {hasSubItems && (
                    <ChevronRight 
                      size={16} 
                      className={`transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                </button>
                
                {/* Sub-items */}
                {hasSubItems && isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.subItems!.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location.pathname === subItem.path;
                      
                      return (
                        <button
                          key={subItem.path}
                          onClick={(e) => handleSubItemClick(subItem.path, e)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                            isSubActive
                              ? 'bg-blue-600/10 text-blue-400'
                              : 'text-sidebar-text/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <SubIcon size={16} />
                          <span className="text-xs font-medium whitespace-nowrap">
                            {subItem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile User Section */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {user?.firstName?.charAt(0) || 'A'}
                {user?.lastName?.charAt(0) || 'D'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-sidebar-text truncate capitalize">
                {user?.role || 'Admin'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-text hover:bg-white/10 hover:text-red-400 transition-colors w-full"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 h-full bg-sidebar-bg z-40 sidebar-transition flex flex-col ${
          isOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo / Brand */}
        <div className="flex items-center h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            {isOpen && (
              <span className="text-white font-bold text-xl whitespace-nowrap animate-fade-in">
                Mercii
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className={`ml-auto p-1.5 rounded-lg hover:bg-white/10 text-sidebar-text hover:text-white transition-all duration-300 ${
              !isOpen ? 'rotate-180' : ''
            }`}
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.path, item.subItems);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedItems.includes(item.path);

            return (
              <div key={item.path}>
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      toggleExpanded(item.path);
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-blue-600/20 text-white'
                      : 'text-sidebar-text hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                  )}
                  <Icon
                    size={20}
                    className={`flex-shrink-0 transition-colors duration-200 ${
                      isActive ? 'text-blue-400' : 'group-hover:text-blue-400'
                    }`}
                  />
                  {isOpen && (
                    <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">
                      {item.label}
                    </span>
                  )}
                  {isOpen && hasSubItems && (
                    <ChevronRight 
                      size={16} 
                      className={`transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                  {!isOpen && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                    </div>
                  )}
                </button>
                
                {/* Sub-items */}
                {hasSubItems && isExpanded && isOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.subItems!.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location.pathname === subItem.path;
                      
                      return (
                        <button
                          key={subItem.path}
                          onClick={(e) => handleSubItemClick(subItem.path, e)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                            isSubActive
                              ? 'bg-blue-600/10 text-blue-400'
                              : 'text-sidebar-text/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <SubIcon size={16} />
                          <span className="text-xs font-medium whitespace-nowrap">
                            {subItem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-white/10 p-3">
          <div className={`flex items-center gap-3 px-2 py-2 ${!isOpen ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {user?.firstName?.charAt(0) || 'A'}
                {user?.lastName?.charAt(0) || 'D'}
              </span>
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-sidebar-text truncate capitalize">
                  {user?.role || 'Admin'}
                </p>
              </div>
            )}
            {isOpen && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-white/10 text-sidebar-text hover:text-red-400 transition-colors animate-fade-in"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
