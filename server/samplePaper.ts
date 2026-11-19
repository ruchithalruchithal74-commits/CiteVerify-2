import type { ResearchSourceRecord } from '../src/types.ts';

export interface SampleCaseExpectation {
  claimSubstring: string;
  caseLabel: string;
  expectedVerdict: string;
  expectedNli: string;
  expectedFlag?: string;
}

export const SAMPLE_PAPER_METADATA = {
  filename: 'CiteVerify_Sample_Clinical_AI_Review.txt',
  title:
    'Automated Diagnostic & Triage Systems in Clinical Practice: Evidence Audit (Illustrative Sample Paper)',
  description:
    'Illustrative demonstration manuscript engineered to test all 7 CiteVerify verification scenarios, combining genuine OpenAlex/Crossref DOIs with clearly labeled illustrative demonstration cases.',
};

export const SAMPLE_PAPER_TEXT = `Title: Automated Diagnostic & Triage Systems in Clinical Practice: Evidence Audit (Illustrative Sample Paper)

Introduction
Recent advances in deep neural networks have transformed computational pathology and clinical decision support. In dermatology, Esteva et al. (2017) demonstrated that a single convolutional neural network trained on 129,450 clinical images achieved classification performance on par with board-certified dermatologists across keratinocyte carcinomas and malignant melanomas [1]. Similarly, large-scale clinical trials of mRNA vaccines established high protective efficacy against symptomatic SARS-CoV-2 infection in adult cohorts [2].

Empirical Performance and Misinterpretation Risks
However, secondary literature frequently overstates or alters original empirical findings. For example, one recent commentary claimed that automated sepsis triage models reduce ICU mortality by 80% across hospital wards [3]. Another widely circulated summary stated that hospital AI diagnostic assistants achieve 95% diagnostic accuracy in real-world clinical applications [4]. In contrast, several authors have asserted that AlphaFold 2 failed to reach atomic-level accuracy in protein structure prediction and performed worse than classical homology modeling [5]. Furthermore, some policy briefs argue that early deep learning radiology models from 2016 eliminate the need for any clinician oversight during emergency stroke screening [6]. Finally, it has been claimed in unreferenced preprints that multi-modal LLM triage reduces emergency department wait times by 47% nationwide without citing any peer-reviewed study.

References
[1] Esteva, A., Kuprel, B., Novoa, R. A., Ko, J., Swetter, S. M., Blau, H. M., & Thrun, S. (2017). Dermatologist-level classification of skin cancer with deep neural networks. Nature, 542(7639), 115-118. https://doi.org/10.1038/nature21056
[2] Polack, F. P., Thomas, S. J., Kitchin, N., Absalon, J., Gurtman, A., Lockhart, S., ... & Gruber, W. C. (2020). Safety and efficacy of the BNT162b2 mRNA Covid-19 vaccine. New England Journal of Medicine, 383(27), 2603-2615. https://doi.org/10.1056/NEJMoa2034577
[3] Chen, L., & Patel, R. (2023). Automated Sepsis Triage Evaluation in Tertiary Wards [Illustrative Demo Reference ID: CV-DEMO-03]. Journal of Applied Clinical Informatics (Illustrative).
[4] Martinez, K., & Zhou, H. (2024). Controlled Benchmark of Clinical Diagnostic Support Systems [Illustrative Demo Reference ID: CV-DEMO-04]. Medical Computing Letters (Illustrative).
[5] Jumper, J., Evans, R., Pritzel, A., Green, T., Figurnov, M., Ronneberger, O., ... & Hassabis, D. (2021). Highly accurate protein structure prediction with AlphaFold. Nature, 596(7873), 583-589. https://doi.org/10.1038/s41586-021-03819-2
[6] Thompson, D. (2016). Preliminary Radiograph Screening Using Early Shallow Networks [Illustrative Demo Reference ID: CV-DEMO-06]. Archive of Pilot Imaging Studies (Illustrative).`;

/**
 * Clearly labeled ILLUSTRATIVE SYNTHETIC corpus records ONLY for references
 * marked [Illustrative Demo Reference ID: CV-DEMO-XX].
 * Genuine DOIs ([1], [2], [5]) are ALWAYS queried live via OpenAlex & Crossref!
 */
