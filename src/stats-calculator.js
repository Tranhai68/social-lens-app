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
 * Bóc tách, Phân loại Đa tầng & Đánh giá "NỘI DUNG WIN" (Winning Content Engine) cho từng Bài viết
 * Hỗ trợ chuyên sâu cho mọi nền tảng: Facebook, TikTok, Instagram, Threads, YouTube, Shopee Video
 */
export function analyzeSinglePostContent(
  post = {},
  averages = {},
  followers = 100000,
  platform = 'facebook'
) {
  const pf = String(platform || post.platform || 'facebook').toLowerCase();
  const caption = String(post.caption || '').trim();
  const transcript = String(post.transcript || '').trim();
  const combinedLower = `${caption} ${transcript}`.toLowerCase();
  const formatLower = String(post.format || '').toLowerCase();
  const isVideo =
    formatLower.includes('reel') ||
    formatLower.includes('video') ||
    formatLower.includes('short') ||
    pf === 'tiktok' ||
    pf === 'youtube' ||
    pf === 'shopee';

  // 1. Trích xuất câu Hook mở đầu từ Caption / Thread
  const captionLines = caption
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const firstCaptionLine = captionLines[0] || 'Chưa có tiêu đề mở đầu';
  const hookSentence =
    firstCaptionLine.length > 150 ? `${firstCaptionLine.slice(0, 150)}...` : firstCaptionLine;

  // 2. Trích xuất câu Hook 3-5 giây đầu từ Lời thoại Video (SRT)
  let videoHookSpoken = '';
  let videoBodySpoken = '';
  let videoCtaSpoken = '';
  if (transcript) {
    const srtLines = transcript
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^\d+$/.test(l) && !l.includes('-->'));
    videoHookSpoken = srtLines.slice(0, 2).join(' ');
    videoBodySpoken = srtLines.slice(2, Math.max(3, srtLines.length - 2)).join(' ');
    videoCtaSpoken = srtLines.slice(-2).join(' ');
  }

  // 3. Phân loại Kỹ thuật Hook (Hook Technique) theo đặc thù đa nền tảng
  let hookType = 'Nêu vấn đề & Insight trực diện (Insight Hook)';
  let hookMechanism =
    'Đi thẳng vào nhu cầu thực tế hoặc bối cảnh sử dụng sản phẩm khiến khách hàng mục tiêu thấy hình ảnh của mình ngay lập tức.';

  if (
    hookSentence.includes('?') ||
    videoHookSpoken.includes('?') ||
    /ai bảo|thật sự|sao phải|nếu như|có mom nào|góc hỏi thật|chị nào/.test(combinedLower)
  ) {
    hookType =
      pf === 'threads'
        ? 'Câu hỏi Khơi gợi Thảo luận 2 chiều (Conversational Thread Hook)'
        : 'Câu hỏi Phản biện / Thách thức định kiến (Myth-Buster Hook)';
    hookMechanism =
      pf === 'threads'
        ? 'Đặt câu hỏi đời thường mở để kích thích cộng đồng trên Threads vào Reply chia sẻ trải nghiệm cá nhân, đẩy thuật toán đề xuất.'
        : 'Đặt câu hỏi ngược lại định kiến cũ (VD: bầu là phải mặc rộng thùng thình?) để kích thích tò mò và giữ chân người xem qua 3 giây đầu.';
  } else if (
    /mega live|sale|đồng giá|99k|199k|129k|49k|xả kho|deal|quà tặng|up to 50%|voucher|giỏ hàng/.test(
      combinedLower
    )
  ) {
    hookType =
      pf === 'tiktok' || pf === 'shopee'
        ? 'Hook Săn Deal Giỏ Hàng & Voucher Sàn (Social Commerce Hook)'
        : 'Tung ưu đãi & Sự kiện giới hạn (FOMO / Deal Hook)';
    hookMechanism =
      'Đánh trực diện vào tâm lý sợ bỏ lỡ (FOMO) bằng mức giá hời, mã giảm giá trực tiếp trên giỏ hàng hoặc khung giờ Livestream độc quyền.';
  } else if (/pov:|checkfit|ootd|lên đồ|1 ngày|trước khi đi làm|biến hình/.test(combinedLower)) {
    hookType = 'Đặt tình huống góc nhìn cá nhân (POV / OOTD Checkfit Hook)';
    hookMechanism =
      'Tạo cảm giác tự nhiên như video đời thường trên TikTok/Reels, giúp người xem dễ dàng hình dung bản thân khi diện sản phẩm.';
  } else if (
    /test độ co giãn|kiểm chứng|cận cảnh|zoom cận|xưởng|may đo|chỉnh sửa số đo/.test(combinedLower)
  ) {
    hookType = 'Kiểm chứng Chất liệu & Hậu trường Thực tế (Proof / BTS Hook)';
    hookMechanism =
      'Show bằng chứng thị giác trực tiếp (test co giãn, cận vải, xưởng may chỉnh size) giúp xóa bỏ hoàn toàn rào cản sợ mua hàng online.';
  } else if (/review trực tiếp|siêu phẩm|lên sóng|mới nhất|lookbook|bst/.test(combinedLower)) {
    hookType = 'Trực diện Siêu phẩm & Thẩm mỹ Thị giác (Visual Lookbook Hook)';
    hookMechanism =
      'Show ngay vẻ đẹp phom dáng và thần thái người mẫu trong 3 giây đầu để giữ chân tệp khách hàng yêu cái đẹp trên IG/TikTok/FB.';
  } else if (/bố mẹ|con yêu|ngủ say|thanh xuân|mong sao|tâm sự|hồi chưa bầu/.test(combinedLower)) {
    hookType = 'Chạm cảm xúc & Đồng cảm sâu sắc (Emotional / Relatable Hook)';
    hookMechanism =
      'Mở đầu bằng lời tâm sự hoặc câu chuyện đồng cảm, kích thích mạnh hành động Chia sẻ (Share / Repost) và Lưu bài (Save).';
  }

  // 4. Phân loại Đa tầng: Tuyến nội dung (Pillar), Góc tiếp cận (Angle), Công thức (Formula) & Tầng phễu (Funnel)
  let copyFormula = 'AIDA (Attention - Interest - Desire - Action)';
  let contentStyle = 'Trưng bày tính năng & Tư vấn giải pháp (Consultative Showcase)';
  let contentPillar = 'Giới thiệu & Trưng bày sản phẩm';
  let contentAngle = 'Tôn dáng & Chất liệu cao cấp';
  let funnelStage = 'MoFu (Giữa phễu - Nuôi dưỡng niềm tin)';

  if (
    /mega live|sale|đồng giá|xả kho|deal|ưu đãi|voucher|giỏ hàng cam|giỏ hàng góc trái/.test(
      combinedLower
    )
  ) {
    contentPillar = 'Chiến dịch & Khuyến mãi';
    contentStyle = 'Kích cầu trực diện & Chốt đơn nhanh (High-Urgency Social Commerce)';
    contentAngle = 'Ưu đãi giá hời & Quà tặng giới hạn';
    funnelStage = 'BoFu (Cuối phễu - Chốt đơn)';
    copyFormula = 'AIDA + Scarcity (Khan hiếm & Kêu gọi hành động)';
  } else if (
    /bố mẹ|con ngủ|mốc khám thai|minigame|khoảnh khắc|tâm sự|góc hỏi thật|có mom nào/.test(
      combinedLower
    )
  ) {
    contentPillar = 'Chia sẻ & Xây dựng cộng đồng';
    contentStyle =
      pf === 'threads'
        ? 'Thảo luận mở & Kết nối cộng đồng (Conversational Thread)'
        : 'Tự sự giàu cảm xúc & Gắn kết cộng đồng (Empathetic Community)';
    contentAngle = 'Đồng cảm tâm lý & Kiến thức hữu ích';
    funnelStage = 'ToFu (Đầu phễu - Thu hút & Lan tỏa)';
    copyFormula =
      pf === 'threads'
        ? 'Hook Câu hỏi -> Chia sẻ góc nhìn -> Kêu gọi Reply thảo luận'
        : 'Storytelling (Kể chuyện chạm cảm xúc)';
  } else if (
    /sợ lùn|dìm dáng|thùng thình|bí bách|nhăn nhàu|phí lắm|kéo căng|lộ bụng|tăng cân/.test(
      combinedLower
    )
  ) {
    copyFormula = 'PAS (Problem - Agitate - Solution)';
    contentStyle = 'Xoáy nỗi đau & Giải pháp thực tế (Pain-Point Solver)';
    contentPillar = 'Giải quyết Nỗi đau & Kiểm chứng Sản phẩm';
    contentAngle = 'Giấu bụng, Hack dáng & Mặc bền 2-trong-1';
    funnelStage = 'MoFu (Giữa phễu - Thuyết phục)';
  } else if (/pov:|checkfit|ootd|phối đồ|3 phong cách/.test(combinedLower)) {
    copyFormula = 'POV / Before-After-Bridge';
    contentStyle = 'Bắt trend trẻ trung & Gợi ý phối đồ (OOTD / Lifestyle)';
    contentPillar = 'POV Phối đồ & Phong cách sống (OOTD)';
    contentAngle = 'Ứng dụng đa hoàn cảnh (Đi làm - Đi chơi - Đi tiệc)';
    funnelStage = 'ToFu (Đầu phễu - Thu hút)';
  } else if (/feedback|lời khen|xưởng|chỉnh sửa theo số đo|test độ co giãn/.test(combinedLower)) {
    copyFormula = 'Social Proof / Behind-The-Scenes';
    contentStyle = 'Chứng thực khách hàng & Hậu trường uy tín (Trust Builder)';
    contentPillar = 'Chứng thực (Social Proof) & Hậu trường';
    contentAngle = 'Bảo chứng chất lượng thực tế & Dịch vụ may đo';
    funnelStage = 'MoFu (Giữa phễu - Củng cố niềm tin)';
  }

  // 5. Trích xuất Từ khóa đắt giá (Sensory & Power Keywords)
  const powerDictionary = [
    'mát tay',
    'không thùng thình',
    'mềm mịn',
    'không lo bí bách',
    'co giãn 4 chiều',
    'khóa ti ẩn',
    'khóa mở ngực ẩn',
    'chỉnh size',
    'chỉnh sửa theo số đo',
    'không nhăn nhàu',
    'che khuyết điểm',
    'giấu bụng',
    'hack dáng',
    'đồng giá 99k',
    'mega live',
    'freeship',
    'giỏ hàng góc trái',
    'voucher 25%',
    'mặc từ bầu tới sau sinh',
    'nâng đỡ bụng',
    'không dặm ngứa',
    'lụa hàn',
    'voan tơ',
    'đũi cotton',
  ];
  const matchedKeywords = powerDictionary.filter((kw) => combinedLower.includes(kw));
  if (matchedKeywords.length === 0) {
    matchedKeywords.push('thoải mái', 'thanh lịch', 'tôn dáng');
  }

  // 6. Phân tích Call To Action (CTA) theo từng nền tảng
  let ctaType = 'Điều hướng Inbox / Tư vấn size';
  let ctaEvaluation = 'Kêu gọi nhắn tin hoặc bấm link nhận tư vấn cá nhân hóa theo nhu cầu.';
  if (/giỏ hàng|góc trái|áp mã|voucher|mua ngay/.test(combinedLower)) {
    ctaType = 'Điều hướng Bấm Giỏ Hàng / Áp Voucher (Shop Cart CTA)';
    ctaEvaluation =
      'Tối ưu chuyển đổi trực tiếp (Direct GMV) trên TikTok Shop & Shopee Video ngay khi khách đang hứng thú.';
  } else if (/comment|chấm|\(\.\)|31\/10|megau/.test(combinedLower)) {
    ctaType = 'Kích thích Bình luận từ khóa (Comment Trigger)';
    ctaEvaluation =
      'Rất hiệu quả để tăng chỉ số Bình luận tự nhiên, đẩy tương tác bài viết và kích hoạt kịch bản gửi tin nhắn tự động.';
  } else if (pf === 'threads' || /thích mặc|ý kiến|chia sẻ|hỏi thật/.test(combinedLower)) {
    ctaType = 'Khơi gợi Trả lời / Thảo luận 2 chiều (Reply & Repost CTA)';
    ctaEvaluation =
      'Đánh trúng thuật toán ưu tiên chuỗi hội thoại (Thread Replies) trên Threads & Instagram.';
  } else if (/ghé store|cửa hàng|showroom|hệ thống/.test(combinedLower)) {
    ctaType = 'Điều hướng ghé Cửa hàng / Showroom (Offline Foot-Traffic CTA)';
    ctaEvaluation = 'Kéo khách ghé trải nghiệm trực tiếp tại showroom vật lý.';
  }

  // 7. Tính toán Điểm Hiệu Quả (Performance Score 0 - 100) & Đánh giá NỘI DUNG WIN
  const avgViews = Math.max(1, Number(averages.avgViews || 15000));
  const avgInteractions = Math.max(1, Number(averages.avgInteractions || 45));
  const avgComments = Math.max(1, Number(averages.avgComments || 12));
  const avgShares = Math.max(1, Number(averages.avgShares || 3));

  const postViews = Number(post.views || 0);
  const postReactions = Number(post.reactions || 0);
  const postComments = Number(post.comments || 0);
  const postShares = Number(post.shares || 0);
  const postInteractions = postReactions + postComments + postShares;

  const interactionRatio = postInteractions / avgInteractions;
  const viewsRatio = isVideo && postViews > 0 ? postViews / avgViews : interactionRatio;
  const commentsRatio = postComments / avgComments;
  const sharesRatio = postShares / avgShares;

  const viewsMultiplier = Number(viewsRatio.toFixed(2));
  const interactionsMultiplier = Number(interactionRatio.toFixed(2));
  const commentsMultiplier = Number(commentsRatio.toFixed(2));
  const sharesMultiplier = Number(sharesRatio.toFixed(2));

  const compositeRatio = isVideo
    ? viewsRatio * 0.4 + interactionRatio * 0.4 + Math.max(commentsRatio, sharesRatio) * 0.2
    : interactionRatio * 0.65 + Math.max(commentsRatio, sharesRatio) * 0.35;

  const rawScore = Math.round(Math.min(99, Math.max(28, 54 + (compositeRatio - 1) * 25)));

  // Xác định bài viết có phải là NỘI DUNG WIN hay không
  const isWin =
    rawScore >= 72 ||
    viewsRatio >= 1.35 ||
    interactionRatio >= 1.35 ||
    commentsRatio >= 1.65 ||
    sharesRatio >= 2.0;

  let tier = '⚡ Đạt chuẩn (Standard)';
  let tierClass = 'standard';
  let winBadgeLabel = 'ĐẠT CHUẨN';
  if (rawScore >= 84 || compositeRatio >= 1.95) {
    tier = '🏆 SUPER WIN (Top Viral & Chuyển đổi)';
    tierClass = 'viral';
    winBadgeLabel = '🏆 SUPER WIN';
  } else if (isWin) {
    tier = '🔥 CONTENT WIN (Nội dung Thắng)';
    tierClass = 'high';
    winBadgeLabel = '🔥 CONTENT WIN';
  } else if (rawScore < 48 && compositeRatio < 0.65) {
    tier = '⚠️ Cần tối ưu (Underperforming)';
    tierClass = 'low';
    winBadgeLabel = 'CẦN TỐI ƯU';
  }

  // Xác định Mục tiêu Chiến thắng chính của bài viết (Win Goal / Primary Win Driver)
  let winGoal = 'Duy trì nhận diện ổn định';
  const winDrivers = [];
  if (viewsRatio >= 1.3) {
    winDrivers.push(`Lượt xem gấp ${viewsMultiplier}x TB kênh`);
  }
  if (commentsRatio >= 1.4) {
    winDrivers.push(`Bình luận hỏi mua gấp ${commentsMultiplier}x TB kênh`);
  }
  if (sharesRatio >= 1.5) {
    winDrivers.push(`Chia sẻ/Lan tỏa gấp ${sharesMultiplier}x TB kênh`);
  }
  if (interactionRatio >= 1.3 && winDrivers.length === 0) {
    winDrivers.push(`Tổng tương tác gấp ${interactionsMultiplier}x TB kênh`);
  }

  if (commentsRatio >= 1.5 && commentsRatio >= viewsRatio) {
    winGoal = '💰 WIN CHUYỂN ĐỔI & HỎI MUA (High-Conversion Win)';
  } else if (sharesRatio >= 1.8 && sharesRatio >= viewsRatio) {
    winGoal = '🔁 WIN LAN TỎA & THẢO LUẬN CỘNG ĐỒNG (Viral Share Win)';
  } else if (viewsRatio >= 1.35 || interactionRatio >= 1.35) {
    winGoal = '🔥 WIN TIẾP CẬN & THU HÚT KHÁCH MỚI (Viral Reach Win)';
  } else if (isWin) {
    winGoal = '✅ WIN TƯƠNG TÁC TỔNG HỢP (Balanced Engagement Win)';
  }

  const vsAvgInteractionsPct = Math.round((interactionRatio - 1) * 100);
  const vsAvgViewsPct = isVideo && postViews > 0 ? Math.round((viewsRatio - 1) * 100) : null;

  const baseForEr = isVideo && postViews > 0 ? postViews : Math.max(1, followers);
  const erVal = ((postInteractions / baseForEr) * 100).toFixed(2);
  const hookScore = Math.min(9.9, Math.max(5.5, Number((rawScore / 10).toFixed(1))));

  // 8. Giải mã DNA Bài WIN (Why It Won) & Hướng dẫn Nhân bản / Vít Ads (Replication Formula)
  let verdict = '';
  let whyItWon = '';
  let optimizationTip = '';
  let rewrittenHook = '';

  if (isWin) {
    verdict = `[${winBadgeLabel}] Bài đăng thắng lớn với mục tiêu "${winGoal}" (${winDrivers.join(' · ') || `Tương tác +${vsAvgInteractionsPct}% so với TB`}).`;
    whyItWon = `Bài viết thắng nhờ sự kết hợp giữa kỹ thuật mở đầu "${hookType}" (Điểm Hook ${hookScore}/10) và kịch bản "${copyFormula}" xoáy đúng góc tiếp cận "${contentAngle}". Từ khóa kích hoạt ("${matchedKeywords.slice(0, 3).join('", "')}") đi kèm CTA "${ctaType}" giúp giữ chân người xem và thúc đẩy hành động ngay lập tức.`;
    optimizationTip =
      pf === 'tiktok' || pf === 'shopee'
        ? 'Đưa ngay video WIN này vào chiến dịch GMV Max / Quảng cáo Giỏ hàng, đồng thời quay thêm 3 biến thể đổi câu Hook 3 giây đầu nhưng giữ nguyên cấu trúc thân bài.'
        : pf === 'threads'
          ? 'Ghim (Pin) bài Thread WIN này lên đầu trang cá nhân và trả lời bình luận bằng ảnh/video thực tế của sản phẩm để chuyển đổi người đọc thành khách mua.'
          : 'Nhân bản (Scale) cấu trúc bài WIN này cho các mã sản phẩm mới và chuyển thẳng sang chạy Quảng cáo Chuyển đổi (Winning Ad Creative).';
    rewrittenHook = `🔥 [Công thức Nhân bản Bài WIN]: Giữ nguyên cấu trúc ${copyFormula} + Đổi Hook 3s đầu: "90% khách hàng đều bất ngờ khi thử giải pháp ${contentAngle.toLowerCase()} này!"`;
  } else if (tierClass === 'standard') {
    verdict = `Bài viết đạt mức chuẩn của kênh (Tương tác ${vsAvgInteractionsPct >= 0 ? `+${vsAvgInteractionsPct}%` : `${vsAvgInteractionsPct}%`} vs TB), truyền tải rõ thông điệp "${contentAngle}" nhưng chưa bứt phá thành bài WIN.`;
    whyItWon = `Nội dung đi đúng công thức "${copyFormula}" nhưng phần mở đầu (3 giây đầu / dòng đầu tiên) chưa tạo được sự đối lập mạnh hoặc thiếu mồi câu bình luận cụ thể.`;
    optimizationTip =
      'Cần đẩy cảnh kết quả ấn tượng nhất (Before/After hoặc cận cảnh test chất vải) lên ngay giây đầu tiên và đặt câu hỏi lựa chọn (VD: "Chọn màu A hay màu B?") ở cuối bài.';
    rewrittenHook = `✨ [Gợi ý nâng cấp thành Bài WIN]: "Đừng vội chọn đồ nếu bạn chưa xem màn kiểm chứng thực tế chỉ trong 15 giây này!"`;
  } else {
    verdict = `Hiệu suất thấp hơn trung bình kênh (${vsAvgInteractionsPct}% tương tác). Nội dung còn mang tính liệt kê thông tin một chiều, thiếu điểm chạm cảm xúc hoặc đòn bẩy FOMO.`;
    whyItWon = `Chưa lọt nhóm bài WIN do thiếu câu Hook đánh trúng nỗi đau cụ thể và định dạng chưa tối ưu cho thuật toán phân phối tự nhiên của ${pf.toUpperCase()}.`;
    optimizationTip =
      'Chuyển sang định dạng Video ngắn (Reels/TikTok) hoặc câu hỏi thảo luận mở (Threads) có người thật trải nghiệm và gắn quyền lợi cụ thể khi tương tác.';
    rewrittenHook = `💡 [Gợi ý làm lại Hook]: "Sai lầm khiến nhiều người tốn tiền mua đồ nhưng chỉ mặc được 1 lần — và cách khắc phục triệt để!"`;
  }

  return {
    platform: pf,
    hookSentence,
    videoHookSpoken,
    videoBodySpoken,
    videoCtaSpoken,
    hookType,
    hookMechanism,
    hookScore,
    contentStyle,
    copyFormula,
    contentPillar,
    contentAngle,
    funnelStage,
    matchedKeywords,
    ctaType,
    ctaEvaluation,
    score: rawScore,
    isWin,
    winBadgeLabel,
    winGoal,
    winDrivers,
    whyItWon,
    viewsMultiplier,
    interactionsMultiplier,
    commentsMultiplier,
    sharesMultiplier,
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

/**
 * Tổng hợp Thống kê Phân loại Nội dung & Đánh giá Nội Dung WIN toàn kênh
 * Dùng cho Bảng Trung Tâm Nội Dung WIN (Winning Content Lab) trên mọi kênh (FB, TikTok, IG, Threads, YT, Shopee)
 */
export function summarizeWinningContent(posts = [], averages = {}, followers = 100000, platform = 'facebook') {
  const enriched = posts.map((p) => ({
    ...p,
    contentAudit: p.contentAudit?.winGoal
      ? p.contentAudit
      : analyzeSinglePostContent(p, averages, followers, platform),
  }));

  const totalPosts = enriched.length || 1;
  const winPosts = enriched.filter((p) => p.contentAudit?.isWin);
  const superWinPosts = enriched.filter((p) => p.contentAudit?.tierClass === 'viral');
  const highWinPosts = enriched.filter((p) => p.contentAudit?.tierClass === 'high');
  const winRatePct = Math.round((winPosts.length / totalPosts) * 100);

  // Nhóm theo Tuyến nội dung (Content Pillar)
  const pillarMap = {};
  // Nhóm theo Kỹ thuật Hook (Hook Type)
  const hookMap = {};
  // Nhóm theo Định dạng (Format)
  const formatMap = {};

  for (const p of enriched) {
    const a = p.contentAudit || {};
    const pillar = a.contentPillar || 'Giới thiệu & Trưng bày sản phẩm';
    const hook = a.hookType || 'Nêu vấn đề & Insight trực diện';
    const fmt = p.format || 'Bài đăng';
    const interactions = Number(p.reactions || 0) + Number(p.comments || 0) + Number(p.shares || 0);
    const views = Number(p.views || 0);

    if (!pillarMap[pillar]) {
      pillarMap[pillar] = {
        name: pillar,
        total: 0,
        wins: 0,
        viewsSum: 0,
        interactionsSum: 0,
        commentsSum: 0,
        sharesSum: 0,
        postIndices: [],
        winPostIndices: [],
      };
    }
    pillarMap[pillar].total += 1;
    if (a.isWin) {
      pillarMap[pillar].wins += 1;
      pillarMap[pillar].winPostIndices.push(p.index);
    }
    pillarMap[pillar].viewsSum += views;
    pillarMap[pillar].interactionsSum += interactions;
    pillarMap[pillar].commentsSum += Number(p.comments || 0);
    pillarMap[pillar].sharesSum += Number(p.shares || 0);
    pillarMap[pillar].postIndices.push(p.index);

    if (!hookMap[hook]) {
      hookMap[hook] = {
        name: hook,
        total: 0,
        wins: 0,
        viewsSum: 0,
        interactionsSum: 0,
        winPostIndices: [],
      };
    }
    hookMap[hook].total += 1;
    if (a.isWin) {
      hookMap[hook].wins += 1;
      hookMap[hook].winPostIndices.push(p.index);
    }
    hookMap[hook].viewsSum += views;
    hookMap[hook].interactionsSum += interactions;

    if (!formatMap[fmt]) {
      formatMap[fmt] = { name: fmt, total: 0, wins: 0 };
    }
    formatMap[fmt].total += 1;
    if (a.isWin) formatMap[fmt].wins += 1;
  }

  const byPillar = Object.values(pillarMap)
    .map((item) => ({
      ...item,
      winRate: Math.round((item.wins / Math.max(1, item.total)) * 100),
      avgViews: Math.round(item.viewsSum / Math.max(1, item.total)),
      avgInteractions: Math.round(item.interactionsSum / Math.max(1, item.total)),
      avgComments: Math.round(item.commentsSum / Math.max(1, item.total)),
      avgShares: Math.round(item.sharesSum / Math.max(1, item.total)),
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  const byHook = Object.values(hookMap)
    .map((item) => ({
      ...item,
      winRate: Math.round((item.wins / Math.max(1, item.total)) * 100),
      avgViews: Math.round(item.viewsSum / Math.max(1, item.total)),
      avgInteractions: Math.round(item.interactionsSum / Math.max(1, item.total)),
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  const topWinningPosts = [...winPosts]
    .sort((a, b) => (b.contentAudit?.score || 0) - (a.contentAudit?.score || 0))
    .slice(0, 12);

  return {
    totalPosts: enriched.length,
    totalWinPosts: winPosts.length,
    superWinCount: superWinPosts.length,
    highWinCount: highWinPosts.length,
    winRatePct,
    bestPillar: byPillar[0] || null,
    bestHook: byHook[0] || null,
    byPillar,
    byHook,
    topWinningPosts,
  };
}


