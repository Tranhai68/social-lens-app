import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateQuantitativeStats,
  filterPostsAndAdsByDateRange,
  analyzeSinglePostContent,
  summarizeWinningContent,
} from './src/stats-calculator.js';
import {
  scrapeChannelData,
  detectPlatformFromUrl,
  extractChannelHandle,
  normalizeRawPost,
  normalizeRawAd,
} from './src/scraper-service.js';
import {
  generate13SectionsWithGemini,
  compareChannelsWithGemini,
  analyzePostDeepWithGemini,
  enrichSimulatedPostsWithGemini,
} from './src/gemini-service.js';
import {
  getSeedReports,
  generateSmartSimulatedChannel,
  buildValidPostUrl,
  buildValidAdUrl,
} from './data/seed-reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Đọc file .env nếu có
function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    console.warn('⚠️ Không thể đọc file .env:', err.message);
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3888);

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadConfig() {
  let saved = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      saved = {};
    }
  }
  let geminiApiKey = saved.geminiApiKey || process.env.GEMINI_API_KEY || '';
  let apifyToken = saved.apifyToken || process.env.APIFY_TOKEN || '';
  let rapidApiKey = saved.rapidApiKey || process.env.RAPIDAPI_KEY || '';

  // Tự động nhận diện nếu người dùng dán nhầm Google Gemini Key (AIzaSy...) vào ô Apify hoặc RapidAPI
  if (!geminiApiKey && apifyToken.startsWith('AIzaSy')) {
    geminiApiKey = apifyToken;
  }
  if (!geminiApiKey && rapidApiKey.startsWith('AIzaSy')) {
    geminiApiKey = rapidApiKey;
  }
  if (apifyToken.startsWith('AIzaSy')) {
    apifyToken = '';
  }
  if (rapidApiKey.startsWith('AIzaSy')) {
    rapidApiKey = '';
  }

  return {
    geminiApiKey,
    geminiModel: saved.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    apifyToken,
    rapidApiKey,
  };
}

function saveConfig(newCfg) {
  const current = loadConfig();
  let geminiApiKey =
    newCfg.geminiApiKey !== undefined ? String(newCfg.geminiApiKey).trim() : current.geminiApiKey;
  let apifyToken =
    newCfg.apifyToken !== undefined ? String(newCfg.apifyToken).trim() : current.apifyToken;
  let rapidApiKey =
    newCfg.rapidApiKey !== undefined ? String(newCfg.rapidApiKey).trim() : current.rapidApiKey;

  if (!geminiApiKey && apifyToken.startsWith('AIzaSy')) {
    geminiApiKey = apifyToken;
  }
  if (!geminiApiKey && rapidApiKey.startsWith('AIzaSy')) {
    geminiApiKey = rapidApiKey;
  }
  if (apifyToken.startsWith('AIzaSy')) {
    apifyToken = '';
  }
  if (rapidApiKey.startsWith('AIzaSy')) {
    rapidApiKey = '';
  }

  const merged = {
    geminiApiKey,
    geminiModel:
      newCfg.geminiModel !== undefined ? String(newCfg.geminiModel).trim() : current.geminiModel,
    apifyToken,
    rapidApiKey,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function loadReports() {
  if (fs.existsSync(REPORTS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('⚠️ Khởi tạo lại dữ liệu báo cáo mẫu do file lỗi:', err.message);
    }
  }
  const seed = getSeedReports();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(seed, null, 2), 'utf8');
  return seed;
}

function saveReports(reports) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
}

let reportsStore = loadReports();

function maskSecret(str = '') {
  if (!str || str.length < 8) return '';
  return `${str.slice(0, 4)}••••••••${str.slice(-4)}`;
}

function enrichReportPostsWithContentAudit(report) {
  if (!report || !Array.isArray(report.posts)) return report;
  const averages = report.stats?.averages || {};
  const followers = report.channel?.followers || 100000;
  const platform = report.channel?.platform || 'facebook';
  const enrichedPosts = report.posts.map((p) => ({
    ...p,
    url: buildValidPostUrl(p, report.channel),
    contentAudit:
      p.contentAudit?.winGoal
        ? p.contentAudit
        : analyzeSinglePostContent(p, averages, followers, platform),
  }));
  const enrichedAds = (report.ads || []).map((a) => ({
    ...a,
    url: buildValidAdUrl(a, report.channel),
  }));
  const winningSummary = summarizeWinningContent(enrichedPosts, averages, followers, platform);
  return {
    ...report,
    posts: enrichedPosts,
    ads: enrichedAds,
    winningSummary,
  };
}

