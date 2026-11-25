/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

type ElementRef = {
  readonly current: HTMLElement | null;
};

type UseFillMessageViewportOptions = {
  conversationId?: string;
  scrollerRef: ElementRef;
  contentRef: ElementRef;
  oldestCursor?: string;
  hasMoreBefore: boolean;
  isLoadingBefore: boolean;
  renderedItemCount: number;
  loadPreviousPage: () => Promise<boolean>;
  isScrollLocked?: () => boolean;
  /** The reader scrolled into the top area and is waiting for older messages. */
  isReaderAtTop?: () => boolean;
  /** The last older-page request failed; wait for the reader's retry. */
  loadFailed?: boolean;
};

/** Distance from the top at which older messages are requested. */
export const PREVIOUS_PAGE_TRIGGER_PX = 160;

const VIEWPORT_HEIGHT_TOLERANCE_PX = 1;

const needsMoreContent = (scroller: HTMLElement): boolean =>
  scroller.clientHeight > 0 && scroller.scrollHeight <= scroller.clientHeight + VIEWPORT_HEIGHT_TOLERANCE_PX;

/**
 * Loads older pages until a collapsed message list becomes scrollable, and
 * keeps loading while the reader stays at the top. A page of tool calls that
 * folds into the top summary adds no height, and a reader already at the top
 * produces no further scroll events to request the next page.
 */
export const useFillMessageViewport = ({
  conversationId,
  scrollerRef,
  contentRef,
  oldestCursor,
  hasMoreBefore,
  isLoadingBefore,
  renderedItemCount,
  loadPreviousPage,
  isScrollLocked,
  isReaderAtTop,
  loadFailed = false,
}: UseFillMessageViewportOptions): void => {
  const attemptedPageRef = useRef<string | undefined>(undefined);
  const activeConversationRef = useRef(conversationId);
  activeConversationRef.current = conversationId;

  useEffect(() => {
    if (!conversationId || !oldestCursor || !hasMoreBefore || isLoadingBefore || loadFailed) return;

    const frame = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller || isScrollLocked?.()) return;
      const readerWaitsAtTop = isReaderAtTop?.() === true && scroller.scrollTop <= PREVIOUS_PAGE_TRIGGER_PX;
      if (!readerWaitsAtTop && !needsMoreContent(scroller)) return;

      const pageKey = `${conversationId}:${oldestCursor}`;
      if (attemptedPageRef.current === pageKey) return;
      attemptedPageRef.current = pageKey;

      const previousHeight = contentRef.current?.scrollHeight ?? scroller.scrollHeight;
      void loadPreviousPage()
        .then((loaded) => {
          if (!loaded || activeConversationRef.current !== conversationId) return;
          requestAnimationFrame(() => {
            if (
              activeConversationRef.current !== conversationId ||
              scrollerRef.current !== scroller ||
              isScrollLocked?.()
            )
              return;
            const nextHeight = contentRef.current?.scrollHeight ?? scroller.scrollHeight;
            scroller.scrollTop += Math.max(0, nextHeight - previousHeight);
          });
        })
        .catch(() => {
          // The page loader reports its own error. Keeping the attempted cursor
          // prevents a failed request from becoming a render-driven retry loop.
        });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    contentRef,
    conversationId,
    hasMoreBefore,
    isLoadingBefore,
    isReaderAtTop,
    isScrollLocked,
    loadFailed,
    loadPreviousPage,
    oldestCursor,
    renderedItemCount,
    scrollerRef,
  ]);
};
