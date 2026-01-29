// Based on OpenAPI 3.1.0 info provided

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export type IdentificationType =
  | 'NATIONAL_IDENTIFICATION_NUMBER'
  | 'SOCIAL_SECURITY_NUMBER'
  | 'AFFILIATED_NUMBER';

export interface BeneficiarySearchRequest {
  identification_number: string;
  identification_type: IdentificationType;
}

export interface DrugsPlan {
  plan_id: number;
  policy_id: number;
  plan_type_id: number;
  policy_type: string;
  copayment: number;
  renewal_date: string;
  plan_name: string;
  plan_type: string;
  max_amount: number;
  available_amount: number;
}

export interface PypProgram {
  program_code: number;
  program: string | null;
  group: string | null;
  group_code: number;
}

export interface BeneficiaryResult {
  name: string;
  last_name: string;
  status: string; // e.g., "OK (CORRECTO)..."
  family_code: number;
  pyp_program_list: PypProgram[];
  person_code: number;
  birth_date: string;
  national_identification_number: string;
  social_security_number: string;
  relationship_code: string;
  affiliated_number: number;
  mobile_phone_number: string | null;
  gender: string;
  phone_number: string;
  regime: string;
  drugs_plan_list: DrugsPlan[];
}

export interface BeneficiarySearchResponse {
  id: string;
  status: string;
  result: BeneficiaryResult;
}

// Keeping a flexible alias for components if needed, or precise one
export interface Pharmacy {
  code: string;
  name: string;
}

export type Beneficiary = BeneficiaryResult;

export interface MedicationModel {
  code: string;
  quantity: number;
  price: number;
  name?: string;
}

export interface AuthorizeMedicationRequest {
  pharmacy_code: string;
  affiliate_contract: string;
  pyp_program_code: number;
  external_authorization: string;
  drugs: MedicationModel[];
}

export interface AuthorizeMedicationResponse {
  // The swagger for /drugs/claim also says 202 Accepted.
  // This strongly reinforces the Async pattern (Monitor).
  // We need to handle potential 202 headers (Location) or body content.
  [key: string]: any;
}

export interface CoverageItem {
  drug_code: number;
  basic_authorized_amount: number;
  complementary_authorized_amount: number;
  quantity: number;
  price: number;
  copayment_amount: number;
  total_authorized_amount: number;
}

export interface ClaimSearchResult {
  authorization_code: number;
  external_authorization: string;
  status: string;
  copayment_amount: number;
  invoice_total: number;
  result: number;
  coverage: CoverageItem[];
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  beneficiaryName: string;
  identification: string;
  status: string;
  message: string;
  authorizationCode?: string;
  pharmacy: Pharmacy;
  drugs?: {
    code: string;
    message: string;
    quantity?: number;
    authorizedAmount?: number;
    copaymentAmount?: number;
    invoiceTotal?: number;
  }[];
  beneficiaryDetails?: BeneficiaryResult;
  processTrackingId?: string;
  errorDetail?: string | object;
}
