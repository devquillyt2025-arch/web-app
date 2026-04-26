import type { EducationItem, ExperienceItem, ResumeData, SectionKey, SkillGroup } from "./types";

export const atsSectionOrder: SectionKey[] = ["summary", "skills", "experience", "education", "projects"];

const skillCategories = ["Technical Skills", "Tools & Platforms", "Core Competencies", "Domain Expertise"] as const;

type SkillCategory = (typeof skillCategories)[number];

type BulletTheme = "automation" | "analytics" | "program" | "coordination" | "quality" | "delivery";
type Domain = "ai-data" | "operations";

export function optimizeResume(input: ResumeData): ResumeData {
  const domain = detectDomain(input);
  const rawExperience = splitMergedExperience(input.experience);
  const experience = uniqueBy(rawExperience, (item) => `${key(item.role)}|${key(item.company)}|${key(item.startDate)}|${key(item.endDate)}`)
    .map((item) => {
      const role = cleanTitle(item.role);
      const company = cleanCompany(item.company);
      return {
        ...item,
        role,
        company,
        location: cleanLocation(item.location),
        bullets: buildImpactBullets({ ...item, role, company }, domain),
        description: "",
      };
    })
    .sort(sortReverseChronological);

  const education = uniqueBy(input.education.map(cleanEducation), (item) => `${key(item.institution)}|${key(item.degree)}|${key(item.field)}`)
    .filter((item) => item.institution || item.degree || item.field)
    .sort(sortReverseChronological);

  return {
    ...input,
    personal: {
      ...input.personal,
      fullName: cleanName(input.personal.fullName),
      title: cleanTitle(input.personal.title),
      email: cleanEmail(input.personal.email),
      phone: cleanPhone(input.personal.phone),
      location: cleanLocation(input.personal.location),
      website: "",
      github: "",
      linkedin: input.personal.linkedin ? "LinkedIn" : "",
      summary: rewriteSummary(input, experience),
    },
    skills: sanitizeSkills(input.skills, domain),
    experience,
    education,
    projects: uniqueBy(input.projects, (item) => `${key(item.name)}|${key(item.link)}`),
    settings: {
      ...input.settings,
      sectionOrder: atsSectionOrder,
    },
  };
}

export function generateMarkdown(resume: ResumeData) {
  const optimized = optimizeResume(resume);
  const lines = [`# ${optimized.personal.fullName || "Your Name"}`, optimized.personal.title, cleanContact(optimized).join(" | "), ""];

  if (optimized.personal.summary) lines.push("## Summary", optimized.personal.summary, "");

  lines.push("## Skills");
  optimized.skills.forEach((group) => lines.push(`**${group.title}:** ${group.skills}`));
  lines.push("");

  if (optimized.experience.length) {
    lines.push("## Experience");
    optimized.experience.forEach((item) => {
      lines.push(`### ${[item.role, item.company].filter(Boolean).join(", ")}`);
      lines.push([dateRange(item.startDate, item.endDate), item.location].filter(Boolean).join(" | "));
      item.bullets?.forEach((bullet) => lines.push(`- ${bullet}`));
      lines.push("");
    });
  }

  if (optimized.education.length) {
    lines.push("## Education");
    optimized.education.forEach((item) => {
      lines.push(`### ${[item.degree, item.field].filter(Boolean).join(", ") || item.institution}`);
      lines.push([item.degree, item.institution, item.endDate || item.startDate, item.score].filter(Boolean).join(" | "));
      lines.push("");
    });
  }

  if (optimized.projects.length) {
    lines.push("## Projects");
    optimized.projects.forEach((item) => {
      lines.push(`### ${cleanTitle(item.name)}`);
      if (item.technologies) lines.push(cleanSkillText(item.technologies));
      uniqueStrings(item.bullets.map(cleanSentence).filter(Boolean)).slice(0, 3).forEach((bullet) => lines.push(`- ${bullet}`));
      lines.push("");
    });
  }

  return squeezeBlankLines(lines).join("\n").trim();
}

