import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';
import './Landing.css';

/* ==========================================================================
   PLUGIN â€” landing page

   1. Hero      giant PLUGIN wordmark, the plug mark in the middle, short copy
   2. Problem   an animated station: too many cars, not enough bays
   3. Solution  the same station, coordinated
   4. Platform  what the software actually provides
   5. Trust     what the record is built on
   6. Join      two ways in: run a station, or charge a vehicle

   Every decorative animation is paused until its section is on screen, so
   scrolling stays smooth. No cursor tracking anywhere.
   ========================================================================== */

const EASE = [0.16, 1, 0.3, 1];
const EASE_SOFT = [0.22, 1, 0.36, 1];
/* slight overshoot, so the mark visibly seats into the word */
const SEAT = [0.34, 1.42, 0.64, 1];

/* The plug mark stands in for the letter I. `null` marks its slot. */
const WORDMARK = ['P', 'L', 'U', 'G', null, 'N'];
const MARK_INDEX = WORDMARK.indexOf(null);
/* roughly one letter advance, used to launch each letter from the plug */
const SLOT = 0.74;

const NAV_SECTIONS = [
  { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' },
  { id: 'platform', label: 'Platform' },
  { id: 'join', label: 'Get started' },
];

const SECTION_IDS = NAV_SECTIONS.map((section) => section.id);

const SOLUTION_STATEMENT =
  'PLUGIN is the layer that coordinates it. Every connector visible, every window held in advance, every price known before the cable goes in and every session settled after it comes out.';

const CAPABILITIES = [
  {
    key: 'visibility',
    title: 'Live network state',
    answers: 'Fixes the guessing',
    line: 'Every connector at every site, reconciled continuously into one picture you can trust.',
    tags: ['Connector state', 'Site health', 'Coverage'],
  },
  {
    key: 'reservations',
    title: 'Held windows',
    answers: 'Fixes the queue',
    line: 'Capacity allocated in time-bounded windows, committed atomically so two drivers never hold one bay.',
    tags: ['Windows', 'Conflict checks', 'Atomic writes'],
  },
  {
    key: 'telemetry',
    title: 'Metered sessions',
    answers: 'Fixes the black box',
    line: 'Energy and duration tracked live, from the first amp to the last, for driver and operator alike.',
    tags: ['Live metering', 'kWh delivered', 'Stop rules'],
  },
  {
    key: 'billing',
    title: 'Settled billing',
    answers: 'Fixes the surprise bill',
    line: 'One tariff engine quotes before the session and itemises after it. The number never moves.',
    tags: ['Tariff rules', 'Itemised invoices', 'Settlement'],
  },
];

const TRUST = [
  { key: 'access', title: 'Role-scoped access', line: 'Exact allow-lists per route. No implicit privilege.' },
  { key: 'identity', title: 'Verified identity', line: 'Accounts confirmed by one-time code, credentials hashed.' },
  { key: 'atomic', title: 'Atomic writes', line: 'Reservations, sessions and wallets commit fully or not at all.' },
  { key: 'audit', title: 'Auditable records', line: 'Every figure can be traced back to the session behind it.' },
];

const JOIN_OPTIONS = [
  {
    key: 'operator',
    kind: 'For station owners',
    title: 'Run a charging station',
    lead: 'Put your site on the network and manage it from one console.',
    points: [
      'Verified onboarding with document checks',
      'Live connector health and utilisation per site',
      'Your tariffs, your revenue, your control',
    ],
    cta: 'Apply as station manager',
    to: '/station-manager/apply',
  },
  {
    key: 'driver',
    kind: 'For drivers',
    title: 'Charge your vehicle',
    lead: 'One account, used in the PLUGIN mobile app.',
    points: [
      'See the connectors that are genuinely free',
      'Hold a charging window before you drive',
      'An itemised bill after every session',
    ],
    cta: 'Create account',
    to: '/register',
  },
];

/* ------------------------------------------------------------------- icons */

const Menu = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const Close = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ArrowNE = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M8 16 16 8M9.5 8H16v6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const JOIN_ICONS = {
  operator: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 20V6.5A1.5 1.5 0 0 1 7.5 5h6A1.5 1.5 0 0 1 15 6.5V20" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.5 20h16M15 10h2.5A1.5 1.5 0 0 1 19 11.5V17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.2 8.5 9 12h2l-.4 3 2.4-3.6h-1.6l.8-2.9Z" fill="currentColor" />
    </svg>
  ),
  driver: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 15.5v-2l1.8-4.2A2 2 0 0 1 7.6 8h8.8a2 2 0 0 1 1.8 1.3L20 13.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3.5 15.5h17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7.5" cy="17.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16.5" cy="17.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
};

/* -------------------------------------------------------------------- logo */

/* Two lockups: the full one carries the word "plugin" and is used in the
   footer; the mark alone is used in the nav, and inline in the hero wordmark.
   Both are white artwork on transparency, generated from the original at
   source resolution. */
const MARK_SRC = '/plugin-mark-light.png';
const LOCKUP_SRC = '/plugin-logo-light.png';

function Logo({ variant }) {
  return (
    <img
      src={variant === 'nav' ? MARK_SRC : LOCKUP_SRC}
      alt="PLUGIN"
      className={variant ? `lp-logo lp-logo--${variant}` : 'lp-logo'}
      draggable="false"
      decoding="async"
    />
  );
}

