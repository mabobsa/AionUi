/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getParentAndCurrentDir } from '@/renderer/utils/workspace/projectPathLabel';
import React from 'react';

type ProjectGroupHeaderProps = {
  workspace: string;
  displayName: string;
  branch?: string | null;
};

const ProjectGroupHeader: React.FC<ProjectGroupHeaderProps> = ({ workspace, displayName, branch }) => (
  <span className='flex flex-col flex-1 min-w-0 leading-tight'>
    <span className='text-14px font-[500] truncate text-t-primary'>
      {getParentAndCurrentDir(workspace) || displayName}
    </span>
    {branch && <span className='text-11px font-[400] truncate text-t-secondary'>({branch})</span>}
  </span>
);

export default ProjectGroupHeader;
