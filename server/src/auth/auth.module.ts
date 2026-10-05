import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: Number(config.get('ACCESS_TOKEN_TTL_MINUTES', 15)) * 60 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookiesService, JwtAuthGuard],
  // Export để các module sau (boards, socket gateway) dùng lại guard
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
