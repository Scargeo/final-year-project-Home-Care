// Rule-based triage map used to infer a likely doctor specialty from free-text symptoms.
const SPECIALTY_RULES = [
  {
    key: 'cardiology',
    displayName: 'Cardiology',
    aliases: ['cardio', 'heart', 'hypertension'],
    keywords: ['chest pain', 'palpitation', 'high blood pressure', 'bp', 'heart beat', 'arrhythmia', 'shortness of breath'],
  },
  {
    key: 'dermatology',
    displayName: 'Dermatology',
    aliases: ['skin'],
    keywords: ['rash', 'eczema', 'acne', 'itching', 'skin infection', 'psoriasis', 'allergic reaction'],
  },
  {
    key: 'orthopedics',
    displayName: 'Orthopedics',
    aliases: ['orthopedic', 'bone', 'joint'],
    keywords: ['back pain', 'joint pain', 'knee pain', 'fracture', 'sprain', 'shoulder pain', 'muscle pain'],
  },
  {
    key: 'neurology',
    displayName: 'Neurology',
    aliases: ['neuro'],
    keywords: ['migraine', 'headache', 'seizure', 'numbness', 'tingling', 'dizziness', 'memory loss'],
  },
  {
    key: 'psychiatry',
    displayName: 'Psychiatry',
    aliases: ['mental health', 'psychology'],
    keywords: ['anxiety', 'depression', 'panic attack', 'stress', 'insomnia', 'mood swings'],
  },
  {
    key: 'pulmonology',
    displayName: 'Pulmonology',
    aliases: ['respiratory', 'lung'],
    keywords: ['cough', 'asthma', 'wheezing', 'breathing problem', 'chest tightness'],
  },
  {
    key: 'gastroenterology',
    displayName: 'Gastroenterology',
    aliases: ['gastro', 'stomach', 'digestive'],
    keywords: ['abdominal pain', 'stomach pain', 'diarrhea', 'constipation', 'bloating', 'vomiting', 'ulcer'],
  },
  {
    key: 'gynecology',
    displayName: 'Gynecology',
    aliases: ['gynaecology', 'obgyn', 'women health'],
    keywords: ['menstrual', 'pregnancy', 'pelvic pain', 'fertility', 'vaginal infection'],
  },
  {
    key: 'pediatrics',
    displayName: 'Pediatrics',
    aliases: ['child', 'children', 'baby'],
    keywords: ['child fever', 'newborn', 'infant', 'vaccination', 'teething'],
  },
  {
    key: 'general medicine',
    displayName: 'General Medicine',
    aliases: ['general practice', 'family medicine', 'gp'],
    keywords: ['fever', 'flu', 'cold', 'body pain', 'fatigue', 'weakness', 'general checkup'],
  },
]

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function getRuleScore(normalizedReason, rule) {
  const hits = []
  let score = 0

  for (const keyword of rule.keywords) {
    if (normalizedReason.includes(keyword)) {
      hits.push(keyword)
      score += keyword.split(' ').length > 1 ? 3 : 2
    }
  }

  for (const alias of rule.aliases) {
    if (normalizedReason.includes(alias)) {
      hits.push(alias)
      score += 1
    }
  }

  return { score, hits }
}

function inferSpecialtyFromReason(reason) {
  const normalizedReason = normalize(reason)
  if (!normalizedReason) {
    return {
      specialtyKey: 'general medicine',
      specialtyLabel: 'General Medicine',
      confidence: 0,
      matchedTerms: [],
      summary: 'No detailed symptoms were provided, so the system defaulted to General Medicine.',
    }
  }

  // We score each specialty by keyword/alias hits and choose the highest score.
  const scored = SPECIALTY_RULES.map((rule) => ({
    rule,
    ...getRuleScore(normalizedReason, rule),
  })).sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score <= 0) {
    return {
      specialtyKey: 'general medicine',
      specialtyLabel: 'General Medicine',
      confidence: 0.25,
      matchedTerms: [],
      summary: 'Symptoms were broad, so the system routed to General Medicine for initial triage.',
    }
  }

  const confidence = Math.min(0.95, 0.35 + best.score * 0.1)
  return {
    specialtyKey: best.rule.key,
    specialtyLabel: best.rule.displayName,
    confidence,
    matchedTerms: Array.from(new Set(best.hits)).slice(0, 8),
    summary: `Symptoms aligned most with ${best.rule.displayName}.`,
  }
}

function buildSpecialtyMatcher(inference) {
  // Build a flexible regex so doctors with similar naming conventions are still matched.
  const specialtyRule = SPECIALTY_RULES.find((rule) => rule.key === inference.specialtyKey)
  const terms = [
    inference.specialtyLabel,
    ...(specialtyRule?.aliases || []),
    ...(specialtyRule?.keywords || []).map((keyword) => keyword.split(' ')[0]),
  ]
    .map((term) => normalize(term))
    .filter(Boolean)

  if (!terms.length) return null

  // Also include the specialty key and its first token (e.g., 'general' for 'general medicine')
  if (specialtyRule?.key) {
    const keyToken = normalize(specialtyRule.key)
    if (keyToken) terms.push(keyToken)
    const firstKeyToken = keyToken.split(' ')[0]
    if (firstKeyToken) terms.push(firstKeyToken)
  }

  const escaped = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  return new RegExp(escaped, 'i')
}

module.exports = {
  inferSpecialtyFromReason,
  buildSpecialtyMatcher,
}
