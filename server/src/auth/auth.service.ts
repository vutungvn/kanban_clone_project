import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash, hashSync } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { PublicUser, toPublicUser, UsersService } from "../users/users.service";
import { AuthTokens, JwtPayload, RequestMeta } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import type { ChangePasswordDto } from "./dto/account.dto";
import { RegisterDto } from "./dto/register.dto";
import { SessionRevocations } from "./session-revocations";

export const SESSION_NOT_FOUND = "Không tìm thấy phiên đăng nhập";
export const CANNOT_REVOKE_CURRENT =
  "Đây là phiên hiện tại — hãy dùng Đăng xuất";
export const WRONG_PASSWORD = "Mật khẩu hiện tại không đúng";
export const SAME_PASSWORD = "Mật khẩu mới phải khác mật khẩu hiện tại";

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
    private readonly revocations: SessionRevocations,
    private readonly realtime: RealtimeService,
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
      data: {
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        lastActiveAt: new Date(),
        ...meta,
      },
    });

    const accessToken = await this.signAccessToken(user.id, session.id);
    return { user, tokens: { accessToken, refreshToken } };
  }

  async logout(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) return;
    const { count } = await this.prisma.session.deleteMany({
      where: { id: parsed.sessionId, tokenHash: sha256(parsed.secret) },
    });
    if (count) this.revocations.add([parsed.sessionId]);
  }

  /** Các phiên còn hạn của user: phiên hiện tại trước, rồi theo lần hoạt động gần nhất. */
  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });
    return sessions
      .map((s) => ({ ...s, current: s.id === currentSessionId }))
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  /** Đăng xuất 1 thiết bị khác. Phiên hiện tại thì dùng /auth/logout (cần xoá cả cookie). */
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ) {
    if (sessionId === currentSessionId)
      throw new BadRequestException(CANNOT_REVOKE_CURRENT);
    const { count } = await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
    if (!count) throw new NotFoundException(SESSION_NOT_FOUND);
    await this.revoke(userId, [sessionId]);
  }

  /** Đăng xuất mọi thiết bị khác. Trả về số phiên đã đăng xuất. */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const others = await this.prisma.session.findMany({
      where: { userId, NOT: { id: currentSessionId } },
      select: { id: true },
    });
    const ids = others.map((s) => s.id);
    await this.prisma.session.deleteMany({ where: { id: { in: ids } } });
    await this.revoke(userId, ids);
    return ids.length;
  }

  /** Đổi mật khẩu (cần mật khẩu hiện tại) rồi đăng xuất mọi thiết bị khác. */
  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException("Tài khoản không tồn tại");
    // 400 chứ không phải 401: client gặp 401 sẽ tưởng hết phiên và tự refresh
    if (!(await compare(dto.currentPassword, user.passwordHash)))
      throw new BadRequestException(WRONG_PASSWORD);
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException(SAME_PASSWORD);
    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return this.revokeOtherSessions(userId, currentSessionId);
  }

  /** Access token của các phiên này hết hiệu lực ngay; tab đang mở của chúng tự đăng xuất. */
  private async revoke(userId: string, sessionIds: string[]) {
    if (!sessionIds.length) return;
    this.revocations.add(sessionIds);
    await this.realtime.sessionsRevoked(userId, sessionIds);
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
