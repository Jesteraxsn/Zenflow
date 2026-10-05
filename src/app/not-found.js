import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-20 text-center">
        <div>
          <p className="eyebrow">404</p>
          <h1 className="mt-2 font-serif text-5xl">This path leads nowhere.</h1>
          <p className="mt-3 text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className="btn-primary">Back to home</Link>
            <Link href="/services" className="btn-outline">Browse treatments</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
