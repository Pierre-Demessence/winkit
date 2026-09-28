import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

import '@pierre/winkit/styles.css';
import './styles.css';

const host = document.getElementById('app');

if (!host)
  throw new Error('Missing #app host element');

// StrictMode on purpose: it double-invokes render and mounts effects twice, which
// is the harshest environment a host can hand this library.
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
