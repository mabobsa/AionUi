import React from 'react';
import { createRoot } from 'react-dom/client';
import '@arco-design/web-react/es/_util/react-19-adapter';
import '@arco-design/web-react/es/Spin/style/css';
import '@arco-design/web-react/es/Button/style/css';
import './webuiI18n';
import WebUIRoot from './WebUIRoot';

createRoot(document.getElementById('root')!).render(<WebUIRoot />);
