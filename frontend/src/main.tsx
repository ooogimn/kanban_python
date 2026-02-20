import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import { createIDBPersister } from './lib/persister';
import App from './App';
import NetworkStatus from './components/NetworkStatus';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: createIDBPersister(),
          buster: 'v1',
        }}
      >
        <App />
        <NetworkStatus />
        <PwaUpdatePrompt />
        <Toaster position="top-right" />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
