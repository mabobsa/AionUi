/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodexUsageSnapshot } from '@/common/types/platform/codexUsage';

const fixtures = vi.hoisted(() => ({
  pathname: '/conversation/first',
  invoke: vi.fn(),
  listener: undefined as ((usage: CodexUsageSnapshot) => void) | undefined,
  unsubscribe: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: fixtures.pathname }),
}));

vi.mock('@/common/platform/subscriptionUsageBridge', () => ({
  subscriptionUsageBridge: {
    getCodex: {
      invoke: fixtures.invoke,
    },
    codexChanged: {
      on: (listener: (usage: CodexUsageSnapshot) => void) => {
        fixtures.listener = listener;
        return fixtures.unsubscribe;
      },
    },
  },
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@icon-park/react', () => ({
  Dashboard: () => <span />,
}));

import CodexUsageIndicator from '@/renderer/components/layout/Titlebar/CodexUsageIndicator';

const usage: CodexUsageSnapshot = {
  weekly: {
    usedPercent: 29,
    resetsAt: 1_800_000_000,
  },
  limitReached: false,
  updatedAt: Date.now(),
};

describe('CodexUsageIndicator', () => {
  beforeEach(() => {
    fixtures.pathname = '/conversation/first';
    fixtures.invoke.mockReset();
    fixtures.listener = undefined;
    fixtures.unsubscribe.mockReset();
  });

  it('keeps the last account usage visible while another conversation refreshes', async () => {
    fixtures.invoke.mockResolvedValueOnce(usage).mockReturnValueOnce(new Promise(() => {}));
    const view = render(<CodexUsageIndicator />);

    await waitFor(() => expect(screen.getByText('29%')).toBeInTheDocument());

    fixtures.pathname = '/conversation/second';
    view.rerender(<CodexUsageIndicator />);

    expect(screen.getByText('29%')).toBeInTheDocument();
    expect(fixtures.invoke).toHaveBeenLastCalledWith({ conversationId: 'second' });
  });

  it('renders a publisher update without waiting for another request interval', async () => {
    fixtures.invoke.mockReturnValue(new Promise(() => {}));
    render(<CodexUsageIndicator />);

    await act(async () => {
      fixtures.listener?.({
        weekly: { usedPercent: 1, resetsAt: 1_800_000_000 },
        limitReached: false,
        updatedAt: Date.now(),
      });
    });

    expect(screen.getByText('1%')).toBeInTheDocument();
    expect(fixtures.invoke).toHaveBeenCalledTimes(1);
  });
});
