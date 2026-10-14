/**
 * GeoDraft Pro - MahaBhunaksha Cloud Batch Worker
 * Deployable on Cloudflare Workers (Free), AWS Lambda, or Vercel
 * 
 * Features:
 * - Session Cookie Management
 * - Batch Plot Processing (20-50 Gats per call)
 * - Automatic 7/12 Owner & Area Parser
 * - Sub-50ms Edge Network Latency
 */

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};

try {
  addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
} catch(e) {}

async function handleRequest(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let payload = {};
    if (request.method === 'POST') {
      payload = await request.json();
    } else {
      const url = new URL(request.url);
      payload = {
        gisCode: url.searchParams.get('gisCode'),
        village: url.searchParams.get('village'),
        gatList: (url.searchParams.get('gats') || '').split(',').map(s => s.trim()).filter(Boolean)
      };
    }

    const gisCode = (payload.gisCode || '').trim();
    const gatList = payload.gatList || [];

    if (!gisCode || gatList.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing gisCode or gatList (e.g. {"gisCode":"RVM...", "gatList":["1","2"]})'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 1. Establish Session Cookie with NIC MahaBhunaksha (or accept warmed cookie from caller)
    let sessionCookie = (payload.cookie || '').trim();
    if (!sessionCookie) {
      try {
        const sessionResp = await fetch('https://mahabhunakasha.mahabhumi.gov.in/27/index.html', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          redirect: 'manual'
        });
        const rawCookie = sessionResp.headers.get('set-cookie');
        if (rawCookie) {
          sessionCookie = rawCookie.split(';')[0];
        }
      } catch(e) {}
    }

    // 2. Process Gats in Parallel / Quick Sequence (up to 20 concurrent)
    const results = [];
    const chunks = [];
    const chunkSize = 10;
    for (let i = 0; i < gatList.length; i += chunkSize) {
      chunks.push(gatList.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(gatNo => queryPlot(gisCode, String(gatNo), sessionCookie));
      const chunkRes = await Promise.all(promises);
      results.push(...chunkRes);
    }

    return new Response(JSON.stringify({
      success: true,
      gisCode: gisCode,
      village: payload.village || '',
      count: results.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

async function queryPlot(gisCode, gatNo, cookie) {
  try {
    const postBody = `state=27&giscode=${encodeURIComponent(gisCode)}&plotno=${encodeURIComponent(gatNo)}&srs=4326`;
    const resp = await fetch('https://mahabhunakasha.mahabhumi.gov.in/rest/MapInfo/getPlotInfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://mahabhunakasha.mahabhumi.gov.in/27/index.html',
        'Cookie': cookie || ''
      },
      redirect: 'manual',
      body: postBody
    });

    if (!resp.ok) {
      return { gatNo, found: false, error: `HTTP ${resp.status}` };
    }

    const text = await resp.text();
    if (!text || text.trim().length === 0) {
      return { gatNo, found: false, error: 'No record (0 bytes)' };
    }

    const data = JSON.parse(text);
    if (!data.info && !data.plotno) {
      return { gatNo, found: false, error: 'No plot info' };
    }

    // Parse Marathi Owners from raw .info block
    const owners = [];
    let totalArea = data.formatedArea || String(data.area || '');
    if (data.info) {
      const blocks = data.info.split(/---------------------------------/);
      for (const blk of blocks) {
        if (!blk.trim()) continue;
        const subM = blk.match(/Survey No\.\s*:\s*(.+)/);
        const areaM = blk.match(/Total Area\s*:\s*(.+)/);
        const potM = blk.match(/Pot kharaba\s*:\s*(.+)/);
        const ownerM = blk.match(/Owner Name\s*:\s*(.+)/);
        const khataM = blk.match(/Khata No\.\s*:\s*(.+)/);

        if (ownerM) {
          const names = ownerM[1].split(',').map(s => s.trim()).filter(Boolean);
          for (const nm of names) {
            owners.push({
              subDivision: subM ? subM[1].trim() : gatNo,
              area: areaM ? areaM[1].trim() : '',
              potKharaba: potM ? potM[1].trim() : '0.0000',
              owner: nm,
              khata: khataM ? khataM[1].trim() : ''
            });
          }
        }
      }
    }

    return {
      gatNo: gatNo,
      found: true,
      totalArea: totalArea,
      ownersCount: owners.length,
      primaryOwner: owners.length > 0 ? owners[0].owner : '',
      owners: owners,
      rawInfo: data.info || ''
    };

  } catch(e) {
    return { gatNo, found: false, error: e.message };
  }
}
