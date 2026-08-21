import { betaDesks, privateWeek, type CoverageStory } from "./boardsignal";
import {
  buildUniverseCategoryGroups,
  deriveMomentFact,
  type UniverseFinishFact,
  type UniverseParticipant,
  type UniversePoolFact,
} from "@/lib/boardsignal/universe";

type ApprovedRecognitionFacts = {
  winningRun?: number;
  checkmateWins?: number;
  pools?: UniversePoolFact[];
  strongFinish?: UniverseFinishFact;
};

/**
 * Positive comparison facts transcribed from approved Founder Lab Desks.
 * Missing facts stay missing: public copy, a rating peak, or a termination count
 * never gets converted into a ranking metric unless the exact metric is present.
 */
const approvedFacts: Record<string, ApprovedRecognitionFacts> = {
  bada_billa: {
    winningRun: 4,
    strongFinish: { games: 4, wins: 4, draws: 0, losses: 0 },
  },
  kylian_mbappe_lottinreal: { checkmateWins: 13 },
  mrinbetween23: { winningRun: 5 },
  captainrangade: { checkmateWins: 3 },
  snoopyissocute: {
    winningRun: 7,
    pools: [{ pool: "rapid", games: 90, end: 1568, peak: 1610, low: 1542 }],
  },
  jefsonfs: {
    pools: [{ pool: "rapid", games: 12, change: 27 }],
  },
  iizorgii: { checkmateWins: 15 },
  "i-know-kungfu": {
    winningRun: 5,
    pools: [{ pool: "rapid", games: 24, start: 652, peak: 705 }],
  },
  harshhmishra: {
    pools: [{ pool: "bullet", games: 285, start: 1886, end: 1977, change: 91, peak: 2060 }],
  },
  alexcet8: {
    winningRun: 2,
    pools: [{ pool: "rapid", games: 8, start: 610, end: 581, peak: 610, low: 581, change: -29 }],
  },
};

export const founderCoverageStory: CoverageStory = {
  id: "founder-eight-game-run",
  eyebrow: "Winning run",
  headline: "Four opening losses did not stop an eight-game winning run.",
  summary: "The approved founding Review recorded eight consecutive wins before the direction changed later in the episode.",
  stat: "8 straight",
  detail: "Longest winning run",
  tone: "blue",
  period: "1–7 Jul",
  feature: true,
};

function addMoment(participant: Omit<UniverseParticipant, "moment">): UniverseParticipant {
  return { ...participant, moment: deriveMomentFact(participant) };
}

const approvedBetaParticipants = betaDesks.map((desk) => {
  const facts = approvedFacts[desk.handle.toLowerCase()] ?? {};
  const participant: Omit<UniverseParticipant, "moment"> = {
    id: `seed:${desk.handle.toLowerCase()}`,
    player: desk.handle,
    source: "seed",
    verified: true,
    periodLabel: desk.period,
    periodEnd: desk.periodEnd,
    games: desk.games,
    score: Number(desk.score.replace("%", "")),
    winningRun: facts.winningRun,
    checkmateWins: facts.checkmateWins,
    pools: facts.pools ?? [],
    strongFinish: facts.strongFinish,
    coverage: {
      href: `/feed#coverage-${desk.publicStory.id}`,
      headline: desk.publicStory.headline,
    },
  };
  return addMoment(participant);
});

const ayandaParticipant = addMoment({
  id: "seed:ayandakopano",
  player: privateWeek.player,
  source: "seed",
  verified: true,
  periodLabel: privateWeek.period,
  periodEnd: "2026-07-07",
  games: privateWeek.games,
  score: Number(privateWeek.score.replace("%", "")),
  winningRun: 8,
  pools: [{
    pool: "rapid",
    games: privateWeek.games,
    start: privateWeek.ratingStart,
    end: privateWeek.ratingEnd,
    change: privateWeek.ratingChange,
    peak: privateWeek.peak,
    low: privateWeek.low,
  }],
  strongFinish: { games: 6, wins: 3, draws: 0, losses: 3 },
  coverage: {
    href: `/feed#coverage-${founderCoverageStory.id}`,
    headline: founderCoverageStory.headline,
  },
});

/**
 * Replace this adapter with a persistent shared comparison source later.
 * The recognition UI consumes UniverseParticipant[], so persistence does not
 * require a component rewrite.
 */
export const foundingBetaField: UniverseParticipant[] = [
  ...approvedBetaParticipants,
  ayandaParticipant,
];

export const foundingUniverseGroups = buildUniverseCategoryGroups(foundingBetaField);
