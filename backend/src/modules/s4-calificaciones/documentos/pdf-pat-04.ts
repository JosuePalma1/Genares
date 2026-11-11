import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { ServiceUnavailableException } from '@nestjs/common';
import { DatosDocumentales, notaEtapaSobreDiez } from './modelo-documental';
import { notaEnLetras } from './reglas-acta';
import { PLANTILLAS } from './plantillas-institucionales';

const ejecutar = promisify(execFile);
const exportarWord = String.raw`
$ErrorActionPreference = 'Stop'
$datos = Get-Content -LiteralPath (Join-Path (Get-Location) 'datos.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($datos.rubrica) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::Open($datos.plantilla, [IO.Compression.ZipArchiveMode]::Update)
  try {
    $entrada = $zip.GetEntry('word/document.xml')
    $lector = [IO.StreamReader]::new($entrada.Open())
    try { [xml]$xml = $lector.ReadToEnd() } finally { $lector.Dispose() }
    $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $cuerpo = $xml.SelectSingleNode('/w:document/w:body', $ns)
    $parrafos = @($cuerpo.SelectNodes('w:p', $ns))
    $tablas = @($cuerpo.SelectNodes('w:tbl', $ns))
    $seccion = $cuerpo.SelectSingleNode('w:sectPr', $ns)
    foreach ($nodo in @($cuerpo.ChildNodes)) {
      if ($nodo -ne $seccion) { [void]$cuerpo.RemoveChild($nodo) }
    }
    function TextoXml($nodo, [string]$valor) {
      $textos = @($nodo.SelectNodes('.//w:t', $ns))
      if (!$textos.Count) {
        $parrafo = $nodo.SelectSingleNode('w:p', $ns)
        $run = $xml.CreateElement('w', 'r', $ns.LookupNamespace('w'))
        $texto = $xml.CreateElement('w', 't', $ns.LookupNamespace('w'))
        [void]$parrafo.AppendChild($run)
        [void]$run.AppendChild($texto)
        $textos = @($texto)
      }
      $wordNs = $ns.LookupNamespace('w')
      $run = $textos[0].ParentNode
      $estilo = $run.SelectSingleNode('w:rPr', $ns)
      if (!$estilo) {
        $estilo = $xml.CreateElement('w', 'rPr', $wordNs)
        [void]$run.PrependChild($estilo)
      }
      $color = $estilo.SelectSingleNode('w:color', $ns)
      if (!$color) {
        $color = $xml.CreateElement('w', 'color', $wordNs)
        [void]$estilo.AppendChild($color)
      }
      $color.RemoveAllAttributes()
      $atributo = $xml.CreateAttribute('w', 'val', $wordNs)
      $atributo.Value = '000000'
      [void]$color.Attributes.Append($atributo)
      $textos[0].InnerText = $valor
      for ($i = 1; $i -lt $textos.Count; $i++) { $textos[$i].InnerText = '' }
    }
    function ParrafoRubrica([int]$indice, [string]$valor) {
      $copia = $parrafos[$indice].CloneNode($true)
      TextoXml $copia $valor
      [void]$cuerpo.InsertBefore($copia, $seccion)
    }
    function TablaRubrica($molde, $filas) {
      $tabla = $molde.CloneNode($true)
      $origen = @($tabla.SelectNodes('w:tr', $ns))
      foreach ($fila in $origen) { [void]$tabla.RemoveChild($fila) }
      for ($i = 0; $i -lt $filas.Count; $i++) {
        $j = if ($i -eq 0) { 0 } elseif ($i -eq $filas.Count - 1) { $origen.Count - 1 } else { 1 }
        $fila = $origen[$j].CloneNode($true)
        $celdas = @($fila.SelectNodes('w:tc', $ns))
        for ($col = 0; $col -lt 3; $col++) { TextoXml $celdas[$col] $filas[$i][$col] }
        [void]$tabla.AppendChild($fila)
      }
      [void]$cuerpo.InsertBefore($tabla, $seccion)
    }
    foreach ($parte in $datos.rubrica.partes) {
      ParrafoRubrica 0 'RÚBRICA DE EVALUACIÓN DE TRABAJO DE INTEGRACIÓN CURRICULAR'
      ParrafoRubrica 1 $parte.modalidad
      ParrafoRubrica 2 $parte.titulo
      ParrafoRubrica 3 $datos.rubrica.trabajo
      ParrafoRubrica 4 $datos.rubrica.estudiante
      ParrafoRubrica 5 $datos.rubrica.tutor
      foreach ($categoria in $parte.categorias) {
        ParrafoRubrica 6 $categoria.titulo
        TablaRubrica $tablas[0] $categoria.filas
      }
      ParrafoRubrica 6 $parte.total
      ParrafoRubrica 5 '________________________________'
      ParrafoRubrica 5 $datos.rubrica.firma
    }
    ParrafoRubrica 0 'RESUMEN DE LA EVALUACIÓN'
    TablaRubrica $tablas[-1] $datos.rubrica.resumen
    ParrafoRubrica 5 $datos.rubrica.estado
    $entrada.Delete()
    $flujo = $zip.CreateEntry('word/document.xml').Open()
    try { $xml.Save($flujo) } finally { $flujo.Dispose() }
  } finally { $zip.Dispose() }
}
Write-Output 'Iniciando Word'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$word.AutomationSecurity = 3
try {
  Write-Output 'Abriendo plantilla'
  $doc = $word.Documents.Open($datos.plantilla, $false, $true, $false)
  try {
    Write-Output 'Rellenando campos'
    $coincidencias = foreach ($cambio in $datos.cambios) {
      $rango = $doc.Content
      $ocurrencia = if ($cambio.ocurrencia) { [int]$cambio.ocurrencia } else { 1 }
      for ($i = 0; $i -lt $ocurrencia; $i++) {
        $buscar = $rango.Find
        $buscar.ClearFormatting()
        $buscar.Text = $cambio.original
        $buscar.MatchWildcards = $false
        $buscar.MatchCase = $true
        $buscar.Wrap = 0
        if (!$buscar.Execute()) { throw ('Falta un marcador en la plantilla: ' + $cambio.original) }
        if ($i + 1 -lt $ocurrencia) { $rango = $doc.Range($rango.End, $doc.Content.End) }
      }
      [pscustomobject]@{ Inicio = $rango.Start; Fin = $rango.End; Cambio = $cambio }
    }
    foreach ($item in ($coincidencias | Sort-Object Inicio -Descending)) {
      $rango = $doc.Range($item.Inicio, $item.Fin)
      if ($item.Cambio.letras) {
        $celda = $rango.Cells.Item(1).Next.Range
        $celda.End = $celda.End - 1
        $celda.Text = $item.Cambio.letras
      }
      $rango.Text = $item.Cambio.valor
    }
    if ($datos.rubrica) { $doc.Content.Font.Color = 0 }
    Write-Output 'Exportando PDF'
    $doc.ExportAsFixedFormat((Join-Path (Get-Location) 'acta.pdf'), 17)
  } finally { $doc.Close(0) }
} finally { $word.Quit(0) }
`;

