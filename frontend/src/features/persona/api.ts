import http from '../../common/api/client'
import type { Paciente, Profesional } from './types'


export const getPacienteByDNI = (dni:string): Promise<Paciente[]> => {
  return http.get<Paciente[]>(`get_paciente/?dni=${dni}`).then(res => res.data);
}

export const getProfesionalByEfector = (id:number, n:string|null, a:string | null): Promise<Profesional[]> => {
    let added = "";
  if (n) { added += `&nombre=${n}`}
  if (a) { added += `&apellido=${a}`}
    return http.get<Profesional[]>(`get_profesional/?id_efector=${id}${added}`).then(res => res.data);
}


