import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Vercel AI Gateway client using OpenAI-compatible endpoint
const gateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  compatibility: 'strict', // Use standard OpenAI API format
});

export interface DraftTweet {
  id: string;
  generatedAt: string;
  theme: string;
  english: string;
  persian: string;
  sources: string[];
  hashtags: string[];
}

export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  model: 'opus' | 'sonnet' = 'sonnet'
): Promise<string> {
  const modelId = model === 'opus'
    ? 'anthropic/claude-opus-4-5-20251101'
    : 'anthropic/claude-sonnet-4-20250514';

  const { text } = await generateText({
    model: gateway.chat(modelId),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4096,
  });

  return text;
}

export async function generateDrafts(
  systemPrompt: string,
  context: string,
  model: 'opus' | 'sonnet' = 'sonnet'
): Promise<DraftTweet[]> {
  const text = await generateWithClaude(
    systemPrompt,
    context,
    model
  );

  // Parse JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('No JSON array found in response');
    return [];
  }

  try {
    const drafts = JSON.parse(jsonMatch[0]);
    return drafts.map((d: any, i: number) => ({
      id: `${new Date().toISOString().slice(0, 10)}-${String(i + 1).padStart(3, '0')}`,
      generatedAt: new Date().toISOString(),
      theme: d.theme || 'General',
      english: d.english || d.en || '',
      persian: d.persian || d.fa || d.farsi || '',
      sources: d.sources || [],
      hashtags: d.hashtags || [],
    }));
  } catch (e) {
    console.error('Failed to parse drafts:', e);
    return [];
  }
}
