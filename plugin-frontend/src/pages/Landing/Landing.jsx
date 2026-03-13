import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import './Landing.css';

const fadeInUp = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.35,
    },
  },
};

const UltraFastIcon = () => (
  <svg viewBox="0 0 24 24" className="landing__card-icon-svg" aria-hidden="true">
    <path fill="currentColor" d="M13 2 5 13.2h5.3L9.2 22 19 10.5h-5.3z" />
  </svg>
);

const SmartBookingIcon = () => (
  <svg viewBox="0 0 24 24" className="landing__card-icon-svg" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 2.8v3.4M16 2.8v3.4M3.5 9.2h17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="8.2" cy="13.2" r="1" fill="currentColor" />
    <circle cx="12" cy="13.2" r="1" fill="currentColor" />
    <circle cx="15.8" cy="13.2" r="1" fill="currentColor" />
  </svg>
);

const RealTimeTrackingIcon = () => (
  <svg viewBox="0 0 24 24" className="landing__card-icon-svg" aria-hidden="true">
    <path d="M4 19.5h16M6.5 16.5l4-4 3 2.6L18 10.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6.5" cy="16.5" r="1.1" fill="currentColor" />
    <circle cx="10.5" cy="12.5" r="1.1" fill="currentColor" />
    <circle cx="13.5" cy="15.1" r="1.1" fill="currentColor" />
    <circle cx="18" cy="10.8" r="1.1" fill="currentColor" />
  </svg>
);

const TransparentBillingIcon = () => (
  <svg viewBox="0 0 24 24" className="landing__card-icon-svg" aria-hidden="true">
    <rect x="3.5" y="6" width="17" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="6.3" y="13.2" width="5.2" height="2.4" rx="1" fill="currentColor" />
  </svg>
);

const features = [
  {
    title: 'Ultra-Fast Charging',
    description: 'Up to 250kW charging speeds. Get from 10% to 80% in under 25 minutes and get back on the road faster.',
    icon: UltraFastIcon,
  },
  {
    title: 'Smart Booking',
    description: 'Reserve your slot ahead of time. No more waiting—your spot is guaranteed when you arrive.',
    icon: SmartBookingIcon,
  },
  {
    title: 'Real-Time Tracking',
    description: 'Monitor your charging session live. See power delivery, time remaining, and cost in real time.',
    icon: RealTimeTrackingIcon,
  },
  {
    title: 'Transparent Billing',
    description: 'Clear pricing, no hidden fees. Pay only for what you use with detailed session breakdowns.',
    icon: TransparentBillingIcon,
  },
];

const stats = [
  { value: '500+', label: 'Stations' },
  { value: '50K+', label: 'Drivers' },
  { value: '2M+', label: 'kWh Delivered' },
  { value: '99.9%', label: 'Uptime' },
];

const steps = [
  { num: 1, title: 'Search', desc: 'Find available stations near you' },
  { num: 2, title: 'Book', desc: 'Reserve your charging slot' },
  { num: 3, title: 'Charge', desc: 'Plug in and power up' },
];

const floatingVariants = (delay = 0, y = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 0.4,
    y: [0, y, 0],
    transition: {
      duration: 6 + delay,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
});

export default function Landing() {
  const featuresRef = useRef(null);
  const stepsRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' });
  const stepsInView = useInView(stepsRef, { once: true, margin: '-80px' });

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="landing">
      {/* Hero Section */}
      <section
        className="landing__hero"
        style={{ background: 'var(--gradient-hero)' }}
      >
        {/* Floating decorative elements */}
        <div className="landing__hero-float" aria-hidden="true">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className={`landing__float-dot landing__float-dot--${i % 4}`}
              variants={prefersReducedMotion ? undefined : floatingVariants(i * 0.3, (i % 2 === 0 ? 1 : -1) * 15)}
              initial={prefersReducedMotion ? { opacity: 0.15 } : 'initial'}
              animate={prefersReducedMotion ? { opacity: 0.15, y: 0 } : 'animate'}
              transition={prefersReducedMotion ? { duration: 0 } : undefined}
            />
          ))}
        </div>

        <motion.div
          className="landing__hero-content"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.h1
            className="landing__hero-title"
            variants={fadeInUp}
          >
            <span className="landing__hero-line">The Future of</span>
            <span className="landing__hero-line landing__hero-line--accent">
              EV Charging
            </span>
          </motion.h1>
          <motion.p
            className="landing__hero-subtitle"
            variants={fadeInUp}
          >
            Intelligent charging management for the modern driver. Find stations, book ahead, and charge with confidence.
          </motion.p>
          <motion.div
            className="landing__hero-cta"
            variants={fadeInUp}
          >
            <Link to="/search" className="landing__btn landing__btn--accent landing__btn--no-hover">
              Find Stations
            </Link>
            <button
              type="button"
              className="landing__btn landing__btn--outline"
              onClick={scrollToFeatures}
            >
              Learn More
            </button>
          </motion.div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="landing__hero-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="landing__stat-item">
              <span className="landing__stat-value">{stat.value}</span>
              <span className="landing__stat-label">{stat.label}</span>
            </div>
          ))}
          <p className="landing__hero-stats-note">Stats as of March 2026</p>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="landing__features" ref={featuresRef}>
        <div className="landing__section-inner">
          <motion.h2
            className="landing__section-title"
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            Why Choose PLUGIN?
          </motion.h2>
          <p className="landing__section-subtitle">
            Built for drivers who demand the best charging experience
          </p>
          <div className="landing__cards">
            {features.map((feature, i) => (
              <motion.article
                key={feature.title}
                className="landing__card"
                initial={{ opacity: 0, y: 50 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="landing__card-icon" aria-hidden="true">
                  <feature.icon />
                </span>
                <h3 className="landing__card-title">{feature.title}</h3>
                <p className="landing__card-desc">{feature.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing__how" ref={stepsRef}>
        <div className="landing__section-inner">
          <motion.h2
            className="landing__section-title"
            initial={{ opacity: 0, y: 30 }}
            animate={stepsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            How It Works
          </motion.h2>
          <div className="landing__steps">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="landing__step"
                initial={{ opacity: 0, y: 30 }}
                animate={stepsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="landing__step-circle">
                  <span>{step.num}</span>
                </div>
                <h3 className="landing__step-title">{step.title}</h3>
                <p className="landing__step-desc">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing__cta">
        <motion.div
          className="landing__cta-inner"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="landing__cta-title">Ready to get started?</h2>
          <p className="landing__cta-subtitle">
            Join thousands of EV drivers powering their journeys with PLUGIN.
          </p>
          <Link to="/register" className="landing__btn landing__btn--cta">
            Register
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
