import Link from "next/link";
import Logo from "@/components/Logo";
import AccountLink from "@/components/AccountLink";
import ServicesPreview from "@/components/ServicesPreview";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-card">
      <header className="border-b border-line">
        <div className="mx-auto grid h-20 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <p className="hidden text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-muted sm:block">
            Iloilo City
            <br />
            <span className="font-normal">Est. 2024</span>
          </p>
          <div className="col-start-2">
            <Logo />
          </div>
          <nav className="col-start-3 flex items-center justify-end gap-5 text-xs">
            <Link href="/services" className="hidden hover:text-forest sm:inline">Services</Link>
            <a href="#sanctuary" className="hidden hover:text-forest sm:inline">Sanctuary</a>
            <AccountLink
              className="rounded-full border border-forest px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-forest hover:bg-sage"
              signedOutLabel="Portal Login"
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="font-serif text-5xl leading-tight text-forest-dark sm:text-6xl">
          To breathe, to heal, to find
        </h1>
        <p id="sanctuary" className="mt-5 max-w-3xl font-serif text-lg italic leading-relaxed text-ink/80">
          Step away from the daily noise and into a sanctuary crafted for total restoration. At Ginhawa, we
          harmonize Filipino hilot techniques with modern, personalized therapies to melt away tension and revitalize
          your spirit. Whether you are stopping in for a targeted deep-tissue massage or a nourishing facial, our
          therapists are here to help you breathe deeply, move comfortably, and simply feel renewed.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="eyebrow mb-4 text-ink">Services offered</h2>
            <div className="card p-6">
              <ServicesPreview />
              <Link href="/services" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
                View all services →
              </Link>
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-4 text-ink">Login</h2>
            <div className="flex h-[calc(100%-2rem)] min-h-64 flex-col items-center justify-center rounded-xl bg-[#4a3527] px-8 py-12 text-center shadow-lg">
              <p className="font-serif text-2xl italic text-white/90">Reserve your sacred time of restoration</p>
              <p className="mt-2 text-xs text-white/60">Pick a treatment, choose your therapist or let us match you, and pay securely online.</p>
              <Link
                href="/book"
                className="mt-6 w-full max-w-md rounded-md bg-forest py-3.5 text-sm font-semibold uppercase tracking-widest text-white transition hover:bg-forest-dark"
              >
                Book Now
              </Link>
              <p className="mt-4 text-[11px] text-white/60">
                Already have an account?{" "}
                <Link href="/login" className="underline hover:text-white">Log in to the portal</Link>
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-espresso text-white/75">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs font-serif text-sm italic text-white/60">
              &ldquo;Ancestral touch, modern calm. A sanctuary for body, mind and spirit in the heart of Iloilo.&rdquo;
            </p>
          </div>
          <div className="text-xs">
            <p className="eyebrow mb-3 text-white">Hours of sanctuary</p>
            <p>Monday – Thursday</p>
            <p className="mb-2 text-white/50">1:00 PM – 10:00 PM</p>
            <p>Friday – Sunday</p>
            <p className="text-white/50">10:00 AM – 11:00 PM</p>
          </div>
          <div className="text-xs">
            <p className="eyebrow mb-3 text-white">The sanctuary</p>
            <p>Luna St., La Paz</p>
            <p className="mb-2">Iloilo City</p>
            <p>+63 917 482 3361</p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-[11px] text-white/50 sm:flex-row sm:justify-between sm:px-6">
            <p>© 2026 Ginhawa Wellness Sanctuary. All rights reserved.</p>
            <p className="flex gap-5">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Powered by ZenFlow</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