export const ILLUSTRATIVE_DEMO_CORPUS: Record<string, ResearchSourceRecord> = {
  'CV-DEMO-03': {
    verified: true,
    openAlexFound: false,
    crossrefFound: false,
    title:
      'Automated Sepsis Triage Evaluation in Tertiary Wards (Illustrative Synthetic Corpus)',
    authors: ['L. Chen', 'R. Patel'],
    year: 2023,
    journal: 'Journal of Applied Clinical Informatics (Illustrative Demo)',
    abstractText:
      'In a retrospective single-center evaluation of 1,420 adult admissions, the proposed automated sepsis triage alert workflow achieved a 62% improvement in early intervention adherence compared with baseline manual scoring (p = 0.004). All-cause ICU mortality shifted modestly by 4.2 percentage points.',
    passageSource: 'Illustrative Demo Corpus',
    isIllustrativeDemo: true,
    retrievalNote:
      'Illustrative synthetic demonstration source (CV-DEMO-03) designed to test Numerical Integrity detection (claimed 80% vs. reported 62%). Not an external publication.',
  },
  'CV-DEMO-04': {
    verified: true,
    openAlexFound: false,
    crossrefFound: false,
    title:
      'Controlled Benchmark of Clinical Diagnostic Support Systems (Illustrative Synthetic Corpus)',
    authors: ['K. Martinez', 'H. Zhou'],
    year: 2024,
    journal: 'Medical Computing Letters (Illustrative Demo)',
    abstractText:
      'AI diagnostic triage achieved 95% accuracy in a controlled laboratory environment using curated, noise-free retrospective vignettes. Performance under uncurated real-world emergency department workflows was not evaluated and remains subject to data-shift degradation.',
    passageSource: 'Illustrative Demo Corpus',
    isIllustrativeDemo: true,
    retrievalNote:
      'Illustrative synthetic demonstration source (CV-DEMO-04) designed to test Research Context Trap detection ("controlled laboratory environment" vs. "real-world clinical applications"). Not an external publication.',
  },
  'CV-DEMO-06': {
    verified: true,
    openAlexFound: false,
    crossrefFound: false,
    title:
      'Preliminary Radiograph Screening Using Early Shallow Networks (Illustrative Synthetic Corpus)',
    authors: ['D. Thompson'],
    year: 2016,
    journal: 'Archive of Pilot Imaging Studies (Illustrative Demo)',
    abstractText:
      'An exploratory 2016 pilot study on 85 stroke CT scans evaluated feasibility of shallow convolutional filters for triage prioritization. Authors emphasized that sensitivity (71%) is insufficient for autonomous use and strictly requires radiologist confirmation.',
    passageSource: 'Illustrative Demo Corpus',
    isIllustrativeDemo: true,
    retrievalNote:
      'Illustrative synthetic demonstration source (CV-DEMO-06) designed to test Unsupported / Overclaiming & Temporal Validity (2016 pilot). Not an external publication.',
  },
};

export const SAMPLE_EXPECTED_MATRIX: SampleCaseExpectation[] = [
  {
    claimSubstring: '129,450 clinical images',
    caseLabel: '1. Correctly Supported Claim (Live OpenAlex/Crossref)',
    expectedVerdict: 'Supported',
    expectedNli: 'ENTAILMENT',
  },
  {
    claimSubstring: 'mRNA vaccines established high protective efficacy',
    caseLabel: '2. Partially Supported / Broad Summary (Live OpenAlex/Crossref)',
    expectedVerdict: 'Supported / Partially Supported',
    expectedNli: 'ENTAILMENT / NEUTRAL',
  },
  {
    claimSubstring: 'reduce ICU mortality by 80%',
    caseLabel: '5. Numerical Mismatch (Illustrative Demo)',
    expectedVerdict: 'Contradictory / Partially Supported',
    expectedNli: 'CONTRADICTION',
    expectedFlag: '80% claimed vs 62% reported',
  },
  {
    claimSubstring: '95% diagnostic accuracy in real-world',
    caseLabel: '6. Research Context Trap (Illustrative Demo)',
    expectedVerdict: 'Partially Supported / Unsupported',
    expectedNli: 'NEUTRAL / CONTRADICTION',
    expectedFlag: 'Context Mismatch (Controlled Lab vs Real-World)',
  },
  {
    claimSubstring: 'AlphaFold 2 failed to reach atomic-level accuracy',
    caseLabel: '4. Contradictory Claim (Live OpenAlex/Crossref)',
    expectedVerdict: 'Contradictory',
    expectedNli: 'CONTRADICTION',
  },
  {
    claimSubstring: 'eliminate the need for any clinician oversight',
    caseLabel: '3. Unsupported / Outdated Claim (Illustrative Demo)',
    expectedVerdict: 'Unsupported / Contradictory',
    expectedNli: 'CONTRADICTION / NEUTRAL',
  },
  {
    claimSubstring: 'reduces emergency department wait times by 47%',
    caseLabel: '7. Missing Citation',
    expectedVerdict: 'Unsupported',
    expectedNli: 'NOT_EVALUATED',
    expectedFlag: 'Missing Citation',
  },
];
