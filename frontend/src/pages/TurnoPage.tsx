import React, { useEffect, useState } from 'react';
import {Menu, MenuItem,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Typography, CircularProgress, Box, Tooltip, TextField
} from '@mui/material';
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);
  useEffect(() => { loadLimited(limit); /* eslint-disable-next-line */ }, []);
  const navigate = useNavigate()

  // --- Nuevo estado para filtrar por DNI ---
  const [filterDni, setFilterDni] = useState<string>('');

  async function loadLimited(requestLimit: number) {
    setLoading(true); 
    try {
      const data = await getTurnosMergedLimit(requestLimit);
      setTurnos(data);
      setHasMore(data.length >= requestLimit);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  }

  async function loadAll() { await loadLimited(limit); }


  function getMsj(type: number, list?: any[]): any | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    const targetPlantillaTipoId = type;
    if (targetPlantillaTipoId !== undefined) {
      for (const item of list) {
        if (item?.plantilla?.tipo?.id === targetPlantillaTipoId) return item;
      }
    }
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
    if (!pkMensaje || !idMensajeExterno || !numero) {
      console.error('Faltan datos para consultar estado del mensaje', { pkMensaje, idMensajeExterno, numero });
      return;
    }
    const pkMensajeStr = String(pkMensaje);
    try {
      setUpdatingMessageId(pkMensajeStr);
      const resp = await getEstadomsj(pkMensaje, idMensajeExterno, numero);
      const data = resp?.data ?? resp;
      if (!data || data.error) { console.error('Error en respuesta de getEstadomsj', data)
        return
      }

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
  const allColumns = [
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
  ];

  const initialVisibility: Record<string, boolean> = allColumns.reduce((acc, c) => { acc[c.key] = true; return acc; }, {} as Record<string, boolean>);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialVisibility);

  function toggleColumn(key: string) { setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] })); }
  function showAll() { const next: Record<string, boolean> = {}; allColumns.forEach(c => next[c.key] = true); setVisibleColumns(next); }

  function renderCell(columnKey: string, t: TurnoExtend, idx: number) {
    switch (columnKey) {
      case 'dni': return <TableCell key={columnKey}>{t.paciente_dni ?? '—'}</TableCell>;
      case 'nombre': return <TableCell key={columnKey}>{t.paciente_nombre ?? '—'}</TableCell>;
      case 'apellido': return <TableCell key={columnKey}>{t.paciente_apellido ?? '—'}</TableCell>;
      case 'efector': return <TableCell key={columnKey}>{t.efector?.nombre ?? String(t.id_efector ?? '—')}</TableCell>;
      case 'servicio': return <TableCell key={columnKey}>{t.servicio?.nombre ?? String(t.id_servicio ?? '—')}</TableCell>;
      case 'especialidad': return <TableCell key={columnKey}>{t.especialidad?.nombre ?? String(t.id_especialidad ?? '—')}</TableCell>;
      case 'prof_nombre': return <TableCell key={columnKey}>{t.profesional_nombre ?? '—'}</TableCell>;
      case 'prof_apellido': return <TableCell key={columnKey}>{t.profesional_apellido ?? '—'}</TableCell>;
      case 'estado': return <TableCell key={columnKey}>{t.estado?.nombre ?? '—'}</TableCell>;
      case 'confirmacion': {
        const mensaje = getMsj(1, t.mensaje_asociado);
        const tooltipTitle = mensaje?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey} style={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleClickEstado(idx, mensaje)}
                    disabled={updatingMessageId === (String(mensaje.id ?? mensaje.pk))}
                  >
                    {updatingMessageId === (String(mensaje.id ?? mensaje.pk)) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <CircularProgress size={16} />
                        <span>{mensaje.estado?.significado ?? '—'}</span>
                      </span>
                    ) : (
                      <span>{mensaje.estado?.significado ?? '—'}</span>
                    )}
                  </Button>
                  {mensaje?.fecha_envio ? <div style={{ marginTop: 6 }}>{mensaje.fecha_envio}</div> : null}
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
          <TableCell key={columnKey} style={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleClickEstado(idx, mensaje)}
                    disabled={updatingMessageId === (String(mensaje.id ?? mensaje.pk))}
                  >
                    {updatingMessageId === (String(mensaje.id ?? mensaje.pk)) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <CircularProgress size={16} />
                        <span>{mensaje.estado?.significado ?? '—'}</span>
                      </span>
                    ) : (
                      <span>{mensaje.estado?.significado ?? '—'}</span>
                    )}
                  </Button>
                  {mensaje?.fecha_envio ? <div style={{ marginTop: 6 }}>{mensaje.fecha_envio}</div> : null}
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
          <TableCell key={columnKey} style={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>
            {mensaje ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleClickEstado(idx, mensaje)}
                    disabled={updatingMessageId === (String(mensaje.id ?? mensaje.pk))}
                  >
                    {updatingMessageId === (String(mensaje.id ?? mensaje.pk)) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <CircularProgress size={16} />
                        <span>{mensaje.estado?.significado ?? '—'}</span>
                      </span>
                    ) : (
                      <span>{mensaje.estado?.significado ?? '—'}</span>
                    )}
                  </Button>
                  {mensaje?.fecha_envio ? <div style={{ marginTop: 6 }}>{mensaje.fecha_envio}</div> : null}
                </div>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }
      case 'recordatorio': {
        const mensaje_reco = getMsj(4,t.mensaje_asociado);
        const tooltipTitle = mensaje_reco?.plantilla?.contenido ? (<span style={{ whiteSpace: 'pre-wrap' }}>{mensaje_reco.plantilla.contenido}</span>) : '';
        return (
          <TableCell key={columnKey}>
            {mensaje_reco ? (
              <Tooltip title={tooltipTitle} arrow placement="top" enterDelay={150}>
                <div>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleClickEstado(idx, mensaje_reco)}
                    disabled={updatingMessageId === (String(mensaje_reco.id ?? mensaje_reco.pk))}
                  >
                    {updatingMessageId === (String(mensaje_reco.id ?? mensaje_reco.pk)) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <CircularProgress size={16} />
                        <span>{mensaje_reco.estado?.significado ?? '—'}</span>
                      </span>
                    ) : (
                      <span>{mensaje_reco.estado?.significado ?? '—'}</span>
                    )}
                  </Button>
                  {mensaje_reco?.fecha_envio ? <div style={{ marginTop: 6 }}>{mensaje_reco.fecha_envio}</div> : null}
                </div>
              </Tooltip>
            ) : '—'}
          </TableCell>
        );
      }
      case 'fecha': return <TableCell key={columnKey}>{t.fecha ?? '—'}</TableCell>;
      case 'hora': return <TableCell key={columnKey}>{t.hora ?? '—'}</TableCell>;
      default: return <TableCell key={columnKey}>—</TableCell>;
    }
  }

  // ---- aplicamos el filtro por DNI (si hay texto) ----
  const filteredTurnos = filterDni.trim()
    ? turnos.filter(t => String(t.paciente_dni ?? '').includes(filterDni.trim()))
    : turnos;

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
          case 'efector': row.push(t.efector?.nombre ?? String(t.id_efector ?? '')); break;
          case 'servicio': row.push(t.servicio?.nombre ?? String(t.id_servicio ?? '')); break;
          case 'especialidad': row.push(t.especialidad?.nombre ?? String(t.id_especialidad ?? '')); break;
          case 'prof_nombre': row.push(t.profesional_nombre ?? ''); break;
          case 'prof_apellido': row.push(t.profesional_apellido ?? ''); break;
          case 'estado': row.push(t.estado?.nombre ?? ''); break;
          case 'mensaje': {
            const mensaje = getMsj(t.estado?.id ?? -1, t.mensaje_asociado);
            row.push(mensaje ? (mensaje.estado?.significado ?? '') : ''); break;
          }
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

  const visibleKeys = allColumns.filter(c => visibleColumns[c.key]).map(c => c.key);
  const visibleCount = Math.max(1, visibleKeys.length);

