import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { getPlantillas, getPlantillaByTipo } from "../features/plantilla/api";
import type { Plantilla } from "../features/plantilla/types";
import { updateEfectorPlantilla } from "../features/turno/api";
import { useLocation, useParams, useNavigate } from "react-router-dom";

type StateShape = {
  especialidades?: number[]; // <-- siempre IDs
  efectorId?: number;
  field?: string;
};

const tipoToId: Record<string, number> = {
  confirmacion: 1,
  cancelacion: 2,
  reprogramacion: 3,
  recordatorio: 4,
};

const idToTipoKey: Record<number, string> = {
  1: "confirmacion",
  2: "cancelacion",
  3: "reprogramacion",
  4: "recordatorio",
};

const tipoToCampo: Record<string, string> = {
  confirmacion: "plantilla_conf",
  cancelacion: "plantilla_canc",
  reprogramacion: "plantilla_repr",
  recordatorio: "plantilla_reco",
};

const tipoToLabel: Record<string, string> = {
  confirmacion: "Confirmación",
  reprogramacion: "Reprogramación",
  cancelacion: "Cancelación",
  recordatorio: "Recordatorio",
};

const tipoToColor: Record<string, string> = {
  confirmacion: "#4caf50", // verde
  reprogramacion: "#1976d2", // azul
  cancelacion: "#e53935", // rojo
  recordatorio: "#fbc02d", // amarillo
};

const Plantillas: React.FC = () => {
  const location = useLocation();
  const state = (location.state as StateShape) ?? {};
  const especialidadesIds = state.especialidades ?? [];

  const { tipo } = useParams<{ tipo?: string }>();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [diasAntes, setDiasAntes] = useState("");

  const navigate = useNavigate();
  const isModificationMode = Boolean(tipo) && especialidadesIds.length > 0;

  useEffect(() => {
    const fetchPlantillas = async () => {
      setLoading(true);
      try {
        let data: Plantilla[] = [];

        if (tipo) {
          const id = tipoToId[tipo] ?? 4;
          data = await getPlantillaByTipo(id);
        } else {
          data = await getPlantillas();
        }

        setPlantillas(data);
      } catch (err) {
        console.error("Error cargando plantillas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlantillas();
  }, [tipo]);

 const groupByType = () => {
    const groups: Record<string, Plantilla[]> = {
      confirmacion: [],
      reprogramacion: [],
      cancelacion: [],
      recordatorio: [],
    };

    plantillas.forEach((p: any) => {
      const key = p.id_tipo

      // normalizamos posibles valores
      const normalized = idToTipoKey[key];
      if (!groups[normalized]) groups[normalized] = [];
      groups[normalized].push(p);
    });

    return groups;
  };

  const handleCardAssign = async (plantillaId: number) => {
    if (!tipo || especialidadesIds.length === 0) {
      alert("No está en modo de modificación o no hay especialidades seleccionadas.");
      return;
    }

    if (tipo === "recordatorio" && (!diasAntes || isNaN(Number(diasAntes)))) {
      alert("Por favor ingrese un número válido de días antes.");
      return;
    }

    const campo = tipoToCampo[tipo] ?? "plantilla_reco";

    const payload: Record<string, any> = {
      [tipo]: 1,
      [campo]: plantillaId,
    };

    if (tipo === "recordatorio") {
      const dias = Number(diasAntes);
      if (isNaN(dias) || dias < 0 || dias > 5) {
        alert("Por favor ingrese un número entre 0 y 5.");
        return;
      }
      payload["dias_antes"] = dias;
    }

    setUpdating(true);
    try {
      await Promise.all(especialidadesIds.map((id) => updateEfectorPlantilla(id, payload)));
      navigate("/list");
    } catch (error) {
      console.error("Error actualizando plantilla:", error);
      alert("Ocurrió un error al actualizar. Revise la consola.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNewPlantilla = (t: string) => {
    navigate(`/plantillas/nueva/${t}`);
  };

  if (loading) return <Typography>Cargando plantillas...</Typography>;
  if (plantillas.length === 0) return <Typography>No hay plantillas disponibles</Typography>;

  const grouped = groupByType();
  const tipoKeys = Object.keys(tipoToLabel);

  return (
    <Box sx={{ p: 3 }}>
      {isModificationMode ? (
        <>
          {tipo === "recordatorio" && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Ingrese los días antes del turno para enviar recordatorio:
              </Typography>
              <TextField
                type="number"
                label="Días antes"
                value={diasAntes}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (Number(val) >= 0 && Number(val) <= 5)) {
                    setDiasAntes(val);
                  }
                }}
                size="small"
                sx={{ width: 150 }}
                inputProps={{ min: 0, max: 5 }}
              />
            </Box>
          )}

          <Grid container spacing={2}>
            {plantillas.map((plantilla) => (
              <Grid item xs={12} sm={6} md={4} key={plantilla.id}>
                <Card
                  sx={{
                    borderRadius: 3,
                    border: "2px solid rgba(0,0,0,0.12)",
                    boxShadow: 3,
                    display: "flex",
                    p: 2,
                    minHeight: 230,
                    maxWidth: 320,
                    cursor: updating ? "default" : "pointer",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    transition: "transform 0.2s",
                    "&:hover": updating ? {} : { transform: "scale(1.02)", boxShadow: 6 },
                    opacity: updating ? 0.7 : 1,
                    flexDirection: "column",
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                      {plantilla.contenido}
                    </Typography>
                  </CardContent>

                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", p: 2 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => !updating && handleCardAssign(plantilla.id)}
                      disabled={updating}
                    >
                      Asignar
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      ) : (
        <>

          <Grid container spacing={2}>
            {tipoKeys.map((t) => {
              const items = grouped[t] ?? [];

              return (
                <Grid item xs={12} sm={6} md={3} key={t}>
                  <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Chip
                      label={tipoToLabel[t]}
                      sx={{
                        backgroundColor: tipoToColor[t],
                        color: t === "recordatorio" ? "rgba(0,0,0,0.87)" : "#fff",
                        fontWeight: 700,
                        fontSize: 14,
                        px: 2,
                      }}
                    />

                  </Box>

                  <Grid container spacing={2}>
                    {items.length === 0 ? (
                      <Grid item xs={12}>
                        <Typography variant="body2">No hay plantillas para {tipoToLabel[t]}</Typography>
                      </Grid>
                    ) : (
                      items.map((plantilla: any) => (
                        <Grid item xs={12} key={plantilla.id || plantilla.id_msj}>
                          <Card
                            sx={{
                              borderRadius: 3,
                              border: "2px solid rgba(0,0,0,0.12)",
                              boxShadow: 3,
                              display: "flex",
                              p: 2,
                              minHeight: 120,
                              justifyContent: "center",
                              alignItems: "center",
                              transition: "transform 0.2s",
                              "&:hover": { transform: "scale(1.02)", boxShadow: 6 },
                              flexDirection: "column",
                            }}
                          >
                            <CardContent>
                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                                {plantilla.contenido}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))
                    )}
                  </Grid>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Plantillas;
