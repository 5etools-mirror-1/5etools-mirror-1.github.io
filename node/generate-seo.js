/**
 * Generator script which creates stub per-entity pages for SEO.
 */

import * as fs from "fs";
import "../js/parser.js";
import "../js/utils.js";
import "../js/utils-dataloader.js";
import "../js/render.js";
import "../js/render-dice.js";
import * as ut from "./util.js";

const IS_DEV_MODE = true; // !!process.env.VET_SEO_IS_DEV_MODE; // N.b.: disabled as all known deployments are "dev"
const BASE_SITE_URL = process.env.VET_BASE_SITE_URL || "https://5e.tools/";
const isSkipUaEtc = !!process.env.VET_SEO_IS_SKIP_UA_ETC;
const isOnlyVanilla = !!process.env.VET_SEO_IS_ONLY_VANILLA;
const version = ut.readJson("package.json").version;

const lastMod = (() => {
	const date = new Date();
	return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
})();

const baseSitemapData = (() => {
	const out = {};

	// Scrape all the links from navigation.js -- avoid any unofficial HTML files which might exist
	const navText = fs.readFileSync("./js/navigation.js", "utf-8");
	navText.replace(/(?:"([^"]+\.html)"|'([^']+)\.html'|`([^`]+)\.html`)/gi, (...m) => {
		const str = m[1] || m[2] || m[3];
		if (str.includes("${")) return;
		out[str] = true;
	});

	return out;
})();

const getTemplate = (page, source, hash, textStyle, isFluff) => `<!DOCTYPE html><html lang="en"><head>
<!--5ETOOLS_CMP-->
<!--5ETOOLS_ANALYTICS-->
<!--5ETOOLS_ADCODE-->
<meta charset="utf-8"><meta name="description" content=""><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><title>5etools</title><link rel="stylesheet" href="/css/bootstrap.css?v=${version}"><link rel="stylesheet" href="/css/main.css"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" sizes="256x256" href="/favicon-256x256.png"><link rel="icon" type="image/png" sizes="144x144" href="/favicon-144x144.png"><link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png"><link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png"><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"><link rel="manifest" href="/manifest.webmanifest"><meta name="application-name" content="5etools"><meta name="theme-color" content="#006bc4"><meta name="msapplication-config" content="browserconfig.xml"/><meta name="msapplication-TileColor" content="#006bc4"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png"><link rel="apple-touch-icon" sizes="360x360" href="/apple-touch-icon-360x360.png"><link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167x167.png"><link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png"><link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png"><meta name="apple-mobile-web-app-title" content="5etools"><link rel="mask-icon" href="/safari-pinned-tab.svg" color="#006bc4"><link rel="search" href="/open-search.xml" title="Search 5etools" type="application/opensearchdescription+xml"><script type="text/javascript" src="/js/header.js?v=${VERSION_NUMBER}"></script><script>_SEO_PAGE="${page}";_SEO_SOURCE="${source}";_SEO_HASH="${hash}";_SEO_STYLE=${textStyle};_SEO_FLUFF=${isFluff}</script></head><body><div class="cancer__wrp-sidebar-rhs cancer__anchor"><div class="cancer__disp-cancer"></div><div class="cancer__sidebar-rhs-inner cancer__sidebar-rhs-inner--top"><!--5ETOOLS_AD_RIGHT_1--></div><div class="cancer__sidebar-rhs-inner cancer__sidebar-rhs-inner--bottom"><!--5ETOOLS_AD_RIGHT_2--></div></div><div class="cancer__wrp-leaderboard cancer__anchor"><div class="cancer__disp-cancer"></div><div class="cancer__wrp-leaderboard-inner"><!--5ETOOLS_AD_LEADERBOARD--></div></div><header class="hidden-xs hidden-sm page__header"><div class="container"><h1 class="page__title"></h1></div></header><nav class="container page__nav" id="navigation"><ul class="nav nav-pills page__nav-inner" id="navbar"></ul></nav><main class="container"><div class="row"><div id="wrp-pagecontent"><table id="pagecontent" class="w-100 stats"><tr><th class="border" colspan="6"></th></tr><tr><td colspan="6" class="initial-message">Loading...</td></tr><tr><th class="border" colspan="6"></th></tr></table></div></div><div class="row" id="link-page"></div></main><script type="text/javascript" src="https://cdn.jsdelivr.net/combine/npm/jquery@3.4.1/dist/jquery.min.js,gh/weixsong/elasticlunr.js@0.9/elasticlunr.min.js"></script><script type="text/javascript" src="/lib/localforage.js"></script></script></script><script type="text/javascript" src="/js/shared.js?v=${VERSION_NUMBER}"></script><script type="text/javascript" src="/js/render-${page}.js?v=${VERSION_NUMBER}"></script><script type="text/javascript" src="/js/seo-loader.js?v=${VERSION_NUMBER}"></script></body></html>`;

