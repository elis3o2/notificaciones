from datetime import timedelta, datetime, date, time

def parse_date(value : str) -> date:

    s = str(value).strip().split(".")[0]      # quitar fracciones si las trae
    if " " in s:
        s = s.split(" ")[0]
    # intentar formatos comunes
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            continue
    # último recurso: intentar partir por '-' (YYYY-M-D)
    parts = s.split("-")
    if len(parts) == 3:
        y, m, d = [int(p) for p in parts]
        return datetime.date(y, m, d)


def parse_time(value : str) -> time:

    s = str(value).strip().split(".")[0]
    if " " in s:
        # tomar la parte que parece hora (ej: "Date ... 08:00:00")
        s = s.split(" ", 1)[-1]
    for fmt in ("%H:%M:%S", "%H:%M"):
        return datetime.strptime(s, fmt).time()

