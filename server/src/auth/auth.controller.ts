import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ErrorResponseDto } from "../common/dto/error-response.dto";
import { UserResponseDto } from "../users/dto/user.dto";
import { UsersService } from "../users/users.service";
import { AuthCookiesService } from "./auth-cookies.service";
import { AuthService } from "./auth.service";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.types";
import type { AuthUser, RequestMeta } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

// Giới hạn chặt cho các endpoint dễ bị brute-force
const STRICT_LIMIT = { default: { limit: 5, ttl: 60_000 } };

function requestMeta(req: Request): RequestMeta {
  return {
    userAgent: req.headers["user-agent"]?.slice(0, 255),
    ipAddress: req.ip,
  };
}

const SET_AUTH_COOKIES = {
  "Set-Cookie": {
    description: `Cookie httpOnly \`${ACCESS_COOKIE}\` (JWT, 15 phút) và \`${REFRESH_COOKIE}\` (7 ngày)`,
    schema: { type: "string" },
  },
};

const VALIDATION_ERROR = {
  type: ErrorResponseDto,
  description: "Dữ liệu gửi lên không hợp lệ",
};
const TOO_MANY_REQUESTS = {
  type: ErrorResponseDto,
  description: "Vượt quá 5 request/phút/IP",
  example: {
    statusCode: 429,
    message: "ThrottlerException: Too Many Requests",
  },
};

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
    private readonly users: UsersService,
  ) {}

  @ApiOperation({
    summary: "Đăng ký tài khoản",
    description:
      "Chỉ tạo tài khoản, **không** tự đăng nhập — gọi `POST /auth/login` sau khi đăng ký.",
  })
  @ApiCreatedResponse({
    type: UserResponseDto,
    description: "Tạo tài khoản thành công",
  })
  @ApiBadRequestResponse({
    ...VALIDATION_ERROR,
    example: {
      statusCode: 400,
      message: ["Email không hợp lệ", "Mật khẩu tối thiểu 8 ký tự"],
      error: "Bad Request",
    },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: "Email đã tồn tại",
    example: {
      statusCode: 409,
      message: "Email đã được sử dụng",
      error: "Conflict",
    },
  })
  @ApiTooManyRequestsResponse(TOO_MANY_REQUESTS)
  @Throttle(STRICT_LIMIT)
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto);
    return { user };
  }

  @ApiOperation({
    summary: "Đăng nhập",
    description:
      "Tạo phiên đăng nhập mới và set cookie access/refresh token. Body trả về chỉ chứa thông tin user.",
  })
  @ApiOkResponse({
    type: UserResponseDto,
    description: "Đăng nhập thành công",
    headers: SET_AUTH_COOKIES,
  })
  @ApiBadRequestResponse({
    ...VALIDATION_ERROR,
    example: {
      statusCode: 400,
      message: ["Vui lòng nhập mật khẩu"],
      error: "Bad Request",
    },
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: "Sai email hoặc mật khẩu",
    example: {
      statusCode: 401,
      message: "Email hoặc mật khẩu không đúng",
      error: "Unauthorized",
    },
  })
  @ApiTooManyRequestsResponse(TOO_MANY_REQUESTS)
  @Throttle(STRICT_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(dto, requestMeta(req));
    this.cookies.set(res, tokens);
    return { user };
  }

  @ApiOperation({
    summary: "Làm mới access token",
    description:
      `Đọc cookie \`${REFRESH_COOKIE}\`, cấp access token mới và gia hạn phiên thêm 7 ngày. ` +
      "Client gọi endpoint này khi nhận 401 rồi thử lại request. Nếu thất bại, cả hai cookie bị xoá.",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({
    type: UserResponseDto,
    description: "Làm mới thành công",
    headers: SET_AUTH_COOKIES,
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: "Thiếu refresh token, token sai hoặc phiên đã hết hạn",
    example: {
      statusCode: 401,
      message: "Phiên đăng nhập đã hết hạn",
      error: "Unauthorized",
    },
  })
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    try {
      if (!refreshToken) throw new UnauthorizedException("Chưa đăng nhập");
      const { user, tokens } = await this.auth.refresh(
        refreshToken,
        requestMeta(req),
      );
      this.cookies.set(res, tokens);
      return { user };
    } catch (e) {
      // Xoá cookie hỏng để client không bị kẹt ở trạng thái "nửa đăng nhập"
      this.cookies.clear(res);
      throw e;
    }
  }

  @ApiOperation({
    summary: "Đăng xuất",
    description:
      "Xoá phiên trong DB (refresh token bị vô hiệu ngay) và xoá cookie. Luôn thành công kể cả khi chưa đăng nhập.",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiNoContentResponse({ description: "Đã đăng xuất" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (refreshToken) await this.auth.logout(refreshToken);
    this.cookies.clear(res);
  }

  @ApiOperation({ summary: "Thông tin user hiện tại" })
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      "Chưa đăng nhập, access token hết hạn/không hợp lệ, hoặc tài khoản đã bị xoá",
    example: {
      statusCode: 401,
      message: "Access token không hợp lệ hoặc đã hết hạn",
      error: "Unauthorized",
    },
  })
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.users.findById(authUser.id);
    if (!user) throw new UnauthorizedException("Tài khoản không tồn tại");
    return { user };
  }

  @ApiOperation({
    summary: "Token kết nối realtime",
    description:
      "JWT 60 giây, gửi trong `auth.token` khi mở socket namespace `/realtime`.",
  })
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiBearerAuth()
  @ApiOkResponse({
    schema: { type: "object", properties: { token: { type: "string" } } },
  })
  @UseGuards(JwtAuthGuard)
  @Get("socket-token")
  async socketToken(@CurrentUser() authUser: AuthUser) {
    return {
      token: await this.auth.signSocketToken(authUser.id, authUser.sessionId),
    };
  }
}
