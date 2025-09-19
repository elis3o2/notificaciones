// HistoricoPage.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, CircularProgress, Tooltip, IconButton, Menu, MenuItem, Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { getHistoricoTurno } from '../features/turno/api'; // adapta si tu ruta es distinta

// ---------------------- Tipos ----------------------
export type HistoricoItem = {
  idturno?: number | string;
  fecha_hora_mdf?: string | null; // ISO string recomendado
  estado?: string | null;
  paciente_nombre?: string | null;
  paciente_apellido?: string | null;
  nro_doc?: string | number | null;
  nombre_profesional?: string | null;
  apellido_profesional?: string | null;
  fecha?: string | null;
  hora?: string | null;
  efector?: string | null;
  servicio?: string | null;
  especialidad?: string | null;
  [k: string]: any;
};

// ---------------------- Columnas ----------------------
const ALL_COLUMNS = [
  { key: 'idturno', label: 'ID Turno' },
  { key: 'fecha_hora_mdf', label: 'Última modificación' },
  { key: 'estado', label: 'Estado' },
  { key: 'nro_doc', label: 'DNI' },
  { key: 'paciente_nombre', label: 'Nombre' },
  { key: 'paciente_apellido', label: 'Apellido' },
  { key: 'efector', label: 'Efector' },
  { key: 'servicio', label: 'Servicio' },
  { key: 'especialidad', label: 'Especialidad' },
  { key: 'nombre_profesional', label: 'Nombre profesional' },
  { key: 'apellido_profesional', label: 'Apellido profesional' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'hora', label: 'Hora' },
] as const;

// ---------------------- Helpers ----------------------
const safeFormat = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
};

