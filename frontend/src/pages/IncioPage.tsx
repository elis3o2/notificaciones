// InitPage.tsx
import { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Checkbox,
  ListItemIcon,
  ListItemText,
  Chip,
  Stack,
  Button,
  CircularProgress
} from "@mui/material"
import { useNavigate } from 'react-router-dom'
import {
  getTurnosAll,
  getEfectoresAll,
  getServiciosAll,
  getEspecialidadesAll,
  getEfectorPlantillasAll,
  getTurnosCount,
  getTurnosByCombinations
} from '../features/turno/api'
import { Business, MedicalServices, LocalHospital } from "@mui/icons-material"

import type { Efector, Especialidad, Servicio } from '../features/turno/types'
import type { EfectorPlantilla } from '../features/turno/types'
import HospitalIcon from '../assets/hospital.png'
import AidKitIcon from '../assets/first-aid-kit.png'
import MedicalReportIcon from '../assets/medical-report.png'


function InitPage() {
  const [turnos, setTurnos] = useState<number>(0)
  const [efectores, setEfectores] = useState<Efector[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [efectorPlantillas, setEfectorPlantillas] = useState<EfectorPlantilla[]>([])

  // Disponibles según combinación actual
  const [availableEfectores, setAvailableEfectores] = useState<number[]>([])
  const [availableServicios, setAvailableServicios] = useState<number[]>([])
  const [availableEspecialidades, setAvailableEspecialidades] = useState<number[]>([])

  // selección múltiple (vacío = "todos")
  const [selectedEfectores, setSelectedEfectores] = useState<number[]>([])
  const [selectedServicios, setSelectedServicios] = useState<number[]>([])
  const [selectedEspecialidades, setSelectedEspecialidades] = useState<number[]>([])

  // Menús abiertos
  const [anchorEfector, setAnchorEfector] = useState<null | HTMLElement>(null)
  const [anchorServicio, setAnchorServicio] = useState<null | HTMLElement>(null)
  const [anchorEspecialidad, setAnchorEspecialidad] = useState<null | HTMLElement>(null)
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate()


  // nuevos estados para contadores de mensajes
  const [msjRecordatorioCount, setMsjRecordatorioCount] = useState<number>(0)
  const [msjConfirmacionCount, setMsjConfirmacionCount] = useState<number>(0)



  const init = async () => {
    try {
      const [ef, se, es, ep] = await Promise.all([
        getEfectoresAll(),
        getServiciosAll(),
        getEspecialidadesAll(),
        getEfectorPlantillasAll()
      ]);
      
      setEfectores(ef);
      setServicios(se);
      setEspecialidades(es);
      setEfectorPlantillas(ep);
      
      // Inicializar disponibles con todos los IDs
      setAvailableEfectores(ef.map(e => e.id));
      setAvailableServicios(se.map(s => s.id));
      setAvailableEspecialidades(es.map(e => e.id));
    } catch (error) {
      console.error("Error inicializando datos:", error);
    } finally {
      setLoading(false);
    }
  }

  const filterByEfec = useCallback((efs: number[]) => {
    if (efs.length === 0) {
      if (selectedServicios.length === 0){
        setAvailableEfectores(efectores.map(e => e.id))
        setAvailableServicios(servicios.map(s => s.id))
        setAvailableEspecialidades(especialidades.map(e => e.id))
      }
      else{
        setAvailableServicios(servicios.map(s => s.id))
        const posibles = efectorPlantillas.filter(p => selectedServicios.includes(p.id_servicio));
        setAvailableEfectores(posibles.map(e => e.id_efector))
        setAvailableEspecialidades(posibles.map(p => p.id_especialidad))
      }
      return;
    }

    const posibles = efectorPlantillas.filter(p => efs.includes(p.id_efector));
    const serviciosPosibles = [...new Set(posibles.map(p => p.id_servicio))];
    const especialidadesPosibles = [...new Set(posibles.map(p => p.id_especialidad))];

    setAvailableServicios(prev => prev.filter(id => serviciosPosibles.includes(id)));
    setAvailableEspecialidades(prev => prev.filter(id => especialidadesPosibles.includes(id)));
  }, [efectorPlantillas, servicios, especialidades]);

  const filterByServ = useCallback((servs: number[]) => {
    if (servs.length === 0) {
      setSelectedEspecialidades([])
      setAvailableEfectores(efectores.map(e => e.id))

      if(selectedEfectores.length === 0){
        setAvailableServicios(servicios.map(s => s.id))
        setAvailableEspecialidades(especialidades.map(e => e.id))
      }
      else{
          const posibles = efectorPlantillas.filter(p => selectedEfectores.includes(p.id_efector));
          setAvailableServicios(posibles.map(p => p.id_servicio))
          setAvailableEspecialidades(posibles.map(p => p.id_especialidad))
      }

      return;
    }

    const posibles = efectorPlantillas.filter(p => servs.includes(p.id_servicio));
    const efectoresPosibles = [...new Set(posibles.map(p => p.id_efector))];
    const especialidadesPosibles = [...new Set(posibles.map(p => p.id_especialidad))];

    setAvailableEfectores(prev => prev.filter(id => efectoresPosibles.includes(id)));
    setAvailableEspecialidades(prev => prev.filter(id => especialidadesPosibles.includes(id)));
  }, [efectorPlantillas, efectores, especialidades]);


  const filterByEsp = useCallback((esps: number[]) => {
    if (esps.length === 0) {
      if(selectedEfectores.length === 0 && selectedEspecialidades.length != 0){
        const posibles = efectorPlantillas.filter(p => selectedServicios.includes(p.id_servicio));
        setAvailableEfectores(posibles.map(p => p.id_efector))
      }
      else if(selectedEfectores.length != 0 && selectedEspecialidades.length != 0){
        const posibles = efectorPlantillas.filter(p => selectedServicios.includes(p.id_servicio) && 
                                                      selectedEfectores.includes(p.id_efector));
        setAvailableEspecialidades(posibles.map(p => p.id_especialidad))
      }
      return;
    }

    const posibles = efectorPlantillas.filter(p => esps.includes(p.id_especialidad));
    const efectoresPosibles = [...new Set(posibles.map(p => p.id_efector))];

    // Intersectar con los disponibles actuales
    setAvailableEfectores(prev => prev.filter(id => efectoresPosibles.includes(id)));
  }, [efectorPlantillas]);


  const getCount = async () => {
    const serviciosParam = selectedServicios.length ? selectedServicios : undefined;
    const especialidadesParam = selectedEspecialidades.length ? selectedEspecialidades : undefined;
    const efectoresParam = selectedEfectores.length ? selectedEfectores : undefined;

    try {
      const res = await getTurnosCount(
        serviciosParam,
        especialidadesParam,
        efectoresParam,
        0
      );

      // adaptarse a la forma que devuelve tu API; se asume:
      // { count: number, msj_recordatorio: number, msj_confirmacion: number, ... }
      setTurnos(res.count);
      setMsjRecordatorioCount(res.msj_recordatorio);
      setMsjConfirmacionCount(res.msj_confirmacion);
    } catch (err) {
      console.error("Error obteniendo conteo de turnos:", err);
      setTurnos(0);
      setMsjRecordatorioCount(0);
      setMsjConfirmacionCount(0);
    }
  };

  useEffect(() => {
    init();
  }, []);

  // Aplicar filtros cuando cambian las selecciones
  useEffect(() => {
    filterByEfec(selectedEfectores);
  }, [selectedEfectores, filterByEfec]);

  useEffect(() => {
    filterByServ(selectedServicios);
  }, [selectedServicios, filterByServ]);

  useEffect(() => {
    filterByEsp(selectedEspecialidades);
  }, [selectedEspecialidades, filterByEsp]);

  // Obtener conteo cuando cambian las selecciones
  useEffect(() => {
    getCount();
  }, [selectedEfectores, selectedServicios, selectedEspecialidades]);

  // Handlers para seleccionar/deseleccionar items
  const handleToggleEfector = (id: number) => {
    setSelectedEfectores(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleServicio = (id: number) => {
    setSelectedServicios(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleEspecialidad = (id: number) => {
    setSelectedEspecialidades(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Helper para eliminar selecciones
  const removeFromSelected = (setter: React.Dispatch<React.SetStateAction<number[]>>, arr: number[], id: number) => {
    setter(arr.filter(x => x !== id));
  };

  if (loading) {
      return (
        <Box sx={{ p: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <CircularProgress />
          <Typography>Cargando datos...</Typography>
        </Box>
      );
    }

  // --- NUEVO: deshabilitar especialidades si no hay servicios seleccionados
  const isEspecialidadDisabled = selectedServicios.length === 0;

  return (
    <Box sx={{ p: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        {/* Efector */}
        <Box sx={{ textAlign: "center" }}>
          <IconButton
            onClick={(e) => setAnchorEfector(e.currentTarget)}
            sx={{ width: 120, height: 120, borderRadius: 3 }}
            aria-label="efectores"
          >
          <img src={HospitalIcon} alt="Hospital" width={64} height={64} />
          </IconButton>

          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap', maxWidth: 220 }}>
            {selectedEfectores.length === 0 ? (
              <Chip label="Todos los efectores" size="small" sx={{ backgroundColor: '#1976d2', color: 'white' }}/>
            ) : (
              selectedEfectores.map(id => {
                const ef = efectores.find(e => e.id === id)
                return (
                  <Chip
                    key={id}
                    label={ef ? ef.nombre : id}
                    size="small"
                    sx={{ backgroundColor: '#1976d2', color: 'white' }}
                    onDelete={() => removeFromSelected(setSelectedEfectores, selectedEfectores, id)}
                  />
                )
              })
            )}
          </Stack>

          <Menu
            anchorEl={anchorEfector}
            open={Boolean(anchorEfector)}
            onClose={() => setAnchorEfector(null)}
            PaperProps={{ style: { maxHeight: 320, minWidth: 260 } }}
          >
            <MenuItem
              onClick={() => {
                setSelectedEfectores([])
                setAnchorEfector(null)
              }}
            >
              <ListItemText>Todos los efectores</ListItemText>
            </MenuItem>

            {efectores
              .filter(e => availableEfectores.includes(e.id))
              .map(e => (
                <MenuItem
                  key={e.id}
                  onClick={() => handleToggleEfector(e.id)}
                >
                  <ListItemIcon>
                    <Checkbox edge="start" checked={selectedEfectores.includes(e.id)} />
                  </ListItemIcon>
                  <ListItemText>{e.nombre}</ListItemText>
                </MenuItem>
            ))}
          </Menu>
        </Box>

        {/* Servicio */}
        <Box sx={{ textAlign: "center" }}>
          <IconButton
            onClick={(e) => setAnchorServicio(e.currentTarget)}
            sx={{ width: 120, height: 120, borderRadius: 3 }}
            aria-label="servicios"
          >
          <img src={MedicalReportIcon} alt="Hospital" width={64} height={64} />
            </IconButton>

          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap', maxWidth: 220 }}>
            {selectedServicios.length === 0 ? (
              <Chip label="Todos los servicios" size="small" sx={{ backgroundColor: '#1976d2', color: 'white' }} />
              
            ) : (
              selectedServicios.map(id => {
                const s = servicios.find(x => x.id === id)
                return (
                  <Chip
                    key={id}
                    label={s ? s.nombre : id}
                    size="small"
                    sx={{ backgroundColor: '#1976d2', color: 'white' }}
                    onDelete={() => removeFromSelected(setSelectedServicios, selectedServicios, id)}
                  />
                )
              })
            )}
          </Stack>

          <Menu
            anchorEl={anchorServicio}
            open={Boolean(anchorServicio)}
            onClose={() => setAnchorServicio(null)}
            PaperProps={{ style: { maxHeight: 360, minWidth: 280 } }}
          >
            <MenuItem
              onClick={() => {
                setSelectedServicios([])
                setAnchorServicio(null)
              }}
            >
              <ListItemText>Todos los servicios</ListItemText>
            </MenuItem>

            {servicios
              .filter(s => availableServicios.includes(s.id))
              .map(s => (
                <MenuItem
                  key={s.id}
                  onClick={() => handleToggleServicio(s.id)}
                >
                  <ListItemIcon>
                    <Checkbox edge="start" checked={selectedServicios.includes(s.id)} />
                  </ListItemIcon>
                  <ListItemText>{s.nombre}</ListItemText>
                </MenuItem>
              ))}
          </Menu>
        </Box>

        {/* Especialidad */}
        <Box sx={{ textAlign: "center" }}>
          <IconButton
            // sólo abre el menú si NO está deshabilitado
            onClick={(e) => {
              if (isEspecialidadDisabled) return;
              setAnchorEspecialidad(e.currentTarget)
            }}
            sx={{
              width: 120,
              height: 120,
              borderRadius: 3,
              // oscurecer cuando está deshabilitado
              filter: isEspecialidadDisabled ? "brightness(0.75)" : "none",
              cursor: isEspecialidadDisabled ? "default" : "pointer",
            }}
            aria-label="especialidades"
            aria-disabled={isEspecialidadDisabled}
            tabIndex={isEspecialidadDisabled ? -1 : 0}
          >
          <img src={AidKitIcon} alt="Hospital" width={64} height={64} />
          </IconButton>

          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap', maxWidth: 220 }}>
            {selectedEspecialidades.length === 0 ? (
              <Chip label="Todas las especialidades" size="small" sx={{ backgroundColor: '#1976d2', color: 'white' }} />
            ) : (
              selectedEspecialidades.map(id => {
                const es = especialidades.find(x => x.id === id)
                return (
                  <Chip
                    key={id}
                    label={es ? es.nombre : id}
                    size="small"
                    sx={{ backgroundColor: '#1976d2', color: 'white' }}
                    onDelete={() => removeFromSelected(setSelectedEspecialidades, selectedEspecialidades, id)}
                  />
                )
              })
            )}
          </Stack>

          <Menu
            anchorEl={anchorEspecialidad}
            open={Boolean(anchorEspecialidad)}
            onClose={() => setAnchorEspecialidad(null)}
            PaperProps={{ style: { maxHeight: 360, minWidth: 320 } }}
          >
            <MenuItem
              onClick={() => {
                setSelectedEspecialidades([])
                setAnchorEspecialidad(null)
              }}
            >
              <ListItemText>Todas las especialidades</ListItemText>
            </MenuItem>

            {especialidades
              .filter(es => availableEspecialidades.includes(es.id))
              .map(es => (
                <MenuItem
                  key={es.id}
                  onClick={() => handleToggleEspecialidad(es.id)}
                >
                  <ListItemIcon>
                    <Checkbox edge="start" checked={selectedEspecialidades.includes(es.id)} />
                  </ListItemIcon>
                  <ListItemText>{es.nombre}</ListItemText>
                </MenuItem>
              ))}
          </Menu>
        </Box>
      </Box>

      {/* Número de turnos */}
      <Card sx={{ textAlign: "center", p: 4, boxShadow: 6, borderRadius: 5, width:"60%", minWidth:400 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Número de turnos programados
          </Typography>
          <Typography variant="h2" color="black" fontWeight="bold">
            {turnos}
          </Typography>
        </CardContent>
      </Card>

      {/* --- NUEVO BLOQUE: contadores de mensajes --- */}
      <Box sx={{ width: "65%", display: "flex", minWidth:400,gap: 2, mt: 2, flexWrap: "wrap", justifyContent: "center" }}>
        <Card sx={{ flex: "1 1 220px", textAlign: "center", boxShadow: 3, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2">Mensajes de Confirmación</Typography>
            <Typography variant="h4" fontWeight="bold">{msjConfirmacionCount}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: "1 1 220px", textAlign: "center", boxShadow: 3, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2">Mensajes de Recordatorio</Typography>
            <Typography variant="h4" fontWeight="bold">{msjRecordatorioCount}</Typography>
          </CardContent>
        </Card>
      </Box>

  <Box sx={{ textAlign: "center", mt: 3, display: "flex", justifyContent: "center", gap: 2 }}>
    <Button variant="contained" disableElevation onClick={() => navigate('/turnos')}>
      Turnos
    </Button>
    <Button variant="contained" disableElevation onClick={() => navigate('/list')}>
      Configuración
    </Button>
  </Box>


    </Box>
  )
}

export default InitPage
