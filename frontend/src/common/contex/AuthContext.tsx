import { createContext, useState, useRef, } from 'react'
import type {ReactNode } from 'react';
import type { AuthContextType, InitializeAuthData, AuthTokens } from './types';
import type { Efector } from '../../features/turno/types';

const defaultContext: AuthContextType = {
    authTokens: null,
    initializeAuth: () => {},

    username: null,

    efectores: [],

    logout: () => {},
};

export const AuthContext = createContext<AuthContextType>(defaultContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [authTokens, setAuthTokens] = useState<AuthTokens | null>(() => {
        const t = localStorage.getItem('tokens');
        return t ? JSON.parse(t) : null;
    });
    const tokensRef = useRef<AuthTokens | null>(authTokens);
    const [username, setUsername] = useState<string | null>(() =>
        localStorage.getItem('username') || null
    );
    const [efectores, setEfectores] = useState<Efector[]>(() => {
        const e = localStorage.getItem('efectores');
        return e ? JSON.parse(e) : [];
    });


    const initializeAuth = (data: InitializeAuthData) => {
        const tokens: AuthTokens = { access: data.access, refresh: data.refresh };
        setAuthTokens(tokens);
        tokensRef.current = tokens;
        localStorage.setItem('tokens', JSON.stringify(tokens));

        if (data.username) {
            setUsername(data.username);
            localStorage.setItem('username', data.username);
        }
        console.log(data.efectores)
        if (data.efectores) {
            const sorted = [...data.efectores].sort((a, b) =>
                a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
            );
            setEfectores(sorted);
            localStorage.setItem('efectores', JSON.stringify(sorted));
        }

    };

    const logout = () => {
        setAuthTokens(null);
        tokensRef.current = null;
        setUsername(null);
        setEfectores([]);
        ['tokens','username','efectores'].forEach(k => localStorage.removeItem(k));
    };


    return (
        <AuthContext.Provider
            value={{
                authTokens,
                initializeAuth,
                username,
                efectores,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};