const downloadCSV = (rows: HistoricoItem[], visibleKeys: string[], columnsMap: Record<string, string>) => {
  const headers = visibleKeys.map(k => `"${columnsMap[k] ?? k}"`);
  const csvRows = [headers.join(',')];

  for (const r of rows) {
    const row = visibleKeys.map(k => {
      let val: any = (r as any)[k];
      if (k === 'fecha_hora_mdf' || k === 'fecha' || k === 'hora') val = safeFormat(val);
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_turnos_${new Date().toISOString()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const estadoColor = (estado?: string | null) => {
  if (!estado) return 'default';
  const e = String(estado).toLowerCase();
  if (e.includes('cancel')) return 'error';
  if (e.includes('conf') || e.includes('confirm')) return 'success';
  if (e.includes('pend') || e.includes('espera') || e.includes('pending')) return 'warning';
  return 'default';
};

// ---------------------- Componente ----------------------
export default function HistoricoPage(): JSX.Element {
  const [dniInput, setDniInput] = useState<string>('');
  const [dniError, setDniError] = useState<string | null>(null);

  const [rows, setRows] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // columnas visibles
  const initialVisibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    ALL_COLUMNS.forEach(c => (map[c.key] = true));
    return map;
  }, []);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(initialVisibility);

  // menú de columnas
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openColsMenu = Boolean(anchorEl);
  const handleOpenColsMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleCloseColsMenu = () => setAnchorEl(null);

  // orden cliente por fecha_hora_mdf
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const toggleSort = () => setSortDesc(prev => !prev);

  // ---------------------- Acciones ----------------------
  const validateDni = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "El DNI es requerido";
    if (!/^\d{3,15}$/.test(trimmed)) return "DNI inválido (sólo dígitos, 3-15 caracteres)";
    return null;
  }, []);

  const handleSearch = async () => {
    setError(null);
    const err = validateDni(dniInput);
    setDniError(err);
    if (err) return;

    setLoading(true);
    try {
      const dniNum = Number(dniInput.trim());
      const data = await getHistoricoTurno(dniNum);
      setRows(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setError('Respuesta inesperada del servidor');
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Error al consultar el histórico');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setDniInput('');
    setDniError(null);
    setError(null);
    setRows([]);
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

  // ordenar rows cliente por fecha_hora_mdf localmente si existe
  const displayedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const da = a.fecha_hora_mdf ? new Date(a.fecha_hora_mdf).getTime() : 0;
      const db = b.fecha_hora_mdf ? new Date(b.fecha_hora_mdf).getTime() : 0;
      return sortDesc ? db - da : da - db;
    });
    return copy;
  }, [rows, sortDesc]);

  // keys visibles
  const visibleKeys = useMemo(() => ALL_COLUMNS.filter(c => visibleCols[c.key]).map(c => c.key), [visibleCols]);

  const columnsMap = useMemo(() => {
    const m: Record<string, string> = {};
    ALL_COLUMNS.forEach(c => (m[c.key] = c.label));
    return m;
  }, []);

  // manejo "Enter" en input
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box className="p-4">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={600}>Histórico de Turnos por paciente</Typography>
        <Box display="flex" gap={1}>
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

      {/* Buscador */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="DNI"
            placeholder="Ingresá DNI..."
            value={dniInput}
            onChange={(e) => setDniInput(e.target.value.replace(/\s+/g, ''))}
            onKeyDown={onKeyDown}
            error={!!dniError}
            helperText={dniError ?? 'Presioná Enter o Buscar'}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            sx={{ minWidth: 220 }}
          />

          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={18} /> : <SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>

          <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClear} disabled={loading}>
            Limpiar
          </Button>

          <Box flexGrow={1} />

          <Box display="flex" gap={1} alignItems="center">
            <Typography variant="body2">Ordenar por última modificación</Typography>
            <IconButton onClick={toggleSort} size="small" aria-label="toggle sort">
              {sortDesc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Typography color="error" mt={1}>{error}</Typography>
        )}
      </Paper>

      {/* Menu columnas */}
      <Menu anchorEl={anchorEl} open={openColsMenu} onClose={handleCloseColsMenu}>
        <MenuItem onClick={() => { showAll(); handleCloseColsMenu(); }}>Mostrar todo</MenuItem>
        <MenuItem onClick={() => { hideAll(); handleCloseColsMenu(); }}>Ocultar todo</MenuItem>
        <Box sx={{ px: 2, py: 1 }}>
          {ALL_COLUMNS.map(col => (
            <Box key={col.key} display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
              <Typography variant="body2">{col.label}</Typography>
              <Button size="small" onClick={() => toggleColumn(col.key)} variant={visibleCols[col.key] ? 'contained' : 'outlined'}>
                {visibleCols[col.key] ? 'Ocultar' : 'Mostrar'}
              </Button>
            </Box>
          ))}
        </Box>
      </Menu>

      {/* Tabla */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {ALL_COLUMNS.filter(c => visibleCols[c.key]).map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 600 }}>
                  {col.label}
                  {col.key === 'fecha_hora_mdf' && (
                    <IconButton size="small" onClick={toggleSort} sx={{ ml: 1 }}>
                      {sortDesc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                    </IconButton>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={Math.max(1, visibleKeys.length)}>
                  <Box display="flex" alignItems="center" gap={2} p={2}>
                    <CircularProgress size={18} />
                    <Typography>Cargando histórico...</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {!loading && displayedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(1, visibleKeys.length)}>
                  <Box p={2}><Typography variant="body2">No se encontraron registros para el DNI ingresado.</Typography></Box>
                </TableCell>
              </TableRow>
            )}

            {!loading && displayedRows.map((r, idx) => (
              <TableRow key={r.idturno ?? idx}>
                {ALL_COLUMNS.filter(c => visibleCols[c.key]).map(col => {
                  const key = col.key as keyof HistoricoItem;
                  switch (col.key) {
                    case 'idturno': return <TableCell key={col.key}>{r.idturno ?? '—'}</TableCell>;
                    case 'fecha_hora_mdf': return <TableCell key={col.key}>{safeFormat(r.fecha_hora_mdf)}</TableCell>;
                    case 'estado':
                      return (
                        <TableCell key={col.key}>
                          {r.estado ? (
                            <Tooltip title={String(r.estado)}>
                              <Chip
                                label={String(r.estado)}
                                size="small"
                                variant="outlined"
                                color={estadoColor(r.estado) as any}
                              />
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                      );
                    case 'nro_doc': return <TableCell key={col.key}>{r.nro_doc ?? '—'}</TableCell>;
                    case 'paciente_nombre': return <TableCell key={col.key}>{r.paciente_nombre ?? '—'}</TableCell>;
                    case 'paciente_apellido': return <TableCell key={col.key}>{r.paciente_apellido ?? '—'}</TableCell>;
                    case 'efector': return <TableCell key={col.key}>{r.efector ?? '—'}</TableCell>;
                    case 'servicio': return <TableCell key={col.key}>{r.servicio ?? '—'}</TableCell>;
                    case 'especialidad': return <TableCell key={col.key}>{r.especialidad ?? '—'}</TableCell>;
                    case 'nombre_profesional': return <TableCell key={col.key}>{r.nombre_profesional ?? '—'}</TableCell>;
                    case 'apellido_profesional': return <TableCell key={col.key}>{r.apellido_profesional ?? '—'}</TableCell>;
                    case 'fecha': return <TableCell key={col.key}>{safeFormat(r.fecha)}</TableCell>;
                    case 'hora': return <TableCell key={col.key}>{r.hora ?? '—'}</TableCell>;
                    default: return <TableCell key={col.key}>{String((r as any)[key] ?? '—')}</TableCell>;
                  }
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body2">Mostrando {displayedRows.length} registros.</Typography>
        <Box>
          <Button onClick={() => downloadCSV(displayedRows, visibleKeys, columnsMap)} disabled={displayedRows.length === 0}>
            Descargar CSV
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
