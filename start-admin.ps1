$secure = Read-Host 'Administrator password (at least 9 characters)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:DREAM_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $env:DREAM_PORT = '8766'
    node (Join-Path $PSScriptRoot 'server.cjs')
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Item Env:DREAM_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
