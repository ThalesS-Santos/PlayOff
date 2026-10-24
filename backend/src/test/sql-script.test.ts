import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { splitSqlScript } from '../repo/sql-script'

const read = (f: string) => readFileSync(new URL(`../../db/${f}`, import.meta.url), 'utf8')

describe('divisão dos scripts .sql em comandos', () => {
  it('separa SQL por ";" (sem o ";"), ignora comentários e mantém PL/SQL até a "/"', () => {
    const script = [
      '-- comentário',
      'CREATE TABLE A (',
      '  X NUMBER',
      ');',
      '',
      'CREATE INDEX IX_A ON A (X);',
      'BEGIN',
      '  -- dentro do bloco o comentário fica',
      "  EXECUTE IMMEDIATE 'DROP TABLE A';",
      'END;',
      '/',
    ].join('\r\n')
    expect(splitSqlScript(script)).toEqual([
      'CREATE TABLE A (\n  X NUMBER\n)',
      'CREATE INDEX IX_A ON A (X)',
      "BEGIN\n  -- dentro do bloco o comentário fica\n  EXECUTE IMMEDIATE 'DROP TABLE A';\nEND;",
    ])
  })

  it('recusa comando sem terminador', () => {
    expect(() => splitSqlScript('CREATE TABLE A (X NUMBER)')).toThrow('sem terminador')
    expect(() => splitSqlScript('BEGIN\n  NULL;\nEND;')).toThrow('sem terminador')
  })

  it('os scripts do projeto viram os comandos esperados', () => {
    const schema = splitSqlScript(read('001_schema.sql'))
    expect(schema.filter((s) => s.startsWith('CREATE TABLE'))).toHaveLength(22)
    expect(schema.every((s) => /^CREATE (TABLE|INDEX)/.test(s) && !s.trimEnd().endsWith(';'))).toBe(true)
    const drop = splitSqlScript(read('000_drop.sql'))
    expect(drop).toHaveLength(1)
    expect(drop[0]).toMatch(/^BEGIN[\s\S]*END;$/)
  })
})
