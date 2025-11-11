$file = "src\routes\+page.svelte"
$content = Get-Content $file -Raw -Encoding UTF8

# Find and replace the corrupted section
$content = $content -replace "import GameBoard from '\`$lib/components/GameBoar\s+// Reset multiplayer state[\s\S]*?roomReady = false;te';", "import GameBoard from '\`$lib/components/GameBoard.svelte';"

# Save the fixed content
$content | Set-Content $file -Encoding UTF8 -NoNewline

Write-Host "File fixed successfully"
