# Alias Router Pro (Chrome Extension, MV3)

**Make aliases for everything** you type after `go` in Chrome's Omnibox.

## Adding a New Alias

1. Open the extension’s **Options** page:
   - `chrome://extensions` → **Details** → **Extension options**
   - or click the puzzle-piece icon → right-click Alias Router Pro → **Options**.
2. Fill out:
   - **Display name:** e.g. `Tek tickets`
   - **Type:** `prefix`, `tokens`, `regex`, or `exact`
   - **Pattern & Template:**
     - **Prefix Example:**
       Pattern: `tek-`
       Template: `https://example.com/tek-{*}`  
       Usage: `go tek-234` → opens `https://example.com/tek-234`
     - **Tokens Example:**  
       Pattern: `gh :owner :repo pr :num`  
       Template: `https://github.com/{owner}/{repo}/pull/{num}`  
       Usage: `go gh myorg site pr 123`
     - **Regex Example:**  
       Pattern: `^JIRA-(\d+)$`  
       Template: `https://jira.example.com/browse/JIRA-$1`  
       Usage: `go JIRA-456`
     - **Exact Example:**  
       Pattern: `docs`  
       Template: `https://docs.example.com`
   - **Open in:** Choose current tab or new tab.
   - Click **Save Alias**.
3. Use **Export/Import JSON** to back up or restore aliases.
4. Optional: Set a **Default template** (e.g., `https://google.com/search?q={q}`) for unmatched inputs.

## Using Aliases

- Type `go` + Space in the address bar followed by your alias.  
  Examples:
  - `go tek-234`
  - `go gh myorg site pr 123`
  - `go JIRA-456`
- Press **Enter** → Chrome opens the mapped URL(s).

## Highlights

- Alias types: **exact**, **tokens**, **prefix**, **regex**
- **Tokens**: Human-friendly patterns like `gh :owner :repo pr :num` → `https://github.com/{owner}/{repo}/pull/{num}`
- Open **multiple URLs** from one alias (newline or ` | `)
- Per-alias **open in**: current tab / new foreground / new background
- **Fallback** template when nothing matches (e.g., `https://google.com/search?q={q}`)
- Import/Export JSON, context menu: “Open as alias”

## Usage

- In the URL bar type: `go` + Space + your alias.
- Examples:
  - **exact**: pattern `docs` → template `https://docs.example.com`
  - **prefix**: pattern `tek-` → template `https://example.com/tek-{*}` → `go tek-234`
  - **regex**: pattern `^JIRA-(\d+)$` → template `https://jira.example.com/browse/JIRA-$1`
  - **tokens**: pattern `gh :owner :repo pr :num` → template `https://github.com/{owner}/{repo}/pull/{num}` → `go gh myorg site pr 123`
