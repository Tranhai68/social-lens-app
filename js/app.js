/**
 * Main SPA Application Controller for Social Lens
 */

import {
  renderSingleReport,
  renderPostCardHtml,
  renderAdCardHtml,
} from './report-renderer.js';
import { renderCompareView } from './compare-renderer.js';

const state = {
  currentView: 'hub', // 'hub' | 'report' | 'compare'
  reportsList: [],
  activeReportId: 'rep-lamme-fb-202610',
  activeReportFull: null,
  platformFilter: 'all',
  searchQuery: '',
  selectedCompareIds: [
    'rep-lamme-fb-202610',
    'rep-mdufashion-fb-202610',
    'rep-glamnest-fb-202610',
    'rep-celestestudio8-fb-202610',
    'rep-megauvietnam-fb-202610',
    'rep-sachimom-fb-202610',
    'rep-b2mum-fb-202610',
  ],
  configStatus: {},
};

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(val) {
  const n = Number(val || 0);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('en-US');
}

// ============================================================================
// NAVIGATION & VIEW SWITCHING
// ============================================================================

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });
  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewName === 'hub') {
    renderHubGrid();
  } else if (viewName === 'report') {
    loadAndRenderSingleReport(state.activeReportId);
  } else if (viewName === 'compare') {
    renderCompareSection();
  }
}

// ============================================================================
// STATIC / GITHUB PAGES FALLBACK LOADER
// ============================================================================

let staticBundleCache = null;

async function getStaticBundle() {
  if (staticBundleCache) return staticBundleCache;
  const res = await fetch('data/reports-static.json');
  if (!res.ok) throw new Error('Không tải được dữ liệu báo cáo tĩnh.');
  staticBundleCache = await res.json();
  window.__SOCIAL_LENS_STATIC_BUNDLE__ = staticBundleCache;
  return staticBundleCache;
}

// ============================================================================
// API CALLS (CÓ TỰ ĐỘNG CHUYỂN SANG CHẾ ĐỘ GITHUB PAGES TĨNH KHI KHÔNG CÓ BACKEND)
// ============================================================================

async function fetchConfigStatus() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Static mode');
    const data = await res.json();
    state.configStatus = data;

    const dot = document.getElementById('apiStatusDot');
    if (dot) {
      dot.classList.toggle(
        'online',
        Boolean(data.hasGeminiKey || data.hasApifyToken || data.hasRapidApiKey)
      );
    }

    const gemStatus = document.getElementById('cfgGeminiStatus');
    if (gemStatus) {
      gemStatus.textContent = data.hasGeminiKey
        ? `✅ Đã cấu hình (${data.geminiKeyMasked})`
        : 'Chưa nhập key (Sử dụng bộ phân tích định lượng + AI tổng hợp chuẩn)';
    }
    const apifyStatus = document.getElementById('cfgApifyStatus');
    if (apifyStatus) {
      apifyStatus.textContent = data.hasApifyToken
        ? `✅ Đã cấu hình (${data.apifyTokenMasked})`
        : 'Chưa nhập token (Tự động dùng Smart Simulation khi quét URL)';
    }
    const rapidStatus = document.getElementById('cfgRapidStatus');
    if (rapidStatus) {
      rapidStatus.textContent = data.hasRapidApiKey
        ? `✅ Đã cấu hình (${data.rapidApiKeyMasked})`
        : 'Chưa nhập key';
    }
    const modelSel = document.getElementById('cfgGeminiModel');
    if (modelSel && data.geminiModel) {
      modelSel.value = data.geminiModel;
    }
  } catch {
    const dot = document.getElementById('apiStatusDot');
    if (dot) dot.classList.add('online');
  }
}

async function fetchReportsList() {
  try {
    let reports = [];
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        reports = data.reports || [];
      } else {
        throw new Error('Static fallback');
      }
    } catch {
      const staticData = await getStaticBundle();
      reports = staticData.reports || [];
    }

    state.reportsList = reports;
    const countSpan = document.getElementById('navReportsCount');
    if (countSpan) countSpan.textContent = state.reportsList.length;

    if (!state.activeReportId && state.reportsList.length > 0) {
      state.activeReportId = state.reportsList[0].id;
    }
    renderHubGrid();
    updateCompareBadges();
  } catch (err) {
    console.error('Lỗi tải danh sách báo cáo:', err);
  }
}

