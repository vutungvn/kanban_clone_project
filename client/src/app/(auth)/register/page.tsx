"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Field, FormError, SubmitButton } from "@/components/ui";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const password = String(form.get("password"));
    if (password !== form.get("confirmPassword")) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }

    setPending(true);
    setError(null);
    const email = String(form.get("email"));

    try {
      await register({ name: String(form.get("name")), email, password });
      router.replace(
        `/login?${new URLSearchParams({ registered: "1", email })}`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể kết nối tới máy chủ",
      );
      setPending(false);
    }
  }

  return (
    <>
      <h2 className="mb-4 text-center text-sm text-slate-500">
        Tạo tài khoản mới
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Họ tên"
          id="name"
          autoComplete="name"
          maxLength={50}
          required
          autoFocus
        />
        <Field
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Mật khẩu"
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <Field
          label="Nhập lại mật khẩu"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Đăng ký</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
