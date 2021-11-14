# Automation

The following is a list of non-automated or semi-automated (i.e. handled with manually-run-once scripts) procedures or data additions that must be maintained. Some the items on this list may be automation-friendly and simply as-yet un-automated, others are impractical or near-impossible to meaningfully automate. This list exist to serve as a reminder/checklist to any maintainer, but also as a gauge of how much manual upkeep is currently required to better judge whether adding to this list with new features is a good idea or not.

Note that this list is being created retroactively, and is as-yet incomplete.

#### All Data

- Page numbers (`page`)
- Data "tagging" (render `@tag` syntax)
	- This is partially automated, see `node/tag-json.js` (although many false positives are generated, e.g. "Sneak Attack" being tagged as the Attack action)
	- Some tags are too specific to automate, such as many of those using `@filter`
- Instances where `_copy` could be utilised, e.g. by converting adventure NPCs which are "commoner with X attributes"  to a `_copy` of "commoner" with the appropriate modifications

#### Spells

- JSON `spell[].miscTags`

#### Items

- JSON `item[].ability`
- Any and all item data contained in natural language (e.g. specific weapons in adventures)


