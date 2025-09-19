export interface Turno {
    id: number;
    id_estado: number;
    fecha: Date;
    msj_confirmado: number;
    msj_reprogramado: number;
    msj_cancelado: number;
    msj_recordatorio: number;
    efector: Efector
    servicio: Servicio;
    especialidad: Especialidad;
}


export interface EstadoTurno {
    id: number,
    nombre: string
}

export interface Servicio{
    id: number;
    nombre: string;
}

export interface Especialidad {
    id: number;
    nombre: string;
    id_servicio: number;
}


export interface Efector {
    id: number;
    nombre: string;
}

export interface EstadoMsj {
    id: number;
    significado: string;
}

export interface EfectorPlantilla {
    id: number;
    id_efector: number;
    id_especialidad: number;
    id_servicio: number;
    confirmacion: number;
    plantilla_conf?: number;
    reprogramacion: number;
    plantilla_repr?: number;
    cancelacion: number;
    plantilla_canc?: number;
    recordatorio: number;
    plantilla_reco?: number;
    dias_antes?: number; 
}

export interface TurnoExtend {
    id: number;
    estado: EstadoTurno;
    fecha: Date;
    msj_confirmado: number;
    msj_reprogramado: number;
    msj_cancelado: number;
    msj_recordatorio: number;
    efector: Efector
    servicio: Servicio;
    especialidad: Especialidad;
    paciente_nombre: string | null;
    paciente_apellido: string | null;
    paciente_dni: string | null;
    profesional_nombre: string | null;
    profesional_apellido: string | null;
    mensaje_asociado: any[] | null;
}

export interface EfectorPlantillaExtend {
    id: number;
    efector: Efector;
    especialidad: Especialidad;
    servicio: Servicio;
    id_efector: number;
    id_especialidad: number;
    id_servicio: number;
    confirmacion: number;
    plantilla_conf?: number;
    reprogramacion: number;
    plantilla_repr?: number;
    cancelacion: number;
    plantilla_canc?: number;
    recordatorio: number;
    plantilla_reco?: number;
    dias_antes?: number; 
}



i