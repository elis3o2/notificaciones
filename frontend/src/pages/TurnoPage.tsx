import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
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
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import GetAppIcon from '@mui/icons-material/GetApp';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { getSignificado, getTurnosMergedLimit, getEstadomsj } from '../features/turno/api';
import type { TurnoExtend } from '../features/turno/types';
import { useNavigate } from 'react-router-dom';

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<TurnoExtend[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState<number>(10);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [extending, setExtending] = useState<boolean>(false);
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null);
  // filtros / UI
  const [dniQuery, setDniQuery] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [anchorCols, setAnchorCols] = useState<null | HTMLElement>(null);
  const [anchorMore, setAnchorMore] = useState<null | HTMLElement>(null);
  const [compactView, setCompactView] = useState(false);

  const navigate = useNavigate();

  useEffect(() => { loadLimited(limit); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const id = setTimeout(() => setFilterDni(dniQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [dniQuery]);

  async function loadLimited(requestLimit: number) {
    setLoading(true);
    try {
      const data = await getTurnosMergedLimit(requestLimit);
      setTurnos(data);
      setHasMore(data.length >= requestLimit);
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadAll() { await loadLimited(limit); }

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

  async function handleLoadMore() {
    const newLimit = limit + 10; setExtending(true);
    try {
      const data = await getTurnosMergedLimit(newLimit);
      setTurnos(data); setLimit(newLimit); setHasMore(data.length >= newLimit);
    } catch (e: any) { console.error(e); }
    finally { setExtending(false); }
  }

  async function handleClickEstado(turnoIndex: number, mensajeObj?: any) {
    if (!mensajeObj) return;
    const pkMensaje = mensajeObj.id ?? mensajeObj.pk;
    const idMensajeExterno = mensajeObj.id_mensaje ?? mensajeObj.id_externo ?? mensajeObj.external_id;
    const numero = mensajeObj.numero ?? mensajeObj.telefono;
    if (!pkMensaje || !idMensajeExterno || !numero) return console.error('Faltan datos para consultar estado del mensaje', { pkMensaje, idMensajeExterno, numero });

    const pkMensajeStr = String(pkMensaje);
    try {
      setUpdatingMessageId(pkMensajeStr);
      const resp = await getEstadomsj(pkMensaje, idMensajeExterno, numero);
      const data = resp?.data ?? resp;
      if (!data || data.error) { console.error('Error en respuesta de getEstadomsj', data); return; }

      let significado: string | undefined = mensajeObj.estado?.significado;
      try {
        if (data.ack != null) {
          const sigObj = await getSignificado(data.ack);
          significado = sigObj.significado;
        }
      } catch (err) { console.warn('No se pudo obtener significado para ack=', data.ack, err); significado = significado ?? (data.ack != null ? String(data.ack) : significado); }

      const nuevoMensaje = {
        ...mensajeObj,
        estado: { ...(mensajeObj.estado ?? {}), id: data.ack ?? mensajeObj.estado?.id, significado },
        fecha_envio: data.time ?? data.fecha_last_ack ?? mensajeObj.fecha_envio,
      };

      setTurnos(prev => {
        if (turnoIndex < 0 || turnoIndex >= prev.length) return prev;
        const nuevosTurnos = prev.map((t, i) => {
          if (i !== turnoIndex) return t;
          const mensajes = Array.isArray(t.mensaje_asociado) ? [...t.mensaje_asociado] : [];
          const idx = mensajes.findIndex((m: any) => String(m.id ?? m.pk) === pkMensajeStr);
          if (idx >= 0) mensajes[idx] = nuevoMensaje; else mensajes.push(nuevoMensaje);
          return { ...t, mensaje_asociado: mensajes };
        });
        return nuevosTurnos;
      });

    } catch (e: any) { console.error('Error consultando estado del mensaje', e); }
    finally { setUpdatingMessageId(null); }
  }

  // ---- columnas ----
  const allColumns = useMemo(() => [
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
  // ancho mínimo dinámico para la tabla (más agresivo para vista compacta)
  const tableMinWidth = useMemo(() => Math.max(visibleCount * 110, 700), [visibleCount]);

  // ---- filtrado por DNI (aplicado con filtro debounced) ----
  const filteredTurnos = useMemo(() => {
    if (!filterDni) return turnos;
    return turnos.filter(t => String(t.paciente_dni ?? '').includes(filterDni));
  }, [turnos, filterDni]);

  function downloadCSV() {
    const headers = allColumns.filter(c => visibleColumns[c.key]).map(c => c.label);
    const rows = filteredTurnos.map(t => {
      const row: any[] = [];
      for (const c of allColumns) {
        if (!visibleColumns[c.key]) continue;
        switch (c.key) {
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

    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `turnos_${new Date().toISOString()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function estadoChipLabel(t: TurnoExtend) {
    const nombre = t.estado?.nombre ?? '—';
    return nombre;
  }

  function estadoChipColor(t: TurnoExtend) {
    const n = t.estado.nombre 
    if (n == 'CONFIRMADO') return 'success';
    if (n == 'CANCELADO') return 'error';
    if (n == 'REPROGRAMADO') return 'warning';
    if (n == 'FINALIZADO') return 'info'
    return 'default';
  }

  // render cell (con ajustes para vista compacta)
  function renderCell(columnKey: string, t: TurnoExtend, idx: number) {
    const cellPadding = compactView ? '6px 8px' : '12px 16px';
    const typographyVariant = compactView ? 'caption' : 'body2';

    const wrapTypography = (content: React.ReactNode) => (
      <Typography
        variant={typographyVariant as any}
        noWrap={compactView}
        sx={{ lineHeight: 1.1, fontSize: compactView ? '0.72rem' : undefined }}
      >
        {content}
      </Typography>
    );

    switch (columnKey) {
      case 'dni': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 140 }}>{wrapTypography(t.paciente_dni ?? '—')}</TableCell>;
      case 'nombre': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 160 }}>{wrapTypography(t.paciente_nombre ?? '—')}</TableCell>;
      case 'apellido': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 160 }}>{wrapTypography(t.paciente_apellido ?? '—')}</TableCell>;
      case 'efector': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 200 }}>{wrapTypography(t.efe_ser_esp.efector?.nombre ?? String(t.efe_ser_esp.efector.id ?? '—'))}</TableCell>;
      case 'servicio': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 180 }}>{wrapTypography(t.efe_ser_esp.servicio?.nombre ?? String(t.efe_ser_esp.servicio.id ?? '—'))}</TableCell>;
      case 'especialidad': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 180 }}>{wrapTypography(t.efe_ser_esp.especialidad?.nombre ?? String(t.efe_ser_esp.especialidad.id ?? '—'))}</TableCell>;
      case 'prof_nombre': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 160 }}>{wrapTypography(t.profesional_nombre ?? '—')}</TableCell>;
      case 'prof_apellido': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 160 }}>{wrapTypography(t.profesional_apellido ?? '—')}</TableCell>;
      case 'estado': return (
        <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 160 }}>
          <Chip size="small" label={estadoChipLabel(t)} color={estadoChipColor(t) as any} variant="outlined" />
        </TableCell>
      );

      case 'confirmacion': {
        const mensaje = getMsj(1, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 220 }}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button size="small" variant="text" onClick={() => handleClickEstado(idx, mensaje)} disabled={updatingMessageId === (String(mensaje.id ?? mensaje.pk))}>
                    {updatingMessageId === (String(mensaje.id ?? mensaje.pk)) ? <CircularProgress size={14} /> : (mensaje.estado?.significado ?? '—')}
                  </Button>
                  {mensaje?.fecha_envio ? <Typography variant="caption" noWrap>{mensaje.fecha_envio}</Typography> : null}
                </div>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'cancelacion': {
        const mensaje = getMsj(2, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 220 }}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button size="small" variant="text" onClick={() => handleClickEstado(idx, mensaje)} disabled={updatingMessageId === (String(mensaje.id ?? mensaje.pk))}>
                    {updatingMessageId === (String(mensaje.id ?? mensaje.pk)) ? <CircularProgress size={14} /> : (mensaje.estado?.significado ?? '—')}
                  </Button>
                  {mensaje?.fecha_envio ? <Typography variant="caption" noWrap>{mensaje.fecha_envio}</Typography> : null}
                </div>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'reprogramacion': {
        const mensaje = getMsj(3, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 220 }}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button size="small" variant="text" onClick={() => handleClickEstado(idx, mensaje)} disabled={updatingMessageId === (String(mensaje.id ?? mensaje.pk))}>
                    {updatingMessageId === (String(mensaje.id ?? mensaje.pk)) ? <CircularProgress size={14} /> : (mensaje.estado?.significado ?? '—')}
                  </Button>
                  {mensaje?.fecha_envio ? <Typography variant="caption" noWrap>{mensaje.fecha_envio}</Typography> : null}
                </div>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'recordatorio': {
        const mensaje_reco = getMsjReco(t.mensaje_asociado);
        const tooltipTitle = mensaje_reco?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje_reco.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 220 }}>
            {mensaje_reco ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button size="small" variant="text" onClick={() => handleClickEstado(idx, mensaje_reco)} disabled={updatingMessageId === (String(mensaje_reco.id ?? mensaje_reco.pk))}>
                    {updatingMessageId === (String(mensaje_reco.id ?? mensaje_reco.pk)) ? <CircularProgress size={14} /> : (mensaje_reco.estado?.significado ?? '—')}
                  </Button>
                  {mensaje_reco?.fecha_envio ? <Typography variant="caption" noWrap>{mensaje_reco.fecha_envio}</Typography> : null}
                </div>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }

      case 'fecha': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 120 }}>{wrapTypography(t.fecha ?? '—')}</TableCell>;
      case 'hora': return <TableCell key={columnKey} sx={{ padding: cellPadding, maxWidth: 90 }}>{wrapTypography(t.hora ?? '—')}</TableCell>;
      default: return <TableCell key={columnKey} sx={{ padding: cellPadding }}>—</TableCell>;
    }
  }
  console.log(turnos)
  return (
    <Box sx={{ p: 2 }}>
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
        <Box>
          <Typography variant={compactView ? 'h6' : 'h5'} fontWeight={700}>Turnos</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Filtrar por DNI..."
            value={dniQuery}
            onChange={(e) => setDniQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }}
            sx={{ width: compactView ? 180 : 220 }}
          />

          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadAll} disabled={loading} size="small">
            {loading ? <CircularProgress size={18} /> : 'Refrescar'}
          </Button>

          <Button startIcon={<GetAppIcon />} variant="contained" onClick={downloadCSV} disabled={loading || !filteredTurnos.length} size="small">Descargar</Button>

          <IconButton onClick={(e) => setAnchorCols(e.currentTarget)} size="small" title="Columnas">
            <ViewColumnIcon fontSize="small" />
          </IconButton>

          <IconButton onClick={(e) => setAnchorMore(e.currentTarget)} size="small" title="Más">
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

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

      <Menu anchorEl={anchorMore} open={Boolean(anchorMore)} onClose={() => setAnchorMore(null)}>
        <MenuItem onClick={() => { setCompactView(v => !v); setAnchorMore(null); }}>
          <FormControlLabel control={<Switch checked={compactView} onChange={() => {}} />} label="Vista compacta" />
        </MenuItem>
        <MenuItem onClick={() => navigate('/historico')}>Ir a histórico</MenuItem>
      </Menu>

      {/* tabla */}
      <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 2, overflowX: 'auto', mt: 1, maxHeight: compactView ? 620 : undefined }}>
        <Table stickyHeader size="small" sx={{ minWidth: tableMinWidth }}>
          <TableHead>
            <TableRow sx={{ background: (theme) => theme.palette.background.paper }}>
              {allColumns.filter(c => visibleColumns[c.key]).map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 700, padding: compactView ? '6px 8px' : '12px 16px' }}>{col.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading && (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {allColumns.filter(c => visibleColumns[c.key]).map((col, j) => (
                    <TableCell key={j} sx={{ padding: compactView ? '6px 8px' : '12px 16px' }}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            )}

            {!loading && !filteredTurnos.length && (
              <TableRow>
                <TableCell colSpan={visibleCount}><Box sx={{ p: 3, textAlign: 'center' }}><Typography>No hay turnos para mostrar.</Typography></Box></TableCell>
              </TableRow>
            )}

            <AnimatePresence initial={false} mode="popLayout">
              {!loading && filteredTurnos.map((t, idx) => (
                <TableRow
                  key={t.id ?? idx}
                  component={motion.tr}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  sx={{ '&:hover': { boxShadow: 3 }, cursor: 'default' }}
                >
                  {allColumns.filter(c => visibleColumns[c.key]).map(col => renderCell(col.key, t, idx))}
                </TableRow>
              ))}
            </AnimatePresence>

          </TableBody>
        </Table>
      </TableContainer>

      {/* footer */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="caption">Mostrando {filteredTurnos.length} turnos. (límite: {limit})</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={handleLoadMore} disabled={extending || loading || !hasMore} size="small">{extending ? <CircularProgress size={18} /> : (hasMore ? 'Mostrar más' : 'No hay más')}</Button>
        </Box>
      </Box>
    </Box>
  );
}
