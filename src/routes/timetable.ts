import { Router } from 'express';
import { z } from 'zod';
import { readRange, writeRange, clearRange } from '../lib/sheets';
import { getSheetsClient } from '../lib/sheets';
import { loadEnv } from '../lib/env';

const router = Router();

// Minimal schema: days, slots, courses
const LabSchema = z.object({ name: z.string(), blocks: z.number().int().min(1).max(10) });

const GenerateBodySchema = z.object({
  sheet: z.string().default('Timetable'),
  days: z.array(z.string()).default(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
  courses: z.array(z.string()).default(['Math', 'Physics', 'Chemistry']),
  labs: z.array(LabSchema).default([])
});

// Fixed 50-min periods and breaks
const periodLabels = [
  '08:45-09:35',
  '09:35-10:25',
  '10:45-11:35',
  '11:35-12:25',
  '13:10-14:00',
  '14:00-14:50',
  '15:00-15:50',
  '15:50-16:40'
];
const pairableIndices = [ [0,1], [2,3], [4,5], [6,7] ];

router.get('/', async (req, res) => {
  const sheet = (req.query.sheet as string) || 'Timetable';
  try {
    const values = await readRange({ sheetName: sheet, rangeA1: 'A1:Z50' });
    res.json({ sheet, values });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List existing sheet tabs for menu
router.get('/sheets', async (_req, res) => {
  try {
    const sheets = getSheetsClient();
    const env = loadEnv();
    const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID_READONLY || env.GOOGLE_SHEETS_SPREADSHEET_ID_EDITABLE || (env.GOOGLE_SHEETS_SPREADSHEET_ID as string);
    const { data } = await sheets.spreadsheets.get({ spreadsheetId });
    const names = (data.sheets || []).map(s => s.properties?.title).filter(Boolean) as string[];
    res.json({ sheets: names });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List sheet tabs from the EDITABLE spreadsheet for Save menu
router.get('/sheets-editable', async (_req, res) => {
  try {
    const sheets = getSheetsClient();
    const env = loadEnv();
    const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID_EDITABLE || env.GOOGLE_SHEETS_SPREADSHEET_ID_READONLY || (env.GOOGLE_SHEETS_SPREADSHEET_ID as string);
    const { data } = await sheets.spreadsheets.get({ spreadsheetId });
    const names = (data.sheets || []).map(s => s.properties?.title).filter(Boolean) as string[];
    res.json({ sheets: names });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Read from EDITABLE spreadsheet explicitly (used for Load Saved)
router.get('/saved', async (req, res) => {
  const sheet = (req.query.sheet as string) || 'Timetable';
  try {
    const sheets = getSheetsClient();
    const env = loadEnv();
    const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID_EDITABLE || env.GOOGLE_SHEETS_SPREADSHEET_ID_READONLY || (env.GOOGLE_SHEETS_SPREADSHEET_ID as string);
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheet}'!A1:Z50`
    });
    res.json({ sheet, values: (data.values as string[][]) || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin can save edited rows back to Sheets
router.put('/', async (req, res) => {
  const sheet = (req.query.sheet as string) || 'Timetable';
  const rows = (req.body && Array.isArray(req.body.rows)) ? (req.body.rows as string[][]) : null;
  if(!rows) return res.status(400).json({ error: 'rows required' });
  try {
    const lastCol = String.fromCharCode(65 + (rows[0]?.length ?? 1) - 1);
    await writeRange({ sheetName: sheet, rangeA1: `A1:${lastCol}${rows.length}` }, rows);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/generate', async (req, res) => {
  const parse = GenerateBodySchema.safeParse(req.body ?? {});
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  let { sheet, days, courses, labs } = parse.data;
  const save = Boolean((req.body && (req.body.save === true || req.body.save === 'true')));

  // Normalize days
  if (days.length === 5) {
    // Force Mon-Fri for 5-day schedules
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  } else {
    // Replace any 'Sat' with 'Fri'
    days = days.map((d) => (d === 'Sat' ? 'Fri' : d));
    if (days.length >= 5) days[days.length - 1] = 'Fri';
  }

  // Grid init
  const headerRow = ['Day', ...periodLabels];
  const grid: (string | null)[][] = days.map(() => Array(periodLabels.length).fill(null));

  // Normalize labs: each distinct lab occurs once per week as a 2-hour block
  const uniqueLabNames = Array.from(new Set(labs.map(l => l.name)));
  const labsOnce = uniqueLabNames.map(name => ({ name, blocks: 1 }));
  // Place labs: each block occupies a valid pair on a day
  const totalPairs = days.length * pairableIndices.length;
  const requestedBlocks = labsOnce.reduce((a, b) => a + b.blocks, 0);
  if (requestedBlocks > totalPairs) {
    return res.status(400).json({ error: 'Too many lab blocks for available time pairs.' });
  }
  const allPairSpots: { dayIdx: number; pair: [number, number] }[] = [];
  for (let d = 0; d < days.length; d++) {
    for (const p of pairableIndices) allPairSpots.push({ dayIdx: d, pair: [p[0], p[1]] });
  }
  // shuffle utility
  function shuffle<T>(arr: T[]): T[] { return arr.sort(() => Math.random() - 0.5); }
  shuffle(allPairSpots);

  for (const lab of labsOnce) {
    for (let i = 0; i < lab.blocks; i++) {
      const spot = allPairSpots.find(s => grid[s.dayIdx][s.pair[0]] === null && grid[s.dayIdx][s.pair[1]] === null);
      if (!spot) return res.status(400).json({ error: 'Not enough free consecutive periods for labs.' });
      grid[spot.dayIdx][spot.pair[0]] = lab.name;
      grid[spot.dayIdx][spot.pair[1]] = lab.name;
      // remove this spot from availability
      allPairSpots.splice(allPairSpots.indexOf(spot), 1);
    }
  }

  // Count remaining free slots
  const freeCells: { dayIdx: number; slotIdx: number }[] = [];
  for (let d = 0; d < days.length; d++) {
    for (let s = 0; s < periodLabels.length; s++) {
      if (grid[d][s] === null) freeCells.push({ dayIdx: d, slotIdx: s });
    }
  }

  // Feasibility: each course may appear at most 2 periods per day.
  // Therefore, for X remaining slots in a day, need at least ceil(X/2) distinct courses.
  // We will attempt to fill while respecting <= 2 per course per day; if tight, we rebalance without erroring

  // Determine target counts per course as equal as possible
  const totalLectures = freeCells.length;
  const base = Math.floor(totalLectures / courses.length);
  let rem = totalLectures % courses.length;
  const counts = new Map<string, number>();
  for (const c of courses) {
    counts.set(c, base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem--;
  }

  // Track per-day placed count per course to enforce <=2 per day
  const dayCourseCount: Array<Map<string, number>> = days.map(() => new Map());

  // Try to create some 2-hour blocks for lectures (same course), but never >2 and only once per day per course
  // Decide lecture double-blocks:
  // - If a day has a lab, it may or may not have a 2-hour lecture (50% chance)
  // - If a day has no lab, it must have exactly one 2-hour lecture
  const isLabDay: boolean[] = days.map((_, d) => grid[d].some(v => v !== null && labsOnce.some(l => l.name === v)));
  let lastDoubleCourse: string | null = null;
  const usedDoubleCourseWeek = new Set<string>();
  for (let d = 0; d < days.length; d++) {
    const mustPlace = !isLabDay[d];
    const mayPlace = isLabDay[d] && Math.random() < 0.5;
    if (!mustPlace && !mayPlace) continue;
    const availablePairs = pairableIndices
      .filter(([a, b]) => grid[d][a] === null && grid[d][b] === null)
      .map(([a, b]) => [a, b] as [number, number]);
    if (availablePairs.length === 0) continue;
    // prefer course with >=2 remaining, unused today, and not equal to previous day's 2-hr course
    const ordered = [...courses].sort((a,b) => (counts.get(b)||0) - (counts.get(a)||0));
    const candidate = ordered.find(c => (counts.get(c)||0) >= 2 && (dayCourseCount[d].get(c)||0) === 0 && c !== lastDoubleCourse && !usedDoubleCourseWeek.has(c));
    if (!candidate) continue;
    const [a, b] = availablePairs[Math.floor(Math.random() * availablePairs.length)];
    grid[d][a] = candidate;
    grid[d][b] = candidate;
    counts.set(candidate, (counts.get(candidate) || 0) - 2);
    dayCourseCount[d].set(candidate, 2);
    lastDoubleCourse = candidate;
    usedDoubleCourseWeek.add(candidate);
  }

  // Fill remaining singles enforcing:
  // - <= 2 periods per course per day
  // - no consecutive identical course within the same day (labs may be adjacent by placement above)
  // - balanced totals using remaining counts
  for (let d = 0; d < days.length; d++) {
    for (let s = 0; s < periodLabels.length; s++) {
      if (grid[d][s] !== null) continue;
      const prev = s > 0 ? grid[d][s - 1] : null;
      // prefer courses with count today < 1 first, then < 2, and not equal to previous
      let prefer = shuffle([...courses]).find(c => (counts.get(c) || 0) > 0 && (dayCourseCount[d].get(c) || 0) === 0 && c !== prev);
      let fallback = prefer ? undefined : shuffle([...courses]).find(c => (counts.get(c) || 0) > 0 && (dayCourseCount[d].get(c) || 0) === 1 && c !== prev);
      let chosen = prefer ?? fallback;
      // As a last resort, if all counts are 0 but some day counts < 2, borrow from the most available course overall
      if (!chosen) {
        const candidate = [...courses]
          .sort((a,b) => (counts.get(b)||0)-(counts.get(a)||0))
          .find(c => (dayCourseCount[d].get(c) || 0) < 2 && c !== prev);
        chosen = candidate ?? courses[0];
      }
      grid[d][s] = chosen;
      counts.set(chosen, Math.max(0, (counts.get(chosen) || 0) - 1));
      dayCourseCount[d].set(chosen, (dayCourseCount[d].get(chosen) || 0) + 1);
    }
  }

  // Build rows with breaks/lunch columns interleaved
  const displayHeader = [
    'Day',
    periodLabels[0],
    periodLabels[1],
    'Break 10:25-10:45',
    periodLabels[2],
    periodLabels[3],
    'Lunch 12:25-13:10',
    periodLabels[4],
    periodLabels[5],
    'Break 14:50-15:00',
    periodLabels[6],
    periodLabels[7]
  ];

  const rows: string[][] = [displayHeader];
  for (let d = 0; d < days.length; d++) {
    const dayRow: string[] = [days[d]];
    dayRow.push(grid[d][0] ?? '');
    dayRow.push(grid[d][1] ?? '');
    dayRow.push(''); // break column
    dayRow.push(grid[d][2] ?? '');
    dayRow.push(grid[d][3] ?? '');
    dayRow.push(''); // lunch column
    dayRow.push(grid[d][4] ?? '');
    dayRow.push(grid[d][5] ?? '');
    dayRow.push(''); // break column
    dayRow.push(grid[d][6] ?? '');
    dayRow.push(grid[d][7] ?? '');
    rows.push(dayRow);
  }

  try {
    if (save) {
      const lastColIndex = displayHeader.length - 1;
      const lastCol = String.fromCharCode(65 + lastColIndex);
      // Clear previous contents before writing new shape
      await clearRange({ sheetName: sheet, rangeA1: `A1:Z100` });
      await writeRange({ sheetName: sheet, rangeA1: `A1:${lastCol}${days.length + 1}` }, rows);
    }
    res.json({ ok: true, sheet, periodLabels, rows, saved: save });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

// shuffle util
function shuffle<T>(arr: T[]): T[] { return arr.sort(() => Math.random() - 0.5); }
