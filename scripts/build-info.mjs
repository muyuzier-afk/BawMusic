// 读取 git HEAD 短 sha + 当前 UTC 时间,生成 lib/build-info.json
// 给前端用来展示"commit id + build timestamp"格式的版本号,并跟 versions.json 里的
// 条目对账,标出"本次更新有哪些 changelog 条目"。
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'lib');
const OUT_FILE = resolve(OUT_DIR, 'build-info.json');

function gitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function buildDate() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

const versionsPath = resolve(ROOT, 'versions.json');
const versions = existsSync(versionsPath)
  ? JSON.parse(readFileSync(versionsPath, 'utf8'))
  : { versions: [] };

const sha = gitShortSha();
const date = buildDate();
const current = versions.versions.find((v) => v.sha === sha) || null;

const out = {
  sha,
  date,
  version: `${sha}@${date}`,
  hasChangelog: Boolean(current),
  changelog: current,
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log(`[build-info] sha=${sha} date=${date} changelog=${current ? current.title : '(none)'}`);
