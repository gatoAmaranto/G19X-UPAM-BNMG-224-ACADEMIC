import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT

def generar_pdf_constancia_laboral(constancia):
    """
    Genera un documento PDF oficial de Constancia Laboral para el colaborador dado.
    Regresa un objeto BytesIO con el contenido del PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Estilos personalizados
    title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#2A3B5C'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'HeaderSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        fontName='Helvetica'
    )

    doc_type_style = ParagraphStyle(
        'DocType',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1E293B'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        spaceAfter=20
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['BodyText'],
        fontSize=11,
        leading=18,
        alignment=TA_JUSTIFY,
        fontName='Helvetica'
    )

    footer_style = ParagraphStyle(
        'FooterCustom',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER
    )

    story = []

    # Encabezado Corporativo
    story.append(Paragraph("DEVELOP TALENT & TECHNOLOGY", title_style))
    story.append(Paragraph("PluriOne S.A. de C.V. | RFC: PLU060407HC9", subtitle_style))
    story.append(Paragraph("Puebla 46, Col. Roma Norte, Alcaldía Cuauhtémoc, C.P. 06700, CDMX", subtitle_style))
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2A3B5C'), spaceAfter=20))

    # Título del Documento
    story.append(Paragraph("CONSTANCIA LABORAL", doc_type_style))

    # Dirigido A
    dirigido = constancia.dirigido_a or "A quien corresponda"
    story.append(Paragraph(f"<b>DIRIGIDO A:</b> {dirigido.upper()}", ParagraphStyle('Dirigido', parent=body_style, fontName='Helvetica-Bold', spaceAfter=15)))

    # Datos del Empleado
    emp = constancia.empleado
    nombre_completo = emp.user.get_full_name() or emp.user.username
    fecha_ingreso_str = emp.fecha_ingreso.strftime("%d de %B de %Y")
    fecha_hoy_str = constancia.fecha_emision.strftime("%d de %B de %Y")

    texto_cuerpo = (
        f"Por medio de la presente, <b>PluriOne S.A. de C.V. (Develop Talent & Technology)</b> hace constar que el/la C. "
        f"<b>{nombre_completo.upper()}</b>, identificado(a) con el número de empleado <b>{emp.numero_empleado}</b>, "
        f"labora en esta organización desde el <b>{fecha_ingreso_str}</b>, desempeñando el cargo de <b>{emp.puesto}</b> "
        f"en el departamento de <b>{emp.departamento}</b>."
    )

    if constancia.incluir_sueldo and emp.salario_mensual:
        texto_cuerpo += f" Percibiendo un sueldo mensual bruto de <b>${emp.salario_mensual:,.2f} MXN</b>."

    texto_cuerpo += " Se expide la presente constancia a solicitud del interesado para los fines legales o administrativos que a sus intereses convengan."

    story.append(Paragraph(texto_cuerpo, body_style))
    story.append(Spacer(1, 30))

    # Fecha de Emisión
    story.append(Paragraph(f"Ciudad de México, a {fecha_hoy_str}.", ParagraphStyle('FechaEmision', parent=body_style, alignment=TA_RIGHT)))
    story.append(Spacer(1, 50))

    # Firma de RH
    tabla_firma = Table([
        [Paragraph("________________________________________", ParagraphStyle('Line', alignment=TA_CENTER))],
        [Paragraph("<b>Juan Méndez Herrera</b>", ParagraphStyle('FirmaNombre', alignment=TA_CENTER, fontName='Helvetica-Bold'))],
        [Paragraph("Recursos Humanos & Capital Humano", ParagraphStyle('FirmaCargo', alignment=TA_CENTER, fontSize=10, textColor=colors.HexColor('#555555')))],
        [Paragraph("Develop Talent & Technology", ParagraphStyle('FirmaEmpresa', alignment=TA_CENTER, fontSize=9, textColor=colors.HexColor('#777777')))]
    ], colWidths=[300])
    tabla_firma.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(tabla_firma)

    story.append(Spacer(1, 40))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#DDDDDD'), spaceAfter=10))
    story.append(Paragraph("Este documento es generado automáticamente por el Sistema de Autoservicio de Recursos Humanos de PluriOne S.A. de C.V.", footer_style))

    doc.build(story)
    buffer.seek(0)
    return buffer
