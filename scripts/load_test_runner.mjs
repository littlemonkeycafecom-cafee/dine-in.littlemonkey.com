/**
 * scripts/load_test_runner.mjs — Comprehensive Production Load Testing Harness
 *
 * Evaluates Little Monkey Café Dining under progressive concurrency:
 * - Stage 1: Baseline (10 Concurrent VUs)
 * - Stage 2: Moderate Load (100 & 500 Concurrent VUs)
 * - Stage 3: Peak Dining Load (1,000 Concurrent VUs)
 * - Stage 4: Stress Load (2,500 Concurrent VUs)
 * - Stage 5: Extreme / Feasibility Test (5,000 - 10,000 Concurrent VUs)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 3000;
const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 5000,
  maxTotalSockets: 10000,
  timeout: 15000,
});

function makeRequest({ path, method = 'GET', body = null, headers = {} }) {
  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();
    const reqHeaders = {
      Host: `${TARGET_HOST}:${TARGET_PORT}`,
      Connection: 'keep-alive',
      'User-Agent': 'LittleMonkeyLoadTester/2.0',
      ...headers,
    };

    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(body);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    const req = http.request(
      {
        host: TARGET_HOST,
        port: TARGET_PORT,
        path,
        method,
        headers: reqHeaders,
        agent,
        timeout: 10000,
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => {
          respData += chunk;
        });
        res.on('end', () => {
          const endTime = process.hrtime.bigint();
          const latencyMs = Number(endTime - startTime) / 1e6;
          resolve({
            statusCode: res.statusCode,
            latencyMs,
            error: null,
            bodyLength: respData.length,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('TIMEOUT'));
    });

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1e6;
      resolve({
        statusCode: 0,
        latencyMs,
        error: err.message,
        bodyLength: 0,
      });
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// User Scenarios
async function executeUserScenario(scenarioType, vuId) {
  const simulatedIp = `10.${Math.floor(vuId / 256) % 256}.${vuId % 256}.1`;
  const commonHeaders = {
    'X-Forwarded-For': simulatedIp,
    Authorization: 'Bearer dev_preview_token',
  };

  const results = [];

  if (scenarioType === 'A') {
    // Scenario A: Browsing Diner (Initial QR Entry -> Session Validation -> Catalog -> Table Status)
    results.push(await makeRequest({ path: '/', headers: commonHeaders }));
    results.push(
      await makeRequest({
        path: '/api/auth/validate-session',
        method: 'POST',
        body: JSON.stringify({ token: 'dev_preview_token' }),
        headers: commonHeaders,
      })
    );
    results.push(await makeRequest({ path: '/api/dine-in/products', headers: commonHeaders }));
    results.push(
      await makeRequest({
        path: '/api/dine-in/table-status?table=Table%2004',
        headers: commonHeaders,
      })
    );
  } else if (scenarioType === 'B') {
    // Scenario B: Returning Diner (Direct Session Validation & Product Refresh)
    results.push(
      await makeRequest({
        path: '/api/auth/validate-session',
        method: 'POST',
        body: JSON.stringify({ token: 'dev_preview_token' }),
        headers: commonHeaders,
      })
    );
    results.push(await makeRequest({ path: '/api/dine-in/products', headers: commonHeaders }));
  } else {
    // Scenario C: Rapid Browsing (Catalog + Category Assets)
    results.push(await makeRequest({ path: '/api/dine-in/products', headers: commonHeaders }));
    results.push(
      await makeRequest({ path: '/images/categories/thin-crust-pizza.jpg', headers: commonHeaders })
    );
    results.push(
      await makeRequest({ path: '/images/categories/burgers.jpg', headers: commonHeaders })
    );
  }

  return results;
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getIndex = (p) => Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);

  return {
    min: Math.round(sorted[0] * 100) / 100,
    p50: Math.round(sorted[getIndex(50)] * 100) / 100,
    p90: Math.round(sorted[getIndex(90)] * 100) / 100,
    p95: Math.round(sorted[getIndex(95)] * 100) / 100,
    p99: Math.round(sorted[getIndex(99)] * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
  };
}

async function runStage({ stageName, vus, durationSec, scenarioDistribution = [0.5, 0.3, 0.2] }) {
  console.log(`\n================================================================`);
  console.log(`STARTING STAGE: ${stageName}`);
  console.log(`Virtual Users: ${vus} | Duration: ${durationSec}s`);
  console.log(`================================================================`);

  const memBefore = process.memoryUsage().heapUsed / (1024 * 1024);
  const cpuBefore = process.cpuUsage();
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  const latencies = [];
  let totalRequests = 0;
  let success2xx = 0;
  let rateLimited429 = 0;
  let clientErrors4xx = 0;
  let serverErrors5xx = 0;
  let socketErrors = 0;

  let activeVUs = 0;

  async function worker(vuId) {
    activeVUs++;
    while (Date.now() < endTime) {
      const rand = Math.random();
      let scenario = 'A';
      if (rand < scenarioDistribution[0]) {
        scenario = 'A';
      } else if (rand < scenarioDistribution[0] + scenarioDistribution[1]) {
        scenario = 'B';
      } else {
        scenario = 'C';
      }

      const reqResults = await executeUserScenario(scenario, vuId);
      for (const res of reqResults) {
        totalRequests++;
        latencies.push(res.latencyMs);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          success2xx++;
        } else if (res.statusCode === 429) {
          rateLimited429++;
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          clientErrors4xx++;
        } else if (res.statusCode >= 500) {
          serverErrors5xx++;
        } else {
          socketErrors++;
        }
      }

      // Small realistic diner think time between actions (15ms to 50ms)
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 35));
    }
    activeVUs--;
  }

  // Launch VUs in batches to prevent socket storm on startup
  const batchSize = Math.min(vus, 250);
  const workers = [];
  for (let i = 0; i < vus; i++) {
    workers.push(worker(i + 1));
    if (i % batchSize === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  await Promise.all(workers);

  const durationActualSec = (Date.now() - startTime) / 1000;
  const rps = Math.round((totalRequests / durationActualSec) * 10) / 10;
  const stats = calculatePercentiles(latencies);

  const memAfter = process.memoryUsage().heapUsed / (1024 * 1024);
  const cpuDiff = process.cpuUsage(cpuBefore);
  const cpuPercent = Math.round(((cpuDiff.user + cpuDiff.system) / (durationActualSec * 1e6 * 10)) * 10) / 10;

  // Recovery latency probe
  await new Promise((r) => setTimeout(r, 1500));
  const probe = await makeRequest({
    path: '/api/dine-in/products',
    headers: { Authorization: 'Bearer dev_preview_token' },
  });

  const stageResult = {
    stageName,
    vus,
    durationSec: Math.round(durationActualSec * 10) / 10,
    totalRequests,
    rps,
    success2xx,
    rateLimited429,
    clientErrors4xx,
    serverErrors5xx,
    socketErrors,
    errorRatePercent:
      Math.round(((serverErrors5xx + socketErrors) / Math.max(totalRequests, 1)) * 10000) / 100,
    latencies: stats,
    memoryUsedMb: Math.round(memAfter * 10) / 10,
    recoveryLatencyMs: Math.round(probe.latencyMs * 100) / 100,
  };

  console.log(`Results for ${stageName}:`);
  console.log(`  Requests: ${totalRequests} | Throughput: ${rps} req/sec`);
  console.log(`  2xx Success: ${success2xx} (${Math.round((success2xx / Math.max(totalRequests, 1)) * 100)}%)`);
  console.log(`  429 Rate Limited: ${rateLimited429}`);
  console.log(`  5xx Server Errors: ${serverErrors5xx}`);
  console.log(`  Socket / Connection Errors: ${socketErrors}`);
  console.log(`  Latency: Median=${stats.p50}ms, p90=${stats.p90}ms, p95=${stats.p95}ms, p99=${stats.p99}ms, Max=${stats.max}ms`);
  console.log(`  Post-Test Recovery Latency: ${stageResult.recoveryLatencyMs}ms`);

  return stageResult;
}

async function runFullLoadTestSuite() {
  console.log('========================================================================');
  console.log('LITTLE MONKEY CAFÉ DINING — PRODUCTION LOAD & CAPACITY EVALUATION');
  console.log('========================================================================\n');

  const allResults = [];

  // Stage 1: Baseline (10 VUs, 5 seconds)
  allResults.push(await runStage({ stageName: 'Stage 1: Baseline', vus: 10, durationSec: 5 }));

  // Stage 2A: Moderate Load (100 VUs, 5 seconds)
  allResults.push(await runStage({ stageName: 'Stage 2A: Moderate Load (100 VUs)', vus: 100, durationSec: 5 }));

  // Stage 2B: Moderate Load (500 VUs, 5 seconds)
  allResults.push(await runStage({ stageName: 'Stage 2B: Moderate Load (500 VUs)', vus: 500, durationSec: 5 }));

  // Stage 3: Peak Dining Load (1,000 VUs, 5 seconds)
  allResults.push(await runStage({ stageName: 'Stage 3: Peak Dining Load (1,000 VUs)', vus: 1000, durationSec: 5 }));

  // Stage 4: Stress / Spike Load (2,500 VUs, 5 seconds)
  allResults.push(await runStage({ stageName: 'Stage 4: Stress / Spike Load (2,500 VUs)', vus: 2500, durationSec: 5 }));

  // Stage 5: Extreme / Feasibility Test (5,000 VUs, 5 seconds)
  allResults.push(await runStage({ stageName: 'Stage 5: Extreme Feasibility (5,000 VUs)', vus: 5000, durationSec: 5 }));

  // Save report artifact
  const reportPath = path.join(ARTIFACT_DIR, 'load_test_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`\nSuccessfully exported full load test telemetry to ${reportPath}`);
}

runFullLoadTestSuite().catch((err) => {
  console.error('Fatal load testing runner error:', err);
  process.exit(1);
});
