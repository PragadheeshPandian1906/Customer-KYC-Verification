import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskBadge, PriorityBadge } from '@/components/shared/RiskBadge';
import { StatusTimeline } from '@/components/shared/StatusTimeline';
import { DocumentTable } from '@/features/documents/DocumentTable';
import { VerificationTab } from '@/features/verification/VerificationTab';
import { CaseCommunication, CaseCommunicationsTab } from './CaseCommunicationsTab';
import { EditCaseModal } from './EditCaseModal';
import { AssignCaseModal } from './AssignCaseModal';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { CaseResponse, StatusHistoryResponse, AssignmentResponse } from '@/types/case';
import { CustomerResponse } from '@/types/customer';
import { DocumentResponse } from '@/types/document';
import { CheckResponse, DecisionResponse } from '@/types/verification';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  CheckCircle2,
  Clock,
  UserCheck,
  Sliders,
  Archive,
  ArrowLeft,
  ExternalLink,
  MessageSquareText,
} from 'lucide-react';

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { isSupervisor, isAnalyst, isCustomer } = useAuth();
  const canViewStaffData = isSupervisor || isAnalyst;

  const [activeTab, setActiveTab] = useState('documents');
  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [checks, setChecks] = useState<CheckResponse[]>([]);
  const [decisions, setDecisions] = useState<DecisionResponse[]>([]);
  const [history, setHistory] = useState<StatusHistoryResponse[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [communications, setCommunications] = useState<CaseCommunication[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailWarnings, setDetailWarnings] = useState<string[]>([]);

  // Modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isClosingCase, setIsClosingCase] = useState(false);

  const loadCaseDetails = useCallback(async () => {
    if (!caseId) return;
    setError(null);
    setDetailWarnings([]);
    setIsLoading(true);
    setCustomer(null);
    setDocuments([]);
    setChecks([]);
    setDecisions([]);
    setHistory([]);
    setAssignments([]);
    setCommunications([]);
    try {
      const c = await api.get<CaseResponse>(`/api/v1/kyc/cases/${caseId}`);
      setCaseData(c);

      const warnings: string[] = [];
      const [customerResult, documentsResult, communicationsResult] = await Promise.allSettled([
        api.get<CustomerResponse>(`/api/v1/customers/${c.customerId}`),
        api.get<DocumentResponse[]>(`/api/v1/kyc/cases/${caseId}/documents`),
        api.get<CaseCommunication[]>(`/api/v1/kyc/cases/${caseId}/communications`),
      ]);
      if (customerResult.status === 'fulfilled') setCustomer(customerResult.value);
      else warnings.push(`Customer details: ${extractErrorMessage(customerResult.reason)}`);
      if (documentsResult.status === 'fulfilled') setDocuments(documentsResult.value);
      else warnings.push(`Documents: ${extractErrorMessage(documentsResult.reason)}`);
      if (communicationsResult.status === 'fulfilled') setCommunications(communicationsResult.value);
      else warnings.push(`Additional information: ${extractErrorMessage(communicationsResult.reason)}`);

      if (canViewStaffData) {
        const [checksResult, decisionsResult, historyResult, assignmentsResult] = await Promise.allSettled([
          api.get<CheckResponse[]>(`/api/v1/kyc/cases/${caseId}/verification-checks`),
          api.get<DecisionResponse[]>(`/api/v1/kyc/cases/${caseId}/verification-decisions`),
          api.get<StatusHistoryResponse[]>(`/api/v1/kyc/cases/${caseId}/status/history`),
          api.get<AssignmentResponse[]>(`/api/v1/kyc/cases/${caseId}/assignments`),
        ]);
        if (checksResult.status === 'fulfilled') setChecks(checksResult.value);
        else warnings.push(`Verification checks: ${extractErrorMessage(checksResult.reason)}`);
        if (decisionsResult.status === 'fulfilled') setDecisions(decisionsResult.value);
        else warnings.push(`Decisions: ${extractErrorMessage(decisionsResult.reason)}`);
        if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
        else warnings.push(`Status history: ${extractErrorMessage(historyResult.reason)}`);
        if (assignmentsResult.status === 'fulfilled') setAssignments(assignmentsResult.value);
        else warnings.push(`Assignments: ${extractErrorMessage(assignmentsResult.reason)}`);
      }
      setDetailWarnings(warnings);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [caseId, canViewStaffData]);

  useEffect(() => {
    loadCaseDetails();
  }, [loadCaseDetails]);

  const handleCloseCase = async () => {
    if (!caseId) return;
    if (!window.confirm('Are you sure you want to close this finalized KYC case? Closed cases cannot accept any further document or workflow modifications.')) {
      return;
    }
    setIsClosingCase(true);
    try {
      await api.post(`/api/v1/kyc/cases/${caseId}/close`);
      await loadCaseDetails();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsClosingCase(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading KYC case workspace..." />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="space-y-4">
        <Link to="/cases" className="inline-flex items-center text-xs text-blue-600 hover:underline gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
        </Link>
        <Alert variant="error" title="Unable to Load Case">
          <p>{error || 'Case not found or permission denied'}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={loadCaseDetails}>Retry</Button>
        </Alert>
      </div>
    );
  }

  const canEditParameters =
    isSupervisor && (caseData.status === 'DRAFT' || caseData.status === 'IN_REVIEW');

  const canCloseCase =
    isSupervisor && (caseData.status === 'APPROVED' || caseData.status === 'REJECTED');

  const tabs = [
    { id: 'documents', label: 'Documents & Proofs', count: documents.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'communications', label: 'Information Requests', count: communications.length, icon: <MessageSquareText className="w-4 h-4" /> },
    ...(canViewStaffData ? [{ id: 'verification', label: 'Verification & Checks', count: checks.length, icon: <CheckCircle2 className="w-4 h-4" /> }] : []),
    { id: 'timeline', label: isCustomer && !canViewStaffData ? 'Status Information' : 'Audit & Status History', count: canViewStaffData ? history.length : undefined, icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/cases" className="inline-flex items-center text-xs text-blue-600 hover:underline gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> All KYC Cases
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {caseData.caseReference}
            </h1>
            <StatusBadge status={caseData.status} />
            <RiskBadge risk={caseData.riskLevel} />
            <PriorityBadge priority={caseData.priority} />
          </div>
          <p className="text-xs text-slate-500">
            Case ID: <span className="font-mono">{caseData.id}</span> • Type: <span className="font-semibold">{caseData.caseType}</span>
          </p>
        </div>

        {/* Action Buttons for Supervisor */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSupervisor && caseData.status !== 'CLOSED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssignOpen(true)}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            >
              {caseData.assignedToUserId ? 'Reassign' : 'Assign Analyst'}
            </Button>
          )}

          {canEditParameters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
            >
              Risk & Priority
            </Button>
          )}

          {canCloseCase && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCloseCase}
              isLoading={isClosingCase}
              leftIcon={<Archive className="w-3.5 h-3.5" />}
            >
              Close Case
            </Button>
          )}
        </div>
      </div>

      {/* Case Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {customer?.displayName || 'Customer ID: ' + caseData.customerId.substring(0, 8)}
            </p>
            <p className="text-slate-500">{customer?.email || '—'}</p>
            <div className="pt-2">
              <Link
                to={`/customers/${caseData.customerId}`}
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium text-[11px]"
              >
                View Customer Profile <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Analyst */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Assigned Analyst</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {caseData.assignedToUserId ? (
              <>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {caseData.assignedToDisplayName || caseData.assignedToUserId}
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                  Active Assigned Reviewer
                </p>
              </>
            ) : (
              <p className="text-slate-400 italic">No analyst assigned yet</p>
            )}
            <p className="text-[11px] text-slate-400 pt-1">
              {assignments.length > 0 ? `${assignments.length} total assignment record(s)` : 'Awaiting assignment'}
            </p>
          </CardContent>
        </Card>

        {/* Case Lifecycle */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Lifecycle & Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <p>
              <strong className="text-slate-700 dark:text-slate-200">Created:</strong> {formatDate(caseData.createdAt)}
            </p>
            <p>
              <strong className="text-slate-700 dark:text-slate-200">Updated:</strong> {formatDate(caseData.updatedAt)}
            </p>
            <p>
              <strong className="text-slate-700 dark:text-slate-200">Record Version:</strong> {caseData.version}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workspace Tabs */}
      <Card>
        <CardHeader className="p-0 border-b-0">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="px-5 pt-3" />
        </CardHeader>
        <CardContent className="pt-6">
          {detailWarnings.length > 0 && (
            <Alert variant="warning" title="Some case details could not be loaded" className="mb-4">
              <ul className="list-disc pl-5">
                {detailWarnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </Alert>
          )}
          {activeTab === 'documents' && (
            <DocumentTable
              caseData={caseData}
              documents={documents}
              onDocumentsChange={loadCaseDetails}
            />
          )}

          {activeTab === 'communications' && (
            <CaseCommunicationsTab
              caseData={caseData}
              documents={documents}
              communications={communications}
              onDataChange={loadCaseDetails}
            />
          )}

          {activeTab === 'verification' && (
            <VerificationTab
              caseData={caseData}
              documents={documents}
              checks={checks}
              decisions={decisions}
              onDataChange={loadCaseDetails}
            />
          )}

          {activeTab === 'timeline' && (
            isCustomer && !canViewStaffData ? (
              <Alert variant="info" title="Detailed status history is not available">
                Your current case status is shown at the top of this page. Detailed status history is restricted to authorized staff.
              </Alert>
            ) : <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Status Transition Trail
                </h3>
                <StatusTimeline history={history} currentStatus={caseData.status} />
              </div>

              {assignments.length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    Assignment History
                  </h3>
                  <div className="space-y-2">
                    {assignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                            Analyst: {asg.analystDisplayName || asg.analystUserId}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Assigned by: {asg.assignedByUserId}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">
                          <p>From: {formatDate(asg.assignedAt)}</p>
                          <p>To: {asg.endedAt ? formatDate(asg.endedAt) : 'Present (Active)'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Parameters Modal */}
      <EditCaseModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        kycCase={caseData}
        onSuccess={() => loadCaseDetails()}
      />

      {/* Assign Modal */}
      <AssignCaseModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        caseId={caseData.id}
        currentAnalystId={caseData.assignedToUserId}
        onSuccess={() => loadCaseDetails()}
      />
    </div>
  );
}
