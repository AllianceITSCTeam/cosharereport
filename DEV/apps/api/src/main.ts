import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => ReturnType<typeof import('cookie-parser')>;
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', true);

  // CORS — only needed in dev (Vite proxy handles it in prod)
  if (!isProd) {
    app.enableCors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5391',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });
  }

  app.use(cookieParser());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.setGlobalPrefix('api', { exclude: ['sso'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('CoShare Report API')
    .setDescription('Readonly reporting API over the CoShare database')
    .setVersion('1.0')
    .addCookieAuth('coshare_report_session', { type: 'apiKey', in: 'cookie', name: 'coshare_report_session' }, 'Cookie')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('bootstrap');
  logger.log(`CoShare Report API running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
