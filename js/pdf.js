// jsPDF carregado via <script> UMD no HTML — não usar import (ES build tem deps @babel/runtime)
const { jsPDF, GState } = window.jspdf || {}

const COR_VERMELHO    = [204, 0, 0]
const COR_PRETO       = [26, 26, 26]
const COR_BRANCO      = [255, 255, 255]
const COR_TEXTO       = [30, 41, 59]
const COR_MUTED       = [100, 116, 139]
const COR_BORDA       = [226, 232, 240]
const COR_FUNDO_SEC   = [245, 245, 245]
const COR_CINZA_CLARO = [204, 204, 204]

const TEXTO_LGPD = 'Declaro que li e concordo com a politica de privacidade e autorizo o tratamento dos meus dados pessoais para fins de filiacao sindical, nos termos da LGPD (Lei 13.709/2018).'

async function carregarLogoBase64(url) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('[pdf.js] Falha ao carregar logo:', url, e)
    return null
  }
}

async function adicionarMarcaDagua(doc, logoBase64) {
  if (!logoBase64) return
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  try { doc.saveGraphicsState() } catch (e) { console.error('[pdf.js] saveGraphicsState:', e) }

  try {
    if (typeof GState !== 'undefined' && GState) {
      doc.setGState(new GState({ opacity: 0.10 }))
    }
  } catch (e) {
    console.error('[pdf.js] GState opacity falhou:', e)
  }

  const imgW = 80
  const imgH = 40
  const x = (pageWidth  - imgW) / 2
  const y = (pageHeight - imgH) / 2

  try {
    doc.addImage(logoBase64, 'JPEG', x, y, imgW, imgH)
  } catch (e) {
    console.error('[pdf.js] addImage marcaDagua falhou:', e)
  }

  try { doc.restoreGraphicsState() } catch (e) { console.error('[pdf.js] restoreGraphicsState:', e) }
}

