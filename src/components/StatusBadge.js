const styles = {
  pending_payment: "bg-tan text-bark",
  pending_verification: "bg-tan text-bark",
  confirmed: "bg-sage text-forest",
  completed: "bg-sand text-muted",
  cancelled: "bg-rose/10 text-rose",
  no_show: "bg-rose/10 text-rose",
  submitted: "bg-tan text-bark",
  verified: "bg-sage text-forest",
  rejected: "bg-rose/10 text-rose",
  active: "bg-sage text-forest",
  inactive: "bg-sand text-muted",
};

const labels = {
  pending_payment: "Awaiting payment",
  pending_verification: "Verifying payment",
  no_show: "No-show",
};

export const statusLabel = (status) => labels[status] ?? status.replace(/_/g, " ");

export default function StatusBadge({ status }) {
  return <span className={`badge ${styles[status] ?? "bg-sand text-muted"}`}>{statusLabel(status)}</span>;
}
