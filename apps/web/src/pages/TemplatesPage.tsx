import { useState } from "react";
import { Button, Card, PageHeader } from "@axa-sign/ui";
import {
  Plus,
  Search,
  FileText,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  category: "Legal" | "HR" | "Sales" | "Procurement";
  description: string;
  fieldsCount: number;
}

const SAMPLE_TEMPLATES: TemplateItem[] = [
  {
    id: "t-1",
    name: "Non-Disclosure Agreement (Mutual NDA)",
    category: "Legal",
    description: "Standard bilateral confidentiality agreement for commercial partnerships.",
    fieldsCount: 4,
  },
  {
    id: "t-2",
    name: "Independent Contractor Agreement",
    category: "HR",
    description: "Contractor agreement including scope of work, IP assignment, and fee schedule.",
    fieldsCount: 6,
  },
  {
    id: "t-3",
    name: "Enterprise Software License Agreement",
    category: "Sales",
    description: "B2B SaaS licensing agreement with SLA, payment terms, and confidentiality terms.",
    fieldsCount: 8,
  },
  {
    id: "t-4",
    name: "Full-Time Employment Offer Letter",
    category: "HR",
    description: "Standard executive and engineering hiring offer letter with benefits schedule.",
    fieldsCount: 5,
  },
];

export function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [search, setSearch] = useState("");

  const categories = ["All", "Legal", "HR", "Sales", "Procurement"];

  const filtered = SAMPLE_TEMPLATES.filter((t) => {
    const matchesCat = selectedCategory === "All" || t.category === selectedCategory;
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Agreement Templates"
        description="Standardized reusable contract templates to accelerate signing workflows."
        action={
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            disabled
            title="Custom template designer coming in next release"
          >
            Create Template
          </Button>
        }
      />

      {/* Feature Announcement Banner */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-blue-50/40 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Template Builder Engine
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Reusable merge tags, dynamic fields, and multi-signer workflows are being finalized for your workspace.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
            Preview Access
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedCategory === c
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <Card key={item.id} padding="md" className="hover:border-slate-300 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  {item.category}
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <FileText size={12} /> {item.fieldsCount} signature fields
                </span>
              </div>
              <h3 className="font-semibold text-sm text-slate-900 group-hover:text-brand-600 transition-colors">
                {item.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {item.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock size={12} /> eIDAS Compliant
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                onClick={() => alert(`Starting new contract with "${item.name}" template.`)}
              >
                Use Template <ArrowRight size={13} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
