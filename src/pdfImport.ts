import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { defaultSectionOrder, emptyResume } from "./data";
import type { CertificationItem, EducationItem, ExperienceItem, LanguageItem, ProjectItem, ResumeData, SkillGroup } from "./types";

GlobalWorkerOptions.workerSrc = pdfWorker;

const makeId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export async function parsePdfResume(file: File, current: ResumeData): Promise<ResumeData> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push(extractVisualLines(textContent.items));
  }

  return resumeFromText(pages.join("\n"), current);
}

type TextItem = { text: string; x: number; y: number; width: number };

function extractVisualLines(items: unknown[]): string {
  const textItems = items
    .map((item) => {
      if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return null;
      const t = item as { str: string; transform: number[]; width?: number };
      const text = t.str.replace(/\s+/g, " ").trim();
      if (!text) return null;
      return { text, x: t.transform[4] ?? 0, y: t.transform[5] ?? 0, width: t.width ?? 0 };
    })
    .filter((item): item is TextItem => Boolean(item));

  if (!textItems.length) return "";

  const pageWidth = Math.max(...textItems.map((i) => i.x + i.width), 1);
  const colSplit = detectColumnSplit(textItems, pageWidth);

  if (colSplit !== null) {
    // Process each column top-to-bottom separately, then concatenate
    const left = textItems.filter((i) => i.x + i.width * 0.4 < colSplit);
    const right = textItems.filter((i) => i.x + i.width * 0.4 >= colSplit);
    return buildLines(left) + "\n" + buildLines(right);
  }

  return buildLines(textItems);
}

// Detect a vertical gap in the body of the page that signals two columns.
// Uses START x-positions only (not item width) so wide right-column bullet text
// doesn't fill the histogram gap and mask the column boundary.
function detectColumnSplit(items: TextItem[], pageWidth: number): number | null {
  if (pageWidth < 100 || items.length < 10) return null;

  const maxY = Math.max(...items.map((i) => i.y));
  const minY = Math.min(...items.map((i) => i.y));
  const pageHeight = maxY - minY || 1;

  const bodyItems = items.filter((i) => i.y < maxY - pageHeight * 0.15);
  if (bodyItems.length < 8) return null;

  const SLOTS = 100;
  const startCount = new Array(SLOTS).fill(0);
  for (const item of bodyItems) {
    const s = Math.max(0, Math.min(SLOTS - 1, Math.floor((item.x / pageWidth) * SLOTS)));
    startCount[s]++;
  }

  // Find the widest zero-run in START positions between 10%–65% of page width
  const lo = Math.floor(SLOTS * 0.10);
  const hi = Math.floor(SLOTS * 0.65);
  let bestStart = -1, bestLen = 0, runStart = -1;

  for (let i = lo; i <= hi; i++) {
    if (startCount[i] === 0) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (len > bestLen) { bestLen = len; bestStart = runStart; }
      runStart = -1;
    }
  }
  if (runStart >= 0) {
    const len = hi - runStart + 1;
    if (len > bestLen) { bestLen = len; bestStart = runStart; }
  }

  if (bestLen < 5 || bestStart < 0) return null;

  const splitX = ((bestStart + bestLen / 2) / SLOTS) * pageWidth;

  // Both sides must have meaningful item counts to avoid false positives on single-column layouts
  const leftCount = bodyItems.filter((i) => i.x < splitX).length;
  const rightCount = bodyItems.filter((i) => i.x >= splitX).length;
  if (leftCount < 3 || rightCount < bodyItems.length * 0.10) return null;

  return splitX;
}

function buildLines(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: Array<{ y: number; items: TextItem[] }> = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= 3);
    if (row) { row.items.push(item); row.y = (row.y + item.y) / 2; }
    else rows.push({ y: item.y, items: [item] });
  }

  return rows
    .map((row) =>
      row.items
        .sort((a, b) => a.x - b.x)
        .reduce((line, item, index, arr) => {
          if (index === 0) return item.text;
          const prev = arr[index - 1];
          const gap = item.x - (prev.x + prev.width);
          const needsSpace = gap > -1 && !/[-/,(]$/.test(line) && !/^[),.;:%]/.test(item.text);
          return `${line}${needsSpace ? " " : ""}${item.text}`;
        }, ""),
    )
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function resumeFromText(text: string, current: ResumeData): ResumeData {
  const lines = cleanLines(text);
  const sectionMap = collectSections(lines);
  const contactText = lines.slice(0, 16).join(" ");

  const email = firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = firstMatch(text, /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  const linkedin = firstMatch(text, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,]+/i);
  const github = firstMatch(text, /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,]+/i);
  const website = firstMatch(text, /(?:https?:\/\/)?(?:www\.)?(?!linkedin\.com|github\.com)[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,]*)?/i);
  const name = guessName(lines, email);
  const title = guessTitle(lines, name);

  // Always build from a blank slate — never fall back to current resume content
  // so old data can't bleed into the import. Only settings (template, colors) are preserved.
  const imported: ResumeData = {
    personal: {
      fullName: name,
      title,
      email,
      phone,
      location: guessLocation(contactText),
      website: cleanUrl(website && website !== linkedin && website !== github ? website : ""),
      linkedin: cleanUrl(linkedin),
      github: cleanUrl(github),
      summary: guessSummary(sectionMap),
    },
    education: guessEducation(sectionMap) ?? emptyResume.education,
    experience: guessExperience(sectionMap) ?? [],
    projects: guessProjects(sectionMap) ?? [],
    skills: guessSkills(sectionMap) ?? emptyResume.skills,
    certifications: guessCertifications(sectionMap) ?? [],
    languages: guessLanguages(sectionMap) ?? [],
    settings: {
      ...current.settings,
      sectionOrder: current.settings.sectionOrder.length ? current.settings.sectionOrder : defaultSectionOrder,
    },
  };

  return imported;
}

function cleanLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function collectSections(lines: string[]) {
  const headings: Record<string, string[]> = {
    summary: ["summary", "profile", "objective", "career objective", "about"],
    education: ["education", "academic", "academics", "qualification"],
    experience: ["experience", "work experience", "employment", "professional experience", "internship", "internships"],
    projects: ["projects", "personal projects", "academic projects"],
    technicalSkills: ["technical skills", "key skills"],
    coreSkills: ["core skills"],
    skills: ["skills"],
    certifications: ["certifications", "courses", "licenses"],
    languages: ["languages", "spoken languages"],
  };

  const sections: Record<string, string[]> = {};
  let active = "intro";

  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:|-]/g, "").trim();
    const next = Object.entries(headings).find(([, names]) =>
      names.some((name) => normalized === name || normalized.startsWith(name + " "))
    );
    if (next) {
      active = next[0];
      sections[active] = sections[active] || [];
      continue;
    }
    sections[active] = sections[active] || [];
    sections[active].push(line);
  }

  return sections;
}

function guessName(lines: string[], email: string) {
  const blocked = ["resume", "curriculum vitae", "cv"];
  return (
    lines.find((line) => {
      const lower = line.toLowerCase();
      return line.length <= 42 && /[a-z]/i.test(line) && !line.includes("@") && line !== email && !blocked.includes(lower) && !/\d/.test(line);
    }) || ""
  );
}

function guessTitle(lines: string[], name: string) {
  const index = lines.indexOf(name);
  if (index < 0) return "";
  const sectionWords = /^(summary|profile|objective|education|experience|skills|projects|certifications|languages|work|professional|academic|core|technical)\b/i;
  return (
    lines.slice(index + 1, index + 5).find(
      (line) => line.length <= 80 && line.length > 5 && !line.includes("@") && !/\d{6,}/.test(line) && !sectionWords.test(line)
    ) || ""
  );
}

function guessLocation(text: string) {
  const cities = ["Bengaluru", "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Noida", "Gurugram", "Gurgaon", "Mysuru", "Mysore"];
  return cities.find((city) => new RegExp(`\\b${city}\\b`, "i").test(text)) || "";
}

function guessSummary(sections: Record<string, string[]>) {
  const summary = sections.summary || sections.intro || [];
  return summary.filter((line) => line.length > 30 && !line.includes("@")).slice(0, 3).join(" ");
}

function extractDates(text: string) {
  const dateRangeRegex =
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[0-9]{2}[\/\.-][0-9]{2,4}|\b19\d{2}\b|\b20\d{2}\b).*?[-–to]+.*?(?:Present|Current|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[0-9]{2}[\/\.-][0-9]{2,4}|\b19\d{2}\b|\b20\d{2}\b)/i;
  const match = text.match(dateRangeRegex);
  if (!match) return { start: "", end: "" };
  const parts = match[0].split(/[-–to]+/);
  return { start: parts[0]?.trim() || "", end: parts[1]?.trim() || "" };
}

