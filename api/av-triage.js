const QWEN_DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const QWEN_DEFAULT_MODEL = "qwen-plus";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) {
      resolve(typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body);
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

function status(env) {
  const bobConfigured = Boolean(env.IBM_BOB_API_URL && env.IBM_BOB_API_KEY);
  return {
    ibm_bob_ready: bobConfigured,
    ibm_bob_mode: env.IBM_BOB_MODE || "triage-partner",
    qwen_ready: Boolean(env.QWEN_API_KEY || env.DASHSCOPE_API_KEY || env.OPENROUTER_API_KEY),
    qwen_model: env.QWEN_MODEL || env.OPENROUTER_MODEL || QWEN_DEFAULT_MODEL,
    supabase_ready: Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)),
    fallback_ready: true,
  };
}

function triagePrompt(input) {
  const schema = {
    severity: "S0 | S1 | S2 | S3",
    issue_type:
      "Perception issue | Prediction issue | Planning issue | Controls issue | Localization issue | Map issue | Sensor issue | Operator / scenario issue",
    confidence: "whole number from 0 to 100",
    summary: "one direct sentence for a stressed AV triage engineer",
    tags: ["VRU", "controls/planning", "perception", "localization/map", "sensor"],
    affected_area: "most likely code area or service area",
    likely_files: ["likely file paths"],
    commits: [{ hash: "short hash", message: "commit message", author: "author" }],
    first_response_steps: ["exactly three ordered checks"],
    handoff_note: "short note suitable for shift handoff",
  };

  return [
    "You are IBM Bob in Triage Partner mode, an autonomous-vehicle incident triage engineer's AI partner.",
    "Classify incidents with this severity scale: S0 collision/injury/unsafe, S1 near miss/hard brake/VRU involved, S2 uncomfortable behavior but safe, S3 minor issue/data quality.",
    "Classify one issue type: Perception, Prediction, Planning, Controls, Localization, Map, Sensor, or Operator / scenario.",
    "Use these rules when useful: pedestrian/cyclist means VRU tag; braking/acceleration/steering means controls/planning; object missed or late detection means perception; wrong lane or wrong position means localization/map.",
    "Return only valid JSON. Do not wrap it in markdown.",
    "If exact repository facts are unavailable, return plausible likely files and commits without pretending certainty.",
    "",
    "Required JSON shape:",
    JSON.stringify(schema),
    "",
    "Incident:",
    JSON.stringify(input),
  ].join("\n");
}

function inferService(rawAlert, provided) {
  if (provided) return String(provided).slice(0, 80);
  const raw = String(rawAlert || "");
  const match = raw.match(/([a-z][a-z0-9_-]+)_(service|api|worker|queue|webhook)/i);
  if (match) return match[0].replace(/_/g, "-");
  if (/checkout/i.test(raw)) return "checkout-service";
  if (/cart/i.test(raw)) return "cart-service";
  if (/payment|webhook/i.test(raw)) return "payments-webhooks";
  if (/auth|login|session/i.test(raw)) return "identity-service";
  return "unknown-service";
}

