import  { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  List,
  ListItem,
  ListItemText,
  Alert,
  Stack,
} from "@mui/material";
import type { Paciente } from "../../persona/types";
import { getPacienteByDNI } from "../../persona/api";

interface LookPacienteProps {
  paciente: Paciente | null;
  setPaciente: (p: Paciente | null) => void;
  setFinishPaciente: useState<boolean>;
}

function LookPaciente({ paciente, setPaciente,  setFinishPaciente }: LookPacienteProps) {
  const [dni, setDni] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [selectedPacienteId, setSelectedPacienteId] = useState<number | string | null>(null);

  useEffect(() => {
    // si el padre ya pasó un paciente, sincronizamos la selección
    if (paciente) {
      setSelectedPacienteId(String(paciente.id));
    }
  }, [paciente]);

  const handleBuscar = async () => {
    setError(null);
    setPacientes([]);
    setSelectedPacienteId(null);

    const doc = dni?.toString().trim();
    if (!doc) {
      setError("Ingresá un DNI válido.");
      return;
    }

    setLoading(true);
    try {
      const data = await getPacienteByDNI(doc);
      const list = Array.isArray(data) ? data : data ? [data] : [];
      if (list.length === 0) {
        setError("No se encontraron pacientes para ese DNI.");
      }
      setPacientes(list);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ??
        e?.response?.data ??
        e?.message ??
        "Error al consultar pacientes.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPaciente = (id: number | string) => {
    setSelectedPacienteId(id);
    const p = pacientes.find((x) => String(x.id) === String(id)) ?? null;
    setPaciente(p); // actualizo el paciente en el padre cuando se selecciona
  };

  const pacienteSeleccionado = pacientes.find((p) => String(p.id) === String(selectedPacienteId)) ?? paciente ?? null;

  const getPhoneAlert = () => {
    if (!pacienteSeleccionado) return null;

    const carac = pacienteSeleccionado.carac_telef;
    const nro = pacienteSeleccionado.nro_telef;

    const caracLen = carac?.length;
    const nroLen = nro?.length;

    if ((carac === undefined || carac === null || carac === "") && (nro === undefined || nro === null || nro === "")) {
      return <Alert severity="info">El paciente no tiene teléfono registrado.</Alert>;
    }

    if (caracLen === 3 && nroLen === 7) {
      return <Alert severity="success">Teléfono válido: {carac} - {nro}</Alert>;
    }

    const messages: string[] = [];
    if (caracLen !== 3) messages.push("Característica inválida");
    if (nroLen !== 7) messages.push("Número inválido");

    return <Alert severity="warning">{messages.join(". ")}</Alert>;
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      {/* Ingresar DNI y Buscar */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField
          label="DNI"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ flex: 1 }}
        />
        <Button variant="contained" onClick={handleBuscar} disabled={loading}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Buscar"}
        </Button>
      </Box>

      {/* Mensajes de error */}
      <Box sx={{ mb: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
      </Box>

      {/* Resultados: mostrar TODOS los datos que trajo la respuesta y permitir seleccionar uno */}
      <Box sx={{ mb: 2 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && pacientes.length === 0 && !error && (
          <Typography variant="body2" color="text.secondary">
            Ingresá DNI y presioná Buscar para ver los pacientes.
          </Typography>
        )}

        {!loading && pacientes.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1 }}>
            <RadioGroup value={String(selectedPacienteId ?? "")} onChange={(e) => handleSelectPaciente(e.target.value)}>
              <List disablePadding>
                {pacientes.map((p) => (
                  <ListItem
                    key={p.id}
                    alignItems="flex-start"
                    secondaryAction={
                      <FormControlLabel
                        value={String(p.id)}
                        control={<Radio />}
                        label=""
                        sx={{ mr: 0 }}
                      />
                    }
                    sx={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
                          <Typography variant="subtitle2">
                            {p.apellido ?? "-"}, {p.nombre ?? "-"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            · DNI: {p.nro_doc ?? "-"}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2">Sexo: {p.sexo ?? "-"}</Typography>
                          <Typography variant="body2">Fecha Nacimiento: {p.fecha_nacimiento ? String(p.fecha_nacimiento) : "-"}</Typography>
                          <Typography variant="body2">Calle: {p.nombre_calle ?? "-"} · Altura: {p.numero_calle ?? "-"}</Typography>
                          <Typography variant="body2">Teléfono: {p.carac_telef ?? "-"} · {p.nro_telef ?? "-"}</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </RadioGroup>
          </Paper>
        )}
      </Box>

      {/* Resumen del seleccionado */}
      <Box sx={{ mt: 2 }}>
        {pacienteSeleccionado ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>{getPhoneAlert()}</Box>

            <Typography variant="h6">
              Seleccionado: {pacienteSeleccionado.apellido ?? "-"}, {pacienteSeleccionado.nombre ?? "-"}
            </Typography>
            <Typography variant="body2">DNI: {pacienteSeleccionado.nro_doc ?? "-"}</Typography>
            <Typography variant="body2">Sexo: {pacienteSeleccionado.sexo ?? "-"}</Typography>
            <Typography variant="body2">Fecha Nacimiento: {pacienteSeleccionado.fecha_nacimiento ? String(pacienteSeleccionado.fecha_nacimiento) : "-"}</Typography>
            <Typography variant="body2">Dirección: {pacienteSeleccionado.nombre_calle ?? "-"} {pacienteSeleccionado.numero_calle ?? ""}</Typography>

            {/* Botón confirmar: actualiza paciente en el padre (ya se hace al seleccionar) y marca finish */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  // asegura que el padre tenga el paciente seleccionado
                  setPaciente(pacienteSeleccionado);
                  setFinishPaciente(true);
                }}
              >
                Confirmar
              </Button>

              <Button
                variant="outlined"
                onClick={() => {
                  // permitir deseleccionar y limpiar
                  setSelectedPacienteId(null);
                  setPaciente(null);
                }}
              >
                Limpiar
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No hay paciente seleccionado.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default LookPaciente;
