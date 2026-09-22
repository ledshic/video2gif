import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { detectLocale, htmlLang } from './i18n';
import { LocaleProvider } from './i18n/LocaleContext';
import './styles.css';

document.documentElement.lang = htmlLang(detectLocale());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
