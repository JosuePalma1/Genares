import { BrowserRouter } from 'react-router-dom';
import AplicacionS4 from './modules/s4-calificaciones/routes.jsx';
import './shared/presentation/styles/styles.css';
import './shared/presentation/styles/responsive.css';
import './shared/presentation/styles/aplicacion.css';

export default function App() {
  return (
    <BrowserRouter>
      <AplicacionS4 />
    </BrowserRouter>
  );
}
