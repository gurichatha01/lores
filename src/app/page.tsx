import { AwardBadge, Button, Chip, StatCard } from "@/components/ui";

const modes = [
  { name: "Sweetheart", color: "bg-sweetheart", note: "rose · soft glow" },
  { name: "Ride or Die", color: "bg-ride-or-die", note: "hot-orange" },
  { name: "Group Wrapped", color: "bg-group", note: "cobalt · scoreboard" },
  { name: "Family", color: "bg-family", note: "cozy amber" },
  { name: "Work", color: "bg-work", note: "cool teal" },
  { name: "Roast 🔥", color: "bg-roast", note: "red heat · dark" },
];

function SectionLabel({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="mb-5 mt-12 flex flex-wrap items-center gap-2.5">
      <span className="bg-ink px-2 py-1 font-mono text-[11px] font-bold text-white">{number}</span>
      <h2 className="font-mono text-[13px] font-bold uppercase tracking-[0.1em]">{title}</h2>
      <span className="font-mono text-xs text-ink/50">{detail}</span>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-[#dcdcd7] px-5 py-10 sm:px-10 lg:px-14 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
          lore · phase 0 · editorial system
        </p>
        <h1 className="text-4xl font-black tracking-[-2px] sm:text-[46px]">the editorial system, wired</h1>
        <p className="mt-2 max-w-2xl font-mono text-sm leading-6 text-ink/55">
          Black-on-white base for legibility. Accent recolors per mode. Rounded and soft only when the story calls for it.
        </p>

        <SectionLabel number="01" title="design system" detail="type · color per mode · components" />

        <div className="grid items-start gap-8 xl:grid-cols-[360px_1fr]">
          <section>
            <p className="mb-2.5 ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">
              type scale · <span className="text-ink">Archivo + Space Mono</span>
            </p>
            <div className="border border-hairline bg-white p-6">
              <div className="text-[64px] font-black leading-[0.8] tracking-[-3px]">47,812</div>
              <div className="mb-5 mt-1 font-mono text-[10px] text-ink/40">display / 900 / -3px · hero numbers</div>
              <div className="text-3xl font-black tracking-[-1px]">the lore, in full</div>
              <div className="mb-5 mt-1 font-mono text-[10px] text-ink/40">h2 / 900</div>
              <p className="text-[15px] font-medium leading-[1.5]">
                body · 15/1.5 · the warm, funny read about them. can go tender or savage.
              </p>
              <div className="mt-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink/50">
                label · space mono · uppercase · .1em
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2.5 ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">
              color per mode · <span className="text-ink">one base, accent shifts</span>
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {modes.map((mode) => (
                <div key={mode.name} className="border border-hairline bg-white">
                  <div className={`h-14 ${mode.color}`} />
                  <div className="px-2.5 py-2 font-mono text-[10px] font-bold">
                    {mode.name}
                    <span className="mt-0.5 block font-normal text-ink/50">{mode.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <SectionLabel number="02" title="primitives" detail="buttons · chips · stat cards · awards" />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <section className="border border-hairline bg-white p-5">
            <h3 className="mb-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/50">buttons</h3>
            <div className="flex flex-col gap-2.5">
              <Button fullWidth>get my lore →</Button>
              <Button fullWidth variant="secondary">share cards</Button>
              <Button fullWidth variant="accent">unlock report</Button>
            </div>
          </section>

          <section className="border border-hairline bg-white p-5">
            <h3 className="mb-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/50">chips · mode + sub-type</h3>
            <div className="flex flex-wrap gap-2">
              <Chip>💕 sweetheart</Chip>
              <Chip selected>👯 ride or die</Chip>
              <Chip>🏆 group</Chip>
            </div>
            <p className="mb-2 mt-3.5 font-mono text-[9px] uppercase text-ink/40">sub-type (partner)</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip selected size="subtype">situationship</Chip>
              <Chip size="subtype">gf</Chip>
              <Chip size="subtype">bf</Chip>
              <Chip size="subtype">crush</Chip>
              <Chip size="subtype">ex</Chip>
            </div>
          </section>

          <section className="border border-hairline bg-white p-5">
            <h3 className="mb-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/50">stat cards</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label="texts first" value="68%" detail={<span className="text-pink">you. bro.</span>} />
              <StatCard label="avg reply" value="4m/2h" detail="you / them" />
            </div>
            <StatCard className="mt-2.5" treatment="soft" label="longest streak" value="1,187d" detail="every single day" />
          </section>

          <section className="border border-hairline bg-white p-5">
            <h3 className="mb-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/50">award badges</h3>
            <div className="flex flex-col gap-2">
              <AwardBadge emoji="👻" label="Certified Ghost" detail="left on read ×3" />
              <AwardBadge highlighted emoji="🎭" label="Main Character" detail="2am essays" />
              <AwardBadge treatment="soft" emoji="☀️" label="The Morning Person" detail="always up first" />
            </div>
          </section>
        </div>

        <div className="mt-8 border-t-2 border-ink pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
          mobile-first · privacy by architecture · lore_
        </div>
      </div>
    </main>
  );
}
