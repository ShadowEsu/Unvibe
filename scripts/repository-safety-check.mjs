import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'dist-test', 'release', '.tools-bin', '.vercel']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql', '.yml', '.yaml', '.env', '.example', '.plist', '.css', '.html']);
const secretPatterns = [
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /sk_live_[A-Za-z0-9]{16,}/,
  /sbp_[A-Za-z0-9]{20,}/,
  /SUPABASE_SERVICE_ROLE_KEY[ \t]*=[ \t]*[^\s#][^\s]*/,
];
const problems = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (stat.size < 2_000_000 && textExtensions.has(extname(path))) inspect(path);
  }
}

function inspect(path) {
  const content = readFileSync(path, 'utf8');
  for (const pattern of secretPatterns) if (pattern.test(content)) problems.push(`${relative(root, path)} matches ${pattern}`);
  if (!path.endsWith('.md')) return;
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(https?:|mailto:|\/)/.test(target) || target.includes(' ')) continue;
    const local = resolve(path, '..', target);
    if (!existsSync(local)) problems.push(`${relative(root, path)} has missing link ${target}`);
  }
}

walk(root);
for (const file of readdirSync(join(root, 'web/supabase/migrations'))) {
  const sql = readFileSync(join(root, 'web/supabase/migrations', file), 'utf8');
  if (/security\s+definer/i.test(sql)) problems.push(`${file} uses SECURITY DEFINER`);
}
if (!existsSync(join(root, 'app/build/icon.icns'))) problems.push('tracked packaging icon is missing');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Repository safety checks passed: secrets, local documentation links, migrations, and package icon.');
