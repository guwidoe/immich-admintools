import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);

  app.enableCors({
    origin: configService.get<string>('corsOrigin', '*'),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  try {
    await app.listen(port);
    console.log(`🚀 Immich Admin Tools server running on http://localhost:${port}`);
  } catch (error) {
    const listenError = error as NodeJS.ErrnoException;

    if (listenError.code === 'EADDRINUSE') {
      console.error(
        `[Server] Port ${port} is already in use. Update PORT in .env to a free port (for example 3101) and restart pnpm dev.`,
      );
    }

    await app.close().catch(() => undefined);
    throw error;
  }
}

bootstrap();
