async function main () {
	await require("./generate-search-index");
	require("./generate-dmscreen-reference");
	require("./generate-quick-reference");
	await require("./generate-tables-data");
	require("./generate-subclass-lookup");
	require("./generate-nav-adventure-book-index");
	require("./generate-all-maps");
	// require("./generate-wotc-homebrew"); // unused
}

main().catch(e => { throw e; });
