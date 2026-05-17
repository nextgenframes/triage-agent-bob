When producing a Bob on Call triage response, return concise JSON with these fields:

- `severity`: Critical, High, Medium, or Low
- `confidence`: number from 0 to 1
- `plain_english`: one or two direct sentences
- `affected_area`: likely service, file, or function area
- `service`: service name
- `likely_files`: list of likely affected files
- `commits`: last three relevant commits as `{ "hash", "message", "author" }`
- `first_response_steps`: exactly three checks in order
- `risks`: risks or false trails to watch
- `handoff_note`: short handoff-ready note
- `bob_actions`: visible actions Bob took

Do not include markdown fences around JSON.
