import { INestApplication, VersioningType, ValidationPipe } from '@nestjs/common';

export function configurarAplicacionApi(aplicacion: INestApplication): void {
  aplicacion.setGlobalPrefix('api');
  aplicacion.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  aplicacion.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
  }));
}
