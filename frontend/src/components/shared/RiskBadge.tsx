import { Badge } from '@/components/ui/Badge';
import { RiskLevel, Priority } from '@/types/case';

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  switch (risk) {
    case 'HIGH':
      return <Badge variant="rose">High Risk</Badge>;
    case 'MEDIUM':
      return <Badge variant="amber">Medium Risk</Badge>;
    case 'LOW':
    default:
      return <Badge variant="slate">Low Risk</Badge>;
  }
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case 'HIGH':
      return <Badge variant="rose">High Priority</Badge>;
    case 'NORMAL':
      return <Badge variant="blue">Normal Priority</Badge>;
    case 'LOW':
    default:
      return <Badge variant="slate">Low Priority</Badge>;
  }
}
