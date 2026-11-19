import crypto from 'crypto';
import type {
  BenchmarkCategory,
  BenchmarkClassMetrics,
  BenchmarkItemResult,
  BenchmarkRunSummary,
  CitationFlag,
  ResearchSourceRecord,
} from '../src/types.ts';
import {
  evaluateClaimsBatchWithEvidence,
  type BatchEvaluationInput,
} from './aiEngine.ts';
import { saveBenchmarkRunToDb } from './db.ts';
import { runRuleBasedNumericalCheck } from './numberChecker.ts';

export interface GoldenBenchmarkItem {
  id: string;
  domain: string;
  expectedCategory: BenchmarkCategory;
  claimText: string;
  matchedCitation: string;
  citationFlags: CitationFlag[];
  source: ResearchSourceRecord;
}

const CATEGORIES: BenchmarkCategory[] = [
  'Supported',
  'Numeric-Drift',
  'Contradicted',
  'Fabricated',
];

function makeSource(
  title: string,
  abstractText: string,
  year = 2022,
  verified = true
): ResearchSourceRecord {
  return {
    verified,
    openAlexFound: verified,
    crossrefFound: verified,
    unpaywallFound: verified,
    title,
    authors: ['Benchmark Corpus Author'],
    year,
    abstractText,
    relevantPassage: abstractText,
    passageSource: verified ? 'OpenAlex Abstract' : 'Unavailable',
  };
}

/**
 * 36-item Golden Scientific Claim Evaluation Dataset
 * Balanced across 4 classes (9 per class):
 *  - Supported
 *  - Numeric-Drift
 *  - Contradicted
 *  - Fabricated
 */
