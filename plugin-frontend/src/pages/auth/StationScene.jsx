import './StationScene.css';

/* ==========================================================================
   PLUGIN - auth stage scene

   An axonometric charging park, drawn as line art on near-black so it reads
   as the same product as the landing page.

   Camera: 2:1 dimetric, looking down the row of bays from above and in front.
     +gx  -> screen (+104, +52)   the row of bays runs this way
     +gy  -> screen (-104, +52)   a car's forward direction, toward the viewer
     +z   -> screen (0, -1)       plain vertical pixels

   Every bay runs the same 24s loop offset by 6s, so at any moment two bays
   are charging while one car pulls in and another pulls away. All motion is
   CSS with a negative animation-delay, so the scene opens already mid-cycle
   and costs nothing per React render.
   ========================================================================== */

const W2 = 104;
const H2 = 52;

const r1 = (n) => Math.round(n * 10) / 10;

/* grid point -> scene pixels */
const pt = (gx, gy, z = 0) => [r1((gx - gy) * W2), r1((gx + gy) * H2 - z)];
const s = (gx, gy, z = 0) => pt(gx, gy, z).join(',');
const quad = (a, b, c, d) => `${a} ${b} ${c} ${d}`;

/* Four slots stepping down-right, two grid units apart. The whole park is
   then scaled and panned as one, so framing is two numbers rather than a
   hunt through every coordinate. */
const BAYS = [0, 1, 2, 3];
const BAY_PITCH = 2;
const SCALE = 0.8;
const PAN = [271, 290];
const CYCLE = 24;

/* Where the post stands relative to its bay centre: ahead of the nose and
   out to the right, so the cable is never hidden by the car it feeds. */
const POST_GX = 1.15;
const POST_GY = 2;
const POST_H = 96;

const bayXY = (i) => [i * BAY_PITCH * W2, i * BAY_PITCH * H2];

const postXY = pt(POST_GX, POST_GY);
/* cable outlet on the post's right cheek, and the car's flank port */
const outlet = [postXY[0] + pt(0.15, 0.11, 52)[0], postXY[1] + pt(0.15, 0.11, 52)[1]];
const port = pt(0.525, 0.55, 40);
const CABLE = `M ${outlet[0]} ${outlet[1]} C ${outlet[0] + 25} ${outlet[1] + 44} ${port[0] - 28} ${port[1] + 82} ${port[0]} ${port[1]}`;

/* -------------------------------------------------------------------- cars */

const CARS = [
  { hl: 1.1, z2: 56, z3: 90, ghF: 0.44, ghR: -0.78, ghW: 0.45 },
  { hl: 1.14, z2: 62, z3: 103, ghF: 0.4, ghR: -0.86, ghW: 0.47 },
  { hl: 1.04, z2: 53, z3: 85, ghF: 0.38, ghR: -0.72, ghW: 0.43 },
  { hl: 1.12, z2: 58, z3: 94, ghF: 0.42, ghR: -0.82, ghW: 0.46 },
];

