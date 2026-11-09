import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';

export default createApiHandler(async (req, res) => {
  return sendJson(res, 403, {
    error: 'GUEST_DISABLED',
    message: 'Guest preview mode has been decommissioned. Mandatory customer registration or sign-in is required.',
  });
});

