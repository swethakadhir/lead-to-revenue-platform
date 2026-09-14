"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">Email</label>
        <input autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2" id="email" name="email" required type="email" />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="password">Password</label>
        <input autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2" id="password" name="password" required type="password" />
      </div>
      {state.error ? <p aria-live="polite" className="text-sm text-red-700" role="alert">{state.error}</p> : null}
      <button className="w-full rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
