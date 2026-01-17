export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function humanDelay(baseMs: number = 1000): Promise<void> {
  const variance = baseMs * 0.3;
  const actual = randomDelay(baseMs - variance, baseMs + variance);
  await sleep(actual);
}

export async function typeWithHumanDelay(
  element: { fill: (text: string) => Promise<void>; type: (text: string, opts?: { delay?: number }) => Promise<void> },
  text: string
): Promise<void> {
  await element.type(text, { delay: randomDelay(50, 150) });
}

export async function countdownTimer(seconds: number, label: string = 'Waiting'): Promise<void> {
  for (let remaining = seconds; remaining > 0; remaining--) {
    process.stdout.write(`\r${label}: ${remaining}s remaining...`);
    await sleep(1000);
  }
  process.stdout.write(`\r${label}: done!                    \n`);
}
