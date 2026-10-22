import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { requestContextMiddleware } from "./realtime/request-context";
import { SocketAdapter } from "./realtime/socket.adapter";
import { setupSwagger, SWAGGER_PATH } from "./swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const clientUrl = config.get("CLIENT_URL", "http://localhost:3000");
  app.setGlobalPrefix("api");

  // Chạy sau proxy (Vercel → Render): lấy IP thật từ X-Forwarded-For,
  // để rate limit tính theo từng người dùng chứ không theo IP của proxy
  app.set("trust proxy", true);

  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.enableCors({ origin: clientUrl, credentials: true });
  app.useWebSocketAdapter(new SocketAdapter(app, clientUrl));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const swaggerEnabled =
    config.get(
      "SWAGGER_ENABLED",
      String(process.env.NODE_ENV !== "production"),
    ) === "true";
  if (swaggerEnabled) setupSwagger(app);

  const port = Number(config.get("PORT", 4000));
  await app.listen(port);
  console.log(`API running at http://localhost:${port}/api`);
  if (swaggerEnabled)
    console.log(`Swagger UI at http://localhost:${port}/${SWAGGER_PATH}`);
}

void bootstrap();
