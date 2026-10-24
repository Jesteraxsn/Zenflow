import Icon from "./Icon";
import PasswordInput from "./PasswordInput";

// Text input with a leading icon, matching the auth form style.
export default function Field({ label, icon, id, ...props }) {
  const Input = props.type === "password" ? PasswordInput : "input";
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        {icon && (
          <Icon name={icon} size={15} className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-muted" />
        )}
        <Input id={id} className={`input ${icon ? "pl-10" : ""}`} {...props} />
      </div>
    </div>
  );
}