export function rutaRecursoDocumental(nombre: string): string {
  let carpeta = __dirname;
  while (true) {
    const archivo = join(carpeta, 'docs', 's4', 'Plantillas-documentos', nombre);
    if (existsSync(archivo)) return archivo;
    const padre = dirname(carpeta);
    if (padre === carpeta) throw new Error(`Falta la plantilla original ${nombre}.`);
    carpeta = padre;
  }
}

export function camposPat04(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  const estudiante = datos.estudiantes.find(({ id }) => id === estudianteId);
  if (!estudiante) throw new Error('El estudiante no pertenece al trabajo.');
  const nombre = `${estudiante.nombres} ${estudiante.apellidos}`;
  const consolidacion = datos.consolidacion.estudiantes.find((item) => item.estudiante.id === estudianteId);
  const componente = (kind: string, scope: string) => {
    const etapas = consolidacion?.etapas ?? [];
    const aplicables = etapas.filter((etapa) => etapa.kind === kind || (etapa.kind === 'PERSONALIZADA' && etapa.scope === scope));
    return aplicables.length === 1 ? notaEtapaSobreDiez(aplicables[0]) : null;
  };
  const nota = (original: string, valor?: string | null) => ({
    original, valor: valor ? `${valor}/10` : 'Pendiente', letras: valor ? notaEnLetras(valor) : 'Pendiente',
  });
  return [
    { original: 'No……', valor: numero },
    { original: '… (opción de titulación)', valor: datos.trabajo.modalidad || 'Por confirmar' },
    { original: '… (NOMBRES DEL/LA ESTUDIANTE)', valor: nombre },
    { original: '...(identificación)', valor: estudiante.identificacion || 'Por confirmar' },
    { original: '“………”', valor: `“${datos.trabajo.titulo}”` },
    nota('7/10', componente('ESCRITA', 'TRABAJO_COMPARTIDO')),
    nota('9/10', componente('ORAL', 'ESTUDIANTE_INDIVIDUAL')),
    nota('16/20', final),
    { original: 'APROBADO', valor: final ? (aprobado ? 'APROBADO' : 'REPROBADO') : 'RESULTADO PENDIENTE' },
    { original: '… (NOMBRES).', valor: ` ${nombre}.` },
    { original: '………………….', valor: datos.trabajo.carrera || 'Por confirmar' },
  ];
}

