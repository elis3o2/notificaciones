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

  // UI filters (temporales, no disparan la búsqueda hasta que se presione Buscar)
  const [selectedEfectores, setSelectedEfectores] = useState<number[]>([]);
  const [selectedServicios, setSelectedServicios] = useState<number[]>([]);
  const [fechaDesde, setFechaDesde] = useState<string | null>(null);
  const [fechaHasta, setFechaHasta] = useState<string | null>(null);

  // filtros aplicados (los que realmente usa la búsqueda / paginación)
  const [appliedFilters, setAppliedFilters] = useState<{
    efectores: number[],
    servicios: number[],
    fechaDesde: string | null,
    fechaHasta: string | null,
  }>({ efectores: [], servicios: [], fechaDesde: null, fechaHasta: null });

  // UI / estado
  const [_, setAnchorCols] = useState<null | HTMLElement>(null);
  const [compactView, setCompactView] = useState(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;
  const [total, setTotal] = useState<number>(0);
  const cellPadding = compactView ? '6px 8px' : '12px 16px';
  const typographyVariant = compactView ? 'caption' : 'body2';

  // modos
  const [errorMode, setErrorMode] = useState<boolean>(false);
  const [alertData, setAlertData] = useState<null | {
    count_total: number,
    grupos: {
      cancelados: TurnoExtend[],
      incorrectos: TurnoExtend[],
      sin_respuesta: TurnoExtend[]
    }
  }>(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertMode, setAlertMode] = useState(false);
  const [activeAlertCategory, setActiveAlertCategory] = useState<'cancelados' | 'incorrectos' | 'sin_respuesta'>('cancelados');

  const navigate = useNavigate();

  // cargar servicios cuando cambia el efector (temporal)
  async function loadServicio() {
    if (!selectedEfectores || selectedEfectores.length === 0) {
      setServicios([]);
      setSelectedServicios([]);
      return;
    }
    try {
      const promises = selectedEfectores.map(id => getServicioByEfector(id));
      const results = await Promise.all(promises);
      const merged: Record<number, Servicio> = {};
      for (const arr of results) for (const s of arr) merged[s.id] = s;
      const mergedList = Object.values(merged);
      mergedList.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
      setServicios(mergedList);
      setSelectedServicios(prev => prev.filter(id => merged[id] || mergedList.find(s => s.id === id)));
    } catch (err) {
      console.error('Error cargando servicios', err);
      setServicios([]);
    }
  }
  useEffect(() => { loadServicio(); /* eslint-disable-next-line */ }, [selectedEfectores]);

  // ----------- loadPage -------------
  async function loadPage(params: {
    page: number,
    useErrorMode: boolean,
    filters: { efectores: number[], servicios: number[], fechaDesde: string | null, fechaHasta: string | null },
  }) {
    const { page: pageToLoad, useErrorMode, filters } = params;

    if (!filters.efectores || filters.efectores.length === 0) {
      setTurnos([]); setTotal(0); return;
    }

    setLoading(true);
    try {
      const offset = (pageToLoad - 1) * pageSize;

      if (alertMode) {
        // alerta paginada por categoría
        const data = await getTurnosAlerta(activeAlertCategory, pageSize, offset, filters.efectores, filters.servicios, filters.fechaDesde, filters.fechaHasta);
        setTurnos(data.response ?? []);
        setTotal(data.count ?? 0);
        return;
      }

      if (useErrorMode) {
        const data = await getTurnosErrorMergedLimit(pageSize, offset, filters.efectores, filters.servicios, filters.fechaDesde, filters.fechaHasta);
        setTurnos(data.response ?? []);
        setTotal(data.count ?? 0);
      } else {
        const data = await getTurnosMergedLimit(pageSize, offset, filters.efectores, filters.servicios, filters.fechaDesde, filters.fechaHasta);
        setTurnos(data.response ?? []);
        setTotal(data.count ?? 0);
      }
    } catch (e: any) {
      console.error('Error cargando turnos paginados', e);
      setTurnos([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // useEffect observa page y appliedFilters. NOTA: toggles NO deben mutar appliedFilters para evitar búsquedas automáticas.
  useEffect(() => {
    if (!appliedFilters.efectores || appliedFilters.efectores.length === 0) {
      setTurnos([]); setTotal(0); return;
    }
    loadPage({ page, useErrorMode: errorMode, filters: appliedFilters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  // ---------- Acción Buscar: aplica filtros UI y ejecuta la consulta ----------
  async function handleBuscar() {
    const newApplied = {
      efectores: selectedEfectores.slice(),
      servicios: selectedServicios.slice(),
      fechaDesde,
      fechaHasta,
    };

    // si no seleccionó efectores, fallback al contexto
    if ((!newApplied.efectores || newApplied.efectores.length === 0) && efectores && efectores.length > 0) {
      newApplied.efectores = efectores.map(e => e.id);
    }

    // si aun así no hay efectores, no hacemos nada
    if (!newApplied.efectores || newApplied.efectores.length === 0) {
      setTurnos([]); setTotal(0); return;
    }

    setAppliedFilters(newApplied);
    setPage(1);

    // Ejecutar búsqueda inmediatamente (usar los flags actuales errorMode / alertMode)
    await loadPage({ page: 1, useErrorMode: errorMode, filters: newApplied });
  }

  // ---------- toggles: solo cambian flags (NO actualizan appliedFilters ni disparan búsqueda) ----------
  function handleToggleErrorMode() {
    const next = !errorMode;

    // si activamos errorMode, apagamos alertMode
    if (next && alertMode) setAlertMode(false);

    setErrorMode(next);
    // NO setAppliedFilters ni loadPage aquí -> la búsqueda solo se lanza con Buscar
  }

  function handleToggleAlertMode() {
    const next = !alertMode;

    // si activamos alertMode, apagamos errorMode
    if (next && errorMode) setErrorMode(false);

    setAlertMode(next);
    // NO setAppliedFilters ni loadPage aquí -> la búsqueda solo se lanza con Buscar
  }

  // ---------- Alertas preview inicial (mantengo la preview para mostrar counts) ----------
  useEffect(() => {
    const efIds = efectores?.map(e => e.id) ?? [];
    if (efIds.length === 0) return;

    (async () => {
      setAlertLoading(true);
      try {
        const pageLimit = pageSize;
        const offset = 0;
        const [resCancel, resIncorrect, resSinResp] = await Promise.all([
          getTurnosAlerta('cancelados', pageLimit, offset, efIds, [], null, null),
          getTurnosAlerta('incorrectos', pageLimit, offset, efIds, [], null, null),
          getTurnosAlerta('sin_respuesta', pageLimit, offset, efIds, [], null, null),
        ]);

        const grupos = {
          cancelados: resCancel.response ?? [],
          incorrectos: resIncorrect.response ?? [],
          sin_respuesta: resSinResp.response ?? [],
        };

        const count_total = (resCancel.count ?? 0) + (resIncorrect.count ?? 0) + (resSinResp.count ?? 0);

        setAlertData({ count_total, grupos });
      } catch (err) {
        console.error('Error cargando turnos alerta', err);
        setAlertData(null);
      } finally {
        setAlertLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efectores]);

  // cuando cambio la categoria activa y estoy en alertMode y ya tengo appliedFilters (la búsqueda se lanza solo con Buscar)
  useEffect(() => {
    if (!alertMode) return;
    // si querés que al cambiar categoría se actualice la tabla sin presionar Buscar, podés descomentar la siguiente línea:
    // loadPage({ page: 1, useErrorMode: false, filters: appliedFilters });
    // por ahora respetamos la regla: la búsqueda solo se ejecuta con Buscar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlertCategory, alertMode]);

  // ---------- page change ----------
  const handleChangePage = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    // si estamos en alertMode y ya hiciste Buscar (appliedFilters tiene efectores), podemos cargar la página
    // pero respetamos la regla: la búsqueda se dispara por Buscar. Sin embargo si appliedFilters está definido (viniste buscando), paginamos.
    if (alertMode && appliedFilters.efectores && appliedFilters.efectores.length > 0) {
      loadPage({ page: value, useErrorMode: false, filters: appliedFilters });
    }
    // si no hay appliedFilters, no hacemos nada hasta que presiones Buscar
  };

  // ---------- utilidades de render (sin cambios relevantes) ----------
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cellSx = (maxWidth?: number | string) => ({
    padding: cellPadding,
    maxWidth: maxWidth ?? undefined,
    overflow: compactView ? 'hidden' : undefined,
    textOverflow: compactView ? 'ellipsis' : undefined,
    whiteSpace: compactView ? 'nowrap' : undefined,
  });

  const wrapTypography = (content: React.ReactNode) => (
    <Box component="div" sx={{
      display: 'block',
      overflow: compactView ? 'hidden' : 'visible',
      textOverflow: compactView ? 'ellipsis' : 'unset',
      whiteSpace: compactView ? 'nowrap' : 'normal',
    }} title={typeof content === 'string' ? content : undefined}>
      <Typography variant={typographyVariant as any} sx={{ lineHeight: 1.1, fontSize: compactView ? '0.72rem' : undefined, display: 'inline-block' }}>
        {content}
      </Typography>
    </Box>
  );

  function formatDateTime(iso?: string | null) {
    if (!iso) return null;
    const s = iso.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const [, yyyy, mm, dd, hh, min, ss] = m;
    return { date: `${dd}-${mm}-${yyyy}`, time: `${hh}:${min}:${ss}` };
  }
  const DateTimeStack = ({ iso }: { iso?: string | null }) => {
    const v = formatDateTime(iso);
    if (!v) return null;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', ml: 0.5 }}>
        <Typography variant="caption" sx={{ lineHeight: 1 }}>{v.date}</Typography>
        <Typography variant="caption" sx={{ lineHeight: 1 }}>{v.time}</Typography>
      </Box>
    );
  };

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
    vis['nombre'] = false; vis['apellido'] = false; vis['prof_nombre'] = false; vis['prof_apellido'] = false;
    return vis;
  }, [allColumns]);
  const [visibleColumns, ] = useState<Record<string, boolean>>(initialVisibility);
  const visibleKeys = allColumns.filter(c => visibleColumns[c.key]).map(c => c.key);
  const visibleCount = Math.max(1, visibleKeys.length);
  const tableMinWidth = useMemo(() => Math.max(visibleCount * 110, 700), [visibleCount]);

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

  function estadoRespChipLabel(t: TurnoExtend) { return t.estado_paciente?.nombre ?? '—'; }
  function estadoRespChipColor(t: TurnoExtend) {
    const n = t.estado_paciente?.nombre ?? '';
    if (n === 'SIN DATOS') return 'info';
    if (n === 'CONFIRMADO') return 'success';
    if (n === 'CANCELADO') return 'error';
    if (n === 'PERSONA INCORRECTA') return 'warning';
    if (n === 'SIN RESPUESTA') return 'warning';
    return 'default';
  }
  function estadoChipLabel(t: TurnoExtend) { return t.estado?.nombre ?? '—'; }
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
            <Chip size="small" label={estadoRespChipLabel(t)} color={estadoRespChipColor(t) as any} variant="outlined"  />
          </TableCell>
        );
      case 'dni': return <TableCell key={columnKey} sx={cellSx(140)}>{wrapTypography(t.paciente_dni ?? '—')}</TableCell>;
      case 'nombre': return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.paciente_nombre ?? '—')}</TableCell>;
      case 'apellido': return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.paciente_apellido ?? '—')}</TableCell>;
      case 'efector': return <TableCell key={columnKey} sx={cellSx(200)}>{wrapTypography(t.efe_ser_esp.efector?.nombre ?? String(t.efe_ser_esp.efector.id ?? '—'))}</TableCell>;
      case 'servicio': return <TableCell key={columnKey} sx={cellSx(180)}>{wrapTypography(t.efe_ser_esp.servicio?.nombre ?? String(t.efe_ser_esp.servicio.id ?? '—'))}</TableCell>;
      case 'especialidad': return <TableCell key={columnKey} sx={cellSx(180)}>{wrapTypography(t.efe_ser_esp.especialidad?.nombre ?? String(t.efe_ser_esp.especialidad.id ?? '—'))}</TableCell>;
      case 'prof_nombre': return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.profesional_nombre ?? '—')}</TableCell>;
      case 'prof_apellido': return <TableCell key={columnKey} sx={cellSx(160)}>{wrapTypography(t.profesional_apellido ?? '—')}</TableCell>;
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
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wrapTypography(mensaje.estado?.significado ?? '—')}
                  {mensaje?.fecha_envio ? <DateTimeStack iso={mensaje.fecha_envio} /> : null}
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
                  {mensaje?.fecha_envio ? <DateTimeStack iso={mensaje.fecha_envio} /> : null}
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
                  {mensaje?.fecha_envio ? <DateTimeStack iso={mensaje.fecha_envio} /> : null}
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
                  {mensaje_reco?.fecha_envio ? <DateTimeStack iso={mensaje_reco.fecha_envio} /> : null}
                </Box>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }
      case 'fecha': return <TableCell key={columnKey} sx={cellSx(120)}>{wrapTypography(t.fecha ?? '—')}</TableCell>;
      case 'hora': return <TableCell key={columnKey} sx={cellSx(90)}>{wrapTypography(t.hora ?? '—')}</TableCell>;
      default: return <TableCell key={columnKey} sx={cellSx()}>{wrapTypography('—')}</TableCell>;
    }
  }

  // condición para bloquear botones: si no hay efectores seleccionados y no hay efectores en contexto
  const noEfectoresAvailable =  selectedEfectores.length === 0

  return (
    <Box sx={{ p: 2 }}>
      {/* ALERTAS */}
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
            <Button size="small" variant={activeAlertCategory === 'cancelados' ? 'contained' : 'outlined'} onClick={() => setActiveAlertCategory('cancelados')}>CANCELADOS {alertData ? `(${alertData.grupos.cancelados.length})` : ''}</Button>
            <Button size="small" variant={activeAlertCategory === 'incorrectos' ? 'contained' : 'outlined'} onClick={() => setActiveAlertCategory('incorrectos')}>INCORRECTOS {alertData ? `(${alertData.grupos.incorrectos.length})` : ''}</Button>
            <Button size="small" variant={activeAlertCategory === 'sin_respuesta' ? 'contained' : 'outlined'} onClick={() => setActiveAlertCategory('sin_respuesta')}>SIN RESPUESTA {alertData ? `(${alertData.grupos.sin_respuesta.length})` : ''}</Button>
          </Box>

          <Button
            startIcon={<WarningAmberIcon />}
            color={alertMode ? 'warning' : 'inherit'}
            variant={alertMode ? 'contained' : 'outlined'}
            onClick={handleToggleAlertMode}
            disabled={alertLoading || noEfectoresAvailable}
            size="small"
          >
            {alertLoading ? <CircularProgress size={18} /> : `ALERTA ${alertData ? `(${alertData.count_total})` : ''}`}
          </Button>
        </Box>
      </Paper>

      {/* FILTROS */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl size="small" fullWidth sx={{ minWidth: 260, maxWidth: 520 }}>
              <InputLabel id="efector-select-label">Efector</InputLabel>
              <Select
                labelId="efector-select-label"
                multiple
                value={selectedEfectores}
                label="Efector"
                onChange={(e) => setSelectedEfectores(e.target.value as number[])}
                renderValue={(selected) => (selected as number[]).map(id => efectores?.find(x => x.id === id)?.nombre ?? String(id)).join(', ')}
                sx={{ minWidth: 240 }}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {efectores && efectores.length > 0 ? efectores.map((ef) => (
                  <MenuItem key={ef.id} value={ef.id}><Checkbox checked={selectedEfectores.indexOf(ef.id) > -1} /><ListItemText primary={ef.nombre ?? `Efector ${ef.id}`} /></MenuItem>
                )) : <MenuItem value="">(sin efectores)</MenuItem>}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl size="small" fullWidth sx={{ minWidth: 260, maxWidth: 520 }}>
              <InputLabel id="servicio-select-label">Servicio</InputLabel>
              <Select labelId="servicio-select-label" multiple value={selectedServicios} label="Servicio" onChange={(e) => setSelectedServicios(e.target.value as number[])} renderValue={(selected) => (selected as number[]).map(id => servicios?.find(x => x.id === id)?.nombre ?? String(id)).join(', ')} sx={{ minWidth: 240 }} MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}>
                {servicios && servicios.length > 0 ? servicios.map((se) => (
                  <MenuItem key={se.id} value={se.id}><Checkbox checked={selectedServicios.indexOf(se.id) > -1} /><ListItemText primary={se.nombre ?? `Servicio ${se.id}`} /></MenuItem>
                )) : <MenuItem value="">(sin servicios)</MenuItem>}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField size="small" label="Desde" type="date" InputLabelProps={{ shrink: true }} value={fechaDesde ?? ''} onChange={(e) => setFechaDesde(e.target.value ? e.target.value : null)} fullWidth />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField size="small" label="Hasta" type="date" InputLabelProps={{ shrink: true }} value={fechaHasta ?? ''} onChange={(e) => setFechaHasta(e.target.value ? e.target.value : null)} fullWidth />
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                startIcon={<RefreshIcon />}
                variant="outlined"
                onClick={handleBuscar}
                disabled={loading || noEfectoresAvailable}
                size="small"
              >
                {loading ? <CircularProgress size={18} /> : 'Buscar'}
              </Button>

              <Button
                startIcon={<WarningAmberIcon />}
                variant={errorMode ? 'contained' : 'outlined'}
                color={errorMode ? 'error' : 'inherit'}
                onClick={handleToggleErrorMode}
                disabled={loading || noEfectoresAvailable}
                size="small"
                title="Alternar modo 'Error mensajes' (presioná Buscar para ejecutar la búsqueda)"
              >
                Error mensajes
              </Button>

              <Button startIcon={<GetAppIcon />} variant="contained" onClick={downloadCSV} disabled={loading || !turnos.length} size="small">Descargar</Button>

              <IconButton onClick={(e) => setAnchorCols(e.currentTarget)} size="small" title="Columnas"><ViewColumnIcon fontSize="small" /></IconButton>
              <IconButton onClick={( _) => navigate('/historico')} size="small" title="Histrico"><MenuBookIcon fontSize="small" /></IconButton>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <FormControlLabel control={<Switch checked={compactView} onChange={() => setCompactView(v => !v)} />} label="Vista compacta" />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* tabla */}
      <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 2, overflowX: 'auto', mt: 1, maxHeight: compactView ? 620 : undefined }}>
        <Table stickyHeader size="small" sx={{ minWidth: tableMinWidth }}>
          <TableHead>
            <TableRow sx={{ background: (theme) => theme.palette.background.paper }}>
              {allColumns.filter(c => visibleColumns[c.key]).map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 700, padding: compactView ? '6px 8px' : '12px 16px', overflow: compactView ? 'hidden' : undefined, textOverflow: compactView ? 'ellipsis' : undefined, whiteSpace: compactView ? 'nowrap' : undefined, maxWidth: 200 }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>{allColumns.filter(c => visibleColumns[c.key]).map((_, j) => (<TableCell key={j} sx={{ padding: compactView ? '6px 8px' : '12px 16px' }}><Skeleton variant="text" /></TableCell>))}</TableRow>
            ))}

            {!loading && !turnos.length && (
              <TableRow><TableCell colSpan={visibleCount + 1}><Box sx={{ p: 3, textAlign: 'center' }}><Typography>No hay turnos para mostrar.</Typography></Box></TableCell></TableRow>
            )}

            <AnimatePresence initial={false} mode="popLayout">
              {!loading && turnos.map((t, idx) => (
                <TableRow key={t.id ?? idx} component={motion.tr} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} sx={{ '&:hover': { boxShadow: 3 }, cursor: 'default' }}>
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
          <Pagination count={totalPages} page={page} onChange={handleChangePage} color="primary" siblingCount={1} boundaryCount={1} showFirstButton showLastButton />
        </Stack>
      </Box>
    </Box>
  );
}
