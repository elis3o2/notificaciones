// SendAll.tsx (reemplazar)
import React, { useState } from "react";
import type { Efector, Servicio } from "../../efe_ser_esp/types";
import type { EfeSerEspPlantillaExtend } from "../types";
import {
  Stack,
  Tooltip,
  IconButton,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import CancelIcon from "@mui/icons-material/Cancel";
import NotificationsIcon from "@mui/icons-material/Notifications";
import type { Setter, AlertSeverity } from "../../../common/types";
import Confirmacion from "./Confirmacion";

type FieldName = "confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio";

type Props = {
  open: boolean;
  setOpen: Setter<boolean>;
  efectorSeleccionado: Efector[]; // ahora lista
  preFunction: () => Promise<EfeSerEspPlantillaExtend[]> | EfeSerEspPlantillaExtend[];
  setEspecialidades: Setter<EfeSerEspPlantillaExtend[]>;
  setEfectorEspecialidades: Setter<Record<number, Record<number, EfeSerEspPlantillaExtend[]>>>;
  confirmField: FieldName;
  setConfirmField: Setter<FieldName>;
  confirmValue: 0 | 1;
  setConfirmValue: Setter<0 | 1>;
  confirmEspecialidades: EfeSerEspPlantillaExtend[]; // ahora viene del padre
  setConfirmEspecialidades: Setter<EfeSerEspPlantillaExtend[]>; // ahora actualizamos el padre
  setAlertOpen: Setter<boolean>;
  setAlertMsg: Setter<string>;
  setAlertSeverity: Setter<AlertSeverity>;
};

const SendAll = ({
  open,
  setOpen,
  efectorSeleccionado,
  preFunction,
  setEspecialidades,
  setEfectorEspecialidades,
  confirmField,
  setConfirmField,
  confirmValue,
  setConfirmValue,
  confirmEspecialidades,
  setConfirmEspecialidades,
  setAlertMsg,
  setAlertSeverity,
  setAlertOpen,
}: Props) => {
  const [loadingField, setLoadingField] = useState<null | FieldName>(null);

  const handleFieldToggleAll = async (field: FieldName, value: 0 | 1) => {
    if (loadingField) return;
    setLoadingField(field);

    try {
      // Ejecutamos preFunction y esperamos su resultado (puede ser sync o async)
      const data = await Promise.resolve(preFunction());

      // Actualizamos confirmEspecialidades en el padre con lo que devolvió preFunction
      setConfirmEspecialidades(data);

      
      // Usamos 'dataArr' (la lista preparada) para filtrar las que realmente necesitan cambio
      const toChange = data.filter((esp) => esp[field] !== value);

      if (toChange.length === 0) {
        setAlertMsg("No hay especialidades que necesiten cambiar.");
        setAlertSeverity("info");
        setAlertOpen(true);
        setLoadingField(null);
        return;
      }

      // sincronizamos estado con el padre para que Confirmacion los use
      setConfirmField(field);
      setConfirmValue(value);
      setConfirmEspecialidades(toChange);

      // abrimos diálogo de confirmación (Confirmacion usará los props que acabamos de setear)
      setOpen(true);
    } catch (err) {
      console.error("Error preparando cambios:", err);
      setAlertMsg("Ocurrió un error preparando los cambios.");
      setAlertSeverity("error");
      setAlertOpen(true);
    } finally {
      setLoadingField(null);
    }
  };

const updateCache = (esp: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => {
  const efId = esp.id_efector;
  const seId = esp.id_servicio;

  // crear una copia actualizada del objeto
  const updatedEsp = { ...esp, [field]: value } as EfeSerEspPlantillaExtend;

  setEfectorEspecialidades((prev) => {
    // copia de todo el estado
    const next = { ...prev };

    // asegurar que existe el nivel de efector
    if (!next[efId]) {
      next[efId] = {};
    }

    // asegurar que existe el nivel de servicio como array
    const currentList = next[efId][seId] || [];

    // reemplazar la especialidad correspondiente dentro de la lista
    next[efId][seId] = currentList.map((e) =>
      e.id === esp.id ? updatedEsp : e
    );

    return next;
  });
};


  const updateEspecialidades = (esp: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => {
    setEspecialidades((prev) =>
      prev.map((e) => (e.id === esp.id ? ({ ...e, [field]: value } as EfeSerEspPlantillaExtend) : e))
    );
  };

  // onSuccess ahora recibe (esp, field, value)
  const handleOnSuccess = (esp: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => {
    updateCache(esp, field, value);
    updateEspecialidades(esp, field, value);

    // Además actualizar la lista de confirmEspecialidades del padre (reflejar el cambio)
    setConfirmEspecialidades((prev) =>
      prev.map((p) => (p.id === esp.id ? ({ ...p, [field]: value } as EfeSerEspPlantillaExtend) : p))
    );
  };

  const onClosed = () => setOpen(false);

  return (
    <>
      <Confirmacion
        onSuccess={handleOnSuccess}
        onClosed={onClosed}
        open={open}
        setOpen={setOpen}
        field={confirmField}
        value={confirmValue}
        confirmEspecialidades={confirmEspecialidades}
        setAlertOpen={setAlertOpen}
        setAlertMsg={setAlertMsg}
        setAlertSeverity={setAlertSeverity}
      />

      <Stack direction="row" spacing={1} alignItems="center">
        {/* Confirmación */}
        <Tooltip title="Prender confirmación (todas)">
          <span>
            <IconButton
              aria-label="prender-confirmacion"
              onClick={() => handleFieldToggleAll("confirmacion", 1)}
              disabled={loadingField !== null}
            >
              <CheckCircleIcon sx={{ color: "success.main" }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Apagar confirmación (todas)">
          <span>
            <IconButton
              aria-label="apagar-confirmacion"
              onClick={() => handleFieldToggleAll("confirmacion", 0)}
              disabled={loadingField !== null}
            >
              <CheckCircleIcon sx={{ color: "grey.500" }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Reprogramación */}
        <Tooltip title="Prender reprogramación (todas)">
          <span>
            <IconButton
              aria-label="prender-reprogramacion"
              onClick={() => handleFieldToggleAll("reprogramacion", 1)}
              disabled={loadingField !== null}
            >
              <ReplayIcon sx={{ color: "info.main" }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Apagar reprogramación (todas)">
          <span>
            <IconButton
              aria-label="apagar-reprogramacion"
              onClick={() => handleFieldToggleAll("reprogramacion", 0)}
              disabled={loadingField !== null}
            >
              <ReplayIcon sx={{ color: "grey.500" }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Cancelación */}
        <Tooltip title="Prender cancelación (todas)">
          <span>
            <IconButton
              aria-label="prender-cancelacion"
              onClick={() => handleFieldToggleAll("cancelacion", 1)}
              disabled={loadingField !== null}
            >
              <CancelIcon sx={{ color: "error.main" }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Apagar cancelación (todas)">
          <span>
            <IconButton
              aria-label="apagar-cancelacion"
              onClick={() => handleFieldToggleAll("cancelacion", 0)}
              disabled={loadingField !== null}
            >
              <CancelIcon sx={{ color: "grey.500" }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Recordatorio */}
        <Tooltip title="Prender recordatorio (todas)">
          <span>
            <IconButton
              aria-label="prender-recordatorio"
              onClick={() => handleFieldToggleAll("recordatorio", 1)}
              disabled={loadingField !== null}
            >
              <NotificationsIcon sx={{ color: "warning.main" }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Apagar recordatorio (todas)">
          <span>
            <IconButton
              aria-label="apagar-recordatorio"
              onClick={() => handleFieldToggleAll("recordatorio", 0)}
              disabled={loadingField !== null}
            >
              <NotificationsIcon sx={{ color: "grey.500" }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </>
  );
};

export default SendAll;
