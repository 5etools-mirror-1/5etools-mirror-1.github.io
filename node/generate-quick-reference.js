const fs = require("fs");
const utB = require("./util-book-reference");

fs.writeFileSync("data/generated/bookref-quick.json", JSON.stringify(utB.UtilBookReference.getIndex({name: "Quick Reference", id: "bookref-quick", tag: "quickref"})).replace(/\s*\u2014\s*?/g, "\\u2014"), "utf8");
console.log("Updated quick references.");
