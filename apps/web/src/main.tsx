import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { selectRenderProfile } from './scene/profile/selectRenderProfile';
import { useAppStore } from './store/appStore';
import { registerServiceWorker } from './registerServiceWorker';

const profile = selectRenderProfile();
useAppStore.getState().setRenderProfile(profile);
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
