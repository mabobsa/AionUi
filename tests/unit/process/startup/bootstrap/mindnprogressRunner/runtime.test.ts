import { describe, expect, it, vi } from 'vitest';
import {
  RunnerConfigError,
  callLocalAionUi,
  createRunnerLoop,
  normalizeRunnerEnvironment,
  normalizeRunnerOperation,
  type RunnerOperation,
} from '@/process/resources/mindnprogressRunner/runtime';

describe('MindNProgress Runner runtime', () => {
  it('normalizes bounded configuration without exposing the token in derived URLs', () => {
    const config = normalizeRunnerEnvironment({
      MNP_RUNNER_API_URL: 'https://mnp.example.test/path?q=1',
      MNP_RUNNER_MACHINE_ID: 'MACBOOK',
      MNP_RUNNER_TOKEN: 'secret-token',
      MNP_RUNNER_AIONUI_URL: 'http://127.0.0.1:4312',
      MNP_RUNNER_CONCURRENCY: '99',
    });

    expect(config.apiBaseUrl).toBe('https://mnp.example.test');
    expect(config.machineId).toBe('macbook');
    expect(config.concurrency).toBe(16);
    expect(JSON.stringify({ ...config, token: undefined })).not.toContain('secret-token');
  });

  it('rejects missing credentials and non-http server URLs', () => {
    expect(() =>
      normalizeRunnerEnvironment({
        MNP_RUNNER_API_URL: 'ftp://mnp.example.test',
        MNP_RUNNER_MACHINE_ID: 'macbook',
        MNP_RUNNER_TOKEN: 'token',
        MNP_RUNNER_AIONUI_URL: 'http://127.0.0.1:4312',
      })
    ).toThrow(RunnerConfigError);
  });

  it('finishes claimed work before a graceful stop completes', async () => {
    const operation: RunnerOperation = {
      operationId: 'operation_123456',
      resultToken: `mnop_${'a'.repeat(43)}`,
      request: {
        pathname: '/api/internal/external-conversation-dispatches',
        method: 'POST',
        timeoutMs: 1_000,
      },
    };
    let claims = 0;
    const reported = vi.fn(async () => undefined);
    let loop: ReturnType<typeof createRunnerLoop>;
    loop = createRunnerLoop({
      claimOperations: async () => {
        claims += 1;
        if (claims === 1) return [operation];
        loop.stop();
        return [];
      },
      callAionUi: async () => ({ ok: true, data: { done: true } }),
      reportResult: reported,
      concurrency: 1,
      retryDelayMs: 1,
      onClaimError: vi.fn(),
    });

    await loop.start();
    expect(reported).toHaveBeenCalledWith(
      'operation_123456',
      { ok: true, data: { done: true } },
      `mnop_${'a'.repeat(43)}`
    );
  });

  it('accepts only the AionCore API routes and methods required by MindNProgress', () => {
    expect(
      normalizeRunnerOperation({
        operationId: 'operation_123456',
        resultToken: `mnop_${'a'.repeat(43)}`,
        request: {
          pathname: '/api/conversations/conversation_1/messages?limit=100&content_mode=full',
          method: 'GET',
          timeoutMs: 30_000,
        },
      }).request.pathname
    ).toBe('/api/conversations/conversation_1/messages?limit=100&content_mode=full');

    expect(() =>
      normalizeRunnerOperation({
        operationId: 'operation_123456',
        resultToken: `mnop_${'a'.repeat(43)}`,
        request: { pathname: '/api/config', method: 'GET', timeoutMs: 30_000 },
      })
    ).toThrow('Runner operation is not allowed.');
  });

  it('does not call AionCore when an untrusted Runner operation bypasses claim validation', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await callLocalAionUi(
      'http://127.0.0.1:4312',
      { pathname: '/api/config', method: 'DELETE', timeoutMs: 1_000 },
      fetchImpl
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: 'RUNNER_LOCAL_CALL_FAILED' });
  });
});