export const GOLDEN_BENCHMARK_DATASET: GoldenBenchmarkItem[] = [
  // ================= SUPPORTED (9) =================
  {
    id: 'BM-01',
    domain: 'Dermatology AI',
    expectedCategory: 'Supported',
    claimText:
      'A convolutional neural network trained on 129,450 clinical images achieved keratinocyte carcinoma and melanoma classification performance comparable to board-certified dermatologists.',
    matchedCitation: '[1]',
    citationFlags: [],
    source: makeSource(
      'Dermatologist-level classification of skin cancer with deep neural networks',
      'We trained a single convolutional neural network end-to-end from images directly using a dataset of 129,450 clinical images consisting of 2,032 different diseases. The CNN achieves performance on par with all tested board-certified dermatologists across both keratinocyte carcinomas and malignant melanomas.',
      2017
    ),
  },
  {
    id: 'BM-02',
    domain: 'Vaccinology',
    expectedCategory: 'Supported',
    claimText:
      'In a randomized trial involving 43,548 participants, two doses of BNT162b2 conferred 95% protection against symptomatic Covid-19.',
    matchedCitation: '[2]',
    citationFlags: [],
    source: makeSource(
      'Safety and efficacy of the BNT162b2 mRNA Covid-19 vaccine',
      'A total of 43,548 participants underwent randomization. A two-dose regimen of BNT162b2 conferred 95% protection against Covid-19 in persons 16 years of age or older.',
      2020
    ),
  },
  {
    id: 'BM-03',
    domain: 'Natural Language Processing',
    expectedCategory: 'Supported',
    claimText:
      'The Transformer architecture relies entirely on self-attention mechanisms and achieved 28.4 BLEU on the WMT 2014 English-to-German translation task.',
    matchedCitation: '[3]',
    citationFlags: [],
    source: makeSource(
      'Attention Is All You Need',
      'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. On the WMT 2014 English-to-German translation task, our big model achieves 28.4 BLEU.',
      2017
    ),
  },
  {
    id: 'BM-04',
    domain: 'Cardiology',
    expectedCategory: 'Supported',
    claimText:
      'Empagliflozin reduced the combined risk of cardiovascular death or hospitalization for heart failure by 25% in patients with heart failure and reduced ejection fraction.',
    matchedCitation: '[4]',
    citationFlags: [],
    source: makeSource(
      'Cardiovascular and Renal Outcomes with Empagliflozin in Heart Failure',
      'Among patients receiving recommended therapy for heart failure and a reduced ejection fraction, those in the empagliflozin group had a lower risk of cardiovascular death or hospitalization for heart failure than those in the placebo group, representing a 25% relative risk reduction (hazard ratio 0.75, p < 0.001).',
      2020
    ),
  },
  {
    id: 'BM-05',
    domain: 'Gene Editing',
    expectedCategory: 'Supported',
    claimText:
      'Prime editing enables targeted insertions, deletions, and all 12 base-to-base conversions in human cells without requiring double-strand DNA breaks.',
    matchedCitation: '[5]',
    citationFlags: [],
    source: makeSource(
      'Search-and-replace genome editing without double-strands or donor DNA',
      'We describe prime editing, a versatile and precise genome editing method that directly writes new genetic information into a specified DNA site using a catalytically impaired Cas9 fused to an engineered reverse transcriptase, performing targeted insertions, deletions, and all 12 possible base-to-base conversions in human cells without double-strand breaks.',
      2019
    ),
  },
  {
    id: 'BM-06',
    domain: 'Oncology',
    expectedCategory: 'Supported',
    claimText:
      'Adding pembrolizumab to standard chemotherapy significantly prolonged median overall survival to 22.0 months compared with 10.7 months for chemotherapy alone in metastatic non-small-cell lung cancer.',
    matchedCitation: '[6]',
    citationFlags: [],
    source: makeSource(
      'Pembrolizumab plus Chemotherapy in Metastatic Non-Small-Cell Lung Cancer',
      'In patients with previously untreated metastatic nonsquamous NSCLC without EGFR or ALK mutations, the addition of pembrolizumab to standard chemotherapy of pemetrexed and a platinum-based drug resulted in significantly longer median overall survival of 22.0 months versus 10.7 months in the placebo-combination group (p < 0.001).',
      2018
    ),
  },
  {
    id: 'BM-07',
    domain: 'Materials Physics',
    expectedCategory: 'Supported',
    claimText:
      'Magic-angle twisted bilayer graphene exhibits correlated insulating states and unconventional superconductivity at a twist angle near 1.1 degrees.',
    matchedCitation: '[7]',
    citationFlags: [],
    source: makeSource(
      'Unconventional superconductivity in magic-angle graphene superlattices',
      'Here we report the realization of intrinsic unconventional superconductivity in a two-dimensional superlattice created by stacking two sheets of graphene twisted relative to each other by a small magic angle of approximately 1.1 degrees, alongside correlated insulating phases at half-filling.',
      2018
    ),
  },
  {
    id: 'BM-08',
    domain: 'Epidemiology',
    expectedCategory: 'Supported',
    claimText:
      'A global analysis across 195 countries estimated that dietary risk factors were associated with 11 million deaths in 2017.',
    matchedCitation: '[8]',
    citationFlags: [],
    source: makeSource(
      'Health effects of dietary risks in 195 countries',
      'Across 195 countries from 1990 to 2017, we evaluated the consumption of major foods and nutrients. In 2017, 11 million deaths and 255 million DALYs were attributable to dietary risk factors globally.',
      2019
    ),
  },
  {
    id: 'BM-09',
    domain: 'Neuroscience',
    expectedCategory: 'Supported',
    claimText:
      'Sleep deprivation in healthy adults reduced hippocampal encoding activity and impaired subsequent episodic memory retention by 40% relative to rested controls.',
    matchedCitation: '[9]',
    citationFlags: [],
    source: makeSource(
      'Sleep deprivation and hippocampal memory encoding',
      'Functional MRI revealed a significant deficit in hippocampal activation during episodic learning after a night of total sleep deprivation, corresponding to a 40% reduction in memory retention compared with sleep-rested control participants (p < 0.01).',
      2021
    ),
  },

  // ================= NUMERIC-DRIFT (9) =================
  {
    id: 'BM-10',
    domain: 'Clinical Sepsis AI',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'Automated sepsis triage alerts reduced ICU mortality by 80% across hospital wards.',
    matchedCitation: '[10]',
    citationFlags: [],
    source: makeSource(
      'Automated Sepsis Triage Evaluation in Tertiary Wards',
      'In a retrospective evaluation of 1,420 admissions, the automated sepsis triage alert workflow achieved a 62% improvement in early intervention adherence (p = 0.004), while all-cause ICU mortality shifted by 4.2 percentage points.',
      2023
    ),
  },
  {
    id: 'BM-11',
    domain: 'Radiology Screening',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'The deep learning chest X-ray classifier attained 98.5% sensitivity in detecting pulmonary nodules across n = 5000 test radiographs.',
    matchedCitation: '[11]',
    citationFlags: [],
    source: makeSource(
      'Deep Learning Detection of Pulmonary Nodules',
      'Evaluated on n = 1200 external test radiographs, the chest radiograph classifier achieved 84.2% sensitivity and 91.0% specificity for pulmonary nodule detection.',
      2022
    ),
  },
  {
    id: 'BM-12',
    domain: 'Metabolic Trials',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'Once-weekly semaglutide produced a mean body weight reduction of 28.4% over 68 weeks in adults with obesity.',
    matchedCitation: '[12]',
    citationFlags: [],
    source: makeSource(
      'Once-Weekly Semaglutide in Adults with Overweight or Obesity',
      'The mean change in body weight from baseline to week 68 was -14.9% in the semaglutide group as compared with -2.4% with placebo (p < 0.001).',
      2021
    ),
  },
  {
    id: 'BM-13',
    domain: 'Battery Chemistry',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'Solid-state lithium-metal cells retained 96% of initial capacity after 2000 charge-discharge cycles.',
    matchedCitation: '[13]',
    citationFlags: [],
    source: makeSource(
      'Cycling Stability of Solid-State Lithium-Metal Cells',
      'Under room-temperature testing at 1C rate, the solid-state lithium-metal pouch cells retained 81% of their initial discharge capacity after 500 cycles.',
      2023
    ),
  },
  {
    id: 'BM-14',
    domain: 'Biochemistry',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'The engineered PETase enzyme degraded polyethylene terephthalate films 12-fold faster than the wild-type enzyme at 50 degrees.',
    matchedCitation: '[14]',
    citationFlags: [],
    source: makeSource(
      'Engineered Hydrolase for PET Depolymerization',
      'Site-directed mutagenesis yielded a thermostable PETase variant showing a 3.4-fold increase in depolymerization rate relative to the wild-type enzyme under identical buffer assays.',
      2022
    ),
  },
  {
    id: 'BM-15',
    domain: 'Stroke Neurology',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'Endovascular thrombectomy within 6 hours improved functional independence rates to 74% compared with 21% in standard medical care.',
    matchedCitation: '[15]',
    citationFlags: [],
    source: makeSource(
      'Randomized Trial of Endovascular Thrombectomy in Acute Stroke',
      'Functional independence (modified Rankin score 0 to 2 at 90 days) occurred in 46.0% of patients in the thrombectomy group versus 26.5% in the standard-care group (p < 0.001).',
      2019
    ),
  },
  {
    id: 'BM-16',
    domain: 'Computer Vision',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'Quantizing the vision transformer to 4-bit weights reduced inference latency by 75% with only a 0.2% drop in ImageNet top-1 accuracy.',
    matchedCitation: '[16]',
    citationFlags: [],
    source: makeSource(
      'Post-Training Quantization of Vision Transformers',
      'Applying 4-bit weight quantization lowered GPU inference latency by 38% while incurring a 2.9% degradation in ImageNet top-1 accuracy compared to FP16.',
      2023
    ),
  },
  {
    id: 'BM-17',
    domain: 'Environmental Science',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'Urban tree canopy expansion lowered peak summer street-level temperatures by 6.5 percentage points across 12 European cities.',
    matchedCitation: '[17]',
    citationFlags: [],
    source: makeSource(
      'Cooling Effects of Urban Green Infrastructure',
      'Remote sensing across European metropolitan corridors showed that increasing canopy cover by 30% reduced mean daytime surface temperature anomalies by 1.8% in summer.',
      2023
    ),
  },
  {
    id: 'BM-18',
    domain: 'Immunology',
    expectedCategory: 'Numeric-Drift',
    claimText:
      'CAR-T cell therapy induced complete remission in 94% of relapsed B-cell lymphoma patients at 12-month follow-up.',
    matchedCitation: '[18]',
    citationFlags: [],
    source: makeSource(
      'Long-Term Outcomes of CD19 CAR-T Therapy in Lymphoma',
      'At 12 months post-infusion, durable complete remission was maintained in 42% of treated patients with relapsed or refractory large B-cell lymphoma, with overall objective response of 68%.',
      2022
    ),
  },

  // ================= CONTRADICTED (9) =================
  {
    id: 'BM-19',
    domain: 'Structural Biology',
    expectedCategory: 'Contradicted',
    claimText:
      'AlphaFold 2 failed to reach atomic-level accuracy in protein structure prediction and performed worse than classical homology modeling.',
    matchedCitation: '[19]',
    citationFlags: [],
    source: makeSource(
      'Highly accurate protein structure prediction with AlphaFold',
      'AlphaFold 2 regularly achieves accuracy competitive with experimental structures at atomic resolution, greatly outperforming all previous homology modeling and physics-based methods in CASP14 with a median backbone accuracy of 0.96 Angstroms RMSD.',
      2021
    ),
  },
  {
    id: 'BM-20',
    domain: 'Preventive Cardiology',
    expectedCategory: 'Contradicted',
    claimText:
      'Daily low-dose aspirin significantly reduced disability-free survival and increased healthy longevity among elderly individuals over 70 without cardiovascular disease.',
    matchedCitation: '[20]',
    citationFlags: [],
    source: makeSource(
      'Effect of Aspirin on Disability-free Survival in the Healthy Elderly',
      'Aspirin use in healthy elderly persons did not prolong disability-free survival over a median of 4.7 years of follow-up, and led to a significantly higher rate of major hemorrhage than placebo (hazard ratio 1.38, p < 0.001).',
      2018
    ),
  },
  {
    id: 'BM-21',
    domain: 'Critical Care',
    expectedCategory: 'Contradicted',
    claimText:
      'Hydroxychloroquine monotherapy lowered 28-day mortality in hospitalized COVID-19 patients compared with usual care.',
    matchedCitation: '[21]',
    citationFlags: [],
    source: makeSource(
      'Effect of Hydroxychloroquine in Hospitalized Patients with Covid-19',
      'Among patients hospitalized with Covid-19, those who received hydroxychloroquine did not have a lower incidence of death at 28 days than those who received usual care (27.0% vs 25.0%; rate ratio 1.09, p = 0.15).',
      2020
    ),
  },
  {
    id: 'BM-22',
    domain: 'Autonomous Imaging AI',
    expectedCategory: 'Contradicted',
    claimText:
      'The shallow convolutional screening model eliminated the need for any clinician oversight during emergency stroke triage.',
    matchedCitation: '[22]',
    citationFlags: [],
    source: makeSource(
      'Preliminary Radiograph Screening Using Early Shallow Networks',
      'Authors explicitly emphasized that sensitivity (71%) is insufficient for autonomous diagnostic use and strictly requires radiologist confirmation before clinical action.',
      2016
    ),
  },
  {
    id: 'BM-23',
    domain: 'Neurology',
    expectedCategory: 'Contradicted',
    claimText:
      'Beta-amyloid targeting monoclonal antibody semorinemab halted cognitive decline on ADAS-Cog11 in moderate Alzheimer disease.',
    matchedCitation: '[23]',
    citationFlags: [],
    source: makeSource(
      'Safety and Efficacy of Semorinemab in Alzheimer Disease',
      'In the Phase 2 Lauriet trial, semorinemab did not slow functional decline on ADCS-ADL or reduce clinical disease progression compared with placebo, showing no significant cognitive benefit on primary clinical endpoints.',
      2023
    ),
  },
  {
    id: 'BM-24',
    domain: 'Machine Learning',
    expectedCategory: 'Contradicted',
    claimText:
      'Removing layer normalization from deep transformer blocks consistently accelerated convergence and improved perplexity.',
    matchedCitation: '[24]',
    citationFlags: [],
    source: makeSource(
      'On Layer Normalization in the Transformer Architecture',
      'Ablation experiments demonstrated that removing layer normalization caused severe gradient instability, divergence during warmup, and substantially worse validation perplexity across all tested depths.',
      2020
    ),
  },
  {
    id: 'BM-25',
    domain: 'Microbiome Research',
    expectedCategory: 'Contradicted',
    claimText:
      'Probiotic supplementation after broad-spectrum antibiotics accelerated gut microbiome reconstitution compared with spontaneous recovery.',
    matchedCitation: '[25]',
    citationFlags: [],
    source: makeSource(
      'Post-Antibiotic Gut Mucosal Microbiome Reconstitution Is Impaired by Probiotics',
      'Contrary to common assumption, multi-strain probiotic supplementation markedly delayed and impaired native gut mucosal microbiome and transcriptome reconstitution compared with watchful waiting.',
      2018
    ),
  },
  {
    id: 'BM-26',
    domain: 'Nutrition Science',
    expectedCategory: 'Contradicted',
    claimText:
      'Vitamin D3 supplementation significantly lowered the incidence of bone fractures among generally healthy middle-aged and older adults.',
    matchedCitation: '[26]',
    citationFlags: [],
    source: makeSource(
      'Vitamin D3 Supplementation and Incident Fractures in Older Adults',
      'Vitamin D3 supplementation (2000 IU per day) did not result in a significantly lower risk of total, nonvertebral, or hip fractures than placebo among generally healthy midlife and older adults (hazard ratio 0.98, p = 0.70).',
      2022
    ),
  },
  {
    id: 'BM-27',
    domain: 'Renewable Energy',
    expectedCategory: 'Contradicted',
    claimText:
      'Perovskite-silicon tandem cells suffered rapid irreversible degradation exceeding 40% efficiency loss within the first 50 hours of outdoor illumination.',
    matchedCitation: '[27]',
    citationFlags: [],
    source: makeSource(
      'Damp-Heat and Outdoor Stability of Encapsulated Perovskite-Silicon Tandems',
      'Encapsulated monolithic perovskite-silicon tandem solar cells retained over 95% of their initial 29.1% power conversion efficiency after 1,000 hours of continuous damp-heat and outdoor illumination testing.',
      2023
    ),
  },

  // ================= FABRICATED / UNSUPPORTED (9) =================
  {
    id: 'BM-28',
    domain: 'Emergency Medicine',
    expectedCategory: 'Fabricated',
    claimText:
      'Multi-modal LLM triage reduces emergency department wait times by 47% nationwide without human triage nurses.',
    matchedCitation: 'None',
    citationFlags: ['Missing Citation'],
    source: {
      verified: false,
      openAlexFound: false,
      crossrefFound: false,
      authors: [],
      passageSource: 'Unavailable',
      retrievalNote: 'No citation attached to this empirical claim.',
    },
  },
  {
    id: 'BM-29',
    domain: 'Quantum Computing',
    expectedCategory: 'Fabricated',
    claimText:
      'Room-temperature topological qubits achieved 99.999% gate fidelity using bismuth-chalcogenide nanowires [99].',
    matchedCitation: '[99]',
    citationFlags: ['Incorrect DOI', 'Missing Publication'],
    source: {
      verified: false,
      openAlexFound: false,
      crossrefFound: false,
      doi: '10.1038/fabricated-quantum-99999',
      authors: ['J. Doe'],
      year: 2024,
      passageSource: 'Unavailable',
      retrievalNote: 'DOI did not resolve in OpenAlex, Crossref, or Unpaywall.',
    },
  },
  {
    id: 'BM-30',
    domain: 'Psychiatry',
    expectedCategory: 'Fabricated',
    claimText:
      'Digital phenotyping passively predicts bipolar manic relapse 14 days in advance with 96% precision across uninsured populations.',
    matchedCitation: '[30]',
    citationFlags: ['Missing Publication'],
    source: {
      verified: false,
      openAlexFound: false,
      crossrefFound: false,
      authors: ['R. Vance'],
      year: 2025,
      passageSource: 'Unavailable',
      retrievalNote: 'No matching publication record found in OpenAlex or Crossref.',
    },
  },
  {
    id: 'BM-31',
    domain: 'Clinical AI Context Trap',
    expectedCategory: 'Fabricated',
    claimText:
      'Hospital AI diagnostic assistants achieve 95% diagnostic accuracy in uncurated real-world emergency department workflows.',
    matchedCitation: '[31]',
    citationFlags: [],
    source: makeSource(
      'Controlled Benchmark of Clinical Diagnostic Support Systems',
      'AI diagnostic triage achieved 95% accuracy in a controlled laboratory environment using curated, noise-free retrospective vignettes. Performance under uncurated real-world emergency department workflows was not evaluated.',
      2024
    ),
  },
  {
    id: 'BM-32',
    domain: 'Virology',
    expectedCategory: 'Fabricated',
    claimText:
      'Intranasal monoclonal IgM sprays completely sterilized upper respiratory viral shedding within 4 hours in Phase 3 pediatric trials.',
    matchedCitation: 'None',
    citationFlags: ['Missing Citation'],
    source: {
      verified: false,
      openAlexFound: false,
      crossrefFound: false,
      authors: [],
      passageSource: 'Unavailable',
      retrievalNote: 'No citation attached to empirical clinical claim.',
    },
  },
  {
    id: 'BM-33',
    domain: 'Pharmacology',
    expectedCategory: 'Fabricated',
    claimText:
      'Oral insulin nanoparticles cured type 1 diabetes in 78% of adult human patients during multicenter trials [33].',
    matchedCitation: '[33]',
    citationFlags: [],
    source: makeSource(
      'Preclinical Biodistribution of Oral Insulin Nanocarriers in Rodents',
      'Oral polymeric insulin nanocarriers reduced fasting blood glucose in streptozotocin-induced diabetic mice over a 6-hour acute assay. Human clinical trials have not yet been conducted.',
      2023
    ),
  },
  {
    id: 'BM-34',
    domain: 'Economics & AI',
    expectedCategory: 'Fabricated',
    claimText:
      'Large language model deployment raised aggregate manufacturing GDP by 8.3% across OECD economies in 2023.',
    matchedCitation: '[34]',
    citationFlags: ['Incorrect DOI'],
    source: {
      verified: false,
      openAlexFound: false,
      crossrefFound: false,
      doi: '10.1257/aer.fabricated.2023',
      authors: ['M. Smith'],
      year: 2023,
      passageSource: 'Unavailable',
      retrievalNote: 'Cited DOI does not exist in Crossref or OpenAlex.',
    },
  },
  {
    id: 'BM-35',
    domain: 'Oncology Screening',
    expectedCategory: 'Fabricated',
    claimText:
      'Single-drop blood spectroscopy detects stage-1 pancreatic adenocarcinoma with 99.1% specificity in asymptomatic screening cohorts.',
    matchedCitation: '[35]',
    citationFlags: ['Missing Publication'],
    source: {
      verified: false,
      openAlexFound: false,
      crossrefFound: false,
      authors: ['K. Patel'],
      year: 2024,
      passageSource: 'Unavailable',
      retrievalNote: 'No matching publication found in bibliographic registries.',
    },
  },
  {
    id: 'BM-36',
    domain: 'Bioengineering',
    expectedCategory: 'Fabricated',
    claimText:
      '3D-bioprinted vascularized human kidneys sustained full dialysis-free renal function for 5 years post-transplant.',
    matchedCitation: '[36]',
    citationFlags: [],
    source: makeSource(
      'In Vitro Micro-Vascularization of Hydrogel Kidney Scaffolds',
      'Bioprinted renal proximal tubule constructs maintained albumin reabsorption and barrier integrity for 14 days in an in vitro microfluidic bioreactor.',
      2024
    ),
  },
];

