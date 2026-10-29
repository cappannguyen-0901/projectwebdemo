/* ============================================================
   VITE CONFIG — MPA tự quét mọi *.html ở gốc dự án
   Thêm trang mới = thả file .html vào gốc + 1 entry src/entry-<tên>.js — KHÔNG phải sửa config này.
   ============================================================ */
import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

const htmlInputs = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(root, f)])
);

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: { input: htmlInputs }
  }
});
