import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Video, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  Bell, 
  User as UserIcon, 
  Menu, 
  X,
  ShieldCheck,
  Cpu
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  socketConnected: boolean;
  aiEngineStatus: boolean;
  unreadCount: number;
  onOpenNotifications: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPage,
  setCurrentPage,
  socketConnected,
  aiEngineStatus,
  unreadCount,
  onOpenNotifications
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cameras', label: 'Camera Config', icon: Video },
    { id: 'events', label: 'Event History', icon: History },
    { id: 'settings', label: 'System Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-dark-800 border-r border-white/5 p-4 flex-shrink-0">
        <div className="flex items-center gap-2 px-2 py-4 mb-6">
          <ShieldCheck className="h-8 w-8 text-blue-500 animate-pulse" />
          <div>
            <h1 className="font-bold text-lg leading-none tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              SENTINEL AI
            </h1>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">Surveillance</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-blue-400' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* System Health */}
        <div className="bg-dark-900/60 rounded-xl p-3 border border-white/5 space-y-3 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> Socket Connection
            </span>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> AI Engine
            </span>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${aiEngineStatus ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-orange-500 shadow-[0_0_8px_#f97316]'}`} />
          </div>
        </div>

        {/* User profile / Logout */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm text-white">
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold max-w-[120px] truncate">{user?.username}</p>
              <span className="text-[10px] text-gray-500 uppercase">{user?.role}</span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between bg-dark-800 border-b border-white/5 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-blue-500" />
          <h1 className="font-bold text-md tracking-wider bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            SENTINEL AI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenNotifications}
            className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-dark-900/95 backdrop-blur-md pt-20 px-6 flex flex-col">
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 text-gray-400"
          >
            <X className="h-6 w-6" />
          </button>
          <nav className="flex-1 space-y-4 text-center">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-medium ${
                    active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/5 py-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="text-left leading-tight">
                <p className="font-semibold">{user?.username}</p>
                <span className="text-xs text-gray-500 uppercase">{user?.role}</span>
              </div>
            </div>
            <button 
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-medium w-full justify-center"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <header className="hidden md:flex items-center justify-between bg-dark-800 border-b border-white/5 px-8 py-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-100 capitalize">
              {menuItems.find(i => i.id === currentPage)?.label || 'System'}
            </h2>
            <div className="flex items-center gap-2 bg-dark-900 border border-white/5 rounded-full px-3 py-1 text-xs">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-400">{socketConnected ? 'Real-time Linked' : 'Offline Mode'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenNotifications}
              className="relative p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors border border-white/5"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-[-2px] right-[-2px] h-4 w-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 border-l border-white/5 pl-4">
              <UserIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300 font-medium">{user?.username}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
export default Layout;
