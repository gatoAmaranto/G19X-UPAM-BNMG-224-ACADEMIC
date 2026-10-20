from datetime import date
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from hr_services.models import Empleado, BaseConocimientoRH

class Command(BaseCommand):
    help = "Puebla la base de datos con colaboradores de prueba y el catalogo de preguntas frecuentes RAG."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Iniciando poblado de datos iniciales..."))

        # 1. Base de Conocimiento RAG (Preguntas Frecuentes y Politicas de RH)
        faqs = [
            # Horarios y Jornada
            {
                'categoria': 'Jornada y Horarios',
                'pregunta': '¿Cual es el horario laboral oficial en Develop Talent & Technology?',
                'respuesta': (
                    'La jornada laboral oficial en Develop Talent & Technology (PluriOne) es de Lunes a Viernes '
                    'de 09:00 a 18:00 horas, con 1 hora diaria para alimentos que no se computa como tiempo efectivo de trabajo.'
                )
            },
            {
                'categoria': 'Jornada y Horarios',
                'pregunta': '¿Como funciona el esquema de horario flexible y nucleo obligatorio?',
                'respuesta': (
                    'Contamos con flexibilidad en la entrada (entre 08:00 y 10:00 hrs) y salida (entre 17:00 y 19:00 hrs). '
                    'El nucleo obligatorio de presencia o conexion colaborativa es de 10:00 a 16:00 hrs para todos los colaboradores.'
                )
            },
            {
                'categoria': 'Jornada y Horarios',
                'pregunta': '¿Cuales son las pausas activas y el tiempo para alimentos?',
                'respuesta': (
                    'Tienes asignada 1 hora diaria para alimentos y dos pausas activas adicionales de 15 minutos (una matutina y otra vespertina). '
                    'Es permitido consumir refrigerios ligeros en tu puesto siempre que no interfiera con tus actividades ni con el equipo de computo.'
                )
            },
            {
                'categoria': 'Jornada y Horarios',
                'pregunta': '¿Como solicito un permiso de salida o ajuste de horario?',
                'respuesta': (
                    'Para permisos especiales, salidas anticipadas o ajustes temporales, debes canalizar tu solicitud '
                    'mediante la apertura de un ticket ante Recursos Humanos con visto bueno previo de tu lider directo.'
                )
            },

            # Vacaciones y Descansos
            {
                'categoria': 'Vacaciones y Descansos',
                'pregunta': '¿Cuantos dias de vacaciones me corresponden por ley y politica interna?',
                'respuesta': (
                    'Conforme a la reforma de Vacaciones Dignas y politica interna de PluriOne, te corresponden 12 dias habiles '
                    'al cumplir tu primer año, incrementando 2 dias por cada año subsecuente hasta llegar a 20 dias en el quinto año. '
                    'A partir del sexto año, aumentan 2 dias por cada bloque de 5 años trabajados.'
                )
            },
            {
                'categoria': 'Vacaciones y Descansos',
                'pregunta': '¿Como puedo solicitar mis vacaciones?',
                'respuesta': (
                    'Puedes solicitarlas directamente conversando con este Asistente Virtual indicando las fechas (ej. "Quiero vacaciones del 2026-11-20 al 2026-11-25") '
                    'o a traves del formulario en el modulo de Horario & Calendario. Las solicitudes deben iniciar y concluir en dias habiles laborales.'
                )
            },
            {
                'categoria': 'Vacaciones y Descansos',
                'pregunta': '¿Con cuanta anticipacion debo solicitar mis vacaciones?',
                'respuesta': (
                    'Se recomienda registrar tu solicitud con al menos 10 dias de anticipacion para periodos de 3 o mas dias, '
                    'permitiendo coordinar la continuidad operativa con tu lider de proyecto.'
                )
            },
            {
                'categoria': 'Vacaciones y Descansos',
                'pregunta': '¿Cuales son los dias festivos oficiales de descanso obligatorio?',
                'respuesta': (
                    'Los dias de descanso obligatorio comprenden: 1 de enero, primer lunes de febrero (Constitucion), '
                    'tercer lunes de marzo (Natalicio de Juarez), 1 de mayo (Dia del Trabajo), 16 de septiembre (Independencia), '
                    'tercer lunes de noviembre (Revolucion) y 25 de diciembre (Navidad).'
                )
            },

            # Nomina y Prestaciones
            {
                'categoria': 'Nomina y Prestaciones',
                'pregunta': '¿Cuales son las fechas oficiales de pago de nomina?',
                'respuesta': (
                    'La nomina se liquida de manera quincenal los dias 15 y el ultimo dia habil de cada mes mediante transferencia bancaria. '
                    'Si la fecha de pago cae en fin de semana o dia festivo, se abona el dia habil bancario inmediato anterior.'
                )
            },
            {
                'categoria': 'Nomina y Prestaciones',
                'pregunta': '¿Cuando se paga el aguinaldo y cuantos dias contempla?',
                'respuesta': (
                    'El aguinaldo se paga antes del 20 de diciembre de cada año. PluriOne otorga 20 dias de salario base integrado '
                    '(superior a los 15 dias establecidos en la Ley Federal del Trabajo) o su parte proporcional si ingresaste en el año en curso.'
                )
            },
            {
                'categoria': 'Nomina y Prestaciones',
                'pregunta': '¿Que es la prima vacacional y cuando se liquida?',
                'respuesta': (
                    'La prima vacacional es del 25% sobre los dias de vacaciones que te correspondan y se liquida en la quincena inmediata '
                    'posterior al cumplimiento de tu aniversario laboral en la empresa.'
                )
            },
            {
                'categoria': 'Nomina y Prestaciones',
                'pregunta': '¿Cuales son las prestaciones superiores a la ley?',
                'respuesta': (
                    'Incluyen: 20 dias de aguinaldo, Seguro de Gastos Medicos Mayores (SGMM) corporativo, Seguro de Vida, '
                    'fondo de ahorro con aportacion empatada de la empresa (hasta 13%), vales de despensa y esquema de trabajo hibrido.'
                )
            },
            {
                'categoria': 'Nomina y Prestaciones',
                'pregunta': '¿Como reporto un problema o aclaracion con mi recibo de nomina?',
                'respuesta': (
                    'Puedes reportarlo mediante este asistente (ej. "Tengo un problema con el recibo de nomina: falta el bono de desempeño") '
                    'o abriendo un ticket de soporte. Recursos Humanos revisara los timbrados y te contactara en un maximo de 48 horas habiles.'
                )
            },

            # Constancias Laborales
            {
                'categoria': 'Constancias Laborales',
                'pregunta': '¿Como tramito mi constancia laboral oficial?',
                'respuesta': (
                    'Puedes solicitarla al instante en esta conversacion diciendo "Genera mi constancia laboral con sueldo" '
                    'o "Descargar constancia sin sueldo". Tambien puedes emitirla desde la pestaña "Constancia PDF" de tu portal.'
                )
            },
            {
                'categoria': 'Constancias Laborales',
                'pregunta': '¿Las constancias emitidas por el asistente tienen validez oficial?',
                'respuesta': (
                    'Si. Se emiten en papel digital membretado institucional, con sello digital, codigo unico de verificacion '
                    'y firma autorizada de la Direccion de Recursos Humanos de Develop Talent & Technology.'
                )
            },

            # Mesa de Tickets y Soporte
            {
                'categoria': 'Mesa de Tickets y Soporte',
                'pregunta': '¿Que tramites se atienden mediante tickets de soporte?',
                'respuesta': (
                    'Aclaraciones de nomina, reportes de incapacidad IMSS, altas de dependientes en SGMM, dudas sobre politicas, '
                    'constancias especiales para embajadas y solicitudes de constancias de retencion de impuestos.'
                )
            },
            {
                'categoria': 'Mesa de Tickets y Soporte',
                'pregunta': '¿Cual es el tiempo maximo de resolucion de un ticket de RH?',
                'respuesta': (
                    'El tiempo de primer contacto y atencion es de maximo 24 horas habiles, con una resolucion definitiva '
                    'en un plazo de 48 a 72 horas habiles dependiendo de la complejidad del caso.'
                )
            },
        ]

        faqs_creadas = 0
        for f in faqs:
            _, created = BaseConocimientoRH.objects.update_or_create(
                pregunta=f['pregunta'],
                defaults={
                    'categoria': f['categoria'],
                    'respuesta': f['respuesta'],
                    'activa': True
                }
            )
            if created:
                faqs_creadas += 1

        self.stdout.write(self.style.SUCCESS(f"Base de Conocimiento RAG poblada: {len(faqs)} politicas ({faqs_creadas} nuevas)."))

        # 2. Empleados y Usuarios de Demostracion
        # Colaborador Demo
        user_colab, _ = User.objects.get_or_create(
            username='demo_colaborador',
            defaults={
                'first_name': 'Juan',
                'last_name': 'Perez',
                'email': 'juan.perez@develop.com.mx'
            }
        )
        emp_colab, _ = Empleado.objects.update_or_create(
            user=user_colab,
            defaults={
                'numero_empleado': 'EMP-0101',
                'puesto': 'Desarrollador Full Stack Senior',
                'departamento': 'Tecnologia de la Informacion',
                'fecha_ingreso': date(2023, 3, 1),
                'salario_mensual': 38500.00,
                'dias_vacaciones_totales': 14,
                'dias_vacaciones_tomados': 2,
                'horario_entrada': '09:00',
                'horario_salida': '18:00',
                'dias_laborales': 'Lunes a Viernes',
                'modalidad_trabajo': 'Hibrido'
            }
        )

        # Administrador RH Demo
        user_rh, _ = User.objects.get_or_create(
            username='demo_rh_admin',
            defaults={
                'first_name': 'Maria',
                'last_name': 'Rodriguez',
                'email': 'maria.rodriguez@develop.com.mx',
                'is_staff': True
            }
        )
        emp_rh, _ = Empleado.objects.update_or_create(
            user=user_rh,
            defaults={
                'numero_empleado': 'RH-0001',
                'puesto': 'Especialista en Capital Humano y Relaciones Laborales',
                'departamento': 'Recursos Humanos',
                'fecha_ingreso': date(2022, 1, 10),
                'salario_mensual': 48000.00,
                'dias_vacaciones_totales': 16,
                'dias_vacaciones_tomados': 4,
                'horario_entrada': '09:00',
                'horario_salida': '18:00',
                'dias_laborales': 'Lunes a Viernes',
                'modalidad_trabajo': 'Presencial'
            }
        )

        self.stdout.write(self.style.SUCCESS("Colaboradores institucionales de prueba verificados."))
        self.stdout.write(self.style.SUCCESS("Datos iniciales poblados satisfactoriamente."))

