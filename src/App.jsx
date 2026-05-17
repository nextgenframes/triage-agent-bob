import React, { useMemo, useState } from 'react';

const issueTypes = [
  "Perception issue",
  "Prediction issue",
  "Planning issue",
  "Controls issue",
  "Localization issue",
  "Map issue",
  "Sensor issue",
  "Operator / scenario issue"
];

const severityMeta = {
  S0: { label: "collision / injury / unsafe", rank: 0 },
  S1: { label: "near miss / hard brake / VRU involved", rank: 1 },
  S2: { label: "uncomfortable behavior but safe", rank: 2 },
  S3: { label: "minor issue / data quality", rank: 3 }
};

const fleetDashboard = {
  tickets: [
    { id: "AVOPS-9142", title: "Hard brake near cyclist", location: "San Francisco", vehicle: "AV-204", status: "New", repeat: "3x", severity: "S1" },
    { id: "AVOPS-9138", title: "Late cone detection", location: "Phoenix", vehicle: "AV-118", status: "Recurring", repeat: "5x", severity: "S2" },
    { id: "AVOPS-9129", title: "Wrong lane estimate", location: "Austin", vehicle: "AV-077", status: "Resolved", repeat: "2x", severity: "S2" },
    { id: "AVOPS-9121", title: "Camera glare sensor drop", location: "Las Vegas", vehicle: "AV-331", status: "New", repeat: "1x", severity: "S3" },
    { id: "AVOPS-9107", title: "Map closure stale", location: "Miami", vehicle: "AV-044", status: "Recurring", repeat: "4x", severity: "S2" }
  ],
  vehicles: ["AV-204", "AV-118", "AV-077", "AV-331", "AV-044", "AV-290"],
  locations: [
    { name: "San Francisco", count: 12 },
    { name: "Phoenix", count: 9 },
    { name: "Austin", count: 7 },
    { name: "Las Vegas", count: 4 }
  ]
};

const demoIncidents = [
  {
    id: "BOB-1842",
    title: "Hard brake near cyclist at 5th and Market",
    location: "San Francisco",
    category: "Planning issue",
    raw_alert: "AV hard brake from 28mph to 4mph. Cyclist crossing from right. Late trajectory update, no collision. Operator reports uncomfortable decel.",
    updated: "8 min ago",
    notes: ["Reviewed disengagement clip. Cyclist was visible but prediction confidence dropped in crosswalk.", "Planning fallback selected full stop after late VRU trajectory update."],
    triage: ruleTriage({
      title: "Hard brake near cyclist at 5th and Market",
      location: "San Francisco",
      raw_alert: "AV hard brake from 28mph to 4mph. Cyclist crossing from right. Late trajectory update, no collision. Operator reports uncomfortable decel."
    })
  },
  {
    id: "BOB-1841",
    title: "Wrong lane estimate after construction merge",
    location: "Austin",
    category: "Localization issue",
    raw_alert: "Vehicle localized one lane left for 2.8s near construction barrels. No unsafe maneuver. HD map lane closure stale.",
    updated: "22 min ago",
    notes: ["Map overlay still shows pre-construction lane geometry.", "Localization recovered after visual lane markers returned."],
    triage: ruleTriage({
      title: "Wrong lane estimate after construction merge",
      location: "Austin",
      raw_alert: "Vehicle localized one lane left for 2.8s near construction barrels. No unsafe maneuver. HD map lane closure stale."
    })
  },
  {
    id: "BOB-1839",
    title: "Missed cone until close range",
    location: "Phoenix",
    category: "Perception issue",
    raw_alert: "Small construction cone detected at 11m, expected 35m. Vehicle nudged right within lane. Safe but uncomfortable.",
    updated: "1 hr ago",
    notes: ["Low sun glare in front camera.", "LiDAR point cluster was sparse but present."],
    triage: ruleTriage({
      title: "Missed cone until close range",
      location: "Phoenix",
      raw_alert: "Small construction cone detected at 11m, expected 35m. Vehicle nudged right within lane. Safe but uncomfortable."
    })
  }
];

