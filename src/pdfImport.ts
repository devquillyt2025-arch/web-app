import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { defaultSectionOrder } from "./data";
import type { EducationItem, ExperienceItem, ProjectItem, ResumeData, SkillGroup } from "./types";

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

function extractVisualLines(items: unknown[]) {
  const textItems = items
    .map((item) => {
      if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return null;
      const textItem = item as { str: string; transform: number[]; width?: number };
      const text = textItem.str.replace(/\s+/g, " ").trim();
      if (!text) return null;
      return {
        text,
        x: textItem.transform[4] ?? 0,
        y: textItem.transform[5] ?? 0,
        width: textItem.width ?? 0,
      };
    })
    .filter((item): item is { text: string; x: number; y: number; width: number } => Boolean(item))
    .sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
      return a.x - b.x;
    });

  const rows: Array<{ y: number; items: typeof textItems }> = [];

  for (const item of textItems) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .map((row) =>
      row.items
        .sort((a, b) => a.x - b.x)
        .reduce((line, item, index, sorted) => {
          if (index === 0) return item.text;
          const previous = sorted[index - 1];
          const gap = item.x - (previous.x + previous.width);
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

  const imported: ResumeData = {
    ...current,
    personal: {
      ...current.personal,
      fullName: name || current.personal.fullName,
      title: title || current.personal.title,
      email: email || current.personal.email,
      phone: phone || current.personal.phone,
      location: guessLocation(contactText) || current.personal.location,
      website: cleanUrl(website && website !== linkedin && website !== github ? website : current.personal.website),
      linkedin: cleanUrl(linkedin || current.personal.linkedin),
      github: cleanUrl(github || current.personal.github),
      summary: guessSummary(sectionMap) || current.personal.summary,
    },
    education: guessEducation(sectionMap) || current.education,
    experience: guessExperience(sectionMap) || current.experience,
    projects: guessProjects(sectionMap) || current.projects,
    skills: guessSkills(sectionMap) || current.skills,
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
    skills: ["skills", "technical skills", "core skills", "key skills"],
  };
  const sections: Record<string, string[]> = {};
  let active = "intro";

  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:|]/g, "").trim();
    const next = Object.entries(headings).find(([, names]) => names.includes(normalized));
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
  return lines.slice(index + 1, index + 4).find((line) => line.length <= 60 && !line.includes("@") && !/\d{6,}/.test(line)) || "";
}

function guessLocation(text: string) {
  const cities = ["Bengaluru", "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Noida", "Gurugram", "Gurgaon"];
  return cities.find((city) => new RegExp(`\\b${city}\\b`, "i").test(text)) || "";
}

function guessSummary(sections: Record<string, string[]>) {
  const summary = sections.summary || sections.intro || [];
  return summary.filter((line) => line.length > 30 && !line.includes("@")).slice(0, 3).join(" ");
}

function guessEducation(sections: Record<string, string[]>): EducationItem[] | null {
  const lines = sections.education || [];
  if (!lines.length) return null;
  return [
    {
      id: makeId(),
      institution: lines[0] || "",
      degree: lines.find((line) => /(b\.?tech|m\.?tech|bachelor|master|mba|bsc|msc|degree|diploma)/i.test(line)) || "",
      field: lines.find((line) => /(computer|mechanical|electrical|commerce|science|arts|engineering|business)/i.test(line)) || "",
      startDate: "",
      endDate: firstMatch(lines.join(" "), /\b(20\d{2}|19\d{2})\b/),
      location: "",
      score: lines.find((line) => /(cgpa|gpa|%|percentage)/i.test(line)) || "",
    },
  ];
}

function guessExperience(sections: Record<string, string[]>): ExperienceItem[] | null {
  const lines = sections.experience || [];
  if (!lines.length) return null;
  const description = normalizeImportedText(lines);
  return [
    {
      id: makeId(),
      company: lines.find((line) => /(pvt|ltd|limited|solutions|technologies|systems|inc|company)/i.test(line)) || "",
      role: lines.find((line) => /(developer|engineer|analyst|designer|manager|intern|consultant)/i.test(line)) || lines[0] || "",
      startDate: "",
      endDate: "",
      location: "",
      description,
    },
  ];
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
  return /\b(19|20)\d{2}\b/.test(line) || /\b(PRESENT|INDIA|BANGALORE|BENGALURU|REMOTE)\b/i.test(line);
}

function looksLikeRoleOrCompany(line: string) {
  return /(consultant|engineer|developer|analyst|manager|intern|lead|architect|technologies|solutions|systems|academy|electronics|pvt|ltd|limited)$/i.test(line.trim());
}

function guessProjects(sections: Record<string, string[]>): ProjectItem[] | null {
  const lines = sections.projects || [];
  if (!lines.length) return null;
  return [
    {
      id: makeId(),
      name: lines[0] || "Imported Project",
      link: firstMatch(lines.join(" "), /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,]*)?/i),
      technologies: lines.find((line) => /(react|node|python|java|sql|html|css|typescript|javascript|mongodb|excel)/i.test(line)) || "",
      bullets: lines.filter((line) => line.length > 25).slice(0, 4),
    },
  ];
}

function guessSkills(sections: Record<string, string[]>): SkillGroup[] | null {
  const lines = sections.skills || [];
  if (!lines.length) return null;
  return [
    {
      id: makeId(),
      title: "Skills",
      skills: lines.join(", ").replace(/[•|]/g, ",").replace(/,+/g, ",").trim(),
    },
  ];
}

function firstMatch(text: string, regex: RegExp) {
  return text.match(regex)?.[0] || "";
}

function cleanUrl(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}
