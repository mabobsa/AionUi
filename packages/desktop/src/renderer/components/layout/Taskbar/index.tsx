/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useConversationListSync } from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { renderTaskbarBadgeIcon } from './taskbarBadge';
import { useEffect } from 'react';

/**
 * Sends the unread completion count to the main process for the taskbar or Dock badge.
 *
 * Rendered as a null component so store updates re-render only this node, not
 * the whole Layout tree.
 */
const TaskbarBadgeSync: React.FC = () => {
  const { completionUnreadCount } = useConversationListSync();

  useEffect(() => {
    if (!isElectronDesktop()) return;
    const iconDataUrl = renderTaskbarBadgeIcon(completionUnreadCount);
    void ipcBridge.application.setTaskbarBadge.invoke({ count: completionUnreadCount, iconDataUrl }).catch(() => {});
  }, [completionUnreadCount]);

  return null;
};

export default TaskbarBadgeSync;