async function loadAndRenderSingleReport(reportId) {
  const container = document.getElementById('singleReportContainer');
  if (!container) return;

  const targetId = reportId || state.activeReportId || state.reportsList[0]?.id;
  if (!targetId) return;

  state.activeReportId = targetId;
  container.innerHTML = `<div class="sl-section-block">⏳ Đang tải dữ liệu chi tiết báo cáo...</div>`;

  try {
    let reportObj = null;
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        reportObj = data.report;
      } else {
        throw new Error('Static fallback');
      }
    } catch {
      const staticData = await getStaticBundle();
      reportObj = (staticData.reports || []).find((r) => r.id === targetId);
    }

    if (!reportObj) {
      container.innerHTML = `<div class="sl-section-block">Không tìm thấy báo cáo.</div>`;
      return;
    }
    state.activeReportFull = reportObj;

    renderSingleReport(container, reportObj, {
      onBackToHub: () => switchView('hub'),
      onReanalyze: handleReanalyzeReport,
      onAddToCompare: (id) => {
        if (!state.selectedCompareIds.includes(id)) {
          state.selectedCompareIds.push(id);
          updateCompareBadges();
        }
        switchView('compare');
      },
      onPreviewRef: openPreviewRefModal,
      onFilterByPeriod: handleFilterReportByPeriod,
      onResetPeriod: (id) => loadAndRenderSingleReport(id),
      onDeepPostAudit: openDeepPostAuditModal,
    });
  } catch (err) {
    container.innerHTML = `<div class="sl-section-block" style="color:var(--danger);">Lỗi tải báo cáo: ${escapeHtml(err.message)}</div>`;
  }
}

async function handleFilterReportByPeriod(reportId, periodPayload) {
  const container = document.getElementById('singleReportContainer');
  if (!container) return;

  const btn = document.getElementById('applyResearchPeriodBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang lọc & phân tích kỳ đã chọn...';
  }

  try {
    let filteredReport = null;
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/research-period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(periodPayload),
      });
      if (res.ok) {
        const data = await res.json();
        filteredReport = data.filteredReport;
      } else {
        throw new Error('Static fallback');
      }
    } catch {
      const staticData = await getStaticBundle();
      const baseReport = (staticData.reports || []).find((r) => r.id === reportId);
      if (baseReport) {
        const { dateFrom = '', dateTo = '', month = '' } = periodPayload;
        const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : 0;
        const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Infinity;
        const filteredPosts = (baseReport.posts || []).filter((p) => {
          if (month && !(p.isoDate || '').includes(`-${month}-`)) return false;
          const t = new Date(p.isoDate || 0).getTime();
          return t >= fromTs && t <= toTs;
        });
        filteredReport = {
          ...baseReport,
          channel: {
            ...baseReport.channel,
            dateFrom: dateFrom || baseReport.channel.dateFrom,
            dateTo: dateTo || baseReport.channel.dateTo,
            activeResearchFilter: { dateFrom, dateTo, month },
          },
          posts: filteredPosts,
        };
      }
    }

    if (!filteredReport) {
      throw new Error('Không thể lọc kỳ báo cáo');
    }

    renderSingleReport(container, filteredReport, {
      onBackToHub: () => switchView('hub'),
      onReanalyze: handleReanalyzeReport,
      onAddToCompare: (id) => {
        if (!state.selectedCompareIds.includes(id)) {
          state.selectedCompareIds.push(id);
          updateCompareBadges();
        }
        switchView('compare');
      },
      onPreviewRef: openPreviewRefModal,
      onFilterByPeriod: handleFilterReportByPeriod,
      onResetPeriod: (id) => loadAndRenderSingleReport(id),
      onDeepPostAudit: openDeepPostAuditModal,
    });
  } catch (err) {
    alert(`Lỗi lọc thời gian: ${err.message}`);
  }
}

