import type { Servicio, Efector, Especialidad } from "../../efe_ser_esp/types";
import type { EfeSerEspPlantillaExtend } from "../types";
import type { EfeSerEspPlantilla } from "../types";
import { getPlantillaByEfectorServicio } from "../api";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Collapse,
  Stack,
} from "@mui/material";
import type { Setter, AlertSeverity } from "../../../common/types"; 
import SendAll from "./SendAll";

type Props = {
  efectorSeleccionado: Efector[];
  servicios: Servicio[];
  servicioSeleccionado: Servicio[];
  setServicioSeleccionado: Setter<Servicio[]>;
  especialidades: EfeSerEspPlantillaExtend[];
  setEspecialidades: Setter<EfeSerEspPlantillaExtend[]>;
  efecServEspecialidades: Record<number, Record<number, EfeSerEspPlantillaExtend[]>>;
  setEfecServEspecialidades: Setter<Record<number, Record<number, EfeSerEspPlantillaExtend[]>>>;
  servicioEfectorActual: Record<number, number[]>; // servicio_id -> [efector_id...]
  setServicioEfectorActual: Setter<Record<number, number[]>>;
  confirmField: "confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio";
  setConfirmField: Setter<"confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio">;
  confirmValue: 0 | 1;
  setConfirmValue: Setter<0 | 1>;
  confirmEspecialidades: EfeSerEspPlantillaExtend[];
  setConfirmEspecialidades: Setter<EfeSerEspPlantillaExtend[]>;
  setAlertOpen: Setter<boolean>;
  setAlertMsg: Setter<string>;
  setAlertSeverity: Setter<AlertSeverity>;
  open: boolean;
  setOpen: Setter<boolean>;
};

