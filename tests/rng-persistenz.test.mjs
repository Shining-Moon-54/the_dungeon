/**
 * Tests: RNG – Persistenz (getState/setState).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";

test("RNG: getState/setState setzt die Folge exakt fort", () => {
  const a = new Rng("persistenz");
  a.float(); a.float(); a.float(); // 3 Schritte laufen lassen
  const zustand = a.getState();
  const erwartet = [a.float(), a.float(), a.float()]; // nächste 3 Werte

  const b = new Rng("egal");
  b.setState(zustand);
  assert.deepEqual([b.float(), b.float(), b.float()], erwartet);
});

test("RNG: Zustand wirkt unabhängig vom Seed des Ziel-RNG", () => {
  const a = new Rng(42);
  a.float(); a.float();
  const zustand = a.getState();
  const b = new Rng(999);
  b.setState(zustand);
  assert.equal(b.float(), a.float());
});

test("RNG: eingefrorener Zustand bleibt von Mutation unberührt", () => {
  const a = new Rng("kopie");
  a.float();
  const zustand = a.getState();
  const b = new Rng("kopie");
  b.setState(zustand);
  // b folgt jetzt derselben Fortsetzung wie a – a läuft weiter …
  const erwartet = [a.float(), a.float()];
  // … und b liefert exakt dieselben Werte:
  assert.deepEqual([b.float(), b.float()], erwartet);
});

test("RNG: setState lehnt ungültige Zustände ab", () => {
  const a = new Rng(1);
  assert.throws(() => a.setState(null), /4er-Array/);
  assert.throws(() => a.setState([1, 2, 3]), /4er-Array/);
});