async function openDeepPostAuditModal(reportId, postObj) {
  const modal = document.getElementById('deepPostAuditModal');
  const titleEl = document.getElementById('deepPostAuditTitle');
  const bodyEl = document.getElementById('deepPostAuditBody');
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = `🧠 AI Phân Tích Chuyên Sâu Bài #${postObj.index} (${postObj.format || 'Bài đăng'}) — ${postObj.publishedAt || ''}`;
  bodyEl.innerHTML = `<div style="padding:20px; text-align:center; color:var(--primary); font-weight:600;">⏳ Đang chạy mô hình AI bóc tách Câu Hook, Phong cách Content, Đòn bẩy tâm lý &amp; Đánh giá Hiệu quả Bài #${postObj.index}...</div>`;
  modal.classList.add('open');

  try {
    let audit = null;
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/analyze-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIndex: postObj.index }),
      });
      if (res.ok) {
        const data = await res.json();
        audit = data.postAudit;
      } else {
        throw new Error('Static fallback');
      }
    } catch {
      audit = postObj.contentAudit || null;
    }

    if (!audit) {
      throw new Error('Không thể phân tích bài viết');
    }
    const deep = audit.deepAudit || {};
    const hookDive = deep.hookDeepDive || {};
    const styleStruct = deep.contentStyleAndStructure || {};
    const effEval = deep.effectivenessEvaluation || {};

    bodyEl.innerHTML = `
      <div class="sl-formula-stack">
        <!-- 1. Tóm tắt Chỉ số & Xếp hạng Hiệu quả -->
        <div class="sl-formula-card" style="background:var(--bg-page);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
              <span class="sl-tier-badge ${escapeHtml(audit.tierClass || 'standard')}" style="font-size:13px; padding:4px 12px;">
                Điểm Hiệu Quả: ${audit.score || 70}/100 · ${escapeHtml(audit.tier || 'Ổn định')}
              </span>
              <span class="sl-m-badge" style="margin-left:6px;">ER: <strong>${escapeHtml(audit.er || '0.35%')}</strong></span>
            </div>
            <div style="font-size:12.5px; color:var(--text-secondary);">
              👁️ <strong>${fmtNum(postObj.views || 0)}</strong> views · 👍 <strong>${fmtNum(postObj.reactions || 0)}</strong> reactions · 💬 <strong>${fmtNum(postObj.comments || 0)}</strong> bình luận · ↗️ <strong>${fmtNum(postObj.shares || 0)}</strong> chia sẻ
            </div>
          </div>
          <div style="font-size:13px; color:var(--text-main);">
            <strong>📊 Đánh giá tổng quát:</strong> ${escapeHtml(effEval.overallVerdict || audit.verdict || '')}
          </div>
        </div>

        <!-- 2. Phân tích Chuyên sâu Câu Hook Mở đầu (3 giây đầu / Dòng đầu) -->
        <div class="sl-formula-card">
          <div class="sl-formula-top">
            <div class="sl-formula-name" style="color:var(--primary);">🎯 1. Giải phẫu Câu Hook Mở Đầu (Hook Anatomy)</div>
            <span class="sl-m-badge">Điểm Hook: <strong>${audit.hookScore || 8.5}/10</strong></span>
          </div>
          <div class="sl-hook-quote" style="margin-bottom:10px;">
            <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:2px;">Câu Hook trích xuất từ bài viết / 3s đầu video:</div>
            <div style="font-size:13.5px; font-weight:700; color:var(--text-main);">"${escapeHtml(hookDive.extractedHook || audit.hookSentence || '')}"</div>
          </div>
          <div class="sl-formula-detail-row"><strong>Phân loại Kỹ thuật Hook:</strong> ${escapeHtml(hookDive.hookCategory || audit.hookType || '')}</div>
          <div class="sl-formula-detail-row"><strong>Đòn bẩy Tâm lý (Psychological Trigger):</strong> ${escapeHtml(hookDive.psychologicalTrigger || audit.hookMechanism || '')}</div>
          <div class="sl-formula-detail-row"><strong>Đánh giá Sức hút:</strong> ${escapeHtml(hookDive.strengthEvaluation || '')}</div>

          <div style="margin-top:10px; background:var(--primary-light); border:1px solid #c7d2fe; border-radius:6px; padding:10px 12px;">
            <div style="font-weight:800; font-size:12.5px; color:var(--primary); margin-bottom:6px;">
              ✨ 3 Phương án Viết lại Câu Hook (A/B Testing để Tăng Tỷ lệ Giữ chân 3s đầu):
            </div>
            <ul style="padding-left:18px; display:flex; flex-direction:column; gap:5px; font-size:12.5px; color:var(--text-main);">
              ${(hookDive.alternativeHooks || [])
                .map((h) => `<li>${escapeHtml(h)}</li>`)
                .join('')}
            </ul>
          </div>
        </div>

        <!-- 3. Phân tích Phong cách Content, Công thức Viết & Mạch Dẫn Dắt -->
        <div class="sl-formula-card">
          <div class="sl-formula-name" style="color:var(--primary); margin-bottom:8px;">
            ✍️ 2. Phong cách Content, Công thức Kịch bản &amp; Từ khóa Đắt giá
          </div>
          <div class="sl-audit-tags-grid" style="margin-bottom:10px;">
            <div class="sl-audit-tag-item">
              <span class="sl-audit-tag-label">Phong cách Content &amp; Tone giọng</span>
              <span class="sl-audit-tag-val">${escapeHtml(styleStruct.contentStyle || audit.contentStyle || '')}</span>
            </div>
            <div class="sl-audit-tag-item">
              <span class="sl-audit-tag-label">Công thức Copywriting</span>
              <span class="sl-audit-tag-val">${escapeHtml(styleStruct.copywritingFormula || audit.copyFormula || '')}</span>
            </div>
            <div class="sl-audit-tag-item">
              <span class="sl-audit-tag-label">Tuyến nội dung (Content Pillar)</span>
              <span class="sl-audit-tag-val">${escapeHtml(audit.contentPillar || '')}</span>
            </div>
            <div class="sl-audit-tag-item">
              <span class="sl-audit-tag-label">Vị trí Phễu &amp; Kỹ thuật CTA</span>
              <span class="sl-audit-tag-val">${escapeHtml(audit.funnelStage || '')} · ${escapeHtml(audit.ctaType || '')}</span>
            </div>
          </div>
          <div class="sl-formula-detail-row">
            <strong>Mạch dẫn dắt (Narrative Story Arc):</strong> ${escapeHtml(styleStruct.narrativeFlow || '')}
          </div>
          <div style="margin-top:8px;">
            <strong style="font-size:12px;">🔑 Từ khóa cảm xúc &amp; USP nổi bật:</strong>
            ${(styleStruct.powerWords || audit.matchedKeywords || [])
              .map((kw) => `<span class="sl-kw-chip">${escapeHtml(kw)}</span>`)
              .join('')}
          </div>
        </div>

        <!-- 4. Đánh giá Hiệu quả Chuyển đổi & Khuyến nghị Tối ưu -->
        <div class="sl-formula-card">
          <div class="sl-formula-name" style="color:var(--primary); margin-bottom:8px;">
            🚀 3. Lý giải Hiệu quả, Mức độ Sẵn sàng Chạy Ads &amp; Khuyến nghị Tối ưu
          </div>
          <div class="sl-formula-detail-row">
            <strong>Nguyên nhân cốt lõi:</strong> ${escapeHtml(effEval.whyItWorkedOrFailed || '')}
          </div>
          <div class="sl-formula-detail-row">
            <strong>Đánh giá Mức độ Sẵn sàng Chạy Quảng cáo (Ad Readiness):</strong> ${escapeHtml(effEval.adReadiness || '')}
          </div>
          <div style="margin-top:8px; background:var(--success-bg); border:1px solid #a7f3d0; border-radius:6px; padding:10px 12px;">
            <div style="font-weight:800; font-size:12.5px; color:#047857; margin-bottom:5px;">
              ✅ Đề xuất Tối ưu &amp; Nhân bản Bài viết này:
            </div>
            <ul style="padding-left:18px; display:flex; flex-direction:column; gap:5px; font-size:12.5px;">
              ${(effEval.actionableImprovements || [])
                .map((imp) => `<li>${escapeHtml(imp)}</li>`)
                .join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    bodyEl.innerHTML = `<div style="color:var(--danger); padding:16px;">Lỗi khi phân tích bài viết: ${escapeHtml(err.message)}</div>`;
  }
}

async function handleReanalyzeReport(reportId) {
  const btn = document.getElementById('reanalyzeReportBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang chạy Gemini AI 13 mục...';
  }
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/reanalyze`, {
      method: 'POST',
    });
    const data = await res.json();
    if (data.report) {
      state.activeReportFull = data.report;
      await fetchReportsList();
      await loadAndRenderSingleReport(reportId);
    }
  } catch (err) {
    alert(`Lỗi khi phân tích lại: ${err.message}`);
  }
}

