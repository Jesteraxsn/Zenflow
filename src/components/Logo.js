import Image from "next/image";
import Link from "next/link";

// `mark` shows the round Ginhawa "G"; `mark="zenflow"` shows the ZenFlow system logo beside the name.
export default function Logo({ href = "/", light = false, mark = false, subtitle = "Spa & Wellness Sanctuary" }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      {mark === "zenflow" ? (
        <Image src="/zenflow-mark.png" alt="ZenFlow" width={40} height={40} className="h-10 w-10" priority />
      ) : (
        mark && (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-forest font-serif text-lg text-white">
            G
          </span>
        )
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
