// Reporter customizado do Vitest: gera um TEST-REPORT.md legível para humanos.
//
// Roda sempre que `npm test` executa (passando ou falhando) e escreve um
// documento Markdown com resumo geral, resultado por arquivo e detalhe de
// cada teste (status, duração e — se falhar — a mensagem de erro).
//
// Usa a API de reporter do Vitest 4 (onTestRunEnd / TestModule).
import { writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const ICON = { passed: '✅', failed: '❌', skipped: '⏭️', pending: '⏭️' }

function fmtMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

export default class MarkdownReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile ?? 'TEST-REPORT.md'
    this.root = process.cwd()
  }

  onInit(ctx) {
    this.root = ctx?.config?.root ?? process.cwd()
  }

  // API nova do Vitest 4 — chamada ao final do run (passe ou falhe).
  onTestRunEnd(testModules = [], unhandledErrors = []) {
    const perFile = []

    for (const mod of testModules) {
      const tests = []
      for (const tc of mod.children.allTests()) {
        const res = tc.result?.() ?? {}
        const diag = tc.diagnostic?.() ?? {}
        tests.push({
          name: tc.fullName ?? tc.name ?? '(sem nome)',
          state: res.state ?? 'skipped',
          duration: diag.duration ?? 0,
          error: res.errors?.[0]?.message ?? null,
        })
      }
      const rel = relative(this.root, mod.moduleId ?? '').replace(/\\/g, '/')
      const fileDuration = tests.reduce((s, t) => s + t.duration, 0)
      perFile.push({ rel, tests, fileDuration })
    }

    this.write(perFile, unhandledErrors)
  }

  write(perFile, unhandledErrors = []) {
    const all = perFile.flatMap((f) => f.tests)
    const passed = all.filter((t) => t.state === 'passed').length
    const failed = all.filter((t) => t.state === 'failed').length
    const skipped = all.length - passed - failed
    const totalDuration = perFile.reduce((s, f) => s + f.fileDuration, 0)

    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const overall = failed === 0 ? '✅ TODOS OS TESTES PASSARAM' : `❌ ${failed} TESTE(S) FALHARAM`

    const lines = []
    lines.push('# Relatório de Testes — Frontend Virla', '')
    lines.push(`> Gerado em ${now} · Comando: \`npm test\``, '')
    lines.push(`## ${overall}`, '')
    lines.push('| Métrica | Valor |', '| --- | --- |')
    lines.push(`| Total de testes | **${all.length}** |`)
    lines.push(`| ✅ Passaram | ${passed} |`)
    lines.push(`| ❌ Falharam | ${failed} |`)
    lines.push(`| ⏭️ Ignorados | ${skipped} |`)
    lines.push(`| Arquivos | ${perFile.length} |`)
    lines.push(`| Duração total | ${fmtMs(totalDuration)} |`, '')

    if (failed > 0) {
      lines.push('## ❌ Falhas', '')
      for (const t of all.filter((x) => x.state === 'failed')) {
        lines.push(`- **${t.name}**`)
        if (t.error) lines.push('  ```', `  ${t.error}`, '  ```')
      }
      lines.push('')
    }

    lines.push('## Detalhes por arquivo', '')
    for (const f of [...perFile].sort((a, b) => a.rel.localeCompare(b.rel))) {
      const fp = f.tests.filter((t) => t.state === 'passed').length
      lines.push(`### \`${f.rel}\``)
      lines.push(`${fp}/${f.tests.length} passaram · ${fmtMs(f.fileDuration)}`, '')
      lines.push('| Status | Teste | Duração |', '| :---: | --- | ---: |')
      for (const t of f.tests) {
        const icon = ICON[t.state] ?? '❔'
        lines.push(`| ${icon} | ${String(t.name).replace(/\|/g, '\\|')} | ${fmtMs(t.duration)} |`)
      }
      lines.push('')
    }

    if (unhandledErrors.length > 0) {
      lines.push('## ⚠️ Erros não tratados', '')
      for (const e of unhandledErrors) lines.push('```', String(e?.message ?? e), '```', '')
    }

    lines.push('---', '_Relatório gerado automaticamente pelo reporter Markdown do Vitest._', '')

    const target = resolve(this.root, this.outputFile)
    writeFileSync(target, lines.join('\n'), 'utf8')
    console.log(`\n📄 Relatório Markdown escrito em ${this.outputFile}`)
  }
}
