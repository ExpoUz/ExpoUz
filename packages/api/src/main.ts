import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('v1');

  // Behind Railway's edge, trust X-Forwarded-For so req.ip is the real client
  // IP. Railway is the only ingress (the container isn't reachable directly), so
  // trusting the proxy chain is safe. Without this the rate limiter keys every
  // request under a varying edge address and never accumulates (throttle no-op).
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('ExpoUz API')
    .setDescription('Sports matchmaking and booking platform for Uzbekistan')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 ExpoUz API running on port ${port}`);
}
bootstrap();
