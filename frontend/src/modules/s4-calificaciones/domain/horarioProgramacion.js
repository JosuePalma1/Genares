export const HORARIO_PROGRAMACION_PREDETERMINADO = {
  bloquearFechasPasadas: true,
  horaMinima: '06:00',
  horaMaxima: '23:00',
};

const fechaInstitucional = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' });

export function fechaHoyInstitucional() {
  return fechaInstitucional.format(new Date());
}
