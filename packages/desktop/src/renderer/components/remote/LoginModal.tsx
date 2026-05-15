/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { Modal, Button } from '@arco-design/web-react';
import { useRemoteAccess } from '@renderer/hooks/remote/useRemoteAccess';
import { Refresh } from '@icon-park/react';

type Step = 'login' | 'logging-in' | 'activate' | 'activating' | 'done';

const GoogleIcon: React.FC = () => (
  <svg width='18' height='18' viewBox='0 0 48 48'>
    <path fill='#EA4335' d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.26 17.74 9.5 24 9.5z' />
    <path fill='#4285F4' d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z' />
    <path fill='#FBBC05' d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z' />
    <path fill='#34A853' d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-3.76-13.47-9.09l-7.98 6.19C6.51 42.62 14.62 48 24 48z' />
  </svg>
);

type StepRowProps = {
  status: 'pending' | 'doing' | 'done';
  text: string;
};

const StepRow: React.FC<StepRowProps> = ({ status, text }) => {
  const iconStyle: React.CSSProperties = {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background:
      status === 'done' ? 'rgba(var(--success-6),0.12)' :
      status === 'doing' ? 'rgba(var(--primary-6),0.12)' :
      'var(--color-fill-2)',
    color:
      status === 'done' ? 'rgb(var(--success-6))' :
      status === 'doing' ? 'rgb(var(--primary-6))' :
      'var(--color-text-3)',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', fontSize: 13, color: status === 'pending' ? 'var(--color-text-3)' : 'var(--color-text-1)' }}>
      <div style={iconStyle}>
        {status === 'done' ? (
          <svg width='12' height='12' viewBox='0 0 48 48' fill='none' stroke='currentColor' strokeWidth='5' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M10 24l10 10 18-18' />
          </svg>
        ) : status === 'doing' ? (
          <svg width='12' height='12' viewBox='0 0 48 48' fill='none' stroke='currentColor' strokeWidth='5' strokeLinecap='round'
            style={{ animation: 'lm-spin 0.8s linear infinite', display: 'block' }}>
            <path d='M24 6v8M24 34v8M42 24h-8M14 24H6' />
          </svg>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600 }}>○</span>
        )}
      </div>
      <span>{text}</span>
    </div>
  );
};

export type LoginModalIntent = 'account' | 'remote';

type Props = {
  visible: boolean;
  intent?: LoginModalIntent;
  onClose: () => void;
  /** Called after login+activate fully done (only when intent='remote') */
  onActivated?: () => void;
};

