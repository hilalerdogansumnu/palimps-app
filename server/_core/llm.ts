import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  /**
   * Output token cap. Default 32768 (Gemini flash-lite/flash hard ceiling).
   * Deterministik OCR/markings workload'larında daha küçük değer (örn 8192
   * = ~32K char güvenli sınır) verilmelidir; cap'siz bırakmak Bug #5 May
   * 2026'da olduğu gibi repetition loop sırasında ham ~35 KB metin üretimine
   * yol açar.
   */
  maxTokens?: number;
  max_tokens?: number;
  /**
   * Sampling temperature. OCR ve markings için 0.0-0.2 (deterministik); chat
   * için undefined → Gemini default. Repetition loop riskini düşürmek için
   * deterministik workload'larda explicit set edilmeli.
   */
  temperature?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  // Optional model override. If omitted, falls back to ENV.geminiModelChat —
  // use this to route OCR workloads to the cheaper flash-lite tier, and let
  // chat keep full flash for quality on complex queries.
  model?: string;
  /**
   * Fetch timeout (ms). Default 45_000 (45 sn). OCR/markings çağrılarında
   * 30_000 önerilir — Gemini bazen flash-lite tier'da silently asılı kalıyor
   * (Bug #5 May 2026: 1m36s timeout-suz beklediğimizde 500 fırladı). Timeout
   * → AbortError fırlatılır → isTransientLLMError true döner → caller retry
   * loop'u devreye girer. Caller bilinçli olarak null verirse timeout
   * uygulanmaz (hot debugging için escape hatch).
   */
  timeoutMs?: number | null;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly",
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

// Google Gemini exposes an OpenAI-compatible endpoint at:
//   https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
// We talk to it directly with GEMINI_API_KEY as a Bearer token.
const resolveApiUrl = () => `${ENV.geminiBaseUrl.replace(/\/$/, "")}/chat/completions`;

