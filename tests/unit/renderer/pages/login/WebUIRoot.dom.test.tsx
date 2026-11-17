import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  status: 'checking' as 'checking' | 'authenticated' | 'unauthenticated',
  loadApplication: vi.fn(),
  loadLocale: vi.fn<() => Promise<void>>(),
}));

vi.mock('@renderer/hooks/context/AuthContext', () => ({ useAuth: () => state }));
vi.mock('@renderer/pages/login', () => ({ default: () => <div>로그인</div> }));
vi.mock('@renderer/components/layout/AppLoader', () => ({ default: () => <div role='status'>로딩</div> }));
vi.mock('@renderer/pages/login/webuiI18n', () => ({ loadApplicationLocale: state.loadLocale }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@renderer/main', () => {
  state.loadApplication();
  return { AuthenticatedApplication: () => <div>대화 화면</div> };
});

describe('lightweight WebUI startup', () => {
  beforeEach(() => {
    vi.resetModules();
    state.status = 'checking';
    state.loadApplication.mockReset();
    state.loadLocale.mockReset().mockResolvedValue();
    window.history.replaceState(null, '', '#/conversation/mobile-test?panel=files');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows login without importing conversation code or its locale before authentication', async () => {
    const { WebUIContent } = await import('@renderer/pages/login/WebUIRoot');
    const view = render(<WebUIContent />);
    state.status = 'unauthenticated';
    view.rerender(<WebUIContent />);
    expect(screen.getByText('로그인')).toBeInTheDocument();
    expect(state.loadApplication).not.toHaveBeenCalled();
    expect(state.loadLocale).not.toHaveBeenCalled();
  });

  it('keeps a deep link until login succeeds', async () => {
    state.status = 'unauthenticated';
    const { WebUIContent } = await import('@renderer/pages/login/WebUIRoot');
    const view = render(<WebUIContent />);
    expect(window.location.hash).toBe('#/login?returnTo=%2Fconversation%2Fmobile-test%3Fpanel%3Dfiles');
    state.status = 'authenticated';
    view.rerender(<WebUIContent />);
    expect(await screen.findByText('대화 화면')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/conversation/mobile-test?panel=files');
  });

  it('waits for the application locale before showing the conversation', async () => {
    let finish!: () => void;
    state.loadLocale.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    state.status = 'authenticated';
    const { WebUIContent } = await import('@renderer/pages/login/WebUIRoot');
    render(<WebUIContent />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('대화 화면')).toBeNull();
    finish();
    expect(await screen.findByText('대화 화면')).toBeInTheDocument();
  });

  it('does not redirect to an external return URL', async () => {
    state.status = 'authenticated';
    window.history.replaceState(null, '', '#/login?returnTo=https%3A%2F%2Fexample.com');
    const { WebUIContent } = await import('@renderer/pages/login/WebUIRoot');
    render(<WebUIContent />);
    await screen.findByText('대화 화면');
    expect(window.location.hash).toBe('#/guid');
  });

  it('removes the conversation immediately when the session is lost', async () => {
    state.status = 'authenticated';
    const { WebUIContent } = await import('@renderer/pages/login/WebUIRoot');
    const view = render(<WebUIContent />);
    await screen.findByText('대화 화면');
    state.status = 'unauthenticated';
    view.rerender(<WebUIContent />);
    expect(screen.queryByText('대화 화면')).toBeNull();
    expect(screen.getByText('로그인')).toBeInTheDocument();
  });

  it('offers recovery when a deferred chunk fails instead of leaving a blank screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.status = 'authenticated';
    state.loadLocale.mockRejectedValue(new Error('Chunk fetch failed'));
    const { WebUIContent } = await import('@renderer/pages/login/WebUIRoot');
    render(<WebUIContent />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'common.reload' })).toBeInTheDocument();
  });
});
