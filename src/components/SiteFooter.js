export default function SiteFooter({ left = "Breathe deeply. Return to yourself." }) {
  return (
    <footer className="mt-auto bg-bark text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-serif text-sm italic">{left}</p>
        <p>© 2026 Ginhawa Sanctuary · Iloilo City, Philippines · Powered by ZenFlow</p>
      </div>
    </footer>
  );
}
