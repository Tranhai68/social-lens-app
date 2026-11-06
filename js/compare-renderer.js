/**
 * Multi-Channel Comparison Renderer (So Sánh Đa Kênh & Đối Thủ Cạnh Tranh)
 * Cho phép đặt 2 - 6 kênh lên bàn cân đối xứng: KPI, Định dạng, Phễu ToFu/MoFu/BoFu,
 * Hoạt động theo Thứ và Nhận định Chiến lược từ Google Gemini AI.
 */

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

export function renderCompareView(container, allReports = [], selectedIds = [], callbacks = {}) {
  const selectedReports = allReports.filter((r) => selectedIds.includes(r.id));

  // Nếu chưa đủ 2 kênh thì mặc định lấy 2 kênh đầu tiên
  const activeReports =
    selectedReports.length >= 2 ? selectedReports : allReports.slice(0, Math.min(3, allReports.length));

  const activeIds = activeReports.map((r) => r.id);

  // Tìm giá trị dẫn đầu cho từng chỉ số để highlight
  const maxFollowers = Math.max(...activeReports.map((r) => Number(r.channel?.followers || 0)), 1);
  const maxPosts = Math.max(...activeReports.map((r) => Number(r.postsCount ?? r.posts?.length ?? 0)), 1);
  const maxAds = Math.max(...activeReports.map((r) => Number(r.adsCount ?? r.ads?.length ?? 0)), 1);
  const maxViews = Math.max(...activeReports.map((r) => Number(r.stats?.totals?.totalViews || 0)), 1);
  const maxAvgViews = Math.max(...activeReports.map((r) => Number(r.stats?.averages?.avgViews || 0)), 1);
  const maxInteractions = Math.max(
    ...activeReports.map((r) => Number(r.stats?.totals?.totalInteractions || 0)),
    1
  );
  const maxAvgInteractions = Math.max(
    ...activeReports.map((r) => Number(r.stats?.averages?.avgInteractions || 0)),
    1
  );

  container.innerHTML = `
    <div class="sl-section-block" style="margin-bottom:20px;">
      <div class="sl-section-bar">
        <div class="sl-section-bar-left">
          <span class="sl-bar-accent"></span>
          <h2 class="sl-section-bar-title">CHỌN CÁC KÊNH ĐỂ SO SÁNH ĐỐI XỨNG (2 – 6 KÊNH)</h2>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" id="runAiCompareBtn">
            🤖 Chạy Phân Tích Cạnh Tranh bằng Gemini AI
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.print()">
            🖨️ Xuất Báo Cáo So Sánh PDF
          </button>
        </div>
      </div>

      <div class="compare-selector-grid">
        ${allReports
          .map((r) => {
            const isSel = activeIds.includes(r.id);
            const pf = (r.channel?.platform || 'facebook').toLowerCase();
            return `
              <div class="compare-pick-card ${isSel ? 'selected' : ''}" data-report-id="${escapeHtml(r.id)}">
                <input type="checkbox" ${isSel ? 'checked' : ''} style="pointer-events:none;" />
                <div style="overflow:hidden;">
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <span class="platform-badge platform-${escapeHtml(pf)}" style="font-size:10px; padding:1px 6px;">
                      ${escapeHtml(pf)}
                    </span>
                    <span style="font-size:11px; color:var(--text-muted);">${fmtNum(r.channel?.followers)} flw</span>
                  </div>
                  <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${escapeHtml(r.channel?.name)}
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>

    <!-- BẢNG MA TRẬN ĐỐI CHIẾU CHỈ SỐ ĐA KÊNH -->
    <div class="sl-section-block" style="margin-bottom:20px;">
      <div class="sl-section-bar">
        <div class="sl-section-bar-left">
          <span class="sl-bar-accent"></span>
          <h2 class="sl-section-bar-title">BẢNG ĐỐI CHIẾU CHỈ SỐ HIỆU SUẤT ĐA KÊNH (SIDE-BY-SIDE KPI MATRIX)</h2>
        </div>
      </div>

      <div class="sl-table-wrap">
        <table class="sl-table">
          <thead>
            <tr>
              <th style="min-width:190px;">Chỉ số đo lường</th>
              ${activeReports
                .map(
                  (r) => `
                <th class="num" style="min-width:170px;">
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
                    <span class="platform-badge platform-${escapeHtml((r.channel?.platform || 'facebook').toLowerCase())}">
                      ${escapeHtml((r.channel?.platform || 'facebook').toUpperCase())}
                    </span>
                    <span style="font-size:14px; font-weight:800; color:var(--text-main);">
                      ${escapeHtml(r.channel?.name)}
                    </span>
                  </div>
                </th>
              `
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Danh mục ngành hàng</strong></td>
              ${activeReports.map((r) => `<td class="num">${escapeHtml(r.channel?.category || 'N/A')}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Lượt theo dõi (Followers)</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.channel?.followers || 0);
                  const best = val === maxFollowers;
                  return `<td class="num" style="${best ? 'font-weight:800; color:var(--primary);' : ''}">${fmtNum(val)} ${best ? '👑' : ''}</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Tổng số Bài đăng trong kỳ</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.postsCount ?? r.posts?.length ?? 0);
                  const best = val === maxPosts;
                  return `<td class="num" style="${best ? 'font-weight:800; color:var(--primary);' : ''}">${fmtNum(val)} bài</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Tần suất đăng bài / ngày</strong></td>
              ${activeReports
                .map(
                  (r) =>
                    `<td class="num"><strong>${r.stats?.postingFrequency?.postsPerDay || 0}</strong> bài/ngày <span style="font-size:11px; color:var(--text-muted);">(${escapeHtml(r.stats?.postingFrequency?.level || '')})</span></td>`
                )
                .join('')}
            </tr>
            <tr>
              <td><strong>Số lượng Quảng cáo đang chạy</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.adsCount ?? r.ads?.length ?? 0);
                  const best = val === maxAds;
                  return `<td class="num" style="${best ? 'font-weight:800; color:var(--primary);' : ''}">${fmtNum(val)} ads</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Tổng Lượt xem (Total Views)</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.stats?.totals?.totalViews || 0);
                  const best = val === maxViews;
                  return `<td class="num" style="${best ? 'font-weight:800; color:#047857;' : ''}">${fmtNum(val)} ${best ? '🔥' : ''}</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Lượt xem Trung bình / Video</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.stats?.averages?.avgViews || 0);
                  const best = val === maxAvgViews;
                  return `<td class="num" style="${best ? 'font-weight:800; color:#047857;' : ''}">${fmtNum(val)}</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Tổng Tương tác (Reactions + Cmt + Share)</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.stats?.totals?.totalInteractions || 0);
                  const best = val === maxInteractions;
                  return `<td class="num" style="${best ? 'font-weight:800; color:var(--primary);' : ''}">${fmtNum(val)} ${best ? '⭐' : ''}</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Tương tác Trung bình / Bài</strong></td>
              ${activeReports
                .map((r) => {
                  const val = Number(r.stats?.averages?.avgInteractions || 0);
                  const best = val === maxAvgInteractions;
                  return `<td class="num" style="${best ? 'font-weight:800; color:var(--primary);' : ''}">${fmtNum(val)} / bài</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Reactions TB / Bình luận TB / Chia sẻ TB</strong></td>
              ${activeReports
                .map(
                  (r) =>
                    `<td class="num">${fmtNum(r.stats?.averages?.avgReactions)} 👍 · ${fmtNum(r.stats?.averages?.avgComments)} 💬 · ${fmtNum(r.stats?.averages?.avgShares)} ↗️</td>`
                )
                .join('')}
            </tr>
            <tr>
              <td><strong>Tỷ trọng Định dạng Reel/Video</strong></td>
              ${activeReports
                .map((r) => {
                  const reelPct =
                    r.stats?.contentDistribution?.find((d) =>
                      d.label.toLowerCase().includes('reel')
                    )?.percentage || 0;
                  return `<td class="num"><strong>${reelPct}%</strong> Video / ${100 - reelPct}% Ảnh</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td><strong>Tỷ trọng Video Ads (Paid Media)</strong></td>
              ${activeReports
                .map((r) => {
                  const vidAdPct =
                    r.stats?.adFormatDistribution?.find((d) =>
                      d.label.toLowerCase().includes('video')
                    )?.percentage || 0;
                  return `<td class="num"><strong>${vidAdPct}%</strong> Video Ads</td>`;
                })
                .join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- BIỂU ĐỒ TRỰC QUAN SO SÁNH PHỄU MARKETING (TOFU / MOFU / BOFU) & QUY MÔ LƯỢT XEM -->
    <div class="sl-summary-two-col" style="margin-bottom:20px;">
      <div class="sl-section-block">
        <div class="sl-section-bar">
          <div class="sl-section-bar-left">
            <span class="sl-bar-accent"></span>
            <h3 class="sl-section-bar-title">SO SÁNH CẤU TRÚC PHỄU MARKETING (TOFU – MOFU – BOFU)</h3>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">
          ${activeReports
            .map((r) => {
              const f = r.funnelSummary || {
                tofu: r.aiAnalysis?.marketingFunnel?.tofu?.count || 20,
                mofu: r.aiAnalysis?.marketingFunnel?.mofu?.count || 30,
                bofu: r.aiAnalysis?.marketingFunnel?.bofu?.count || 15,
              };
              const sum = Math.max(1, f.tofu + f.mofu + f.bofu);
              const pTofu = Math.round((f.tofu / sum) * 100);
              const pMofu = Math.round((f.mofu / sum) * 100);
              const pBofu = Math.max(0, 100 - pTofu - pMofu);

              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
                    <strong>${escapeHtml(r.channel?.name)} (${escapeHtml(r.channel?.platform.toUpperCase())})</strong>
                    <span style="color:var(--text-secondary);">ToFu: ${f.tofu} (${pTofu}%) · MoFu: ${f.mofu} (${pMofu}%) · BoFu: ${f.bofu} (${pBofu}%)</span>
                  </div>
                  <div class="compare-bar-track">
                    <div style="width:${pTofu}%; background:#6366f1;" title="ToFu ${pTofu}%"></div>
                    <div style="width:${pMofu}%; background:#10b981;" title="MoFu ${pMofu}%"></div>
                    <div style="width:${pBofu}%; background:#f59e0b;" title="BoFu ${pBofu}%"></div>
                  </div>
                </div>
              `;
            })
            .join('')}

          <div style="display:flex; gap:16px; font-size:12px; color:var(--text-secondary); padding-top:6px;">
            <span><span class="sl-legend-dot" style="background:#6366f1; display:inline-block; margin-right:5px;"></span>Đầu phễu (ToFu - Thu hút)</span>
            <span><span class="sl-legend-dot" style="background:#10b981; display:inline-block; margin-right:5px;"></span>Giữa phễu (MoFu - Nuôi dưỡng)</span>
            <span><span class="sl-legend-dot" style="background:#f59e0b; display:inline-block; margin-right:5px;"></span>Cuối phễu (BoFu - Chốt sale)</span>
          </div>
        </div>
      </div>

      <div class="sl-section-block">
        <div class="sl-section-bar">
          <div class="sl-section-bar-left">
            <span class="sl-bar-accent"></span>
            <h3 class="sl-section-bar-title">TƯƠNG QUAN TỔNG LƯỢT XEM &amp; TƯƠNG TÁC</h3>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">
          ${activeReports
            .map((r) => {
              const views = Number(r.stats?.totals?.totalViews || 0);
              const pctWidth = Math.max(6, Math.round((views / maxViews) * 100));
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
                    <strong>${escapeHtml(r.channel?.name)}</strong>
                    <span><strong>${fmtNum(views)}</strong> views · <strong>${fmtNum(r.stats?.totals?.totalInteractions)}</strong> tương tác</span>
                  </div>
                  <div class="compare-bar-track">
                    <div style="width:${pctWidth}%; background:linear-gradient(90deg, #4f46e5, #06b6d4);"></div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>

    <!-- KẾT QUẢ PHÂN TÍCH ĐỐI THỦ & ĐA KÊNH BẰNG GEMINI AI -->
    <div class="sl-section-block" id="aiCompareResultBox">
      <div class="sl-section-bar">
        <div class="sl-section-bar-left">
          <span class="sl-bar-accent"></span>
          <h2 class="sl-section-bar-title">BÁO CÁO PHÂN TÍCH CẠNH TRANH ĐA KÊNH (GEMINI AI COMPETITIVE BENCHMARK)</h2>
        </div>
      </div>
      <div id="aiCompareContentArea">
        <div style="padding:12px; color:var(--text-secondary);">Đang tổng hợp nhận định so sánh chiến lược giữa ${activeReports.length} kênh...</div>
      </div>
    </div>
  `;

  // Sự kiện chọn/bỏ chọn kênh trong bảng so sánh
  container.querySelectorAll('.compare-pick-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.reportId;
      callbacks.onToggleCompareId?.(id);
    });
  });

  // Sự kiện bấm nút chạy phân tích AI
  const runAiCompareBtn = container.querySelector('#runAiCompareBtn');
  const aiCompareContentArea = container.querySelector('#aiCompareContentArea');

  async function triggerAiComparison() {
    if (runAiCompareBtn) {
      runAiCompareBtn.disabled = true;
      runAiCompareBtn.textContent = '⏳ Đang phân tích đa kênh...';
    }
    try {
      let comparison = null;
      try {
        const res = await fetch('/api/compare/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportIds: activeIds }),
        });
        if (res.ok) {
          const data = await res.json();
          comparison = data.comparison;
        } else {
          throw new Error('Static fallback');
        }
      } catch {
        if (!window.__SOCIAL_LENS_STATIC_BUNDLE__) {
          const sRes = await fetch('data/reports-static.json');
          if (sRes.ok) window.__SOCIAL_LENS_STATIC_BUNDLE__ = await sRes.json();
        }
        comparison = window.__SOCIAL_LENS_STATIC_BUNDLE__?.defaultComparison || null;
      }

      if (comparison) {
        renderAiComparisonResult(aiCompareContentArea, comparison);
      }
    } catch (err) {
      aiCompareContentArea.innerHTML = `<div style="color:var(--danger);">Lỗi khi phân tích so sánh: ${escapeHtml(err.message)}</div>`;
    } finally {
      if (runAiCompareBtn) {
        runAiCompareBtn.disabled = false;
        runAiCompareBtn.textContent = '🤖 Chạy Phân Tích Cạnh Tranh bằng Gemini AI';
      }
    }
  }

  runAiCompareBtn?.addEventListener('click', triggerAiComparison);

  // Tự động chạy phân tích ngay khi mở tab So sánh
  triggerAiComparison();
}

function renderAiComparisonResult(targetEl, comp) {
  targetEl.innerHTML = `
    <div class="sl-formula-stack">
      <div class="sl-formula-card">
        <div class="sl-formula-name" style="margin-bottom:6px; color:var(--primary);">1. Nhận định Tổng quan Tương quan Đa kênh</div>
        <div class="sl-ai-prose">${escapeHtml(comp.executiveComparison || '')}</div>
      </div>

      <div class="sl-ideas-grid">
        ${(comp.channelRankings || [])
          .map(
            (rk) => `
          <div class="sl-idea-card">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span class="sl-idea-title">${escapeHtml(rk.channelName)}</span>
                <span class="sl-m-badge">Điểm sức mạnh: <strong>${rk.strengthScore}/100</strong></span>
              </div>
              <div style="font-size:12.5px; margin-bottom:6px;">
                <strong style="color:#047857;">✓ Lợi thế:</strong> ${escapeHtml(rk.keyAdvantage || '')}
              </div>
              <div style="font-size:12.5px;">
                <strong style="color:#b91c1c;">⚠ Điểm nghẽn:</strong> ${escapeHtml(rk.keyWeakness || '')}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="sl-summary-two-col">
        <div class="sl-formula-card">
          <div class="sl-formula-name" style="margin-bottom:6px; color:var(--primary);">2. Phân tích Khoảng trống Nội dung (Content Whitespace)</div>
          <div class="sl-ai-prose">${escapeHtml(comp.contentGapAnalysis || '')}</div>
        </div>
        <div class="sl-formula-card">
          <div class="sl-formula-name" style="margin-bottom:6px; color:var(--primary);">3. Đối chiếu Chiến lược Quảng cáo &amp; Phễu Chuyển đổi</div>
          <div class="sl-ai-prose">${escapeHtml(comp.adAndFunnelComparison || '')}</div>
        </div>
      </div>

      <div class="sl-formula-card" style="background:var(--primary-light); border-color:#c7d2fe;">
        <div class="sl-formula-name" style="margin-bottom:8px; color:var(--primary);">🚀 4. Khuyến nghị Hành động Chiến lược Đa kênh</div>
        <ul style="padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:13.2px;">
          ${(comp.actionableRecommendations || [])
            .map((rec) => `<li>${escapeHtml(rec)}</li>`)
            .join('')}
        </ul>
      </div>
    </div>
  `;
}