const LoginModal: React.FC<Props> = ({ visible, intent = 'account', onClose, onActivated }) => {
  const { devSetState } = useRemoteAccess();
  const [step, setStep] = useState<Step>('login');

  const reset = useCallback(() => setStep('login'), []);

  const handleClose = useCallback(() => {
    onClose();
    // delay reset so animation doesn't flash
    setTimeout(reset, 300);
  }, [onClose, reset]);

  // Step 1: click Google login
  const handleLogin = useCallback(() => {
    setStep('logging-in');
    setTimeout(() => {
      // Login success → go to activate step if intent=remote, else done
      if (intent === 'remote') {
        setStep('activate');
        if (devSetState) devSetState('INACTIVE');
      } else {
        setStep('done');
        if (devSetState) devSetState('INACTIVE');
        setTimeout(handleClose, 800);
      }
    }, 1200);
  }, [intent, devSetState, handleClose]);

  // Step 2 (remote only): click enable remote
  const handleActivate = useCallback(() => {
    setStep('activating');
    setTimeout(() => {
      setStep('done');
      if (devSetState) devSetState('ACTIVE');
      onActivated?.();
      setTimeout(handleClose, 1000);
    }, 1500);
  }, [devSetState, onActivated, handleClose]);

  const isProgressing = step === 'logging-in' || step === 'activating';

  return (
    <>
      <style>{`@keyframes lm-spin { to { transform: rotate(360deg); } }`}</style>
      <Modal
        visible={visible}
        onCancel={handleClose}
        footer={null}
        title={step === 'activate' || step === 'activating' || step === 'done' ? '开启远程访问' : '登录 Aion 账号'}
        style={{ width: 400 }}
        maskClosable={!isProgressing}
        closable={!isProgressing}
      >
        {/* ── Step 1: login form ── */}
        {step === 'login' && (
          <div className='flex flex-col gap-12px px-4px pb-8px pt-4px'>
            {/* 权益说明卡 */}
            <div className='rd-10px bg-fill-1 px-14px py-12px flex flex-col gap-8px'>
              {intent === 'remote' ? (
                <>
                  {[
                    { icon: '📱', title: '手机随时访问', desc: '开启后扫码即可在手机浏览器用 Aion' },
                    { icon: '⚡', title: '零配置', desc: '不用 SSH / 内网穿透，局域网直连' },
                    { icon: '🔄', title: '任务不中断', desc: '离开电脑后手机继续看 Agent 进度' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className='flex items-start gap-10px'>
                      <span className='text-16px shrink-0 mt-1px'>{icon}</span>
                      <div>
                        <div className='text-12px font-500 text-t-primary'>{title}</div>
                        <div className='text-11px text-t-tertiary mt-1px'>{desc}</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { icon: '☁️', title: '会话同步', desc: '多设备访问同一份对话历史' },
                    { icon: '📱', title: '手机远程访问', desc: '登录后可开启远程，随时随地用 Aion' },
                    { icon: '🔐', title: '安全登录', desc: '账号体系保护你的数据安全' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className='flex items-start gap-10px'>
                      <span className='text-16px shrink-0 mt-1px'>{icon}</span>
                      <div>
                        <div className='text-12px font-500 text-t-primary'>{title}</div>
                        <div className='text-11px text-t-tertiary mt-1px'>{desc}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            <button
              type='button'
              onClick={handleLogin}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', height: 40, padding: '0 16px',
                background: 'var(--color-bg-1)', border: '1px solid var(--color-fill-3)',
                borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500,
                color: 'var(--color-text-1)', fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-fill-1)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-1)'; }}
            >
              <GoogleIcon />
              <span>使用 Google 账号继续</span>
            </button>
            <Button type='text' size='mini' long className='text-t-tertiary' onClick={handleClose}>取消</Button>
          </div>
        )}

        {/* ── Step 1 in progress ── */}
        {step === 'logging-in' && (
          <div className='px-4px pb-8px pt-4px'>
            <StepRow status='doing' text='正在登录账号…' />
          </div>
        )}

        {/* ── Step 2: activate remote (remote intent only) ── */}
        {step === 'activate' && (
          <div className='flex flex-col gap-12px px-4px pb-8px pt-4px'>
            <StepRow status='done' text='已登录 · demo@aionui.com' />
            <div className='rd-12px border border-line overflow-hidden'>
              <div className='px-14px py-12px bg-fill-1'>
                <div className='text-13px font-500 text-t-primary mb-4px'>开启远程，手机扫码即可访问</div>
                <div className='text-12px text-t-tertiary leading-relaxed'>
                  开启后下方会出现二维码，用手机相机扫一下就能直接打开 Aion
                </div>
              </div>
              <div className='px-14px py-10px border-t border-line'>
                <Button type='primary' size='default' long shape='round' onClick={handleActivate}>
                  开启远程访问
                </Button>
              </div>
            </div>
            <Button type='text' size='mini' long className='text-t-tertiary' onClick={handleClose}>稍后再说</Button>
          </div>
        )}

        {/* ── Step 2 in progress ── */}
        {step === 'activating' && (
          <div className='px-4px pb-8px pt-4px'>
            <StepRow status='done' text='已登录 · demo@aionui.com' />
            <StepRow status='doing' text='正在开启远程访问…' />
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <div className='px-4px pb-8px pt-4px'>
            <StepRow status='done' text='已登录 · demo@aionui.com' />
            {intent === 'remote' && (
              <>
                <StepRow status='done' text='远程访问已开启' />
                <div className='mt-8px px-12px py-10px rd-10px flex items-center gap-10px' style={{ background: 'rgba(var(--success-6),0.08)' }}>
                  <span className='text-18px'>📱</span>
                  <span className='text-12px' style={{ color: 'rgb(var(--success-6))' }}>
                    用手机扫描下方二维码即可访问 Aion
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default LoginModal;
