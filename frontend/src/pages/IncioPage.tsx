// InitPage.tsx
import { useEffect, useState, useCallback,useContext } from 'react'
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
import { getTurnosCount } from '../features/turno/api'
import {  getServiciosAll, getEspecialidadesAll, getEfeSerEspAll} from '../features/efe_ser_esp/api'
import type {  Especialidad, Servicio } from '../features/efe_ser_esp/types'
import type { EfeSerEsp } from '../features/efe_ser_esp/types'
import HospitalIcon from '../assets/hospital.png'
import AidKitIcon from '../assets/first-aid-kit.png'
import MedicalReportIcon from '../assets/medical-report.png'
import {  AuthContext } from '../common/contex'

function InitPage() {
  const [turnos, setTurnos] = useState<number>(0)
  const { efectores } = useContext(AuthContext);
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [combinaciones, setCombinaciones] = useState<EfeSerEsp[]>([])

  // Disponibles según combinación actual
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
      const [se, es, co] = await Promise.all([
        getServiciosAll(),
        getEspecialidadesAll(),
        getEfeSerEspAll()
      ]);
    
      setServicios(se);
      setEspecialidades(es);
      setCombinaciones(co);
      
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
      setAvailableServicios(servicios.map(s => s.id));
      setAvailableEspecialidades(especialidades.map(e => e.id));
      setSelectedServicios([]);
      setSelectedEspecialidades([]);
      return;
    }

    // Filtramos combinaciones por efectores seleccionados
    const posibles = combinaciones.filter(p => efs.includes(p.id_efector));

    // Servicios posibles según efectores
    const serviciosPosibles = [...new Set(posibles.map(p => p.id_servicio))];
    setAvailableServicios(serviciosPosibles);

    // Si ya hay servicios seleccionados, filtramos especialidades
    if (selectedServicios.length > 0) {
      const especialidadesPosibles = combinaciones
        .filter(p =>
          efs.includes(p.id_efector) &&
          selectedServicios.includes(p.id_servicio)
        )
        .map(p => p.id_especialidad);

      setAvailableEspecialidades([...new Set(especialidadesPosibles)]);
    } else {
      // Si no hay servicios seleccionados, resetear a todas posibles
      const todasEspecialidades = posibles.map(p => p.id_especialidad);
      setAvailableEspecialidades([...new Set(todasEspecialidades)]);
    }
  }, [ selectedEfectores]);

  const filterByServ = useCallback((servs: number[]) => {
    if (servs.length === 0) {
      setSelectedEspecialidades([]);
      setAvailableEspecialidades(especialidades.map(e => e.id));
      return;
    }

    const posibles = combinaciones.filter(p =>
      servs.includes(p.id_servicio) &&
      selectedEfectores.includes(p.id_efector)
    );

    const especialidadesPosibles = [...new Set(posibles.map(p => p.id_especialidad))];
    setAvailableEspecialidades(especialidadesPosibles);

  }, [selectedServicios]);


  const getCount = async () => {
    const serviciosParam = selectedServicios.length ? selectedServicios : undefined;
    const especialidadesParam = selectedEspecialidades.length ? selectedEspecialidades : undefined;
    const efectoresParam = selectedEfectores.length ? selectedEfectores : undefined;

    try {
      const res = await getTurnosCount(
        serviciosParam,
        especialidadesParam,
        efectoresParam,
        1
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
            // sólo abre el menú si NO está deshabilitado
            onClick={(e) => {
              if (selectedEfectores.length === 0) return;
              setAnchorServicio(e.currentTarget)
            }}
            sx={{
              width: 120,
              height: 120,
              borderRadius: 3,
              // oscurecer cuando está deshabilitado
              filter: selectedEfectores.length === 0 ? "brightness(0.75)" : "none",
              cursor: selectedEfectores.length === 0 ? "default" : "pointer",
            }}
            aria-label="servicios"
            aria-disabled={selectedEfectores.length === 0}
            tabIndex={selectedEfectores.length === 0 ? -1 : 0}
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

  <Box sx={{ textAlign: "center", mt: 3, display: "flex", justifyContent: "center", gap: 3 }}>
    <Button variant="contained" disableElevation onClick={() => navigate('/turnos')}>
      Turnos
    </Button>
    <Button variant="contained" disableElevation onClick={() => navigate('/list')}>
      Configuración
    </Button>
    <Button variant="contained" disableElevation onClick={() => navigate('/espera')}>
      Espera
    </Button>
  </Box>


    </Box>
  )
}

export default InitPage
