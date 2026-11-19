/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AnalysisDashboardPage } from './components/AnalysisDashboardPage.tsx';
import { BenchmarkPage } from './components/BenchmarkPage.tsx';
import { ClaimInvestigationPage } from './components/ClaimInvestigationPage.tsx';
import { DocumentUploadPage } from './components/DocumentUploadPage.tsx';
import { EvidenceExplorerPage } from './components/EvidenceExplorerPage.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { VerificationReportPage } from './components/VerificationReportPage.tsx';
import { WorkspaceShell, type WorkspacePage } from './components/WorkspaceShell.tsx';
import type {
  DocumentReport,
  VerificationVerdict,
  WorkspaceUser,
} from './types.ts';
import { exportVerificationReportPdf } from './utils/pdfReport.ts';

const DEFAULT_USER: WorkspaceUser = {
  id: 'usr-elena',
  displayName: 'Dr. Elena Vance',
  role: 'Lead Integrity Auditor',
};

export default function App() {
  const [view, setView] = useState<'landing' | 'workspace'>('landing');
  const [workspacePage, setWorkspacePage] = useState<WorkspacePage>('upload');
  const [users, setUsers] = useState<WorkspaceUser[]>([DEFAULT_USER]);
  const [activeUser, setActiveUser] = useState<WorkspaceUser>(DEFAULT_USER);
  const [filterByUser, setFilterByUser] = useState(false);
  const [reports, setReports] = useState<DocumentReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [claimFilter, setClaimFilter] = useState<VerificationVerdict | 'All'>('All');
  const [focusedClaimId, setFocusedClaimId] = useState<string | null>(null);
  const [autoTriggerSample, setAutoTriggerSample] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : { users: [DEFAULT_USER] }))
      .then((data) => {
        if (Array.isArray(data.users) && data.users.length > 0) {
          setUsers(data.users);
          setActiveUser(data.users[0]);
        }
      })
      .catch(() => {
        // Fallback to default seeded profile
      });
  }, []);

  useEffect(() => {
    const query = filterByUser
      ? `?userId=${encodeURIComponent(activeUser.id)}`
      : '';
    fetch(`/api/reports${query}`)
      .then((res) => (res.ok ? res.json() : { reports: [] }))
      .then((data) => {
        if (Array.isArray(data.reports)) {
          setReports(data.reports);
          setActiveReportId((prev) => {
            if (prev && data.reports.some((r: DocumentReport) => r.reportId === prev)) {
              return prev;
            }
            return data.reports[0]?.reportId || null;
          });
        }
      })
      .catch(() => {
        // Non-blocking initial history fetch
      });
  }, [activeUser.id, filterByUser]);

  const activeReport =
    reports.find((r) => r.reportId === activeReportId) || null;

  const handleCreateUser = async (displayName: string, role: string) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, role }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUsers(data.users || [data.user, ...users]);
      setActiveUser(data.user);
    }
  };

  const handleVerificationComplete = (newReport: DocumentReport) => {
    setReports((prev) => [
      newReport,
      ...prev.filter((r) => r.reportId !== newReport.reportId),
    ]);
    setActiveReportId(newReport.reportId);
    setClaimFilter('All');
    setWorkspacePage('dashboard');
  };

  const handleReviewUpdated = (updated: DocumentReport) => {
    setReports((prev) =>
      prev.map((r) => (r.reportId === updated.reportId ? updated : r))
    );
  };

  const handleLaunchSample = () => {
    setView('workspace');
    setWorkspacePage('upload');
    setAutoTriggerSample(true);
  };

  if (view === 'landing') {
    return (
      <LandingPage
        onNavigateUpload={() => {
          setView('workspace');
          setWorkspacePage('upload');
        }}
        onRunSampleDemo={handleLaunchSample}
        onNavigateDashboard={() => {
          setView('workspace');
          setWorkspacePage(activeReport ? 'dashboard' : 'upload');
        }}
        hasExistingReport={Boolean(activeReport)}
      />
    );
  }

  return (
    <WorkspaceShell
      activePage={workspacePage}
      onSelectPage={(page) => setWorkspacePage(page)}
      onGoHome={() => setView('landing')}
      activeReport={activeReport}
      reports={reports}
      users={users}
      activeUser={activeUser}
      filterByUser={filterByUser}
      onToggleFilterByUser={setFilterByUser}
      onSelectUser={(uid) => {
        const found = users.find((u) => u.id === uid);
        if (found) setActiveUser(found);
      }}
      onCreateUser={handleCreateUser}
      onSelectReport={(id) => {
        setActiveReportId(id);
        setFocusedClaimId(null);
      }}
      onExportPdf={() => {
        if (activeReport) exportVerificationReportPdf(activeReport);
      }}
    >
      {workspacePage === 'upload' && (
        <DocumentUploadPage
          activeUser={activeUser}
          onVerificationComplete={handleVerificationComplete}
          autoTriggerSample={autoTriggerSample}
          onSampleTriggerHandled={() => setAutoTriggerSample(false)}
        />
      )}

      {workspacePage === 'dashboard' && (
        <AnalysisDashboardPage
          report={activeReport}
          reports={reports}
          onGoUpload={() => setWorkspacePage('upload')}
          onRunSample={handleLaunchSample}
          onInspectClaims={(filter = 'All') => {
            setClaimFilter(filter);
            setWorkspacePage('claims');
          }}
          onSelectReport={(id) => setActiveReportId(id)}
        />
      )}

      {workspacePage === 'claims' && (
        <ClaimInvestigationPage
          report={activeReport}
          activeUser={activeUser}
          initialFilter={claimFilter}
          onGoUpload={() => setWorkspacePage('upload')}
          onInspectEvidence={(claimId) => {
            setFocusedClaimId(claimId);
            setWorkspacePage('evidence');
          }}
          onReviewUpdated={handleReviewUpdated}
        />
      )}

      {workspacePage === 'evidence' && (
        <EvidenceExplorerPage
          report={activeReport}
          focusedClaimId={focusedClaimId}
          onGoUpload={() => setWorkspacePage('upload')}
        />
      )}

      {workspacePage === 'benchmark' && (
        <BenchmarkPage activeUser={activeUser} />
      )}

      {workspacePage === 'report' && (
        <VerificationReportPage
          report={activeReport}
          onExportPdf={() => {
            if (activeReport) exportVerificationReportPdf(activeReport);
          }}
          onGoUpload={() => setWorkspacePage('upload')}
        />
      )}
    </WorkspaceShell>
  );
}
