/**
 * 백업 API 클라이언트 — 상태 코드 → 에러 코드 매핑, 404, 타임아웃.
 */
import { BackupApiError, deleteBackup, fetchBackup, uploadBackup } from '../api';
import type { BackupSnapshot } from '../snapshot';

jest.mock('../snapshot', () => ({}));

const g = globalThis as { fetch?: unknown };
let prevFetch: unknown;

function respond(status: number, body?: unknown) {
  g.fetch = jest.fn(async () => ({
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    },
  }));
}

beforeEach(() => {
  prevFetch = g.fetch;
});
afterEach(() => {
  g.fetch = prevFetch;
  jest.useRealTimers();
});

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof BackupApiError) return e.code;
    throw e;
  }
  throw new Error('did not throw');
}

describe('fetchBackup', () => {
  it('200 이면 본문을, 404 면 null 을 돌려준다', async () => {
    respond(200, { schemaVersion: 1, updatedAt: 42, email: 'a@b.c', payload: { x: 1 } });
    await expect(fetchBackup('tok')).resolves.toEqual({
      schemaVersion: 1,
      updatedAt: 42,
      email: 'a@b.c',
      payload: { x: 1 },
    });
    const [url, init] = (g.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/backup$/);
    expect(init).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer tok' } });

    respond(404, { error: 'not-found' });
    await expect(fetchBackup('tok')).resolves.toBeNull();
  });

  it.each([
    [401, 'reauth'],
    [400, 'invalid'],
    [413, 'invalid'],
    [503, 'server'],
    [500, 'server'],
    [405, 'server'],
  ])('%i → %s', async (status, code) => {
    respond(status, { error: 'x' });
    await expect(codeOf(fetchBackup('tok'))).resolves.toBe(code);
  });

  it('fetch 자체가 실패하면 network', async () => {
    g.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(codeOf(fetchBackup('tok'))).resolves.toBe('network');
  });

  it('15초 안에 응답이 없으면 abort 하고 network', async () => {
    jest.useFakeTimers();
    g.fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_res, rej) => {
          init.signal.addEventListener('abort', () => rej(new Error('Aborted')));
        }),
    );
    const p = codeOf(fetchBackup('tok'));
    jest.advanceTimersByTime(15_000);
    await expect(p).resolves.toBe('network');
  });
});

describe('uploadBackup / deleteBackup', () => {
  it('PUT 본문은 {schemaVersion, payload} 이고 서버 updatedAt 을 돌려준다', async () => {
    respond(200, { updatedAt: 777 });
    const snap = { schemaVersion: 1, createdAt: 1 } as unknown as BackupSnapshot;
    await expect(uploadBackup('tok', snap)).resolves.toEqual({ updatedAt: 777 });
    const [, init] = (g.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ schemaVersion: 1, payload: snap });
  });

  it('PUT 413 → invalid', async () => {
    respond(413);
    const snap = { schemaVersion: 1 } as unknown as BackupSnapshot;
    await expect(codeOf(uploadBackup('tok', snap))).resolves.toBe('invalid');
  });

  it('DELETE 204 는 성공, 401 은 reauth', async () => {
    respond(204);
    await expect(deleteBackup('tok')).resolves.toBeUndefined();
    respond(401, { error: 'unauthorized' });
    await expect(codeOf(deleteBackup('tok'))).resolves.toBe('reauth');
  });
});
