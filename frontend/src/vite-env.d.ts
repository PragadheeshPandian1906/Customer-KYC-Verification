/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KYC_REQUIRED_CHECK_TYPES?: string;
  readonly VITE_KYC_REQUIRED_DOCUMENT_TYPES?: string;
  readonly VITE_KYC_VERIFICATION_CHECK_TYPES?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
