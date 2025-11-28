import type { Efector, Servicio, EfeSerEsp, Especialidad, EfeSerEspCompleto } from "../efe_ser_esp/types";
import type { Paciente, Profesional, User } from "../persona/types";

export interface Turno {
    id: number;
    id_estado: EstadoMsj;
    fecha: string | null;
    hora: string;
    msj_confirmado: number;
    msj_reprogramado: number;
    msj_cancelado: number;
    msj_recordatorio: number;
    efe_ser_esp: EfeSerEsp;
}

export interface TurnoEspera {
    id: number;
    estado: EstadoMsj;
    profesional_solicitante: Profesional;
    efector: Efector;
    servicio: Servicio;
    especialidad: Especialidad;
    efector_solicitante: Efector;
    paciente: Paciente;
    prioridad: number;
    estudio_requerido:  EstudioRequerido[];
    fecha_hora_creacion: string;
    fecha_hora_cierre: string | null;
    usuario_creacion: User;
    usuario_cierre: User | null;
    cupo: boolean;
}

export interface EstadoTurno {
    id: number,
    nombre: string
}

export interface EstadoTurnoPaciente {
    id: number,
    nombre: string
}


export interface EstadoMsj {
    id: number;
    significado: string;
}


export interface TurnoExtend {
    id: number;
    estado: EstadoTurno;
    estado_paciente: EstadoTurnoPaciente;
    fecha: string;
    hora: string;
    msj_confirmado: number;
    msj_reprogramado: number;
    msj_cancelado: number;
    msj_recordatorio: number;
    efe_ser_esp: EfeSerEspCompleto;
    paciente_nombre: string | null;
    paciente_apellido: string | null;
    paciente_dni: string | null;
    profesional_nombre: string | null;
    profesional_apellido: string | null;
    mensaje_asociado: any[] | undefined;
}

export interface EstudioRequerido {
    id: number,
    nombre: string
}
