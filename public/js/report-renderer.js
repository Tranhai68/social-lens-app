/**
 * Single Channel Report Renderer (Upgraded)
 * - Tái hiện 100% bố cục báo cáo PDF Social Lens (L'AMME)
 * - Bổ sung Bộ lọc Research theo Ngày & theo Tháng chi tiết (Interactive Date & Month Research Panel)
 * - Bổ sung Phân tích chuyên sâu từng Bài viết: Bóc tách Câu Hook, Phong cách Content, Công thức viết,
 *   Từ khóa đắt giá, Đánh giá Hiệu quả so với TB kênh & Đề xuất viết lại Hook bằng Gemini AI.
 */

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(val) {
  if (val === null || val === undefined || val === 'N/A') return 'N/A';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

function fmtSignedPct(val) {
  if (val === null || val === undefined || isNaN(Number(val))) return '';
  const n = Number(val);
  return n >= 0 ? `+${n}%` : `${n}%`;
}

/**
 * Biến đổi các cụm "Bài 1", "Bài 84", "Quảng cáo 2" trong văn bản thành chip có thể click
 */
function linkifyPostAndAdRefs(text = '') {
  const safe = escapeHtml(text);
  return safe
    .replace(/\bBài\s+(\d+)\b/g, (_, idx) => {
      return `<button type="button" class="ref-chip" data-ref-type="post" data-ref-index="${idx}">Bài ${idx}</button>`;
    })
    .replace(/\bQuảng cáo\s+(\d+)\b/g, (_, idx) => {
      return `<button type="button" class="ref-chip" data-ref-type="ad" data-ref-index="${idx}">Quảng cáo ${idx}</button>`;
    });
}

function renderRefChipsList(indices = [], type = 'post') {
  if (!Array.isArray(indices) || indices.length === 0) return '';
  const labelPrefix = type === 'ad' ? 'Quảng cáo' : 'Bài';
  const chips = indices
    .map(
      (idx) =>
        `<button type="button" class="ref-chip" data-ref-type="${type}" data-ref-index="${idx}">${labelPrefix} ${idx}</button>`
    )
    .join('');
  return `<div class="sl-ref-chips-wrap">${chips}</div>`;
}

/**
 * Vẽ biểu đồ SVG Donut chuẩn xác theo tỷ lệ phần trăm
 */
function renderSvgDonutChart(segments = []) {
  const size = 148;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const circlesHtml = segments
    .map((seg) => {
      const pct = Math.max(0, Math.min(100, Number(seg.percentage || 0)));
      const dash = (pct / 100) * circumference;
      const gap = circumference - dash;
      const circle = `<circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${radius}"
        fill="transparent"
        stroke="${seg.color || '#6366f1'}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dash} ${gap}"
        stroke-dashoffset="${-currentOffset}"
        transform="rotate(-90 ${size / 2} ${size / 2})"
      />`;
      currentOffset += dash;
      return circle;
    })
    .join('');

  const legendHtml = segments
    .map(
      (seg) => `
      <div class="sl-legend-item">
        <span class="sl-legend-dot" style="background:${seg.color || '#6366f1'}"></span>
        <span>${escapeHtml(seg.label)}: <strong>${seg.percentage}%</strong></span>
      </div>`
    )
    .join('');

  return `
    <div class="sl-donut-layout">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="${strokeWidth}" />
        ${circlesHtml}
      </svg>
      <div class="sl-legend-list">
        ${legendHtml}
      </div>
    </div>
  `;
}

export function resolvePostOriginalUrl(post, channel = {}) {
  const rawUrl = String(post?.url || '').trim();
  const baseChannelUrl = String(channel?.url || 'https://www.facebook.com/lamme.official')
    .trim()
    .replace(/\/+$/, '');
  const platform = String(channel?.platform || 'facebook').toLowerCase();
  const idx = post?.index || 1;
  const fmt = String(post?.format || '').toLowerCase();
  const isVideo = fmt.includes('reel') || fmt.includes('video') || fmt.includes('short');

  if (
    rawUrl &&
    rawUrl.startsWith('http') &&
    !rawUrl.includes('/posts/100') &&
    !rawUrl.includes('#post-')
  ) {
    return rawUrl;
  }

  if (platform === 'facebook') {
    return isVideo
      ? `${baseChannelUrl}/reels/?post_ref=${idx}`
      : `${baseChannelUrl}?post_ref=${idx}`;
  }
  if (platform === 'instagram') {
    return isVideo
      ? `${baseChannelUrl}/reels/?post_ref=${idx}`
      : `${baseChannelUrl}/?post_ref=${idx}`;
  }
  if (platform === 'youtube') {
    return fmt.includes('short')
      ? `${baseChannelUrl}/shorts?post_ref=${idx}`
      : `${baseChannelUrl}/videos?post_ref=${idx}`;
  }
  return `${baseChannelUrl}?post_ref=${idx}`;
}

export function resolveAdOriginalUrl(ad, channel = {}) {
  if (ad?.url && String(ad.url).startsWith('http')) return ad.url;
  const baseChannelUrl = String(channel?.url || 'https://www.facebook.com/lamme.official')
    .trim()
    .replace(/\/+$/, '');
  const platform = String(channel?.platform || 'facebook').toLowerCase();
  const handle =
    baseChannelUrl.split('/').filter(Boolean).pop()?.replace(/^@/, '') || channel?.name || '';
  if (platform === 'facebook' || platform === 'instagram') {
    return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&q=${encodeURIComponent(handle)}`;
  }
  return `${baseChannelUrl}?ad_ref=${ad?.index || 1}`;
}

/**
 * Render 1 thẻ Bài đăng (Post Card) kèm Khung Phân Tích Chuyên Sâu Nội Dung, Câu Hook & Đánh giá Nội dung WIN
 */
export function renderPostCardHtml(post, channel = {}) {
  const postUrl = resolvePostOriginalUrl(post, channel);
  const fmtLower = String(post.format || '').toLowerCase();
  const isVideo =
    fmtLower.includes('reel') ||
    fmtLower.includes('video') ||
    fmtLower.includes('shorts') ||
    fmtLower.includes('live');
  const mediaCount = Math.max(1, Math.min(4, Number(post.mediaCount || (isVideo ? 1 : 1))));
  const mediaBoxes = [];
  for (let m = 1; m <= mediaCount; m++) {
    mediaBoxes.push(`
      <div class="sl-media-box">
        <div class="sl-media-icon-circle">${isVideo ? '▶' : fmtLower.includes('thread') ? '🧵' : '🖼️'}</div>
        <span>${escapeHtml(post.format || 'Media')} #${m}</span>
      </div>
    `);
  }

  const transcriptHtml = post.transcript
    ? `
      <div class="sl-transcript-box">
        <div class="sl-transcript-title">
          <span>🎙️ Bóc tách Lời thoại Video (SRT / Voiceover):</span>
          <span style="font-weight:600; color:var(--primary)">Đã đọc chi tiết âm thanh</span>
        </div>
        <div class="sl-transcript-content">${escapeHtml(post.transcript)}</div>
      </div>
    `
    : '';

  const audit = post.contentAudit || {};
  const isWin = Boolean(audit.isWin);
  const isSuperWin = audit.tierClass === 'viral';

  const vsStatsText = [
    audit.viewsMultiplier ? `${audit.viewsMultiplier}x Views TB` : null,
    audit.interactionsMultiplier ? `${audit.interactionsMultiplier}x Tương tác TB` : null,
    audit.er ? `ER: ${audit.er}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const winRibbonHtml = isWin
    ? `
      <div style="background:${isSuperWin ? 'linear-gradient(90deg, #fef3c7, #dcfce7)' : 'linear-gradient(90deg, #e0e7ff, #f0fdf4)'}; border:1px solid ${isSuperWin ? '#fbbf24' : '#818cf8'}; border-radius:6px; padding:7px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="background:${isSuperWin ? '#d97706' : '#4f46e5'}; color:#fff; font-weight:800; font-size:11px; padding:2px 8px; border-radius:999px;">
            ${escapeHtml(audit.winBadgeLabel || '🔥 CONTENT WIN')}
          </span>
          <span style="font-size:11.5px; font-weight:700; color:#1e293b;">
            🎯 Mục tiêu Win: ${escapeHtml(audit.winGoal || 'Chuyển đổi & Reach')}
          </span>
        </div>
        <span style="font-size:11px; font-weight:700; color:#047857;">
          📈 ${escapeHtml(vsStatsText)}
        </span>
      </div>
    `
    : '';

  const winDriversChips =
    Array.isArray(audit.winDrivers) && audit.winDrivers.length > 0
      ? `
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:2px;">
          ${audit.winDrivers
            .map(
              (d) =>
                `<span style="font-size:10.8px; font-weight:600; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 7px; border-radius:4px;">✓ ${escapeHtml(d)}</span>`
            )
            .join('')}
        </div>
      `
      : '';

  const auditBoxHtml = audit.hookType
    ? `
      <div class="sl-post-audit-box" style="${isWin ? 'border-color:#86efac; background:#f8fafc;' : ''}">
        ${winRibbonHtml}
        <div class="sl-post-audit-header">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="sl-tier-badge ${escapeHtml(audit.tierClass || 'standard')}">
              Điểm Content: ${audit.score || 65}/100 · ${escapeHtml(audit.tier || 'Ổn định')}
            </span>
            ${
              !isWin
                ? `<span style="font-size:11px; color:var(--text-secondary); font-weight:600;">(${escapeHtml(vsStatsText)})</span>`
                : ''
            }
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm deep-post-audit-btn no-print"
            data-post-index="${post.index}"
            style="padding:3px 9px; font-size:11.5px; border-color:#a5b4fc; color:var(--primary); background:#ffffff;"
          >
            🧠 AI Giải phẫu Bài &amp; Kịch bản
          </button>
        </div>

        <!-- Phân tích câu Hook mở đầu & Đọc chi tiết 3 lớp nội dung -->
        <div class="sl-hook-quote">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; gap:6px; flex-wrap:wrap;">
            <strong style="color:var(--primary); font-size:11.5px;">🎯 Kỹ thuật Hook: ${escapeHtml(audit.hookType)}</strong>
            <span class="sl-m-badge" style="font-size:10.5px; padding:1px 6px;">Điểm Hook: <strong>${audit.hookScore || 8.0}/10</strong></span>
          </div>
          <div style="color:var(--text-main); font-style:italic; font-size:12px;">
            "${escapeHtml(audit.videoHookSpoken || audit.hookSentence || '')}"
          </div>
          ${
            audit.videoBodySpoken
              ? `<div style="font-size:11.2px; color:var(--text-secondary); margin-top:3px;">🎙️ <strong>Nội dung thân &amp; kết video:</strong> "${escapeHtml(audit.videoBodySpoken)}"</div>`
              : ''
          }
          <div style="font-size:11.2px; color:var(--text-secondary); margin-top:3px;">
            💡 <strong>Đòn bẩy tâm lý:</strong> ${escapeHtml(audit.hookMechanism || '')}
          </div>
        </div>

        <!-- Phân loại Đa chiều: Tuyến bài, Góc tiếp cận, Công thức viết, Phễu & CTA -->
        <div class="sl-audit-tags-grid">
          <div class="sl-audit-tag-item">
            <span class="sl-audit-tag-label">📌 Phân loại Tuyến nội dung (Pillar)</span>
            <span class="sl-audit-tag-val">${escapeHtml(audit.contentPillar || '')}</span>
          </div>
          <div class="sl-audit-tag-item">
            <span class="sl-audit-tag-label">🧭 Góc tiếp cận (Content Angle)</span>
            <span class="sl-audit-tag-val">${escapeHtml(audit.contentAngle || audit.contentStyle || '')}</span>
          </div>
          <div class="sl-audit-tag-item">
            <span class="sl-audit-tag-label">📐 Công thức Copywriting</span>
            <span class="sl-audit-tag-val">${escapeHtml(audit.copyFormula || '')}</span>
          </div>
          <div class="sl-audit-tag-item">
            <span class="sl-audit-tag-label">📣 Tầng Phễu &amp; Kỹ thuật CTA</span>
            <span class="sl-audit-tag-val">${escapeHtml((audit.funnelStage || '').split(' ')[0])} · ${escapeHtml(audit.ctaType || '')}</span>
          </div>
        </div>

        ${winDriversChips}

        <!-- Từ khóa đắt giá -->
        <div>
          <span style="font-size:11px; color:var(--text-muted); font-weight:600; margin-right:4px;">🔑 Từ khóa &amp; Thực thể bóc tách:</span>
          ${(audit.matchedKeywords || [])
            .map((kw) => `<span class="sl-kw-chip">${escapeHtml(kw)}</span>`)
            .join('')}
        </div>

        <!-- Giải mã Lý do WIN hoặc Đề xuất sửa bài -->
        <div class="sl-verdict-note" style="${isWin ? 'background:#f0fdf4; border-color:#bbf7d0;' : ''}">
          <div>
            <strong>${isWin ? '🧬 Giải mã Tại sao Bài WIN:' : '📊 Đánh giá hiệu quả:'}</strong>
            ${escapeHtml(audit.whyItWon || audit.verdict || '')}
          </div>
          <div style="margin-top:4px; color:var(--primary);">
            <strong>${isWin ? '🚀 Công thức Nhân bản / Scale Ads:' : '🔧 Gợi ý tối ưu &amp; Viết lại Hook:'}</strong>
            ${escapeHtml(isWin ? audit.optimizationTip || '' : audit.rewrittenHook || audit.optimizationTip || '')}
          </div>
        </div>
      </div>
    `
    : '';

  return `
    <article class="sl-post-card" id="report-post-card-${post.index}" style="${isSuperWin ? 'border:1.5px solid #f59e0b;' : isWin ? 'border:1.5px solid #10b981;' : ''}">
      <div class="sl-post-header">
        <div class="sl-post-title" style="flex-wrap:wrap;">
          <span>Bài ${post.index}</span>
          <span>·</span>
          <span class="sl-format-tag">${escapeHtml(post.format || 'Bài đăng')}</span>
          ${
            isWin
              ? `<span style="font-size:10.5px; font-weight:800; padding:1px 7px; border-radius:999px; background:${isSuperWin ? '#fef3c7' : '#dcfce7'}; color:${isSuperWin ? '#b45309' : '#047857'}; border:1px solid ${isSuperWin ? '#fcd34d' : '#86efac'};">${escapeHtml(audit.winBadgeLabel)}</span>`
              : ''
          }
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="sl-post-date">${escapeHtml(post.publishedAt || '')}</span>
          <a
            href="${escapeHtml(postUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-outline btn-sm no-print"
            style="padding:2px 8px; font-size:11.2px; color:var(--primary); border-color:#c7d2fe; background:#eef2ff; text-decoration:none; font-weight:700;"
            title="Mở xem trực tiếp bài viết gốc trên kênh"
          >
            🔗 Xem bài gốc &nearr;
          </a>
        </div>
      </div>

      <div class="sl-post-body">
        <div style="font-size:11.5px; color:var(--text-secondary); background:#f8fafc; border:1px dashed var(--border-color); border-radius:5px; padding:5px 9px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:75%;">
            🌐 <strong>Link bài gốc:</strong> <a href="${escapeHtml(postUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:underline;">${escapeHtml(postUrl)}</a>
          </span>
          <a href="${escapeHtml(postUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:700; color:var(--primary); text-decoration:none; white-space:nowrap;">Mở tab mới &nearr;</a>
        </div>
        <div class="sl-post-caption">${escapeHtml(post.caption || '')}</div>
        ${transcriptHtml}
        ${auditBoxHtml}
        <div class="sl-media-strip">
          ${mediaBoxes.join('')}
        </div>
      </div>

      <div class="sl-post-metrics">
        <div class="sl-metric-cell">
          <span class="sl-metric-label">Reaction / Tim</span>
          <span class="sl-metric-val">${fmtNum(post.reactions || 0)}</span>
        </div>
        <div class="sl-metric-cell">
          <span class="sl-metric-label">Bình luận</span>
          <span class="sl-metric-val">${fmtNum(post.comments || 0)}</span>
        </div>
        <div class="sl-metric-cell">
          <span class="sl-metric-label">Chia sẻ / Lưu</span>
          <span class="sl-metric-val">${fmtNum(post.shares || 0)}</span>
        </div>
        <div class="sl-metric-cell">
          <span class="sl-metric-label">Lượt xem</span>
          <span class="sl-metric-val">${post.views > 0 ? fmtNum(post.views) : '—'}</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render 1 thẻ Quảng cáo (Ad Card)
 */
export function renderAdCardHtml(ad, channel = {}) {
  const adUrl = resolveAdOriginalUrl(ad, channel);
  const isVideo = String(ad.format || '').toUpperCase().includes('VIDEO');
  const mediaCount = isVideo ? 1 : Math.min(4, Number(ad.mediaCount || 4));
  const mediaBoxes = [];
  for (let m = 1; m <= mediaCount; m++) {
    mediaBoxes.push(`
      <div class="sl-media-box">
        <div class="sl-media-icon-circle">${isVideo ? '▶' : '🖼️'}</div>
        <span>Media ${m}</span>
      </div>
    `);
  }

  const transcriptHtml = ad.transcript
    ? `
      <div class="sl-transcript-box">
        <div class="sl-transcript-title">
          <span>🎙️ Lời thoại:</span>
          <span style="font-weight:500; color:var(--text-muted)">Ad Transcript</span>
        </div>
        <div class="sl-transcript-content">${escapeHtml(ad.transcript)}</div>
      </div>
    `
    : '';

  return `
    <article class="sl-post-card" id="report-ad-card-${ad.index}">
      <div class="sl-post-header">
        <div class="sl-post-title" style="flex-wrap:wrap;">
          <span>Quảng cáo ${ad.index}</span>
          <span class="sl-ad-status-tag">${escapeHtml(ad.status || 'Đang chạy')}</span>
          <span style="font-size:11.5px; color:var(--text-muted); font-weight:500;">${escapeHtml(ad.publishedLabel || '')}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="sl-post-date">ID: ${escapeHtml(ad.adId || '')}</span>
          <a
            href="${escapeHtml(adUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-outline btn-sm no-print"
            style="padding:2px 8px; font-size:11px; color:var(--primary); border-color:#c7d2fe; background:#eef2ff; text-decoration:none; font-weight:700;"
            title="Xem mẫu quảng cáo trên Thư viện Quảng cáo"
          >
            🔗 Xem QC gốc &nearr;
          </a>
        </div>
      </div>

      <div class="sl-post-body">
        <div class="sl-post-caption">${escapeHtml(ad.caption || '')}</div>
        ${transcriptHtml}
        <div class="sl-media-strip">
          ${mediaBoxes.join('')}
        </div>
      </div>

      <div class="sl-post-metrics ad-metrics">
        <div class="sl-metric-cell">
          <span class="sl-metric-label">Loại</span>
          <span class="sl-metric-val">${isVideo ? 'VIDEO' : 'MULTI_IMAGES'}</span>
        </div>
        <div class="sl-metric-cell">
          <span class="sl-metric-label">CTA</span>
          <span class="sl-metric-val">${escapeHtml(ad.cta || 'Send message')}</span>
        </div>
      </div>
    </article>
  `;
}

function renderStatsTableRows(rows = [], allowDateClick = false) {
  return rows
    .map((r) => {
      // Nếu là bảng Ngày (DD/MM/YYYY), cho phép bấm nút lọc ngay ngày đó
      let dateFilterBtn = '';
      if (allowDateClick && /^\d{2}\/\d{2}\/\d{4}$/.test(r.label)) {
        const [dd, mm, yyyy] = r.label.split('/');
        const ymd = `${yyyy}-${mm}-${dd}`;
        dateFilterBtn = `<button type="button" class="ref-chip filter-single-day-btn no-print" data-ymd="${ymd}" style="margin-left:8px; font-size:10.5px;">🔍 Lọc ngày này</button>`;
      }
      return `
      <tr>
        <td><strong>${escapeHtml(r.label)}</strong>${dateFilterBtn}</td>
        <td class="num">${fmtNum(r.posts ?? r.postsCount ?? 0)}</td>
        <td class="num">${fmtNum(r.views || 0)}</td>
        <td class="num">${fmtNum(r.reactions || 0)}</td>
        <td class="num">${fmtNum(r.comments || 0)}</td>
        <td class="num">${fmtNum(r.shares || 0)}</td>
      </tr>
    `;
    })
    .join('');
}

function renderMetricBadges(item) {
  const badges = [];
  if (item.count !== undefined) {
    badges.push(`<span class="sl-m-badge">Số bài <strong>${fmtNum(item.count)}</strong></span>`);
  }
  if (item.avgReactions !== undefined) {
    badges.push(`<span class="sl-m-badge">Reactions TB <strong>${fmtNum(item.avgReactions)}</strong></span>`);
  }
  if (item.avgComments !== undefined) {
    badges.push(`<span class="sl-m-badge">Bình luận TB <strong>${fmtNum(item.avgComments)}</strong></span>`);
  }
  if (item.avgShares !== undefined) {
    badges.push(`<span class="sl-m-badge">Chia sẻ TB <strong>${fmtNum(item.avgShares)}</strong></span>`);
  }
  if (item.avgViews !== undefined && item.avgViews > 0) {
    badges.push(`<span class="sl-m-badge">Lượt xem TB <strong>${fmtNum(item.avgViews)}</strong></span>`);
  }
  if (item.er !== undefined) {
    badges.push(`<span class="sl-m-badge">ER <strong>${escapeHtml(item.er)}</strong></span>`);
  }
  return `<div class="sl-metric-badges">${badges.join('')}</div>`;
}

/**
 * Render Trung tâm Phân loại Nội dung & Đánh giá Nội dung WIN (Winning Content Lab)
 * Hỗ trợ đa nền tảng: Facebook, TikTok, Instagram, Threads, YouTube, Shopee Video
 */
function renderWinningContentSectionHtml(report) {
  const { channel = {}, posts = [], winningSummary = {} } = report;
  const pf = String(channel.platform || 'facebook').toLowerCase();
  const totalPosts = winningSummary.totalPosts || posts.length || 1;
  const winPosts = posts.filter((p) => p.contentAudit?.isWin);
  const superWinCount =
    winningSummary.superWinCount ??
    posts.filter((p) => p.contentAudit?.tierClass === 'viral').length;
  const contentWinCount =
    winningSummary.contentWinCount ??
    posts.filter((p) => p.contentAudit?.tierClass === 'high').length;
  const totalWinCount = winningSummary.totalWinCount ?? winPosts.length;
  const winRatePct =
    winningSummary.winRatePct ?? Math.round((totalWinCount / Math.max(1, totalPosts)) * 100);

  const byPillar = winningSummary.byPillar || [];
  const byHook = winningSummary.byHook || [];
  const topWinPillar = winningSummary.topWinPillar || byPillar[0] || { name: 'Giải quyết Nỗi đau', winRate: 45 };
  const topWinHook = winningSummary.topWinHook || byHook[0] || { name: 'Câu hỏi / Phản biện', winRate: 50 };
  const topWinningPosts =
    Array.isArray(winningSummary.topWinningPosts) && winningSummary.topWinningPosts.length > 0
      ? winningSummary.topWinningPosts.slice(0, 6)
      : [...winPosts]
          .sort((a, b) => (b.contentAudit?.score || 0) - (a.contentAudit?.score || 0))
          .slice(0, 6);

  const platformCriteriaText =
    pf === 'tiktok'
      ? 'Chuẩn TikTok For You: Views ≥ 1.5x TB kênh + Tỷ lệ giữ chân 3s đầu (Spoken SRT Hook) & Lượt Share/Comment hỏi giỏ hàng vượt chuẩn.'
      : pf === 'instagram'
        ? 'Chuẩn Instagram Reels & Carousel: Tỷ lệ Tương tác & Lưu/Chia sẻ (Saves & Shares) ≥ 1.5x TB kênh + Thẩm mỹ Lookbook/OOTD rõ nét.'
        : pf === 'threads'
          ? 'Chuẩn Threads Thảo luận: Tỷ lệ Reply & Repost (Chia sẻ quan điểm / Hỏi đáp cộng đồng) ≥ 1.5x TB kênh với câu mở đầu chạm cảm xúc.'
          : pf === 'shopee'
            ? 'Chuẩn Shopee Video & Live: Lượt xem ≥ 1.5x TB + Tương tác hỏi mã giảm giá / bấm Giỏ hàng cam cao đột biến.'
            : pf === 'youtube'
              ? 'Chuẩn YouTube Shorts & Lookbook: Views ≥ 1.5x TB + Giữ chân khán giả bằng cấu trúc tiêu đề SEO & Hook 3 giây đầu.'
              : 'Chuẩn Facebook Fanpage: Lượt xem Reel hoặc Tương tác (Reactions + Comment + Share) ≥ 1.5x TB kênh kèm cấu trúc kịch bản & CTA rõ ràng.';

  return `
    <div class="sl-section-block" id="sec-winning-content" style="border:1.5px solid #a7f3d0; background:linear-gradient(180deg, #f0fdf4 0%, #ffffff 220px);">
      <div class="sl-section-bar">
        <div class="sl-section-bar-left">
          <span class="sl-bar-accent" style="background:#059669;"></span>
          <h2 class="sl-section-bar-title" style="color:#065f46;">
            🏆 TRUNG TÂM ĐỌC CHI TIẾT, PHÂN LOẠI &amp; ĐÁNH GIÁ NỘI DUNG WIN (${escapeHtml(pf.toUpperCase())})
          </h2>
          <span class="sl-tier-badge viral">${totalWinCount}/${totalPosts} Bài WIN (${winRatePct}%)</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm no-print" id="quickFilterOnlyWinsBtn" style="background:#059669; border-color:#059669;">
          🔥 Lọc xem riêng ${totalWinCount} Bài WIN dưới danh sách &darr;
        </button>
      </div>

      <!-- 4 KPI CARDS TỔNG QUAN NỘI DUNG WIN -->
      <div class="sl-ideas-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:18px;">
        <div class="sl-idea-card" style="background:#ffffff; border-color:#86efac;">
          <div>
            <div style="font-size:11.5px; font-weight:700; color:#047857; text-transform:uppercase;">Tỷ lệ Nội dung WIN (Win Rate)</div>
            <div style="font-size:26px; font-weight:800; color:#065f46; margin:4px 0;">${winRatePct}%</div>
            <div style="font-size:12px; color:var(--text-secondary);">
              🏆 <strong>${superWinCount}</strong> Super Win · 🔥 <strong>${contentWinCount}</strong> Content Win / ${totalPosts} bài
            </div>
          </div>
        </div>

        <div class="sl-idea-card" style="background:#ffffff;">
          <div>
            <div style="font-size:11.5px; font-weight:700; color:var(--primary); text-transform:uppercase;">Tuyến Nội dung (Pillar) WIN #1</div>
            <div style="font-size:14.5px; font-weight:800; color:var(--text-main); margin:5px 0;">${escapeHtml(topWinPillar.name || '')}</div>
            <div style="font-size:12px; color:#047857; font-weight:700;">
              Tỷ lệ Win: ${topWinPillar.winRate || 0}% (${topWinPillar.winCount || 0}/${topWinPillar.count || 0} bài)
            </div>
          </div>
        </div>

        <div class="sl-idea-card" style="background:#ffffff;">
          <div>
            <div style="font-size:11.5px; font-weight:700; color:#b45309; text-transform:uppercase;">Kỹ thuật Hook 3s WIN Mạnh Nhất</div>
            <div style="font-size:14.5px; font-weight:800; color:var(--text-main); margin:5px 0;">${escapeHtml(topWinHook.name || '')}</div>
            <div style="font-size:12px; color:#b45309; font-weight:700;">
              Tỷ lệ Win: ${topWinHook.winRate || 0}% · TB ${fmtNum(topWinHook.avgViews || 0)} views
            </div>
          </div>
        </div>

        <div class="sl-idea-card" style="background:#ffffff;">
          <div>
            <div style="font-size:11.5px; font-weight:700; color:#3730a3; text-transform:uppercase;">Hệ quy chiếu Đánh giá WIN</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px; line-height:1.45;">
              ${escapeHtml(platformCriteriaText)}
            </div>
          </div>
        </div>
      </div>

      <!-- 2 BẢNG MA TRẬN PHÂN LOẠI NỘI DUNG & TỶ LỆ WIN THEO PILLAR VÀ HOOK -->
      <div class="sl-summary-two-col" style="margin-bottom:20px;">
        <div class="sl-quant-card">
          <div class="sl-quant-card-title">📌 1. Phân loại Tuyến Nội dung (Content Pillars) &amp; Tỷ lệ Bài WIN</div>
          <div class="sl-table-wrap">
            <table class="sl-table">
              <thead>
                <tr>
                  <th>Tuyến nội dung (Content Pillar)</th>
                  <th class="num">Số bài</th>
                  <th class="num">Số bài WIN</th>
                  <th class="num">Tỷ lệ WIN</th>
                  <th class="num">Views TB</th>
                  <th class="num">Tương tác TB</th>
                </tr>
              </thead>
              <tbody>
                ${byPillar
                  .map(
                    (row) => `
                  <tr>
                    <td><strong>${escapeHtml(row.name)}</strong></td>
                    <td class="num">${fmtNum(row.count)}</td>
                    <td class="num"><strong style="color:#047857;">${fmtNum(row.winCount)}</strong></td>
                    <td class="num">
                      <span class="sl-tier-badge ${row.winRate >= 40 ? 'viral' : row.winRate >= 25 ? 'high' : 'standard'}">
                        ${row.winRate}%
                      </span>
                    </td>
                    <td class="num">${fmtNum(row.avgViews)}</td>
                    <td class="num">${fmtNum(row.avgInteractions)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="sl-quant-card">
          <div class="sl-quant-card-title">🎯 2. Phân loại Kỹ thuật Hook Mở đầu &amp; Tỷ lệ Bài WIN</div>
          <div class="sl-table-wrap">
            <table class="sl-table">
              <thead>
                <tr>
                  <th>Kỹ thuật Hook (3s đầu / Dòng đầu)</th>
                  <th class="num">Số bài</th>
                  <th class="num">Số bài WIN</th>
                  <th class="num">Tỷ lệ WIN</th>
                  <th class="num">Views TB</th>
                  <th class="num">Tương tác TB</th>
                </tr>
              </thead>
              <tbody>
                ${byHook
                  .map(
                    (row) => `
                  <tr>
                    <td><strong>${escapeHtml(row.name)}</strong></td>
                    <td class="num">${fmtNum(row.count)}</td>
                    <td class="num"><strong style="color:#047857;">${fmtNum(row.winCount)}</strong></td>
                    <td class="num">
                      <span class="sl-tier-badge ${row.winRate >= 40 ? 'viral' : row.winRate >= 25 ? 'high' : 'standard'}">
                        ${row.winRate}%
                      </span>
                    </td>
                    <td class="num">${fmtNum(row.avgViews)}</td>
                    <td class="num">${fmtNum(row.avgInteractions)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- GIẢI PHẪU CHI TIẾT TOP BÀI NỘI DUNG WIN TIÊU BIỂU CỦA KÊNH -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
          <h3 style="font-size:14.5px; font-weight:800; color:#065f46; text-transform:uppercase;">
            🧬 GIẢI PHẪU CHI TIẾT TOP BÀI NỘI DUNG WIN TIÊU BIỂU (ĐỌC HOOK, LỜI THOẠI, CÔNG THỨC &amp; LÝ DO WIN)
          </h3>
          <span style="font-size:12px; color:var(--text-secondary);">
            Bấm vào mã <strong>Bài X</strong> để nhảy tới bài gốc hoặc <strong>🧠 AI Giải phẫu</strong> để lấy 3 mẫu Hook nhân bản
          </span>
        </div>

        <div class="sl-feed-grid">
          ${topWinningPosts
            .map((p) => {
              const a = p.contentAudit || {};
              const isSuper = a.tierClass === 'viral';
              const pUrl = resolvePostOriginalUrl(p, channel);
              return `
                <div class="sl-formula-card" style="border:1.5px solid ${isSuper ? '#fbbf24' : '#6ee7b7'}; background:#ffffff; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <button type="button" class="ref-chip" data-ref-type="post" data-ref-index="${p.index}">Bài ${p.index}</button>
                        <span class="sl-format-tag">${escapeHtml(p.format || '')}</span>
                        <span style="font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background:${isSuper ? '#fef3c7' : '#dcfce7'}; color:${isSuper ? '#b45309' : '#047857'};">
                          ${escapeHtml(a.winBadgeLabel || '🔥 CONTENT WIN')} · ${a.score || 82}/100
                        </span>
                      </div>
                      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <a
                          href="${escapeHtml(pUrl)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="btn btn-outline btn-sm no-print"
                          style="padding:2px 8px; font-size:11px; color:var(--primary); border-color:#c7d2fe; background:#eef2ff; text-decoration:none; font-weight:700;"
                          title="Mở xem trực tiếp bài viết gốc"
                        >
                          🔗 Xem bài gốc &nearr;
                        </a>
                        <button type="button" class="btn btn-outline btn-sm deep-post-audit-btn no-print" data-post-index="${p.index}" style="padding:2px 8px; font-size:11px;">
                          🧠 Nhân bản kịch bản Win
                        </button>
                      </div>
                    </div>

                    <div style="font-size:12px; font-weight:700; color:#047857; margin-bottom:6px;">
                      🎯 Mục tiêu Win: ${escapeHtml(a.winGoal || '')} &nbsp;|&nbsp; 📈 ${a.viewsMultiplier || 1.5}x Views TB · ${a.interactionsMultiplier || 1.5}x Tương tác TB (${fmtNum(p.views || 0)} views · ${fmtNum(p.reactions || 0)} 👍 · ${fmtNum(p.comments || 0)} 💬 · ${fmtNum(p.shares || 0)} ↗️)
                    </div>

                    <div class="sl-hook-quote" style="margin-bottom:8px;">
                      <div style="font-size:11px; font-weight:700; color:var(--primary); margin-bottom:2px;">
                        🎙️ Hook 3s đầu / Dòng mở đầu (${escapeHtml(a.hookType || '')} - ${a.hookScore || 9.0}/10):
                      </div>
                      <div style="font-size:12.2px; font-style:italic; color:var(--text-main);">
                        "${escapeHtml(a.videoHookSpoken || a.hookSentence || '')}"
                      </div>
                    </div>

                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">
                      <strong>📌 Phân loại:</strong> ${escapeHtml(a.contentPillar || '')} &nbsp;·&nbsp;
                      <strong>🧭 Góc tiếp cận:</strong> ${escapeHtml(a.contentAngle || '')} &nbsp;·&nbsp;
                      <strong>📐 Công thức:</strong> ${escapeHtml(a.copyFormula || '')}
                    </div>

                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:8px 10px; font-size:12px; color:#1e293b;">
                      <div><strong>🧬 Tại sao bài này WIN:</strong> ${escapeHtml(a.whyItWon || a.verdict || '')}</div>
                      <div style="margin-top:4px; color:#047857;"><strong>🚀 Hướng nhân bản:</strong> ${escapeHtml(a.optimizationTip || '')}</div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Bảng Ma Trận Phân Tích Chuyên Sâu Bài Viết (Hook, Phong cách Content, Công thức & Đánh giá Nội dung WIN)
 */
function renderPostContentMasterTable(posts = [], channel = {}) {
  const sorted = [...posts].sort(
    (a, b) => (b.contentAudit?.score || 0) - (a.contentAudit?.score || 0)
  );
  const topAndNotable = sorted.slice(0, 18);

  return topAndNotable
    .map((p) => {
      const a = p.contentAudit || {};
      const pUrl = resolvePostOriginalUrl(p, channel);
      const vsView = a.viewsMultiplier ? `${a.viewsMultiplier}x Views TB` : '';
      const vsInt = a.interactionsMultiplier ? `${a.interactionsMultiplier}x Tương tác TB` : '';

      return `
        <tr>
          <td style="white-space:nowrap;">
            <div style="display:flex; align-items:center; gap:5px;">
              <button type="button" class="ref-chip" data-ref-type="post" data-ref-index="${p.index}">Bài ${p.index}</button>
              <a href="${escapeHtml(pUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px; font-weight:700; color:var(--primary); text-decoration:none;" title="Mở xem bài viết gốc">🔗 Gốc &nearr;</a>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">${escapeHtml(p.format)}</div>
            <div style="font-size:10.5px; color:var(--text-muted);">${escapeHtml((p.publishedAt || '').split(' lúc ')[0])}</div>
          </td>
          <td style="min-width:220px;">
            <div style="font-weight:700; color:var(--primary); font-size:11.5px; margin-bottom:2px;">
              ${escapeHtml(a.hookType || '')} (${a.hookScore || 8.0}/10)
            </div>
            <div style="font-size:12px; font-style:italic; color:var(--text-main);">
              "${escapeHtml(a.videoHookSpoken || a.hookSentence || '')}"
            </div>
          </td>
          <td style="min-width:190px;">
            <div style="font-weight:700; font-size:12px; color:var(--text-main);">${escapeHtml(a.contentPillar || '')}</div>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
              🧭 Góc: <strong>${escapeHtml(a.contentAngle || a.contentStyle || '')}</strong>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
              📐 ${escapeHtml(a.copyFormula || '')} · 🎯 ${escapeHtml((a.funnelStage || '').split(' ')[0])}
            </div>
          </td>
          <td class="num" style="white-space:nowrap;">
            <div><strong>${p.views > 0 ? `${fmtNum(p.views)} views` : '—'}</strong></div>
            <div style="font-size:11.5px; color:var(--text-secondary);">
              ${fmtNum(p.reactions)} 👍 · ${fmtNum(p.comments)} 💬 · ${fmtNum(p.shares)} ↗️
            </div>
            <div style="font-size:11px; color:#047857; font-weight:700;">
              ${[vsView, vsInt].filter(Boolean).join(' · ')}
            </div>
          </td>
          <td style="min-width:250px;">
            <div style="margin-bottom:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="sl-tier-badge ${escapeHtml(a.tierClass || 'standard')}">
                ${escapeHtml(a.winBadgeLabel || a.tier || 'Ổn định')} (${a.score || 65}/100)
              </span>
              ${
                a.isWin
                  ? `<span style="font-size:10.5px; font-weight:700; color:#047857;">🎯 ${escapeHtml(a.winGoal || '')}</span>`
                  : ''
              }
            </div>
            <div style="font-size:11.8px; color:var(--text-secondary);">
              ${escapeHtml(a.whyItWon || a.verdict || '')}
            </div>
            <button
              type="button"
              class="btn btn-outline btn-sm deep-post-audit-btn no-print"
              data-post-index="${p.index}"
              style="margin-top:5px; padding:2px 8px; font-size:11px;"
            >
              🧠 Giải phẫu &amp; Nhân bản Hook
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Render toàn bộ giao diện Báo cáo Đơn Kênh
 */
export function renderSingleReport(container, report, callbacks = {}) {
  if (!report) {
    container.innerHTML = `<div class="sl-section-block">Không có dữ liệu báo cáo.</div>`;
    return;
  }

  const { channel = {}, posts = [], ads = [], stats = {}, aiAnalysis = {} } = report;
  const platformUpper = String(channel.platform || 'facebook').toUpperCase();
  const freqLevel = stats.postingFrequency?.level || 'Cao (>3)';
  const activeFilter = channel.activeResearchFilter || {};
  const isFiltered = Boolean(activeFilter.dateFrom || activeFilter.dateTo || activeFilter.month);

  container.innerHTML = `
    <!-- THANH CÔNG CỤ TRÊN CÙNG CỦA BÁO CÁO -->
    <div class="sl-section-block no-print" style="padding:14px 20px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <button class="btn btn-outline btn-sm" id="backToHubBtn">&larr; Quay lại Thư viện</button>
        <span class="platform-badge platform-${escapeHtml((channel.platform || 'facebook').toLowerCase())}">
          ${escapeHtml(platformUpper)}
        </span>
        <a href="${escapeHtml(channel.url || '#')}" target="_blank" rel="noopener" style="font-size:12.5px; color:var(--primary); text-decoration:none;">
          🔗 Mở trang gốc của kênh &nearr;
        </a>
      </div>

      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" id="reanalyzeReportBtn">
          ✨ Phân tích lại 13 mục bằng Gemini AI
        </button>
        <button class="btn btn-outline btn-sm" id="addReportToCompareBtn">
          ⚖️ So sánh Kênh này với Đối thủ
        </button>
        <button class="btn btn-primary btn-sm" id="printPdfBtn">
          🖨️ Xuất Báo Cáo PDF
        </button>
      </div>
    </div>

    <!-- BỘ LỌC THỜI GIAN RESEARCH ĐỘNG: CHỌN THEO NGÀY & THEO THÁNG CHI TIẾT -->
    <div class="research-time-panel no-print">
      <div class="research-time-header">
        <div class="research-time-title">
          <span>📅 BỘ CHỌN KỲ RESEARCH &amp; PHÂN TÍCH CHI TIẾT (THEO THÁNG / TUẦN / NGÀY CỤ THỂ)</span>
          ${
            isFiltered
              ? `<span class="sl-tier-badge high">Đang lọc: ${escapeHtml(channel.dateFrom)} &rarr; ${escapeHtml(channel.dateTo)} (${posts.length} bài)</span>`
              : `<span class="sl-count-pill">Toàn kỳ (${posts.length} bài đăng · ${ads.length} quảng cáo)</span>`
          }
        </div>
        ${
          isFiltered
            ? `<button type="button" class="btn btn-outline btn-sm" id="resetPeriodFilterBtn">↺ Xem lại Toàn bộ Kỳ gốc</button>`
            : ''
        }
      </div>

      <!-- Các mốc chọn nhanh theo Tuần / Chiến dịch / Tháng -->
      <div class="preset-chips-row" id="reportPeriodQuickChips">
        <button type="button" class="preset-chip-btn ${!isFiltered ? 'active' : ''}" data-from="" data-to="">
          🌐 Toàn bộ kỳ (${escapeHtml(channel.dateFrom)} &rarr; ${escapeHtml(channel.dateTo)})
        </button>
        <button type="button" class="preset-chip-btn" data-from="2026-10-01" data-to="2026-10-07">
          📆 Tuần 1 (01/10 – 07/10)
        </button>
        <button type="button" class="preset-chip-btn" data-from="2026-10-08" data-to="2026-10-14">
          📆 Tuần 2 (08/10 – 14/10)
        </button>
        <button type="button" class="preset-chip-btn" data-from="2026-10-15" data-to="2026-10-21">
          📆 Tuần 3 (15/10 – 21/10)
        </button>
        <button type="button" class="preset-chip-btn" data-from="2026-10-22" data-to="2026-10-31">
          📆 Tuần 4 (22/10 – 31/10)
        </button>
        <button type="button" class="preset-chip-btn" data-from="2026-10-12" data-to="2026-10-18">
          🔥 Tuần Viral Đỉnh Điểm (12/10 – 18/10)
        </button>
        <button type="button" class="preset-chip-btn" data-from="2026-10-28" data-to="2026-10-30">
          💥 Chiến dịch Mega Live (28/10 – 30/10)
        </button>
      </div>

      <!-- Điều khiển chọn Tháng chi tiết hoặc Từ ngày -> Đến ngày -->
      <div class="research-controls-grid">
        <div class="form-group">
          <label>Chọn theo Tháng chi tiết</label>
          <select id="researchMonthSelect">
            <option value="">-- Chọn Tháng trong năm --</option>
            <option value="2026-01">Tháng 01/2026</option>
            <option value="2026-02">Tháng 02/2026</option>
            <option value="2026-03">Tháng 03/2026</option>
            <option value="2026-04">Tháng 04/2026</option>
            <option value="2026-05">Tháng 05/2026</option>
            <option value="2026-06">Tháng 06/2026</option>
            <option value="2026-07">Tháng 07/2026</option>
            <option value="2026-08">Tháng 08/2026</option>
            <option value="2026-09">Tháng 09/2026</option>
            <option value="2026-10" ${activeFilter.month === '2026-10' ? 'selected' : ''}>Tháng 10/2026 (126 bài)</option>
            <option value="2026-11">Tháng 11/2026</option>
            <option value="2026-12">Tháng 12/2026</option>
          </select>
        </div>

        <div class="form-group">
          <label>Từ ngày cụ thể (Date From)</label>
          <input type="date" id="researchDateFrom" value="${escapeHtml(activeFilter.dateFrom || channel.dateFrom || '2026-10-01')}" />
        </div>

        <div class="form-group">
          <label>Đến ngày cụ thể (Date To)</label>
          <input type="date" id="researchDateTo" value="${escapeHtml(activeFilter.dateTo || channel.dateTo || '2026-10-31')}" />
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-primary" id="applyResearchPeriodBtn" style="flex:1;">
            🔎 Lọc &amp; Phân tích Khoảng Ngày Này
          </button>
        </div>
      </div>
    </div>

    <div class="report-layout">
      <!-- SIDEBAR MỤC LỤC NHANH (STICKY TOC) -->
      <aside class="report-toc-sidebar">
        <div class="toc-heading">Mục lục Báo cáo</div>
        <ul class="toc-list">
          <li><a href="#sec-header" class="toc-link"><span class="toc-num">★</span> Thông tin Kênh</a></li>
          <li><a href="#sec-winning-content" class="toc-link"><span class="toc-num">🏆</span> Phân loại &amp; Nội dung WIN</a></li>
          <li><a href="#sec-posts" class="toc-link"><span class="toc-num">P</span> Bài đăng &amp; Hook (${posts.length})</a></li>
          <li><a href="#sec-post-master" class="toc-link"><span class="toc-num">🔬</span> Bóc tách Hook &amp; Content</a></li>
          <li><a href="#sec-ads" class="toc-link"><span class="toc-num">A</span> Quảng cáo (${ads.length})</a></li>
          <li><a href="#sec-quant" class="toc-link"><span class="toc-num">📊</span> Thống kê Ngày / Tháng</a></li>
          <li><a href="#sec-ai-01" class="toc-link"><span class="toc-num">01</span> Định vị Thương hiệu</a></li>
          <li><a href="#sec-ai-02" class="toc-link"><span class="toc-num">02</span> Giọng văn Thương hiệu</a></li>
          <li><a href="#sec-ai-03" class="toc-link"><span class="toc-num">03</span> Chân dung Khách hàng</a></li>
          <li><a href="#sec-ai-04" class="toc-link"><span class="toc-num">04</span> Hoạt động &amp; Xu hướng</a></li>
          <li><a href="#sec-ai-05" class="toc-link"><span class="toc-num">05</span> Tuyến nội dung</a></li>
          <li><a href="#sec-ai-06" class="toc-link"><span class="toc-num">06</span> Công thức nội dung Text</a></li>
          <li><a href="#sec-ai-07" class="toc-link"><span class="toc-num">07</span> Công thức Reel</a></li>
          <li><a href="#sec-ai-08" class="toc-link"><span class="toc-num">08</span> Hoạt động Quảng cáo</a></li>
          <li><a href="#sec-ai-09" class="toc-link"><span class="toc-num">09</span> Phễu Marketing</a></li>
          <li><a href="#sec-ai-10" class="toc-link"><span class="toc-num">10</span> Tương tác &amp; Bình luận</a></li>
          <li><a href="#sec-ai-11" class="toc-link"><span class="toc-num">11</span> Tóm tắt tổng quan</a></li>
          <li><a href="#sec-ai-12" class="toc-link"><span class="toc-num">12</span> Điểm mạnh &amp; Điểm yếu</a></li>
          <li><a href="#sec-ai-13" class="toc-link"><span class="toc-num">13</span> Ý tưởng Nội dung Đề xuất</a></li>
        </ul>
      </aside>

      <!-- NỘI DUNG BÁO CÁO CHÍNH -->
      <div class="report-paper">
        <!-- 1. HEADER CARD (TRANG 1 PDF) -->
        <div class="sl-header-card" id="sec-header">
          <div class="sl-header-top">
            <div>
              <div class="sl-channel-name">
                <span>${escapeHtml(channel.name || "L'AMME")}</span>
              </div>
              <div class="sl-channel-subtitle">
                Báo cáo Phân tích ${channel.platform === 'facebook' ? 'Fanpage' : platformUpper} dựa trên Dữ liệu từ ${escapeHtml(channel.dateFrom || '2026-10-01')} đến ${escapeHtml(channel.dateTo || '2026-10-31')}
              </div>
            </div>
            <div class="sl-created-badge">
              Ngày tạo: <strong>${escapeHtml(channel.createdAt || '02/11/2026')}</strong>
            </div>
          </div>

          <div class="sl-top-kpi-grid">
            <div class="sl-top-kpi-box">
              <div class="sl-top-kpi-label">Lượt theo dõi</div>
              <div class="sl-top-kpi-value">${fmtNum(channel.followers || 0)}</div>
            </div>
            <div class="sl-top-kpi-box">
              <div class="sl-top-kpi-label">Danh mục</div>
              <div class="sl-top-kpi-value">${escapeHtml(channel.category || 'Fashion Designer')}</div>
            </div>
            <div class="sl-top-kpi-box">
              <div class="sl-top-kpi-label">Đánh giá</div>
              <div class="sl-top-kpi-value">${escapeHtml(channel.rating || 'N/A')}</div>
            </div>
          </div>
        </div>

        <!-- 1B. TRUNG TÂM PHÂN LOẠI NỘI DUNG & ĐÁNH GIÁ NỘI DUNG WIN (WINNING CONTENT LAB) -->
        ${renderWinningContentSectionHtml(report)}

        <!-- 2. DANH SÁCH BÀI ĐĂNG + PHÂN TÍCH CÂU HOOK & HIỆU QUẢ TỪNG BÀI (| BÀI ĐĂNG) -->
        <div class="sl-section-block" id="sec-posts">
          <div class="sl-section-bar">
            <div class="sl-section-bar-left">
              <span class="sl-bar-accent"></span>
              <h2 class="sl-section-bar-title">BÀI ĐĂNG, PHÂN LOẠI &amp; ĐÁNH GIÁ NỘI DUNG WIN CHI TIẾT</h2>
              <span class="sl-count-pill" id="postsFilteredCountPill">${posts.length} bài</span>
            </div>

            <div class="sl-filter-controls">
              <input type="text" id="postSearchInput" placeholder="Tìm caption, lời thoại SRT, câu hook..." />
              <select id="postFormatFilter">
                <option value="all">Mọi định dạng</option>
                ${Array.from(new Set(posts.map((p) => p.format).filter(Boolean)))
                  .map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`)
                  .join('')}
              </select>
              <select id="postTierFilter">
                <option value="all">Mọi mức Hiệu quả</option>
                <option value="all_wins">🏆 Tất cả Bài WIN (Super Win + Content Win)</option>
                <option value="viral">🏆 SUPER WIN (Top Bùng nổ)</option>
                <option value="high">🔥 CONTENT WIN (Hiệu quả cao)</option>
                <option value="standard">⚡ Đạt chuẩn TB</option>
                <option value="low">⚠️ Dưới chuẩn (Cần tối ưu)</option>
              </select>
              <select id="postPillarFilter">
                <option value="all">Mọi Tuyến nội dung (Pillar)</option>
                ${Array.from(
                  new Set(posts.map((p) => p.contentAudit?.contentPillar).filter(Boolean))
                )
                  .map((pil) => `<option value="${escapeHtml(pil)}">${escapeHtml(pil)}</option>`)
                  .join('')}
              </select>
              <select id="postHookFilter">
                <option value="all">Mọi kỹ thuật Hook</option>
                <option value="Câu hỏi">Câu hỏi / Phản biện định kiến</option>
                <option value="Nêu vấn đề">Nêu vấn đề &amp; Insight</option>
                <option value="Tung ưu đãi">Tung ưu đãi &amp; FOMO</option>
                <option value="POV">POV / Tình huống đời thực</option>
                <option value="Trực diện">Show trực diện siêu phẩm</option>
                <option value="Chạm cảm xúc">Tâm sự chạm cảm xúc</option>
                <option value="Bí quyết">Bí quyết / Cẩm nang</option>
              </select>
              <select id="postSortSelect">
                <option value="index">Thứ tự gốc (Bài 1 &rarr; ${posts.length})</option>
                <option value="score">🏆 Điểm Nội dung WIN cao nhất</option>
                <option value="views">👁️ Lượt xem cao nhất</option>
                <option value="reactions">👍 Reactions / Tim cao nhất</option>
                <option value="comments">💬 Bình luận cao nhất</option>
                <option value="shares">↗️ Chia sẻ / Lưu cao nhất</option>
              </select>
              <button type="button" class="btn btn-outline btn-sm" id="toggleAllPostsBtn">
                Hiển thị toàn bộ (${posts.length})
              </button>
            </div>
          </div>

          <div class="sl-feed-grid" id="postsFeedGrid"></div>
        </div>

        <!-- 2B. BẢNG TỔNG HỢP BÓC TÁCH CÂU HOOK, PHONG CÁCH CONTENT & ĐÁNH GIÁ HIỆU QUẢ BÀI VIẾT -->
        <div class="sl-section-block" id="sec-post-master">
          <div class="sl-section-bar">
            <div class="sl-section-bar-left">
              <span class="sl-bar-accent"></span>
              <h2 class="sl-section-bar-title">BẢNG BÓC TÁCH CÂU HOOK, PHONG CÁCH CONTENT &amp; XẾP HẠNG HIỆU QUẢ BÀI VIẾT</h2>
            </div>
          </div>
          <div class="sl-table-wrap">
            <table class="sl-table">
              <thead>
                <tr>
                  <th>Bài đăng</th>
                  <th>Câu Hook Mở đầu &amp; Kỹ thuật Hook</th>
                  <th>Phong cách Content &amp; Công thức</th>
                  <th class="num">Chỉ số &amp; So với TB Kênh</th>
                  <th>Đánh giá Hiệu quả &amp; Hành động</th>
                </tr>
              </thead>
              <tbody>
                ${renderPostContentMasterTable(posts, channel)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. DANH SÁCH QUẢNG CÁO (| QUẢNG CÁO) -->
        <div class="sl-section-block" id="sec-ads">
          <div class="sl-section-bar">
            <div class="sl-section-bar-left">
              <span class="sl-bar-accent"></span>
              <h2 class="sl-section-bar-title">QUẢNG CÁO</h2>
              <span class="sl-count-pill" id="adsFilteredCountPill">${ads.length} mẫu</span>
            </div>

            <div class="sl-filter-controls">
              <input type="text" id="adSearchInput" placeholder="Tìm theo ID, nội dung quảng cáo..." />
              <select id="adFormatFilter">
                <option value="all">Tất cả loại Ads</option>
                <option value="VIDEO">VIDEO</option>
                <option value="MULTI_IMAGES">MULTI_IMAGES / Ảnh</option>
              </select>
              <button type="button" class="btn btn-outline btn-sm" id="toggleAllAdsBtn">
                Hiển thị toàn bộ (${ads.length})
              </button>
            </div>
          </div>

          <div class="sl-feed-grid" id="adsFeedGrid"></div>
        </div>

        <!-- 4. THỐNG KÊ ĐỊNH LƯỢNG & BIỂU ĐỒ THEO THỨ / NGÀY / THÁNG / QUÝ / NĂM (TRANG 120 - 123 PDF) -->
        <div class="sl-section-block" id="sec-quant">
          <div class="sl-section-bar">
            <div class="sl-section-bar-left">
              <span class="sl-bar-accent"></span>
              <h2 class="sl-section-bar-title">THỐNG KÊ ĐỊNH LƯỢNG CHI TIẾT THEO THỨ, NGÀY &amp; THÁNG</h2>
            </div>
            <span style="font-size:12px; color:var(--text-secondary);">
              💡 Mẹo: Bấm nút <strong>"🔍 Lọc ngày này"</strong> trên bảng Thống kê theo Ngày để phân tích sâu các bài đăng của riêng ngày đó.
            </span>
          </div>

          <div class="sl-tables-stack">
            <!-- Bảng 1: Thống kê theo Thứ -->
            <div class="sl-quant-card">
              <div class="sl-quant-card-title">Thống kê theo Thứ</div>
              <div class="sl-table-wrap">
                <table class="sl-table">
                  <thead>
                    <tr>
                      <th>Thứ</th>
                      <th class="num">Số bài</th>
                      <th class="num">Lượt xem</th>
                      <th class="num">Reactions</th>
                      <th class="num">Bình luận</th>
                      <th class="num">Chia sẻ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderStatsTableRows(stats.byWeekday || [], false)}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Bảng 2: Thống kê theo Ngày (Hỗ trợ click lọc nhanh từng ngày) -->
            <div class="sl-quant-card">
              <div class="sl-quant-card-title">Thống kê theo Ngày (Click vào từng ngày để bóc tách bài đăng trong ngày đó)</div>
              <div class="sl-table-wrap" style="max-height:420px; overflow-y:auto;">
                <table class="sl-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th class="num">Số bài</th>
                      <th class="num">Lượt xem</th>
                      <th class="num">Reactions</th>
                      <th class="num">Bình luận</th>
                      <th class="num">Chia sẻ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderStatsTableRows(stats.byDate || [], true)}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Bảng 3, 4, 5: Thống kê theo Tháng, Quý, Năm -->
            <div class="sl-three-tables-grid">
              <div class="sl-quant-card">
                <div class="sl-quant-card-title">Thống kê theo Tháng</div>
                <div class="sl-table-wrap">
                  <table class="sl-table">
                    <thead>
                      <tr>
                        <th>Tháng</th>
                        <th class="num">Số bài</th>
                        <th class="num">Lượt xem</th>
                        <th class="num">Reactions</th>
                        <th class="num">Bình luận</th>
                        <th class="num">Chia sẻ</th>
                      </tr>
                    </thead>
                    <tbody>${renderStatsTableRows(stats.byMonth || [])}</tbody>
                  </table>
                </div>
              </div>

              <div class="sl-quant-card">
                <div class="sl-quant-card-title">Thống kê theo Quý</div>
                <div class="sl-table-wrap">
                  <table class="sl-table">
                    <thead>
                      <tr>
                        <th>Quý</th>
                        <th class="num">Số bài</th>
                        <th class="num">Lượt xem</th>
                        <th class="num">Reactions</th>
                        <th class="num">Bình luận</th>
                        <th class="num">Chia sẻ</th>
                      </tr>
                    </thead>
                    <tbody>${renderStatsTableRows(stats.byQuarter || [])}</tbody>
                  </table>
                </div>
              </div>

              <div class="sl-quant-card">
                <div class="sl-quant-card-title">Thống kê theo Năm</div>
                <div class="sl-table-wrap">
                  <table class="sl-table">
                    <thead>
                      <tr>
                        <th>Năm</th>
                        <th class="num">Số bài</th>
                        <th class="num">Lượt xem</th>
                        <th class="num">Reactions</th>
                        <th class="num">Bình luận</th>
                        <th class="num">Chia sẻ</th>
                      </tr>
                    </thead>
                    <tbody>${renderStatsTableRows(stats.byYear || [])}</tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Trang 123: Tổng tương tác & Tương tác trung bình -->
            <div class="sl-summary-two-col">
              <div class="sl-stat-list-card">
                <div class="sl-stat-list-title">Tổng tương tác</div>
                <div class="sl-stat-row">
                  <span>Tổng tương tác</span>
                  <strong>${fmtNum(stats.totals?.totalInteractions || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Tổng reaction</span>
                  <strong>${fmtNum(stats.totals?.totalReactions || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Tổng bình luận</span>
                  <strong>${fmtNum(stats.totals?.totalComments || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Tổng chia sẻ</span>
                  <strong>${fmtNum(stats.totals?.totalShares || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Tổng lượt xem</span>
                  <strong>${fmtNum(stats.totals?.totalViews || 0)}</strong>
                </div>
              </div>

              <div class="sl-stat-list-card">
                <div class="sl-stat-list-title">Tương tác trung bình</div>
                <div class="sl-stat-row">
                  <span>Tương tác TB</span>
                  <strong>${fmtNum(stats.averages?.avgInteractions || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Reaction TB</span>
                  <strong>${fmtNum(stats.averages?.avgReactions || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Bình luận TB</span>
                  <strong>${fmtNum(stats.averages?.avgComments || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Chia sẻ TB</span>
                  <strong>${fmtNum(stats.averages?.avgShares || 0)}</strong>
                </div>
                <div class="sl-stat-row">
                  <span>Lượt xem TB</span>
                  <strong>${fmtNum(stats.averages?.avgViews || 0)}</strong>
                </div>
              </div>
            </div>

            <!-- Trang 123: 4 Biểu đồ Phân bổ & Tần suất -->
            <div class="sl-summary-two-col">
              <div class="sl-chart-card">
                <div class="sl-stat-list-title">Phân bổ định dạng nội dung</div>
                ${renderSvgDonutChart(stats.contentDistribution || [])}
              </div>

              <div class="sl-chart-card">
                <div class="sl-stat-list-title">Tần suất đăng</div>
                <div class="sl-freq-center">
                  <div class="sl-freq-big">${stats.postingFrequency?.postsPerDay || 0}</div>
                  <div class="sl-freq-unit">bài/ngày</div>
                  <div class="sl-freq-tiers">
                    <div class="sl-freq-pill ${freqLevel.includes('Thấp') ? 'active' : ''}">Thấp (0-1)</div>
                    <div class="sl-freq-pill ${freqLevel.includes('Trung bình') ? 'active' : ''}">Trung bình (1-3)</div>
                    <div class="sl-freq-pill ${freqLevel.includes('Cao') ? 'active' : ''}">Cao (&gt;3)</div>
                  </div>
                </div>
              </div>

              <div class="sl-chart-card">
                <div class="sl-stat-list-title">Phân bổ định dạng quảng cáo</div>
                ${renderSvgDonutChart(stats.adFormatDistribution || [])}
              </div>

              <div class="sl-chart-card">
                <div class="sl-stat-list-title">Phân bổ CTA</div>
                ${renderSvgDonutChart(stats.ctaDistribution || [])}
              </div>
            </div>
          </div>
        </div>

        <!-- ====================================================================
             13 CHUYÊN MỤC PHÂN TÍCH CHIẾN LƯỢC AI (TRANG 124 - 146 PDF)
             ==================================================================== -->

        <!-- 01. Định vị Thương hiệu -->
        <div class="sl-ai-section-card" id="sec-ai-01">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">01</span>
            <h3 class="sl-ai-sec-title">Định vị Thương hiệu</h3>
          </div>
          <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.brandPositioning || '')}</div>
        </div>

        <!-- 02. Giọng văn Thương hiệu -->
        <div class="sl-ai-section-card" id="sec-ai-02">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">02</span>
            <h3 class="sl-ai-sec-title">Giọng văn Thương hiệu</h3>
          </div>
          <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.brandVoice || '')}</div>
        </div>

        <!-- 03. Chân dung Khách hàng -->
        <div class="sl-ai-section-card" id="sec-ai-03">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">03</span>
            <h3 class="sl-ai-sec-title">Chân dung Khách hàng</h3>
          </div>
          <div class="sl-persona-grid">
            <div class="sl-persona-box">
              <div class="sl-persona-label">Độ tuổi</div>
              <div class="sl-persona-text">${linkifyPostAndAdRefs(aiAnalysis.targetAudience?.age || '')}</div>
            </div>
            <div class="sl-persona-box">
              <div class="sl-persona-label">Giới tính</div>
              <div class="sl-persona-text">${linkifyPostAndAdRefs(aiAnalysis.targetAudience?.gender || '')}</div>
            </div>
            <div class="sl-persona-box">
              <div class="sl-persona-label">Thói quen</div>
              <div class="sl-persona-text">${linkifyPostAndAdRefs(aiAnalysis.targetAudience?.habits || '')}</div>
            </div>
            <div class="sl-persona-box">
              <div class="sl-persona-label">Vị trí địa lý</div>
              <div class="sl-persona-text">${linkifyPostAndAdRefs(aiAnalysis.targetAudience?.location || '')}</div>
            </div>
            <div class="sl-persona-box">
              <div class="sl-persona-label">Nghề nghiệp</div>
              <div class="sl-persona-text">${linkifyPostAndAdRefs(aiAnalysis.targetAudience?.occupation || '')}</div>
            </div>
            <div class="sl-persona-box">
              <div class="sl-persona-label">Vấn đề / Nỗi đau</div>
              <div class="sl-persona-text">${linkifyPostAndAdRefs(aiAnalysis.targetAudience?.pain_points || '')}</div>
            </div>
          </div>
        </div>

        <!-- 04. Hoạt động & Xu hướng -->
        <div class="sl-ai-section-card" id="sec-ai-04">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">04</span>
            <h3 class="sl-ai-sec-title">Hoạt động &amp; Xu hướng</h3>
          </div>
          <div class="sl-formula-stack">
            <div class="sl-formula-card">
              <div class="sl-formula-name" style="margin-bottom:6px;">Thói quen hoạt động</div>
              <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.activityAndTrends?.activityHabits || '')}</div>
            </div>
            <div class="sl-formula-card">
              <div class="sl-formula-name" style="margin-bottom:6px;">Xu hướng hiệu suất</div>
              <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.activityAndTrends?.performanceTrends || '')}</div>
            </div>
          </div>
        </div>

        <!-- 05. Tuyến nội dung -->
        <div class="sl-ai-section-card" id="sec-ai-05">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">05</span>
            <h3 class="sl-ai-sec-title">Tuyến nội dung</h3>
          </div>
          <div class="sl-formula-stack">
            ${(aiAnalysis.contentPillars || [])
              .map(
                (p) => `
              <div class="sl-formula-card">
                <div class="sl-formula-top">
                  <div class="sl-formula-name">${escapeHtml(p.name)}</div>
                  ${renderMetricBadges(p)}
                </div>
                <div class="sl-formula-detail-row"><strong>Mục đích:</strong> ${linkifyPostAndAdRefs(p.purpose || '')}</div>
                <div class="sl-formula-detail-row"><strong>Cách triển khai:</strong> ${linkifyPostAndAdRefs(p.execution || '')}</div>
                <div class="sl-formula-detail-row"><strong>Hiệu quả:</strong> ${linkifyPostAndAdRefs(p.effectiveness || '')}</div>
                ${renderRefChipsList(p.posts, 'post')}
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- 06. Công thức nội dung Text -->
        <div class="sl-ai-section-card" id="sec-ai-06">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">06</span>
            <h3 class="sl-ai-sec-title">Công thức nội dung Text</h3>
          </div>
          <div class="sl-formula-stack">
            ${(aiAnalysis.textFormulas || [])
              .map(
                (f) => `
              <div class="sl-formula-card">
                <div class="sl-formula-top">
                  <div class="sl-formula-name">${escapeHtml(f.name)}</div>
                  ${renderMetricBadges(f)}
                </div>
                <div class="sl-formula-detail-row"><strong>Mô tả:</strong> ${linkifyPostAndAdRefs(f.description || '')}</div>
                <div class="sl-formula-detail-row"><strong>Hiệu quả:</strong> ${linkifyPostAndAdRefs(f.effectiveness || '')}</div>
                ${renderRefChipsList(f.posts, 'post')}
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- 07. Công thức Reel -->
        <div class="sl-ai-section-card" id="sec-ai-07">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">07</span>
            <h3 class="sl-ai-sec-title">Công thức Reel</h3>
          </div>

          <div style="margin-bottom:16px;">
            <h4 style="font-size:14px; font-weight:800; color:var(--primary); margin-bottom:10px; text-transform:uppercase;">Kỹ thuật Hooks (3 Giây đầu)</h4>
            <div class="sl-formula-stack">
              ${(aiAnalysis.reelFormulas?.hooks || [])
                .map(
                  (h) => `
                <div class="sl-formula-card">
                  <div class="sl-formula-top">
                    <div class="sl-formula-name">${escapeHtml(h.name)}</div>
                    ${renderMetricBadges(h)}
                  </div>
                  <div class="sl-formula-detail-row"><strong>Mô tả:</strong> ${linkifyPostAndAdRefs(h.description || '')}</div>
                  <div class="sl-formula-detail-row"><strong>Hiệu quả:</strong> ${linkifyPostAndAdRefs(h.effectiveness || '')}</div>
                  ${renderRefChipsList(h.posts, 'post')}
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <h4 style="font-size:14px; font-weight:800; color:var(--primary); margin-bottom:10px; text-transform:uppercase;">Cách dẫn dắt (Narrative Structure)</h4>
            <div class="sl-formula-stack">
              ${(aiAnalysis.reelFormulas?.narratives || [])
                .map(
                  (n) => `
                <div class="sl-formula-card">
                  <div class="sl-formula-top">
                    <div class="sl-formula-name">${escapeHtml(n.name)}</div>
                    ${renderMetricBadges(n)}
                  </div>
                  <div class="sl-formula-detail-row"><strong>Mô tả:</strong> ${linkifyPostAndAdRefs(n.description || '')}</div>
                  <div class="sl-formula-detail-row"><strong>Hiệu quả:</strong> ${linkifyPostAndAdRefs(n.effectiveness || '')}</div>
                  ${renderRefChipsList(n.posts, 'post')}
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div>
            <h4 style="font-size:14px; font-weight:800; color:var(--primary); margin-bottom:10px; text-transform:uppercase;">Call to Action (CTA)</h4>
            <div class="sl-formula-stack">
              ${(aiAnalysis.reelFormulas?.ctas || [])
                .map(
                  (c) => `
                <div class="sl-formula-card">
                  <div class="sl-formula-top">
                    <div class="sl-formula-name">${escapeHtml(c.name)}</div>
                    ${renderMetricBadges(c)}
                  </div>
                  <div class="sl-formula-detail-row"><strong>Mô tả:</strong> ${linkifyPostAndAdRefs(c.description || '')}</div>
                  <div class="sl-formula-detail-row"><strong>Hiệu quả:</strong> ${linkifyPostAndAdRefs(c.effectiveness || '')}</div>
                  ${renderRefChipsList(c.posts, 'post')}
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>

        <!-- 08. Hoạt động Quảng cáo -->
        <div class="sl-ai-section-card" id="sec-ai-08">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">08</span>
            <h3 class="sl-ai-sec-title">Hoạt động Quảng cáo</h3>
          </div>
          <div class="sl-formula-card" style="margin-bottom:14px;">
            <div class="sl-formula-name" style="margin-bottom:6px;">Mục tiêu chiến dịch</div>
            <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.adActivities?.campaignObjective || '')}</div>
          </div>

          <h4 style="font-size:14px; font-weight:800; color:var(--primary); margin-bottom:10px; text-transform:uppercase;">Tuyến nội dung quảng cáo</h4>
          <div class="sl-formula-stack" style="margin-bottom:16px;">
            ${(aiAnalysis.adActivities?.adPillars || [])
              .map(
                (ap) => `
              <div class="sl-formula-card">
                <div class="sl-formula-name" style="margin-bottom:6px;">${escapeHtml(ap.name)}</div>
                <div class="sl-formula-detail-row">${linkifyPostAndAdRefs(ap.description || '')}</div>
                ${renderRefChipsList(ap.ads, 'ad')}
              </div>
            `
              )
              .join('')}
          </div>

          <h4 style="font-size:14px; font-weight:800; color:var(--primary); margin-bottom:10px; text-transform:uppercase;">Công thức quảng cáo</h4>
          <div class="sl-formula-stack">
            ${(aiAnalysis.adActivities?.adFormulas || [])
              .map(
                (af) => `
              <div class="sl-formula-card">
                <div class="sl-formula-name" style="margin-bottom:6px;">${escapeHtml(af.name)}</div>
                <div class="sl-formula-detail-row">${linkifyPostAndAdRefs(af.description || '')}</div>
                ${renderRefChipsList(af.ads, 'ad')}
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- 09. Phễu Marketing -->
        <div class="sl-ai-section-card" id="sec-ai-09">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">09</span>
            <h3 class="sl-ai-sec-title">Phễu Marketing</h3>
          </div>
          <div class="sl-formula-stack">
            ${[
              { title: 'Đầu phễu — ToFu', data: aiAnalysis.marketingFunnel?.tofu },
              { title: 'Giữa phễu — MoFu', data: aiAnalysis.marketingFunnel?.mofu },
              { title: 'Cuối phễu — BoFu', data: aiAnalysis.marketingFunnel?.bofu },
            ]
              .map(({ title, data }) => {
                if (!data) return '';
                return `
                  <div class="sl-formula-card">
                    <div class="sl-formula-top">
                      <div class="sl-formula-name">${escapeHtml(title)}</div>
                      ${renderMetricBadges(data)}
                    </div>
                    <div class="sl-formula-detail-row">${linkifyPostAndAdRefs(data.description || '')}</div>
                    ${renderRefChipsList(data.posts, 'post')}
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <!-- 10. Tương tác & Bình luận -->
        <div class="sl-ai-section-card" id="sec-ai-10">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">10</span>
            <h3 class="sl-ai-sec-title">Tương tác &amp; Bình luận</h3>
          </div>
          <div class="sl-formula-stack">
            <div class="sl-formula-card">
              <div class="sl-formula-name" style="margin-bottom:6px;">Chiến thuật Seeding &amp; Điều hướng</div>
              <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.engagementAndComments?.seedingStrategy || '')}</div>
            </div>
            <div class="sl-formula-card">
              <div class="sl-formula-name" style="margin-bottom:6px;">Chủ đề thảo luận của người dùng</div>
              <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.engagementAndComments?.userDiscussionTopics || '')}</div>
            </div>
          </div>
        </div>

        <!-- 11. Tóm tắt tổng quan -->
        <div class="sl-ai-section-card" id="sec-ai-11">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">11</span>
            <h3 class="sl-ai-sec-title">Tóm tắt tổng quan</h3>
          </div>
          <div class="sl-ai-prose">${linkifyPostAndAdRefs(aiAnalysis.executiveSummary || '')}</div>
        </div>

        <!-- 12. Điểm mạnh & Điểm yếu -->
        <div class="sl-ai-section-card" id="sec-ai-12">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">12</span>
            <h3 class="sl-ai-sec-title">Điểm mạnh &amp; Điểm yếu</h3>
          </div>
          ${(aiAnalysis.strengthsAndWeaknesses || [])
            .map(
              (group) => `
            <div class="sl-swot-group">
              <div class="sl-swot-cat-title">${escapeHtml(group.category)}</div>
              <div class="sl-swot-columns">
                <div class="sl-swot-col good">
                  <div class="sl-swot-col-header">✓ Điểm tốt</div>
                  <ul class="sl-swot-list">
                    ${(group.goodPoints || [])
                      .map(
                        (pt) =>
                          `<li><strong>${escapeHtml(pt.title)}</strong> ${linkifyPostAndAdRefs(pt.detail || '')}</li>`
                      )
                      .join('')}
                  </ul>
                </div>

                <div class="sl-swot-col bad">
                  <div class="sl-swot-col-header">⚠ Điểm chưa tốt</div>
                  <ul class="sl-swot-list">
                    ${(group.badPoints || [])
                      .map(
                        (pt) =>
                          `<li><strong>${escapeHtml(pt.title)}</strong> ${linkifyPostAndAdRefs(pt.detail || '')}</li>`
                      )
                      .join('')}
                  </ul>
                </div>

                <div class="sl-swot-col opt">
                  <div class="sl-swot-col-header">🚀 Tối ưu</div>
                  <ul class="sl-swot-list">
                    ${(group.optimizations || [])
                      .map(
                        (pt) =>
                          `<li><strong>${escapeHtml(pt.title)}</strong> ${linkifyPostAndAdRefs(pt.detail || '')}</li>`
                      )
                      .join('')}
                  </ul>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        <!-- 13. Ý tưởng Nội dung Đề xuất -->
        <div class="sl-ai-section-card" id="sec-ai-13">
          <div class="sl-ai-sec-header">
            <span class="sl-ai-sec-num">13</span>
            <h3 class="sl-ai-sec-title">Ý tưởng Nội dung Đề xuất</h3>
          </div>
          <div class="sl-ideas-grid">
            ${(aiAnalysis.contentIdeas || [])
              .map(
                (idea, idx) => `
              <div class="sl-idea-card">
                <div>
                  <div class="sl-idea-title">Ý tưởng ${idx + 1}: ${escapeHtml(idea.title)}</div>
                  <div class="sl-idea-desc" style="margin-top:8px;">${linkifyPostAndAdRefs(idea.description || '')}</div>
                </div>
                <div class="sl-idea-rationale">
                  <strong>💡 Lý do đề xuất:</strong> ${linkifyPostAndAdRefs(idea.rationale || '')}
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // ============================================================================
  // GẮN SỰ KIỆN TƯƠNG TÁC LỌC BÀI ĐĂNG, QUẢNG CÁO, LỌC THỜI GIAN & DEEP AUDIT
  // ============================================================================
  let showAllPosts = false;
  let showAllAds = false;

  const postsFeedGrid = container.querySelector('#postsFeedGrid');
  const postSearchInput = container.querySelector('#postSearchInput');
  const postFormatFilter = container.querySelector('#postFormatFilter');
  const postTierFilter = container.querySelector('#postTierFilter');
  const postPillarFilter = container.querySelector('#postPillarFilter');
  const postHookFilter = container.querySelector('#postHookFilter');
  const postSortSelect = container.querySelector('#postSortSelect');
  const toggleAllPostsBtn = container.querySelector('#toggleAllPostsBtn');
  const postsFilteredCountPill = container.querySelector('#postsFilteredCountPill');
  const quickFilterOnlyWinsBtn = container.querySelector('#quickFilterOnlyWinsBtn');

  function updatePostsGrid() {
    const q = (postSearchInput?.value || '').trim().toLowerCase();
    const fmt = postFormatFilter?.value || 'all';
    const tierVal = postTierFilter?.value || 'all';
    const pillarVal = postPillarFilter?.value || 'all';
    const hookVal = postHookFilter?.value || 'all';
    const sortBy = postSortSelect?.value || 'index';

    let filtered = posts.filter((p) => {
      if (fmt !== 'all') {
        if ((p.format || '') !== fmt) return false;
      }
      if (tierVal !== 'all') {
        if (tierVal === 'all_wins') {
          if (!p.contentAudit?.isWin) return false;
        } else if ((p.contentAudit?.tierClass || 'standard') !== tierVal) {
          return false;
        }
      }
      if (pillarVal !== 'all') {
        if ((p.contentAudit?.contentPillar || '') !== pillarVal) return false;
      }
      if (hookVal !== 'all') {
        const ht = (p.contentAudit?.hookType || '').toLowerCase();
        if (!ht.includes(hookVal.toLowerCase())) return false;
      }
      if (q) {
        const hay = `${p.caption || ''} ${p.transcript || ''} ${p.contentAudit?.hookType || ''} ${p.contentAudit?.contentPillar || ''} ${p.contentAudit?.contentAngle || ''} ${p.contentAudit?.contentStyle || ''} bài ${p.index}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'score') {
      filtered.sort((a, b) => (b.contentAudit?.score || 0) - (a.contentAudit?.score || 0));
    } else if (sortBy === 'views') {
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'reactions') {
      filtered.sort((a, b) => (b.reactions || 0) - (a.reactions || 0));
    } else if (sortBy === 'comments') {
      filtered.sort((a, b) => (b.comments || 0) - (a.comments || 0));
    } else if (sortBy === 'shares') {
      filtered.sort((a, b) => (b.shares || 0) - (a.shares || 0));
    } else {
      filtered.sort((a, b) => a.index - b.index);
    }

    postsFilteredCountPill.textContent = `${filtered.length} bài`;
    const visible = showAllPosts ? filtered : filtered.slice(0, 10);
    postsFeedGrid.innerHTML = visible.map((p) => renderPostCardHtml(p, channel)).join('');
    toggleAllPostsBtn.textContent = showAllPosts
      ? 'Thu gọn (10 bài đầu)'
      : `Hiển thị toàn bộ (${filtered.length})`;
  }

  postSearchInput?.addEventListener('input', updatePostsGrid);
  postFormatFilter?.addEventListener('change', updatePostsGrid);
  postTierFilter?.addEventListener('change', updatePostsGrid);
  postPillarFilter?.addEventListener('change', updatePostsGrid);
  postHookFilter?.addEventListener('change', updatePostsGrid);
  postSortSelect?.addEventListener('change', updatePostsGrid);
  toggleAllPostsBtn?.addEventListener('click', () => {
    showAllPosts = !showAllPosts;
    updatePostsGrid();
  });
  quickFilterOnlyWinsBtn?.addEventListener('click', () => {
    if (postTierFilter) postTierFilter.value = 'all_wins';
    if (postSortSelect) postSortSelect.value = 'score';
    showAllPosts = true;
    updatePostsGrid();
    const secPosts = container.querySelector('#sec-posts');
    secPosts?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Lọc Quảng cáo
  const adsFeedGrid = container.querySelector('#adsFeedGrid');
  const adSearchInput = container.querySelector('#adSearchInput');
  const adFormatFilter = container.querySelector('#adFormatFilter');
  const toggleAllAdsBtn = container.querySelector('#toggleAllAdsBtn');
  const adsFilteredCountPill = container.querySelector('#adsFilteredCountPill');

  function updateAdsGrid() {
    const q = (adSearchInput.value || '').trim().toLowerCase();
    const fmt = adFormatFilter.value;

    const filtered = ads.filter((a) => {
      if (fmt !== 'all') {
        const isVid = String(a.format || '').toUpperCase().includes('VIDEO');
        if (fmt === 'VIDEO' && !isVid) return false;
        if (fmt === 'MULTI_IMAGES' && isVid) return false;
      }
      if (q) {
        const hay = `${a.caption || ''} ${a.transcript || ''} ${a.adId || ''} quảng cáo ${a.index}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    adsFilteredCountPill.textContent = `${filtered.length} mẫu`;
    const visible = showAllAds ? filtered : filtered.slice(0, 10);
    adsFeedGrid.innerHTML = visible.map((a) => renderAdCardHtml(a, channel)).join('');
    toggleAllAdsBtn.textContent = showAllAds
      ? 'Thu gọn (10 mẫu đầu)'
      : `Hiển thị toàn bộ (${filtered.length})`;
  }

  adSearchInput?.addEventListener('input', updateAdsGrid);
  adFormatFilter?.addEventListener('change', updateAdsGrid);
  toggleAllAdsBtn?.addEventListener('click', () => {
    showAllAds = !showAllAds;
    updateAdsGrid();
  });

  updatePostsGrid();
  updateAdsGrid();

  // ============================================================================
  // SỰ KIỆN BỘ CHỌN KỲ RESEARCH THEO NGÀY / THÁNG CHI TIẾT
  // ============================================================================
  const researchMonthSelect = container.querySelector('#researchMonthSelect');
  const researchDateFrom = container.querySelector('#researchDateFrom');
  const researchDateTo = container.querySelector('#researchDateTo');
  const applyResearchPeriodBtn = container.querySelector('#applyResearchPeriodBtn');
  const resetPeriodFilterBtn = container.querySelector('#resetPeriodFilterBtn');

  researchMonthSelect?.addEventListener('change', () => {
    const ym = researchMonthSelect.value;
    if (!ym) return;
    const [yyyy, mm] = ym.split('-').map(Number);
    const lastDay = new Date(yyyy, mm, 0).getDate();
    researchDateFrom.value = `${ym}-01`;
    researchDateTo.value = `${ym}-${String(lastDay).padStart(2, '0')}`;
  });

  applyResearchPeriodBtn?.addEventListener('click', () => {
    callbacks.onFilterByPeriod?.(report.id, {
      dateFrom: researchDateFrom.value,
      dateTo: researchDateTo.value,
      month: researchMonthSelect.value,
      runAi: true,
    });
  });

  resetPeriodFilterBtn?.addEventListener('click', () => {
    callbacks.onResetPeriod?.(report.id);
  });

  container.querySelectorAll('#reportPeriodQuickChips .preset-chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      const dFrom = chip.dataset.from;
      const dTo = chip.dataset.to;
      if (!dFrom && !dTo) {
        callbacks.onResetPeriod?.(report.id);
      } else {
        callbacks.onFilterByPeriod?.(report.id, {
          dateFrom: dFrom,
          dateTo: dTo,
          month: '',
          runAi: true,
        });
      }
    });
  });

  // Sự kiện nút công cụ trên cùng
  container.querySelector('#backToHubBtn')?.addEventListener('click', () => {
    callbacks.onBackToHub?.();
  });
  container.querySelector('#printPdfBtn')?.addEventListener('click', () => {
    showAllPosts = true;
    showAllAds = true;
    updatePostsGrid();
    updateAdsGrid();
    setTimeout(() => window.print(), 150);
  });
  container.querySelector('#reanalyzeReportBtn')?.addEventListener('click', () => {
    callbacks.onReanalyze?.(report.id);
  });
  container.querySelector('#addReportToCompareBtn')?.addEventListener('click', () => {
    callbacks.onAddToCompare?.(report.id);
  });

  // Sự kiện uỷ quyền (Delegation) cho:
  // 1) Click vào nút "🔍 Lọc ngày này" trong bảng Thống kê theo Ngày
  // 2) Click vào nút "🧠 AI Bóc tách sâu Hook & Content" trên từng bài đăng
  // 3) Click vào chip "Bài X" / "Quảng cáo Y"
  container.addEventListener('click', (e) => {
    const dayBtn = e.target.closest('.filter-single-day-btn');
    if (dayBtn) {
      const ymd = dayBtn.dataset.ymd;
      callbacks.onFilterByPeriod?.(report.id, {
        dateFrom: ymd,
        dateTo: ymd,
        month: '',
        runAi: true,
      });
      return;
    }

    const deepAuditBtn = e.target.closest('.deep-post-audit-btn');
    if (deepAuditBtn) {
      const postIdx = Number(deepAuditBtn.dataset.postIndex);
      const postObj = posts.find((p) => Number(p.index) === postIdx);
      if (postObj) {
        callbacks.onDeepPostAudit?.(report.id, postObj);
      }
      return;
    }

    const chip = e.target.closest('.ref-chip');
    if (!chip) return;
    const refType = chip.dataset.refType;
    const refIdx = Number(chip.dataset.refIndex);
    if (refType === 'post') {
      const postObj = posts.find((p) => Number(p.index) === refIdx);
      if (postObj) {
        callbacks.onPreviewRef?.('post', postObj, () => {
          showAllPosts = true;
          updatePostsGrid();
          const cardEl = container.querySelector(`#report-post-card-${refIdx}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.classList.add('highlighted-flash');
            setTimeout(() => cardEl.classList.remove('highlighted-flash'), 2600);
          }
        });
      }
    } else if (refType === 'ad') {
      const adObj = ads.find((a) => Number(a.index) === refIdx);
      if (adObj) {
        callbacks.onPreviewRef?.('ad', adObj, () => {
          showAllAds = true;
          updateAdsGrid();
          const cardEl = container.querySelector(`#report-ad-card-${refIdx}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.classList.add('highlighted-flash');
            setTimeout(() => cardEl.classList.remove('highlighted-flash'), 2600);
          }
        });
      }
    }
  });
}
