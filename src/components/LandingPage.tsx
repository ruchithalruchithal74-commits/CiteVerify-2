import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSearch,
  FlaskConical,
  Scale,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

interface LandingPageProps {
  onNavigateUpload: () => void;
  onRunSampleDemo: () => void;
  onNavigateDashboard: () => void;
  hasExistingReport: boolean;
}

const PIPELINE_STAGES = [
  {
    step: '01',
    title: 'Document Ingestion',
    detail: 'Extracts structured prose and reference sections from academic PDF and TXT manuscripts.',
  },
  {
    step: '02',
    title: 'Claim Extraction',
    detail: 'Isolates atomic scientific statements, causal assertions, and statistical figures.',
  },
  {
    step: '03',
    title: 'Citation Intelligence',
    detail: 'Maps [n], (Author, Year), et al., and DOI citations to bibliography entries and flags errors.',
  },
  {
    step: '04',
    title: 'Primary Source Retrieval',
    detail: 'Queries OpenAlex and Crossref APIs to resolve DOIs, verify metadata, and retrieve genuine abstracts.',
  },
  {
    step: '05',
    title: 'NLI & Integrity Audit',
    detail: 'Evaluates Entailment, Contradiction, or Neutrality alongside Numerical Integrity and Context Traps.',
  },
  {
    step: '06',
    title: 'Evidence-Backed Report',
    detail: 'Generates an auditable Evidence DNA™ profile, human review log, and downloadable PDF dossier.',
  },
];

const DNA_PILLARS = [
  {
    code: 'A',
    name: 'Source Authenticity',
    desc: 'Confirms publication existence across OpenAlex and Crossref and flags author, year, or DOI mismatches.',
  },
  {
    code: 'B',
    name: 'Semantic Alignment',
    desc: 'Checks whether the original abstract addresses the same mechanism, cohort, and scientific entities.',
  },
  {
    code: 'C',
    name: 'Numerical Integrity',
    desc: 'Audits percentages, percentage points, p-values, sample sizes, and baseline shifts deterministically.',
  },
  {
    code: 'D',
    name: 'Context Integrity',
    desc: 'Detects Research Context Traps where laboratory or pilot conditions are generalized to clinical reality.',
  },
  {
    code: 'E',
    name: 'Temporal Validity',
    desc: 'Flags aging foundational citations in fast-moving fields that warrant checking against newer consensus.',
  },
];

