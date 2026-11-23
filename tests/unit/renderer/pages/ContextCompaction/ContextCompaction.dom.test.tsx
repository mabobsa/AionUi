import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import ContextCompaction from '@/renderer/pages/conversation/platforms/acp/ContextCompaction';
import {
  useContextCompaction,
  type CompactionOptions,
} from '@/renderer/pages/conversation/platforms/acp/ContextCompaction/useContextCompaction';
import { tokenUsageFromAcpUsage } from '@/renderer/pages/conversation/platforms/acp/useAcpMessage';
import conversationKo from '@/renderer/services/i18n/locales/ko-KR/conversation.json';

const { getUsage, listeners } = vi.hoisted(() => ({
  getUsage: vi.fn(),
  listeners: new Set<(message: IResponseMessage) => void>(),
}));

vi.mock('@/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common')>();
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      conversation: { ...actual.ipcBridge.conversation, getUsage: { invoke: getUsage } },
      acpConversation: {
        ...actual.ipcBridge.acpConversation,
        responseStream: {
          on: (listener: (message: IResponseMessage) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      },
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'ko-KR' },
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      const name = key.replace('conversation.contextUsage.', '') as keyof typeof conversationKo.contextUsage;
      let text = conversationKo.contextUsage[name] ?? fallback ?? key;
      for (const [placeholder, value] of Object.entries(options ?? {}))
        text = text.replaceAll(`{{${placeholder}}}`, String(value));
      return text;
    },
  }),
}));

const snapshot = (count = 2, compactedAt = 80, updatedAt = 100) => ({
  used: updatedAt > 200 ? 20_000 : 800_000,
  size: 1_000_000,
  _meta: {
    'aionui/contextCompaction': {
      count,
      last_compacted_at: compactedAt,
      updated_at: compactedAt,
      history_complete: true,
    },
    'aionui/contextUsage': {
      status: 'current',
      turn_id: updatedAt > 100 ? 'compact-turn' : 'old-turn',
      updated_at: updatedAt,
      status_changed_at: Math.max(compactedAt, updatedAt),
    },
  },
});
const emit = (type: string, data: unknown = {}, turnId = 'compact-turn', conversationId = 'conv-1') => {
  for (const listener of listeners)
    listener({ type, data, turn_id: turnId, conversation_id: conversationId, msg_id: 'message' });
};
const options = (overrides: Partial<CompactionOptions> = {}): CompactionOptions => ({
  conversationId: 'conv-1',
  tokenUsage: tokenUsageFromAcpUsage(snapshot()),
  disabled: false,
  send: vi.fn(async (onAccepted: (turnId?: string) => void) => {
    onAccepted('compact-turn');
  }),
  ...overrides,
});

beforeEach(() => {
  listeners.clear();
  getUsage.mockReset().mockResolvedValue(snapshot());
});
afterEach(() => vi.useRealTimers());

describe('context compaction menu', () => {
  it('opens on click and shows real completion while retaining the ring until usage is refreshed', async () => {
    const props = options();
    const { container, rerender } = render(<ContextCompaction {...props} contextLimit={1_000_000} />);
    fireEvent.click(screen.getByRole('button', { name: '컨텍스트 사용량 및 압축' }));
    fireEvent.click(await screen.findByRole('button', { name: '지금 압축' }));
    await waitFor(() => expect(props.send).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('대화 압축 중')).toBeVisible();
    await act(async () => {
      emit('acp_context_usage', snapshot(3, 200, 101), '');
    });
    expect(await screen.findByText('압축 완료 · 사용량 갱신 대기')).toBeVisible();
    expect(container.querySelector('.context-compaction-count')).toHaveTextContent('3');
    rerender(
      <ContextCompaction
        {...props}
        tokenUsage={tokenUsageFromAcpUsage(snapshot(3, 200, 300))}
        contextLimit={1_000_000}
      />
    );
    expect(await screen.findByText('압축 완료', { exact: true })).toBeVisible();
    expect(screen.queryByText('압축 완료 · 사용량 갱신 대기')).not.toBeInTheDocument();
  });

  it('disables compaction while the AI is busy', async () => {
    const props = options({ disabled: true });
    render(<ContextCompaction {...props} contextLimit={1_000_000} />);
    fireEvent.click(screen.getByRole('button', { name: '컨텍스트 사용량 및 압축' }));
    expect(await screen.findByRole('button', { name: '지금 압축' })).toBeDisabled();
    expect(props.send).not.toHaveBeenCalled();
  });
});

