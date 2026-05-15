import { ipcBridge } from '@/common';
import type { IStartOnBootStatus } from '@/common/adapter/ipcBridge';
import { configService } from '@/common/config/configService';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { ThemeSwitcher } from '@/renderer/components/settings/ThemeSwitcher';
import LanguageSwitcher from '@/renderer/components/settings/LanguageSwitcher';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { Button, Switch } from '@arco-design/web-react';
import { Earth, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const Row: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div className='flex min-h-58px items-center justify-between gap-24px py-13px'>
    <div className='flex-1 min-w-0'>
      <div className='text-14px text-t-primary leading-22px'>{label}</div>
      {description && <div className='text-12px text-t-tertiary mt-3px leading-18px'>{description}</div>}
    </div>
    <div className='shrink-0'>{children}</div>
  </div>
);

const Divider: React.FC = () => <div className='h-1px bg-[var(--color-border-1)]' />;

const Section: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => <div className={`bg-2 rd-16px overflow-hidden ${className ?? ''}`}>{children}</div>;

const NotificationRows: React.FC<{
  notificationEnabled: boolean;
  cronNotificationEnabled: boolean;
  onNotificationChange: (checked: boolean) => void;
  onCronNotificationChange: (checked: boolean) => void;
}> = ({ notificationEnabled, cronNotificationEnabled, onNotificationChange, onCronNotificationChange }) => {
  const { t } = useTranslation();

  return (
    <>
      <div className='pt-13px pb-2px text-12px text-t-tertiary leading-18px'>
        {t('settings.general.notificationPreferences')}
      </div>
      <Row label={t('settings.general.taskCompletionNotification')}>
        <Switch checked={notificationEnabled} onChange={onNotificationChange} />
      </Row>
      <Divider />
      <Row label={t('settings.cronNotificationEnabled')}>
        <Switch checked={cronNotificationEnabled} onChange={onCronNotificationChange} />
      </Row>
    </>
  );
};

const GeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDesktop = isElectronDesktop();

  const [startOnBoot, setStartOnBoot] = useState<IStartOnBootStatus>({
    supported: false,
    enabled: false,
    isPackaged: false,
    platform: 'web',
  });
  const [closeToTray, setCloseToTray] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [cronNotificationEnabled, setCronNotificationEnabled] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    ipcBridge.application.getStartOnBootStatus
      .invoke()
      .then((result) => {
        if (result.success && result.data) setStartOnBoot(result.data);
      })
      .catch(() => {});
  }, [isDesktop]);

  useEffect(() => {
    setCloseToTray(configService.get('system.closeToTray') ?? false);
    setNotificationEnabled(configService.get('system.notificationEnabled') ?? true);
    setCronNotificationEnabled(configService.get('system.cronNotificationEnabled') ?? false);
  }, []);

  const handleStartOnBootChange = useCallback(
    (checked: boolean) => {
      const prev = startOnBoot;
      setStartOnBoot((s) => ({ ...s, enabled: checked }));
      ipcBridge.application.setStartOnBoot
        .invoke({ enabled: checked })
        .then((result) => {
          if (result.success && result.data) {
            setStartOnBoot(result.data);
          } else {
            setStartOnBoot(prev);
          }
        })
        .catch(() => setStartOnBoot(prev));
    },
    [startOnBoot]
  );

  const handleCloseToTrayChange = useCallback((checked: boolean) => {
    setCloseToTray(checked);
    configService.setLocal('system.closeToTray', checked);
    ipcBridge.systemSettings.setCloseToTray.invoke({ enabled: checked }).catch(() => {
      setCloseToTray(!checked);
      configService.setLocal('system.closeToTray', !checked);
    });
  }, []);

  const handleNotificationChange = useCallback((checked: boolean) => {
    setNotificationEnabled(checked);
    configService.set('system.notificationEnabled', checked).catch(() => {
      setNotificationEnabled(!checked);
      configService.setLocal('system.notificationEnabled', !checked);
    });
  }, []);

  const handleCronNotificationChange = useCallback((checked: boolean) => {
    setCronNotificationEnabled(checked);
    configService.set('system.cronNotificationEnabled', checked).catch(() => {
      setCronNotificationEnabled(!checked);
      configService.setLocal('system.cronNotificationEnabled', !checked);
    });
  }, []);

  const goToRemote = useCallback(() => {
    sessionStorage.setItem('aion-last-settings-path', '/settings/webui');
    void navigate('/settings/webui');
  }, [navigate]);

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col h-full w-full'>
        <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow>
          <div className='space-y-14px'>
            <Section className='px-16px md:px-24px lg:px-28px py-16px'>
              <div className='flex flex-col gap-14px md:flex-row md:items-center md:justify-between'>
                <div className='flex min-w-0 items-center gap-14px'>
                  <div
                    className='size-48px rd-50% flex items-center justify-center text-18px font-600 text-color-white shrink-0 select-none'
                    style={{
                      background:
                        'linear-gradient(135deg, color-mix(in srgb, rgb(var(--primary-6)) 52%, var(--color-text-3)), rgb(var(--primary-6)))',
                    }}
                  >
                    A
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='text-15px font-500 text-t-primary leading-22px'>
                      {t('settings.general.accountPlaceholder')}
                    </div>
                    <div className='text-12px text-t-secondary mt-2px leading-18px'>
                      {t('settings.general.accountSubPlaceholder')}
                    </div>
                  </div>
                </div>
                <Button type='primary' shape='round' size='small' className='self-start md:self-auto px-16px'>
                  {t('settings.general.loginAction')}
                </Button>
              </div>

              <div className='mt-12px inline-flex max-w-full items-center gap-6px px-10px py-6px rd-8px bg-fill-1 text-t-secondary'>
                <Earth theme='outline' size='13' className='shrink-0' />
                <span className='text-12px leading-18px truncate'>{t('settings.general.accountRemoteTrial')}</span>
              </div>
            </Section>

            <Section className='px-16px md:px-24px lg:px-28px py-4px'>
              <Button
                type='text'
                className='!h-auto !w-full !px-0 !py-13px !inline-flex !items-center !justify-between gap-24px group'
                onClick={goToRemote}
              >
                <div className='flex min-w-0 items-center gap-10px'>
                  <span className='size-22px flex-center text-t-secondary shrink-0'>
                    <Earth theme='outline' size='16' />
                  </span>
                  <span className='text-14px text-t-primary leading-22px truncate'>{t('settings.webui')}</span>
                </div>
                <div className='flex shrink-0 items-center gap-8px'>
                  <span className='text-13px text-t-secondary whitespace-nowrap'>
                    {t('settings.general.remoteOff')}
                  </span>
                  <Right
                    theme='outline'
                    size='14'
                    className='text-t-secondary group-hover:text-t-primary transition-colors'
                  />
                </div>
              </Button>
            </Section>

            <Section className='px-16px md:px-24px lg:px-28px py-4px'>
              <Row label={t('settings.theme')}>
                <ThemeSwitcher />
              </Row>
              <Divider />
              <Row label={t('settings.language')}>
                <LanguageSwitcher />
              </Row>
            </Section>

            {isDesktop && (
              <>
                <Section className='px-16px md:px-24px lg:px-28px py-4px'>
                  <Row
                    label={t('settings.startOnBoot')}
                    description={
                      startOnBoot.supported ? t('settings.startOnBootDesc') : t('settings.startOnBootUnsupported')
                    }
                  >
                    <Switch
                      checked={startOnBoot.enabled}
                      onChange={handleStartOnBootChange}
                      disabled={!startOnBoot.supported}
                    />
                  </Row>
                  <Divider />
                  <Row label={t('settings.closeToTray')}>
                    <Switch checked={closeToTray} onChange={handleCloseToTrayChange} />
                  </Row>
                </Section>

                <Section className='px-16px md:px-24px lg:px-28px py-4px'>
                  <NotificationRows
                    notificationEnabled={notificationEnabled}
                    cronNotificationEnabled={cronNotificationEnabled}
                    onNotificationChange={handleNotificationChange}
                    onCronNotificationChange={handleCronNotificationChange}
                  />
                </Section>
              </>
            )}
          </div>
        </AionScrollArea>
      </div>
    </SettingsPageWrapper>
  );
};

export default GeneralSettings;
