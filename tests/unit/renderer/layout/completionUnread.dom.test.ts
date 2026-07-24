import type { TChatConversation } from '@/common/config/storage';
import {
  countVisibleCompletionUnread,
  isConversationWindowFocused,
} from '@/renderer/pages/conversation/GroupedHistory/utils/completionUnread';
import { describe, expect, it, vi } from 'vitest';

const conversation = (id: string): TChatConversation => ({ id }) as TChatConversation;

describe('completion unread taskbar state', () => {
  it('counts only unread ids present in the visible conversation list', () => {
    expect(
      countVisibleCompletionUnread(
        [conversation('visible-1'), conversation('visible-2')],
        new Set(['visible-1', 'team-hidden'])
      )
    ).toBe(1);
  });

  it('uses document focus to decide whether the active conversation is visible to the user', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    expect(isConversationWindowFocused()).toBe(false);

    vi.mocked(document.hasFocus).mockReturnValue(true);
    expect(isConversationWindowFocused()).toBe(true);
  });
});
