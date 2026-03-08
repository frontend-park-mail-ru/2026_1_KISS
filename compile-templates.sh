#!/bin/bash


while IFS= read -r -d '' file; do
    outfile="${file%.hbs}.precompiled.js"

    if npx handlebars "$file" -f "$outfile"; then
        echo "$file --> $(basename "$outfile")"
    else
        echo "Ошибка при компиляции: $file"
    fi
done < <(find . -type f -name "*.hbs" -print0)
