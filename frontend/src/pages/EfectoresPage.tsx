// src/pages/ListaPage.tsx
import { AuthContext } from "../common/contex";
import { useContext, useState } from "react";
import { Box, Grid, Card, CardContent, Typography, Snackbar, Alert, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { Efector, EfectorPlantilla, EfectorPlantillaExtend, Servicio } from "../features/turno/types";
import type { AlertSeverity } from "../common/types";
import { getServicioByEfector } from "../features/turno/api";
import Servicios from "../features/turno/components/ServicioBlock";
import Especialidades from "../features/turno/components/EspecialidadBlock";

function ListaPage() {
  const { efectores } = useContext(AuthContext);
  const navigate = useNavigate();

  // Selección actual
  const [efectorSeleccionado, setEfectorSeleccionado] = useState<Efector[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio[]>([]);
  const [especialidades, setEspecialidades] = useState<EfectorPlantillaExtend[]>([]);
  // service_id -> [efector_id, ...]
  const [servicioEfectorActual, setServicioEfectorActual] = useState<Record<number, number[]>>({});

  // Cache: servicios por efector y especialidades por efector->servicio
  const [efectorServicios, setEfectorServicios] = useState<Record<number, Servicio[]>>({});
  const [efectorEspecialidades, setEfectorEspecialidades] = useState<Record<number, Record<number, EfectorPlantillaExtend[]>>>({});

  // Estado del diálogo / confirmación y selección global para SendAll
  const [open, setOpen] = useState<boolean>(false);
  const [confirmEspecialidades, setConfirmEspecialidades] = useState<EfectorPlantillaExtend[]>([]);
  const [confirmField, setConfirmField] = useState<"confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio">("confirmacion");
  const [confirmValue, setConfirmValue] = useState<0 | 1>(1);

  // alertas
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>("info");

  // Helpers
  const mergeServiciosUnique = (a: Servicio[], b: Servicio[]) => {
    const map = new Map<number, Servicio>();
    for (const s of a) map.set(s.id, s);
    for (const s of b) map.set(s.id, s);
    return Array.from(map.values());
  };

  const ensureServicioEfectorAdd = (prev: Record<number, number[]>, servicioId: number, efectorId: number) => {
    const next = { ...prev };
    const arr = Array.from(new Set([...(next[servicioId] || []), efectorId]));
    next[servicioId] = arr;
    return next;
  };

  const ensureServicioEfectorRemove = (prev: Record<number, number[]>, servicioId: number, efectorId: number) => {
    const next = { ...prev };
    if (!next[servicioId]) return next;
    const arr = next[servicioId].filter(id => id !== efectorId);
    if (arr.length === 0) {
      delete next[servicioId];
    } else {
      next[servicioId] = arr;
    }
    return next;
  };

  /** CLICK EFECTOR → muestra servicios */
  const handleEfectorClick = async (efector: Efector) => {
    const isSelected = efectorSeleccionado.some(e => e.id === efector.id);

    if (isSelected) {
      // Deseleccionar: removemos efector de la lista y actualizamos servicioEfectorActual
      setEfectorSeleccionado(prev => prev.filter(e => e.id !== efector.id));

      // trabajamos sobre la copia actual del diccionario para calcular efectos
      const currentMap = servicioEfectorActual;
      let nextMap = { ...currentMap };

      const servToEf = efectorServicios[efector.id] || [];

      // remover efector de las entradas correspondientes
      for (const s of servToEf) {
        if (nextMap[s.id]) {
          nextMap = ensureServicioEfectorRemove(nextMap, s.id, efector.id);
        }
      }

      // aplicar cambios
      setServicioEfectorActual(nextMap);

      // ahora actualizamos servicios globales: solo mantengo servicios que aún tienen algun efector
      const serviciosIdsConEfector = new Set<number>(Object.keys(nextMap).map(k => Number(k)));
      setServicios(prev => prev.filter(s => serviciosIdsConEfector.has(s.id)));

      // actualizar servicios seleccionados (si un servicio quedó sin efectores, lo removemos)
      setServicioSeleccionado(prev => prev.filter(s => serviciosIdsConEfector.has(s.id)));

      // actualizar especialidades: mantener solo las que correspondan a servicios que siguen teniendo efectores
      setEspecialidades(prev => prev.filter(es => es.efector.id != efector.id));

      return;
    }

    // Seleccionar efector: agregamos efector a la lista y sus servicios a servicios & servicioEfectorActual
    setEfectorSeleccionado(prev => [...prev, efector]);

    // Si ya tenemos servicios cacheados para este efector
    if (efectorServicios[efector.id] && efectorServicios[efector.id].length > 0) {
      const cached = efectorServicios[efector.id];

      // actualizamos la lista global de servicios (sin duplicados)
      setServicios(prev => mergeServiciosUnique(prev, cached));

      // actualizamos servicioEfectorActual: por cada servicio, añadimos efector.id
      setServicioEfectorActual(prev => {
        let next = { ...prev };
        for (const s of cached) {
          next = ensureServicioEfectorAdd(next, s.id, efector.id);
        }
        return next;
      });

      return;
    }

    // Si no hay cache: fetch
    try {
      const data = await getServicioByEfector(efector.id);
      // guardamos en cache por efector
      setEfectorServicios(prev => ({ ...prev, [efector.id]: data }));

      // agregamos a la lista global de servicios (sin duplicados)
      setServicios(prev => mergeServiciosUnique(prev, data));

      // actualizamos servicioEfectorActual
      setServicioEfectorActual(prev => {
        let next = { ...prev };
        for (const s of data) {
          next = ensureServicioEfectorAdd(next, s.id, efector.id);
        }
        return next;
      });
    } catch (err) {
      console.error(err);
      setAlertMsg("No se pudieron cargar los servicios");
      setAlertSeverity("error");
      setAlertOpen(true);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Top bar with Plantillas button aligned to the right */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" onClick={() => navigate("/plantillas")}>
          Plantillas
        </Button>
      </Box>

      {/* Grid de Efector */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {efectores.map((item: Efector) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
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
                bgcolor: efectorSeleccionado.some(e => e.id === item.id) ? "rgba(177, 248, 248, 1)" : "white",
                transition: "background-color 200ms, border-color 200ms, box-shadow 200ms, transform 120ms",
                "&:hover": {
                  borderColor: "primary.main",
                  boxShadow: 6,
                  transform: "translateY(-4px)",
                },
                "&:active": {
                  transform: "translateY(-1px)",
                },
                ...(efectorSeleccionado.some(e => e.id === item.id) && {
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
              onClick={() => handleEfectorClick(item)}
            >
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {item.nombre}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Lista de Servicios */}
      {efectorSeleccionado.length > 0 && (
        <Servicios
          efectorSeleccionado={efectorSeleccionado}
          servicios={servicios}
          servicioSeleccionado={servicioSeleccionado}
          setServicioSeleccionado={setServicioSeleccionado}
          especialidades={especialidades}
          setEspecialidades={setEspecialidades}
          efectorEspecialidades={efectorEspecialidades}
          setEfectorEspecialidades={setEfectorEspecialidades}
          servicioEfectorActual={servicioEfectorActual}
          setServicioEfectorActual={setServicioEfectorActual}
          confirmField={confirmField}
          setConfirmField={setConfirmField}
          confirmValue={confirmValue}
          setConfirmValue={setConfirmValue}
          confirmEspecialidades={confirmEspecialidades}
          setConfirmEspecialidades={setConfirmEspecialidades}
          setAlertOpen={setAlertOpen}
          setAlertMsg={setAlertMsg}
          setAlertSeverity={setAlertSeverity}
          open={open}
          setOpen={setOpen}
        />
      )}

      {/* Lista de Especialidades */}
      {servicioSeleccionado.length > 0 && efectorSeleccionado.length > 0 && (
        <Especialidades
          open={open}
          setOpen={setOpen}
          especialidades={especialidades}
          setEspecialidades={setEspecialidades}
          efectorSeleccionado={efectorSeleccionado}
          servicioSeleccionado={servicioSeleccionado}
          confirmEspecialidades={confirmEspecialidades}
          setConfirmEspecialidades={setConfirmEspecialidades}
          confirmField={confirmField}
          setConfirmField={setConfirmField}
          confirmValue={confirmValue}
          setConfirmValue={setConfirmValue}
          setEfectorEspecialidades={setEfectorEspecialidades}
          setAlertOpen={setAlertOpen}
          setAlertMsg={setAlertMsg}
          setAlertSeverity={setAlertSeverity}
        />
      )}

      {/* Snackbar */}
      <Snackbar open={alertOpen} autoHideDuration={3500} onClose={() => setAlertOpen(false)}>
        <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity} sx={{ width: "100%" }}>
          {alertMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ListaPage;