function guessEducation(sections: Record<string, string[]>): EducationItem[] | null {
  const lines = sections.education || [];
  if (!lines.length) return null;

  // Chunk by date line — each education entry ends with a date line
  const edus: string[][] = [];
  let current: string[] = [];
  const dateTrigger = /\b(20\d{2}|19\d{2})\b/;

  lines.forEach((line) => {
    if (dateTrigger.test(line) && current.length > 0) {
      current.push(line);
      edus.push(current);
      current = [];
    } else {
      current.push(line);
    }
  });
  if (current.length) edus.push(current);

  return edus.map((eduLines) => {
    const fullText = eduLines.join(" ");
    const dates = extractDates(fullText);
    const degreeLine = eduLines.find((l) => /(b\.?tech|m\.?tech|bachelor|master|mba|bsc|msc|b\.?e\.?|m\.?e\.?|degree|diploma)/i.test(l)) || "";

    let degree = "";
    let field = "";

    if (degreeLine) {
      // Handle "Field | Degree (abbrev)" format common in Indian resumes
      const parts = degreeLine.split(/\s*[|]\s*/);
      if (parts.length >= 2) {
        const degreeIdx = parts.findIndex((p) => /(bachelor|master|b\.?tech|m\.?tech|mba|bsc|msc|b\.?e|degree|diploma)/i.test(p));
        if (degreeIdx >= 0) {
          degree = parts[degreeIdx].trim();
          field = parts.filter((_, i) => i !== degreeIdx).join(", ").trim();
        } else {
          degree = parts[0].trim();
          field = parts.slice(1).join(", ").trim();
        }
      } else {
        degree = degreeLine;
        field = eduLines.find((l) => /(computer|mechanical|electrical|electronics|commerce|science|arts|engineering|business)/i.test(l) && l !== degreeLine) || "";
      }
    }

    return {
      id: makeId(),
      institution: eduLines.find((l) => /(university|college|institute|academy|school)/i.test(l)) || eduLines[0] || "",
      degree,
      field,
      startDate: dates.start,
      endDate: dates.end || firstMatch(fullText, /\b(20\d{2}|19\d{2})\b/),
      location: guessLocation(fullText),
      score: eduLines.find((l) => /(cgpa|gpa|%|percentage)/i.test(l)) || "",
    };
  });
}