function mapEvaluationToBenchmarkCategory(
  input: BatchEvaluationInput,
  evalOut: {
    nli: { label: string; performed: boolean };
    numericalCheckStatus: string;
    contextTrapDetected: boolean;
    verdict: string;
    isNumericDriftOnly?: boolean;
  }
): BenchmarkCategory {
  // 1. Missing citation / missing publication / incorrect DOI -> Fabricated
  if (
    input.citationFlags.includes('Missing Citation') ||
    input.citationFlags.includes('Missing Publication') ||
    input.citationFlags.includes('Incorrect DOI') ||
    !input.source.verified
  ) {
    return 'Fabricated';
  }

  // 2. Qualitative directional contradiction takes precedence over incidental number differences
  if (
    evalOut.nli.label === 'CONTRADICTION' &&
    evalOut.verdict === 'Contradictory' &&
    evalOut.isNumericDriftOnly === false
  ) {
    return 'Contradicted';
  }

  // 3. Numeric drift: rule-based or NLI detected numerical mismatch on a claim that actually asserts numbers
  if (
    input.numericalCheck.hasNumbers &&
    (evalOut.numericalCheckStatus === 'Mismatch' ||
      input.numericalCheck.status === 'Mismatch')
  ) {
    return 'Numeric-Drift';
  }

  // 4. Context trap / unverified extrapolation (e.g., mouse -> human, lab -> real-world, in vitro -> clinical)
  if (
    evalOut.contextTrapDetected &&
    (evalOut.verdict === 'Unsupported' || evalOut.verdict === 'Partially Supported')
  ) {
    return 'Fabricated';
  }

  // 5. Contradiction
  if (
    evalOut.nli.label === 'CONTRADICTION' ||
    evalOut.verdict === 'Contradictory'
  ) {
    return 'Contradicted';
  }

  // 6. Unsupported -> Fabricated
  if (evalOut.verdict === 'Unsupported') {
    return 'Fabricated';
  }

  return 'Supported';
}