/* ------------------------------------------------------------------ pieces */

function Shell({ children, className = '' }) {
  return <div className={`lp-shell ${className}`.trim()}>{children}</div>;
}

/* Adds `is-live` only while the block is on screen, so CSS animations stay
   paused off-screen instead of compositing the whole page at once. */
function useLive(margin = '-10% 0px') {
  const ref = useRef(null);
  const live = useInView(ref, { margin });
  return [ref, live];
}

function SectionLabel({ index, children }) {
  return (
    <motion.p
      className="lp-label"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <span className="lp-label__index">{index}</span>
      <span className="lp-label__rule" aria-hidden="true" />
      {children}
    </motion.p>
  );
}

function Reveal({ children, delay = 0, y = 26, className }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Head({ index, label, title, line }) {
  return (
    <div className="lp-head">
      <SectionLabel index={index}>{label}</SectionLabel>
      <Reveal delay={0.06}>
        <h2 className="lp-head__title">{title}</h2>
      </Reveal>
      {line ? (
        <Reveal delay={0.12}>
          <p className="lp-head__line">{line}</p>
        </Reveal>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- chrome */

function ScrollRail() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 260, damping: 40, mass: 0.35 });
  return <motion.div className="lp-rail" style={{ scaleX }} aria-hidden="true" />;
}

/* Matches the breakpoint where the stylesheet drops sticky card stacking. */
function useCompactViewport(query = '(max-width: 940px)') {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia(query);
    const update = () => setCompact(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return compact;
}

function useActiveSection() {
  const [active, setActive] = useState(SECTION_IDS[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const nodes = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return active;
}

function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className={`lp-nav${solid || open ? ' is-solid' : ''}`}>
      <div className="lp-nav__bar">
        <Link to="/" className="lp-nav__brand">
          <Logo variant="nav" />
        </Link>

        <nav className="lp-nav__links" aria-label="Page sections">
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`lp-nav__link${active === section.id ? ' is-active' : ''}`}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="lp-nav__actions">
          <Link to="/login" className="lp-nav__ghost">Sign in</Link>
          <Link to="/register" className="lp-btn lp-btn--sm">
            Create account
            <ArrowNE />
          </Link>
        </div>

        <button
          type="button"
          className="lp-nav__toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="lp-nav-drawer"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <Close /> : <Menu />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="lp-nav-drawer"
            className="lp-nav__drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_SOFT }}
          >
            <div className="lp-nav__drawer-in">
              {NAV_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="lp-nav__drawer-link"
                  onClick={() => setOpen(false)}
                >
                  {section.label}
                </a>
              ))}
              <Link to="/login" className="lp-nav__drawer-link" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link to="/register" className="lp-btn lp-btn--block" onClick={() => setOpen(false)}>
                Create account
                <ArrowNE />
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------- hero */

/* One letter of the brand word.
   Entrance: it emerges from behind the plug and settles into its slot.
   Exit: as the hero scrolls away it converges back into the plug, so the
   whole word folds into the connector it came from. */
function WordLetter({ glyph, offset, rank, progress, motionOff }) {
  const converge = useTransform(progress, [0, 0.7], ['0em', `${-offset * 0.52}em`]);

  return (
    <motion.span
      className="lp-hero__slot"
      style={motionOff ? undefined : { x: converge }}
    >
      <motion.span
        initial={motionOff
          ? { opacity: 0 }
          : { opacity: 0, x: `${-offset * SLOT}em`, scale: 0.88, filter: 'blur(9px)' }}
        animate={motionOff
          ? { opacity: 1 }
          : { opacity: 1, x: '0em', scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.15, delay: 0.8 + rank * 0.085, ease: EASE }}
      >
        {glyph}
      </motion.span>
    </motion.span>
  );
}

function Hero({ motionOff }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const ghostScale = useTransform(scrollYProgress, [0, 1], [1, 1.16]);
  const stageY = useTransform(scrollYProgress, [0, 1], ['0%', '-22%']);
  const stageOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.16], [1, 0]);

  return (
    <section className="lp-hero" ref={ref}>
      <Shell>
        <motion.div
          className="lp-hero__stage"
          style={motionOff ? undefined : { y: stageY, opacity: stageOpacity }}
        >
          {/* The brand word, with the plug mark standing in for the letter I.
              The plug drops and compresses onto the baseline, then the
              letters unfold outward from it â€” nearest first. One pass only,
              no flashes. */}
          <motion.p
            className="lp-hero__word"
            style={motionOff ? undefined : { scale: ghostScale }}
            aria-hidden="true"
          >
            {WORDMARK.map((glyph, index) => {
              if (glyph === null) {
                return (
                  <motion.img
                    key="mark"
                    className="lp-hero__glyph"
                    src={MARK_SRC}
                    alt=""
                    draggable="false"
                    initial={motionOff ? { opacity: 0 } : { opacity: 0, y: '-88%', scaleY: 1.24 }}
                    animate={motionOff ? { opacity: 1 } : { opacity: 1, y: '0%', scaleY: 1 }}
                    transition={{ duration: 0.95, delay: 0.1, ease: SEAT }}
                  />
                );
              }

              /* how far this letter sits from the plug, in slots */
              const offset = index - MARK_INDEX;

              return (
                <WordLetter
                  key={`${glyph}-${index}`}
                  glyph={glyph}
                  offset={offset}
                  rank={Math.abs(offset) - 1}
                  progress={scrollYProgress}
                  motionOff={motionOff}
                />
              );
            })}
          </motion.p>

          <h1 className="lp-hero__title">
            <span className="lp-hero__line">
              <motion.span
                className="lp-hero__word-line"
                initial={{ y: '110%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1, delay: 1.5, ease: EASE }}
              >
                Charging, coordinated.
              </motion.span>
            </span>
          </h1>

          <motion.p
            className="lp-hero__lead"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.75, ease: EASE }}
          >
            The control layer for EV charging networks.
          </motion.p>
        </motion.div>
      </Shell>

      <motion.div
        className="lp-hero__cue"
        style={motionOff ? undefined : { opacity: cueOpacity }}
        aria-hidden="true"
      >
        <span className="lp-hero__cue-line"><i /></span>
        <span className="lp-hero__cue-text">Scroll</span>
      </motion.div>
    </section>
  );
}

