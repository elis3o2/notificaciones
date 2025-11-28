import http from '../../common/api/client'
import type { Efector, Servicio, Especialidad, EfeSerEsp, EfeSerEspCompleto, Deriva, SerEsp } from "./types";

export const getEfectoresAll = (): Promise<Efector[]> =>
  http.get<Efector[]>(`efectores/`).then(res => res.data);

export const getEfectorById = (id: number): Promise<Efector> =>
  http.get<Efector>(`efectores/${id}/`).then(res => res.data);

export const getServiciosAll = (): Promise<Servicio[]> =>
  http.get<Servicio[]>(`servicios/`).then(res => res.data);

export const getEspecialidadesAll = (): Promise<Especialidad[]> =>
  http.get<Especialidad[]>(`especialidades/`).then(res => res.data);

export const getEspecialidadesByServicio = (id: number): Promise<Especialidad[]> =>
  http.get<Especialidad[]>(`especialidades/?id_servicio=${id}`).then(res => res.data);


export const getServicioByEfector = (id: number): Promise<Servicio[]> =>
  http.get<Servicio[]>(`efe_ser_esp/servicios/?id_efector=${id}`).then(res => res.data);

export const getEfectoresByServEsp = (id_ser: number, id_esp: number): Promise <Efector[]> =>
  http.get<Efector[]>(`efe_ser_esp/efectores/?id_ser=${id_ser}&id_esp=${id_esp}`).then(res => res.data)

export const getEfeSerEspAll = () : Promise<EfeSerEsp[]> =>
  http.get<EfeSerEsp[]>(`efe_ser_esp/`).then(res => res.data)

export const getIdByEfeSerEsp = (efector: number, servicio: number, especialidad: number) : Promise<EfeSerEspCompleto> =>
  http.get<EfeSerEspCompleto>(`efe_ser_esp/id/?efector=${efector}&servicio=${servicio}&especialidad=${especialidad}`).then(res => res.data)


export const getDerivaByEfector = (id: number) : Promise<Deriva[]> =>
  http.get<Deriva[]>(`derivaciones/?id_efector=${id}`).then(res=> res.data)


export const getSerEspByEfector = (id: number) : Promise<SerEsp[]> =>
  http.get<SerEsp[]>(`efe_ser_esp/ser_esp/?id_efector=${id}`).then(res => res.data); 