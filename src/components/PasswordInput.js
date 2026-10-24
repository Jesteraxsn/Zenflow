"use client";

import { useState } from "react";
import Icon from "./Icon";

// Password input with a show/hide toggle on the right.
export default function PasswordInput({ className = "", ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted hover:text-forest"
      >
        <Icon name={shown ? "eyeOff" : "eye"} size={16} />
      </button>
    </div>
  );
}
