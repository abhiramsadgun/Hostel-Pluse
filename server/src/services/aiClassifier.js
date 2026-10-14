/**
 * AI/ML Keyword-Based Category Classifier
 * Uses weighted keyword and phrase dictionaries to classify complaint text
 * with a normalized confidence score, falling back to 'other'.
 */

const CATEGORY_KEYWORDS = {
  electrical: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'short circuit', weight: 15 },
      { phrase: 'power outage', weight: 14 },
      { phrase: 'power cut', weight: 14 },
      { phrase: 'tube light', weight: 12 },
      { phrase: 'ceiling fan', weight: 12 },
      { phrase: 'electric shock', weight: 18 },
      { phrase: 'mcb trip', weight: 15 },
      { phrase: 'switch board', weight: 12 },
      { phrase: 'geyser not working', weight: 14 },
    ],
    words: {
      spark: 12,
      shock: 14,
      mcb: 12,
      tripped: 10,
      socket: 8,
      switch: 7,
      light: 6,
      lights: 6,
      bulb: 7,
      fan: 7,
      wiring: 10,
      wire: 6,
      wires: 6,
      voltage: 10,
      current: 8,
      power: 7,
      blackout: 10,
      geyser: 10,
      heater: 8,
      plug: 6,
      fuse: 10,
      electricity: 9,
      ac: 7,
      cooler: 6,
    },
  },

  plumbing: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'water leak', weight: 14 },
      { phrase: 'leaking tap', weight: 14 },
      { phrase: 'tap leaking', weight: 14 },
      { phrase: 'water leakage', weight: 14 },
      { phrase: 'toilet flush', weight: 14 },
      { phrase: 'low pressure', weight: 11 },
      { phrase: 'no water', weight: 16 },
      { phrase: 'hot water', weight: 11 },
      { phrase: 'drain clogged', weight: 14 },
      { phrase: 'pipe burst', weight: 18 },
      { phrase: 'jet spray', weight: 12 },
      { phrase: 'wash basin', weight: 10 },
    ],
    words: {
      tap: 10,
      taps: 10,
      leak: 10,
      leaking: 10,
      leakage: 10,
      pipe: 8,
      pipes: 8,
      flush: 10,
      flushing: 10,
      basin: 8,
      sink: 8,
      toilet: 9,
      toilets: 9,
      drain: 9,
      drainage: 10,
      clog: 9,
      clogged: 10,
      water: 6,
      sewage: 14,
      overflow: 11,
      shower: 8,
      bathroom: 6,
      faucet: 9,
      tank: 7,
      plumber: 10,
      commode: 9,
    },
  },

  furniture: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'study table', weight: 12 },
      { phrase: 'study chair', weight: 12 },
      { phrase: 'cupboard lock', weight: 12 },
      { phrase: 'window latch', weight: 12 },
      { phrase: 'door lock', weight: 12 },
      { phrase: 'bed broken', weight: 14 },
      { phrase: 'cot spring', weight: 10 },
      { phrase: 'wardrobe door', weight: 11 },
    ],
    words: {
      bed: 9,
      cot: 9,
      mattress: 8,
      cupboard: 9,
      wardrobe: 9,
      desk: 8,
      chair: 8,
      table: 7,
      almirah: 9,
      hinge: 9,
      hinges: 9,
      latch: 9,
      lock: 8,
      locked: 7,
      key: 6,
      door: 6,
      doors: 6,
      window: 7,
      handle: 8,
      drawer: 8,
      curtain: 6,
      carpenter: 10,
      wood: 6,
      plywood: 7,
      mirror: 6,
      shelf: 7,
    },
  },

  cleanliness: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'pest control', weight: 15 },
      { phrase: 'bed bug', weight: 15 },
      { phrase: 'bed bugs', weight: 16 },
      { phrase: 'dustbin full', weight: 12 },
      { phrase: 'garbage overflowing', weight: 14 },
      { phrase: 'washroom cleaning', weight: 14 },
      { phrase: 'bad smell', weight: 11 },
      { phrase: 'foul odor', weight: 12 },
    ],
    words: {
      dirty: 9,
      clean: 7,
      cleaning: 9,
      dust: 7,
      dustbin: 9,
      garbage: 10,
      trash: 9,
      smell: 9,
      odor: 9,
      stink: 10,
      cockroach: 12,
      cockroaches: 12,
      insects: 10,
      pest: 11,
      lizard: 10,
      rat: 11,
      mosquito: 10,
      mosquitoes: 10,
      litter: 8,
      sweep: 8,
      mop: 8,
      sweeper: 9,
      unhygienic: 11,
      hygiene: 9,
      fungus: 10,
      mold: 10,
    },
  },

  internet: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'no internet', weight: 16 },
      { phrase: 'slow speed', weight: 12 },
      { phrase: 'wi fi', weight: 14 },
      { phrase: 'lan port', weight: 14 },
      { phrase: 'ethernet cable', weight: 14 },
      { phrase: 'wifi portal', weight: 13 },
      { phrase: 'dns error', weight: 14 },
      { phrase: 'login page not loading', weight: 14 },
    ],
    words: {
      wifi: 12,
      internet: 11,
      lan: 12,
      ethernet: 12,
      router: 11,
      cable: 6,
      speed: 8,
      slow: 6,
      portal: 8,
      dns: 10,
      ip: 8,
      bandwidth: 10,
      hotspot: 9,
      ping: 8,
      disconnect: 9,
      disconnected: 9,
      disconnecting: 10,
      network: 10,
      signal: 8,
      latency: 9,
    },
  },

  mess: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'food poisoning', weight: 18 },
      { phrase: 'bad food', weight: 14 },
      { phrase: 'hair in food', weight: 16 },
      { phrase: 'undercooked food', weight: 14 },
      { phrase: 'drinking water mess', weight: 13 },
      { phrase: 'plate dirty', weight: 12 },
      { phrase: 'rotten smell', weight: 14 },
    ],
    words: {
      food: 11,
      meal: 9,
      curry: 8,
      rice: 8,
      dal: 8,
      roti: 8,
      chapati: 8,
      sambar: 9,
      rasam: 8,
      breakfast: 8,
      lunch: 8,
      dinner: 8,
      tasteless: 9,
      undercooked: 10,
      cold: 6,
      caterer: 9,
      utensil: 8,
      utensils: 8,
      canteen: 8,
      mess: 10,
      dining: 8,
      spicy: 6,
      stale: 11,
      sour: 8,
      fly: 9,
      insect: 10,
    },
  },

  security: {
    weightMultiplier: 1.0,
    phrases: [
      { phrase: 'id card lost', weight: 14 },
      { phrase: 'lost id', weight: 14 },
      { phrase: 'stolen laptop', weight: 18 },
      { phrase: 'laptop stolen', weight: 18 },
      { phrase: 'gate security', weight: 12 },
      { phrase: 'unauthorized entry', weight: 16 },
      { phrase: 'biometric error', weight: 14 },
      { phrase: 'late entry dispute', weight: 13 },
      { phrase: 'threatened by', weight: 16 },
    ],
    words: {
      theft: 14,
      stolen: 14,
      thief: 14,
      intruder: 14,
      trespassing: 14,
      fight: 12,
      harassment: 16,
      ragging: 18,
      cctv: 11,
      biometric: 12,
      turnstile: 11,
      guard: 9,
      gate: 8,
      unauthorized: 11,
      threat: 14,
      emergency: 14,
      stole: 12,
      safety: 9,
      security: 10,
      lockpick: 14,
    },
  },
};

