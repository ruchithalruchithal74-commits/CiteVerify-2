import {
  BarChart3,
  BookOpenCheck,
  Download,
  FileCheck2,
  FileUp,
  Gauge,
  Home,
  Menu,
  Plus,
  SearchCheck,
  Users,
  X,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { DocumentReport, WorkspaceUser } from '../types.ts';

export type WorkspacePage =
  | 'upload'
  | 'dashboard'
  | 'claims'
  | 'evidence'
  | 'benchmark'
  | 'report';

interface WorkspaceShellProps {
  activePage: WorkspacePage;
  onSelectPage: (page: WorkspacePage) => void;
  onGoHome: () => void;
  activeReport: DocumentReport | null;
  reports: DocumentReport[];
  users: WorkspaceUser[];
  activeUser: WorkspaceUser;
  filterByUser: boolean;
  onToggleFilterByUser: (next: boolean) => void;
  onSelectUser: (userId: string) => void;
  onCreateUser: (displayName: string, role: string) => Promise<void>;
  onSelectReport: (reportId: string) => void;
  onExportPdf: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: WorkspacePage;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: 'upload', label: 'Document Upload', icon: FileUp },
  { id: 'dashboard', label: 'Analysis Dashboard', icon: BarChart3 },
  { id: 'claims', label: 'Claim Investigation', icon: SearchCheck },
  { id: 'evidence', label: 'Evidence Explorer', icon: BookOpenCheck },
  { id: 'benchmark', label: 'Evaluation Benchmark', icon: Gauge },
  { id: 'report', label: 'Verification Report', icon: FileCheck2 },
];

export function WorkspaceShell({
  activePage,
  onSelectPage,
  onGoHome,
  activeReport,
  reports,
  users,
  activeUser,
  filterByUser,
  onToggleFilterByUser,
  onSelectUser,
  onCreateUser,
  onSelectReport,
  onExportPdf,
  children,
}: WorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Research Auditor');
  const [creatingUser, setCreatingUser] = useState(false);

  const pageTitle =
    NAV_ITEMS.find((n) => n.id === activePage)?.label || 'Workspace';

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    setCreatingUser(true);
    try {
      await onCreateUser(newUserName.trim(), newUserRole.trim());
      setNewUserName('');
      setAddingUser(false);
    } finally {
      setCreatingUser(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#14201C] border-r border-[#22322C]">
      <div className="px-5 py-5 border-b border-[#22322C] flex items-center justify-between">
        <button
          type="button"
          onClick={onGoHome}
          className="text-left group cursor-pointer"
        >
          <span className="font-display text-xl font-semibold tracking-tight text-[#F4F1E8] group-hover:text-[#19B887] transition-colors block">
            CiteVerify
          </span>
          <span className="text-[11px] text-[#A3B5A9] block mt-0.5">
            Beyond Citations. Into Evidence.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 text-[#A3B5A9] hover:text-[#F4F1E8]"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Multi-User Researcher Profile Switcher (SQLite backed) */}
      <div className="px-3.5 py-3 border-b border-[#22322C] bg-[#101916]/60 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#A3B5A9]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5 text-[#D6B875]" />
            Active Auditor
          </span>
          <button
            type="button"
            onClick={() => setAddingUser((v) => !v)}
            className="inline-flex items-center gap-1 text-[#19B887] hover:underline cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>

        <select
          value={activeUser.id}
          onChange={(e) => onSelectUser(e.target.value)}
          aria-label="Active workspace researcher"
          className="w-full px-2.5 py-1.5 rounded-lg bg-[#101414] border border-[#283631] text-xs text-[#F4F1E8] focus:outline-none focus:border-[#19B887]"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.role})
            </option>
          ))}
        </select>

        {addingUser && (
          <form onSubmit={handleAddUser} className="space-y-1.5 pt-1">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Researcher name..."
              className="w-full px-2.5 py-1.5 rounded bg-[#101414] border border-[#283631] text-xs text-[#F4F1E8] placeholder:text-[#A3B5A9]/50 focus:outline-none focus:border-[#19B887]"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                placeholder="Role"
                className="flex-1 min-w-0 px-2.5 py-1 rounded bg-[#101414] border border-[#283631] text-[11px] text-[#A3B5A9] focus:outline-none focus:border-[#19B887]"
              />
              <button
                type="submit"
                disabled={creatingUser}
                className="px-2.5 py-1 rounded bg-[#19B887] text-[#0B1411] text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </form>
        )}

        <label className="flex items-center gap-2 text-[11px] text-[#A3B5A9] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filterByUser}
            onChange={(e) => onToggleFilterByUser(e.target.checked)}
            className="accent-[#19B887]"
          />
          <span>Filter history to my audits</span>
        </label>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectPage(item.id);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#19B887]/15 text-[#19B887] border border-[#19B887]/35'
                  : 'text-[#A3B5A9] hover:text-[#F4F1E8] hover:bg-[#1C2623] border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {reports.length > 0 && (
          <div className="pt-6 mt-6 border-t border-[#22322C] px-2">
            <p className="text-[11px] font-medium text-[#A3B5A9] mb-2">
              Persisted Audit History ({reports.length})
            </p>
            <div className="space-y-1.5">
              {reports.slice(0, 6).map((r) => {
                const isSelected = activeReport?.reportId === r.reportId;
                return (
                  <button
                    key={r.reportId}
                    type="button"
                    onClick={() => {
                      onSelectReport(r.reportId);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1C2623] text-[#F4F1E8] border border-[#2F4039]'
                        : 'text-[#A3B5A9] hover:bg-[#1C2623]/60 hover:text-[#F4F1E8] border border-transparent'
                    }`}
                  >
                    <p className="font-medium truncate">{r.filename}</p>
                    <p className="font-mono text-[10px] text-[#D6B875] mt-0.5 tabular-nums truncate">
                      {r.summaryStats.totalClaims} claims · {r.fileType} · {r.userDisplayName}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-[#22322C]">
        <button
          type="button"
          onClick={onGoHome}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#A3B5A9] hover:text-[#F4F1E8] hover:bg-[#1C2623] transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
          Back to Overview
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#101414] text-[#F4F1E8] flex">
      <aside className="hidden lg:block w-[262px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[274px] h-full">{sidebarContent}</div>
          <div
            className="flex-1 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-[#101414]/92 backdrop-blur-md border-b border-[#212D29] px-5 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#27342F] text-[#A3B5A9] hover:text-[#F4F1E8]"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#A3B5A9]">
                <span>Workspace</span>
                <span aria-hidden="true">/</span>
                <span className="text-[#D6B875] font-medium truncate">
                  {pageTitle}
                </span>
              </div>
              {activeReport && (
                <p className="text-xs text-[#A3B5A9] truncate mt-0.5">
                  {activeReport.filename} · {activeReport.extractionMethod}
                  {activeReport.isSampleDemo && ' · Illustrative Sample Mode'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeReport && (
              <button
                type="button"
                onClick={onExportPdf}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D6B875]/40 bg-[#1C2623] text-xs font-semibold text-[#F4F1E8] hover:border-[#D6B875] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#D6B875]" />
                Export PDF
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectPage('upload')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#19B887] text-[#0B1411] text-xs font-semibold hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              New Analysis
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1380px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
