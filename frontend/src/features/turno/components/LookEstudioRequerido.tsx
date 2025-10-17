import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Alert,
  Stack,
  TextField,
  Chip,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

import { getEstudioRequeridoAll } from "../api";
import type { EstudioRequerido } from "../types";

interface Props {
  estudioRequerido: EstudioRequerido[];
  setEstudioRequerido: React.Dispatch<React.SetStateAction<EstudioRequerido[]>>;
  setFinishEstudioRequerido: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function LookEstudioRequerido({
  estudioRequerido,
  setEstudioRequerido,
  setFinishEstudioRequerido,
}: Props) {
  const [estudios, setEstudios] = useState<EstudioRequerido[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(
    () => estudioRequerido?.map((e) => e.id) ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getEstudioRequeridoAll();
        if (!mounted) return;
        setEstudios(data);
        setSelectedIds(estudioRequerido?.map((e) => e.id) ?? []);
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? e?.message ?? "Error al obtener estudios.";
        setError(String(msg));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => {
      mounted = false;
    };
  }, []); // solo al montar

  useEffect(() => {
    setSelectedIds(estudioRequerido?.map((e) => e.id) ?? []);
  }, [estudioRequerido]);

  const handleConfirm = () => {
    const selectedObjects = estudios.filter((s) => selectedIds.includes(s.id));
    setEstudioRequerido(selectedObjects);
    setFinishEstudioRequerido(true);
  };

  const handleClear = () => {
    setSelectedIds([]);
    setEstudioRequerido([]);
    setFinishEstudioRequerido(false);
    setQuery("");
  };

  // filtro simple
  const filtered = estudios.filter((e) =>
    [e.nombre,  e.id?.toString()]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 1 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Seleccionar estudios requeridos
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="contained" onClick={handleConfirm} disabled={loading}>
            Confirmar
          </Button>
          <Button variant="outlined" onClick={handleClear} disabled={loading || estudios.length === 0}>
            Limpiar
          </Button>

          <TextField
            size="small"
            placeholder="Buscar estudios por nombre, descr. o id..."
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton aria-label="clear-search" size="small" onClick={() => setQuery("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{ minWidth: 320, ml: 1 }}
          />
        </Stack>
      </Box>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress />
        </Box>
      ) : (
        estudios.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1 }}>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                overflowX: "auto",
                whiteSpace: "nowrap",
                py: 1,
                px: 0.5,
              }}
              role="list"
              aria-label="barra-estudios"
            >
              {filtered.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nombre}
                  color={selectedIds.includes(e.id) ? "primary" : "default"}
                  onClick={() =>
                    setSelectedIds((prev) =>
                      prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                    )
                  }
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Box>
          </Paper>
        )
      )}

      {!loading && estudios.length === 0 && !error && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info">No hay estudios disponibles.</Alert>
        </Box>
      )}
    </Box>
  );
}
