/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useEffect, useState } from 'react';

/**
 * Parse the current branch name out of a `.git/HEAD` file's contents.
 *
 * - On a branch: `ref: refs/heads/<branch>` → `<branch>`
 * - Detached HEAD: a raw commit SHA → short 7-char hash
 * - Anything else / empty: `null`
 */
const parseGitHead = (raw: string | null): string | null => {
  if (!raw) return null;
  const text = raw.trim();
  const refMatch = text.match(/^ref:\s*refs\/heads\/(.+)$/);
  if (refMatch) return refMatch[1].trim();
  if (/^[0-9a-f]{7,40}$/i.test(text)) return text.slice(0, 7);
  return null;
};

/**
 * Resolve the Git branch for each project workspace by reading its
 * `.git/HEAD` file directly (no git binary required). Returns a map of
 * workspace path → branch name (or `null` when the folder is not a repo).
 */
export const useProjectGitBranches = (workspaces: string[]): Record<string, string | null> => {
  const [branches, setBranches] = useState<Record<string, string | null>>({});
  // Stable dependency so the effect only re-runs when the set of workspaces changes.
  const workspacesKey = workspaces.join('|');

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      workspaces.map(async (workspace) => {
        try {
          const head = await ipcBridge.fs.readFile.invoke({ path: `${workspace}/.git/HEAD`, workspace });
          return [workspace, parseGitHead(head)] as const;
        } catch {
          return [workspace, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setBranches(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacesKey]);

  return branches;
};
