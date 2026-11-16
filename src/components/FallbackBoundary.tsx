import { Component, type ReactNode } from "react";

export interface FallbackBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface FallbackBoundaryState {
  failed: boolean;
}

// P14: something optional that can't draw, such as the 3D die on a computer without WebGL, quietly
// gives way to the plain version. A class, because only a class can catch a render error.
export class FallbackBoundary extends Component<FallbackBoundaryProps, FallbackBoundaryState> {
  state: FallbackBoundaryState = { failed: false };

  static getDerivedStateFromError(): FallbackBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
