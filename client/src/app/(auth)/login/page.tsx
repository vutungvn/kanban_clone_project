"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthHeader } from "@/components/auth-header";
import { useAuth } from "@/components/auth-provider";
import { ResendVerificationButton } from "@/components/resend-verification";
import { Alert, Field, PasswordField, SubmitButton } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { authHref, EMAIL_NOT_VERIFIED_STATUS, getSafeNextPath } from "@/lib/auth";

/** Thông báo xanh theo trang vừa chuyển tới: đăng ký xong / xác minh xong / đặt lại mật khẩu xong */
function noticeFrom(params: URLSearchParams) {
  if (params.get("verified") === "1") return "Email đã được xác minh! Đăng nhập để bắt đầu.";
  if (params.get("reset") === "1") return "Đã đặt mật khẩu mới. Hãy đăng nhập bằng mật khẩu mới.";
  if (params.get("registered") === "1") return "Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.";
  return null;
}

type FieldErrors = Partial<Record<"email" | "password", string>>;

export default function LoginPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";

  const [notice, setNotice] = useState(() => noticeFrom(searchParams));
  // Đúng mật khẩu nhưng email chưa xác minh → hiện nút gửi lại email
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearFieldError = (key: keyof FieldErrors) =>
    setFieldErrors((prev) =>
      prev[key] ? { ...prev, [key]: undefined } : prev,
    );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));

    const errors: FieldErrors = {};
    if (!email) errors.email = "Vui lòng nhập email";
    if (!password) errors.password = "Vui lòng nhập mật khẩu";
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setPending(true);
    setError(null);
    setUnverifiedEmail(null);
    try {
      await login({ email, password });
      router.replace(getSafeNextPath());
    } catch (err) {
      setNotice(null);
      if (err instanceof ApiError && err.status === EMAIL_NOT_VERIFIED_STATUS) setUnverifiedEmail(email);
      setError(
        err instanceof ApiError ? err.message : "Không thể kết nối tới máy chủ",
      );
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeader subtitle="Đăng nhập vào tài khoản của bạn" />

      {notice && (
        <div className="mb-4">
          <Alert tone="success" onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="nguyenvana@gmail.com"
          defaultValue={prefillEmail}
          error={fieldErrors.email}
          onChange={() => clearFieldError("email")}
          autoFocus={!prefillEmail}
        />
        <PasswordField
          id="password"
          label="Mật khẩu"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          error={fieldErrors.password}
          onChange={() => clearFieldError("password")}
          autoFocus={!!prefillEmail}
          labelAside={
            <Link
              href={authHref("/forgot-password", null, prefillEmail ? { email: prefillEmail } : {})}
              className="font-semibold text-brand hover:text-brand-hover hover:underline"
            >
              Quên mật khẩu?
            </Link>
          }
        />
        {error && <Alert tone="error">{error}</Alert>}
        {unverifiedEmail && (
          <ResendVerificationButton email={unverifiedEmail} next={searchParams.get("next")} />
        )}
        <SubmitButton pending={pending}>Đăng nhập</SubmitButton>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-ink-subtle">
        <span className="h-px flex-1 bg-surface-highest" />
        hoặc
        <span className="h-px flex-1 bg-surface-highest" />
      </div>

      <p className="text-center text-sm text-ink-subtle">
        Chưa có tài khoản?{" "}
        <Link
          href={authHref("/register", searchParams.get("next"))}
          className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
        >
          Đăng ký
        </Link>
      </p>
    </>
  );
}
