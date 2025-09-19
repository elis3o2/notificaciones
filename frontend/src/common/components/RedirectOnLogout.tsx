import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contex';

const RedirectOnLogout = () => {
    const { authTokens } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!authTokens) {
            navigate('/login');
        }
    }, [authTokens, navigate]);

    return null;
};

export default RedirectOnLogout;
