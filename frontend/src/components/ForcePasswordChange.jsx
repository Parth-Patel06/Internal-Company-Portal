import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";
import triobyteLogo from "../Triobyte.jpeg";

function ForcePasswordChange({
  me,
  onPasswordChanged
}) {
  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (message !== "Password created successfully.") return;
    const timer = window.setTimeout(() => {
      setMessage("");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function updatePassword(e) {
    e.preventDefault();

    setMessage("");

    if (newPassword.length < 6) {
      setMessage(
        "Password must be at least 6 characters."
      );

      return;
    }

    if (
      newPassword !== confirmPassword
    ) {
      setMessage(
        "Passwords do not match."
      );

      return;
    }

    setLoading(true);

    try {
      await api(
        "/api/settings/password",
        {
          method: "PUT",

          body: {
            currentPassword: "",
            newPassword
          }
        }
      );

      setMessage(
        "Password created successfully."
      );

      await onPasswordChanged();

    } catch (err) {
      setMessage(
        err.message ||
        "Unable to update password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="loginCard">

        <img
          src={triobyteLogo}
          className="loginLogo"
        />

        <h1>Create new password</h1>

        <p>
          Your account was created with a
          default password. Please create
          your personal password to continue.
        </p>

        <form
          onSubmit={updatePassword}
        >
          <input
            type="password"
            placeholder="Create new password"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(
                e.target.value
              )
            }
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Updating..."
              : "Continue to Portal"}
          </button>
        </form>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <button
          type="button"
          className="link"
          onClick={() => {
            clearToken();
            window.location.reload();
          }}
        >
          Back to Login
        </button>

      </div>
    </div>
  );
}

export default ForcePasswordChange;
