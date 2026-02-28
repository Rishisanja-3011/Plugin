import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
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

const features = [
  {
    title: 'Ultra-Fast Charging',
    description: 'Up to 250kW charging speeds. Get from 10% to 80% in under 25 minutes and get back on the road faster.',
    icon: '\u26A1\uFE0E',
  },
  {
    title: 'Smart Booking',
    description: 'Reserve your slot ahead of time. No more waiting—your spot is guaranteed when you arrive.',
    icon: '\u{1F4C5}\uFE0E',
  },
  {
    title: 'Real-Time Tracking',
    description: 'Monitor your charging session live. See power delivery, time remaining, and cost in real time.',
    icon: '\u{1F4CA}\uFE0E',
  },
  {
    title: 'Transparent Billing',
    description: 'Clear pricing, no hidden fees. Pay only for what you use with detailed session breakdowns.',
    icon: '\u{1F4B0}\uFE0E',
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
              variants={floatingVariants(i * 0.3, (i % 2 === 0 ? 1 : -1) * 15)}
              initial="initial"
              animate="animate"
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
            <Link to="/search" className="landing__btn landing__btn--accent">
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
          {stats.map((stat, i) => (
            <div key={stat.label} className="landing__stat-item">
              <span className="landing__stat-value">{stat.value}</span>
              <span className="landing__stat-label">{stat.label}</span>
            </div>
          ))}
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
                {typeof feature.icon === 'string' && (feature.icon.endsWith('.png') || feature.icon.endsWith('.svg')) ? (
                  <img
                    src={feature.icon}
                    alt=""
                    className={`landing__card-icon landing__card-icon-img${feature.title === 'Ultra-Fast Charging' ? ' landing__card-icon--bold' : ''}`}
                    aria-hidden="true"
                  />
                ) : (
                  <span className={`landing__card-icon${feature.title === 'Ultra-Fast Charging' ? ' landing__card-icon--bold' : ''}`}>
                    {feature.icon}
                  </span>
                )}
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
