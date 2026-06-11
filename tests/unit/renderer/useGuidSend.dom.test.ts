/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMcpServer } from '@/common/config/storage';
import { useGuidSend, type GuidSendDeps } from '@/renderer/pages/guid/hooks/useGuidSend';

const createConversationInvokeMock = vi.fn();
const swrMutateMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      create: {
        invoke: (...args: unknown[]) => createConversationInvokeMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: vi.fn(),
  },
}));

vi.mock('swr', () => ({
  mutate: (...args: unknown[]) => swrMutateMock(...args),
}));

vi.mock('@/renderer/utils/workspace/workspaceHistory', () => ({
  updateWorkspaceTime: vi.fn(),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

const createDeps = (): GuidSendDeps => ({
  input: 'hello',
  setInput: vi.fn(),
  files: [],
  setFiles: vi.fn(),
  dir: '',
  setDir: vi.fn(),
  setLoading: vi.fn(),
  loading: false,
  selectedAgent: 'claude',
  selectedAgentKey: 'preset-claude',
  selectedAgentInfo: {
    id: 'meta-1',
    key: 'preset-claude',
    name: 'Claude',
    agent_type: 'claude',
    backend: 'claude',
    custom_agent_id: 'assistant-1',
    is_preset: true,
    isExtension: false,
  } as never,
  is_presetAgent: true,
  selectedMode: 'bypassPermissions',
  selectedAcpModel: 'claude-opus',
  currentAcpCachedModelInfo: null,
  current_model: undefined,
  findAgentByKey: vi.fn(),
  getEffectiveAgentType: vi.fn(() => ({
    agent_type: 'claude',
    isAvailable: true,
  })),
  resolveEnabledSkills: vi.fn(() => ['skill-a']),
  resolveDisabledBuiltinSkills: vi.fn(() => ['skill-b']),
  guidDisabledBuiltinSkills: undefined,
  guidEnabledSkills: undefined,
  availableMcpServers: [{ id: 'mcp-user', name: 'User MCP', enabled: true, builtin: false } as IMcpServer],
  selectedMcpServerIds: ['mcp-user'],
  currentEffectiveAgentInfo: {
    agent_type: 'claude',
    isAvailable: true,
  } as never,
  isGoogleAuth: false,
  setMentionOpen: vi.fn(),
  setMentionQuery: vi.fn(),
  setMentionSelectorOpen: vi.fn(),
  setMentionActiveIndex: vi.fn(),
  navigate: vi.fn(() => Promise.resolve()) as never,
  t: vi.fn((key: string, options?: { defaultValue?: string }) => options?.defaultValue || key) as never,
  localeKey: 'zh-CN',
});

describe('useGuidSend', () => {
  beforeEach(() => {
    createConversationInvokeMock.mockReset();
    createConversationInvokeMock.mockResolvedValue({ id: 'conv-1' });
    swrMutateMock.mockReset();
    swrMutateMock.mockResolvedValue(undefined);
  });

  it('passes selected mode into assistant_overrides when creating a preset ACP conversation', async () => {
    const { result } = renderHook(() => useGuidSend(createDeps()));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(createConversationInvokeMock).toHaveBeenCalledTimes(1);
    const payload = createConversationInvokeMock.mock.calls[0][0];
    expect(payload.extra.assistant_overrides.permission).toBe('bypassPermissions');
    expect(payload.extra.assistant_overrides.model).toBe('claude-opus');
    expect(swrMutateMock).toHaveBeenCalledWith('guid.assistant.detail.assistant-1.zh-CN');
    expect(swrMutateMock).toHaveBeenCalledWith('assistants.list');
  });
});
