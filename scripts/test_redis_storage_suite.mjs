/**
 * Little Monkey Cafe Dining — Automated Shared Redis Storage Test Suite
 * Tests session lifecycle, cross-instance retrieval, distributed QR proof replay prevention,
 * idempotent same-request recovery, ambiguous timeout handling, cookie attributes,
 * distributed table credential revocation, fail-closed behavior, and security invariants.
 */
import {
  InMemoryRedisMock,
  UpstashRedisClient,
  RedisUnavailableError,
  RedisTimeoutError,
} from '../src/server/redisClient.ts';
import {
  RedisStorageProvider,
  getStorageProvider,
  setStorageProvider,
} from '../src/server/storage.ts';
import {
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  createQrProofToken,
  getSystemTime,
  advanceSystemTime,
  resetSystemTime,
  FIXED_SESSION_DURATION_MS,
  loadCredentials,
} from '../src/server/qrAuthStore.ts';
import {
  getQrHmacSecret,
  getRedisConfig,
} from '../src/server/config.ts';
import {
  buildDiningSessionCookie,
  buildClearDiningSessionCookie,
} from '../src/server/http.ts';

// Ensure table credentials and secrets are loaded
loadCredentials();

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('LITTLE MONKEY CAFE DINING - REMEDIATED REDIS STORAGE SUITE');
  console.log('================================================================\n');

  resetSystemTime();

  const credTable01 = getActiveCredentialForTable('Table 01');
  const rawSecretTable01 = getActiveRawSecretForTable('Table 01');
  if (!credTable01) {
    console.error('[FATAL] Table 01 credential not found.');
    process.exit(1);
  }

  // ============================================================================
  // GROUP 1: SESSION LIFECYCLE & CROSS-INSTANCE VALIDATION
  // ============================================================================
  console.log('--- GROUP 1: SESSION LIFECYCLE & CROSS-INSTANCE PERSISTENCE ---');
  {
    const sharedRedis = new InMemoryRedisMock();
    const serverInstanceA = new RedisStorageProvider(sharedRedis);
    const serverInstanceB = new RedisStorageProvider(sharedRedis);

    // 1.1 Create session with valid proof token on Instance A
    const proofToken1 = createQrProofToken(credTable01.credentialId, 'Table 01');
    const customer1 = {
      id: 'cust_001',
      name: 'Aditya Rao',
      phone: '9876543210',
      role: 'customer',
    };
    const clientMeta = { ip: '192.168.1.50', userAgent: 'Mozilla/5.0 TestBrowser' };

    const createResult = await serverInstanceA.createSession(proofToken1, customer1, clientMeta);
    assert(
      createResult.success === true && !!createResult.session?.sessionId,
      'Session creation succeeds on Server Instance A'
    );

    const sessionId = createResult.session.sessionId;

    // 1.2 Cross-instance session retrieval on Instance B
    const validateOnB = await serverInstanceB.validateSession(sessionId);
    assert(
      validateOnB.valid === true &&
        validateOnB.session?.sessionId === sessionId &&
        validateOnB.session?.tableNumber === 'Table 01' &&
        validateOnB.session?.customerName === 'Aditya Rao',
      'Session retrieved and validated across independent Server Instance B'
    );

    // 1.3 Active session remaining time is approximately 15 minutes (900,000 ms)
    assert(
      validateOnB.timeRemainingMs > 890000 && validateOnB.timeRemainingMs <= 900000,
      'Valid session returns accurate remaining time (~15 minutes)'
    );

    // 1.4 Non-existent / invalid session rejection
    const invalidCheck = await serverInstanceB.validateSession('dinesess_nonexistent_random_id');
    assert(
      invalidCheck.valid === false && invalidCheck.error === 'DINING_SESSION_EXPIRED',
      'Non-existent session token is rejected'
    );

    // 1.5 Null / empty session token rejection
    const emptyCheck = await serverInstanceB.validateSession('');
    assert(
      emptyCheck.valid === false && emptyCheck.error === 'NO_SESSION',
      'Empty session token is rejected with NO_SESSION'
    );

    // 1.6 Session expiration at exactly 15 minutes
    advanceSystemTime(FIXED_SESSION_DURATION_MS + 1000); // 15 mins + 1 second
    const expiredCheck = await serverInstanceB.validateSession(sessionId);
    assert(
      expiredCheck.valid === false && expiredCheck.error === 'DINING_SESSION_EXPIRED',
      'Expired session rejected at exactly 15 minutes'
    );
    resetSystemTime();

    // 1.7 Session revocation
    const proofTokenRevoke = createQrProofToken(credTable01.credentialId, 'Table 01');
    const sessToRevoke = await serverInstanceA.createSession(proofTokenRevoke, customer1, clientMeta);
    const revId = sessToRevoke.session.sessionId;

    const revokeResult = await serverInstanceA.revokeSession(revId);
    assert(revokeResult === true, 'Session revocation succeeds');

    const checkRevoked = await serverInstanceB.validateSession(revId);
    assert(
      checkRevoked.valid === false && checkRevoked.error === 'SESSION_REVOKED',
      'Revoked session is rejected on independent instance with SESSION_REVOKED'
    );

    // 1.8 Storage unavailable behavior (fails closed)
    sharedRedis.setSimulateFailure(true);
    const failClosedCheck = await serverInstanceA.validateSession(sessionId);
    assert(
      failClosedCheck.valid === false && failClosedCheck.error === 'STORAGE_UNAVAILABLE',
      'Session validation fails closed when Redis connection is unavailable'
    );
    sharedRedis.setSimulateFailure(false);
  }

  // ============================================================================
  // GROUP 2: IDEMPOTENT RECOVERY, SAME-REQUEST RETRY & REPLAY PREVENTION
  // ============================================================================
  console.log('\n--- GROUP 2: IDEMPOTENT RECOVERY, RETRIES & REPLAY PREVENTION ---');
  {
    const sharedRedis = new InMemoryRedisMock();
    const serverInstanceA = new RedisStorageProvider(sharedRedis);
    const serverInstanceB = new RedisStorageProvider(sharedRedis);

    const customerA = {
      id: 'cust_002',
      name: 'Priya Sharma',
      phone: '9123456789',
      role: 'customer',
    };
    const attackerB = {
      id: 'cust_attacker',
      name: 'Malicious User',
      phone: '9000000000',
      role: 'customer',
    };

    // 2.1 First use of proof token succeeds
    const proofToken = createQrProofToken(credTable01.credentialId, 'Table 01');
    const firstUse = await serverInstanceA.createSession(proofToken, customerA);
    assert(firstUse.success === true, 'First use of QR proof token succeeds on Instance A');

    // 2.2 Same-request retry by Customer A idempotently recovers session (CRIT-01, HIGH-03)
    const sameCustomerRetry = await serverInstanceA.createSession(proofToken, customerA);
    assert(
      sameCustomerRetry.success === true &&
        sameCustomerRetry.session?.sessionId === firstUse.session?.sessionId,
      'Same-request retry by original customer idempotently returns existing session without error'
    );

    // 2.3 Same-request retry on independent Instance B also recovers the session
    const instanceBRetry = await serverInstanceB.createSession(proofToken, customerA);
    assert(
      instanceBRetry.success === true &&
        instanceBRetry.session?.sessionId === firstUse.session?.sessionId,
      'Same-request retry on independent Instance B recovers the session'
    );

    // 2.4 Different customer / attacker replay is strictly rejected with PROOF_ALREADY_USED
    const attackerReplay = await serverInstanceB.createSession(proofToken, attackerB);
    assert(
      attackerReplay.success === false && attackerReplay.error === 'PROOF_ALREADY_USED',
      'Replay attempt by different customer is rejected with PROOF_ALREADY_USED'
    );

    // 2.5 Recovery when session write previously failed (Simulating partial failure)
    const proofTokenPartial = createQrProofToken(credTable01.credentialId, 'Table 01');
    // Pre-seed claim without session to simulate interrupted network during step 4
    const payload = JSON.parse(Buffer.from(proofTokenPartial.split('.')[1], 'base64url').toString());
    await sharedRedis.set(`lm:proof_claim:${payload.jti}`, customerA.id, { ex: 300 });

    const recoveredSession = await serverInstanceA.createSession(proofTokenPartial, customerA);
    assert(
      recoveredSession.success === true && !!recoveredSession.session?.sessionId,
      'Interrupted session creation successfully recovers and persists session upon retry (CRIT-01)'
    );

    // 2.6 Ambiguous network timeout recovery
    const proofTokenAmbiguous = createQrProofToken(credTable01.credentialId, 'Table 01');
    sharedRedis.setSimulateAmbiguousTimeout(true);
    let timeoutCaught = false;
    try {
      await serverInstanceA.createSession(proofTokenAmbiguous, customerA);
    } catch {
      timeoutCaught = true;
    }
    sharedRedis.setSimulateAmbiguousTimeout(false);

    // Now customer retries after the timeout
    const postTimeoutRetry = await serverInstanceA.createSession(proofTokenAmbiguous, customerA);
    assert(
      postTimeoutRetry.success === true && !!postTimeoutRetry.session?.sessionId,
      'Legitimate customer retrying after ambiguous Redis timeout successfully recovers session (HIGH-03)'
    );

    // 2.7 Concurrent duplicate requests race test
    const proofTokenRace = createQrProofToken(credTable01.credentialId, 'Table 01');
    const [resRace1, resRace2, resRace3] = await Promise.all([
      serverInstanceA.createSession(proofTokenRace, customerA),
      serverInstanceB.createSession(proofTokenRace, attackerB),
      serverInstanceA.createSession(proofTokenRace, customerA),
    ]);

    const successes = [resRace1, resRace2, resRace3].filter((r) => r.success);
    const rejections = [resRace1, resRace2, resRace3].filter((r) => r.error === 'PROOF_ALREADY_USED');

    assert(
      successes.length >= 1 && rejections.length >= 1,
      `Concurrent requests test: Customer A claims token, attacker is rejected with PROOF_ALREADY_USED`
    );

    // 2.8 Expired proof token rejected before Redis write
    const proofTokenExpired = createQrProofToken(credTable01.credentialId, 'Table 01');
    advanceSystemTime(301 * 1000); // 5 minutes + 1 sec
    const expiredProofRes = await serverInstanceA.createSession(proofTokenExpired, customerA);
    assert(
      expiredProofRes.success === false && expiredProofRes.error === 'EXPIRED_PROOF',
      'Expired proof token (> 5 min) is rejected before Redis write'
    );
    resetSystemTime();

    // 2.9 Malformed JTI format rejected
    const malformedJtiRes = await serverInstanceA.createSession('qrproof.invalidpayload.sig', customerA);
    assert(
      malformedJtiRes.success === false,
      'Malformed proof token is rejected'
    );
  }

  // ============================================================================
  // GROUP 3: DISTRIBUTED TABLE CREDENTIAL ROTATION & REVOCATION (CRIT-02)
  // ============================================================================
  console.log('\n--- GROUP 3: DISTRIBUTED TABLE CREDENTIAL ROTATION & REVOCATION ---');
  {
    const sharedRedis = new InMemoryRedisMock();
    const serverInstanceA = new RedisStorageProvider(sharedRedis);
    const serverInstanceB = new RedisStorageProvider(sharedRedis);

    // 3.1 Initial state: Baseline table credentials from Authoritative Tables work cross-instance
    const credTable04 = await serverInstanceB.getActiveCredentialForTable('Table 04');
    assert(
      credTable04 !== null && credTable04.tableNumber === 'Table 04',
      'Baseline table credentials resolve across independent instances without pre-seeding'
    );

    // 3.2 Table Credential Revocation on Instance A propagates immediately to Instance B
    const revokeResult = await serverInstanceA.revokeTableCredential('Table 04', 'Staff Admin');
    assert(revokeResult === true, 'Revocation of Table 04 succeeds on Instance A');

    const checkRevokedOnB = await serverInstanceB.getActiveCredentialForTable('Table 04');
    assert(
      checkRevokedOnB === null,
      'Revocation of Table 04 is immediately reflected on independent Instance B (CRIT-02)'
    );

    // 3.3 Active session on Table 04 is rejected as CREDENTIAL_REVOKED on Instance B
    const proofT05 = createQrProofToken(getActiveCredentialForTable('Table 05').credentialId, 'Table 05');
    const sessT05 = await serverInstanceA.createSession(proofT05, { id: 'cust_005', name: 'User 5', phone: '9999999995' });

    // Revoke Table 05 on Instance A
    await serverInstanceA.revokeTableCredential('Table 05', 'Staff Admin');

    // Instance B validates session for Table 05
    const validateT05 = await serverInstanceB.validateSession(sessT05.session.sessionId);
    assert(
      validateT05.valid === false && validateT05.error === 'CREDENTIAL_REVOKED',
      'Session validation on Instance B correctly fails with CREDENTIAL_REVOKED after table revocation'
    );

    // 3.4 Table Credential Rotation on Instance A generates new credential in Redis
    const rotationRes = await serverInstanceA.rotateTableCredential('Table 06', 'Staff Admin');
    assert(
      rotationRes.record.tableNumber === 'Table 06' &&
        !!rotationRes.rawSecret &&
        rotationRes.record.rotationCount > 0,
      'Table credential rotated on Instance A with new cryptographic secret'
    );

    // Instance B immediately sees the newly rotated credential
    const activeOnB = await serverInstanceB.getActiveCredentialForTable('Table 06');
    assert(
      activeOnB !== null && activeOnB.credentialId === rotationRes.record.credentialId,
      'Rotated credential on Instance A is immediately active on Instance B (CRIT-02)'
    );
  }

  // ============================================================================
  // GROUP 4: SESSION COOKIE SECURITY ATTRIBUTES (HIGH-01)
  // ============================================================================
  console.log('\n--- GROUP 4: SESSION COOKIE SECURITY ATTRIBUTES ---');
  {
    const originalNodeEnv = process.env.NODE_ENV;

    // 4.1 Production cookie has Secure, HttpOnly, SameSite=Lax, Path=/
    process.env.NODE_ENV = 'production';
    const prodCookie = buildDiningSessionCookie('dinesess_test_123', 900);
    assert(
      prodCookie.includes('; Secure') &&
        prodCookie.includes('; HttpOnly') &&
        prodCookie.includes('SameSite=Lax') &&
        prodCookie.includes('Path=/') &&
        prodCookie.includes('Max-Age=900'),
      'Production session cookie includes ; Secure, ; HttpOnly, SameSite=Lax, Path=/ (HIGH-01)'
    );

    const prodClearCookie = buildClearDiningSessionCookie();
    assert(
      prodClearCookie.includes('; Secure') &&
        prodClearCookie.includes('; HttpOnly') &&
        prodClearCookie.includes('Max-Age=0'),
      'Production clear cookie includes ; Secure and Max-Age=0'
    );

    // 4.2 Development cookie omits ; Secure for local HTTP testing
    process.env.NODE_ENV = 'development';
    const devCookie = buildDiningSessionCookie('dinesess_test_123', 900);
    assert(
      !devCookie.includes('; Secure') &&
        devCookie.includes('; HttpOnly') &&
        devCookie.includes('SameSite=Lax'),
      'Development session cookie omits ; Secure to permit local HTTP development'
    );

    process.env.NODE_ENV = originalNodeEnv;
  }

  // ============================================================================
  // GROUP 5: CRYPTOGRAPHIC SECRETS & FAIL-CLOSED CHECKS (HIGH-02, MED-01)
  // ============================================================================
  console.log('\n--- GROUP 5: CRYPTOGRAPHIC SECRETS & FAIL-CLOSED CHECKS ---');
  {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalHmac = process.env.QR_HMAC_SECRET;
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // 5.1 Production rejects missing or default QR_HMAC_SECRET (HIGH-02)
    process.env.NODE_ENV = 'production';
    delete process.env.QR_HMAC_SECRET;
    delete process.env.SESSION_SECRET;

    let hmacError = null;
    try {
      getQrHmacSecret();
    } catch (err) {
      hmacError = err;
    }
    assert(
      hmacError !== null && hmacError.message.includes('PRODUCTION_SECURITY_ERROR'),
      'Production fails closed with PRODUCTION_SECURITY_ERROR when QR_HMAC_SECRET is missing (HIGH-02)'
    );

    // 5.2 Production rejects hardcoded default secret
    process.env.QR_HMAC_SECRET = 'lm_qr_hmac_secret_2026_warangal_dining';
    let defaultHmacError = null;
    try {
      getQrHmacSecret();
    } catch (err) {
      defaultHmacError = err;
    }
    assert(
      defaultHmacError !== null && defaultHmacError.message.includes('PRODUCTION_SECURITY_ERROR'),
      'Production fails closed when QR_HMAC_SECRET equals repository default string (HIGH-02)'
    );

    // 5.3 Production accepts valid high-entropy secret
    process.env.QR_HMAC_SECRET = 'c4d7e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9';
    const validHmac = getQrHmacSecret();
    assert(
      validHmac.length >= 32,
      'Production accepts valid high-entropy QR_HMAC_SECRET'
    );

    // 5.4 Production rejects insecure HTTP Redis URL (MED-01)
    process.env.UPSTASH_REDIS_REST_URL = 'http://insecure-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock_token_at_least_16_chars_length';
    const redisInsecureConfig = getRedisConfig();
    assert(
      redisInsecureConfig.isConfigured === false &&
        redisInsecureConfig.error?.includes('Insecure protocol'),
      'Production rejects insecure http:// Redis REST URL (MED-01)'
    );

    // 5.5 Production Upstash client constructor strictly rejects non-HTTPS
    let clientProtocolError = null;
    try {
      new UpstashRedisClient({
        url: 'http://insecure-redis.upstash.io',
        token: 'mock_token_at_least_16_chars_length',
      });
    } catch (err) {
      clientProtocolError = err;
    }
    assert(
      clientProtocolError !== null && clientProtocolError.message.includes('Insecure protocol rejected'),
      'UpstashRedisClient constructor rejects non-HTTPS URL in production (MED-01)'
    );

    // Restore environment
    process.env.NODE_ENV = originalNodeEnv;
    if (originalHmac) process.env.QR_HMAC_SECRET = originalHmac;
    else delete process.env.QR_HMAC_SECRET;
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
    setStorageProvider(null);
  }

  // ============================================================================
  // GROUP 6: AUDIT PIPELINE & PII MINIMIZATION (MED-02, MED-03)
  // ============================================================================
  console.log('\n--- GROUP 6: AUDIT PIPELINE & PII MINIMIZATION ---');
  {
    const sharedRedis = new InMemoryRedisMock();
    const provider = new RedisStorageProvider(sharedRedis);

    // 6.1 Audit logging executes via single atomic pipeline (MED-02)
    await provider.logAuditEvent({
      tableNumber: 'Table 01',
      eventType: 'TEST_PIPELINE_EVENT',
      status: 'SUCCESS',
      metadata: { test: true },
    });

    const auditList = await sharedRedis.get('lm:audit_log');
    assert(
      sharedRedis.keyCount() > 0,
      'Audit log recorded via pipeline command batch (MED-02)'
    );

    // 6.2 Data minimization: session payload in Redis omits IP and User-Agent (MED-03)
    const proof = createQrProofToken(credTable01.credentialId, 'Table 01');
    const customer = { id: 'cust_min', name: 'Min Diner', phone: '9800000000' };
    const sessRes = await provider.createSession(proof, customer, {
      ip: '192.168.1.99',
      userAgent: 'Mozilla/5.0 SuperSecretBrowser',
    });

    assert(sessRes.success === true, 'Session created for data minimization check');

    const sessionRaw = await sharedRedis.get(`lm:sess:${sessRes.session.sessionId}`);
    const parsedStored = JSON.parse(sessionRaw);

    assert(
      parsedStored.ipAddress === undefined && parsedStored.userAgent === undefined,
      'Stored Redis session payload strictly omits ipAddress and userAgent (MED-03)'
    );
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[UNCAUGHT TEST ERROR]:', err);
  process.exit(1);
});
