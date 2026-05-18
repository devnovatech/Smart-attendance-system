// Heuristic parser that turns OCR'd text from a timetable PDF into a list of
// candidate timetable rows. The output is intentionally rough — admins must
// review and fix the rows in the importer UI before saving.

export interface ParsedRow {
  dayOfWeek: number; // 0=Sun..6=Sat; -1 if unknown
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  courseHint: string; // free text that might be a course name/code
  teacherHint: string; // free text that might be a teacher name
  room: string;
  rawLine: string;
}

const DAY_PATTERNS: { day: number; rx: RegExp }[] = [
  { day: 0, rx: /\b(sun(day)?)\b/i },
  { day: 1, rx: /\b(mon(day)?)\b/i },
  { day: 2, rx: /\b(tue(s(day)?)?)\b/i },
  { day: 3, rx: /\b(wed(nesday)?)\b/i },
  { day: 4, rx: /\b(thu(r(s(day)?)?)?)\b/i },
  { day: 5, rx: /\b(fri(day)?)\b/i },
  { day: 6, rx: /\b(sat(urday)?)\b/i },
];

// Captures any time-range pattern: 9-10, 9:00-10:00, 09.00-10.00, 9am-10am
const TIME_RANGE_RX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/gi;

const ROOM_RX = /\b(?:room|lab|hall|class|cls)[\s-]*([\w-]+)\b/i;

const toHHMM = (h: number, m: number, meridiem?: string): string => {
  let hours = h;
  if (meridiem) {
    const isPm = meridiem.toLowerCase() === 'pm';
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
  }
  // Heuristic: if the hour is 1-7 with no meridiem, assume PM (afternoon timetable)
  else if (hours >= 1 && hours <= 7) {
    hours += 12;
  }
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const findDay = (text: string): number => {
  for (const { day, rx } of DAY_PATTERNS) {
    if (rx.test(text)) return day;
  }
  return -1;
};

const stripPatterns = (line: string): string => {
  return line
    .replace(TIME_RANGE_RX, ' ')
    .replace(/\b(sun|mon|tue(s)?|wed|thu(r)?|fri|sat)(day)?\b/gi, ' ')
    .replace(ROOM_RX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Split residual text into a teacher hint vs course hint.
// Heuristic: capitalised tokens that look like "Mr X" / "Prof Y" / "Dr Z" → teacher.
const splitTeacherCourse = (residual: string): { teacherHint: string; courseHint: string } => {
  const teacherRx = /(mr\.?|mrs\.?|ms\.?|miss|prof\.?|dr\.?)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?/i;
  const match = residual.match(teacherRx);
  if (match) {
    return {
      teacherHint: match[0].trim(),
      courseHint: residual.replace(teacherRx, '').replace(/\s+/g, ' ').trim(),
    };
  }
  // Fall back: assume everything is course text; admin will pick a teacher manually.
  return { teacherHint: '', courseHint: residual };
};

export const parseTimetableText = (text: string): ParsedRow[] => {
  const rows: ParsedRow[] = [];
  // Track the last day mention seen so list-style timetables ("Monday:\n  9-10 …\n  10-11 …")
  // still attribute subsequent rows to the right day.
  let lastDay = -1;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const dayInLine = findDay(line);
    if (dayInLine !== -1) lastDay = dayInLine;

    TIME_RANGE_RX.lastIndex = 0;
    const matches = Array.from(line.matchAll(TIME_RANGE_RX));
    if (matches.length === 0) continue;

    for (const m of matches) {
      const startH = parseInt(m[1], 10);
      const startM = parseInt(m[2] || '0', 10);
      const startMeridiem = m[3];
      const endH = parseInt(m[4], 10);
      const endM = parseInt(m[5] || '0', 10);
      const endMeridiem = m[6];

      if (Number.isNaN(startH) || Number.isNaN(endH)) continue;

      const startTime = toHHMM(startH, startM, startMeridiem);
      const endTime = toHHMM(endH, endM, endMeridiem);

      const roomMatch = line.match(ROOM_RX);
      const room = roomMatch ? roomMatch[0].trim() : '';

      const residual = stripPatterns(line);
      const { teacherHint, courseHint } = splitTeacherCourse(residual);

      rows.push({
        dayOfWeek: dayInLine !== -1 ? dayInLine : lastDay,
        startTime,
        endTime,
        courseHint,
        teacherHint,
        room,
        rawLine: line,
      });
    }
  }

  return rows;
};

// ---- Fuzzy matching against existing entities ----

const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

const tokenOverlap = (a: string, b: string): number => {
  const ta = tokenize(a);
  const tb = new Set(tokenize(b));
  if (ta.length === 0 || tb.size === 0) return 0;
  const uniqueA = Array.from(new Set(ta));
  let common = 0;
  for (const t of uniqueA) if (tb.has(t)) common += 1;
  return common / Math.max(uniqueA.length, tb.size);
};

export interface MatchCandidate<T> {
  item: T;
  score: number;
}

export const bestMatch = <T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  minScore = 0.34
): MatchCandidate<T> | null => {
  if (!query.trim() || items.length === 0) return null;
  let best: MatchCandidate<T> | null = null;
  for (const item of items) {
    const score = tokenOverlap(query, getText(item));
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= minScore ? best : null;
};
