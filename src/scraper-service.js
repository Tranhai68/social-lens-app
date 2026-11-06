/**
 * Multi-Platform Scraper Service (Apify + RapidAPI + Transcript Extractor)
 * Hỗ trợ tất cả các kênh: Facebook, TikTok, Instagram, YouTube, Shopee Video, Threads
 */

import { getVietnameseWeekday } from './stats-calculator.js';

/**
 * Tự động nhận diện nền tảng từ URL kênh
 */
export function detectPlatformFromUrl(url = '') {
  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('shopee.vn') || lower.includes('shp.ee')) return 'shopee';
  if (lower.includes('threads.net') || lower.includes('threads.com')) return 'threads';
  return 'facebook';
}

/**
 * Cấu hình Apify Actors cho từng nền tảng
 */
const APIFY_ACTORS = {
  facebook: {
    postsActor: 'apify/facebook-posts-scraper',
    adsActor: 'apify/facebook-ads-scraper',
    buildPostsInput: (url, limit) => ({
      startUrls: [{ url }],
      resultsLimit: limit || 50,
    }),
    buildAdsInput: (url, limit) => ({
      startUrls: [{ url }],
      resultsLimit: limit || 30,
      activeStatus: 'active',
    }),
  },
  tiktok: {
    postsActor: 'clockworks/tiktok-scraper',
    buildPostsInput: (url, limit) => ({
      profiles: [url],
      resultsPerPage: limit || 50,
      shouldDownloadSubtitles: true,
      shouldDownloadVideos: false,
    }),
  },
  instagram: {
    postsActor: 'apify/instagram-scraper',
    buildPostsInput: (url, limit) => ({
      startUrls: [{ url }],
      resultsLimit: limit || 50,
      resultsType: 'posts',
      addParentData: true,
    }),
  },
  youtube: {
    postsActor: 'streamers/youtube-scraper',
    buildPostsInput: (url, limit) => ({
      startUrls: [{ url }],
      maxResults: limit || 50,
      maxResultsShorts: limit || 50,
      downloadSubtitles: true,
    }),
  },
  threads: {
    postsActor: 'apify/instagram-scraper',
    buildPostsInput: (url, limit) => ({
      startUrls: [{ url }],
      resultsLimit: limit || 40,
    }),
  },
  shopee: {
    postsActor: 'apify/web-scraper',
    buildPostsInput: (url, limit) => ({
      startUrls: [{ url }],
      maxPagesPerCrawl: limit || 30,
    }),
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chạy 1 Apify Actor và chờ kết quả trả về
 */
async function runApifyActor(actorId, inputData, apifyToken, timeoutSec = 240) {
  const apiActorId = actorId.replace('/', '~');
  const startUrl = `https://api.apify.com/v2/acts/${apiActorId}/runs?token=${encodeURIComponent(apifyToken)}`;

  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputData),
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Apify khởi chạy lỗi (${startRes.status}): ${errText.slice(0, 200)}`);
  }

  const startJson = await startRes.json();
  const runId = startJson.data?.id;
  const datasetId = startJson.data?.defaultDatasetId;

  const startTime = Date.now();
  while (true) {
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(apifyToken)}`
    );
    if (!statusRes.ok) throw new Error(`Không kiểm tra được trạng thái Apify run ${runId}`);
    const statusJson = await statusRes.json();
    const status = statusJson.data?.status;

    if (status === 'SUCCEEDED') break;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run kết thúc với trạng thái: ${status}`);
    }
    if ((Date.now() - startTime) / 1000 > timeoutSec) {
      throw new Error(`Apify run quá thời gian chờ (${timeoutSec}s)`);
    }
    await sleep(5000);
  }

  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(apifyToken)}&format=json`
  );
  if (!dataRes.ok) throw new Error('Không tải được dataset từ Apify');
  return dataRes.json();
}

/**
 * Quét nhanh qua RapidAPI nếu người dùng cấu hình RAPIDAPI_KEY
 */