/* ==================================================== demand on a timeline

   The problem and the solution are the same picture twice: a working day of
   charging demand, per charging point. Left uncoordinated, requests land on
   top of each other and collide. Allocated, the very same demand packs into
   the same four connectors without a single conflict.
   ========================================================================= */

const AXIS = ['09', '11', '13', '15', '17', '19'];

/* [start, width] as a percentage of the working day */
const ALLOCATED = [
  { id: 'CP-01', blocks: [[6, 26], [34, 24]] },
  { id: 'CP-02', blocks: [[12, 22], [38, 28]] },
  { id: 'CP-03', blocks: [[8, 28], [40, 22], [66, 20]] },
  { id: 'CP-04', blocks: [[18, 34], [56, 26]] },
];

function DemandGrid({ lanes, stats }) {
  const [ref, live] = useLive('-8% 0px');

  return (
    <div className={`lp-grid${live ? ' is-live' : ''}`} ref={ref}>
      <div className="lp-grid__axis" aria-hidden="true">
        {AXIS.map((hour) => <span key={hour}>{hour}</span>)}
      </div>

      <div className="lp-grid__lanes">
        {lanes.map((lane, laneIndex) => (
          <div className="lp-grid__lane" key={lane.id}>
            <span className="lp-grid__id">{lane.id}</span>
            <span className="lp-grid__track">
              {lane.blocks.map(([start, width], blockIndex) => (
                <span
                  className="lp-grid__block"
                  key={`${start}-${blockIndex}`}
                  style={{
                    left: `${start}%`,
                    width: `${width}%`,
                    '--d': `${(laneIndex * 0.1 + blockIndex * 0.16).toFixed(2)}s`,
                  }}
                />
              ))}
            </span>
          </div>
        ))}
        <span className="lp-grid__playhead" aria-hidden="true" />
      </div>

      <div className="lp-grid__foot">
        {stats.map((stat) => (
          <span className="lp-grid__stat" key={stat.label}>
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ================================================ the problem, one at a time

   The readings a driver needs already exist somewhere on the network:
   connector state, the live tariff, how deep the queue is. Rather than list
   them all at once, the section pins and the scroll turns a machined dial.
   Each signal rides the graduated barrel round to the gate at nine o'clock,
   the hub reads out which signal has arrived, and the column on the left
   states the problem it causes in full - one problem, then the next.
   ============================================================================ */

const PROBLEM_NODES = [
  {
    n: '01',
    signal: 'Connector status',
    who: 'Driver',
    title: 'You cannot see which connectors are free',
    line: 'Live availability stays locked inside each operator\u2019s own app, so a bay looks open right up to the moment you park beside a cable already in use.',
    cost: 'A detour that ends in a queue',
  },
  {
    n: '02',
    signal: 'Live tariff',
    who: 'Driver',
    title: 'The price appears only once you are plugged in',
    line: 'Rates move by site, by connector and by hour. What the session will actually cost is disclosed at the plug, never while there is still a choice.',
    cost: 'A bill nobody agreed to',
  },
  {
    n: '03',
    signal: 'Queue depth',
    who: 'Driver',
    title: 'The queue stays invisible until you are in it',
    line: 'Cars can already be waiting on the connector you picked, and nothing reaches you while there is still time to pick a different site.',
    cost: 'Waiting, with no way out',
  },
];

/* ------------------------------------------------------------- the wheel

   The instrument is an alloy road wheel, so the section reads as the car it
   is about: tyre and sidewall, a polished lip, five machined spokes over a
   slotted brake disc, lug bolts, and a centre cap that carries the readout.

   The three signals are machined into the lip. Scrolling spins the wheel a
   full turn plus a third per step, so each signal arrives at the reading head
   at nine o'clock - the head that faces the copy - after a real spin rather
   than a nudge. Everything below is laid out in the same 0-100 space the SVG
   layers use and is computed once at module load; nothing here runs per frame.
   ============================================================================ */

const WHEEL_STEP = 360 / PROBLEM_NODES.length; /* angle between two signals */
const WHEEL_TURN = WHEEL_STEP + 360; /* the same, plus one full turn of spin */
const WHEEL_ARMS = 5;

const R_TRACK = 52.4; /* the progress ring, orbiting outside the tyre */
const R_TYRE = 49.4; /* the outer edge of the tyre */
const R_BEAD = 40.6; /* where the rubber meets the rim */
const R_MARK = 39.1; /* the signals, machined into the lip */
const R_LIP = 37.6; /* the inner edge of the polished lip */
const R_KNURL = 34.4; /* the knurled band inside the lip */
const R_ARM_OUT = 34;
const R_ARM_IN = 23.6;
const R_DISC = 30.6; /* the brake disc, seen through the spokes */
const R_LUG = 26.4; /* the lug bolts, one per spoke */
const R_LABEL = 30.2; /* the printed number for each signal */

function wheelPoint(radius, deg) {
  const rad = (deg * Math.PI) / 180;
  return [50 + Math.cos(rad) * radius, 50 + Math.sin(rad) * radius];
}

function wheelArc(radius, from, to) {
  const [x1, y1] = wheelPoint(radius, from);
  const [x2, y2] = wheelPoint(radius, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${large} ${sweep} ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

/* one spoke: wide where it leaves the centre, tapered where it meets the lip */
function wheelArm(deg) {
  const wi = 15.5;
  const wo = 9.4;
  const [ax, ay] = wheelPoint(R_ARM_IN, deg - wi);
  const [bx, by] = wheelPoint(R_ARM_OUT, deg - wo);
  const [cx, cy] = wheelPoint(R_ARM_OUT, deg + wo);
  const [dx, dy] = wheelPoint(R_ARM_IN, deg + wi);
  return [
    `M ${ax.toFixed(3)} ${ay.toFixed(3)}`,
    `L ${bx.toFixed(3)} ${by.toFixed(3)}`,
    `A ${R_ARM_OUT} ${R_ARM_OUT} 0 0 1 ${cx.toFixed(3)} ${cy.toFixed(3)}`,
    `L ${dx.toFixed(3)} ${dy.toFixed(3)}`,
    `A ${R_ARM_IN} ${R_ARM_IN} 0 0 0 ${ax.toFixed(3)} ${ay.toFixed(3)}`,
    'Z',
  ].join(' ');
}

/* the spokes sit on the odd angles, so no spoke ever hides a signal */
const WHEEL_ARM_ANGLES = Array.from(
  { length: WHEEL_ARMS },
  (_, i) => -54 + i * (360 / WHEEL_ARMS),
);

const WHEEL_ARM_PATHS = WHEEL_ARM_ANGLES.map((deg) => wheelArm(deg));

const WHEEL_LUGS = WHEEL_ARM_ANGLES.map((deg) => {
  const [x, y] = wheelPoint(R_LUG, deg);
  return { key: deg, x: x.toFixed(3), y: y.toFixed(3) };
});

/* the knurled band on the barrel: fine machining that catches the spin */
const WHEEL_KNURL = Array.from({ length: 90 }, (_, i) => {
  const deg = i * 4;
  const fromSignal = (((deg - 180) % 360) + 360) % 360;
  const rank = fromSignal % WHEEL_STEP === 0 ? 'major' : fromSignal % 20 === 0 ? 'mid' : 'minor';
  const inner = rank === 'major' ? R_KNURL - 1.6 : rank === 'mid' ? R_KNURL - 0.4 : R_KNURL + 0.9;
  const [x1, y1] = wheelPoint(inner, deg);
  const [x2, y2] = wheelPoint(R_LIP - 0.4, deg);
  return {
    key: i,
    rank,
    x1: x1.toFixed(3),
    y1: y1.toFixed(3),
    x2: x2.toFixed(3),
    y2: y2.toFixed(3),
  };
});

/* each signal is cut across the lip, so it reads as part of the machining */
const WHEEL_NOTCHES = PROBLEM_NODES.map((node, i) => {
  const deg = 180 + i * WHEEL_STEP;
  const [x1, y1] = wheelPoint(R_LIP + 0.2, deg);
  const [x2, y2] = wheelPoint(R_BEAD - 0.2, deg);
  return {
    key: node.n,
    x1: x1.toFixed(3),
    y1: y1.toFixed(3),
    x2: x2.toFixed(3),
    y2: y2.toFixed(3),
  };
});

/* the brake disc behind the spokes: drilled, and slotted like a vented rotor */
const DISC_HOLES = Array.from({ length: 12 }, (_, i) => {
  const [x, y] = wheelPoint(27.4, i * 30 + 15);
  return { key: i, x: x.toFixed(3), y: y.toFixed(3) };
});

const DISC_SLOTS = Array.from({ length: 12 }, (_, i) => wheelArc(29.4, i * 30, i * 30 + 13));

/* the reading head: a clamp over the lip at nine o'clock, aimed at the copy */
const WHEEL_HEAD = [wheelArc(42.4, 167, 193), wheelArc(36.4, 167, 193)];

/* the valve stem, because a wheel has one */
const VALVE = wheelPoint(R_MARK, 306);

/* a line of text that rises out from a clipped baseline */
function Rise({ children, delay = 0, motionOff }) {
  return (
    <span className="lp-rise">
      <motion.span
        className="lp-rise__in"
        initial={motionOff ? { opacity: 0 } : { y: '112%' }}
        whileInView={motionOff ? { opacity: 1 } : { y: '0%' }}
        viewport={{ once: true, margin: '-12% 0px' }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* the statement that sits in the void at the centre */
function ConsStatement({ motionOff, className = '' }) {
  return (
    <div className={`lp-cons__core ${className}`.trim()}>
      <motion.p
        className="lp-cons__eyebrow"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-14% 0px' }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        The whole trip, in the dark
      </motion.p>
      <p className="lp-cons__statement">
        <span className="lp-cons__stmt-line">
          <Rise motionOff={motionOff} delay={0.04}>Every signal exists.</Rise>
        </span>
        <span className="lp-cons__stmt-line lp-cons__stmt-line--out">
          <Rise motionOff={motionOff} delay={0.16}>None reaches you in time.</Rise>
        </span>
      </p>
    </div>
  );
}

/* one signal on the lip: the mark is cut into the metal and turns with the
   wheel; its number stays upright and fades out while the wheel is spinning,
   so a fast turn smears instead of carrying legible text round with it. */
function WheelMark({ node, index, rot, active, settle }) {
  const deg = 180 + index * WHEEL_STEP;
  const [x, y] = wheelPoint(R_MARK, deg);
  const [lx, ly] = wheelPoint(R_LABEL, deg);
  const counter = useTransform(rot, (value) => value * -1);
  const on = index === active;

  return (
    <>
      <span
        className={`lp-wheel__mark${on ? ' is-on' : ''}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <span className="lp-wheel__mark-dot" />
      </span>
      <motion.span
        className={`lp-wheel__tag${on ? ' is-on' : ''}`}
        style={{ left: `${lx}%`, top: `${ly}%`, opacity: settle }}
      >
        <motion.span className="lp-wheel__tag-in" style={{ rotate: counter }}>
          {node.n}
        </motion.span>
      </motion.span>
    </>
  );
}

/* the problem, one at a time: the section pins, the scroll spins the wheel and
   brings each signal round into the reading head that faces the copy */
function ProblemDial() {
  const trackRef = useRef(null);
  const [vizRef, live] = useLive('-20% 0px');
  const total = PROBLEM_NODES.length;
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  });

  const index = useTransform(scrollYProgress, [0.04, 0.9], [0, total - 1]);
  const rot = useSpring(useTransform(index, (v) => v * -WHEEL_TURN), {
    stiffness: 64,
    damping: 23,
    mass: 0.6,
  });

  /* how hard the wheel is turning right now. Everything that should smear or
     drop out during a spin hangs off this one value. */
  const spin = useSpring(
    useTransform(useVelocity(rot), (v) => Math.min(1, Math.abs(v) / 760)),
    { stiffness: 190, damping: 32, mass: 0.4 },
  );
  const settle = useTransform(spin, [0.06, 0.55], [1, 0]);
  const ghost = useTransform(spin, [0.04, 1], [0, 0.5]);
  const smear = useTransform(spin, [0.04, 1], [0, 0.55]);

  const fill = useTransform(scrollYProgress, [0.04, 0.9], [0, 1]);
  /* the head rides the end of the same value as the stroke, so the two can
     never drift apart; it starts at twelve o'clock and runs the ring clockwise */
  const headTurn = useTransform(fill, (v) => Math.min(1, Math.max(0, v)) * 360);
  const headShow = useTransform(fill, [0, 0.03], [0, 1]);

  const [active, setActive] = useState(0);
  useMotionValueEvent(index, 'change', (v) => {
    setActive(Math.max(0, Math.min(total - 1, Math.round(v))));
  });

  const node = PROBLEM_NODES[active];

  return (
    <div className="lp-dial-track" ref={trackRef} style={{ '--steps': total }}>
      <div className="lp-dial-stage">
        <div className="lp-dial-info">
          <p className="lp-dial-eyebrow">The whole trip, in the dark</p>

          <p className="lp-dial-count">
            <span>{node.n}</span>
            <i />
            {String(total).padStart(2, '0')}
          </p>

          <div className="lp-dial-copy">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="lp-dial-copy__in"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <h3 className="lp-dial-title">{node.title}</h3>
                <p className="lp-dial-desc">{node.line}</p>
                <p className="lp-dial-cost">
                  <span className="lp-dial-cost__cap">What it costs</span>
                  <span className="lp-dial-cost__text">{node.cost}</span>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lp-dial-bar" aria-hidden="true">
            <motion.i style={{ scaleX: fill }} />
          </div>
        </div>

        <div className={`lp-dial-viz${live ? ' is-live' : ''}`} ref={vizRef} aria-hidden="true">
          <div className="lp-wheel">
            {/* the light it stands in, and the ground it stands on */}
            <span className="lp-wheel__aura" />
            <span className="lp-wheel__shadow" />

            {/* rubber: sidewall shading, then the tread, which turns */}
            <span className="lp-wheel__tyre" />
            <motion.span className="lp-wheel__tread" style={{ rotate: rot }} />
            <span className="lp-wheel__sheen" />

            {/* the polished lip and the barrel dropping away behind it */}
            <span className="lp-wheel__lip" />
            <span className="lp-wheel__dish" />

            {/* the brake disc: fixed to the car, so it never turns */}
            <svg className="lp-wheel__disc" viewBox="0 0 100 100">
              <circle className="lp-wheel__disc-face" cx="50" cy="50" r={R_DISC} />
              <circle className="lp-wheel__disc-ring" cx="50" cy="50" r={R_DISC - 1.6} />
              <circle className="lp-wheel__disc-ring" cx="50" cy="50" r="24.6" />
              {DISC_SLOTS.map((d) => (
                <path className="lp-wheel__disc-slot" d={d} key={d} />
              ))}
              {DISC_HOLES.map((hole) => (
                <circle className="lp-wheel__disc-hole" cx={hole.x} cy={hole.y} r="0.85" key={hole.key} />
              ))}
            </svg>

            {/* everything the wheel actually turns */}
            <motion.div className="lp-wheel__spin" style={{ rotate: rot }}>
              <svg className="lp-wheel__face" viewBox="0 0 100 100">
                <defs>
                  <radialGradient id="lp-wheel-arm" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="50">
                    <stop offset="0.3" stopColor="#2b2b2b" />
                    <stop offset="0.62" stopColor="#1d1d1d" />
                    <stop offset="1" stopColor="#101010" />
                  </radialGradient>
                </defs>

                {/* two faint copies, thrown off the spokes while the wheel is
                    turning fast, so a quick scroll blurs instead of strobing */}
                <motion.g className="lp-wheel__ghost" style={{ opacity: ghost }}>
                  <g transform="rotate(13 50 50)">
                    {WHEEL_ARM_PATHS.map((d) => (
                      <path className="lp-wheel__arm" d={d} key={`g1${d}`} />
                    ))}
                  </g>
                  <g transform="rotate(-13 50 50)">
                    {WHEEL_ARM_PATHS.map((d) => (
                      <path className="lp-wheel__arm" d={d} key={`g2${d}`} />
                    ))}
                  </g>
                </motion.g>

                {WHEEL_ARM_PATHS.map((d) => (
                  <path className="lp-wheel__arm" d={d} key={d} />
                ))}

                {WHEEL_LUGS.map((lug) => (
                  <g key={lug.key}>
                    <circle className="lp-wheel__lug" cx={lug.x} cy={lug.y} r="1.55" />
                    <circle className="lp-wheel__lug-in" cx={lug.x} cy={lug.y} r="0.62" />
                  </g>
                ))}

                {WHEEL_KNURL.map((tick) => (
                  <line
                    key={tick.key}
                    className={`lp-wheel__knurl is-${tick.rank}`}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                  />
                ))}

                {WHEEL_NOTCHES.map((notch, i) => (
                  <line
                    key={notch.key}
                    className={`lp-wheel__notch${i === active ? ' is-on' : ''}`}
                    x1={notch.x1}
                    y1={notch.y1}
                    x2={notch.x2}
                    y2={notch.y2}
                  />
                ))}

                <circle className="lp-wheel__valve" cx={VALVE[0].toFixed(3)} cy={VALVE[1].toFixed(3)} r="0.9" />
              </svg>

              {PROBLEM_NODES.map((n, i) => (
                <WheelMark key={n.n} node={n} index={i} rot={rot} active={active} settle={settle} />
              ))}
            </motion.div>

            {/* one fixed specular pass, so the light stays put as it turns */}
            <span className="lp-wheel__gloss" />

            {/* the smear that comes up under speed */}
            <motion.span className="lp-wheel__smear" style={{ opacity: smear }} />

            {/* how far through the section, on a ring outside the tyre */}
            <svg className="lp-wheel__track" viewBox="0 0 100 100">
              <circle className="lp-wheel__track-bed" cx="50" cy="50" r={R_TRACK} />
              <motion.circle
                className="lp-wheel__track-line"
                cx="50"
                cy="50"
                r={R_TRACK}
                style={{ pathLength: fill }}
              />
            </svg>

            <motion.div className="lp-wheel__head" style={{ rotate: headTurn, opacity: headShow }}>
              <span className="lp-wheel__head-dot" />
            </motion.div>

            {/* the reading head, clamped on the lip and aimed at the copy */}
            <svg className="lp-wheel__gate-arc" viewBox="0 0 100 100">
              {WHEEL_HEAD.map((d) => (
                <path className="lp-wheel__gate-bracket" d={d} key={d} />
              ))}
            </svg>

            <span className="lp-wheel__gate">
              <span className="lp-wheel__gate-ring" />
              <span className="lp-wheel__gate-seat" key={active} />
              <span className="lp-wheel__gate-beam" />
              <span className="lp-wheel__gate-cap">Reading</span>
            </span>

            {/* the centre cap, carrying the readout */}
            <div className="lp-wheel__cap">
              <span className="lp-dial-hub__cap">Signal</span>
              <span className="lp-dial-hub__display">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={active}
                    className="lp-dial-hub__n"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    {node.n}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="lp-dial-hub__rule" />
              <span className="lp-dial-hub__read">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={active}
                    className="lp-dial-hub__read-in"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <span className="lp-dial-hub__sig">{node.signal}</span>
                    <span className="lp-dial-hub__who">{node.who}</span>
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* the same signals as a plain numbered list, for narrow screens */
function ProblemList({ motionOff }) {
  return (
    <div className="lp-cons-fallback">
      <ConsStatement motionOff={motionOff} className="lp-cons__core--flow" />
      <div className="lp-cons-list">
        {PROBLEM_NODES.map((node, index) => (
          <Reveal key={node.n} delay={index * 0.06} className="lp-cons-list__item">
            <span className="lp-cons-list__n">{node.n}</span>
            <span className="lp-cons-list__body">
              <span className="lp-cons-list__sig">{node.signal}</span>
              <span className="lp-cons-list__title">{node.title}</span>
              <span className="lp-cons-list__desc">{node.line}</span>
              <span className="lp-cons-list__cost">{node.cost}</span>
            </span>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- problem */

function Problem({ motionOff, compact }) {
  return (
    <section className="lp-section lp-problem" id="problem">
      <Shell>
        <Head
          index="01"
          label="The problem"
        />

        {compact || motionOff ? (
          <ProblemList motionOff={motionOff} />
        ) : (
          <ProblemDial />
        )}
      </Shell>
    </section>
  );
}

/* --------------------------------------------------------------- solution */

function StatementWord({ progress, range, children, motionOff }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <span className="lp-statement__word">
      <motion.span style={motionOff ? undefined : { opacity }}>{children}</motion.span>
    </span>
  );
}

function Solution({ motionOff }) {
  const statementRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: statementRef,
    offset: ['start 0.82', 'end 0.5'],
  });

  const words = SOLUTION_STATEMENT.split(' ');

  return (
    <section className="lp-section lp-solution" id="solution">
      <Shell>
        <Head
          index="02"
          label="The solution"
          title="The same demand, allocated"
          line="Same four connectors, same requests, same day. Resolved into windows that cannot collide."
        />

        <DemandGrid
          lanes={ALLOCATED}
          stats={[
            { label: 'Conflicts', value: '00' },
            { label: 'Turned away', value: '00' },
            { label: 'Utilisation', value: '87%' },
          ]}
        />

        <p className="lp-statement" ref={statementRef}>
          {words.map((word, index) => (
            <StatementWord
              key={`${word}-${index}`}
              progress={scrollYProgress}
              range={[index / words.length, (index + 1) / words.length]}
              motionOff={motionOff}
            >
              {word}
            </StatementWord>
          ))}
        </p>
      </Shell>
    </section>
  );
}

/* -------------------------------------------------------- platform visuals */

function VisualGrid() {
  return (
    <div className="lp-viz lp-viz--grid" aria-hidden="true">
      {Array.from({ length: 32 }, (_, index) => (
        <span key={index} style={{ '--d': `${(index % 8) * 0.14 + Math.floor(index / 8) * 0.22}s` }} />
      ))}
    </div>
  );
}

function VisualWindows() {
  const rows = [
    [18, 34],
    [46, 26],
    [8, 22],
    [58, 30],
  ];
  return (
    <div className="lp-viz lp-viz--windows" aria-hidden="true">
      {rows.map((row, index) => (
        <span className="lp-viz__lane" key={index} style={{ '--d': `${index * 0.55}s` }}>
          <i style={{ left: `${row[0]}%`, width: `${row[1]}%` }} />
        </span>
      ))}
    </div>
  );
}

function VisualStream() {
  return (
    <div className="lp-viz lp-viz--stream" aria-hidden="true">
      <svg viewBox="0 0 260 96" preserveAspectRatio="none">
        <path className="lp-viz__base" d="M0 78 C 34 78 44 58 70 52 S 116 56 140 38 S 190 30 214 18 L 260 12" />
        <path className="lp-viz__draw" pathLength="1" d="M0 78 C 34 78 44 58 70 52 S 116 56 140 38 S 190 30 214 18 L 260 12" />
      </svg>
      <div className="lp-viz__bars">
        {[36, 62, 44, 78, 58, 88, 70, 94].map((height, index) => (
          <span key={index} style={{ height: `${height}%`, '--d': `${index * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}

function VisualLedger() {
  const rows = [
    ['Energy delivered', '62%'],
    ['Time occupied', '38%'],
    ['Platform fee', '18%'],
  ];
  return (
    <div className="lp-viz lp-viz--ledger" aria-hidden="true">
      {rows.map(([label, width], index) => (
        <span className="lp-viz__row" key={label}>
          <small>{label}</small>
          <i style={{ '--w': width, '--d': `${index * 0.14}s` }} />
        </span>
      ))}
      <span className="lp-viz__total">
        <small>Invoice total</small>
        <strong>Settled</strong>
      </span>
    </div>
  );
}

const CAPABILITY_VISUALS = {
  visibility: VisualGrid,
  reservations: VisualWindows,
  telemetry: VisualStream,
  billing: VisualLedger,
};

function DeckCard({ item, index, total, progress, motionOff }) {
  const isLast = index === total - 1;
  const start = index / total;
  const end = (index + 1) / total;

  /* The outgoing card stays fully opaque: it recedes with scale, lifts
     slightly, and is darkened by a solid scrim rather than faded out. */
  const scale = useTransform(progress, [start, end], [1, 0.93]);
  const lift = useTransform(progress, [start, end], [0, -26]);
  const scrim = useTransform(progress, [start, end * 0.98], [0, 0.78]);

  const Visual = CAPABILITY_VISUALS[item.key];
  const still = motionOff || isLast;

  return (
    <motion.article
      className="lp-card"
      style={still ? { '--i': index } : { '--i': index, scale, y: lift }}
    >
      <div className="lp-card__text">
        <span className="lp-card__index">{String(index + 1).padStart(2, '0')}</span>
        <h3 className="lp-card__title">{item.title}</h3>
        <p className="lp-card__answers">{item.answers}</p>
        <p className="lp-card__line">{item.line}</p>
        <ul className="lp-card__tags">
          {item.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </div>
      <div className="lp-card__visual">
        <Visual />
      </div>
      {still ? null : (
        <motion.span className="lp-card__scrim" style={{ opacity: scrim }} aria-hidden="true" />
      )}
    </motion.article>
  );
}

function Platform({ motionOff }) {
  const deckRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: deckRef,
    offset: ['start start', 'end end'],
  });
  const live = useInView(deckRef, { margin: '-6% 0px' });

  return (
    <section className="lp-section lp-platform" id="platform">
      <Shell>
        <Head
          index="03"
          label="Platform"
          title="What the software provides"
          line="Four systems behind one record."
        />

        <div className={`lp-deck${live ? ' is-live' : ''}`} ref={deckRef}>
          {CAPABILITIES.map((item, index) => (
            <DeckCard
              key={item.key}
              item={item}
              index={index}
              total={CAPABILITIES.length}
              progress={scrollYProgress}
              motionOff={motionOff}
            />
          ))}
        </div>
      </Shell>
    </section>
  );
}

/* ------------------------------------------------------------------ trust */

function Trust() {
  return (
    <section className="lp-section lp-trust">
      <Shell>
        <Head index="04" label="Foundation" title="Built to hold the record" />

        <motion.div
          className="lp-trust__grid"
          initial="rest"
          whileInView="live"
          viewport={{ once: true, margin: '-12% 0px' }}
          variants={{ live: { transition: { staggerChildren: 0.08 } } }}
        >
          {TRUST.map((item) => (
            <motion.article
              className="lp-trust__item"
              key={item.key}
              variants={{
                rest: { opacity: 0, y: 22 },
                live: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
              }}
            >
              <h3>{item.title}</h3>
              <p>{item.line}</p>
            </motion.article>
          ))}
        </motion.div>
      </Shell>
    </section>
  );
}

/* ------------------------------------------------------------------- join */

function Join() {
  return (
    <section className="lp-section lp-join" id="join">
      <Shell>
        <Head
          index="05"
          label="Get started"
          title="Become part of PLUGIN"
          line="Two ways in, depending on which side of the cable you are on."
        />

        <div className="lp-join__grid">
          {JOIN_OPTIONS.map((option, index) => (
            <Reveal key={option.key} delay={index * 0.1} className="lp-join__card">
              <span className="lp-join__icon" aria-hidden="true">{JOIN_ICONS[option.key]}</span>
              <p className="lp-join__kind">{option.kind}</p>
              <h3 className="lp-join__title">{option.title}</h3>
              <p className="lp-join__lead">{option.lead}</p>
              <ul className="lp-join__list">
                {option.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Link to={option.to} className="lp-btn lp-btn--block">
                {option.cta}
                <ArrowNE />
              </Link>
            </Reveal>
          ))}
        </div>
      </Shell>
    </section>
  );
}

/* ----------------------------------------------------------------- footer */

function Foot() {
  return (
    <footer className="lp-foot">
      <Shell>
        <div className="lp-foot__top">
          <div className="lp-foot__brand">
            <Logo variant="foot" />
            <p>The control layer for EV charging networks.</p>
          </div>

          <nav className="lp-foot__col" aria-label="Sections">
            <h2>Page</h2>
            <ul>
              {NAV_SECTIONS.map((section) => (
                <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>
              ))}
            </ul>
          </nav>

          <nav className="lp-foot__col" aria-label="Access">
            <h2>Access</h2>
            <ul>
              <li><Link to="/login">Sign in</Link></li>
              <li><Link to="/register">Create account</Link></li>
            </ul>
          </nav>

          <nav className="lp-foot__col" aria-label="Partners">
            <h2>Partners</h2>
            <ul>
              <li><Link to="/station-manager/apply">Operate a station</Link></li>
            </ul>
          </nav>
        </div>

        <div className="lp-foot__bar">
          <p>&copy; {new Date().getFullYear()} PLUGIN</p>
          <p>Drivers Â· Operators Â· Administrators</p>
        </div>
      </Shell>
    </footer>
  );
}

/* -------------------------------------------------------------------- page */

export default function Landing() {
  const motionOff = useReducedMotion();
  const compact = useCompactViewport();

  useEffect(() => {
    document.body.classList.add('lp-body');
    return () => document.body.classList.remove('lp-body');
  }, []);

  return (
    <div className="lp">
      <ScrollRail />
      <span className="lp-grain" aria-hidden="true" />
      <Nav />

      <main>
        <Hero motionOff={motionOff} />
        <Problem motionOff={motionOff} compact={compact} />
        <Solution motionOff={motionOff} />
        <Platform motionOff={motionOff || compact} />
        <Trust />
        <Join />
      </main>

      <Foot />
    </div>
  );
}
