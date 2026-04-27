// Vercel Serverless Function: POST /api/convert
//
// 입력 문장을 공공기관/사무 환경의 보고용 표현으로 변환한다.
// OPENAI_API_KEY 는 서버 환경변수로만 접근하며, 프론트엔드에 노출하지 않는다.
//
// 요청: { input: string }
// 응답(성공): 200 { text: string }
// 응답(실패): 4xx/5xx { error: string }
//
// 프론트엔드는 실패 시 기존 템플릿 기반 fallback 으로 결과를 표시한다.

const SYSTEM_PROMPT = [
  "사용자 입력을 공공기관 또는 사무 환경에서 사용할 수 있는 보고용 표현으로 변환해줘.",
  "",
  "조건:",
  "- 한 문장만 반환",
  "- 과장 금지",
  "- 허위 내용 추가 금지",
  "- 사용자가 입력한 범위 안에서만 표현 개선",
  "- 따옴표, 번호, 설명 없이 결과 문장만 반환",
  "",
  "예:",
  "서류 정리 → 관련 서류를 분류하고 정리함",
  "영상 제작 → 업무 목적에 맞는 영상 자료를 제작함",
].join("\n");

const MIN_INPUT_LENGTH = 2;
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function readJsonBody(req) {
  // Vercel 의 Node 런타임은 req.body 를 자동 파싱한다.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  // Fallback: 직접 stream 에서 읽기
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function sanitize(text) {
  if (typeof text !== "string") return "";
  // 모델이 따옴표/번호/공백을 붙여 보낸 경우를 마지막으로 한 번 더 정리한다.
  let t = text.trim();
  t = t.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "");
  t = t.replace(/^\s*\d+[\.\)]\s*/, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "OPENAI_API_KEY not configured" }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }

  const input = typeof body?.input === "string" ? body.input : "";
  const trimmed = input.trim();
  if (trimmed.length < MIN_INPUT_LENGTH) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ error: `Input must be at least ${MIN_INPUT_LENGTH} characters` })
    );
    return;
  }

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
        temperature: 0.4,
        max_tokens: 200,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: `OpenAI request failed (${upstream.status})`,
          detail: detail.slice(0, 500),
        })
      );
      return;
    }

    const data = await upstream.json();
    const raw = data?.choices?.[0]?.message?.content;
    const text = sanitize(raw);
    if (!text) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Empty response from OpenAI" }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ text }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Internal error",
        detail: err && err.message ? err.message : String(err),
      })
    );
  }
}
