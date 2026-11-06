#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "📦 1/3: Đóng gói dữ liệu báo cáo mới nhất sang bản Web Tĩnh (GitHub Pages)..."
node scripts/build-static-data.mjs

echo "📤 2/3: Đẩy mã nguồn & dữ liệu báo cáo lên nhánh main (Đã ẩn API Key trong data/config.json)..."
git add .
git commit -m "Update Social Lens reports and analytics" || echo "Không có thay đổi mới trên nhánh main"
git push -u origin main

echo "🌐 3/3: Cập nhật trang web chia sẻ trực tuyến (GitHub Pages - nhánh gh-pages)..."
TMP_DIR=$(mktemp -d)
cp -R public/* "$TMP_DIR/"
touch "$TMP_DIR/.nojekyll"

git -C "$TMP_DIR" init -b gh-pages
git -C "$TMP_DIR" add .
git -C "$TMP_DIR" commit -m "Deploy Social Lens static web viewer to GitHub Pages"
REMOTE_URL=$(git remote get-url origin)
git -C "$TMP_DIR" remote add origin "$REMOTE_URL"
git -C "$TMP_DIR" push -f origin gh-pages
rm -rf "$TMP_DIR"

echo "✅ Hoàn tất! Mọi người có thể truy cập trực tiếp tại:"
echo "👉 https://tranhai68.github.io/social-lens-app/"
