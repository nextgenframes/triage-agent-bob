import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import './launch.css';

const alertText =
  'CRITICAL p99_latency_checkout_service > 2000ms for 8m. Error budget burn 14x.';

const steps = [
  'Confirm deploy timing',
  'Check dependency saturation',
  'Prepare rollback path',
];

const commits = ['9f31c22 retry wrapper', '4ab8d90 latency dimensions', '16de45a timeout handling'];

function fade(frame, start, duration = 22) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

function rise(frame, start, amount = 36) {
  const p = fade(frame, start, 24);
  return {
    opacity: p,
    transform: `translateY(${interpolate(p, [0, 1], [amount, 0])}px)`,
  };
}

function Header() {
  return (
    <div className="videoHeader">
      <div>
        <h1>Triage Bob</h1>
        <p>On-call response console</p>
      </div>
      <div className="videoPills">
        <span className="whitePill">IBM Bob connected</span>
        <span>Triage Partner mode</span>
        <span>Supabase ready</span>
      </div>
    </div>
  );
}

function PerceptionScene({compact = false}) {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % 90, [0, 90], [-54, 54]);
  return (
    <div className={compact ? 'perception compact' : 'perception'}>
      <div className="roadHaze" />
      <div className="roadGrid" />
      <div className="walk near" />
      <div className="walk far" />
      <div className="lane left" />
      <div className="lane center" />
      <div className="lane right" />
      {[-55, -35, -18, 17, 37, 55].map((angle, index) => (
        <div
          className={`ray ray${index}`}
          key={angle}
          style={{transform: `rotate(${angle + (index === 0 ? sweep * 0.05 : 0)}deg)`}}
        />
      ))}
      <div className="detected car leftCar" />
      <div className="detected car centerCar" />
      <div className="detected car rightCar" />
      <div className="detected bus" />
      <div className="person personLeft" />
      <div className="person personRight" />
      <div className="egoCar" />
    </div>
  );
}

function ConsoleCard({frame}) {
  return (
    <div className="consoleCard" style={rise(frame, 20)}>
      <div className="consoleTitle">Alert Translator</div>
      <div className="alertLine">{alertText}</div>
      <div className="statusStrip">
        <span>Critical</span>
        <span>checkout-service</span>
        <span>86 confidence</span>
      </div>
    </div>
  );
}

function TriageBrief({frame}) {
  return (
    <div className="briefGrid">
      <div className="briefText" style={rise(frame, 132)}>
        <span className="redTag">Critical</span>
        <h2>Know what broke before the second page.</h2>
        <p>
          Bob turns a raw production alert into plain English, likely affected files, recent
          commits, and the first three checks.
        </p>
      </div>
      <div className="stepStack" style={rise(frame, 158)}>
        {steps.map((step, index) => (
          <div className="step" key={step}>
            <span>{index + 1}</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function WarRoom({frame}) {
  return (
    <div className="warRoom" style={rise(frame, 292)}>
      <div className="warColumn wide">
        <div className="panelLabel">Shift Brain</div>
        <h3>Return to any incident with full context.</h3>
        <div className="timeline">
          <div>02:14 Bob mapped alert to checkout-service</div>
          <div>02:18 Maya confirmed deploy timing</div>
          <div>02:23 Rollback owner assigned</div>
        </div>
      </div>
      <div className="warColumn">
        <div className="panelLabel">Last commits</div>
        {commits.map((commit) => (
          <div className="commitPill" key={commit}>{commit}</div>
        ))}
      </div>
    </div>
  );
}

function Handoff({frame}) {
  const reveal = spring({
    frame: frame - 420,
    fps: 30,
    config: {damping: 18, stiffness: 80},
  });
  return (
    <div
      className="handoff"
      style={{
        opacity: fade(frame, 420, 18),
        transform: `translateY(${interpolate(reveal, [0, 1], [60, 0])}px)`,
      }}
    >
      <div>
        <span className="greenTag">Handoff Generator</span>
        <h2>One click at end of shift.</h2>
        <p>Structured Markdown summary, open questions, mitigation status, and next owner.</p>
      </div>
      <pre>{`# Bob on Call Handoff\n\nSeverity: Critical\nService: checkout-service\nNext: rollback or disable retry flag\nOwner: Maya`}</pre>
    </div>
  );
}

function LaunchVideo() {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const closing = fade(frame, durationInFrames - 78, 22);

  return (
    <AbsoluteFill className="videoRoot">
      <Header />
      <Sequence from={0} durationInFrames={148}>
        <div className="heroScene">
          <div className="heroCopy" style={rise(frame, 8)}>
            <span className="blueTag">2 AM INCIDENT RESPONSE</span>
            <h2>From raw alert to first action in 60 seconds.</h2>
            <p>Built for the engineer who just got paged and needs clarity now.</p>
          </div>
          <ConsoleCard frame={frame} />
        </div>
      </Sequence>
      <Sequence from={90} durationInFrames={230}>
        <div className="splitScene">
          <PerceptionScene />
          <TriageBrief frame={frame} />
        </div>
      </Sequence>
      <Sequence from={260} durationInFrames={190}>
        <WarRoom frame={frame} />
      </Sequence>
      <Sequence from={390} durationInFrames={150}>
        <Handoff frame={frame} />
      </Sequence>
      <div className="closing" style={{opacity: closing}}>
        <h2>Bob on Call</h2>
        <p>Saving an engineer&apos;s sanity at 2 AM.</p>
      </div>
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <Composition
      id="TriageBobLaunch"
      component={LaunchVideo}
      durationInFrames={540}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
