/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NavigateFunction } from 'react-router-dom';

type ExternalConversationDeepLinkPayload = {
  action: string;
  params: Record<string, string>;
};

export type ExternalConversationLaunch = {
  agentId: string;
  completionUrl?: string;
  title?: string;
  prompt: string;
  modelId?: string;
  providerId?: string;
  mode?: string;
  thoughtLevel?: string;
  enabledSkillIds?: string[];
  disabledBuiltinSkillIds?: string[];
  mcpIds?: string[];
  workspace?: string;
  autoSend?: boolean;
};

export type ExternalConversationLaunchSession = {
  launch: ExternalConversationLaunch;
  onConversationCreated: (conversationId: string) => Promise<void>;
  token: string;
};

const EXTERNAL_LAUNCH_QUERY_KEY = 'external-launch';
const pendingLaunches = new Map<string, ExternalConversationLaunchSession>();
let launchSequence = 0;

function parseLoopbackCompletionUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value);
    const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    const isIntegrationEndpoint = url.pathname.startsWith('/api/integrations/aionui/');
    return url.protocol === 'http:' && isLoopback && isIntegrationEndpoint && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseExternalConversationLaunch(value: string | undefined): ExternalConversationLaunch | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ExternalConversationLaunch>;
    if (typeof parsed.agentId !== 'string' || !parsed.agentId.trim()) return null;
    if (typeof parsed.prompt !== 'string' || !parsed.prompt.trim()) return null;

    return {
      agentId: parsed.agentId.trim(),
      completionUrl: parseLoopbackCompletionUrl(parsed.completionUrl),
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.replace(/\s+/g, ' ').trim().slice(0, 120)
          : undefined,
      prompt: parsed.prompt,
      modelId: typeof parsed.modelId === 'string' ? parsed.modelId : undefined,
      providerId: typeof parsed.providerId === 'string' ? parsed.providerId : undefined,
      mode: typeof parsed.mode === 'string' ? parsed.mode : undefined,
      thoughtLevel: typeof parsed.thoughtLevel === 'string' ? parsed.thoughtLevel : undefined,
      enabledSkillIds: Array.isArray(parsed.enabledSkillIds)
        ? parsed.enabledSkillIds.filter((item): item is string => typeof item === 'string')
        : undefined,
      disabledBuiltinSkillIds: Array.isArray(parsed.disabledBuiltinSkillIds)
        ? parsed.disabledBuiltinSkillIds.filter((item): item is string => typeof item === 'string')
        : undefined,
      mcpIds: Array.isArray(parsed.mcpIds)
        ? parsed.mcpIds.filter((item): item is string => typeof item === 'string')
        : undefined,
      workspace: typeof parsed.workspace === 'string' ? parsed.workspace : undefined,
      autoSend: parsed.autoSend === true,
    };
  } catch {
    return null;
  }
}

async function reportConversationCreated(
  token: string,
  launch: ExternalConversationLaunch,
  conversationId: string
): Promise<void> {
  pendingLaunches.delete(token);
  if (!launch.completionUrl) return;

  try {
    await fetch(launch.completionUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ conversationId }),
    });
  } catch (error) {
    console.warn('[ExternalConversationLaunch] Failed to report the created conversation', error);
  }
}

function registerExternalConversationLaunch(launch: ExternalConversationLaunch): ExternalConversationLaunchSession {
  pendingLaunches.clear();
  launchSequence += 1;
  const token = `${Date.now().toString(36)}-${launchSequence.toString(36)}`;
  const session: ExternalConversationLaunchSession = {
    launch,
    onConversationCreated: (conversationId) => reportConversationCreated(token, launch, conversationId),
    token,
  };
  pendingLaunches.set(token, session);
  return session;
}

export function handleExternalConversationDeepLink(
  payload: ExternalConversationDeepLinkPayload,
  navigate: NavigateFunction
): boolean {
  if (payload.action !== 'conversation/new') return false;

  const launch = parseExternalConversationLaunch(payload.params.payload);
  if (!launch) {
    console.warn('[DeepLink] conversation/new action has an invalid payload');
    return true;
  }

  const session = registerExternalConversationLaunch(launch);
  const search = new URLSearchParams({ [EXTERNAL_LAUNCH_QUERY_KEY]: session.token });
  void navigate(`/guid?${search.toString()}`, {
    state: {
      selectedAssistantId: `bare:${launch.agentId}`,
      prefillPrompt: launch.prompt,
      workspace: launch.workspace,
    },
  });
  return true;
}

export function readExternalConversationLaunch(search: string): ExternalConversationLaunchSession | null {
  const token = new URLSearchParams(search).get(EXTERNAL_LAUNCH_QUERY_KEY);
  return token ? (pendingLaunches.get(token) ?? null) : null;
}