function guessExperience(sections: Record<string, string[]>): ExperienceItem[] | null {
  const lines = sections.experience || [];
  if (!lines.length) return null;

  const jobs: string[][] = [];
  let current: string[] = [];
  const dateTrigger = /\b(20\d{2}|19\d{2})\b/;

  lines.forEach((line) => {
    if (dateTrigger.test(line) && current.length > 2) {
      jobs.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  });
  if (current.length) jobs.push(current);

  return jobs.map((jobLines) => {
    const description = normalizeImportedText(jobLines);
    const dates = extractDates(jobLines.join(" "));

    // Skip date/location lines when finding role and company
    const nonMeta = jobLines.filter((l) => !looksLikeDateOrLocation(l));

    return {
      id: makeId(),
      role: nonMeta.find((l) => /(developer|engineer|analyst|designer|manager|intern|consultant|lead|architect|specialist|officer|executive|associate)/i.test(l)) || "",
      company: nonMeta.find((l) => /(pvt|ltd|limited|solutions|technologies|systems|inc|company|group|academy|electronics|consulting|services|global)/i.test(l)) || nonMeta[1] || nonMeta[0] || "",
      startDate: dates.start,
      endDate: dates.end,
      location: guessLocation(jobLines.join(" ")),
      description,
    };
  });
}

function normalizeImportedText(lines: string[]) {
  const rebuilt: string[] = [];

  for (const rawLine of lines) {
    for (const fragment of splitImportedLine(rawLine)) {
      const line = fragment.replace(/^[•\-*]\s*/, "").trim();
      if (!line) continue;
      const previous = rebuilt[rebuilt.length - 1];
      const shouldJoin = Boolean(previous && shouldMergeImportedLine(previous, line));

      if (shouldJoin) {
        rebuilt[rebuilt.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ").trim();
      } else {
        rebuilt.push(line);
      }
    }
  }

  return rebuilt.join("\n");
}

function splitImportedLine(line: string) {
  return line
    .replace(/\b(INDIA|REMOTE)\s+(?=[A-Z][A-Za-z &]+(?:Engineer|Manager|Analyst|Developer|Consultant|Intern)\b)/g, "$1\n")
    .replace(
      /\b(Technologies|Electronics|Academy|Solutions|Systems|Limited|Ltd)\s+(?=(Developed|Delivered|Analyzed|Built|Designed|Ensured|Implemented|Managed|Coordinated|Supported|Contributed)\b)/g,
      "$1\n",
    )
    .split("\n");
}

function shouldMergeImportedLine(previous: string, current: string) {
  if (looksLikeHeading(current) || looksLikeDateOrLocation(current)) return false;
  if (looksLikeRoleOrCompany(previous) && looksLikeRoleOrCompany(current)) return false;
  if (looksLikeRoleOrCompany(previous) && /^(Developed|Delivered|Analyzed|Built|Designed|Ensured|Implemented|Managed|Coordinated|Supported|Contributed)\b/.test(current)) return false;
  if (/[.!?:;)]$/.test(previous) && current.length > 18) return false;

  const previousWords = previous.split(/\s+/).length;
  const currentWords = current.split(/\s+/).length;
  const previousIsTiny = previous.length < 32 || previousWords <= 3;
  const currentIsTiny = current.length < 32 || currentWords <= 3;
  const currentLooksContinuation = /^[a-z0-9,(]/.test(current) || /^(and|or|with|using|to|for|from|while|ensuring|improving|through|by)\b/i.test(current);

  if (previousIsTiny && currentIsTiny) return true;
  if (previous.length < 150 && currentLooksContinuation) return true;
  if (previous.length < 90 && current.length < 80 && !looksLikeRoleOrCompany(current)) return true;

  return false;
}

function looksLikeHeading(line: string) {
  return line.length <= 40 && line === line.toUpperCase() && /[A-Z]/.test(line);
}

function looksLikeDateOrLocation(line: string) {
  return /\b(19|20)\d{2}\b/.test(line) || /\b(PRESENT|CURRENT|INDIA|BANGALORE|BENGALURU|REMOTE|MYSURU|NARSAPURA)\b/i.test(line);
}

function looksLikeRoleOrCompany(line: string) {
  return /(consultant|engineer|developer|analyst|manager|intern|lead|architect|technologies|solutions|systems|academy|electronics|pvt|ltd|limited)$/i.test(line.trim());
}

function guessProjects(sections: Record<string, string[]>): ProjectItem[] | null {
  const lines = sections.projects || [];
  if (!lines.length) return null;

  const projs: string[][] = [];
  let current: string[] = [];

  lines.forEach((line) => {
    if (line.length < 60 && !/(react|python|java|sql)/i.test(line) && current.length > 1 && !/^[•\-*]/.test(line)) {
      projs.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  });
  if (current.length) projs.push(current);

  return projs.map((projLines) => ({
    id: makeId(),
    name: projLines[0] || "Imported Project",
    link: firstMatch(projLines.join(" "), /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,]*)?/i),
    technologies: projLines.find((l) => /(react|node|python|java|sql|html|css|typescript|javascript|aws|azure|power bi|excel)/i.test(l)) || "",
    description: projLines.filter((l) => l.length > 20).slice(1).join("\n"),
    bullets: [],
  }));
}

function guessSkills(sections: Record<string, string[]>): SkillGroup[] | null {
  const groups: SkillGroup[] = [];

  function addGroup(title: string, lines: string[]) {
    const skills = lines.map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean).join(", ");
    if (skills) groups.push({ id: makeId(), title, skills });
  }

  // Separately bucketed skill sections (from two-column layouts)
  if (sections.technicalSkills?.length) addGroup("Technical Skills", sections.technicalSkills);
  if (sections.coreSkills?.length) addGroup("Core Skills", sections.coreSkills);

  // Generic skills bucket — look for "Category: items" inline pattern or just dump
  const generic = sections.skills || [];
  if (generic.length) {
    let curTitle = "Skills";
    let curLines: string[] = [];

    for (const line of generic) {
      const inline = line.match(/^(.{3,30}):\s+(.+)$/);
      if (inline) {
        if (curLines.length) { addGroup(curTitle, curLines); curLines = []; }
        groups.push({ id: makeId(), title: inline[1].trim(), skills: inline[2].trim() });
        curTitle = "Skills";
      } else {
        curLines.push(line);
      }
    }
    if (curLines.length) addGroup(curTitle, curLines);
  }

  return groups.length ? groups : null;
}

function guessCertifications(sections: Record<string, string[]>): CertificationItem[] | null {
  const lines = sections.certifications || [];
  if (!lines.length) return null;

  return lines.filter((l) => l.length > 5).map((line) => {
    // Handle "Name — Issuer | Year" format
    const dashParts = line.split(/\s*[—–-]\s*/);
    const name = dashParts[0].replace(/\b(20\d{2}|19\d{2})\b.*/, "").trim();
    const rest = dashParts.slice(1).join(" ");
    const year = firstMatch(line, /\b(20\d{2}|19\d{2})\b/);
    const issuerMatch = rest.match(/^([^|]+?)(?:\s*[|]\s*|\s+(?:20|19)\d{2}|$)/);
    return {
      id: makeId(),
      name,
      issuer: issuerMatch?.[1]?.trim() || "",
      year,
    };
  });
}

function guessLanguages(sections: Record<string, string[]>): LanguageItem[] | null {
  const lines = sections.languages || [];
  if (!lines.length) return null;

  const text = lines.join(", ");
  const langs = text.split(/[,|•]+/).map((l) => l.trim()).filter((l) => l.length > 2);

  return langs.map((l) => ({ id: makeId(), name: l, level: "" }));
}

function firstMatch(text: string, regex: RegExp) {
  return text.match(regex)?.[0] || "";
}

function cleanUrl(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}
