import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { getIntegration } from './catalog.js';
import { IntegrationPage } from './IntegrationPage.js';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('BooLink root element was not found.');
}

const integrationMatch = /^\/integrations\/([a-z][a-z0-9-]*)\/?$/u.exec(window.location.pathname);
const integration = integrationMatch?.[1] ? getIntegration(integrationMatch[1]) : undefined;

createRoot(root).render(
  <StrictMode>{integration ? <IntegrationPage integration={integration} /> : <App />}</StrictMode>,
);
