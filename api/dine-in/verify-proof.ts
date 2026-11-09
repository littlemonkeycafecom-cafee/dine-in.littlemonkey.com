import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';
import { verifyQrProofToken } from '../../src/server/qrAuthStore.ts';

export default createApiHandler(async (req, res, { body }) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const qrProofToken = body?.qrProofToken;
  if (!qrProofToken || typeof qrProofToken !== 'string') {
    return sendJson(res, 400, {
      valid: false,
      error: 'MISSING_QR_PROOF',
      message: 'No QR proof token provided.',
    });
  }

  const qrProof = verifyQrProofToken(qrProofToken, { consume: false });
  if (!qrProof.valid || !qrProof.tableNumber || !qrProof.credentialId) {
    return sendJson(res, 403, {
      valid: false,
      error: qrProof.error || 'INVALID_QR_PROOF',
      message: (qrProof as any).message || 'Table QR proof is invalid, expired, or already used.',
    });
  }

  return sendJson(res, 200, {
    valid: true,
    tableNumber: qrProof.tableNumber,
    credentialId: qrProof.credentialId,
  });
});
