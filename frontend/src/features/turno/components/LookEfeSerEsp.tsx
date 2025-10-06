import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";

import {
  getServiciosAll,
  getEspecialidadesByServicio,
  getEfectoresByServEsp,
  getIdByEfeSerEsp, // <-- asegúrate de exportarla desde tu api
} from "../../efe_ser_esp/api";

import type { Efector, Servicio, Especialidad, EfeSerEspCompleto } from "../../efe_ser_esp/types";

interface Props {
  setEfeSerEspSeleccionado: React.Dispatch<React.SetStateAction<EfeSerEspCompleto | null>>;
  setFinishEfeSerEsp: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function LookEfeSerEsp({ setEfeSerEspSeleccionado, setFinishEfeSerEsp }: Props) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [selectedEspecialidad, setSelectedEspecialidad] = useState<Especialidad | null>(null);

  const [efectores, setEfectores] = useState<Efector[]>([]);
  const [selectedEfector, setSelectedEfector] = useState<Efector | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // para la llamada de confirm
  const [loadingServicios, setLoadingServicios] = useState(false);

  useEffect(() => {
    setLoadingServicios(true);
    getServiciosAll()
      .then(setServicios)
      .catch(() => setError("Error al cargar servicios"))
      .finally(() => setLoadingServicios(false));
  }, []);

  useEffect(() => {
    if (!selectedServicio) {
      setEspecialidades([]);
      setSelectedEspecialidad(null);
      return;
    }
    getEspecialidadesByServicio(selectedServicio.id)
      .then(setEspecialidades)
      .catch(() => setError("Error al cargar especialidades"));
    setSelectedEfector(null);
  }, [selectedServicio]);

  useEffect(() => {
    if (!selectedServicio || !selectedEspecialidad) {
      setEfectores([]);
      setSelectedEfector(null);
      return;
    }
    setSelectedEfector(null);
    getEfectoresByServEsp(selectedServicio.id, selectedEspecialidad.id)
      .then(setEfectores)
      .catch(() => setError("Error al cargar efectores"));
  }, [selectedServicio, selectedEspecialidad]);

  const handleConfirm = async () => {
    setError(null);

    if (!selectedEfector || !selectedServicio || !selectedEspecialidad) {
      setError("Faltan seleccionar efector/servicio/especialidad.");
      return;
    }

    setLoading(true);
    try {
      // llamada a la función que pediste
      const res = await getIdByEfeSerEsp(
        selectedEfector.id,
        selectedServicio.id,
        selectedEspecialidad.id
      );
      // setear el resultado en el padre y marcar finish
      setEfeSerEspSeleccionado(res);
      setFinishEfeSerEsp(true);
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data ?? e?.message ?? "Error al obtener EfeSerEsp.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedEfector(null);
    setEfeSerEspSeleccionado(null);
    setFinishEfeSerEsp(false);
    setError(null);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 1 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Seleccionar servicio / especialidad / efector
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel id="servicio-label">Servicio</InputLabel>
        <Select
          labelId="servicio-label"
          value={selectedServicio?.id ?? ""}
          label="Servicio"
          onChange={(e) => {
            const id = Number(e.target.value);
            const srv = servicios.find((s) => s.id === id) ?? null;
            setSelectedServicio(srv);
          }}
        >
          <MenuItem value="">
            <em>-- Seleccioná servicio --</em>
          </MenuItem>
          {servicios.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!selectedServicio}>
        <InputLabel id="especialidad-label">Especialidad</InputLabel>
        <Select
          labelId="especialidad-label"
          value={selectedEspecialidad?.id ?? ""}
          label="Especialidad"
          onChange={(e) => {
            const id = Number(e.target.value);
            const esp = especialidades.find((x) => x.id === id) ?? null;
            setSelectedEspecialidad(esp);
          }}
        >
          <MenuItem value="">
            <em>-- Seleccioná especialidad --</em>
          </MenuItem>
          {especialidades.map((esp) => (
            <MenuItem key={esp.id} value={esp.id}>
              {esp.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!selectedEspecialidad}>
        <InputLabel id="efector-label">Efector</InputLabel>
        <Select
          labelId="efector-label"
          value={selectedEfector?.id ?? ""}
          label="Efector"
          onChange={(e) => {
            const id = Number(e.target.value);
            const ef = efectores.find((x) => x.id === id) ?? null;
            setSelectedEfector(ef);
          }}
        >
          <MenuItem value="">
            <em>-- Seleccioná efector --</em>
          </MenuItem>
          {efectores.map((ef) => (
            <MenuItem key={ef.id} value={ef.id}>
              {ef.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* cuadro de confirmar / limpiar */}
      {selectedEfector && (
        <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
          <Typography variant="subtitle2">Efector seleccionado</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedEfector.nombre}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={loading || !selectedServicio || !selectedEspecialidad}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : "Confirmar"}
            </Button>

            <Button variant="outlined" onClick={handleClear} disabled={loading}>
              Limpiar
            </Button>
          </Stack>
        </Paper>
      )}

      {/* errores generales */}
      {error && !selectedEfector && (
        <Paper variant="outlined" sx={{ p: 1, mt: 1 }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
