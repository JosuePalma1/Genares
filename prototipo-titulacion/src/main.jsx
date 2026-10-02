import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { PrototypeProvider } from './state/PrototypeContext';
import '../css/styles.css';
import '../css/responsive.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrototypeProvider>
        <App />
      </PrototypeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
