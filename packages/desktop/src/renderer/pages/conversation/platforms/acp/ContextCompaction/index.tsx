import ContextUsageIndicator from '@/renderer/components/agent/ContextUsageIndicator';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isAwaitingCompactedUsage } from './state';
import { useContextCompaction, type CompactionOptions } from './useContextCompaction';

/** Claude's native compaction action beside the shared, agent-reported usage ring. */
const ContextCompaction: React.FC<CompactionOptions & { contextLimit: number }> = (props) => {
  const { t } = useTranslation();
  const { phase, reading, start } = useContextCompaction(props);
  const pending = phase === 'running';
  const waiting = isAwaitingCompactedUsage(phase === 'complete' ? reading : props.tokenUsage);
  const status = pending
    ? t('conversation.contextUsage.compactRunning')
    : phase === 'failed'
      ? t('conversation.contextUsage.compactFailed')
      : phase === 'unconfirmed'
        ? t('conversation.contextUsage.compactUnconfirmed')
        : waiting
          ? t('conversation.contextUsage.compactWaiting')
          : phase === 'complete'
            ? t('conversation.contextUsage.compactComplete')
            : undefined;

  return (
    <ContextUsageIndicator
      tokenUsage={phase === 'complete' ? (reading ?? props.tokenUsage) : props.tokenUsage}
      context_limit={props.contextLimit}
      activityLabel={status}
      busy={pending}
      awaitingUsage={waiting}
      footer={
        <div className='mt-8px flex flex-col gap-6px max-w-280px'>
          {status && (
            <div role='status' className='text-12px text-t-secondary'>
              {status}
            </div>
          )}
          <Button
            type='secondary'
            size='small'
            long
            loading={pending}
            disabled={props.disabled || pending}
            onClick={() => void start()}
          >
            {t('conversation.contextUsage.compactNow')}
          </Button>
          <div className='text-12px text-t-secondary'>
            {props.disabled && !pending
              ? t('conversation.contextUsage.compactBusy')
              : t('conversation.contextUsage.compactHint')}
          </div>
        </div>
      }
    />
  );
};

export default ContextCompaction;
