import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import { postTurnoEspera } from "../features/turno/api";
import type { Efector, EfeSerEspCompleto } from "../features/efe_ser_esp/types";
import { getEfectorById } from "../features/efe_ser_esp/api";
import type { Paciente, Profesional } from "../features/persona/types";
import LookPaciente from "../features/turno/components/LookPaciente";
import LookProfesional from "../features/turno/components/LookProfesional";
import LookEfeSerEsp from "../features/turno/components/LookEfeSerEsp";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

type AlertSeverity = "success" | "info" | "warning" | "error";

export default function AddEspera(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  const search = new URLSearchParams(location.search);
  const efQuery = search.get("efector");
  const stateEf = (location.state as number) ?? undefined;
  const efectorId = efQuery ? Number(efQuery) : stateEf ?? null;

  const [efector, setEfector] = useState<Efector | null>(null);
  const [loadingEfector, setLoadingEfector] = useState(false);
  const [errorEfector, setErrorEfector] = useState<string | null>(null);

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [finishPaciente, setFinishPaciente] = useState(false);

  const [profesional, setProfesional] = useState<Profesional | null>(null);
  const [finishProfesional, setFinishProfesional] = useState(false);

  const [efeSerEspSeleccionado, setEfeSerEspSeleccionado] =
    useState<EfeSerEspCompleto | null>(null);
  const [finishEfeSerEsp, setFinishEfeSerEsp] = useState(false);

  // prioridad: "baja" | "media" | "alta" | null
  const [priority, setPriority] = useState<string | null>(null);

  const mapPriority: Record<string, number> = { baja: 2, media: 1, alta: 0 };

  // Estados de alerta solicitados
  const [alertOpen, setAlertOpen] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<string>("");
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>("info");

  // NUEVO: estado para bloquear el botón y evitar doble click
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (efectorId == null) {
      setEfector(null);
      return;
    }
    let mounted = true;
    const load = async () => {
      setLoadingEfector(true);
      setErrorEfector(null);
      try {
        const data = await getEfectorById(efectorId);
        if (!mounted) return;
        setEfector(data ?? null);
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "Error al cargar efector";
        if (!mounted) return;
        setErrorEfector(msg);
        setEfector(null);
        // mostrar alerta de error al cargar efector
        setAlertMsg(msg);
        setAlertSeverity("error");
        setAlertOpen(true);
      } finally {
        if (mounted) setLoadingEfector(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [efectorId]);

  // handlers para "eliminar" selección y mostrar de nuevo el selector
  const resetPaciente = () => {
    setPaciente(null);
    setFinishPaciente(false);
    setPriority(null);
  };

  const resetProfesional = () => {
    setProfesional(null);
    setFinishProfesional(false);
    setPriority(null);
  };

  const resetEfeSerEsp = () => {
    setEfeSerEspSeleccionado(null);
    setFinishEfeSerEsp(false);
    setPriority(null);
  };

  // puede seleccionarse prioridad solo si todas las selecciones anteriores están hechas
  const canSelectPriority = Boolean(
    (efector || efectorId) && paciente && profesional && efeSerEspSeleccionado
  );

  // si por cualquier motivo canSelectPriority deja de cumplirse, limpiamos priority
  useEffect(() => {
    if (!canSelectPriority) setPriority(null);
  }, [canSelectPriority]);

  const handlePriorityChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (!canSelectPriority) return;
    setPriority((ev.target as HTMLInputElement).value);
  };

  // condición para habilitar confirmar:
  const canConfirm = Boolean(
    (efector || efectorId) &&
      paciente &&
      profesional &&
      efeSerEspSeleccionado &&
      priority
  );

  const handleConfirm = async () => {
    if (!canConfirm) return;
    if (submitting) return; // evita doble submit por seguridad

    setSubmitting(true); // bloqueamos inmediatamente

    try {
      const idEfeSerEsp = efeSerEspSeleccionado!.id;
      const idProf = profesional!.id;
      const idEfeSolicitante = efector ? efector.id : efectorId;
      const prioridadNum = mapPriority[priority!];
      const idPaciente = paciente!.id;

      // llamada al backend (asegurate que postTurnoEspera devuelva una Promise)
      await postTurnoEspera(idEfeSerEsp, idProf, idEfeSolicitante, idPaciente, prioridadNum);

      // éxito: mostrar alerta
      setAlertMsg("Turno en espera creado correctamente.");
      setAlertSeverity("success");
      setAlertOpen(true);

      // mantener botón bloqueado hasta la navegación para evitar doble click durante el delay
      window.setTimeout(() => {
        setSubmitting(false);
        navigate('/espera');
      }, 3000);
    } catch (err: unknown) {
      console.error("Error creando turno en espera:", err);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Error al crear turno en espera";
      setAlertMsg(msg);
      setAlertSeverity("error");
      setAlertOpen(true);
      setSubmitting(false); // re-habilitar botón en caso de error
    }
  };

  // mapeo de colores por prioridad (sin tocar)
  const priorityBg = (p: string | null) => {
    if (p === "baja") return { bgcolor: "success.light", color: "success.contrastText" };
    if (p === "media") return { bgcolor: "warning.light", color: "warning.contrastText" };
    if (p === "alta") return { bgcolor: "error.light", color: "error.contrastText" };
    // default (sin seleccionar)
    return { bgcolor: "background.paper", color: "text.primary" };
  };

  // colores exclusivos para las otras tarjetas (no se repiten con success/warning/error)
  const efectorStyle = { bgcolor: "primary.light", color: "primary.contrastText" }; // azul claro
  const pacienteStyle = { bgcolor: "info.light", color: "info.contrastText" }; // cian distinto
  const profesionalStyle = { bgcolor: "#8b5cf6", color: "common.white" }; // violeta personalizado
  const especialidadStyle = { bgcolor: "#cf7302ff", color: "common.white" }; // naranja con texto blanco

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto", position: "relative" }}>
      {/* Header: título + botón volver a la derecha */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h5">Agregar a espera</Typography>
      </Box>

      {/* Tarjeta Efector actual (color exclusivo) */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, ...efectorStyle }}>
        <Typography variant="h6">Efector actual</Typography>
        <Typography variant="body2">
          {loadingEfector ? (
            <CircularProgress size={14} sx={{ ml: 1 }} />
          ) : efector ? (
            <strong>{efector.nombre ?? `#${efector.id}`}</strong>
          ) : efectorId ? (
            <em>Efector {efectorId} (no encontrado)</em>
          ) : (
            <em>(no seleccionado)</em>
          )}
        </Typography>
        {errorEfector && (
          <Typography variant="caption" color="error">
            {errorEfector}
          </Typography>
        )}
      </Paper>

      <Divider sx={{ mb: 2 }} />

      {/* Selección de paciente */}
      {!finishPaciente ? (
        <LookPaciente
          paciente={paciente}
          setPaciente={setPaciente}
          setFinishPaciente={setFinishPaciente}
        />
      ) : (
        <Paper elevation={2} sx={{ p: 2, mb: 2, position: "relative", ...pacienteStyle }}>
          <IconButton
            size="small"
            onClick={resetPaciente}
            sx={{ position: "absolute", top: 8, right: 8 }}
            aria-label="Eliminar paciente"
          >
            <CloseIcon />
          </IconButton>

          <Typography variant="h6">Paciente</Typography>
          <Typography>
            {paciente
              ? `${paciente.apellido ?? "-"}, ${paciente.nombre ?? "-"}`
              : "(ninguno)"}
          </Typography>
        </Paper>
      )}

      {/* Selección de profesional */}
      {!finishProfesional && finishPaciente ? (
        <LookProfesional
          efectorId={efectorId}
          selectedProfesional={profesional}
          setProfesional={setProfesional}
          setFinishProfesional={setFinishProfesional}
        />
      ) : (
        finishProfesional && (
          <Paper elevation={2} sx={{ p: 2, mb: 2, position: "relative", ...profesionalStyle }}>
            <IconButton
              size="small"
              onClick={resetProfesional}
              sx={{ position: "absolute", top: 8, right: 8, color: "common.white" }}
              aria-label="Eliminar profesional"
            >
              <CloseIcon />
            </IconButton>

            <Typography variant="h6">Profesional que deriva</Typography>
            <Typography>
              {profesional
                ? `${profesional.apellido ?? "-"}, ${profesional.nombre ?? "-"}`
                : "(ninguno)"}
            </Typography>
          </Paper>
        )
      )}

      {/* Selección de especialidad/servicio */}
      {!finishEfeSerEsp && finishProfesional ? (
        <LookEfeSerEsp
          setEfeSerEspSeleccionado={setEfeSerEspSeleccionado}
          setFinishEfeSerEsp={setFinishEfeSerEsp}
        />
      ) : (
        finishEfeSerEsp && (
          <Paper elevation={2} sx={{ p: 2, mb: 2, position: "relative", ...especialidadStyle }}>
            <IconButton
              size="small"
              onClick={resetEfeSerEsp}
              sx={{ position: "absolute", top: 8, right: 8 }}
              aria-label="Eliminar especialidad"
            >
              <CloseIcon />
            </IconButton>

            <Typography variant="h6">Especialidad / Servicio</Typography>
            <Stack spacing={0.5}>
              <Typography>
                <strong>Efector:</strong>{" "}
                {efeSerEspSeleccionado?.efector?.nombre ?? "(ninguno)"}
              </Typography>
              <Typography>
                <strong>Servicio:</strong>{" "}
                {efeSerEspSeleccionado?.servicio?.nombre ?? "(ninguno)"}
              </Typography>
              <Typography>
                <strong>Especialidad:</strong>{" "}
                {efeSerEspSeleccionado?.especialidad?.nombre ?? "(ninguno)"}
              </Typography>
            </Stack>
          </Paper>
        )
      )}

      <Divider sx={{ my: 2 }} />

      {/* -- PRIORIDAD: Sólo se muestra si canSelectPriority === true -- */}
      {canSelectPriority && (
        <Paper elevation={2} sx={{ p: 2, mb: 2, position: "relative", ...priorityBg(priority) }}>
          <Typography variant="h6">Prioridad</Typography>

          <FormControl component="fieldset" sx={{ mt: 1 }}>
            <FormLabel component="legend" sx={{ mb: 1 }}>
              Seleccione prioridad
            </FormLabel>
            <RadioGroup
              row
              aria-label="prioridad"
              name="prioridad"
              value={priority ?? ""}
              onChange={handlePriorityChange}
            >
              <FormControlLabel value="baja" control={<Radio />} label="Baja" />
              <FormControlLabel value="media" control={<Radio />} label="Media" />
              <FormControlLabel value="alta" control={<Radio />} label="Alta" />
            </RadioGroup>
          </FormControl>

          {priority && (
            <Typography sx={{ mt: 1 }}>
              Prioridad seleccionada: <strong>{priority.toUpperCase()}</strong>
            </Typography>
          )}
        </Paper>
      )}

      {/* Botón Confirmar: solo si canSelectPriority y se completó prioridad */}
      {canSelectPriority && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 1 }}>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={!canConfirm || submitting} // se bloquea mientras submitting === true
            aria-disabled={!canConfirm || submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            {submitting ? "Enviando..." : "Confirmar"}
          </Button>
        </Box>
      )}

      {/* Snackbar / Alert global */}
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
