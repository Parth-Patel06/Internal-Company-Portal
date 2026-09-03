import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function Card({ n, t }) {
  return (
    <div className="card stat">
      <b>{n}</b>
      <span>{t}</span>
    </div>
  );
}

export default Card;
