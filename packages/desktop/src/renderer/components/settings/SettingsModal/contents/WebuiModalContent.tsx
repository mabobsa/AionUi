/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { WEBUI_DEFAULT_PORT } from '@/common/config/constants';
import { shell, webui, type IWebUIStatus } from '@/common/adapter/ipcBridge';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { configService } from '@/common/config/configService';
import AionModal from '@/renderer/components/base/AionModal';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import ChannelDingTalkLogo from '@/renderer/assets/channel-logos/dingtalk.svg';
import ChannelDiscordLogo from '@/renderer/assets/channel-logos/discord.svg';
import ChannelLarkLogo from '@/renderer/assets/channel-logos/lark.svg';
import ChannelSlackLogo from '@/renderer/assets/channel-logos/slack.svg';
import ChannelTelegramLogo from '@/renderer/assets/channel-logos/telegram.svg';
import ChannelWecomLogo from '@/renderer/assets/channel-logos/wecom.svg';
import ChannelWeixinLogo from '@/renderer/assets/channel-logos/weixin.svg';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { Button, Collapse, Form, Input, Message, Switch, Tabs, Tooltip } from '@arco-design/web-react';
import { CheckOne, Communication, Copy, Down, Earth, EditTwo, Refresh, Up } from '@icon-park/react';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSettingsViewMode } from '../settingsViewContext';
import { useRemoteAccess } from '@renderer/hooks/remote/useRemoteAccess';
import LoginModal from '@renderer/components/remote/LoginModal';

/**
 * 偏好设置行组件
 * Preference row component
 */
const PreferenceRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, description, extra, children }) => (
  <div className='flex items-center justify-between gap-12px py-12px'>
    <div className='min-w-0 flex-1'>
      <div className='flex items-center gap-8px'>
        <span className='text-14px text-t-primary'>{label}</span>
        {extra}
      </div>
      {description && <div className='text-12px text-t-tertiary mt-2px'>{description}</div>}
    </div>
    <div className='flex items-center shrink-0'>{children}</div>
  </div>
);

const CHANNEL_LOGOS = [
  { src: ChannelTelegramLogo, alt: 'Telegram' },
  { src: ChannelLarkLogo, alt: 'Lark' },
  { src: ChannelDingTalkLogo, alt: 'DingTalk' },
  { src: ChannelWeixinLogo, alt: 'WeChat' },
  { src: ChannelWecomLogo, alt: 'WeCom' },
  { src: ChannelSlackLogo, alt: 'Slack' },
  { src: ChannelDiscordLogo, alt: 'Discord' },
] as const;

const ChannelModalContentLazy = React.lazy(() => import('./channels/ChannelModalContent'));
const QRCodeSVGLazy = React.lazy(async () => {
  const mod = await import('qrcode.react');
  return { default: mod.QRCodeSVG };
});

const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';

/** 远程访问状态+操作区，所有状态统一 pill 形态 */
const RemoteControlArea: React.FC<{
  remoteState: 'GUEST' | 'INACTIVE' | 'ACTIVE' | 'OFFLINE';
  isLinking: boolean;
  loading: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReconnect: () => void;
}> = ({ remoteState, isLinking, loading, onEnable, onDisable, onReconnect }) => {
  const pillBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 26, padding: '0 11px', borderRadius: 100,
    fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
  };
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 32, padding: '0 16px', borderRadius: 100,
    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
    fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s', opacity: loading ? 0.5 : 1,
  };

  if (isLinking) {
    return (
      <span style={{ ...pillBase, background: 'rgba(var(--primary-6),0.08)', color: 'rgb(var(--primary-6))' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgb(var(--primary-6))', flexShrink: 0, animation: 'pulse 1s infinite' }} />
        连接中…
      </span>
    );
  }

  if (remoteState === 'ACTIVE') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...pillBase, background: 'rgba(var(--success-6),0.10)', color: 'rgb(var(--success-6))' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgb(var(--success-6))', flexShrink: 0 }} />
          已开启
        </span>
        <button
          type='button' disabled={loading} onClick={onDisable}
          style={{ ...btnBase, border: '1px solid rgba(var(--danger-6),0.35)', background: 'transparent', color: 'rgb(var(--danger-6))' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(var(--danger-6),0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >关闭</button>
      </div>
    );
  }

  if (remoteState === 'OFFLINE') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...pillBase, background: 'rgba(var(--warning-6),0.10)', color: 'rgb(var(--warning-6))' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgb(var(--warning-6))', flexShrink: 0 }} />
          已开启
        </span>
        <button
          type='button' disabled={loading} onClick={onReconnect}
          style={{ ...btnBase, border: '1px solid rgba(var(--warning-6),0.35)', background: 'transparent', color: 'rgb(var(--warning-6))' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(var(--warning-6),0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >重连</button>
      </div>
    );
  }

  // INACTIVE
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ ...pillBase, background: 'var(--color-fill-2)', color: 'var(--color-text-3)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-4)', flexShrink: 0 }} />
        未开启
      </span>
      <button
        type='button' disabled={loading}
        onClick={onEnable}
        style={{ ...btnBase, border: 'none', background: 'rgb(var(--primary-6))', color: '#fff' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgb(var(--primary-7))'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgb(var(--primary-6))'; }}
      >开启</button>
    </div>
  );
};

/**
 * WebUI 设置内容组件
 * WebUI settings content component
 */
