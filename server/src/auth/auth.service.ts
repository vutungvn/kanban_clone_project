import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash, hashSync } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PublicUser, toPublicUser, UsersService } from "../users/users.service";
import { AuthTokens, JwtPayload, RequestMeta } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const BCRYPT_ROUNDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function safeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  // So sánh với hash giả khi email không tồn tại để thời gian phản hồi như nhau (chống dò email)
  private readonly dummyHash = hashSync(
    "timing-safe-dummy-password",
    BCRYPT_ROUNDS,
  );
  private readonly refreshTtlMs: number;

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.refreshTtlMs =
      Number(config.get("REFRESH_TOKEN_TTL_DAYS", 7)) * DAY_MS;
  }

  /** Chỉ tạo tài khoản, không tự đăng nhập — người dùng phải đăng nhập lại. */
  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    return this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const valid = await compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !valid) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }
    const tokens = await this.createSession(user.id, meta);
    return { user: toPublicUser(user), tokens };
  }

  /** Cấp access token mới và gia hạn (sliding) session. */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthResult> {
    const session = await this.findValidSession(refreshToken);
    const user = await this.users.findById(session.userId);
    if (!user) throw new UnauthorizedException("Phiên đăng nhập không hợp lệ");

    await this.prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + this.refreshTtlMs), ...meta },
    });

    const accessToken = await this.signAccessToken(user.id, session.id);
    return { user, tokens: { accessToken, refreshToken } };
  }

  async logout(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) return;
    await this.prisma.session.deleteMany({
      where: { id: parsed.sessionId, tokenHash: sha256(parsed.secret) },
    });
  }

  private async createSession(
    userId: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const secret = randomBytes(32).toString("base64url");
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(secret),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        ...meta,
      },
    });
    return {
      accessToken: await this.signAccessToken(userId, session.id),
      refreshToken: `${session.id}.${secret}`,
    };
  }

  private async findValidSession(refreshToken: string) {
    const invalid = new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) throw invalid;

    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!session || !safeEqualHex(session.tokenHash, sha256(parsed.secret)))
      throw invalid;

    if (session.expiresAt < new Date()) {
      await this.prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
      throw invalid;
    }
    return session;
  }

  private parseRefreshToken(token: string) {
    const [sessionId, secret] = token.split(".");
    return sessionId && secret ? { sessionId, secret } : null;
  }

  /** Token 60 giây để mở socket khi client và API khác domain (socket không gửi được cookie). */
  signSocketToken(userId: string, sessionId: string) {
    const payload: JwtPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload, { expiresIn: 60 });
  }

  private signAccessToken(userId: string, sessionId: string) {
    const payload: JwtPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload);
  }
}
