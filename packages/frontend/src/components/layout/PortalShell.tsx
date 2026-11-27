'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  PlusCircle,
  Users,
  CheckSquare,
  Paperclip,
  Clock,
  HelpCircle,
  Bell,
  User,
  Shield,
  Layers,
  Award,
  BookOpen,
  FileCheck,
  Send,
  Eye,
  Settings,
  Scale,
  FolderLock,
  History,
  BarChart3,
  UserCheck,
  Building,
  Menu,
  X,
  ChevronDown,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { MOCK_USERS, MOCK_NOTIFICATIONS } from '../../data/mock-portal-data';

export type PortalRoleType = 'Student' | 'Faculty' | 'Reviewer' | 'Legal' | 'Administrator';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface PortalShellProps {
  role: PortalRoleType;
  currentPath: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isBackendConnected?: boolean;
}

export function PortalShell({
  role,
  currentPath,
  title,
  subtitle,
  actions,
  children,
  isBackendConnected = false
}: PortalShellProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Active user representation based on role
  const currentUser = MOCK_USERS.find((u) => u.role === role) || MOCK_USERS[0];
  const roleNotifications = MOCK_NOTIFICATIONS.filter((n) => n.targetRole === role || n.targetRole === 'Student');
  const unreadCount = roleNotifications.filter((n) => !n.read).length;

  const roleThemes: Record<
    PortalRoleType,
    {
      badgeBg: string;
      badgeText: string;
      accentBg: string;
      hoverBg: string;
      activeBg: string;
      activeText: string;
      portalLabel: string;
      homeUrl: string;
    }
  > = {
    Student: {
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      accentBg: 'bg-blue-600',
      hoverBg: 'hover:bg-blue-50 hover:text-blue-700',
      activeBg: 'bg-blue-600 text-white',
      activeText: 'text-white',
      portalLabel: 'Student Portal',
      homeUrl: '/student/dashboard'
    },
    Faculty: {
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      accentBg: 'bg-emerald-600',
      hoverBg: 'hover:bg-emerald-50 hover:text-emerald-700',
      activeBg: 'bg-emerald-600 text-white',
      activeText: 'text-white',
      portalLabel: 'Faculty Portal',
      homeUrl: '/faculty/dashboard'
    },
    Reviewer: {
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-800',
      accentBg: 'bg-purple-600',
      hoverBg: 'hover:bg-purple-50 hover:text-purple-700',
      activeBg: 'bg-purple-600 text-white',
      activeText: 'text-white',
      portalLabel: 'Reviewer Portal',
      homeUrl: '/reviewer/dashboard'
    },
    Legal: {
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      accentBg: 'bg-amber-600',
      hoverBg: 'hover:bg-amber-50 hover:text-amber-700',
      activeBg: 'bg-amber-600 text-white',
      activeText: 'text-white',
      portalLabel: 'Legal & Patent Portal',
      homeUrl: '/legal/dashboard'
    },
    Administrator: {
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-800',
      accentBg: 'bg-rose-600',
      hoverBg: 'hover:bg-rose-50 hover:text-rose-700',
      activeBg: 'bg-rose-600 text-white',
      activeText: 'text-white',
      portalLabel: 'Admin Governance',
      homeUrl: '/admin/dashboard'
    }
  };

  const theme = roleThemes[role];

  const navigationConfig: Record<PortalRoleType, NavItem[]> = {
    Student: [
      { name: 'Dashboard', href: '/student/dashboard', icon: Layers },
      { name: 'My Disclosures', href: '/student/disclosures', icon: FileText, badge: 2 },
      { name: 'Create Disclosure', href: '/student/create', icon: PlusCircle },
      { name: 'Inventor Management', href: '/student/inventors', icon: Users },
      { name: 'Consent Status', href: '/student/consent', icon: CheckSquare },
      { name: 'Attachments', href: '/student/attachments', icon: Paperclip },
      { name: 'Submission Checklist', href: '/student/checklist', icon: FileCheck },
      { name: 'Submission Tracking', href: '/student/tracking', icon: Clock },
      { name: 'Clarifications', href: '/student/clarifications', icon: HelpCircle },
      { name: 'Notifications', href: '/student/notifications', icon: Bell, badge: unreadCount },
      { name: 'Profile & Settings', href: '/student/profile', icon: User }
    ],
    Faculty: [
      { name: 'Dashboard', href: '/faculty/dashboard', icon: Layers },
      { name: 'Research Disclosures', href: '/faculty/disclosures', icon: BookOpen, badge: 3 },
      { name: 'Create Disclosure', href: '/faculty/create', icon: PlusCircle },
      { name: 'Manage Drafts', href: '/faculty/drafts', icon: FileText },
      { name: 'Inventor Management', href: '/faculty/inventors', icon: Users },
      { name: 'Consent Status', href: '/faculty/consent', icon: CheckSquare },
      { name: 'Attachments', href: '/faculty/attachments', icon: Paperclip },
      { name: 'Submission History', href: '/faculty/history', icon: History },
      { name: 'Notifications', href: '/faculty/notifications', icon: Bell },
      { name: 'Profile & Settings', href: '/faculty/profile', icon: User }
    ],
    Reviewer: [
      { name: 'Dashboard', href: '/reviewer/dashboard', icon: Layers },
      { name: 'Assigned Disclosures', href: '/reviewer/assigned', icon: FileText, badge: 2 },
      { name: 'Pending Reviews', href: '/reviewer/pending', icon: Clock, badge: 1 },
      { name: 'Document Viewer', href: '/reviewer/documents', icon: Eye },
      { name: 'Technical Evaluation', href: '/reviewer/evaluation', icon: Award },
      { name: 'Review Comments', href: '/reviewer/comments', icon: HelpCircle },
      { name: 'Recommendations', href: '/reviewer/recommendations', icon: CheckSquare },
      { name: 'Clarification Requests', href: '/reviewer/clarifications', icon: Send },
      { name: 'Review History', href: '/reviewer/history', icon: History },
      { name: 'Notifications', href: '/reviewer/notifications', icon: Bell },
      { name: 'Profile & Settings', href: '/reviewer/profile', icon: User }
    ],
    Legal: [
      { name: 'Dashboard', href: '/legal/dashboard', icon: Layers },
      { name: 'Reviewed Disclosures', href: '/legal/reviewed', icon: FileCheck, badge: 2 },
      { name: 'Patent Applications', href: '/legal/patents', icon: Scale, badge: 4 },
      { name: 'Patent Filing', href: '/legal/filing', icon: PlusCircle },
      { name: 'Stage Tracking', href: '/legal/stages', icon: Clock },
      { name: 'Patent Documents', href: '/legal/documents', icon: FolderLock },
      { name: 'Application History', href: '/legal/history', icon: History },
      { name: 'Reports', href: '/legal/reports', icon: BarChart3 },
      { name: 'Notifications', href: '/legal/notifications', icon: Bell },
      { name: 'Profile & Settings', href: '/legal/profile', icon: User }
    ],
    Administrator: [
      { name: 'Dashboard', href: '/admin/dashboard', icon: Layers },
      { name: 'User Management', href: '/admin/users', icon: Users, badge: 6 },
      { name: 'Student Management', href: '/admin/students', icon: User },
      { name: 'Faculty Management', href: '/admin/faculty', icon: Building },
      { name: 'Reviewer Management', href: '/admin/reviewers', icon: Award },
      { name: 'Legal Team', href: '/admin/legal', icon: Scale },
      { name: 'Role Management', href: '/admin/roles', icon: Shield },
      { name: 'Disclosure Oversight', href: '/admin/disclosures', icon: FileText },
      { name: 'Reviewer Assignment', href: '/admin/assignments', icon: UserCheck },
      { name: 'Consent Verification', href: '/admin/consent-verification', icon: CheckSquare },
      { name: 'Patent Oversight', href: '/admin/patents', icon: FolderLock },
      { name: 'Reports & Analytics', href: '/admin/reports', icon: BarChart3 },
      { name: 'Audit History', href: '/admin/audit', icon: History },
      { name: 'System Settings', href: '/admin/settings', icon: Settings },
      { name: 'Notifications', href: '/admin/notifications', icon: Bell }
    ]
  };

  const navItems = navigationConfig[role];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Left: Mobile Toggle & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold flex items-center justify-center text-base shadow-sm">
                PU
              </div>
              <div className="hidden sm:block">
                <span className="font-extrabold text-gray-900 tracking-tight text-base block leading-none">
                  Parul University
                </span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mt-0.5">
                  IPR & Patent Cell
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center ml-4 pl-4 border-l border-gray-200">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
                {theme.portalLabel}
              </span>
            </div>
          </div>

          {/* Right: Role Switcher, Indicators, Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Backend vs Mock indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              {isBackendConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Backend Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Mock / Preview Mode
                </span>
              )}
            </div>

            {/* Quick Role Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition"
              >
                <span>Switch Portal</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {roleSwitcherOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Switch Active Portal View
                  </div>
                  <Link
                    href="/student/dashboard"
                    onClick={() => setRoleSwitcherOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span>1. Student Portal</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">CSE</span>
                  </Link>
                  <Link
                    href="/faculty/dashboard"
                    onClick={() => setRoleSwitcherOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <span>2. Faculty Portal</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">R&D</span>
                  </Link>
                  <Link
                    href="/reviewer/dashboard"
                    onClick={() => setRoleSwitcherOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                  >
                    <span>3. Reviewer Portal</span>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Panel</span>
                  </Link>
                  <Link
                    href="/legal/dashboard"
                    onClick={() => setRoleSwitcherOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <span>4. Legal Portal</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">IPO</span>
                  </Link>
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setRoleSwitcherOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <span>5. Administrator Portal</span>
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">Dean</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 py-3 z-50">
                  <div className="px-4 pb-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Notifications</span>
                    <span className="text-[11px] text-blue-600 font-semibold">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {roleNotifications.map((n) => (
                      <div key={n.id} className="p-3 hover:bg-gray-50 transition text-xs">
                        <p className="font-semibold text-gray-900">{n.title}</p>
                        <p className="text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-gray-900 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {currentUser.avatar}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{currentUser.email}</p>
              </div>
              <button
                onClick={() => router.push('/login')}
                title="Logout"
                className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sticky top-24 space-y-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">
                {role.toUpperCase()} WORKSPACE
              </p>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = currentPath === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? theme.activeBg
                          : `text-gray-700 ${theme.hoverBg}`
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Quick Links Footer */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">
                Institutional Portals
              </p>
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition"
                >
                  <span>Student Live Dashboard</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </Link>
                <Link
                  href="/unauthorized"
                  className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-600 hover:text-rose-600 hover:bg-gray-50 rounded-lg transition"
                >
                  <span>Security Guard (403)</span>
                  <Shield className="w-3 h-3 text-gray-400" />
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Modal */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden bg-black/40 backdrop-blur-sm flex">
            <div className="w-72 bg-white h-full p-4 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="font-bold text-sm text-gray-900">{theme.portalLabel}</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = currentPath === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive ? theme.activeBg : `text-gray-700 ${theme.hoverBg}`
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Center Main Work Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Page Sub-Header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                  {title}
                </h1>
                {!isBackendConnected && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                    UI Preview
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
          </div>

          {/* Body Content */}
          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
