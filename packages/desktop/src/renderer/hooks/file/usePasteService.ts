import type { FileMetadata } from '@/renderer/services/FileService';
import type { UploadSource } from '@/renderer/hooks/file/useUploadState';
import type { ImageCounter } from '@/renderer/services/PasteService';
import { PasteService } from '@/renderer/services/PasteService';
import { ipcBridge } from '@/common';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '@arco-design/web-react';
import { uuid } from '@renderer/utils/common';

interface UsePasteServiceProps {
  supportedExts: string[];
  onFilesAdded?: (files: FileMetadata[]) => void;
  onTextPaste?: (text: string) => void;
  /** Conversation ID for WebUI file uploads */
  conversation_id?: string;
  source?: UploadSource;
}

/**
 * 通用的PasteService集成hook
 * 为所有组件提供统一的粘贴处理功能
 */
export const usePasteService = ({
  supportedExts,
  onFilesAdded,
  onTextPaste,
  conversation_id,
  source = 'sendbox',
}: UsePasteServiceProps) => {
  const { t } = useTranslation();
  const componentId = useRef('paste-service-' + uuid(4)).current;

  // 跨 handlePaste 调用保持的粘贴图片序号。生命周期 = hook 实例 = SendBox mount，
  // 每个 SendBox 独立一个计数器；组件卸载 -> 重建时归零，符合“关闭后归零可接受”。
  const pastedImageCounter = useRef(0);
  const imageCounter = useMemo<ImageCounter>(
    () => ({
      next: () => ++pastedImageCounter.current,
    }),
    []
  );

  // 统一的粘贴事件处理
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      // 检查是否有文件，如果有文件立即阻止默认行为
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
      }

      try {
        const handled = await PasteService.handlePaste(
          event,
          supportedExts,
          onFilesAdded || (() => {}),
          onTextPaste,
          conversation_id,
          source,
          imageCounter
        );
        if (handled && (!files || files.length === 0)) {
          // 如果不是文件粘贴但被处理了（比如纯文本粘贴），也阻止默认行为
          event.preventDefault();
          event.stopPropagation();
        }
        return handled;
      } catch (err) {
        Message.error(t('common.fileAttach.failed'));
        return false;
      }
    },
    [conversation_id, source, supportedExts, onFilesAdded, onTextPaste, imageCounter, t]
  );

  // 焦点处理
  const handleFocus = useCallback(() => {
    PasteService.setLastFocusedComponent(componentId);
  }, [componentId]);

  // Ctrl+Shift+V in a message input: paste the OS clipboard file path(s) as text.
  // The browser paste event exposes the File object but not its OS path, and
  // Ctrl+Shift+V usually fires no file paste at all — so read the paths from the
  // main process (Windows file-drop list) and insert them as text. Desktop only.
  const onTextPasteRef = useRef(onTextPaste);
  onTextPasteRef.current = onTextPaste;
  useEffect(() => {
    if (source !== 'sendbox') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const isPasteAsPath =
        (event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'v' || event.key === 'V');
      if (!isPasteAsPath) return;
      // Only the currently focused paste target acts (every input registers this).
      if (PasteService.getLastFocusedComponent() !== componentId) return;
      const insertText = onTextPasteRef.current;
      if (!insertText) return;
      // OS clipboard file paths are unavailable in the browser (WebUI).
      if (typeof window === 'undefined' || !window.electronAPI) return;
      event.preventDefault();
      void (async () => {
        try {
          const paths = await ipcBridge.application.getClipboardFilePaths.invoke();
          if (!paths || paths.length === 0) return;
          const text = paths.join('\n');
          // Insert via execCommand so the paste is a single native undo step —
          // Ctrl+Z removes the whole path. A setInput-based insert (the
          // onTextPaste fallback) bypasses the textarea's undo stack. The trusted
          // `input` event still drives the controlled component's onChange.
          const activeEl = document.activeElement;
          const isEditable = activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLInputElement;
          if (isEditable && document.execCommand('insertText', false, text)) {
            return;
          }
          insertText(text);
        } catch (error) {
          console.error('Failed to read clipboard file paths:', error);
        }
      })();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [source, componentId]);

  // 注册粘贴处理器
  useEffect(() => {
    PasteService.init();
    PasteService.registerHandler(componentId, handlePaste);

    return () => {
      PasteService.unregisterHandler(componentId);
    };
  }, [componentId, handlePaste]);

  return {
    onFocus: handleFocus,
    onPaste: handlePaste,
  };
};
