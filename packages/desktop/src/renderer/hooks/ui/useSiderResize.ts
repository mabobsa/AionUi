/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_SIDER_WIDTH = 260;
const DESKTOP_COLLAPSED_WIDTH = 0;
// Desktop sider is resizable by dragging; width is clamped to this range.
const MIN_SIDER_WIDTH = 220;
const MAX_SIDER_WIDTH = 480;
// Dragging below this width snaps the sider to collapsed.
const SIDER_DRAG_SNAP_THRESHOLD = Math.round((MIN_SIDER_WIDTH + DESKTOP_COLLAPSED_WIDTH) / 2);
const SIDER_WIDTH_STORAGE_KEY = 'layout-sider-width';
const MOBILE_SIDER_WIDTH_RATIO = 0.67;
const MOBILE_SIDER_MIN_WIDTH = 260;
const MOBILE_SIDER_MAX_WIDTH = 420;

type UseSiderResizeParams = {
  isMobile: boolean;
  viewportWidth: number;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

type UseSiderResizeResult = {
  /** Effective sider width: viewport-derived on mobile, drag-controlled on desktop. */
  siderWidth: number;
  /** Mouse-down handler for the sider's right-edge resize grip (desktop only). */
  beginSiderResizeDrag: (event: React.MouseEvent<HTMLDivElement>) => void;
};

/**
 * Drag-to-resize behaviour for the desktop sider, isolated from Layout so that
 * upstream changes to Layout.tsx and this customization rarely touch the same
 * lines. Dragging the right edge resizes within [MIN, MAX]; dragging below the
 * snap threshold collapses the sider. The width persists to localStorage.
 */
export const useSiderResize = ({
  isMobile,
  viewportWidth,
  collapsed,
  setCollapsed,
}: UseSiderResizeParams): UseSiderResizeResult => {
  // Desktop sider width (resizable by dragging the right edge), restored from localStorage.
  const [desktopSiderWidth, setDesktopSiderWidth] = useState<number>(() => {
    const stored = Number(typeof window === 'undefined' ? NaN : localStorage.getItem(SIDER_WIDTH_STORAGE_KEY));
    return stored >= MIN_SIDER_WIDTH && stored <= MAX_SIDER_WIDTH ? stored : DEFAULT_SIDER_WIDTH;
  });
  const desktopSiderWidthRef = useRef(desktopSiderWidth);
  useEffect(() => {
    desktopSiderWidthRef.current = desktopSiderWidth;
  }, [desktopSiderWidth]);

  // Mirror `collapsed` into a ref so the global mouse listeners read the latest value.
  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const dragStateRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: DEFAULT_SIDER_WIDTH,
  });

  const siderWidth = isMobile
    ? Math.max(
        MOBILE_SIDER_MIN_WIDTH,
        Math.min(MOBILE_SIDER_MAX_WIDTH, Math.round(viewportWidth * MOBILE_SIDER_WIDTH_RATIO))
      )
    : desktopSiderWidth;

  const beginSiderResizeDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      event.preventDefault();
      dragStateRef.current = {
        active: true,
        startX: event.clientX,
        startWidth: collapsedRef.current ? DESKTOP_COLLAPSED_WIDTH : desktopSiderWidthRef.current,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [isMobile]
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState.active) return;

      const draggedWidth = dragState.startWidth + (event.clientX - dragState.startX);
      // Below the snap threshold → collapse; otherwise expand and resize within bounds.
      if (draggedWidth <= SIDER_DRAG_SNAP_THRESHOLD) {
        if (!collapsedRef.current) setCollapsed(true);
        return;
      }
      if (collapsedRef.current) setCollapsed(false);
      setDesktopSiderWidth(Math.min(MAX_SIDER_WIDTH, Math.max(MIN_SIDER_WIDTH, draggedWidth)));
    };

    const endDrag = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(SIDER_WIDTH_STORAGE_KEY, String(desktopSiderWidthRef.current));
      } catch {
        // ignore storage errors
      }
    };

    const handleBlur = () => endDrag();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', handleBlur);
      endDrag();
    };
  }, [setCollapsed]);

  return { siderWidth, beginSiderResizeDrag };
};
