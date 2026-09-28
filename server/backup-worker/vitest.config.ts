import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // 파일명을 *.test.ts 로 두면 앱 루트의 jest(testMatch: *.test.ts)가 이 폴더까지 주워 가 실패한다.
    // 루트 jest 설정을 건드리지 않으려고 vitest 전용 접미사를 쓴다.
    include: ['test/**/*.vitest.ts'],
  },
});
