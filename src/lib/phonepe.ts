import crypto from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PhonePePaymentRequest {
  merchantId: string;
  merchantTransactionId: string;
  merchantUserId: string;
  amount: number; // in paise
  redirectUrl: string;
  redirectMode: 'REDIRECT';
  callbackUrl: string;
  mobileNumber?: string;
  paymentInstrument: {
    type: 'PAY_PAGE';
  };
}

export interface PhonePeResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse: {
      type: string;
      redirectInfo: {
        url: string;
        method: string;
      };
    };
  };
}

export interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    state: string;
    responseCode: string;
    paymentInstrument: {
      type: string;
      [key: string]: any;
    };
  };
}

// ─── Checksum Helpers ──────────────────────────────────────────────────────────

/**
 * Generates the X-VERIFY checksum for PhonePe payment initiation.
 *
 * Formula: SHA256(base64(payload) + endpoint + saltKey) + "###" + saltIndex
 */
export function generateChecksum(
  payload: string,
  endpoint: string,
  saltKey: string,
  saltIndex: string
): string {
  const base64Payload = Buffer.from(payload).toString('base64');

  const hashString = base64Payload + endpoint + saltKey;

  const sha256Hash = crypto
    .createHash('sha256')
    .update(hashString)
    .digest('hex');

  return `${sha256Hash}###${saltIndex}`;
}

/**
 * Generates the X-VERIFY checksum for PhonePe status check API.
 *
 * Formula: SHA256(endpoint + saltKey) + "###" + saltIndex
 * Note: NO base64 payload for status check — different from initiation.
 */
export function generateStatusChecksum(
  endpoint: string,
  saltKey: string,
  saltIndex: string
): string {
  const hashString = endpoint + saltKey;

  const sha256Hash = crypto
    .createHash('sha256')
    .update(hashString)
    .digest('hex');

  return `${sha256Hash}###${saltIndex}`;
}

/**
 * Verifies the checksum from PhonePe callback response.
 *
 * Formula: SHA256(responseBase64 + saltKey) === receivedHash
 */
export function verifyChecksum(
  responseBase64: string,
  receivedChecksum: string,
  saltKey: string,
  saltIndex: string
): boolean {
  const [receivedHash, receivedIndex] = receivedChecksum.split('###');

  if (receivedIndex !== saltIndex) return false;

  const hashString = responseBase64 + saltKey;

  const expectedHash = crypto
    .createHash('sha256')
    .update(hashString)
    .digest('hex');

  return expectedHash === receivedHash;
}
