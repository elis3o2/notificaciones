import type { Efector } from "../../features/efe_ser_esp/types";

export interface AuthTokens {
    access: string;
    refresh: string;
}

export interface InitializeAuthData {
    access: string;
    refresh: string;
    username?: string;
    efectores?: Efector[];
}

export interface AuthContextType {
    authTokens: AuthTokens | null;
    initializeAuth: (data: InitializeAuthData) => void;

    username: string | null;
    efectores: Efector[];

    logout: () => void;
}