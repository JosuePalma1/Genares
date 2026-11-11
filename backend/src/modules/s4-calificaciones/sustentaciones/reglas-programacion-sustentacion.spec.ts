import {
  patronBusquedaProgramacion,
  permiteTransicionEstadoProgramacion,
  seSolapanEnLaMismaSala,
  validarDuracionEstimada,
  validarFechaProgramada,
  validarHoraProgramada,
  validarSalaProgramada,
  elegirParticipantesSesion,
  validarMotivoReprogramacion,
} from './reglas-programacion-sustentacion';

describe('reglas de programación de sustentaciones', () => {
  it('acepta una fecha de calendario real y rechaza una fecha imposible', () => {
    expect(validarFechaProgramada('2026-10-23')).toBe('2026-10-23');
    expect(() => validarFechaProgramada('2026-02-30')).toThrow('no existe en el calendario');
    expect(() => validarFechaProgramada('0000-01-01')).toThrow('AAAA-MM-DD');
    expect(() => validarFechaProgramada('23/10/2026')).toThrow('AAAA-MM-DD');
  });

  it('valida hora local sin imponer una duración de sustentación', () => {
    expect(validarHoraProgramada('09:35')).toBe('09:35');
    expect(validarHoraProgramada('23:59:59')).toBe('23:59:59');
    expect(() => validarHoraProgramada('24:00')).toThrow('00:00 y 23:59');
    expect(() => validarHoraProgramada('9:35')).toThrow('00:00 y 23:59');
  });

  it('recorta la sala y rechaza texto vacío o extenso', () => {
    expect(validarSalaProgramada('  Sala 2  ')).toBe('Sala 2');
    expect(() => validarSalaProgramada('   ')).toThrow('obligatoria');
    expect(() => validarSalaProgramada('S'.repeat(161))).toThrow('160 caracteres');
  });

  it('admite duraciones estimadas enteras de 1 a 240 minutos', () => {
    expect(validarDuracionEstimada(1)).toBe(1);
    expect(validarDuracionEstimada(60)).toBe(60);
    expect(validarDuracionEstimada(240)).toBe(240);
    for (const invalida of [0, -1, 241, 40.5, '60', null]) {
      expect(() => validarDuracionEstimada(invalida)).toThrow('número entero entre 1 y 240');
    }
  });

  it('resuelve intervalos de sala semiabiertos y libera las cancelaciones', () => {
    const base = { fecha: '2026-10-24', sala: 'Sala A', duracionMinutos: 60, estado: 'PROGRAMADA' };
    expect(seSolapanEnLaMismaSala({ ...base, hora: '09:00' }, { ...base, hora: '09:59' })).toBe(true);
    expect(seSolapanEnLaMismaSala({ ...base, hora: '09:00' }, { ...base, hora: '10:00' })).toBe(false);
    expect(seSolapanEnLaMismaSala({ ...base, hora: '09:00' }, { ...base, hora: '09:30', sala: 'Sala B' })).toBe(false);
    expect(seSolapanEnLaMismaSala({ ...base, hora: '09:00' }, { ...base, hora: '09:30', estado: 'CANCELADA' })).toBe(false);
    expect(seSolapanEnLaMismaSala(
      { ...base, fecha: '2026-10-24', hora: '23:30' },
      { ...base, fecha: '2026-10-25', hora: '00:15' },
    )).toBe(true);
  });

  it('permite solo transiciones operativas confirmadas', () => {
    expect(permiteTransicionEstadoProgramacion('PROGRAMADA', 'EN_SUSTENTACION')).toBe(true);
    expect(permiteTransicionEstadoProgramacion('PROGRAMADA', 'CANCELADA')).toBe(true);
    expect(permiteTransicionEstadoProgramacion('EN_SUSTENTACION', 'FINALIZADA')).toBe(true);
    expect(permiteTransicionEstadoProgramacion('PROGRAMADA', 'FINALIZADA')).toBe(false);
    expect(permiteTransicionEstadoProgramacion('CANCELADA', 'PROGRAMADA')).toBe(false);
    expect(permiteTransicionEstadoProgramacion('FINALIZADA', 'CANCELADA')).toBe(false);
  });

  it('escapa comodines SQL y trata búsqueda vacía como ausencia de filtro', () => {
    expect(patronBusquedaProgramacion('  TT%_\\01  ')).toBe('%TT\\%\\_\\\\01%');
    expect(patronBusquedaProgramacion('  ')).toBeNull();
  });
});

describe('participantes de una sesión nueva (RN-28)', () => {
  const a = '55555555-5555-4555-8555-555555555551';
  const b = '55555555-5555-4555-8555-555555555552';

  it('sin selección incluye a todos los pendientes: bina conjunta', () => {
    expect(elegirParticipantesSesion([{ id: a, programado: false }, { id: b, programado: false }])).toEqual([a, b]);
  });

  it('sin selección deja fuera al estudiante ya programado', () => {
    expect(elegirParticipantesSesion([{ id: a, programado: true }, { id: b, programado: false }])).toEqual([b]);
  });

  it('con selección crea una sesión separada solo para ese estudiante', () => {
    expect(elegirParticipantesSesion([{ id: a, programado: false }, { id: b, programado: false }], [b.toUpperCase()])).toEqual([b]);
  });

  it('rechaza un trabajo sin estudiantes o ya programado por completo', () => {
    expect(() => elegirParticipantesSesion([])).toThrow('no tiene estudiantes');
    expect(() => elegirParticipantesSesion([{ id: a, programado: true }])).toThrow('ya tiene una programación');
  });

  it('rechaza estudiantes ajenos al trabajo o ya programados', () => {
    const estudiantes = [{ id: a, programado: true }, { id: b, programado: false }];
    expect(() => elegirParticipantesSesion(estudiantes, ['55555555-5555-4555-8555-555555555559'])).toThrow('no pertenece al trabajo');
    expect(() => elegirParticipantesSesion(estudiantes, [a, b])).toThrow('ya tiene una programación');
  });
});

describe('motivo de reprogramación (RN-27)', () => {
  it('lo exige y lo normaliza', () => {
    expect(validarMotivoReprogramacion('  Cambio de aula por mantenimiento ')).toBe('Cambio de aula por mantenimiento');
    expect(() => validarMotivoReprogramacion('   ')).toThrow('motivo');
    expect(() => validarMotivoReprogramacion(undefined)).toThrow('motivo');
    expect(() => validarMotivoReprogramacion('x'.repeat(501))).toThrow('500');
  });
});
