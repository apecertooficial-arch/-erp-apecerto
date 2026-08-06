import * as React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  /** Color tone. @default "orange" */
  tone?: 'orange' | 'purple' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Filled (solid) or tinted (soft). @default "solid" */
  variant?: 'solid' | 'soft';
  /** Show a leading status dot. @default false */
  dot?: boolean;
}

/** ApêCerto pill badge — status labels and feature tags. */
export function Badge(props: BadgeProps): JSX.Element;
