import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ReviewApprovalModal } from './ReviewApprovalModal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CaseResponse } from '@/types/case';
import { CheckResponse, DecisionResponse } from '@/types/verification';
import { CustomerResponse } from '@/types/customer';
import { DocumentResponse } from '@/types/document';
import { StatusHistoryResponse } from '@/types/case';
import { extractErrorMessage } from '@/lib/api/errors';
import { EvidenceState, ReviewEvidence } from './reviewEvidence';
import { formatDate } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { CheckSquare2, ExternalLink, ShieldCheck } from 'lucide-react';

interface PendingApprovalItem {
  caseItem: CaseResponse;
  decision: DecisionResponse;
}

export function ApprovalsPage() {
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForReview, setSelectedForReview] = useState<PendingApprovalItem | null>(null);
  const [reviewEvidence, setReviewEvidence] = useState<ReviewEvidence>({
    caseData: { status: 'loading' },
    customer: { status: 'loading' },
    documents: { status: 'loading' },
    checks: { status: 'loading' },
    history: { status: 'loading' },
  });
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const loadPendingApprovals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch cases that are in PENDING_SUPERVISOR_APPROVAL
      const allCases = await api.getAllPages<CaseResponse>('/api/v1/kyc/cases');

      const pendingCases = allCases.filter(
        (c) => c.status === 'PENDING_SUPERVISOR_APPROVAL'
      );

      // 2. Fetch pending decision approvals for each case
      const decisionsByCase = await Promise.all(
        pendingCases.map(async (caseItem) => ({
          caseItem,
          decisions: await api.get<DecisionResponse[]>(
            `/api/v1/kyc/cases/${caseItem.id}/approvals/pending`
          ),
        }))
      );
      setItems(decisionsByCase.flatMap(({ caseItem, decisions }) =>
        decisions.map((decision) => ({ caseItem, decision }))
      ));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const openReview = async (item: PendingApprovalItem) => {
    setSelectedForReview(item);
    setIsLoadingReview(true);
    setReviewEvidence({
      caseData: { status: 'loading' },
      customer: { status: 'loading' },
      documents: { status: 'loading' },
      checks: { status: 'loading' },
      history: { status: 'loading' },
    });
    try {
      const caseData = await api.get<CaseResponse>(`/api/v1/kyc/cases/${item.caseItem.id}`);
      const results = await Promise.allSettled([
        api.get<CustomerResponse>(`/api/v1/customers/${caseData.customerId}`),
        api.get<DocumentResponse[]>(`/api/v1/kyc/cases/${caseData.id}/documents`),
        api.get<CheckResponse[]>(`/api/v1/kyc/cases/${caseData.id}/verification-checks`),
        api.get<StatusHistoryResponse[]>(`/api/v1/kyc/cases/${caseData.id}/status/history`),
      ]);
      const toEvidence = <T,>(result: PromiseSettledResult<T>): EvidenceState<T> =>
        result.status === 'fulfilled'
          ? { status: 'success', data: result.value }
          : { status: 'error', error: extractErrorMessage(result.reason) };
      setReviewEvidence({
        caseData: { status: 'success', data: caseData },
        customer: toEvidence(results[0]),
        documents: toEvidence(results[1]),
        checks: toEvidence(results[2]),
        history: toEvidence(results[3]),
      });
    } catch (err) {
      const message = extractErrorMessage(err);
      setReviewEvidence({
        caseData: { status: 'error', error: message },
        customer: { status: 'error', error: 'Unavailable because the case could not be loaded.' },
        documents: { status: 'error', error: 'Unavailable because the case could not be loaded.' },
        checks: { status: 'error', error: 'Unavailable because the case could not be loaded.' },
        history: { status: 'error', error: 'Unavailable because the case could not be loaded.' },
      });
    } finally {
      setIsLoadingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare2 className="w-5 h-5 text-purple-600" />
            Supervisor Approval Queue
          </h1>
          <p className="text-xs text-slate-500">
            Independent oversight and sign-off for high-risk KYC case recommendations.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPendingApprovals} isLoading={isLoading}>
          Refresh Queue
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cases Awaiting Supervisor Review ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12">
              <Spinner size="md" label="Loading pending approvals..." />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ShieldCheck className="w-8 h-8 text-emerald-500" />}
                title="All approvals complete"
                description="There are currently no high-risk cases awaiting supervisor action."
              />
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Case Reference</Th>
                  <Th>Risk Level</Th>
                  <Th>Status</Th>
                  <Th>Analyst Recommendation</Th>
                  <Th>Submitted By</Th>
                  <Th>Submitted At</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map(({ caseItem, decision }) => (
                  <Tr key={decision.id}>
                    <Td className="font-mono text-xs font-semibold">
                      <Link
                        to={`/cases/${caseItem.id}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {caseItem.caseReference}
                        <ExternalLink className="w-3 h-3 inline" />
                      </Link>
                    </Td>
                    <Td>
                      <RiskBadge risk={caseItem.riskLevel} />
                    </Td>
                    <Td>
                      <StatusBadge status={caseItem.status} />
                    </Td>
                    <Td>
                      <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        {decision.outcome}
                      </span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">
                        ({decision.reasonCode})
                      </span>
                    </Td>
                    <Td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {decision.submittedByUserId}
                      {decision.submittedByUserId === decision.reviewedByUserId && decision.reviewedByUserId
                        ? ' (reviewed)'
                        : ''}
                    </Td>
                    <Td className="text-xs text-slate-500">{formatDate(decision.submittedAt)}</Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        onClick={() => openReview({ caseItem, decision })}
                      >
                        Review Decision
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <ReviewApprovalModal
        isOpen={!!selectedForReview}
        onClose={() => setSelectedForReview(null)}
        caseId={selectedForReview?.caseItem.id || ''}
        decision={selectedForReview?.decision || null}
        evidence={reviewEvidence}
        isLoadingReview={isLoadingReview}
        onRetryEvidence={() => selectedForReview && openReview(selectedForReview)}
        onSuccess={() => {
          loadPendingApprovals();
        }}
      />
    </div>
  );
}
