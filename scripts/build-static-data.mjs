import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeSinglePostContent } from '../src/stats-calculator.js';
import { compareChannelsWithGemini } from '../src/gemini-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const REPORTS_FILE = path.join(ROOT_DIR, 'data', 'reports.json');
const PUBLIC_DATA_DIR = path.join(ROOT_DIR, 'public', 'data');
const STATIC_OUT_FILE = path.join(PUBLIC_DATA_DIR, 'reports-static.json');

function buildPostDeepAuditFallback(baseAnalysis, channel) {
  return {
    ...baseAnalysis,
    aiEnhanced: false,
    deepAudit: {
      hookDeepDive: {
        extractedHook: baseAnalysis.videoHookSpoken || baseAnalysis.hookSentence,
        hookCategory: baseAnalysis.hookType,
        psychologicalTrigger: baseAnalysis.hookMechanism,
        strengthEvaluation: `Câu mở đầu đạt ${baseAnalysis.hookScore}/10 điểm. ${
          baseAnalysis.videoHookSpoken
            ? `Lời thoại 3 giây đầu ("${baseAnalysis.videoHookSpoken}") kết hợp trực tiếp với tiêu đề tạo điểm chạm kép cả về âm thanh lẫn thị giác.`
            : `Tiêu đề văn bản ("${baseAnalysis.hookSentence}") truyền tải thông điệp nhanh gọn ngay dòng đầu tiên trước nút "Xem thêm".`
        }`,
        alternativeHooks: [
          `[Góc độ Nỗi đau - PAS]: "Tại sao 80% khách hàng đều gặp bất tiện này khi chọn đồ — và đây là cách ${channel?.name || 'thương hiệu'} giải quyết triệt để chỉ trong 3 giây!"`,
          `[Góc độ POV Đời thực]: "POV: Khi bạn vừa muốn thoải mái suốt 8 tiếng đi làm, vừa muốn giữ phom thanh lịch chuẩn Hàn Quốc!"`,
          `[Góc độ Lợi ích 2-trong-1]: "Đầu tư 1 thiết kế nhưng diện đẹp suốt nhiều giai đoạn — kiểm chứng trực tiếp chất vải gây sốt tuần qua!"`,
        ],
      },
      contentStyleAndStructure: {
        contentStyle: baseAnalysis.contentStyle,
        copywritingFormula: baseAnalysis.copyFormula,
        narrativeFlow: `Mở đầu bằng kỹ thuật "${baseAnalysis.hookType}" -> Dẫn dắt phần thân bài bằng việc làm nổi bật các đặc tính cốt lõi (${(baseAnalysis.matchedKeywords || []).join(', ')}) -> Khép lại bằng "${baseAnalysis.ctaType}" thuộc tầng phễu ${baseAnalysis.funnelStage}.`,
        powerWords: baseAnalysis.matchedKeywords || [],
      },
      effectivenessEvaluation: {
        overallVerdict: baseAnalysis.verdict,
        whyItWorkedOrFailed: `Bài viết sử dụng công thức ${baseAnalysis.copyFormula} kết hợp kỹ thuật mở đầu "${baseAnalysis.hookType}", đánh trúng tâm lý khách hàng mục tiêu.`,
        adReadiness:
          baseAnalysis.score >= 72
            ? 'Rất phù hợp để nhân bản làm bài chạy Quảng cáo chuyển đổi (Paid Ads - Send Message / Shop Now).'
            : 'Nên tối ưu lại 3 giây đầu (Hook) và bổ sung lời kêu gọi hành động trực diện hơn trước khi chạy Ads.',
        actionableImprovements: [
          'Bổ sung text overlay nổi bật ngay trong 3 giây đầu tiên để giữ chân người xem tắt tiếng.',
          'Đưa lời kêu gọi hành động (Comment mã SP / Chấm ".") lên sớm hơn ở dòng thứ 3 của caption.',
          'Kết hợp thêm hình ảnh/clip cận cảnh test độ co giãn và bảng màu thực tế dưới phần bình luận.',
        ],
      },
    },
  };
}

async function main() {
  if (!fs.existsSync(PUBLIC_DATA_DIR)) {
    fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  }

  const rawReports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
  const enrichedReports = rawReports.map((r) => {
    const averages = r.stats?.averages || {};
    const followers = r.channel?.followers || 100000;
    const posts = (r.posts || []).map((p) => {
      const baseAudit = p.contentAudit || analyzeSinglePostContent(p, averages, followers);
      return {
        ...p,
        contentAudit: baseAudit.deepAudit ? baseAudit : buildPostDeepAuditFallback(baseAudit, r.channel),
      };
    });
    return {
      ...r,
      postsCount: posts.length,
      adsCount: (r.ads || []).length,
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
      posts,
    };
  });

  let defaultComparison = null;
  const scratchCompPath =
    '/Users/admin/.gemini/antigravity/brain/d8c70a0f-317e-4bca-b0c0-82c73ba97dc0/scratch/competitors_output.json';
  if (fs.existsSync(scratchCompPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(scratchCompPath, 'utf8'));
      defaultComparison = parsed.comparison || null;
    } catch {
      defaultComparison = null;
    }
  }
  if (!defaultComparison) {
    defaultComparison = await compareChannelsWithGemini(enrichedReports.slice(0, 7), '');
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    reports: enrichedReports,
    defaultComparison,
  };

  fs.writeFileSync(STATIC_OUT_FILE, JSON.stringify(payload), 'utf8');
  console.log(`✅ Đã đóng gói ${enrichedReports.length} báo cáo vào public/data/reports-static.json`);
}

main();
