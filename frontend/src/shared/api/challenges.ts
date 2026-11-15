import { env } from '../config/env';

/** Технологический вызов из перечня TechLead8 (357 шт.). */
export interface TechChallengeOption {
  number: number;
  direction: string;
  partner: string;
  topic: string;
}

/** Справочник вызовов для выбора в паспорте (GET /challenges, публичный). */
export async function fetchChallenges(): Promise<TechChallengeOption[]> {
  const res = await fetch(env.challengesEndpoint);
  if (!res.ok) throw new Error(`Challenges HTTP ${res.status}`);
  const body = (await res.json()) as { challenges: TechChallengeOption[] };
  return body.challenges;
}
