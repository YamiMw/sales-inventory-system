/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dashboard
 * Implements the reusable dashboard UI component.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  Users, 
  LogOut, 
  Search, 
  Bell, 
  ChevronDown,
  RefreshCcw,
  Download,
  Calendar,
  MoreHorizontal,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  X,
  UserCog,
  Settings2,
  Shuffle,
  Info as InfoIcon,
  XCircle,
  User as UserIcon,
  Mail,
  Shield,
  Loader2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { User } from '../types';
import Inventory from './Inventory';
import Products from './Products';
import Sales from './Sales';
import Customers from './Customers';
import Reports from './Reports';
import UserManagement from './UserManagement';
import Settings from './Settings';
import { useNotifications } from '../contexts/NotificationContext';
import { storage } from '../lib/storage';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onOpenPOS: () => void;
}

export default function Dashboard({ user, onLogout, onOpenPOS }: DashboardProps) {
  const { history, unreadCount, markAllRead, clearHistory } = useNotifications();
  const [activeRange, setActiveRange] = useState<'Week' | 'Month' | 'Year' | 'Last 30 Days' | 'Custom'>('Month');
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'inventory' | 'sales' | 'customers' | 'reports' | 'users' | 'settings'>('overview');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Firestore Data State
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [usersInfo, setUsersInfo] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(() => storage.getSettings());
  const currencySymbol = 'K';

  useEffect(() => {
    const loadData = () => {
      setOrders(storage.getOrders());
      setProducts(storage.getProducts());
      setCustomers(storage.getCustomers());
      setUsersInfo(storage.getUsers());
      setSettings(storage.getSettings());
      setIsLoading(false);
    };

    loadData();
    window.addEventListener('storage_update', loadData);
    return () => window.removeEventListener('storage_update', loadData);
  }, []);

  // Stats Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    
    const todayOrders = orders.filter(o => {
      const dateStr = o.timestamp?.toDate ? o.timestamp.toDate().toLocaleDateString() : 
                     (o.timestamp instanceof Date ? o.timestamp.toLocaleDateString() : 
                     (typeof o.timestamp === 'string' ? new Date(o.timestamp).toLocaleDateString() : ''));
      return dateStr === todayStr;
    });
    const todaySales = todayOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);

    const monthOrders = orders.filter(o => {
      const date = o.timestamp?.toDate ? o.timestamp.toDate() : 
                  (o.timestamp instanceof Date ? o.timestamp : 
                  (typeof o.timestamp === 'string' ? new Date(o.timestamp) : null));
      return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const monthlySales = monthOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);

    const inventoryValue = products.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.stock || 0)), 0);
    const lowStock = products.filter(p => (p.stock || 0) <= 5).length;

    return {
      todaySales,
      todayCount: todayOrders.length,
      monthlySales,
      monthlyCount: monthOrders.length,
      inventoryValue,
      lowStock,
      productCount: products.length,
      customerCount: customers.length
    };
  }, [orders, products, customers]);

  // Chart Data Generation from real orders
  const chartData = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStr = d.toLocaleDateString();
      
      const dayOrders = orders.filter(o => {
        const dateStr = o.timestamp?.toDate ? o.timestamp.toDate().toLocaleDateString() : 
                       (o.timestamp instanceof Date ? o.timestamp.toLocaleDateString() : 
                       (typeof o.timestamp === 'string' ? new Date(o.timestamp).toLocaleDateString() : ''));
        return dateStr === dayStr;
      });
      const dayTotal = dayOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
      
      days.push({ label: dayLabel, sales: dayTotal });
    }
    return days;
  }, [orders]);

  const recentTransactions = useMemo(() => {
    return orders.slice(0, 5).map(o => {
      let timeStr = 'Pending';
      if (o.timestamp) {
        const date = o.timestamp?.toDate ? o.timestamp.toDate() : 
                    (o.timestamp instanceof Date ? o.timestamp : 
                    (typeof o.timestamp === 'string' ? new Date(o.timestamp) : null));
        if (date) {
          timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
      
      return {
        time: timeStr,
        id: (o.id || '').substring(0, 8).toUpperCase(),
        customer: o.customerName || 'Walk-in Customer',
        items: o.items?.length || 0,
        total: o.total || 0,
        status: o.status || 'completed'
      };
    });
  }, [orders]);

  const lowStockThreshold = products
    .filter(p => p.stock <= 10)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans antialiased text-[#111827]">
      {/* Sidebar - Same as before but updated with theme */}
      <aside className="w-64 bg-white border-r border-[#E5E7EB] hidden xl:flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 bg-[#dc2626] rounded-xl flex items-center justify-center shadow-sm">
            <Package className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-[#dc2626] text-lg tracking-tight">Nexus Inventory</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6">
          <NavItem 
            icon={<BarChart3 size={19} />} 
            label="Dashboard" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
          />
          <NavItem icon={<ShoppingCart size={19} />} label="POS System" onClick={onOpenPOS} highlight />
          <NavItem 
            icon={<Package size={19} />} 
            label="Products" 
            active={activeTab === 'products'}
            onClick={() => setActiveTab('products')}
          />
          <NavItem 
            icon={<Shuffle size={19} />} 
            label="Inventory" 
            active={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
          />
          <NavItem 
            icon={<FileText size={19} />} 
            label="Sales & Invoices" 
            active={activeTab === 'sales'}
            onClick={() => setActiveTab('sales')}
          />
          <NavItem 
            icon={<Users size={19} />} 
            label="Customers" 
            active={activeTab === 'customers'}
            onClick={() => setActiveTab('customers')}
          />
          <NavItem 
            icon={<FileText size={19} />} 
            label="Reports" 
            active={activeTab === 'reports'}
            onClick={() => setActiveTab('reports')}
          />
          {user.role === 'Admin' && (
            <NavItem 
              icon={<UserCog size={19} />} 
              label="User Management" 
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
            />
          )}
          <NavItem 
            icon={<Settings2 size={19} />} 
            label="Settings" 
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={19} />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        {/* Header toolbar */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 shrink-0 relative z-10 shadow-sm shadow-gray-100/50">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold tracking-tight capitalize">{activeTab}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Refresh Data">
              <RefreshCcw size={18} />
            </button>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Export as PDF/CSV">
              <Download size={18} />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markAllRead();
                }}
                className={`p-2 rounded-lg transition-all relative ${
                  showNotifications ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:bg-gray-100'
                }`}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifications(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden flex flex-col"
                    >
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Recent Activity</span>
                        <div className="flex gap-2">
                           {history.length > 0 && (
                             <button 
                              onClick={clearHistory}
                              className="text-[9px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-tighter"
                            >
                              Clear All
                            </button>
                           )}
                           <button 
                            onClick={() => setShowNotifications(false)}
                            className="text-gray-400 hover:text-gray-900"
                           >
                            <X size={14} />
                           </button>
                        </div>
                      </div>
                      
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {history.length > 0 ? (
                          <div className="divide-y divide-gray-50">
                            {history.map((n) => (
                              <div key={n.id} className="p-4 hover:bg-gray-50/80 transition-all flex gap-3">
                                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                  {
                                    success: 'bg-emerald-50 text-emerald-600',
                                    warning: 'bg-amber-50 text-amber-600',
                                    error: 'bg-red-50 text-red-600',
                                    info: 'bg-blue-50 text-blue-600'
                                  }[n.type]
                                }`}>
                                  {{
                                    success: <CheckCircle2 size={16} />,
                                    warning: <AlertTriangle size={16} />,
                                    error: <XCircle size={16} />,
                                    info: <InfoIcon size={16} />
                                  }[n.type]}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-gray-900 truncate">{n.title}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight line-clamp-2">{n.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-12 text-center text-gray-400">
                            <Bell size={32} className="mx-auto opacity-10 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-widest opacity-40">No new alerts</p>
                          </div>
                        )}
                      </div>

                      {history.length > 0 && (
                        <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
                          <button className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-widest">
                            View All Notifications
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-3 p-1.5 pr-3 rounded-xl transition-all ${
                  showUserMenu ? 'bg-gray-100 ring-1 ring-gray-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#111827] flex items-center justify-center text-white font-black text-xs uppercase shadow-lg shadow-gray-200">
                  {user.fullName ? user.fullName.charAt(0) : user.username.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[10px] font-black text-gray-900 leading-none uppercase tracking-wider">{user.fullName || user.username}</p>
                  <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">{user.role}</p>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden"
                    >
                      {/* User Info Header */}
                      <div className="p-5 bg-gray-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#dc2626] flex items-center justify-center text-white font-black text-sm uppercase">
                            {user.fullName ? user.fullName.charAt(0) : user.username.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate tracking-tight">{user.fullName || user.username}</p>
                            <p className="text-[10px] font-bold text-gray-400 truncate tracking-widest uppercase">{user.username}</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                           <div className="flex items-center gap-2 text-gray-500">
                             <Mail size={12} className="shrink-0" />
                             <span className="text-[10px] font-bold truncate">{user.email || 'no-email@nexus.com'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-blue-600">
                             <Shield size={12} className="shrink-0" />
                             <span className="text-[10px] font-black uppercase tracking-widest">{user.role} Authority</span>
                           </div>
                           <div className="flex items-center gap-2 text-gray-400">
                             <Calendar size={12} className="shrink-0" />
                             <span className="text-[10px] font-bold">Session: {new Date().toLocaleDateString()}</span>
                           </div>
                        </div>
                      </div>

                      {/* Dropdown Options */}
                      <div className="p-2">
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all group">
                          <UserIcon size={16} className="text-gray-400 group-hover:text-[#dc2626]" />
                          My Profile
                        </button>
                        <button 
                          onClick={() => {
                            setActiveTab('settings');
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all group"
                        >
                          <Settings2 size={16} className="text-gray-400 group-hover:text-[#dc2626]" />
                          Account Settings
                        </button>
                      </div>

                      <div className="p-2 border-t border-gray-100 bg-gray-50/30">
                        <button 
                          onClick={() => {
                            setShowUserMenu(false);
                            onLogout();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all group"
                        >
                          <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-8 pb-12">
          <div className="max-w-[1600px] mx-auto space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* ... contents of overview ... */}
                  {/* Stat Cards Grid - 2 Rows of 4 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard 
                      label="Today" 
                      value={`${currencySymbol}${stats.todaySales.toFixed(2)}`} 
                      detail={`${stats.todayCount} transactions`} 
                      icon={<ShoppingCart className="text-blue-500" size={16} />}
                    />
                    <StatCard 
                      label="This Month" 
                      value={`${currencySymbol}${stats.monthlySales.toFixed(2)}`} 
                      detail={`${stats.monthlyCount} transactions`} 
                      icon={<BarChart3 className="text-purple-500" size={16} />}
                    />
                    <StatCard 
                      label="Low Stock" 
                      value={stats.lowStock.toString()} 
                      detail="Items <= 5" 
                      icon={<AlertTriangle className="text-amber-500" size={16} />}
                      variant={stats.lowStock > 0 ? "warning" : "default"}
                    />
                    <StatCard 
                      label="Products" 
                      value={stats.productCount.toString()} 
                      detail="Total in Catalog" 
                      icon={<Package className="text-emerald-500" size={16} />}
                    />
                    <StatCard 
                      label="Inventory Value" 
                      value={`${currencySymbol}${stats.inventoryValue.toFixed(2)}`} 
                      detail="Based on unit prices" 
                      icon={<BarChart3 className="text-indigo-500" size={16} />}
                    />
                    <StatCard 
                      label="Customers" 
                      value={stats.customerCount.toString()} 
                      detail="Profiles in system" 
                      icon={<Users className="text-pink-500" size={16} />}
                    />
                    <StatCard 
                      label="Pending Orders" 
                      value={orders.filter(o => o.status === 'pending').length.toString()} 
                      detail="Items to fulfill" 
                      icon={<FileText className="text-orange-500" size={16} />}
                    />
                    <StatCard 
                      label="Staff Members" 
                      value={usersInfo.length.toString()} 
                      detail="Users in system" 
                      icon={<Shield className="text-red-500" size={16} />}
                    />
                  </div>

                  {/* Main Charts View */}
                  <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <h3 className="text-base font-bold text-gray-900 tracking-tight">Sales Trend (Last 7 Days)</h3>
                        </div>
                    </div>
                    <div className="h-[400px] w-full p-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.05}/>
                              <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F1" />
                          <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }} 
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }} 
                            tickFormatter={(val) => `${currencySymbol}${val}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: '1px solid #E5E7EB', 
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                              padding: '12px'
                            }}
                            itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="sales" 
                            stroke="#dc2626" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorSales)" 
                            dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#dc2626' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Bottom Grid: Top Products vs Low Stock */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Placeholder for Dynamic Top Products */}
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-base font-bold text-gray-900 tracking-tight">🏆 Recently Sold</h3>
                        <button className="text-xs font-bold text-gray-400 hover:text-gray-900" onClick={() => setActiveTab('sales')}>View All</button>
                      </div>
                      <div className="space-y-4">
                        {orders.slice(0, 5).map((order, idx) => (
                           <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-100 shadow-sm">
                                  <Package size={18} className="text-gray-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{order.customerName || 'Walk-in Customer'}</p>
                                  <p className="text-[10px] text-gray-400">{order.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-gray-900">{currencySymbol}{order.total?.toFixed(2)}</span>
                           </div>
                        ))}
                        {orders.length === 0 && (
                          <div className="py-20 text-center text-gray-400 text-sm italic border-2 border-dashed border-gray-100 rounded-2xl">
                             No sales recorded yet.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Low Stock Alert */}
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-base font-bold text-gray-900 tracking-tight">⚠️ Low Stock Alert</h3>
                        <button className="text-xs font-bold text-gray-400 hover:text-gray-900" onClick={() => setActiveTab('products')}>View All</button>
                      </div>
                      <div className="space-y-1">
                        {lowStockThreshold.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                            <div className="flex items-center gap-4">
                              <div className={`w-2.5 h-2.5 rounded-full border ${
                                item.stock === 0 ? 'bg-red-500 border-red-200' : 'bg-amber-500 border-amber-200'
                              }`} />
                              <div>
                                <h4 className="text-sm font-bold text-gray-900">{item.name}</h4>
                                <p className="text-[10px] font-bold text-gray-400 tracking-wider">SKU: {item.sku} • Stock: {item.stock}</p>
                              </div>
                            </div>
                            <button className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-lg hover:bg-black transition-all">
                              Reorder
                            </button>
                          </div>
                        ))}
                        {lowStockThreshold.length === 0 && (
                           <div className="py-16 text-center text-gray-400 text-sm italic">
                             All items have sufficient stock.
                           </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions Table */}
                  <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900 tracking-tight">🕐 Recent Transactions</h3>
                      <button className="text-xs font-bold text-gray-400 hover:text-gray-900" onClick={() => setActiveTab('sales')}>View All</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                          <tr>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invoice #</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Items</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {recentTransactions.map((tx, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-all group">
                              <td className="px-8 py-4 text-xs font-medium text-gray-500">{tx.time}</td>
                              <td className="px-8 py-4 text-xs font-bold text-gray-900">{tx.id}</td>
                              <td className="px-8 py-4 text-sm font-semibold text-gray-700">{tx.customer}</td>
                              <td className="px-8 py-4 text-xs font-bold text-gray-500">{tx.items}</td>
                              <td className="px-8 py-4 text-sm font-bold text-gray-900">{currencySymbol}{tx.total.toFixed(2)}</td>
                              <td className="px-8 py-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700">
                                  <CheckCircle2 size={12} />
                                  {tx.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {recentTransactions.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-8 py-10 text-center text-gray-400 text-sm italic">
                                No recent transactions.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'products' && (
                <motion.div
                  key="products"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Products />
                </motion.div>
              )}
              {activeTab === 'inventory' && (
                <motion.div
                  key="inventory"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Inventory />
                </motion.div>
              )}
              {activeTab === 'sales' && (
                <motion.div
                  key="sales"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Sales />
                </motion.div>
              )}
              {activeTab === 'customers' && (
                <motion.div
                  key="customers"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Customers />
                </motion.div>
              )}
              {activeTab === 'reports' && (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Reports />
                </motion.div>
              )}
              {activeTab === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <UserManagement />
                </motion.div>
              )}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Settings />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ 
  icon, 
  label, 
  active = false, 
  onClick,
  highlight = false 
}: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  onClick?: () => void,
  highlight?: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-[#dc2626] text-white shadow-lg shadow-gray-200/50' 
          : highlight
            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50/50'
      }`}
    >
      {icon}
      <span className="text-sm font-semibold tracking-tight">{label}</span>
      {active && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
      {highlight && <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
    </button>
  );
}

function StatCard({ 
  label, 
  value, 
  detail, 
  trend, 
  trendUp = false, 
  icon,
  variant = 'default' 
}: { 
  label: string, 
  value: string, 
  detail: string, 
  trend?: string, 
  trendUp?: boolean,
  icon: React.ReactNode,
  variant?: 'default' | 'warning'
}) {
  return (
    <div className={`bg-white p-6 pb-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between ${
      variant === 'warning' ? 'ring-1 ring-amber-100' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-2xl font-bold text-[#dc2626] tracking-tight">{value}</h4>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <span className="text-[10px] font-bold text-gray-400">{detail}</span>
        </div>
      </div>
    </div>
  );
}
