import { describe, expect, it, vi } from 'vitest';
import {
  callWorkspaceAwareRunner,
  loadWorkspaceAgent,
} from '../../../../../packages/desktop/src/process/resources/mindnprogressRunner/workspaceAgentBridge';
import {
  callLocalAionUi,
  normalizeRunnerOperationRequest,
  type RunnerConfig,
} from '../../../../../packages/desktop/src/process/resources/mindnprogressRunner/runtime';

vi.mock('../../../../../packages/desktop/src/process/resources/mindnprogressRunner/runtime', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('../../../../../packages/desktop/src/process/resources/mindnprogressRunner/runtime')
    >();
  return { ...original, callLocalAionUi: vi.fn(async () => ({ ok: true, data: { forwarded: true } })) };
});
const config: RunnerConfig = {
  apiBaseUrl: 'https://mnp.example.invalid',
  aionUiBaseUrl: 'http://127.0.0.1:1',
  machineId: 'macbook',
  token: 'test',
  concurrency: 1,
  heartbeatIntervalMs: 5000,
  retryDelayMs: 500,
};
describe('remote workspace bridge', () => {
  it('requires explicit paired paths, without enabling the feature by default', async () => {
    expect(await loadWorkspaceAgent(config, {})).toBeNull();
    await expect(loadWorkspaceAgent(config, { MNP_RUNNER_WORKSPACE_REGISTRY: '/tmp/registry.json' })).rejects.toThrow(
      'Explicit absolute'
    );
  });
  it('normalizes only the Runner-local workspace command route', () => {
    expect(normalizeRunnerOperationRequest({ method: 'POST', pathname: '/mnp/workspaces' }).pathname).toBe(
      '/mnp/workspaces'
    );
    expect(() => normalizeRunnerOperationRequest({ method: 'GET', pathname: '/mnp/workspaces' })).toThrow();
    expect(() =>
      normalizeRunnerOperationRequest({ method: 'POST', pathname: '/mnp/workspaces?target=other' })
    ).toThrow();
  });
  it('does not forward workspace commands to the unauthenticated local API', async () => {
    vi.mocked(callLocalAionUi).mockClear();
    const agent = { execute: vi.fn(async () => ({ prepared: true })), report: vi.fn(), validateDispatch: vi.fn() };
    const request = { method: 'POST', pathname: '/mnp/workspaces', timeoutMs: 1000, body: { action: 'prepare' } };
    expect(await callWorkspaceAwareRunner(config, agent, request)).toEqual({ ok: true, data: { prepared: true } });
    expect(callLocalAionUi).not.toHaveBeenCalled();
    expect((await callWorkspaceAwareRunner(config, null, request)).ok).toBe(false);
    expect(callLocalAionUi).not.toHaveBeenCalled();
  });
  it('checks remote ownership before dispatch and retains ordinary conversation compatibility', async () => {
    vi.mocked(callLocalAionUi).mockClear();
    const request = {
      method: 'POST',
      pathname: '/api/internal/external-conversation-dispatches',
      timeoutMs: 1000,
      body: { workspaceLease: { ownership: { generation: 1 } } },
    };
    expect((await callWorkspaceAwareRunner(config, null, request)).ok).toBe(false);
    const agent = {
      execute: vi.fn(),
      report: vi.fn(),
      validateDispatch: vi.fn(async () => {
        throw Object.assign(new Error('mismatch'), { reasonCode: 'MNP_WORKSPACE_ASSIGNMENT_MISMATCH' });
      }),
    };
    expect((await callWorkspaceAwareRunner(config, agent, request)).code).toBe('MNP_WORKSPACE_ASSIGNMENT_MISMATCH');
    expect(callLocalAionUi).not.toHaveBeenCalled();
    expect((await callWorkspaceAwareRunner(config, null, { ...request, body: {} })).ok).toBe(true);
  });
});
