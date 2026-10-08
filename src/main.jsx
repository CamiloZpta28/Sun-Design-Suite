import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import BarreraDeErrores, { puedeRecargarSola } from './shared/BarreraDeErrores.jsx';
import './index.css';

/* Vite avisa con este evento cuando no pudo descargar una sección, que es lo
   que pasa en una pestaña abierta desde antes de un despliegue (ver
   BarreraDeErrores). Se recarga para traer la versión nueva; si ya se recargó
   hace un momento, se deja seguir al error para que lo muestre la barrera. */
window.addEventListener('vite:preloadError', (evento) => {
  if (puedeRecargarSola()) {
    evento.preventDefault();
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BarreraDeErrores pantallaCompleta>
      <App />
    </BarreraDeErrores>
  </React.StrictMode>
);
