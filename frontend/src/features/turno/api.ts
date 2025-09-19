import http from '../../common/api/client'
import type { Efector, EfectorPlantilla, Especialidad, Servicio, Turno, TurnoExtend, EstadoMsj } from './types'

export const getEfectoresAll = (): Promise<Efector[]> =>
  http.get<Efector[]>(`efectores/`).then(res => res.data);

export const getEfectorById = (id: number): Promise<Efector> =>
  http.get<Efector>(`efectores/${id}/`).then(res => res.data);

export const getServiciosAll = (): Promise<Servicio[]> =>
  http.get<Servicio[]>(`servicios/`).then(res => res.data);

export const getEspecialidadesAll = (): Promise<Especialidad[]> =>
  http.get<Especialidad[]>(`especialidades/`).then(res => res.data);

// existing endpoints you already had
export const getPlantillaByEfector = (id: number): Promise<EfectorPlantilla[]> =>
  http.get<EfectorPlantilla[]>(`efector_plantilla/buscar/?id_efector=${id}`).then(res => res.data);

export const updateEfectorPlantilla = (id: number, data: EfectorPlantilla): Promise<EfectorPlantilla> =>
  http.patch<EfectorPlantilla>(`efector_plantilla/${id}/`, data).then(res => res.data);

export const getPlantillaByEfectorServicio = (id_e: number, id_s: number): Promise<EfectorPlantilla[]> =>
  http.get<EfectorPlantilla[]>(`efector_plantilla/detalle/?id_efector=${id_e}&id_servicio=${id_s}`).then(res => res.data);

export const getServicioByEfector = (id: number): Promise<Servicio[]> =>
  http.get<Servicio[]>(`efector_plantilla/servicios/?id_efector=${id}`).then(res => res.data);

export const getTurnosAll = (
  id_servicio?: number,
  id_especialidad?: number,
  id_estado?: number
): Promise<Turno[]> => {
  let url = `turnos/`;

  const params: string[] = [];
  if (id_servicio !== undefined) params.push(`id_servicio=${id_servicio}`);
  if (id_especialidad !== undefined) params.push(`id_especialidad=${id_especialidad}`);
  if (id_estado !== undefined) params.push(`id_estado=${id_estado}`);

  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  return http.get<Turno[]>(url).then(res => res.data);
};

/**
 * New: devuelve todas las combinaciones EfectorPlantilla
 * (usa /efector_plantilla/ list endpoint si está disponible; si no,
 * intentá usar /efector_plantilla/buscar/ sin params)
 */
export const getEfectorPlantillasAll = (): Promise<EfectorPlantilla[]> =>
  http.get<EfectorPlantilla[]>(`efector_plantilla/`).then(res => res.data)
  .catch(() => http.get<EfectorPlantilla[]>(`efector_plantilla/buscar/`).then(res => res.data));

/**
 * New: llama al endpoint /turnos/count/ que añadiste en backend.
 * Acepta arrays y construye params CSV. Devuelve un número (count).
 */
// types (exportalo si lo usás en varios lados)
export type TurnosCountResult = {
  count: number;
  msj_recordatorio: number;
  msj_confirmacion: number;
  msj_cancelacion: number;
  msj_reprogramacion: number;
};

export const getTurnosCount = (
  id_servicio?: number | number[],
  id_especialidad?: number | number[],
  efectores?: number | number[],
  id_estado?: number
): Promise<TurnosCountResult> => {
  let url = `turnos/count/`;
  const params: string[] = [];

  const toCsv = (val: number | number[] | undefined) =>
    Array.isArray(val) ? val.join(",") : val?.toString();

  const pushParam = (key: string, val?: number | number[]) => {
    const csv = toCsv(val);
    if (csv !== undefined) params.push(`${key}=${encodeURIComponent(csv)}`);
  };

  pushParam("id_servicio", id_servicio);
  pushParam("id_especialidad", id_especialidad);
  if (id_estado !== undefined) params.push(`id_estado=${encodeURIComponent(String(id_estado))}`);
  pushParam("efectores", efectores);

  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  return http.get<Partial<TurnosCountResult>>(url).then(res => {
    const d = res.data ?? {};
    return {
      count: Number(d.count ?? 0),
      msj_recordatorio: Number(d.msj_recordatorio ?? 0),
      msj_confirmacion: Number(d.msj_confirmacion ?? 0),
      msj_cancelacion: Number(d.msj_cancelacion ?? 0),
      msj_reprogramacion: Number(d.msj_reprogramacion ?? 0),
    };
  });
};

/**
 * Fallback: cuando no existe /turnos/count/ o falla, combinamos llamadas a getTurnosAll
 * y deduplicamos por id.
 */
export const getTurnosByCombinations = async (
  servicios?: number[],
  especialidades?: number[],
  id_estado?: number
): Promise<Turno[]> => {
  const servs = servicios && servicios.length ? servicios : [undefined];
  const esps = especialidades && especialidades.length ? especialidades : [undefined];

  const promises: Promise<Turno[]>[] = [];
  servs.forEach(s => {
    esps.forEach(es => {
      promises.push(getTurnosAll(s as any, es as any, id_estado));
    });
  });

  const results = await Promise.all(promises);
  const all = results.flat();
  // dedupe por id (si tu Turno usa otra clave, ajustá aquí)
  const unique = Array.from(new Map(all.map((t: any) => [t.id, t])).values());
  return unique;
};


// Obtener todos los turnos con un límite de cantidad
export const getTurnosMergedLimit = (cantidad: number): Promise<TurnoExtend[]> => {
  if (cantidad <= 0) return Promise.resolve([]);
  const url = '/turnos-merged-all-list/';
  return http
    .get<TurnoExtend[]>(url, { params: { cantidad } })
    .then(res => res.data);
};

// Mantengo las funciones originales
export const getTurnosMergedAll = (ids?: Array<string | number>): Promise<TurnoExtend[]> => {
  if (ids && ids.length === 0) return Promise.resolve([]);
  const url = '/turnos-merged-all-list/';
  if (!ids) return http.get<TurnoExtend[]>(url).then(res => res.data);

  const idsCsv = ids.map(String).map(encodeURIComponent).join(',');
  return http.get<TurnoExtend[]>(url, { params: { ids: idsCsv } }).then(res => res.data);
};

export const getTurnosByIds = (ids: Array<string | number>): Promise<TurnoExtend[]> => {
  return getTurnosMergedAll(ids);
};


export const getEstadomsj = (id: number, id_mensaje: string, numero: string) => {
  return http.post('get_last_ack/', { id, id_mensaje, numero });
};
export const getSignificado = async (id: number): Promise<EstadoMsj> => {
  return await http.get<EstadoMsj>(`estado_msj/${id}/`).then(res => res.data);
};


export const getHistoricoTurno = (dni:number) => {
  return http.get(`get_historico/?dni=${dni}`).then(res => res.data);
}