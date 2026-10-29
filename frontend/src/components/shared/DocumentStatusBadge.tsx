import { Badge } from '@/components/ui/Badge';
import { DocumentStatus } from '@/types/document';
import { CheckResult } from '@/types/verification';

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  switch (status) {
    case 'ACCEPTED':
      return (
        <Badge variant="emerald" dot>
          Accepted
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="rose" dot>
          Rejected
        </Badge>
      );
    case 'PENDING_REVIEW':
    default:
      return (
        <Badge variant="amber" dot>
          Pending Review
        </Badge>
      );
  }
}

export function CheckResultBadge({ result }: { result: CheckResult }) {
  switch (result) {
    case 'PASS':
      return <Badge variant="emerald">Pass</Badge>;
    case 'FAIL':
      return <Badge variant="rose">Fail</Badge>;
    case 'NEEDS_INFORMATION':
      return <Badge variant="amber">Needs Info</Badge>;
    case 'NOT_APPLICABLE':
    default:
      return <Badge variant="slate">N/A</Badge>;
  }
}