const getTemplateDev = (page, source, hash, textStyle, isFluff) => `<!DOCTYPE html><html lang="en"><head>
<!--5ETOOLS_CMP-->
<!--5ETOOLS_ANALYTICS-->
<!--5ETOOLS_ADCODE-->
<meta charset="utf-8">
<meta name="description" content="">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>5etools</title>
<link rel="stylesheet" href="/css/bootstrap.css">
<link rel="stylesheet" href="/css/main.css">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="256x256" href="/favicon-256x256.png">
<link rel="icon" type="image/png" sizes="144x144" href="/favicon-144x144.png">
<link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png">
<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="application-name" content="5etools">
<meta name="theme-color" content="#006bc4">
<meta name="msapplication-config" content="browserconfig.xml"/>
<meta name="msapplication-TileColor" content="#006bc4">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png">
<link rel="apple-touch-icon" sizes="360x360" href="/apple-touch-icon-360x360.png">
<link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167x167.png">
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png">
<link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png">
<meta name="apple-mobile-web-app-title" content="5etools">
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#006bc4">
<script type="text/javascript" src="/js/styleswitch.js"></script>
<script type="text/javascript" src="/js/navigation.js"></script>
<script type="text/javascript" src="/js/browsercheck.js"></script>
<script>_SEO_PAGE="${page}";_SEO_SOURCE="${source}";_SEO_HASH="${hash}";_SEO_STYLE=${textStyle};_SEO_FLUFF=${isFluff}</script>
</head>
<body>
<div class="cancer__wrp-sidebar-rhs cancer__anchor"><div class="cancer__disp-cancer"></div><div class="cancer__sidebar-rhs-inner cancer__sidebar-rhs-inner--top"><!--5ETOOLS_AD_RIGHT_1--></div><div class="cancer__sidebar-rhs-inner cancer__sidebar-rhs-inner--bottom"><!--5ETOOLS_AD_RIGHT_2--></div></div>
<div class="cancer__wrp-leaderboard cancer__anchor"><div class="cancer__disp-cancer"></div><div class="cancer__wrp-leaderboard-inner"><!--5ETOOLS_AD_LEADERBOARD--></div></div>

<header class="hidden-xs hidden-sm page__header"><div class="container"><h1 class="page__title"></h1></div></header><nav class="container page__nav" id="navigation"><ul class="nav nav-pills page__nav-inner" id="navbar"></ul></nav>

<main class="container"><div class="row"><div id="wrp-pagecontent"><table id="pagecontent" class="w-100 stats"><tr><th class="border" colspan="6"></th></tr><tr><td colspan="6" class="initial-message">Loading...</td></tr><tr><th class="border" colspan="6"></th></tr></table></div></div><div class="row" id="link-page"></div></main>
<script type="text/javascript" src="/lib/jquery.js"></script>
<script type="text/javascript" src="/lib/localforage.js"></script>
<script type="text/javascript" src="/lib/elasticlunr.js"></script>
<script type="text/javascript" src="/js/parser.js"></script>
<script type="text/javascript" src="/js/utils.js"></script>
<script type="text/javascript" src="/js/utils-ui.js"></script>
<script type="text/javascript" src="/js/omnidexer.js"></script>
<script type="text/javascript" src="/js/omnisearch.js"></script>
<script type="text/javascript" src="/js/filter.js"></script>
<script type="text/javascript" src="/js/utils-dataloader.js"></script>
<script type="text/javascript" src="/js/utils-brew.js"></script>
<script type="text/javascript" src="/js/render.js"></script>
<script type="text/javascript" src="/js/render-dice.js"></script>
<script type="text/javascript" src="/js/scalecreature.js"></script>
<script type="text/javascript" src="/js/hist.js"></script>
<script type="text/javascript" src="/js/render-${page}.js"></script>
<script type="text/javascript" src="/js/seo-loader.js"></script></body></html>`;

