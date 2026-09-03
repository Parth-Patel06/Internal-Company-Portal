import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function CreateUser({
  id,
  currentRole
}) {
  const [form, setForm] = useState({
    role: "employee",
    default_password: "Demo@123",
  });

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (message.type !== "success" || !message.text) return;
    const timer = window.setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [message.type, message.text]);

  function setField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function createUser() {
  if (
    !form.full_name?.trim() ||
    !form.email?.trim()
  ) {
    setMessage({
      type: "error",
      text: "Full name and company email are required.",
    });

    return;
  }

  try {
    setCreating(true);

    setMessage({
      type: "",
      text: "",
    });

    await api("/api/users", {
      method: "POST",
      body: form,
    });

    setMessage({
      type: "success",
      text:
        `${form.role === "intern"
          ? "Intern"
          : "Employee"} account created successfully. ` +
        "Default password: Demo@123",
    });

    setForm({
      role: "employee",
      default_password: "Demo@123",
    });

    window.setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (err) {
    setMessage({
      type: "error",
      text:
        err.message ||
        "Unable to create the account.",
    });

  } finally {
    setCreating(false);
  }
}

  return (
    <div
      id={id}
      className="create hide card"
    >
      <h2>Create New Employee</h2>

      {message.text && (
  <div
    className={
      message.type === "success"
        ? "formMessage success"
        : "formMessage error"
    }
  >
    {message.text}
  </div>
)}

      <div className="formGrid">
        {[
          ["full_name", "Full name"],
          ["email", "Company email"],
          ["employee_id", "Employee ID"],
          ["department", "Department"],
          ["designation", "Designation"],
          ["mobile", "Mobile"],
        ].map(([key, placeholder]) => (
          <input
            key={key}
            placeholder={placeholder}
            value={form[key] || ""}
            onChange={(e) =>
              setField(key, e.target.value)
            }
          />
        ))}
      </div>

      <select
  value={form.role}
  onChange={(e) =>
    setField(
      "role",
      e.target.value.toLowerCase()
    )
  }
>
  <option value="employee">
    EMPLOYEE
  </option>

  <option value="intern">
    INTERN
  </option>

  {currentRole !== "HR" && (
    <>
      <option value="hr">
        HR
      </option>

      <option value="admin">
        ADMIN
      </option>
    </>
  )}
</select>

     <button
  className="primary"
  onClick={createUser}
  disabled={creating}
>
  {creating
    ? "Creating Account..."
    : "Create Account"}
</button>
    </div>
  );
}

export default CreateUser;
