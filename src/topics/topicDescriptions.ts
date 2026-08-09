// One-line "what does this exercise do" copy for the section landing pages
// (SectionLandingPage.tsx). Keyed by TopicDefinition.id. Not every topic in
// registry.ts needs an entry — placeholder/hidden topics never render on a
// landing page — but every active, visible topic should have one.
export const TOPIC_DESCRIPTIONS: Record<string, string> = {
  // Aural
  'interval-recognition': 'Hear two notes and name the interval between them.',
  scales: 'Hear a scale played and identify which one it is.',
  'interval-comparison': 'Hear two intervals back to back and judge which is larger, or if they match.',
  'interval-singing': 'Sing back the interval you’re given, checked against your mic.',
  tuning: 'Train your ear for pitch — spot notes that are sharp, flat, or in tune.',
  'chord-recognition': 'Hear a chord and identify its quality and voicing.',
  'chord-comparison': 'Hear two chords back to back and judge how they differ.',
  'chord-singing': 'Sing back the notes of a chord you’re given.',
  'meter-recognition': 'Hear a rhythm and identify its time signature.',
  'rhythm-dictation': 'Hear a rhythmic pattern and notate it on the stave.',
  'chord-progressions': 'Hear a chord progression and identify the sequence.',
  'melodic-dictation': 'Hear a short melody and write it out in notation.',
  'sight-singing': 'Sing back a melody shown on the stave, checked against your mic.',
  'dynamics-articulation': 'Hear a passage and identify its dynamics and articulation.',
  'custom-topic': 'Build and manage your own custom recognition drills.',

  // Theory
  'note-reading': 'Name the note shown on the stave.',
  'key-signatures': 'Identify a key from its key signature, or build the signature for a given key.',
  'scale-degrees': 'Identify the scale degree of a note shown on the stave.',
  'scale-home-keys': 'Work out which keys a given scale belongs to.',
  'interval-writing': 'Notate the interval you’re asked for, starting from a given note.',
  'scale-writing': 'Notate a given scale on the stave.',
  'chord-writing': 'Notate a given chord on the stave.',
  transposition: 'Transpose written music into a different key.',
  'meter-transposition': 'Rewrite a rhythm from one time signature into another.',

  // Arranging
  'arr-voicing-build': 'Build a four-way close or drop voicing for a given chord symbol on the stave.',
  'arr-voicing-identify': 'Identify the voicing type (close, drop 2, drop 3, and more) used in a written chord.',
  'arr-three-note-identify': 'Identify the three-note voicing technique used in a written chord.',
  'arr-three-note-build': 'Build a three-note voicing for a given chord.',
  'arr-spot-error': 'Find the voice-leading or spacing error in a written voicing.',
  'arr-voicing-by-ear': 'Hear a voicing and identify which type it is.',
  'arr-omit-skip': 'Apply omit and skip techniques to reduce a voicing to fewer voices.',
  'arr-ust': 'Identify or build upper structure triads over a given chord.',
  'arr-slash-poly': 'Read and interpret slash chords and polychords.',
  'arr-chord-tones': 'Identify chord tones and available tensions for a given chord.',
  'arr-chord-scales': 'Match a chord to its correct chord scale.',
  'arr-transposition': 'Transpose a written part for a transposing instrument.',
  'arr-ranges': 'Judge whether a written note falls inside an instrument’s practical range.',
  'arr-lil': 'Apply lower interval limit rules to a voicing.',
  'arr-score-order': 'Put instruments into correct concert score order.',
  'arr-approach-identify': 'Identify the type of approach note used in a melodic line.',
  'arr-approach-reharm': 'Reharmonise a melody note using a different approach-note technique.',
  'arr-melodic-motion': 'Classify the motion between two voices as parallel, similar, contrary or oblique.',
  'arr-melodic-manipulation': 'Apply retrograde, inversion or transposition to a given melodic line.',
};
