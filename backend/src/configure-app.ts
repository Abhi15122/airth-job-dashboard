import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpErrorFilter } from './http-error.filter';

export function configureApp(app: INestApplication) {
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  }));
}
