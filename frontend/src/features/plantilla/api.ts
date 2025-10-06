import http from '../../common/api/client'
import type { Plantilla, EfeSerEspPlantilla} from './types'


export const getPlantillas = (): Promise<Plantilla[]> =>
	http.get<Plantilla[]>(`plantilla/`).then(res => res.data);


export const getPlantillaById = (id: number): Promise<Plantilla> =>
  http.get<Plantilla>(`plantilla/${id}/`).then(res => res.data);


export const getPlantillaByTipo = (id: number): Promise<Plantilla[]> =>
  http.get<Plantilla[]>(`plantilla/?id_tipo=${id}`).then(res => res.data);

export const getPlantillaByEfector = (id: number): Promise<EfeSerEspPlantilla[]> =>
  http.get<EfeSerEspPlantilla[]>(`efe_ser_esp_plantilla/buscar/?id_efector=${id}`).then(res => res.data);


export const updateEfectorPlantilla = (id: number, data: EfeSerEspPlantilla): Promise<EfeSerEspPlantilla> =>
  http.patch<EfeSerEspPlantilla>(`efe_ser_esp_plantilla/${id}/`, data).then(res => res.data);

export const getPlantillaByEfectorServicio = (id_e: number, id_s: number): Promise<EfeSerEspPlantilla[]> =>
  http.get<EfeSerEspPlantilla[]>(`efe_ser_esp_plantilla/detalle/?id_efector=${id_e}&id_servicio=${id_s}`).then(res => res.data);


export const getEfeSerEspPlantillaAll = (): Promise<EfeSerEspPlantilla[]> =>
  http.get<EfeSerEspPlantilla[]>(`efe_ser_esp_plantilla/buscar`).then(res => res.data); 