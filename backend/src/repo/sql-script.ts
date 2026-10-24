/*
 * Divide um arquivo .sql em comandos para executar um a um pelo driver
 * (o mesmo que o SQL Developer faz no "executar como script"):
 *  - comandos SQL terminam com ';' no fim da linha (o ';' não vai para o driver);
 *  - blocos PL/SQL (BEGIN/DECLARE) terminam com uma linha contendo só '/';
 *  - linhas de comentário ('--') fora de bloco PL/SQL são ignoradas.
 */
export function splitSqlScript(text: string): string[] {
  const out: string[] = []
  let buf: string[] = []
  const plsql = () => /^(BEGIN|DECLARE)\b/i.test(buf[0] ?? '')
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (plsql()) {
      if (trimmed === '/') {
        out.push(buf.join('\n'))
        buf = []
      } else buf.push(line)
      continue
    }
    if (!trimmed || trimmed.startsWith('--')) continue
    buf.push(line)
    if (plsql()) continue
    if (trimmed.endsWith(';')) {
      out.push(buf.join('\n').replace(/;\s*$/, ''))
      buf = []
    }
  }
  if (buf.length) throw new Error(`Comando sem terminador no fim do script: ${buf[0]}`)
  return out
}
