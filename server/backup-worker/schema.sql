-- 사용자당 스냅샷 1행. 백업 1회 = 행 쓰기 1회라 D1 무료 한도(쓰기 100,000행/일)를 넉넉히 버틴다.
-- user_sub 는 사용자 키 — Google 은 ID 토큰 sub 그대로, Apple 은 "apple:<sub>". 이메일은 바뀔 수 있어 식별에 쓰지 않고 표시용으로만 둔다.
-- WITHOUT ROWID: PRIMARY KEY 가 TEXT 라 기본 rowid 인덱스를 따로 두면 같은 데이터가
-- 클러스터드 인덱스(PK)와 rowid 테이블 양쪽에 저장된다. 없애면 행당 저장량이 줄어든다.
CREATE TABLE IF NOT EXISTS backups (
  user_sub TEXT PRIMARY KEY,
  email TEXT,
  schema_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