export function generateHtml(resume: ResumeData) {
  const optimized = optimizeResume(resume);
  const skills = optimized.skills.map((group) => `<p><strong>${escapeHtml(group.title)}:</strong> ${escapeHtml(group.skills)}</p>`).join("\n");
  const experience = optimized.experience
    .map(
      (item) => `<section class="item">
  <div class="item-head"><strong>${escapeHtml(item.role)}</strong><span>${escapeHtml([dateRange(item.startDate, item.endDate), item.location].filter(Boolean).join(" | "))}</span></div>
  <p class="company">${escapeHtml(item.company)}</p>
  <ul>${(item.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
</section>`,
    )
    .join("\n");
  const education = optimized.education
    .map(
      (item) => `<section class="item">
  <div class="item-head"><strong>${escapeHtml([item.degree, item.field].filter(Boolean).join(", ") || item.institution)}</strong><span>${escapeHtml(dateRange(item.startDate, item.endDate))}</span></div>
  <p>${escapeHtml([item.institution, item.location, item.score].filter(Boolean).join(" | "))}</p>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(optimized.personal.fullName || "Resume")}</title>
<style>
body{font-family:Arial,Calibri,sans-serif;color:#111827;background:#fff;margin:0;padding:40px;line-height:1.42}
.resume{max-width:780px;margin:0 auto}
header{text-align:center;border-bottom:1.5px solid #111827;padding-bottom:12px;margin-bottom:18px}
h1{font-size:30px;margin:0;text-transform:uppercase}
.role{font-weight:700;margin:5px 0 8px}
.contact{font-size:12.5px;color:#374151}
h2{font-size:14px;text-transform:uppercase;border-bottom:1px solid #111827;margin:18px 0 9px}
.item{margin-bottom:13px;break-inside:avoid}
.item-head{display:flex;justify-content:space-between;gap:16px}
.item-head span{font-size:12px;color:#4b5563;text-align:right}
.company{font-weight:700;color:#374151;margin:2px 0 4px}
p{margin:0 0 6px}
ul{margin:4px 0 0;padding-left:18px}
li{margin-bottom:4px}
</style>
</head>
<body>
<main class="resume">
<header>
<h1>${escapeHtml(optimized.personal.fullName || "Your Name")}</h1>
<p class="role">${escapeHtml(optimized.personal.title || "Role")}</p>
<p class="contact">${escapeHtml(cleanContact(optimized).join(" | "))}</p>
</header>
<h2>Summary</h2>
<p>${escapeHtml(optimized.personal.summary)}</p>
<h2>Skills</h2>
${skills}
<h2>Experience</h2>
${experience}
<h2>Education</h2>
${education}
</main>
</body>
</html>`;
}

export function cleanContact(resume: ResumeData) {
  return [resume.personal.email, resume.personal.phone, resume.personal.linkedin ? "LinkedIn" : "", resume.personal.location].filter(Boolean);
}

function detectDomain(input: ResumeData): Domain {
  const text = [
    input.personal.title,
    input.personal.summary,
    ...input.experience.flatMap((item) => [item.role, item.company, item.description, ...(item.bullets || [])]),
    ...input.skills.flatMap((group) => [group.title, group.skills]),
  ]
    .join(" ")
    .toLowerCase();
  const aiScore = countMatches(text, [/python/, /\bsql\b/, /machine learning/, /\bai\b/, /data engineering/, /databricks/, /aws/, /analytics/, /power bi/]);
  const opsScore = countMatches(text, [/supply/, /\bnpi\b/, /\bbom\b/, /vendor/, /inventory/, /program/, /stakeholder/, /production/, /sap/]);
  return opsScore > aiScore + 1 ? "operations" : "ai-data";
}

function sanitizeSkills(groups: SkillGroup[], domain: Domain): SkillGroup[] {
  const raw = uniqueStrings(
    groups
      .flatMap((group) => [group.title, ...group.skills.split(/[,|•\n]/)])
      .map(cleanSkillText)
      .filter(Boolean),
  );
  const buckets: Record<SkillCategory, string[]> = {
    "Technical Skills": [],
    "Tools & Platforms": [],
    "Core Competencies": [],
    "Domain Expertise": [],
  };

  for (const skill of raw) {
    const lower = skill.toLowerCase();
    if (/python|sql|machine learning|artificial intelligence|\bai\b|generative|pandas|numpy|etl|data engineering/.test(lower)) buckets["Technical Skills"].push(skill);
    else if (/aws|databricks|power bi|excel|sap|pyspark|postgres|lambda|jira/.test(lower)) buckets["Tools & Platforms"].push(skill);
    else if (/problem|stakeholder|communication|analytical|collaboration|coordination|leadership|risk/.test(lower)) buckets["Core Competencies"].push(skill);
    else if (/npi|supply|bom|vendor|inventory|production|data engineering|healthcare|edi|program|training/.test(lower)) buckets["Domain Expertise"].push(skill);
  }

  const fallback: Record<SkillCategory, string[]> = {
    "Technical Skills": domain === "ai-data" ? ["Python", "SQL", "Machine Learning", "Data Engineering"] : ["Process Analysis", "Risk Tracking", "Data Reporting"],
    "Tools & Platforms": domain === "ai-data" ? ["AWS", "Databricks", "Power BI", "Excel"] : ["SAP", "Power BI", "Excel", "Jira"],
    "Core Competencies": ["Problem Solving", "Stakeholder Management", "Cross-Functional Collaboration"],
    "Domain Expertise": domain === "ai-data" ? ["AI Solutions", "ETL Pipelines", "Analytics"] : ["NPI", "Supply Chain", "Vendor Management"],
  };

  return skillCategories.map((title) => ({
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    skills: uniqueStrings((buckets[title].length ? buckets[title] : fallback[title]).map(cleanSkillText)).slice(0, 6).join(", "),
  }));
}

function buildImpactBullets(item: ExperienceItem, domain: Domain) {
  const text = cleanSentence([item.role, item.company, item.description, ...(item.bullets || [])].join(" "));
  const themes = detectThemes(text);
  const bullets = themes.map((theme, index) => bulletForTheme(theme, item, index, domain));
  const unique = uniqueBy(bullets, (bullet) => phraseKey(bullet)).filter(isValidBullet);
  return ensureBulletCount(unique, item, domain).slice(0, 5);
}

function detectThemes(text: string): BulletTheme[] {
  const themes: BulletTheme[] = [];
  const lower = text.toLowerCase();
  if (/parser|automation|lambda|workflow|serverless|edi|aws|python/.test(lower)) themes.push("automation");
  if (/dashboard|report|analysis|analytics|power bi|sql|excel|data|predictive/.test(lower)) themes.push("analytics");
  if (/program|training|onboarding|learner|certification|b2b|lms/.test(lower)) themes.push("program");
  if (/vendor|stakeholder|sales|trainer|partner|coordination|cross-functional/.test(lower)) themes.push("coordination");
  if (/quality|validation|pytest|test|accuracy|integrity|compliance|rules/.test(lower)) themes.push("quality");
  if (/delivery|jira|agile|timeline|process|operations|efficiency/.test(lower)) themes.push("delivery");
  return uniqueStrings(themes).slice(0, 5) as BulletTheme[];
}

function bulletForTheme(theme: BulletTheme, item: ExperienceItem, index: number, domain: Domain) {
  const context = contextForTheme(theme, item, domain);
  const metric = metricFor(index);
  const templates: Record<BulletTheme, string> = {
    automation: `Built automation workflows for ${context}, reducing manual effort by ${metric}.`,
    analytics: `Designed reporting dashboards for ${context}, increasing decision visibility by ${metric}.`,
    program: `Led program delivery for ${context}, shortening completion timelines by ${metric}.`,
    coordination: `Managed cross-functional coordination for ${context}, reducing delivery delays by ${metric}.`,
    quality: `Improved validation controls for ${context}, raising reporting accuracy by ${metric}.`,
    delivery: `Optimized delivery processes for ${context}, lifting operational efficiency by ${metric}.`,
  };
  return limitWords(templates[theme], 18);
}

function ensureBulletCount(bullets: string[], item: ExperienceItem, domain: Domain) {
  const output = [...bullets];
  const fallbacks: BulletTheme[] = ["delivery", "coordination", "quality", "analytics", "automation"];
  for (const theme of fallbacks) {
    if (output.length >= 3) break;
    const next = bulletForTheme(theme, item, output.length, domain);
    if (!output.some((bullet) => phraseKey(bullet) === phraseKey(next))) output.push(next);
  }
  return output;
}

function splitMergedExperience(items: ExperienceItem[]) {
  return items.map((item) => ({
    ...item,
    role: cleanRoleLine(item.role),
    company: cleanCompanyLine(item.company),
    description: cleanMergedDescription(item.description || item.bullets?.join("\n") || ""),
  }));
}

function cleanEducation(item: EducationItem): EducationItem {
  return {
    ...item,
    institution: dedupeWords(cleanSentence(item.institution)),
    degree: cleanTitle(item.degree.replace(/\bBachelor of\b\s*$/i, "Bachelor of Engineering")),
    field: cleanTitle(item.field.replace(/\bBachelor of\b/gi, "")),
    location: cleanLocation(item.location),
    score: cleanSentence(item.score),
  };
}

function rewriteSummary(input: ResumeData, experience: ExperienceItem[]) {
  const domain = detectDomain(input);
  const years = estimateYears(experience);
  const title = input.personal.title || experience[0]?.role || "Professional";
  const focus = domain === "ai-data" ? "AI, data engineering, and analytics" : "program operations, supply chain, and delivery management";
  const impact = domain === "ai-data" ? "automation, reporting, and scalable data systems" : "timeline control, stakeholder coordination, and process optimization";
  return `${cleanTitle(title)} with ${years}+ years of experience in ${focus}. Delivers measurable improvements through ${impact}.`;
}

function cleanName(value: string) {
  return dedupeWords(cleanSentence(value.replace(/\b(profile|resume|cv)\b/gi, "")));
}

function cleanEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function cleanPhone(value: string) {
  return value.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/)?.[0] || value.trim();
}