return (
  <div className="p-4">
    {/* Header con título y controles */}
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 6,
        gap: 4
      }}
    >
      <Typography variant="h5" fontWeight="600">Turnos</Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
        <TextField
          size="small"
          label="Filtrar DNI"
          value={filterDni}
          onChange={(e) => setFilterDni(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFilterDni("");
          }}
        />

        <Button
          variant="contained"
          onClick={loadAll}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </Button>

        <Button
          variant="outlined"
          onClick={downloadCSV}
          disabled={loading || !filteredTurnos.length}
        >
          Descargar
        </Button>
      </Box>
    </Box>

    {/* Controles adicionales */}
    <Box
      className="mb-3 flex flex-wrap gap-8 items-center"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 3,
        mb: 6
      }}
    >
      <Button size="small" variant="outlined" onClick={showAll}>
        Mostrar todo
      </Button>

      <Button size="small" variant="contained" onClick={handleOpenMenu}>
        Columnas
      </Button>

      <Button size="small" variant="contained" onClick={() => navigate("/historico")}>
        Histórico
      </Button>

      <Menu anchorEl={anchorEl} open={openMenu} onClose={handleCloseMenu}>
        {allColumns.map(c => (
          <MenuItem
            key={c.key}
            onClick={() => { toggleColumn(c.key); }}
          >
            <input
              type="checkbox"
              checked={visibleColumns[c.key]}
              readOnly
              style={{ marginRight: 8 }}
            />
            {c.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>

    {/* Tabla */}
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            {allColumns.filter(c => visibleColumns[c.key]).map(col => (
              <TableCell key={col.key}>{col.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={visibleCount}>Cargando turnos...</TableCell>
            </TableRow>
          )}
          {!loading && !filteredTurnos.length && (
            <TableRow>
              <TableCell colSpan={visibleCount}>No hay turnos para mostrar.</TableCell>
            </TableRow>
          )}

          {!loading && filteredTurnos.map((t, idx) => (
            <TableRow key={idx}>
              {allColumns.filter(c => visibleColumns[c.key]).map(col => (
                renderCell(col.key, t, idx)
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    {/* Footer */}
    <div className="mt-2 flex items-center justify-between">
      <div className="text-sm text-gray-600">
        Mostrando {filteredTurnos.length} turnos. (límite: {limit})
      </div>
      <div className="flex gap-2">
        <Button
          variant="outlined"
          onClick={handleLoadMore}
          disabled={extending || loading || !hasMore}
        >
          {extending ? "Cargando..." : hasMore ? "Mostrar más" : "No hay más"}
        </Button>
      </div>
    </div>
  </div>
);
}