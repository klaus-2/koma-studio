// Contrato de aceite legal no registro — cruza client ↔ auth-server.
export interface RegistrationLegalAcceptancePayload {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  cookiesVersion: string;
  contentVersion: string;
}
