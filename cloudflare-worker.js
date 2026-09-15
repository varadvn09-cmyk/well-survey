// ============================================================================
// Cloudflare Worker for MahaBhunaksha 7/12 CORS Proxy
// Deploy free on Cloudflare Workers (100,000 requests/day, no credit card)
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const district = url.searchParams.get("district") || "30";
    const taluka = url.searchParams.get("taluka") || "Solapur North";
    const village = url.searchParams.get("village") || "";
    const gatNo = url.searchParams.get("gatNo") || "";

    if (!village || !gatNo) {
      return new Response(JSON.stringify({ success: false, error: "Missing village or gatNo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      // 1. Session Cookie Handshake with index.jsp
      const cookieJar = new Map();
      function updateCookies(resp) {
        // Collect all Set-Cookie headers reliably by iterating headers.
        for (const [hName, hVal] of resp.headers) {
          if (hName.toLowerCase() === 'set-cookie' && hVal) {
            // Each Set-Cookie header contains a full cookie string; take the name=value part before the first ';'
            const pair = hVal.split(';')[0].trim();
            const eq = pair.indexOf('=');
            if (eq > 0) cookieJar.set(pair.substring(0, eq), pair.substring(eq + 1));
          }
        }
      }
      function getCookieHeader() {
        return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
      }

      let currentUrl = "https://mahabhunakasha.mahabhumi.gov.in/27/index.jsp";
      for (let hop = 0; hop < 3; hop++) {
        const hResp = await fetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            ...(cookieJar.size > 0 ? { "Cookie": getCookieHeader() } : {})
          },
          redirect: "manual"
        });
        updateCookies(hResp);
        const loc = hResp.headers.get("location");
        if (hResp.status >= 300 && hResp.status < 400 && loc) {
          currentUrl = loc.startsWith("http") ? loc : new URL(loc, currentUrl).toString();
        } else {
          break;
        }
      }

      // 2. Taluka code mapping
      const distCode = /^\d+$/.test(district) ? district.padStart(2, "0") : "30";
      const talMap = {
        "akkalkot": "11", "barshi": "03", "karmala": "01",
        "madha": "02", "malshiras": "07", "mangalvedhe": "09",
        "mangalwedha": "09", "mohol": "05", "pandharpur": "06",
        "sangole": "08", "solapur north": "04", "north solapur": "04",
        "solapur south": "10", "south solapur": "10"
      };
      const talCode = talMap[taluka.toLowerCase().trim()] || (/^\d+$/.test(taluka) ? taluka.padStart(2, "0") : "04");

      // 3. Village resolution via ListsAfterLevelGeoref
      let vilCode = village.trim();
      if (!vilCode.startsWith("27") || vilCode.length < 16) {
        const vResp = await fetch("https://mahabhunakasha.mahabhumi.gov.in/rest/VillageMapService/ListsAfterLevelGeoref", {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": "https://mahabhunakasha.mahabhumi.gov.in/27/index.html",
            "X-Requested-With": "XMLHttpRequest",
            ...(cookieJar.size > 0 ? { "Cookie": getCookieHeader() } : {})
          },
          body: `state=27&level=3&codes=${encodeURIComponent(`R,${distCode},${talCode},`)}&hasmap=true`
        });
        updateCookies(vResp);
        const vData = await vResp.json();
        const vList = vData[0] || [];

        function phoneticKey(s) {
          if (!s) return { full: "", cons: "" };
          let clean = s.toLowerCase().trim()
            .replace(/sh/g, "s").replace(/ch/g, "c").replace(/ee/g, "i")
            .replace(/oo/g, "u").replace(/w/g, "v").replace(/aa/g, "a")
            .replace(/[^a-z0-9]/g, "");
          let cons = clean.replace(/[aeiou]/g, "");
          return { full: clean, cons: cons };
        }

        const tTarget = phoneticKey(village);
        let bestCode = "";
        let bestScore = 0;

        for (const item of vList) {
          const code = item.code || "";
          const val = (item.value || "").trim();
          if (village.toLowerCase() === val.toLowerCase() || village === code) {
            vilCode = code;
            bestScore = 100;
            break;
          }
          const p = phoneticKey(val);
          if (tTarget.cons && tTarget.cons === p.cons) {
            bestCode = code;
            bestScore = 90;
            break;
          }
          if (tTarget.full && (tTarget.full.includes(p.full) || p.full.includes(tTarget.full))) {
            if (70 > bestScore) { bestScore = 70; bestCode = code; }
          }
        }
        if (bestScore > 0 && bestCode) vilCode = bestCode;
      }

      // 4. Query getPlotInfo
      const gisCode = `RVM${distCode}${talCode}${vilCode}`;
      const pResp = await fetch("https://mahabhunakasha.mahabhumi.gov.in/rest/MapInfo/getPlotInfo", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": "https://mahabhunakasha.mahabhumi.gov.in/27/index.html",
          "X-Requested-With": "XMLHttpRequest",
          ...(cookieJar.size > 0 ? { "Cookie": getCookieHeader() } : {})
        },
        body: `state=27&giscode=${encodeURIComponent(gisCode)}&plotno=${encodeURIComponent(gatNo)}&srs=4326`
      });

      if (pResp.status === 204) {
        return new Response(JSON.stringify({ success: false, error: `No 7/12 record found for Gat #${gatNo} in ${village}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const pData = await pResp.json();
      const infoText = pData.info || "";
      const blocks = infoText.split("---------------------------------");
      const owners = [];

      for (const block of blocks) {
        const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        const o = {};
        for (const line of lines) {
          if (line.includes(":")) {
            const idx = line.indexOf(":");
            const k = line.substring(0, idx).trim().toLowerCase();
            const v = line.substring(idx + 1).trim();
            if (k.includes("survey")) o.subDivision = v;
            else if (k.includes("owner")) o.owner = v;
            else if (k.includes("total area")) o.area = v;
            else if (k.includes("khata")) o.khata = v;
            else if (k.includes("pot")) o.potKharaba = v;
          }
        }
        if (o.owner) owners.push(o);
      }

      return new Response(JSON.stringify({
        success: true,
        gatNo,
        gisCode,
        owners,
        primaryOwner: owners.length > 0 ? owners[0].owner : "",
        totalArea: owners.length > 0 ? owners[0].area : ""
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
