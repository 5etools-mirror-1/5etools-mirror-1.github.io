## 5e.tools

Visit the [main site](https://5e.tools/index.html) or go to the unofficial GitHub [mirror](index.html).

[Join the 5etools Discord here!](https://discord.gg/5etools)

## Help and Support

Please see [our wiki](https://wiki.5e.tools/) for FAQs, installation guides, supported integrations, and more.

---

## Developer Notes
### Data Sources and Versioning

Only "official" (that is, published by WotC) data is to be included in the site. Anything else should be added to the homebrew repository. Some exceptions to this rule are:
- All Adventurers League (AL) -specific content is to be kept in the homebrew repository. While much of this content broadly falls under the "published by WotC" umbrella, a good deal of it doesn't. For the sake of consistency/cleanliness, all AL content is to be considered homebrew.
- Anything published in the Dragon+ magazine.
- Anything veto'd by the maintainers of this repository.

Prioritise RAW above all else. Aim to provide a 1:1 copy of the original data. Obvious typos (for instance, mathematical errors in creature statblocks) may be corrected at the discretion of the maintainer(s).

Aim to use the latest version of any published material. Older versions which are sufficiently different (and relevant to community interests) can be moved to the homebrew repository.

The primary source for an entity should be that under which it was first released. Exceptions to this rule include:
- The entity was originally released in a "partial" or "pre-release" form. For example, races from WGE were later re-released in ERLW.
- The entity was originally released in a published adventure, but was later re-printed in a generic supplement. For example, the demon lords in OotA were re-printed in MTF, or the Haunted One background in CoS was re-printed in VRGR.

#### Page-Specific Notes

*Languages page.* As there is no well-defined RAW format for language data, the languages page collects together information from several disjoint places. A priority list of sources to be considered is:
- The "Languages" section on PHB p123
- official sources, in order of:
  - PHB > (DMG) > MM
  - Other "official" (i.e. published) products in release-date order
  - "Unofficial" products (i.e. Unearthed Arcana; Plane Shift) in release-date order

Within this ordering, the following prioritisation should be made:
- text that directly refers to or describes a language, in order of first appearance in the product (i.e. if a language is mentioned on page 2 and 10 of a book, the entry on page 2 should be taken as the primary source)
- text that is given for player use (e.g. the "Druidic" feature of the Druid class) (the text of which may have to be adapted to fit a reference format; i.e. changing "You can understand..." to "A speaker or X language can understand...).


### Target JavaScript Version

Any language feature which is available in both main-line Chrome and main-line Firefox, and has been available for at least six months, may be used.

### Style Guidelines
#### Code

- Use tabs over spaces.

#### CSS

- The [BEM](http://getbem.com/) ("Block Element Modifier") naming strategy should be used where possible.

#### Data/Text

- Format JSON to match the default output of JavaScript's `JSON.stringify` (using tabs for indentation), i.e. one line per bracket and one line per value. JSON files programmatically generated from other JSON files (i.e. those stored in `data/generated`) should be minified, however.

- When "tagging" references in data (e.g. `{@creature goblin}`), the following rules apply:
	- Only tag references which are _intended as references_. For example, the Wizard class in `You gain one cantrip of your choice from the wizard spell list` should be tagged, whereas the Wizard class in `Together, a group of seven powerful wizards sought to contain the demon` should not be tagged. One is a reference to the mechanical class, one is merely the casual usage of the word "wizard."
	- In a similar vein, never tag anything within a `quote`-type block. Even if the quote directly refers to a specific creature, we can assume the quote is from a universe/perspective in which (for example) statblocks don't exist, and therefore the tag should be omitted to maintain the flavor of the quote.
	- Within data from a source, avoid referencing content from a source printed after the publication of that source. For example, MTF content might reference SCAG deities, but SCAG deities should refrain from referencing MTF content.

### JSON Cleaning
#### Trailing commas

To remove trailing commas in JSON:

Find: `(.*?)(,)(:?\s*]|\s*})`

Replace: `$1$3`

#### Character replacement

- `’` should be replaced with `'`
- `“` and `”` should be replaced with `"`
- `—` (em dash) should be replaced with `\u2014` (Unicode for em dash)
- `–` should be replaced with `\u2013` (Unicode for en dash)
- `−` should be replaced with `\u2212` (Unicode for minus sign)
- `•` should be not be used unless the JSON in question is not yet covered by the entryRenderer, i.e. should be encoded as a list
- the only Unicode escape sequences allowed are `\u2014`, `\u2013`, and `\u2212`; all other characters (unless noted above) should be stored as-is

#### Convention for dashes

- `-` (hyphen) should **only** be used to hyphenate words, e.g. `60-foot` and `18th-level`
- `\u2014` should be used for parenthetical dash pairs, or for marking empty table rows.
- `\u2013` should be used for joining numerical ranges, e.g. `1-5` should become `1\u20135`.
- `\u2212` should be used for unary minus signs, in the case of penalties. For example, `"You have a -5 penalty to..."` should become `"You have a \u22125 penalty to..."`.
- any whitespace on any side of a `\u2014` should be removed

#### Convention for measurement

- Adjectives: a hyphen and the full name of the unit of measure should be used, e.g. dragon exhales acid in a `60-foot line`
- Nouns: a space and the short name of the unit of measure (including the trailing period) should be used, e.g. `blindsight 60 ft.`, `darkvision 120 ft.`
- Time: a slash, `/`, with no spaces on either side followed by the capitalised unit of time, e.g. `2/Turn`, `3/Day`

#### Convention for Dice

Dice should be written as `[X]dY[ <+|-|×> Z]`, i.e. with a space between dice and operator, and a space between operator and modifier. Some examples of acceptable formatting are: `d6`, `2d6`, or `2d6 + 1`.

#### Convention for Item Names

Item names should be title-case, with the exception of units in parentheses, which should be sentence-case. Items who's volume or amount is specified by container (e.g. `(vial)`) treat the container as a unit.

### Mouse/Keyboard Events

Avoid binding ALT-modified events, as these are not available under MacOS or various Linux flavors. Binding SHIFT-/CTRL-modified events is preferred.

### Dev Server

Do `npm run serve:dev` to launch a local dev server that serves the project files on [`http://localhost:5000/index.html`](http://localhost:8080/index.html).

### Version bump

Do `npm run version-bump -- [OPTION]`, where `[OPTION]` is one of the following:

- `major` to increment the major version (`1.2.3` will become `2.0.0`)
- `minor` to increment the minor version (`1.2.3` will become `1.3.0`)
- `patch` to increment the patch version (`1.2.3` will become `1.2.4`)
- a version number (like `1.2.3`)

It will first run the tests and fail to increase the version if the tests fail.
It will then automatically replace the version in the files where it needs to be replaced, create a commit with the message `chore(version): bump` and create a tag (in the form `v1.2.3`) at the commit.
This feature can be easily disabled by doing `npm config set git-tag-version false`.

---

## License

This project is licensed under the terms of the MIT license.
