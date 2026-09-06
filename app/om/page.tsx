import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Om, metod och integritet | SuperSafe',
  description:
    'Så fungerar SuperSafe, vilka källor som används och hur tjänsten hanterar integritet och ansvar.',
  alternates: { canonical: '/om' },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        Hoppa till innehållet
      </a>
      <header className="site-header border-b border-white/8 bg-[#071410]/95 text-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="SuperSafe – gå till startsidan"
          >
            <span className="brand-mark">
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold tracking-[-0.03em]">SuperSafe</p>
              <p className="text-xs uppercase tracking-[0.15em] text-emerald-100/65">
                Fondinnehav
              </p>
            </div>
          </Link>
          <Link className="trust-back" href="/">
            <ArrowLeft aria-hidden="true" className="size-4" /> Till sökningen
          </Link>
        </div>
      </header>

      <main id="main-content" className="trust-page">
        <section className="trust-hero" aria-labelledby="trust-title">
          <div>
            <p className="trust-kicker">Transparens före löften</p>
            <h1 id="trust-title">Så fungerar SuperSafe.</h1>
            <p>
              Här beskriver vi vad tjänsten visar, var informationen kommer
              ifrån, vad som stannar i din webbläsare och vilka begränsningar du
              behöver känna till.
            </p>
            <nav className="trust-nav" aria-label="Innehåll på sidan">
              <a href="#om">Om tjänsten</a>
              <a href="#metod">Metod och källor</a>
              <a href="#integritet">Integritet</a>
              <a href="#ansvar">Ansvar</a>
              <a href="#kontakt">Kontakt</a>
            </nav>
          </div>
        </section>

        <div className="trust-content">
          <section
            id="om"
            className="trust-section"
            aria-labelledby="about-title"
          >
            <h2 id="about-title">Om tjänsten</h2>
            <p>
              SuperSafe är en fristående fondanalys-pilot som gör offentligt
              rapporterade fondinnehav lättare att läsa. Tjänsten hjälper dig
              att undersöka vad en fond ägde på rapportdagen, hur koncentrerade
              de största innehaven var och var flera fonder överlappar.
            </p>
            <p className="trust-note">
              SuperSafe säljer inga fonder, tar inte emot sparpengar och är inte
              knutet till Finansinspektionen eller Pensionsmyndigheten.
            </p>
          </section>

          <section
            id="metod"
            className="trust-section"
            aria-labelledby="method-title"
          >
            <h2 id="method-title">Metod och källor</h2>
            <p>
              Fondinnehav hämtas från Finansinspektionens öppna
              kvartalsregister. PPM-avgifter hämtas separat från
              Pensionsmyndighetens fondtorg. Källorna blandas inte ihop och
              varje resultat visar vilket datum uppgiften avser, när den
              publicerades och när SuperSafe hämtade den.
            </p>
            <ul>
              <li>Innehavsvikter skalas inte upp till 100 procent.</li>
              <li>Saknade uppgifter markeras i stället för att uppskattas.</li>
              <li>Jämförelser använder identifierade ISIN när sådana finns.</li>
              <li>Avgiftskalkylen är ett förenklat räkneexempel.</li>
            </ul>
            <h3>Officiella källor</h3>
            <p>
              <a
                href="https://www.fi.se/sv/vara-register/fondinnehav-per-kvartal/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Finansinspektionens fondinnehav{' '}
                <ExternalLink aria-hidden="true" className="inline size-4" />
              </a>{' '}
              och{' '}
              <a
                href="https://www.pensionsmyndigheten.se/service/fondtorg/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Pensionsmyndighetens fondtorg{' '}
                <ExternalLink aria-hidden="true" className="inline size-4" />
              </a>
              .
            </p>
          </section>

          <section
            id="integritet"
            className="trust-section"
            aria-labelledby="privacy-title"
          >
            <h2 id="privacy-title">Integritet</h2>
            <p>
              Du behöver inget konto. Sökord, val i jämförelser, portföljandelar
              och värden i avgiftskalkylen skickas inte till SuperSafe för att
              sparas. Funktionen Mina fonder lagrar endast fondens källa,
              identifierare och namn lokalt i din webbläsare.
            </p>
            <ul>
              <li>Ingen reklamspårning eller egen besöksanalys används.</li>
              <li>SuperSafe sätter inga egna marknadsföringscookies.</li>
              <li>
                Webbläsaren kontaktar GitHub för att kontrollera om ett nyare
                FI-underlag finns; själva sökordet skickas inte med.
              </li>
              <li>
                Om du följer en extern källänk gäller den webbplatsens egen
                integritetspolicy.
              </li>
            </ul>
            <p>
              Webbläsardata kan tas bort genom att rensa webbplatsdata. Vanliga
              tekniska loggar kan förekomma hos webbplatsens driftleverantör.
            </p>
          </section>

          <section
            id="ansvar"
            className="trust-section"
            aria-labelledby="liability-title"
          >
            <h2 id="liability-title">Ansvar och begränsningar</h2>
            <p>
              Informationen är utbildande och utgör inte personlig
              investeringsrådgivning, köp- eller säljrekommendationer eller en
              prognos. Historiska innehav kan ha ändrats efter rapportdagen.
              Datatäckning beskriver hur mycket av underlaget som identifierats,
              inte hur säker eller lämplig fonden är.
            </p>
            <p>
              Kontrollera alltid aktuellt faktablad, avgift, riskindikator och
              villkor hos fondbolaget eller din handelsplattform innan du fattar
              ett ekonomiskt beslut. Ingen information på SuperSafe garanterar
              framtida avkastning eller skydd mot förlust.
            </p>
          </section>

          <section
            id="kontakt"
            className="trust-section"
            aria-labelledby="contact-title"
          >
            <h2 id="contact-title">Kontakt och rättelser</h2>
            <p>
              SuperSafe är fortfarande en privat pilot. Tekniska synpunkter och
              upptäckta datafel kan tills vidare lämnas via projektet på GitHub.
              En särskild publik kontaktadress läggs till före en extern
              lansering.
            </p>
            <p>
              <a
                href="https://github.com/malte3000/SuperSafe"
                target="_blank"
                rel="noopener noreferrer"
              >
                Öppna SuperSafe på GitHub{' '}
                <ExternalLink aria-hidden="true" className="inline size-4" />
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
