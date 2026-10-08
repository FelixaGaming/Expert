import React from 'react';

interface Props {
  children: React.ReactNode;
  onReset: () => void;
}

// Shows a readable message instead of a blank page when a report has unexpected data
export class ErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Report failed to render:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-stone-900 mb-2">This report came back incomplete</h2>
        <p className="text-sm text-stone-600 mb-6">
          The AI returned data the page could not display. This is usually a one-off. Please run the search again.
        </p>
        <button
          onClick={() => { this.setState({ failed: false }); this.props.onReset(); }}
          className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm hover:bg-stone-800 cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }
}
