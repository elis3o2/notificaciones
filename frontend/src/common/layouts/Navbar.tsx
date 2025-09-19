import React, { useContext, useState } from 'react';
import { AppBar, Toolbar, IconButton, MenuItem, Button, Typography, Menu, Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faUser, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../contex';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  backTo?: string;  // Ruta opcional para mostrar la flecha
}

const Navbar: React.FC<NavbarProps> = ({ backTo }) => {
  const { username, logout } = useContext(AuthContext);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMenu(event.currentTarget);
  const handleMenuClose = () => setMenu(null);
  const handleLogout = () => { logout(); handleMenuClose(); };

  return (
    <AppBar
      position='fixed'
      sx={{
        backgroundColor: (theme) => theme.palette.background.default,
        color: (theme) => theme.palette.text.primary,
        boxShadow: (theme) => theme.shadows[4],
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`
      }}
    >
      <Toolbar>
        {/* Flecha de volver si la prop está definida */}
        {backTo && (
          <IconButton
            onClick={() => navigate(backTo)}
            sx={{ color: 'inherit', marginRight: 2 }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Button
          onClick={handleMenuOpen}
          sx={{
            textTransform: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover': { backgroundColor: 'transparent', boxShadow: 'none' }
          }}
        >
          <FontAwesomeIcon icon={faUser} size='1x' />
          <Typography variant='body1'>{username}</Typography>
        </Button>

        <Menu
          anchorEl={menu}
          open={Boolean(menu)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleLogout}>
            <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: 8 }} size='1x' />
            Cerrar sesión
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
