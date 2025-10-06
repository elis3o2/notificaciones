import {useContext } from 'react';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contex';

const PrivateRoute = ({ children }: { children: ReactElement }): ReactElement | null => {
    const { authTokens } = useContext(AuthContext);
    return authTokens ? children : <Navigate to='/login' />;
};

export default PrivateRoute;
