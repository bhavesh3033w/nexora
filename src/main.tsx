import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { purgeLegacyDemoData } from './lib/storage';
import './styles/global.css';
import './styles/workspace.css';
purgeLegacyDemoData();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
