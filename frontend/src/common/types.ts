import type { ReactNode } from 'react';
import type { AlertProps } from '@mui/material';

export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
export type APIResponseObj = Record<string, unknown>;
export type APIResponseList  = APIResponseObj[];
export type AlertSeverity = AlertProps['severity']; // 'success' | 'info' | 'warning' | 'error';

export interface Column<T> {
    id: string;
    label: string;
    align?: 'right' | 'left' | 'center';
    render?: (value: any, row: T) => ReactNode;
}