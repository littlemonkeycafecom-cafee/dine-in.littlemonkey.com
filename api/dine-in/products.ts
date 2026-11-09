import { createApiHandler } from '../_lib/handler.ts';
import { sendJson } from '../../src/server/http.ts';
import { getEnv } from '../../src/server/config.ts';

let _cachedAvailability: Record<string, boolean> = {};
let _lastAvailabilityFetch = 0;

export default createApiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://tdhpatamtqgrvrnfmscj.supabase.co');
  const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_PBDOJAlQHqHqQyAo2OiFkw_kQTIDDJT');
  const sharedBackendOrigin = getEnv('VITE_BACKEND_URL', 'http://localhost:5173');

  let discounts: Record<string, number> = {};
  let isStoreOpen = true;
  let isDineInOpen = true;
  let liveTables: any[] = [];

  try {
    const statusRes = await fetch(`${sharedBackendOrigin}/api/operational/store-status`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      discounts = statusData.discounts || {};
      isStoreOpen = statusData.isOpen !== false;
      isDineInOpen = statusData.dineInEnabled !== false;
      liveTables = Array.isArray(statusData.tables) ? statusData.tables : [];
    }
  } catch {}

  const now = Date.now();
  let liveAvailability: Record<string, boolean> = { ..._cachedAvailability };

  if (now - _lastAvailabilityFetch > 5000 || Object.keys(_cachedAvailability).length === 0) {
    try {
      const itemsRes = await fetch(`${supabaseUrl}/rest/v1/menu_items?select=id,name,slug,is_available`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });
      if (itemsRes.ok) {
        const itemsData: Array<{ slug: string; id: string; name?: string; is_available: boolean }> = await itemsRes.json();
        const freshAvail: Record<string, boolean> = {};
        for (const it of itemsData) {
          const available = it.is_available !== false;
          if (it.slug) freshAvail[it.slug] = available;
          if (it.id) freshAvail[it.id] = available;
          if (it.name) freshAvail[it.name.toLowerCase().trim()] = available;
        }
        _cachedAvailability = freshAvail;
        _lastAvailabilityFetch = now;
        liveAvailability = freshAvail;
      }
    } catch {}
  }

  return sendJson(res, 200, {
    success: true,
    isStoreOpen,
    isDineInOpen,
    discounts,
    liveAvailability,
    liveImages: {},
    tables: liveTables,
  });
});