const WebuiModalContent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewMode = useSettingsViewMode();
  const { state: remoteState, username: remoteUsername, networkUrl: remoteNetworkUrl } = useRemoteAccess();
  // dev 模式下以 mock state 为准，prod 以 allowRemotePreference 为准
  const effectiveRemoteOn = remoteState === 'ACTIVE' || remoteState === 'OFFLINE';
  const isPageMode = viewMode === 'page';
  const [activeTab, setActiveTab] = useState<'webui' | 'channels'>('webui');
  // linking 过渡态：开关拨动后短暂显示「建立连接中」动画
  const [isLinking, setIsLinking] = useState(false);
  const linkingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [qrHighlight, setQrHighlight] = useState(false);
  const qrSectionRef = useRef<HTMLDivElement>(null);

  // 检测是否在 Electron 桌面环境 / Check if running in Electron desktop environment
  const isDesktop = isElectronDesktop();

  const [status, setStatus] = useState<IWebUIStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const port = WEBUI_DEFAULT_PORT;
  const [webuiEnabled, setWebuiEnabled] = useState(false);
  const [lanExpanded, setLanExpanded] = useState(false);
  const [allowRemotePreference, setAllowRemotePreference] = useState(false);
  const [cachedIP, setCachedIP] = useState<string | null>(null);
  const [cachedPassword, setCachedPassword] = useState<string | null>(null);
  // 标记密码是否可以明文显示（首次启动且未复制过）/ Flag for plaintext password display (first startup and not copied)
  const [canShowPlainPassword, setCanShowPlainPassword] = useState(false);
  // 设置新密码弹窗 / Set new password modal
  const [setPasswordModalVisible, setSetPasswordModalVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [setUsernameModalVisible, setSetUsernameModalVisible] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [form] = Form.useForm();
  const [usernameForm] = Form.useForm();

  // 二维码登录相关状态 / QR code login related state
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const qrRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载状态 / Load status
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const savedAllowRemote = configService.get(DESKTOP_WEBUI_ALLOW_REMOTE_KEY) ?? false;
      setAllowRemotePreference(savedAllowRemote === true);

      // getStatus goes via IPC to the Electron main process which tracks the
      // WebUI lifecycle; backend does not know it's being wrapped.
      const statusData: IWebUIStatus | null = await webui.getStatus.invoke();

      if (statusData) {
        setStatus(statusData);
        // Switch must track the *real* server state, not the persisted
        // preference. Reading `webui.desktop.enabled` from config and using it
        // as the Switch's checked value used to make the Switch look "on" when
        // the main-process auto-restore silently failed (port conflict, etc.),
        // so users clicked the saved URL and got a white screen because 25808
        // was empty. The main process is the sole writer of this key — the
        // start/stop IPC providers and restoreDesktopWebUIFromPreferences own
        // reconciliation, so the renderer only reads `running` and never
        // writes the flag back.
        setWebuiEnabled(statusData.running);

        if (statusData.lanIP) {
          setCachedIP(statusData.lanIP);
        } else if (statusData.networkUrl) {
          const match = statusData.networkUrl.match(/http:\/\/([^:]+):/);
          if (match) {
            setCachedIP(match[1]);
          }
        }
        if (statusData.initialPassword) {
          setCachedPassword(statusData.initialPassword);
          // 有初始密码说明可以显示明文 / Having initial password means can show plaintext
          setCanShowPlainPassword(true);
        }
        // 注意：如果 running 但没有密码，会在下面的 useEffect 中自动重置
        // Note: If running but no password, auto-reset will be triggered in the useEffect below
      } else {
        // getStatus failed — fall back to treating server as stopped rather
        // than believing a possibly-stale config flag.
        setWebuiEnabled(false);
        setStatus(
          (prev) =>
            prev || {
              running: false,
              port: WEBUI_DEFAULT_PORT,
              allowRemote: false,
              localUrl: `http://localhost:${WEBUI_DEFAULT_PORT}`,
              adminUsername: 'admin',
            }
        );
      }
    } catch (error) {
      console.error('[WebuiModal] Failed to load WebUI status:', error);
      setWebuiEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // 监听状态变更事件 / Listen to status change events
  useEffect(() => {
    const unsubscribe = webui.statusChanged.on((data) => {
      // Keep the Switch checkbox in lock-step with the actual server state so
      // a main-process auto-restore (or external stop) is reflected in the UI
      // without a page reload.
      setWebuiEnabled(data.running === true);
      if (data.running) {
        setStatus((prev) => ({
          ...(prev || { adminUsername: 'admin' }),
          running: true,
          port: data.port ?? prev?.port ?? WEBUI_DEFAULT_PORT,
          allowRemote: prev?.allowRemote ?? false,
          localUrl: data.localUrl ?? `http://localhost:${data.port ?? WEBUI_DEFAULT_PORT}`,
          networkUrl: data.networkUrl,
          lanIP: prev?.lanIP,
          initialPassword: prev?.initialPassword,
        }));
        if (data.networkUrl) {
          const match = data.networkUrl.match(/http:\/\/([^:]+):/);
          if (match) setCachedIP(match[1]);
        }
      } else {
        setStatus((prev) => (prev ? { ...prev, running: false } : null));
      }
    });
    return () => unsubscribe();
  }, []);

  // 注意：不再自动重置密码，用户已有密码存储在数据库中
  // Note: No longer auto-reset password, user already has password stored in database
  // 如果用户忘记密码，可以手动点击重置按钮
  // If user forgets password, they can manually click reset button
  useEffect(() => {
    // 仅在组件首次加载且没有显示过密码时，标记为密文状态
    // Only when component first loads and password hasn't been shown, mark as hidden
    if (status?.running && !status?.initialPassword && !cachedPassword && !loading) {
      // 不自动重置，只是确保密码显示为 ******
      // Don't auto-reset, just ensure password shows as ******
      setCanShowPlainPassword(false);
    }
  }, [status?.running, status?.initialPassword, cachedPassword, loading]);

  // 获取当前 IP 地址 / Get current IP
  const getLocalIP = useCallback(() => {
    if (status?.lanIP) return status.lanIP;
    if (cachedIP) return cachedIP;
    if (status?.networkUrl) {
      const match = status.networkUrl.match(/http:\/\/([^:]+):/);
      if (match) return match[1];
    }
    return null;
  }, [status?.lanIP, cachedIP, status?.networkUrl]);

  // 获取显示的 URL / Get display URL
  const getDisplayUrl = useCallback(() => {
    const currentIP = getLocalIP();
    const currentPort = status?.port || port;
    const useRemote = status?.running ? status.allowRemote : allowRemotePreference;
    if (useRemote && currentIP) {
      return `http://${currentIP}:${currentPort}`;
    }
    return `http://localhost:${currentPort}`;
  }, [allowRemotePreference, getLocalIP, status?.allowRemote, status?.port, status?.running, port]);

  // 启动/停止 WebUI / Start/Stop WebUI
  const handleToggle = async (enabled: boolean) => {
    // 使用缓存的 IP，不再阻塞获取 / Use cached IP, no longer block to fetch
    const currentIP = getLocalIP();

    // 保存原始值用于回滚 / Save original value for rollback
    const previousEnabled = webuiEnabled;

    // 立即显示 loading / Immediately show loading
    setStartLoading(true);
    setWebuiEnabled(enabled);

    try {
      if (enabled) {
        const localUrl = `http://localhost:${port}`;

        // Await the real result — Promise.race with a 3s fallback used to hide
        // backend failures behind a fake "started" toast while the server was
        // still RESOLVING or had crashed, leaving webui.desktop.enabled unset.
        const startResult = await webui.start.invoke({ port, allowRemote: allowRemotePreference });

        const responseIP = startResult.lanIP || currentIP;
        const responsePassword = startResult.initialPassword;

        if (responseIP) setCachedIP(responseIP);
        if (responsePassword) {
          setCachedPassword(responsePassword);
          setCanShowPlainPassword(true);
        }

        setStatus((prev) => ({
          ...(prev || { adminUsername: 'admin' }),
          running: true,
          port,
          allowRemote: allowRemotePreference,
          localUrl,
          networkUrl: allowRemotePreference && responseIP ? `http://${responseIP}:${port}` : undefined,
          lanIP: responseIP,
          initialPassword: responsePassword || cachedPassword || prev?.initialPassword,
        }));

        await configService.set(DESKTOP_WEBUI_ENABLED_KEY, true);
        Message.success(t('settings.webui.startSuccess'));
      } else {
        // 立即更新UI，异步停止服务器 / Update UI immediately, stop server async
        setStatus((prev) => (prev ? { ...prev, running: false } : null));
        await configService.set(DESKTOP_WEBUI_ENABLED_KEY, false);
        Message.success(t('settings.webui.stopSuccess'));
        webui.stop.invoke().catch((err) => console.error('WebUI stop error:', err));
      }
    } catch (error) {
      // 回滚 UI 状态 / Rollback UI state
      setWebuiEnabled(previousEnabled);
      console.error('Toggle WebUI error:', error);
      Message.error(t('settings.webui.operationFailed'));
    } finally {
      setStartLoading(false);
    }
  };

  // 处理允许远程访问切换 / Handle allow remote toggle
  // 需要重启服务器才能更改绑定地址 / Need to restart server to change binding address
  const handleAllowRemoteChange = async (checked: boolean) => {
    // 开启时触发 linking 过渡动画
    if (checked) {
      if (linkingTimerRef.current) clearTimeout(linkingTimerRef.current);
      setIsLinking(true);
      linkingTimerRef.current = setTimeout(() => setIsLinking(false), 2000);
    } else {
      setIsLinking(false);
    }
    // 保存原始值用于回滚 / Save original value for rollback
    const previousAllowRemote = allowRemotePreference;
    setAllowRemotePreference(checked);

    const wasRunning = status?.running;

    // 如果服务器正在运行，需要重启以应用新的绑定设置
    // If server is running, need to restart to apply new binding settings
    if (wasRunning) {
      setStartLoading(true);
      try {
        // 1. 先停止服务器 / First stop the server
        try {
          await Promise.race([webui.stop.invoke(), new Promise((resolve) => setTimeout(resolve, 1500))]);
        } catch (err) {
          console.error('WebUI stop error:', err);
        }

        // Await the real result — a 3s race fallback used to mask backend
        // failures as success (see handleToggle).
        const startResult = await webui.start.invoke({ port, allowRemote: checked });

        const responseIP = startResult.lanIP;
        const responsePassword = startResult.initialPassword;

        if (responseIP) setCachedIP(responseIP);
        if (responsePassword) setCachedPassword(responsePassword);

        setStatus((prev) => ({
          ...(prev || { adminUsername: 'admin' }),
          running: true,
          port,
          allowRemote: checked,
          localUrl: `http://localhost:${port}`,
          networkUrl: checked && responseIP ? `http://${responseIP}:${port}` : undefined,
          lanIP: responseIP,
          initialPassword: responsePassword || cachedPassword || prev?.initialPassword,
        }));

        await configService.set(DESKTOP_WEBUI_ALLOW_REMOTE_KEY, checked);
        Message.success(t('settings.webui.restartSuccess'));
      } catch (error) {
        // 回滚 UI 状态 / Rollback UI state
        setAllowRemotePreference(previousAllowRemote);
        console.error('[WebuiModal] Restart error:', error);
        Message.error(t('settings.webui.operationFailed'));
      } finally {
        setStartLoading(false);
      }
    } else {
      // 服务器未运行，直接持久化 / Server not running, persist directly
      try {
        await configService.set(DESKTOP_WEBUI_ALLOW_REMOTE_KEY, checked);

        // 获取 IP 用于显示 / Get IP for display
        let newIP: string | undefined;
        try {
          const snapshot = await webui.getStatus.invoke();
          if (snapshot?.lanIP) {
            newIP = snapshot.lanIP;
            setCachedIP(newIP);
          }
        } catch {
          // ignore
        }

        const existingIP = newIP || cachedIP || status?.lanIP;
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                allowRemote: checked,
                lanIP: existingIP || prev.lanIP,
                networkUrl: checked && existingIP ? `http://${existingIP}:${port}` : undefined,
              }
            : null
        );
      } catch (error) {
        // 回滚 UI 状态 / Rollback UI state
        setAllowRemotePreference(previousAllowRemote);
        console.error('[WebuiModal] Failed to persist allowRemote:', error);
        Message.error(t('settings.webui.operationFailed'));
      }
    }
  };

  // 复制内容 / Copy content
  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess'));
  };

  // 打开设置新密码弹窗 / Open set new password modal
  const handleResetPassword = () => {
    form.resetFields();
    setSetPasswordModalVisible(true);
  };

  const handleResetUsername = () => {
    usernameForm.setFieldsValue({
      newUsername: status?.adminUsername || 'admin',
    });
    setSetUsernameModalVisible(true);
  };

  // 提交新密码 / Submit new password
  const handleSetNewPassword = async () => {
    try {
      const values = await form.validate();
      setPasswordLoading(true);

      // changePassword goes through httpBridge; on 4xx/5xx it throws
      // BackendHttpError, caught below and translated via errorCodeMap.
      await webui.changePassword.invoke({
        newPassword: values.newPassword,
      });
      Message.success(t('settings.webui.passwordChanged'));
      setSetPasswordModalVisible(false);
      form.resetFields();
      // 更新缓存的密码为新密码，不再显示明文 / Update cached password, no longer show plaintext
      setCachedPassword(values.newPassword);
      setCanShowPlainPassword(false);
      setStatus((prev) => (prev ? { ...prev, initialPassword: undefined } : null));
    } catch (error) {
      console.error('Set new password error:', error);
      const errorCodeMap: Record<string, string> = {
        PASSWORD_TOO_SHORT: t('settings.webui.passwordTooShort'),
        PASSWORD_TOO_LONG: t('settings.webui.passwordTooLong'),
        PASSWORD_TOO_COMMON: t('settings.webui.passwordTooCommon'),
      };
      const rawMsg =
        isBackendHttpError(error) && error.backendMessage
          ? error.backendMessage
          : error instanceof Error
            ? error.message
            : '';
      const codes = rawMsg.split('; ');
      const translated = codes.map((code) => errorCodeMap[code]).filter(Boolean);
      Message.error(translated.length > 0 ? translated.join('; ') : rawMsg || t('settings.webui.passwordChangeFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSetNewUsername = async () => {
    try {
      const values = await usernameForm.validate();
      setUsernameLoading(true);

      // HTTP bridge: changeUsername returns { username: string } directly;
      // httpBridge throws BackendHttpError on 4xx/5xx — caught below.
      const result = await webui.changeUsername.invoke({
        newUsername: values.newUsername,
      });
      const nextUsername = result?.username ?? values.newUsername.trim();
      Message.success(t('settings.webui.usernameChanged'));
      setSetUsernameModalVisible(false);
      usernameForm.resetFields();
      setStatus((prev) => (prev ? { ...prev, adminUsername: nextUsername } : null));
    } catch (error) {
      console.error('Set new username error:', error);
      const fallback = t('settings.webui.usernameChangeFailed');
      const msg = isBackendHttpError(error) && error.backendMessage ? error.backendMessage : fallback;
      Message.error(msg);
    } finally {
      setUsernameLoading(false);
    }
  };

  // 生成二维码 / Generate QR code
  const generateQRCode = useCallback(async () => {
    if (!status?.running) return;

    setQrLoading(true);
    try {
      // Backend returns only { token, expires_at_ms }; the scannable URL is
      // composed here from the current status so it points at the right host
      // (networkUrl for remote-enabled servers, localUrl otherwise).
      const qrData = await webui.generateQRToken.invoke();

      if (qrData) {
        const baseUrl =
          status.allowRemote && status.networkUrl
            ? status.networkUrl
            : (status.localUrl ?? `http://localhost:${status.port ?? port}`);
        setQrUrl(`${baseUrl}/qr-login?token=${qrData.token}`);
        setQrExpiresAt(qrData.expires_at_ms);

        // 设置自动刷新定时器（4分钟后自动刷新，因为 token 5分钟过期）
        // Set auto-refresh timer (refresh after 4 minutes, as token expires in 5 minutes)
        if (qrRefreshTimerRef.current) {
          clearTimeout(qrRefreshTimerRef.current);
        }
        qrRefreshTimerRef.current = setTimeout(
          () => {
            void generateQRCode();
          },
          4 * 60 * 1000
        );
      } else {
        console.error('Generate QR code failed: no data returned');
        Message.error(t('settings.webui.qrGenerateFailed'));
      }
    } catch (error) {
      console.error('Generate QR code error:', error);
      Message.error(t('settings.webui.qrGenerateFailed'));
    } finally {
      setQrLoading(false);
    }
  }, [status?.running, status?.allowRemote, status?.networkUrl, status?.localUrl, status?.port, port, t]);

  // 当服务器启动且允许远程访问时自动生成二维码
  useEffect(() => {
    if (status?.running && effectiveRemoteOn && !qrUrl) {
      void generateQRCode();
    }
    // 清理定时器 / Cleanup timer
    return () => {
      if (qrRefreshTimerRef.current) {
        clearTimeout(qrRefreshTimerRef.current);
      }
    };
  }, [status?.allowRemote, status?.running, generateQRCode, qrUrl]);

  // 服务器停止或关闭远程时清除二维码
  useEffect(() => {
    if (!status?.running || !effectiveRemoteOn) {
      setQrUrl(null);
      setQrExpiresAt(null);
      if (qrRefreshTimerRef.current) {
        clearTimeout(qrRefreshTimerRef.current);
        qrRefreshTimerRef.current = null;
      }
    }
  }, [status?.allowRemote, status?.running]);

  // 清理 linking timer
  useEffect(() => {
    return () => {
      if (linkingTimerRef.current) clearTimeout(linkingTimerRef.current);
    };
  }, []);

  // 重连：恢复连接后高亮二维码区域并滚动到视图
  const handleReconnect = useCallback(async () => {
    await handleAllowRemoteChange(true);
    // 等状态更新后再高亮
    setTimeout(() => {
      setQrHighlight(true);
      qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setQrHighlight(false), 2000);
    }, 300);
    Message.success('已重连，请用手机扫描二维码访问');
  }, [handleAllowRemoteChange]);

  // 格式化过期时间 / Format expiration time
  const formatExpiresAt = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  // 获取实际密码 / Get actual password
  const actualPassword = status?.initialPassword || cachedPassword;
  // 获取显示的密码 / Get display password
  // 密码默认显示 ***，只在首次启动时显示明文 / Password shows *** by default, only show plaintext on first startup
  // 重置中显示加载状态 / Show loading state when resetting
  const getDisplayPassword = () => {
    // 可以显示明文且有密码时显示明文 / Show plaintext when allowed and has password
    if (canShowPlainPassword && actualPassword) return actualPassword;
    // 否则显示 ****** / Otherwise show ******
    return t('settings.webui.passwordHidden');
  };
  const displayPassword = getDisplayPassword();
  const displayUsername = status?.adminUsername || 'admin';

  // 浏览器端只显示 Channels 配置，不显示 WebUI 服务配置 / In browser mode, only show Channels config, not WebUI service config
  if (!isDesktop) {
    return (
      <div className='flex flex-col h-full w-full'>
        <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
          <div className='space-y-16px'>
            <h2 className='text-20px font-500 text-t-primary m-0'>Channels</h2>
            <Suspense fallback={<div className='text-13px text-t-secondary'>{t('common.loading')}</div>}>
              <ChannelModalContentLazy />
            </Suspense>
          </div>
        </AionScrollArea>
      </div>
    );
  }

  const webuiPanel = (
    <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
      <div className='space-y-12px px-[12px] md:px-[28px]'>
        {/* 标题 / Title — 缩进与卡片内容左侧 padding 对齐 */}
        <div className='px-[12px] md:px-[28px]'>
          <h2 className='text-20px font-500 text-t-primary m-0'>WebUI</h2>
          <p className='m-0 mt-4px text-13px text-t-secondary leading-relaxed'>
            一键开启远程访问，在任意设备打开你的 AionUi
          </p>
        </div>

        {/* Messaging 强引导入口 / Messaging primary entry — disabled, kept for future use
        <div className='rd-12px border border-line bg-2 px-12px py-10px flex items-center justify-between gap-10px'>
            <div className='min-w-0 flex items-center gap-8px'>
              <Communication theme='outline' size='18' className='text-[rgb(var(--primary-6))] shrink-0' />
              <div className='min-w-0'>
                <div className='text-13px text-t-primary font-500'>{t('settings.webui.featureChannelsTitle')}</div>
                <div className='text-12px text-t-secondary truncate'>{t('settings.webui.featureChannelsDesc')}</div>
              </div>
            </div>
            <Button type='primary' size='small' className='rd-100px' onClick={() => setActiveTab('channels')}>
              {t('settings.webui.goToChannels')}
            </Button>
          </div>
        */}

        {/* ── 主卡：远程访问 ── */}
        <div className='px-[12px] md:px-[28px] py-14px bg-2 rd-16px'>
          {/* 标题行：图标 + 标题 + 描述 + CTA */}
          <div className='flex items-center justify-between gap-12px'>
            <div className='flex items-center gap-12px min-w-0 flex-1'>
              <div
                className='size-44px rd-12px flex items-center justify-center shrink-0'
                style={{ background: 'linear-gradient(135deg, rgba(var(--success-6),0.16), rgba(var(--success-6),0.06))', color: 'rgb(var(--success-6))' }}
              >
                <Earth theme='outline' size='22' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='text-15px font-600 text-t-primary leading-22px'>远程访问</div>
                <div className='text-12px text-t-tertiary mt-2px leading-18px'>
                  在任意网络通过专属地址访问，由 Aion 安全中继
                </div>
              </div>
            </div>
            <div className='shrink-0'>
              <RemoteControlArea
                remoteState={remoteState}
                isLinking={isLinking}
                loading={startLoading}
                onEnable={() => void handleAllowRemoteChange(true)}
                onDisable={() => void handleAllowRemoteChange(false)}
                onReconnect={() => void handleReconnect()}
              />
            </div>
          </div>

          {/* 状态详情区 */}
          <div className='mt-14px'>
              {isLinking ? (
                /* LINKING 过渡 */
                <div className='rd-12px border px-14px py-12px flex flex-col gap-8px' style={{ background: 'rgba(var(--primary-6),0.04)', borderColor: 'rgba(var(--primary-6),0.12)' }}>
                  <div className='flex items-center gap-8px text-13px' style={{ color: 'rgb(var(--success-6))' }}>
                    <span>✓</span><span>账号登录成功 · {remoteUsername}</span>
                  </div>
                  <div className='flex items-center gap-8px text-13px' style={{ color: 'rgb(var(--primary-6))' }}>
                    <Refresh size={13} className='animate-spin shrink-0' /><span>正在建立连接，请稍候…</span>
                  </div>
                </div>

              ) : remoteState === 'GUEST' || remoteState === 'INACTIVE' ? (
                /* INACTIVE — 卖点列表（缩进对齐到主标题文字起点 = 44 + 12 = 56px） */
                <div className='flex flex-col gap-8px pl-56px'>
                  {[
                    { icon: '📱', text: '手机、平板直接用浏览器打开，无需安装 App' },
                    { icon: '⚡', text: '局域网内扫码自动登录，不用输密码' },
                    { icon: '🔒', text: '不用配 SSH / 内网穿透，零配置开启' },
                  ].map(({ icon, text }) => (
                    <div key={text} className='flex items-center gap-8px text-12px text-t-secondary leading-18px'>
                      <span className='shrink-0 text-13px'>{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

              ) : remoteState === 'ACTIVE' ? (
                /* ACTIVE — 远程 QR 卡（含 QR + 专属地址）*/
                status?.running && effectiveRemoteOn ? (
                  <div
                    ref={qrSectionRef}
                    className='rd-10px border border-line bg-fill-1 px-12px py-12px flex flex-col items-center gap-10px'
                    style={{
                      transition: 'box-shadow 0.3s, background 0.3s',
                      ...(qrHighlight ? {
                        background: 'rgba(var(--success-6),0.06)',
                        boxShadow: '0 0 0 2px rgba(var(--success-6),0.3) inset',
                      } : {}),
                    }}
                  >
                    {/* Header: 标题 + 徽章 */}
                    <div className='w-full flex items-center justify-between'>
                      <div className='flex flex-col gap-2px min-w-0'>
                        <span className='text-13px font-500 text-t-primary'>外网扫码访问</span>
                        <span className='text-12px text-t-tertiary'>任意网络下手机扫码即可打开，由 Aion 安全中继</span>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(var(--success-6),.3)', background: 'rgba(var(--success-6),.06)', color: 'rgb(var(--success-6))', fontWeight: 500, flexShrink: 0 }}>远程模式</span>
                    </div>

                    {/* QR 码 */}
                    {qrLoading ? (
                      <div className='w-140px h-140px flex items-center justify-center bg-bg-1 rd-8px border border-line'>
                        <Refresh size={20} className='animate-spin text-t-tertiary' />
                      </div>
                    ) : qrUrl ? (
                      <div className='p-8px bg-white rd-8px border border-line'>
                        <Suspense fallback={<div className='w-140px h-140px flex items-center justify-center'><Refresh size={16} className='animate-spin text-t-tertiary' /></div>}>
                          <QRCodeSVGLazy value={qrUrl} size={140} level='M' />
                        </Suspense>
                      </div>
                    ) : (
                      <button
                        type='button'
                        onClick={() => void generateQRCode()}
                        className='w-156px h-156px flex flex-col items-center justify-center gap-6px bg-bg-1 rd-8px border border-line cursor-pointer text-t-tertiary hover:text-t-secondary transition-colors'
                      >
                        <Refresh size={20} />
                        <span className='text-12px'>点击生成二维码</span>
                      </button>
                    )}

                    {/* 有效期 + 复制 + 刷新 */}
                    <div className='flex items-center gap-8px'>
                      {qrExpiresAt && <span className='text-12px text-t-tertiary'>{t('settings.webui.qrExpires', { time: formatExpiresAt(qrExpiresAt) })}</span>}
                      {qrUrl && (
                        <Tooltip content={t('settings.webui.copyQrLink')}>
                          <button className='p-3px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer' onClick={() => handleCopy(qrUrl)}><Copy size={13} /></button>
                        </Tooltip>
                      )}
                      <Tooltip content={t('settings.webui.refreshQr')}>
                        <button className='p-3px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer' onClick={() => void generateQRCode()} disabled={qrLoading}><Refresh size={13} className={qrLoading ? 'animate-spin' : ''} /></button>
                      </Tooltip>
                    </div>

                    {/* 直接打开：URL 行（次要入口）*/}
                    {remoteNetworkUrl && (
                      <div className='w-full pt-10px border-t border-line flex items-center justify-between gap-8px'>
                        <span className='text-12px text-t-tertiary shrink-0'>或直接打开</span>
                        <div className='inline-flex items-center gap-6px rd-100px border border-line bg-bg-1 px-10px py-3px min-w-0'>
                          <button
                            className='text-12px font-mono truncate bg-transparent border-none p-0 cursor-pointer hover:underline'
                            style={{ color: 'rgb(var(--primary-6))' }}
                            onClick={() => shell.openExternal.invoke(remoteNetworkUrl).catch(console.error)}
                          >
                            {remoteNetworkUrl}
                          </button>
                          <button className='p-2px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer' onClick={() => { void navigator.clipboard.writeText(remoteNetworkUrl); Message.success(t('common.copySuccess')); }}>
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null

              ) : (
                /* OFFLINE — 警告卡 + 二维码灰罩 */
                <div className='rd-12px border overflow-hidden' style={{ borderColor: 'rgba(var(--warning-6),0.3)' }}>
                  <div className='px-14px py-12px flex items-center gap-8px' style={{ background: 'rgba(var(--warning-6),0.06)' }}>
                    <span className='text-14px shrink-0'>⚠</span>
                    <span className='text-13px flex-1' style={{ color: 'rgb(var(--warning-6))' }}>中继断开，点击右上角"重连"即可恢复</span>
                  </div>
                  {status?.running && allowRemotePreference && qrUrl && (
                    <div className='border-t px-14px py-12px flex flex-col items-center gap-10px' style={{ borderColor: 'rgba(var(--danger-6),0.15)' }}>
                      <div className='p-8px bg-white rd-8px border border-line' style={{ position: 'relative' }}>
                        <Suspense fallback={null}>
                          <QRCodeSVGLazy value={qrUrl} size={120} level='M' />
                        </Suspense>
                        {/* 灰罩：只说明状态，重连按钮在上方 */}
                        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <svg width='22' height='22' viewBox='0 0 48 48' fill='none' style={{ opacity: 0.3 }}><circle cx='24' cy='24' r='18' stroke='currentColor' strokeWidth='3'/><path d='M15 15l18 18M33 15L15 33' stroke='currentColor' strokeWidth='3' strokeLinecap='round'/></svg>
                          <span className='text-12px text-t-tertiary'>重连后可用</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* ── 副卡：局域网访问（折叠） ── */}
        <Collapse
          bordered={false}
          style={{ background: 'transparent' }}
          className='webui-lan-collapse'
          activeKey={lanExpanded ? ['lan-access'] : []}
          onChange={(_, keys) => setLanExpanded((keys as string[]).includes('lan-access'))}
        >
          <Collapse.Item
            showExpandIcon={false}
            header={
              <div className='flex items-center gap-12px w-full'>
                <div
                  className='size-44px rd-12px flex items-center justify-center shrink-0'
                  style={{ background: 'linear-gradient(135deg, rgba(120,140,180,0.16), rgba(120,140,180,0.06))', color: 'rgb(94,120,160)' }}
                >
                  <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M5 12.55a11 11 0 0114 0' />
                    <path d='M1.42 9a16 16 0 0121.16 0' />
                    <path d='M8.53 16.11a6 6 0 016.95 0' />
                    <circle cx='12' cy='20' r='1' />
                  </svg>
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-8px'>
                    <span className='text-15px font-600 text-t-primary leading-22px'>局域网访问</span>
                    {status?.running && (
                      <span className='inline-flex items-center gap-4px text-12px text-t-tertiary'>
                        <span className='w-6px h-6px rd-50% inline-block' style={{ background: 'rgb(var(--success-6))' }} />
                        运行中
                      </span>
                    )}
                  </div>
                  <div className='text-12px text-t-tertiary mt-2px leading-18px'>
                    同 WiFi 下扫码即用，无需 Aion 账号
                  </div>
                </div>
                <span className='shrink-0 flex items-center justify-center w-22px h-22px text-t-tertiary'>
                  {lanExpanded ? <Up theme='outline' size='14' fill='currentColor' /> : <Down theme='outline' size='14' fill='currentColor' />}
                </span>
              </div>
            }
            name='lan-access'
            className='bg-2 rd-16px overflow-hidden'
          >
            <div className='px-[12px] md:px-[28px] pb-14px pt-12px space-y-12px'>

              {/* 局域网访问开关 */}
              <PreferenceRow
                label='局域网访问'
                description={
                  <span className='text-12px text-t-tertiary'>
                    开启后，同 WiFi 下的设备可通过 IP 访问
                  </span>
                }
                extra={
                  startLoading ? (
                    <span className='text-12px text-warning'>{t('settings.webui.starting')}</span>
                  ) : null
                }
              >
                <Switch checked={webuiEnabled} loading={startLoading} onChange={handleToggle} />
              </PreferenceRow>

              {/* 访问地址 */}
              {webuiEnabled && (
                <div className='flex items-center justify-between gap-12px py-2px'>
                  <span className='text-14px text-t-secondary shrink-0'>{t('settings.webui.accessUrl')}</span>
                  <div className='inline-flex items-center gap-8px rd-100px border border-line bg-fill-1 px-10px py-4px min-w-0'>
                    <button
                      className='text-13px text-primary font-mono hover:underline cursor-pointer bg-transparent border-none p-0 truncate'
                      onClick={() => shell.openExternal.invoke(getDisplayUrl()).catch(console.error)}
                    >
                      {getDisplayUrl()}
                    </button>
                    <Tooltip content={t('common.copy')}>
                      <Button type='text' size='mini' className='rd-100px !px-6px inline-flex items-center !h-24px' onClick={() => handleCopy(getDisplayUrl())}>
                        <Copy size={14} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* 局域网 QR 码 — WebUI 跑起来就显示，跟远程状态解耦 */}
              {status?.running && qrUrl && remoteState !== 'ACTIVE' && (
                <div className='rd-10px border border-line bg-fill-1 px-12px py-12px flex flex-col items-center gap-8px'>
                  <div className='w-full flex items-center justify-between'>
                    <span className='text-13px font-500 text-t-primary'>同 WiFi 下扫码</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, border: '1px solid var(--color-fill-3)', background: 'var(--color-bg-1)', color: 'var(--color-text-3)' }}>局域网模式</span>
                  </div>
                  <div className='p-8px bg-white rd-8px border border-line'>
                    <Suspense fallback={<div className='w-120px h-120px flex items-center justify-center'><Refresh size={14} className='animate-spin text-t-tertiary' /></div>}>
                      <QRCodeSVGLazy value={qrUrl} size={120} level='M' />
                    </Suspense>
                  </div>
                  <div className='flex items-center gap-8px'>
                    {qrExpiresAt && <span className='text-12px text-t-tertiary'>{t('settings.webui.qrExpires', { time: formatExpiresAt(qrExpiresAt) })}</span>}
                    <Tooltip content={t('settings.webui.refreshQr')}>
                      <button className='p-3px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer' onClick={() => void generateQRCode()} disabled={qrLoading}>
                        <Refresh size={13} className={qrLoading ? 'animate-spin' : ''} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* 本地账号兜底（浏览器手动登录用）*/}
              <div className='pt-12px border-t border-line'>
                <div className='text-12px text-t-tertiary mb-8px'>本地账号兜底 · 浏览器手动登录用</div>

                <div className='flex items-center justify-between gap-12px py-6px'>
                  <span className='text-13px text-t-secondary shrink-0'>{t('settings.webui.username')}</span>
                  <div className='inline-flex items-center gap-6px rd-100px border border-line bg-fill-1 px-10px py-3px min-w-0'>
                    <span className='text-13px text-t-primary truncate'>{displayUsername}</span>
                    <Tooltip content={t('common.copy')}>
                      <Button type='text' size='mini' className='rd-100px !px-4px inline-flex items-center !h-20px' onClick={() => handleCopy(displayUsername)}>
                        <Copy size={12} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('settings.webui.editUsernameTooltip')}>
                      <Button type='text' size='mini' className='rd-100px !px-4px inline-flex items-center !h-20px' onClick={handleResetUsername}>
                        <EditTwo size={12} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <div className='flex items-center justify-between gap-12px py-6px'>
                  <span className='text-13px text-t-secondary shrink-0'>{t('settings.webui.initialPassword')}</span>
                  <div className='inline-flex items-center gap-6px rd-100px border border-line bg-fill-1 px-10px py-3px min-w-0'>
                    <span className='text-13px text-t-primary truncate'>{displayPassword}</span>
                    <Tooltip content={t('settings.webui.resetPasswordTooltip')}>
                      <Button type='text' size='mini' className='rd-100px !px-4px inline-flex items-center !h-20px' onClick={handleResetPassword}>
                        <EditTwo size={12} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>

            </div>
          </Collapse.Item>
        </Collapse>
      </div>
    </AionScrollArea>
  );

  return (
    <div className='flex flex-col h-full w-full'>
      <LoginModal visible={loginModalVisible} intent='remote' onClose={() => setLoginModalVisible(false)} />
      <Tabs
        activeTab={activeTab}
        onChange={(key) => setActiveTab((key as 'webui' | 'channels') || 'webui')}
        type='line'
        className='mb-12px settings-remote-tabs'
      >
        <Tabs.TabPane
          key='webui'
          title={
            <span
              data-webui-tab='webui'
              className={`inline-flex items-center gap-6px transition-colors ${activeTab === 'webui' ? 'text-t-primary font-600' : 'text-t-secondary'}`}
            >
              <Earth theme='outline' size='15' />
              <span>WebUI</span>
            </span>
          }
        />
        <Tabs.TabPane
          key='channels'
          title={
            <span
              data-webui-tab='channels'
              className={`inline-flex items-center gap-6px transition-colors ${activeTab === 'channels' ? 'text-t-primary font-600' : 'text-t-secondary'}`}
            >
              <Communication theme='outline' size='15' />
              <span>Channels</span>
              <span className='inline-flex items-center gap-4px ml-2px'>
                {CHANNEL_LOGOS.map((item) => (
                  <span
                    key={item.alt}
                    className='inline-flex items-center justify-center w-16px h-16px rd-50% border border-line bg-fill-1'
                    title={item.alt}
                    aria-label={item.alt}
                  >
                    <img src={item.src} alt={item.alt} className='w-14px h-14px object-contain' />
                  </span>
                ))}
              </span>
            </span>
          }
        />
      </Tabs>

      {activeTab === 'webui' ? (
        webuiPanel
      ) : (
        <div className='flex-1 min-h-0'>
          <Suspense
            fallback={<div className='px-[12px] md:px-[28px] text-13px text-t-secondary'>{t('common.loading')}</div>}
          >
            <ChannelModalContentLazy />
          </Suspense>
        </div>
      )}

      <AionModal
        visible={setUsernameModalVisible}
        onCancel={() => setSetUsernameModalVisible(false)}
        onOk={handleSetNewUsername}
        confirmLoading={usernameLoading}
        title={t('settings.webui.setNewUsername')}
        size='small'
      >
        <Form form={usernameForm} layout='vertical' className='pt-16px'>
          <Form.Item
            label={t('settings.webui.newUsername')}
            field='newUsername'
            rules={[
              { required: true, message: t('settings.webui.newUsernameRequired') },
              {
                validator: (value, callback) => {
                  if (typeof value !== 'string') {
                    callback();
                    return;
                  }

                  const trimmed = value.trim();
                  if (trimmed.length < 3) {
                    callback(t('settings.webui.usernameMinLength'));
                    return;
                  }

                  if (trimmed.length > 32) {
                    callback(t('settings.webui.usernameMaxLength'));
                    return;
                  }

                  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
                    callback(t('settings.webui.usernameFormatError'));
                    return;
                  }

                  if (/^[_-]|[_-]$/.test(trimmed)) {
                    callback(t('settings.webui.usernameEdgeError'));
                    return;
                  }

                  callback();
                },
              },
            ]}
          >
            <Input placeholder={t('settings.webui.newUsernamePlaceholder')} />
          </Form.Item>
        </Form>
      </AionModal>

      {/* 设置新密码弹窗 / Set New Password Modal */}
      <AionModal
        visible={setPasswordModalVisible}
        onCancel={() => setSetPasswordModalVisible(false)}
        onOk={handleSetNewPassword}
        confirmLoading={passwordLoading}
        title={t('settings.webui.setNewPassword')}
        size='small'
      >
        <Form form={form} layout='vertical' className='pt-16px'>
          <Form.Item
            label={t('settings.webui.newPassword')}
            field='newPassword'
            rules={[
              { required: true, message: t('settings.webui.newPasswordRequired') },
              { minLength: 8, message: t('settings.webui.passwordMinLength') },
            ]}
          >
            <Input.Password placeholder={t('settings.webui.newPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('settings.webui.confirmPassword')}
            field='confirmPassword'
            rules={[
              { required: true, message: t('settings.webui.confirmPasswordRequired') },
              {
                validator: (value, callback) => {
                  if (value !== form.getFieldValue('newPassword')) {
                    callback(t('settings.webui.passwordMismatch'));
                  } else {
                    callback();
                  }
                },
              },
            ]}
          >
            <Input.Password placeholder={t('settings.webui.confirmPasswordPlaceholder')} />
          </Form.Item>
        </Form>
      </AionModal>
    </div>
  );
};

export default WebuiModalContent;
