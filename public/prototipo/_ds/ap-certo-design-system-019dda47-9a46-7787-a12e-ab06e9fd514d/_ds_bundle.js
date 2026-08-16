/* @ds-bundle: {"format":3,"namespace":"ApCertoDesignSystem_019dda","components":[{"name":"Badge","sourcePath":"components/Badge.jsx"},{"name":"Button","sourcePath":"components/Button.jsx"},{"name":"ListingCard","sourcePath":"components/ListingCard.jsx"}],"sourceHashes":{"components/Badge.jsx":"91119d88017f","components/Button.jsx":"a0306150d57a","components/ListingCard.jsx":"5f24ae6cd524","ui_kits/instagram/CarouselSlide.jsx":"d1750ee36e82","ui_kits/instagram/ListingPost.jsx":"e62b14826703","ui_kits/instagram/QuotePost.jsx":"75d6a4adda7e","ui_kits/instagram/StoryPost.jsx":"ad51bc5d5c9f","ui_kits/website/Footer.jsx":"a83fd6642e01","ui_kits/website/Header.jsx":"04f15e391b6c","ui_kits/website/Hero.jsx":"19f1a4525e4a","ui_kits/website/HowItWorks.jsx":"0f9c7cf557ba","ui_kits/website/ListingDetailSheet.jsx":"674b3085ea9f","ui_kits/website/ListingGrid.jsx":"f511c81b7a13","ui_kits/website/NeighborhoodCard.jsx":"beab81b0977e","ui_kits/website/SearchBar.jsx":"1ba3fe2873d5","ui_kits/website/SiteListingCard.jsx":"93af71c80706","ui_kits/website/Testimonial.jsx":"42af83152afb","ui_kits/website/icons.jsx":"45de570f4cad"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ApCertoDesignSystem_019dda = window.ApCertoDesignSystem_019dda || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/Badge.jsx
try { (() => {
function Badge({
  children,
  tone = 'orange',
  variant = 'solid',
  dot = false
}) {
  const solid = {
    orange: {
      background: 'var(--ape-orange)',
      color: '#fff'
    },
    purple: {
      background: 'var(--ape-purple)',
      color: '#fff'
    },
    success: {
      background: 'var(--success)',
      color: '#fff'
    },
    warning: {
      background: 'var(--warning)',
      color: '#fff'
    },
    danger: {
      background: 'var(--danger)',
      color: '#fff'
    },
    neutral: {
      background: 'var(--neutral-800)',
      color: '#fff'
    }
  };
  const soft = {
    orange: {
      background: 'var(--ape-orange-100)',
      color: 'var(--ape-orange-700)'
    },
    purple: {
      background: 'var(--ape-purple-100)',
      color: 'var(--ape-purple-700)'
    },
    success: {
      background: 'var(--success-bg)',
      color: 'var(--success)'
    },
    warning: {
      background: 'var(--warning-bg)',
      color: '#9c6a14'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)'
    },
    neutral: {
      background: 'var(--neutral-100)',
      color: 'var(--neutral-700)'
    }
  };
  const palette = variant === 'soft' ? soft : solid;
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
    ...(palette[tone] || palette.orange)
  };
  const dotColor = (variant === 'soft' ? solid[tone] : {
    background: 'currentColor'
  }).background;
  return /*#__PURE__*/React.createElement("span", {
    style: style
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: dotColor
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Badge.jsx", error: String((e && e.message) || e) }); }

// components/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  children,
  variant = 'primary',
  size = 'md',
  as = 'button',
  ...rest
}) {
  const pad = size === 'sm' ? '9px 18px' : size === 'lg' ? '16px 28px' : '12px 22px';
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 17 : 15;
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize,
    padding: pad,
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--dur-fast) var(--ease-out)',
    textDecoration: 'none',
    lineHeight: 1
  };
  const variants = {
    primary: {
      background: 'var(--ape-orange)',
      color: '#fff',
      boxShadow: 'var(--shadow-brand)'
    },
    accent: {
      background: 'var(--ape-purple)',
      color: '#fff',
      boxShadow: 'var(--shadow-accent)'
    },
    secondary: {
      background: '#fff',
      color: 'var(--fg-1)',
      border: '1.5px solid var(--border-default)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ape-orange)',
      borderRadius: 'var(--radius-md)'
    }
  };
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      ...base,
      ...(variants[variant] || variants.primary)
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Button.jsx", error: String((e && e.message) || e) }); }

