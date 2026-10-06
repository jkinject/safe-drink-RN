#!/usr/bin/env node
/**
 * App Store Connect 심사 상태 조회 — 브라우저 로그인 없이 API 키로.
 *
 * 사용법:
 *   node scripts/asc-status.mjs            # 최근 버전들의 상태
 *   node scripts/asc-status.mjs --builds   # 최근 빌드 처리 상태까지
 *
 * 필요한 값 (.env.local, git 에 안 올라감):
 *   ASC_KEY_ID=YNW2JAD99P
 *   ASC_ISSUER_ID=<App Store Connect → 사용자 및 액세스 → 통합 → App Store Connect API 상단의 발급자 ID>
 *   ASC_KEY_PATH=/Users/tim/Documents/keys/AuthKey_YNW2JAD99P.p8   (생략 시 이 경로)
 *
 * 의존성 없음 — Node 내장 crypto 로 ES256 JWT 를 만든다(유효 20분).
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ID = '6813104713';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(ASC_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function makeToken({ keyId, issuerId, keyPath }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: issuerId, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(readFileSync(keyPath));
  const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

async function api(token, path) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.errors?.map((e) => `${e.status} ${e.code}: ${e.detail ?? e.title}`).join('; ');
    throw new Error(`${path} → HTTP ${res.status}${detail ? ` (${detail})` : ''}`);
  }
  return body;
}

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '-';

async function main() {
  loadEnvLocal();
  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyPath = process.env.ASC_KEY_PATH || join(homedir(), 'Documents/keys', `AuthKey_${keyId}.p8`);
  if (!keyId || !issuerId) {
    console.error('ASC_KEY_ID·ASC_ISSUER_ID 가 필요합니다 (.env.local 또는 환경변수).');
    process.exit(2);
  }
  if (!existsSync(keyPath)) {
    console.error(`키 파일이 없습니다: ${keyPath}`);
    process.exit(2);
  }
  const token = makeToken({ keyId, issuerId, keyPath });

  const versions = await api(
    token,
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=5&include=build` +
      '&fields[appStoreVersions]=versionString,appStoreState,appVersionState,releaseType,createdDate,build' +
      '&fields[builds]=version,processingState,uploadedDate',
  );
  const builds = new Map((versions.included ?? []).map((b) => [b.id, b.attributes]));
  console.log('iOS 버전');
  for (const v of versions.data) {
    const a = v.attributes;
    const b = builds.get(v.relationships?.build?.data?.id);
    const state = a.appVersionState ?? a.appStoreState;
    console.log(
      `  ${a.versionString.padEnd(7)} ${state.padEnd(28)} build ${b ? `${b.version} (${b.processingState})` : '-'}  출시:${a.releaseType}  생성 ${fmt(a.createdDate)}`,
    );
  }

  const subs = await api(token, `/v1/apps/${APP_ID}/reviewSubmissions?filter[platform]=IOS&limit=3`);
  console.log('\n심사 제출');
  for (const s of subs.data) {
    const a = s.attributes;
    console.log(`  ${s.id}  ${a.state.padEnd(20)} 제출 ${fmt(a.submittedDate)}`);
  }

  if (process.argv.includes('--builds')) {
    const bl = await api(
      token,
      `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5&fields[builds]=version,processingState,uploadedDate`,
    );
    console.log('\n최근 빌드');
    for (const b of bl.data) {
      const a = b.attributes;
      console.log(`  ${a.version.padEnd(4)} ${a.processingState.padEnd(12)} 업로드 ${fmt(a.uploadedDate)}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
