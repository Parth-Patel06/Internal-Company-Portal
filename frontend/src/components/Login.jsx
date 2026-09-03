import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

import triobyteLogo from "../Triobyte.jpeg";
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setMessage("Please enter your company email and password.");
      return;
    }

    clearToken();

    setLoading(true);
    setMessage("");

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: {
          email: cleanEmail,
          password,
        },
      });

      if (!data.token) {
        throw new Error("Login succeeded but token was not returned.");
      }

      setToken(data.token);
      await onLogin();
    } catch (err) {
      clearToken();
      setMessage(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMessage("Enter your company email first.");
      return;
    }

    try {
      setMessage("");

      const result = await api("/auth/forgot-password", {
        method: "POST",
        body: {
          email: cleanEmail,
        },
      });

      setMessage(
        result.message || "Password reset request submitted."
      );
    } catch (err) {
      setMessage(
        err.message || "Unable to process request."
      );
    }
  }

  return (
    <div className="login">
      <div className="loginBackdrop">
        <span className="loginOrb orbOne" />
        <span className="loginOrb orbTwo" />
        <span className="loginGrid" />
      </div>

      <div className="loginShell">

        <div className="loginIntro">

          <div className="loginBrandLockup">
            <img
              src={triobyteLogo}
              className="loginIntroLogo"
              alt="TrioByte Technology"
            />

            <div className="loginBrandText">
              <div className="loginBrandName">
                TRIOBYTE
              </div>

              <div className="loginBrandTagline">
                TECHNOLOGY
              </div>
            </div>
          </div>

          <div>
            <span className="loginKicker">
              ONE WORKSPACE. ONE FLOW.
            </span>

            <h1>
              Work together.
              <br />
              Move forward.
            </h1>

            <p>
              A focused workspace for projects, people,
              progress, and everything that keeps TrioByte moving.
            </p>
          </div>

          <div className="loginFeatureList">
            <span>Projects</span>
            <span>People</span>
            <span>Progress</span>
          </div>

        </div>

        <div className="loginCard">

          <img
            src={triobyteLogo}
            className="loginLogo"
            alt="TrioByte Technology"
          />

          <h1>Welcome back</h1>

          <p>
            Sign in to your company portal
          </p>

          <form
            onSubmit={login}
            autoComplete="off"
          >

            <input
              type="email"
              name="company-login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Company email"
              autoComplete="off"
              spellCheck="false"
            />

            <input
              type="password"
              name="company-login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing In..."
                : "Sign In"}
            </button>

          </form>

          <button
            type="button"
            className="link"
            onClick={forgotPassword}
          >
            Forgot Password?
          </button>

          {message && (
            <div className="notice">
              {message}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Login;
