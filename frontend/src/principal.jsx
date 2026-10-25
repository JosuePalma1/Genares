import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Aplicacion from './Aplicacion';
import '../css/styles.css';
import '../css/responsive.css';
import './estilos/aplicacion.css';

const raiz = ReactDOM.createRoot(document.getElementById('root'));

raiz.render(
  <React.StrictMode>
    <BrowserRouter>
      <Aplicacion />
    </BrowserRouter>
  </React.StrictMode>,
);
