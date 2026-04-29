/**
 * Pratix — Logo system.
 *
 * Tre direzioni grafiche disponibili:
 *  - "px"     monogramma "Px" geometrico, la x in oro brunito.
 *  - "bar"    "P" sans con barra orizzontale dorata (riga d'atto).
 *  - "seal"   sigillo circolare navy con "P" centrata e dettaglio oro (ceralacca).
 *
 * Forme:
 *  - "mark"     solo simbolo (per favicon, app icon, intestazioni compatte).
 *  - "wordmark" solo "Pratix".
 *  - "lockup"   simbolo + wordmark (default).
 *
 * Toni:
 *  - "navy"    primario su fondi chiari (default).
 *  - "inverse" bianco caldo su fondi scuri.
 *  - "mono"    tutto monocromatico in currentColor.
 */

import { cn } from "@/lib/utils";

export type LogoDirection = "px" | "bar" | "seal";
export type LogoForm = "mark" | "wordmark" | "lockup";
export type LogoTone = "navy" | "inverse" | "mono";

type LogoProps = {
  direction?: LogoDirection;
  form?: LogoForm;
  tone?: LogoTone;
  /** Altezza in px applicata via className h-{n} non disponibile: usa size diretta */
  size?: number;
  className?: string;
  ariaLabel?: string;
};

/** Direzione di default del brand. Cambiandola qui si propaga ovunque. */
export const BRAND_DIRECTION: LogoDirection = "px";

function toneColors(tone: LogoTone) {
  if (tone === "inverse") {
    return {
      primary: "var(--color-brand-cream)",
      gold: "var(--color-brand-gold)",
      onGold: "var(--color-brand-gold-foreground)",
    };
  }
  if (tone === "mono") {
    return {
      primary: "currentColor",
      gold: "currentColor",
      onGold: "currentColor",
    };
  }
  return {
    primary: "var(--color-brand-navy)",
    gold: "var(--color-brand-gold)",
    onGold: "var(--color-brand-gold-foreground)",
  };
}

/* -------------------------------------------------------------------------- */
/* MARKS                                                                      */
/* -------------------------------------------------------------------------- */

function MarkPx({ tone, size }: { tone: LogoTone; size: number }) {
  const c = toneColors(tone);
  const isMono = tone === "mono";
  const isInverse = tone === "inverse";

  // Default ("navy"): usa i token --logo-* che sono adattivi al tema.
  // Inverse: forza tile panna + glifo inchiostro (per fondi scuri brandizzati).
  // Mono: solo cornice e glifo in currentColor.
  const tileFill = isMono
    ? "transparent"
    : isInverse
      ? "var(--color-brand-cream)"
      : "var(--logo-tile)";

  const borderStroke = isMono
    ? "currentColor"
    : isInverse
      ? "var(--color-brand-navy)"
      : "var(--logo-border)";
  const borderOpacity = isMono
    ? 1
    : isInverse
      ? 0.35
      : "var(--logo-border-opacity)";

  const glyphColor = isMono
    ? "currentColor"
    : isInverse
      ? "var(--color-brand-navy)"
      : "var(--logo-glyph)";

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill={tileFill} />
      <rect
        x="0.75"
        y="0.75"
        width="46.5"
        height="46.5"
        rx="11.25"
        fill="none"
        stroke={borderStroke}
        strokeWidth="1.5"
        opacity={borderOpacity as number | string}
      />
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontFamily="'Inter Tight', Georgia, serif"
        fontSize="26"
        fontWeight={500}
        letterSpacing="-1"
        fill={glyphColor}
      >
        P
        <tspan fill={isMono ? "currentColor" : c.gold} fontStyle="italic">
          x
        </tspan>
      </text>
    </svg>
  );
}

