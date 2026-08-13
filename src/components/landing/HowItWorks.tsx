import { BrandWordmark } from "@/components/BrandWordmark";

const steps = [
  {
    number: "01",
    title: "Upload your chat",
    description: "Export a WhatsApp chat and drop the .zip or .txt straight in.",
    accent: "var(--pink)",
  },
  {
    number: "02",
    title: "lores reads it",
    description: "The patterns, timing, running jokes, and plot twists get mapped.",
    accent: "var(--group)",
  },
  {
    number: "03",
    title: "Get your report",
    description: "Open a designed report, Wrapped card, and keepsake PDF.",
    accent: "var(--ride)",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="how-it-works" aria-labelledby="how-it-works-title">
      <div className="mx-auto max-w-6xl">
        <div className="how-it-works__heading">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-pink">
              three steps. zero homework.
            </p>
            <h2 id="how-it-works-title" className="mt-3 text-4xl font-black tracking-[-2px] sm:text-5xl">
              how it works
            </h2>
          </div>
          <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-surface/55">
            your export becomes a story you can actually keep
          </p>
        </div>

        <ol className="how-it-works__grid">
          {steps.map((step) => (
            <li
              key={step.number}
              className={`how-step how-step--${step.number}`}
              style={{ "--step-accent": step.accent } as React.CSSProperties}
            >
              <div className="how-step__topline">
                <span>step {step.number}</span>
                <span aria-hidden="true">{step.number === "03" ? "done" : "next"} /</span>
              </div>

              <div className="how-step__demo" aria-hidden="true">
                {step.number === "01" ? <UploadDemo /> : null}
                {step.number === "02" ? <ReadingDemo /> : null}
                {step.number === "03" ? <ReportDemo /> : null}
              </div>

              <div className="how-step__copy">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function UploadDemo() {
  return (
    <div className="upload-demo">
      <div className="upload-demo__arrow">↓</div>
      <div className="upload-demo__file">
        <span className="upload-demo__fold" />
        <span className="upload-demo__wa">WA</span>
        <span className="upload-demo__filename">WhatsApp Chat.zip</span>
        <span className="upload-demo__size">2.4 MB</span>
      </div>
      <span className="upload-demo__label">drop export here</span>
    </div>
  );
}

function ReadingDemo() {
  return (
    <div className="reading-demo">
      <p className="reading-demo__label">illustrative chat</p>
      <div className="reading-demo__bubble reading-demo__bubble--one">
        <span>Aly</span>
        still on for eight?
      </div>
      <div className="reading-demo__bubble reading-demo__bubble--two">
        <span>you</span>
        obviously. bringing snacks.
      </div>
      <div className="reading-demo__bubble reading-demo__bubble--three">
        <span>Aly</span>
        hero behavior
      </div>
      <div className="reading-demo__pill">
        <span className="reading-demo__pulse" />
        lores is reading...
      </div>
    </div>
  );
}

function ReportDemo() {
  return (
    <div className="report-demo__viewport">
      <div className="report-demo">
        <BrandWordmark accent="#ff5c1a" contrastPlate className="report-demo__brand" />
        <p className="report-demo__edition">ride or die / 2026</p>
        <p className="report-demo__names">YOU &amp; ALY</p>
        <div className="report-demo__stat">
          <strong>2,487</strong>
          <span>messages</span>
        </div>
        <p className="report-demo__award">MAIN CHARACTER</p>
        <p className="report-demo__line">the chat had a plot.</p>
      </div>
    </div>
  );
}
