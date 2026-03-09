#!/bin/bash


files=()
while IFS= read -r -d '' file; do
  files+=("$file")
done < <(find . -type f -name "*.hbs" -print0)

# Компилируем все в один файл
if [ ${#files[@]} -gt 0 ]; then
  echo "Найдены HBS файлы:"
  echo "--------------------------------------"
  for i in "${!files[@]}"; do
      echo "$((i+1)). ${files[$i]}"
  done
  echo "--------------------------------------"

  npx handlebars "${files[@]}" -f "./src/all-templates.precompiled.js" --extension "hbs"
  if [ $? -eq 0 ]; then
      echo "Шаблоны скомпилированы в ./src/all-templates.precompiled.js"
    else
      echo "Ошибка компиляции"
      exit 1
    fi

else
  echo "HBS файлы не найдены"
fi
