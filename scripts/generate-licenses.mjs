/**
 * 오픈소스 라이선스 고지 데이터 생성.
 *
 *   node scripts/generate-licenses.mjs
 *   → src/constants/licenses.json
 *
 * MIT·BSD·ISC 는 "저작권 고지와 라이선스 전문을 배포물에 포함할 것"을 요구한다.
 * 배포되는 코드는 프로덕션 의존성 전체(700개 이상)라 전문을 패키지마다 넣으면
 * 번들이 수백 KB 불어나고 OTA 도 그만큼 무거워진다.
 *
 * 그래서 두 갈래로 나눈다:
 *   - 패키지별: 이름·버전·라이선스 종류·저작권 한 줄
 *   - 라이선스 종류별: 전문 1부
 * 이러면 고지 의무를 지키면서 크기는 수십 KB 로 유지된다.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'src/constants/licenses.json');

/** LICENSE 로 쓰이는 파일 이름들 (확장자·대소문자 제각각) */
function findLicenseFile(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const hit = entries.find(f => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  return hit ? join(dir, hit) : null;
}

/** 저작권 표시 한 줄 뽑기 — MIT 가 요구하는 "copyright notice" */
function extractCopyright(text, pkg) {
  if (text) {
    const m = text.match(/Copyright\s+(\(c\)|©)?\s*[^\n]{3,120}/i);
    if (m) return m[0].replace(/\s+/g, ' ').trim();
  }
  const author =
    typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  return author ? `Copyright (c) ${author}` : '';
}

/**
 * 파일 앞머리의 저작권 표시만 제거한다.
 * 제목(예: "MIT License")과 본문은 그대로 둔다.
 */
function stripLeadingCopyright(text) {
  const lines = text.split('\n');
  const out = [];
  let inHeader = true;
  for (const line of lines) {
    if (inHeader) {
      const t = line.trim();
      if (t === '') {
        // 본문이 시작되기 전의 빈 줄은 흘려보낸다
        if (out.length > 0) out.push(line);
        continue;
      }
      // 앞머리의 저작권 줄과 그 짝인 "All rights reserved." 만 제거
      if (/^copyright\b/i.test(t)) continue;
      if (/^all rights reserved\.?$/i.test(t)) continue;
      // 저작권도 빈 줄도 아니면 본문이 시작된 것
      if (!/^(the\s+)?[\w.\-+ ()]{0,40}licen[cs]e/i.test(t)) inHeader = false;
    }
    out.push(line);
  }
  return out.join('\n').trim();
}

function licenseId(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses) && pkg.licenses[0]?.type)
    return pkg.licenses[0].type;
  return 'UNKNOWN';
}

const paths = execSync('npm ls --omit=dev --parseable --all', {
  cwd: ROOT,
  maxBuffer: 64 * 1024 * 1024,
})
  .toString()
  .split('\n')
  .map(p => p.trim())
  .filter(p => p && p !== ROOT);

const packages = [];
const licenseTexts = {};
const seen = new Set();

for (const dir of paths) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) continue;

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    continue;
  }
  if (!pkg.name) continue;

  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const licenseFile = findLicenseFile(dir);
  const text = licenseFile ? readFileSync(licenseFile, 'utf8') : '';
  const id = licenseId(pkg);

  // 종류별 전문은 처음 만난 것 하나만 보관한다.
  //
  // 앞머리의 저작권 줄만 걷어낸다 (그 자리는 패키지마다 다르고, 각 항목에서
  // 따로 보여주므로). "Copyright 가 들어간 모든 줄"을 지우면 안 된다 —
  // MIT 본문의 "The above copyright notice ... shall be included in all"
  // 과 "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE" 까지 잘려 라이선스가 훼손된다.
  if (text && !licenseTexts[id] && id !== 'UNKNOWN') {
    licenseTexts[id] = stripLeadingCopyright(text);
  }

  packages.push({
    name: pkg.name,
    version: pkg.version ?? '',
    license: id,
    copyright: extractCopyright(text, pkg),
  });
}

packages.sort((a, b) => a.name.localeCompare(b.name));

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  packages,
  licenseTexts,
};

writeFileSync(OUT, JSON.stringify(data), 'utf8');

const counts = packages.reduce((acc, p) => {
  acc[p.license] = (acc[p.license] ?? 0) + 1;
  return acc;
}, {});
const sizeKb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1);

console.log(`패키지 ${packages.length}개, 라이선스 전문 ${Object.keys(licenseTexts).length}종, ${sizeKb} KB`);
console.log(
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n'),
);
