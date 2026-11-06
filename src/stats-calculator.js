/**
 * Quantitative Statistics Calculator
 * Tính toán các bảng thống kê định lượng (Thứ, Ngày, Tháng, Quý, Năm),
 * Tổng tương tác, Tương tác trung bình, Phân bổ định dạng & Tần suất đăng.
 */

const DAY_NAMES_ORDER = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ nhật',
];

/**
 * Chuyển đổi Date sang tên Thứ tiếng Việt chuẩn trong báo cáo
 */
export function getVietnameseWeekday(dateObj) {
  const day = dateObj.getDay(); // 0 = CN, 1 = Thứ 2, ..., 6 = Thứ 7
  if (day === 0) return 'Chủ nhật';
  return `Thứ ${day + 1}`;
}

/**
 * Format Date sang DD/MM/YYYY
 */
export function formatDateDDMMYYYY(dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse chuỗi thời gian hoặc timestamp thành Date object
 */
export function parsePostDate(post) {
  if (post.isoDate) {
    const d = new Date(post.isoDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (post.dateStr) {
    // Hỗ trợ DD/MM/YYYY
    const parts = post.dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
      const [, dd, mm, yyyy] = parts;
      const timeMatch = (post.publishedAt || '').match(/(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch) {
        return new Date(`${yyyy}-${mm}-${dd}T${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}+07:00`);
      }
      return new Date(`${yyyy}-${mm}-${dd}T12:00:00+07:00`);
    }
  }
  if (post.publishedAt) {
    const parts = post.publishedAt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
      const [, dd, mm, yyyy] = parts;
      const timeMatch = post.publishedAt.match(/(\d{2}):(\d{2}):(\d{2})/);
      const timePart = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : '12:00:00';
      return new Date(`${yyyy}-${mm}-${dd}T${timePart}+07:00`);
    }
    const d = new Date(post.publishedAt);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Tính toán đầy đủ thống kê định lượng từ danh sách posts & ads
 */
export function calculateQuantitativeStats(posts = [], ads = [], dateRange = {}) {
  const byWeekdayMap = {};
  for (const name of DAY_NAMES_ORDER) {
    byWeekdayMap[name] = { label: name, posts: 0, views: 0, reactions: 0, comments: 0, shares: 0 };
  }

  const byDateMap = {};
  const byMonthMap = {};
  const byQuarterMap = {};
  const byYearMap = {};

  let totalReactions = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalViews = 0;
  let reelOrVideoCount = 0;
  let imageCount = 0;

  for (const post of posts) {
    const d = parsePostDate(post);
    const weekday = getVietnameseWeekday(d);
    const dateKey = formatDateDDMMYYYY(d);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monthKey = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const quarterKey = `Q${quarter}/${d.getFullYear()}`;
    const yearKey = `${d.getFullYear()}`;

    const views = Number(post.views || 0);
    const reactions = Number(post.reactions || 0);
    const comments = Number(post.comments || 0);
    const shares = Number(post.shares || 0);

    totalViews += views;
    totalReactions += reactions;
    totalComments += comments;
    totalShares += shares;

    const formatLower = (post.format || '').toLowerCase();
    if (formatLower.includes('reel') || formatLower.includes('video') || formatLower.includes('short')) {
      reelOrVideoCount++;
    } else {
      imageCount++;
    }

    // Weekday
    if (byWeekdayMap[weekday]) {
      byWeekdayMap[weekday].posts += 1;
      byWeekdayMap[weekday].views += views;
      byWeekdayMap[weekday].reactions += reactions;
      byWeekdayMap[weekday].comments += comments;
      byWeekdayMap[weekday].shares += shares;
    }

    // Date
    if (!byDateMap[dateKey]) {
      byDateMap[dateKey] = { label: dateKey, sortKey, posts: 0, views: 0, reactions: 0, comments: 0, shares: 0 };
    }
    byDateMap[dateKey].posts += 1;
    byDateMap[dateKey].views += views;
    byDateMap[dateKey].reactions += reactions;
    byDateMap[dateKey].comments += comments;
    byDateMap[dateKey].shares += shares;

    // Month
    if (!byMonthMap[monthKey]) {
      byMonthMap[monthKey] = { label: monthKey, posts: 0, views: 0, reactions: 0, comments: 0, shares: 0 };
    }
    byMonthMap[monthKey].posts += 1;
    byMonthMap[monthKey].views += views;
    byMonthMap[monthKey].reactions += reactions;
    byMonthMap[monthKey].comments += comments;
    byMonthMap[monthKey].shares += shares;

    // Quarter
    if (!byQuarterMap[quarterKey]) {
      byQuarterMap[quarterKey] = { label: quarterKey, posts: 0, views: 0, reactions: 0, comments: 0, shares: 0 };
    }
    byQuarterMap[quarterKey].posts += 1;
    byQuarterMap[quarterKey].views += views;
    byQuarterMap[quarterKey].reactions += reactions;
    byQuarterMap[quarterKey].comments += comments;
    byQuarterMap[quarterKey].shares += shares;

    // Year
    if (!byYearMap[yearKey]) {
      byYearMap[yearKey] = { label: yearKey, posts: 0, views: 0, reactions: 0, comments: 0, shares: 0 };
    }
    byYearMap[yearKey].posts += 1;
    byYearMap[yearKey].views += views;
    byYearMap[yearKey].reactions += reactions;
    byYearMap[yearKey].comments += comments;
    byYearMap[yearKey].shares += shares;
  }

  const totalPosts = posts.length || 1;
  const totalInteractions = totalReactions + totalComments + totalShares;
  const videoPostsCount = reelOrVideoCount || 1;

  // Days in range
  let activeDaysCount = Object.keys(byDateMap).length || 30;
  if (dateRange.from && dateRange.to) {
    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) activeDaysCount = diffDays;
  }

  const postsPerDay = parseFloat((posts.length / Math.max(1, activeDaysCount)).toFixed(2));
  let frequencyLevel = 'Thấp (0-1)';
  if (postsPerDay > 3) frequencyLevel = 'Cao (>3)';
  else if (postsPerDay >= 1) frequencyLevel = 'Trung bình (1-3)';

  // Content format distribution
  const reelPct = posts.length > 0 ? Math.round((reelOrVideoCount / posts.length) * 100) : 0;
  const imagePct = posts.length > 0 ? 100 - reelPct : 0;

  // Ad format & CTA distribution
  let adVideoCount = 0;
  let adImageCount = 0;
  const ctaCounts = {};
  for (const ad of ads) {
    const adType = (ad.format || 'VIDEO').toUpperCase();
    if (adType.includes('VIDEO')) adVideoCount++;
    else adImageCount++;

    const cta = ad.cta || 'Send message';
    ctaCounts[cta] = (ctaCounts[cta] || 0) + 1;
  }

  const totalAds = ads.length || 1;
  const adVideoPct = ads.length > 0 ? Math.round((adVideoCount / totalAds) * 100) : 0;
  const adImagePct = ads.length > 0 ? 100 - adVideoPct : 0;

  const ctaDistribution = Object.entries(ctaCounts).map(([label, count]) => ({
    label,
    count,
    percentage: Math.round((count / totalAds) * 100),
  }));

  if (ctaDistribution.length === 0) {
    ctaDistribution.push({ label: 'Send message', count: 0, percentage: 100 });
  }

  return {
    byWeekday: DAY_NAMES_ORDER.map((day) => byWeekdayMap[day]),
    byDate: Object.values(byDateMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey, ...rest }) => rest),
    byMonth: Object.values(byMonthMap),
    byQuarter: Object.values(byQuarterMap),
    byYear: Object.values(byYearMap),
    totals: {
      totalInteractions,
      totalReactions,
      totalComments,
      totalShares,
      totalViews,
    },
    averages: {
      avgInteractions: Math.round(totalInteractions / totalPosts),
      avgReactions: Math.round(totalReactions / totalPosts),
      avgComments: Math.round(totalComments / totalPosts),
      avgShares: Math.round(totalShares / totalPosts),
      avgViews: Math.round(totalViews / videoPostsCount),
    },
    contentDistribution: [
      { label: 'Reel', percentage: reelPct, color: '#1877F2' },
      { label: 'Ảnh', percentage: imagePct, color: '#60A5FA' },
    ],
    postingFrequency: {
      postsPerDay,
      level: frequencyLevel, // 'Thấp (0-1)' | 'Trung bình (1-3)' | 'Cao (>3)'
    },
    adFormatDistribution: [
      { label: 'Ảnh', percentage: adImagePct, color: '#1877F2' },
      { label: 'Video', percentage: adVideoPct, color: '#60A5FA' },
    ],
    ctaDistribution: ctaDistribution.map((item, idx) => ({
      ...item,
      color: idx === 0 ? '#1877F2' : idx === 1 ? '#60A5FA' : '#93C5FD',
    })),
  };
}

/**
 * Tính toán chỉ số trung bình của 1 tập hợp bài đăng (dùng cho Mục 05, 06, 07, 09)
 */
export function calculateSubsetMetrics(posts = [], postIndices = [], followers = 100000) {
  const indexSet = new Set(postIndices.map((idx) => Number(idx)));
  const matched = posts.filter((p) => indexSet.has(Number(p.index)));
  const count = matched.length;
  if (count === 0) {
    return {
      count: 0,
      avgReactions: 0,
      avgComments: 0,
      avgShares: 0,
      avgViews: 0,
      er: '0.00%',
    };
  }

  const sumReactions = matched.reduce((s, p) => s + Number(p.reactions || 0), 0);
  const sumComments = matched.reduce((s, p) => s + Number(p.comments || 0), 0);
  const sumShares = matched.reduce((s, p) => s + Number(p.shares || 0), 0);
  const sumViews = matched.reduce((s, p) => s + Number(p.views || 0), 0);

  const avgReactions = Math.round(sumReactions / count);
  const avgComments = Math.round(sumComments / count);
  const avgShares = Math.round(sumShares / count);
  const avgViews = Math.round(sumViews / count);

  const avgInteractions = (sumReactions + sumComments + sumShares) / count;
  const base = avgViews > 0 ? avgViews : Math.max(followers, 1);
  const erVal = ((avgInteractions / base) * 100).toFixed(2);

  return {
    count,
    avgReactions,
    avgComments,
    avgShares,
    avgViews,
    er: `${erVal}%`,
  };
}

/**
 * Format Date sang YYYY-MM-DD để so sánh khoảng ngày/tháng chính xác
 */
export function formatDateYYYYMMDD(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Lọc danh sách bài đăng và quảng cáo theo Ngày cụ thể, Khoảng ngày (dateFrom -> dateTo) hoặc Tháng (YYYY-MM)
 */
export function filterPostsAndAdsByDateRange(posts = [], ads = [], filter = {}) {
  const { dateFrom, dateTo, month } = filter;
  if (!dateFrom && !dateTo && !month) {
    return { filteredPosts: posts, filteredAds: ads };
  }

  const filteredPosts = posts.filter((post) => {
    const d = parsePostDate(post);
    const ymd = formatDateYYYYMMDD(d);
    const ym = ymd.slice(0, 7);
    if (month && month !== 'all' && ym !== month) return false;
    if (dateFrom && ymd < dateFrom) return false;
    if (dateTo && ymd > dateTo) return false;
    return true;
  });

  const filteredAds = ads.filter((ad) => {
    const rawStr = ad.publishedDate || ad.publishedLabel || '';
    const matchDMY = rawStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    let ymd = '';
    if (matchDMY) {
      ymd = `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(rawStr)) {
      ymd = rawStr.slice(0, 10);
    }
    if (!ymd) return true;
    const ym = ymd.slice(0, 7);
    if (month && month !== 'all' && ym !== month) return false;
    if (dateFrom && ymd < dateFrom) return false;
    if (dateTo && ymd > dateTo) return false;
    return true;
  });

  return { filteredPosts, filteredAds };
}

/**
 * Bóc tách & Phân tích chuyên sâu từng Bài viết:
 * - Câu Hook mở đầu (Caption & 3 giây đầu Video SRT) + Kỹ thuật Hook + Điểm Hook
 * - Phong cách Content, Công thức viết (AIDA/PAS/Storytelling/POV), Từ khóa cảm xúc/USP
 * - Đánh giá hiệu quả (Performance Score 0-100, Xếp hạng Viral/Cao/Ổn định/Cần tối ưu, % so với TB kênh)
 * - Nhận xét chi tiết & Gợi ý tối ưu câu Hook / CTA
 */
export function analyzeSinglePostContent(post = {}, averages = {}, followers = 100000) {
  const caption = String(post.caption || '').trim();
  const transcript = String(post.transcript || '').trim();
  const combinedLower = `${caption} ${transcript}`.toLowerCase();
  const isVideo =
    String(post.format || '').toLowerCase().includes('reel') ||
    String(post.format || '').toLowerCase().includes('video');

  // 1. Trích xuất câu Hook mở đầu từ Caption
  const captionLines = caption
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const firstCaptionLine = captionLines[0] || 'Chưa có tiêu đề mở đầu';
  const hookSentence =
    firstCaptionLine.length > 140 ? `${firstCaptionLine.slice(0, 140)}...` : firstCaptionLine;

  // 2. Trích xuất câu Hook 3-5 giây đầu từ Lời thoại Video (SRT)
  let videoHookSpoken = '';
  if (transcript) {
    const srtLines = transcript
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^\d+$/.test(l) && !l.includes('-->'));
    videoHookSpoken = srtLines.slice(0, 2).join(' ');
  }

  // 3. Phân loại kỹ thuật Hook (Hook Technique)
  let hookType = 'Nêu vấn đề & Insight trực diện (Insight Hook)';
  let hookMechanism =
    'Đi thẳng vào nhu cầu thực tế hoặc bối cảnh sử dụng sản phẩm khiến khách hàng mục tiêu thấy hình ảnh của mình ngay lập tức.';

  if (
    hookSentence.includes('?') ||
    videoHookSpoken.includes('?') ||
    /ai bảo|thật sự|sao phải|nếu như|có mom nào/.test(combinedLower)
  ) {
    hookType = 'Câu hỏi phản biện / Thách thức định kiến (Myth-Buster Hook)';
    hookMechanism =
      'Đặt câu hỏi ngược lại thói quen cũ (VD: bầu là phải mặc rộng thùng thình?) để kích thích sự tò mò và giữ chân người xem trong 3 giây đầu.';
  } else if (
    /mega live|sale|đồng giá|99k|199k|49k|xả kho|deal|quà tặng|up to 50%/.test(combinedLower)
  ) {
    hookType = 'Tung ưu đãi & Sự kiện giới hạn (FOMO / Deal Hook)';
    hookMechanism =
      'Đánh trực diện vào tâm lý sợ bỏ lỡ (FOMO) bằng con số giá hời (99K/199K, 50%) và thời gian diễn ra sự kiện cụ thể.';
  } else if (/pov:|checkfit|lên đồ|1 ngày|trước khi đi làm/.test(combinedLower)) {
    hookType = 'Đặt tình huống góc nhìn cá nhân (POV / Relatable Lifestyle Hook)';
    hookMechanism =
      'Tạo cảm giác tự nhiên như một vlog đời thường, giúp người xem dễ dàng tưởng tượng bản thân khi diện sản phẩm.';
  } else if (/review trực tiếp|cận cảnh|siêu phẩm|lên sóng|mới nhất/.test(combinedLower)) {
    hookType = 'Trực diện siêu phẩm & Bằng chứng thị giác (Visual Showcase Hook)';
    hookMechanism =
      'Show ngay vẻ đẹp phom dáng và chất liệu sản phẩm best-seller ngay khung hình đầu để thu hút thị giác.';
  } else if (/bố mẹ|con yêu|ngủ say|thanh xuân|mong sao|tâm sự/.test(combinedLower)) {
    hookType = 'Chạm cảm xúc & Đồng cảm sâu sắc (Emotional Storytelling Hook)';
    hookMechanism =
      'Mở đầu bằng lời tâm sự hoặc khoảnh khắc gia đình lắng đọng, kích thích sự đồng cảm và hành động Chia sẻ (Share).';
  }

  // 4. Phân loại Phong cách Content & Công thức Viết (Copywriting Formula)
  let copyFormula = 'AIDA (Attention - Interest - Desire - Action)';
  let contentStyle = 'Trưng bày tính năng & Tư vấn giải pháp (Consultative Showcase)';
  let contentPillar = 'Giới thiệu & Trưng bày sản phẩm';
  let funnelStage = 'MoFu (Giữa phễu - Nuôi dưỡng niềm tin)';

  if (/mega live|sale|đồng giá|xả kho|deal|ưu đãi|tặng/.test(combinedLower)) {
    contentPillar = 'Chiến dịch & Khuyến mãi';
    contentStyle = 'Kích cầu trực diện & Thúc đẩy hành động nhanh (High-Urgency Promo)';
    funnelStage = 'BoFu (Cuối phễu - Chốt đơn)';
    copyFormula = 'AIDA + Scarcity (Khan hiếm & Kêu gọi hành động)';
  } else if (/bố mẹ|con ngủ|mốc khám thai|minigame|khoảnh khắc|tâm sự/.test(combinedLower)) {
    contentPillar = 'Chia sẻ & Xây dựng cộng đồng';
    contentStyle = 'Tự sự giàu cảm xúc & Gắn kết cộng đồng (Empathetic Community)';
    funnelStage = 'ToFu (Đầu phễu - Thu hút & Lan tỏa)';
    copyFormula = 'Storytelling (Kể chuyện chạm cảm xúc)';
  } else if (
    /sợ lùn|dìm dáng|thùng thình|bí bách|nhăn nhàu|phí lắm|kéo căng|lạnh thật/.test(combinedLower)
  ) {
    copyFormula = 'PAS (Problem - Agitate - Solution)';
    contentStyle = 'Xoáy nỗi đau & Giải pháp thực tế (Pain-Point Solver)';
    funnelStage = 'MoFu (Giữa phễu - Thuyết phục)';
  } else if (/pov:|checkfit/.test(combinedLower)) {
    copyFormula = 'POV / Before-After-Bridge';
    contentStyle = 'Bắt trend trẻ trung & Gợi ý phối đồ (OOTD / Lifestyle)';
    funnelStage = 'ToFu (Đầu phễu - Thu hút)';
  }

  // 5. Trích xuất Từ khóa đắt giá (Sensory & Power Keywords)
  const powerDictionary = [
    'mát tay',
    'không thùng thình',
    'mềm mịn',
    'không lo bí bách',
    'co giãn 4 chiều',
    'khóa ti ẩn',
    'chỉnh size',
    'không nhăn nhàu',
    'che bụng',
    'hack dáng',
    'đồng giá 99k',
    'mega live',
    'freeship',
    'tặng túi tote',
    'mặc từ bầu tới sau sinh',
    'nâng đỡ bụng',
    'không dặm ngứa',
    'giữ nhiệt',
  ];
  const matchedKeywords = powerDictionary.filter((kw) => combinedLower.includes(kw));
  if (matchedKeywords.length === 0) {
    matchedKeywords.push('thoải mái', 'thanh lịch', 'tôn dáng');
  }

  // 6. Phân tích Call To Action (CTA)
  let ctaType = 'Điều hướng Inbox / Tư vấn size';
  let ctaEvaluation = 'Kêu gọi nhắn tin hoặc bấm link nhận tư vấn cá nhân hóa theo nhu cầu.';
  if (/comment|chấm|\(\.\)|31\/10/.test(combinedLower)) {
    ctaType = 'Kích thích Bình luận từ khóa (Comment Trigger)';
    ctaEvaluation =
      'Rất hiệu quả để tăng chỉ số Bình luận tự nhiên và kích hoạt kịch bản gửi tin nhắn tự động.';
  } else if (/ghé store|cửa hàng|hệ thống/.test(combinedLower)) {
    ctaType = 'Điều hướng ghé Cửa hàng (Offline Store CTA)';
    ctaEvaluation =
      'Phù hợp kéo khách tới điểm bán nhưng cần bổ sung thêm lựa chọn đặt online cho khách ở xa.';
  } else if (/lưu lại|chia sẻ/.test(combinedLower)) {
    ctaType = 'Kêu gọi Lưu & Chia sẻ (Save/Share CTA)';
    ctaEvaluation = 'Tối ưu tốt cho mục tiêu lan tỏa tự nhiên (Organic Reach) ở đầu phễu.';
  }

  // 7. Tính toán Điểm Hiệu Quả (Performance Score 0 - 100) & So sánh với Trung bình Kênh
  const avgViews = Math.max(1, Number(averages.avgViews || 15000));
  const avgInteractions = Math.max(1, Number(averages.avgInteractions || 40));

  const postViews = Number(post.views || 0);
  const postInteractions =
    Number(post.reactions || 0) + Number(post.comments || 0) + Number(post.shares || 0);

  const interactionRatio = postInteractions / avgInteractions;
  const viewsRatio = isVideo && postViews > 0 ? postViews / avgViews : interactionRatio;

  const compositeRatio = isVideo ? viewsRatio * 0.45 + interactionRatio * 0.55 : interactionRatio;
  const rawScore = Math.round(Math.min(99, Math.max(28, 52 + (compositeRatio - 1) * 26)));

  let tier = 'Ổn định (Standard)';
  let tierClass = 'standard';
  if (rawScore >= 85 || compositeRatio >= 2.2) {
    tier = 'Bùng nổ (Viral Win)';
    tierClass = 'viral';
  } else if (rawScore >= 70 || compositeRatio >= 1.25) {
    tier = 'Hiệu quả cao (High Performer)';
    tierClass = 'high';
  } else if (rawScore < 48 && compositeRatio < 0.65) {
    tier = 'Cần tối ưu (Underperforming)';
    tierClass = 'low';
  }

  const vsAvgInteractionsPct = Math.round((interactionRatio - 1) * 100);
  const vsAvgViewsPct = isVideo && postViews > 0 ? Math.round((viewsRatio - 1) * 100) : null;

  const baseForEr = isVideo && postViews > 0 ? postViews : Math.max(1, followers);
  const erVal = ((postInteractions / baseForEr) * 100).toFixed(2);

  const hookScore = Math.min(9.8, Math.max(5.5, Number((rawScore / 10).toFixed(1))));

  // 8. Nhận định hiệu quả & Đề xuất tối ưu cụ thể cho bài viết
  let verdict = '';
  let optimizationTip = '';
  let rewrittenHook = '';

  if (tierClass === 'viral' || tierClass === 'high') {
    verdict = `Bài viết đạt hiệu suất vượt trội (Tương tác ${vsAvgInteractionsPct >= 0 ? `+${vsAvgInteractionsPct}%` : `${vsAvgInteractionsPct}%`} so với TB kênh${vsAvgViewsPct !== null ? `, Lượt xem ${vsAvgViewsPct >= 0 ? `+${vsAvgViewsPct}%` : `${vsAvgViewsPct}%`}` : ''}). Sự kết hợp giữa kỹ thuật "${hookType}" và công thức "${copyFormula}" đánh trúng tâm lý khách hàng mục tiêu.`;
    optimizationTip =
      'Nên nhân bản (Scale) kịch bản này thành 2-3 biến thể góc quay khác nhau và đưa vào danh sách bài chạy Quảng cáo chuyển đổi (Winning Creative).';
    rewrittenHook = `🔥 [Biến thể A/B Test để chạy Ads]: "90% các mẹ bầu đều mắc sai lầm này khi chọn đồ — cho tới khi thử thiết kế 2-trong-1 này!"`;
  } else if (tierClass === 'standard') {
    verdict = `Bài viết duy trì mức tương tác ổn định, truyền tải đầy đủ thông điệp sản phẩm theo công thức "${copyFormula}" nhưng câu Hook mở đầu chưa tạo được độ đột phá để bứt tốc viral.`;
    optimizationTip =
      'Cần đẩy mạnh sự tương phản (Before/After) ngay trong 3 giây đầu tiên và bổ sung câu hỏi kích thích bình luận cụ thể (VD: "Mom thích màu Be hay màu Đen hơn?").';
    rewrittenHook = `✨ [Gợi ý nâng cấp Hook]: "Bầu 7 tháng mặc sao để đi làm cả ngày không tức bụng mà nhìn như chưa bầu?"`;
  } else {
    verdict = `Hiệu suất bài viết thấp hơn mức trung bình toàn kênh (${vsAvgInteractionsPct}% tương tác). Nguyên nhân chính do cách trình bày còn mang tính thông báo một chiều hoặc thiếu yếu tố kích thích thảo luận hai chiều.`;
    optimizationTip =
      'Chuyển từ dạng giới thiệu thông tin thuần túy sang kịch bản POV/Problem-Solution có người mẫu trải nghiệm thực tế và gắn CTA ưu đãi/quà tặng khi bình luận.';
    rewrittenHook = `💡 [Gợi ý viết lại Hook]: "Đừng vội sắm đồ mới nếu Mom chưa biết bí quyết mặc đẹp từ tháng thứ 3 tới tận sau sinh này!"`;
  }

  return {
    hookSentence,
    videoHookSpoken,
    hookType,
    hookMechanism,
    hookScore,
    contentStyle,
    copyFormula,
    contentPillar,
    funnelStage,
    matchedKeywords,
    ctaType,
    ctaEvaluation,
    score: rawScore,
    tier,
    tierClass,
    vsAvgInteractionsPct,
    vsAvgViewsPct,
    er: `${erVal}%`,
    verdict,
    optimizationTip,
    rewrittenHook,
  };
}