const toGenerate = [
	{
		page: "spells",
		pGetEntries: () => {
			const index = ut.readJson(`data/spells/index.json`);
			const fileData = Object.entries(index)
				.filter(([source]) => !isSkipUaEtc || !SourceUtil.isNonstandardSourceWotc(source))
				.filter(([source]) => !isOnlyVanilla || Parser.SOURCES_VANILLA.has(source))
				.map(([_, filename]) => ut.readJson(`data/spells/${filename}`));
			return fileData.map(it => MiscUtil.copy(it.spell)).reduce((a, b) => a.concat(b));
		},
		style: 1,
		isFluff: 1,
	},
	{
		page: "bestiary",
		pGetEntries: () => {
			const index = ut.readJson(`data/bestiary/index.json`);
			const fileData = Object.entries(index)
				.filter(([source]) => !isSkipUaEtc || !SourceUtil.isNonstandardSourceWotc(source))
				.filter(([source]) => !isOnlyVanilla || Parser.SOURCES_VANILLA.has(source))
				.map(([source, filename]) => ({source: source, json: ut.readJson(`data/bestiary/${filename}`)}));
			// Filter to prevent duplicates from "otherSources" copies
			return fileData.map(it => MiscUtil.copy(it.json.monster.filter(mon => mon.source === it.source))).reduce((a, b) => a.concat(b));
		},
		style: 2,
		isFluff: 1,
	},
	{
		page: "items",
		pGetEntries: async () => {
			const out = (await Renderer.item.pBuildList()).filter(it => !it._isItemGroup);
			return out
				.filter(it => !isSkipUaEtc || !SourceUtil.isNonstandardSourceWotc(it.source))
				.filter(it => !isOnlyVanilla || Parser.SOURCES_VANILLA.has(it.source));
		},
		style: 1,
		isFluff: 1,
	},

	// TODO expand this as required
];

const siteMapData = {};

async function main () {
	ut.patchLoadJson();

	let total = 0;
	console.log(`Generating SEO pages...`);
	await Promise.all(toGenerate.map(async meta => {
		try {
			fs.mkdirSync(`./${meta.page}`, { recursive: true });
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
		}

		const entries = await meta.pGetEntries();
		const builder = UrlUtil.URL_TO_HASH_BUILDER[`${meta.page}.html`];
		entries.forEach(ent => {
			let offset = 0;
			let html;
			let path;
			while (true) {
				const hash = builder(ent);
				const sluggedHash = UrlUtil.getSluggedHash(hash);
				path = `${meta.page}/${sluggedHash}${offset ? `-${offset}` : ""}.html`;
				if (siteMapData[path]) {
					++offset;
					continue;
				}

				html = (IS_DEV_MODE ? getTemplateDev : getTemplate)(meta.page, ent.source, hash, meta.style, meta.isFluff);

				siteMapData[path] = true;
				break;
			}

			if (offset > 0) console.warn(`\tDeduplicated URL using suffix: ${path}`);

			fs.writeFileSync(`./${path}`, html, "utf-8");

			total++;
			if (total % 100 === 0) console.log(`Wrote ${total} files...`);
		});
	}));
	console.log(`Wrote ${total} files.`);

	let sitemapLinkCount = 0;
	let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
	sitemap += `<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n`;

	sitemap += `<url>
	<loc>${BASE_SITE_URL}</loc>
	<lastmod>${lastMod}</lastmod>
	<changefreq>monthly</changefreq>
</url>\n`;
	sitemapLinkCount++;

	Object.keys(baseSitemapData).forEach(url => {
		sitemap += `<url>
	<loc>${BASE_SITE_URL}${url}</loc>
	<lastmod>${lastMod}</lastmod>
	<changefreq>monthly</changefreq>
</url>\n`;
		sitemapLinkCount++;
	});

	Object.keys(siteMapData).forEach(url => {
		sitemap += `<url>
	<loc>${BASE_SITE_URL}${url}</loc>
	<lastmod>${lastMod}</lastmod>
	<changefreq>weekly</changefreq>
</url>\n`;
		sitemapLinkCount++;
	});

	sitemap += `</urlset>\n`;

	fs.writeFileSync("./sitemap.xml", sitemap, "utf-8");
	console.log(`Wrote ${sitemapLinkCount.toLocaleString()} URL${sitemapLinkCount === 1 ? "" : "s"} to sitemap.xml`);

	ut.unpatchLoadJson();
}

main().then(() => console.log(`SEO page generation complete.`)).catch(e => console.error(e));