export function LandingPage({
  onNavigateUpload,
  onRunSampleDemo,
  onNavigateDashboard,
  hasExistingReport,
}: LandingPageProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="min-h-screen bg-[#101414] text-[#F4F1E8]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-[#222E2A] bg-[#101414]/90 backdrop-blur-md">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-semibold tracking-tight text-[#F4F1E8] whitespace-nowrap shrink-0"
          >
            CiteVerify
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A3B5A9]">
            <a
              href="#how-it-works"
              className="hover:text-[#F4F1E8] transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#evidence-dna"
              className="hover:text-[#F4F1E8] transition-colors whitespace-nowrap shrink-0"
            >
              Evidence DNA
            </a>
            <a
              href="#context-trap"
              className="hover:text-[#F4F1E8] transition-colors whitespace-nowrap shrink-0"
            >
              Context Trap
            </a>
            <a
              href="#capabilities"
              className="hover:text-[#F4F1E8] transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={hasExistingReport ? onNavigateDashboard : onNavigateUpload}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#19B887] text-[#0B1411] hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {hasExistingReport ? 'Open Workspace' : 'Upload Paper'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main id="top">
        <section className="max-w-[1320px] mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div>
                <p className="font-mono text-xs tracking-wider text-[#D6B875] mb-4">
                  Research Integrity & Evidence Verification
                </p>
                <h1 className="font-display text-[clamp(2.25rem,4.2vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-[#F4F1E8] text-balance">
                  Beyond Citations. Into Evidence.
                </h1>
                <p className="mt-6 text-base sm:text-lg text-[#A3B5A9] leading-relaxed max-w-xl">
                  Existing tools stop at checking whether a DOI resolves. CiteVerify investigates whether the original research paper actually supports the scientific statement made—exposing unsupported claims, distorted statistics, contradictions, and experimental context shifts.
                </p>
              </div>

              <div className="mt-9 space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={onNavigateUpload}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#19B887] text-[#0B1411] font-semibold text-sm hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Research Paper
                  </button>
                  <button
                    type="button"
                    onClick={onRunSampleDemo}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg border border-[#D6B875]/45 bg-[#14201C] text-[#F4F1E8] font-medium text-sm hover:border-[#D6B875] hover:bg-[#1C2623] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-[#D6B875]" />
                    Try Sample Paper
                  </button>
                </div>

                <div className="pt-5 border-t border-[#222E2A] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#A3B5A9]">
                  <span>OpenAlex & Crossref Retrieval</span>
                  <span aria-hidden="true">·</span>
                  <span>Natural Language Inference (NLI)</span>
                  <span aria-hidden="true">·</span>
                  <span>Numerical & Context Audits</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[300px] lg:min-h-[420px] rounded-2xl border border-[#283530] bg-[#14201C] overflow-hidden">
                {!imageError ? (
                  <img
                    src="/src/assets/images/hero_evidence_prism_1795095167108.jpg"
                    alt="Optical glass prisms refracting emerald light beside brass vernier calipers on obsidian slate"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#14201C] via-[#101414] to-[#1C2623]">
                    <Scale className="w-12 h-12 text-[#19B887] mb-3" />
                    <p className="font-display text-lg text-[#F4F1E8]">
                      Empirical Claim Refraction
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#101414]/90 via-[#101414]/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-[#D6B875]">
                      Primary Source Grounding
                    </p>
                    <p className="text-sm text-[#F4F1E8] mt-1 max-w-md">
                      Every verdict links directly to genuine OpenAlex or Crossref source passages—never fabricated excerpts.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#19B887] whitespace-nowrap">
                    NLI + Rule Engine
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works: 6-Stage Verification Pipeline */}
        <section
          id="how-it-works"
          className="border-t border-[#1F2A26] bg-[#121917] py-16 lg:py-20"
        >
          <div className="max-w-[1320px] mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <p className="font-mono text-xs text-[#19B887] mb-2">
                Verification Architecture
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8] text-balance">
                How CiteVerify audits every scientific claim
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#A3B5A9] leading-relaxed">
                A deterministic six-stage pipeline separates bibliographic resolution from semantic entailment, statistical verification, and experimental scope checks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PIPELINE_STAGES.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-[#24312C] bg-[#1C2623] p-6 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-semibold text-[#D6B875] tabular-nums">
                      Stage {item.step}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-semibold text-[#F4F1E8]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#A3B5A9] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Unique Innovation 1: Evidence DNA™ */}
        <section id="evidence-dna" className="py-16 lg:py-20 border-t border-[#1F2A26]">
          <div className="max-w-[1320px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-4">
                <p className="font-mono text-xs text-[#D6B875] mb-2">
                  Diagnostic Framework
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8] text-balance">
                  Evidence DNA™ evaluates five distinct axes
                </h2>
                <p className="mt-4 text-sm sm:text-base text-[#A3B5A9] leading-relaxed">
                  Scientific validity cannot be collapsed into a single percentage score. A claim can cite a real DOI while inflating a statistic or altering experimental conditions. CiteVerify preserves each axis independently.
                </p>
              </div>

              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DNA_PILLARS.map((p, idx) => (
                  <div
                    key={p.code}
                    className={`rounded-xl border border-[#25322D] bg-[#1C2623] p-5 ${
                      idx === 4 ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-[#19B887]">
                        Dimension {p.code}
                      </span>
                      <span className="font-mono text-xs text-[#A3B5A9]">
                        Independent Status
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-lg font-semibold text-[#F4F1E8]">
                      {p.name}
                    </h3>
                    <p className="mt-1.5 text-sm text-[#A3B5A9] leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Unique Innovation 2: Research Context Trap & Number Integrity */}
        <section
          id="context-trap"
          className="border-t border-[#1F2A26] bg-[#121917] py-16 lg:py-20"
        >
          <div className="max-w-[1320px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Context Trap Card */}
              <div className="rounded-xl border border-[#283530] bg-[#1C2623] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#27342F]">
                  <span className="font-mono text-xs text-[#E9AC45]">
                    Research Context Trap
                  </span>
                  <ShieldAlert className="w-4 h-4 text-[#E9AC45]" />
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F4F1E8]">
                  Detects subtle scope & environment shifts
                </h3>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="rounded-lg border border-[#2A3732] bg-[#141D1A] p-4">
                    <p className="font-mono text-[11px] text-[#22C58B] mb-1">
                      Original Research Finding
                    </p>
                    <p className="text-[#F4F1E8]">
                      “AI achieved 95% accuracy in a{' '}
                      <span className="underline decoration-[#22C58B] decoration-2 underline-offset-4">
                        controlled laboratory environment
                      </span>
                      .”
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E9AC45]/35 bg-[#E9AC45]/5 p-4">
                    <p className="font-mono text-[11px] text-[#E9AC45] mb-1">
                      Submitted Manuscript Claim
                    </p>
                    <p className="text-[#F4F1E8]">
                      “AI achieves 95% accuracy in{' '}
                      <span className="underline decoration-[#E9AC45] decoration-2 underline-offset-4">
                        real-world applications
                      </span>
                      .”
                    </p>
                  </div>

                  <p className="text-xs text-[#A3B5A9] leading-relaxed">
                    <strong className="text-[#E9AC45]">Context Mismatch Detected:</strong>{' '}
                    Controlled benchmark performance does not establish equivalent accuracy under uncurated real-world conditions.
                  </p>
                </div>
              </div>

              {/* Number Integrity Card */}
              <div className="rounded-xl border border-[#283530] bg-[#1C2623] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#27342F]">
                  <span className="font-mono text-xs text-[#E05265]">
                    Number Integrity Checker
                  </span>
                  <FileSearch className="w-4 h-4 text-[#E05265]" />
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F4F1E8]">
                  Audits statistical figures and baselines
                </h3>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="grid grid-cols-3 gap-3 rounded-lg border border-[#2A3732] bg-[#141D1A] p-4 font-mono tabular-nums">
                    <div>
                      <p className="text-[11px] text-[#A3B5A9]">Claimed</p>
                      <p className="text-lg font-semibold text-[#E05265] mt-0.5">
                        80%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#A3B5A9]">Reported</p>
                      <p className="text-lg font-semibold text-[#22C58B] mt-0.5">
                        62%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#A3B5A9]">Discrepancy</p>
                      <p className="text-lg font-semibold text-[#D6B875] mt-0.5">
                        18 pp
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[#A3B5A9] leading-relaxed">
                    Accounts for units, percentage vs. percentage-point distinctions, p-values, sample sizes, and experimental conditions before flagging quantitative drift.
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onRunSampleDemo}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#19B887] hover:text-[#22C58B] transition-colors cursor-pointer"
                    >
                      Run live 7-case demonstration paper
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Bento Grid */}
        <section id="capabilities" className="py-16 lg:py-20 border-t border-[#1F2A26]">
          <div className="max-w-[1320px] mx-auto px-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div>
                <p className="font-mono text-xs text-[#19B887] mb-2">
                  Platform Capabilities
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
                  Built for rigorous scholarly review
                </h2>
              </div>
              <button
                type="button"
                onClick={onNavigateUpload}
                className="px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Analyze a Manuscript
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
                <div className="flex items-center gap-2 text-xs font-mono text-[#D6B875] mb-3">
                  <BookOpen className="w-4 h-4" />
                  <span>Natural Language Inference Engine</span>
                </div>
                <h3 className="font-display text-xl font-semibold text-[#F4F1E8]">
                  Premise-to-Hypothesis verification, never similarity shortcuts
                </h3>
                <p className="mt-2.5 text-sm text-[#A3B5A9] leading-relaxed max-w-2xl">
                  Two sentences can share 90% vocabulary while expressing opposite conclusions. CiteVerify pairs the retrieved research passage (Premise) against the submitted claim (Hypothesis) to classify Entailment, Contradiction, or Neutrality with explicit model confidence.
                </p>
              </div>

              <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
                <div className="flex items-center gap-2 text-xs font-mono text-[#56B4D3] mb-3">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Human-in-the-Loop Governance</span>
                </div>
                <h3 className="font-display text-xl font-semibold text-[#F4F1E8]">
                  Auditable reviewer sign-off
                </h3>
                <p className="mt-2.5 text-sm text-[#A3B5A9] leading-relaxed">
                  Automated checks never replace scholarly judgment. Reviewers can accept, reject, annotate, and record timestamped decisions on every claim.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#1F2A26] bg-[#101414] py-8">
        <div className="max-w-[1320px] mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#A3B5A9]">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold text-[#F4F1E8]">
              CiteVerify
            </span>
            <span aria-hidden="true">·</span>
            <span>Beyond Citations. Into Evidence.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onNavigateUpload}
              className="hover:text-[#F4F1E8] transition-colors cursor-pointer"
            >
              Upload Paper
            </button>
            <button
              type="button"
              onClick={onRunSampleDemo}
              className="hover:text-[#F4F1E8] transition-colors cursor-pointer"
            >
              Sample Demonstration
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
