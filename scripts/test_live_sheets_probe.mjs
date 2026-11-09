import crypto from 'node:crypto';
import { getGoogleSheetsConfig } from '../src/server/config.ts';

async function main() {
  const conf = getGoogleSheetsConfig();
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const action = 'lookup';
  const rawMobile = '9999999999';
  const canonicalString = [timestamp, nonce, action, rawMobile].join(':');

  const signature = crypto.createHmac('sha256', conf.apiKey).update(canonicalString).digest('hex').toLowerCase();

  const res = await fetch(conf.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp,
      nonce,
      action,
      mobile: rawMobile,
      signature
    })
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

main().catch(console.error);