function Car({ spec }) {
  const hw = 0.525;
  const { hl, z2, z3, ghF, ghR, ghW } = spec;
  const z1 = 20;
  const rw = ghW * 0.88;
  const rF = ghF - 0.2;
  const rR = ghR + 0.16;

  return (
    <g className="sc-car">
      {/* contact pool, so the car sits on the deck instead of floating over it */}
      <ellipse className="sc-car__pool" cx="0" cy="0" rx="182" ry="92" />

      <polygon className="sc-car__skirt" points={quad(s(hw, hl), s(hw, -hl), s(hw, -hl, z1), s(hw, hl, z1))} />
      <polygon className="sc-car__skirt" points={quad(s(-hw, hl), s(hw, hl), s(hw, hl, z1), s(-hw, hl, z1))} />

      <polygon className="sc-car__flank" points={quad(s(hw, hl, z1), s(hw, -hl, z1), s(hw, -hl, z2), s(hw, hl, z2))} />
      <polygon className="sc-car__face" points={quad(s(-hw, hl, z1), s(hw, hl, z1), s(hw, hl, z2), s(-hw, hl, z2))} />
      <polygon className="sc-car__deck" points={quad(s(hw, hl, z2), s(-hw, hl, z2), s(-hw, -hl, z2), s(hw, -hl, z2))} />

      <polygon className="sc-car__glass" points={quad(s(-ghW, ghF, z2), s(ghW, ghF, z2), s(rw, rF, z3), s(-rw, rF, z3))} />
      <polygon className="sc-car__glass" points={quad(s(ghW, ghF, z2), s(ghW, ghR, z2), s(rw, rR, z3), s(rw, rF, z3))} />
      <polygon className="sc-car__roof" points={quad(s(rw, rF, z3), s(-rw, rF, z3), s(-rw, rR, z3), s(rw, rR, z3))} />

      {/* full-width light bar: the one detail that says "electric" at a glance */}
      <polygon className="sc-car__lamp" points={quad(s(-0.46, hl, z1 + 15), s(0.46, hl, z1 + 15), s(0.46, hl, z1 + 21), s(-0.46, hl, z1 + 21))} />
      <polygon className="sc-car__port" points={quad(s(hw, 0.63, 33), s(hw, 0.47, 33), s(hw, 0.47, 46), s(hw, 0.63, 46))} />

      <ellipse
        className="sc-car__wheel"
        cx="0"
        cy="0"
        rx="21"
        ry="12"
        transform={`translate(${pt(hw + 0.02, 0.66, 20).join(' ')}) rotate(-26.57)`}
      />
      <ellipse
        className="sc-car__wheel"
        cx="0"
        cy="0"
        rx="21"
        ry="12"
        transform={`translate(${pt(hw + 0.02, -0.7, 20).join(' ')}) rotate(-26.57)`}
      />
    </g>
  );
}

/* ------------------------------------------------------------------- posts */

/* The post's front cheek is a plane; this matrix lets everything printed on
   it be authored as plain rects. Local x is hundredths of a grid unit, local
   y is height in pixels. */
const FACE = `matrix(1.04 0.52 0 -1 ${pt(0, 0.11)[0]} ${pt(0, 0.11)[1]})`;