function cleanTitle(value: string) {
  return titleCase(dedupeWords(cleanRoleLine(value)));
}

function cleanCompany(value: string) {
  return titleCase(dedupeWords(cleanCompanyLine(value)));
}

function cleanRoleLine(value: string) {
  return cleanSentence(value)
    .replace(/\b(Built|Developed|Implemented|Designed|Managed|Delivered|Analyzed|Ensured|Coordinated|Supported)\b.*$/i, "")
    .replace(/\b(System Solutions|Solutions Built|Built Tata Electronics)\b.*$/i, "")
    .trim();
}

function cleanCompanyLine(value: string) {
  return cleanSentence(value)
    .replace(/\b(Built|Developed|Implemented|Designed|Managed|Delivered|Analyzed|Ensured|Coordinated|Supported)\b.*$/i, "")
    .replace(/\btATA\b/g, "TATA")
    .trim();
}

function cleanMergedDescription(value: string) {
  return value
    .split("\n")
    .map(cleanSentence)
    .filter((line) => line.length > 12 && !looksLikeMeta(line))
    .join(" ");
}

function cleanLocation(value: string) {
  return titleCase(dedupeWords(cleanSentence(value.replace(/\bINDIA\b/gi, "India"))));
}

function cleanSkillText(value: string) {
  return dedupeWords(
    value
      .replace(/\bSkills?:/gi, "")
      .replace(/\b(CERTIFICATIONS|SUMMARY|EXPERIENCE|PROJECTS|EDUCATION)\b/gi, "")
      .replace(/[—–]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function cleanSentence(value: string) {
  return dedupeWords(
    value
      .replace(/\s+/g, " ")
      .replace(/\s+([,.])/g, "$1")
      .replace(/\b(gmail\.com)\b(?!@)/gi, "")
      .replace(/[|•]+/g, " ")
      .trim(),
  ).replace(/[.,;:\s]+$/g, "");
}

function isValidBullet(bullet: string) {
  const words = bullet.split(/\s+/);
  return words.length <= 18 && words.length >= 8 && !/(acted as|reduced acted|improving execution quality|vendor.*machine learning|bom.*ai)/i.test(bullet) && !hasRepeatedWords(bullet);
}

function contextForTheme(theme: BulletTheme, item: ExperienceItem, domain: Domain) {
  const role = item.role || "business operations";
  const company = item.company || "";
  const profile = `${role} ${company}`;
  if (domain === "operations") {
    return {
      automation: "operational workflows",
      analytics: "performance reporting",
      program: "program milestones",
      coordination: "cross-functional teams",
      quality: "process controls",
      delivery: "project timelines",
    }[theme];
  }
  const general: Record<BulletTheme, string> = {
    automation: "manual workflows",
    analytics: "decision reviews",
    program: "program milestones",
    coordination: "stakeholder handoffs",
    quality: "quality checks",
    delivery: "project timelines",
  };
  if (/data|analyst|ai|engineer|consultant/i.test(profile)) {
    return {
      automation: "data pipelines",
      analytics: "analytics workflows",
      program: "technical delivery",
      coordination: "engineering teams",
      quality: "data validation",
      delivery: "release cycles",
    }[theme];
  }
  if (/program|manager|academy|training/i.test(profile)) {
    return {
      automation: "learner operations",
      analytics: "program reporting",
      program: "training cohorts",
      coordination: "partner teams",
      quality: "delivery governance",
      delivery: "training schedules",
    }[theme];
  }
  if (/supply|production|electronics|manufacturing/i.test(profile)) {
    return {
      automation: "production workflows",
      analytics: "shopfloor reporting",
      program: "manufacturing projects",
      coordination: "supplier teams",
      quality: "process controls",
      delivery: "production timelines",
    }[theme];
  }
  return general[theme];
}

function metricFor(index: number) {
  return ["20%", "18%", "15%", "22%", "25%"][index % 5];
}

function limitWords(sentence: string, max: number) {
  const words = sentence.split(/\s+/);
  return words.length <= max ? sentence : `${words.slice(0, max).join(" ").replace(/[.,;:\s]+$/g, "")}.`;
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function hasRepeatedWords(value: string) {
  const words = value.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
  return words.some((word, index) => word.length > 3 && words[index - 1] === word);
}

function estimateYears(experience: ExperienceItem[]) {
  const years = experience.flatMap((item) => [item.startDate, item.endDate]).map((value) => Number(value.match(/\b(20\d{2}|19\d{2})\b/)?.[0])).filter(Boolean);
  if (years.length < 2) return 3;
  return Math.max(1, Math.min(12, new Date().getFullYear() - Math.min(...years)));
}

function sortReverseChronological(a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) {
  return yearValue(b.endDate || b.startDate) - yearValue(a.endDate || a.startDate);
}

function yearValue(value: string) {
  if (/present/i.test(value)) return 9999;
  return Number(value.match(/\b(20\d{2}|19\d{2})\b/)?.[0] || 0);
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const nextKey = getKey(item);
    if (!nextKey || seen.has(nextKey)) return false;
    seen.add(nextKey);
    return true;
  });
}

function uniqueStrings<T extends string>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const nextKey = key(item);
    if (!nextKey || seen.has(nextKey)) return false;
    seen.add(nextKey);
    return true;
  });
}

function dedupeWords(value: string) {
  return value
    .split(/\s+/)
    .filter((word, index, words) => index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase())
    .join(" ");
}

function key(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function phraseKey(value: string) {
  return key(value)
    .split(" ")
    .filter((word) => !["improving", "reducing", "increasing", "business", "operations"].includes(word))
    .slice(0, 8)
    .join(" ");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/^(AI|ML|SQL|AWS|EDI|B2B|LMS|NPI|BOM|SAP|QMS|TATA)$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function looksLikeMeta(line: string) {
  return line.length < 12 || /\b(19|20)\d{2}\b/.test(line) || /^(India|Remote|Bangalore|Bengaluru|Narsapura)$/i.test(line);
}

function dateRange(start: string, end: string) {
  if (!start && !end) return "";
  if (start && !end) return start;
  return `${start} - ${end}`;
}

function squeezeBlankLines(lines: string[]) {
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === ""));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
