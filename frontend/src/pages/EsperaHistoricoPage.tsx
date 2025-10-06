import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, CircularProgress, Tooltip, IconButton, Popover, FormGroup, FormControlLabel, Checkbox, Skeleton, Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { AnimatePresence, motion } from 'framer-motion';
import { getTurnoEsperaById } from '../features/turno/api'; // adapta la ruta según tu proyecto
import type { TurnoEspera } from '../features/turno/types';
// Component para buscar paciente (ajusta la ruta de import si es necesario)
import LookPaciente from '../features/turno/components/LookPaciente';
import type { Paciente } from '../features/persona/types';



// ---------------------- Columnas ----------------------
const ALL_COLUMNS = [
  { key: 'fecha_hora_creacion', label: 'Creación' },
  { key: 'fecha_hora_cierre', label: 'Cierre' },
  { key: 'estado', label: 'Estado' },
  { key: 'nro_doc', label: 'DNI' },
  { key: 'paciente_nombre', label: 'Nombre' },
  { key: 'paciente_apellido', label: 'Apellido' },
  { key: 'profesional', label: 'Profesional' },
  { key: 'efector', label: 'Efector' },
  { key: 'servicio', label: 'Servicio' },
  { key: 'especialidad', label: 'Especialidad' },
  { key: 'prioridad', label: 'Prioridad' },
] as const;