function Post() {
  const w = 0.15;
  const d = 0.11;

  return (
    <g className="sc-post">
      <polygon className="sc-post__side" points={quad(s(w, d), s(w, -d), s(w, -d, POST_H), s(w, d, POST_H))} />
      <polygon className="sc-post__cap" points={quad(s(w, d, POST_H), s(-w, d, POST_H), s(-w, -d, POST_H), s(w, -d, POST_H))} />

      <g transform={FACE}>
        <rect className="sc-post__face" x="-15" y="0" width="30" height={POST_H} />
        <rect className="sc-post__screen" x="-11.5" y="50" width="23" height="30" />
        <rect className="sc-post__track" x="-8" y="56" width="16" height="6" />
        <rect className="sc-post__fill" x="-8" y="56" width="16" height="6" />
        <rect className="sc-post__slot" x="-8" y="68" width="9" height="3.6" />
        <rect className="sc-post__slot" x="3" y="68" width="5" height="3.6" />
        <circle className="sc-post__led" cx="0" cy="88" r="3" />
        <rect className="sc-post__grill" x="-6" y="20" width="12" height="1.6" />
        <rect className="sc-post__grill" x="-6" y="26" width="12" height="1.6" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------- decor */

function Deck() {
  const lines = [];
  for (let gy = -3; gy <= 9; gy += 1) {
    lines.push(
      <line key={`a${gy}`} x1={pt(-4, gy)[0]} y1={pt(-4, gy)[1]} x2={pt(10, gy)[0]} y2={pt(10, gy)[1]} />,
    );
  }
  for (let gx = -4; gx <= 10; gx += 1) {
    lines.push(
      <line key={`b${gx}`} x1={pt(gx, -3)[0]} y1={pt(gx, -3)[1]} x2={pt(gx, 9)[0]} y2={pt(gx, 9)[1]} />,
    );
  }
  return <g className="sc-deck">{lines}</g>;
}

function Wall() {
  const gy = -2.75;
  const h = 172;
  const mullions = [];
  for (let i = 0; i <= 11; i += 1) {
    const gx = -3.6 + i * 1.2;
    mullions.push(
      <line key={i} x1={pt(gx, gy)[0]} y1={pt(gx, gy)[1]} x2={pt(gx, gy, h)[0]} y2={pt(gx, gy, h)[1]} />,
    );
  }
  return (
    <g className="sc-wall">
      <polygon className="sc-wall__face" points={quad(s(-4.2, gy), s(9, gy), s(9, gy, h), s(-4.2, gy, h))} />
      <g className="sc-wall__mullions">{mullions}</g>
      <line className="sc-wall__strip" x1={pt(-4.2, gy, h - 28)[0]} y1={pt(-4.2, gy, h - 28)[1]} x2={pt(9, gy, h - 28)[0]} y2={pt(9, gy, h - 28)[1]} />
      <line className="sc-wall__cap" x1={pt(-4.2, gy, h)[0]} y1={pt(-4.2, gy, h)[1]} x2={pt(9, gy, h)[0]} y2={pt(9, gy, h)[1]} />
    </g>
  );
}

/* -------------------------------------------------------------------- bays */

function Bay({ index }) {
  const [bx, by] = bayXY(index);
  const slot = quad(s(0.675, 1.3), s(-0.675, 1.3), s(-0.675, -1.3), s(0.675, -1.3));

  return (
    <g
      className="sc-bay"
      transform={`translate(${bx} ${by})`}
      style={{ '--sc-delay': `${-index * (CYCLE / BAYS.length)}s` }}
    >
      <polygon className="sc-bay__open" points={slot} />
      <polygon className="sc-bay__slot" points={slot} />
      <line
        className="sc-bay__sill"
        x1={pt(-0.675, 1.3)[0]}
        y1={pt(-0.675, 1.3)[1]}
        x2={pt(0.675, 1.3)[0]}
        y2={pt(0.675, 1.3)[1]}
      />

      <g className="sc-car-fade">
        <g className="sc-car-move">
          <Car spec={CARS[index]} />
        </g>
      </g>

      <g transform={`translate(${postXY[0]} ${postXY[1]})`}>
        <Post />
      </g>
      <path className="sc-cable" d={CABLE} />
      <path className="sc-cable sc-cable--flow" d={CABLE} />

      <g className="sc-chip" transform={`translate(${postXY[0]} ${postXY[1] + 34})`}>
        <line className="sc-chip__leader" x1="0" y1="-26" x2="0" y2="-9" />
        <text className="sc-chip__id" x="0" y="0">{`BAY ${String(index + 1).padStart(2, '0')}`}</text>
        <text className="sc-chip__state sc-chip__state--open" x="0" y="17">BAY OPEN</text>
        <text className="sc-chip__state sc-chip__state--arrive" x="0" y="17">ARRIVING</text>
        <text className="sc-chip__state sc-chip__state--charge" x="0" y="17">CHARGING 60 kW</text>
        <text className="sc-chip__state sc-chip__state--ready" x="0" y="17">COMPLETE</text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------- scene */

export default function StationScene() {
  return (
    <svg
      className="sc"
      viewBox="0 0 1000 900"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A charging park seen from above: four bays, with cars arriving, charging and pulling away."
    >
      <defs>
        <radialGradient id="sc-sky" cx="52%" cy="12%" r="74%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.13" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sc-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sc-fade" cx="52%" cy="48%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <mask id="sc-deck-mask">
          <rect x="0" y="0" width="1000" height="900" fill="url(#sc-fade)" />
        </mask>
      </defs>

      <rect x="0" y="0" width="1000" height="900" fill="url(#sc-sky)" />

      <g transform={`translate(${PAN[0]} ${PAN[1]}) scale(${SCALE})`}>
        <g mask="url(#sc-deck-mask)">
          <Deck />
        </g>
        <Wall />
        <g className="sc-sweep" aria-hidden="true">
          <line x1={pt(-4, 0)[0]} y1={pt(-4, 0)[1]} x2={pt(10, 0)[0]} y2={pt(10, 0)[1]} />
        </g>

        {BAYS.map((index) => (
          <Bay key={index} index={index} />
        ))}
      </g>

      <g className="sc-motes" aria-hidden="true">
        {[
          [176, 250, 0],
          [420, 158, -3.2],
          [648, 300, -6.4],
          [842, 214, -1.6],
          [300, 520, -8.1],
          [560, 612, -4.4],
          [780, 700, -9.6],
          [120, 640, -2.4],
        ].map(([x, y, d]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" style={{ animationDelay: `${d}s` }} />
        ))}
      </g>
    </svg>
  );
}
