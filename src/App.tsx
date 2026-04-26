import { ChevronDown, ChevronUp, Download, Eye, FileText, GripVertical, List, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultSectionOrder, emptyResume, sectionLabels, templates } from "./data";
import { atsSectionOrder, cleanContact, generateHtml, generateMarkdown, optimizeResume } from "./resumeEngine";
import { clearSavedResume, loadResume, saveResume } from "./storage";
import type { CertificationItem, EducationItem, ExperienceItem, LanguageItem, ProjectItem, ResumeData, SectionKey, SkillGroup, TemplateDefinition } from "./types";

const makeId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const blankEducation = (): EducationItem => ({ id: makeId(), institution: "", degree: "", field: "", startDate: "", endDate: "", location: "", score: "" });
const blankExperience = (): ExperienceItem => ({ id: makeId(), company: "", role: "", startDate: "", endDate: "", location: "", description: "" });
const blankProject = (): ProjectItem => ({ id: makeId(), name: "", link: "", technologies: "", description: "", bullets: [] });
const blankSkill = (): SkillGroup => ({ id: makeId(), title: "Skills", skills: "" });
const blankCertification = (): CertificationItem => ({ id: makeId(), name: "", issuer: "", year: "" });
const blankLanguage = (): LanguageItem => ({ id: makeId(), name: "", level: "" });

