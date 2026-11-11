import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import App from './App';
import './game/style.css';

// Mount every control before starting the imperative Three.js simulation.
// Do not wrap this bootstrap in StrictMode or initialize it from two effects.
flushSync(() => createRoot(document.getElementById('root')!).render(<App />));
import('./game/app.js').catch(error => {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = '게임을 불러오지 못했습니다. 새로고침해 주세요.';
});
