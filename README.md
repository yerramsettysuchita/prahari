# Prahari

Autonomous civic accountability infrastructure for urban India.

Prahari turns a single citizen photo or voice note into a tracked, routed, and vision verified municipal case, then ranks government departments by how fast they actually fix things. It is built around one city, Bengaluru, and one painful problem, the potholes and road damage that get reported endlessly and resolved rarely.

## Live links

| What | Link |
| ---- | ---- |
| Live app (submitted) | https://prahari-civic.vercel.app |
| Live app on Google Cloud | https://prahari-eb12a.web.app |
| Repository | https://github.com/yerramsettysuchita/prahari |

## A short note to the reviewers

Thank you for taking the time to look at Prahari. Two honest points before you begin.

The link submitted during the hackathon window points to Vercel. Under the challenge timeline and a billing constraint on the cloud project, we deployed to Vercel first so the app was live and reachable. The project is also deployed on Google Cloud through Firebase Hosting at the second link above, which satisfies the Google Cloud requirement, and the backend ships with a Dockerfile and a Cloud Build config so it moves to Cloud Run the moment billing is enabled.

We also request your understanding on timing. The team was sitting final semester exams during the build window, so a few finishing touches landed a little later than we would have liked. Everything described below is built, deployed, and working. Only the demo video remains.

## The problem

The same pothole gets reported by forty people and ignored forty times. Reports pile up with no owner, no deadline, and no proof of resolution. Citizens lose trust, and there is no public record of which department acted and which one stalled. Most civic apps add to the noise. Prahari turns the noise into accountability.

## What Prahari does

A citizen submits a photo, a voice note, or both, with a location. From there a network of AI agents runs the case end to end.

It classifies the issue and severity, understanding a voice note spoken in Kannada, Hindi, or English. It cross checks the confidence and flags weak results for community confirmation. It checks nearby open cases and merges duplicates into one, counting every affected citizen instead of creating forty dead reports. It routes the case to the correct Bengaluru municipal department using a grounded knowledge base, and it tags every routing decision with its source so nothing is invented. It sets a service level deadline, drafts a formal grievance, and climbs an escalation ladder on its own when nothing is fixed, even generating a complete Right to Information request at the top rung. When a repair is claimed, Prahari does not trust a checkbox. It compares a before and after photo with vision and marks the case resolved only when the fix is actually visible. Every verified resolution feeds a public scoreboard that ranks wards and departments by real responsiveness, and a predictive layer flags wards heading toward higher civic risk.

## Why it is different

Prahari does not gamify the citizen. It gamifies the government.

Three ideas make it credible. Resolution is proven by vision, never by a manual toggle, so the resolved number means something. Routing is a grounded lookup with a visible source, never a hallucinated authority, so the system never invents an office or an official. And the scoreboard counts only vision verified resolutions, so nothing counts until the fix is seen. Honesty is the feature.

## Key features

The report flow accepts a photo, a multilingual voice note, or both. Gemini transcribes and translates the voice, and classification works from the image, the transcript, or both together.

A visible agent trace shows every agent acting on a report, step by step, so the multi agent work is inspectable rather than hidden. This is the depth made visible.

Deduplication merges nearby reports of the same issue and counts citizens affected, and the merged number is shown the moment it happens.

Grounded routing resolves the responsible BBMP department from a real knowledge base and shows a source verified provenance chip. When there is no confident match it says so honestly rather than naming a fake department.

Autonomous escalation sets a service level deadline, drafts grievances, and climbs a ladder of Filed, Reminder, Public, and RTI. A scheduled tick re-checks open cases and escalates them on its own with no human in the loop, and a real time trigger escalates immediately when enough citizens are affected. A complete Right to Information request can be generated on demand at the top rung.

The Government Silence Timer is a live clock on every unresolved case showing exactly how long the responsible department has stayed silent. It freezes and turns green when the case is resolved.