describe('native compaction lifecycle', () => {
  it('does not report success on a finish with no compaction, including an insufficient-history response', async () => {
    const { result } = renderHook(useContextCompaction, { initialProps: options() });
    await act(async () => result.current.start());
    await act(async () => emit('finish'));
    await waitFor(() => expect(result.current.phase).toBe('unconfirmed'));
  });

  it('ignores other conversations and other turns, then recovers a missing live completion from persisted usage', async () => {
    const { result } = renderHook(useContextCompaction, { initialProps: options() });
    await act(async () => result.current.start());
    await act(async () => {
      emit('finish', {}, 'different-turn');
      emit('finish', {}, 'compact-turn', 'conv-2');
    });
    expect(result.current.phase).toBe('running');
    getUsage.mockResolvedValue(snapshot(3, 200, 101));
    await act(async () => emit('finish'));
    await waitFor(() => expect(result.current.phase).toBe('complete'));
  });

  it('buffers a terminal that arrives before the HTTP acknowledgement', async () => {
    const props = options({
      send: vi.fn(async (onAccepted) => {
        emit('finish');
        getUsage.mockResolvedValue(snapshot(3, 200, 101));
        onAccepted('compact-turn');
      }),
    });
    const { result } = renderHook(() => useContextCompaction(props));
    await act(async () => result.current.start());
    await waitFor(() => expect(result.current.phase).toBe('complete'));
  });

  it('tracks a team send through its native start when the team acknowledgement has no turn ID', async () => {
    const props = options({
      send: vi.fn(async (onAccepted) => {
        onAccepted();
      }),
    });
    const { result } = renderHook(() => useContextCompaction(props));
    await act(async () => result.current.start());
    getUsage.mockResolvedValue(snapshot(3, 200, 101));
    await act(async () => {
      emit('start');
      emit('finish');
    });
    await waitFor(() => expect(result.current.phase).toBe('complete'));
  });

  it('blocks duplicate clicks while the request is pending', async () => {
    let release!: () => void;
    const props = options({
      send: vi.fn(
        async () =>
          new Promise<void>((resolve) => {
            release = resolve;
          })
      ),
    });
    const { result } = renderHook(() => useContextCompaction(props));
    let sending!: Promise<void>;
    await act(async () => {
      sending = result.current.start();
    });
    await act(async () => result.current.start());
    expect(props.send).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await sending;
    });
  });

  it('allows retry after a rejected request without claiming completion', async () => {
    const send = vi
      .fn<CompactionOptions['send']>()
      .mockRejectedValueOnce(new Error('archived'))
      .mockImplementationOnce(async (onAccepted) => {
        onAccepted('compact-turn');
      });
    const { result } = renderHook(useContextCompaction, { initialProps: options({ send }) });
    await act(async () => result.current.start());
    expect(result.current.phase).toBe('failed');
    await act(async () => result.current.start());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('releases the progress state if the baseline request never returns', async () => {
    vi.useFakeTimers();
    getUsage.mockReturnValue(new Promise(() => {}));
    const props = options();
    const { result } = renderHook(() => useContextCompaction(props));
    let sending!: Promise<void>;
    act(() => {
      sending = result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_001);
      await sending;
    });
    expect(result.current.phase).toBe('failed');
    expect(props.send).not.toHaveBeenCalled();
  });

  it('does not submit a delayed request after leaving the conversation', async () => {
    let resolveUsage!: (value: ReturnType<typeof snapshot>) => void;
    getUsage.mockReturnValue(
      new Promise((resolve) => {
        resolveUsage = resolve;
      })
    );
    const props = options();
    const { result, unmount } = renderHook(() => useContextCompaction(props));
    let sending!: Promise<void>;
    act(() => {
      sending = result.current.start();
    });
    unmount();
    await act(async () => {
      resolveUsage(snapshot());
      await sending;
    });
    expect(props.send).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