function fallbackBrief(input) {
  const raw = `${input.title || ""} ${input.raw_alert || ""}`.toLowerCase();
  const unsafe = /(collision|injur|unsafe|contact)/.test(raw) && !/(no collision|without collision|no injury|no injuries|no contact)/.test(raw);
  const severity = unsafe
    ? "S0"
    : /near miss|hard brake|vru|pedestrian|cyclist/.test(raw)
      ? "S1"
      : /uncomfortable|safe|jerk|swerve|nudge/.test(raw)
        ? "S2"
        : "S3";
  const issue_type = /miss|detect|object|cone|pedestrian/.test(raw)
    ? "Perception issue"
    : /predict|trajectory|vru/.test(raw)
      ? "Prediction issue"
      : /brak|steer|maneuver|path|fallback/.test(raw)
        ? "Planning issue"
        : /control|decel|accel/.test(raw)
          ? "Controls issue"
          : /localiz|position/.test(raw)
            ? "Localization issue"
            : /map|lane closure/.test(raw)
              ? "Map issue"
              : /sensor|camera|lidar|radar/.test(raw)
                ? "Sensor issue"
                : "Operator / scenario issue";
  const tags = [];
  if (/pedestrian|cyclist|bike|vru|crosswalk/.test(raw)) tags.push("VRU");
  if (/brak|accelerat|steer|swerve|jerk/.test(raw)) tags.push("controls/planning");
  if (/miss|late detect|detected late|object|cone/.test(raw)) tags.push("perception");
  if (/wrong lane|position|localiz|map|hd map|lane closure/.test(raw)) tags.push("localization/map");
  if (/sensor|camera|lidar|radar|occlu|glare/.test(raw)) tags.push("sensor");
  const confidence = severity === "S0" ? 94 : severity === "S1" ? 88 : severity === "S2" ? 78 : 66;
  const area = issue_type.replace(" issue", "").toLowerCase().replace(" / scenario", "");

  return {
    severity,
    issue_type,
    confidence,
    summary: `${severity} ${issue_type.toLowerCase()}${input.location ? ` in ${input.location}` : ""}. Bob flagged this from the incident text and prepared first-response checks.`,
    plain_english: `${severity} ${issue_type.toLowerCase()}${input.location ? ` in ${input.location}` : ""}. Bob flagged this from the incident text and prepared first-response checks.`,
    tags: tags.length ? tags : ["needs review"],
    affected_area: `${area}-stack/${area === "map" ? "hd-map-diff" : "incident-review"}`,
    service: String(input.service || "av-incident-triage").slice(0, 80),
    likely_files: [
      `av/${area}/triage_rules.ts`,
      `av/${area}/debug_playbook.md`,
      "ops/jira_templates/incident_report.md",
    ],
    commits: [
      { hash: "a81c42e", message: `Tune ${area} confidence thresholds`, author: "bob-demo" },
      { hash: "7df30b9", message: "Add AV incident replay annotations", author: "ops" },
      { hash: "3c19aa4", message: "Update Jira handoff template fields", author: "triage" },
    ],
    first_response_steps: [
      "Open the replay window and mark the first timestamp where behavior diverges from expectation.",
      "Compare perception, prediction, planning, controls, localization, map, and sensor signals against the event tags.",
      "Create a Jira report with severity, affected stack, evidence links, and the next owner.",
    ],
    handoff_note:
      `Keep focus on ${issue_type.toLowerCase()} evidence, severity ${severity}, scene context, and whether the behavior was unsafe or only uncomfortable.`,
  };
}

function normalizeTriage(parsed, input) {
  const fallback = fallbackBrief(input);
  const severity = ["S0", "S1", "S2", "S3"].includes(parsed.severity) ? parsed.severity : fallback.severity;
  const issueTypes = [
    "Perception issue",
    "Prediction issue",
    "Planning issue",
    "Controls issue",
    "Localization issue",
    "Map issue",
    "Sensor issue",
    "Operator / scenario issue",
  ];
  const issue_type = issueTypes.includes(parsed.issue_type) ? parsed.issue_type : fallback.issue_type;
  const confidence = Math.round(Math.max(0, Math.min(100, Number(parsed.confidence || fallback.confidence))));
  const list = (value, fallbackValue, max) =>
    Array.isArray(value) && value.length ? value.slice(0, max).map(String) : fallbackValue;
  const commits =
    Array.isArray(parsed.commits) && parsed.commits.length
      ? parsed.commits.slice(0, 3).map((commit) => ({
          hash: String(commit.hash || "unknown").slice(0, 16),
          message: String(commit.message || "Relevant change").slice(0, 140),
          author: String(commit.author || "unknown").slice(0, 60),
        }))
      : fallback.commits;

  return {
    severity,
    issue_type,
    confidence,
    summary: String(parsed.summary || parsed.plain_english || fallback.summary).slice(0, 280),
    plain_english: String(parsed.plain_english || parsed.summary || fallback.plain_english).slice(0, 280),
    tags: list(parsed.tags, fallback.tags, 8),
    affected_area: String(parsed.affected_area || fallback.affected_area).slice(0, 220),
    service: String(parsed.service || fallback.service).slice(0, 80),
    likely_files: list(parsed.likely_files, fallback.likely_files, 5),
    commits,
    first_response_steps: list(parsed.first_response_steps, fallback.first_response_steps, 3),
    risks: list(parsed.risks, fallback.risks || [], 4),
    handoff_note: String(parsed.handoff_note || fallback.handoff_note).slice(0, 360),
    bob_actions: list(parsed.bob_actions, fallback.bob_actions || [], 6),
  };
}

