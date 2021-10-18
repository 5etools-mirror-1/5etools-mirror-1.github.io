#!/bin/bash

echo "Replacing local files with combined jsdelivr."

find . -maxdepth 1 -type f -name '*.html' -print0 |
    while IFS= read -r -d $'\0' line; do
        sed -n -i '/lib\/jquery.js/!p' $line
        sed -n -i '/lib\/elasticlunr.js/!p' $line
		# Lots of messy escapes below, you care about the version number after the @ sign & the comma.
        sed -i -e '/<!--5ETOOLS_SCRIPT_ANCHOR-->/a <script type="text/javascript" src="https://cdn.jsdelivr.net/combine/npm/jquery@3.4.1/dist/jquery.min.js,gh/weixsong/elasticlunr.js@0.9/elasticlunr.min.js"><\/script> <script>window.jQuery || document.write(`<script src="/lib\/jquery.js"><\\\/script>`);' $line
    done