function valor(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function formatarData(value) {
  if (!value) return '-'
  const soData = String(value).split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(soData)) {
    const [ano, mes, dia] = soData.split('-')
    return `${dia}/${mes}/${ano}`
  }
  const data = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(data.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR').format(data)
}

function formatarDataHora(value) {
  if (!value) return '-'
  const data = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(data.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data)
}

export async function gerarPDF(dados = {}) {
  const [logoIcone, logoMarca] = await Promise.all([
    carregarLogoBase64('/logo/faviSinteenp.jpeg'),
    carregarLogoBase64('/logo/logoSinteenp_transparente.png')
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const largura      = doc.internal.pageSize.getWidth()   // 210mm
  const altura       = doc.internal.pageSize.getHeight()  // 297mm
  const margemX      = 12
  const larguraTexto = largura - margemX * 2              // 186mm

  const registroId = dados.id || dados.uuid || globalThis.crypto?.randomUUID?.() || `temp-${Date.now()}`
  const geradoEm   = dados.geradoEm   || new Date().toISOString()
  const assinadoEm = dados.assinadoEm || geradoEm

  // ── MARCA D'ÁGUA (antes do conteúdo) ──────────────────────────────────────
  try {
    await adicionarMarcaDagua(doc, logoMarca)
  } catch (e) {
    console.error('[pdf.js] Marca d\'água abortou:', e)
  }

  // ── CABEÇALHO ──────────────────────────────────────────────────────────────
  const alturaHeader = 28

  doc.setFillColor(...COR_PRETO)
  doc.rect(0, 0, largura, alturaHeader, 'F')

  if (logoIcone) {
    try { doc.addImage(logoIcone, 'JPEG', margemX, 5, 18, 18) } catch (e) { console.error('[pdf.js] addImage header:', e) }
  }

  const xTexto = logoIcone ? margemX + 22 : margemX

  doc.setTextColor(...COR_BRANCO)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('FICHA DE FILIACAO', xTexto, 12)

  doc.setTextColor(...COR_VERMELHO)
  doc.setFontSize(10)
  doc.text('SINTEENP-PB', xTexto, 19)

  doc.setTextColor(...COR_CINZA_CLARO)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'Sindicato dos Trabalhadores em Estabelecimentos de Ensino Privado da Paraiba',
    xTexto, 25,
    { maxWidth: largura - xTexto - margemX }
  )

  // Linha divisória vermelha (~1mm)
  doc.setFillColor(...COR_VERMELHO)
  doc.rect(0, alturaHeader, largura, 1, 'F')

  let y = alturaHeader + 1 + 7  // 36mm

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function garantirEspaco(h) {
    if (y + h <= altura - 20) return
    doc.addPage()
    y = 14
  }

  function escreverLabelValor(label, val, xBase, largMax) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...COR_VERMELHO)
    doc.text(label + ':', xBase, y)

    const lw = doc.getTextWidth(label + ':') + 1.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COR_TEXTO)
    const linhas = doc.splitTextToSize(String(val), largMax - lw)
    doc.text(linhas, xBase + lw, y)
    return linhas.length
  }

  function escreverCampoSimples(label, val) {
    garantirEspaco(5)
    escreverLabelValor(label, val, margemX, larguraTexto)
    y += 4.5
  }

  function escreverCampoDuplo(label1, val1, label2, val2) {
    garantirEspaco(5)
    const metade = larguraTexto / 2 - 3
    escreverLabelValor(label1, val1, margemX, metade)
    if (label2 !== null) {
      escreverLabelValor(label2, val2, margemX + larguraTexto / 2 + 3, metade)
    }
    y += 4.5
  }

  function iniciarSecao(titulo) {
    garantirEspaco(14)

    doc.setFillColor(...COR_FUNDO_SEC)
    doc.rect(0, y - 5, largura, 8, 'F')

    doc.setFillColor(...COR_VERMELHO)
    doc.rect(0, y - 5, 3, 8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COR_VERMELHO)
    doc.text(titulo, margemX + 2, y)
    y += 6
  }

  function fecharSecao() {
    y += 4
  }

  // ── SEÇÃO 1: DADOS PESSOAIS ───────────────────────────────────────────────
  iniciarSecao('1. DADOS PESSOAIS')
  escreverCampoSimples('Nome completo', valor(dados.nome_completo))
  escreverCampoDuplo('CPF', valor(dados.cpf), 'RG', valor(dados.rg))
  escreverCampoDuplo('Nascimento', formatarData(dados.data_nascimento), 'Sexo', valor(dados.sexo))
  escreverCampoSimples('Estado civil', valor(dados.estado_civil))
  fecharSecao()

  // ── SEÇÃO 2: CONTATO ──────────────────────────────────────────────────────
  iniciarSecao('2. CONTATO')
  escreverCampoSimples('Email', valor(dados.email))
  escreverCampoDuplo('Telefone', valor(dados.telefone), 'WhatsApp', valor(dados.whatsapp))
  fecharSecao()

  // ── SEÇÃO 3: ENDEREÇO ─────────────────────────────────────────────────────
  iniciarSecao('3. ENDERECO')
  const endLinha1 = [dados.logradouro, dados.numero, dados.complemento].filter(Boolean).join(', ') || '-'
  escreverCampoSimples('Logradouro', endLinha1)
  escreverCampoSimples('Bairro', valor(dados.bairro))
  escreverCampoDuplo('CEP', valor(dados.cep), 'Estado', valor(dados.estado))
  escreverCampoSimples('Cidade', valor(dados.cidade))
  fecharSecao()

  // ── SEÇÃO 4: DADOS PROFISSIONAIS ──────────────────────────────────────────
  iniciarSecao('4. DADOS PROFISSIONAIS')
  escreverCampoSimples('Empresa', valor(dados.empresa))
  escreverCampoDuplo('Cargo', valor(dados.cargo), 'Matricula', valor(dados.matricula))
  escreverCampoDuplo('Setor', valor(dados.setor), 'Admissao', formatarData(dados.data_admissao))
  fecharSecao()

  // ── SEÇÃO 5: PAGAMENTO ────────────────────────────────────────────────────
  iniciarSecao('5. PAGAMENTO')
  escreverCampoSimples('Data de Filiacao', formatarData(dados.data_filiacao))
  const folha  = dados.forma_pagamento === 'folha'  ? '[X]' : '[ ]'
  const direto = dados.forma_pagamento === 'direto' ? '[X]' : '[ ]'
  escreverCampoSimples('Forma', `${folha} Desconto em folha   ${direto} Pagamento em sede`)
  escreverCampoSimples('Contribuicao', '1% do valor bruto da remuneracao')
  if (dados.forma_pagamento === 'direto') {
    escreverCampoSimples('Vencimento', 'Dia 5 de cada mes')
  }
  fecharSecao()

  // ── SEÇÃO 6: DECLARAÇÃO LGPD ─────────────────────────────────────────────
  iniciarSecao('6. DECLARACAO LGPD')
  garantirEspaco(12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COR_TEXTO)
  const lgpdLinhas = doc.splitTextToSize(TEXTO_LGPD, larguraTexto)
  doc.text(lgpdLinhas, margemX, y)
  y += lgpdLinhas.length * 3.5 + 2

  escreverCampoSimples(
    'Consentido em',
    `${formatarDataHora(dados.data_consentimento_lgpd || geradoEm)} - IP: ${valor(dados.ip_consentimento)}`
  )
  fecharSecao()

  // ── SEÇÃO 7: ASSINATURA ───────────────────────────────────────────────────
  garantirEspaco(38)

  doc.setFillColor(...COR_FUNDO_SEC)
  doc.rect(0, y - 5, largura, 8, 'F')
  doc.setFillColor(...COR_VERMELHO)
  doc.rect(0, y - 5, 3, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COR_VERMELHO)
  doc.text('7. ASSINATURA DIGITAL', margemX + 2, y)
  y += 6

  if (dados.assinaturaDataUrl) {
    try {
      doc.addImage(dados.assinaturaDataUrl, 'PNG', margemX, y, 75, 25)
      y += 28
    } catch (e) {
      console.error('[pdf.js] addImage assinatura:', e)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COR_MUTED)
      doc.text('Assinatura digital nao pode ser renderizada.', margemX, y)
      y += 6
    }
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COR_MUTED)
    doc.text('Assinatura digital nao informada.', margemX, y)
    y += 6
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...COR_MUTED)
  doc.text(`Assinado digitalmente em ${formatarDataHora(assinadoEm)}`, margemX, y)
  y += 4.5

  if (y > 280) {
    console.warn(`[pdf.js] yPos final = ${y.toFixed(1)}mm — excede 280mm`)
  }

  // ── RODAPÉ ─────────────────────────────────────────────────────────────────
  const yRodape = altura - 14

  doc.setDrawColor(...COR_BORDA)
  doc.setLineWidth(0.3)
  doc.line(margemX, yRodape - 4, largura - margemX, yRodape - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COR_MUTED)

  const protocolo = registroId.substring(0, 8).toUpperCase()
  doc.text(`Protocolo: ${protocolo}`, margemX, yRodape)
  doc.text('portalsinteenp.org', largura / 2, yRodape, { align: 'center' })
  doc.text(`Gerado em: ${formatarDataHora(geradoEm)}`, largura - margemX, yRodape, { align: 'right' })

  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(`ID: ${registroId}`, margemX, yRodape + 5)

  return doc.output('blob')
}
