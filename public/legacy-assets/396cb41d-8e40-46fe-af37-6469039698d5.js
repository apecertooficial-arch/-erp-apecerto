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

// ui_kits/instagram/CarouselSlide.jsx
try { (() => {
// CarouselSlide.jsx — 1080×1080 carousel slide, several variants
function CarouselSlide({
  variant,
  slide
}) {
  if (variant === 'title') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1080 slide cs-title"
    }, /*#__PURE__*/React.createElement("div", {
      className: "slide__grafismo"
    }), /*#__PURE__*/React.createElement("div", {
      className: "cs-title__inner"
    }, /*#__PURE__*/React.createElement("span", {
      className: "slide__eyebrow"
    }, slide.eyebrow || 'apêcerto · moema'), /*#__PURE__*/React.createElement("h1", {
      className: "slide__h1",
      style: {
        fontSize: 130
      }
    }, slide.titleLeft && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ape-orange)'
      }
    }, slide.titleLeft), slide.titleLeft && /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ape-purple)'
      }
    }, slide.title)), /*#__PURE__*/React.createElement("p", {
      className: "slide__body",
      style: {
        color: 'var(--neutral-700)',
        maxWidth: 800,
        marginTop: 32
      }
    }, slide.subtitle)), /*#__PURE__*/React.createElement("span", {
      className: "cs-page-indicator"
    }, "01 / 05"));
  }
  if (variant === 'numbered') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1080 slide cs-numbered"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cs-numbered__bg"
    }), /*#__PURE__*/React.createElement("div", {
      className: "cs-numbered__num"
    }, slide.n), /*#__PURE__*/React.createElement("div", {
      className: "cs-numbered__copy"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "slide__h2",
      style: {
        color: '#fff'
      }
    }, slide.title), /*#__PURE__*/React.createElement("p", {
      className: "slide__body",
      style: {
        color: 'rgba(255,255,255,0.85)',
        marginTop: 24
      }
    }, slide.body)), /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-branco.png",
      className: "cs-corner-logo",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", {
      className: "cs-page-indicator cs-page-indicator--light"
    }, slide.page));
  }
  if (variant === 'stat') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1080 slide cs-stat"
    }, /*#__PURE__*/React.createElement("div", {
      className: "slide__grafismo slide__grafismo--faded"
    }), /*#__PURE__*/React.createElement("div", {
      className: "cs-stat__inner"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cs-stat__big"
    }, slide.stat), /*#__PURE__*/React.createElement("div", {
      className: "cs-stat__label"
    }, slide.label), /*#__PURE__*/React.createElement("div", {
      className: "cs-stat__note"
    }, slide.note)), /*#__PURE__*/React.createElement("img", {
      src: "../../assets/simbolo-cores.png",
      className: "cs-stat__mark",
      alt: ""
    }));
  }
  if (variant === 'cta') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1080 slide cs-cta"
    }, /*#__PURE__*/React.createElement("div", {
      className: "slide__grafismo slide__grafismo--purple"
    }), /*#__PURE__*/React.createElement("div", {
      className: "cs-cta__inner"
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-branco.png",
      alt: "ap\xEAcerto",
      style: {
        width: 280
      }
    }), /*#__PURE__*/React.createElement("h2", {
      className: "slide__h2",
      style: {
        color: '#fff',
        marginTop: 40,
        fontSize: 80
      }
    }, "Bora ver seu ap\xEA?"), /*#__PURE__*/React.createElement("p", {
      className: "slide__body",
      style: {
        color: 'rgba(255,255,255,0.85)',
        marginTop: 24,
        maxWidth: 720
      }
    }, "A gente responde em ~6 minutos no WhatsApp. Sem corretor rob\xF4, sem visita perdida."), /*#__PURE__*/React.createElement("div", {
      className: "slide__cta slide__cta--white",
      style: {
        marginTop: 56
      }
    }, /*#__PURE__*/React.createElement("span", null, "link na bio"), /*#__PURE__*/React.createElement("span", {
      className: "arrow"
    }, "\u2192"))));
  }
  return null;
}
window.CarouselSlide = CarouselSlide;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instagram/CarouselSlide.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instagram/ListingPost.jsx
try { (() => {
// ListingPost.jsx — 1080×1350 feed post for a new apartment
function ListingPost({
  listing,
  photoVariant = 1
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "canvas-1080-1350 slide listing-post"
  }, /*#__PURE__*/React.createElement("div", {
    className: `listing-post__photo listing-post__photo--${photoVariant}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "listing-post__photo-overlay"
  }), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__top"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-branco.png",
    alt: "ap\xEAcerto",
    className: "listing-post__logo"
  }), /*#__PURE__*/React.createElement("span", {
    className: "listing-post__pill"
  }, "novo ap\xEA")), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__photo-caption"
  }, "\uD83D\uDCF7 ", listing.photoCount, " fotos no link da bio")), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "listing-post__row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "listing-post__title"
  }, listing.title), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__addr"
  }, "\uD83D\uDCCD ", listing.address)), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big"
  }, "R$ ", listing.price.toLocaleString('pt-BR')), /*#__PURE__*/React.createElement("span", {
    className: "unit"
  }, "/m\xEAs \xB7 cond. incluso"))), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__specs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lp-spec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, listing.beds), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "dorms")), /*#__PURE__*/React.createElement("div", {
    className: "lp-spec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, listing.baths), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "banhos")), /*#__PURE__*/React.createElement("div", {
    className: "lp-spec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, listing.sqm), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "m\xB2")), /*#__PURE__*/React.createElement("div", {
    className: "lp-spec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, listing.parking || 1), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "vaga"))), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__tags"
  }, listing.tags.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: `lp-tag ${i % 2 === 0 ? 'orange' : 'purple'}`
  }, t))), /*#__PURE__*/React.createElement("div", {
    className: "listing-post__cta"
  }, /*#__PURE__*/React.createElement("span", null, "Chave em 48h."), /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "link na bio \u2192"))));
}
window.ListingPost = ListingPost;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instagram/ListingPost.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instagram/QuotePost.jsx
try { (() => {
// QuotePost.jsx — 1080×1350 testimonial / brand voice post
function QuotePost({
  quote,
  author,
  role,
  tone = 'orange'
}) {
  const bg = tone === 'purple' ? 'var(--ape-purple)' : 'var(--ape-orange)';
  return /*#__PURE__*/React.createElement("div", {
    className: "canvas-1080-1350 slide qp",
    style: {
      background: bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `slide__grafismo ${tone === 'purple' ? 'slide__grafismo--purple' : ''}`,
    style: {
      opacity: 0.35
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "qp__inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qp__quote-mark"
  }, "\""), /*#__PURE__*/React.createElement("p", {
    className: "qp__quote"
  }, quote), /*#__PURE__*/React.createElement("div", {
    className: "qp__by"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qp__avatar"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qp__name"
  }, author), /*#__PURE__*/React.createElement("div", {
    className: "qp__role"
  }, role)))), /*#__PURE__*/React.createElement("div", {
    className: "qp__footer"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-branco.png",
    alt: "ap\xEAcerto",
    className: "qp__logo"
  }), /*#__PURE__*/React.createElement("span", {
    className: "qp__handle"
  }, "@apecerto.imoveis")));
}
window.QuotePost = QuotePost;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instagram/QuotePost.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instagram/StoryPost.jsx
try { (() => {
// StoryPost.jsx — 1080×1920 story with sticker overlay variants
function StoryPost({
  variant,
  data
}) {
  if (variant === 'listing') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1920 slide story story--listing"
    }, /*#__PURE__*/React.createElement("div", {
      className: `story__bg story__bg--${data.photoVariant || 1}`
    }), /*#__PURE__*/React.createElement("div", {
      className: "story__overlay"
    }), /*#__PURE__*/React.createElement("div", {
      className: "story__top"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__progress"
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar story__progress-bar--active"
    }), /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar"
    }), /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar"
    })), /*#__PURE__*/React.createElement("div", {
      className: "story__handle"
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/simbolo-cores.png",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", null, "apecerto.imoveis"), /*#__PURE__*/React.createElement("span", {
      className: "story__time"
    }, "2h"))), /*#__PURE__*/React.createElement("div", {
      className: "story__sticker story__sticker--rotate"
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__sticker-eyebrow"
    }, "NOVO AP\xCA"), /*#__PURE__*/React.createElement("span", {
      className: "story__sticker-big"
    }, "R$ ", data.price.toLocaleString('pt-BR')), /*#__PURE__*/React.createElement("span", {
      className: "story__sticker-unit"
    }, "/m\xEAs \xB7 cond. incluso")), /*#__PURE__*/React.createElement("div", {
      className: "story__bottom"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__title"
    }, data.title), /*#__PURE__*/React.createElement("div", {
      className: "story__addr"
    }, "\uD83D\uDCCD ", data.address), /*#__PURE__*/React.createElement("div", {
      className: "story__specs"
    }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDECF ", data.beds, " dorms"), /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCD0 ", data.sqm, "m\xB2"), /*#__PURE__*/React.createElement("span", null, "\uD83D\uDECB mobiliado")), /*#__PURE__*/React.createElement("div", {
      className: "story__swipe"
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__swipe-arrow"
    }, "\u2191"), /*#__PURE__*/React.createElement("span", null, "arrasta pra ver"))));
  }
  if (variant === 'poll') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1920 slide story story--poll"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__bg story__bg--gradient"
    }), /*#__PURE__*/React.createElement("div", {
      className: "slide__grafismo slide__grafismo--faded",
      style: {
        opacity: 0.15
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "story__top"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__progress"
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar"
    }), /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar story__progress-bar--active"
    }), /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "story__poll-inner"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__poll-q"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ape-orange)'
      }
    }, "Ap\xEA dos sonhos:"), /*#__PURE__*/React.createElement("br", null), "mobiliado", /*#__PURE__*/React.createElement("br", null), "ou vazio?"), /*#__PURE__*/React.createElement("div", {
      className: "story__poll"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__poll-bar",
      style: {
        width: '78%'
      }
    }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDECB mobiliado"), /*#__PURE__*/React.createElement("span", null, "78%")), /*#__PURE__*/React.createElement("div", {
      className: "story__poll-bar story__poll-bar--alt",
      style: {
        width: '22%'
      }
    }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCE6 vazio"), /*#__PURE__*/React.createElement("span", null, "22%"))), /*#__PURE__*/React.createElement("div", {
      className: "story__poll-foot"
    }, "2.1k votos")), /*#__PURE__*/React.createElement("div", {
      className: "story__brand-foot"
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-branco.png",
      alt: ""
    })));
  }
  if (variant === 'tip') {
    return /*#__PURE__*/React.createElement("div", {
      className: "canvas-1080-1920 slide story story--tip"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__bg story__bg--orange"
    }), /*#__PURE__*/React.createElement("div", {
      className: "slide__grafismo",
      style: {
        opacity: 0.6,
        mixBlendMode: 'overlay'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "story__top"
    }, /*#__PURE__*/React.createElement("div", {
      className: "story__progress"
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar"
    }), /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar"
    }), /*#__PURE__*/React.createElement("span", {
      className: "story__progress-bar story__progress-bar--active"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "story__tip-inner"
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__tip-eyebrow"
    }, "DICA DE MUDAN\xC7A \xB7 03"), /*#__PURE__*/React.createElement("div", {
      className: "story__tip-h"
    }, "N\xE3o compre cama nova", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ape-purple)'
      }
    }, "no primeiro dia.")), /*#__PURE__*/React.createElement("div", {
      className: "story__tip-body"
    }, "Durma uma semana no ap\xEA antes. Voc\xEA vai descobrir se quer king, queen, ou se a cabeceira do vizinho faz barulho \xE0s 6h.")), /*#__PURE__*/React.createElement("div", {
      className: "story__brand-foot"
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-branco.png",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", null, "+ 14 dicas no destaque \"mudan\xE7a\"")));
  }
  return null;
}
window.StoryPost = StoryPost;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instagram/StoryPost.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Footer.jsx
try { (() => {
// Footer.jsx — newsletter + nav
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "site-footer",
    id: "contato"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container site-footer__inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "site-footer__lead"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-branco.png",
    alt: "ap\xEAcerto",
    className: "site-footer__logo"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "site-footer__h"
  }, "Quer ser o primeiro a ver os ap\xEAs novos?"), /*#__PURE__*/React.createElement("p", null, "A gente manda no WhatsApp toda quarta. Nada de spam, nada de promo\xE7\xE3o."), /*#__PURE__*/React.createElement("form", {
    className: "newsletter",
    onSubmit: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "11 99999-0000",
    type: "tel"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit"
  }, "Me avisa"))), /*#__PURE__*/React.createElement("div", {
    className: "site-footer__cols"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "site-footer__col-h"
  }, "Ap\xEAs"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Rec\xE9m-chegados"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Mobiliados"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Pet friendly"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Investimento")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "site-footer__col-h"
  }, "A gente"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Como funciona"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Bairro Moema"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Anunciar"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Trabalhe com a gente")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "site-footer__col-h"
  }, "Fale conosco"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "WhatsApp"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Instagram"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "contato@apecerto.com"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "+55 11 98765-4321")))), /*#__PURE__*/React.createElement("div", {
    className: "site-footer__base"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Ap\xEACerto \xB7 Imobili\xE1ria Moema"), /*#__PURE__*/React.createElement("span", null, "CRECI 12345-J \xB7 CNPJ 00.000.000/0001-00")));
}
window.Footer = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Footer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Header.jsx
try { (() => {
// Header.jsx — sticky nav with backdrop blur
const {
  useState,
  useEffect
} = React;
function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return /*#__PURE__*/React.createElement("header", {
    className: `site-header ${scrolled ? 'scrolled' : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "container site-header__inner"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "site-header__logo"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-cores.png",
    alt: "ap\xEAcerto"
  })), /*#__PURE__*/React.createElement("nav", {
    className: "site-header__nav"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#listings"
  }, "Ap\xEAs"), /*#__PURE__*/React.createElement("a", {
    href: "#como"
  }, "Como funciona"), /*#__PURE__*/React.createElement("a", {
    href: "#bairro"
  }, "Moema"), /*#__PURE__*/React.createElement("a", {
    href: "#contato"
  }, "Contato")), /*#__PURE__*/React.createElement("div", {
    className: "site-header__actions"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "link-ghost"
  }, "Anunciar"), /*#__PURE__*/React.createElement("a", {
    href: "#contato",
    className: "btn btn-primary btn-sm"
  }, "Falar com a gente"))));
}
window.Header = Header;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Hero.jsx
try { (() => {
// Hero.jsx — landing hero with search and trust strip
function Hero({
  onSearch
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero__grafismo"
  }), /*#__PURE__*/React.createElement("div", {
    className: "container hero__inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero__copy"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Imobili\xE1ria \xB7 Moema, SP"), /*#__PURE__*/React.createElement("h1", {
    className: "hero__title"
  }, "Mude esse m\xEAs.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "hero__title-accent"
  }, "Sem caixa, sem pintor, sem dor.")), /*#__PURE__*/React.createElement("p", {
    className: "hero__lead"
  }, "Apartamentos prontos pra morar, mobiliados e decorados na regi\xE3o de Moema. A gente entrega a chave \u2014 voc\xEA s\xF3 leva a escova de dente."), /*#__PURE__*/React.createElement(SearchBar, {
    onSearch: onSearch
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero__trust"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "120+"), " ap\xEAs entregues"), /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "4.9"), " \u2605 no Google"), /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Resposta no mesmo dia"))), /*#__PURE__*/React.createElement("div", {
    className: "hero__visual"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero__photo hero__photo--1"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero__photo hero__photo--2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero__badge"
  }, "\uD83D\uDD11 chave em 48h")), /*#__PURE__*/React.createElement("div", {
    className: "hero__photo hero__photo--3"
  }))));
}
window.Hero = Hero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HowItWorks.jsx
try { (() => {
// HowItWorks.jsx — 3-step explainer
function HowItWorks() {
  const steps = [{
    n: '01',
    title: 'A gente seleciona',
    body: 'Visitamos cada apartamento, testamos chuveiro, internet, vizinhança. Só entra na vitrine o que a gente moraria.',
    icon: '🏡'
  }, {
    n: '02',
    title: 'A gente decora',
    body: 'Mobília escolhida por uma designer que sabe o que faz. Da panela ao quadro, tudo pronto pra você se mudar amanhã.',
    icon: '🛋️'
  }, {
    n: '03',
    title: 'Você se muda',
    body: 'Assinatura digital, vistoria em 30 min, chave em até 48h. Sem corretor sumido, sem pintor, sem dor de cabeça.',
    icon: '🔑'
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "how",
    id: "como"
  }, /*#__PURE__*/React.createElement("div", {
    className: "how__grafismo"
  }), /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head section-head--centered"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Como funciona"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Tr\xEAs passos pra chave na m\xE3o.")), /*#__PURE__*/React.createElement("div", {
    className: "how__grid"
  }, steps.map(s => /*#__PURE__*/React.createElement("div", {
    className: "how__step",
    key: s.n
  }, /*#__PURE__*/React.createElement("div", {
    className: "how__icon"
  }, s.icon), /*#__PURE__*/React.createElement("div", {
    className: "how__n"
  }, s.n), /*#__PURE__*/React.createElement("h3", {
    className: "how__title"
  }, s.title), /*#__PURE__*/React.createElement("p", {
    className: "how__body"
  }, s.body))))));
}
window.HowItWorks = HowItWorks;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HowItWorks.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/ListingDetailSheet.jsx
try { (() => {
// ListingDetailSheet.jsx — slide-up listing detail panel
function ListingDetailSheet({
  listing,
  onClose
}) {
  if (!listing) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "sheet-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    className: "sheet__close",
    onClick: onClose,
    "aria-label": "Fechar"
  }, /*#__PURE__*/React.createElement(Icon.Close, {
    width: 18,
    height: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: `sheet__hero sheet__hero--${listing.photoVariant || 1}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet__hero-overlay"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sheet__hero-content"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge badge--orange"
  }, listing.statusBadge?.label || 'Pronto pra morar'), /*#__PURE__*/React.createElement("h1", {
    className: "sheet__title"
  }, listing.title), /*#__PURE__*/React.createElement("div", {
    className: "sheet__addr"
  }, /*#__PURE__*/React.createElement(Icon.MapPin, {
    width: 16,
    height: 16
  }), " ", listing.address))), /*#__PURE__*/React.createElement("div", {
    className: "sheet__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet__col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet__price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sheet__price-big"
  }, "R$ ", listing.price.toLocaleString('pt-BR')), /*#__PURE__*/React.createElement("span", {
    className: "sheet__price-unit"
  }, "/m\xEAs")), /*#__PURE__*/React.createElement("div", {
    className: "sheet__price-detail"
  }, "condom\xEDnio R$ ", listing.condo, " \xB7 IPTU incluso"), /*#__PURE__*/React.createElement("div", {
    className: "sheet__specs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spec"
  }, /*#__PURE__*/React.createElement(Icon.Bed, {
    width: 22,
    height: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "spec__k"
  }, listing.beds), /*#__PURE__*/React.createElement("div", {
    className: "spec__v"
  }, "dorms")), /*#__PURE__*/React.createElement("div", {
    className: "spec"
  }, /*#__PURE__*/React.createElement(Icon.Bath, {
    width: 22,
    height: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "spec__k"
  }, listing.baths), /*#__PURE__*/React.createElement("div", {
    className: "spec__v"
  }, "banhos")), /*#__PURE__*/React.createElement("div", {
    className: "spec"
  }, /*#__PURE__*/React.createElement(Icon.Area, {
    width: 22,
    height: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "spec__k"
  }, listing.sqm), /*#__PURE__*/React.createElement("div", {
    className: "spec__v"
  }, "m\xB2")), /*#__PURE__*/React.createElement("div", {
    className: "spec"
  }, /*#__PURE__*/React.createElement(Icon.Car, {
    width: 22,
    height: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "spec__k"
  }, listing.parking || 1), /*#__PURE__*/React.createElement("div", {
    className: "spec__v"
  }, "vaga"))), /*#__PURE__*/React.createElement("p", {
    className: "sheet__desc"
  }, listing.description || 'Apê mobiliado por uma designer que sabe o que faz. Cozinha equipada, internet 600 mega, ar-split nos quartos. Janelão pro sol da manhã.'), /*#__PURE__*/React.createElement("div", {
    className: "sheet__tags"
  }, ['Mobiliado', 'Decorado', 'Pet friendly', '5 min metrô', 'Vaga coberta'].map(t => /*#__PURE__*/React.createElement("span", {
    className: "tag tag--neutral",
    key: t
  }, t)))), /*#__PURE__*/React.createElement("div", {
    className: "sheet__sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet__cta-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet__cta-h"
  }, "Quer ver pessoalmente?"), /*#__PURE__*/React.createElement("p", null, "A gente leva voc\xEA no ap\xEA hoje ainda. Resposta no WhatsApp em at\xE9 10 min."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-lg",
    style: {
      width: '100%'
    }
  }, "Agendar visita \u2192"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      width: '100%',
      marginTop: 8
    }
  }, "WhatsApp direto"), /*#__PURE__*/React.createElement("div", {
    className: "sheet__broker"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet__avatar"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "sheet__broker-name"
  }, "Bia \xB7 sua broker"), /*#__PURE__*/React.createElement("div", {
    className: "sheet__broker-meta"
  }, "responde em ~6min"))))))));
}
window.ListingDetailSheet = ListingDetailSheet;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/ListingDetailSheet.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/ListingGrid.jsx
try { (() => {
// ListingGrid.jsx — featured grid with filter chips
const {
  useState: useStateLG
} = React;
const FILTERS = ['Todos', '1 dorm', '2 dorms', '3+ dorms', 'Pet friendly', 'Próx. metrô'];
function ListingGrid({
  listings,
  onOpen
}) {
  const [active, setActive] = useStateLG('Todos');
  const filtered = listings.filter(l => {
    if (active === 'Todos') return true;
    if (active === '1 dorm') return l.beds === 1;
    if (active === '2 dorms') return l.beds === 2;
    if (active === '3+ dorms') return l.beds >= 3;
    return l.tags.some(t => t.toLowerCase().includes(active.toLowerCase().split(' ')[0]));
  });
  return /*#__PURE__*/React.createElement("section", {
    className: "listings",
    id: "listings"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Rec\xE9m-chegados"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Ap\xEAs prontos pra voc\xEA")), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "link-ghost"
  }, "Ver todos \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, FILTERS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: `chip ${active === f ? 'chip--active' : ''}`,
    onClick: () => setActive(f)
  }, f))), /*#__PURE__*/React.createElement("div", {
    className: "listings__grid"
  }, filtered.map(l => /*#__PURE__*/React.createElement(SiteListingCard, {
    key: l.id,
    listing: l,
    onOpen: onOpen
  })), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, "Nenhum ap\xEA com esse filtro agora \u2014 ", /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "avise quando aparecer \u2192")))));
}
window.ListingGrid = ListingGrid;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/ListingGrid.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/NeighborhoodCard.jsx
try { (() => {
// NeighborhoodCard.jsx — Moema spotlight
function NeighborhoodCard() {
  const facts = [{
    k: '5 min',
    v: 'do metrô Eucaliptos'
  }, {
    k: '900 m',
    v: 'do Parque Ibirapuera'
  }, {
    k: '180+',
    v: 'restaurantes a pé'
  }, {
    k: '12',
    v: 'pet shops no bairro'
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "bairro",
    id: "bairro"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container bairro__inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bairro__copy"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "O bairro"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Moema \xE9 ", /*#__PURE__*/React.createElement("span", {
    className: "brand-ape"
  }, "arborizada"), ", ", /*#__PURE__*/React.createElement("span", {
    className: "brand-certo"
  }, "caminh\xE1vel"), " e do tamanho certo."), /*#__PURE__*/React.createElement("p", {
    className: "body"
  }, "A gente escolheu Moema porque \xE9 o bairro que entrega vida l\xE1 fora \u2014 padaria boa, vizinhan\xE7a calma, metr\xF4 perto, Ibirapuera no quintal. Voc\xEA n\xE3o precisa ir longe pra viver bem."), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "btn btn-secondary"
  }, "Conhecer o bairro \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "bairro__facts"
  }, facts.map((f, i) => /*#__PURE__*/React.createElement("div", {
    className: "fact",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "fact__k"
  }, f.k), /*#__PURE__*/React.createElement("div", {
    className: "fact__v"
  }, f.v))))));
}
window.NeighborhoodCard = NeighborhoodCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/NeighborhoodCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SearchBar.jsx
try { (() => {
// SearchBar.jsx — bairro / dorms / preço search pill
const {
  useState: useStateSB
} = React;
function SearchBar({
  onSearch
}) {
  const [bairro, setBairro] = useStateSB('Moema');
  const [dorms, setDorms] = useStateSB('2 dorms');
  const [price, setPrice] = useStateSB('Até R$ 5.000');
  return /*#__PURE__*/React.createElement("div", {
    className: "searchbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "searchbar__field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "searchbar__label"
  }, "Bairro"), /*#__PURE__*/React.createElement("select", {
    value: bairro,
    onChange: e => setBairro(e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "Moema"), /*#__PURE__*/React.createElement("option", null, "Vila Mariana"), /*#__PURE__*/React.createElement("option", null, "Vila Nova Concei\xE7\xE3o"), /*#__PURE__*/React.createElement("option", null, "Indian\xF3polis"))), /*#__PURE__*/React.createElement("div", {
    className: "searchbar__divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "searchbar__field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "searchbar__label"
  }, "Dorms"), /*#__PURE__*/React.createElement("select", {
    value: dorms,
    onChange: e => setDorms(e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "1 dorm"), /*#__PURE__*/React.createElement("option", null, "2 dorms"), /*#__PURE__*/React.createElement("option", null, "3+ dorms"))), /*#__PURE__*/React.createElement("div", {
    className: "searchbar__divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "searchbar__field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "searchbar__label"
  }, "Aluguel at\xE9"), /*#__PURE__*/React.createElement("select", {
    value: price,
    onChange: e => setPrice(e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "At\xE9 R$ 3.000"), /*#__PURE__*/React.createElement("option", null, "At\xE9 R$ 5.000"), /*#__PURE__*/React.createElement("option", null, "At\xE9 R$ 8.000"), /*#__PURE__*/React.createElement("option", null, "Sem limite"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary searchbar__cta",
    onClick: () => onSearch && onSearch({
      bairro,
      dorms,
      price
    })
  }, "Ver ap\xEAs \u2192"));
}
window.SearchBar = SearchBar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SearchBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SiteListingCard.jsx
try { (() => {
// ListingCard.jsx — apartment card
const {
  useState: useStateLC
} = React;
function SiteListingCard({
  listing,
  onOpen
}) {
  const [saved, setSaved] = useStateLC(listing.saved || false);
  return /*#__PURE__*/React.createElement("article", {
    className: "listing",
    onClick: () => onOpen && onOpen(listing)
  }, /*#__PURE__*/React.createElement("div", {
    className: `listing__photo listing__photo--${listing.photoVariant || 1}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "listing__photo-overlay"
  }), /*#__PURE__*/React.createElement("div", {
    className: "listing__badge-row"
  }, listing.statusBadge && /*#__PURE__*/React.createElement("span", {
    className: `badge badge--${listing.statusBadge.tone || 'orange'}`
  }, listing.statusBadge.label), /*#__PURE__*/React.createElement("button", {
    className: `heart-btn ${saved ? 'heart-btn--saved' : ''}`,
    onClick: e => {
      e.stopPropagation();
      setSaved(s => !s);
    },
    "aria-label": "Salvar"
  }, saved ? /*#__PURE__*/React.createElement(Icon.HeartFill, {
    width: 18,
    height: 18
  }) : /*#__PURE__*/React.createElement(Icon.Heart, {
    width: 18,
    height: 18
  }))), listing.photoCount && /*#__PURE__*/React.createElement("span", {
    className: "listing__photo-count"
  }, /*#__PURE__*/React.createElement(Icon.Camera, {
    width: 13,
    height: 13
  }), " ", listing.photoCount)), /*#__PURE__*/React.createElement("div", {
    className: "listing__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "listing__price"
  }, "R$ ", listing.price.toLocaleString('pt-BR'), /*#__PURE__*/React.createElement("span", null, " /m\xEAs")), /*#__PURE__*/React.createElement("h3", {
    className: "listing__title"
  }, listing.title), /*#__PURE__*/React.createElement("div", {
    className: "listing__addr"
  }, /*#__PURE__*/React.createElement(Icon.MapPin, {
    width: 13,
    height: 13
  }), " ", listing.address), /*#__PURE__*/React.createElement("div", {
    className: "listing__specs"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon.Bed, {
    width: 15,
    height: 15
  }), " ", listing.beds), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon.Bath, {
    width: 15,
    height: 15
  }), " ", listing.baths), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon.Area, {
    width: 15,
    height: 15
  }), " ", listing.sqm, "m\xB2"), listing.parking && /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon.Car, {
    width: 15,
    height: 15
  }), " ", listing.parking)), /*#__PURE__*/React.createElement("div", {
    className: "listing__tags"
  }, listing.tags.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `tag tag--${i % 2 === 0 ? 'orange' : 'purple'}`
  }, t)))));
}
window.SiteListingCard = SiteListingCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SiteListingCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Testimonial.jsx
try { (() => {
// Testimonial.jsx — quote card
function Testimonial() {
  return /*#__PURE__*/React.createElement("section", {
    className: "testimonial"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "testimonial__card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "testimonial__quote-mark"
  }, "\""), /*#__PURE__*/React.createElement("blockquote", {
    className: "testimonial__quote"
  }, "Cheguei de mudan\xE7a de SP no domingo. Segunda j\xE1 tava dormindo no ap\xEA com len\xE7ol limpo, caf\xE9 na cozinha e a Bia respondendo no WhatsApp. Esse \xE9 o tipo de servi\xE7o que devia existir pra tudo."), /*#__PURE__*/React.createElement("div", {
    className: "testimonial__by"
  }, /*#__PURE__*/React.createElement("div", {
    className: "testimonial__avatar"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "testimonial__name"
  }, "Mariana Tavares"), /*#__PURE__*/React.createElement("div", {
    className: "testimonial__role"
  }, "Mudou pra Moema em mar\xE7o"))))));
}
window.Testimonial = Testimonial;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Testimonial.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// icons.jsx — Lucide-style SVG icon set used across the website.
// Monoline, 2px stroke, round caps/joins, inherits currentColor.

const _icnProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};
const Icon = {
  MapPin: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "3"
  })),
  Bed: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M2 4v16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 8h18a2 2 0 0 1 2 2v10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 17h20"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 8v9"
  })),
  Bath: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
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
  })),
  Area: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("polyline", {
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
  })),
  Car: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "17",
    r: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 17h6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "17",
    cy: "17",
    r: "2"
  })),
  Heart: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
  })),
  HeartFill: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p, {
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
  })),
  Camera: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "3"
  })),
  ArrowRight: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m12 5 7 7-7 7"
  })),
  Search: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.3-4.3"
  })),
  Check: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  Close: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m6 6 12 12"
  })),
  Phone: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"
  })),
  Tree: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 22v-7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 8a3 3 0 1 1 6 0c1.1 0 3 .9 3 3a3 3 0 0 1-1 5.8V18a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-1.2A3 3 0 0 1 6 11c0-2.1 1.9-3 3-3Z"
  })),
  Sparkle: p => /*#__PURE__*/React.createElement("svg", _extends({}, _icnProps, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
  }))
};
window.Icon = Icon;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/icons.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.ListingCard = __ds_scope.ListingCard;

})();
