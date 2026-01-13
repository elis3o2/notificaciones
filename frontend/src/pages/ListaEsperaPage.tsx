import  { useContext, useEffect, useMemo, useState } from "react";
import type { Efector } from "../features/efe_ser_esp/types";
import type { TurnoEspera } from "../features/turno/types";
import { AuthContext } from "../common/contex";
import { getTurnoEsperaAbierto, getTurnoEsperaAbiertoDeriva } from "../features/turno/api";
import { CloseTurnoEspera } from "../features/turno/api";
import {getDerivaByEfector} from "../features/efe_ser_esp/api"
// MUI
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Typography,
  Paper,
  Stack,
  Button,
  GridLegacy as Grid,
    Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Snackbar,
  Alert,
  Chip, // <-- agregado
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";

import { useNavigate } from "react-router-dom";

type SortBy = "priority" | "dias";
type AlertSeverity = "success" | "info" | "warning" | "error";

export default function ListaEspera(): React.ReactElement {
  const { efectores } = useContext(AuthContext) as { efectores?: Efector[] };
  const [selectedEfector, setSelectedEfector] = useState<Efector | null>(null);
  // `selectedEspecialidad` se maneja por ID para simplificar el Select
  const [selectedEspecialidad, setSelectedEspecialidad] = useState<number | null>(null);

  const [turnos, setTurnos] = useState<TurnoEspera[]>([]);
  const [loading, setLoading] = useState(false);
  const [_, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [derivaciones, setDerivaciones] = useState<Efector[]>([])
  const [selectedDerivacion, setSelectedDerivacion] = useState<Efector | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>("priority");

  // dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [activeTurno, setActiveTurno] = useState<TurnoEspera | null>(null);

  // ids que están en proceso de eliminación
  const [removingIds, setRemovingIds] = useState<number[]>([]);

  // Estados de alerta solicitados
  const [alertOpen, setAlertOpen] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<string>("");
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>("info");

  useEffect(() => {
    let mounted = true;
    const fetchTurnos = async () => {
      if (!selectedEfector) {
        setTurnos([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await getTurnoEsperaAbierto(selectedEfector.id);
        if (!mounted) return;
        setTurnos(data);
      } catch (e: unknown) {
        // obtener mensaje sin introducir `any`
        const msg = (e as { message?: string })?.message ?? "Error al obtener turnos";
        if (!mounted) return;
        setError(msg);
        setTurnos([]);
        // mostrar alerta
        setAlertMsg(msg);
        setAlertSeverity("error");
        setAlertOpen(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTurnos();
    return () => {
      mounted = false;
    };
  }, [selectedEfector]);

  // cuando cambie efector, resetear filtros
  useEffect(() => {
    setSelectedEspecialidad(null);
    setSortBy("priority");
  }, [selectedEfector]);


  useEffect(() => {
    if (!selectedEfector) {
      setDerivaciones([]);
      setSelectedDerivacion(null);
      return;
    }

    const loadDerivaciones = async () => {
      try {
        const data = await getDerivaByEfector(selectedEfector.id);
        const únicos = Array.from(
          new Map(
            data.map(d => [d.efector_deriva.id, d.efector_deriva])
          ).values()
        );

        setDerivaciones(únicos);
      } catch (e: any) {
        const msg = e?.message ?? "Error al obtener derivaciones";
        setAlertMsg(msg);
        setAlertSeverity("error");
        setAlertOpen(true);
      }
    };

    loadDerivaciones();
  }, [selectedEfector]);

  useEffect(() => {
  if (!selectedEfector) return;

  // Si no hay derivación seleccionada → lista normal
  if (!selectedDerivacion) {
    let mounted = true;
    const fetchTurnos = async () => {
      if (!selectedEfector) {
        setTurnos([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await getTurnoEsperaAbierto(selectedEfector.id);
        if (!mounted) return;
        setTurnos(data);
      } catch (e: unknown) {
        // obtener mensaje sin introducir `any`
        const msg = (e as { message?: string })?.message ?? "Error al obtener turnos";
        if (!mounted) return;
        setError(msg);
        setTurnos([]);
        // mostrar alerta
        setAlertMsg(msg);
        setAlertSeverity("error");
        setAlertOpen(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTurnos();
    return () => {
      mounted = false;
    };
  }

  // Si hay derivación → lista de derivados
   const loadDerivados = async () => {
    try {
      setLoading(true);
      const data = await getTurnoEsperaAbiertoDeriva(
        selectedDerivacion.id,
        selectedEfector.id
      );
      setTurnos(data);
    } catch (e: any) {
      setAlertMsg(e?.message ?? "Error al obtener turnos derivados");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  loadDerivados();
}, [selectedDerivacion]);




  const priorityColor = (p: number) => {
    if (p == 2) return "#0baf26ff"; // verde claro (ejemplo)
    if (p == 0) return "#EF4444"; // rojo
    if (p == 1) return "#F59E0B"; // amarillo
  };

  const diasEnEsperaNumber = (t: TurnoEspera): number => {
    try {
      // Convertimos la fecha de creación al inicio del día
      const fecha = new Date(t.fecha_hora_creacion);
      const fechaMid = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();

      // Fecha actual truncada al inicio del día
      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

      const diffMs = todayMid - fechaMid;
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return days >= 0 ? days : 0;
    } catch {
      return 0;
    }
  };



  const diasEnEsperaLabel = (t: TurnoEspera) => {
    const n = diasEnEsperaNumber(t);
    return `${n} días`;
  };

  // Paciente: mostramos Apellido, Nombre · DNI: ####
  const pacienteLabel = (t: TurnoEspera) => {
    const p = t.paciente;
    const apellido = p?.apellido ?? "";
    const nombre = p?.nombre ?? "";
    const dni = p?.nro_doc ?? null;

    if (apellido || nombre) {
      const base = `${apellido}${apellido && nombre ? ", " : ""}${nombre}`;
      return dni ? `${base} · DNI: ${dni}` : base;
    }
    return dni ? `Paciente · DNI: ${dni}` : "Paciente sin datos";
  };

  // proveedor (médico que solicitó) - varios fallbacks
  const medicoSolicitanteLabel = (t: TurnoEspera) => {
    const apellido = t.profesional_solicitante?.apellido ?? "";
    const nombre = t.profesional_solicitante?.nombre ?? "";
    if (apellido || nombre) return `${apellido}${apellido && nombre ? ", " : ""}${nombre}`;
    return "No registrado";
  };

  // opciones de filtro construidas a partir de turnos -> array de { id, nombre }
  const especialidadesOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of turnos) {
      const id = t.especialidad.id;
      const name = t.especialidad.nombre;
      if (!map.has(id)) map.set(id, name);
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [turnos]);

  // si el filtro seleccionado ya no está en las opciones, lo reseteamos
  useEffect(() => {
    if (selectedEspecialidad !== null && !especialidadesOptions.some((s) => s.id === selectedEspecialidad)) {
      setSelectedEspecialidad(null);
    }
  }, [especialidadesOptions, selectedEspecialidad]);

  // aplicar filtros y orden
  const visibleTurnos = useMemo(() => {
    let arr = [...turnos] as TurnoEspera[];

    // filtro por especialidad (por id)
    if (selectedEspecialidad !== null) {
      arr = arr.filter((t) => t.especialidad.id === selectedEspecialidad);
    }

    // orden según criterio
    if (sortBy === "priority") {
      arr.sort((a, b) => {
        const pa = a.prioridad ?? 99;
        const pb = b.prioridad ?? 99;
        if (pa !== pb) return pa - pb;
        const da = Number(a.fecha_hora_creacion);
        const db = Number(b.fecha_hora_creacion);
        return da - db;
      });
    } else {
      arr.sort((a, b) => {
        const da = diasEnEsperaNumber(a);
        const db = diasEnEsperaNumber(b);
        if (db !== da) return db - da;
        const pa = a.prioridad ?? 99;
        const pb = b.prioridad ?? 99;
        return pa - pb;
      });
    }

    return arr;
  }, [turnos, selectedEspecialidad, sortBy]);

  // open dialog with a turno
  const handleOpenDialog = (t: TurnoEspera) => {
    setActiveTurno(t);
    setOpenDialog(true);
  };
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setActiveTurno(null);
  };

  const handleRemove = async () => {
    if (!activeTurno) return;
    const id = activeTurno.id;

    setRemovingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    try {
      await CloseTurnoEspera(id);
      // actualizar lista local
      setTurnos((prev) => prev.filter((t) => t.id !== id));

      // mostrar éxito
      setAlertMsg("Turno sacado de la lista de espera.");
      setAlertSeverity("success");
      setAlertOpen(true);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Error al sacar el turno.";
      console.error(e);
      // mostrar error
      setAlertMsg(msg);
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setRemovingIds((prev) => prev.filter((x) => x !== id));
      handleCloseDialog();
    }
  };

  const tooltipContent = (t: TurnoEspera) => {
    const p = t.paciente ?? {};
    const dni = p.nro_doc ?? "-";
    return (
      <Box sx={{ maxWidth: 320 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {p.apellido ?? ""}
          {p.apellido && p.nombre ? ", " : ""}
          {p.nombre ?? ""}
        </Typography>
        <Typography variant="caption" display="block">
          DNI: {dni}
        </Typography>
        <Typography variant="caption" display="block">
          Servicio: {t.servicio.nombre}
        </Typography>
        <Typography variant="caption" display="block">
          Especialidad: {t.especialidad.nombre}
        </Typography>
        <Typography variant="caption" display="block">
          Solicitado por: {medicoSolicitanteLabel(t)}
        </Typography>
        <Typography variant="caption" display="block">
          Desde: {t.efector_solicitante.nombre}
        </Typography>
        {t.cupo && (
        <Typography  variant="caption" display="block">
          A: {t.efector.nombre }
        </Typography>
        )}
      </Box>
    );
  };

  const isRemoving = (id?: number | null) => id != null && removingIds.includes(id);


const telefonoEstado = (carac: string | null | undefined, nro: string | null | undefined) => {
  
  const status: "missing" | "valid" | "invalid" =
    (carac == null || nro == null) ? "missing" :
    (carac.length === 3 && nro.length === 7) ? "valid" :
    "invalid";

  const icon =
    status === "valid" ? (
      <CheckCircleIcon sx={{ color: "success.main", ml: 1 }} fontSize="small" />
    ) : status === "missing" ? (
      <WarningAmberIcon sx={{ color: "warning.main", ml: 1 }} fontSize="small" />
    ) : (
      <CancelIcon sx={{ color: "error.main", ml: 1 }} fontSize="small" />
    );

  const tooltipText =
    status === "valid"
      ? "Teléfono válido"
      : status === "missing"
      ? "Teléfono no cargado"
      : "Teléfono no válido";

  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center" }}>
      Teléfono: {carac || "-"} - {nro || "-"}
      <Tooltip title={tooltipText}>
        <span aria-hidden>{icon}</span>
      </Tooltip>
    </Typography>
  );
}

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h6">Lista de espera</Typography>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(`/add-espera?efector=${selectedEfector?.id}`)}
            disabled={!selectedEfector}
          >
            Agregar
          </Button>

          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(`/espera-paciente`)}
          >
            Buscar Paciente
          </Button>
        </Box>
      </Box>


      {/* Filtros: Efector, Especialidad, Orden */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4} md={3}>
          <FormControl size="small" fullWidth>
            <InputLabel id="efector-select-label">Efector</InputLabel>
            <Select
              labelId="efector-select-label"
              value={selectedEfector?.id ?? ""}
              label="Efector"
              onChange={(e) => {
                const id = Number(e.target.value);
                const ef = efectores?.find((x) => x.id === id) ?? null;
                setSelectedEfector(ef);
              }}
            >
              {efectores && efectores.length > 0 ? (
                efectores.map((ef) => (
                  <MenuItem key={ef.id} value={ef.id}>
                    {ef.nombre ?? `Efector ${ef.id}`}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="">(sin efectores)</MenuItem>
              )}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={4} md={3}>
          <FormControl size="small" fullWidth>
            <InputLabel id="especialidad-select-label">Especialidad</InputLabel>
            <Select
              labelId="especialidad-select-label"
              value={selectedEspecialidad ?? ""}
              label="Especialidad"
              onChange={(e) => {
                const val = e.target.value === null ? null : Number(e.target.value);
                setSelectedEspecialidad(val);
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {especialidadesOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FormControl size="small" fullWidth>
            <InputLabel id="sort-select-label">Ordenar por</InputLabel>
            <Select
              labelId="sort-select-label"
              value={sortBy}
              label="Ordenar por"
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <MenuItem value="priority">Prioridad</MenuItem>
              <MenuItem value="dias">Días en espera</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        
        <Grid item xs={12} sm={6} md={3}>
          <FormControl size="small" fullWidth>
            <InputLabel id="sort-select-label">Derivación</InputLabel>
            <Select
            labelId="derivacion-select-label"
            value={selectedDerivacion?.id ?? ""}
            label="Derivacion"
            onChange={(e) => {
              const val = e.target.value;

              if (val === null) {
                // opción "ninguna"
                setSelectedDerivacion(null);
              } else {
                const id = Number(val);
                const ef = derivaciones.find((x) => x.id === id) ?? null;
                setSelectedDerivacion(ef);
              }
            }}
          >
            {/* Opción para no filtrar por derivación */}
            <MenuItem value="">
              <em>Ninguna</em>
            </MenuItem>

            {derivaciones.map((ef) => (
              <MenuItem key={ef.id} value={ef.id}>
                {ef.nombre}
              </MenuItem>
            ))}
          </Select>

          </FormControl>
        </Grid>
      </Grid>

      {/* Estado carga / contador */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mb: 1 }}>
        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Cargando...</Typography>
          </Stack>
        ) : selectedEfector ? (
          <Typography variant="body2">{visibleTurnos.length} turno(s) visibles</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Seleccione un efector
          </Typography>
        )}
      </Box>

      {/* Contenedor principal */}
      {!selectedEfector ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Seleccione un efector para ver los turnos en espera.</Typography>
        </Paper>
      ) : visibleTurnos.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">No hay turnos que coincidan con los filtros.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visibleTurnos.map((t: TurnoEspera) => {
            const prioridad = t.prioridad ?? 0;
            const bg = priorityColor(prioridad);
            const dias = diasEnEsperaLabel(t);

            return (
              <Tooltip key={t.id} title={tooltipContent(t)} placement="top" arrow>
                <Paper
                  variant="outlined"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    px: 1.5,
                    height: 72,
                    cursor: "pointer",
                  }}
                  onClick={() => handleOpenDialog(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleOpenDialog(t);
                    }
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", width: "100%", gap: 2 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 52,
                        backgroundColor: bg,
                        borderRadius: 1,
                        flexShrink: 0,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                      aria-hidden
                    />

                    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {pacienteLabel(t)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {t.servicio.nombre} · {t.especialidad.nombre}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      ml: 2,
                      textAlign: "right",
                      minWidth: 88,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 0.5,
                    }}
                  >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

                        {t.cupo ? (
                          <Chip
                            label="CUPO"
                            size="small"
                            sx={{
                              fontWeight: 700,
                              height: 20,
                              lineHeight: "20px",
                              px: 0.7,
                            }}
                          />
                        ) : null}

                        <Typography variant="body2" sx={{ fontWeight: 700,whiteSpace: "nowrap" }}>
                          {dias}
                        </Typography>

                      </Box>

                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Espera
                    </Typography>
                  </Box>

                </Paper>
              </Tooltip>
            );
          })}
        </Box>
      )}

      {/* DIALOG: detalles completos */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Detalle del turno
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {activeTurno ? (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {activeTurno.paciente?.apellido ?? ""}
                {activeTurno.paciente && activeTurno.paciente.nombre ? `, ${activeTurno.paciente.nombre}` : ""}{" "}
                {activeTurno.paciente?.nro_doc ? `· DNI: ${activeTurno.paciente.nro_doc}` : ""}
              </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Sexo: {activeTurno.paciente?.sexo ?? ""}{"  ·  "}
                  Fecha de nacimiento: {String(activeTurno.paciente?.fecha_nacimiento ?? "")}
                  {telefonoEstado(activeTurno.paciente.carac_telef, activeTurno.paciente.nro_telef)}
                </Typography>
              <Divider sx={{ my: 1 }} />

              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Servicio:</strong> {activeTurno.servicio.nombre}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Especialidad:</strong> {activeTurno.especialidad.nombre}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Solicitado por:</strong> {medicoSolicitanteLabel(activeTurno)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Desde efector:</strong> {activeTurno.efector_solicitante.nombre}
              </Typography>
              {activeTurno.cupo && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>A:</strong> {activeTurno.efector.nombre }
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Prioridad:</strong> {String(activeTurno.prioridad)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Fecha creación:</strong> {new Date(activeTurno.fecha_hora_creacion).toLocaleString()}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Días en espera:</strong> {diasEnEsperaNumber(activeTurno)}
              </Typography>

              {/* -- NUEVO: lista de estudios requeridos -- */}
              {activeTurno.estudio_requerido && activeTurno.estudio_requerido.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Estudios requeridos
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    {activeTurno.estudio_requerido.map((s) => (
                      <Chip key={s.id} label={s.nombre ?? `#${s.id}`} size="small" sx={{ mb: 0.5 }} />
                    ))}
                  </Stack>
                </>
              )}
            </Box>
          ) : (
            <Typography>Sin datos</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {(selectedDerivacion === null || activeTurno?.cupo)  &&
              <Button
                color="error"
                onClick={handleRemove}
                disabled={isRemoving(activeTurno?.id)}
                startIcon={isRemoving(activeTurno?.id) ? <CircularProgress size={16} /> : null}
              >
                Sacar de la lista de espera
              </Button>}

          <Button onClick={handleCloseDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Alerta global */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={4000}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity} sx={{ width: "100%" }}>
          {alertMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
