import type { Servicio, Efector, EfectorPlantillaExtend } from "../types";
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
import { getPlantillaByEfectorServicio } from "../api";
import SendAll from "./SendAll";

type Props = {
  efectorSeleccionado: Efector[];
  servicios: Servicio[];
  servicioSeleccionado: Servicio[];
  setServicioSeleccionado: Setter<Servicio[]>;
  especialidades: EfectorPlantillaExtend[];
  setEspecialidades: Setter<EfectorPlantillaExtend[]>;
  efectorEspecialidades: Record<number, Record<number, EfectorPlantillaExtend[]>>;
  setEfectorEspecialidades: Setter<Record<number, Record<number, EfectorPlantillaExtend[]>>>;
  servicioEfectorActual: Record<number, number[]>; // servicio_id -> [efector_id...]
  setServicioEfectorActual: Setter<Record<number, number[]>>;
  confirmField: "confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio";
  setConfirmField: Setter<"confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio">;
  confirmValue: 0 | 1;
  setConfirmValue: Setter<0 | 1>;
  confirmEspecialidades: EfectorPlantillaExtend[];
  setConfirmEspecialidades: Setter<EfectorPlantillaExtend[]>;
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
  efectorEspecialidades,
  setEfectorEspecialidades,
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
   * Usa servicioEfectorActual para ser más eficiente.
   */
  const allEspecialidadesToChange = async (): Promise<EfectorPlantillaExtend[]> => {
    if (efectorSeleccionado.length === 0 || servicios.length === 0) return [];

    const listaMap = new Map<number, EfectorPlantillaExtend>();

    // combos que faltan (efId-servId)
    const missingCombos: Array<{ efId: number; servId: number }> = [];

    // Recorremos cada servicio y consultamos qué efectores debemos considerar
    for (const serv of servicios) {
      const servId = serv.id;
      // si existe mapping en servicioEfectorActual, lo restringimos a los efectores actualmente seleccionados
      const mapped = servicioEfectorActual[servId];
      const efIdsToCheck = mapped.filter(id => selectedEfIds.has(id))

      for (const efId of efIdsToCheck) {
        const cached = efectorEspecialidades?.[efId]?.[servId];
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


    // Lanzamos fetchs en paralelo
    const fetches = missingCombos.map(async ({ efId, servId }) => {
      try {
        const data = await getPlantillaByEfectorServicio(efId, servId);
        return { efId, servId, data, error: null as any };
      } catch (error) {
        return { efId, servId, data: [] as EfectorPlantillaExtend[], error };
      }
    });

    const results = await Promise.all(fetches);

    // Recolectar por efector para actualización de cache
    const updatesByEf: Record<number, Record<number, EfectorPlantillaExtend[]>> = {};
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

    // Actualizamos la cache en bloque (inmutable)
    if (Object.keys(updatesByEf).length > 0) {
      setEfectorEspecialidades(prev => {
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
    }

    if (failed.length > 0) {
      console.warn("Fallaron fetchs de especialidades:", failed);
      setAlertMsg(`No se pudieron cargar especialidades de ${failed.length} combinación(es).`);
      setAlertSeverity("warning");
      setAlertOpen(true);
    }

    return Array.from(listaMap.values());
  };

  /** CLICK SERVICIO → muestra especialidades (usa servicioEfectorActual para ser eficiente) */
  const handleServicioClick = async (servicio: Servicio) => {
    if (efectorSeleccionado.length === 0) return;

    // toggle deselect
    if (servicioSeleccionado.some(s => s.id === servicio.id)) {
      setEspecialidades(prev => prev.filter(es => es.id_servicio !== servicio.id));
      setServicioSeleccionado(prev => prev.filter(s => s.id !== servicio.id));
      return;
    }

    const servId = servicio.id;
    // Determinar qué efectores usar para este servicio: preferimos servicioEfectorActual si está, restringido a los efectores seleccionados
    const mapped = servicioEfectorActual?.[servId];
    const efIds = (mapped ? mapped.filter(id => selectedEfIds.has(id)) : Array.from(selectedEfIds));

    // Si no había mapping, guardamos el mapping actual para optimizar futuras llamadas
    if (!mapped) {
      setServicioEfectorActual(prev => ({ ...(prev || {}), [servId]: Array.from(selectedEfIds) }));
    }

    // revisar cache para esos efIds
    const cachedCombined: EfectorPlantilla[] = [];
    const missingEfIds: number[] = [];

    for (const efId of efIds) {
      const cached = efectorEspecialidades?.[efId]?.[servId];
      if (cached && cached.length > 0) {
        cached.forEach(es => cachedCombined.push(es));
      } else {
        missingEfIds.push(efId);
      }
    }

    // si hay cache parcialmente o completamente, añadimos deduplicado
    if (cachedCombined.length > 0 && missingEfIds.length === 0) {
      const map = new Map<number, EfectorPlantilla>();
      // prev + cachedCombined dedupe
      for (const p of especialidades) map.set(p.id, p);
      for (const c of cachedCombined) map.set(c.id, c);
      setEspecialidades(Array.from(map.values()));
      setServicioSeleccionado(prev => [...prev, servicio]);
      return;
    }

    // fetch solo para missingEfIds
    try {
      const fetches = missingEfIds.map(async efId => {
        try {
          const data = await getPlantillaByEfectorServicio(efId, servId);
          return { efId, data, error: null as any };
        } catch (error) {
          return { efId, data: [] as EfectorPlantilla[], error };
        }
      });

      const results = await Promise.all(fetches);

      // actualizar cache por efector (inmutable)
      setEfectorEspecialidades(prev => {
        const next = { ...prev };
        for (const r of results) {
          next[r.efId] = {
            ...(next[r.efId] || {}),
            [servId]: r.data,
          };
        }
        return next;
      });

      // combinar cachedCombined + todos los results, deduplicar por id
      const combined = [...cachedCombined, ...results.flatMap(r => r.data)];
      const dedup = new Map<number, EfectorPlantilla>();
      for (const es of combined) dedup.set(es.id, es);

      // evitar duplicados con prev
      const prevMap = new Map<number, EfectorPlantilla>(especialidades.map(p => [p.id, p]));
      for (const [id, es] of dedup.entries()) prevMap.set(id, es);

      setEspecialidades(Array.from(prevMap.values()));
      setServicioSeleccionado(prev => [...prev, servicio]);

      // si no hay especialidades
      if (Array.from(prevMap.values()).length === 0) {
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
                setEfectorEspecialidades={setEfectorEspecialidades}
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
