/**
 * THE DUNGEON – Settings & Dungeon-Verwaltung.
 *
 * Modul-Einstellungen (game.settings), Dungeon-Konfiguration (Datenstruktur
 * aus generator.mjs) und die typischen Auslöser/Regler aus dem Plan:
 * Limits, Dichten, Schutz, Modi.
 */

export const MODUL_ID = "the-dungeon";

/** Dungeon-Modi. */
export const MODI = {
  STATISCH: "statisch",
  DYNAMISCH: "dynamisch",
  VERAENDERND: "veraendernd",
  CHAOTISCH: "chaotisch",
};

/** Standard-Settings des Moduls. */
export const SETTING_KEYS = {
  DICHTE_GEGNER: "dichte-gegner",
  DICHTE_FALLEN: "dichte-fallen",
  DICHTE_RAETSEL: "dichte-raetsel",
  DICHTE_SCHAETZE: "dichte-schaetze",
  RESET_BEIM_VERLASSEN: "reset-beim-verlassen",
  AUTOMATISCHE_AUSLOESER: "automatische-ausloeser",
};

/** Alle Settings registrieren (Hook „init“). */
export function settingsRegistrieren() {
  if (typeof game === "undefined") return;
  const S = game.settings;
  S.register(MODUL_ID, "packs", {scope:"world",config:false,type:Array,default:[]});
  S.register(MODUL_ID,"requestLedger",{scope:"world",config:false,type:Object,default:{}});
  S.register(MODUL_ID, SETTING_KEYS.DICHTE_GEGNER, {
    name: "Dichte: Gegner", hint: "Anteil der Räume mit Gegnern (0–100 %).",
    scope: "world", type: Number, range: { min: 0, max: 100, step: 5 }, default: 40,
    config: true,
  });
  S.register(MODUL_ID, SETTING_KEYS.DICHTE_FALLEN, {
    name: "Dichte: Fallen", hint: "Anteil der Räume mit Fallen (0–100 %).",
    scope: "world", type: Number, range: { min: 0, max: 100, step: 5 }, default: 20,
    config: true,
  });
  S.register(MODUL_ID, SETTING_KEYS.DICHTE_RAETSEL, {
    name: "Dichte: Rätsel", hint: "Anteil der Räume mit Rätseln (0–100 %).",
    scope: "world", type: Number, range: { min: 0, max: 100, step: 5 }, default: 15,
    config: true,
  });
  S.register(MODUL_ID, SETTING_KEYS.DICHTE_SCHAETZE, {
    name: "Dichte: Schätze", hint: "Anteil der Räume mit Truhen (0–100 %).",
    scope: "world", type: Number, range: { min: 0, max: 100, step: 5 }, default: 30,
    config: true,
  });
  S.register(MODUL_ID, SETTING_KEYS.RESET_BEIM_VERLASSEN, {
    name: "Reset beim Verlassen", hint: "Dungeon automatisch zurücksetzen, wenn die Gruppe ihn verlässt.",
    scope: "world", type: Boolean, default: false, config: true,
  });
  S.register(MODUL_ID, SETTING_KEYS.AUTOMATISCHE_AUSLOESER, {
    name: "Automatische Auslöser", hint: "Auslöser feuern automatisch statt per GM-Bestätigung.",
    scope: "world", type: Boolean, default: false, config: true,
  });
}

/**
 * Dungeon-Konfiguration aus Benutzereingaben bauen.
 * Reine Funktion – validiert und normalisiert.
 */
export function dungeonKonfiguration(eingabe = {}) {
  const limits = {
    maxKartenProEbene: zahl(eingabe.maxKartenProEbene, 12, { min: 1, max: 100 }),
    maxAusdehnung: {
      breite: zahl(eingabe.maxKartenBreite, 40, { min: 5, max: 200 }),
      hoehe: zahl(eingabe.maxKartenHoehe, 40, { min: 5, max: 200 }),
    },
    maxEbenen: zahl(eingabe.maxEbenen, 5, { min: 1, max: 20 }),
  };
  const dichten = {
    gegner: prozent(eingabe.dichteGegner, 40),
    fallen: prozent(eingabe.dichteFallen, 20),
    raetsel: prozent(eingabe.dichteRaetsel, 15),
    schaetze: prozent(eingabe.dichteSchaetze, 30),
  };
  const modus = Object.values(MODI).includes(eingabe.modus)
    ? eingabe.modus
    : MODI.DYNAMISCH;
  return { limits, dichten, modus };
}

/** Zahl-Helfer mit Fallback und Range-Clamp. */
function zahl(wert, fallback, { min, max } = {}) {
  const n = Number(wert);
  let v = Number.isFinite(n) && wert !== "" && wert !== null ? n : fallback;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return Math.floor(v);
}

/** Prozent-Helfer (0–1). */
function prozent(wert, fallback) {
  const n = Number(wert);
  const v = Number.isFinite(n) ? n / 100 : fallback / 100;
  return Math.min(1, Math.max(0, v));
}