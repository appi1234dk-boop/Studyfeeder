import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `당신은 사용자가 작성한 메모를 보고 "이 자료의 콘텐츠 가치 점수"를 추천합니다.

평가 기준:
- 1점: 메모가 짧고 평이함. 새로운 인사이트나 액션 의도가 없음. ("좋네", "참고용", "ㅇㅋ")
- 2점: 메모에 분명한 인사이트나 새로운 관점이 담김. ("X구나", "Y가 핵심", "이런 식으로 볼 수도")
- 3점: 강한 정서 시그널 + 액션 의도가 명확. 길고 깊은 메모. 무릎 침. ("꼭", "최고", "다시 보자", "이걸 ~에 적용해봐야겠다")

오직 아래 JSON 형식만 반환하세요. 다른 텍스트 금지.

{
  "rating": 1 | 2 | 3,
  "reason": "15자 이내 한 줄 이유"
}`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
    }

    const body = await request.json();
    const memo = (body.ideas || "").trim();
    if (memo.length < 10) {
      return NextResponse.json({ rating: null, reason: "메모가 너무 짧음" });
    }

    const userMessage = `제목: ${body.title || ""}\n요약: ${(body.summary || "").slice(0, 300)}\n\n메모:\n${memo.slice(0, 1000)}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 128,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ error: "AI 호출 실패" }, { status: 502 });
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() || "";

    let jsonText = text;
    if (text.includes("```")) {
      const chunk = text.split("```")[1] || "";
      jsonText = chunk.startsWith("json") ? chunk.slice(4).trim() : chunk.trim();
    }

    const parsed = JSON.parse(jsonText) as { rating: number; reason?: string };
    const rating = Number(parsed.rating);
    if (![1, 2, 3].includes(rating)) {
      return NextResponse.json({ rating: null });
    }
    const reason = String(parsed.reason || "").slice(0, 30);
    return NextResponse.json({ rating, reason });
  } catch (error) {
    console.error("suggest-rating failed:", error);
    return NextResponse.json({ error: "Failed to suggest rating" }, { status: 500 });
  }
}
