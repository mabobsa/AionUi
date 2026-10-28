import { Dropdown, Menu } from '@arco-design/web-react';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChoiceNoticeStore } from '../store';

type MenuTarget = {
  key: string;
  x: number;
  y: number;
  anchor: HTMLElement;
  anchorLeft: number;
  anchorTop: number;
};

/** Share one menu and inspect the current caption-bar snapshot only when a question is right-clicked. */
export default function QuestionContextMenu({ store }: { store: ChoiceNoticeStore }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<MenuTarget | null>(null);
  const notice = useSyncExternalStore(
    store.subscribe,
    () => (target ? store.getSnapshot().find((item) => item.key === target.key) : undefined),
    (): undefined => undefined
  );

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      // Markdown lives in a shadow root: target/closest cannot reach both the question and its message owner.
      const path = event.composedPath().filter((node): node is HTMLElement => node instanceof HTMLElement);
      const boxIndex = path.findIndex((node) => node.hasAttribute('data-choice-marker-index'));
      const box = path[boxIndex];
      const owner = box
        ? path.slice(boxIndex).find((node) => node.hasAttribute('data-choice-conversation-id'))
        : undefined;
      const index = box?.dataset.choiceMarkerIndex;
      const matchingNotice =
        owner && index !== undefined && /^\d+$/.test(index)
          ? store
              .getSnapshot()
              .find(
                (item) =>
                  item.conversationId === owner.dataset.choiceConversationId &&
                  (item.messageId === owner.dataset.choiceMessageId ||
                    item.messageId === owner.dataset.choiceStreamMessageId) &&
                  item.markerIndex === Number(index)
              )
          : undefined;
      if (!matchingNotice) {
        setTarget(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const bounds = box.getBoundingClientRect();
      setTarget({
        key: matchingNotice.key,
        x: event.clientX,
        y: event.clientY,
        anchor: box,
        anchorLeft: bounds.left,
        anchorTop: bounds.top,
      });
    };
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => document.removeEventListener('contextmenu', onContextMenu, true);
  }, [store]);

  useEffect(() => {
    if (target && !notice) setTarget(null);
  }, [target, notice]);

  useEffect(() => {
    if (!target) return;
    const close = () => setTarget(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onScroll = () => {
      // Ignore delayed scroll events and popup scrolling that leave the question in place.
      const bounds = target.anchor.getBoundingClientRect();
      if (!target.anchor.isConnected || bounds.left !== target.anchorLeft || bounds.top !== target.anchorTop) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [target]);

  if (!target || !notice) return null;
  return (
    <Dropdown
      key={`${target.key}:${target.x}:${target.y}`}
      trigger={[]}
      triggerProps={{ duration: 0 }}
      popupVisible
      onVisibleChange={(visible) => {
        if (!visible) setTarget(null);
      }}
      droplist={
        <Menu
          onClickMenuItem={() => {
            store.dismiss(notice.key);
            setTarget(null);
          }}
        >
          <Menu.Item key='dismiss'>{t('conversation.userChoiceNotifications.dismiss')}</Menu.Item>
        </Menu>
      }
    >
      <span aria-hidden='true' className='fixed size-0' style={{ left: target.x, top: target.y }} />
    </Dropdown>
  );
}
