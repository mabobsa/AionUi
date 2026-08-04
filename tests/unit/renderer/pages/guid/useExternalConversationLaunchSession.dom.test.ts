/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook, waitFor } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExternalConversationLaunchSession } from '@/renderer/pages/guid/hooks/useExternalConversationLaunchSession';

const { httpRequestMock } = vi.hoisted(() => ({
  httpRequestMock: vi.fn(),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  httpRequest: (...args: unknown[]) => httpRequestMock(...args),
  isBackendHttpError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'BackendHttpError'),
}));

const strictModeWrapper: React.FC<React.PropsWithChildren> = ({ children }) =>
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/guid?external-launch=web-launch-strict'] },
    React.createElement(StrictMode, null, children)
  );

function routerWrapper(entry: string): React.FC<React.PropsWithChildren> {
  return ({ children }) => React.createElement(MemoryRouter, { initialEntries: [entry] }, children);
}

describe('useExternalConversationLaunchSession', () => {
  afterEach(() => {
    httpRequestMock.mockReset();
  });

  it('claims a WebUI launch once under StrictMode and completes it through AionCore', async () => {
    httpRequestMock.mockImplementation(async (_method: string, path: string) => {
      if (path.endsWith('/claim')) {
        return {
          launch: {
            agentId: 'codex',
            prompt: 'Review this card',
            thoughtLevel: 'high',
            autoSend: true,
          },
          expiresAt: '2026-08-04T12:05:00.000Z',
        };
      }
      return { callbackStatus: 'delivered' };
    });
    const onCallbackPending = vi.fn();

    const { result } = renderHook(
      () => ({
        launchState: useExternalConversationLaunchSession(onCallbackPending),
        location: useLocation(),
      }),
      { wrapper: strictModeWrapper }
    );

    await waitFor(() => expect(result.current.launchState.session?.source).toBe('web'));
    await waitFor(() =>
      expect(result.current.location.state).toMatchObject({
        prefillPrompt: 'Review this card',
        selectedAssistantId: 'bare:codex',
      })
    );
    expect(httpRequestMock.mock.calls.filter((call) => call[1].endsWith('/claim'))).toHaveLength(1);

    await result.current.launchState.session?.onConversationCreated('conv-1');

    expect(httpRequestMock).toHaveBeenCalledWith('POST', '/api/external-conversation-launches/complete', {
      conversationId: 'conv-1',
      launchId: 'web-launch-strict',
    });
    expect(onCallbackPending).not.toHaveBeenCalled();
  });

  it('maps an expired launch to a stable user-facing state', async () => {
    httpRequestMock.mockRejectedValue({
      name: 'BackendHttpError',
      status: 404,
      code: 'EXTERNAL_LAUNCH_NOT_FOUND_OR_EXPIRED',
    });

    const onCallbackPending = vi.fn();
    const { result } = renderHook(() => useExternalConversationLaunchSession(onCallbackPending), {
      wrapper: routerWrapper('/guid?external-launch=web-launch-expired'),
    });

    await waitFor(() => expect(result.current.error).toBe('not-found-or-expired'));
    expect(result.current.loading).toBe(false);
    expect(result.current.session).toBeNull();
  });

  it('reports a pending server-side completion callback without failing conversation creation', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        launch: { agentId: 'claude', prompt: 'Start work', autoSend: true },
        expiresAt: '2026-08-04T12:05:00.000Z',
      })
      .mockResolvedValueOnce({ callbackStatus: 'pending' });
    const onCallbackPending = vi.fn();

    const { result } = renderHook(() => useExternalConversationLaunchSession(onCallbackPending), {
      wrapper: routerWrapper('/guid?external-launch=web-launch-pending'),
    });
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await result.current.session?.onConversationCreated('conv-2');

    expect(onCallbackPending).toHaveBeenCalledTimes(1);
  });
});
