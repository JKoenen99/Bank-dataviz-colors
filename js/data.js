// Sample data for the example charts. Fictional, shaped like a banking app.

export const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Deterministic pseudo-random numbers, so every visit shows the same charts.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const kpis = [
  { label: 'Saldo betaalrekening', value: 12480, delta: 3.2, upIsGood: true, spark: [9.8, 10.1, 9.6, 10.4, 10.9, 10.6, 11.2, 11.0, 11.6, 11.9, 12.1, 12.5] },
  { label: 'Inkomsten deze maand', value: 4250, delta: 1.1, upIsGood: true, spark: [4.0, 4.0, 4.1, 4.0, 4.1, 4.6, 4.1, 4.1, 4.2, 4.2, 4.2, 4.25] },
  { label: 'Uitgaven deze maand', value: 3180, delta: 8.4, upIsGood: false, spark: [2.7, 2.9, 2.6, 2.8, 3.0, 2.8, 3.3, 2.9, 2.8, 3.0, 2.9, 3.18] },
  { label: 'Beleggingen', value: 48620, delta: -1.8, upIsGood: true, spark: [44.1, 45.0, 46.2, 45.4, 46.9, 47.8, 48.9, 49.6, 48.8, 49.9, 49.5, 48.6] },
];

export const monthlySpend = {
  cats: MONTHS,
  values: [2710, 2890, 2640, 2820, 3010, 2790, 3320, 2940, 2810, 3040, 2930, 3180],
};

export const incomeVsSpend = {
  cats: ['jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  series: [
    { name: 'Inkomsten', values: [4100, 4100, 4200, 4200, 4200, 4250] },
    { name: 'Uitgaven', values: [3320, 2940, 2810, 3040, 2930, 3180] },
  ],
};

// The last series is "Overig" (all others): it always gets the grey for
// distinct values, never a categorical colour.
export const spendByCategory = {
  cats: ['jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  series: [
    { name: 'Wonen', values: [1250, 1250, 1250, 1250, 1250, 1250] },
    { name: 'Boodschappen', values: [520, 480, 505, 540, 510, 590] },
    { name: 'Vrije tijd', values: [640, 420, 280, 350, 330, 480] },
    { name: 'Vervoer', values: [310, 260, 240, 290, 270, 255] },
    { name: 'Verzekeringen', values: [285, 285, 285, 285, 285, 285] },
    { name: 'Zorg', values: [140, 95, 180, 120, 110, 160] },
    { name: 'Abonnementen', values: [92, 92, 104, 104, 104, 118] },
    { name: 'Kleding', values: [60, 140, 210, 75, 90, 170] },
    { name: 'Overig', values: [215, 165, 140, 210, 175, 190], other: true },
  ],
};

export const funds = (() => {
  const names = ['Wereldwijd aandelen', 'Duurzaam mix', 'Obligaties euro', 'Vastgoed', 'Technologie', 'Geldmarkt', 'Opkomende markten', 'Small caps'];
  const drift = [0.9, 0.55, 0.2, -0.25, 1.35, 0.12, 0.4, 0.7];
  const vol = [1.6, 1.0, 0.5, 1.4, 2.4, 0.05, 2.0, 1.9];
  return {
    x: MONTHS,
    series: names.map((name, k) => {
      const r = rng(11 + k * 7);
      let v = 100;
      const values = [100];
      for (let i = 1; i < 12; i++) {
        v += drift[k] + (r() - 0.5) * 2 * vol[k];
        values.push(Math.round(v * 10) / 10);
      }
      return { name, values };
    }),
  };
})();

export const wealth = {
  x: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'],
  series: [
    { name: 'Spaargeld', values: [18, 21, 24, 29, 31, 30, 33, 36, 38, 41] },
    { name: 'Beleggingen', values: [6, 8, 12, 15, 24, 22, 29, 37, 44, 49] },
    { name: 'Pensioen', values: [22, 26, 31, 35, 42, 44, 50, 57, 64, 71] },
    { name: 'Overwaarde woning', values: [35, 44, 52, 61, 78, 86, 84, 92, 101, 108] },
  ],
};

export const portfolio = [
  { name: 'Aandelen', value: 38 },
  { name: 'Obligaties', value: 22 },
  { name: 'Vastgoed', value: 11 },
  { name: 'Grondstoffen', value: 8 },
  { name: 'Liquiditeiten', value: 7 },
  { name: 'Alternatieven', value: 6 },
  { name: 'Infrastructuur', value: 5 },
  { name: 'Private equity', value: 3 },
];

export const riskReturn = (() => {
  const groups = [
    { name: 'Aandelenfondsen', risk: [12, 22], ret: [4, 11] },
    { name: 'Mixfondsen', risk: [6, 13], ret: [2.5, 7] },
    { name: 'Obligatiefondsen', risk: [2, 7], ret: [0.5, 4] },
  ];
  const r = rng(42);
  return groups.map((g, k) => ({
    name: g.name,
    points: Array.from({ length: 11 }, (_, i) => {
      const t = r();
      const risk = g.risk[0] + t * (g.risk[1] - g.risk[0]);
      const ret = g.ret[0] + (0.25 + 0.75 * t) * r() * (g.ret[1] - g.ret[0]);
      return { x: Math.round(risk * 10) / 10, y: Math.round(ret * 10) / 10, label: `${g.name.replace('fondsen', 'fonds')} ${String.fromCharCode(65 + k)}${i + 1}` };
    }),
  }));
})();

export const activity = (() => {
  const rows = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const cols = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];
  const r = rng(7);
  const values = rows.map((_, d) =>
    cols.map((_, h) => {
      const lunch = Math.exp(-((h - 4.5) ** 2) / 4);
      const evening = Math.exp(-((h - 10) ** 2) / 5);
      const weekend = d >= 5 ? 1.5 : 1;
      const v = Math.round((8 + 46 * lunch * (d >= 5 ? 0.7 : 1) + 38 * evening * weekend) * (0.75 + r() * 0.5));
      // Thursday 14-15: storing, no data.
      return d === 3 && (h === 6 || h === 7) ? null : v;
    }),
  );
  return { rows, cols, values };
})();

export const sectorReturns = (() => {
  const rows = ['Technologie', 'Financials', 'Gezondheidszorg', 'Energie', 'Consumptie', 'Vastgoed'];
  const bias = [1.2, 0.4, 0.5, -0.3, 0.2, -0.8];
  const r = rng(99);
  const values = rows.map((_, k) => MONTHS.map(() => Math.round((bias[k] + (r() - 0.5) * 9) * 10) / 10));
  return { rows, cols: MONTHS, values };
})();

export const budgetDeviation = [
  { name: 'Vrije tijd', value: 24 },
  { name: 'Boodschappen', value: 11 },
  { name: 'Overig', value: 6 },
  { name: 'Wonen', value: 0.5 },
  { name: 'Verzekeringen', value: -2 },
  { name: 'Vervoer', value: -14 },
  { name: 'Abonnementen', value: -19 },
];

export const budgets = [
  { name: 'Boodschappen', used: 0.62, status: 'positive', text: 'Binnen budget' },
  { name: 'Vervoer', used: 0.91, status: 'positive', text: 'Nog 9% beschikbaar' },
  { name: 'Vrije tijd', used: 1, status: 'negative', text: 'Overschreden' },
  { name: 'Kleding', used: 0.18, status: 'neutral', text: 'Nog niet gestart' },
];
