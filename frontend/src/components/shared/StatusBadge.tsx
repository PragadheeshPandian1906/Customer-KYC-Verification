import { Badge } from '@/components/ui/Badge';
import { CaseStatus } from '@/types/case';

export function StatusBadge({ status }: { status: CaseStatus }) {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge variant="emerald" dot>
          Approved
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="rose" dot>
          Rejected
        </Badge>
      );
    case 'IN_REVIEW':
      return (
        <Badge variant="blue" dot>
          In Review
        </Badge>
      );
    case 'PENDING_SUPERVISOR_APPROVAL':
      return (
        <Badge variant="purple" dot>
          Pending Supervisor Approval
        </Badge>
      );
    case 'NEEDS_INFORMATION':
      return (
        <Badge variant="amber" dot>
          Needs Information
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge variant="slate" dot>
          Closed
        </Badge>
      );
    case 'DRAFT':
    default:
      return (
        <Badge variant="slate" dot>
          Draft
        </Badge>
      );
  }
}