// ---------------------- Helpers ----------------------
const safeFormat = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const downloadCSV = (rows: TurnoEspera[], visibleKeys: string[], columnsMap: Record<string, string>) => {
  const headers = visibleKeys.map(k => `"${columnsMap[k] ?? k}"`);
  const csvRows = [headers.join(',')];

  for (const r of rows) {
    const row = visibleKeys.map(k => {
      let val: any = '';
      switch (k) {
        case 'fecha_hora_creacion': val = safeFormat(r.fecha_hora_creacion); break;
        case 'fecha_hora_cierre': val = safeFormat(r.fecha_hora_cierre); break;
        case 'estado': val = r.estado?.significado ?? ''; break;
        case 'nro_doc': val = r.paciente?.nro_doc ?? ''; break;
        case 'paciente_nombre': val = r.paciente?.nombre ?? ''; break;
        case 'paciente_apellido': val = r.paciente?.apellido ?? ''; break;
        case 'profesional': val = `${r.profesional_solicitante?.nombre ?? ''} ${r.profesional_solicitante?.apellido ?? ''}`.trim(); break;
        case 'efector': val = r.efector?.nombre ?? ''; break;
        case 'servicio': val = r.servicio?.nombre ?? ''; break;
        case 'especialidad': val = r.especialidad?.nombre ?? ''; break;
        case 'prioridad': val = r.prioridad; break;
        default: val = (r as any)[k] ?? '';
      }
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  }

  // Descarga simple del CSV
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turnos_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const estadoColor = (estado: string) => {
  console.log(estado)
  const e = estado.trim().toUpperCase();
  switch (e) {
    case 'ESPERA': return 'warning';
    case 'OTORGADO': return 'success';
  }
};

// ---------------------- Componente ----------------------
export default function TurnosEsperaDashboard(): JSX.Element {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [finishPaciente, setFinishPaciente] = useState<boolean>(false);

  const [rows, setRows] = useState<TurnoEspera[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialVisibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    ALL_COLUMNS.forEach(c => (map[c.key] = true));
    return map;
  }, []);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(initialVisibility);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openColsMenu = Boolean(anchorEl);
  const handleOpenColsMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleCloseColsMenu = () => setAnchorEl(null);

  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const toggleSort = () => setSortDesc(prev => !prev);
  console.log(rows)
  useEffect(() => {
    // cuando el componente hijo marca finishPaciente = true, lanzamos la búsqueda automática
    if (finishPaciente && paciente?.id) {
      fetchTurnosByPacienteId(paciente.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishPaciente, paciente]);

  const fetchTurnosByPacienteId = async (pacienteId: number) => {
    setError(null);
    setLoading(true);
    try {
      const data = await getTurnoEsperaById(pacienteId);
      setRows(data);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Error al consultar turnos');
      setRows([]);
    } finally {
      setLoading(false);
      // reseteamos el estado de finish para permitir nuevas confirmaciones posteriores
      //setFinishPaciente(false);
    }
  };

  const handleClear = () => {
    setPaciente(null);
    setFinishPaciente(false);
    setError(null);
    setRows([]);
  };

  // Deseleccionar para poder volver a usar LookPaciente
  const handleDeselect = () => {
    setPaciente(null);
    setFinishPaciente(false);
    setRows([]);
    setError(null);
  };

  const toggleColumn = (key: string) => {
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const showAll = () => {
    const next: Record<string, boolean> = {};
    ALL_COLUMNS.forEach(c => (next[c.key] = true));
    setVisibleCols(next);
  };
  const hideAll = () => {
    const next: Record<string, boolean> = {};
    ALL_COLUMNS.forEach(c => (next[c.key] = false));
    setVisibleCols(next);
  };

  const displayedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const da = new Date(a.fecha_hora_creacion).getTime();
      const db = new Date(b.fecha_hora_creacion).getTime();
      return sortDesc ? db - da : da - db;
    });
    return copy;
  }, [rows, sortDesc]);

  const visibleKeys = useMemo(() => ALL_COLUMNS.filter(c => visibleCols[c.key]).map(c => c.key), [visibleCols]);

  const columnsMap = useMemo(() => {
    const m: Record<string, string> = {};
    ALL_COLUMNS.forEach(c => (m[c.key] = c.label));
    return m;
  }, []);

  const tableMinWidth = useMemo(() => Math.max(visibleKeys.length * 140, 700), [visibleKeys]);

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Turnos en Espera</Typography>
        </Box>

        <Box display="flex" gap={1} alignItems="center">
          <Tooltip title="Columnas">
            <IconButton onClick={handleOpenColsMenu}><ViewColumnIcon /></IconButton>
          </Tooltip>

          <Tooltip title="Descargar CSV">
            <span>
              <IconButton
                onClick={() => downloadCSV(displayedRows, visibleKeys, columnsMap)}
                disabled={loading || displayedRows.length === 0}
              >
                <DownloadIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* LookPaciente o resumen del paciente seleccionado */}
      <Paper sx={{ p: 2, mb: 2 }}>
        {!finishPaciente ? (
          // Si no se confirmó la búsqueda, mostramos el buscador reutilizable
          <LookPaciente paciente={paciente} setPaciente={setPaciente} setFinishPaciente={setFinishPaciente} />
        ) : (
          // Si finishPaciente=true mostramos sólo los datos del paciente y botón para deseleccionar
            <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="subtitle2">Paciente seleccionado</Typography>
                <Box display="flex" alignItems="center" gap={1} mt={1}>
                  <Chip label={`${paciente.apellido ?? ''}, ${paciente.nombre ?? ''}`} />
                  <Typography variant="body2" color="text.secondary">DNI: {paciente.nro_doc ?? '—'}</Typography>
                </Box>
              </Box>

              <Box display="flex" gap={1} alignItems="center">
                <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleDeselect} disabled={loading}>
                  Deseleccionar
                </Button>

                {/* Permitimos recargar manualmente si hace falta */}
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={18} /> : <SearchIcon />}
                  onClick={() => paciente?.id && fetchTurnosByPacienteId(paciente.id)}
                  disabled={loading || !paciente?.id}
                >
                  {loading ? 'Cargando...' : 'Cargar turnos del paciente'}
                </Button>
              </Box>
            </Box>
          
        )}

        <Box display="flex" gap={1} mt={2}>
          <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClear} disabled={loading}>
            Limpiar
          </Button>

          {/* Este botón queda aquí como forma alternativa de cargar cuando no se usa el flujo automático */}
          {!finishPaciente && (
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} /> : <SearchIcon />}
              onClick={() => paciente?.id && fetchTurnosByPacienteId(paciente.id)}
              disabled={loading || !paciente?.id}
            >
              {loading ? 'Cargando...' : 'Cargar turnos del paciente'}
            </Button>
          )}

          <Box flexGrow={1} />

          <Box display="flex" gap={1} alignItems="center">
            <Typography variant="body2">Ordenar por creación</Typography>
            <IconButton onClick={toggleSort} size="small" aria-label="toggle sort">
              {sortDesc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Typography color="error" mt={1}>{error}</Typography>
        )}
      </Paper>

      {/* Popover columnas */}
      <Popover
        open={openColsMenu}
        anchorEl={anchorEl}
        onClose={handleCloseColsMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, minWidth: 260 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">Columnas</Typography>
            <Box>
              <Button size="small" onClick={() => { showAll(); handleCloseColsMenu(); }} sx={{ mr: 1 }}>Mostrar todo</Button>
              <Button size="small" onClick={() => { hideAll(); handleCloseColsMenu(); }}>Ocultar todo</Button>
            </Box>
          </Box>

          <FormGroup>
            {ALL_COLUMNS.map(col => (
              <FormControlLabel
                key={col.key}
                control={<Checkbox checked={Boolean(visibleCols[col.key])} onChange={() => toggleColumn(col.key)} />}
                label={col.label}
              />
            ))}
          </FormGroup>
        </Box>
      </Popover>

      {/* Tabla */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
        <Table size="small" stickyHeader sx={{ minWidth: tableMinWidth }}>
          <TableHead>
            <TableRow sx={{ background: (theme) => theme.palette.background.paper }}>
              {ALL_COLUMNS.filter(c => visibleCols[c.key]).map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, py: 0.5, px: 1 }}>
                  <Box display="flex" alignItems="center">
                    <span>{col.label}</span>
                    {col.key === 'fecha_hora_creacion' && (
                      <IconButton size="small" onClick={toggleSort} sx={{ ml: 1 }}>
                        {sortDesc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading && (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {ALL_COLUMNS.filter(c => visibleCols[c.key]).map((col, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            )}

            {!loading && displayedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(1, visibleKeys.length)}>
                  <Box p={2}><Typography variant="body2">No se encontraron turnos para el paciente seleccionado.</Typography></Box>
                </TableCell>
              </TableRow>
            )}

            <AnimatePresence initial={false} mode="popLayout">
              {!loading && displayedRows.map((r, idx) => (
                <TableRow
                  component={motion.tr}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  key={r.id ?? idx}
                  sx={{ '&:hover': { boxShadow: 3 } }}
                >
                  {ALL_COLUMNS.filter(c => visibleCols[c.key]).map(col => {
                    switch (col.key) {
                      case 'fecha_hora_creacion': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, py: 0.5, px: 1 }}>{safeFormat(r.fecha_hora_creacion)}</TableCell>;
                      case 'fecha_hora_cierre': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, py: 0.5, px: 1 }}>{safeFormat(r.fecha_hora_cierre)}</TableCell>;
                      case 'estado':
                        return (
                          <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, py: 0.5, px: 1 }}>
                            {r.estado?.significado ? (
                              <Tooltip title={r.estado.significado}>
                                <Chip label={r.estado.significado} size="small" variant="outlined" color={estadoColor(r.estado.significado) as any} />
                              </Tooltip>
                            ) : '—'}
                          </TableCell>
                        );
                      case 'nro_doc': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, py: 0.5, px: 1 }}>{r.paciente?.nro_doc ?? '—'}</TableCell>;
                      case 'paciente_nombre': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, py: 0.5, px: 1 }}>{r.paciente?.nombre ?? '—'}</TableCell>;
                      case 'paciente_apellido': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, py: 0.5, px: 1 }}>{r.paciente?.apellido ?? '—'}</TableCell>;
                      case 'profesional': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, py: 0.5, px: 1 }}>{`${r.profesional_solicitante?.nombre ?? ''} ${r.profesional_solicitante?.apellido ?? ''}`.trim() || '—'}</TableCell>;
                      case 'efector': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, py: 0.5, px: 1 }}>{r.efector?.nombre ?? '—'}</TableCell>;
                      case 'servicio': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, py: 0.5, px: 1 }}>{r.servicio?.nombre ?? '—'}</TableCell>;
                      case 'especialidad': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, py: 0.5, px: 1 }}>{r.especialidad?.nombre ?? '—'}</TableCell>;
                      case 'prioridad': return <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80, py: 0.5, px: 1 }}>{r.prioridad ?? '—'}</TableCell>;
                      default: return <TableCell key={col.key}>—</TableCell>;
                    }
                  })}
                </TableRow>
              ))}
            </AnimatePresence>

          </TableBody>
        </Table>
      </TableContainer>

      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body2">Mostrando {displayedRows.length} registros.</Typography>
        <Box>
          <Button onClick={() => downloadCSV(displayedRows, visibleKeys, columnsMap)} disabled={displayedRows.length === 0} startIcon={<DownloadIcon />}>
            Descargar CSV
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