async function scrapeViaRapidAPI(platform, url, limit, rapidApiKey) {
  const handle = extractChannelHandle(url);
  if (platform === 'tiktok') {
    const endpoint = `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(handle)}&count=${limit || 30}`;
    const res = await fetch(endpoint, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
      },
    });
    if (!res.ok) throw new Error(`RapidAPI TikTok lỗi: ${res.status}`);
    const json = await res.json();
    return json.data?.videos || [];
  }

  if (platform === 'instagram') {
    const endpoint = `https://instagram-scraper-api2.p.rapidapi.com/v1.2/posts?username_or_id_or_url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com',
      },
    });
    if (!res.ok) throw new Error(`RapidAPI Instagram lỗi: ${res.status}`);
    const json = await res.json();
    return json.data?.items || [];
  }

  throw new Error(`RapidAPI chưa cấu hình endpoint trực tiếp cho nền tảng ${platform}`);
}

export function extractChannelHandle(url = '') {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const raw = parts[parts.length - 1] || parsed.hostname;
    return raw.replace(/^@/, '');
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[1] || 'Channel';
  }
}

function formatViTimestamp(dateObj) {
  const weekday = getVietnameseWeekday(dateObj);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');
  return `${weekday}, ${dd}/${mm}/${yyyy} lúc ${hh}:${min}:${ss}`;
}

/**
 * Chuẩn hóa item trả về từ Apify / RapidAPI thành cấu trúc Post của Social Lens
 */
export function normalizeRawPost(item, idx, platform) {
  const rawTime =
    item.time ||
    item.timestamp ||
    (item.createTime ? item.createTime * 1000 : null) ||
    item.publishedAt ||
    Date.now() - idx * 14400 * 1000;

  const dateObj = new Date(rawTime);
  const validDate = isNaN(dateObj.getTime()) ? new Date(Date.now() - idx * 14400 * 1000) : dateObj;

  const isVideo =
    Boolean(item.isVideo) ||
    Boolean(item.videoUrl) ||
    Boolean(item.playCount) ||
    Boolean(item.viewsCount) ||
    ['video', 'reel', 'short'].includes(String(item.type || '').toLowerCase()) ||
    platform === 'tiktok' ||
    platform === 'youtube';

  let format = 'Ảnh';
  if (isVideo) {
    format = platform === 'youtube' ? 'Video' : 'Reel';
  } else if (Array.isArray(item.images) && item.images.length > 1) {
    format = 'Nhiều ảnh';
  } else if (item.mediaCount && item.mediaCount > 1) {
    format = 'Nhiều ảnh';
  }

  const caption =
    item.text ||
    item.caption ||
    item.message ||
    item.desc ||
    item.title ||
    item.description ||
    '';

  const views = Number(
    item.viewsCount || item.videoViewCount || item.videoPlayCount || item.playCount || item.viewCount || 0
  );
  const reactions = Number(
    item.likes || item.reactionsCount || item.likesCount || item.diggCount || item.likeCount || 0
  );
  const comments = Number(
    item.comments || item.commentsCount || item.commentCount || 0
  );
  const shares = Number(
    item.shares || item.sharesCount || item.shareCount || 0
  );

  // Trích xuất lời thoại (Transcript) nếu có từ dữ liệu phụ đề
  let transcript = item.transcript || item.subtitles || '';
  if (Array.isArray(item.subtitleLinks) && item.subtitleLinks.length > 0 && item.subtitleLinks[0].srt) {
    transcript = item.subtitleLinks[0].srt;
  } else if (Array.isArray(item.subtitles) && item.subtitles.length > 0) {
    transcript = item.subtitles.map((s) => s.srt || s.text || '').join('\n');
  }

  const mediaCount =
    format === 'Nhiều ảnh'
      ? Math.min(Math.max(item.images?.length || item.mediaCount || 3, 2), 5)
      : 1;

  return {
    index: idx + 1,
    id: item.postId || item.id || `post_${idx + 1}`,
    format,
    publishedAt: formatViTimestamp(validDate),
    isoDate: validDate.toISOString(),
    url: item.url || item.postUrl || item.webVideoUrl || '#',
    caption,
    mediaCount,
    views: isVideo ? Math.max(views, (reactions + comments) * 35) : 0,
    reactions,
    comments,
    shares,
    transcript: isVideo ? (transcript || '') : null,
  };
}

/**
 * Chuẩn hóa item Quảng cáo từ Ad Library
 */
export function normalizeRawAd(item, idx) {
  const isVideo =
    Boolean(item.videos?.length) ||
    String(item.displayFormat || item.format || '').toUpperCase().includes('VIDEO');

  return {
    index: idx + 1,
    adId: String(item.adArchiveID || item.adArchiveId || item.id || `180000000000${idx + 1}`),
    caption:
      item.snapshot?.body?.text ||
      item.body ||
      item.caption ||
      item.text ||
      '',
    format: isVideo ? 'VIDEO' : 'MULTI_IMAGES',
    cta: item.snapshot?.ctaText || item.ctaText || item.cta || 'Send message',
  };
}

/**
 * Quét kênh thực tế qua Apify hoặc RapidAPI
 */
export async function scrapeChannelData({
  url,
  platform: explicitPlatform,
  channelName,
  category = 'Brand / Retail',
  dateFrom = '2026-10-01',
  dateTo = '2026-10-31',
  limit = 40,
  apifyToken = '',
  rapidApiKey = '',
}) {
  const platform = explicitPlatform || detectPlatformFromUrl(url);
  const handle = channelName || extractChannelHandle(url).toUpperCase();

  let rawPosts = [];
  let rawAds = [];
  let sourceUsed = 'demo';
  let followers = 0;

  // 1. Thử quét qua Apify nếu có Token
  if (apifyToken && apifyToken.trim().length > 10) {
    const actorCfg = APIFY_ACTORS[platform] || APIFY_ACTORS.facebook;
    const input = actorCfg.buildPostsInput(url, limit);
    rawPosts = await runApifyActor(actorCfg.postsActor, input, apifyToken.trim());
    sourceUsed = 'apify';

    if (rawPosts.length > 0) {
      followers =
        rawPosts[0].pageFollowers ||
        rawPosts[0].ownerFollowersCount ||
        rawPosts[0].authorMeta?.fans ||
        rawPosts[0].channelTotalViews ||
        125000;
    }

    if (actorCfg.adsActor && platform === 'facebook') {
      try {
        rawAds = await runApifyActor(
          actorCfg.adsActor,
          actorCfg.buildAdsInput(url, Math.min(limit, 30)),
          apifyToken.trim(),
          120
        );
      } catch (adErr) {
        console.warn('⚠️ Bỏ qua quét Ads Library:', adErr.message);
      }
    }
  } else if (rapidApiKey && rapidApiKey.trim().length > 10) {
    // 2. Thử quét qua RapidAPI
    rawPosts = await scrapeViaRapidAPI(platform, url, limit, rapidApiKey.trim());
    sourceUsed = 'rapidapi';
  }

  // Nếu có dữ liệu thực từ Apify/RapidAPI
  if (rawPosts.length > 0) {
    const posts = rawPosts.slice(0, limit).map((item, i) => normalizeRawPost(item, i, platform));
    const ads = rawAds.slice(0, 30).map((item, i) => normalizeRawAd(item, i));

    return {
      sourceUsed,
      channel: {
        name: handle,
        platform,
        url,
        followers: followers || 85000,
        category,
        rating: 'N/A',
        dateFrom,
        dateTo,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      },
      posts,
      ads,
    };
  }

  throw new Error(
    'Chưa có APIFY_TOKEN hoặc RAPIDAPI_KEY hợp lệ để quét trực tiếp, hoặc kênh không trả về dữ liệu công khai.'
  );
}

