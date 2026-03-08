#!/bin/bash

# Счетчики для статистики
compiled=0
skipped=0

# Рекурсивно ищем все .hbs файлы
while IFS= read -r -d '' file; do
    # Формируем имя выходного файла
    outfile="${file%.hbs}.precompiled.js"

    # Компилируем шаблон
    if npx handlebars "$file" -f "$outfile"; then
        echo "  ✅ $file → $(basename "$outfile")"
        ((compiled++))
    else
        echo "  ❌ Ошибка при компиляции: $file"
        ((skipped++))
    fi
done < <(find . -type f -name "*.hbs" -print0)

echo ""
echo "📊 Результат:"
echo "   Скомпилировано: $compiled"
echo "   Пропущено: $skipped"
echo "✨ Готово!"