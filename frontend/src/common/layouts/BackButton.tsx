import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate(-1)}   // -1 significa "una página atrás"
      sx={{
        textTransform: 'none',
        color: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <FontAwesomeIcon icon={faArrowLeft} />
      Volver
    </Button>
  );
};

export default BackButton;
