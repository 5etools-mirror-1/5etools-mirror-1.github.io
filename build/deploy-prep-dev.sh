#!/bin/bash

echo "Making the javascript cry (Minifying)."
for f in js/*.js
do
    npm run minify -- "$f" --out-file "$f"
done