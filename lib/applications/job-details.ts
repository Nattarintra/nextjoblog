export const CHOICE_FIELDS = [
  {
    name: "work_format",
    label: "Work arrangement",
    options: [
      { value: "on_site", label: "On-site" },
      { value: "hybrid", label: "Hybrid" },
      { value: "remote", label: "Remote" },
    ],
  },
  {
    name: "contract_type",
    label: "Contract type",
    options: [
      { value: "permanent", label: "Permanent" },
      { value: "contract", label: "Fixed-term" },
      { value: "consultant", label: "Consultant" },
      { value: "internship", label: "Internship" },
    ],
  },
  {
    name: "discipline",
    label: "Track",
    options: [
      { value: "frontend", label: "Frontend" },
      { value: "fullstack", label: "Fullstack" },
      { value: "backend", label: "Backend" },
      { value: "tester_qa", label: "Tester/QA" },
    ],
  },
] as const;

export type ChoiceFieldName = (typeof CHOICE_FIELDS)[number]["name"];
export type WorkFormat = (typeof CHOICE_FIELDS)[0]["options"][number]["value"];
export type ContractType = (typeof CHOICE_FIELDS)[1]["options"][number]["value"];
export type Discipline = (typeof CHOICE_FIELDS)[2]["options"][number]["value"];

export function findChoiceLabel(field: ChoiceFieldName, value: string): string | undefined {
  return CHOICE_FIELDS.find((config) => config.name === field)?.options.find((option) => option.value === value)?.label;
}

export function isChoiceValue(field: ChoiceFieldName, value: string): boolean {
  return findChoiceLabel(field, value) !== undefined;
}

export function emptyJobDetails() {
  return {
    closing_date: "",
    salary_info: "",
    work_format: "",
    contract_type: "",
    discipline: "",
    tech_stack: [] as string[],
  };
}
