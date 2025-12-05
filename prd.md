# **URL Pattern Extraction**

## **1. Purpose of the Application**

The web application allows a user to:

* paste a list of **unique absolute URLs**,
* analyze these URLs,
* automatically identify **URL patterns** by generalizing low-frequency segments in hosts and paths.

This helps to reverse-engineer the structure and routing logic of a website.

---

## **2. Target User & Basic Use Case**

**Target user:** SEO analysts, developers, data engineers.

**Use case:**

1. User copies a list of unique URLs from a crawl or logs.
2. Pastes them into the app.
3. Runs the analysis.
4. The app outputs URL **patterns** showing which segments are static vs dynamic.
5. Each pattern lists all URLs that match it.

No configuration required.

---

## **3. Inputs**

### **3.1 Mandatory Input**

* **List of absolute URLs**

  * One per line
  * Duplicates ignored

### **3.2 No other parameters**

* **The placeholder is fixed**: `…` (U+2026)
* **No max_iter**
* **No user-configurable options**

The app is as simple as possible: **paste → click → get patterns**.

---

## **4. Output**

### **4.1 Pattern List**

For each identified pattern, the app shows:

* **Pattern** (example: `https://example.com/products/…`)
* **Count of URLs** belonging to that pattern
* **List of URLs** in that pattern (expandable/collapsible)

### **4.2 Ordering**

Patterns are sorted:

1. Descending by size (`count`)
2. Alphabetically as a tiebreaker

---

## **5. The Algorithm (Simplified, No Iterations)**

The algorithm consists of **three phases**:

1. Preprocessing
2. Global frequency counting
3. Pattern construction based on frequency thresholds (no loops)

### **5.1 Phase 1 — Preprocessing**

For each URL:

1. Parse into `scheme`, `host`, `path`.
2. **Host segmentation (right-aligned)**

   * Split by `.`
   * Assign positions from right (TLD = position 1).
3. **Path segmentation (left-aligned)**

   * Split by `/`
   * Assign positions from left (first segment = position 1).
4. Store all segments in internal form:

   * `type` (`host` or `path`)
   * `pos` (integer)
   * `seg` (original string)

### **5.2 Phase 2 — Trie Construction**

Build a prefix Trie from all parsed URLs:

1. Each node represents a segment (scheme, host part, or path part).
2. Traverse each URL's segments sequentially, creating nodes as needed.
3. Track the count of URLs passing through each node.
4. Store original URLs at terminal nodes.

### **5.3 Phase 3 — Pattern Extraction**

Traverse the Trie to extract patterns:

1. At each position, collect all distinct segment values for each type (scheme, host, path).
2. If multiple different values exist at the same position for a type, replace them with the placeholder `…` (dynamic segment).
3. If only one value exists at a position, keep it literal (static segment).
4. Group branches with identical masked patterns.
5. Collect all URLs that match each pattern.

---

## **6. User Interface**

### **6.1 Components**

1. **Title + short description**
2. **Textarea** to paste URLs
3. **"Analyze" button**
4. **Results section**

### **6.2 Interaction Flow**

1. User pastes URLs.
2. Clicks "Analyze".
3. Application:

   * deduplicates,
   * parses,
   * computes segment frequencies,
   * produces patterns,
   * displays pattern cards.

### **6.3 Pattern Card**

Each card shows:

* Pattern (monospace)
* Count of URLs
* Collapsible list of URLs

### **6.4 Error Handling**

* If no input: show message
* Invalid URLs: ignore and notify the user
* Empty result: show “No patterns detected”

---

## **7. Non-Goals (Out of Scope)**

* No export (CSV/JSON) in v1
* No regex generation
* No interactive filtering or searching
* No advanced configuration
* No support for URLs without schemes
* No normalization (case folding, trailing slash normalization, etc.)

Goal: **minimal, clean, deterministic application**.

---

## **8. Example**

Input URLs:

```
https://example.com/products/123
https://example.com/products/456
```

Frequencies:

* `products` occurs 2 times → keep
* `123` occurs 1 time → mask
* `456` occurs 1 time → mask

Output pattern:

```
https://example.com/products/…
```

