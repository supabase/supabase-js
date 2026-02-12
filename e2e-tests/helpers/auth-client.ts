/**
 * Auth Client Helpers for E2E Tests
 *
 * Re-exports pre-configured auth clients and utility functions
 * for testing against Supabase CLI auth endpoint
 */

// Re-export all clients
export {
  authClient,
  authClientWithSession,
  authSubscriptionClient,
  clientApiAutoConfirmEnabledClient,
  pkceClient,
  autoRefreshClient,
  authAdminApiAutoConfirmEnabledClient,
  serviceRoleApiClient,
  getClientWithSpecificStorage,
  getClientWithSpecificStorageKey,
  GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  GOTRUE_JWT_SECRET,
} from './auth/clients'

// Re-export all utility functions
export {
  mockAccessToken,
  mockUserCredentials,
  mockVerificationOTP,
  mockUserMetadata,
  mockAppMetadata,
  createNewUserWithEmail,
  mockOAuthClientParams,
  mockOAuthUpdateParams,
  createTestOAuthClient,
} from './auth/utils'

// Re-export webauthn fixtures
export * from './auth/webauthn.fixtures'