const Servicios = ({
  efectorSeleccionado,
  servicios,
  servicioSeleccionado,
  setServicioSeleccionado,
  especialidades,
  setEspecialidades,
  efecServEspecialidades,
  setEfecServEspecialidades,
  servicioEfectorActual,
  setServicioEfectorActual,
  confirmField,
  setConfirmField,
  confirmValue,
  setConfirmValue,
  confirmEspecialidades,
  setConfirmEspecialidades,
  setAlertOpen,
  setAlertMsg,
  setAlertSeverity,
  open,
  setOpen,
}: Props) => {
  // util: ids selected
  const selectedEfIds = new Set(efectorSeleccionado.map(e => e.id));

  /**
   * Devuelve todas las especialidades para las combinaciones (efectorSeleccionado x servicios)
   * Usa servicioEfectorActual para ser más eficiente y cache efecServEspecialidades.
   */
  const allEspecialidadesToChange = async (): Promise<EfeSerEspPlantillaExtend[]> => {
    if (efectorSeleccionado.length === 0 || servicios.length === 0) return [];

    const listaMap = new Map<number, EfeSerEspPlantillaExtend>();
    const missingCombos: Array<{ efId: number; servId: number }> = [];

    for (const serv of servicios) {
      const servId = serv.id;
      const mapped: number[] = servicioEfectorActual[servId] ?? [];
      const efIdsToCheck = mapped.filter(id => selectedEfIds.has(id));

      for (const efId of efIdsToCheck) {
        const cached = efecServEspecialidades?.[efId]?.[servId];
        if (cached && cached.length > 0) {
          for (const es of cached) listaMap.set(es.id, es);
        } else {
          missingCombos.push({ efId, servId });
        }
      }
    }

    if (missingCombos.length === 0) {
      return Array.from(listaMap.values());
    }

    const fetches = missingCombos.map(async ({ efId, servId }) => {
      try {
        const data = await getPlantillaByEfectorServicio(efId, servId);
        return { efId, servId, data, error: null as any };
      } catch (error) {
        return { efId, servId, data: [] as EfeSerEspPlantillaExtend[], error };
      }
    });

    const results = await Promise.all(fetches);

    // recolectar updates por efector y llenar listaMap
    const updatesByEf: Record<number, Record<number, EfeSerEspPlantillaExtend[]>> = {};
    const failed: Array<{ efId: number; servId: number; error: any }> = [];

    for (const r of results) {
      if (r.error) {
        failed.push({ efId: r.efId, servId: r.servId, error: r.error });
        continue;
      }
      for (const es of r.data) listaMap.set(es.id, es);

      updatesByEf[r.efId] = {
        ...(updatesByEf[r.efId] || {}),
        [r.servId]: r.data,
      };
    }

    // actualizar cache en bloque (si el setter existe)
    if (typeof setEfecServEspecialidades === "function" && Object.keys(updatesByEf).length > 0) {
      setEfecServEspecialidades(prev => {
        const next = { ...prev };
        for (const [efIdStr, svcMap] of Object.entries(updatesByEf)) {
          const efId = Number(efIdStr);
          next[efId] = {
            ...(next[efId] || {}),
            ...svcMap,
          };
        }
        return next;
      });
    } else if (Object.keys(updatesByEf).length > 0) {
      console.error("setEfecServEspecialidades no es función:", setEfecServEspecialidades);
    }

    if (failed.length > 0) {
      console.warn("Fallaron fetchs de especialidades:", failed);
      setAlertMsg(`No se pudieron cargar especialidades de ${failed.length} combinación(es).`);
      setAlertSeverity("warning");
      setAlertOpen(true);
    }

    return Array.from(listaMap.values());
  };

  /** CLICK SERVICIO → muestra especialidades (usa servicioEfectorActual y efecServEspecialidades) */
  const handleServicioClick = async (servicio: Servicio) => {
    if (efectorSeleccionado.length === 0) return;

    // toggle deselect: si ya estaba seleccionado lo removemos y ocultamos sus especialidades
    if (servicioSeleccionado.some(s => s.id === servicio.id)) {

      setEspecialidades(prev => prev.filter(es => es.id_servicio != servicio.id));
      setServicioSeleccionado(prev => prev.filter(s => s.id !== servicio.id));
      return;
    }

    const servId = servicio.id;

    // 1) obtener efectores asociados al servicio pero solo los seleccionados
    const efIdsForService: number[] = (servicioEfectorActual[servId] ?? []).filter(id => selectedEfIds.has(id));


    // 2) recopilar plantillas desde la cache y detectar faltantes
    const cachedPlantillas: EfeSerEspPlantillaExtend[] = [];
    const missingEfIds: number[] = [];

    for (const efId of efIdsForService) {
      const cachedAll = efecServEspecialidades?.[efId]?.[servId];
      if (cachedAll && cachedAll.length > 0) {
        cachedPlantillas.push(...cachedAll);
      } else {
        missingEfIds.push(efId);
      }
    }

    // 3) Si no hay faltantes usamos la cache y terminamos
    if (missingEfIds.length === 0) {
      // deduplicar plantillas por id
      const dedup = new Map<number, EfeSerEspPlantillaExtend>();
      for (const p of cachedPlantillas) dedup.set(p.id, p);

      // extraer especialidades deduplicadas
      const espMap = new Map<number, EfeSerEspPlantillaExtend>();
      for (const p of dedup.values()) espMap.set(p.especialidad.id, p);

      // combinar con prev (evitar duplicados)
      const prevMap = new Map<number, EfeSerEspPlantillaExtend>(especialidades.map(e => [e.id, e]));
      for (const [id, esp] of espMap) prevMap.set(id, esp);

      setEspecialidades(Array.from(prevMap.values()));
      setServicioSeleccionado(prev => [...prev, servicio]);
      return;
    }

    // 4) fetch solo para los effectores faltantes y luego actualizar cache
    try {
      const fetches = missingEfIds.map(async efId => {
        try {
          const data = await getPlantillaByEfectorServicio(efId, servId);
          return { efId, data, error: null as any };
        } catch (error) {
          return { efId, data: [] as EfeSerEspPlantillaExtend[], error };
        }
      });

      const results = await Promise.all(fetches);

      // actualizar cache por efector (inmutable) — protegemos con typeof
      if (typeof setEfecServEspecialidades === "function") {
        setEfecServEspecialidades(prev => {
          const next = { ...prev };
          for (const r of results) {
            next[r.efId] = {
              ...(next[r.efId] || {}),
              [servId]: r.data,
            };
          }
          return next;
        });
      } else {
        console.error("setEfecServEspecialidades no es función:", setEfecServEspecialidades);
      }

      // combinar cached + fetched, deduplicar por plantilla.id
      const combinedPlantillas = [
        ...cachedPlantillas,
        ...results.flatMap(r => r.data),
      ];
      const dedupPlantillas = new Map<number, EfeSerEspPlantillaExtend>();
      for (const p of combinedPlantillas) dedupPlantillas.set(p.id, p);

      // extraer Especialidad[] deduplicadas
      const espMap = new Map<number, EfeSerEspPlantillaExtend>();
      for (const p of dedupPlantillas.values()) espMap.set(p.especialidad.id, p);

      // combinar con prev (evitar duplicados)
      const prevMap = new Map<number, EfeSerEspPlantillaExtend>(especialidades.map(e => [e.id, e]));
      for (const [id, esp] of espMap) prevMap.set(id, esp);

      const nuevaLista = Array.from(prevMap.values());
      setEspecialidades(nuevaLista);
      setServicioSeleccionado(prev => [...prev, servicio]);

      if (nuevaLista.length === 0) {
        setAlertMsg("No se encontraron especialidades para este servicio.");
        setAlertSeverity("info");
        setAlertOpen(true);
      }
    } catch (err) {
      console.error("Error cargando especialidades por servicio:", err);
      setAlertMsg("No se pudieron cargar las especialidades");
      setAlertSeverity("error");
      setAlertOpen(true);
      setEspecialidades([]);
    }
  };

  return (
    <>
      <Collapse in={efectorSeleccionado.length > 0 && (servicios?.length ?? 0) > 0} timeout={300}>
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              Servicios
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <SendAll
                open={open}
                setOpen={setOpen}
                efectorSeleccionado={efectorSeleccionado}
                preFunction={allEspecialidadesToChange}
                setEspecialidades={setEspecialidades}
                // paso ambos nombres para compatibilidad con distintos hijos
                setEfecServEspecialidades={setEfecServEspecialidades}
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

          <Grid container spacing={2} sx={{ mt: 2 }}>
            {servicios.map((serv) => (
              <Grid item xs={12} sm={6} md={4} key={serv.id}>
                <Card
                  sx={{
                    p: 2,
                    borderRadius: 5,
                    textAlign: "center",
                    cursor: "pointer",
                    minHeight: 20,
                    maxHeight: 30,
                    minWidth: 150,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    boxShadow: 4,
                    border: "2px solid rgba(0,0,0,0.12)",
                    bgcolor: servicioSeleccionado.some(s => s.id === serv.id) ? "rgba(238, 200, 150, 1)" : "white",
                    transition: "background-color 200ms, border-color 200ms, box-shadow 200ms, transform 120ms",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: 6,
                      transform: "translateY(-4px)",
                    },
                    "&:active": {
                      transform: "translateY(-1px)",
                    },
                    ...(servicioSeleccionado.some(s => s.id === serv.id) && {
                      borderColor: "primary.main",
                      boxShadow: 6,
                      transform: "translateY(-4px)",
                    }),
                    "&:focus-visible": {
                      outline: "none",
                      borderColor: "primary.main",
                      boxShadow: "0 0 0 4px rgba(25,118,210,0.12)",
                    },
                  }}
                  onClick={() => handleServicioClick(serv)}
                >
                  <CardContent>
                    <Typography variant="body1" sx={{ fontWeight: 550 }}>
                      {serv.nombre}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </>
  );
};

export default Servicios;