function MarkBar({ tone, size }: { tone: LogoTone; size: number }) {
  const c = toneColors(tone);
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="9" fill={c.primary} />
      <path
        d="M12 11h8.5c3.6 0 6 2.2 6 5.6 0 3.4-2.4 5.6-6 5.6H15.5v6.8H12V11Zm8.2 8.2c1.6 0 2.7-1 2.7-2.6 0-1.6-1.1-2.6-2.7-2.6H15.5v5.2h4.7Z"
        fill={tone === "mono" ? "transparent" : "var(--color-primary-foreground)"}
        stroke={tone === "mono" ? "currentColor" : "none"}
        strokeWidth={tone === "mono" ? 1.5 : 0}
      />
      <rect x="9" y="30" width="22" height="2" rx="1" fill={c.gold} />
    </svg>
  );
}

function MarkSeal({ tone, size }: { tone: LogoTone; size: number }) {
  const c = toneColors(tone);
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18" fill={c.primary} />
      <circle
        cx="20"
        cy="20"
        r="15.5"
        fill="none"
        stroke={c.gold}
        strokeWidth="0.6"
        opacity="0.7"
      />
      <path
        d="M14.5 11.5h6.7c3.2 0 5.3 2 5.3 4.9 0 2.9-2.1 4.9-5.3 4.9h-3.4v7.2h-3.3V11.5Zm6.4 7c1.4 0 2.3-.8 2.3-2.1 0-1.3-.9-2.1-2.3-2.1h-3.1v4.2h3.1Z"
        fill={tone === "mono" ? "transparent" : "var(--color-primary-foreground)"}
        stroke={tone === "mono" ? "currentColor" : "none"}
        strokeWidth={tone === "mono" ? 1.5 : 0}
      />
      {/* Goccia di ceralacca */}
      <circle cx="29" cy="29" r="2.2" fill={c.gold} />
    </svg>
  );
}

function Mark({
  direction,
  tone,
  size,
}: {
  direction: LogoDirection;
  tone: LogoTone;
  size: number;
}) {
  if (direction === "bar") return <MarkBar tone={tone} size={size} />;
  if (direction === "seal") return <MarkSeal tone={tone} size={size} />;
  return <MarkPx tone={tone} size={size} />;
}

/* -------------------------------------------------------------------------- */
/* WORDMARK                                                                   */
/* -------------------------------------------------------------------------- */

function Wordmark({
  tone,
  size,
  direction,
}: {
  tone: LogoTone;
  size: number;
  direction: LogoDirection;
}) {
  const c = toneColors(tone);
  // size = altezza glifo desiderata; calcoliamo font-size proporzionale
  const fontSize = Math.round(size * 0.95);
  // Il wordmark "navy" si adatta al tema: navy in light, panna in dark.
  // "inverse" forza panna su fondi scuri brandizzati. "mono" usa currentColor.
  const wordColor =
    tone === "mono"
      ? "currentColor"
      : tone === "inverse"
        ? "var(--color-brand-cream)"
        : "var(--color-foreground)";
  return (
    <span
      className="font-display"
      style={{
        color: wordColor,
        fontSize,
        lineHeight: 1,
        letterSpacing: "-0.035em",
        fontWeight: 600,
        fontStyle: "normal",
        whiteSpace: "nowrap",
      }}
    >
      Prati
      <span
        style={{
          color:
            direction === "px" || direction === "seal" ? c.gold : wordColor,
          // Stesso font, niente italic: evita il fallback che introduce spazio extra.
          fontStyle: "normal",
          marginLeft: "-0.02em",
        }}
      >
        x
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* PUBLIC                                                                     */
/* -------------------------------------------------------------------------- */

export function Logo({
  direction = BRAND_DIRECTION,
  form = "lockup",
  tone = "navy",
  size = 28,
  className,
  ariaLabel = "Pratix",
}: LogoProps) {
  const gap = Math.max(6, Math.round(size * 0.32));
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center", className)}
      style={{ gap }}
    >
      {form !== "wordmark" && <Mark direction={direction} tone={tone} size={size} />}
      {form !== "mark" && <Wordmark direction={direction} tone={tone} size={size} />}
    </span>
  );
}
