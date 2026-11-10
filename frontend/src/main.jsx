// Import React core library.
import React from 'react';

// Import ReactDOM client for mounting the application to DOM.
import ReactDOM from 'react-dom/client';

// Import root App component.
import App from './App';

// Import Tailwind CSS and global style definitions.
import './index.css';

// Create root react tree and render the application inside root DOM node.
ReactDOM.createRoot(document.getElementById('root')).render(
  // Wrap application in React StrictMode to enforce best practices and identify side effects.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
