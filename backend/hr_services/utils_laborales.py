import datetime

def obtener_indices_dias_laborales(dias_laborales_str="Lunes a Viernes"):
    """
    Retorna un conjunto de enteros (0=Lunes, ..., 6=Domingo) correspondientes
    a los dias laborales del colaborador segun su configuracion institucional.
    """
    if not dias_laborales_str:
        return {0, 1, 2, 3, 4}

    txt = dias_laborales_str.lower().strip()

    if "lunes a sabado" in txt or "lunes a sábado" in txt or "l-s" in txt:
        return {0, 1, 2, 3, 4, 5}
    if "lunes a jueves" in txt:
        return {0, 1, 2, 3}
    if "lunes a domingo" in txt:
        return {0, 1, 2, 3, 4, 5, 6}
    if "lunes a viernes" in txt or "l-v" in txt:
        return {0, 1, 2, 3, 4}

    mapping = {
        'lun': 0, 'lunes': 0,
        'mar': 1, 'martes': 1,
        'mie': 2, 'mié': 2, 'miercoles': 2, 'miércoles': 2,
        'jue': 3, 'jueves': 3,
        'vie': 4, 'viernes': 4,
        'sab': 5, 'sáb': 5, 'sabado': 5, 'sábado': 5,
        'dom': 6, 'domingo': 6,
    }
    indices = set()
    for word in txt.replace(',', ' ').replace(';', ' ').replace('-', ' ').split():
        clean = word.strip().lower()
        if clean in mapping:
            indices.add(mapping[clean])

    return indices if indices else {0, 1, 2, 3, 4}


def es_dia_laboral(fecha, dias_laborales_str="Lunes a Viernes"):
    """
    Determina si un objeto datetime.date o string 'YYYY-MM-DD' es dia laboral
    para el colaborador.
    """
    if isinstance(fecha, str):
        try:
            fecha = datetime.datetime.strptime(fecha.split('T')[0], '%Y-%m-%d').date()
        except ValueError:
            return False

    indices = obtener_indices_dias_laborales(dias_laborales_str)
    return fecha.weekday() in indices


def calcular_dias_laborales(fecha_inicio, fecha_fin, dias_laborales_str="Lunes a Viernes"):
    """
    Calcula la lista y cantidad exacta de dias laborales en un rango de fechas.
    Excluye sabados, domingos y dias no laborables segun la jornada del empleado.
    """
    if isinstance(fecha_inicio, str):
        fecha_inicio = datetime.datetime.strptime(fecha_inicio.split('T')[0], '%Y-%m-%d').date()
    if isinstance(fecha_fin, str):
        fecha_fin = datetime.datetime.strptime(fecha_fin.split('T')[0], '%Y-%m-%d').date()

    if fecha_fin < fecha_inicio:
        return []

    indices = obtener_indices_dias_laborales(dias_laborales_str)
    dias = []
    curr = fecha_inicio
    while curr <= fecha_fin:
        if curr.weekday() in indices:
            dias.append(curr)
        curr += datetime.timedelta(days=1)

    return dias


MESES_ES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
}

def parsear_fecha_flexible(valor):
    """
    Interpreta fechas en formatos YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    o lenguaje natural en español (ej. '20 de noviembre de 2026').
    """
    import re
    if not valor:
        return None
    if isinstance(valor, datetime.date):
        return valor
    if isinstance(valor, datetime.datetime):
        return valor.date()

    txt = str(valor).strip().lower()

    # Formato ISO: YYYY-MM-DD
    m_iso = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', txt)
    if m_iso:
        try:
            return datetime.date(int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3)))
        except ValueError:
            pass

    # Formato latino: DD/MM/YYYY o DD-MM-YYYY
    m_lat = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})', txt)
    if m_lat:
        try:
            return datetime.date(int(m_lat.group(3)), int(m_lat.group(2)), int(m_lat.group(1)))
        except ValueError:
            pass

    # Texto natural en español: '20 de noviembre de 2026' o '20 de noviembre'
    m_nat = re.search(r'(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?', txt)
    if m_nat:
        dia = int(m_nat.group(1))
        mes_str = m_nat.group(2)
        mes = MESES_ES.get(mes_str)
        anio = int(m_nat.group(3)) if m_nat.group(3) else datetime.date.today().year
        if mes:
            try:
                return datetime.date(anio, mes, dia)
            except ValueError:
                pass

    return None