Community co-sign lets other citizens confirm they see an issue too, which raises citizens affected and, once enough agree, clears the low confidence flag and marks the case community confirmed.

Vision verified resolution compares a before and after photo and flips a case to resolved only on a confident, same location match, with the reasoning shown on screen.

The responsiveness scoreboard ranks wards and departments on vision verified resolutions, with headline metrics and a predictive civic risk read per ward.

## The agent network

Prahari is built as a graph of focused agents on the Google Agent Development Kit, with an orchestrator that branches on real conditions rather than running a fixed chain.

The intake agent classifies the issue, severity, and description. The verification agent cross checks classification confidence and flags weak results for community confirmation. The dedup agent finds nearby open cases and merges true duplicates. The routing agent resolves the responsible department from the grounded knowledge base and attaches provenance. The escalation agent owns the service level deadline, the drafted grievances, the RTI draft, and the autonomous and real time escalation paths. The resolution agent runs the before and after vision comparison that closes the loop. The insight agent aggregates open cases per ward to surface predictive civic risk.

## Architecture

| Layer | Technology |
| ----- | ---------- |
| Agent graph | Google Agent Development Kit |
| Model | Gemini for classification, voice, vision, drafting, and risk |
| API | FastAPI, containerized for Cloud Run |
| Data | Firebase Firestore for cases, Firebase Cloud Storage for images |
| Analytics | BigQuery for the scoreboard, with an in memory fallback |
| Frontend | Next.js, Tailwind, Framer Motion, Google Maps |
| Hosting | Firebase Hosting on Google Cloud, with Vercel as the submitted mirror |

## Google technologies used

Gemini, the Google Agent Development Kit, Firebase Firestore, Firebase Cloud Storage, BigQuery, the Google Maps JavaScript API, Firebase Hosting, and Google Cloud.

## How a case flows

A photo, a voice note, and a location arrive at the report endpoint. The voice is transcribed, the case is classified, verified, and checked against nearby reports, and it is either merged or created. A new case is routed to its department with provenance, given a deadline, and handed an initial drafted grievance, all shown as a live agent trace. If a merge or a co-sign pushes the affected count past the threshold, the case escalates to public on the spot. A scheduled tick escalates unresolved cases over time. Later, a before and after photo runs the vision check, and a confident match flips the case to verified resolved. Every state change updates the live map, the case list, and the responsiveness scoreboard.

## Running locally

The backend is a FastAPI app. From the backend folder, create a virtual environment on Python 3.12, install the requirements, set the environment values for the Firebase project and the Gemini key, then start the server on port 8080. A seed script populates ten open Bengaluru cases across all four issue types so the board looks alive.

The frontend is a Next.js app. From the frontend folder, install dependencies, provide the public values for the API base and the Google Maps key, then start the dev server. Open the local address and the landing page loads, with the command center and the scoreboard one click away.

## Demo dataset

The `prahari dataset` folder holds matched before and after images for all four issue types, potholes, road cracks, debris, and waterlogging, for use in the demo. Each pair is the same location with the issue present in the before image and cleared in the after image, so the vision verification confirms resolution cleanly.

## Repository structure

```
prahari/
  backend/
    agents/        one file per agent, plus the orchestration in main.py
    kb/            grounded department knowledge base for Bengaluru
    main.py        FastAPI app exposing the agent graph
    seed.py        demo data, clear_cases.py resets the board
    Dockerfile     Cloud Run container
  frontend/
    app/           landing, dashboard, and scoreboard routes
    components/    the command center, map, report panel, and more
    Dockerfile     Cloud Run container for the frontend
  prahari dataset/ before and after demo images
```

## Scope

One city and one vertical, by design. Bengaluru and road damage. Depth over breadth, so every part of the loop is real rather than a long list of shallow features.

## Built for Vibe2Ship

Prahari was built for the Vibe2Ship hackathon to show that civic technology can be honest, autonomous, and accountable at the same time.
