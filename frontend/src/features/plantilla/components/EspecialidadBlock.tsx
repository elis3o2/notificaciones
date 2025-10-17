// Especialidades.tsx
import React from "react";
import type { Servicio, Efector, Especialidad} from "../../efe_ser_esp/types";
import type { EfeSerEspPlantillaExtend } from "../types";
import {
  Box,
  Typography,
  Card,
  Stack,
  IconButton,
  Popper,
  Grow,
  Paper,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import CancelIcon from "@mui/icons-material/Cancel";
import NotificationsIcon from "@mui/icons-material/Notifications";
import Confirmacion from "./Confirmacion";
import SendAll from "./SendAll";
import type { Setter, AlertSeverity } from "../../../common/types";

type FieldName = "confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio";

type Props = {
  open: boolean;
  setOpen: Setter<boolean>;
  especialidades: EfeSerEspPlantillaExtend[]; // lista plana: cada entrada ya contiene id_efector, id_servicio, id_especialidad
  setEspecialidades: Setter<EfeSerEspPlantillaExtend[]>;
  efectorSeleccionado: Efector[]; // lista de efectores seleccionados
  servicioSeleccionado: Servicio[]; // lista de servicios seleccionados
  confirmEspecialidades: EfeSerEspPlantillaExtend[];
  setConfirmEspecialidades: Setter<EfeSerEspPlantillaExtend[]>;
  confirmField: FieldName;
  setConfirmField: Setter<FieldName>;
  confirmValue: 0 | 1;
  setConfirmValue: Setter<0 | 1>;
  efecServEspecialidades: Record<number, Record<number, EfeSerEspPlantillaExtend[]>>;
  setEfecServEspecialidades: Setter<Record<number, Record<number, EfeSerEspPlantillaExtend[]>>>;
  setAlertOpen: Setter<boolean>;
  setAlertMsg: Setter<string>;
  setAlertSeverity: Setter<AlertSeverity>;
};


const Especialidades = ({
  open,
  setOpen,
  especialidades,
  setEspecialidades,
  efectorSeleccionado,
  servicioSeleccionado,
  confirmEspecialidades,
  setConfirmEspecialidades,
  confirmField,
  setConfirmField,
  confirmValue,
  setConfirmValue,
  setEfecServEspecialidades,
  setAlertOpen,
  setAlertMsg,
  setAlertSeverity,
}: Props) => {
  const flagOn = (v: number) => v === 1;

  // popper hover state: guardamos el id de la entrada (EfectorPlantilla.id) y el field
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [hovered, setHovered] = React.useState<{ espId: number; field: FieldName } | null>(null);
  const openPopper = Boolean(anchorEl && hovered);
  // Actualiza cache por id_efector / id_servicio y marca el campo en la entrada concreta
  const updateCache = (esp: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => {
    const efId = esp.id_efector;
    const servId = esp.id_servicio;
    if (!efId || !servId) return;

    setEfecServEspecialidades(prev => {
      const prevEf = prev[efId] || {};
      const prevArr = prevEf[servId] || especialidades.filter(e => e .id_efector === efId &&  e.id_servicio === servId);
      const newArr = prevArr.map(e => (e.id === esp.id ? ({ ...e, [field]: value } as EfeSerEspPlantillaExtend) : e));

      return {
        ...prev,
        [efId]: {
          ...(prev[efId] || {}),
          [servId]: newArr,
        },
      };
    });
  };

  // Actualiza la lista visible (solo la entrada concreta)
  const updateEspecialidades = (esp: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => {
    setEspecialidades(prev => prev.map(e => (e.id === esp.id ? ({ ...e, [field]: value } as EfeSerEspPlantillaExtend) : e)));
  };

  const handleOnSuccess = (esp: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => {
    // Confirmacion llamará a esto por cada entrada afectada
    updateCache(esp, field, value);
    updateEspecialidades(esp, field, value);
  };

  const handleSectionClick = (esp: EfeSerEspPlantillaExtend, field: FieldName) => {
    // alternamos según el estado actual de esa entrada específica
    const current = (esp as any)[field];
    const desired: 0 | 1 = current === 1 ? 0 : 1;

    setConfirmField(field);
    setConfirmValue(desired);
    setConfirmEspecialidades([esp]); // aplicamos solo a la fila concreta (no a todas las repetidas)
    setOpen(true);
  };

  const allEspecialidadesToChange = async (): Promise<EfeSerEspPlantillaExtend[]> => {
    // SendAll trabaja por efector; devolvemos la lista plana tal como está
    return especialidades;
  };

  const handleConfirmClosed = () => {
    setConfirmEspecialidades([]);
    setOpen(false);
  };
  return (
    <>
      <Confirmacion
        onSuccess={handleOnSuccess}
        onClosed={handleConfirmClosed}
        open={open}
        setOpen={setOpen}
        field={confirmField}
        value={confirmValue}
        confirmEspecialidades={confirmEspecialidades}
        setAlertOpen={setAlertOpen}
        setAlertMsg={setAlertMsg}
        setAlertSeverity={setAlertSeverity}
      />

      <Box sx={{ mt: 4 }}>
        {especialidades.length === 0 ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No hay especialidades cargadas para este servicio.
            </Typography>
          </Box>
        ) : (
          <>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <SendAll
                  open={open}
                  setOpen={setOpen}
                  efectorSeleccionado={efectorSeleccionado}
                  preFunction={allEspecialidadesToChange}
                  setEspecialidades={setEspecialidades}
                  setEfectorEspecialidades={setEfecServEspecialidades}
                  confirmField={confirmField}
                  setConfirmField={setConfirmField}
                  confirmValue={confirmValue}
                  setConfirmValue={setConfirmValue}
                  confirmEspecialidades={confirmEspecialidades}
                  setConfirmEspecialidades={setConfirmEspecialidades}
                  setAlertOpen={setAlertOpen}
                  setAlertMsg={setAlertMsg}
                  setAlertSeverity={setAlertSeverity}
                />
              </Stack>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Box sx={{ width: "100%", maxWidth: 850, display: "flex", flexDirection: "column", gap: 2 }}>
                {especialidades.map((esp) => {
                  const nombreEspecialidad = esp.especialidad.nombre;
                  const nombreEfector = efectorSeleccionado.find(e=> e.id == esp.id_efector)?.nombre
                  const confirmOn = flagOn(esp.confirmacion);
                  const reproOn = flagOn(esp.reprogramacion);
                  const cancOn = flagOn(esp.cancelacion);
                  const recoOn = flagOn(esp.recordatorio);

                  // decide si mostramos el nombre del efector: solo si hay más de un efector seleccionado
                  const showEfectorName = (efectorSeleccionado?.length ?? 0) > 1 && !!nombreEfector;

                  return (
                    <Card
                      key={esp.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        borderRadius: 2,
                        boxShadow: 2,
                        overflow: "hidden",
                        border: "2px solid rgba(0,0,0,0.12)",
                        transition: "border-color 200ms, box-shadow 200ms",
                        "&:hover": { borderColor: "primary.main", boxShadow: 6 },
                        height: 56,
                        width: "100%",
                      }}
                    >
                      {/* Nombre + (efector) */}
                      <Box sx={{ display: "flex", alignItems: "center", pl: 2, pr: 1, flex: "0 0 35%", minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                          {nombreEspecialidad}
                          {showEfectorName && (
                            <Typography
                              component="span"
                              sx={{ fontSize: "1rem", fontWeight: 500, ml: 1, color: "text.secondary" }}
                            >
                              ({nombreEfector})
                            </Typography>
                          )}
                        </Typography>
                      </Box>

                      {/* Botones: aplican solo a esta entrada */}
                      <Box sx={{ display: "flex", alignItems: "stretch", flex: "0 0 65%", height: "100%" }}>
                        <IconButton
                          aria-label="confirmacion"
                          onClick={() => handleSectionClick(esp, "confirmacion")}
                          onMouseEnter={(e) => {
                            if (confirmOn) {
                              setAnchorEl(e.currentTarget as HTMLElement);
                              setHovered({ espId: esp.id, field: "confirmacion" });
                            }
                          }}
                          onMouseLeave={() => {
                            setAnchorEl(null);
                            setHovered(null);
                          }}
                          sx={{
                            flex: 1,
                            height: "100%",
                            minWidth: 0,
                            borderRadius: 0,
                            px: 0,
                            bgcolor: confirmOn ? "success.main" : "transparent",
                            color: confirmOn ? "success.contrastText" : "text.secondary",
                            "&:hover": { bgcolor: confirmOn ? "success.dark" : "action.hover" },
                          }}
                        >
                          <CheckCircleIcon fontSize="medium" />
                        </IconButton>

                        <IconButton
                          aria-label="reprogramacion"
                          onClick={() => handleSectionClick(esp, "reprogramacion")}
                          onMouseEnter={(e) => {
                            if (reproOn) {
                              setAnchorEl(e.currentTarget as HTMLElement);
                              setHovered({ espId: esp.id, field: "reprogramacion" });
                            }
                          }}
                          onMouseLeave={() => {
                            setAnchorEl(null);
                            setHovered(null);
                          }}
                          sx={{
                            flex: 1,
                            height: "100%",
                            minWidth: 0,
                            borderRadius: 0,
                            px: 0,
                            bgcolor: reproOn ? "primary.main" : "transparent",
                            color: reproOn ? "primary.contrastText" : "text.secondary",
                            "&:hover": { bgcolor: reproOn ? "primary.dark" : "action.hover" },
                          }}
                        >
                          <ReplayIcon fontSize="medium" />
                        </IconButton>

                        <IconButton
                          aria-label="cancelacion"
                          onClick={() => handleSectionClick(esp, "cancelacion")}
                          onMouseEnter={(e) => {
                            if (cancOn) {
                              setAnchorEl(e.currentTarget as HTMLElement);
                              setHovered({ espId: esp.id, field: "cancelacion" });
                            }
                          }}
                          onMouseLeave={() => {
                            setAnchorEl(null);
                            setHovered(null);
                          }}
                          sx={{
                            flex: 1,
                            height: "100%",
                            minWidth: 0,
                            borderRadius: 0,
                            px: 0,
                            bgcolor: cancOn ? "error.main" : "transparent",
                            color: cancOn ? "error.contrastText" : "text.secondary",
                            "&:hover": { bgcolor: cancOn ? "error.dark" : "action.hover" },
                          }}
                        >
                          <CancelIcon fontSize="medium" />
                        </IconButton>

                        {/* Último botón: recordatorio — con esquinas redondeadas y separador izquierdo para que se vea bien */}
                        <IconButton
                          aria-label="recordatorio"
                          onClick={() => handleSectionClick(esp, "recordatorio")}
                          onMouseEnter={(e) => {
                            if (recoOn) {
                              setAnchorEl(e.currentTarget as HTMLElement);
                              setHovered({ espId: esp.id, field: "recordatorio" });
                            }
                          }}
                          onMouseLeave={() => {
                            setAnchorEl(null);
                            setHovered(null);
                          }}
                          sx={{
                            flex: 1,
                            height: "100%",
                            minWidth: 0,
                            borderRadius: 0,
                            px: 0,
                            // redondeo derecho para coincidir con la tarjeta
                            // pequeño separador para que la esquina sea visible cuando el botón tiene fondo
                            borderLeft: "1px solid rgba(0,0,0,0.04)",
                            bgcolor: recoOn ? "warning.main" : "transparent",
                            color: recoOn ? "warning.contrastText" : "text.secondary",
                            "&:hover": { bgcolor: recoOn ? "warning.dark" : "action.hover" },
                          }}
                        >
                          <NotificationsIcon fontSize="medium"  />
                        </IconButton>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Popper: mostramos la plantilla de la entrada específica (representante = esa entrada) */}
      <Popper
        open={openPopper}
        anchorEl={anchorEl}
        placement="top"
        transition
        disablePortal
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: "center bottom" }}>
            <Paper
              elevation={3}
              onMouseEnter={() => {}}
              onMouseLeave={() => {
                setAnchorEl(null);
                setHovered(null);
              }}
              sx={{ p: 1, maxWidth: 420, bgcolor: "background.paper", borderRadius: 1, boxShadow: 3 }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {(() => {
                  if (!hovered) return "";
                  const rep = especialidades.find(e => e.id === hovered.espId) as any;
                  if (!rep) return "";

                  if (hovered.field === "confirmacion") {
                    return rep.plantilla_conf?.contenido ?? "No hay plantilla configurada";
                  }
                  if (hovered.field === "recordatorio") {
                    const dias = rep.dias_antes ?? "—";
                    const contenido = rep.plantilla_reco?.contenido ?? "No hay plantilla configurada";
                    return `Días antes: ${dias}\n\n${contenido}`;
                  }
                  if (hovered.field === "cancelacion") {
                    return rep.plantilla_canc?.contenido ?? "No hay plantilla configurada";
                  }
                  if (hovered.field === "reprogramacion") {
                    return rep.plantilla_repr?.contenido ?? "No hay plantilla configurada";
                  }
                  return "";
                })()}
              </Typography>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
};

export default Especialidades;
