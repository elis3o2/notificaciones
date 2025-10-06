export interface Paciente {
    id: number;
    nombre?: string | null;
    apellido?: string | null;
    nro_doc: string;
    sexo?: string | null;
    fecha_nacimiento?: Date | null;
    nombre_calle?: string | null;
    numero_calle?: number | null;
    carac_telef?: string | null;
    nro_telef?: string | null;
}

export interface Profesional {
    id: number;
    nombre: string;
    apellido: string;
}


export interface User {
    id: number;
    name: string;
}
