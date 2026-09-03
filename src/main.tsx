import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/chrome.css';
import './styles/field.css';
import './styles/record.css';
import './styles/habitat.css';
import './styles/landing.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
