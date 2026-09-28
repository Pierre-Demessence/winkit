import { render } from 'preact';

import { App } from './App';

import '@pierre/winkit/styles.css';
import './styles.css';

const host = document.getElementById('app');

if (!host)
  throw new Error('Missing #app host element');

render(<App />, host);
