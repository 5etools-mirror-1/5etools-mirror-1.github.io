# Schema Templates

This directory contains extended pseudo JSON-schema files, designed to be compiled down to usable JSON schema files using `node ./node/compile-schemas.js [homebrew]`.

## Preprocessor Properties

### `$$ifSite`/`$$ifBrew`

The value will be merged into its parent iff the compilation mode matches the key, for example:

---

```json
{
	"$$ifBrew": {
		"b": 1
	}
}
```

Outputs the following when compiled in "site" mode:

```json
{}
```

---

```json
{
	"$$ifSite": {
		"a": 1
	},
	"$$ifBrew": {
		"a": 2
	}
}
```

Outputs the following when compiled in "site" mode:

```json
{
	"a": 1
}
```

Outputs the following when compiled in "homebrew" mode:

```json
{
	"a": 2
}
```

---

### `$$ifSite_item`/`$$ifBrew_item`

Usable only in an array. The value will be included in the array iff the compilation mode matches the key, for example:

---

```json
{
	"myArray": [
		{"$$ifBrew_item": 1},
		2,
		3
	]
}
```

Outputs the following when compiled in "site" mode:

```json
{
	"myArray": [
		2,
		3
	]
}
```

Outputs the following when compiled in "homebrew" mode:

```json
{
	"myArray": [
		1,
		2,
		3
	]
}
```

---

### `$$ifSiteElse_key`

The key/value will be merged into its parent with a key decided by the compilation mode, for example:

---

```json
{
	"$$ifSiteElse_key": {
		"keySite": "enum",
		"keyBrew": "examples",
		"value": [1]
	}
}
```

Outputs the following when compiled in "site" mode:

```json
{
	"enum": [1]
}
```

Outputs the following when compiled in "homebrew" mode:

```json
{
	"examples": [1]
}
```

---
