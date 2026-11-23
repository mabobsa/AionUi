import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { isErrorTipMessage } from '@/common/chat/chatLib';
import type { ContextCompaction, TokenUsageData } from '@/common/config/storage';
import { useLatestRef } from '@/renderer/hooks/ui/useLatestRef';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tokenUsageFromAcpUsage } from '../useAcpMessage';
import { hasNewCompaction, mergeCompactionReading, type CompactionPhase } from './state';

export type CompactionOptions = {
  conversationId: string;
  tokenUsage: TokenUsageData;
  disabled: boolean;
  send: (onAccepted: (turnId?: string) => void) => Promise<void>;
};

type Attempt = {
  baseline?: ContextCompaction;
  accepted: boolean;
  turnId?: string;
  startedTurnId?: string;
  terminals: Map<string, boolean>;
  usage: TokenUsageData | null;
  complete: boolean;
  checking: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

const readUsage = async (conversationId: string): Promise<TokenUsageData | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      ipcBridge.conversation.getUsage.invoke({ conversation_id: conversationId }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Usage read timed out')), 10_000);
      }),
    ]);
    return raw ? tokenUsageFromAcpUsage(raw) : null;
  } finally {
    clearTimeout(timer);
  }
};

/** Track a user-requested native compact without touching the send-box draft. */
export const useContextCompaction = (options: CompactionOptions) => {
  const latest = useLatestRef(options);
  const attemptRef = useRef<Attempt | null>(null);
  const [phase, setPhase] = useState<CompactionPhase>('idle');
  const [reading, setReading] = useState<TokenUsageData | null>(options.tokenUsage);

  const observe = useCallback((attempt: Attempt, usage: TokenUsageData | null) => {
    if (attemptRef.current !== attempt || !usage) return;
    attempt.usage = mergeCompactionReading(attempt.usage, usage);
    const ownTurn = attempt.turnId ?? attempt.startedTurnId;
    const matchingTurn = !ownTurn || !attempt.usage.freshness || attempt.usage.freshness.turn_id === ownTurn;
    if (attempt.accepted && (attempt.complete || matchingTurn) && hasNewCompaction(attempt.usage, attempt.baseline)) {
      attempt.complete = true;
      clearTimeout(attempt.timer);
      setReading(attempt.usage);
      setPhase('complete');
    }
  }, []);

  const settle = useCallback(
    async (attempt: Attempt) => {
      if (attemptRef.current !== attempt || !attempt.accepted || attempt.checking || attempt.complete) return;
      const turnId = attempt.turnId ?? attempt.startedTurnId;
      if (!turnId || !attempt.terminals.has(turnId)) return;
      attempt.checking = true;
      clearTimeout(attempt.timer);
      if (attempt.terminals.get(turnId)) {
        setPhase('failed');
        return;
      }
      try {
        observe(attempt, await readUsage(latest.current.conversationId));
      } catch {
        // A read failure is not proof the native command failed.
      }
      if (attemptRef.current === attempt && !attempt.complete) setPhase('unconfirmed');
    },
    [latest, observe]
  );

  useEffect(() => {
    const attempt = attemptRef.current;
    if (attempt) observe(attempt, options.tokenUsage);
    else setReading(options.tokenUsage);
  }, [options.tokenUsage, observe]);

  useEffect(() => {
    const unsubscribe = ipcBridge.acpConversation.responseStream.on((message: IResponseMessage) => {
      const attempt = attemptRef.current;
      if (!attempt || message.conversation_id !== options.conversationId) return;
      if (message.type === 'acp_context_usage') {
        if (message.data && typeof message.data === 'object') {
          observe(attempt, tokenUsageFromAcpUsage(message.data));
        }
        return;
      }
      if (!message.turn_id) return;
      if (message.type === 'start') attempt.startedTurnId ??= message.turn_id;
      if (message.type === 'finish' || message.type === 'error' || isErrorTipMessage(message)) {
        // Buffer terminals that race the HTTP admission response; correlate later.
        if (attempt.terminals.size < 16) attempt.terminals.set(message.turn_id, message.type !== 'finish');
        void settle(attempt);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(attemptRef.current?.timer);
      attemptRef.current = null;
    };
  }, [options.conversationId, observe, settle]);

  const start = useCallback(async () => {
    if (latest.current.disabled || (attemptRef.current && !attemptRef.current.checking && !attemptRef.current.complete))
      return;
    const attempt: Attempt = {
      accepted: false,
      terminals: new Map(),
      usage: null,
      complete: false,
      checking: false,
    };
    clearTimeout(attemptRef.current?.timer);
    attemptRef.current = attempt;
    setPhase('running');
    try {
      // Establish the baseline from persisted state so a late UI hydration cannot
      // turn an old compaction into a false success for this request.
      const baseline = await readUsage(latest.current.conversationId);
      if (attemptRef.current !== attempt) return;
      attempt.baseline = baseline?.compaction;
      const initial = baseline
        ? mergeCompactionReading(latest.current.tokenUsage, baseline)
        : latest.current.tokenUsage;
      attempt.usage = attempt.usage ? mergeCompactionReading(initial, attempt.usage) : initial;
      if (latest.current.disabled) {
        attemptRef.current = null;
        setPhase('idle');
        return;
      }
      attempt.timer = setTimeout(() => {
        if (attemptRef.current === attempt && !attempt.complete) {
          attempt.checking = true;
          setPhase('unconfirmed');
        }
      }, 300_000);
      await latest.current.send((turnId) => {
        if (attemptRef.current !== attempt) return;
        attempt.accepted = true;
        attempt.turnId = turnId;
        observe(attempt, attempt.usage);
        void settle(attempt);
      });
    } catch {
      if (attemptRef.current === attempt) {
        clearTimeout(attempt.timer);
        attempt.checking = true;
        setPhase('failed');
      }
    }
  }, [latest, observe, settle]);

  return { phase, reading, start };
};