function App() {
  const [incidents, setIncidents] = useState(demoIncidents);
  const [activeId, setActiveId] = useState(demoIncidents[0].id);
  const [form, setForm] = useState({
    title: "Hard brake near cyclist at 5th and Market",
    location: "San Francisco",
    raw_alert: demoIncidents[0].raw_alert
  });
  const [filters, setFilters] = useState({ severity: "All", category: "All", location: "All" });
  const [note, setNote] = useState("");
  const [chatInput, setChatInput] = useState("What happened?");
  const [chat, setChat] = useState([
    { by: "Triage Bob", text: "This incident looks like a VRU prediction/planning handoff. The cyclist was seen, but the path update came late enough that planning chose a hard stop." }
  ]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("Incidents");
  const [theme, setTheme] = useState("dark");
  const [updateStatus, setUpdateStatus] = useState("Triage Bob v1.0.0 is up to date.");

  const active = incidents.find((item) => item.id === activeId) || incidents[0];
  const triage = active.triage;

  const filtered = useMemo(() => {
    return incidents.filter((item) => {
      return (
        (filters.severity === "All" || item.triage.severity === filters.severity) &&
        (filters.category === "All" || item.category === filters.category) &&
        (filters.location === "All" || item.location === filters.location)
      );
    });
  }, [filters, incidents]);

  const handoff = useMemo(() => buildHandoff(incidents), [incidents]);
  const jira = useMemo(() => buildJira(active), [active]);

  async function submitIncident(event) {
    event.preventDefault();
    setLoading(true);
    let nextTriage = ruleTriage(form);

    try {
      const response = await fetch("/api/av-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (data.triage) nextTriage = normalizeClientTriage(data.triage, form);
    } catch {
      nextTriage = ruleTriage(form);
    }

    const incident = {
      id: `BOB-${Math.floor(1900 + Math.random() * 8000)}`,
      title: form.title || "Untitled incident",
      location: form.location || "Unknown",
      category: nextTriage.issue_type,
      raw_alert: form.raw_alert,
      updated: "just now",
      notes: [],
      triage: nextTriage
    };
    setIncidents((current) => [incident, ...current]);
    setActiveId(incident.id);
    setChat([{ by: "Triage Bob", text: nextTriage.summary }]);
    setLoading(false);
  }

  function addNote() {
    const clean = note.trim();
    if (!clean) return;
    setIncidents((current) => current.map((item) => item.id === active.id ? { ...item, notes: [...item.notes, clean], updated: "just now" } : item));
    setNote("");
  }

  function askBob() {
    const clean = chatInput.trim();
    if (!clean) return;
    const answer = `${active.title}: ${triage.summary} Current lead is ${triage.issue_type.toLowerCase()} with ${triage.tags.join(", ")} tags. Next best check: ${triage.first_response_steps[0]}`;
    setChat((current) => [...current, { by: "You", text: clean }, { by: "Triage Bob", text: answer }]);
    setChatInput("");
  }

  return (
    <main className="app" data-theme={theme}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark"><img src="/triage-bob-logo.png" alt="Triage Bob logo" /></div>
          <div>
            <strong>Triage Bob</strong>
            <span>IBM Bob partner</span>
          </div>
        </div>

        <div className="bob-status">
          <span className="online-dot" />
          <div>
            <strong>Triage Bob online</strong>
            <span>Monitoring incident shift</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {["Incidents", "Services", "Dashboards", "Settings"].map((item) => (
            <button className={activeSection === item ? "active" : ""} type="button" key={item} onClick={() => setActiveSection(item)}>
              <span>{item === "Incidents" ? "●" : item === "Services" ? "◆" : item === "Dashboards" ? "▦" : "⚙"}</span>{item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>Rules + LLM fallback</span>
          <span>Local shift brain</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div>
            <h1>Triage Bob</h1>
            <p>IBM Bob-powered incident partner for alert translation, shift memory, dashboard tracking, and Jira-style reporting.</p>
          </div>
          <div className="status">
            <span>IBM Bob integration ready</span>
            <span>{incidents.length} open incidents</span>
            <span>{active.triage.severity} active severity</span>
          </div>
        </header>

        {activeSection === "Incidents" ? <section className="workspace incidents-workspace">
          <section className="overview-strip" aria-label="Incident overview">
            <MetricCard label="Open incidents" value={incidents.length} delta="+3 this shift" tone="blue" />
            <MetricCard label="S0/S1 priority" value={incidents.filter((item) => ["S0", "S1"].includes(item.triage.severity)).length} delta="active queue" tone="amber" />
            <MetricCard label="Avg confidence" value={`${Math.round(incidents.reduce((sum, item) => sum + item.triage.confidence, 0) / incidents.length)}%`} delta="rules + LLM" tone="green" />
            <MetricCard label="Current owner" value={triage.issue_type.split(" ")[0]} delta={active.location} tone="cyan" />
          </section>

          <form className="panel incident-form" onSubmit={submitIncident}>
            <PanelTitle title="Incident input" meta="paste alert" />
            <label>Incident title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label>Raw monitoring alert<textarea value={form.raw_alert} onChange={(e) => setForm({ ...form, raw_alert: e.target.value })} /></label>
            <button className="primary" disabled={loading}>{loading ? "Bob is triaging..." : "Generate triage"}</button>
          </form>

        <section className="panel triage">
          <PanelTitle title="AI triage result" meta={triage.confidence + "% confidence"} />
          <div className={`score ${triage.severity}`}>
            <strong>{triage.severity}</strong>
            <span>{severityMeta[triage.severity]?.label}</span>
          </div>
          <h2>{triage.summary}</h2>
          <div className="tags">{triage.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="split">
            <List title="First-response steps" items={triage.first_response_steps} ordered />
            <List title="Likely code area" items={[triage.affected_area, ...triage.likely_files]} />
          </div>
          <div className="commits">
            {triage.commits.map((commit) => <div key={commit.hash}><b>{commit.hash}</b><span>{commit.message}</span></div>)}
          </div>
        </section>

        <section className="panel dashboard">
          <PanelTitle title="Incident dashboard" meta={`${filtered.length} shown`} />
          <div className="filters">
            <Select label="Severity" value={filters.severity} values={["All", "S0", "S1", "S2", "S3"]} onChange={(severity) => setFilters({ ...filters, severity })} />
            <Select label="Category" value={filters.category} values={["All", ...issueTypes]} onChange={(category) => setFilters({ ...filters, category })} />
            <Select label="Location" value={filters.location} values={["All", ...new Set(incidents.map((item) => item.location))]} onChange={(location) => setFilters({ ...filters, location })} />
          </div>
          <div className="incident-list">
            {filtered.map((item) => (
              <button className={item.id === active.id ? "incident active" : "incident"} key={item.id} onClick={() => setActiveId(item.id)}>
                <span className={`mini ${item.triage.severity}`}>{item.triage.severity}</span>
                <b>{item.title}</b>
                <small>{item.category} · {item.location} · {item.updated}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel report">
          <PanelTitle title="Jira-style report" meta={active.id} />
          <textarea readOnly value={jira} />
        </section>

        <section className="panel brain">
          <PanelTitle title="Shift Brain" meta="re-brief" />
          <p>{triage.handoff_note}</p>
          <div className="notes">
            {active.notes.map((item, index) => <div key={index}>{item}</div>)}
          </div>
          <label>Add investigation note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you check? What changed?" /></label>
          <button className="secondary" type="button" onClick={addNote}>Save note</button>
        </section>

        <section className="panel chat">
          <PanelTitle title="Ask the bot what happened" meta="chat" />
          <div className="messages">{chat.map((item, index) => <p key={index} className={item.by.toLowerCase()}><b>{item.by}</b>{item.text}</p>)}</div>
          <div className="chat-row">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
            <button className="primary" type="button" onClick={askBob}>Ask</button>
          </div>
        </section>

          <section className="panel handoff">
            <PanelTitle title="Handoff Generator" meta="end of shift" />
            <textarea readOnly value={handoff} />
          </section>
        </section> : null}

        {activeSection === "Services" ? <ServicesView incidents={incidents} /> : null}
        {activeSection === "Dashboards" ? <DashboardView /> : null}
        {activeSection === "Settings" ? <SettingsView theme={theme} setTheme={setTheme} updateStatus={updateStatus} setUpdateStatus={setUpdateStatus} /> : null}
      </div>
    </main>
  );
}

function PanelTitle({ title, meta }) {
  return <div className="panel-title"><h2>{title}</h2><span>{meta}</span></div>;
}

function MetricCard({ label, value, delta, tone }) {
  return <article className={`mini-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{delta}</small></article>;
}

function Select({ label, value, values, onChange }) {
  return <label>{label}<select value={value} onChange={(e) => onChange(e.target.value)}>{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function List({ title, items, ordered }) {
  const Tag = ordered ? "ol" : "ul";
  return <div><h3>{title}</h3><Tag>{items.map((item, index) => <li key={index}>{item}</li>)}</Tag></div>;
}

function ServicesView({ incidents }) {
  const services = issueTypes.map((name, index) => ({
    name,
    owner: ["Perception", "Prediction", "Planning", "Controls", "Localization", "Maps", "Sensors", "Operations"][index],
    health: index < 2 ? "Watch" : index < 5 ? "Stable" : "Good",
    open: incidents.filter((item) => item.category === name).length + (index % 3)
  }));

  return (
    <section className="service-grid">
      {services.map((service) => (
        <article className="panel service-card" key={service.name}>
          <PanelTitle title={service.name} meta={service.health} />
          <strong>{service.open}</strong>
          <span>open linked tickets</span>
          <p>Owner: {service.owner} team</p>
        </article>
      ))}
    </section>
  );
}

function DashboardView() {
  const totals = [
    ["All tickets", "37"],
    ["New tickets", "8"],
    ["Recurring", "11"],
    ["Resolved", "18"]
  ];

  return (
    <section className="dashboard-page">
      <div className="metric-row">
        {totals.map(([label, value]) => <div className="panel metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <section className="panel ticket-table">
        <PanelTitle title="Ticket dashboard" meta="fleet overview" />
        <div className="table-head"><span>Ticket</span><span>Location</span><span>Vehicle</span><span>Status</span><span>Repeat</span><span>Severity</span></div>
        {fleetDashboard.tickets.map((ticket) => (
          <div className="table-row" key={ticket.id}>
            <span><b>{ticket.id}</b>{ticket.title}</span>
            <span>{ticket.location}</span>
            <span>{ticket.vehicle}</span>
            <span>{ticket.status}</span>
            <span>{ticket.repeat}</span>
            <span className={`mini ${ticket.severity}`}>{ticket.severity}</span>
          </div>
        ))}
      </section>
      <section className="panel vehicle-panel">
        <PanelTitle title="Vehicles affected" meta={`${fleetDashboard.vehicles.length} vehicles`} />
        <div className="vehicle-list">{fleetDashboard.vehicles.map((vehicle) => <span key={vehicle}>{vehicle}</span>)}</div>
      </section>
      <section className="panel location-panel">
        <PanelTitle title="Tickets by location" meta="last 24h" />
        {fleetDashboard.locations.map((loc) => <div className="location-row" key={loc.name}><span>{loc.name}</span><strong>{loc.count}</strong></div>)}
      </section>
    </section>
  );
}

function SettingsView({ theme, setTheme, updateStatus, setUpdateStatus }) {
  return (
    <section className="settings-page">
      <section className="panel settings-panel">
        <PanelTitle title="Settings" meta="app preferences" />
        <div className="setting-row">
          <div><strong>Theme</strong><span>Choose light or dark mode.</span></div>
          <div className="segmented">
            <button className={theme === "dark" ? "active" : ""} type="button" onClick={() => setTheme("dark")}>Dark</button>
            <button className={theme === "light" ? "active" : ""} type="button" onClick={() => setTheme("light")}>Light</button>
          </div>
        </div>
        <div className="setting-row">
          <div><strong>Version</strong><span>Triage Bob v1.0.0</span></div>
          <button className="secondary compact" type="button" onClick={() => setUpdateStatus("Triage Bob is up to date.")}>Check for updates</button>
        </div>
        <div className="update-box">{updateStatus}</div>
      </section>
    </section>
  );
}

function ruleTriage(input) {
  const raw = `${input.title || ""} ${input.raw_alert || ""}`.toLowerCase();
  const tags = [];
  if (/pedestrian|cyclist|bike|vru|crosswalk/.test(raw)) tags.push("VRU");
  if (/brak|accelerat|steer|swerve|jerk/.test(raw)) tags.push("controls/planning");
  if (/miss|late detect|detected late|object|cone/.test(raw)) tags.push("perception");
  if (/wrong lane|position|localiz|map|hd map|lane closure/.test(raw)) tags.push("localization/map");
  if (/sensor|camera|lidar|radar|occlu|glare/.test(raw)) tags.push("sensor");

  const unsafe = /(collision|injur|unsafe|contact)/.test(raw) && !/(no collision|without collision|no injury|no injuries|no contact)/.test(raw);
  const severity = unsafe ? "S0" : /near miss|hard brake|vru|pedestrian|cyclist/.test(raw) ? "S1" : /uncomfortable|safe|jerk|swerve|nudge/.test(raw) ? "S2" : "S3";
  const issue_type = /miss|detect|object|cone|pedestrian/.test(raw) ? "Perception issue" : /predict|trajectory|vru/.test(raw) ? "Prediction issue" : /brak|steer|maneuver|path|fallback/.test(raw) ? "Planning issue" : /control|decel|accel/.test(raw) ? "Controls issue" : /localiz|position/.test(raw) ? "Localization issue" : /map|lane closure/.test(raw) ? "Map issue" : /sensor|camera|lidar|radar/.test(raw) ? "Sensor issue" : "Operator / scenario issue";
  const area = issue_type.replace(" issue", "").toLowerCase().replace(" / scenario", "");

  return {
    severity,
    issue_type,
    confidence: severity === "S0" ? 94 : severity === "S1" ? 88 : severity === "S2" ? 78 : 66,
    summary: summarize(severity, issue_type, input),
    tags: tags.length ? tags : ["needs review"],
    affected_area: `${area}-stack/${area === "map" ? "hd-map-diff" : "incident-review"}`,
    likely_files: [`av/${area}/triage_rules.ts`, `av/${area}/debug_playbook.md`, "ops/jira_templates/incident_report.md"],
    commits: [
      { hash: "a81c42e", message: `Tune ${area} confidence thresholds` },
      { hash: "7df30b9", message: "Add AV incident replay annotations" },
      { hash: "3c19aa4", message: "Update Jira handoff template fields" }
    ],
    first_response_steps: [
      "Open the replay window and mark the first timestamp where behavior diverges from expectation.",
      "Check perception, prediction, planning, controls, localization, map, and sensor signals against the event tags.",
      "Create a Jira report with severity, affected stack, evidence links, and the next owner."
    ],
    handoff_note: `Keep focus on ${issue_type.toLowerCase()} evidence, severity ${severity}, scene context, and whether the behavior was unsafe or only uncomfortable.`
  };
}

function summarize(severity, issueType, input) {
  const location = input.location ? ` in ${input.location}` : "";
  return `${severity} ${issueType.toLowerCase()}${location}. Bob flagged the event from the alert text and prepared first-response checks for the on-call triage engineer.`;
}

function normalizeClientTriage(triage, input) {
  const fallback = ruleTriage(input);
  return {
    ...fallback,
    ...triage,
    severity: ["S0", "S1", "S2", "S3"].includes(triage.severity) ? triage.severity : fallback.severity,
    issue_type: issueTypes.includes(triage.issue_type) ? triage.issue_type : fallback.issue_type,
    confidence: Math.round(Number(triage.confidence || fallback.confidence)),
    tags: Array.isArray(triage.tags) ? triage.tags : fallback.tags
  };
}

function buildJira(incident) {
  const t = incident.triage;
  return [
    `Project: AVOPS`,
    `Issue Type: Incident`,
    `Summary: [${t.severity}] ${incident.title}`,
    `Location: ${incident.location}`,
    `Severity: ${t.severity} - ${severityMeta[t.severity]?.label}`,
    `Category: ${t.issue_type}`,
    `Tags: ${t.tags.join(", ")}`,
    "",
    "Description:",
    t.summary,
    "",
    "Acceptance / next checks:",
    ...t.first_response_steps.map((step) => `- ${step}`),
    "",
    "Raw alert:",
    incident.raw_alert
  ].join("\n");
}

function buildHandoff(incidents) {
  return [
    "# Triage Bob Handoff",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...incidents.flatMap((incident) => [
      `## ${incident.id} - ${incident.title}`,
      `Severity: ${incident.triage.severity}`,
      `Category: ${incident.triage.issue_type}`,
      `Location: ${incident.location}`,
      `Current read: ${incident.triage.summary}`,
      `Notes: ${incident.notes.length ? incident.notes.join(" | ") : "No notes yet."}`,
      ""
    ])
  ].join("\n");
}

export default App;
