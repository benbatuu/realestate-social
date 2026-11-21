/**
 * Starting plan catalogue from blueprint §4.4.
 *
 * These are **pricing hypotheses**, not validated market prices: they must be recalculated with
 * real provider costs, taxes and pilot data before launch (§4.4, §5.4). Prices are in kuruş.
 */
export interface PlanDefinition {
  code: string;
  name: string;
  monthlyPriceMinor: number;
  currency: 'TRY';
  monthlyCredits: number;
  freeRegenerationAllowance: number;
  maxSeats: number;
  maxWorkspaces: number;
  maxCrmConnections: number;
  retentionDays: number;
  features: {
    portfolioAnalytics: 'basic' | 'advanced';
    teamReport: 'none' | 'basic' | 'full' | 'advanced';
    brandKits: number;
    priorityQueue: boolean;
    apiAccess: 'none' | 'limited' | 'advanced';
  };
}

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    code: 'starter',
    name: 'Starter',
    monthlyPriceMinor: 699_000,
    currency: 'TRY',
    monthlyCredits: 10,
    freeRegenerationAllowance: 3,
    maxSeats: 2,
    maxWorkspaces: 1,
    maxCrmConnections: 1,
    retentionDays: 30,
    features: {
      portfolioAnalytics: 'basic',
      teamReport: 'none',
      brandKits: 0,
      priorityQueue: false,
      apiAccess: 'none',
    },
  },
  {
    code: 'growth',
    name: 'Growth',
    monthlyPriceMinor: 1_899_000,
    currency: 'TRY',
    monthlyCredits: 30,
    freeRegenerationAllowance: 10,
    maxSeats: 5,
    maxWorkspaces: 1,
    maxCrmConnections: 2,
    retentionDays: 90,
    features: {
      portfolioAnalytics: 'advanced',
      teamReport: 'basic',
      brandKits: 0,
      priorityQueue: false,
      apiAccess: 'none',
    },
  },
  {
    code: 'professional',
    name: 'Professional',
    monthlyPriceMinor: 4_499_000,
    currency: 'TRY',
    monthlyCredits: 75,
    freeRegenerationAllowance: 25,
    maxSeats: 10,
    maxWorkspaces: 1,
    maxCrmConnections: 3,
    retentionDays: 180,
    features: {
      portfolioAnalytics: 'advanced',
      teamReport: 'full',
      brandKits: 1,
      priorityQueue: true,
      apiAccess: 'limited',
    },
  },
  {
    code: 'agency',
    name: 'Agency',
    monthlyPriceMinor: 8_499_000,
    currency: 'TRY',
    monthlyCredits: 150,
    freeRegenerationAllowance: 50,
    maxSeats: 25,
    maxWorkspaces: 3,
    maxCrmConnections: 5,
    retentionDays: 365,
    features: {
      portfolioAnalytics: 'advanced',
      teamReport: 'advanced',
      brandKits: 1,
      priorityQueue: true,
      apiAccess: 'advanced',
    },
  },
];
