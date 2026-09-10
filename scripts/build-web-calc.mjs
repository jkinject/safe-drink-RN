#!/usr/bin/env node
/**
 * 웹 계산기(docs/calc)용으로 src/core 의 계산 로직을 브라우저 ES 모듈로 내보낸다.
 * 앱과 같은 코드를 쓰므로 수치가 어긋날 일이 없다. 실행: node scripts/build-web-calc.mjs
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = 'docs/calc/lib';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execSync(
  `npx tsc src/core/bacCalculator.ts src/core/planCalculator.ts src/core/types.ts ` +
    `--target es2020 --module es2020 --moduleResolution bundler --strict --outDir ${out} --declaration false --skipLibCheck --ignoreConfig`,
  { stdio: 'inherit' },
);
// 브라우저는 확장자 없는 import 를 못 푼다 → './x' → './x.js'
for (const f of readdirSync(out)) {
  const p = join(out, f);
  const src = readFileSync(p, 'utf8').replace(/from '(\.\/[^']+)'/g, (m, s) => (s.endsWith('.js') ? m : `from '${s}.js'`));
  writeFileSync(p, src);
}
console.log('built', out, readdirSync(out));
