import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { CheckResultBadge } from '@/components/shared/DocumentStatusBadge';
import { AddCheckModal } from './AddCheckModal';
import { DecisionModal } from './DecisionModal';
import { CaseResponse } from '@/types/case';
import { DocumentResponse } from '@/types/document';
import { CheckResponse, DecisionResponse } from '@/types/verification';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import {
  PlayCircle,
  Plus,
  Send,
  FileSearch,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';

interface VerificationTabProps {
  caseData: CaseResponse;
  documents: DocumentResponse[];
  checks: CheckResponse[];
  decisions: DecisionResponse[];
  onDataChange: () => void;
}

export function VerificationTab({
  caseData,
  documents,
  checks,
  decisions,
  onDataChange,
}: VerificationTabProps) {
  const { user, isAnalyst, isSupervisor } = useAuth();
  const [isAddCheckOpen, setIsAddCheckOpen] = useState(false);
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStartReview =
    (isAnalyst || isSupervisor) &&
    (caseData.status === 'DRAFT' || caseData.status === 'NEEDS_INFORMATION');

  const isAssignedAnalyst =
    isAnalyst && caseData.assignedToUserId && user?.id === caseData.assignedToUserId;

  const canAddChecks =
    (isSupervisor || isAssignedAnalyst) && caseData.status === 'IN_REVIEW';

  const canSubmitDecision = isAssignedAnalyst && caseData.status === 'IN_REVIEW';

  const handleStartReview = async () => {
    setIsStartingReview(true);
    setError(null);
    try {
      await api.post(`/api/v1/kyc/cases/${caseData.id}/review/start`);
      onDataChange();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsStartingReview(false);
    }
  };

  // The backend provides no catalogue endpoint; these defaults match its current configuration.
  const requiredTypes = (import.meta.env.VITE_KYC_REQUIRED_CHECK_TYPES ||
    'CUSTOMER_INFORMATION,IDENTITY_DOCUMENT,ADDRESS_DOCUMENT')
    .split(',')
    .map((type: string) => type.trim())
    .filter(Boolean);
  const latestCheckMap = new Map<string, CheckResponse>();
  checks.forEach((c) => {
    latestCheckMap.set(c.checkType, c);
  });

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" className="mb-2">
          {error}
        </Alert>
      )}

      {/* Start / Resume Review Action Banner */}
      {canStartReview && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
          <div>
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {caseData.status === 'DRAFT' ? 'Ready to Start Review' : 'Ready to Resume Review'}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              {caseData.status === 'DRAFT'
                ? 'Transition the case status from DRAFT into active IN_REVIEW state to perform checks.'
                : 'Customer has provided updates. Transition case back into IN_REVIEW to continue verification.'}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleStartReview}
            isLoading={isStartingReview}
            leftIcon={<PlayCircle className="w-4 h-4" />}
          >
            {caseData.status === 'DRAFT' ? 'Start Active Review' : 'Resume Review'}
          </Button>
        </div>
      )}

      {/* Verification Catalogue Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Configured Verification Checklist</CardTitle>
            <p className="text-xs text-slate-500">
              Checklist uses the configured required check names; the backend validates decision readiness.
            </p>
          </div>
          {canAddChecks && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddCheckOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Check
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {requiredTypes.length === 0 ? (
            <p className="text-xs text-slate-500">No required checks are configured for this environment.</p>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {requiredTypes.map((type) => {
              const latest = latestCheckMap.get(type);
              return (
                <div
                  key={type}
                  className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {type}
                    </span>
                    {latest ? (
                      <CheckResultBadge result={latest.result} />
                    ) : (
                      <Badge variant="slate" size="sm">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {latest ? (
                      <>
                        <p className="truncate" title={latest.notes || ''}>
                          {latest.notes || 'No notes attached'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatDate(latest.performedAt)}
                        </p>
                      </>
                    ) : (
                      <p className="italic text-slate-400">Check not yet performed</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Recorded Verification Checks History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recorded Verification Log ({checks.length})
          </h3>
          {canSubmitDecision && (
            <Button
              size="sm"
              onClick={() => setIsDecisionOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Recommendation
            </Button>
          )}
        </div>

        {checks.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="w-6 h-6" />}
            title="No checks recorded yet"
            description="Start review and record checks against customer evidence to build the audit verification trail."
            actionLabel={canAddChecks ? 'Add First Check' : undefined}
            onAction={canAddChecks ? () => setIsAddCheckOpen(true) : undefined}
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Check Type</Th>
                <Th>Result</Th>
                <Th>Associated Document</Th>
                <Th>Notes</Th>
                <Th>Performed Date</Th>
              </Tr>
            </Thead>
            <Tbody>
              {checks.map((check) => {
                const linkedDoc = documents.find((d) => d.id === check.documentId);
                return (
                  <Tr key={check.id}>
                    <Td className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {check.checkType}
                    </Td>
                    <Td>
                      <CheckResultBadge result={check.result} />
                    </Td>
                    <Td className="text-xs">
                      {linkedDoc ? (
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {linkedDoc.documentType} ({linkedDoc.filename})
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate" title={check.notes || ''}>
                      {check.notes || '—'}
                    </Td>
                    <Td className="text-xs text-slate-500">{formatDate(check.performedAt)}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Decision Trail */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Verification Decisions ({decisions.length})
        </h3>
        {decisions.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            No verification decisions have been submitted for this case yet.
          </div>
        ) : (
          <div className="space-y-3">
            {decisions.map((dec) => (
              <div
                key={dec.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        dec.outcome === 'APPROVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : dec.outcome === 'REJECT'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      }`}
                    >
                      {dec.outcome}
                    </span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      Reason: <strong className="text-slate-800 dark:text-slate-200">{dec.reasonCode}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {dec.approvalRequired ? (
                      <Badge
                        variant={
                          dec.approvalOutcome === 'APPROVED'
                            ? 'emerald'
                            : dec.approvalOutcome === 'REJECTED'
                            ? 'rose'
                            : 'purple'
                        }
                        size="sm"
                      >
                        Supervisor Review: {dec.approvalOutcome}
                      </Badge>
                    ) : (
                      <Badge variant="slate" size="sm">
                        Supervisor Approval Not Required
                      </Badge>
                    )}
                    <span className="text-slate-400">Submitted {formatDate(dec.submittedAt)}</span>
                  </div>
                </div>

                {dec.rationale && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold">Rationale:</span> {dec.rationale}
                  </p>
                )}

                {dec.reviewedByUserId && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                    <span>
                      Reviewed by Supervisor ({dec.reviewedByUserId}) at {formatDate(dec.reviewedAt)}
                    </span>
                    {dec.reviewReason && (
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Reason: {dec.reviewReason}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Check Modal */}
      <AddCheckModal
        isOpen={isAddCheckOpen}
        onClose={() => setIsAddCheckOpen(false)}
        caseId={caseData.id}
        documents={documents}
        onSuccess={() => onDataChange()}
      />

      {/* Decision Modal */}
      <DecisionModal
        isOpen={isDecisionOpen}
        onClose={() => setIsDecisionOpen(false)}
        caseData={caseData}
        documents={documents}
        checks={checks}
        onSuccess={() => onDataChange()}
      />
    </div>
  );
}
