import * as React from 'react';

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost';
  /** Size. @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Element to render as. @default "button" */
  as?: 'button' | 'a';
}

/** ApêCerto pill button — primary (orange), accent (purple), secondary, ghost. */
export function Button(props: ButtonProps): JSX.Element;
