export type ReportKind = "risk" | "growth" | "summary";

export const REPORT_KINDS: Record<
  ReportKind,
  { label: string; description: string; queries: string[]; instructions: string }
> = {
  risk: {
    label: "Risk assessment",
    description: "Material risks with severity, evidence and open questions.",
    queries: [
      "risk factors that could materially affect the business",
      "customer concentration largest customers percentage of revenue",
      "debt maturities covenants liquidity refinancing",
      "litigation legal proceedings regulatory investigations contingencies",
      "going concern material weakness internal control auditor",
      "related party transactions",
      "supplier dependence supply chain single source",
      "competition pricing pressure market share loss",
      "changes in accounting policies estimates restatement impairment",
      "cybersecurity data privacy operational disruption",
    ],
    instructions: `Write a risk assessment for an investment committee.

Structure:
## Overall view
Two or three sentences on the overall risk profile.
## Key risks
For each material risk, a "### <Risk name> (High / Medium / Low)" heading, then: what the risk is, the evidence with figures, why it matters to value, and how it has changed over time where the sources show it.
Order risks from most to least severe. Base severity on likelihood and impact as evidenced by the sources, and say briefly why you rated it.
## Red flags to investigate
Bullets of specific accounting, governance or disclosure concerns worth checking further.
## Questions for management
Five to eight specific questions the sources raise but do not answer.`,
  },
  growth: {
    label: "Growth opportunities",
    description: "Where growth is coming from, and how durable it looks.",
    queries: [
      "revenue growth by segment geography product",
      "management outlook guidance growth strategy",
      "new products launches pipeline expansion",
      "market size addressable market industry growth trends",
      "pricing power margins expansion operating leverage",
      "recurring revenue retention customer growth backlog bookings",
      "acquisitions partnerships international expansion",
      "capital expenditure investment research and development",
    ],
    instructions: `Write a growth opportunities assessment for an investment committee.

Structure:
## Summary
Two or three sentences on where growth comes from and how durable it looks.
## Growth drivers
For each driver, a "### <Driver>" heading, then: the evidence with figures and periods, what management says, and what would need to be true for it to continue.
## Market context
What the sources say about market size and trends, with citations.
## Risks to the growth case
Bullets on what could slow growth, with citations.
## What to diligence next
Specific data to request or analysis to run.`,
  },
  summary: {
    label: "Executive summary",
    description: "A one-page brief: business, financials, risks and questions.",
    queries: [
      "business overview what the company does products customers",
      "revenue gross margin operating income net income results",
      "cash flow from operations free cash flow capital expenditure",
      "balance sheet cash debt liquidity",
      "key risks",
      "strategy outlook guidance",
      "segment performance",
      "ownership management governance",
    ],
    instructions: `Write a one-page executive summary for an investment committee.

Structure:
## Business
What the company does, how it makes money, and who its customers are.
## Financial snapshot
A compact markdown table of the key figures available in the sources (revenue, growth, margins, cash flow, net debt) with periods, followed by two or three sentences of interpretation.
## Investment considerations
Bullets: the strongest points in favour, then the main concerns.
## Key questions
Three to five questions to resolve before a decision.

Keep it to roughly one page.`,
  },
};
