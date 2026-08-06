import * as React from 'react';

export interface Listing {
  title?: string;
  address?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqm?: number;
  parking?: number;
  statusBadge?: { label: string; tone?: 'orange' | 'purple' };
  photoVariant?: 1 | 2 | 3 | 4 | 5 | 6;
  tags?: string[];
  saved?: boolean;
}

export interface ListingCardProps {
  listing?: Listing;
  /** Called with the listing when the card is clicked. */
  onOpen?: (listing: Listing) => void;
  /** Real photo URL; falls back to a warm placeholder gradient. */
  photo?: string;
}

/** ApêCerto apartment listing card — photo, price, specs, feature tags, save toggle. */
export function ListingCard(props: ListingCardProps): JSX.Element;
