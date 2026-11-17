import React, { Suspense, lazy, useEffect } from 'react';
import { Button } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '../../hooks/context/AuthContext';
import AppLoader from '../../components/layout/AppLoader';
import { buildLoginPath, resolveLoginReturnTo } from '../../utils/navigation';
import LoginPage from './index';
import { loadApplicationLocale } from './webuiI18n';

const Application = lazy(async () => {
  const [, { AuthenticatedApplication }] = await Promise.all([loadApplicationLocale(), import('../../main')]);
  return { default: AuthenticatedApplication };
});

function StartupFailure(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div role='alert' style={{ display: 'grid', placeContent: 'center', minHeight: '100vh', gap: 16 }}>
      <div>{t('common.error')}</div>
      <Button onClick={() => window.location.reload()}>{t('common.reload')}</Button>
    </div>
  );
}

class StartupBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): React.ReactNode {
    return this.state.failed ? <StartupFailure /> : this.props.children;
  }
}

export function WebUIContent(): React.ReactElement {
  const { status } = useAuth();
  useEffect(() => {
    const route = window.location.hash.slice(1) || '/guid';
    const location = new URL(route, window.location.origin);
    if (status === 'unauthenticated' && location.pathname !== '/login') {
      window.history.replaceState(null, '', `#${buildLoginPath(location.pathname, location.search)}`);
    } else if (status === 'authenticated' && location.pathname === '/login') {
      window.history.replaceState(null, '', `#${resolveLoginReturnTo(location.search)}`);
    }
  }, [status]);

  if (status === 'checking') return <AppLoader />;
  if (status === 'unauthenticated') return <LoginPage />;
  return (
    <StartupBoundary>
      <Suspense fallback={<AppLoader />}>
        <Application />
      </Suspense>
    </StartupBoundary>
  );
}

export default function WebUIRoot(): React.ReactElement {
  return (
    <AuthProvider>
      <WebUIContent />
    </AuthProvider>
  );
}
