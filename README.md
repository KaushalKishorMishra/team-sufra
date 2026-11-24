# Team Sufra's quote agent

A worked example of taking an AI agent from a prototype to a system people can rely on, in five stages. It is built three ways, so that people who code and people who don't can follow the same stages.

Team Sufra, its users and every figure are fictional.

Huda runs a small home catering business in Dubai. A client sends an incomplete enquiry. The agent reads it, asks one question if a detail is missing, and drafts a quote from Huda's menu. Huda approves, edits or rejects it. Nothing reaches the client before she approves.

**The model reads; the code prices.** The model never sees a price. All three versions keep this rule.

## Start with the workflow

[WORKFLOW.md](WORKFLOW.md) describes the system once, without tools: the people, the steps, the data, the five stages and the five test cases. Every version follows it and uses the same step names, so you can put any two side by side.

## Teaching it

[guides/](guides) has a teaching path for facilitators and one step-by-step guide per version: [coded](guides/1-coded.md), [n8n](guides/2-n8n.md) and [Lovable](guides/3-lovable.md).

## The three versions

| Folder | Who it's for | What it is | Checked |
|---|---|---|---|
| [coded/](coded) | People who code | A Cloudflare program with a database, online as five stages at their own addresses | All five stages pass on a local server and on the built Pages folders, in mock mode. Online at team-sufra-stage-0.pages.dev to team-sufra-stage-4.pages.dev, with sample answers until a key is added. |
| [n8n/](n8n) | No-code, automation | Three n8n workflows to import: table setup, stage 0, and stages 1 to 3 in one canvas with notes | Run on a local n8n 2.48.8 with sample model answers: all five test cases pass three runs out of three. Screenshots in [n8n/SCREENSHOTS.md](n8n/SCREENSHOTS.md). |
| [lovable/](lovable) | No-code, app builder | Prompts to paste into Lovable, stage by stage, with a reference server function and a checklist | Being built in Lovable: stage 0 is half done. Progress and screenshots in [lovable/SCREENSHOTS.md](lovable/SCREENSHOTS.md). |

## The five stages

| Stage | Question | Coded | n8n | Lovable |
|---|---|---|---|---|
| 0. Prototype | What breaks when the prototype meets real use? | Yes | Yes | Yes |
| 1. Connect it | How do users reach it, and where does the person act? | Yes | Yes | Yes |
| 2. Real data | Where does the truth live, and what must it remember? | Yes | Yes | Yes |
| 3. Run it safely | Where does it run, why would a customer trust it, and what does it cost? | Yes | Partly: no cost page, no 30-day deletion | Yes |
| 4. Grow it | What changes with many users? | Yes | A note on the canvas only | Yes |

The no-code versions are simpler in a few places, each listed in its own README. The main one: their quotes say "about N working days", with no calendar, rush fee or dates.