async function callQwen(input, env) {
  if (!status(env).qwen_ready) return fallbackBrief(input);
  const prompt = triagePrompt(input);

  if (env.OPENROUTER_API_KEY) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.OPENROUTER_SITE_URL || "https://example.com",
        "X-Title": env.OPENROUTER_APP_NAME || "Bob on Call",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || env.QWEN_MODEL || "qwen/qwen3.6-plus",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return JSON only. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return normalizeTriage(JSON.parse(data.choices?.[0]?.message?.content || "{}"), input);
  }

  const apiKey = env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;
  const baseUrl = (env.QWEN_BASE_URL || QWEN_DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.QWEN_MODEL || QWEN_DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return normalizeTriage(JSON.parse(data.choices?.[0]?.message?.content || "{}"), input);
}

function extractBobPayload(data) {
  if (data && typeof data === "object") {
    if (data.triage) return data.triage;
    if (data.output) return data.output;
    if (data.response) return data.response;
    if (data.result) return data.result;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.message?.content) return data.message.content;
  }
  return data;
}

async function callIbmBob(input, env) {
  if (!status(env).ibm_bob_ready) return null;

  const response = await fetch(env.IBM_BOB_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.IBM_BOB_API_KEY}`,
      ...(env.IBM_BOB_PROJECT_ID ? { "X-IBM-Bob-Project": env.IBM_BOB_PROJECT_ID } : {}),
    },
    body: JSON.stringify({
      mode: env.IBM_BOB_MODE || "triage-partner",
      prompt: triagePrompt(input),
      input,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  const payload = extractBobPayload(data);
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  return normalizeTriage(parsed || {}, input);
}

async function triageIncident(input, env) {
  if (status(env).ibm_bob_ready) return callIbmBob(input, env);
  return callQwen(input, env);
}

async function supabaseFetch(path, options = {}, env = process.env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const baseUrl = env.SUPABASE_URL;
  if (!baseUrl || !key) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? null : response.json();
}

async function listRecords(req, res) {
  const limit = Math.max(1, Math.min(25, Number(new URL(req.url, "http://localhost").searchParams.get("limit") || 8)));
  let records = [];

  if (status(process.env).supabase_ready) {
    const data = await supabaseFetch(
      `av_triage_events?select=id,title,source,environment,severity,confidence,created_at&order=created_at.desc&limit=${limit}`,
    );
    records = Array.isArray(data) ? data : [];
  }

  return json(res, 200, { status: status(process.env), records });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return listRecords(req, res);
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

    const body = await readBody(req);
    req.body = body;
    const title = String(body.title || "Untitled incident").slice(0, 160);
    const rawAlert = String(body.raw_alert || body.alert || "").slice(0, 8000);
    const service = String(body.service || inferService(rawAlert)).slice(0, 80);

    if (!rawAlert.trim()) return json(res, 400, { error: "raw_alert is required." });

    const input = { title, service, raw_alert: rawAlert };
    const triage = await triageIncident(input, process.env);
    const record = {
      title,
      source: "Bob on Call",
      environment: service,
      severity: triage.severity,
      confidence: triage.confidence,
      av_data: input,
      triage,
    };

    let saved = record;
    if (status(process.env).supabase_ready) {
      const inserted = await supabaseFetch("av_triage_events", {
        method: "POST",
        body: JSON.stringify(record),
      });
      saved = Array.isArray(inserted) && inserted[0] ? inserted[0] : record;
    }

    return json(res, 200, { status: status(process.env), triage, record: saved });
  } catch (error) {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const triage = fallbackBrief(body);
    return json(res, 200, {
      status: status(process.env),
      warning: "Provider failed; returned local Bob fallback.",
      detail: String(error),
      triage,
      record: {
        title: body.title || "Untitled incident",
        source: "Bob on Call",
        environment: triage.service,
        severity: triage.severity,
        confidence: triage.confidence,
        av_data: body,
        triage,
      },
    });
  }
};
