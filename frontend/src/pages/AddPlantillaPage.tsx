import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Stack,
  Typography,
  Chip,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
// Ajusta estas importaciones según tu API real

const EMOJIS = ["✅", "⏰", "❗", "📍", "📞", "✉️", "🔔", "👍"];

const PLACEHOLDERS = [
  "nompac",
  "apepac",
  "fecha",
  "horaturno",
  "nomprof",
  "apeprof",
  "especialidad",
  "efector",
  "nombre_servicio",
  "calle",
  "altura",
  "letra",
  "coordx",
  "coordy",
  "tel_efe",
  "calle_nom",
];

const AddPlantillaPage: React.FC = () => {
  const { id_tipo } = useParams<{ id_tipo: string }>();
  const navigate = useNavigate();

  const tipoToIdKey: Record<string, number> = {
    "confirmacion": 1,
    "cancelacion": 2,
    "reprogramacion": 3,
    "recordatorio": 4,
  };

  // plantilla.id_tipo desde la URL (si viene como string)
  const plantillaTipo =  id_tipo ? tipoToIdKey[id_tipo] : "confirmacion"

  const [contenido, setContenido] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // enfocamos el textarea al montar
    textareaRef.current?.focus();
  }, []);

  const insertAtCursor = (valueToInsert: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      // fallback: append
      setContenido((prev) => prev + valueToInsert);
      return;
    }

    const start = ta.selectionStart ?? contenido.length;
    const end = ta.selectionEnd ?? contenido.length;

    const before = contenido.slice(0, start);
    const after = contenido.slice(end);
    const newText = before + valueToInsert + after;

    setContenido(newText);

    // update cursor position after insertion (use timeout to wait state update)
    requestAnimationFrame(() => {
      const pos = start + valueToInsert.length;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos;
    });
  };

  const handleEmojiClick = (emoji: string) => {
    insertAtCursor(emoji);
  };

  const handlePlaceholderClick = (ph: string) => {
    insertAtCursor(`{${ph}}`);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setContenido(e.target.value);
  };

  const handleSave = async () => {
    if (!contenido.trim()) {
      setSnack({ open: true, message: "El contenido no puede estar vacío.", severity: "error" });
      return;
    }

    setSaving(true);
    try {
      // Ajustar payload según tu API
      const payload: any = {
        contenido: contenido.trim(),
      };
      if (plantillaTipo != null) payload.id_tipo = plantillaTipo;

      //await createPlantilla(payload);

      setSnack({ open: true, message: "Plantilla creada correctamente.", severity: "success" });
      setTimeout(() => navigate("/plantillas"), 800);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: "Error al crear la plantilla.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h6">Nueva plantilla</Typography>
        {plantillaTipo != null && <Chip label={`id_tipo: ${plantillaTipo}`} color="primary" />}
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Escriba el contenido de la plantilla. Puede insertar emojis o campos entre llaves presionando los botones.
      </Typography>

      <TextField
        inputRef={textareaRef}
        value={contenido}
        onChange={handleChange}
        multiline
        minRows={8}
        fullWidth
        placeholder="Escriba aquí la plantilla..."
        sx={{ mb: 2 }}
      />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Emojis rápidos
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {EMOJIS.map((em) => (
            <Button key={em} size="small" onClick={() => handleEmojiClick(em)}>
              {em}
            </Button>
          ))}
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Campos (se insertan entre llaves)
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {PLACEHOLDERS.map((ph) => (
            <Button key={ph} size="small" variant="outlined" onClick={() => handlePlaceholderClick(ph)} sx={{ mb: 1 }}>
              {`{${ph}}`}
            </Button>
          ))}
        </Stack>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          Guardar
        </Button>
        <Button variant="outlined" onClick={() => navigate(-1)} disabled={saving}>
          Cancelar
        </Button>
      </Box>

      <Snackbar
        open={!!snack?.open}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack && (
          <Alert onClose={() => setSnack(null)} severity={snack.severity} sx={{ width: "100%" }}>
            {snack.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default AddPlantillaPage;
