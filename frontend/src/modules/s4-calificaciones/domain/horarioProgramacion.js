export const HORARIO_PROGRAMACION_PREDETERMINADO = {
  bloquearFechasPasadas: true,
  horaMinima: '06:00',
  horaMaxima: '23:00',
};

const fechaInstitucional = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' });

export function fechaHoyInstitucional() {
  return fechaInstitucional.format(new Date());
}

export function rangoRapidoCronograma(tipo, hoy = fechaHoyInstitucional()) {
  if (tipo === 'HOY') return { desde: hoy, hasta: hoy };
  if (tipo !== 'MANANA' && tipo !== 'SEMANA') return {};
  const fecha = new Date(`${hoy}T00:00:00Z`);
  const dia = (desplazamiento) => new Date(fecha.getTime() + desplazamiento * 86_400_000).toISOString().slice(0, 10);
  if (tipo === 'MANANA') return { desde: dia(1), hasta: dia(1) };
  const lunes = -((fecha.getUTCDay() + 6) % 7);
  return { desde: dia(lunes), hasta: dia(lunes + 6) };
}