export async function pdfPat04(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  return exportarPlantillaPdf(PLANTILLAS['PAT-04-F-017'].archivo, camposPat04(datos, estudianteId, numero, final, aprobado));
}

export function camposPat01(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  return camposPat04(datos, estudianteId, numero, final, aprobado).map((campo) => {
    const posicion = ['7/10', '9/10', '16/20'].indexOf(campo.original);
    if (posicion >= 0) return { ...campo, original: 'XX/10', ocurrencia: posicion + 1 };
    if (campo.original === 'No……') return { ...campo, original: 'No. ……' };
    if (campo.original === '… (opción de titulación)') return { ...campo, original: '… (modalidad de titulación)' };
    return campo;
  }).concat([{ original: '…(nombre del trabajo de titulación/examen complexivo)', valor: ` «${datos.trabajo.titulo}»` }]);
}

export function pdfPat01(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  return exportarPlantillaPdf(PLANTILLAS['PAT-01-F-019'].archivo, camposPat01(datos, estudianteId, numero, final, aprobado));
}

export async function exportarPlantillaPdf(
  archivo: string, cambios: ReadonlyArray<{ original: string; valor: string; letras?: string; ocurrencia?: number }>,
  rubrica?: object,
) {
  const carpeta = await mkdtemp(join(tmpdir(), 'genares-docx-'));
  try {
    const plantilla = join(carpeta, 'plantilla.docx');
    await writeFile(plantilla, await readFile(rutaRecursoDocumental(archivo)));
    await writeFile(join(carpeta, 'datos.json'), JSON.stringify({ plantilla, cambios, rubrica }));
    const instalado = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe');
    const powershell = process.env.GENARES_POWERSHELL_EXE?.trim() || (existsSync(instalado) ? instalado : 'pwsh.exe');
    const script = join(carpeta, 'exportar.ps1');
    await writeFile(script, '\uFEFF' + exportarWord, 'utf8');
    await ejecutar(powershell, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
    ], { cwd: carpeta, windowsHide: true, timeout: 45000 });
    return await readFile(join(carpeta, 'acta.pdf'));
  } catch (error) {
    const fallo = error as NodeJS.ErrnoException & { killed?: boolean };
    if (fallo.code === 'ENOENT' && fallo.syscall?.startsWith('spawn')) {
      throw new ServiceUnavailableException('No se encontró PowerShell 7 para exportar el PDF. Configure GENARES_POWERSHELL_EXE.');
    }
    if (fallo.killed) throw new ServiceUnavailableException('Word no terminó de exportar el PDF a tiempo.');
    throw error;
  } finally {
    await rm(carpeta, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => undefined);
  }
}
