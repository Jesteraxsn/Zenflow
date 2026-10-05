import PageIntro from "@/components/PageIntro";

const entries = [
  { tag: "Hilot", title: "What your body remembers", excerpt: "How the ancestral Filipino art of hilot works with the body's own rhythm to release tension stored over years.", read: "5 min read" },
  { tag: "Ritual", title: "Arriving before you arrive", excerpt: "Small habits for the hour before your treatment that make the time on the table go deeper.", read: "3 min read" },
  { tag: "Skin", title: "Calamansi, malunggay and your skin", excerpt: "The local botanicals behind our Dalisay facial, and why they suit tropical climates.", read: "4 min read" },
];

export default function JournalPage() {
  return (
    <>
      <PageIntro
        eyebrow="Wellness journal"
        title="Notes on rest and restoration."
        subtitle="Gentle reading from our therapists, between visits."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {entries.map((e) => (
          <article key={e.title} className="card flex flex-col p-6">
            <p className="eyebrow text-[10px]">{e.tag}</p>
            <h2 className="mt-2 font-serif text-2xl leading-snug">{e.title}</h2>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">{e.excerpt}</p>
            <p className="mt-4 text-[11px] text-muted">{e.read}</p>
          </article>
        ))}
      </div>
    </>
  );
}
