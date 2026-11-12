
# validar-etapa4-completa.ps1
# FootEra - ETAPA 4
# Bateria QA sequencial, sem estornos reais.

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

# Ambiente exclusivamente QA.
$env:NODE_ENV = "test"
$env:MP_ACCESS_TOKEN = ""
$env:BILLING_CUPOM_RESERVA_QA = "true"
$env:BILLING_SHOW_LEARNING_PLANS = "true"

$env:ENABLE_ACCOUNT_PURGE = "false"
$env:ENABLE_BILLING_SCHEDULER = "false"
$env:ENABLE_MP_CONCILIACAO_SCHEDULER = "false"

$env:ENABLE_EVENT_REFUNDS_REAL = "false"
$env:ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED = "false"
$env:BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED = "false"

# Nunca inventar nem substituir DATABASE_URL.
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    throw "DATABASE_URL_NAO_CONFIGURADA"
}

try {
    $db = [uri]$env:DATABASE_URL
} catch {
    throw "DATABASE_URL_INVALIDA"
}

if (
    $db.Scheme -ne "postgresql" -or
    $db.Host -notin @("127.0.0.1", "localhost") -or
    $db.Port -ne 5433 -or
    $db.AbsolutePath -ne "/footera_billing_qa"
) {
    throw "BANCO_QA_INCORRETO"
}

Write-Host "BANCO_QA_VALIDADO" -ForegroundColor Green
Write-Host "ESTORNOS_REAIS_DESABILITADOS" -ForegroundColor Green

# Testes que devem existir no projeto.
$testes = @(
    "testar-checkout-financeiro-qa.ts",
    "testar-preferencia-recuperacao-qa.ts",
    "testar-preparacao-compensacao-evento-qa.ts",
    "testar-consulta-recuperacao-compensacao-qa.ts",
    "testar-reserva-chave-compensacao-qa.ts",
    "testar-retomada-compensacao-qa.ts",
    "testar-admin-billing-http-autenticado-qa.ts",
    "testar-admin-billing-dupla-aprovacao-http-qa.ts"
)

# Validar todos os caminhos ANTES de executar.
foreach ($teste in $testes) {
    if (-not (Test-Path -LiteralPath ".\$teste" -PathType Leaf)) {
        throw "TESTE_NAO_ENCONTRADO: $teste"
    }
}

$inicio = Get-Date
$resultados = @()

function Executar-Comando {
    param(
        [string]$Nome,
        [string[]]$Argumentos
    )

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Nome -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    & npx.cmd @Argumentos

    if ($LASTEXITCODE -ne 0) {
        throw "FALHA: $Nome (codigo $LASTEXITCODE)"
    }

    Write-Host "APROVADO: $Nome" -ForegroundColor Green
}

# Compilar.
Executar-Comando "TypeScript Server" @(
    "--no-install", "tsc", "--noEmit"
)

Executar-Comando "TypeScript Client" @(
    "--no-install", "tsc", "--noEmit",
    "--project", ".\client\tsconfig.json"
)

# Executar sequencialmente: os testes usam
# o mesmo banco QA e alguns alteram mocks.
foreach ($teste in $testes) {
    Executar-Comando $teste @(
        "--no-install",
        "tsx",
        ".\$teste"
    )

    $resultados += $teste
}

Write-Host ""
Write-Host "===== GIT DIFF CHECK ====="

& git -c core.pager=cat diff --check

if ($LASTEXITCODE -ne 0) {
    throw "GIT_DIFF_CHECK_FALHOU"
}

$duracao = (Get-Date) - $inicio

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "ETAPA 4 - BATERIA QA CONCLUIDA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "TypeScript Server: OK"
Write-Host "TypeScript Client: OK"
Write-Host "Git diff check: OK"
Write-Host "Scripts QA aprovados: $($resultados.Count)/$($testes.Count)"
Write-Host "Duracao: $($duracao.ToString('hh\:mm\:ss'))"

Write-Host "ETAPA4_BATERIA_QA_APROVADA" -ForegroundColor Green