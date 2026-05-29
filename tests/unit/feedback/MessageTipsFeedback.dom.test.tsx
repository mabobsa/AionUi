/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Verifies MessageTips only renders the FeedbackButton on error tips and
 * wires it to module=conversation-session.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const openFeedbackMock = vi.fn(() => Promise.resolve());
vi.mock('@/renderer/hooks/context/FeedbackContext', () => ({
  useFeedback: () => ({ openFeedback: openFeedbackMock }),
}));

// CollapsibleContent uses ResizeObserver and runtime theme context — stub it
// so tests don't have to pull in the entire theme provider tree.
vi.mock('@renderer/components/chat/CollapsibleContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// MarkdownView pulls in a heavy markdown pipeline — replace with a passthrough.
vi.mock('@renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import MessageTips from '@/renderer/pages/conversation/Messages/components/MessageTips';
import type { AgentStreamErrorInfo, IMessageTips } from '@/common/chat/chatLib';

const buildTips = (
  type: IMessageTips['content']['type'],
  content = 'boom',
  error?: AgentStreamErrorInfo
): IMessageTips =>
  ({
    id: 'tip-1',
    type: 'tips',
    content: { type, content, ...(error ? { error } : {}) },
  }) as IMessageTips;

describe('MessageTips — FeedbackButton wiring', () => {
  beforeEach(() => {
    openFeedbackMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render FeedbackButton on success tips', () => {
    render(<MessageTips message={buildTips('success')} />);
    expect(screen.queryByText('settings.oneClickFeedback')).not.toBeInTheDocument();
  });

  it('does not render FeedbackButton on warning tips', () => {
    render(<MessageTips message={buildTips('warning')} />);
    expect(screen.queryByText('settings.oneClickFeedback')).not.toBeInTheDocument();
  });

  it('renders FeedbackButton when tip type is error', () => {
    render(<MessageTips message={buildTips('error')} />);
    expect(screen.getByText('settings.oneClickFeedback')).toBeInTheDocument();
  });

  it('click opens feedback with module=conversation-session', async () => {
    const user = userEvent.setup();
    render(<MessageTips message={buildTips('error')} />);
    await user.click(screen.getByText('settings.oneClickFeedback'));

    expect(openFeedbackMock).toHaveBeenCalledTimes(1);
    expect(openFeedbackMock).toHaveBeenCalledWith({
      module: 'conversation-session',
      autoScreenshot: true,
    });
  });

  it('renders FeedbackButton on JSON-formatted error content too', async () => {
    const user = userEvent.setup();
    render(<MessageTips message={buildTips('error', '{"code":500}')} />);
    await user.click(screen.getByText('settings.oneClickFeedback'));
    expect(openFeedbackMock).toHaveBeenCalledWith({
      module: 'conversation-session',
      autoScreenshot: true,
    });
  });

  it('renders HTML-like error text as literal text', () => {
    const { container } = render(<MessageTips message={buildTips('error', '<strong>boom</strong>')} />);

    expect(container.querySelector('strong')).not.toBeInTheDocument();
    expect(screen.getByText('<strong>boom</strong>')).toBeInTheDocument();
  });

  it('renders classified provider errors with friendly copy and feedback', () => {
    render(
      <MessageTips
        message={buildTips('error', 'raw provider 401', {
          message: 'raw provider 401',
          code: 'USER_LLM_PROVIDER_AUTH_FAILED',
          ownership: 'user_llm_provider',
          detail: 'Provider returned 401.',
          retryable: false,
          feedback_recommended: false,
        })}
      />
    );

    expect(screen.getByText('conversation.agentError.codes.USER_LLM_PROVIDER_AUTH_FAILED.title')).toBeInTheDocument();
    expect(screen.getByText('conversation.agentError.codes.USER_LLM_PROVIDER_AUTH_FAILED.body')).toBeInTheDocument();
    expect(screen.getByText('conversation.agentError.ownership.user_llm_provider')).toBeInTheDocument();
    expect(screen.getByText('conversation.agentError.notRetryable')).toBeInTheDocument();
    expect(screen.getByText('settings.oneClickFeedback')).toBeInTheDocument();
  });

  it('expands classified error technical details explicitly', async () => {
    const user = userEvent.setup();
    render(
      <MessageTips
        message={buildTips('error', 'raw provider 401', {
          message: 'raw provider 401',
          code: 'USER_LLM_PROVIDER_AUTH_FAILED',
          ownership: 'user_llm_provider',
          detail: 'Provider returned 401.',
          retryable: false,
          feedback_recommended: false,
        })}
      />
    );

    const detailsToggle = screen.getByRole('button', { name: /common.technical_details/ });
    expect(detailsToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(detailsToggle);

    expect(detailsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Provider returned 401/)).toBeInTheDocument();
  });
});

describe('agent error locale copy', () => {
  it('does not label app-side errors as direct AionUi ownership', () => {
    const localeDir = path.join(process.cwd(), 'packages/desktop/src/renderer/services/i18n/locales');
    const localeNames = ['zh-CN', 'en-US', 'ja-JP', 'zh-TW', 'ko-KR', 'tr-TR', 'ru-RU', 'uk-UA'];

    for (const localeName of localeNames) {
      const locale = JSON.parse(readFileSync(path.join(localeDir, localeName, 'conversation.json'), 'utf8'));
      const agentError = locale.agentError;

      expect(agentError.ownership.aionui, localeName).not.toMatch(/AionUi/);

      for (const [code, copy] of Object.entries<Record<string, string>>(agentError.codes)) {
        if (!code.startsWith('AIONUI_')) continue;

        expect(copy.title, `${localeName} ${code} title`).not.toMatch(/AionUi/);
        expect(copy.body, `${localeName} ${code} body`).not.toMatch(/AionUi/);
      }
    }
  });
});