// ============================================================================
// RENDER VIEW 1: THƯ VIỆN BÁO CÁO (REPORTS HUB)
// ============================================================================

function updateCompareBadges() {
  const navCnt = document.getElementById('navCompareCount');
  if (navCnt) navCnt.textContent = state.selectedCompareIds.length;

  const floatingBar = document.getElementById('compareFloatingBar');
  const floatingCnt = document.getElementById('floatingCompareCount');
  const floatingNames = document.getElementById('floatingCompareNames');

  if (floatingBar) {
    if (state.selectedCompareIds.length > 0) {
      floatingBar.style.display = 'flex';
      floatingCnt.textContent = state.selectedCompareIds.length;
      const names = state.reportsList
        .filter((r) => state.selectedCompareIds.includes(r.id))
        .map((r) => `${r.channel?.name} (${(r.channel?.platform || '').toUpperCase()})`);
      floatingNames.textContent = names.join('  vs  ');
    } else {
      floatingBar.style.display = 'none';
    }
  }
}

function renderHubGrid() {
  const grid = document.getElementById('hubReportsGrid');
  if (!grid) return;

  const pf = state.platformFilter;
  const q = state.searchQuery.trim().toLowerCase();

  const filtered = state.reportsList.filter((r) => {
    if (pf !== 'all' && (r.channel?.platform || '').toLowerCase() !== pf) {
      return false;
    }
    if (q) {
      const hay = `${r.channel?.name || ''} ${r.channel?.category || ''} ${r.channel?.platform || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="sl-section-block" style="grid-column: 1 / -1; text-align:center; padding:40px;">
        <h3 style="margin-bottom:8px;">Không tìm thấy báo cáo nào phù hợp bộ lọc</h3>
        <p style="color:var(--text-secondary); margin-bottom:16px;">Hãy bấm nút "Quét Kênh Mới" để phân tích bất kỳ Fanpage, TikTok, Instagram, YouTube hay Shopee Video nào.</p>
        <button class="btn btn-primary" onclick="document.getElementById('openScanModalBtn').click()">＋ Quét Kênh Mới ngay</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((r) => {
      const platform = (r.channel?.platform || 'facebook').toLowerCase();
      const isChecked = state.selectedCompareIds.includes(r.id);

      return `
        <article class="report-hub-card">
          <div>
            <div class="hub-card-top">
              <span class="platform-badge platform-${escapeHtml(platform)}">
                ${escapeHtml(platform)}
              </span>
              <span style="font-size:11.5px; color:var(--text-muted);">
                Tạo ngày: <strong>${escapeHtml(r.channel?.createdAt || '02/11/2026')}</strong>
              </span>
            </div>

            <div class="hub-card-title" data-open-report="${escapeHtml(r.id)}">
              ${escapeHtml(r.channel?.name)}
            </div>
            <div class="hub-card-period">
              📂 ${escapeHtml(r.channel?.category || 'Brand')} · 📅 Kỳ dữ liệu: ${escapeHtml(r.channel?.dateFrom)} &rarr; ${escapeHtml(r.channel?.dateTo)}
            </div>

            <div class="hub-card-kpis">
              <div class="hub-kpi-item">
                <span class="hub-kpi-label">Followers</span>
                <span class="hub-kpi-val">${fmtNum(r.channel?.followers)}</span>
              </div>
              <div class="hub-kpi-item">
                <span class="hub-kpi-label">Bài đăng / Ads</span>
                <span class="hub-kpi-val">${fmtNum(r.postsCount)} / ${fmtNum(r.adsCount)}</span>
              </div>
              <div class="hub-kpi-item">
                <span class="hub-kpi-label">Tổng Views</span>
                <span class="hub-kpi-val">${fmtNum(r.stats?.totals?.totalViews)}</span>
              </div>
              <div class="hub-kpi-item">
                <span class="hub-kpi-label">Tương tác</span>
                <span class="hub-kpi-val">${fmtNum(r.stats?.totals?.totalInteractions)}</span>
              </div>
            </div>

            <div class="hub-card-summary">
              ${escapeHtml(r.executiveSummary || '')}
            </div>
          </div>

          <div class="hub-card-footer">
            <label class="compare-checkbox-label">
              <input type="checkbox" class="hub-compare-chk" data-id="${escapeHtml(r.id)}" ${isChecked ? 'checked' : ''} />
              <span>Chọn so sánh</span>
            </label>

            <div style="display:flex; gap:6px;">
              ${
                r.id !== 'rep-lamme-fb-202610'
                  ? `<button class="btn btn-outline btn-sm hub-del-btn" data-del-id="${escapeHtml(r.id)}" title="Xóa báo cáo">🗑️</button>`
                  : ''
              }
              <button class="btn btn-primary btn-sm" data-open-report="${escapeHtml(r.id)}">
                Xem Báo Cáo (13 mục) &rarr;
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  // Sự kiện mở báo cáo
  grid.querySelectorAll('[data-open-report]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.openReport;
      state.activeReportId = id;
      switchView('report');
    });
  });

  // Sự kiện chọn checkbox so sánh
  grid.querySelectorAll('.hub-compare-chk').forEach((chk) => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.id;
      if (chk.checked) {
        if (!state.selectedCompareIds.includes(id)) state.selectedCompareIds.push(id);
      } else {
        state.selectedCompareIds = state.selectedCompareIds.filter((x) => x !== id);
      }
      updateCompareBadges();
    });
  });

  // Sự kiện xóa báo cáo
  grid.querySelectorAll('.hub-del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delId;
      if (!confirm('Bạn có chắc muốn xóa báo cáo này?')) return;
      await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.selectedCompareIds = state.selectedCompareIds.filter((x) => x !== id);
      await fetchReportsList();
    });
  });
}

