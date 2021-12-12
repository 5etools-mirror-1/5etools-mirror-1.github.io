const fs = require("fs");
const ut = require("./util.js");

let swFiles = [];
const _addSwFilenames = (list, {isRemoveExtension = false} = {}) => {
	if (isRemoveExtension) list = list.map(it => it.split(".").slice(0, -1).join("."));
	swFiles = swFiles.concat(list.map(it => `/${it}`));
};

const audioFiles = ut.listFiles({dir: "audio", whitelistFileExts: [".mp3"]});
_addSwFilenames(audioFiles);

const cssFiles = ut.listFiles({dir: "css", whitelistFileExts: [".css"]});
_addSwFilenames(cssFiles);

const dataFiles = ut.listFiles({
	dir: `data`,
	blacklistFilePrefixes: ["srd-spells.json", "roll20.json"],
	whitelistFileExts: [".json"],
});
_addSwFilenames(dataFiles);

const fontFiles = ut.listFiles({dir: "fonts", whitelistFileExts: [".ttf", ".eot", ".woff", ".woff2", ".svg"]});
_addSwFilenames(fontFiles);

const homebrewFiles = ut.listFiles({dir: "homebrew", whitelistFileExts: ["index.json"]});
_addSwFilenames(homebrewFiles);

const iconFiles = ut.listFiles({dir: "icon", whitelistFileExts: [".png", ".jpg", ".jpeg", ".svg", ".gif"]});
_addSwFilenames(iconFiles);

if (fs.existsSync("img")) {
	const imgFiles = ut.listFiles({dir: "img", whitelistFileExts: [".png", ".jpg", ".jpeg", ".svg", ".gif"]});
	_addSwFilenames(imgFiles);
}

const jsFiles = ut.listFiles({dir: "js", whitelistFileExts: [".js"]});
_addSwFilenames(jsFiles);

const libFiles = ut.listFiles({dir: "lib", whitelistFileExts: [".js"]});
_addSwFilenames(libFiles);

const searchFiles = ut.listFiles({dir: "search", whitelistFileExts: [".json"]});
_addSwFilenames(searchFiles);

const rootFilesHtml = ut.listFiles({dir: ".", whitelistFileExts: [".html"], whitelistDirs: []})
	.map(it => it.substring(2));
_addSwFilenames(rootFilesHtml, {isRemoveExtension: !!process.env.VET_SW_REMOVE_EXTENSION_HTML});

const rootFiles = ut.listFiles({dir: ".", whitelistFileExts: [".webmanifest", ".png"], whitelistDirs: []})
	.map(it => it.substring(2));
_addSwFilenames(rootFiles);

// Add prod/CDN files
swFiles = swFiles.concat([
	"/js/header.js",
	"/js/shared.js",
	"https://cdn.jsdelivr.net/combine/npm/jquery@3.4.1/dist/jquery.min.js,gh/weixsong/elasticlunr.js@0.9/elasticlunr.min.js",
]);

fs.writeFileSync("./js/sw-files.js", `/* eslint-disable */\nthis.filesToCache = ${JSON.stringify(swFiles)};`, "utf-8");
