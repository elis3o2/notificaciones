import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { PrivateRoute } from '../common/components';
import Layout from '../common/layouts/Layout';
import InitPage from '../pages/IncioPage';
import ListaPage from '../pages/EfectoresPage';
import Plantilla from '../pages/PlantillasPage';
import AddPlantillaPage from '../pages/AddPlantillaPage';
import TurnosPage from '../pages/TurnoPage';
import HistoricoPage from '../pages/HistoricoPage';
const AppRoutes = () => {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas privadas con Layout */}
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/home" element={<InitPage />} />
        <Route path="/list" element={<ListaPage />} />
        <Route path="/plantillas" element={<Plantilla />} /> 
        <Route path="/plantillas/:tipo" element={<Plantilla />} />
        <Route path="/plantillas/nueva/:tipo" element={<AddPlantillaPage />}/> 
        <Route path="/turnos" element={<TurnosPage />}/>
        <Route path="/historico" element={<HistoricoPage />}/>
          {/* Aquí podés agregar más rutas privadas */}
      </Route>
    </Routes>
  );
};

export default AppRoutes;