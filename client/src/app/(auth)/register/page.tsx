"use client";

import { KeyRound, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthHeader } from "@/components/auth-header";
import { useAuth } from "@/components/auth-provider";
import { Alert, Field, PasswordField, SubmitButton } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { authHref } from "@/lib/auth";

type FormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};
type FieldErrors = Partial<Record<keyof FormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Khớp với rule của RegisterDto trên server
function validate(v: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!v.name) errors.name = "Vui lòng nhập họ tên";
  else if (v.name.length > 50) errors.name = "Tên tối đa 50 ký tự";
  if (!EMAIL_RE.test(v.email)) errors.email = "Email không hợp lệ";
  if (v.password.length < 8) errors.password = "Mật khẩu tối thiểu 8 ký tự";
  else if (v.password.length > 72) errors.password = "Mật khẩu tối đa 72 ký tự";
  if (v.confirmPassword !== v.password)
    errors.confirmPassword = "Mật khẩu nhập lại không khớp";
  return errors;
}

export default function RegisterPage() {
  // useSearchParams cần Suspense boundary khi build
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  // Đến từ liên kết mời → đăng ký xong, đăng nhập rồi quay lại đúng trang đó
  const next = useSearchParams().get("next");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearFieldError = (key: keyof FormValues) =>
    setFieldErrors((prev) =>
      prev[key] ? { ...prev, [key]: undefined } : prev,
    );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values: FormValues = {
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      confirmPassword: String(form.get("confirmPassword")),
    };

    const errors = validate(values);
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setPending(true);
    setError(null);
    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      router.replace(
        authHref("/login", next, { registered: "1", email: values.email }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Email đã tồn tại → báo ngay tại ô email
        setFieldErrors({ email: err.message });
        document.getElementById("email")?.focus();
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "Không thể kết nối tới máy chủ",
        );
      }
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeader subtitle="Tạo tài khoản mới" />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          id="name"
          label="Họ tên"
          icon={User}
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          maxLength={50}
          error={fieldErrors.name}
          onChange={() => clearFieldError("name")}
          autoFocus
        />
        <Field
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="nguyenvana@gmail.com"
          error={fieldErrors.email}
          onChange={() => clearFieldError("email")}
        />
        <PasswordField
          id="password"
          label="Mật khẩu"
          icon={Lock}
          autoComplete="new-password"
          hint="Tối thiểu 8 ký tự"
          placeholder="Nhập mật khẩu"
          error={fieldErrors.password}
          onChange={() => clearFieldError("password")}
        />
        <PasswordField
          id="confirmPassword"
          label="Nhập lại mật khẩu"
          icon={KeyRound}
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          labelAside={fieldErrors.confirmPassword ? "Không khớp" : undefined}
          error={fieldErrors.confirmPassword}
          onChange={() => clearFieldError("confirmPassword")}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <SubmitButton pending={pending}>Đăng ký</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Đã có tài khoản?{" "}
        <Link
          href={authHref("/login", next)}
          className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