function summarizeReportForList(r) {
  const averages = r.stats?.averages || {};
  const followers = r.channel?.followers || 100000;
  const platform = r.channel?.platform || 'facebook';
  const winSummary =
    r.winningSummary || summarizeWinningContent(r.posts || [], averages, followers, platform);

  return {
    id: r.id,
    channel: r.channel,
    postsCount: r.posts?.length || 0,
    adsCount: r.ads?.length || 0,
    stats: r.stats,
    winningSummary: {
      totalPosts: winSummary.totalPosts,
      totalWinCount: winSummary.totalWinCount,
      superWinCount: winSummary.superWinCount,
      contentWinCount: winSummary.contentWinCount,
      winRatePct: winSummary.winRatePct,
      topWinPillar: winSummary.topWinPillar,
      topWinHook: winSummary.topWinHook,
    },
    funnelSummary: {
      tofu: r.aiAnalysis?.marketingFunnel?.tofu?.count || 0,
      mofu: r.aiAnalysis?.marketingFunnel?.mofu?.count || 0,
      bofu: r.aiAnalysis?.marketingFunnel?.bofu?.count || 0,
    },
    pillarsSummary: (r.aiAnalysis?.contentPillars || []).map((p) => ({
      name: p.name,
      count: p.count,
      avgReactions: p.avgReactions,
      avgComments: p.avgComments,
      avgShares: p.avgShares,
    })),
    executiveSummary: r.aiAnalysis?.executiveSummary || '',
  };
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Payload quá lớn (>25MB)'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. GET /api/config
    if (req.method === 'GET' && pathname === '/api/config') {
      const cfg = loadConfig();
      return sendJson(res, 200, {
        hasGeminiKey: Boolean(cfg.geminiApiKey && cfg.geminiApiKey.length > 8),
        hasApifyToken: Boolean(cfg.apifyToken && cfg.apifyToken.length > 8),
        hasRapidApiKey: Boolean(cfg.rapidApiKey && cfg.rapidApiKey.length > 8),
        geminiKeyMasked: maskSecret(cfg.geminiApiKey),
        apifyTokenMasked: maskSecret(cfg.apifyToken),
        rapidApiKeyMasked: maskSecret(cfg.rapidApiKey),
        geminiModel: cfg.geminiModel || 'gemini-2.5-flash',
      });
    }

    // 2. POST /api/config
    if (req.method === 'POST' && pathname === '/api/config') {
      const body = await readRequestBody(req);
      const updated = saveConfig(body);
      return sendJson(res, 200, {
        ok: true,
        hasGeminiKey: Boolean(updated.geminiApiKey && updated.geminiApiKey.length > 8),
        hasApifyToken: Boolean(updated.apifyToken && updated.apifyToken.length > 8),
        hasRapidApiKey: Boolean(updated.rapidApiKey && updated.rapidApiKey.length > 8),
        geminiKeyMasked: maskSecret(updated.geminiApiKey),
        apifyTokenMasked: maskSecret(updated.apifyToken),
        rapidApiKeyMasked: maskSecret(updated.rapidApiKey),
        geminiModel: updated.geminiModel,
      });
    }

    // 2b. POST /api/config/test (Kiểm tra trực tiếp trạng thái hoạt động của Gemini API Key)
    if (req.method === 'POST' && pathname === '/api/config/test') {
      const body = await readRequestBody(req);
      const cfg = loadConfig();
      const keyToTest = (body.geminiApiKey || cfg.geminiApiKey || '').trim();
      const modelToTest = (body.geminiModel || cfg.geminiModel || 'gemini-2.5-flash').trim();

      if (!keyToTest) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Chưa có Google Gemini API Key để kiểm tra.',
        });
      }

      try {
        let activeModel = modelToTest === 'gemini-2.5-pro' ? 'gemini-3.1-pro-preview' : modelToTest;
        let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(keyToTest)}`;
        let testRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Trả lời ngắn gọn: OK' }] }],
          }),
        });
        if (testRes.status === 404 && activeModel !== 'gemini-2.5-flash') {
          activeModel = 'gemini-2.5-flash';
          endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(keyToTest)}`;
          testRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Trả lời ngắn gọn: OK' }] }],
            }),
          });
        }
        if (!testRes.ok) {
          const errJson = await testRes.json().catch(() => ({}));
          const msg = errJson?.error?.message || `HTTP ${testRes.status}`;
          return sendJson(res, 200, {
            ok: false,
            status: testRes.status,
            error: msg,
          });
        }
        return sendJson(res, 200, {
          ok: true,
          status: 200,
          message: `Kết nối Google Gemini (${activeModel}) thành công! Key hoạt động tốt.`,
        });
      } catch (netErr) {
        return sendJson(res, 200, {
          ok: false,
          error: `Lỗi kết nối mạng tới Google Gemini: ${netErr.message}`,
        });
      }
    }

    // 3. GET /api/reports
    if (req.method === 'GET' && pathname === '/api/reports') {
      const full = parsedUrl.searchParams.get('full') === 'true';
      const platformFilter = parsedUrl.searchParams.get('platform');
      let list = reportsStore;
      if (platformFilter && platformFilter !== 'all') {
        list = list.filter(
          (r) => (r.channel?.platform || '').toLowerCase() === platformFilter.toLowerCase()
        );
      }
      return sendJson(res, 200, {
        reports: full ? list : list.map(summarizeReportForList),
      });
    }

    // 4. POST /api/reports/scan (Quét kênh mới qua Apify / RapidAPI + Smart Simulation + Gemini AI)
    if (req.method === 'POST' && pathname === '/api/reports/scan') {
      const body = await readRequestBody(req);
      const {
        url = '',
        platform: explicitPlatform = '',
        channelName = '',
        category = 'Fashion & Retail Brand',
        dateFrom = '2026-10-01',
        dateTo = '2026-10-31',
        limit = 45,
      } = body;

      if (!url && !channelName) {
        return sendJson(res, 400, { error: 'Vui lòng nhập URL kênh hoặc tên kênh cần phân tích.' });
      }

      const cfg = loadConfig();
      const targetUrl = url || `https://www.${explicitPlatform || 'facebook'}.com/${channelName}`;
      const detectedPlatform = explicitPlatform || detectPlatformFromUrl(targetUrl);

      let scrapedData = null;
      let warningMsg = null;

      try {
        scrapedData = await scrapeChannelData({
          url: targetUrl,
          platform: detectedPlatform,
          channelName,
          category,
          dateFrom,
          dateTo,
          limit: Number(limit || 45),
          apifyToken: cfg.apifyToken,
          rapidApiKey: cfg.rapidApiKey,
        });
      } catch (scrapeErr) {
        warningMsg = scrapeErr.message;
        scrapedData = generateSmartSimulatedChannel({
          url: targetUrl,
          platform: detectedPlatform,
          channelName,
          category,
          dateFrom,
          dateTo,
          limit: Number(limit || 45),
        });
        scrapedData = await enrichSimulatedPostsWithGemini(
          scrapedData,
          cfg.geminiApiKey,
          cfg.geminiModel
        );
      }

      const stats = calculateQuantitativeStats(scrapedData.posts, scrapedData.ads, {
        from: dateFrom,
        to: dateTo,
      });

      const aiAnalysis = await generate13SectionsWithGemini(
        {
          channel: scrapedData.channel,
          posts: scrapedData.posts,
          ads: scrapedData.ads,
          stats,
        },
        cfg.geminiApiKey,
        cfg.geminiModel
      );

      const newReport = {
        id: `rep-${detectedPlatform}-${Date.now()}`,
        sourceUsed: scrapedData.sourceUsed,
        channel: scrapedData.channel,
        posts: scrapedData.posts,
        ads: scrapedData.ads,
        stats,
        aiAnalysis,
      };

      reportsStore.unshift(newReport);
      saveReports(reportsStore);

      return sendJson(res, 201, {
        ok: true,
        warning: warningMsg,
        report: newReport,
      });
    }

    // 5. POST /api/reports/import (Import từ JSON / CSV)
    if (req.method === 'POST' && pathname === '/api/reports/import') {
      const body = await readRequestBody(req);
      const {
        channelName = 'Imported Channel',
        platform = 'facebook',
        url = '',
        category = 'Brand / Business',
        followers = 100000,
        dateFrom = '2026-10-01',
        dateTo = '2026-10-31',
        posts: rawPosts = [],
        ads: rawAds = [],
      } = body;

      const cfg = loadConfig();
      const normalizedPosts = rawPosts.map((item, idx) =>
        item.format && item.publishedAt && item.index
          ? item
          : normalizeRawPost(item, idx, platform)
      );
      const normalizedAds = rawAds.map((item, idx) =>
        item.adId && item.index ? item : normalizeRawAd(item, idx)
      );

      const channel = {
        name: channelName,
        platform,
        url: url || `https://www.${platform}.com/${extractChannelHandle(channelName)}`,
        followers: Number(followers || 100000),
        category,
        rating: 'N/A',
        dateFrom,
        dateTo,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };

      const stats = calculateQuantitativeStats(normalizedPosts, normalizedAds, {
        from: dateFrom,
        to: dateTo,
      });

      const aiAnalysis = await generate13SectionsWithGemini(
        { channel, posts: normalizedPosts, ads: normalizedAds, stats },
        cfg.geminiApiKey,
        cfg.geminiModel
      );

      const newReport = {
        id: `rep-import-${Date.now()}`,
        sourceUsed: 'import',
        channel,
        posts: normalizedPosts,
        ads: normalizedAds,
        stats,
        aiAnalysis,
      };

      reportsStore.unshift(newReport);
      saveReports(reportsStore);

      return sendJson(res, 201, { ok: true, report: newReport });
    }

    // 6. POST /api/reports/reset-seed
    if (req.method === 'POST' && pathname === '/api/reports/reset-seed') {
      reportsStore = getSeedReports();
      saveReports(reportsStore);
      return sendJson(res, 200, { ok: true, count: reportsStore.length });
    }

    // 7. GET /api/reports/:id
    const reportIdMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (req.method === 'GET' && reportIdMatch) {
      const id = decodeURIComponent(reportIdMatch[1]);
      const found = reportsStore.find((r) => r.id === id);
      if (!found) {
        return sendJson(res, 404, { error: 'Không tìm thấy báo cáo.' });
      }
      return sendJson(res, 200, { report: enrichReportPostsWithContentAudit(found) });
    }

    // 8. DELETE /api/reports/:id
    if (req.method === 'DELETE' && reportIdMatch) {
      const id = decodeURIComponent(reportIdMatch[1]);
      const idx = reportsStore.findIndex((r) => r.id === id);
      if (idx === -1) {
        return sendJson(res, 404, { error: 'Không tìm thấy báo cáo để xóa.' });
      }
      reportsStore.splice(idx, 1);
      saveReports(reportsStore);
      return sendJson(res, 200, { ok: true });
    }

    // 9. POST /api/reports/:id/reanalyze (Chạy lại AI Gemini 13 mục)
    const reanalyzeMatch = pathname.match(/^\/api\/reports\/([^/]+)\/reanalyze$/);
    if (req.method === 'POST' && reanalyzeMatch) {
      const id = decodeURIComponent(reanalyzeMatch[1]);
      const report = reportsStore.find((r) => r.id === id);
      if (!report) {
        return sendJson(res, 404, { error: 'Không tìm thấy báo cáo.' });
      }
      const cfg = loadConfig();
      report.stats = calculateQuantitativeStats(report.posts, report.ads, {
        from: report.channel.dateFrom,
        to: report.channel.dateTo,
      });
      report.aiAnalysis = await generate13SectionsWithGemini(
        report,
        cfg.geminiApiKey,
        cfg.geminiModel
      );
      saveReports(reportsStore);
      return sendJson(res, 200, {
        ok: true,
        usedGeminiKey: Boolean(cfg.geminiApiKey && cfg.geminiApiKey.length > 8),
        report: enrichReportPostsWithContentAudit(report),
      });
    }

    // 9b. POST /api/reports/:id/research-period (Lọc & Phân tích chuyên sâu theo Ngày / Tháng chi tiết)
    const researchPeriodMatch = pathname.match(/^\/api\/reports\/([^/]+)\/research-period$/);
    if (req.method === 'POST' && researchPeriodMatch) {
      const id = decodeURIComponent(researchPeriodMatch[1]);
      const report = reportsStore.find((r) => r.id === id);
      if (!report) {
        return sendJson(res, 404, { error: 'Không tìm thấy báo cáo.' });
      }
      const body = await readRequestBody(req);
      const { dateFrom = '', dateTo = '', month = '', runAi = false } = body;

      const { filteredPosts, filteredAds } = filterPostsAndAdsByDateRange(
        report.posts || [],
        report.ads || [],
        { dateFrom, dateTo, month }
      );

      const effectiveFrom = dateFrom || report.channel?.dateFrom || '2026-10-01';
      const effectiveTo = dateTo || report.channel?.dateTo || '2026-10-31';

      const subStats = calculateQuantitativeStats(filteredPosts, filteredAds, {
        from: effectiveFrom,
        to: effectiveTo,
      });

      const pf = report.channel?.platform || 'facebook';
      const avgForSub = subStats.averages || report.stats?.averages || {};
      const flwForSub = report.channel?.followers || 100000;
      const enrichedFilteredPosts = filteredPosts.map((p) => ({
        ...p,
        contentAudit: analyzeSinglePostContent(p, avgForSub, flwForSub, pf),
      }));
      const subWinningSummary = summarizeWinningContent(
        enrichedFilteredPosts,
        avgForSub,
        flwForSub,
        pf
      );

      let subAiAnalysis = report.aiAnalysis;
      if (runAi || filteredPosts.length > 0) {
        const cfg = loadConfig();
        subAiAnalysis = await generate13SectionsWithGemini(
          {
            channel: {
              ...report.channel,
              dateFrom: effectiveFrom,
              dateTo: effectiveTo,
            },
            posts: enrichedFilteredPosts,
            ads: filteredAds,
            stats: subStats,
          },
          runAi ? cfg.geminiApiKey : '',
          cfg.geminiModel
        );
      }

      return sendJson(res, 200, {
        ok: true,
        filteredReport: {
          ...report,
          channel: {
            ...report.channel,
            dateFrom: effectiveFrom,
            dateTo: effectiveTo,
            activeResearchFilter: { dateFrom, dateTo, month },
          },
          posts: enrichedFilteredPosts,
          ads: filteredAds,
          stats: subStats,
          winningSummary: subWinningSummary,
          aiAnalysis: subAiAnalysis,
        },
      });
    }

    // 9c. POST /api/reports/:id/analyze-post (AI Phân tích chuyên sâu 1 bài viết: Hook, Phong cách, Hiệu quả)
    const analyzePostMatch = pathname.match(/^\/api\/reports\/([^/]+)\/analyze-post$/);
    if (req.method === 'POST' && analyzePostMatch) {
      const id = decodeURIComponent(analyzePostMatch[1]);
      const report = reportsStore.find((r) => r.id === id);
      if (!report) {
        return sendJson(res, 404, { error: 'Không tìm thấy báo cáo.' });
      }
      const body = await readRequestBody(req);
      const postIndex = Number(body.postIndex || 1);
      const post = (report.posts || []).find((p) => Number(p.index) === postIndex);
      if (!post) {
        return sendJson(res, 404, { error: `Không tìm thấy Bài ${postIndex}` });
      }
      const cfg = loadConfig();
      const postAudit = await analyzePostDeepWithGemini(
        post,
        report.channel,
        report.stats,
        cfg.geminiApiKey,
        cfg.geminiModel
      );
      return sendJson(res, 200, {
        ok: true,
        postIndex,
        postAudit,
      });
    }

    // 10. POST /api/compare/ai (So sánh đa kênh bằng Gemini AI)
    if (req.method === 'POST' && pathname === '/api/compare/ai') {
      const body = await readRequestBody(req);
      const { reportIds = [] } = body;
      const selected = reportsStore.filter((r) => reportIds.includes(r.id));
      if (selected.length < 2) {
        return sendJson(res, 400, {
          error: 'Vui lòng chọn ít nhất 2 báo cáo kênh để thực hiện so sánh đa kênh.',
        });
      }
      const cfg = loadConfig();
      const comparison = await compareChannelsWithGemini(
        selected,
        cfg.geminiApiKey,
        cfg.geminiModel
      );
      return sendJson(res, 200, {
        ok: true,
        usedGeminiKey: Boolean(cfg.geminiApiKey && cfg.geminiApiKey.length > 8),
        comparison,
      });
    }

    // 11. Phục vụ Static Files trong public/
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
    const absPath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      const ext = path.extname(absPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(absPath).pipe(res);
      return;
    }

    // SPA Fallback về index.html
    const indexHtml = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexHtml).pipe(res);
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('❌ Server Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Social Lens Analytics Server đang chạy tại: http://localhost:${PORT}`);
});

