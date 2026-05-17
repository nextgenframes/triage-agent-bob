const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function extractText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

async function callProvider(prompt, schema, env) {
  if (env.OPENROUTER_API_KEY) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.OPENROUTER_SITE_URL || "https://example.com",
        "X-Title": env.OPENROUTER_APP_NAME || "TuneScope",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || "openrouter/free",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return only valid JSON matching the requested schema. Do not wrap it in markdown.",
          },
          {
            role: "user",
            content: `${prompt}\n\nJSON schema:\n${JSON.stringify(schema)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  }

  if (env.OPENAI_API_KEY) {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5.2",
        input: prompt,
        max_output_tokens: 2200,
        text: {
          format: {
            type: "json_schema",
            name: "music_curation",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return JSON.parse(extractText(data));
  }

  throw new Error("No AI provider configured.");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    return json(res, 503, { error: "No AI provider key is configured." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { search, videos } = body;
    if (!search || !Array.isArray(videos) || videos.length === 0) {
      return json(res, 400, { error: "Search context and videos are required." });
    }

    const trimmedVideos = videos.slice(0, 24).map((video) => ({
      id: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      views: video.views,
      likes: video.likes,
      publishedAt: video.publishedAt,
    }));

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        ranked_videos: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              score: { type: "integer", minimum: 0, maximum: 100 },
              note: { type: "string" },
              playlist_role: { type: "string" },
            },
            required: ["id", "score", "note", "playlist_role"],
          },
        },
        playlist: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              section: { type: "string" },
              ids: {
                type: "array",
                items: { type: "string" },
                maxItems: 6,
              },
            },
            required: ["section", "ids"],
          },
          maxItems: 5,
        },
      },
      required: ["ranked_videos", "playlist"],
    };

    const prompt = [
      "You are TuneScope's music curator.",
      "Rank these YouTube song/video results for the user's search intent.",
      "Favor official songs, iconic appeal, replay value, playlist flow, and fit to genre/era filters.",
      "Penalize covers, reactions, low-fit outliers, and videos that sound like non-song content based on title/channel.",
      "Write each note in 18 words or fewer.",
      "Use playlist_role values like Opener, Peak, Singalong, Throwback, Cooldown, Deep Cut, or Closer.",
      "Create playlist sections that describe listening flow, not generic rankings.",
      "",
      "Search context:",
      JSON.stringify(search),
      "",
      "Videos:",
      JSON.stringify(trimmedVideos),
    ].join("\n");

    const parsed = await callProvider(prompt, schema, process.env);
    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: "AI curation failed.", detail: String(error) });
  }
};
