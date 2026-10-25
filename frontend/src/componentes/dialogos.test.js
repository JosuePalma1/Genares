import { describe, expect, it } from 'vitest';
import { CONFIGURACION_DIALOGOS } from './dialogos';

describe('configuracion institucional de dialogos', () => {
  it('conserva el foco y usa controles del Design System', () => {
    expect(CONFIGURACION_DIALOGOS.returnFocus).toBe(true);
    expect(CONFIGURACION_DIALOGOS.buttonsStyling).toBe(false);
    expect(CONFIGURACION_DIALOGOS.didOpen).toBeTypeOf('function');
    expect(CONFIGURACION_DIALOGOS.customClass.confirmButton).toContain('button-primary');
    expect(CONFIGURACION_DIALOGOS.customClass.cancelButton).toContain('button-outline');
  });

  it('mantiene clases diferenciadas para confirmar, cancelar y denegar', () => {
    const { confirmButton, cancelButton, denyButton } = CONFIGURACION_DIALOGOS.customClass;
    expect(new Set([confirmButton, cancelButton, denyButton]).size).toBe(3);
  });
});
