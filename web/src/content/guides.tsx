import Link from "next/link";
import type { ReactNode } from "react";

export interface Guide {
  slug: string;
  title: string;
  /** Shorter title for search results when the headline is over ~60 characters. */
  seoTitle?: string;
  description: string;
  keywords: string[];
  published: string;
  updated: string;
  readingMinutes: number;
  body: () => ReactNode;
}

export const guides: Guide[] = [
  {
    slug: "how-to-read-a-10-k-for-due-diligence",
    title: "How to Read a 10-K for Due Diligence: A Section-by-Section Checklist",
    seoTitle: "How to Read a 10-K for Due Diligence: A Checklist",
    description:
      "Where to look in an annual report, what each section tells you, and the questions to ask before you trust the numbers.",
    keywords: ["how to read a 10-K", "10-K due diligence", "annual report analysis", "SEC filings"],
    published: "2026-10-21",
    updated: "2026-10-21",
    readingMinutes: 8,
    body: () => (
      <>
        <p>
          A 10-K is the annual report that US public companies file with the SEC. It routinely runs
          to 100 to 300 pages, and most of what matters for diligence sits in five or six places.
          This checklist walks through the sections in the order an experienced analyst reads them,
          not the order they are printed.
        </p>

        <h2>1. Item 1: Business</h2>
        <p>
          Start here to understand how the company makes money before you look at a single number.
          Write down, in one sentence each, what it sells, who buys it, and why customers choose it
          over alternatives.
        </p>
        <ul>
          <li><strong>Segments:</strong> which segments exist and how management describes each one.</li>
          <li><strong>Customers:</strong> any customer above 10% of revenue must be disclosed. Note the names and percentages.</li>
          <li><strong>Competition:</strong> who the company names as competitors, and who it conspicuously does not.</li>
          <li><strong>Regulation:</strong> licences, approvals or rules the business depends on.</li>
          <li><strong>Seasonality and backlog:</strong> useful for judging whether a single quarter is representative.</li>
        </ul>

        <h2>2. Item 7: Management&apos;s Discussion and Analysis (MD&amp;A)</h2>
        <p>
          MD&amp;A is management&apos;s explanation of the results. Read it next to the income statement
          and check that each explanation actually accounts for the size of the change it
          describes. &quot;Revenue grew 18% due to pricing and volume&quot; tells you little; a good MD&amp;A
          quantifies each driver.
        </p>
        <ul>
          <li>Look for <strong>non-GAAP measures</strong> (adjusted EBITDA, organic growth) and read the reconciliation to the GAAP figure.</li>
          <li>Read the <strong>liquidity and capital resources</strong> discussion: cash, debt maturities, covenants and committed spending.</li>
          <li>Read <strong>critical accounting estimates</strong>. These are the judgements where small changes move earnings most.</li>
        </ul>

        <h2>3. Item 8: Financial Statements and Notes</h2>
        <p>
          The statements themselves are only a few pages. The notes are where the detail lives, and
          where most problems are found.
        </p>
        <ul>
          <li><strong>Revenue recognition note:</strong> when revenue is recognised, and how much is deferred or unbilled.</li>
          <li><strong>Debt note:</strong> maturity schedule, interest rates, covenants and any recent amendments.</li>
          <li><strong>Commitments and contingencies:</strong> leases, purchase obligations, guarantees and pending litigation.</li>
          <li><strong>Segment note:</strong> revenue and profit by segment, which often tells a different story from the consolidated totals.</li>
          <li><strong>Related-party transactions:</strong> dealings with executives, directors or major shareholders.</li>
          <li><strong>Subsequent events:</strong> anything material that happened after the year end.</li>
        </ul>
        <p>
          Also read the <strong>auditor&apos;s report</strong>. Note any critical audit matters, any
          change of auditor, and above all any going-concern paragraph.
        </p>

        <h2>4. Item 1A: Risk Factors</h2>
        <p>
          Risk factors are long and much of the language is boilerplate. The useful signal is in
          what is specific and what has changed. Compare this year&apos;s section with last year&apos;s and
          focus on new risks, risks that moved higher up the list, and risks that now include
          concrete numbers or names.
        </p>

        <h2>5. Item 3: Legal Proceedings and Item 9A: Controls</h2>
        <p>
          Item 3 lists material litigation. Item 9A reports on internal control over financial
          reporting; a disclosed <strong>material weakness</strong> means the company or its auditor
          found a reasonable possibility that a material misstatement would not be caught in time.
          Treat it as a reason to test the numbers harder.
        </p>

        <h2>6. Ownership, pay and governance</h2>
        <p>
          Items 10 to 14 usually point to the proxy statement (DEF 14A), which covers executive
          pay, board composition and major shareholders. Check how executive incentives are
          measured, since management tends to optimise for whatever the bonus plan rewards.
        </p>

        <h2>A one-page checklist</h2>
        <table>
          <thead>
            <tr><th>Question</th><th>Where to find it</th></tr>
          </thead>
          <tbody>
            <tr><td>How does the company make money?</td><td>Item 1, segment note</td></tr>
            <tr><td>Is growth real and repeatable?</td><td>MD&amp;A, revenue note, segment note</td></tr>
            <tr><td>Can it pay its debts?</td><td>Liquidity section, debt note, cash flow statement</td></tr>
            <tr><td>What could go badly wrong?</td><td>Risk factors (changes year on year), legal proceedings, contingencies</td></tr>
            <tr><td>Can the numbers be trusted?</td><td>Auditor&apos;s report, Item 9A, accounting policy changes</td></tr>
            <tr><td>Are incentives aligned?</td><td>Proxy statement, related-party note</td></tr>
          </tbody>
        </table>

        <h2>Doing this faster</h2>
        <p>
          The slow part of this process is finding and re-reading the right passages across several
          years of filings. Due Diligence Copilot indexes each filing with its page numbers and
          section headings, so you can ask a question like &quot;how has customer concentration changed
          over three years?&quot; and get an answer with links to each source page.{" "}
          <Link href="/how-it-works">See how it works</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "financial-statement-red-flags",
    title: "12 Financial Statement Red Flags Every Analyst Should Check",
    description:
      "Warning signs in revenue, cash flow, the balance sheet and disclosures, with what each one can indicate and how to test it.",
    keywords: ["financial statement red flags", "earnings quality", "accounting red flags", "financial due diligence checklist"],
    published: "2026-10-21",
    updated: "2026-10-21",
    readingMinutes: 7,
    body: () => (
      <>
        <p>
          A red flag is not proof of a problem. It is a pattern that has preceded problems often
          enough to deserve a closer look. Each item below includes how to test it, because the
          goal is to ask a sharper question, not to reach a verdict from one ratio.
        </p>

        <h2>Revenue and earnings</h2>
        <h3>1. Receivables growing faster than revenue</h3>
        <p>
          If accounts receivable rise much faster than sales, the company may be booking revenue it
          has not yet collected, extending payment terms to win deals, or struggling to collect.
          Track <strong>days sales outstanding</strong> (receivables ÷ revenue × 365) over several periods.
        </p>
        <h3>2. Net income consistently above operating cash flow</h3>
        <p>
          Over time, profits should turn into cash. A persistent gap where net income exceeds cash
          from operations suggests earnings depend on accruals and estimates. Compare the two over
          at least three years, not one.
        </p>
        <h3>3. Unexplained changes in revenue recognition</h3>
        <p>
          Read the revenue note every year. A change in when revenue is recognised, a new
          principal-versus-agent judgement, or a jump in contract assets can lift reported revenue
          without any change in the underlying business.
        </p>
        <h3>4. Growing reliance on non-GAAP adjustments</h3>
        <p>
          Adjusted metrics can be useful, but watch for adjustments that grow every year or recur
          every year under the label &quot;one-time&quot;. Restructuring that happens annually is an
          operating cost.
        </p>

        <h2>Cash flow</h2>
        <h3>5. Operating cash flow boosted by working capital</h3>
        <p>
          Stretching payables, cutting inventory or selling receivables (factoring) can raise
          operating cash flow for a period but cannot repeat indefinitely. Look at the working
          capital lines in the cash flow statement and the notes for any receivable sales or supplier
          finance programmes.
        </p>
        <h3>6. Capitalising costs that peers expense</h3>
        <p>
          Capitalised software, customer acquisition costs or interest move spending from the
          income statement to the balance sheet and from operating to investing cash flow. Compare
          the policy with close competitors.
        </p>

        <h2>Balance sheet</h2>
        <h3>7. Inventory building up</h3>
        <p>
          Rising <strong>days inventory outstanding</strong> can mean slowing demand or obsolete stock
          that will eventually be written down.
        </p>
        <h3>8. Goodwill that is large relative to equity</h3>
        <p>
          Acquisitive companies carry goodwill that is tested for impairment using management&apos;s own
          forecasts. If the acquired businesses are underperforming but no impairment is booked,
          ask what assumptions the test used.
        </p>
        <h3>9. Debt maturities bunched together, or tight covenants</h3>
        <p>
          The debt note shows when borrowings fall due. A large maturity in the next 12 to 24 months,
          especially alongside weak cash flow or an amended covenant, is a refinancing risk.
        </p>

        <h2>Disclosures and governance</h2>
        <h3>10. Auditor changes, qualified opinions or material weaknesses</h3>
        <p>
          A change of auditor, a going-concern paragraph, or a material weakness in internal
          controls each deserve an explanation. Read the 8-K that announced any auditor change.
        </p>
        <h3>11. Significant related-party transactions</h3>
        <p>
          Leases from the CEO, sales to companies owned by directors, or loans to executives can
          move value away from shareholders. They are disclosed in the notes and the proxy statement.
        </p>
        <h3>12. Customer or supplier concentration</h3>
        <p>
          Any customer above 10% of revenue must be disclosed. Dependence on a few customers or a
          single supplier is not an accounting issue, but it is one of the most common sources of
          sudden revenue loss.
        </p>

        <h2>Summary table</h2>
        <table>
          <thead>
            <tr><th>Signal</th><th>Test</th></tr>
          </thead>
          <tbody>
            <tr><td>Receivables outpacing revenue</td><td>DSO trend over 8 to 12 quarters</td></tr>
            <tr><td>Earnings above cash flow</td><td>Net income vs. operating cash flow, 3+ years</td></tr>
            <tr><td>Recurring &quot;one-time&quot; adjustments</td><td>List every non-GAAP add-back by year</td></tr>
            <tr><td>Working-capital-driven cash flow</td><td>Cash flow statement lines, factoring disclosures</td></tr>
            <tr><td>Inventory build-up</td><td>DIO trend, inventory reserves</td></tr>
            <tr><td>Refinancing risk</td><td>Debt maturity schedule, covenant terms</td></tr>
            <tr><td>Control or audit concerns</td><td>Auditor&apos;s report, Item 9A, 8-K Item 4.01</td></tr>
          </tbody>
        </table>

        <p>
          Many of these checks require reading the same note across several years of filings.
          Due Diligence Copilot can pull those passages side by side with page citations, so you
          spend your time judging the pattern rather than hunting for it. See also our guide on{" "}
          <Link href="/guides/how-to-read-a-10-k-for-due-diligence">how to read a 10-K</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "ai-for-due-diligence",
    title: "AI for Due Diligence: Where It Helps and Where Humans Must Verify",
    seoTitle: "AI for Due Diligence: Where It Helps, What to Verify",
    description:
      "A practical look at retrieval-augmented generation (RAG) for investment research: what it does well, its failure modes, and how to evaluate a tool.",
    keywords: ["AI due diligence", "RAG for finance", "AI investment research", "LLM due diligence"],
    published: "2026-10-21",
    updated: "2026-10-21",
    readingMinutes: 7,
    body: () => (
      <>
        <p>
          Large language models can read faster than any analyst, but they can also state wrong
          things fluently. Used well, AI shortens due diligence from weeks to days. Used carelessly,
          it puts unverified claims in front of an investment committee. This guide explains the
          approach that makes AI trustworthy enough for diligence work, and the checks that should
          stay with people.
        </p>

        <h2>Why a general chatbot is the wrong tool</h2>
        <p>
          A general-purpose chatbot answers from what it learned during training. That knowledge
          has a cut-off date, may be incomplete for smaller or private companies, and cannot be
          traced to a source. For diligence, an answer you cannot verify is not usable.
        </p>

        <h2>How retrieval-augmented generation works</h2>
        <p>
          Retrieval-augmented generation (RAG) grounds the model in your documents:
        </p>
        <ol>
          <li><strong>Ingest:</strong> each document is split into passages that keep their page number, section and table structure.</li>
          <li><strong>Index:</strong> passages are stored with both a keyword index and a semantic (vector) index.</li>
          <li><strong>Retrieve:</strong> for each question, the most relevant passages are found using both methods and re-ranked.</li>
          <li><strong>Generate:</strong> the model writes an answer using only those passages and cites the ones it relied on.</li>
        </ol>
        <p>
          The result is an answer you can check: every claim points to a page you can open.
        </p>

        <h2>Where AI helps most</h2>
        <ul>
          <li><strong>Finding things:</strong> &quot;Where does the company discuss customer churn?&quot; across hundreds of pages and several years.</li>
          <li><strong>Comparing periods:</strong> how a risk factor, accounting policy or segment description changed year to year.</li>
          <li><strong>First drafts:</strong> structured summaries, risk lists and question lists for management meetings.</li>
          <li><strong>Consistency checks:</strong> whether the deck&apos;s growth story matches what the filings say.</li>
        </ul>

        <h2>Failure modes to watch for</h2>
        <ul>
          <li><strong>Retrieval misses:</strong> if the right passage is never retrieved, the answer will be incomplete. Good systems say when evidence is thin.</li>
          <li><strong>Table errors:</strong> numbers separated from their row or column labels are easy to misread. Parsing tables as tables matters.</li>
          <li><strong>Wrong period or entity:</strong> a figure from the prior year or a subsidiary presented as current and consolidated.</li>
          <li><strong>Over-confident synthesis:</strong> combining two true statements into a conclusion neither supports.</li>
        </ul>

        <h2>What should stay with people</h2>
        <p>
          AI should prepare the evidence. People should make the judgements: whether a risk is
          material, whether management is credible, how much to pay, and whether to proceed.
          Verify every number that will appear in an investment memo against its cited source.
        </p>

        <h2>How to evaluate an AI diligence tool</h2>
        <table>
          <thead>
            <tr><th>Question</th><th>What good looks like</th></tr>
          </thead>
          <tbody>
            <tr><td>Are answers cited?</td><td>Every claim links to a specific page and passage</td></tr>
            <tr><td>Does it admit gaps?</td><td>Says &quot;not found in the documents&quot; rather than guessing</td></tr>
            <tr><td>How are tables handled?</td><td>Numbers keep their labels; spreadsheets and chart data are readable</td></tr>
            <tr><td>Is data isolated?</td><td>Workspace-level access enforced in the database, not just the UI</td></tr>
            <tr><td>Is accuracy measured?</td><td>The vendor tests answers against a labelled question set and can show results</td></tr>
          </tbody>
        </table>

        <p>
          Due Diligence Copilot is built around these principles. Read{" "}
          <Link href="/how-it-works">how it works</Link> or our notes on{" "}
          <Link href="/security">security and data isolation</Link>.
        </p>
      </>
    ),
  },
];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}
