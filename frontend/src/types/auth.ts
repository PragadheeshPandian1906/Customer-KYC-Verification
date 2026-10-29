export type RoleCode =
  | 'CUSTOMER'
  | 'KYC_ANALYST'
  | 'COMPLIANCE_SUPERVISOR'
  | 'API_CLIENT_ADMIN';

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
}

export interface CsrfResponse {
  headerName: string;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
