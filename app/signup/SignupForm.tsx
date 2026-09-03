"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signup } from "@/app/actions/auth";

const inputClassName = "njl-auth-input";

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, undefined);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordMessage =
    passwordError ??
    (state?.error === "weak_password" ? "At least 6 characters" : null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");

    if (typeof password !== "string" || password.length < 6) {
      event.preventDefault();
      setPasswordError("At least 6 characters");
      return;
    }

    setPasswordError(null);
  }

  return (
    <div className="auth-wrap">
      <style>{`
        .auth-wrap {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          padding: 52px 26px 30px;
          color: #fff;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
        }
        .auth-glow {
          position: absolute;
          top: -90px;
          right: -90px;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(25, 118, 210, 0.45) 0%, rgba(25, 118, 210, 0) 70%);
          pointer-events: none;
        }
        .auth-mark { margin-bottom: 26px; }
        .auth-h1 {
          font-family: var(--font-archivo);
          font-size: 23px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 5px;
        }
        .auth-sub {
          font-size: 13px;
          color: #b5d4f4;
          line-height: 1.5;
          margin-bottom: 26px;
        }
        .auth-field { margin-bottom: 14px; }
        .auth-field label {
          font-size: 11.5px;
          font-weight: 600;
          color: #cfe1f5;
          display: block;
          margin-bottom: 5px;
        }
        .${inputClassName} {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          padding: 11px 12px;
          color: #fff;
          font-size: 13.5px;
          font-family: var(--font-work-sans);
        }
        .${inputClassName}::placeholder { color: rgba(255, 255, 255, 0.35); }
        .${inputClassName}:focus { outline: 2px solid #1976d2; border-color: #1976d2; }
        .auth-helper {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 5px;
        }
        .auth-error { color: #ffb4ab; }
        .alert {
          display: flex;
          gap: 9px;
          padding: 11px 12px;
          margin-bottom: 16px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
          align-items: flex-start;
          background: #fbf0dc;
          color: #8a5608;
        }
        .alert svg { flex: none; margin-top: 1px; }
        .auth-link { color: #b5d4f4; font-size: 12.5px; font-weight: 600; }
        .auth-foot {
          margin-top: auto;
          padding-top: 22px;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.55);
          text-align: center;
        }
        .btn {
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          padding: 13px 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          background: #1976d2;
          color: #fff;
          cursor: pointer;
        }
        .btn:disabled { cursor: wait; opacity: 0.7; }
      `}</style>

      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-mark" aria-label="NextJobLog">
        <svg width="40" height="40" viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r="62" fill="#042C53" />
          <path d="M28 96 C 45 60, 60 100, 78 55 C 88 32, 96 48, 104 40" fill="none" stroke="#B5D4F4" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 12" />
          <circle cx="104" cy="40" r="15" fill="#1976D2" />
          <path d="M97 40 l5 5 l10 -11" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="auth-h1">Create Your NextJobLog Account</div>
      <div className="auth-sub">Your application data is encrypted and visible only to you.</div>

      {state?.error === "duplicate_email" && (
        <div className="alert" role="alert">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3l9 17H3L12 3z" stroke="#8a5608" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 10v4M12 17h.01" stroke="#8a5608" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>
            This email is already in use — <Link className="auth-link" href="/login" style={{ textDecoration: "underline" }}>Log In</Link> instead
          </span>
        </div>
      )}

      {state?.error === "unknown" && (
        <div className="alert auth-error" role="alert">
          {state.message}
        </div>
      )}

      <form action={formAction} onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input className={inputClassName} id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input className={inputClassName} id="password" name="password" type="password" placeholder="••••••••" required aria-invalid={passwordMessage !== null} />
          {passwordMessage ? (
            <div className="auth-helper auth-error">{passwordMessage}</div>
          ) : (
            <div className="auth-helper">At least 6 characters</div>
          )}
        </div>
        <div style={{ marginTop: 6, marginBottom: 20 }} />
        <button className="btn" type="submit" disabled={isPending}>
          {isPending ? "Creating account…" : "Sign Up"}
        </button>
      </form>

      <div className="auth-foot">
        Already have an account? <Link className="auth-link" href="/login">Log In</Link>
      </div>
    </div>
  );
}
