/**
 * Tests: Deterministischer Zufallsgenerator (rng.mjs).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";

test("RNG: gleicher Seed -> gleiche Zahlenfolge", () => {
  const a = new Rng("dungeon-1");
  const b = new Rng("dungeon-1");
  for (let i = 0; i < 100; i++) {
    assert.equal(a.float(), b.float(), `Abweichung bei Schritt ${i}`);
  }
});

test("RNG: anderer Seed -> andere Folge", () => {
  const a = new Rng("dungeon-1");
  const b = new Rng("dungeon-2");
  const folgeA = Array.from({ length: 20 }, () => a.float());
  const folgeB = Array.from({ length: 20 }, () => b.float());
  assert.notDeepEqual(folgeA, folgeB);
});

test("RNG: float liegt in [0, 1)", () => {
  const rng = new Rng(42);
  for (let i = 0; i < 1000; i++) {
    const f = rng.float();
    assert.ok(f >= 0 && f < 1, `float außerhalb [0,1): ${f}`);
  }
});

test("RNG: int liefert ganze Zahlen in [min, max]", () => {
  const rng = new RuanSeed();
  for (let i = 0; i < 500; i++) {
    const n = rng.int(1, 6);
    assert.ok(Number.isInteger(n));
    assert.ok(n >= 1 && n <= 6, `int außerhalb: ${n}`);
  }
});

test("RNG: int mit vertauschten Grenzen funktioniert", () => {
  const rng = new Rng(7);
  const n = rng.int(6, 1);
  assert.ok(n >= 1 && n <= 6);
});

test("RNG: chance(0) nie wahr, chance(1) immer wahr", () => {
  const rng = new Rng("chance");
  for (let i = 0; i < 50; i++) {
    assert.equal(rng.chance(0), false);
    assert.equal(rng.chance(1), true);
  }
});

test("RNG: pick wählt nur Elemente der Liste", () => {
  const rng = new Rng("pick");
  const liste = ["a", "b", "c"];
  for (let i = 0; i < 50; i++) {
    assert.ok(liste.includes(rng.pick(liste)));
  }
  assert.equal(rng.pick([]), null);
});

test("RNG: pickWeightet respektiert Gewichte (Statistik)", () => {
  const rng = new Rng("gewichte");
  const eintraege = [
    { wert: "selten", gewicht: 1 },
    { wert: "oft", gewicht: 9 },
  ];
  let oft = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    if (rng.pickWeighted(eintraege).wert === "oft") oft++;
  }
  // Erwartung 90 %; Toleranz ±5 %.
  assert.ok(oft / N > 0.85 && oft / N < 0.95, `oft-Anteil ${oft / N}`);
  assert.equal(rng.pickWeighted([{ wert: "x", gewicht: 0 }]), null);
});

test("RNG: shuffle mischt ohne zu verlieren", () => {
  const rng = new Rng("shuffle");
  const liste = [1, 2, 3, 4, 5, 6, 7, 8];
  const gemischt = rng.shuffle(liste);
  assert.equal(gemischt.length, liste.length);
  assert.deepEqual([...gemischt].sort(), [...liste].sort());
  assert.deepEqual(liste, [1, 2, 3, 4, 5, 6, 7, 8], "Original verändert!");
});

test("RNG: dice würfelt plausibel", () => {
  const rng = new Rng("dice");
  for (let i = 0; i < 100; i++) {
    const summe = rng.dice("2d6+3");
    assert.ok(summe >= 5 && summe <= 15, `2d6+3 außerhalb: ${summe}`);
  }
  assert.equal(rng.dice("unsinn"), 0);
});

/** Seed per Zahl, damit int-Verteilung nicht entartet. */
function RuanSeed() {
  return new Rng(12345);
}