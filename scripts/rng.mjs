/**
 * THE DUNGEON – Deterministischer Zufallsgenerator (seedbar).
 *
 * Pure Logik, keine Foundry-Abhängigkeiten -> mit `node --test` testbar.
 * Basierend auf sfc32 (Public Domain). Gleicher Seed + gleiche
 * Aufrufsreihenfolge => gleiche Ergebnisse.
 *
 * Persistenz: getState()/setState() erlauben, den Generatorzustand
 * einzufrieren (z. B. über Foundry-Flags) und später exakt
 * fortzusetzen – Dungeon-Zufall überlebt Neuladen/Sitzungswechsel.
 */

/** sfc32-Step: mutiert das Zustands-Array [a,b,c,d], gibt float [0,1). */
function _sfc32Step(state) {
  let [a, b, c, d] = state;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  state[0] = a; state[1] = b; state[2] = c; state[3] = d;
  return (t >>> 0) / 4294967296;
}

/** String-Seed deterministisch auf 4 x uint32 verteilen. */
function _stringToQuads(seedString) {
  const quads = [0, 0, 0, 0];
  const s = String(seedString);
  for (let i = 0; i < s.length; i++) {
    const pos = i & 3;
    quads[pos] = (quads[pos] * 33 + s.charCodeAt(i)) >>> 0;
  }
  return quads;
}

/** Seed (Zahl ODER String) -> sfc32-Startzustand [a,b,c,d]. */
export function seedToState(seed) {
  const q =
    typeof seed === "number" && Number.isFinite(seed)
      ? [Math.abs(Math.floor(seed)) >>> 0, 0x9e3779b9, 0x668b5681, 0x8cb92a72]
      : _stringToQuads(seed);
  // Nullen vermeiden (sfc32 mag keine All-Null-Zustände).
  return q.map((v, i) =>
    v === 0 ? [1, 0x9e3779b9, 0x7f4a7c15, 0x85ebca6b][i] : v
  );
}

/** Seedbare RNG-Instanz mit Persistenz. */
export class Rng {
  /** @param {number|string} [seed] */
  constructor(seed = Date.now() % 0xffffffff) {
    this.seedValue = seed;
    this.state = seedToState(seed);
  }

  /** Float in [0, 1). */
  float() {
    return _sfc32Step(this.state);
  }

  /** Integer in [min, max] (inklusive Enden). */
  int(min, max) {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** True mit Wahrscheinlichkeit `p`. */
  chance(p = 0.5) {
    return this.float() < p;
  }

  /** Element aus einer Liste (null bei leerer Liste). */
  pick(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[this.int(0, list.length - 1)];
  }

  /**
   * Gewichtetes Element aus [{wert, gewicht}].
   * Gibt den Eintrag zurück; null bei leerer Gewichtssumme.
   */
  pickWeighted(entries) {
    const valid = (entries || []).filter((e) => e && e.gewicht > 0);
    const total = valid.reduce((s, e) => s + e.gewicht, 0);
    if (total <= 0) return null;
    let roll = this.float() * total;
    for (const e of valid) {
      roll -= e.gewicht;
      if (roll < 0) return e;
    }
    return valid[valid.length - 1];
  }

  /** Kopiertes, gemischtes Array (Fisher-Yates). */
  shuffle(list) {
    const a = [...(list || [])];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Würfelsyntax "2d6+3". */
  dice(formula) {
    const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(formula).replace(/\s+/g, ""));
    if (!m) return 0;
    const [, n, sides, mod] = m;
    let sum = mod ? parseInt(mod, 10) : 0;
    for (let i = 0; i < parseInt(n, 10); i++) {
      sum += this.int(1, parseInt(sides, 10));
    }
    return sum;
  }

  /** Unveränderliche Zustandskopie (zum Persistieren). */
  getState() {
    return [...this.state];
  }

  /** Zustand wiederherstellen (z. B. aus Foundry-Flags). */
  setState(state) {
    if (!Array.isArray(state) || state.length !== 4) {
      throw new Error("RNG-Zustand muss ein 4er-Array sein");
    }
    this.state = state.map((v) => v >>> 0);
    return this;
  }
}

/** Fabrik: neue RNG aus Seed (oder Zufallsseed). */
export function createRng(seed) {
  return new Rng(seed);
}
export default createRng;