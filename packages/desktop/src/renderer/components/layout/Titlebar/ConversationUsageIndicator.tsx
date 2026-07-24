/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ClaudeUsagePill from './ClaudeUsagePill';
import CodexUsageIndicator from './CodexUsageIndicator';

const ConversationUsageIndicator: React.FC = () => {
  return (
    <>
      <ClaudeUsagePill />
      <CodexUsageIndicator />
    </>
  );
};

export default ConversationUsageIndicator;
