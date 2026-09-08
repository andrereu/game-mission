// Health check LEVE e SANITIZADO da IA de combinação.
//
// - NUNCA dispara geração (nada de chamada paga ao provedor).
// - NUNCA expõe chave, nome de segredo sensível nem detalhe interno.
// - Só informa se o recurso está CONFIGURADO neste ambiente. O cliente
//   (src/ui/rede.js) combina isto com navigator.onLine, com o próprio
//   sucesso/falha ao alcançar este endpoint e com o resultado das gerações
//   reais para decidir o estado (verificando / online / offline).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).end();
    return;
  }
  const configurado = Boolean(process.env.GEMINI_API_KEY);
  res.status(200).json({ disponivel: configurado });
}
