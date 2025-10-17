// Confirmacion.tsx
import type { EfeSerEspPlantillaExtend } from "../types";
import {
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import type { Setter, AlertSeverity } from "../../../common/types";
import { updateEfectorPlantilla } from "../api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type FieldName = "confirmacion" | "reprogramacion" | "cancelacion" | "recordatorio";

type Props = {
  onSuccess: (e: EfeSerEspPlantillaExtend, field: FieldName, value: 0 | 1) => void;
  /**
   * Opcional: callback que se invoca cuando el diálogo se cierra (internamente).
   */
  onClosed?: () => void;
  open: boolean;
  setOpen: Setter<boolean>;
  field: FieldName;
  value: 0 | 1;
  confirmEspecialidades: EfeSerEspPlantillaExtend[];
  setAlertOpen: Setter<boolean>;
  setAlertMsg: Setter<string>;
  setAlertSeverity: Setter<AlertSeverity>;
};

const Confirmacion = ({
  onSuccess,
  onClosed,
  open,
  setOpen,
  field,
  value,
  confirmEspecialidades,
  setAlertOpen,
  setAlertMsg,
  setAlertSeverity,
}: Props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const fieldLabel = (f: string) => {
    switch (f) {
      case "confirmacion":
        return "Confirmaciones";
      case "reprogramacion":
        return "Reprogramaciones";
      case "cancelacion":
        return "Cancelaciones";
      case "recordatorio":
        return "Recordatorios";
      default:
        return f;
    }
  };

  const handleClose = () => {
    if (busy) return; // no permitir cerrar mientras haya operaciones en curso
    setOpen(false);
    onClosed?.();
  };

  const handleConfirmToggle = async () => {
    if (confirmEspecialidades.length === 0) {
      setAlertMsg("No hay especialidades seleccionadas.");
      setAlertSeverity("info");
      setAlertOpen(true);
      handleClose();
      return;
    }

    const ids = confirmEspecialidades.map((s) => s.id);
    const attempted = ids.length;

    // Si vamos a PRNDER (value === 1) — navegamos a asignar plantilla y no hacemos updates aquí.
    if (value === 1) {
      // navegamos a plantillas y pasamos los ids por state
      navigate(`/plantillas/${field}`, {
        state: {
          especialidades: ids,
        },
      });
      handleClose();
      return;
    }

    // CASO: apagado -> actualizamos en backend
    setBusy(true);
    try {
      const plantField =
        field === "confirmacion"
          ? "plantilla_conf"
          : field === "reprogramacion"
          ? "plantilla_repr"
          : field === "cancelacion"
          ? "plantilla_canc"
          : "plantilla_reco";

      const payload: Record<string, any> = {
        [field]: 0,
        [plantField]: null,
      };

      const settled = await Promise.allSettled(
        ids.map((id) => updateEfectorPlantilla(id, payload))
      );

      let updated = 0;
      const failedIds: number[] = [];

      
      settled.forEach((res, idx) => {
        const esp = confirmEspecialidades[idx];
        if (res.status === "fulfilled") {
          updated++;
          // ahora pasamos también field/value al callback para que el padre actualice correctamente
          try {
            onSuccess(esp, field, value);
          } catch (cbErr) {
            console.error("onSuccess callback error:", cbErr);
          }
        } else {
          failedIds.push(esp.id);
        }
      });

      const success = failedIds.length === 0;

      if (success) {
        setAlertMsg(`${fieldLabel(field)} actualizadas correctamente (${updated}).`);
        setAlertSeverity("success");
        setAlertOpen(true);
      } else {
        setAlertMsg(`Se actualizaron ${updated}/${attempted}. Fallaron ids: ${failedIds.join(", ")}.`);
        setAlertSeverity("warning");
        setAlertOpen(true);
      }

      handleClose();
      return;
    } catch (err) {
      console.error("Error actualizando especialidades:", err);
      setAlertMsg("No se pudo actualizar en el servidor");
      setAlertSeverity("error");
      setAlertOpen(true);
      handleClose();
    } finally {
      setBusy(false);
    }
  };

  const actionText = value === 1 ? `Encender ${fieldLabel(field)}` : `Apagar ${fieldLabel(field)}`;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{actionText}</DialogTitle>
      <DialogContent>
        <Typography>
          {value === 1
            ? `Se van a seleccionar ${confirmEspecialidades.length} especialidades para asignar plantilla. ¿Desea continuar?`
            : `Se van a apagar ${confirmEspecialidades.length} especialidades y se limpiará la plantilla asociada. ¿Desea continuar?`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={handleConfirmToggle} disabled={busy} variant="contained">
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Confirmacion;
