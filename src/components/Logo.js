import Link from "next/link";

export default function Logo({ href = "/", light = false, mark = false, subtitle = "Spa & Wellness Sanctuary" }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      {mark && (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-forest font-serif text-lg text-white">
          G
        </span>
      )}
      <span className="leading-none">
        <span
          className={`block font-serif text-xl tracking-[0.18em] ${light ? "text-white" : "text-forest-dark"}`}
        >
          GINHAWA
        </span>
        <span
          className={`mt-1 block text-[8px] font-medium uppercase tracking-[0.2em] ${
            light ? "text-white/60" : "text-muted"
          }`}
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
