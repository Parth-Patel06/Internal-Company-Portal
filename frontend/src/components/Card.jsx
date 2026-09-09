import { api } from "../api";

function Card({ n, t }) {
  return (
    <div className="card stat">
      <b>{n}</b>
      <span>{t}</span>
    </div>
  );
}

export default Card;
