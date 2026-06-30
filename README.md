# Prahari

Autonomous civic accountability infrastructure for urban India.

Prahari turns a single citizen photo into a tracked, routed, and verified municipal case, then ranks the government on how fast it actually fixes things. It is built around one city, Bengaluru, and one painful problem, the potholes and road damage that get reported endlessly and resolved rarely.

## The problem

The same pothole gets reported by forty people and ignored forty times. Reports pile up with no owner, no deadline, and no proof of resolution. Citizens lose trust, and there is no public record of which department acted and which one stalled. Most civic apps add to the noise. They collect complaints and let the data rot.

## What Prahari does

A citizen submits a photo with a location. From there a network of AI agents runs the case end to end.

It classifies the issue and severity from the image. It checks nearby open cases and merges duplicates into one, counting every affected citizen instead of creating forty dead reports. It routes the case to the correct Bengaluru municipal department using a grounded knowledge base, and it tags every routing decision with its source so nothing is invented. It sets a service level deadline, drafts a formal grievance, and climbs an escalation ladder on its own when nothing is fixed. The moment enough citizens are affected, it escalates to a public level automatically, with no human in the loop.

When a repair is claimed, Prahari does not trust a checkbox. It takes a follow up photo of the same spot and uses vision to compare before and after. A case is marked resolved only when the fix is actually visible.

Finally, every verified resolution feeds a public scoreboard that ranks wards and departments by real responsiveness, and a predictive layer flags wards heading toward higher civic risk.

## Why it is different

Prahari does not gamify the citizen. It gamifies the government.

Three ideas make it credible in a room full of demos. Resolution is proven by vision, never by a manual toggle, so the resolved number means something. Routing is a grounded lookup with a visible source, never a hallucinated authority, so the system never invents an office or an official. And the scoreboard counts only vision verified resolutions, so nothing counts until the fix is seen. Honesty is the feature.

## The agent network

Prahari is built as a graph of focused agents on the Google Agent Development Kit, with an orchestrator that branches on real conditions rather than running a fixed chain.

The intake agent classifies the issue, severity, and a plain description from the photo and location. The verification agent checks classification confidence and flags low confidence cases for community confirmation. The dedup agent embeds the report, finds nearby open cases within a small radius, and merges true duplicates. The routing agent resolves the responsible department from the grounded knowledge base and attaches provenance. The escalation agent owns the service level deadline, the drafted grievances, and the autonomous and real time escalation paths. The resolution agent runs the before and after vision comparison that closes the loop. The insight agent aggregates open cases per ward to surface predictive civic risk.

## Architecture

| Layer | Technology |
| ----- | ---------- |
| Agent graph | Google Agent Development Kit |
| Model | Gemini for classification, vision comparison, drafting, and risk |
| API | FastAPI on Cloud Run |
| Data | Firebase Firestore for cases, Firebase Cloud Storage for images |
| Analytics | BigQuery for the scoreboard, with an in memory fallback |
| Frontend | Next.js, Tailwind, Framer Motion, Google Maps |

## How a case flows

A photo and a location arrive at the report endpoint. The case is classified, checked against nearby reports, and either merged or created. A new case is routed to its department with provenance, given a deadline, and handed an initial drafted grievance. If a merge pushes the affected count past the threshold, the case escalates to public on the spot. Later, a follow up photo runs the vision check, and a confident match flips the case to verified resolved. Every state change updates the live map, the case list, and the responsiveness scoreboard.

## Running locally

The backend is a FastAPI app. From the backend folder, create a virtual environment on Python 3.12, install the requirements, set the environment values for the Firebase project and the Gemini key, then start the server on port 8080. A seed script populates a realistic spread of Bengaluru cases so the scoreboard and risk layer look alive.

The frontend is a Next.js app. From the frontend folder, install dependencies, provide the public environment values for the API base and the Google Maps key, then start the dev server. Open the local address and the command center loads with the live map, the report panel, and the scoreboard.

## Scope

One city and one vertical, by design. Bengaluru and road damage. Depth over breadth, so every part of the loop is real rather than a long list of shallow features.

## Built for VibeToShip

Prahari was built as a hackathon project to show that civic technology can be honest, autonomous, and accountable at the same time.
