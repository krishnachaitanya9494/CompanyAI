// Import React core library.
import React from 'react';

// Import ReactDOM client for mounting the application to DOM.
import ReactDOM from 'react-dom/client';

// Import root App component.
import App from './App';

// Import Tailwind CSS and global style definitions.
import './index.css';

// Import ErrorBoundary to prevent blank white screen crashes.
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Create root react tree and render the application inside root DOM node.
ReactDOM.createRoot(document.getElementById('root')).render(
  // Wrap application in React StrictMode to enforce best practices and identify side effects.
  <React.StrictMode>
    <ErrorBoundary
      title="CompanyAI Application Initialization Error"
      message="The application encountered an unexpected runtime issue. Please refresh the page to reload the workspace."
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