// ============================================================================
// RENDER VIEW 3: SO SÁNH ĐA KÊNH
// ============================================================================

function renderCompareSection() {
  const container = document.getElementById('compareViewContainer');
  if (!container) return;

  renderCompareView(container, state.reportsList, state.selectedCompareIds, {
    onToggleCompareId: (id) => {
      if (state.selectedCompareIds.includes(id)) {
        if (state.selectedCompareIds.length <= 2) {
          alert('Cần giữ ít nhất 2 kênh để so sánh đối xứng.');
          return;
        }
        state.selectedCompareIds = state.selectedCompareIds.filter((x) => x !== id);
      } else {
        state.selectedCompareIds.push(id);
      }
      updateCompareBadges();
      renderCompareSection();
    },
  });
}

// ============================================================================
// PREVIEW MODAL KHI CLICK CHIP "BÀI X" HOẶC "QUẢNG CÁO Y"
// ============================================================================

let pendingScrollCallback = null;

function openPreviewRefModal(type, itemObj, onScrollToCard) {
  const modal = document.getElementById('previewRefModal');
  const titleEl = document.getElementById('previewRefTitle');
  const bodyEl = document.getElementById('previewRefBody');
  if (!modal || !titleEl || !bodyEl) return;

  pendingScrollCallback = onScrollToCard;

  if (type === 'post') {
    titleEl.textContent = `Chi tiết Bài đăng #${itemObj.index} (${itemObj.format || ''})`;
    bodyEl.innerHTML = renderPostCardHtml(itemObj);
  } else {
    titleEl.textContent = `Chi tiết Quảng cáo #${itemObj.index} (ID: ${itemObj.adId || ''})`;
    bodyEl.innerHTML = renderAdCardHtml(itemObj);
  }

  modal.classList.add('open');
}