const assertApiKey = () => {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// Transient hata tespiti — chat.send'de inner retry loop için kullanılır.
// Gemini OpenAI-compatible endpoint 503 "high demand" sıkça döndürür ve
// genelde 1-2 saniye içinde kendine geliyor. Bunu kullanıcıya
// "LLM_UNAVAILABLE" olarak yansıtmadan önce küçük bir backoff ile yeniden
// denemek istiyoruz.
//
// Kapsam:
//  - HTTP statüleri (invokeLLM'in fırlattığı string formatından parse): 408
//    request timeout, 429 rate limit, 500/502/503/504 server / gateway hatası
//  - Gemini-spesifik keyword'ler: UNAVAILABLE, DEADLINE_EXCEEDED,
//    RESOURCE_EXHAUSTED (per-minute quota'lar zamanla kalkar)
//  - Network seviyesinde: fetch failed (Node 18+ undici), ECONNRESET,
//    ETIMEDOUT, EAI_AGAIN — bunların hepsi geçici bağlantı sorunu
//
// Permanent (retry edilmemeli): 400 invalid request, 401/403 auth, 404 not
// found, 422 unprocessable. Bu durumlarda retry sadece quota harcar ve
// kullanıcıyı bekletir — direkt fırlat.
const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_KEYWORDS = [
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
  "RESOURCE_EXHAUSTED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "FETCH FAILED",
  "NETWORK ERROR",
  "SOCKET HANG UP",
];

export function isTransientLLMError(err: unknown): boolean {
  // AbortSignal.timeout() Node 20+ DOMException name: "TimeoutError".
  // Kullanıcı tarafından iptal: name: "AbortError". İkisi de transient —
  // network/server tarafında bir şey takıldı, yeniden denenebilir.
  if (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  ) {
    return true;
  }

  const msg = err instanceof Error ? err.message : String(err);
  if (!msg) return false;

  // invokeLLM "LLM invoke failed: <status> <statusText> – <body>" fırlatır.
  // Hem üst seviye status hem de body içindeki "code: 503" varyantlarını yakala.
  const statusMatch = msg.match(/(?:LLM invoke failed:\s*|status[\s:"]+|code[\s:"]+)(\d{3})\b/i);
  if (statusMatch) {
    const status = Number.parseInt(statusMatch[1], 10);
    if (TRANSIENT_HTTP_STATUSES.has(status)) return true;
  }

  const upper = msg.toUpperCase();
  return TRANSIENT_KEYWORDS.some((kw) => upper.includes(kw));
}

/**
 * OCR çıktısında repetition loop tespiti. Gemini bazı görüntülerde belirli
 * koşullarda aynı cümleyi defalarca tekrar etmeye başlar (rare ama
 * deterministic failure mode — Bug #5 May 2026 root cause: Sf 110 fotoğrafı
 * ~500 kez aynı 70-char cümleyi üretti, ~35 KB ham text → readingMoments
 * INSERT 1m36s asılı kalıp 500 fırlattı).
 *
 * Yöntem: 50-char sliding window n-gram. Aynı substring >5 kez geçiyorsa
 * repetition flag. Threshold conservative — gerçek metinde tekrarlanan
 * başlık / dipnot / kısa formül false-positive olarak yakalanmasın diye.
 *
 * Performans: O(n) time, O(n) memory; 50 KB text → ~2.5 MB peak map
 * allocation. Tek seferlik post-processing, async hot path'te değil.
 *
 * Edge case'ler:
 * - text.length < 250 → false (5 tekrar × 50 char minimum threshold)
 * - tek satırda yüzlerce kez peş peşe geçen cümle → cycle ~70-200 char
 *   civarında, her unique window threshold'a hızlıca ulaşır (~280-1000 char)
 * - kısa fragment (<50 char) tekrarı YAKALANMAZ — Bug #5 spesifik failure
 *   mode'una odaklı; "..." gibi gürültü tekrarlarını bilinçli olarak
 *   ele almıyor (caller layer'ında zaten farklı handle).
 */
export function detectOcrRepetition(text: string): boolean {
  // Çok kısa metinde repetition pattern oluşamaz (5 tekrar × 50 char = 250)
  if (text.length < 250) return false;

  const NGRAM_SIZE = 50;
  const THRESHOLD = 5;

  const counts = new Map<string, number>();
  const limit = text.length - NGRAM_SIZE;
  for (let i = 0; i <= limit; i++) {
    const ngram = text.slice(i, i + NGRAM_SIZE);
    const c = (counts.get(ngram) ?? 0) + 1;
    if (c > THRESHOLD) return true;
    counts.set(ngram, c);
  }
  return false;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    temperature,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    timeoutMs,
  } = params;

  const payload: Record<string, unknown> = {
    // Caller-provided model wins; chat model is the safe default for
    // anything that hasn't opted into routing yet.
    model: model ?? ENV.geminiModelChat,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // Caller-provided cap wins; default 32768 (Gemini hard ceiling). Bug #5
  // (May 2026) sebebiyle artık caller'lar OCR/markings için 8192 civarı
  // explicit set ediyor — repetition loop'un üretebileceği max output'u
  // sınırlamak defense-in-depth'in birinci adımı.
  payload.max_tokens = maxTokens ?? max_tokens ?? 32768;

  // Sampling temperature — caller explicit verirse payload'a koy; aksi halde
  // Gemini'nin kendi default'unu kullansın (genelde 1.0). OCR call site'ları
  // 0.1 set ediyor (deterministik), chat undefined bırakıyor (creative).
  if (typeof temperature === "number") {
    payload.temperature = temperature;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  // Fetch timeout — Bug #5 May 2026'da timeout-suz fetch nedeniyle 1m36s
  // asılı kaldıktan sonra 500 fırlamıştı. AbortSignal.timeout() Node 20+
  // native; default 45s, caller override edebilir. null geçilirse timeout
  // hiç uygulanmaz (debug escape hatch).
  const effectiveTimeoutMs = timeoutMs === null ? null : (timeoutMs ?? 45_000);

  const fetchOptions: Parameters<typeof fetch>[1] = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.geminiApiKey}`,
    },
    body: JSON.stringify(payload),
  };
  if (effectiveTimeoutMs !== null) {
    fetchOptions.signal = AbortSignal.timeout(effectiveTimeoutMs);
  }

  const response = await fetch(resolveApiUrl(), fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
