import { OptionChainRow, SpotPrice } from "../market-data/providers/MarketDataProvider";
import { OptionChainAnalysis } from "../option-chain-analytics/analytics";
import { AiSignal, generateSignal } from "./mockSignalEngine";

export interface AIProviderConfig {
  provider: "ANTHROPIC" | "OPENAI" | "MOCK";
  apiKey?: string;
  modelName?: string;
}

export class RealAIProvider {
  private config: AIProviderConfig;

  constructor(config?: AIProviderConfig) {
    this.config = config || {
      provider: (process.env.AI_PROVIDER as "ANTHROPIC" | "OPENAI") || "MOCK",
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "",
      modelName: process.env.AI_MODEL_NAME || "claude-3-5-sonnet-20241022",
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.provider !== "MOCK");
  }

  public async evaluateTradePlan(
    spot: SpotPrice,
    chain: OptionChainRow[],
    analysis: OptionChainAnalysis
  ): Promise<AiSignal> {
    if (!this.isConfigured()) {
      // Fallback seamlessly to mock rule-based signal generator
      return generateSignal(spot, chain, analysis);
    }

    try {
      const prompt = this.buildPrompt(spot, analysis);

      if (this.config.provider === "ANTHROPIC") {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.config.apiKey!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: this.config.modelName || "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await response.json();
        if (data.content && data.content[0]?.text) {
          const parsed = JSON.parse(data.content[0].text);
          return this.formatSignal(parsed, spot);
        }
      } else if (this.config.provider === "OPENAI") {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.modelName || "gpt-4o",
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) {
          const parsed = JSON.parse(data.choices[0].message.content);
          return this.formatSignal(parsed, spot);
        }
      }
    } catch {
      // Fallback on API failure
    }

    return generateSignal(spot, chain, analysis);
  }

  private buildPrompt(spot: SpotPrice, analysis: OptionChainAnalysis): string {
    return `You are a professional Intraday Options Trading AI Specialist for Indian stock market indices (${spot.underlying}).

Evaluate the following market snapshot and respond STRICTLY with JSON matching the specified structure:

MARKET SNAPSHOT:
- Underlying: ${spot.underlying}
- Spot LTP: ${spot.ltp} (Change: ${spot.change} pts / ${spot.changePct}%)
- Option Chain Bias: ${analysis.bias}
- Put-Call Ratio (PCR): ${analysis.pcr != null ? analysis.pcr.toFixed(2) : "N/A"}
- Major Call Resistance Strike: ${analysis.majorCallResistance[0]?.strike ?? "N/A"} (Total Call OI: ${analysis.totalCeOi})
- Major Put Support Strike: ${analysis.majorPutSupport[0]?.strike ?? "N/A"} (Total Put OI: ${analysis.totalPeOi})
- ATM Strike: ${analysis.atmStrike}
- Unusual Activity: ${JSON.stringify(analysis.unusualActivity)}

REQUIREMENTS:
1. Decision must be one of: "STRONG_TRADE_CANDIDATE", "TRADE_CANDIDATE", "WATCH", "WAIT", "NO_TRADE".
2. Say NO_TRADE or WAIT if signals conflict or underlying move is flat (< 0.05%).
3. Return valid JSON only.

JSON SCHEMA:
{
  "decision": "STRONG_TRADE_CANDIDATE" | "TRADE_CANDIDATE" | "WATCH" | "WAIT" | "NO_TRADE",
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": number (0-100),
  "quality": number (0-100),
  "strike": number,
  "optionType": "CE" | "PE",
  "entry": number,
  "confirmation": string,
  "stopLoss": number,
  "target1": number,
  "target2": number,
  "trailingStop": string,
  "invalidation": string,
  "riskReward": number,
  "expectedHoldingPeriod": string,
  "whyThisStrike": string,
  "whyNotOther": string,
  "supportingFactors": string[],
  "conflictingFactors": string[],
  "reasoning": string
}`;
  }

  private formatSignal(parsed: Partial<AiSignal>, spot: SpotPrice): AiSignal {
    return {
      id: crypto.randomUUID(),
      decision: parsed.decision || "NO_TRADE",
      bias: parsed.bias || "NEUTRAL",
      confidence: parsed.confidence || 50,
      quality: parsed.quality || 50,
      underlying: spot.underlying,
      strike: parsed.strike,
      optionType: parsed.optionType,
      entry: parsed.entry,
      confirmation: parsed.confirmation || "Wait for candle confirmation",
      stopLoss: parsed.stopLoss,
      target1: parsed.target1,
      target2: parsed.target2,
      trailingStop: parsed.trailingStop || "Trail to entry at Target 1",
      invalidation: parsed.invalidation || "Invalidated on price reversal",
      riskReward: parsed.riskReward || 1.5,
      expectedHoldingPeriod: parsed.expectedHoldingPeriod || "Intraday",
      whyThisStrike: parsed.whyThisStrike || "Strike chosen based on OI structure",
      whyNotOther: parsed.whyNotOther || "ATM offered lower R:R",
      supportingFactors: parsed.supportingFactors || [],
      conflictingFactors: parsed.conflictingFactors || [],
      reasoning: parsed.reasoning || "Evaluated by AI model",
      timestamp: new Date().toISOString(),
      snapshotRef: `ai-live-${Math.floor(Math.random() * 9999)}`,
      disclaimer: "Real AI Provider signal generation — for informational and paper trading purposes only.",
    };
  }
}
