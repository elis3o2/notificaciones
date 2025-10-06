import Navbar from './Navbar';
import { Box } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import type { Theme } from '@mui/material/styles';

const NAVBAR_HEIGHT = 64;

const Layout = () => {
  const location = useLocation();

  // Definís acá las rutas donde querés la flecha y su destino
  let backTo: string | undefined;
  if (location.pathname.startsWith("/list")) {
    backTo = "/home";
  }
if (location.pathname.startsWith("/plantillas")) {
    backTo = "/list";
  }
  if (location.pathname.startsWith("/turnos")) {
    backTo = "/home";
  }
if (location.pathname.startsWith("/historico")) {
    backTo = "/turnos";
  }
if (location.pathname.startsWith("/add-espera")) {
    backTo = "/espera";
  }
if (location.pathname.startsWith("/espera")) {
    backTo = "/home";
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Navbar backTo={backTo} /> {/* 👈 se pasa la prop */}
      <Box 
        sx={(theme: Theme) => ({
          flexGrow: 1, 
          pt: 2,
          pr: 1,
          pb: 2,
          pl: 1,
          mt: `${NAVBAR_HEIGHT}px`,
          transition: (theme) => theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          marginLeft: 0,
          width:  '100%',
          [theme.breakpoints.down('sm')]: {
            marginLeft: 0,
            width: '100%'
          },
        })}
      >
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
