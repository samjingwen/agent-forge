# ASD-STE100 Writing Rules: Summary and Sources

Adapted from the upstream summary attributed in `../THIRD_PARTY_NOTICES.md`.
This file paraphrases rule categories, not the standard's text or approved-word dictionary.
For the authoritative document, request the standard from the official site.

## What ASD-STE100 Is

ASD-STE100 is a controlled natural language first released in 1986 as AECMA Document PSC-85-16598.
The AeroSpace and Defense Industries Association of Europe maintains the standard through the Simplified Technical English Maintenance Group (STEMG).
Its original purpose is technical documentation that non-native English readers can understand without misreading safety-critical instructions.
The pinned upstream summary targets Issue 9, published in January 2025.

## Structure

- 53 writing rules across 9 sections cover word choice, grammar, sentence structure, and style.
- A dictionary contains roughly 900 approved words, restricted to one meaning and one part of speech.
- Roughly 1,200 words to avoid have suggested replacements.
- Organizations can define approved technical nouns and verbs for terminology outside the base dictionary.

## Rule Categories

These are paraphrases of the categories discussed by the upstream skill and its cited sources.
They are not a complete compliance checklist.

### Word choice

- Use an approved word only with its approved meaning and part of speech.
- Prefer a plain word over a formal or rare synonym when both preserve the same meaning.
- Use an approved verb for an action instead of a noun derived from that verb (Rule 3.7).
- Avoid phrasal verbs whose combined meaning is not predictable from their parts (Rule 9.3).

### Verb forms

- Permitted forms include infinitive, imperative, simple present, simple past, simple future, and past participles used as adjectives.
- The standard does not permit present perfect and other compound forms.
- "-ing" forms are permitted as technical nouns or parts of technical nouns, not as verb forms.

Plainspoken preserves a compound form when removing it would lose uncertainty or required status information.
This is a deliberate meaning-preserving departure from strict STE, not a claim of compliance.

### Voice

- Use active voice for procedures and instructions.
- Passive voice is permitted in descriptive text only when the actor is genuinely unknown or irrelevant.

### Sentence structure

- Give one instruction per sentence.
- Limit procedural and instructional sentences to about 20 words and descriptive sentences to about 25 words.
- Do not omit a subject, verb, or article just to shorten a sentence.
- Limit noun clusters to 3 words.
- Do not use semicolons (Rule 8.1).
  This rule does not ban every other punctuation mark.

### Paragraph and document structure

- Keep one topic per paragraph.
- Keep paragraphs to about 6 sentences.
- Use lists for sequences, conditions, and complex enumerations.

### Safety instructions

- Put a safety-critical command or condition at the beginning of its instruction, not inside a long sentence.
- Preserve the strength of a requirement and every exception or prerequisite.

## Application to Agent-facing Text

Agent instructions, tool descriptions, and error messages can also be misread when the reader cannot ask the author for clarification.
Explicit actors, conditions, and fallback behavior reduce that risk.
Plainspoken applies those principles without claiming dictionary validation.
The bundled linter checks heuristics, not whether a rewrite preserved meaning.

## Sources

- [ASD-STE100 official site](https://www.asd-ste100.org/)
- [ASD-STE100: About STE](https://www.asd-ste100.org/about_STE.html)
- [ASD Europe: Simplified Technical English](https://www.asd-europe.org/standards-specifications/simplified-technical-english/)
- [Simplified Technical English: Wikipedia](https://en.wikipedia.org/wiki/Simplified_Technical_English)
- [TechScribe: ASD Simplified Technical English](https://www.techscribe.co.uk/techw/asd-simplified-technical-english.htm)
- [SKYbrary: Simplified Technical English](https://skybrary.aero/articles/simplified-technical-english-ste)
