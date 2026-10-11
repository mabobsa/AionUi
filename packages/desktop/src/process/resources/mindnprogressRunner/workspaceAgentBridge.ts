import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { callLocalAionUi, requestJson, type RunnerConfig, type RunnerOperation, type RunnerResult } from './runtime';

type WorkspaceAgent = {
  execute: (body: unknown) => Promise<unknown>;
  report: () => Promise<unknown>;
  validateDispatch: (body: unknown) => Promise<void>;
};
type WorkspaceModule = {
  createWorkspaceAgent: (options: {
    registryFile: string;
    machineId: string;
    request: (pathname: string, body: unknown, method: string) => Promise<unknown>;
    runtimeIdle: (conversationId: string, root: string) => Promise<boolean>;
  }) => Promise<WorkspaceAgent>;
  workspaceRuntimeIdle: (
    call: (request: RunnerOperation['request']) => Promise<RunnerResult>
  ) => (conversationId: string, root: string) => Promise<boolean>;
};

// Load the installed MnP engine explicitly; do not infer a registry from the app's workspace.
export async function loadWorkspaceAgent(
  config: RunnerConfig,
  environment: NodeJS.ProcessEnv = process.env
): Promise<WorkspaceAgent | null> {
  const registryFile = environment.MNP_RUNNER_WORKSPACE_REGISTRY;
  const moduleFile = environment.MNP_RUNNER_WORKSPACE_AGENT_MODULE;
  if (!registryFile && !moduleFile) return null;
  if (!registryFile || !moduleFile || !path.isAbsolute(registryFile) || !path.isAbsolute(moduleFile)) {
    throw new Error('Explicit absolute workspace registry and MnP agent module paths are required.');
  }
  const module = (await import(/* @vite-ignore */ pathToFileURL(moduleFile).href)) as WorkspaceModule;
  if (typeof module.createWorkspaceAgent !== 'function' || typeof module.workspaceRuntimeIdle !== 'function') {
    throw new Error('Unsupported MnP workspace agent module.');
  }
  return module.createWorkspaceAgent({
    registryFile,
    machineId: config.machineId,
    request: (pathname, body, method) =>
      requestJson(
        `${config.apiBaseUrl}${pathname}`,
        {
          method,
          headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        30_000
      ),
    runtimeIdle: module.workspaceRuntimeIdle((request) => callLocalAionUi(config.aionUiBaseUrl, request)),
  });
}

export async function callWorkspaceAwareRunner(
  config: RunnerConfig,
  agent: WorkspaceAgent | null,
  request: RunnerOperation['request']
): Promise<RunnerResult> {
  try {
    if (request.pathname === '/mnp/workspaces' && request.method === 'POST') {
      if (!agent) throw new Error('REMOTE_WORKSPACE_AGENT_UNAVAILABLE');
      return { ok: true, data: await agent.execute(request.body) };
    }
    const body = request.body as { workspaceLease?: { ownership?: unknown } } | undefined;
    if (
      request.pathname === '/api/internal/external-conversation-dispatches' &&
      request.method === 'POST' &&
      body?.workspaceLease?.ownership
    ) {
      if (!agent) throw new Error('REMOTE_WORKSPACE_AGENT_UNAVAILABLE');
      await agent.validateDispatch(body);
    }
    return callLocalAionUi(config.aionUiBaseUrl, request);
  } catch (error) {
    const failure = error as { reasonCode?: string; code?: string; status?: number; message?: string };
    return {
      ok: false,
      status: failure.status ?? 409,
      code: failure.reasonCode ?? failure.code ?? 'REMOTE_WORKSPACE_AGENT_REJECTED',
      message: failure.message,
    };
  }
}
