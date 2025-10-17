import  { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  RadioGroup,
  Radio,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Alert,
  Stack,
} from "@mui/material";

import { getProfesionalByEfector } from "../../persona/api";
import type { Profesional } from "../../persona/types";

interface Props {
  efectorId: number;
  selectedProfesional: Profesional | null;
  setProfesional: (p: Profesional | null) => void;
  setFinishProfesional: React.Dispatch<React.SetStateAction<boolean>>;

}

export default function LookProfesional({
  efectorId,
  selectedProfesional,
  setProfesional,
  setFinishProfesional,
}: Props) {
  const [nombre, setNombre] = useState<string>("");
  const [apellido, setApellido] = useState<string>("");

  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleBuscar = async () => {
    if (!efectorId) {
      setError("Debes seleccionar un efector primero.");
      return;
    }
    setError(null);
    setProfesionales([]);
    setProfesional(null);
    setSelectedProfesionalId("");
    setFinishProfesional(false);
    setLoading(true);

    try {
      const data = await getProfesionalByEfector(
        efectorId,
        nombre || null,
        apellido || null
      );
      const list: Profesional[] = Array.isArray(data) ? data : data ? [data] : [];
      if (list.length === 0) {
        setError("No se encontraron profesionales.");
      }
      setProfesionales(list);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ??
        e?.response?.data ??
        e?.message ??
        "Error al consultar profesionales.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleRadioChange = (val: string) => {
    setSelectedProfesionalId(val);
    const prof = profesionales.find((p) => String(p.id) === String(val)) ?? null;
    setProfesional(prof);
    // al seleccionar, reseteamos finish para obligar reconfirmación
    setFinishProfesional(false);
  };

  const handleConfirm = () => {
    // si el padre ya tiene el profesional, confirmamos. Si no, tratamos de asignarlo desde el id.
    if (!selectedProfesional && selectedProfesionalId) {
      const prof = profesionales.find((p) => String(p.id) === String(selectedProfesionalId)) ?? null;
      setProfesional(prof);
    }
    setFinishProfesional(true);
  };

  const handleClear = () => {
    setSelectedProfesionalId("");
    setProfesionales((prev) => prev); // mantenemos la lista
    setProfesional(null);
    setFinishProfesional(false);
  };

  const profesionalSeleccionado =
    profesionales.find((p) => String(p.id) === String(selectedProfesionalId)) ?? selectedProfesional ?? null;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 1 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Buscar profesional que deriva
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <TextField
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Apellido"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          size="small"
          fullWidth
        />
      </Box>

      <Button
        variant="contained"
        onClick={handleBuscar}
        disabled={loading || !efectorId}
        sx={{ mb: 2 }}
      >
        {loading ? <CircularProgress size={20} color="inherit" /> : "Buscar"}
      </Button>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {!loading && profesionales.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
          <RadioGroup
            value={selectedProfesionalId}
            onChange={(e) => handleRadioChange(e.target.value)}
          >
            <List disablePadding>
              {profesionales.map((p) => (
                <ListItem
                  key={p.id}
                  secondaryAction={
                    <FormControlLabel
                      value={String(p.id)}
                      control={<Radio />}
                      label=""
                    />
                  }
                  sx={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <ListItemText primary={`${p.apellido}, ${p.nombre}`} />
                </ListItem>
              ))}
            </List>
          </RadioGroup>
        </Paper>
      )}

      {profesionalSeleccionado && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">
            Seleccionado: {profesionalSeleccionado.apellido}, {profesionalSeleccionado.nombre}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={!profesionalSeleccionado}
            >
              Confirmar
            </Button>

            <Button variant="outlined" onClick={handleClear}>
              Limpiar
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