export async function runAutomatedBenchmark(
  userId = 'usr-elena'
): Promise<BenchmarkRunSummary> {
  const startMs = Date.now();

  const inputs: BatchEvaluationInput[] = GOLDEN_BENCHMARK_DATASET.map((item) => {
    const numericalCheck = runRuleBasedNumericalCheck(
      item.claimText,
      item.source.abstractText
    );
    return {
      claimId: item.id,
      claimText: item.claimText,
      matchedCitation: item.matchedCitation,
      citationFlags: item.citationFlags,
      source: item.source,
      numericalCheck,
      targetedPremiseText: item.source.abstractText,
    };
  });

  const evalMap = await evaluateClaimsBatchWithEvidence(inputs);

  // Initialize 4x4 confusion matrix
  const confusionMatrix: Record<
    BenchmarkCategory,
    Record<BenchmarkCategory, number>
  > = {
    Supported: { Supported: 0, 'Numeric-Drift': 0, Contradicted: 0, Fabricated: 0 },
    'Numeric-Drift': {
      Supported: 0,
      'Numeric-Drift': 0,
      Contradicted: 0,
      Fabricated: 0,
    },
    Contradicted: {
      Supported: 0,
      'Numeric-Drift': 0,
      Contradicted: 0,
      Fabricated: 0,
    },
    Fabricated: { Supported: 0, 'Numeric-Drift': 0, Contradicted: 0, Fabricated: 0 },
  };

  const items: BenchmarkItemResult[] = GOLDEN_BENCHMARK_DATASET.map((gold, idx) => {
    const inp = inputs[idx];
    const out = evalMap.get(gold.id)!;
    const numericalOverrideFail = out.evidenceDna.numericalIntegrity.status === 'Fail';
    const predictedCategory = mapEvaluationToBenchmarkCategory(inp, {
      nli: out.nli,
      numericalCheckStatus: numericalOverrideFail
        ? 'Mismatch'
        : inp.numericalCheck.status,
      contextTrapDetected: out.contextTrap.detected,
      verdict: out.verdict,
      isNumericDriftOnly: out.isNumericDriftOnly,
    });

    confusionMatrix[gold.expectedCategory][predictedCategory] += 1;

    return {
      id: gold.id,
      domain: gold.domain,
      expectedCategory: gold.expectedCategory,
      predictedCategory,
      correct: gold.expectedCategory === predictedCategory,
      claimText: gold.claimText,
      nliLabel: out.nli.label,
      numericalStatus: numericalOverrideFail ? 'Mismatch' : inp.numericalCheck.status,
      contextTrapDetected: out.contextTrap.detected,
      rationale: out.reason,
    };
  });

  const classMetrics: BenchmarkClassMetrics[] = CATEGORIES.map((cat) => {
    const total = items.filter((i) => i.expectedCategory === cat).length;
    const predictedPositive = items.filter(
      (i) => i.predictedCategory === cat
    ).length;
    const truePositive = confusionMatrix[cat][cat];
    const precision = predictedPositive > 0 ? truePositive / predictedPositive : 0;
    const recall = total > 0 ? truePositive / total : 0;
    const f1 =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return {
      category: cat,
      total,
      predictedPositive,
      truePositive,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
    };
  });

  const correctItems = items.filter((i) => i.correct).length;
  const overallAccuracy = Number((correctItems / items.length).toFixed(4));
  const macroPrecision = Number(
    (
      classMetrics.reduce((acc, m) => acc + m.precision, 0) / classMetrics.length
    ).toFixed(4)
  );
  const macroRecall = Number(
    (
      classMetrics.reduce((acc, m) => acc + m.recall, 0) / classMetrics.length
    ).toFixed(4)
  );
  const macroF1 = Number(
    (classMetrics.reduce((acc, m) => acc + m.f1, 0) / classMetrics.length).toFixed(
      4
    )
  );

  const summary: BenchmarkRunSummary = {
    runId: `BM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    ranAt: new Date().toISOString(),
    userId,
    totalItems: items.length,
    correctItems,
    overallAccuracy,
    macroPrecision,
    macroRecall,
    macroF1,
    durationMs: Date.now() - startMs,
    classMetrics,
    confusionMatrix,
    items,
  };

  saveBenchmarkRunToDb(summary);
  return summary;
}