export default function App() {
  const [resume, setResume] = useState<ResumeData>(() => loadResume());
  const [activeSection, setActiveSection] = useState<SectionKey>("summary");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState("Saved");
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionKey | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("Drop an existing resume PDF to prefill the form.");
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaveState("Saving...");
    const timer = window.setTimeout(() => {
      saveResume(resume);
      setSaveState("Saved");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [resume]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === resume.settings.templateId) ?? templates[0],
    [resume.settings.templateId],
  );
  const optimizedResume = useMemo(() => optimizeResume(resume), [resume]);

  const updateResume = (updater: (draft: ResumeData) => ResumeData) => setResume((current) => updater(current));
  const patchPersonal = (key: keyof ResumeData["personal"], value: string) => updateResume((r) => ({ ...r, personal: { ...r.personal, [key]: value } }));

  function switchTemplate(templateId: string) {
    updateResume((r) => ({ ...r, settings: { ...r.settings, templateId } }));
  }

  function moveSection(section: SectionKey, direction: -1 | 1) {
    updateResume((r) => {
      const order = [...r.settings.sectionOrder];
      const index = order.indexOf(section);
      const next = index + direction;
      if (next < 0 || next >= order.length) return r;
      [order[index], order[next]] = [order[next], order[index]];
      return { ...r, settings: { ...r.settings, sectionOrder: order } };
    });
  }

  function reorderSection(source: SectionKey, target: SectionKey) {
    if (source === target) return;
    updateResume((r) => {
      const order = [...r.settings.sectionOrder];
      const sourceIndex = order.indexOf(source);
      const targetIndex = order.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return r;
      const [moved] = order.splice(sourceIndex, 1);
      order.splice(targetIndex, 0, moved);
      return { ...r, settings: { ...r.settings, sectionOrder: order } };
    });
  }

  function startSectionDrag(event: React.DragEvent<HTMLDivElement>, section: SectionKey) {
    setDraggedSection(section);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", section);
  }

  function dropSection(event: React.DragEvent<HTMLDivElement>, target: SectionKey) {
    event.preventDefault();
    const source = (event.dataTransfer.getData("text/plain") || draggedSection) as SectionKey | null;
    if (source) reorderSection(source, target);
    setDraggedSection(null);
    setDragOverSection(null);
  }

  function resetResume() {
    clearSavedResume();
    setResume(emptyResume);
    setActiveSection("summary");
  }

  function printResume() {
    window.print();
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(generateMarkdown(resume));
    setSaveState("Markdown copied");
  }

  async function copyHtml() {
    await navigator.clipboard.writeText(generateHtml(resume));
    setSaveState("HTML copied");
  }

  async function importPdf(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setImportMessage("Please choose a PDF file.");
      return;
    }

    setIsImporting(true);
    setImportMessage("Reading PDF...");
    try {
      const { parsePdfResume } = await import("./pdfImport");
      const imported = await parsePdfResume(file, resume);
      setResume(optimizeResume(imported));
      setActiveSection("summary");
      setImportMessage("PDF imported and improved. Review the editable fields before downloading.");
    } catch {
      setImportMessage("Could not read this PDF. You can still fill the form manually.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <FileText size={22} />
          <div>
            <strong>Quick Resume</strong>
            <span>{saveState}</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost mobile-only" onClick={() => setMobileView(mobileView === "edit" ? "preview" : "edit")}>
            <Eye size={16} />
            {mobileView === "edit" ? "Preview" : "Edit"}
          </button>
          <button className="ghost" onClick={resetResume}>
            <RotateCcw size={16} />
            Reset
          </button>
          <button className="ghost" onClick={() => setResume(optimizeResume(resume))}>
            Improve
          </button>
          <button className="ghost" onClick={() => void copyMarkdown()}>
            Markdown
          </button>
          <button className="ghost" onClick={() => void copyHtml()}>
            HTML
          </button>
          <button className="primary" onClick={printResume}>
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </header>

      <main className="builder-grid">
        <section className={`preview-panel ${mobileView === "edit" ? "hide-mobile" : ""}`}>
          <div className="paper-stage">
            <div ref={printRef} className="print-area">
              <ResumeTemplate resume={optimizedResume} template={selectedTemplate} onSectionClick={setActiveSection} />
            </div>
          </div>
        </section>

        <aside className={`editor-panel ${mobileView === "preview" ? "hide-mobile" : ""}`}>
          <section
            className={`import-dropzone ${isImporting ? "loading" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) void importPdf(file);
            }}
          >
            <div>
              <Upload size={20} />
              <div>
                <strong>Import PDF</strong>
                <span>{importMessage}</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importPdf(file);
              }}
            />
            <button className="ghost" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
              {isImporting ? "Importing..." : "Choose PDF"}
            </button>
          </section>

          <TemplateSelector selectedId={resume.settings.templateId} onSelect={switchTemplate} />

          <section className="nav-block">
            <nav className="section-nav">
              {defaultSectionOrder.map((section) => (
                <button key={section} className={activeSection === section ? "active" : ""} onClick={() => setActiveSection(section)}>
                  {sectionLabels[section]}
                </button>
              ))}
            </nav>
          </section>

          <section className="form-card">
            {activeSection === "summary" && <PersonalForm resume={resume} patchPersonal={patchPersonal} />}
            {activeSection === "education" && (
              <RepeatableList
                title="Education"
                items={resume.education}
                addLabel="Add education"
                onAdd={() => updateResume((r) => ({ ...r, education: [...r.education, blankEducation()] }))}
                onRemove={(id) => updateResume((r) => ({ ...r, education: r.education.filter((x) => x.id !== id) }))}
                render={(item) => (
                  <EducationForm item={item} update={(patch) => updateResume((r) => ({ ...r, education: r.education.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }))} />
                )}
              />
            )}
            {activeSection === "experience" && (
              <RepeatableList
                title="Experience"
                items={resume.experience}
                addLabel="Add experience"
                onAdd={() => updateResume((r) => ({ ...r, experience: [...r.experience, blankExperience()] }))}
                onRemove={(id) => updateResume((r) => ({ ...r, experience: r.experience.filter((x) => x.id !== id) }))}
                render={(item) => (
                  <ExperienceForm
                    item={item}
                    update={(patch) => updateResume((r) => ({ ...r, experience: r.experience.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }))}
                  />
                )}
              />
            )}
            {activeSection === "projects" && (
              <RepeatableList
                title="Projects"
                items={resume.projects}
                addLabel="Add project"
                onAdd={() => updateResume((r) => ({ ...r, projects: [...r.projects, blankProject()] }))}
                onRemove={(id) => updateResume((r) => ({ ...r, projects: r.projects.filter((x) => x.id !== id) }))}
                render={(item) => (
                  <ProjectForm item={item} update={(patch) => updateResume((r) => ({ ...r, projects: r.projects.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }))} />
                )}
              />
            )}
            {activeSection === "skills" && (
              <RepeatableList
                title="Skills"
                items={resume.skills}
                addLabel="Add skill group"
                onAdd={() => updateResume((r) => ({ ...r, skills: [...r.skills, blankSkill()] }))}
                onRemove={(id) => updateResume((r) => ({ ...r, skills: r.skills.filter((x) => x.id !== id) }))}
                render={(item) => (
                  <SkillForm item={item} update={(patch) => updateResume((r) => ({ ...r, skills: r.skills.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }))} />
                )}
              />
            )}
            {activeSection === "certifications" && (
              <RepeatableList
                title="Certifications"
                items={resume.certifications}
                addLabel="Add certification"
                onAdd={() => updateResume((r) => ({ ...r, certifications: [...r.certifications, blankCertification()] }))}
                onRemove={(id) => updateResume((r) => ({ ...r, certifications: r.certifications.filter((x) => x.id !== id) }))}
                render={(item) => (
                  <CertificationForm
                    item={item}
                    update={(patch) => updateResume((r) => ({ ...r, certifications: r.certifications.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }))}
                  />
                )}
              />
            )}
            {activeSection === "languages" && (
              <RepeatableList
                title="Languages"
                items={resume.languages}
                addLabel="Add language"
                onAdd={() => updateResume((r) => ({ ...r, languages: [...r.languages, blankLanguage()] }))}
                onRemove={(id) => updateResume((r) => ({ ...r, languages: r.languages.filter((x) => x.id !== id) }))}
                render={(item) => (
                  <LanguageForm item={item} update={(patch) => updateResume((r) => ({ ...r, languages: r.languages.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }))} />
                )}
              />
            )}
          </section>

          <section className="form-card">
            <div className="section-title">
              <h2>Section Order</h2>
              <span>Drag to rearrange</span>
            </div>
            <div className="reorder-list">
              {resume.settings.sectionOrder.map((section, index) => (
                <div
                  className={`reorder-row ${draggedSection === section ? "dragging" : ""} ${dragOverSection === section && draggedSection !== section ? "drag-over" : ""}`}
                  draggable
                  key={section}
                  onDragStart={(event) => startSectionDrag(event, section)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverSection(section);
                  }}
                  onDragLeave={() => setDragOverSection(null)}
                  onDrop={(event) => dropSection(event, section)}
                  onDragEnd={() => {
                    setDraggedSection(null);
                    setDragOverSection(null);
                  }}
                >
                  <span className="drag-label">
                    <GripVertical size={16} />
                    {sectionLabels[section]}
                  </span>
                  <div>
                    <button aria-label={`Move ${sectionLabels[section]} up`} disabled={index === 0} onClick={() => moveSection(section, -1)}>
                      <ChevronUp size={16} />
                    </button>
                    <button aria-label={`Move ${sectionLabels[section]} down`} disabled={index === resume.settings.sectionOrder.length - 1} onClick={() => moveSection(section, 1)}>
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function TemplateSelector({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="template-strip">
      <div className="section-title">
        <h2>Template</h2>
        <span>Switch anytime</span>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <button key={template.id} className={selectedId === template.id ? "template-card selected" : "template-card"} onClick={() => onSelect(template.id)}>
            <span>{template.name}</span>
            <small>{template.category}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PersonalForm({ resume, patchPersonal }: { resume: ResumeData; patchPersonal: (key: keyof ResumeData["personal"], value: string) => void }) {
  return (
    <>
      <div className="section-title">
        <h2>Personal Details</h2>
        <span>Start here</span>
      </div>
      <div className="field-grid">
        <Field label="Full name" value={resume.personal.fullName} onChange={(v) => patchPersonal("fullName", v)} placeholder="Your name" />
        <Field label="Role / headline" value={resume.personal.title} onChange={(v) => patchPersonal("title", v)} placeholder="Frontend Developer" />
        <Field label="Email" value={resume.personal.email} onChange={(v) => patchPersonal("email", v)} placeholder="you@email.com" />
        <Field label="Phone" value={resume.personal.phone} onChange={(v) => patchPersonal("phone", v)} placeholder="+91..." />
        <Field label="Location" value={resume.personal.location} onChange={(v) => patchPersonal("location", v)} placeholder="City, India" />
        <Field label="Website" value={resume.personal.website} onChange={(v) => patchPersonal("website", v)} placeholder="portfolio.com" />
        <Field label="LinkedIn" value={resume.personal.linkedin} onChange={(v) => patchPersonal("linkedin", v)} placeholder="linkedin.com/in/..." />
        <Field label="GitHub" value={resume.personal.github} onChange={(v) => patchPersonal("github", v)} placeholder="github.com/..." />
      </div>
      <TextArea label="Summary" value={resume.personal.summary} onChange={(v) => patchPersonal("summary", v)} placeholder="2-3 lines about your strengths and goals." />
    </>
  );
}

function EducationForm({ item, update }: { item: EducationItem; update: (patch: Partial<EducationItem>) => void }) {
  return (
    <div className="field-grid">
      <Field label="Institution" value={item.institution} onChange={(v) => update({ institution: v })} />
      <Field label="Degree" value={item.degree} onChange={(v) => update({ degree: v })} />
      <Field label="Field" value={item.field} onChange={(v) => update({ field: v })} />
      <Field label="Score" value={item.score} onChange={(v) => update({ score: v })} />
      <MonthYearPicker label="Start" value={item.startDate} onChange={(v) => update({ startDate: v })} />
      <MonthYearPicker label="End" value={item.endDate} onChange={(v) => update({ endDate: v })} allowPresent />
      <Field label="Location" value={item.location} onChange={(v) => update({ location: v })} />
    </div>
  );
}

function ExperienceForm({ item, update }: { item: ExperienceItem; update: (patch: Partial<ExperienceItem>) => void }) {
  return (
    <>
      <div className="field-grid">
        <Field label="Role" value={item.role} onChange={(v) => update({ role: v })} />
        <Field label="Company" value={item.company} onChange={(v) => update({ company: v })} />
        <MonthYearPicker label="Start" value={item.startDate} onChange={(v) => update({ startDate: v })} />
        <MonthYearPicker label="End" value={item.endDate} onChange={(v) => update({ endDate: v })} allowPresent />
        <Field label="Location" value={item.location} onChange={(v) => update({ location: v })} />
      </div>
      <DescriptionWithBullets
        description={item.description ?? ""}
        bullets={item.bullets ?? []}
        onUpdate={(patch) => update({ description: patch.description ?? "", bullets: patch.bullets ?? [] })}
        placeholder="Paste your experience description here, then convert to bullets."
      />
    </>
  );
}

function ProjectForm({ item, update }: { item: ProjectItem; update: (patch: Partial<ProjectItem>) => void }) {
  return (
    <>
      <div className="field-grid">
        <Field label="Project name" value={item.name} onChange={(v) => update({ name: v })} />
        <Field label="Link" value={item.link} onChange={(v) => update({ link: v })} />
        <Field label="Technologies" value={item.technologies} onChange={(v) => update({ technologies: v })} />
      </div>
      <DescriptionWithBullets
        description={item.description ?? ""}
        bullets={item.bullets}
        onUpdate={(patch) => update({ description: patch.description ?? "", bullets: patch.bullets ?? [] })}
        placeholder="Describe the project and your contributions, then convert to bullets."
      />
    </>
  );
}

function SkillForm({ item, update }: { item: SkillGroup; update: (patch: Partial<SkillGroup>) => void }) {
  return (
    <div className="field-grid">
      <Field label="Group title" value={item.title} onChange={(v) => update({ title: v })} />
      <Field label="Skills" value={item.skills} onChange={(v) => update({ skills: v })} placeholder="React, SQL, Excel" />
    </div>
  );
}

function CertificationForm({ item, update }: { item: CertificationItem; update: (patch: Partial<CertificationItem>) => void }) {
  return (
    <div className="field-grid">
      <Field label="Name" value={item.name} onChange={(v) => update({ name: v })} />
      <Field label="Issuer" value={item.issuer} onChange={(v) => update({ issuer: v })} />
      <Field label="Year" value={item.year} onChange={(v) => update({ year: v })} />
    </div>
  );
}

function LanguageForm({ item, update }: { item: LanguageItem; update: (patch: Partial<LanguageItem>) => void }) {
  return (
    <div className="field-grid">
      <Field label="Language" value={item.name} onChange={(v) => update({ name: v })} />
      <Field label="Level" value={item.level} onChange={(v) => update({ level: v })} placeholder="Native, Fluent, Basic" />
    </div>
  );
}

function RepeatableList<T extends { id: string }>({
  title,
  items,
  addLabel,
  onAdd,
  onRemove,
  render,
}: {
  title: string;
  items: T[];
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <>
      <div className="section-title">
        <h2>{title}</h2>
        <button className="mini-primary" onClick={onAdd}>
          <Plus size={16} />
          {addLabel}
        </button>
      </div>
      {items.length === 0 ? <p className="muted">No entries yet. Add one when you need it.</p> : null}
      <div className="repeat-list">
        {items.map((item, index) => (
          <div className="repeat-item" key={item.id}>
            <div className="repeat-head">
              <strong>Entry {index + 1}</strong>
              <button className="icon-danger" aria-label="Remove entry" onClick={() => onRemove(item.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            {render(item)}
          </div>
        ))}
      </div>
    </>
  );
}

function BulletEditor({ bullets, onChange }: { bullets: string[]; onChange: (bullets: string[]) => void }) {
  return (
    <div className="bullet-editor">
      <label>Bullet points</label>
      {bullets.map((bullet, index) => (
        <div className="bullet-row" key={index}>
          <input value={bullet} onChange={(event) => onChange(bullets.map((b, i) => (i === index ? event.target.value : b)))} placeholder="Write a clear achievement" />
          <button aria-label="Remove bullet" onClick={() => onChange(bullets.filter((_, i) => i !== index))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button className="mini-button" onClick={() => onChange([...bullets, ""])}>
        <Plus size={16} />
        Add bullet
      </button>
    </div>
  );
}

function DescriptionWithBullets({
  description,
  bullets,
  onUpdate,
  placeholder = "Paste your description here, then convert to bullets.",
}: {
  description: string;
  bullets: string[];
  onUpdate: (patch: { description?: string; bullets?: string[] }) => void;
  placeholder?: string;
}) {
  const hasBullets = bullets.filter(Boolean).length > 0;
  const textValue = hasBullets
    ? bullets.map((b) => (b ? `• ${b}` : "")).join("\n")
    : description;

  function handleChange(v: string) {
    if (hasBullets) {
      onUpdate({ bullets: v.split("\n").map((line) => line.replace(/^•\s*/, "")), description: "" });
    } else {
      onUpdate({ description: v, bullets: [] });
    }
  }

  function convertToBullets() {
    const lines = textValue
      .split("\n")
      .map((line) => line.replace(/^\s*[•·\-*]\s*|\s*\d+[.)]\s*/g, "").trim())
      .filter(Boolean);
    if (lines.length) onUpdate({ bullets: lines, description: "" });
  }

  function revertToText() {
    onUpdate({ description: bullets.filter(Boolean).join("\n"), bullets: [] });
  }

  return (
    <div className="description-field">
      <label className="field wide">
        <span>Details</span>
        <textarea value={textValue} onChange={(e) => handleChange(e.target.value)} placeholder={placeholder} rows={5} />
      </label>
      <div className="description-actions">
        {hasBullets ? (
          <>
            <span className="converted-badge">
              <List size={12} />
              {bullets.filter(Boolean).length} {bullets.filter(Boolean).length === 1 ? "bullet" : "bullets"}
            </span>
            <button className="mini-button" onClick={revertToText}>Edit as text</button>
          </>
        ) : (
          <button className="mini-button" onClick={convertToBullets}>
            <List size={14} />
            Convert to bullets
          </button>
        )}
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => String(CURRENT_YEAR - i));

function parseMonthYear(value: string): { month: string; year: string } {
  if (!value || /^present$/i.test(value.trim())) return { month: "", year: "" };
  const monthMatch = value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  return {
    month: monthMatch ? monthMatch[0].slice(0, 1).toUpperCase() + monthMatch[0].slice(1, 3).toLowerCase() : "",
    year: yearMatch ? yearMatch[0] : "",
  };
}

function MonthYearPicker({
  label,
  value,
  onChange,
  allowPresent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowPresent?: boolean;
}) {
  const isPresent = /^present$/i.test(value.trim());
  const { month, year } = parseMonthYear(value);

  function emit(newMonth: string, newYear: string) {
    if (!newMonth && !newYear) onChange("");
    else onChange([newMonth, newYear].filter(Boolean).join(" "));
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="date-select-group">
        <select value={isPresent ? "" : month} disabled={isPresent} onChange={(e) => emit(e.target.value, year)}>
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={isPresent ? "" : year} disabled={isPresent} onChange={(e) => emit(month, e.target.value)}>
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {allowPresent && (
        <label className="present-checkbox">
          <input
            type="checkbox"
            checked={isPresent}
            onChange={(e) => onChange(e.target.checked ? "Present" : "")}
          />
          Present
        </label>
      )}
    </label>
  );
}

function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field wide">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} />
    </label>
  );
}

function ResumeTemplate({ resume, template, onSectionClick }: { resume: ResumeData; template: TemplateDefinition; onSectionClick: (section: SectionKey) => void }) {
  const compact = template.layout === "compact";
  const accent = resume.settings.accentColor;
  const contact = cleanContact(resume);

  const sections = atsSectionOrder.map((key) => <ResumeSection key={key} section={key} resume={resume} compact={compact} onClick={() => onSectionClick(key)} />);

  return (
    <article className={`resume-page ats-template ${compact ? "compact" : ""}`} style={{ "--accent": accent } as React.CSSProperties}>
      <header className="clickable-section" onClick={() => onSectionClick("summary")}>
        <h1>{resume.personal.fullName || "Your Name"}</h1>
        <div className="resume-contact">{contact.map((item) => <span key={item}>{item}</span>)}</div>
      </header>
      {sections}
    </article>
  );
}

function ResumeSection({ section, resume, compact, onClick }: { section: SectionKey; resume: ResumeData; compact: boolean; onClick: () => void }) {
  if (section === "summary" && resume.personal.summary) {
    return <ResumeBlock title="Summary" onClick={onClick}><p>{resume.personal.summary}</p></ResumeBlock>;
  }
  if (section === "education" && resume.education.length) {
    return (
      <ResumeBlock title="Education" onClick={onClick}>
        {resume.education.map((item) => (
          <ResumeItem
            key={item.id}
            title={[item.degree, item.field].filter(Boolean).join(", ") || item.institution}
            meta={[item.institution, item.endDate || item.startDate, item.score]}
          />
        ))}
      </ResumeBlock>
    );
  }
  if (section === "experience" && resume.experience.length) {
    return (
      <ResumeBlock title="Experience" onClick={onClick}>
        {resume.experience.map((item) => (
          <ResumeItem
            key={item.id}
            title={item.role}
            subtitle={item.company}
            meta={[item.location, dateRange(item.startDate, item.endDate)]}
            description={item.bullets?.filter(Boolean).length ? "" : (item.description ?? "")}
            bullets={item.bullets || []}
            compact={compact}
          />
        ))}
      </ResumeBlock>
    );
  }
  if (section === "projects" && resume.projects.length) {
    return (
      <ResumeBlock title="Projects" onClick={onClick}>
        {resume.projects.map((item) => (
          <ResumeItem
            key={item.id}
            title={item.name}
            subtitle={item.technologies}
            meta={[item.link ? "Project Link" : ""]}
            description={item.bullets.filter(Boolean).length ? "" : (item.description ?? "")}
            bullets={item.bullets}
            compact={compact}
          />
        ))}
      </ResumeBlock>
    );
  }
  if (section === "skills" && resume.skills.length) {
    return <ResumeBlock title="Skills" onClick={onClick}><div className="skill-lines">{resume.skills.map((group) => <p key={group.id}><strong>{group.title}:</strong> {group.skills}</p>)}</div></ResumeBlock>;
  }
  if (section === "certifications" && resume.certifications.length) {
    return <ResumeBlock title="Certifications" onClick={onClick}>{resume.certifications.map((item) => <ResumeItem key={item.id} title={item.name} meta={[item.issuer, item.year]} />)}</ResumeBlock>;
  }
  if (section === "languages" && resume.languages.length) {
    return <ResumeBlock title="Languages" onClick={onClick}><div className="skill-lines">{resume.languages.map((item) => <p key={item.id}><strong>{item.name}</strong>{item.level ? ` - ${item.level}` : ""}</p>)}</div></ResumeBlock>;
  }
  return null;
}

function ResumeBlock({ title, children, onClick }: { title: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <section className="resume-block clickable-section" onClick={onClick}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ResumeItem({
  title,
  subtitle,
  meta,
  description = "",
  bullets = [],
  compact = false,
}: {
  title: string;
  subtitle?: string;
  meta: string[];
  description?: string;
  bullets?: string[];
  compact?: boolean;
}) {
  const cleanMeta = meta.filter(Boolean);
  return (
    <div className="resume-item">
      <div className="item-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {cleanMeta.length ? <span>{cleanMeta.join(" | ")}</span> : null}
      </div>
      {description ? <p className="resume-description">{description}</p> : null}
      {bullets.filter(Boolean).length ? <ul>{bullets.filter(Boolean).slice(0, compact ? 3 : 5).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
    </div>
  );
}

function dateRange(start: string, end: string) {
  if (!start && !end) return "";
  if (start && !end) return start;
  return `${start} - ${end}`;
}