import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentidadApi, SolicitudConIdentidad } from './identidad-api';
import { CLAVE_CAPACIDADES_REQUERIDAS, CLAVE_RUTA_PUBLICA } from './metadatos-api';

@Injectable()
export class GuardiaCapacidades implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const handler = contexto.getHandler();
    const controller = contexto.getClass();
    const solicitud = contexto.switchToHttp().getRequest<SolicitudConIdentidad & { method?: string }>();
    const identidad = solicitud?.identidadApi;
    const publica = this.reflector.getAllAndOverride<boolean>(CLAVE_RUTA_PUBLICA, [handler, controller]);
    if (publica) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(solicitud?.method ?? '')) {
        throw new ForbiddenException('Las rutas públicas solo pueden ser de lectura.');
      }
      return true;
    }

    const capacidades = this.reflector.getAllAndOverride<string[]>(CLAVE_CAPACIDADES_REQUERIDAS, [handler, controller]);
    if (!capacidades?.length) {
      throw new ForbiddenException('La ruta no tiene una política de acceso configurada.');
    }

    if (
      !identidad
      || typeof identidad.sujeto !== 'string'
      || identidad.sujeto.length === 0
      || !Array.isArray(identidad.capacidades)
      || !identidad.capacidades.every((capacidad) => typeof capacidad === 'string')
    ) {
      throw new UnauthorizedException('Se requiere una identidad verificada.');
    }

    if (identidad.tipo !== 'VERIFICADA') {
      if (identidad.tipo === 'DESARROLLO_LOCAL' && ['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
        const capacidadesOtorgadas = new Set(identidad.capacidades);
        if (!capacidades.every((capacidad) => capacidadesOtorgadas.has(capacidad))) {
          throw new ForbiddenException('La operación no está disponible en el entorno local.');
        }
        return true;
      }
      throw new UnauthorizedException('La identidad no es válida.');
    }

    const capacidadesOtorgadas = new Set(identidad.capacidades);
    if (!capacidades.every((capacidad) => capacidadesOtorgadas.has(capacidad))) {
      throw new ForbiddenException('La identidad no tiene las capacidades requeridas.');
    }

    return true;
  }
}
