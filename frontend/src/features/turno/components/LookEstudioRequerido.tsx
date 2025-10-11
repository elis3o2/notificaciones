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
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

import { getEstudioRequeridoAll } from "../api";
import type { EstudioRequerido } from "../types";

interface Props {
  estudioRequerido: EstudioRequerido[]; // seleccionados actualmente en el padre
  setEstudioRequerido: React.Dispatch<React.SetStateAction<EstudioRequerido[]>>;
  setFinishEstudioRequerido: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function LookEstudioRequerido({
  estudioRequerido,
  setEstudioRequerido,
  setFinishEstudioRequerido,
}: Props) {
  const [estudios, setEstudios] = useState<EstudioRequerido[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => estudioRequerido?.map((e) => String((e as any).id)) ?? []
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // búsqueda y filtro
  const [query, setQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "selected" | "not_selected">("all");

  // cargar todos los estudios al montar
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getEstudioRequeridoAll();
        if (!mounted) return;
        const list: EstudioRequerido[] = Array.isArray(data) ? data : data ? [data] : [];
        setEstudios(list);
        // si el padre trae seleccionados, sincronizamos selectedIds con eso
        setSelectedIds(estudioRequerido?.map((e) => String((e as any).id)) ?? []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // se carga solo al montar

  // Si el prop estudioRequerido cambia desde afuera, mantenemos sincronía local
  useEffect(() => {
    setSelectedIds(estudioRequerido?.map((e) => String((e as any).id)) ?? []);
  }, [estudioRequerido]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      // actualizamos el estado del padre con los objetos completos
      const selectedObjects = estudios.filter((s) => next.includes(String((s as any).id)));
      setEstudioRequerido(selectedObjects);
      // al cambiar selección, forzamos que el padre marque que NO está terminado
      setFinishEstudioRequerido(false);
      return next;
    });
  };

  const handleConfirm = () => {
    // guardamos selección (puede ser vacía)
    const selectedObjects = estudios.filter((s) => selectedIds.includes(String((s as any).id)));
    setEstudioRequerido(selectedObjects);
    // marcamos como finalizado (conforme a tu comportamiento anterior)
    setFinishEstudioRequerido(true);
  };

  const handleClear = () => {
    setSelectedIds([]);
    setEstudioRequerido([]);
    setFinishEstudioRequerido(false);
    setQuery("");
    setFilterMode("all");
  };

  // Filtrado por query y modo
  const normalized = (txt?: any) => String(txt ?? "").toLowerCase();
  const filteredEstudios = estudios.filter((e) => {
    const idStr = String((e as any).id);
    const primary = (e as any).nombre ?? (e as any).descripcion ?? "";
    const searchTarget = `${idStr} ${primary} ${(e as any).descripcion ?? ""}`.toLowerCase();
    if (query.trim()) {
      if (!searchTarget.includes(query.toLowerCase().trim())) return false;
    }
    if (filterMode === "selected") {
      return selectedIds.includes(idStr);
    } else if (filterMode === "not_selected") {
      return !selectedIds.includes(idStr);
    }
    return true;
  });

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
          <Button
            variant="outlined"
            onClick={handleClear}
            disabled={loading && estudios.length === 0}
          >
            Limpiar
          </Button>

          {/* búsqueda */}
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
                  <IconButton
                    aria-label="clear-search"
                    size="small"
                    onClick={() => setQuery("")}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{ minWidth: 320, ml: 1 }}
          />

          {/* filtro */}
          <Select
            size="small"
            value={filterMode}
            onChange={(ev) => setFilterMode(ev.target.value as any)}
            sx={{ minWidth: 160, ml: 1 }}
            aria-label="Filtro estudios"
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="selected">Seleccionados</MenuItem>
            <MenuItem value="not_selected">No seleccionados</MenuItem>
          </Select>
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
            {/* barra horizontal con chips (una única fila scrollable) */}
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
              {filteredEstudios.map((e) => {
                const idStr = String((e as any).id);
                const primary = (e as any).nombre ?? (e as any).descripcion ?? `Estudio ${idStr}`;
                const selected = selectedIds.includes(idStr);
                return (
                  <Chip
                    key={idStr}
                    label={primary}
                    onClick={() => toggleId(idStr)}
                    clickable
                    variant={selected ? "filled" : "outlined"}
                    size="medium"
                    sx={{ flex: "0 0 auto" }}
                    aria-pressed={selected}
                    aria-label={`estudio-${idStr}`}
                  />
                );
              })}

              {/* si el filtro deja vacío, mostrar indicación */}
              {filteredEstudios.length === 0 && (
                <Box sx={{ px: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    No se encontraron estudios con esos filtros.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* opcional: listado detallado debajo (para accesibilidad) */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Haz clic en un estudio para seleccionarlo/deseleccionarlo. Puedes confirmar aunque no
                haya ninguno seleccionado.
              </Typography>
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
