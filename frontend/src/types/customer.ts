export interface CustomerResponse {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  displayName: string;
  email: string;
}

export interface UpdateCustomerRequest {
  displayName?: string;
  email?: string;
}
