/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';

export const isConversationWindowFocused = (): boolean => typeof document !== 'undefined' && document.hasFocus();

/**
 * Count unread completions that have a corresponding visible history row.
 * Team and health-check conversations live outside this list.
 */
export const countVisibleCompletionUnread = (
  conversations: TChatConversation[],
  completionUnreadIds: ReadonlySet<string>
): number =>
  conversations.reduce((total, conversation) => total + (completionUnreadIds.has(conversation.id) ? 1 : 0), 0);
