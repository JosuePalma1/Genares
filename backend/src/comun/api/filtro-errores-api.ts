import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

interface RespuestaExcepcion {
  message?: unknown;
}

@Catch()
export class FiltroErroresApi implements ExceptionFilter {
  catch(excepcion: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<{
      status: (codigo: number) => { json: (body: unknown) => void };
    }>();
    const solicitud = contexto.getRequest<{ path?: string; originalUrl?: string; url?: string }>();
    const esHttp = excepcion instanceof HttpException;
    const statusCode = esHttp ? excepcion.getStatus() : 500;
    const cuerpoHttp = esHttp ? excepcion.getResponse() : undefined;
    const mensajeOriginal = this.obtenerMensaje(cuerpoHttp);
    const detalles = statusCode === 400 && Array.isArray(mensajeOriginal)
      ? mensajeOriginal.filter((elemento): elemento is string => typeof elemento === 'string')
      : undefined;

    const cuerpo = {
      statusCode,
      code: this.obtenerCodigo(statusCode, detalles),
      message: this.obtenerMensajePublico(statusCode),
      ...(detalles?.length ? { details: detalles } : {}),
      path: solicitud?.path ?? solicitud?.url ?? solicitud?.originalUrl ?? '/',
      timestamp: new Date().toISOString(),
    };

    respuesta.status(statusCode).json(cuerpo);
  }

  private obtenerMensaje(cuerpo: unknown): unknown {
    if (typeof cuerpo !== 'object' || cuerpo === null || !('message' in cuerpo)) return undefined;
    return (cuerpo as RespuestaExcepcion).message;
  }

  private obtenerCodigo(statusCode: number, detalles?: string[]): string {
    if (statusCode === 400 && detalles?.length) return 'VALIDATION_ERROR';
    const codigos: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_REQUEST',
      429: 'TOO_MANY_REQUESTS',
    };
    return codigos[statusCode] ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  }

  private obtenerMensajePublico(statusCode: number): string {
    const mensajes: Record<number, string> = {
      400: 'La solicitud no es válida.',
      401: 'Se requiere una identidad válida.',
      403: 'Acceso denegado.',
      404: 'Recurso no encontrado.',
      409: 'La solicitud entra en conflicto con el estado actual.',
      422: 'La solicitud no se puede procesar.',
      429: 'Se recibieron demasiadas solicitudes.',
    };
    return statusCode >= 500
      ? 'Error interno del servidor.'
      : mensajes[statusCode] ?? 'No se pudo procesar la solicitud.';
  }
}
