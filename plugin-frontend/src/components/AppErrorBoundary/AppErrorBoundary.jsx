import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Something went wrong while rendering the page.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="card"
          style={{
            width: 'min(92vw, 560px)',
            padding: '32px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto',
              borderRadius: '18px',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            !
          </div>
          <div>
            <h1 className="page-header__title" style={{ fontSize: '2rem', marginBottom: '8px' }}>
              Something went wrong
            </h1>
            <p className="page-header__subtitle" style={{ marginBottom: '8px' }}>
              The page hit an unexpected error, but the app did not crash into a white screen.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {this.state.errorMessage}
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--accent" onClick={this.handleReload}>
              Reload Page
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => window.history.back()}
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }
}
