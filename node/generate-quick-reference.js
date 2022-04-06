const fs = require("fs");
const utB = require("./util-book-reference");

Object.entries(DataUtil.contentLanguages).forEach(([k, v]) => {
	fs.writeFileSync(`${v.baseDir}/generated/bookref-quick.json`, JSON.stringify(utB.UtilBookReference.getIndex(`../${v.baseDir}`, {name: "Quick Reference", id: "bookref-quick", tag: "quickref"})).replace(/\s*\u2014\s*?/g, "\\u2014"), "utf8");
})
console.log("Updated quick references.");
