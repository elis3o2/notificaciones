import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  GridLegacy as Grid,
  FormControl,
  InputLabel,
  Select,
  Paper,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Switch,
  FormGroup,
  Skeleton,
  Pagination,
  Stack,
  ListItemText
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { motion, AnimatePresence } from 'framer-motion';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import GetAppIcon from '@mui/icons-material/GetApp';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { getTurnosMergedLimit, getTurnosAlerta, getTurnosErrorMergedLimit } from '../features/turno/api';
import type { TurnoExtend } from '../features/turno/types';
import { useNavigate } from 'react-router-dom';
import type { Efector, Servicio } from '../features/efe_ser_esp/types';
import { AuthContext } from '../common/contex';
import { getServicioByEfector } from '../features/efe_ser_esp/api';

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<TurnoExtend[]>([]);
  const [loading, setLoading] = useState(false);
  const { efectores } = useContext(AuthContext) as { efectores?: Efector[] };
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [selectedEfectores, setSelectedEfectores] = useState<number[]>([]);
  const [selectedServicios, setSelectedServicios] = useState<number[]>([]);
  // filtros / UI
  const [anchorCols, setAnchorCols] = useState<null | HTMLElement>(null);
  const [compactView, setCompactView] = useState(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 25; // antes limit
  const [total, setTotal] = useState<number>(0); // total rows del servidor
  const [fechaDesde, setFechaDesde] = useState<string | null>(null);
  const [fechaHasta, setFechaHasta] = useState<string | null>(null);
  const cellPadding = compactView ? '6px 8px' : '12px 16px';
  const typographyVariant = compactView ? 'caption' : 'body2';
  // --- Estados para alertas ---
  const [alertData, setAlertData] = useState<null | {
    count_total: number,
    grupos: {
      cancelados: TurnoExtend[],
      incorrectos: TurnoExtend[],
      sin_respuesta: TurnoExtend[]
    }
  }>(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertMode, setAlertMode] = useState(false); // cuando true mostramos turnos de alertas
  const [activeAlertCategory, setActiveAlertCategory] = useState<
    'cancelados' | 'incorrectos' | 'sin_respuesta'
  >('cancelados');

  const navigate = useNavigate();

  // cargar servicios cuando cambia el efector
  async function loadServicio() {
    if (!selectedEfectores || selectedEfectores.length === 0) {
      setServicios([]);
      setSelectedServicios([]); // opcional: limpiar selección de servicios si no hay efectores
      return;
    }

    try {
      // obtener servicios por cada efector y mezclarlos
      const promises = selectedEfectores.map(id => getServicioByEfector(id));
      const results = await Promise.all(promises);
      // results es array de arrays. Unir y quitar duplicados por id
      const merged: Record<number, Servicio> = {};
      for (const arr of results) {
        for (const s of arr) {
          merged[s.id] = s;
        }
      }
      const mergedList = Object.values(merged);
      // opcional: ordenar por nombre
      mergedList.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
      setServicios(mergedList);
      // si seleccionaste servicios que ya no existen en merged, filtrarlos
      setSelectedServicios(prev => prev.filter(id => merged[id] || mergedList.find(s => s.id === id)));
    } catch (err) {
      console.error('Error cargando servicios para efectores seleccionados', err);
      setServicios([]);
    }
  }

  useEffect(() => {
    // cuando cambia efector o servicio: resetear página y recargar
    loadServicio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEfectores]);

  // carga activa: se ejecuta cuando page o pageSize o selectedEfector cambian
  useEffect(() => {
    // si estamos en modo alertas no recargamos la paginación normal
    if (!alertMode) loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // ----------- loadPage actualizado -------------
  async function loadPage() {
    // si no hay efector seleccionado no hacemos request
    if (selectedEfectores.length === 0) {
      setTurnos([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;

      // Espero que getTurnosMergedLimit devuelva { response, count }
      const data = await getTurnosMergedLimit(pageSize, offset, selectedEfectores, selectedServicios, fechaDesde, fechaHasta);

      setTurnos(data.response);
      setTotal(data.count);
    } catch (e: any) {
      console.error('Error cargando turnos paginados', e);
    } finally {
      setLoading(false);
    }
  }
  async function loadAll() { await loadPage(); }

  // ---------- Nueva función: buscar turnos con error en último mensaje ----------
  async function handleSearchError() {
    // No hacemos nada si no hay efectores seleccionados
    if (!selectedEfectores || selectedEfectores.length === 0) {
      setTurnos([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      // Llamamos a la función que pediste
      const data = await getTurnosErrorMergedLimit(pageSize, offset, selectedEfectores, selectedServicios, fechaDesde, fechaHasta);

      setTurnos(data.response);
      setTotal(data.count);
      // aseguramos salir del modo alertas si estaba activo
      if (alertMode) setAlertMode(false);
    } catch (err: any) {
      console.error('Error cargando turnos con error:', err);
      setTurnos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Alertas: fetch inicial al montar usando efectores del AuthContext ----------
  useEffect(() => {
    const efIds = efectores?.map(e => e.id) ?? [];
    if (efIds.length === 0) return;

    (async () => {
      setAlertLoading(true);
      try {
        const data = await getTurnosAlerta(efIds);
        setAlertData(data);
      } catch (err) {
        console.error('Error cargando turnos alerta', err);
        setAlertData(null);
      } finally {
        setAlertLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efectores]);

  // Función que aplica (o desactiva) el modo alertas:
  async function handleToggleAlertMode() {
    const efIds = efectores?.map(e => e.id) ?? [];
    if (efIds.length === 0) return;

    if (!alertData) {
      setAlertLoading(true);
      try {
        const data = await getTurnosAlerta(efIds);
        setAlertData(data);
      } catch (err) {
        console.error('Error recargando turnos alerta', err);
        setAlertData(null);
      } finally {
        setAlertLoading(false);
      }
    }

    const next = !alertMode;
    setAlertMode(next);

    if (next) {
      const cat = activeAlertCategory;
      const grouped = alertData?.grupos ?? { cancelados: [], incorrectos: [], sin_respuesta: [] };
      const newTurnos = grouped[cat] ?? [];
      setTurnos(newTurnos);
      setTotal(newTurnos.length);
    } else {
      setPage(1);
      await loadPage();
    }
  }

  // cuando cambio la categoria activa y estoy en alertMode, actualizo tabla
  useEffect(() => {
    if (!alertMode) return;
    const cat = activeAlertCategory;
    const grouped = alertData?.grupos ?? { cancelados: [], incorrectos: [], sin_respuesta: [] };
    const newTurnos = grouped[cat] ?? [];
    setTurnos(newTurnos);
    setTotal(newTurnos.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlertCategory, alertMode]);

  // ... tus funciones getMsj, getMsjReco, handleClickEstado mantienen igual ...
  function getMsj(type: number, list?: any[]): any | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    for (const item of list) if (item?.plantilla?.tipo?.id === type) return item;
    return undefined;
  }

  function getMsjReco(list?: any[]): any | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    for (const item of list) if (item?.plantilla?.tipo?.id === 4) return item;
    return undefined;
  }

  const handleChangePage = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

const cellSx = (maxWidth?: number | string) => ({
    padding: cellPadding,
    maxWidth: maxWidth ?? undefined,
    // solo aplicar truncamiento en vista compacta
    overflow: compactView ? 'hidden' : undefined,
    textOverflow: compactView ? 'ellipsis' : undefined,
    whiteSpace: compactView ? 'nowrap' : undefined,
  });

  // wrapper que garantiza el truncamiento visual y usa Typography dentro
  const wrapTypography = (content: React.ReactNode) => (
    <Box
      component="div"
      sx={{
        display: 'block',
        overflow: compactView ? 'hidden' : 'visible',
        textOverflow: compactView ? 'ellipsis' : 'unset',
        whiteSpace: compactView ? 'nowrap' : 'normal',
      }}
      title={typeof content === 'string' ? content : undefined} // tooltip nativo al pasar el mouse
    >
      <Typography
        variant={typographyVariant as any}
        // noWrap ya no es necesario porque lo maneja el contenedor
        sx={{ lineHeight: 1.1, fontSize: compactView ? '0.72rem' : undefined, display: 'inline-block' }}
      >
        {content}
      </Typography>
    </Box>
  );

  // ---- columnas y resto del render sin cambios ----
  const allColumns = useMemo(() => [
    { key: 'respuesta', label: 'Respuesta' },
    { key: 'dni', label: 'DNI' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'apellido', label: 'Apellido' },
    { key: 'efector', label: 'Efector' },
    { key: 'servicio', label: 'Servicio' },
    { key: 'especialidad', label: 'Especialidad' },
    { key: 'prof_nombre', label: 'Nombre profesional' },
    { key: 'prof_apellido', label: 'Apellido profesional' },
    { key: 'estado', label: 'Estado' },
    { key: 'confirmacion', label: 'Confirmacion' },
    { key: 'cancelacion', label: 'Cancelacion' },
    { key: 'reprogramacion', label: 'Reprogramacion' },
    { key: 'recordatorio', label: 'Recordatorio' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'hora', label: 'Hora' },
  ], []);

  const initialVisibility: Record<string, boolean> = useMemo(() => {
    const vis = allColumns.reduce((acc, c) => { acc[c.key] = true; return acc; }, {} as Record<string, boolean>);
    // Ocultar por defecto nombres y apellidos de paciente y profesional
    vis['nombre'] = false;
    vis['apellido'] = false;
    vis['prof_nombre'] = false;
    vis['prof_apellido'] = false;
    return vis;
  }, [allColumns]);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialVisibility);

  function toggleColumn(key: string) { setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] })); }
  function showAll() { const next: Record<string, boolean> = {}; allColumns.forEach(c => next[c.key] = true); setVisibleColumns(next); }

  const visibleKeys = allColumns.filter(c => visibleColumns[c.key]).map(c => c.key);
  const visibleCount = Math.max(1, visibleKeys.length);
  const tableMinWidth = useMemo(() => Math.max(visibleCount * 110, 700), [visibleCount]);


  function downloadCSV() {
    const headers = allColumns.filter(c => visibleColumns[c.key]).map(c => c.label);
    const rows = turnos.map(t => {
      const row: any[] = [];
      for (const c of allColumns) {
        if (!visibleColumns[c.key]) continue;
        switch (c.key) {
          case 'respuesta': row.push(t.estado_paciente?.nombre ?? ''); break;
          case 'dni': row.push(t.paciente_dni ?? ''); break;
          case 'nombre': row.push(t.paciente_nombre ?? ''); break;
          case 'apellido': row.push(t.paciente_apellido ?? ''); break;
          case 'efector': row.push(t.efe_ser_esp.efector?.nombre ?? String(t.efe_ser_esp.efector.id ?? '')); break;
          case 'servicio': row.push(t.efe_ser_esp.servicio?.nombre ?? String(t.efe_ser_esp.servicio.id ?? '')); break;
          case 'especialidad': row.push(t.efe_ser_esp.especialidad?.nombre ?? String(t.efe_ser_esp.especialidad.id ?? '')); break;
          case 'prof_nombre': row.push(t.profesional_nombre ?? ''); break;
          case 'prof_apellido': row.push(t.profesional_apellido ?? ''); break;
          case 'estado': row.push(t.estado?.nombre ?? ''); break;
          case 'recordatorio': {
            const mensaje_reco = getMsjReco(t.mensaje_asociado);
            row.push(mensaje_reco ? (mensaje_reco.estado?.significado ?? '') : ''); break;
          }
          case 'fecha': row.push(t.fecha ?? ''); break;
          case 'hora': row.push(t.hora ?? ''); break;
          default: row.push('');
        }
      }
      return row;
    });

    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turnos_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function estadoChipLabel(t: TurnoExtend) {
    const nombre = t.estado?.nombre ?? '—';
    return nombre;
  }

  function estadoRespChipLabel(t: TurnoExtend) {
    const nombre = t.estado_paciente?.nombre ?? '—';
    return nombre;
  }

  function estadoRespChipColor(t: TurnoExtend) {
    const n = t.estado_paciente?.nombre ?? '';
    if (n === 'SIN DATOS') return 'info';
    if (n === 'CONFIRMADO') return 'success';
    if (n === 'CANCELADO') return 'error';
    if (n === 'PERSONA INCORRECTA') return 'warning';
    if (n === 'SIN RESPUESTA') return 'warning';
    return 'default';
  }

  function estadoChipColor(t: TurnoExtend) {
    const n = t.estado?.nombre ?? '';
    if (n === 'ASIGNADO') return 'success';
    if (n === 'SUSPENDIDO') return 'error';
    if (n === 'REPROGRAMADO') return 'warning';
    if (n === 'FINALIZADO') return 'info';
    return 'default';
  }

  function renderCell(columnKey: string, t: TurnoExtend) {
    switch (columnKey) {
      case 'respuesta':
        return (
          <TableCell key={columnKey} sx={cellSx(160)}>
            <Chip size="small" label={estadoRespChipLabel(t)} color={estadoRespChipColor(t) as any} variant="outlined" />
          </TableCell>
        );
      case 'dni':
        return <TableCell key={columnKey} sx={cellSx(140)}>{wrapTypography(t.paciente_dni ?? '—')}</TableCell>;
      case 'nombre':
        return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.paciente_nombre ?? '—')}</TableCell>;
      case 'apellido':
        return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.paciente_apellido ?? '—')}</TableCell>;
      case 'efector':
        return <TableCell key={columnKey} sx={cellSx(200)}>{wrapTypography(t.efe_ser_esp.efector?.nombre ?? String(t.efe_ser_esp.efector.id ?? '—'))}</TableCell>;
      case 'servicio':
        return <TableCell key={columnKey} sx={cellSx(180)}>{wrapTypography(t.efe_ser_esp.servicio?.nombre ?? String(t.efe_ser_esp.servicio.id ?? '—'))}</TableCell>;
      case 'especialidad':
        return <TableCell key={columnKey} sx={cellSx(180)}>{wrapTypography(t.efe_ser_esp.especialidad?.nombre ?? String(t.efe_ser_esp.especialidad.id ?? '—'))}</TableCell>;
      case 'prof_nombre':
        return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.profesional_nombre ?? '—')}</TableCell>;
      case 'prof_apellido':
        return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.profesional_apellido ?? '—')}</TableCell>;
      case 'estado':
        return (
          <TableCell key={columnKey} sx={cellSx(160)}>
            <Chip size="small" label={estadoChipLabel(t)} color={estadoChipColor(t) as any} variant="outlined" />
          </TableCell>
        );

      case 'confirmacion': {
        const mensaje = getMsj(1, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={cellSx(220)}>
            {mensaje ? (
              <Tooltip
                title={tooltipTitle}
                arrow
                placement="top"
                enterDelay={150}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wrapTypography(mensaje.estado?.significado ?? '—')}
                  {mensaje?.fecha_envio ? <Typography variant="caption" sx={{ ml: 0.5, flexShrink: 0 }}>{mensaje.fecha_envio}</Typography> : null}
                </Box>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'cancelacion': {
        const mensaje = getMsj(2, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={cellSx(220)}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wrapTypography(mensaje.estado?.significado ?? '—')}
                  {mensaje?.fecha_envio ? <Typography variant="caption" sx={{ ml: 0.5, flexShrink: 0 }}>{mensaje.fecha_envio}</Typography> : null}
                </Box>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'reprogramacion': {
        const mensaje = getMsj(3, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={cellSx(220)}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wrapTypography(mensaje.estado?.significado ?? '—')}
                  {mensaje?.fecha_envio ? <Typography variant="caption" sx={{ ml: 0.5, flexShrink: 0 }}>{mensaje.fecha_envio}</Typography> : null}
                </Box>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'recordatorio': {
        const mensaje_reco = getMsjReco(t.mensaje_asociado);
        const tooltipTitle = mensaje_reco?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje_reco.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={cellSx(220)}>
            {mensaje_reco ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wrapTypography(mensaje_reco.estado?.significado ?? '—')}
                  {mensaje_reco?.fecha_envio ? <Typography variant="caption" sx={{ ml: 0.5, flexShrink: 0 }}>{mensaje_reco.fecha_envio}</Typography> : null}
                </Box>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'fecha':
        return <TableCell key={columnKey} sx={cellSx(120)}>{wrapTypography(t.fecha ?? '—')}</TableCell>;
      case 'hora':
        return <TableCell key={columnKey} sx={cellSx(90)}>{wrapTypography(t.hora ?? '—')}</TableCell>;
      default:
        return <TableCell key={columnKey} sx={cellSx()}>{wrapTypography('—')}</TableCell>;
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* ALERTAS: arriba de todo */}
      <Paper elevation={3} sx={{ p: 1, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          <Typography fontWeight={700}>Alerta</Typography>
          <Typography variant="caption" sx={{ ml: 1 }}>
            {alertLoading ? 'cargando...' : alertData ? `${alertData.count_total} turnos en total` : '—'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant={activeAlertCategory === 'cancelados' ? 'contained' : 'outlined'}
              onClick={() => setActiveAlertCategory('cancelados')}
            >
              CANCELADOS {alertData ? `(${alertData.grupos.cancelados.length})` : ''}
            </Button>
            <Button
              size="small"
              variant={activeAlertCategory === 'incorrectos' ? 'contained' : 'outlined'}
              onClick={() => setActiveAlertCategory('incorrectos')}
            >
              INCORRECTOS {alertData ? `(${alertData.grupos.incorrectos.length})` : ''}
            </Button>
            <Button
              size="small"
              variant={activeAlertCategory === 'sin_respuesta' ? 'contained' : 'outlined'}
              onClick={() => setActiveAlertCategory('sin_respuesta')}
            >
              SIN RESPUESTA {alertData ? `(${alertData.grupos.sin_respuesta.length})` : ''}
            </Button>
          </Box>

          <Button
            startIcon={<WarningAmberIcon />}
            color={alertMode ? 'warning' : 'inherit'}
            variant={alertMode ? 'contained' : 'outlined'}
            onClick={handleToggleAlertMode}
            disabled={alertLoading || !(efectores && efectores.length > 0)}
            size="small"
          >
            {alertLoading ? <CircularProgress size={18} /> : `ALERTA ${alertData ? `(${alertData.count_total})` : ''}`}
          </Button>
        </Box>
      </Paper>

      {/* FILTROS: debajo de las alertas, bien distribuidos */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* EFECTORES */}
          <Grid item xs={12} md={4}>
            <FormControl
              size="small"
              fullWidth
              sx={{ minWidth: 260, maxWidth: 520 }} // <- tamaño fijo razonable
            >
              <InputLabel id="efector-select-label">Efector</InputLabel>
              <Select
                labelId="efector-select-label"
                multiple
                value={selectedEfectores}
                label="Efector"
                onChange={(e) => {
                  const ids = e.target.value as number[];
                  setSelectedEfectores(ids);
                }}
                renderValue={(selected) => {
                  const ids = selected as number[];
                  return ids.map(id => efectores?.find(x => x.id === id)?.nombre ?? String(id)).join(', ');
                }}
                // fuerza tamaño mínimo visual del control
                sx={{ minWidth: 240 }}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {efectores && efectores.length > 0 ? (
                  efectores.map((ef) => (
                    <MenuItem key={ef.id} value={ef.id}>
                      <Checkbox checked={selectedEfectores.indexOf(ef.id) > -1} />
                      <ListItemText primary={ef.nombre ?? `Efector ${ef.id}`} />
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value="">(sin efectores)</MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* SERVICIOS */}
          <Grid item xs={12} md={4}>
            <FormControl
              size="small"
              fullWidth
              sx={{ minWidth: 260, maxWidth: 520 }} // <- mismo tamaño que efector para consistencia
            >
              <InputLabel id="servicio-select-label">Servicio</InputLabel>
              <Select
                labelId="servicio-select-label"
                multiple
                value={selectedServicios}
                label="Servicio"
                onChange={(e) => {
                  const ids = e.target.value as number[];
                  setSelectedServicios(ids);
                }}
                renderValue={(selected) => {
                  const ids = selected as number[];
                  return ids.map(id => servicios?.find(x => x.id === id)?.nombre ?? String(id)).join(', ');
                }}
                sx={{ minWidth: 240 }}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {servicios && servicios.length > 0 ? (
                  servicios.map((se) => (
                    <MenuItem key={se.id} value={se.id}>
                      <Checkbox checked={selectedServicios.indexOf(se.id) > -1} />
                      <ListItemText primary={se.nombre ?? `Servicio ${se.id}`} />
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value="">(sin servicios)</MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* RANGO FECHAS */}
          <Grid item xs={12} md={2}>
            <TextField
              size="small"
              label="Desde"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={fechaDesde ?? ''}
              onChange={(e) => setFechaDesde(e.target.value ? e.target.value : null)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              size="small"
              label="Hasta"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={fechaHasta ?? ''}
              onChange={(e) => setFechaHasta(e.target.value ? e.target.value : null)}
              fullWidth
            />
          </Grid>

          {/* BOTONES ACCION */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadAll} disabled={loading || selectedEfectores?.length === 0} size="small">
                {loading ? <CircularProgress size={18} /> : 'Buscar'}
              </Button>

              <Button
                startIcon={<WarningAmberIcon />}
                variant="outlined"
                onClick={handleSearchError}
                disabled={loading || selectedEfectores?.length === 0}
                size="small"
                title="Buscar turnos con mensajes en error (último mensaje id_estado <= 0)"
              >
                Error mensajes
              </Button>

              <Button startIcon={<GetAppIcon />} variant="contained" onClick={downloadCSV} disabled={loading || !turnos.length} size="small">Descargar</Button>

              <IconButton onClick={(e) => setAnchorCols(e.currentTarget)} size="small" title="Columnas">
                <ViewColumnIcon fontSize="small" />
              </IconButton>

              <IconButton onClick={(_) => navigate('/historico')} size="small" title="Histrico">
                <MenuBookIcon fontSize="small" />
              </IconButton>
            </Box>
          </Grid>

          {/* ESPACIO PARA AJUSTES (compact view, etc) */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <FormControlLabel control={<Switch checked={compactView} onChange={() => setCompactView(v => !v)} />} label="Vista compacta" />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* controles de columnas (popover) */}
      <Popover open={Boolean(anchorCols)} anchorEl={anchorCols} onClose={() => setAnchorCols(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Box sx={{ p: 2, minWidth: 260 }}>
          <Typography variant="subtitle2">Columnas visibles</Typography>
          <FormGroup>
            {allColumns.map(c => (
              <FormControlLabel
                key={c.key}
                control={<Checkbox checked={Boolean(visibleColumns[c.key])} onChange={() => toggleColumn(c.key)} />}
                label={c.label}
              />
            ))}
          </FormGroup>

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button size="small" onClick={showAll}>Mostrar todo</Button>
            <Button size="small" onClick={() => setVisibleColumns(prev => { const next = { ...prev }; allColumns.forEach(c => next[c.key] = !next[c.key]); return next; })}>Invertir</Button>
          </Box>
        </Box>
      </Popover>


      {/* tabla */}
      <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 2, overflowX: 'auto', mt: 1, maxHeight: compactView ? 620 : undefined }}>
        <Table stickyHeader size="small" sx={{ minWidth: tableMinWidth }}>
        <TableHead>
          <TableRow sx={{ background: (theme) => theme.palette.background.paper }}>
            {allColumns.filter(c => visibleColumns[c.key]).map(col => (
              <TableCell
                key={col.key}
                sx={{
                  fontWeight: 700,
                  padding: compactView ? '6px 8px' : '12px 16px',
                  overflow: compactView ? 'hidden' : undefined,
                  textOverflow: compactView ? 'ellipsis' : undefined,
                  whiteSpace: compactView ? 'nowrap' : undefined,
                  maxWidth: 200
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>



          <TableBody>
          {loading && (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                {allColumns.filter(c => visibleColumns[c.key]).map((_, j) => (
                  <TableCell key={j} sx={{ padding: compactView ? '6px 8px' : '12px 16px' }}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}


            {!loading && !turnos.length && (
              <TableRow>
                <TableCell colSpan={visibleCount + 1}>
                  <Box sx={{ p: 3, textAlign: 'center' }}><Typography>No hay turnos para mostrar.</Typography></Box>
                </TableCell>
              </TableRow>
            )}

            <AnimatePresence initial={false} mode="popLayout">
              {!loading && turnos.map((t, idx) => (
                <TableRow
                  key={t.id ?? idx}
                  component={motion.tr}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  sx={{ '&:hover': { boxShadow: 3 }, cursor: 'default' }}
                >

                  {allColumns.filter(c => visibleColumns[c.key]).map(col => renderCell(col.key, t))}
                </TableRow>
              ))}
            </AnimatePresence>

          </TableBody>
        </Table>
      </TableContainer>

      {/* footer */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={handleChangePage}
            color="primary"
            siblingCount={1}
            boundaryCount={1}
            showFirstButton
            showLastButton
          />
        </Stack>
      </Box>
    </Box>
  );
}