/**
 * Classify a complaint from title and description
 * @param {string} title
 * @param {string} description
 * @returns {{ categoryKey: string, confidence: number, matchedKeywords: string[], isFallback: boolean }}
 */
function classifyComplaintText(title = '', description = '') {
  const combinedText = `${title} ${description}`.toLowerCase();
  // Strip punctuation and extract alphanumeric tokens
  const cleanText = combinedText.replace(/[^a-z0-9\s-]/g, ' ');
  const tokens = cleanText.split(/\s+/).filter(Boolean);
  const tokenSet = new Set(tokens);

  const scores = {};
  const matchedWordsByCat = {};

  for (const [catKey, catConfig] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    const matches = [];

    // Check phrases (multi-word combinations)
    for (const p of catConfig.phrases) {
      if (combinedText.includes(p.phrase.toLowerCase())) {
        score += p.weight;
        matches.push(p.phrase);
      }
    }

    // Check individual words
    for (const [word, weight] of Object.entries(catConfig.words)) {
      if (tokenSet.has(word)) {
        score += weight;
        matches.push(word);
      }
    }

    scores[catKey] = score * (catConfig.weightMultiplier || 1.0);
    matchedWordsByCat[catKey] = matches;
  }

  // Find category with highest score
  let bestCategory = 'other';
  let highestScore = 0;

  for (const [catKey, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      bestCategory = catKey;
    }
  }

  // Minimum threshold to prevent false positives
  const MIN_SCORE_THRESHOLD = 8;
  if (highestScore < MIN_SCORE_THRESHOLD) {
    return {
      categoryKey: 'other',
      confidence: 0.15,
      matchedKeywords: [],
      isFallback: true,
    };
  }

  // Confidence is calculated relative to maximum expected saturation score (~40)
  const confidence = Math.min(0.98, Math.max(0.45, Number((highestScore / 42).toFixed(2))));

  return {
    categoryKey: bestCategory,
    confidence,
    matchedKeywords: Array.from(new Set(matchedWordsByCat[bestCategory] || [])),
    isFallback: false,
  };
}

module.exports = {
  classifyComplaintText,
  CATEGORY_KEYWORDS,
};
