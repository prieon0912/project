const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export interface GeminiFailureClassification {
  retryable: boolean;
  capacityRelated: boolean;
  quotaRelated: boolean;
}

export function buildGeminiModelChain(primary?: string, configuredFallbacks?: string): string[] {
  const configured = configuredFallbacks?.split(',').map((model) => model.trim()).filter(Boolean) ?? [];
  return [...new Set([primary?.trim() || DEFAULT_MODELS[0], ...configured, ...DEFAULT_MODELS])];
}

export function classifyGeminiFailure(status: number, message: string): GeminiFailureClassification {
  const normalized = message.toLowerCase();
  const capacityRelated = /high demand|overload|temporar|unavailable|resource exhausted|too many requests/u.test(normalized);
  const quotaRelated = /quota|rate limit|resource exhausted/u.test(normalized);
  return {
    retryable: [404, 408, 409, 429, 500, 502, 503, 504].includes(status) || capacityRelated || quotaRelated,
    capacityRelated,
    quotaRelated,
  };
}
