import { Button } from '@arco-design/web-react';
import { Attention, CheckOne, LoadingOne, Refresh } from '@icon-park/react';
import React from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  dismissRuntimeStatus,
  isRuntimeActivePhase,
  retryRuntimeStatus,
  useGlobalRuntimeStatus,
} from './runtimeStatusStore';
import { formatRuntimeScopeLabel, formatRuntimeStatusText } from './runtimeStatusText';

const GlobalRuntimeStatus: React.FC = () => {
  const { t } = useTranslation();
  const status = useGlobalRuntimeStatus();

  if (!status) {
    return null;
  }

  const active = isRuntimeActivePhase(status.phase);
  const failed = status.phase === 'failed';
  const scopeLabel = formatRuntimeScopeLabel(t, status.scope);
  const text = formatRuntimeStatusText(t, status);

  const handleRetry = () => {
    void retryRuntimeStatus(status.scope);
  };

  const handleDismiss = () => {
    dismissRuntimeStatus(status.scope);
  };

  return ReactDOM.createPortal(
    <div className='pointer-events-none fixed left-1/2 top-16px z-9999 w-full max-w-[760px] -translate-x-1/2 px-16px'>
      <div
        className={`pointer-events-auto flex items-center justify-between gap-12px rounded-16px border px-16px py-12px shadow-[0_12px_32px_rgba(15,23,42,0.16)] backdrop-blur-[8px] ${
          active
            ? 'border-primary-3 bg-primary-1/95 text-primary-7'
            : failed
              ? 'border-danger-3 bg-danger-1/95 text-danger-7'
              : 'border-success-3 bg-success-1/95 text-success-7'
        }`}
      >
        <div className='min-w-0 flex items-start gap-10px'>
          <div className='shrink-0 pt-2px'>
            {active ? (
              <LoadingOne className='animate-spin' size={16} />
            ) : failed ? (
              <Attention theme='filled' size={16} />
            ) : (
              <CheckOne theme='filled' size={16} />
            )}
          </div>
          <div className='min-w-0'>
            <div className='mb-4px'>
              <span className='inline-flex items-center rounded-full bg-white/60 px-8px py-2px text-11px leading-16px text-current/80'>
                {scopeLabel}
              </span>
            </div>
            <div className='text-13px leading-20px break-all'>{text}</div>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-8px'>
          {failed ? (
            <Button size='mini' type='text' icon={<Refresh size={14} />} onClick={handleRetry}>
              {t('common.retry')}
            </Button>
          ) : null}
          {failed ? (
            <Button size='mini' type='text' onClick={handleDismiss}>
              {t('common.close')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GlobalRuntimeStatus;