// components/ListingCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const iconBase = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};
function MapPin(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: 13,
    height: 13
  }, iconBase, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "3"
  }));
}
function Bed(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: 15,
    height: 15
  }, iconBase, p), /*#__PURE__*/React.createElement("path", {
    d: "M2 4v16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 8h18a2 2 0 0 1 2 2v10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 17h20"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 8v9"
  }));
}
function Bath(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: 15,
    height: 15
  }, iconBase, p), /*#__PURE__*/React.createElement("path", {
    d: "M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "10",
    x2: "8",
    y1: "5",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    x2: "22",
    y1: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "7",
    x2: "7",
    y1: "19",
    y2: "21"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "17",
    x2: "17",
    y1: "19",
    y2: "21"
  }));
}
function Area(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: 15,
    height: 15
  }, iconBase, p), /*#__PURE__*/React.createElement("polyline", {
    points: "15 3 21 3 21 9"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "9 21 3 21 3 15"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    x2: "14",
    y1: "3",
    y2: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    x2: "10",
    y1: "21",
    y2: "14"
  }));
}
function Heart({
  filled,
  ...p
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: 18,
    height: 18
  }, iconBase, {
    fill: filled ? 'currentColor' : 'none'
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
  }));
}
const PHOTO_GRADIENTS = {
  1: 'linear-gradient(135deg, #e8d4b8 0%, #b8966a 100%)',
  2: 'linear-gradient(135deg, #d9c5e0 0%, #8c6ea8 100%)',
  3: 'linear-gradient(135deg, #f3d9b4 0%, #c98850 100%)',
  4: 'linear-gradient(135deg, #c4d5c8 0%, #6a8b7a 100%)',
  5: 'linear-gradient(135deg, #e5d2c0 0%, #a07a5e 100%)',
  6: 'linear-gradient(135deg, #d4c8de 0%, #786899 100%)'
};

/**
 * ApêCerto apartment listing card.
 * Pass `photo` (image URL) to use a real photo; otherwise a warm
 * placeholder gradient (chosen by `photoVariant`) is shown.
 */
function ListingCard({
  listing = {},
  onOpen,
  photo
}) {
  const [saved, setSaved] = React.useState(!!listing.saved);
  const {
    title = 'Apê na Pavão',
    address = 'Moema · 5 min metrô Eucaliptos',
    price = 4200,
    beds = 2,
    baths = 2,
    sqm = 67,
    parking = 1,
    statusBadge = {
      label: 'Pronto pra morar',
      tone: 'orange'
    },
    photoVariant = 1,
    tags = ['Mobiliado', 'Decorado']
  } = listing;
  const badgeBg = statusBadge && statusBadge.tone === 'purple' ? 'var(--ape-purple)' : 'var(--ape-orange)';
  const photoStyle = photo ? {
    backgroundImage: `url(${photo})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  } : {
    background: PHOTO_GRADIENTS[photoVariant] || PHOTO_GRADIENTS[1]
  };
  return /*#__PURE__*/React.createElement("article", {
    onClick: () => onOpen && onOpen(listing),
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      cursor: onOpen ? 'pointer' : 'default',
      fontFamily: 'var(--font-body)',
      transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 220,
      ...photoStyle
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, transparent 50%, rgba(31,28,26,0.35) 100%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 14,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, statusBadge && /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-pill)',
      fontSize: 11,
      fontWeight: 700,
      background: badgeBg,
      color: '#fff'
    }
  }, statusBadge.label), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      setSaved(s => !s);
    },
    "aria-label": "Salvar",
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.96)',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: saved ? 'var(--ape-orange)' : 'var(--neutral-600)'
    }
  }, /*#__PURE__*/React.createElement(Heart, {
    filled: saved
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: 'var(--fg-1)'
    }
  }, "R$ ", price.toLocaleString('pt-BR'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fg-3)'
    }
  }, " /m\xEAs")), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: '4px 0 2px',
      color: 'var(--fg-1)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(MapPin, null), " ", address), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 12,
      paddingTop: 12,
      borderTop: '1px solid var(--border-soft)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Bed, null), " ", beds), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Bath, null), " ", baths), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Area, null), " ", sqm, "m\xB2"), parking ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, parking, " vaga") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, tags.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      fontSize: 11,
      fontWeight: 600,
      background: i % 2 === 0 ? 'var(--ape-orange-100)' : 'var(--ape-purple-100)',
      color: i % 2 === 0 ? 'var(--ape-orange-700)' : 'var(--ape-purple-700)'
    }
  }, t)))));
}
Object.assign(__ds_scope, { ListingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ListingCard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.ListingCard = __ds_scope.ListingCard;

})();
