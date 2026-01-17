export const EVENT_EXTRACTION_PROMPT = `
<role>
You are an OSINT analyst extracting structured events from Twitter content about Iran.
</role>

<task>
Analyze the tweets below and extract discrete events. For each event, determine:
1. What happened (factual description)
2. When (date/time if mentioned)
3. Where (location if mentioned)
4. Category (massacre, protest, regime_action, international, infrastructure, resistance, diaspora)
5. Severity (1-5, where 5 is critical breaking news)
6. Whether it contains verifiable claims or speculation

DO NOT:
- Invent details not in the source
- Combine unrelated events
- Editorialize
</task>

<source_tweets>
{tweets}
</source_tweets>

<output_format>
Return ONLY valid JSON:
{
  "events": [
    {
      "title": "Brief event title",
      "description": "What happened",
      "date": "2026-01-17" or null,
      "location": "Tehran" or null,
      "category": "massacre",
      "severity": 4,
      "isVerified": false,
      "sourceHandles": ["@handle1"],
      "rawClaims": ["Direct quote from tweet"]
    }
  ],
  "newFacts": [
    {
      "statement": "Specific verifiable claim",
      "confidence": "reported",
      "source": "@handle"
    }
  ]
}
</output_format>
`;

export function buildExtractionPrompt(tweets: { author: string; text: string }[]): string {
  const tweetSection = tweets
    .map((t) => `[@${t.author}]: ${t.text}`)
    .join('\n\n---\n\n');

  return EVENT_EXTRACTION_PROMPT.replace('{tweets}', tweetSection);
}

export const FACT_VERIFICATION_PROMPT = `
<role>
You are a fact-checker verifying claims about the Iran uprising.
</role>

<task>
Review the following claims and categorize their verification status:
- verified: Multiple independent sources confirm
- reported: Single credible source reports
- unconfirmed: Speculation or single non-credible source

<claims>
{claims}
</claims>

<output_format>
Return ONLY valid JSON:
{
  "verifications": [
    {
      "claim": "original claim text",
      "status": "verified" | "reported" | "unconfirmed",
      "reasoning": "Why this status"
    }
  ]
}
</output_format>
`;

export function buildFactVerificationPrompt(claims: string[]): string {
  const claimsSection = claims.map((c, i) => `${i + 1}. ${c}`).join('\n');
  return FACT_VERIFICATION_PROMPT.replace('{claims}', claimsSection);
}
