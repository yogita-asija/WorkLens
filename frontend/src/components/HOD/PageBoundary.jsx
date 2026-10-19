import { Component } from "react"

export default class PageBoundary extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error("Page crashed:", err, info?.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="p-6 text-sm text-red-400 space-y-2">
        <p className="font-semibold">This page crashed.</p>
        <pre className="whitespace-pre-wrap text-xs bg-black/30 p-3 rounded-lg">
          {String(this.state.err?.stack || this.state.err)}
        </pre>
        <button className="underline" onClick={() => this.setState({ err: null })}>Try again</button>
      </div>
    )
  }
}