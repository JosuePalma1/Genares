import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TablaCatalogo } from './TablaCatalogo';

const columnas = [{ key: 'codigo', label: 'Código', sortable: true }];

describe('TablaCatalogo con errores de lectura', () => {
  it('muestra un solo error recuperable y no presenta registros vacíos o antiguos como respuesta actual', () => {
    const html = renderToStaticMarkup(<TablaCatalogo
      caption="Carreras registradas"
      registros={[{ id: '1', codigo: 'TI', estaActivo: true }]}
      columnas={columnas}
      error="No fue posible contactar con la API local."
      onReintentar={vi.fn()}
      etiquetaRegistro="carreras"
    />);

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain('No fue posible contactar con la API local.');
    expect(html).toContain('Reintentar lectura');
    expect(html).not.toContain('Todavía no hay carreras');
    expect(html).not.toContain('tabla-catalogo-scroll');
  });

  it('no presenta como vacío un catálogo mientras su consulta está cargando', () => {
    const html = renderToStaticMarkup(<TablaCatalogo
      caption="Modalidades registradas"
      registros={[]}
      columnas={columnas}
      cargando
      etiquetaRegistro="modalidades"
    />);

    expect(html).toContain('role="status"');
    expect(html).toContain('Actualizando modalidades');
    expect(html).not.toContain('Todavía no hay modalidades');
    expect(html).not.toContain('Sin resultados con estos filtros');
  });
});