// ============================================================================
// CSV PARSER HELPER CHO TÍNH NĂNG IMPORT
// ============================================================================

function parseSimpleCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] || '';
    });
    return obj;
  });
}

// ============================================================================
// INITIALIZE DOM EVENTS
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([fetchConfigStatus(), fetchReportsList()]);

  // Navigation Tabs
  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.getElementById('navLogoBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('hub');
  });

  // Platform Filter Pills
  document.querySelectorAll('#hubPlatformPills .platform-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document
        .querySelectorAll('#hubPlatformPills .platform-pill')
        .forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.platformFilter = pill.dataset.platform;
      renderHubGrid();
    });
  });

  // Search box
  document.getElementById('hubSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value || '';
    renderHubGrid();
  });

  // Compare Floating Bar buttons
  document.getElementById('goCompareNowBtn')?.addEventListener('click', () => switchView('compare'));
  document.getElementById('quickCompareTopBtn')?.addEventListener('click', () => switchView('compare'));
  document.getElementById('clearCompareSelectionBtn')?.addEventListener('click', () => {
    state.selectedCompareIds = [];
    updateCompareBadges();
    renderHubGrid();
  });

  // Open / Close Modals
  const openModal = (id) => document.getElementById(id)?.classList.add('open');
  const closeModal = (id) => document.getElementById(id)?.classList.remove('open');

  document.getElementById('openScanModalBtn')?.addEventListener('click', () => openModal('scanModal'));
  document.getElementById('heroScanBtn')?.addEventListener('click', () => openModal('scanModal'));
  document.getElementById('openImportModalBtn')?.addEventListener('click', () => openModal('importModal'));
  document.getElementById('openSettingsModalBtn')?.addEventListener('click', () => {
    fetchConfigStatus();
    openModal('settingsModal');
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.getElementById('scrollToOriginalCardBtn')?.addEventListener('click', () => {
    closeModal('previewRefModal');
    if (typeof pendingScrollCallback === 'function') {
      pendingScrollCallback();
    }
  });

  // Sự kiện chọn Tháng chi tiết (Tháng 1 -> Tháng 12) và Mốc thời gian nhanh trong Modal Quét Kênh
  const scanYearSelect = document.getElementById('scanYearSelect');
  const scanDateFrom = document.getElementById('scanDateFrom');
  const scanDateTo = document.getElementById('scanDateTo');

  function applyMonthSelection(mmStr) {
    const yyyy = Number(scanYearSelect?.value || 2026);
    const mm = Number(mmStr);
    const lastDay = new Date(yyyy, mm, 0).getDate();
    if (scanDateFrom) scanDateFrom.value = `${yyyy}-${mmStr}-01`;
    if (scanDateTo) scanDateTo.value = `${yyyy}-${mmStr}-${String(lastDay).padStart(2, '0')}`;
  }

  document.querySelectorAll('#scanMonthGrid .month-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('#scanMonthGrid .month-pill-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyMonthSelection(btn.dataset.month);
    });
  });

  scanYearSelect?.addEventListener('change', () => {
    const activeMonthBtn = document.querySelector('#scanMonthGrid .month-pill-btn.active');
    if (activeMonthBtn) {
      applyMonthSelection(activeMonthBtn.dataset.month);
    }
  });

  document.querySelectorAll('#scanQuickPresets .preset-chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      document
        .querySelectorAll('#scanQuickPresets .preset-chip-btn')
        .forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const preset = chip.dataset.preset;
      const yyyy = Number(scanYearSelect?.value || 2026);
      if (preset === '7d') {
        scanDateFrom.value = `${yyyy}-10-24`;
        scanDateTo.value = `${yyyy}-10-31`;
      } else if (preset === '14d') {
        scanDateFrom.value = `${yyyy}-10-17`;
        scanDateTo.value = `${yyyy}-10-31`;
      } else if (preset === 'month-10') {
        applyMonthSelection('10');
      } else if (preset === 'month-11') {
        applyMonthSelection('11');
      } else if (preset === 'q3') {
        scanDateFrom.value = `${yyyy}-07-01`;
        scanDateTo.value = `${yyyy}-09-30`;
      } else if (preset === 'q4') {
        scanDateFrom.value = `${yyyy}-10-01`;
        scanDateTo.value = `${yyyy}-12-31`;
      }
    });
  });

  // Form 1: Quét Kênh Mới (Apify / RapidAPI + Gemini AI)
  document.getElementById('scanChannelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitScanBtn');
    const progressBox = document.getElementById('scanProgressBox');
    submitBtn.disabled = true;
    progressBox.style.display = 'block';

    try {
      const payload = {
        url: document.getElementById('scanUrlInput').value.trim(),
        platform: document.getElementById('scanPlatformSelect').value,
        channelName: document.getElementById('scanNameInput').value.trim(),
        category: document.getElementById('scanCategoryInput').value.trim() || 'Fashion & Retail',
        limit: Number(document.getElementById('scanLimitInput').value || 50),
        dateFrom: document.getElementById('scanDateFrom').value || '2026-10-01',
        dateTo: document.getElementById('scanDateTo').value || '2026-10-31',
      };

      const res = await fetch('/api/reports/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi quét kênh');

      closeModal('scanModal');
      await fetchReportsList();
      state.activeReportId = data.report.id;
      switchView('report');
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      progressBox.style.display = 'none';
    }
  });

  // Form 2: Import CSV / JSON
  const importFileInput = document.getElementById('importFileInput');
  importFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const textarea = document.getElementById('importJsonTextarea');
    if (file.name.endsWith('.csv')) {
      const parsed = parseSimpleCsv(text);
      textarea.value = JSON.stringify(parsed, null, 2);
    } else {
      textarea.value = text;
    }
  });

  document.getElementById('importDataForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitImportBtn');
    btn.disabled = true;
    try {
      const rawText = document.getElementById('importJsonTextarea').value.trim();
      let posts = [];
      let ads = [];
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) posts = parsed;
        else if (parsed.posts) {
          posts = parsed.posts;
          ads = parsed.ads || [];
        }
      }

      const payload = {
        channelName: document.getElementById('importChannelName').value.trim(),
        platform: document.getElementById('importPlatform').value,
        followers: Number(document.getElementById('importFollowers').value || 100000),
        category: document.getElementById('importCategory').value.trim(),
        posts,
        ads,
      };

      const res = await fetch('/api/reports/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import thất bại');

      closeModal('importModal');
      await fetchReportsList();
      state.activeReportId = data.report.id;
      switchView('report');
    } catch (err) {
      alert(`Lỗi Import: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // Form 3: Lưu Cấu Hình API & Kiểm tra trực tiếp
  async function runGeminiKeyTest(customKey = '', customModel = '') {
    const box = document.getElementById('cfgTestResultBox');
    if (!box) return;
    box.style.display = 'block';
    box.style.background = '#eef2ff';
    box.style.border = '1px solid #c7d2fe';
    box.style.color = '#3730a3';
    box.textContent = '⏳ Đang kiểm tra kết nối tới máy chủ Google Gemini...';

    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: customKey,
          geminiModel: customModel || document.getElementById('cfgGeminiModel')?.value,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        box.style.background = '#ecfdf5';
        box.style.border = '1px solid #6ee7b7';
        box.style.color = '#065f46';
        box.textContent = `✅ ${data.message}`;
      } else {
        box.style.background = '#fef2f2';
        box.style.border = '1px solid #fecaca';
        box.style.color = '#991b1b';
        box.textContent = `❌ Key không hợp lệ hoặc bị khóa (${data.status || 'Lỗi'}): ${data.error}`;
      }
    } catch (err) {
      box.style.background = '#fef2f2';
      box.style.border = '1px solid #fecaca';
      box.style.color = '#991b1b';
      box.textContent = `❌ Lỗi kiểm tra: ${err.message}`;
    }
  }

  document.getElementById('testApiKeyBtn')?.addEventListener('click', () => {
    const gemVal = document.getElementById('cfgGeminiKey')?.value.trim() || '';
    const modelVal = document.getElementById('cfgGeminiModel')?.value || '';
    runGeminiKeyTest(gemVal, modelVal);
  });

  document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const gemVal = document.getElementById('cfgGeminiKey').value.trim();
    const apifyVal = document.getElementById('cfgApifyToken').value.trim();
    const rapidVal = document.getElementById('cfgRapidKey').value.trim();
    const modelVal = document.getElementById('cfgGeminiModel').value;

    const payload = { geminiModel: modelVal };
    if (gemVal) payload.geminiApiKey = gemVal;
    if (apifyVal) payload.apifyToken = apifyVal;
    if (rapidVal) payload.rapidApiKey = rapidVal;

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      document.getElementById('cfgGeminiKey').value = '';
      document.getElementById('cfgApifyToken').value = '';
      document.getElementById('cfgRapidKey').value = '';
      await fetchConfigStatus();
      await runGeminiKeyTest('', modelVal);
    }
  });
});

