import { HttpOutlined } from '@mui/icons-material';
import http from '../../common/api/client'
import type { Plantilla} from './types'


export const getPlantillas = (): Promise<Plantilla[]> =>
	http.get<Plantilla[]>(`plantilla/`).then(res => res.data);


export const getPlantillaById = (id: number): Promise<Plantilla> =>
	http.get<Plantilla>(`plantilla/id=${id}/`).then(res => res.data);


export const getPlantillaByTipo = (id: number): Promise<Plantilla[]> =>
  http.get<Plantilla[]>(`plantilla/?id_tipo=${id}`).then(res => res.data);

export const postPlantilla = (id: number, contenido: string): Promise<Plantilla> =>
  // enviar en body: el ViewSet usará el serializer para crear el objeto
  http.post<Plantilla>(`plantilla/`, { id_tipo: id,contenido: contenido }).then(res => res.data);